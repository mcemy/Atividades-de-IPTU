/***********************/***********************

 *  CONFIG *  CONFIG

 ***********************/ ***********************/

const CFG = (() => {const CFG = (() => {

  const props = PropertiesService.getScriptProperties();  const props = PropertiesService.getScriptProperties();

  return {  return {

    TOKEN: props.getProperty('PIPEDRIVE_API_TOKEN'),    TOKEN: props.getProperty("PIPEDRIVE_API_TOKEN"),

    BASE: props.getProperty('PIPEDRIVE_BASE_URL') || 'https://api.pipedrive.com/v1',    BASE:

    TZ: props.getProperty('TIMEZONE') || 'America/Sao_Paulo',      props.getProperty("PIPEDRIVE_BASE_URL") || "https://api.pipedrive.com/v1",

  };    TZ: props.getProperty("TIMEZONE") || "America/Sao_Paulo",

})();  };

})();

if (!CFG.TOKEN) {

  throw new Error('Defina PIPEDRIVE_API_TOKEN nas Propriedades do Script.');if (!CFG.TOKEN) {

}  throw new Error("Defina PIPEDRIVE_API_TOKEN nas Propriedades do Script.");

}

const ACTIVITY_TYPE_KEY = 'condominio'; // Key do tipo IPTU

const ACTIVITY_TYPE_KEY = "condominio"; // Key do tipo IPTU

const FIELD_KEYS = {

  dataTerminoTriagem: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_TRIAGEM'),const FIELD_KEYS = {

  dataTerminoIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_IPTU'),  dataTerminoTriagem: "fb1aa427746a8e05d6dadc6eccfc51dd1cdc992d",

  statusIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_STATUS_IPTU'),  dataTerminoIPTU: "46f5eea72dbdcd18c9c19d2ddee73bff046fc14b",

  iptuResponsabilidade: PropertiesService.getScriptProperties().getProperty('FIELD_IPTU_RESPONSABILIDADE')  statusIPTU: "f6e1f351857746dc37fbf68c57946dc98a8a5d65",

};  iptuResponsabilidade: "f3fa85b1fa8b1d474df7e2ddc35d703fcf7cb3de",

};

const STATUS_IDS = {

  IPTU: {const STATUS_IDS = {

    INICIAR: PropertiesService.getScriptProperties().getProperty('STATUS_INICIAR'),  IPTU: {

    BOLETO_ENVIADO: PropertiesService.getScriptProperties().getProperty('STATUS_BOLETO_ENVIADO'),    INICIAR: "1079",

    PENDENCIA_DOCUMENTAL: PropertiesService.getScriptProperties().getProperty('STATUS_PENDENCIA_DOCUMENTAL'),    BOLETO_ENVIADO: "209",

    ATESTE_RECEBIDO: PropertiesService.getScriptProperties().getProperty('STATUS_ATESTE_RECEBIDO'),    PENDENCIA_DOCUMENTAL: "235",

    SOLICITAR_CND: PropertiesService.getScriptProperties().getProperty('STATUS_SOLICITAR_CND'),    ATESTE_RECEBIDO: "172",

    CND_SALVA_DRIVE: PropertiesService.getScriptProperties().getProperty('STATUS_CND_SALVA_DRIVE')    SOLICITAR_CND: "587",

  }    CND_SALVA_DRIVE: "143",

};  },

};

const RESPONSABILIDADE_IDS = {

  ARREMATANTE: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_ARREMATANTE'),const RESPONSABILIDADE_IDS = {

  CAIXA: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_CAIXA')  ARREMATANTE: "363",

};  CAIXA: "364",

};

/***********************

 *  FILTROS - MODIFICADO/***********************

 ***********************/ *  CACHE DE PRIORIDADES

const FILTROS = { ***********************/

  USUARIO_ATIVIDADES_EMAIL: PropertiesService.getScriptProperties().getProperty('USUARIO_ATIVIDADES_EMAIL') || 'lucastolentino.smart@gmail.com',if (typeof PRIORITY_IDS_CACHE === "undefined") {

  FUNIL_NOME: PropertiesService.getScriptProperties().getProperty('FUNIL_NOME') || 'pos arrematação',  var PRIORITY_IDS_CACHE = null;

  ETAPA_NOME: PropertiesService.getScriptProperties().getProperty('ETAPA_NOME') || 'contrato'}

};

function getPriorityIds_() {

/***********************  if (PRIORITY_IDS_CACHE) return PRIORITY_IDS_CACHE;

 *  CACHE DE PRIORIDADES

 ***********************/  try {

if (typeof PRIORITY_IDS_CACHE === 'undefined') {    const resp = pd_("/activityFields");

  var PRIORITY_IDS_CACHE = null;    if (resp && resp.data) {

}      const priorityField = resp.data.find((f) => f.key === "priority");



if (typeof ACTIVITIES_USER_ID_CACHE === 'undefined') {      if (

  var ACTIVITIES_USER_ID_CACHE = null;        priorityField &&

}        priorityField.options &&

        Array.isArray(priorityField.options)

function getPriorityIds_() {      ) {

  if (PRIORITY_IDS_CACHE) return PRIORITY_IDS_CACHE;        const options = {};

          priorityField.options.forEach((opt) => {

  try {          const label = String(opt.label || "").toLowerCase();

    const resp = pd_('/activityFields');          if (

    if (resp && resp.data) {            label.includes("high") ||

      const priorityField = resp.data.find(f => f.key === 'priority');            label.includes("alta") ||

                  label.includes("alto")

      if (priorityField && priorityField.options && Array.isArray(priorityField.options)) {          ) {

        const options = {};            options.HIGH = opt.id;

        priorityField.options.forEach(opt => {          } else if (

          const label = String(opt.label || '').toLowerCase();            label.includes("medium") ||

          if (label.includes('high') || label.includes('alta') || label.includes('alto')) {            label.includes("média") ||

            options.HIGH = opt.id;            label.includes("medio")

          } else if (label.includes('medium') || label.includes('média') || label.includes('medio')) {          ) {

            options.MEDIUM = opt.id;            options.MEDIUM = opt.id;

          } else if (label.includes('low') || label.includes('baixa') || label.includes('bajo')) {          } else if (

            options.LOW = opt.id;            label.includes("low") ||

          }            label.includes("baixa") ||

        });            label.includes("bajo")

                  ) {

        PRIORITY_IDS_CACHE = options;            options.LOW = opt.id;

        Logger.log('🎯 IDs de prioridade carregados: ' + JSON.stringify(options));          }

        return options;        });

      }

    }        PRIORITY_IDS_CACHE = options;

  } catch (err) {        Logger.log(

    Logger.log('⚠️ Erro ao buscar prioridades, usando fallback: ' + err.message);          "🎯 IDs de prioridade carregados: " + JSON.stringify(options)

  }        );

          return options;

  PRIORITY_IDS_CACHE = { HIGH: 2, MEDIUM: 1, LOW: 0 };      }

  return PRIORITY_IDS_CACHE;    }

}  } catch (err) {

    Logger.log(

function getPriorityValue_(priority) {      "⚠️ Erro ao buscar prioridades, usando fallback: " + err.message

  const ids = getPriorityIds_();    );

    }

  switch(priority) {

    case 'high':  PRIORITY_IDS_CACHE = { HIGH: 2, MEDIUM: 1, LOW: 0 };

      return ids.HIGH || 2;  return PRIORITY_IDS_CACHE;

    case 'medium':}

      return ids.MEDIUM || 1;

    case 'low':function getPriorityValue_(priority) {

      return ids.LOW || 0;  const ids = getPriorityIds_();

    default:

      return ids.MEDIUM || 1;  switch (priority) {

  }    case "high":

}      return ids.HIGH || 2;

    case "medium":

/***********************      return ids.MEDIUM || 1;

 *  FUNÇÕES AUXILIARES DE FILTRO - MODIFICADO    case "low":

 ***********************/      return ids.LOW || 0;

function normalizeText_(text) {    default:

  return String(text || '')      return ids.MEDIUM || 1;

    .toLowerCase()  }

    .normalize('NFD')}

    .replace(/[\u0300-\u036f]/g, '') // Remove acentos

    .replace(/\s+/g, ' ')/***********************

    .trim(); *  DATAS (TZ-LOCAL)

} ***********************/

function tzToday_() {

function getActivitiesUserId_() {  const now = new Date();

  if (ACTIVITIES_USER_ID_CACHE) return ACTIVITIES_USER_ID_CACHE;  const str = Utilities.formatDate(now, CFG.TZ, "yyyy-MM-dd");

    return new Date(str + "T00:00:00");

  try {}

    const resp = pd_('/users?limit=500');function parseLocalDate_(yyyy_mm_dd) {

    if (resp && resp.data) {  return new Date(yyyy_mm_dd + "T00:00:00");

      const user = resp.data.find(u => }

        String(u.email || '').toLowerCase() === FILTROS.USUARIO_ATIVIDADES_EMAIL.toLowerCase()function addDays_(date, days) {

      );  const d = new Date(date.getTime());

        d.setDate(d.getDate() + days);

      if (user && user.id) {  return d;

        ACTIVITIES_USER_ID_CACHE = user.id;}

        Logger.log('👤 Usuário para atividades encontrado: %s (ID: %s)', user.name, user.id);function diffDays_(startDate, endDate) {

        return user.id;  return Math.floor((endDate - startDate) / 86400000);

      }}

    }function ymd_(date) {

  } catch (err) {  return Utilities.formatDate(date, CFG.TZ, "yyyy-MM-dd");

    Logger.log('⚠️ Erro ao buscar usuário: ' + err.message);}

  }function isWeekend_(date) {

    const dow = date.getDay();

  Logger.log('❌ Usuário %s não encontrado', FILTROS.USUARIO_ATIVIDADES_EMAIL);  return dow === 0 || dow === 6;

  return null;}

}function nextBusinessDay_(date) {

  let d = new Date(date.getTime());

function isDealInCorrectStage_(deal) {  while (isWeekend_(d)) d = addDays_(d, 1);

  try {  return d;

    if (!deal.pipeline_id || !deal.stage_id) {}

      Logger.log('⚠️ Deal %s sem pipeline_id ou stage_id', deal.id);

      return false;/***********************

    } *  HELPERS DE STATUS

     ***********************/

    const pipelineResp = pd_('/pipelines/' + deal.pipeline_id);function normalizeStatus_(v) {

    if (!pipelineResp || !pipelineResp.data) {  if (v == null || v === "") return "";

      Logger.log('⚠️ Pipeline não encontrado para deal %s', deal.id);  const s = String(v).trim().toLowerCase();

      return false;  if (!s) return "";

    }  const s2 = s.replace(/^\d+[\.\-\s]+/, "").trim();

      return s2;

    const pipeline = pipelineResp.data;}

    const pipelineName = normalizeText_(pipeline.name);

    function isIniciar_(v) {

    if (pipelineName !== normalizeText_(FILTROS.FUNIL_NOME)) {  if (!v) return false;

      Logger.log('⊘ Deal %s não está no funil "%s" (está em "%s")',   const vStr = String(v).trim();

        deal.id, FILTROS.FUNIL_NOME, pipeline.name);

      return false;  if (STATUS_IDS.IPTU.INICIAR && vStr === String(STATUS_IDS.IPTU.INICIAR)) {

    }    return true;

      }

    const stageResp = pd_('/stages/' + deal.stage_id);

    if (!stageResp || !stageResp.data) {  const s = normalizeStatus_(v);

      Logger.log('⚠️ Etapa não encontrada para deal %s', deal.id);  return s === "iniciar";

      return false;}

    }

    function isResponsabilidadeCaixa_(v) {

    const stage = stageResp.data;  if (!v) return false;

    const stageName = normalizeText_(stage.name);  const vStr = String(v).trim();

      return vStr === String(RESPONSABILIDADE_IDS.CAIXA);

    if (stageName !== normalizeText_(FILTROS.ETAPA_NOME)) {}

      Logger.log('⊘ Deal %s não está na etapa "%s" (está em "%s")', 

        deal.id, FILTROS.ETAPA_NOME, stage.name);function isResponsabilidadeArrematante_(v) {

      return false;  if (!v) return false;

    }  const vStr = String(v).trim();

      return vStr === String(RESPONSABILIDADE_IDS.ARREMATANTE);

    Logger.log('✅ Deal %s está no funil "%s" e etapa "%s"', }

      deal.id, pipeline.name, stage.name);

    return true;/***********************

     *  HTTP PIPEDRIVE

  } catch (err) { ***********************/

    Logger.log('❌ Erro ao verificar stage do deal %s: %s', deal.id, err.message);function pd_(path, opt) {

    return false;  const url =

  }    CFG.BASE +

}    path +

    (path.includes("?") ? "&" : "?") +

/***********************    "api_token=" +

 *  DATAS (TZ-LOCAL)    encodeURIComponent(CFG.TOKEN);

 ***********************/  const params = Object.assign(

function tzToday_() {    {

  const now = new Date();      method: "get",

  const str = Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd');      muteHttpExceptions: true,

  return new Date(str + 'T00:00:00');      contentType: "application/json",

}    },

function parseLocalDate_(yyyy_mm_dd) { return new Date(yyyy_mm_dd + 'T00:00:00'); }    opt || {}

function addDays_(date, days) { const d = new Date(date.getTime()); d.setDate(d.getDate() + days); return d; }  );

function diffDays_(startDate, endDate) { return Math.floor((endDate - startDate) / 86400000); }  const res = UrlFetchApp.fetch(url, params);

function ymd_(date) { return Utilities.formatDate(date, CFG.TZ, 'yyyy-MM-dd'); }  const code = res.getResponseCode();

function isWeekend_(date) { const dow = date.getDay(); return dow === 0 || dow === 6; }  if (code < 200 || code >= 300)

function nextBusinessDay_(date) {    throw new Error(

  let d = new Date(date.getTime());      "PD " +

  while (isWeekend_(d)) d = addDays_(d, 1);        (params.method || "GET") +

  return d;        " " +

}        path +

        " " +

/***********************        code +

 *  HELPERS DE STATUS        ": " +

 ***********************/        res.getContentText()

function normalizeStatus_(v) {    );

  if (v == null || v === '') return '';  return JSON.parse(res.getContentText());

  const s = String(v).trim().toLowerCase();}

  if (!s) return '';

  const s2 = s.replace(/^\d+[\.\-\s]+/, '').trim();/***********************

  return s2; *  NEGÓCIOS ELEGÍVEIS

} ***********************/

function fetchCandidateDeals_() {

function isIniciar_(v) {  const resp = pd_("/deals?limit=500&status=open");

  if (!v) return false;  const deals = resp.data || [];

  const vStr = String(v).trim();  return deals.filter((d) => {

      const statusIPTU = String(d[FIELD_KEYS.statusIPTU] || "").trim();

  if (STATUS_IDS.IPTU.INICIAR && vStr === String(STATUS_IDS.IPTU.INICIAR)) {

    return true;    return (

  }      d[FIELD_KEYS.dataTerminoTriagem] &&

        !d[FIELD_KEYS.dataTerminoIPTU] &&

  const s = normalizeStatus_(v);      d[FIELD_KEYS.statusIPTU] &&

  return s === 'iniciar';      d[FIELD_KEYS.iptuResponsabilidade] &&

}      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE

    );

function isResponsabilidadeCaixa_(v) {  });

  if (!v) return false;}

  const vStr = String(v).trim();

  return vStr === String(RESPONSABILIDADE_IDS.CAIXA);/***********************

} *  ATIVIDADES: LISTAGEM E EXISTÊNCIA

 ***********************/

function isResponsabilidadeArrematante_(v) {function listActivitiesAll_(dealId) {

  if (!v) return false;  const all = [];

  const vStr = String(v).trim();  const limit = 200;

  return vStr === String(RESPONSABILIDADE_IDS.ARREMATANTE);

}  let start = 0;

  while (true) {

/***********************    const r = pd_(

 *  HTTP PIPEDRIVE      `/activities?deal_id=${dealId}&done=0&start=${start}&limit=${limit}`

 ***********************/    );

function pd_(path, opt) {    const arr = r.data || [];

  const url = CFG.BASE + path + (path.includes('?') ? '&' : '?') + 'api_token=' + encodeURIComponent(CFG.TOKEN);    all.push.apply(all, arr);

  const params = Object.assign({ method: 'get', muteHttpExceptions: true, contentType: 'application/json' }, opt || {});    const pg = r.additional_data && r.additional_data.pagination;

  const res = UrlFetchApp.fetch(url, params);    if (!pg || !pg.more_items_in_collection) break;

  const code = res.getResponseCode();    start = pg.next_start;

  if (code < 200 || code >= 300) throw new Error('PD ' + (params.method || 'GET') + ' ' + path + ' ' + code + ': ' + res.getContentText());  }

  return JSON.parse(res.getContentText());

}  start = 0;

  while (true) {

/***********************    const r = pd_(

 *  NEGÓCIOS ELEGÍVEIS - MODIFICADO (SÓ VERIFICA FUNIL/ETAPA)      `/activities?deal_id=${dealId}&done=1&start=${start}&limit=${limit}`

 ***********************/    );

function fetchCandidateDeals_() {    const arr = r.data || [];

  const resp = pd_('/deals?limit=500&status=open');    all.push.apply(all, arr);

  const deals = resp.data || [];    const pg = r.additional_data && r.additional_data.pagination;

      if (!pg || !pg.more_items_in_collection) break;

  return deals.filter(d => {    start = pg.next_start;

    const statusIPTU = String(d[FIELD_KEYS.statusIPTU] || '').trim();  }

    

    // Verificações originais  return all;

    const hasRequiredFields = (}

      d[FIELD_KEYS.dataTerminoTriagem] && 

      !d[FIELD_KEYS.dataTerminoIPTU] &&function normalizeSubject_(s) {

      d[FIELD_KEYS.statusIPTU] &&  return String(s || "")

      d[FIELD_KEYS.iptuResponsabilidade] &&    .replace(/[\u200B-\u200D\u2060]/g, "")

      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE    .replace(/\s+/g, " ")

    );    .trim()

        .toLowerCase();

    if (!hasRequiredFields) return false;}

    

    // VERIFICAÇÃO: Apenas Funil e Etapa corretosfunction activityExistsStrong_({ dealId, subject, dueDateYmd, dueTime }) {

    if (!isDealInCorrectStage_(d)) return false;  const subjN = normalizeSubject_(subject);

      const list = listActivitiesAll_(dealId);

    return true;  return list.some((a) => {

  });    const sameType = String(a.type || "").trim() === ACTIVITY_TYPE_KEY;

}    const sameDue = String(a.due_date || "") === String(dueDateYmd);

    const sameTime = String(a.due_time || "") === String(dueTime);

/***********************    const sameSubj = normalizeSubject_(a.subject) === subjN;

 *  ATIVIDADES: LISTAGEM E EXISTÊNCIA    return sameType && sameDue && sameTime && sameSubj;

 ***********************/  });

function listActivitiesAll_(dealId) {}

  const all = [];

  const limit = 200;function activityExistsBySubjectType_({ dealId, subject }) {

  const subjN = normalizeSubject_(subject);

  let start = 0;  const list = listActivitiesAll_(dealId);

  while (true) {  return list.some((a) => {

    const r = pd_(`/activities?deal_id=${dealId}&done=0&start=${start}&limit=${limit}`);    const sameType = String(a.type || "").trim() === ACTIVITY_TYPE_KEY;

    const arr = r.data || [];    const sameSubj = normalizeSubject_(a.subject) === subjN;

    all.push.apply(all, arr);    return sameType && sameSubj;

    const pg = r.additional_data && r.additional_data.pagination;  });

    if (!pg || !pg.more_items_in_collection) break;}

    start = pg.next_start;

  }/***********************

 *  FORMATAÇÃO DO NOTE

  start = 0; ***********************/

  while (true) {function escapeHtml_(s) {

    const r = pd_(`/activities?deal_id=${dealId}&done=1&start=${start}&limit=${limit}`);  return String(s).replace(/[&<>"]/g, function (c) {

    const arr = r.data || [];    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];

    all.push.apply(all, arr);  });

    const pg = r.additional_data && r.additional_data.pagination;}

    if (!pg || !pg.more_items_in_collection) break;function formatNote_(rawNote) {

    start = pg.next_start;  var s = String(rawNote || "").replace(/\r\n?/g, "\n");

  }  s = s.replace(/—\s*Lembre-se:/gi, "Observação:");

  var lines = s.split("\n");

  return all;  var out = [];

}  for (var i = 0; i < lines.length; i++) {

    var raw = lines[i];

function normalizeSubject_(s) {    if (raw.trim() === "") {

  return String(s || '')      out.push("<br/>");

    .replace(/[\u200B-\u200D\u2060]/g, '')      continue;

    .replace(/\s+/g, ' ')    }

    .trim()    var content = raw.replace(/^\s*[•◉\-—–→]\s*/, "").trimEnd();

    .toLowerCase();    var bullet = /^Observa[cç][aã]o:/i.test(content) ? "" : "• ";

}    out.push("<p>" + bullet + escapeHtml_(content) + "</p>");

  }

function activityExistsStrong_({ dealId, subject, dueDateYmd, dueTime }) {  return out.join("");

  const subjN = normalizeSubject_(subject);}

  const list = listActivitiesAll_(dealId);

  return list.some(a => {/***********************

    const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY); *  TABELAS DE CONTEÚDO

    const sameDue  = (String(a.due_date || '') === String(dueDateYmd)); ***********************/

    const sameTime = (String(a.due_time || '') === String(dueTime));const TXT = {

    const sameSubj = (normalizeSubject_(a.subject) === subjN);  IPTU_CEF: {

    return sameType && sameDue && sameTime && sameSubj;    INICIAL: {

  });      1: `Enviar mensagem inicial ao cliente.

}Localizar inscrição municipal e preencher na lateral do pipe.

Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.

function activityExistsBySubjectType_({ dealId, subject }) {Registrar os meios que tiveram retorno ("frutíferos").`,

  const subjN = normalizeSubject_(subject);      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.

  const list = listActivitiesAll_(dealId);Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,

  return list.some(a => {      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.

    const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY);Caso negativo, confirmar com o cliente o interesse na diligência presencial.

    const sameSubj = (normalizeSubject_(a.subject) === subjN);Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,

    return sameType && sameSubj;      6: `Enviar a mensagem padrão de confirmação de emissão.

  });Lembrar de preencher os campos "IPTU: Valor da Dívida".

}Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,

      7: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas (lembre-se de validar se a responsabilidade de pagamento é de fato do CEF através da proposta).

/***********************Em caso de CND, salavar no Google Drive e finalizar o imóvel.

 *  FORMATAÇÃO DO NOTEEnviar a mensagem padrão de envio da documentação.`,

 ***********************/      9: `Confirmar se os boletos foram enviados para a CEF.

function escapeHtml_(s) {Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,

  return String(s).replace(/[&<>"]/g, function(c){      10: `Confirmar se os boletos foram enviados para a CEF.

    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,

  });      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.

}Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.

function formatNote_(rawNote) {Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`,

  var s = String(rawNote || '').replace(/\r\n?/g, '\n');    },

  s = s.replace(/—\s*Lembre-se:/gi, 'Observação:');    BOLETO_ENVIADO: {

  var lines = s.split('\n');      5: `Verificar se a CEF enviou retorno quanto ao boleto anexado.

  var out = [];Em caso de análise documental, atualizar o pipe, enviar mensagem padrão de Análise Documental para o cliente e tomar as medidas necessárias para corrigir a documentação e protocolar novamente em 3 dias úteis.

  for (var i=0;i<lines.length;i++){Em caso de Ateste, atualizar o pipe, enviar mensagem padrão de Ateste para o cliente.`,

    var raw = lines[i];    },

    if (raw.trim()===''){ out.push('<br/>'); continue; }    SOLICITAR_CND: {

    var content = raw.replace(/^\s*[•◉\-—–→]\s*/, '').trimEnd();      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.

    var bullet = /^Observa[cç][aã]o:/i.test(content) ? '' : '• ';Enviar a mensagem padrão de finalização de processo para o cliente.`,

    out.push('<p>'+bullet+escapeHtml_(content)+'</p>');    },

  }    PENDENCIA_DOCUMENTAL: {

  return out.join('');      3: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas garantindo que as pendências foram atendindas.

}Enviar a mensagem padrão de resposta de Análise Documental anexada para o cliente`,

    },

/***********************    ATESTE_RECEBIDO: {

 *  TABELAS DE CONTEÚDO      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades

 ***********************/Enviar a mensagem padrão de finalização de processo para o cliente.`,

const TXT = {    },

  IPTU_CEF: {  },

    INICIAL: {  IPTU_CLIENTE: {

      1: `Enviar mensagem inicial ao cliente.    INICIAL: {

Localizar inscrição municipal e preencher na lateral do pipe.      1: `Enviar mensagem inicial ao cliente.

Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.Localizar inscrição municipal e preencher na lateral do pipe.

Registrar os meios que tiveram retorno ("frutíferos").`,Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.

      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.Registrar os meios que tiveram retorno ("frutíferos").`,

Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.

      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,

Caso negativo, confirmar com o cliente o interesse na diligência presencial.      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.

Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,Caso negativo, confirmar com o cliente o interesse na diligência presencial.

      6: `Enviar a mensagem padrão de confirmação de emissão.Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,

Lembrar de preencher os campos "IPTU: Valor da Dívida".      6: `Enviar a mensagem padrão de confirmação de emissão.

Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,Lembrar de preencher os campos "IPTU: Valor da Dívida"

      7: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas (lembre-se de validar se a responsabilidade de pagamento é de fato do CEF através da proposta).Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,

Em caso de CND, salavar no Google Drive e finalizar o imóvel.      7: `Enviar o bloeto para o cliente quitar (lembre-se de validar se a responsabilidade de pagamento é de fato do cliente através da proposta).

Enviar a mensagem padrão de envio da documentação.`,Em caso de CND, salavar no Google Drive e finalizar o imóvel.

      9: `Confirmar se os boletos foram enviados para a CEF.Enviar a mensagem padrão de envio da documentação.`,

Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,      9: `Confirmar se os boletos foram enviados para o cliente.

      10: `Confirmar se os boletos foram enviados para a CEF.Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,

Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,      10: `Confirmar se os boletos foram enviados para o cliente.

      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,

Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.

Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.

    },Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`,

    BOLETO_ENVIADO: {    },

      5: `Verificar se a CEF enviou retorno quanto ao boleto anexado.    BOLETO_ENVIADO: {

Em caso de análise documental, atualizar o pipe, enviar mensagem padrão de Análise Documental para o cliente e tomar as medidas necessárias para corrigir a documentação e protocolar novamente em 3 dias úteis.      3: `Verificar o cliente pagou o boleto enviado.

Em caso de Ateste, atualizar o pipe, enviar mensagem padrão de Ateste para o cliente.`Caso ele informe que não irá realizar o pagamento por motivos que não são de nossa responsabilidade, como por exemplo: após a venda, após registro, etc, enviar ao cliente a mensagem padrrão de conclusão do processo sem CND por impedimento do cliente e concluir o imóvel com o status "03. Negociação pelo cliente".

    },Caso o cliente tenha realizado o pagamento, solicitar CND e enviar a mensagem padrão de CND Solicitada.`,

    SOLICITAR_CND: {    },

      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.    SOLICITAR_CND: {

Enviar a mensagem padrão de finalização de processo para o cliente.`      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.

    },Enviar a mensagem padrão de finalização de processo para o cliente.`,

    PENDENCIA_DOCUMENTAL: {    },

      3: `Anexar os boletos na plafatorma da CEF seguindo as padronizações exigidas garantindo que as pendências foram atendindas.  },

Enviar a mensagem padrão de resposta de Análise Documental anexada para o cliente`};

    },

    ATESTE_RECEBIDO: {const TITLE_IPTU_CEF_INICIAL = {

      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades  1: "INICIAR",

Enviar a mensagem padrão de finalização de processo para o cliente.`  2: "TENTATIVAS VIRTUAIS",

    }  4: "VERIFICAR NECESSIDADE DE DILIGÊNCIA",

  },  6: "CONFIRMAÇÃO DE EMISSÃO",

  IPTU_CLIENTE: {  7: "ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO",

    INICIAL: {  9: "ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA",

      1: `Enviar mensagem inicial ao cliente.  10: "ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO",

Localizar inscrição municipal e preencher na lateral do pipe.  11: "SINAL DE RISCO: PRAZO ESTOURADO",

Acessar a pasta "Prefeituras", localizar a cidade do imóvel e reunir os meios de contato já utilizados (e-mails, telefone, site, etc.), após localizar o meio de solicitação, tentar emitir a guia de IPTU ou CND.};

Registrar os meios que tiveram retorno ("frutíferos").`,

      2: `Confirmar se foi realizada todas as tentativas de contato remoto com a Prefeitura para a emissão da documentação.const TITLE_IPTU_CLIENTE_INICIAL = {

Caso infrutíferas, registrar a necessidade de diligência e preparar o envio da mensagem padrão ao cliente no 4º dia.`,  1: "INICIAR",

      4: `Verificar se foi possível Emitir a Guia ou CND de IPTU por via virtual.  2: "TENTATIVAS VIRTUAIS",

Caso negativo, confirmar com o cliente o interesse na diligência presencial.  4: "VERIFICAR NECESSIDADE DE DILIGÊNCIA",

Enviar instruções para solicitação e contratação, e acompanhar o andamento até conclusão.`,  6: "CONFIRMAÇÃO DE EMISSÃO",

      6: `Enviar a mensagem padrão de confirmação de emissão.  7: "ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO",

Lembrar de preencher os campos "IPTU: Valor da Dívida"  9: "ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA",

Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,  10: "ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO",

      7: `Enviar o bloeto para o cliente quitar (lembre-se de validar se a responsabilidade de pagamento é de fato do cliente através da proposta).  11: "SINAL DE RISCO: PRAZO ESTOURADO",

Em caso de CND, salavar no Google Drive e finalizar o imóvel.};

Enviar a mensagem padrão de envio da documentação.`,

      9: `Confirmar se os boletos foram enviados para o cliente.const PRIORITY_MAP = {

Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,  IPTU_CEF_INICIAL: {

      10: `Confirmar se os boletos foram enviados para o cliente.    high: new Set([1, 7, 10, 11]),

Caso ainda não tenha ocorrido, entender o motivo e atuar para atender o prazo definido para anexar a documentação.`,    medium: new Set([2, 4, 9]),

      11: `Verificar se a pendência que impediu a emissão da guia foi resolvida.    low: new Set([6]),

Tomar ação efetiva para garantir que o IPTU seja emitido e enviado para pagamento próximos 3 dias.  },

Enviar ao cliente a mensagem padrão quanto ao não cumprimento do prazo.`  IPTU_CEF_BOLETO: { high: new Set(), medium: new Set([5]), low: new Set() },

    },  IPTU_CEF_SOLICITAR: { high: new Set(), medium: new Set(), low: new Set([7]) },

    BOLETO_ENVIADO: {  IPTU_CEF_PENDENCIA: { high: new Set(), medium: new Set([3]), low: new Set() },

      3: `Verificar o cliente pagou o boleto enviado.  IPTU_CEF_ATESTE: { high: new Set(), medium: new Set(), low: new Set([7]) },

Caso ele informe que não irá realizar o pagamento por motivos que não são de nossa responsabilidade, como por exemplo: após a venda, após registro, etc, enviar ao cliente a mensagem padrrão de conclusão do processo sem CND por impedimento do cliente e concluir o imóvel com o status "03. Negociação pelo cliente".  IPTU_CLIENTE_INICIAL: {

Caso o cliente tenha realizado o pagamento, solicitar CND e enviar a mensagem padrão de CND Solicitada.`    high: new Set([1, 7, 10, 11]),

    },    medium: new Set([2, 4, 9]),

    SOLICITAR_CND: {    low: new Set([6]),

      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.  },

Enviar a mensagem padrão de finalização de processo para o cliente.`  IPTU_CLIENTE_BOLETO: {

    }    high: new Set(),

  }    medium: new Set([3]),

};    low: new Set(),

  },

const TITLE_IPTU_CEF_INICIAL = {   IPTU_CLIENTE_SOLICITAR: {

  1:'INICIAR',    high: new Set(),

  2:'TENTATIVAS VIRTUAIS',    medium: new Set(),

  4:'VERIFICAR NECESSIDADE DE DILIGÊNCIA',    low: new Set([7]),

  6:'CONFIRMAÇÃO DE EMISSÃO',  },

  7:'ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO',};

  9:'ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA',

  10:'ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO',function getPriority_(planKey, day) {

  11:'SINAL DE RISCO: PRAZO ESTOURADO'  const pm = PRIORITY_MAP[planKey];

};  if (!pm) return "low";

  if (pm.high.has(day)) return "high";

const TITLE_IPTU_CLIENTE_INICIAL = {   if (pm.medium.has(day)) return "medium";

  1:'INICIAR',  if (pm.low.has(day)) return "low";

  2:'TENTATIVAS VIRTUAIS',  return "low";

  4:'VERIFICAR NECESSIDADE DE DILIGÊNCIA',}

  6:'CONFIRMAÇÃO DE EMISSÃO',

  7:'ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO',const PLAN = {

  9:'ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA',  IPTU_CEF_INICIAL: {

  10:'ALERTA: ÚLTIMO DIA PARA ENVIO DA DOCUMENTAÇÃO',    days: [

  11:'SINAL DE RISCO: PRAZO ESTOURADO'      { day: 1, hour: 9 },

};      { day: 2, hour: 10 },

      { day: 4, hour: 11 },

const PRIORITY_MAP = {      { day: 6, hour: 12 },

  IPTU_CEF_INICIAL:        { high:new Set([1,7,10,11]), medium:new Set([2,4,9]), low:new Set([6]) },      { day: 7, hour: 13 },

  IPTU_CEF_BOLETO:         { high:new Set(),            medium:new Set([5]),     low:new Set() },      { day: 9, hour: 14 },

  IPTU_CEF_SOLICITAR:      { high:new Set(),            medium:new Set(),        low:new Set([7]) },      { day: 10, hour: 15 },

  IPTU_CEF_PENDENCIA:      { high:new Set(),            medium:new Set([3]),     low:new Set() },      { day: 11, hour: 16 },

  IPTU_CEF_ATESTE:         { high:new Set(),            medium:new Set(),        low:new Set([7]) },    ],

  IPTU_CLIENTE_INICIAL:    { high:new Set([1,7,10,11]), medium:new Set([2,4,9]), low:new Set([6]) },    title: (d) =>

  IPTU_CLIENTE_BOLETO:     { high:new Set(),            medium:new Set([3]),     low:new Set() },      `IPTU - ${d} DIA${d > 1 ? "S" : ""} - ${TITLE_IPTU_CEF_INICIAL[d]}`,

  IPTU_CLIENTE_SOLICITAR:  { high:new Set(),            medium:new Set(),        low:new Set([7]) }    note: (d) => formatNote_(TXT.IPTU_CEF.INICIAL[d]),

};  },

  IPTU_CEF_BOLETO: {

function getPriority_(planKey, day){    days: [{ day: 5, hour: 10 }],

  const pm = PRIORITY_MAP[planKey];    title: (d) => `IPTU - VERIFICAR RETORNO DA CEF SOBRE O BOLETO ENVIADO`,

  if (!pm) return 'low';    note: (d) => formatNote_(TXT.IPTU_CEF.BOLETO_ENVIADO[d]),

  if (pm.high.has(day)) return 'high';  },

  if (pm.medium.has(day)) return 'medium';  IPTU_CEF_SOLICITAR: {

  if (pm.low.has(day)) return 'low';    days: [{ day: 7, hour: 11 }],

  return 'low';    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,

}    note: (d) => formatNote_(TXT.IPTU_CEF.SOLICITAR_CND[d]),

  },

const PLAN = {  IPTU_CEF_PENDENCIA: {

  IPTU_CEF_INICIAL: {    days: [{ day: 3, hour: 11 }],

    days: [    title: (d) => `IPTU - ENVIAR DOCUMENTAÇÃO CORRIGIDA PARA A CEF`,

      { day: 1, hour: 9 },    note: (d) => formatNote_(TXT.IPTU_CEF.PENDENCIA_DOCUMENTAL[d]),

      { day: 2, hour: 10 },  },

      { day: 4, hour: 11 },  IPTU_CEF_ATESTE: {

      { day: 6, hour: 12 },    days: [{ day: 7, hour: 11 }],

      { day: 7, hour: 13 },    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,

      { day: 9, hour: 14 },    note: (d) => formatNote_(TXT.IPTU_CEF.ATESTE_RECEBIDO[d]),

      { day: 10, hour: 15 },  },

      { day: 11, hour: 16 }  IPTU_CLIENTE_INICIAL: {

    ],    days: [

    title: (d) => `IPTU - ${d} DIA${d>1?'S':''} - ${TITLE_IPTU_CEF_INICIAL[d]}`,      { day: 1, hour: 9 },

    note: (d) => formatNote_(TXT.IPTU_CEF.INICIAL[d])      { day: 2, hour: 10 },

  },      { day: 4, hour: 11 },

  IPTU_CEF_BOLETO: {      { day: 6, hour: 12 },

    days: [      { day: 7, hour: 13 },

      { day: 5, hour: 10 }      { day: 9, hour: 14 },

    ],      { day: 10, hour: 15 },

    title: (d) => `IPTU - VERIFICAR RETORNO DA CEF SOBRE O BOLETO ENVIADO`,      { day: 11, hour: 16 },

    note: (d) => formatNote_(TXT.IPTU_CEF.BOLETO_ENVIADO[d])    ],

  },    title: (d) =>

  IPTU_CEF_SOLICITAR: {      `IPTU - ${d} DIA${d > 1 ? "S" : ""} - ${TITLE_IPTU_CLIENTE_INICIAL[d]}`,

    days: [    note: (d) => formatNote_(TXT.IPTU_CLIENTE.INICIAL[d]),

      { day: 7, hour: 11 }  },

    ],  IPTU_CLIENTE_BOLETO: {

    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,    days: [{ day: 3, hour: 10 }],

    note: (d) => formatNote_(TXT.IPTU_CEF.SOLICITAR_CND[d])    title: (d) => `IPTU - VERIFICAR SE O CLIENTE PAGOU O BOLETO`,

  },    note: (d) => formatNote_(TXT.IPTU_CLIENTE.BOLETO_ENVIADO[d]),

  IPTU_CEF_PENDENCIA: {  },

    days: [  IPTU_CLIENTE_SOLICITAR: {

      { day: 3, hour: 11 }    days: [{ day: 7, hour: 11 }],

    ],    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,

    title: (d) => `IPTU - ENVIAR DOCUMENTAÇÃO CORRIGIDA PARA A CEF`,    note: (d) => formatNote_(TXT.IPTU_CLIENTE.SOLICITAR_CND[d]),

    note: (d) => formatNote_(TXT.IPTU_CEF.PENDENCIA_DOCUMENTAL[d])  },

  },};

  IPTU_CEF_ATESTE: {

    days: [/***********************

      { day: 7, hour: 11 } *  DECIDIR PLANOS A CRIAR

    ], ***********************/

    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,function getPlansToCreate_(deal) {

    note: (d) => formatNote_(TXT.IPTU_CEF.ATESTE_RECEBIDO[d])  const plans = [];

  },  const statusIPTU = deal[FIELD_KEYS.statusIPTU];

  IPTU_CLIENTE_INICIAL: {  const statusIPTUStr = String(statusIPTU || "").trim();

    days: [  const responsabilidade = deal[FIELD_KEYS.iptuResponsabilidade];

      { day: 1, hour: 9 },

      { day: 2, hour: 10 },  // Bloqueia se CND já foi salva

      { day: 4, hour: 11 },  if (statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {

      { day: 6, hour: 12 },    return plans;

      { day: 7, hour: 13 },  }

      { day: 9, hour: 14 },

      { day: 10, hour: 15 },  if (isIniciar_(statusIPTU)) {

      { day: 11, hour: 16 }    if (isResponsabilidadeCaixa_(responsabilidade)) {

    ],      plans.push("IPTU_CEF_INICIAL");

    title: (d) => `IPTU - ${d} DIA${d>1?'S':''} - ${TITLE_IPTU_CLIENTE_INICIAL[d]}`,    } else if (isResponsabilidadeArrematante_(responsabilidade)) {

    note: (d) => formatNote_(TXT.IPTU_CLIENTE.INICIAL[d])      plans.push("IPTU_CLIENTE_INICIAL");

  },    }

  IPTU_CLIENTE_BOLETO: {  }

    days: [

      { day: 3, hour: 10 }  if (statusIPTUStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {

    ],    if (isResponsabilidadeCaixa_(responsabilidade)) {

    title: (d) => `IPTU - VERIFICAR SE O CLIENTE PAGOU O BOLETO`,      plans.push("IPTU_CEF_BOLETO");

    note: (d) => formatNote_(TXT.IPTU_CLIENTE.BOLETO_ENVIADO[d])    } else if (isResponsabilidadeArrematante_(responsabilidade)) {

  },      plans.push("IPTU_CLIENTE_BOLETO");

  IPTU_CLIENTE_SOLICITAR: {    }

    days: [  }

      { day: 7, hour: 11 }

    ],  if (statusIPTUStr === STATUS_IDS.IPTU.SOLICITAR_CND) {

    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,    if (isResponsabilidadeCaixa_(responsabilidade)) {

    note: (d) => formatNote_(TXT.IPTU_CLIENTE.SOLICITAR_CND[d])      plans.push("IPTU_CEF_SOLICITAR");

  }    } else if (isResponsabilidadeArrematante_(responsabilidade)) {

};      plans.push("IPTU_CLIENTE_SOLICITAR");

    }

/***********************  }

 *  DECIDIR PLANOS A CRIAR

 ***********************/  if (statusIPTUStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {

function getPlansToCreate_(deal) {    if (isResponsabilidadeCaixa_(responsabilidade)) {

  const plans = [];      plans.push("IPTU_CEF_PENDENCIA");

  const statusIPTU = deal[FIELD_KEYS.statusIPTU];    }

  const statusIPTUStr = String(statusIPTU || '').trim();  }

  const responsabilidade = deal[FIELD_KEYS.iptuResponsabilidade];

  if (statusIPTUStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO) {

  if (statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {    if (isResponsabilidadeCaixa_(responsabilidade)) {

    return plans;      plans.push("IPTU_CEF_ATESTE");

  }    }

  }

  if (isIniciar_(statusIPTU)) {

    if (isResponsabilidadeCaixa_(responsabilidade)) {  return plans;

      plans.push('IPTU_CEF_INICIAL');}

    } else if (isResponsabilidadeArrematante_(responsabilidade)) {

      plans.push('IPTU_CLIENTE_INICIAL');/***********************

    } *  CRIAÇÃO DE ATIVIDADE

  } ***********************/

  function createActivity_({ deal, subject, note, dueDate, dueTime, priority }) {

  if (statusIPTUStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {  const dueBday = nextBusinessDay_(dueDate);

    if (isResponsabilidadeCaixa_(responsabilidade)) {  const dueY = ymd_(dueBday);

      plans.push('IPTU_CEF_BOLETO');

    } else if (isResponsabilidadeArrematante_(responsabilidade)) {  if (

      plans.push('IPTU_CLIENTE_BOLETO');    activityExistsStrong_({

    }      dealId: deal.id,

  }      subject,

        dueDateYmd: dueY,

  if (statusIPTUStr === STATUS_IDS.IPTU.SOLICITAR_CND) {      dueTime,

    if (isResponsabilidadeCaixa_(responsabilidade)) {    })

      plans.push('IPTU_CEF_SOLICITAR');  ) {

    } else if (isResponsabilidadeArrematante_(responsabilidade)) {    Logger.log("⊘ Já existe: %s | %s %s", subject, dueY, dueTime);

      plans.push('IPTU_CLIENTE_SOLICITAR');    return;

    }  }

  }

    const priorityValue = getPriorityValue_(priority);

  if (statusIPTUStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {

    if (isResponsabilidadeCaixa_(responsabilidade)) {  const body = {

      plans.push('IPTU_CEF_PENDENCIA');    subject: subject,

    }    type: ACTIVITY_TYPE_KEY,

  }    done: 0,

      deal_id: deal.id,

  if (statusIPTUStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO) {    due_date: dueY,

    if (isResponsabilidadeCaixa_(responsabilidade)) {    due_time: dueTime,

      plans.push('IPTU_CEF_ATESTE');    duration: "01:00",

    }    note: note || "",

  }    busy_flag: true,

    priority: priorityValue,

  return plans;  };

}

  if (deal.user_id && deal.user_id.id) {

/***********************    body.user_id = deal.user_id.id;

 *  CRIAÇÃO DE ATIVIDADE - MODIFICADO (SÓ VERIFICA FUNIL/ETAPA)  }

 ***********************/  if (deal.person_id && deal.person_id.value) {

function createActivity_({ deal, subject, note, dueDate, dueTime, priority }) {    body.person_id = deal.person_id.value;

  // VERIFICAÇÃO: Apenas funil/etapa corretos  }

  if (!isDealInCorrectStage_(deal)) {  if (deal.org_id && deal.org_id.value) {

    Logger.log('🚫 Criação bloqueada: Deal %s não está no funil/etapa correto', deal.id);    body.org_id = deal.org_id.value;

    return;  }

  }

    Logger.log(

  const dueBday = nextBusinessDay_(dueDate);    "🔨 Criando: %s | %s %s | Prio: %s (ID=%s)",

  const dueY = ymd_(dueBday);    subject,

    dueY,

  if (activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime })) {    dueTime,

    Logger.log('⊘ Já existe: %s | %s %s', subject, dueY, dueTime);    priority,

    return;    priorityValue

  }  );



  const priorityValue = getPriorityValue_(priority);  try {

  const activitiesUserId = getActivitiesUserId_();    const result = pd_("/activities", {

      method: "post",

  if (!activitiesUserId) {      payload: JSON.stringify(body),

    Logger.log('❌ Erro: Usuário para atividades não encontrado');    });

    return;

  }    if (result && result.data && result.data.id) {

      Logger.log("  ✅ Criada ID: %s", result.data.id);

  const body = {      Logger.log("  📊 Priority retornada: %s", result.data.priority);

    subject: subject,    }

    type: ACTIVITY_TYPE_KEY,  } catch (err) {

    done: 0,    Logger.log("  ❌ Erro: %s", err.message);

    deal_id: deal.id,    throw err;

    due_date: dueY,  }

    due_time: dueTime,}

    duration: '01:00',

    note: note || '',/***********************

    busy_flag: true, *  EXECUTOR PRINCIPAL

    priority: priorityValue, ***********************/

    user_id: activitiesUserId // SEMPRE atribui ao usuário específicofunction tick() {

  };  const today = tzToday_();

  const deals = fetchCandidateDeals_();

  if (deal.person_id && deal.person_id.value) {

    body.person_id = deal.person_id.value;  let created = 0,

  }    skipped = 0,

  if (deal.org_id && deal.org_id.value) {    checked = 0;

    body.org_id = deal.org_id.value;

  }  deals.forEach((deal) => {

    checked++;

  Logger.log('🔨 Criando: %s | %s %s | Prio: %s (ID=%s) | User: %s', 

    subject, dueY, dueTime, priority, priorityValue, activitiesUserId);    const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];

    if (!baseStr) return;

  try {

    const result = pd_('/activities', {     const baseDate = parseLocalDate_(baseStr);

      method: 'post',     const dx = diffDays_(baseDate, today);

      payload: JSON.stringify(body) 

    });    const plans = getPlansToCreate_(deal);

    if (!plans.length) return;

    if (result && result.data && result.data.id) {

      Logger.log('  ✅ Criada ID: %s', result.data.id);    for (const planKey of plans) {

      Logger.log('  📊 Priority: %s | User: %s', result.data.priority, result.data.user_id);      const pl = PLAN[planKey];

    }      const dayConfigs = pl.days.slice();

  } catch (err) {

    Logger.log('  ❌ Erro: %s', err.message);      const isStatusChange = !planKey.includes("INICIAL");

    throw err;

  }      if (isStatusChange) {

}        dayConfigs.forEach((config) => {

          const d = config.day;

/***********************          const hour = config.hour;

 *  EXECUTOR PRINCIPAL          const subject = pl.title(d);

 ***********************/          const note = pl.note(d);

function tick() {          const priority = getPriority_(planKey, d);

  const today = tzToday_();          const dueRaw = addDays_(today, d);

  const deals = fetchCandidateDeals_();          const dueBday = nextBusinessDay_(dueRaw);

          const dueTime = String(hour).padStart(2, "0") + ":00";

  let created = 0, skipped = 0, checked = 0;

          if (

  deals.forEach((deal) => {            !activityExistsStrong_({

    checked++;              dealId: deal.id,

              subject,

    const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];              dueDateYmd: ymd_(dueBday),

    if (!baseStr) return;              dueTime,

            }) &&

    const baseDate = parseLocalDate_(baseStr);            !activityExistsBySubjectType_({ dealId: deal.id, subject })

    const dx = diffDays_(baseDate, today);          ) {

            createActivity_({

    const plans = getPlansToCreate_(deal);              deal,

    if (!plans.length) return;              subject,

              note,

    for (const planKey of plans) {              dueDate: dueBday,

      const pl = PLAN[planKey];              dueTime,

      const dayConfigs = pl.days.slice();              priority,

            });

      const isStatusChange = !planKey.includes('INICIAL');            created++;

                } else {

      if (isStatusChange) {            skipped++;

        dayConfigs.forEach((config) => {          }

          const d = config.day;        });

          const hour = config.hour;      } else {

          const subject  = pl.title(d);        dayConfigs.forEach((config) => {

          const note     = pl.note(d);          const d = config.day;

          const priority = getPriority_(planKey, d);          const hour = config.hour;

          const dueRaw   = addDays_(today, d);          const dueRaw = addDays_(baseDate, d);

          const dueBday  = nextBusinessDay_(dueRaw);          const dueBday = nextBusinessDay_(dueRaw);

          const dueTime  = String(hour).padStart(2, '0') + ':00';

          if (dueBday <= today) {

          if (!activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: ymd_(dueBday), dueTime }) &&             const subject = pl.title(d);

              !activityExistsBySubjectType_({ dealId: deal.id, subject })) {            const note = pl.note(d);

            createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });            const priority = getPriority_(planKey, d);

            created++;            const dueTime = String(hour).padStart(2, "0") + ":00";

          } else {

            skipped++;            if (

          }              !activityExistsStrong_({

        });                dealId: deal.id,

      } else {                subject,

        dayConfigs.forEach((config) => {                dueDateYmd: ymd_(dueBday),

          const d = config.day;                dueTime,

          const hour = config.hour;              }) &&

          const dueRaw = addDays_(baseDate, d);              !activityExistsBySubjectType_({ dealId: deal.id, subject })

          const dueBday = nextBusinessDay_(dueRaw);            ) {

                        createActivity_({

          if (dueBday <= today) {                deal,

            const subject  = pl.title(d);                subject,

            const note     = pl.note(d);                note,

            const priority = getPriority_(planKey, d);                dueDate: dueBday,

            const dueTime  = String(hour).padStart(2, '0') + ':00';                dueTime,

                priority,

            if (!activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: ymd_(dueBday), dueTime }) &&               });

                !activityExistsBySubjectType_({ dealId: deal.id, subject })) {              created++;

              createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });            } else {

              created++;              skipped++;

            } else {            }

              skipped++;          }

            }        });

          }

        });        const nextConfig = dayConfigs.find((cfg) => {

                  const dueRaw = addDays_(baseDate, cfg.day);

        const nextConfig = dayConfigs.find(cfg => {          const dueBday = nextBusinessDay_(dueRaw);

          const dueRaw = addDays_(baseDate, cfg.day);          return dueBday > today;

          const dueBday = nextBusinessDay_(dueRaw);        });

          return dueBday > today;

        });        if (nextConfig) {

                  const nextD = nextConfig.day;

        if (nextConfig) {          const nextHour = nextConfig.hour;

          const nextD = nextConfig.day;          const subjectN = pl.title(nextD);

          const nextHour = nextConfig.hour;          const noteN = pl.note(nextD);

          const subjectN  = pl.title(nextD);          const priorityN = getPriority_(planKey, nextD);

          const noteN     = pl.note(nextD);          const dueRawN = addDays_(baseDate, nextD);

          const priorityN = getPriority_(planKey, nextD);          const dueBdayN = nextBusinessDay_(dueRawN);

          const dueRawN   = addDays_(baseDate, nextD);          const dueTimeN = String(nextHour).padStart(2, "0") + ":00";

          const dueBdayN  = nextBusinessDay_(dueRawN);

          const dueTimeN  = String(nextHour).padStart(2, '0') + ':00';          if (

            !activityExistsStrong_({

          if (!activityExistsStrong_({ dealId: deal.id, subject: subjectN, dueDateYmd: ymd_(dueBdayN), dueTime: dueTimeN }) &&               dealId: deal.id,

              !activityExistsBySubjectType_({ dealId: deal.id, subject: subjectN })) {              subject: subjectN,

            createActivity_({ deal, subject: subjectN, note: noteN, dueDate: dueBdayN, dueTime: dueTimeN, priority: priorityN });              dueDateYmd: ymd_(dueBdayN),

            created++;              dueTime: dueTimeN,

          } else {            }) &&

            skipped++;            !activityExistsBySubjectType_({

          }              dealId: deal.id,

        }              subject: subjectN,

      }            })

    }          ) {

  });            createActivity_({

              deal,

  Logger.log(JSON.stringify({ ok:true, created, skipped, checked, date: ymd_(today) }));              subject: subjectN,

}              note: noteN,

              dueDate: dueBdayN,

/***********************              dueTime: dueTimeN,

 *  FUNÇÃO DE TESTE - MODIFICADA              priority: priorityN,

 ***********************/            });

function testarNegocio(id) {            created++;

  const TEST_DEAL_ID = PropertiesService.getScriptProperties().getProperty('TEST_DEAL_ID') || '11176';          } else {

  const DEAL_ID = id || TEST_DEAL_ID;            skipped++;

  const today = tzToday_();          }

          }

  Logger.log('=== TESTE DO NEGÓCIO %s ===', DEAL_ID);      }

  Logger.log('Data de hoje: %s\n', ymd_(today));    }

    });

  Logger.log('🔍 Carregando configurações de filtro...');

  Logger.log('👤 Usuário para ATIVIDADES: %s', FILTROS.USUARIO_ATIVIDADES_EMAIL);  Logger.log(

  Logger.log('🗂️ Funil esperado: %s', FILTROS.FUNIL_NOME);    JSON.stringify({ ok: true, created, skipped, checked, date: ymd_(today) })

  Logger.log('📍 Etapa esperada: %s\n', FILTROS.ETAPA_NOME);  );

  }

  const activitiesUserId = getActivitiesUserId_();

  if (!activitiesUserId) {/***********************

    Logger.log('❌ ERRO CRÍTICO: Usuário %s não encontrado no Pipedrive', FILTROS.USUARIO_ATIVIDADES_EMAIL); *  FUNÇÃO DE TESTE

    return; ***********************/

  }function testarNegocio(id) {

    const DEAL_ID =

  Logger.log('🔍 Carregando IDs de prioridade do Pipedrive...');    id || PropertiesService.getScriptProperties().getProperty("TEST_DEAL_ID");

  const priorityIds = getPriorityIds_();  const today = tzToday_();

  Logger.log('✅ IDs carregados: %s\n', JSON.stringify(priorityIds));

    Logger.log("=== TESTE DO NEGÓCIO %s ===", DEAL_ID);

  const dealResp = pd_('/deals/' + DEAL_ID);  Logger.log("Data de hoje: %s\n", ymd_(today));

  const deal = dealResp && dealResp.data;

    Logger.log("🔍 Carregando IDs de prioridade do Pipedrive...");

  if (!deal) {   const priorityIds = getPriorityIds_();

    Logger.log('❌ Negócio %s não encontrado.', DEAL_ID);   Logger.log("✅ IDs carregados: %s\n", JSON.stringify(priorityIds));

    return; 

  }  const dealResp = pd_("/deals/" + DEAL_ID);

  const deal = dealResp && dealResp.data;

  Logger.log('📋 Informações do Deal:');

  Logger.log('  • ID: %s', deal.id);  if (!deal) {

  Logger.log('  • Título: %s', deal.title);    Logger.log("❌ Negócio %s não encontrado.", DEAL_ID);

  Logger.log('  • Status: %s', deal.status);    return;

  Logger.log('  • User ID do Deal: %s', deal.user_id && deal.user_id.id ? deal.user_id.id : deal.user_id);  }

  Logger.log('  • Pipeline ID: %s', deal.pipeline_id);

  Logger.log('  • Stage ID: %s\n', deal.stage_id);  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];

  const hasTerminoIPTU = !!deal[FIELD_KEYS.dataTerminoIPTU];

  // VERIFICAÇÃO: Funil e Etapa  const statusIPTUStr = String(deal[FIELD_KEYS.statusIPTU] || "").trim();

  Logger.log('🔍 VERIFICAÇÃO: Funil e Etapa');

  const stageCheck = isDealInCorrectStage_(deal);  if (

  if (!stageCheck) {    !baseStr ||

    Logger.log('❌ BLOQUEADO: Deal não está no funil "%s" e etapa "%s"\n',     hasTerminoIPTU ||

      FILTROS.FUNIL_NOME, FILTROS.ETAPA_NOME);    statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE

    return;  ) {

  }    Logger.log("❌ Elegibilidade falhou:");

  Logger.log('✅ Funil e Etapa OK\n');    Logger.log("   Data Término Triagem: %s", baseStr ? "✅" : "❌");

    Logger.log("   IPTU finalizado: %s", hasTerminoIPTU ? "❌ SIM" : "✅ NÃO");

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];    Logger.log(

  const hasTerminoIPTU = !!deal[FIELD_KEYS.dataTerminoIPTU];      "   CND salva no Drive: %s",

  const statusIPTUStr = String(deal[FIELD_KEYS.statusIPTU] || '').trim();      statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE ? "❌ SIM" : "✅ NÃO"

      );

  Logger.log('🔍 VERIFICAÇÃO: Campos obrigatórios');    return;

  if (!baseStr || hasTerminoIPTU || statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {  }

    Logger.log('❌ Elegibilidade falhou:');

    Logger.log('   Data Término Triagem: %s', baseStr ? '✅' : '❌');  const baseDate = parseLocalDate_(baseStr);

    Logger.log('   IPTU finalizado: %s', hasTerminoIPTU ? '❌ SIM' : '✅ NÃO');  const dx = diffDays_(baseDate, today);

    Logger.log('   CND salva no Drive: %s', statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE ? '❌ SIM' : '✅ NÃO');

    return;  Logger.log("📅 Data Término Triagem: %s", ymd_(baseDate));

  }  Logger.log("📊 Dias desde término da triagem: %s\n", dx);

  Logger.log('✅ Campos obrigatórios OK\n');

  const plans = getPlansToCreate_(deal);

  const baseDate = parseLocalDate_(baseStr);

  const dx = diffDays_(baseDate, today);  if (!plans.length) {

      Logger.log("❌ Sem planos a criar para deal %s", DEAL_ID);

  Logger.log('📅 Data Término Triagem: %s', ymd_(baseDate));    Logger.log(

  Logger.log('📊 Dias desde término da triagem: %s\n', dx);      "Motivo: Status não mapeado, responsabilidade não definida ou CND já salva\n"

  Logger.log('⚠️ IMPORTANTE: Atividades serão criadas para o usuário ID %s (%s)\n',     );

    activitiesUserId, FILTROS.USUARIO_ATIVIDADES_EMAIL);

    Logger.log("Status atual:");

  const plans = getPlansToCreate_(deal);    Logger.log("  • Status IPTU: %s", deal[FIELD_KEYS.statusIPTU] || "(vazio)");

      Logger.log(

  if (!plans.length) {      "  • Responsabilidade: %s",

    Logger.log('❌ Sem planos a criar para deal %s', DEAL_ID);      deal[FIELD_KEYS.iptuResponsabilidade] || "(vazio)"

    return;    );

  }    Logger.log("\nStatus mapeados:");

    Logger.log("  • INICIAR: %s", STATUS_IDS.IPTU.INICIAR);

  Logger.log('✅ Planos identificados: %s\n', plans.join(', '));    Logger.log("  • BOLETO_ENVIADO: %s", STATUS_IDS.IPTU.BOLETO_ENVIADO);

  Logger.log('🚀 Processando criação de atividades...\n');    Logger.log(

      "  • PENDENCIA_DOCUMENTAL: %s",

  let totalCreated = 0;      STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL

  let totalSkipped = 0;    );

    Logger.log("  • ATESTE_RECEBIDO: %s", STATUS_IDS.IPTU.ATESTE_RECEBIDO);

  for (const planKey of plans) {    Logger.log("  • SOLICITAR_CND: %s", STATUS_IDS.IPTU.SOLICITAR_CND);

    Logger.log('--- Processando plano: %s ---', planKey);    Logger.log(

    const pl = PLAN[planKey];      "  • CND_SALVA_DRIVE (bloqueador): %s",

    const dayConfigs = pl.days.slice();      STATUS_IDS.IPTU.CND_SALVA_DRIVE

    );

    const isStatusChange = !planKey.includes('INICIAL');    return;

      }

    if (isStatusChange) {

      dayConfigs.forEach((config) => {  Logger.log("✅ Planos identificados: %s\n", plans.join(", "));

        const d = config.day;

        const hour = config.hour;  let totalCreated = 0;

        const s = pl.title(d);  let totalSkipped = 0;

        const n = pl.note(d);

        const p = getPriority_(planKey, d);  for (const planKey of plans) {

        const pValue = getPriorityValue_(p);    Logger.log("--- Processando plano: %s ---", planKey);

        const dueRaw = addDays_(today, d);    const pl = PLAN[planKey];

        const dueB = nextBusinessDay_(dueRaw);    const dayConfigs = pl.days.slice();

        const dueY = ymd_(dueB);

        const dueTime = String(hour).padStart(2, '0') + ':00';    const isStatusChange = !planKey.includes("INICIAL");

        

        if (!activityExistsStrong_({ dealId: DEAL_ID, subject: s, dueDateYmd: dueY, dueTime }) &&     if (isStatusChange) {

            !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })) {      dayConfigs.forEach((config) => {

          createActivity_({ deal, subject: s, note: n, dueDate: dueB, dueTime, priority: p });        const d = config.day;

          Logger.log('  ✔ Status Change: +%s dias %s | %s | prio %s (ID=%s)', d, dueTime, s, p, pValue);        const hour = config.hour;

          totalCreated++;        const s = pl.title(d);

        } else {        const n = pl.note(d);

          Logger.log('  ⊘ Já existe: +%s dias %s | %s', d, dueTime, s);        const p = getPriority_(planKey, d);

          totalSkipped++;        const pValue = getPriorityValue_(p);

        }        const dueRaw = addDays_(today, d);

      });        const dueB = nextBusinessDay_(dueRaw);

    } else {        const dueY = ymd_(dueB);

      Logger.log('  📋 Criando atividades passadas (backlog):');        const dueTime = String(hour).padStart(2, "0") + ":00";

      

      dayConfigs.forEach((config) => {        if (

        const d = config.day;          !activityExistsStrong_({

        const hour = config.hour;            dealId: DEAL_ID,

        const dueRaw = addDays_(baseDate, d);            subject: s,

        const dueBday = nextBusinessDay_(dueRaw);            dueDateYmd: dueY,

                    dueTime,

        if (dueBday <= today) {          }) &&

          const s = pl.title(d);          !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })

          const n = pl.note(d);        ) {

          const p = getPriority_(planKey, d);          createActivity_({

          const pValue = getPriorityValue_(p);            deal,

          const dueY = ymd_(dueBday);            subject: s,

          const dueTime = String(hour).padStart(2, '0') + ':00';            note: n,

                      dueDate: dueB,

          if (!activityExistsStrong_({ dealId: DEAL_ID, subject: s, dueDateYmd: dueY, dueTime }) &&             dueTime,

              !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })) {            priority: p,

            createActivity_({ deal, subject: s, note: n, dueDate: dueBday, dueTime, priority: p });          });

            Logger.log('  ✔ Backlog: D+%s vence %s %s | %s | prio %s (ID=%s)', d, dueY, dueTime, s, p, pValue);          Logger.log(

            totalCreated++;            "  ✔ Status Change: +%s dias %s | %s | prio %s (ID=%s)",

          } else {            d,

            Logger.log('  ⊘ Já existe: D+%s vence %s %s | %s', d, dueY, dueTime, s);            dueTime,

            totalSkipped++;            s,

          }            p,

        }            pValue

      });          );

                totalCreated++;

      Logger.log('  📋 Criando próxima atividade futura:');        } else {

                Logger.log("  ⊘ Já existe: +%s dias %s | %s", d, dueTime, s);

      const nextConfig = dayConfigs.find(cfg => {          totalSkipped++;

        const dueRaw = addDays_(baseDate, cfg.day);        }

        const dueBday = nextBusinessDay_(dueRaw);      });

        return dueBday > today;    } else {

      });      Logger.log("  📋 Criando atividades passadas (backlog):");

      

      if (nextConfig) {      dayConfigs.forEach((config) => {

        const nextD = nextConfig.day;        const d = config.day;

        const nextHour = nextConfig.hour;        const hour = config.hour;

        const sN = pl.title(nextD);        const dueRaw = addDays_(baseDate, d);

        const nN = pl.note(nextD);        const dueBday = nextBusinessDay_(dueRaw);

        const pN = getPriority_(planKey, nextD);

        const pValueN = getPriorityValue_(pN);        if (dueBday <= today) {

        const dueRawN = addDays_(baseDate, nextD);          const s = pl.title(d);

        const dueBN = nextBusinessDay_(dueRawN);          const n = pl.note(d);

        const dueYN = ymd_(dueBN);          const p = getPriority_(planKey, d);

        const dueTimeN = String(nextHour).padStart(2, '0') + ':00';          const pValue = getPriorityValue_(p);

                  const dueY = ymd_(dueBday);

        if (!activityExistsStrong_({ dealId: DEAL_ID, subject: sN, dueDateYmd: dueYN, dueTime: dueTimeN }) &&           const dueTime = String(hour).padStart(2, "0") + ":00";

            !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: sN })) {

          createActivity_({ deal, subject: sN, note: nN, dueDate: dueBN, dueTime: dueTimeN, priority: pN });          if (

          Logger.log('  ✔ Próxima: D+%s vence %s %s | %s | prio %s (ID=%s)', nextD, dueYN, dueTimeN, sN, pN, pValueN);            !activityExistsStrong_({

          totalCreated++;              dealId: DEAL_ID,

        } else {              subject: s,

          Logger.log('  ⊘ Já existe: D+%s vence %s %s | %s', nextD, dueYN, dueTimeN, sN);              dueDateYmd: dueY,

          totalSkipped++;              dueTime,

        }            }) &&

      }            !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })

    }          ) {

                createActivity_({

    Logger.log('');              deal,

  }              subject: s,

                note: n,

  Logger.log('=== RESUMO ===');              dueDate: dueBday,

  Logger.log('✅ Atividades criadas: %s', totalCreated);              dueTime,

  Logger.log('⊘ Atividades puladas: %s', totalSkipped);              priority: p,

  Logger.log('🎯 Total processado: %s', totalCreated + totalSkipped);            });

  Logger.log('👤 Todas atividades atribuídas ao usuário: %s (ID: %s)',             Logger.log(

    FILTROS.USUARIO_ATIVIDADES_EMAIL, activitiesUserId);              "  ✔ Backlog: D+%s vence %s %s | %s | prio %s (ID=%s)",

  Logger.log('\n=== FIM DO TESTE ===');              d,

}              dueY,

              dueTime,
              s,
              p,
              pValue
            );
            totalCreated++;
          } else {
            Logger.log(
              "  ⊘ Já existe: D+%s vence %s %s | %s",
              d,
              dueY,
              dueTime,
              s
            );
            totalSkipped++;
          }
        }
      });

      Logger.log("  📋 Criando próxima atividade futura:");

      const nextConfig = dayConfigs.find((cfg) => {
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
        const dueTimeN = String(nextHour).padStart(2, "0") + ":00";

        if (
          !activityExistsStrong_({
            dealId: DEAL_ID,
            subject: sN,
            dueDateYmd: dueYN,
            dueTime: dueTimeN,
          }) &&
          !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: sN })
        ) {
          createActivity_({
            deal,
            subject: sN,
            note: nN,
            dueDate: dueBN,
            dueTime: dueTimeN,
            priority: pN,
          });
          Logger.log(
            "  ✔ Próxima: D+%s vence %s %s | %s | prio %s (ID=%s)",
            nextD,
            dueYN,
            dueTimeN,
            sN,
            pN,
            pValueN
          );
          totalCreated++;
        } else {
          Logger.log(
            "  ⊘ Já existe: D+%s vence %s %s | %s",
            nextD,
            dueYN,
            dueTimeN,
            sN
          );
          totalSkipped++;
        }
      }
    }

    Logger.log("");
  }

  Logger.log("=== RESUMO ===");
  Logger.log("✅ Atividades criadas: %s", totalCreated);
  Logger.log("⊘ Atividades puladas: %s", totalSkipped);
  Logger.log("🎯 Total processado: %s", totalCreated + totalSkipped);
  Logger.log("\n=== FIM DO TESTE ===");
}
