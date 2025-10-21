/***********************
 *  CONFIG
 ***********************/
const CFG = (() => {
  const props = PropertiesService.getScriptProperties();
  return {
    TOKEN: props.getProperty('PIPEDRIVE_API_TOKEN') || '592fa4db75e415cbb9e8bebbee497e3c24527f16',
    BASE: props.getProperty('PIPEDRIVE_BASE_URL') || 'https://api.pipedrive.com/v1',
    TZ: props.getProperty('TIMEZONE') || 'America/Sao_Paulo',
  };
})();

if (!CFG.TOKEN) {
  throw new Error('Defina PIPEDRIVE_API_TOKEN nas Propriedades do Script.');
}

const ACTIVITY_TYPE_KEY = (PropertiesService.getScriptProperties().getProperty('ACTIVITY_TYPE_KEY') || 'escritura');

const FIELD_KEYS = {
  dataTerminoTriagem: 'fb1aa427746a8e05d6dadc6eccfc51dd1cdc992d',
  dataTerminoIPTU: '46f5eea72dbdcd18c9c19d2ddee73bff046fc14b',
  statusIPTU: 'f6e1f351857746dc37fbf68c57946dc98a8a5d65',
  iptuResponsabilidade: 'f3fa85b1fa8b1d474df7e2ddc35d703fcf7cb3de'
};

const STATUS_IDS = {
  IPTU: {
    INICIAR: '1079',
    BOLETO_ENVIADO: '209',
    PENDENCIA_DOCUMENTAL: '235',
    ATESTE_RECEBIDO: '172',
    SOLICITAR_CND: '587',
    CND_SALVA_DRIVE: '143'
  }
};

const RESPONSABILIDADE_IDS = {
  ARREMATANTE: '363',
  CAIXA: '364'
};

/***********************
 *  CACHE DE PRIORIDADES
 ***********************/
if (typeof PRIORITY_IDS_CACHE === 'undefined') {
  var PRIORITY_IDS_CACHE = null;
}

function getPriorityIds_() {
  if (PRIORITY_IDS_CACHE) return PRIORITY_IDS_CACHE;
  
  try {
    const resp = pd_('/activityFields');
    if (resp && resp.data) {
      const priorityField = resp.data.find(f => f.key === 'priority');
      
      if (priorityField && priorityField.options && Array.isArray(priorityField.options)) {
        const options = {};
        priorityField.options.forEach(opt => {
          const label = String(opt.label || '').toLowerCase();
          if (label.includes('high') || label.includes('alta') || label.includes('alto')) {
            options.HIGH = opt.id;
          } else if (label.includes('medium') || label.includes('média') || label.includes('medio')) {
            options.MEDIUM = opt.id;
          } else if (label.includes('low') || label.includes('baixa') || label.includes('bajo')) {
            options.LOW = opt.id;
          }
        });
        
        PRIORITY_IDS_CACHE = options;
        Logger.log('🎯 IDs de prioridade carregados: ' + JSON.stringify(options));
        return options;
      }
    }
  } catch (err) {
    Logger.log('⚠️ Erro ao buscar prioridades, usando fallback: ' + err.message);
  }
  
  PRIORITY_IDS_CACHE = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  return PRIORITY_IDS_CACHE;
}

function getPriorityValue_(priority) {
  const ids = getPriorityIds_();
  
  switch(priority) {
    case 'high':
      return ids.HIGH || 2;
    case 'medium':
      return ids.MEDIUM || 1;
    case 'low':
      return ids.LOW || 0;
    default:
      return ids.MEDIUM || 1;
  }
}

/***********************
 *  DATAS (TZ-LOCAL)
 ***********************/
function tzToday_() {
  const now = new Date();
  const str = Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd');
  return new Date(str + 'T00:00:00');
}
function parseLocalDate_(yyyy_mm_dd) { return new Date(yyyy_mm_dd + 'T00:00:00'); }
function addDays_(date, days) { const d = new Date(date.getTime()); d.setDate(d.getDate() + days); return d; }
function diffDays_(startDate, endDate) { return Math.floor((endDate - startDate) / 86400000); }
function ymd_(date) { return Utilities.formatDate(date, CFG.TZ, 'yyyy-MM-dd'); }
function isWeekend_(date) { const dow = date.getDay(); return dow === 0 || dow === 6; }
function nextBusinessDay_(date) {
  let d = new Date(date.getTime());
  while (isWeekend_(d)) d = addDays_(d, 1);
  return d;
}

/***********************
 *  HELPERS DE STATUS
 ***********************/
function normalizeStatus_(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim().toLowerCase();
  if (!s) return '';
  const s2 = s.replace(/^\d+[\.\-\s]+/, '').trim();
  return s2;
}

function isIniciar_(v) {
  if (!v) return false;
  const vStr = String(v).trim();
  
  if (STATUS_IDS.IPTU.INICIAR && vStr === String(STATUS_IDS.IPTU.INICIAR)) {
    return true;
  }
  
  const s = normalizeStatus_(v);
  return s === 'iniciar';
}

function isResponsabilidadeCaixa_(v) {
  if (!v) return false;
  const vStr = String(v).trim();
  return vStr === String(RESPONSABILIDADE_IDS.CAIXA);
}

function isResponsabilidadeArrematante_(v) {
  if (!v) return false;
  const vStr = String(v).trim();
  return vStr === String(RESPONSABILIDADE_IDS.ARREMATANTE);
}

/***********************
 *  HTTP PIPEDRIVE
 ***********************/
function pd_(path, opt) {
  const url = CFG.BASE + path + (path.includes('?') ? '&' : '?') + 'api_token=' + encodeURIComponent(CFG.TOKEN);
  const params = Object.assign({ method: 'get', muteHttpExceptions: true, contentType: 'application/json' }, opt || {});
  const res = UrlFetchApp.fetch(url, params);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('PD ' + (params.method || 'GET') + ' ' + path + ' ' + code + ': ' + res.getContentText());
  return JSON.parse(res.getContentText());
}

/***********************
 *  NEGÓCIOS ELEGÍVEIS
 ***********************/
function fetchCandidateDeals_() {
  const resp = pd_('/deals?limit=500&status=open');
  const deals = resp.data || [];
  return deals.filter(d => {
    const statusIPTU = String(d[FIELD_KEYS.statusIPTU] || '').trim();
    
    return (
      d[FIELD_KEYS.dataTerminoTriagem] && 
      !d[FIELD_KEYS.dataTerminoIPTU] &&
      d[FIELD_KEYS.statusIPTU] &&
      d[FIELD_KEYS.iptuResponsabilidade] &&
      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE
    );
  });
}

/***********************
 *  ATIVIDADES: LISTAGEM E EXISTÊNCIA
 ***********************/
function listActivitiesAll_(dealId) {
  const all = [];
  const limit = 200;

  let start = 0;
  while (true) {
    const r = pd_(`/activities?deal_id=${dealId}&done=0&start=${start}&limit=${limit}`);
    const arr = r.data || [];
    all.push.apply(all, arr);
    const pg = r.additional_data && r.additional_data.pagination;
    if (!pg || !pg.more_items_in_collection) break;
    start = pg.next_start;
  }

  start = 0;
  while (true) {
    const r = pd_(`/activities?deal_id=${dealId}&done=1&start=${start}&limit=${limit}`);
    const arr = r.data || [];
    all.push.apply(all, arr);
    const pg = r.additional_data && r.additional_data.pagination;
    if (!pg || !pg.more_items_in_collection) break;
    start = pg.next_start;
  }

  return all;
}

function normalizeSubject_(s) {
  return String(s || '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function activityExistsStrong_({ dealId, subject, dueDateYmd, dueTime }) {
  const subjN = normalizeSubject_(subject);
  const list = listActivitiesAll_(dealId);
  return list.some(a => {
    const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY);
    const sameDue  = (String(a.due_date || '') === String(dueDateYmd));
    const sameTime = (String(a.due_time || '') === String(dueTime));
    const sameSubj = (normalizeSubject_(a.subject) === subjN);
    return sameType && sameDue && sameTime && sameSubj;
  });
}

function activityExistsBySubjectType_({ dealId, subject }) {
  const subjN = normalizeSubject_(subject);
  const list = listActivitiesAll_(dealId);
  return list.some(a => {
    const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY);
    const sameSubj = (normalizeSubject_(a.subject) === subjN);
    return sameType && sameSubj;
  });
}

/***********************
 *  FORMATAÇÃO DO NOTE
 ***********************/
function escapeHtml_(s) {
  return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}
function formatNote_(rawNote) {
  var s = String(rawNote || '').replace(/\r\n?/g, '\n');
  s = s.replace(/—\s*Lembre-se:/gi, 'Observação:');
  var lines = s.split('\n');
  var out = [];
  for (var i=0;i<lines.length;i++){
    var raw = lines[i];
    if (raw.trim()===''){ out.push('<br/>'); continue; }
    var content = raw.replace(/^\s*[•◉\-—–→]\s*/, '').trimEnd();
    var bullet = /^Observa[cç][aã]o:/i.test(content) ? '' : '• ';
    out.push('<p>'+bullet+escapeHtml_(content)+'</p>');
  }
  return out.join('');
}

/***********************
 *  TABELAS DE CONTEÚDO
 ***********************/
const TXT = {
  IPTU_CEF: {
    INICIAL: {
      1: `Enviar mensagem inicial ao cliente.
Localizar inscrição municipal e preencher na lateral do pipe.
Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.
Registrar os meios que tiveram retorno ("frutíferos").`,
      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.
Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,
      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.
Caso negativo, confirmar com o cliente o interesse na diligência presencial.
Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,
      6: `Enviar a mensagem padrão de confirmação de emissão.
Lembrar de preencher os campos "IPTU: Valor da Dívida".
Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,
      7: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas (lembre-se de validar se a responsabilidade de pagamento é de fato do CEF através da proposta).
Em caso de CND, salavar no Google Drive e finalizar o imóvel.
Enviar a mensagem padrão de envio da documentação.`,
      9: `Confirmar se os boletos foram enviados para a CEF.
Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,
      10: `Confirmar se os boletos foram enviados para a CEF.
Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,
      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.
Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.
Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`
    },
    BOLETO_ENVIADO: {
      5: `Verificar se a CEF enviou retorno quanto ao boleto anexado.
Em caso de análise documental, atualizar o pipe, enviar mensagem padrão de Análise Documental para o cliente e tomar as medidas necessárias para corrigir a documentação e protocolar novamente em 3 dias úteis.
Em caso de Ateste, atualizar o pipe, enviar mensagem padrão de Ateste para o cliente.`
    },
    SOLICITAR_CND: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.
Enviar a mensagem padrão de finalização de processo para o cliente.`
    },
    PENDENCIA_DOCUMENTAL: {
      3: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas garantindo que as pendências foram atendindas.
Enviar a mensagem padrão de resposta de Análise Documental anexada para o cliente`
    },
    ATESTE_RECEBIDO: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades
Enviar a mensagem padrão de finalização de processo para o cliente.`
    }
  },
  IPTU_CLIENTE: {
    INICIAL: {
      1: `Enviar mensagem inicial ao cliente.
Localizar inscrição municipal e preencher na lateral do pipe.
Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.
Registrar os meios que tiveram retorno ("frutíferos").`,
      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.
Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,
      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.
Caso negativo, confirmar com o cliente o interesse na diligência presencial.
Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,
      6: `Enviar a mensagem padrão de confirmação de emissão.
Lembrar de preencher os campos "IPTU: Valor da Dívida"
Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,
      7: `Enviar o bloeto para o cliente quitar (lembre-se de validar se a responsabilidade de pagamento é de fato do cliente através da proposta).
Em caso de CND, salavar no Google Drive e finalizar o imóvel.
Enviar a mensagem padrão de envio da documentação.`,
      9: `Confirmar se os boletos foram enviados para o cliente.
Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,
      10: `Confirmar se os boletos foram enviados para o cliente.
Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,
      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.
Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.
Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`
    },
    BOLETO_ENVIADO: {
      3: `Verificar o cliente pagou o boleto enviado.
Caso ele informe que não irá realizar o pagamento por motivos que não são de nossa responsabilidade, como por exemplo: após a venda, após registro, etc, enviar ao cliente a mensagem padrrão de conclusão do processo sem CND por impedimento do cliente e concluir o imóvel com o status "03. Negociação pelo cliente".
Caso o cliente tenha realizado o pagamento, solicitar CND e enviar a mensagem padrão de CND Solicitada.`
    },
    SOLICITAR_CND: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.
Enviar a mensagem padrão de finalização de processo para o cliente.`
    }
  }
};

const TITLE_IPTU_CEF_INICIAL = { 
  1:'INICIAR',
  2:'TENTATIVAS VIRTUAIS',
  4:'VERIFICAR NECESSIDADE DE DILIGÊNCIA',
  6:'CONFIRMAÇÃO DE EMISSÃO',
  7:'ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO',
  9:'ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA',
  10:'ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO',
  11:'SINAL DE RISCO: PRAZO ESTOURADO'
};

const TITLE_IPTU_CLIENTE_INICIAL = { 
  1:'INICIAR',
  2:'TENTATIVAS VIRTUAIS',
  4:'VERIFICAR NECESSIDADE DE DILIGÊNCIA',
  6:'CONFIRMAÇÃO DE EMISSÃO',
  7:'ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO',
  9:'ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA',
  10:'ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO',
  11:'SINAL DE RISCO: PRAZO ESTOURADO'
};

const PRIORITY_MAP = {
  IPTU_CEF_INICIAL:        { high:new Set([1,7,10,11]), medium:new Set([2,4,9]), low:new Set([6]) },
  IPTU_CEF_BOLETO:         { high:new Set(),            medium:new Set([5]),     low:new Set() },
  IPTU_CEF_SOLICITAR:      { high:new Set(),            medium:new Set(),        low:new Set([7]) },
  IPTU_CEF_PENDENCIA:      { high:new Set(),            medium:new Set([3]),     low:new Set() },
  IPTU_CEF_ATESTE:         { high:new Set(),            medium:new Set(),        low:new Set([7]) },
  IPTU_CLIENTE_INICIAL:    { high:new Set([1,7,10,11]), medium:new Set([2,4,9]), low:new Set([6]) },
  IPTU_CLIENTE_BOLETO:     { high:new Set(),            medium:new Set([3]),     low:new Set() },
  IPTU_CLIENTE_SOLICITAR:  { high:new Set(),            medium:new Set(),        low:new Set([7]) }
};

function getPriority_(planKey, day){
  const pm = PRIORITY_MAP[planKey];
  if (!pm) return 'low';
  if (pm.high.has(day)) return 'high';
  if (pm.medium.has(day)) return 'medium';
  if (pm.low.has(day)) return 'low';
  return 'low';
}

const PLAN = {
  IPTU_CEF_INICIAL: {
    days: [
      { day: 1, hour: 9 },
      { day: 2, hour: 10 },
      { day: 4, hour: 11 },
      { day: 6, hour: 12 },
      { day: 7, hour: 13 },
      { day: 9, hour: 14 },
      { day: 10, hour: 15 },
      { day: 11, hour: 16 }
    ],
    title: (d) => `IPTU - ${d} DIA${d>1?'S':''} - ${TITLE_IPTU_CEF_INICIAL[d]}`,
    note: (d) => formatNote_(TXT.IPTU_CEF.INICIAL[d])
  },
  IPTU_CEF_BOLETO: {
    days: [
      { day: 5, hour: 10 }
    ],
    title: (d) => `IPTU - VERIFICAR RETORNO DA CEF SOBRE O BOLETO ENVIADO`,
    note: (d) => formatNote_(TXT.IPTU_CEF.BOLETO_ENVIADO[d])
  },
  IPTU_CEF_SOLICITAR: {
    days: [
      { day: 7, hour: 11 }
    ],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CEF.SOLICITAR_CND[d])
  },
  IPTU_CEF_PENDENCIA: {
    days: [
      { day: 3, hour: 11 }
    ],
    title: (d) => `IPTU - ENVIAR DOCUMENTAÇÃO CORRIGIDA PARA A CEF`,
    note: (d) => formatNote_(TXT.IPTU_CEF.PENDENCIA_DOCUMENTAL[d])
  },
  IPTU_CEF_ATESTE: {
    days: [
      { day: 7, hour: 11 }
    ],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CEF.ATESTE_RECEBIDO[d])
  },
  IPTU_CLIENTE_INICIAL: {
    days: [
      { day: 1, hour: 9 },
      { day: 2, hour: 10 },
      { day: 4, hour: 11 },
      { day: 6, hour: 12 },
      { day: 7, hour: 13 },
      { day: 9, hour: 14 },
      { day: 10, hour: 15 },
      { day: 11, hour: 16 }
    ],
    title: (d) => `IPTU - ${d} DIA${d>1?'S':''} - ${TITLE_IPTU_CLIENTE_INICIAL[d]}`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.INICIAL[d])
  },
  IPTU_CLIENTE_BOLETO: {
    days: [
      { day: 3, hour: 10 }
    ],
    title: (d) => `IPTU - VERIFICAR SE O CLIENTE PAGOU O BOLETO`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.BOLETO_ENVIADO[d])
  },
  IPTU_CLIENTE_SOLICITAR: {
    days: [
      { day: 7, hour: 11 }
    ],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.SOLICITAR_CND[d])
  }
};

/***********************
 *  DECIDIR PLANOS A CRIAR
 ***********************/
function getPlansToCreate_(deal) {
  const plans = [];
  const statusIPTU = deal[FIELD_KEYS.statusIPTU];
  const statusIPTUStr = String(statusIPTU || '').trim();
  const responsabilidade = deal[FIELD_KEYS.iptuResponsabilidade];

  // Bloqueia se CND já foi salva
  if (statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    return plans;
  }

  if (isIniciar_(statusIPTU)) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push('IPTU_CEF_INICIAL');
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push('IPTU_CLIENTE_INICIAL');
    }
  }
  
  if (statusIPTUStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push('IPTU_CEF_BOLETO');
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push('IPTU_CLIENTE_BOLETO');
    }
  }
  
  if (statusIPTUStr === STATUS_IDS.IPTU.SOLICITAR_CND) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push('IPTU_CEF_SOLICITAR');
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push('IPTU_CLIENTE_SOLICITAR');
    }
  }
  
  if (statusIPTUStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push('IPTU_CEF_PENDENCIA');
    }
  }
  
  if (statusIPTUStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push('IPTU_CEF_ATESTE');
    }
  }

  return plans;
}

/***********************
 *  CRIAÇÃO DE ATIVIDADE
 ***********************/
function createActivity_({ deal, subject, note, dueDate, dueTime, priority }) {
  const dueBday = nextBusinessDay_(dueDate);
  const dueY = ymd_(dueBday);

  if (activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime })) {
    Logger.log('⊘ Já existe: %s | %s %s', subject, dueY, dueTime);
    return;
  }

  const priorityValue = getPriorityValue_(priority);

  const body = {
    subject: subject,
    type: ACTIVITY_TYPE_KEY,
    done: 0,
    deal_id: deal.id,
    due_date: dueY,
    due_time: dueTime,
    duration: '01:00',
    note: note || '',
    busy_flag: true,
    priority: priorityValue
  };

  if (deal.user_id && deal.user_id.id) {
    body.user_id = deal.user_id.id;
  }
  if (deal.person_id && deal.person_id.value) {
    body.person_id = deal.person_id.value;
  }
  if (deal.org_id && deal.org_id.value) {
    body.org_id = deal.org_id.value;
  }

  Logger.log('🔨 Criando: %s | %s %s | Prio: %s (ID=%s)', subject, dueY, dueTime, priority, priorityValue);

  try {
    const result = pd_('/activities', { 
      method: 'post', 
      payload: JSON.stringify(body) 
    });

    if (result && result.data && result.data.id) {
      Logger.log('  ✅ Criada ID: %s', result.data.id);
      Logger.log('  📊 Priority retornada: %s', result.data.priority);
    }
  } catch (err) {
    Logger.log('  ❌ Erro: %s', err.message);
    throw err;
  }
}

/***********************
 *  EXECUTOR PRINCIPAL
 ***********************/
function tick() {
  const today = tzToday_();
  const deals = fetchCandidateDeals_();

  let created = 0, skipped = 0, checked = 0;

  deals.forEach((deal) => {
    checked++;

    const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];
    if (!baseStr) return;

    const baseDate = parseLocalDate_(baseStr);
    const dx = diffDays_(baseDate, today);

    const plans = getPlansToCreate_(deal);
    if (!plans.length) return;

    for (const planKey of plans) {
      const pl = PLAN[planKey];
      const dayConfigs = pl.days.slice();

      const isStatusChange = !planKey.includes('INICIAL');
      
      if (isStatusChange) {
        dayConfigs.forEach((config) => {
          const d = config.day;
          const hour = config.hour;
          const subject  = pl.title(d);
          const note     = pl.note(d);
          const priority = getPriority_(planKey, d);
          const dueRaw   = addDays_(today, d);
          const dueBday  = nextBusinessDay_(dueRaw);
          const dueTime  = String(hour).padStart(2, '0') + ':00';

          if (!activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: ymd_(dueBday), dueTime }) && 
              !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
            createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
            created++;
          } else {
            skipped++;
          }
        });
      } else {
        dayConfigs.forEach((config) => {
          const d = config.day;
          const hour = config.hour;
          const dueRaw = addDays_(baseDate, d);
          const dueBday = nextBusinessDay_(dueRaw);
          
          if (dueBday <= today) {
            const subject  = pl.title(d);
            const note     = pl.note(d);
            const priority = getPriority_(planKey, d);
            const dueTime  = String(hour).padStart(2, '0') + ':00';

            if (!activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: ymd_(dueBday), dueTime }) && 
                !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
              createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
              created++;
            } else {
              skipped++;
            }
          }
        });
        
        const nextConfig = dayConfigs.find(cfg => {
          const dueRaw = addDays_(baseDate, cfg.day);
          const dueBday = nextBusinessDay_(dueRaw);
          return dueBday > today;
        });
        
        if (nextConfig) {
          const nextD = nextConfig.day;
          const nextHour = nextConfig.hour;
          const subjectN  = pl.title(nextD);
          const noteN     = pl.note(nextD);
          const priorityN = getPriority_(planKey, nextD);
          const dueRawN   = addDays_(baseDate, nextD);
          const dueBdayN  = nextBusinessDay_(dueRawN);
          const dueTimeN  = String(nextHour).padStart(2, '0') + ':00';

          if (!activityExistsStrong_({ dealId: deal.id, subject: subjectN, dueDateYmd: ymd_(dueBdayN), dueTime: dueTimeN }) && 
              !activityExistsBySubjectType_({ dealId: deal.id, subject: subjectN })) {
            createActivity_({ deal, subject: subjectN, note: noteN, dueDate: dueBdayN, dueTime: dueTimeN, priority: priorityN });
            created++;
          } else {
            skipped++;
          }
        }
      }
    }
  });

  Logger.log(JSON.stringify({ ok:true, created, skipped, checked, date: ymd_(today) }));
}

/***********************
 *  FUNÇÃO DE TESTE
 ***********************/
function testarNegocio(id) {
  const DEAL_ID = id || 11176;
  const today = tzToday_();
  
  Logger.log('=== TESTE DO NEGÓCIO %s ===', DEAL_ID);
  Logger.log('Data de hoje: %s\n', ymd_(today));
  
  Logger.log('🔍 Carregando IDs de prioridade do Pipedrive...');
  const priorityIds = getPriorityIds_();
  Logger.log('✅ IDs carregados: %s\n', JSON.stringify(priorityIds));
  
  const dealResp = pd_('/deals/' + DEAL_ID);
  const deal = dealResp && dealResp.data;
  
  if (!deal) { 
    Logger.log('❌ Negócio %s não encontrado.', DEAL_ID); 
    return; 
  }

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];
  const hasTerminoIPTU = !!deal[FIELD_KEYS.dataTerminoIPTU];
  const statusIPTUStr = String(deal[FIELD_KEYS.statusIPTU] || '').trim();
  
  if (!baseStr || hasTerminoIPTU || statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    Logger.log('❌ Elegibilidade falhou:');
    Logger.log('   Data Término Triagem: %s', baseStr ? '✅' : '❌');
    Logger.log('   IPTU finalizado: %s', hasTerminoIPTU ? '❌ SIM' : '✅ NÃO');
    Logger.log('   CND salva no Drive: %s', statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE ? '❌ SIM' : '✅ NÃO');
    return;
  }

  const baseDate = parseLocalDate_(baseStr);
  const dx = diffDays_(baseDate, today);
  
  Logger.log('📅 Data Término Triagem: %s', ymd_(baseDate));
  Logger.log('📊 Dias desde término da triagem: %s\n', dx);

  const plans = getPlansToCreate_(deal);
  
  if (!plans.length) {
    Logger.log('❌ Sem planos a criar para deal %s', DEAL_ID);
    Logger.log('Motivo: Status não mapeado, responsabilidade não definida ou CND já salva\n');
    
    Logger.log('Status atual:');
    Logger.log('  • Status IPTU: %s', deal[FIELD_KEYS.statusIPTU] || '(vazio)');
    Logger.log('  • Responsabilidade: %s', deal[FIELD_KEYS.iptuResponsabilidade] || '(vazio)');
    Logger.log('\nStatus mapeados:');
    Logger.log('  • INICIAR: %s', STATUS_IDS.IPTU.INICIAR);
    Logger.log('  • BOLETO_ENVIADO: %s', STATUS_IDS.IPTU.BOLETO_ENVIADO);
    Logger.log('  • PENDENCIA_DOCUMENTAL: %s', STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL);
    Logger.log('  • ATESTE_RECEBIDO: %s', STATUS_IDS.IPTU.ATESTE_RECEBIDO);
    Logger.log('  • SOLICITAR_CND: %s', STATUS_IDS.IPTU.SOLICITAR_CND);
    Logger.log('  • CND_SALVA_DRIVE (bloqueador): %s', STATUS_IDS.IPTU.CND_SALVA_DRIVE);
    return;
  }

  Logger.log('✅ Planos identificados: %s\n', plans.join(', '));

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const planKey of plans) {
    Logger.log('--- Processando plano: %s ---', planKey);
    const pl = PLAN[planKey];
    const dayConfigs = pl.days.slice();

    const isStatusChange = !planKey.includes('INICIAL');
    
    if (isStatusChange) {
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const s = pl.title(d);
        const n = pl.note(d);
        const p = getPriority_(planKey, d);
        const pValue = getPriorityValue_(p);
        const dueRaw = addDays_(today, d);
        const dueB = nextBusinessDay_(dueRaw);
        const dueY = ymd_(dueB);
        const dueTime = String(hour).padStart(2, '0') + ':00';
        
        if (!activityExistsStrong_({ dealId: DEAL_ID, subject: s, dueDateYmd: dueY, dueTime }) && 
            !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })) {
          createActivity_({ deal, subject: s, note: n, dueDate: dueB, dueTime, priority: p });
          Logger.log('  ✔ Status Change: +%s dias %s | %s | prio %s (ID=%s)', d, dueTime, s, p, pValue);
          totalCreated++;
        } else {
          Logger.log('  ⊘ Já existe: +%s dias %s | %s', d, dueTime, s);
          totalSkipped++;
        }
      });
    } else {
      Logger.log('  📋 Criando atividades passadas (backlog):');
      
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        
        if (dueBday <= today) {
          const s = pl.title(d);
          const n = pl.note(d);
          const p = getPriority_(planKey, d);
          const pValue = getPriorityValue_(p);
          const dueY = ymd_(dueBday);
          const dueTime = String(hour).padStart(2, '0') + ':00';
          
          if (!activityExistsStrong_({ dealId: DEAL_ID, subject: s, dueDateYmd: dueY, dueTime }) && 
              !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })) {
            createActivity_({ deal, subject: s, note: n, dueDate: dueBday, dueTime, priority: p });
            Logger.log('  ✔ Backlog: D+%s vence %s %s | %s | prio %s (ID=%s)', d, dueY, dueTime, s, p, pValue);
            totalCreated++;
          } else {
            Logger.log('  ⊘ Já existe: D+%s vence %s %s | %s', d, dueY, dueTime, s);
            totalSkipped++;
          }
        }
      });
      
      Logger.log('  📋 Criando próxima atividade futura:');
      
      const nextConfig = dayConfigs.find(cfg => {
        const dueRaw = addDays_(baseDate, cfg.day);
        const dueBday = nextBusinessDay_(dueRaw);
        return dueBday > today;
      });
      
      if (nextConfig) {
        const nextD = nextConfig.day;
        const nextHour = nextConfig.hour;
        const sN = pl.title(nextD);
        const nN = pl.note(nextD);
        const pN = getPriority_(planKey, nextD);
        const pValueN = getPriorityValue_(pN);
        const dueRawN = addDays_(baseDate, nextD);
        const dueBN = nextBusinessDay_(dueRawN);
        const dueYN = ymd_(dueBN);
        const dueTimeN = String(nextHour).padStart(2, '0') + ':00';
        
        if (!activityExistsStrong_({ dealId: DEAL_ID, subject: sN, dueDateYmd: dueYN, dueTime: dueTimeN }) && 
            !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: sN })) {
          createActivity_({ deal, subject: sN, note: nN, dueDate: dueBN, dueTime: dueTimeN, priority: pN });
          Logger.log('  ✔ Próxima: D+%s vence %s %s | %s | prio %s (ID=%s)', nextD, dueYN, dueTimeN, sN, pN, pValueN);
          totalCreated++;
        } else {
          Logger.log('  ⊘ Já existe: D+%s vence %s %s | %s', nextD, dueYN, dueTimeN, sN);
          totalSkipped++;
        }
      }
    }
    
    Logger.log('');
  }
  
  Logger.log('=== RESUMO ===');
  Logger.log('✅ Atividades criadas: %s', totalCreated);
  Logger.log('⊘ Atividades puladas: %s', totalSkipped);
  Logger.log('🎯 Total processado: %s', totalCreated + totalSkipped);
  Logger.log('\n=== FIM DO TESTE ===');
}