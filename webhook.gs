/***********************
 *  WEBHOOK HANDLER - IPTU FINAL
 ***********************/

const SHEET_ID = '1PL0xop3gHQA6ryjtmgHaCara28Ei7QMFvDzVfI414bk';
const SHEET_LOG = 'WebhookLog';
const SHEET_ERR = 'WebhookErrors';

const CREATED_ACTIVITIES_CACHE = {};
const PROCESSING_LOCK = PropertiesService.getScriptProperties();
const CACHE_LOCK = CacheService.getScriptCache();

const DEBOUNCE_SECONDS = 15;
const GLOBAL_COOLDOWN_MINUTES = 2;
const CACHE_LOCK_SECONDS = 30;

const ALLOWED_DEAL_ID = 11176;

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

const CFG = {
  TOKEN: '592fa4db75e415cbb9e8bebbee497e3c24527f16',
  BASE: 'https://api.pipedrive.com/v1',
  TZ: 'America/Sao_Paulo'
};

const ACTIVITY_TYPE_KEY = 'escritura';

/***********************
 *  PROTEÇÃO DE ENTRADA
 ***********************/
function canProcessDeal_(dealId, statusChange) {
  const cacheKey = `PROC_${dealId}_${statusChange}`;
  const isProcessing = CACHE_LOCK.get(cacheKey);
  
  if (isProcessing) {
    Logger.log('[Deal %s] 🚫 BLOQUEADO - Processamento em andamento para %s', dealId, statusChange);
    return false;
  }
  
  CACHE_LOCK.put(cacheKey, 'true', CACHE_LOCK_SECONDS);
  Logger.log('[Deal %s] ✅ Permitido processar %s', dealId, statusChange);
  return true;
}

function releaseCacheLock_(dealId, statusChange) {
  const cacheKey = `PROC_${dealId}_${statusChange}`;
  CACHE_LOCK.remove(cacheKey);
  Logger.log('[Deal %s] 🔓 Cache lock liberado para %s', dealId, statusChange);
}

/***********************
 *  CONTROLE DE DUPLICAÇÃO
 ***********************/
function acquireProcessingLock_(dealId, statusChange) {
  const lockKey = `LOCK_${dealId}_${statusChange}`;
  const now = new Date().getTime();
  
  try {
    const lastProcessed = PROCESSING_LOCK.getProperty(lockKey);
    
    if (lastProcessed) {
      const diffSeconds = (now - parseInt(lastProcessed)) / 1000;
      
      if (diffSeconds < DEBOUNCE_SECONDS) {
        Logger.log('[Deal %s] ⏸️ LOCK ATIVO - Ignorando (processado há %ss)', dealId, diffSeconds.toFixed(1));
        return false;
      }
    }
    
    PROCESSING_LOCK.setProperty(lockKey, String(now));
    Logger.log('[Deal %s] 🔒 Lock adquirido para %s', dealId, statusChange);
    return true;
    
  } catch (err) {
    Logger.log('[Deal %s] ⚠️ Erro ao verificar lock: %s', dealId, err.message);
    return false;
  }
}

function releaseProcessingLock_(dealId, statusChange) {
  const lockKey = `LOCK_${dealId}_${statusChange}`;
  try {
    PROCESSING_LOCK.deleteProperty(lockKey);
    Logger.log('[Deal %s] 🔓 Lock liberado para %s', dealId, statusChange);
  } catch (err) {
    Logger.log('[Deal %s] ⚠️ Erro ao liberar lock: %s', dealId, err.message);
  }
}

function isDealRecentlyProcessed_(dealId) {
  const globalKey = `GLOBAL_PROCESSED_${dealId}`;
  const lastTime = PROCESSING_LOCK.getProperty(globalKey);
  
  if (lastTime) {
    const diffMinutes = (new Date().getTime() - parseInt(lastTime)) / 60000;
    if (diffMinutes < GLOBAL_COOLDOWN_MINUTES) {
      Logger.log('[Deal %s] ⏸️ Processado recentemente (há %.1f min)', dealId, diffMinutes);
      return true;
    }
  }
  
  return false;
}

function markDealAsProcessed_(dealId) {
  const globalKey = `GLOBAL_PROCESSED_${dealId}`;
  PROCESSING_LOCK.setProperty(globalKey, String(new Date().getTime()));
  Logger.log('[Deal %s] ✅ Marcado como processado globalmente', dealId);
}

/***********************
 *  DATAS
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
 *  HELPERS
 ***********************/
function normalizeSubject_(s) {
  return String(s || '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isIniciar_(v) {
  if (!v) return false;
  const vStr = String(v).trim();
  return vStr === String(STATUS_IDS.IPTU.INICIAR);
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
 *  ATIVIDADES
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
 *  PRIORIDADES
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
        return options;
      }
    }
  } catch (err) {
    Logger.log('⚠️ Erro ao buscar prioridades: ' + err.message);
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
 *  FORMATAÇÃO
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
 *  CONTEÚDO
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
    }
  } catch (err) {
    Logger.log('  ❌ Erro: %s', err.message);
    throw err;
  }
}

/***********************
 *  HANDLERS PRINCIPAIS
 ***********************/
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    
    if (!raw) throw new Error('Evento sem corpo postData');

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      throw new Error('JSON inválido: ' + err.message);
    }

    const meta = payload.meta || {};
    const current = payload.data || payload.current || {};
    const previous = payload.previous || {};

    const action = meta.action || '';
    const entity = meta.object || meta.entity || '';
    const dealId = current.id || '';
    const title = current.title || '';

    if (String(dealId) !== String(ALLOWED_DEAL_ID)) {
      Logger.log('[Deal %s] ⚠️ Deal não permitido. Apenas deal %s é processado.', dealId, ALLOWED_DEAL_ID);
      return jsonOut_({ 
        ok: true, 
        skipped: 'deal_not_allowed', 
        dealId: dealId,
        message: `Apenas deal ${ALLOWED_DEAL_ID} é processado`
      });
    }

    if (entity === 'deal' && dealId) {
      
      let fullDeal = current;
      try {
        const r = pd_('/deals/' + dealId);
        if (r && r.data) fullDeal = r.data;
      } catch (_) {}

      if (!isDealEligible_(fullDeal)) {
        const reason = getIneligibilityReason_(fullDeal);
        
        Logger.log('[Deal %s] ⚠️ Não elegível: %s', dealId, reason);
        
        return jsonOut_({ 
          ok: true, 
          skipped: 'not_eligible', 
          dealId: dealId,
          reason: reason
        });
      }

      const statusChanges = detectStatusChanges_(fullDeal, previous);
      
      if (statusChanges.length === 0) {
        Logger.log('[Deal %s] ℹ️ Nenhuma mudança de status detectada', dealId);
        
        return jsonOut_({ ok:true, skipped:'no_valid_status_change', dealId });
      }

      const changeKey = statusChanges.map(c => c.plan).sort().join(',');
      
      Logger.log('[Deal %s] 🎯 Mudanças detectadas: %s', dealId, changeKey);
      
      if (!canProcessDeal_(dealId, changeKey)) {
        return jsonOut_({ 
          ok: true, 
          skipped: 'cache_lock', 
          dealId: dealId,
          message: 'Deal em processamento (cache lock)'
        });
      }
      
      if (isDealRecentlyProcessed_(dealId)) {
        releaseCacheLock_(dealId, changeKey);
        return jsonOut_({ 
          ok: true, 
          skipped: 'recently_processed', 
          dealId: dealId,
          message: 'Deal processado recentemente'
        });
      }

      if (!acquireProcessingLock_(dealId, changeKey)) {
        releaseCacheLock_(dealId, changeKey);
        return jsonOut_({ 
          ok: true, 
          skipped: 'debounce_lock', 
          dealId: dealId,
          reason: 'Processamento já em andamento'
        });
      }

      try {
        const result = processDealWebhook_(fullDeal, statusChanges);

        let atividadesTexto = 'Nenhuma';
        let detalhesTexto = '';
        
        if (result.created && result.created > 0) {
          atividadesTexto = result.createdActivities ? result.createdActivities.join('\n') : `${result.created} criada(s)`;
          detalhesTexto = `${result.created} criada(s)`;
          
          markDealAsProcessed_(dealId);
          
          Logger.log('[Deal %s] ✅ %d atividades criadas com sucesso', dealId, result.created);
        } else {
          detalhesTexto = result.skipped > 0 ? `${result.skipped} já existente(s)` : 'Nenhuma ação necessária';
          Logger.log('[Deal %s] ℹ️ %s', dealId, detalhesTexto);
        }

        appendLogToSheet_({
          timestamp: new Date(),
          dealId: dealId,
          title: title,
          action: 'Processamento IPTU',
          atividadesCriadas: atividadesTexto,
          detalhes: detalhesTexto
        });

        return jsonOut_({
          ok: true,
          processed: new Date().toISOString(),
          dealId: dealId,
          statusChanges: statusChanges,
          result: result
        });

      } finally {
        releaseProcessingLock_(dealId, changeKey);
        releaseCacheLock_(dealId, changeKey);
      }
    }

    return jsonOut_({
      ok: true,
      processed: new Date().toISOString(),
      action: action,
      entity: entity,
      dealId: dealId
    });

  } catch (err) {
    appendErrToSheet_('doPost', err, e);
    return jsonOut_({
      ok: false,
      error: String(err && err.message || err),
      timestamp: new Date().toISOString()
    });
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'online',
      service: 'Pipedrive Webhook Handler - IPTU FINAL',
      allowedDealId: ALLOWED_DEAL_ID,
      timestamp: new Date().toISOString(),
      statusIds: STATUS_IDS
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  VERIFICAÇÃO DE ELEGIBILIDADE
 ***********************/
function isDealEligible_(deal) {
  const statusIPTU = String(deal[FIELD_KEYS.statusIPTU] || '').trim();
  
  if (deal.status !== 'open') return false;
  if (!deal[FIELD_KEYS.dataTerminoTriagem]) return false;
  if (deal[FIELD_KEYS.dataTerminoIPTU]) return false;
  if (!deal[FIELD_KEYS.statusIPTU]) return false;
  if (!deal[FIELD_KEYS.iptuResponsabilidade]) return false;
  if (statusIPTU === STATUS_IDS.IPTU.CND_SALVA_DRIVE) return false;
  
  return true;
}

function getIneligibilityReason_(deal) {
  const statusIPTU = String(deal[FIELD_KEYS.statusIPTU] || '').trim();
  
  if (deal.status !== 'open') return 'Status ≠ "Aberto"';
  if (!deal[FIELD_KEYS.dataTerminoTriagem]) return 'Sem "Data Término Triagem"';
  if (deal[FIELD_KEYS.dataTerminoIPTU]) return 'IPTU já finalizado';
  if (statusIPTU === STATUS_IDS.IPTU.CND_SALVA_DRIVE) return 'CND já salva no Drive (processo finalizado)';
  if (!deal[FIELD_KEYS.statusIPTU]) return 'Sem status IPTU definido';
  if (!deal[FIELD_KEYS.iptuResponsabilidade]) return 'Sem responsabilidade IPTU definida';
  
  return 'Motivo desconhecido';
}

/***********************
 *  CACHE DE ATIVIDADES
 ***********************/
function activityWasJustCreated_(dealId, subject) {
  const key = `${dealId}_${normalizeSubject_(subject)}`;
  return CREATED_ACTIVITIES_CACHE[key] === true;
}

function markActivityAsCreated_(dealId, subject) {
  const key = `${dealId}_${normalizeSubject_(subject)}`;
  CREATED_ACTIVITIES_CACHE[key] = true;
}

/***********************
 *  DETECÇÃO DE MUDANÇAS
 ***********************/
function detectStatusChanges_(currentDeal, previousPayload) {
  const changes = [];
  
  const currentStatus = currentDeal[FIELD_KEYS.statusIPTU];
  const currentResp = currentDeal[FIELD_KEYS.iptuResponsabilidade];
  
  let previousStatus = null;
  if (previousPayload.custom_fields && previousPayload.custom_fields[FIELD_KEYS.statusIPTU] !== undefined) {
    previousStatus = previousPayload.custom_fields[FIELD_KEYS.statusIPTU];
  } else if (previousPayload[FIELD_KEYS.statusIPTU] !== undefined) {
    previousStatus = previousPayload[FIELD_KEYS.statusIPTU];
  }
  
  const currentStatusStr = String(currentStatus || '').trim();
  const previousStatusStr = String(previousStatus || '').trim();
  
  Logger.log('[Deal %s] 🔍 Comparando status: "%s" → "%s"', currentDeal.id, previousStatusStr, currentStatusStr);
  
  if (currentStatusStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    Logger.log('[Deal %s] 🛑 Status mudou para "CND salva no Drive" - processo finalizado', currentDeal.id);
    return changes;
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.INICIAR && previousStatusStr !== STATUS_IDS.IPTU.INICIAR) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({
        plan: 'IPTU_CEF_INICIAL',
        from: previousStatusStr || '(vazio)',
        to: 'iniciar_cef'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CEF: "%s" → "INICIAR"', currentDeal.id, previousStatusStr || '(vazio)');
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      changes.push({
        plan: 'IPTU_CLIENTE_INICIAL',
        from: previousStatusStr || '(vazio)',
        to: 'iniciar_cliente'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CLIENTE: "%s" → "INICIAR"', currentDeal.id, previousStatusStr || '(vazio)');
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO && previousStatusStr !== STATUS_IDS.IPTU.BOLETO_ENVIADO) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({
        plan: 'IPTU_CEF_BOLETO',
        from: previousStatusStr || '(vazio)',
        to: 'boleto_enviado_cef'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CEF: "%s" → "BOLETO_ENVIADO"', currentDeal.id, previousStatusStr || '(vazio)');
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      changes.push({
        plan: 'IPTU_CLIENTE_BOLETO',
        from: previousStatusStr || '(vazio)',
        to: 'boleto_enviado_cliente'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CLIENTE: "%s" → "BOLETO_ENVIADO"', currentDeal.id, previousStatusStr || '(vazio)');
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND && previousStatusStr !== STATUS_IDS.IPTU.SOLICITAR_CND) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({
        plan: 'IPTU_CEF_SOLICITAR',
        from: previousStatusStr || '(vazio)',
        to: 'solicitar_cnd_cef'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CEF: "%s" → "SOLICITAR_CND"', currentDeal.id, previousStatusStr || '(vazio)');
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      changes.push({
        plan: 'IPTU_CLIENTE_SOLICITAR',
        from: previousStatusStr || '(vazio)',
        to: 'solicitar_cnd_cliente'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CLIENTE: "%s" → "SOLICITAR_CND"', currentDeal.id, previousStatusStr || '(vazio)');
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL && previousStatusStr !== STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({
        plan: 'IPTU_CEF_PENDENCIA',
        from: previousStatusStr || '(vazio)',
        to: 'pendencia_documental'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CEF: "%s" → "PENDENCIA_DOCUMENTAL"', currentDeal.id, previousStatusStr || '(vazio)');
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO && previousStatusStr !== STATUS_IDS.IPTU.ATESTE_RECEBIDO) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({
        plan: 'IPTU_CEF_ATESTE',
        from: previousStatusStr || '(vazio)',
        to: 'ateste_recebido'
      });
      Logger.log('[Deal %s] ✔ Status IPTU CEF: "%s" → "ATESTE_RECEBIDO"', currentDeal.id, previousStatusStr || '(vazio)');
    }
  }
  
  const triagemFieldKey = FIELD_KEYS.dataTerminoTriagem;
  const currentTriagem = currentDeal[triagemFieldKey];
  
  let previousTriagem = null;
  if (previousPayload.custom_fields && previousPayload.custom_fields[triagemFieldKey] !== undefined) {
    previousTriagem = previousPayload.custom_fields[triagemFieldKey];
  } else if (previousPayload[triagemFieldKey] !== undefined) {
    previousTriagem = previousPayload[triagemFieldKey];
  }
  
  if (currentTriagem && !previousTriagem) {
    Logger.log('[Deal %s] ✔ Data Término Triagem preenchida: %s', currentDeal.id, currentTriagem);
    
    if (isIniciar_(currentStatus)) {
      if (isResponsabilidadeCaixa_(currentResp)) {
        const alreadyAdded = changes.some(c => c.plan === 'IPTU_CEF_INICIAL');
        if (!alreadyAdded) {
          changes.push({
            plan: 'IPTU_CEF_INICIAL',
            from: 'triagem_preenchida',
            to: 'iniciar_cef'
          });
          Logger.log('[Deal %s] ✔ IPTU CEF já estava em "Iniciar" - criando atividades', currentDeal.id);
        }
      } else if (isResponsabilidadeArrematante_(currentResp)) {
        const alreadyAdded = changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL');
        if (!alreadyAdded) {
          changes.push({
            plan: 'IPTU_CLIENTE_INICIAL',
            from: 'triagem_preenchida',
            to: 'iniciar_cliente'
          });
          Logger.log('[Deal %s] ✔ IPTU CLIENTE já estava em "Iniciar" - criando atividades', currentDeal.id);
        }
      }
    }
  }

  Logger.log('[Deal %s] 📋 Total de mudanças detectadas: %s', currentDeal.id, changes.length);
  return changes;
}

/***********************
 *  PROCESSAMENTO DO DEAL
 ***********************/
function processDealWebhook_(deal, statusChanges) {
  const today = tzToday_();
  
  if (isWeekend_(today)) {
    return { ok:true, skipped:'weekend', date: ymd_(today) };
  }

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];
  
  if (!baseStr) {
    return { ok:true, skipped:'missing_triagem' };
  }

  const baseDate = parseLocalDate_(baseStr);
  
  if (today < baseDate) {
    return { ok:true, skipped:'before_triagem', today: ymd_(today), triDate: ymd_(baseDate) };
  }

  const dx = diffDays_(baseDate, today);
  let created = 0;
  let skipped = 0;
  const createdActivities = [];

  for (const change of statusChanges) {
    const planKey = change.plan;
    const pl = PLAN[planKey];
    
    if (!pl) {
      Logger.log('[Deal %s] ⚠ Plano não encontrado: %s', deal.id, planKey);
      continue;
    }
    
    const dayConfigs = pl.days.slice();

    Logger.log('[Deal %s] ▶ Criando atividades para %s', deal.id, planKey);

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
        const dueY     = ymd_(dueBday);
        const dueTime  = String(hour).padStart(2, '0') + ':00';

        if (activityWasJustCreated_(deal.id, subject)) {
          skipped++;
          return;
        }

        if (activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) || 
            activityExistsBySubjectType_({ dealId: deal.id, subject })) {
          skipped++;
          return;
        }

        createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
        markActivityAsCreated_(deal.id, subject);
        created++;
        createdActivities.push(`✓ ${subject}`);
        Logger.log('[Deal %s]   ✔ Criada: %s | %s %s', deal.id, subject, dueY, dueTime);
      });
    } else {
      Logger.log('[Deal %s]   📋 Criando backlog (atividades passadas)...', deal.id);
      
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        
        if (dueBday <= today) {
          const subject  = pl.title(d);
          const note     = pl.note(d);
          const priority = getPriority_(planKey, d);
          const dueY     = ymd_(dueBday);
          const dueTime  = String(hour).padStart(2, '0') + ':00';

          if (!activityWasJustCreated_(deal.id, subject) &&
              !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 
              !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
            createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
            markActivityAsCreated_(deal.id, subject);
            created++;
            createdActivities.push(`✓ ${subject}`);
            Logger.log('[Deal %s]   ✔ Backlog D+%s: %s | vence %s %s', deal.id, d, subject, dueY, dueTime);
          } else {
            skipped++;
          }
        }
      });
      
      Logger.log('[Deal %s]   📋 Criando próxima atividade futura...', deal.id);
      
      const nextConfig = dayConfigs.find(cfg => {
        const dueRaw = addDays_(baseDate, cfg.day);
        const dueBday = nextBusinessDay_(dueRaw);
        return dueBday > today;
      });
      
      if (nextConfig) {
        const d = nextConfig.day;
        const hour = nextConfig.hour;
        const subject  = pl.title(d);
        const note     = pl.note(d);
        const priority = getPriority_(planKey, d);
        const dueRaw   = addDays_(baseDate, d);
        const dueBday  = nextBusinessDay_(dueRaw);
        const dueY     = ymd_(dueBday);
        const dueTime  = String(hour).padStart(2, '0') + ':00';

        if (!activityWasJustCreated_(deal.id, subject) &&
            !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 
            !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
          createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
          markActivityAsCreated_(deal.id, subject);
          created++;
          createdActivities.push(`✓ ${subject}`);
          Logger.log('[Deal %s]   ✔ Próxima D+%s: %s | vence %s %s', deal.id, d, subject, dueY, dueTime);
        } else {
          skipped++;
        }
      }
    }
  }

  return { 
    ok: true, 
    plans: statusChanges.map(c => c.plan),
    created, 
    skipped,
    createdActivities,
    dx: dx,
    date: ymd_(today) 
  };
}

/***********************
 *  FUNÇÕES DE LOG
 ***********************/
function getLogSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (err) {
    throw new Error('Erro ao abrir planilha ' + SHEET_ID + ': ' + err.message);
  }
}

function getOrCreateSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      const headerRange = sh.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers])
                 .setFontWeight('bold')
                 .setBackground('#4285f4')
                 .setFontColor('#ffffff')
                 .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      for (let i = 1; i <= headers.length; i++) sh.autoResizeColumn(i);
    }
  }
  return sh;
}

function appendLogToSheet_({ timestamp, dealId, title, action, atividadesCriadas, detalhes }) {
  try {
    const ss = getLogSpreadsheet_();
    const sh = getOrCreateSheet_(ss, SHEET_LOG, [
      'Timestamp',
      'DealID',
      'Title',
      'Action',
      'Atividades Criadas',
      'Detalhes'
    ]);
    
    sh.appendRow([
      Utilities.formatDate(timestamp || new Date(), CFG.TZ, 'dd/MM/yyyy, HH:mm:ss'),
      String(dealId || ''),
      String(title || ''),
      String(action || ''),
      String(atividadesCriadas || ''),
      String(detalhes || '')
    ]);
    
    const lastRow = sh.getLastRow();
    
    if (action === 'Processamento IPTU') {
      sh.getRange(lastRow, 1, 1, 6).setBackground('#d9ead3');
    } else if (action === 'Requisitos não atendidos') {
      sh.getRange(lastRow, 1, 1, 6).setBackground('#f4cccc');
    }
    
    if (lastRow > 201) {
      sh.deleteRows(2, lastRow - 201);
    }
  } catch (err) {
    console.error('Erro ao adicionar log:', err);
  }
}

function appendErrToSheet_(where, error, eventData) {
  try {
    const ss = getLogSpreadsheet_();
    const sh = getOrCreateSheet_(ss, SHEET_ERR, [
      'Timestamp', 
      'DealID', 
      'Erro', 
      'Stack Trace', 
      'Payload'
    ]);
    
    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy, HH:mm:ss');
    const errorMessage = (error && error.message) ? String(error.message) : String(error);
    const stackTrace = (error && error.stack) ? String(error.stack) : '';
    
    let dealId = '';
    let payloadText = '';
    
    try {
      if (eventData && eventData.postData && eventData.postData.contents) {
        const payload = JSON.parse(eventData.postData.contents);
        const current = payload.data || payload.current || {};
        dealId = String(current.id || '');
        
        payloadText = JSON.stringify(payload, null, 2);
      } else if (eventData) {
        payloadText = JSON.stringify(eventData, null, 2);
      }
    } catch (parseErr) {
      payloadText = eventData ? String(eventData) : 'N/A';
    }
    
    if (payloadText.length > 50000) {
      payloadText = payloadText.substring(0, 50000) + '\n\n... (truncado)';
    }
    
    sh.appendRow([
      timestamp,
      dealId,
      errorMessage,
      stackTrace,
      payloadText
    ]);
    
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow, 1, 1, 5).setBackground('#f4cccc');
    
    if (lastRow > 501) {
      sh.deleteRows(2, lastRow - 501);
    }
    
  } catch (err) {
    console.error('Erro crítico ao registrar erro:', err);
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  FUNÇÕES DE DIAGNÓSTICO
 ***********************/
function limparLocks() {
  Logger.log('=== LIMPANDO TODOS OS LOCKS ===');
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  let count = 0;
  
  for (const key in allProps) {
    if (key.startsWith('LOCK_') || key.startsWith('GLOBAL_PROCESSED_')) {
      props.deleteProperty(key);
      count++;
    }
  }
  
  Logger.log('✅ %s locks removidos', count);
}

function limparCacheAtividades() {
  Logger.log('=== LIMPANDO CACHE DE ATIVIDADES ===');
  for (const key in CREATED_ACTIVITIES_CACHE) {
    delete CREATED_ACTIVITIES_CACHE[key];
  }
  Logger.log('✅ Cache limpo');
}