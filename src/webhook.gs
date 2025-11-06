/***********************/***********************

 *  WEBHOOK HANDLER - ANTI-DUPLICAÇÃO v3.0 *  WEBHOOK HANDLER - IPTU

 ***********************/ ***********************/



// Configurações do webhook// Configurações obtidas das propriedades do script

const WEBHOOK_CONFIG = (() => {const CFG = (() => {

  const props = PropertiesService.getScriptProperties();  const props = PropertiesService.getScriptProperties();

  return {  return {

    SHEET_ID: props.getProperty('SHEET_ID'),    TOKEN: props.getProperty('PIPEDRIVE_API_TOKEN'),

    LOG_SHEET: 'WebhookLog',    BASE: props.getProperty('PIPEDRIVE_BASE_URL') || 'https://api.pipedrive.com/v1',

    ERR_SHEET: 'WebhookErrors',    TZ: props.getProperty('TIMEZONE') || 'America/Sao_Paulo',

    DEBUG_SHEET: 'WebhookDebug',    SHEET_ID: props.getProperty('SHEET_ID'),

    ALLOWED_DEAL: props.getProperty('ALLOWED_DEAL_ID') || null,    ACTIVITY_TYPE_KEY: props.getProperty('ACTIVITY_TYPE_KEY') || 'escritura'

    MAX_LOG_ROWS: 200,  };

    MAX_ERR_ROWS: 100,})();

    MAX_DEBUG_ROWS: 500,

    LOCK_SECONDS: 30,// Configurações do webhook

    CACHE_VALIDITY: 86400,const WEBHOOK_CONFIG = {

    MEMORY_CACHE_TTL: 3600  DEBOUNCE_SECONDS: parseInt(PropertiesService.getScriptProperties().getProperty('DEBOUNCE_SECONDS') || '15'),

  };  GLOBAL_COOLDOWN_MINUTES: parseInt(PropertiesService.getScriptProperties().getProperty('GLOBAL_COOLDOWN_MINUTES') || '2'),

})();  CACHE_LOCK_SECONDS: parseInt(PropertiesService.getScriptProperties().getProperty('CACHE_LOCK_SECONDS') || '30'),

  ALLOWED_DEAL_ID: PropertiesService.getScriptProperties().getProperty('ALLOWED_DEAL_ID')

// Cache em memória para atividades};

if (typeof WEBHOOK_ACTIVITIES_CACHE === 'undefined') {

  var WEBHOOK_ACTIVITIES_CACHE = {};// IDs dos campos e status - Configure nas propriedades do script

}const FIELD_KEYS = {

  dataTerminoTriagem: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_TRIAGEM'),

const WEBHOOK_LOCK = PropertiesService.getScriptProperties();  dataTerminoIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_IPTU'),

  statusIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_STATUS_IPTU'),

/***********************  iptuResponsabilidade: PropertiesService.getScriptProperties().getProperty('FIELD_IPTU_RESPONSABILIDADE')

 *  FINGERPRINT (dealId + subject)};

 ***********************/

function getActivityFingerprint_(dealId, subject) {const STATUS_IDS = {

  const normalized = normalizeSubject_(subject);  IPTU: {

  const data = `${dealId}|${normalized}`;    INICIAR: PropertiesService.getScriptProperties().getProperty('STATUS_INICIAR'),

      BOLETO_ENVIADO: PropertiesService.getScriptProperties().getProperty('STATUS_BOLETO_ENVIADO'),

  return Utilities.computeDigest(    PENDENCIA_DOCUMENTAL: PropertiesService.getScriptProperties().getProperty('STATUS_PENDENCIA_DOCUMENTAL'),

    Utilities.DigestAlgorithm.MD5,    ATESTE_RECEBIDO: PropertiesService.getScriptProperties().getProperty('STATUS_ATESTE_RECEBIDO'),

    data    SOLICITAR_CND: PropertiesService.getScriptProperties().getProperty('STATUS_SOLICITAR_CND'),

  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))    CND_SALVA_DRIVE: PropertiesService.getScriptProperties().getProperty('STATUS_CND_SALVA_DRIVE')

   .join('')  }

   .substring(0, 12);};

}

const RESPONSABILIDADE_IDS = {

/***********************  ARREMATANTE: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_ARREMATANTE'),

 *  SISTEMA DE LOCK  CAIXA: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_CAIXA')

 ***********************/};

function webhookIsProcessing_(dealId, changeHash) {

  const lockKey = `LOCK_${dealId}_${changeHash}`;// Cache e controles globais

  const now = Date.now();const CREATED_ACTIVITIES_CACHE = {};

  const PROCESSING_LOCK = PropertiesService.getScriptProperties();

  try {const CACHE_LOCK = CacheService.getScriptCache();

    const lastProcessed = WEBHOOK_LOCK.getProperty(lockKey);

    /***********************

    if (lastProcessed) { *  HANDLERS PRINCIPAIS

      const elapsed = (now - parseInt(lastProcessed)) / 1000; ***********************/

      if (elapsed < WEBHOOK_CONFIG.LOCK_SECONDS) return true;function doPost(e) {

    }  try {

        const payload = parseWebhookPayload_(e);

    WEBHOOK_LOCK.setProperty(lockKey, String(now));    const { dealId, current: deal, previous, action, entity, title } = payload;

    return false;

  } catch (err) {    // Validação de deal permitido

    return false;    if (WEBHOOK_CONFIG.ALLOWED_DEAL_ID && String(dealId) !== String(WEBHOOK_CONFIG.ALLOWED_DEAL_ID)) {

  }      Logger.log('[Deal %s] ⚠️ Deal não permitido. Apenas deal %s é processado.', dealId, WEBHOOK_CONFIG.ALLOWED_DEAL_ID);

}      return jsonResponse_({ 

        ok: true, 

function webhookGetChangeHash_(dealId, plans) {        skipped: 'deal_not_allowed', 

  const planStr = plans.map(p => p.plan).sort().join('|');        dealId: dealId,

  return Utilities.computeDigest(        message: `Apenas deal ${WEBHOOK_CONFIG.ALLOWED_DEAL_ID} é processado`

    Utilities.DigestAlgorithm.MD5,      });

    `${dealId}_${planStr}`    }

  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 12);

}    if (entity === 'deal' && dealId) {

      return processDealWebhook_(deal, previous, title);

/***********************    }

 *  DEBUG LOGGING

 ***********************/    return jsonResponse_({

function webhookDebug_(message, data) {      ok: true,

  if (!WEBHOOK_CONFIG.SHEET_ID) return;      processed: new Date().toISOString(),

        action: action,

  try {      entity: entity,

    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);      dealId: dealId

    let sh = ss.getSheetByName(WEBHOOK_CONFIG.DEBUG_SHEET);    });

    

    if (!sh) {  } catch (err) {

      sh = ss.insertSheet(WEBHOOK_CONFIG.DEBUG_SHEET);    Logger.log('❌ Erro no webhook: %s', err.message);

      const headers = ['Timestamp', 'Mensagem', 'Dados'];    logError_('doPost', err, e);

      sh.getRange(1, 1, 1, 3).setValues([headers])    return jsonResponse_({

        .setFontWeight('bold').setBackground('#FF9800').setFontColor('#ffffff');      ok: false,

      sh.setFrozenRows(1);      error: String(err && err.message || err),

    }      timestamp: new Date().toISOString()

        });

    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm:ss');  }

    const dataStr = data ? JSON.stringify(data, null, 2) : '';}

    sh.appendRow([timestamp, String(message), dataStr]);

    function doGet(e) {

    const lastRow = sh.getLastRow();  return ContentService

    if (lastRow > WEBHOOK_CONFIG.MAX_DEBUG_ROWS + 1) {    .createTextOutput(JSON.stringify({

      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_DEBUG_ROWS - 1);      status: 'online',

    }      service: 'Pipedrive Webhook Handler - IPTU',

  } catch (err) {      allowedDealId: WEBHOOK_CONFIG.ALLOWED_DEAL_ID,

    Logger.log('Erro no debug: %s', err.message);      timestamp: new Date().toISOString(),

  }      statusIds: STATUS_IDS

}    }))

    .setMimeType(ContentService.MimeType.JSON);

/***********************}

 *  VERIFICAÇÃO DE ATIVIDADE EXISTENTE

 *  Estratégia: Verifica apenas por SUBJECT/***********************

 ***********************/ *  PROCESSAMENTO DE DEAL

function webhookActivityExists_(dealId, subject) { ***********************/

  const fingerprint = getActivityFingerprint_(dealId, subject);function processDealWebhook_(deal, previous, title) {

  const memKey = `ACT_${fingerprint}`;  const dealId = deal.id;

    

  // 1. Cache em memória  // Buscar dados completos do deal

  if (WEBHOOK_ACTIVITIES_CACHE[memKey]) {  let fullDeal = deal;

    const age = (Date.now() - WEBHOOK_ACTIVITIES_CACHE[memKey]) / 1000;  try {

    if (age < WEBHOOK_CONFIG.MEMORY_CACHE_TTL) {    const response = makeApiRequest_('/deals/' + dealId);

      return true;    if (response && response.data) fullDeal = response.data;

    }  } catch (err) {

    delete WEBHOOK_ACTIVITIES_CACHE[memKey];    Logger.log('[Deal %s] ⚠️ Erro ao buscar dados completos: %s', dealId, err.message);

  }  }

  

  // 2. Cache persistente  // Verificar elegibilidade

  const persistentKey = `ACT_${fingerprint}`;  if (!isDealEligible_(fullDeal)) {

  try {    const reason = getIneligibilityReason_(fullDeal);

    const cached = WEBHOOK_LOCK.getProperty(persistentKey);    Logger.log('[Deal %s] ⚠️ Não elegível: %s', dealId, reason);

    if (cached) {    

      const age = (Date.now() - parseInt(cached)) / 1000;    return jsonResponse_({ 

      if (age < WEBHOOK_CONFIG.CACHE_VALIDITY) {      ok: true, 

        WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();      skipped: 'not_eligible', 

        return true;      dealId: dealId,

      }      reason: reason

      WEBHOOK_LOCK.deleteProperty(persistentKey);    });

    }  }

  } catch (err) {

    Logger.log('Erro ao verificar cache persistente: %s', err.message);  // Detectar mudanças de status

  }  const statusChanges = detectStatusChanges_(fullDeal, previous);

    

  // 3. Verificação na API (apenas por subject e tipo)  if (statusChanges.length === 0) {

  try {    Logger.log('[Deal %s] ℹ️ Nenhuma mudança de status detectada', dealId);

    const subjNorm = normalizeSubject_(subject);    return jsonResponse_({ ok: true, skipped: 'no_valid_status_change', dealId });

    const list = listActivitiesAll_(dealId);  }

    

    const found = list.find(a => {  const changeKey = statusChanges.map(c => c.plan).sort().join(',');

      const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY);  Logger.log('[Deal %s] 🎯 Mudanças detectadas: %s', dealId, changeKey);

      const sameSubj = (normalizeSubject_(a.subject) === subjNorm);  

      return sameType && sameSubj;  // Controles de duplicação

    });  if (!acquireLocks_(dealId, changeKey)) {

        return jsonResponse_({ 

    if (found) {      ok: true, 

      // Salva no cache      skipped: 'locked', 

      WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();      dealId: dealId,

      try {      message: 'Deal em processamento ou processado recentemente'

        WEBHOOK_LOCK.setProperty(persistentKey, String(Date.now()));    });

      } catch (err) {  }

        Logger.log('Erro ao salvar cache persistente: %s', err.message);

      }  try {

          const result = processActivitiesCreation_(fullDeal, statusChanges);

      webhookDebug_('Atividade já existe', {     

        dealId,     const activityText = result.created > 0 

        subject,       ? (result.createdActivities ? result.createdActivities.join('\n') : `${result.created} criada(s)`)

        activityId: found.id,      : 'Nenhuma';

        dueDate: found.due_date,    

        dueTime: found.due_time,    const detailText = result.created > 0 

        done: found.done      ? `${result.created} criada(s)` 

      });      : (result.skipped > 0 ? `${result.skipped} já existente(s)` : 'Nenhuma ação necessária');

      

      return true;    if (result.created > 0) {

    }      markDealAsProcessed_(dealId);

          Logger.log('[Deal %s] ✅ %d atividades criadas com sucesso', dealId, result.created);

    return false;    } else {

          Logger.log('[Deal %s] ℹ️ %s', dealId, detailText);

  } catch (err) {    }

    webhookDebug_('Erro ao verificar atividade', { dealId, subject, error: err.message });

    return false;    // Log da operação

  }    logWebhookActivity_({

}      timestamp: new Date(),

      dealId: dealId,

/***********************      title: title,

 *  DELETA ATIVIDADES INCOMPATÍVEIS      action: 'Processamento IPTU',

 *  Remove atividades conflitantes ao mudar responsabilidade      atividadesCriadas: activityText,

 ***********************/      detalhes: detailText

function webhookDeleteIncompatibleActivities_(dealId, currentPlan) {    });

  const incompatiblePlans = {

    'IPTU_CEF_INICIAL': ['IPTU_CLIENTE_INICIAL'],    return jsonResponse_({

    'IPTU_CLIENTE_INICIAL': ['IPTU_CEF_INICIAL'],      ok: true,

    'IPTU_CEF_BOLETO': ['IPTU_CLIENTE_BOLETO'],      processed: new Date().toISOString(),

    'IPTU_CLIENTE_BOLETO': ['IPTU_CEF_BOLETO'],      dealId: dealId,

    'IPTU_CEF_SOLICITAR': ['IPTU_CLIENTE_SOLICITAR'],      statusChanges: statusChanges,

    'IPTU_CLIENTE_SOLICITAR': ['IPTU_CEF_SOLICITAR']      result: result

  };    });

  

  const toDelete = incompatiblePlans[currentPlan] || [];  } finally {

  if (toDelete.length === 0) return 0;    releaseLocks_(dealId, changeKey);

    }

  let deleted = 0;}

  

  try {/***********************

    const activities = listActivitiesAll_(dealId); *  UTILITÁRIOS DO WEBHOOK

     ***********************/

    for (const activity of activities) {function parseWebhookPayload_(e) {

      const activitySubject = normalizeSubject_(activity.subject);  const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';

        

      for (const incompatiblePlan of toDelete) {  if (!raw) throw new Error('Evento sem corpo postData');

        const pl = PLAN[incompatiblePlan];

        if (!pl) continue;  let payload;

          try {

        for (const config of pl.days) {    payload = JSON.parse(raw);

          const expectedSubject = normalizeSubject_(pl.title(config.day));  } catch (err) {

              throw new Error('JSON inválido: ' + err.message);

          if (activitySubject === expectedSubject) {  }

            try {

              pd_('/activities/' + activity.id, { method: 'delete' });  const meta = payload.meta || {};

              deleted++;  const current = payload.data || payload.current || {};

                const previous = payload.previous || {};

              // Remove do cache

              const fp = getActivityFingerprint_(dealId, activity.subject);  return {

              delete WEBHOOK_ACTIVITIES_CACHE[`ACT_${fp}`];    action: meta.action || '',

              try {    entity: meta.object || meta.entity || '',

                WEBHOOK_LOCK.deleteProperty(`ACT_${fp}`);    dealId: current.id || '',

              } catch (err) {}    title: current.title || '',

                  current: current,

              webhookDebug_('Atividade deletada', {     previous: previous

                dealId,   };

                activityId: activity.id, }

                subject: activity.subject 

              });function isDealEligible_(deal) {

                const statusIPTU = String(deal[FIELD_KEYS.statusIPTU] || '').trim();

            } catch (err) {  

              Logger.log('Erro ao deletar atividade %s: %s', activity.id, err.message);  if (deal.status !== 'open') return false;

            }  if (!deal[FIELD_KEYS.dataTerminoTriagem]) return false;

            break;  if (deal[FIELD_KEYS.dataTerminoIPTU]) return false;

          }  if (!deal[FIELD_KEYS.statusIPTU]) return false;

        }  if (!deal[FIELD_KEYS.iptuResponsabilidade]) return false;

      }  if (statusIPTU === STATUS_IDS.IPTU.CND_SALVA_DRIVE) return false;

    }  

  } catch (err) {  return true;

    Logger.log('Erro ao deletar atividades incompatíveis: %s', err.message);}

  }

  function getIneligibilityReason_(deal) {

  return deleted;  const statusIPTU = String(deal[FIELD_KEYS.statusIPTU] || '').trim();

}  

  if (deal.status !== 'open') return 'Status ≠ "Aberto"';

/***********************  if (!deal[FIELD_KEYS.dataTerminoTriagem]) return 'Sem "Data Término Triagem"';

 *  DETECÇÃO DE MUDANÇAS DE STATUS  if (deal[FIELD_KEYS.dataTerminoIPTU]) return 'IPTU já finalizado';

 ***********************/  if (statusIPTU === STATUS_IDS.IPTU.CND_SALVA_DRIVE) return 'CND já salva no Drive (processo finalizado)';

function webhookDetectChanges_(currentDeal, previousPayload) {  if (!deal[FIELD_KEYS.statusIPTU]) return 'Sem status IPTU definido';

  const changes = [];  if (!deal[FIELD_KEYS.iptuResponsabilidade]) return 'Sem responsabilidade IPTU definida';

  const currentStatus = currentDeal[FIELD_KEYS.statusIPTU];  

  const currentResp = currentDeal[FIELD_KEYS.iptuResponsabilidade];  return 'Motivo desconhecido';

  }

  // Extrair status anterior

  let previousStatus = null;/***********************

  if (previousPayload && previousPayload[FIELD_KEYS.statusIPTU] !== undefined) { *  CONTROLES DE DUPLICAÇÃO

    const val = previousPayload[FIELD_KEYS.statusIPTU]; ***********************/

    previousStatus = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;function acquireLocks_(dealId, changeKey) {

  }  // Cache lock

    const cacheKey = `PROC_${dealId}_${changeKey}`;

  // Extrair responsabilidade anterior  if (CACHE_LOCK.get(cacheKey)) {

  let previousResp = null;    Logger.log('[Deal %s] 🚫 BLOQUEADO - Cache lock ativo', dealId);

  if (previousPayload && previousPayload[FIELD_KEYS.iptuResponsabilidade] !== undefined) {    return false;

    const val = previousPayload[FIELD_KEYS.iptuResponsabilidade];  }

    previousResp = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;  CACHE_LOCK.put(cacheKey, 'true', WEBHOOK_CONFIG.CACHE_LOCK_SECONDS);

  }

    // Verificar se foi processado recentemente

  const currentStatusStr = String(currentStatus || '').trim();  if (isDealRecentlyProcessed_(dealId)) {

  const previousStatusStr = String(previousStatus || '').trim();    CACHE_LOCK.remove(cacheKey);

  const currentRespStr = String(currentResp || '').trim();    Logger.log('[Deal %s] ⏸️ Processado recentemente', dealId);

  const previousRespStr = String(previousResp || '').trim();    return false;

    }

  // Bloqueia se CND já foi salva

  if (currentStatusStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {  // Processing lock

    return changes;  const lockKey = `LOCK_${dealId}_${changeKey}`;

  }  const now = new Date().getTime();

    const lastProcessed = PROCESSING_LOCK.getProperty(lockKey);

  // Detecção de mudança de responsabilidade  

  if (previousRespStr && currentRespStr && previousRespStr !== currentRespStr) {  if (lastProcessed) {

    if (isResponsabilidadeCaixa_(currentResp) && isIniciar_(currentStatus)) {    const diffSeconds = (now - parseInt(lastProcessed)) / 1000;

      changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'resp_change', to: 'cef' });    if (diffSeconds < WEBHOOK_CONFIG.DEBOUNCE_SECONDS) {

    }      CACHE_LOCK.remove(cacheKey);

    if (isResponsabilidadeArrematante_(currentResp) && isIniciar_(currentStatus)) {      Logger.log('[Deal %s] ⏸️ LOCK ATIVO - Ignorando (processado há %ss)', dealId, diffSeconds.toFixed(1));

      changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'resp_change', to: 'cliente' });      return false;

    }    }

    if (isResponsabilidadeCaixa_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {  }

      changes.push({ plan: 'IPTU_CEF_BOLETO', from: 'resp_change', to: 'cef_boleto' });  

    }  PROCESSING_LOCK.setProperty(lockKey, String(now));

    if (isResponsabilidadeArrematante_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {  Logger.log('[Deal %s] 🔒 Locks adquiridos', dealId);

      changes.push({ plan: 'IPTU_CLIENTE_BOLETO', from: 'resp_change', to: 'cliente_boleto' });  return true;

    }}

    if (isResponsabilidadeCaixa_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND) {

      changes.push({ plan: 'IPTU_CEF_SOLICITAR', from: 'resp_change', to: 'cef_solicitar' });function releaseLocks_(dealId, changeKey) {

    }  const cacheKey = `PROC_${dealId}_${changeKey}`;

    if (isResponsabilidadeArrematante_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND) {  const lockKey = `LOCK_${dealId}_${changeKey}`;

      changes.push({ plan: 'IPTU_CLIENTE_SOLICITAR', from: 'resp_change', to: 'cliente_solicitar' });  

    }  CACHE_LOCK.remove(cacheKey);

  }  try {

      PROCESSING_LOCK.deleteProperty(lockKey);

  // Detecção de mudança de status  } catch (err) {

  if (currentStatusStr === STATUS_IDS.IPTU.INICIAR && previousStatusStr !== STATUS_IDS.IPTU.INICIAR) {    Logger.log('[Deal %s] ⚠️ Erro ao liberar lock: %s', dealId, err.message);

    if (isResponsabilidadeCaixa_(currentResp)) {  }

      if (!changes.some(c => c.plan === 'IPTU_CEF_INICIAL')) {  

        changes.push({ plan: 'IPTU_CEF_INICIAL', from: previousStatusStr, to: 'iniciar_cef' });  Logger.log('[Deal %s] 🔓 Locks liberados', dealId);

      }}

    } else if (isResponsabilidadeArrematante_(currentResp)) {

      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL')) {function isDealRecentlyProcessed_(dealId) {

        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: previousStatusStr, to: 'iniciar_cliente' });  const globalKey = `GLOBAL_PROCESSED_${dealId}`;

      }  const lastTime = PROCESSING_LOCK.getProperty(globalKey);

    }  

  }  if (lastTime) {

      const diffMinutes = (new Date().getTime() - parseInt(lastTime)) / 60000;

  if (currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO && previousStatusStr !== STATUS_IDS.IPTU.BOLETO_ENVIADO) {    if (diffMinutes < WEBHOOK_CONFIG.GLOBAL_COOLDOWN_MINUTES) {

    if (isResponsabilidadeCaixa_(currentResp)) {      return true;

      if (!changes.some(c => c.plan === 'IPTU_CEF_BOLETO')) {    }

        changes.push({ plan: 'IPTU_CEF_BOLETO', from: previousStatusStr, to: 'boleto_cef' });  }

      }  

    } else if (isResponsabilidadeArrematante_(currentResp)) {  return false;

      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_BOLETO')) {}

        changes.push({ plan: 'IPTU_CLIENTE_BOLETO', from: previousStatusStr, to: 'boleto_cliente' });

      }function markDealAsProcessed_(dealId) {

    }  const globalKey = `GLOBAL_PROCESSED_${dealId}`;

  }  PROCESSING_LOCK.setProperty(globalKey, String(new Date().getTime()));

  }

  if (currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND && previousStatusStr !== STATUS_IDS.IPTU.SOLICITAR_CND) {

    if (isResponsabilidadeCaixa_(currentResp)) {/***********************

      if (!changes.some(c => c.plan === 'IPTU_CEF_SOLICITAR')) { *  DETECÇÃO DE MUDANÇAS

        changes.push({ plan: 'IPTU_CEF_SOLICITAR', from: previousStatusStr, to: 'solicitar_cef' }); ***********************/

      }function detectStatusChanges_(currentDeal, previousPayload) {

    } else if (isResponsabilidadeArrematante_(currentResp)) {  const changes = [];

      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_SOLICITAR')) {  const currentStatus = currentDeal[FIELD_KEYS.statusIPTU];

        changes.push({ plan: 'IPTU_CLIENTE_SOLICITAR', from: previousStatusStr, to: 'solicitar_cliente' });  const currentResp = currentDeal[FIELD_KEYS.iptuResponsabilidade];

      }  

    }  // Buscar status anterior

  }  let previousStatus = null;

    if (previousPayload.custom_fields && previousPayload.custom_fields[FIELD_KEYS.statusIPTU] !== undefined) {

  if (currentStatusStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL && previousStatusStr !== STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {    previousStatus = previousPayload.custom_fields[FIELD_KEYS.statusIPTU];

    if (isResponsabilidadeCaixa_(currentResp)) {  } else if (previousPayload[FIELD_KEYS.statusIPTU] !== undefined) {

      changes.push({ plan: 'IPTU_CEF_PENDENCIA', from: previousStatusStr, to: 'pendencia' });    previousStatus = previousPayload[FIELD_KEYS.statusIPTU];

    }  }

  }  

    const currentStatusStr = String(currentStatus || '').trim();

  if (currentStatusStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO && previousStatusStr !== STATUS_IDS.IPTU.ATESTE_RECEBIDO) {  const previousStatusStr = String(previousStatus || '').trim();

    if (isResponsabilidadeCaixa_(currentResp)) {  

      changes.push({ plan: 'IPTU_CEF_ATESTE', from: previousStatusStr, to: 'ateste' });  Logger.log('[Deal %s] 🔍 Status: "%s" → "%s"', currentDeal.id, previousStatusStr, currentStatusStr);

    }  

  }  // Bloquear se CND já foi salva

    if (currentStatusStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {

  // Verificar se Data Término Triagem foi preenchida    Logger.log('[Deal %s] 🛑 CND salva no Drive - processo finalizado', currentDeal.id);

  const triagemFieldKey = FIELD_KEYS.dataTerminoTriagem;    return changes;

  const currentTriagem = currentDeal[triagemFieldKey];  }

    

  let previousTriagem = null;  // Detectar mudanças de status específicas

  if (previousPayload && previousPayload[triagemFieldKey] !== undefined) {  const statusMappings = [

    const val = previousPayload[triagemFieldKey];    { status: STATUS_IDS.IPTU.INICIAR, cefPlan: 'IPTU_CEF_INICIAL', clientePlan: 'IPTU_CLIENTE_INICIAL' },

    previousTriagem = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;    { status: STATUS_IDS.IPTU.BOLETO_ENVIADO, cefPlan: 'IPTU_CEF_BOLETO', clientePlan: 'IPTU_CLIENTE_BOLETO' },

  }    { status: STATUS_IDS.IPTU.SOLICITAR_CND, cefPlan: 'IPTU_CEF_SOLICITAR', clientePlan: 'IPTU_CLIENTE_SOLICITAR' },

      { status: STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL, cefPlan: 'IPTU_CEF_PENDENCIA', clientePlan: null },

  if (currentTriagem && !previousTriagem && isIniciar_(currentStatus)) {    { status: STATUS_IDS.IPTU.ATESTE_RECEBIDO, cefPlan: 'IPTU_CEF_ATESTE', clientePlan: null }

    if (isResponsabilidadeCaixa_(currentResp)) {  ];

      if (!changes.some(c => c.plan === 'IPTU_CEF_INICIAL')) {

        changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'triagem', to: 'triagem_cef' });  for (const mapping of statusMappings) {

      }    if (currentStatusStr === mapping.status && previousStatusStr !== mapping.status) {

    } else if (isResponsabilidadeArrematante_(currentResp)) {      if (isResponsabilidadeCaixa_(currentResp) && mapping.cefPlan) {

      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL')) {        changes.push({ plan: mapping.cefPlan, from: previousStatusStr, to: currentStatusStr });

        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'triagem', to: 'triagem_cliente' });      } else if (isResponsabilidadeArrematante_(currentResp) && mapping.clientePlan) {

      }        changes.push({ plan: mapping.clientePlan, from: previousStatusStr, to: currentStatusStr });

    }      }

  }    }

  }

  return changes;  

}  // Verificar se Data Término Triagem foi preenchida

  const currentTriagem = currentDeal[FIELD_KEYS.dataTerminoTriagem];

/***********************  let previousTriagem = null;

 *  CRIAÇÃO SEGURA DE ATIVIDADE  

 ***********************/  if (previousPayload.custom_fields && previousPayload.custom_fields[FIELD_KEYS.dataTerminoTriagem] !== undefined) {

function webhookCreateActivitySafe_(params) {    previousTriagem = previousPayload.custom_fields[FIELD_KEYS.dataTerminoTriagem];

  const { deal, subject, note, dueDate, dueTime, priority } = params;  } else if (previousPayload[FIELD_KEYS.dataTerminoTriagem] !== undefined) {

  const dueBday = nextBusinessDay_(dueDate);    previousTriagem = previousPayload[FIELD_KEYS.dataTerminoTriagem];

  const dueY = ymd_(dueBday);  }

    

  // Verificação única: Se existe atividade com mesmo subject, NÃO CRIA  if (currentTriagem && !previousTriagem && isIniciar_(currentStatus)) {

  if (webhookActivityExists_(deal.id, subject)) {    Logger.log('[Deal %s] ✔ Data Término Triagem preenchida: %s', currentDeal.id, currentTriagem);

    return { created: false, reason: 'exists' };    

  }    if (isResponsabilidadeCaixa_(currentResp)) {

        const alreadyAdded = changes.some(c => c.plan === 'IPTU_CEF_INICIAL');

  // Marca no cache ANTES de criar      if (!alreadyAdded) {

  const fingerprint = getActivityFingerprint_(deal.id, subject);        changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'triagem_preenchida', to: 'iniciar_cef' });

  const memKey = `ACT_${fingerprint}`;      }

  WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();    } else if (isResponsabilidadeArrematante_(currentResp)) {

        const alreadyAdded = changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL');

  try {      if (!alreadyAdded) {

    createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'triagem_preenchida', to: 'iniciar_cliente' });

          }

    // Salva no cache persistente    }

    try {  }

      WEBHOOK_LOCK.setProperty(`ACT_${fingerprint}`, String(Date.now()));

    } catch (err) {  return changes;

      Logger.log('Erro ao salvar cache persistente: %s', err.message);}

    }

    /***********************

    webhookDebug_('Atividade criada', { dealId: deal.id, subject, dueDate: dueY, dueTime }); *  CRIAÇÃO DE ATIVIDADES

     ***********************/

    return { created: true };function processActivitiesCreation_(deal, statusChanges) {

  } catch (err) {  // Importar funções do main.gs para criação de atividades

    // Remove do cache se falhou  const today = tzToday_();

    delete WEBHOOK_ACTIVITIES_CACHE[memKey];  

    throw err;  if (isWeekend_(today)) {

  }    return { ok: true, skipped: 'weekend', date: ymd_(today) };

}  }



/***********************  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];

 *  PROCESSAMENTO DO DEAL  if (!baseStr) {

 ***********************/    return { ok: true, skipped: 'missing_triagem' };

function webhookProcessDeal_(deal, statusChanges) {  }

  const today = tzToday_();

  if (isWeekend_(today)) {  const baseDate = parseLocalDate_(baseStr);

    return { ok: true, skipped: 'weekend' };  if (today < baseDate) {

  }    return { ok: true, skipped: 'before_triagem', today: ymd_(today), triDate: ymd_(baseDate) };

  }

  // Deleta atividades incompatíveis

  let deletedCount = 0;  let created = 0;

  for (const change of statusChanges) {  let skipped = 0;

    deletedCount += webhookDeleteIncompatibleActivities_(deal.id, change.plan);  const createdActivities = [];

  }

  for (const change of statusChanges) {

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];    const planKey = change.plan;

  if (!baseStr) {    const pl = PLAN[planKey];

    return { ok: true, skipped: 'missing_triagem' };    

  }    if (!pl) {

      Logger.log('[Deal %s] ⚠ Plano não encontrado: %s', deal.id, planKey);

  const baseDate = parseLocalDate_(baseStr);      continue;

    }

  let created = 0, skipped = 0;    

  const createdActivities = [];    const result = createActivitiesForPlan_(deal, planKey, pl, today, baseDate);

    created += result.created;

  for (const change of statusChanges) {    skipped += result.skipped;

    const planKey = change.plan;    createdActivities.push(...result.activities);

    const pl = PLAN[planKey];  }

    

    if (!pl) continue;  return { 

        ok: true, 

    const dayConfigs = pl.days.slice();    plans: statusChanges.map(c => c.plan),

    const isStatusChange = !planKey.includes('INICIAL');    created, 

        skipped,

    if (isStatusChange) {    createdActivities,

      // Mudança de status: cria a partir de HOJE    date: ymd_(today) 

      for (const config of dayConfigs) {  };

        const d = config.day;}

        const hour = config.hour;

        const subject = pl.title(d);function createActivitiesForPlan_(deal, planKey, plan, today, baseDate) {

        const note = pl.note(d);  let created = 0;

        const priority = getPriority_(planKey, d);  let skipped = 0;

        const dueRaw = addDays_(today, d);  const activities = [];

        const dueBday = nextBusinessDay_(dueRaw);  

        const dueTime = String(hour).padStart(2, '0') + ':00';  const isStatusChange = !planKey.includes('INICIAL');

  const dayConfigs = plan.days.slice();

        try {

          const result = webhookCreateActivitySafe_({   Logger.log('[Deal %s] ▶ Processando plano: %s', deal.id, planKey);

            deal, subject, note, 

            dueDate: dueBday,   for (const config of dayConfigs) {

            dueTime,     const d = config.day;

            priority    const hour = config.hour;

          });    const subject = plan.title(d);

              const note = plan.note(d);

          if (result.created) {    const priority = getPriority_(planKey, d);

            created++;    

            createdActivities.push(`✓ ${subject}`);    let dueDate, shouldCreate;

          } else {    

            skipped++;    if (isStatusChange) {

          }      // Para mudanças de status, criar atividades a partir de hoje

        } catch (err) {      dueDate = nextBusinessDay_(addDays_(today, d));

          webhookDebug_('Erro ao criar atividade', { subject, error: err.message });      shouldCreate = true;

        }    } else {

      }      // Para planos iniciais, verificar se é backlog ou futura

    } else {      const rawDue = addDays_(baseDate, d);

      // Inicialização: cria BACKLOG + PRÓXIMA      dueDate = nextBusinessDay_(rawDue);

            shouldCreate = dueDate <= today; // Apenas backlog por enquanto

      // 1. Criar backlog    }

      for (const config of dayConfigs) {    

        const d = config.day;    if (shouldCreate) {

        const hour = config.hour;      const dueY = ymd_(dueDate);

        const dueRaw = addDays_(baseDate, d);      const dueTime = String(hour).padStart(2, '0') + ':00';

        const dueBday = nextBusinessDay_(dueRaw);

              if (!activityWasJustCreated_(deal.id, subject) &&

        if (dueBday <= today) {          !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 

          const subject = pl.title(d);          !activityExistsBySubjectType_({ dealId: deal.id, subject })) {

          const note = pl.note(d);        

          const priority = getPriority_(planKey, d);        createActivity_({ deal, subject, note, dueDate, dueTime, priority });

          const dueTime = String(hour).padStart(2, '0') + ':00';        markActivityAsCreated_(deal.id, subject);

        created++;

          try {        activities.push(`✓ ${subject}`);

            const result = webhookCreateActivitySafe_({         Logger.log('[Deal %s]   ✔ Criada: %s | %s %s', deal.id, subject, dueY, dueTime);

              deal, subject, note,       } else {

              dueDate: dueBday,         skipped++;

              dueTime,       }

              priority    }

            });  }

            

            if (result.created) {  // Para planos iniciais, criar também a próxima atividade futura

              created++;  if (!isStatusChange) {

              createdActivities.push(`✓ ${subject}`);    const nextConfig = dayConfigs.find(cfg => {

            } else {      const dueRaw = addDays_(baseDate, cfg.day);

              skipped++;      const dueBday = nextBusinessDay_(dueRaw);

            }      return dueBday > today;

          } catch (err) {    });

            webhookDebug_('Erro ao criar atividade (backlog)', { subject, error: err.message });    

          }    if (nextConfig) {

        }      const d = nextConfig.day;

      }      const hour = nextConfig.hour;

            const subject = plan.title(d);

      // 2. Criar próxima atividade futura      const note = plan.note(d);

      const nextConfig = dayConfigs.find(cfg => {      const priority = getPriority_(planKey, d);

        const dueRaw = addDays_(baseDate, cfg.day);      const dueDate = nextBusinessDay_(addDays_(baseDate, d));

        const dueBday = nextBusinessDay_(dueRaw);      const dueY = ymd_(dueDate);

        return dueBday > today;      const dueTime = String(hour).padStart(2, '0') + ':00';

      });

            if (!activityWasJustCreated_(deal.id, subject) &&

      if (nextConfig) {          !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 

        const d = nextConfig.day;          !activityExistsBySubjectType_({ dealId: deal.id, subject })) {

        const hour = nextConfig.hour;        

        const subject = pl.title(d);        createActivity_({ deal, subject, note, dueDate, dueTime, priority });

        const note = pl.note(d);        markActivityAsCreated_(deal.id, subject);

        const priority = getPriority_(planKey, d);        created++;

        const dueRaw = addDays_(baseDate, d);        activities.push(`✓ ${subject}`);

        const dueBday = nextBusinessDay_(dueRaw);        Logger.log('[Deal %s]   ✔ Próxima: %s | %s %s', deal.id, subject, dueY, dueTime);

        const dueTime = String(hour).padStart(2, '0') + ':00';      } else {

        skipped++;

        try {      }

          const result = webhookCreateActivitySafe_({     }

            deal, subject, note,   }

            dueDate: dueBday, 

            dueTime,   return { created, skipped, activities };

            priority}

          });

          /***********************

          if (result.created) { *  CACHE DE ATIVIDADES

            created++; ***********************/

            createdActivities.push(`✓ ${subject}`);function activityWasJustCreated_(dealId, subject) {

          } else {  const key = `${dealId}_${normalizeSubject_(subject)}`;

            skipped++;  return CREATED_ACTIVITIES_CACHE[key] === true;

          }}

        } catch (err) {

          webhookDebug_('Erro ao criar atividade (próxima)', { subject, error: err.message });function markActivityAsCreated_(dealId, subject) {

        }  const key = `${dealId}_${normalizeSubject_(subject)}`;

      }  CREATED_ACTIVITIES_CACHE[key] = true;

    }}

  }

/***********************

  return { ok: true, created, skipped, deleted: deletedCount, createdActivities }; *  HELPERS

} ***********************/

function isIniciar_(v) {

/***********************  if (!v) return false;

 *  LOGGING EM PLANILHA  const vStr = String(v).trim();

 ***********************/  return vStr === String(STATUS_IDS.IPTU.INICIAR);

function webhookAppendLog_({ timestamp, dealId, title, action, atividadesCriadas, detalhes }) {}

  if (!WEBHOOK_CONFIG.SHEET_ID) return;

  function isResponsabilidadeCaixa_(v) {

  try {  if (!v) return false;

    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);  const vStr = String(v).trim();

    let sh = ss.getSheetByName(WEBHOOK_CONFIG.LOG_SHEET);  return vStr === String(RESPONSABILIDADE_IDS.CAIXA);

    }

    if (!sh) {

      sh = ss.insertSheet(WEBHOOK_CONFIG.LOG_SHEET);function isResponsabilidadeArrematante_(v) {

      sh.getRange(1, 1, 1, 6).setValues([['Timestamp', 'DealID', 'Title', 'Action', 'Atividades', 'Detalhes']])  if (!v) return false;

        .setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');  const vStr = String(v).trim();

      sh.setFrozenRows(1);  return vStr === String(RESPONSABILIDADE_IDS.ARREMATANTE);

    }}

    

    sh.appendRow([function normalizeSubject_(s) {

      Utilities.formatDate(timestamp || new Date(), CFG.TZ, 'dd/MM/yyyy, HH:mm:ss'),  return String(s || '')

      String(dealId || ''),    .replace(/[\u200B-\u200D\u2060]/g, '')

      String(title || ''),    .replace(/\s+/g, ' ')

      String(action || ''),    .trim()

      String(atividadesCriadas || ''),    .toLowerCase();

      String(detalhes || '')}

    ]);

    function makeApiRequest_(path, options = {}) {

    const lastRow = sh.getLastRow();  const url = CFG.BASE + path + (path.includes('?') ? '&' : '?') + 'api_token=' + encodeURIComponent(CFG.TOKEN);

    if (action === 'Processamento IPTU') {  const params = Object.assign({ method: 'get', muteHttpExceptions: true, contentType: 'application/json' }, options);

      sh.getRange(lastRow, 1, 1, 6).setBackground('#d9ead3');  const response = UrlFetchApp.fetch(url, params);

    }  const code = response.getResponseCode();

      

    if (lastRow > WEBHOOK_CONFIG.MAX_LOG_ROWS + 1) {  if (code < 200 || code >= 300) {

      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_LOG_ROWS - 1);    throw new Error('API ' + (params.method || 'GET') + ' ' + path + ' ' + code + ': ' + response.getContentText());

    }  }

  } catch (err) {  

    Logger.log('Erro ao adicionar log: %s', err.message);  return JSON.parse(response.getContentText());

  }}

}

function jsonResponse_(obj) {

function webhookAppendError_(where, error, eventData) {  return ContentService

  if (!WEBHOOK_CONFIG.SHEET_ID) return;    .createTextOutput(JSON.stringify(obj, null, 2))

      .setMimeType(ContentService.MimeType.JSON);

  try {}

    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);

    let sh = ss.getSheetByName(WEBHOOK_CONFIG.ERR_SHEET);/***********************

     *  LOGGING

    if (!sh) { ***********************/

      sh = ss.insertSheet(WEBHOOK_CONFIG.ERR_SHEET);function logWebhookActivity_(data) {

      sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'DealID', 'Erro', 'Stack', 'Payload']])  if (!CFG.SHEET_ID) return;

        .setFontWeight('bold').setBackground('#ea4335').setFontColor('#ffffff');  

      sh.setFrozenRows(1);  try {

    }    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);

        let sheet = ss.getSheetByName('WebhookLog');

    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm:ss');    

    const errorMessage = (error && error.message) ? String(error.message) : String(error);    if (!sheet) {

    const stackTrace = (error && error.stack) ? String(error.stack) : 'N/A';      sheet = ss.insertSheet('WebhookLog');

          sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'DealID', 'Title', 'Action', 'Atividades Criadas', 'Detalhes']]);

    let dealId = '', payloadText = '';    }

    try {    

      if (eventData && eventData.postData && eventData.postData.contents) {    sheet.appendRow([

        const payload = JSON.parse(eventData.postData.contents);      Utilities.formatDate(data.timestamp, CFG.TZ, 'dd/MM/yyyy, HH:mm:ss'),

        const current = payload.data || payload.current || {};      String(data.dealId || ''),

        dealId = String(current.id || '');      String(data.title || ''),

        payloadText = JSON.stringify(payload, null, 2);      String(data.action || ''),

      }      String(data.atividadesCriadas || ''),

    } catch (parseErr) {      String(data.detalhes || '')

      payloadText = 'N/A';    ]);

    }    

      } catch (err) {

    if (payloadText.length > 50000) payloadText = payloadText.substring(0, 50000);    Logger.log('⚠️ Erro ao fazer log: %s', err.message);

      }

    sh.appendRow([timestamp, dealId, errorMessage, stackTrace, payloadText]);}

    sh.getRange(sh.getLastRow(), 1, 1, 5).setBackground('#f4cccc');

  } catch (err) {function logError_(where, error, eventData) {

    Logger.log('Erro ao registrar erro: %s', err.message);  if (!CFG.SHEET_ID) return;

  }  

}  try {

    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);

/***********************    let sheet = ss.getSheetByName('WebhookErrors');

 *  HANDLER PRINCIPAL    

 ***********************/    if (!sheet) {

function doPost(e) {      sheet = ss.insertSheet('WebhookErrors');

  try {      sheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'DealID', 'Erro', 'Stack Trace', 'Payload']]);

    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';    }

    if (!raw) throw new Error('Sem corpo');    

    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy, HH:mm:ss');

    const payload = JSON.parse(raw);    const errorMessage = (error && error.message) ? String(error.message) : String(error);

    const meta = payload.meta || {};    const stackTrace = (error && error.stack) ? String(error.stack) : '';

    let current = payload.data || payload.current || payload;    

    const previous = payload.previous || {};    let dealId = '';

        let payloadText = '';

    const dealId = current.id || current.dealId || payload.dealId || '';    

    const title = current.title || payload.title || '';    try {

          if (eventData && eventData.postData && eventData.postData.contents) {

    const isDealEvent = !!(dealId && (meta.object === 'deal' || meta.action === 'updated' || meta.action === 'change' || payload.dealId));        const payload = JSON.parse(eventData.postData.contents);

        const current = payload.data || payload.current || {};

    if (WEBHOOK_CONFIG.ALLOWED_DEAL && String(dealId) !== String(WEBHOOK_CONFIG.ALLOWED_DEAL)) {        dealId = String(current.id || '');

      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'deal_not_allowed' })).setMimeType(ContentService.MimeType.JSON);        payloadText = JSON.stringify(payload, null, 2);

    }      }

    } catch (parseErr) {

    if (!isDealEvent || !dealId) {      payloadText = eventData ? String(eventData) : 'N/A';

      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'not_deal' })).setMimeType(ContentService.MimeType.JSON);    }

    }    

    if (payloadText.length > 50000) {

    // Busca deal completo      payloadText = payloadText.substring(0, 50000) + '\n... (truncado)';

    let fullDeal = current;    }

    try {    

      const r = pd_('/deals/' + dealId);    sheet.appendRow([timestamp, dealId, errorMessage, stackTrace, payloadText]);

      if (r && r.data) fullDeal = r.data;    

    } catch (errDeal) {  } catch (err) {

      Logger.log('Erro ao buscar deal: %s', errDeal.message);    Logger.log('❌ Erro crítico ao registrar erro: %s', err.message);

    }  }

}

    const statusIPTU = String(fullDeal[FIELD_KEYS.statusIPTU] || '').trim();

    /***********************

    const isEligible = ( *  FUNÇÕES DE DIAGNÓSTICO

      fullDeal.status === 'open' &&  ***********************/

      fullDeal[FIELD_KEYS.dataTerminoTriagem] && function limparLocks() {

      !fullDeal[FIELD_KEYS.dataTerminoIPTU] &&   Logger.log('=== LIMPANDO TODOS OS LOCKS ===');

      fullDeal[FIELD_KEYS.statusIPTU] &&   const props = PropertiesService.getScriptProperties();

      fullDeal[FIELD_KEYS.iptuResponsabilidade] &&   const allProps = props.getProperties();

      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE  let count = 0;

    );  

  for (const key in allProps) {

    if (!isEligible) {    if (key.startsWith('LOCK_') || key.startsWith('GLOBAL_PROCESSED_')) {

      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'not_eligible' })).setMimeType(ContentService.MimeType.JSON);      props.deleteProperty(key);

    }      count++;

    }

    const statusChanges = webhookDetectChanges_(fullDeal, previous);  }

      

    if (statusChanges.length === 0) {  Logger.log('✅ %s locks removidos', count);

      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'no_changes' })).setMimeType(ContentService.MimeType.JSON);}

    }

function limparCacheAtividades() {

    const changeHash = webhookGetChangeHash_(dealId, statusChanges);  Logger.log('=== LIMPANDO CACHE DE ATIVIDADES ===');

      for (const key in CREATED_ACTIVITIES_CACHE) {

    if (webhookIsProcessing_(dealId, changeHash)) {    delete CREATED_ACTIVITIES_CACHE[key];

      return ContentService.createTextOutput(JSON.stringify({   }

        ok: true,   Logger.log('✅ Cache limpo');

        skipped: 'processing' }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = webhookProcessDeal_(fullDeal, statusChanges);

    let atividadesTexto = 'Nenhuma', detalhesTexto = '';
    
    if (result.created > 0) {
      atividadesTexto = result.createdActivities ? result.createdActivities.join('\n') : `${result.created} criada(s)`;
      detalhesTexto = `${result.created} criada(s)`;
      if (result.deleted > 0) detalhesTexto += ` | ${result.deleted} deletada(s)`;
    } else {
      detalhesTexto = result.skipped > 0 ? `${result.skipped} já existente(s)` : 'Nenhuma ação';
      if (result.deleted > 0) detalhesTexto += ` | ${result.deleted} deletada(s)`;
    }

    webhookAppendLog_({
      timestamp: new Date(),
      dealId: dealId,
      title: title,
      action: 'Processamento IPTU',
      atividadesCriadas: atividadesTexto,
      detalhes: detalhesTexto
    });

    return ContentService.createTextOutput(JSON.stringify({ 
      ok: true, 
      dealId, 
      result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    webhookAppendError_('doPost', err, e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'Webhook IPTU v3.0 - Anti-Duplicação',
    timestamp: new Date().toISOString(),
    lockSeconds: WEBHOOK_CONFIG.LOCK_SECONDS,
    features: [
      '🎯 Verificação APENAS por SUBJECT',
      '💾 Cache 3 camadas (memória + persistente + API)',
      '⚡ Lock ' + WEBHOOK_CONFIG.LOCK_SECONDS + 's',
      '🚫 Se existe atividade = NÃO CRIA outra',
      '🔄 Deleta atividades incompatíveis ao mudar responsabilidade',
      '✅ Sistema robusto anti-duplicação'
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  FUNÇÕES DE MANUTENÇÃO
 ***********************/
function webhookLimparCache() {
  try {
    const allProps = WEBHOOK_LOCK.getProperties();
    let count = 0;
    
    for (const key in allProps) {
      if (key.startsWith('ACT_') || key.startsWith('LOCK_')) {
        WEBHOOK_LOCK.deleteProperty(key);
        count++;
      }
    }
    
    for (const key in WEBHOOK_ACTIVITIES_CACHE) {
      delete WEBHOOK_ACTIVITIES_CACHE[key];
    }
    
    Logger.log('✅ %s itens removidos do cache', count);
    return count;
  } catch (err) {
    Logger.log('Erro ao limpar cache: %s', err.message);
    return 0;
  }
}

function webhookResetarTudo() {
  Logger.log('🔄 RESETANDO WEBHOOK...');
  const removed = webhookLimparCache();
  
  if (WEBHOOK_CONFIG.SHEET_ID) {
    try {
      const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
      const sh = ss.getSheetByName(WEBHOOK_CONFIG.DEBUG_SHEET);
      if (sh && sh.getLastRow() > 1) {
        sh.deleteRows(2, sh.getLastRow() - 1);
      }
    } catch (err) {
      Logger.log('Erro ao limpar sheet de debug: %s', err.message);
    }
  }
  
  Logger.log('✅ Reset concluído: %s itens removidos', removed);
}