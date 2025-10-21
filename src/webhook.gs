/***********************
 *  WEBHOOK HANDLER - IPTU
 ***********************/

// Configurações obtidas das propriedades do script
const CFG = (() => {
  const props = PropertiesService.getScriptProperties();
  return {
    TOKEN: props.getProperty('PIPEDRIVE_API_TOKEN'),
    BASE: props.getProperty('PIPEDRIVE_BASE_URL') || 'https://api.pipedrive.com/v1',
    TZ: props.getProperty('TIMEZONE') || 'America/Sao_Paulo',
    SHEET_ID: props.getProperty('SHEET_ID'),
    ACTIVITY_TYPE_KEY: props.getProperty('ACTIVITY_TYPE_KEY') || 'escritura'
  };
})();

// Configurações do webhook
const WEBHOOK_CONFIG = {
  DEBOUNCE_SECONDS: parseInt(PropertiesService.getScriptProperties().getProperty('DEBOUNCE_SECONDS') || '15'),
  GLOBAL_COOLDOWN_MINUTES: parseInt(PropertiesService.getScriptProperties().getProperty('GLOBAL_COOLDOWN_MINUTES') || '2'),
  CACHE_LOCK_SECONDS: parseInt(PropertiesService.getScriptProperties().getProperty('CACHE_LOCK_SECONDS') || '30'),
  ALLOWED_DEAL_ID: PropertiesService.getScriptProperties().getProperty('ALLOWED_DEAL_ID')
};

// IDs dos campos e status - Configure nas propriedades do script
const FIELD_KEYS = {
  dataTerminoTriagem: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_TRIAGEM'),
  dataTerminoIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_DATA_TERMINO_IPTU'),
  statusIPTU: PropertiesService.getScriptProperties().getProperty('FIELD_STATUS_IPTU'),
  iptuResponsabilidade: PropertiesService.getScriptProperties().getProperty('FIELD_IPTU_RESPONSABILIDADE')
};

const STATUS_IDS = {
  IPTU: {
    INICIAR: PropertiesService.getScriptProperties().getProperty('STATUS_INICIAR'),
    BOLETO_ENVIADO: PropertiesService.getScriptProperties().getProperty('STATUS_BOLETO_ENVIADO'),
    PENDENCIA_DOCUMENTAL: PropertiesService.getScriptProperties().getProperty('STATUS_PENDENCIA_DOCUMENTAL'),
    ATESTE_RECEBIDO: PropertiesService.getScriptProperties().getProperty('STATUS_ATESTE_RECEBIDO'),
    SOLICITAR_CND: PropertiesService.getScriptProperties().getProperty('STATUS_SOLICITAR_CND'),
    CND_SALVA_DRIVE: PropertiesService.getScriptProperties().getProperty('STATUS_CND_SALVA_DRIVE')
  }
};

const RESPONSABILIDADE_IDS = {
  ARREMATANTE: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_ARREMATANTE'),
  CAIXA: PropertiesService.getScriptProperties().getProperty('RESPONSABILIDADE_CAIXA')
};

// Cache e controles globais
const CREATED_ACTIVITIES_CACHE = {};
const PROCESSING_LOCK = PropertiesService.getScriptProperties();
const CACHE_LOCK = CacheService.getScriptCache();

/***********************
 *  HANDLERS PRINCIPAIS
 ***********************/
function doPost(e) {
  try {
    const payload = parseWebhookPayload_(e);
    const { dealId, current: deal, previous, action, entity, title } = payload;

    // Validação de deal permitido
    if (WEBHOOK_CONFIG.ALLOWED_DEAL_ID && String(dealId) !== String(WEBHOOK_CONFIG.ALLOWED_DEAL_ID)) {
      Logger.log('[Deal %s] ⚠️ Deal não permitido. Apenas deal %s é processado.', dealId, WEBHOOK_CONFIG.ALLOWED_DEAL_ID);
      return jsonResponse_({ 
        ok: true, 
        skipped: 'deal_not_allowed', 
        dealId: dealId,
        message: `Apenas deal ${WEBHOOK_CONFIG.ALLOWED_DEAL_ID} é processado`
      });
    }

    if (entity === 'deal' && dealId) {
      return processDealWebhook_(deal, previous, title);
    }

    return jsonResponse_({
      ok: true,
      processed: new Date().toISOString(),
      action: action,
      entity: entity,
      dealId: dealId
    });

  } catch (err) {
    Logger.log('❌ Erro no webhook: %s', err.message);
    logError_('doPost', err, e);
    return jsonResponse_({
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
      service: 'Pipedrive Webhook Handler - IPTU',
      allowedDealId: WEBHOOK_CONFIG.ALLOWED_DEAL_ID,
      timestamp: new Date().toISOString(),
      statusIds: STATUS_IDS
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  PROCESSAMENTO DE DEAL
 ***********************/
function processDealWebhook_(deal, previous, title) {
  const dealId = deal.id;
  
  // Buscar dados completos do deal
  let fullDeal = deal;
  try {
    const response = makeApiRequest_('/deals/' + dealId);
    if (response && response.data) fullDeal = response.data;
  } catch (err) {
    Logger.log('[Deal %s] ⚠️ Erro ao buscar dados completos: %s', dealId, err.message);
  }

  // Verificar elegibilidade
  if (!isDealEligible_(fullDeal)) {
    const reason = getIneligibilityReason_(fullDeal);
    Logger.log('[Deal %s] ⚠️ Não elegível: %s', dealId, reason);
    
    return jsonResponse_({ 
      ok: true, 
      skipped: 'not_eligible', 
      dealId: dealId,
      reason: reason
    });
  }

  // Detectar mudanças de status
  const statusChanges = detectStatusChanges_(fullDeal, previous);
  
  if (statusChanges.length === 0) {
    Logger.log('[Deal %s] ℹ️ Nenhuma mudança de status detectada', dealId);
    return jsonResponse_({ ok: true, skipped: 'no_valid_status_change', dealId });
  }

  const changeKey = statusChanges.map(c => c.plan).sort().join(',');
  Logger.log('[Deal %s] 🎯 Mudanças detectadas: %s', dealId, changeKey);
  
  // Controles de duplicação
  if (!acquireLocks_(dealId, changeKey)) {
    return jsonResponse_({ 
      ok: true, 
      skipped: 'locked', 
      dealId: dealId,
      message: 'Deal em processamento ou processado recentemente'
    });
  }

  try {
    const result = processActivitiesCreation_(fullDeal, statusChanges);
    
    const activityText = result.created > 0 
      ? (result.createdActivities ? result.createdActivities.join('\n') : `${result.created} criada(s)`)
      : 'Nenhuma';
    
    const detailText = result.created > 0 
      ? `${result.created} criada(s)` 
      : (result.skipped > 0 ? `${result.skipped} já existente(s)` : 'Nenhuma ação necessária');

    if (result.created > 0) {
      markDealAsProcessed_(dealId);
      Logger.log('[Deal %s] ✅ %d atividades criadas com sucesso', dealId, result.created);
    } else {
      Logger.log('[Deal %s] ℹ️ %s', dealId, detailText);
    }

    // Log da operação
    logWebhookActivity_({
      timestamp: new Date(),
      dealId: dealId,
      title: title,
      action: 'Processamento IPTU',
      atividadesCriadas: activityText,
      detalhes: detailText
    });

    return jsonResponse_({
      ok: true,
      processed: new Date().toISOString(),
      dealId: dealId,
      statusChanges: statusChanges,
      result: result
    });

  } finally {
    releaseLocks_(dealId, changeKey);
  }
}

/***********************
 *  UTILITÁRIOS DO WEBHOOK
 ***********************/
function parseWebhookPayload_(e) {
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

  return {
    action: meta.action || '',
    entity: meta.object || meta.entity || '',
    dealId: current.id || '',
    title: current.title || '',
    current: current,
    previous: previous
  };
}

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
 *  CONTROLES DE DUPLICAÇÃO
 ***********************/
function acquireLocks_(dealId, changeKey) {
  // Cache lock
  const cacheKey = `PROC_${dealId}_${changeKey}`;
  if (CACHE_LOCK.get(cacheKey)) {
    Logger.log('[Deal %s] 🚫 BLOQUEADO - Cache lock ativo', dealId);
    return false;
  }
  CACHE_LOCK.put(cacheKey, 'true', WEBHOOK_CONFIG.CACHE_LOCK_SECONDS);

  // Verificar se foi processado recentemente
  if (isDealRecentlyProcessed_(dealId)) {
    CACHE_LOCK.remove(cacheKey);
    Logger.log('[Deal %s] ⏸️ Processado recentemente', dealId);
    return false;
  }

  // Processing lock
  const lockKey = `LOCK_${dealId}_${changeKey}`;
  const now = new Date().getTime();
  const lastProcessed = PROCESSING_LOCK.getProperty(lockKey);
  
  if (lastProcessed) {
    const diffSeconds = (now - parseInt(lastProcessed)) / 1000;
    if (diffSeconds < WEBHOOK_CONFIG.DEBOUNCE_SECONDS) {
      CACHE_LOCK.remove(cacheKey);
      Logger.log('[Deal %s] ⏸️ LOCK ATIVO - Ignorando (processado há %ss)', dealId, diffSeconds.toFixed(1));
      return false;
    }
  }
  
  PROCESSING_LOCK.setProperty(lockKey, String(now));
  Logger.log('[Deal %s] 🔒 Locks adquiridos', dealId);
  return true;
}

function releaseLocks_(dealId, changeKey) {
  const cacheKey = `PROC_${dealId}_${changeKey}`;
  const lockKey = `LOCK_${dealId}_${changeKey}`;
  
  CACHE_LOCK.remove(cacheKey);
  try {
    PROCESSING_LOCK.deleteProperty(lockKey);
  } catch (err) {
    Logger.log('[Deal %s] ⚠️ Erro ao liberar lock: %s', dealId, err.message);
  }
  
  Logger.log('[Deal %s] 🔓 Locks liberados', dealId);
}

function isDealRecentlyProcessed_(dealId) {
  const globalKey = `GLOBAL_PROCESSED_${dealId}`;
  const lastTime = PROCESSING_LOCK.getProperty(globalKey);
  
  if (lastTime) {
    const diffMinutes = (new Date().getTime() - parseInt(lastTime)) / 60000;
    if (diffMinutes < WEBHOOK_CONFIG.GLOBAL_COOLDOWN_MINUTES) {
      return true;
    }
  }
  
  return false;
}

function markDealAsProcessed_(dealId) {
  const globalKey = `GLOBAL_PROCESSED_${dealId}`;
  PROCESSING_LOCK.setProperty(globalKey, String(new Date().getTime()));
}

/***********************
 *  DETECÇÃO DE MUDANÇAS
 ***********************/
function detectStatusChanges_(currentDeal, previousPayload) {
  const changes = [];
  const currentStatus = currentDeal[FIELD_KEYS.statusIPTU];
  const currentResp = currentDeal[FIELD_KEYS.iptuResponsabilidade];
  
  // Buscar status anterior
  let previousStatus = null;
  if (previousPayload.custom_fields && previousPayload.custom_fields[FIELD_KEYS.statusIPTU] !== undefined) {
    previousStatus = previousPayload.custom_fields[FIELD_KEYS.statusIPTU];
  } else if (previousPayload[FIELD_KEYS.statusIPTU] !== undefined) {
    previousStatus = previousPayload[FIELD_KEYS.statusIPTU];
  }
  
  const currentStatusStr = String(currentStatus || '').trim();
  const previousStatusStr = String(previousStatus || '').trim();
  
  Logger.log('[Deal %s] 🔍 Status: "%s" → "%s"', currentDeal.id, previousStatusStr, currentStatusStr);
  
  // Bloquear se CND já foi salva
  if (currentStatusStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    Logger.log('[Deal %s] 🛑 CND salva no Drive - processo finalizado', currentDeal.id);
    return changes;
  }
  
  // Detectar mudanças de status específicas
  const statusMappings = [
    { status: STATUS_IDS.IPTU.INICIAR, cefPlan: 'IPTU_CEF_INICIAL', clientePlan: 'IPTU_CLIENTE_INICIAL' },
    { status: STATUS_IDS.IPTU.BOLETO_ENVIADO, cefPlan: 'IPTU_CEF_BOLETO', clientePlan: 'IPTU_CLIENTE_BOLETO' },
    { status: STATUS_IDS.IPTU.SOLICITAR_CND, cefPlan: 'IPTU_CEF_SOLICITAR', clientePlan: 'IPTU_CLIENTE_SOLICITAR' },
    { status: STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL, cefPlan: 'IPTU_CEF_PENDENCIA', clientePlan: null },
    { status: STATUS_IDS.IPTU.ATESTE_RECEBIDO, cefPlan: 'IPTU_CEF_ATESTE', clientePlan: null }
  ];

  for (const mapping of statusMappings) {
    if (currentStatusStr === mapping.status && previousStatusStr !== mapping.status) {
      if (isResponsabilidadeCaixa_(currentResp) && mapping.cefPlan) {
        changes.push({ plan: mapping.cefPlan, from: previousStatusStr, to: currentStatusStr });
      } else if (isResponsabilidadeArrematante_(currentResp) && mapping.clientePlan) {
        changes.push({ plan: mapping.clientePlan, from: previousStatusStr, to: currentStatusStr });
      }
    }
  }
  
  // Verificar se Data Término Triagem foi preenchida
  const currentTriagem = currentDeal[FIELD_KEYS.dataTerminoTriagem];
  let previousTriagem = null;
  
  if (previousPayload.custom_fields && previousPayload.custom_fields[FIELD_KEYS.dataTerminoTriagem] !== undefined) {
    previousTriagem = previousPayload.custom_fields[FIELD_KEYS.dataTerminoTriagem];
  } else if (previousPayload[FIELD_KEYS.dataTerminoTriagem] !== undefined) {
    previousTriagem = previousPayload[FIELD_KEYS.dataTerminoTriagem];
  }
  
  if (currentTriagem && !previousTriagem && isIniciar_(currentStatus)) {
    Logger.log('[Deal %s] ✔ Data Término Triagem preenchida: %s', currentDeal.id, currentTriagem);
    
    if (isResponsabilidadeCaixa_(currentResp)) {
      const alreadyAdded = changes.some(c => c.plan === 'IPTU_CEF_INICIAL');
      if (!alreadyAdded) {
        changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'triagem_preenchida', to: 'iniciar_cef' });
      }
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      const alreadyAdded = changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL');
      if (!alreadyAdded) {
        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'triagem_preenchida', to: 'iniciar_cliente' });
      }
    }
  }

  return changes;
}

/***********************
 *  CRIAÇÃO DE ATIVIDADES
 ***********************/
function processActivitiesCreation_(deal, statusChanges) {
  // Importar funções do main.gs para criação de atividades
  const today = tzToday_();
  
  if (isWeekend_(today)) {
    return { ok: true, skipped: 'weekend', date: ymd_(today) };
  }

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];
  if (!baseStr) {
    return { ok: true, skipped: 'missing_triagem' };
  }

  const baseDate = parseLocalDate_(baseStr);
  if (today < baseDate) {
    return { ok: true, skipped: 'before_triagem', today: ymd_(today), triDate: ymd_(baseDate) };
  }

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
    
    const result = createActivitiesForPlan_(deal, planKey, pl, today, baseDate);
    created += result.created;
    skipped += result.skipped;
    createdActivities.push(...result.activities);
  }

  return { 
    ok: true, 
    plans: statusChanges.map(c => c.plan),
    created, 
    skipped,
    createdActivities,
    date: ymd_(today) 
  };
}

function createActivitiesForPlan_(deal, planKey, plan, today, baseDate) {
  let created = 0;
  let skipped = 0;
  const activities = [];
  
  const isStatusChange = !planKey.includes('INICIAL');
  const dayConfigs = plan.days.slice();

  Logger.log('[Deal %s] ▶ Processando plano: %s', deal.id, planKey);

  for (const config of dayConfigs) {
    const d = config.day;
    const hour = config.hour;
    const subject = plan.title(d);
    const note = plan.note(d);
    const priority = getPriority_(planKey, d);
    
    let dueDate, shouldCreate;
    
    if (isStatusChange) {
      // Para mudanças de status, criar atividades a partir de hoje
      dueDate = nextBusinessDay_(addDays_(today, d));
      shouldCreate = true;
    } else {
      // Para planos iniciais, verificar se é backlog ou futura
      const rawDue = addDays_(baseDate, d);
      dueDate = nextBusinessDay_(rawDue);
      shouldCreate = dueDate <= today; // Apenas backlog por enquanto
    }
    
    if (shouldCreate) {
      const dueY = ymd_(dueDate);
      const dueTime = String(hour).padStart(2, '0') + ':00';

      if (!activityWasJustCreated_(deal.id, subject) &&
          !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 
          !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
        
        createActivity_({ deal, subject, note, dueDate, dueTime, priority });
        markActivityAsCreated_(deal.id, subject);
        created++;
        activities.push(`✓ ${subject}`);
        Logger.log('[Deal %s]   ✔ Criada: %s | %s %s', deal.id, subject, dueY, dueTime);
      } else {
        skipped++;
      }
    }
  }

  // Para planos iniciais, criar também a próxima atividade futura
  if (!isStatusChange) {
    const nextConfig = dayConfigs.find(cfg => {
      const dueRaw = addDays_(baseDate, cfg.day);
      const dueBday = nextBusinessDay_(dueRaw);
      return dueBday > today;
    });
    
    if (nextConfig) {
      const d = nextConfig.day;
      const hour = nextConfig.hour;
      const subject = plan.title(d);
      const note = plan.note(d);
      const priority = getPriority_(planKey, d);
      const dueDate = nextBusinessDay_(addDays_(baseDate, d));
      const dueY = ymd_(dueDate);
      const dueTime = String(hour).padStart(2, '0') + ':00';

      if (!activityWasJustCreated_(deal.id, subject) &&
          !activityExistsStrong_({ dealId: deal.id, subject, dueDateYmd: dueY, dueTime }) && 
          !activityExistsBySubjectType_({ dealId: deal.id, subject })) {
        
        createActivity_({ deal, subject, note, dueDate, dueTime, priority });
        markActivityAsCreated_(deal.id, subject);
        created++;
        activities.push(`✓ ${subject}`);
        Logger.log('[Deal %s]   ✔ Próxima: %s | %s %s', deal.id, subject, dueY, dueTime);
      } else {
        skipped++;
      }
    }
  }

  return { created, skipped, activities };
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
 *  HELPERS
 ***********************/
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

function normalizeSubject_(s) {
  return String(s || '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function makeApiRequest_(path, options = {}) {
  const url = CFG.BASE + path + (path.includes('?') ? '&' : '?') + 'api_token=' + encodeURIComponent(CFG.TOKEN);
  const params = Object.assign({ method: 'get', muteHttpExceptions: true, contentType: 'application/json' }, options);
  const response = UrlFetchApp.fetch(url, params);
  const code = response.getResponseCode();
  
  if (code < 200 || code >= 300) {
    throw new Error('API ' + (params.method || 'GET') + ' ' + path + ' ' + code + ': ' + response.getContentText());
  }
  
  return JSON.parse(response.getContentText());
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  LOGGING
 ***********************/
function logWebhookActivity_(data) {
  if (!CFG.SHEET_ID) return;
  
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    let sheet = ss.getSheetByName('WebhookLog');
    
    if (!sheet) {
      sheet = ss.insertSheet('WebhookLog');
      sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'DealID', 'Title', 'Action', 'Atividades Criadas', 'Detalhes']]);
    }
    
    sheet.appendRow([
      Utilities.formatDate(data.timestamp, CFG.TZ, 'dd/MM/yyyy, HH:mm:ss'),
      String(data.dealId || ''),
      String(data.title || ''),
      String(data.action || ''),
      String(data.atividadesCriadas || ''),
      String(data.detalhes || '')
    ]);
    
  } catch (err) {
    Logger.log('⚠️ Erro ao fazer log: %s', err.message);
  }
}

function logError_(where, error, eventData) {
  if (!CFG.SHEET_ID) return;
  
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    let sheet = ss.getSheetByName('WebhookErrors');
    
    if (!sheet) {
      sheet = ss.insertSheet('WebhookErrors');
      sheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'DealID', 'Erro', 'Stack Trace', 'Payload']]);
    }
    
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
      }
    } catch (parseErr) {
      payloadText = eventData ? String(eventData) : 'N/A';
    }
    
    if (payloadText.length > 50000) {
      payloadText = payloadText.substring(0, 50000) + '\n... (truncado)';
    }
    
    sheet.appendRow([timestamp, dealId, errorMessage, stackTrace, payloadText]);
    
  } catch (err) {
    Logger.log('❌ Erro crítico ao registrar erro: %s', err.message);
  }
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