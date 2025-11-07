/***********************/***********************

 *  WEBHOOK HANDLER - ANTI-DUPLICAÇÃO + FILTROS *  WEBHOOK HANDLER - ANTI-DUPLICAÇÃO + FILTROS

 ***********************/ ***********************/



const WEBHOOK_CONFIG = (() => {const WEBHOOK_CONFIG = (() => {

  const props = PropertiesService.getScriptProperties();  const props = PropertiesService.getScriptProperties();

  return {  return {

    SHEET_ID: props.getProperty('SHEET_ID'),    SHEET_ID: props.getProperty('SHEET_ID'),

    LOG_SHEET: 'WebhookLog',    LOG_SHEET: 'WebhookLog',

    ERR_SHEET: 'WebhookErrors',    ERR_SHEET: 'WebhookErrors',

    DEBUG_SHEET: 'WebhookDebug',    DEBUG_SHEET: 'WebhookDebug',

    ALLOWED_DEAL: props.getProperty('TEST_DEAL_ID') || null,    ALLOWED_DEAL: props.getProperty('TEST_DEAL_ID') || null,

    MAX_LOG_ROWS: 200,    MAX_LOG_ROWS: 200,

    MAX_ERR_ROWS: 100,    MAX_ERR_ROWS: 100,

    MAX_DEBUG_ROWS: 500,    MAX_DEBUG_ROWS: 500,

    LOCK_SECONDS: 30,    LOCK_SECONDS: 30,

    CACHE_VALIDITY: 86400,    CACHE_VALIDITY: 86400,

    MEMORY_CACHE_TTL: 3600    MEMORY_CACHE_TTL: 3600

  };  };

})();})();



if (typeof WEBHOOK_ACTIVITIES_CACHE === 'undefined') {if (typeof WEBHOOK_ACTIVITIES_CACHE === 'undefined') {

  var WEBHOOK_ACTIVITIES_CACHE = {};  var WEBHOOK_ACTIVITIES_CACHE = {};

}}



const WEBHOOK_LOCK = PropertiesService.getScriptProperties();const WEBHOOK_LOCK = PropertiesService.getScriptProperties();



/***********************/***********************

 *  FILTROS DO WEBHOOK - RENOMEADO *  FILTROS DO WEBHOOK - RENOMEADO

 ***********************/ ***********************/

const WEBHOOK_FILTROS = {const WEBHOOK_FILTROS = {

  USUARIO_ATIVIDADES_EMAIL: PropertiesService.getScriptProperties().getProperty('USUARIO_ATIVIDADES_EMAIL') || 'lucastolentino.smart@gmail.com',  USUARIO_ATIVIDADES_EMAIL: PropertiesService.getScriptProperties().getProperty('USUARIO_ATIVIDADES_EMAIL') || 'lucastolentino.smart@gmail.com',

  FUNIL_NOME: PropertiesService.getScriptProperties().getProperty('FUNIL_NOME') || 'pos arrematação',  FUNIL_NOME: PropertiesService.getScriptProperties().getProperty('FUNIL_NOME') || 'pos arrematação',

  ETAPA_NOME: PropertiesService.getScriptProperties().getProperty('ETAPA_NOME') || 'contrato'  ETAPA_NOME: PropertiesService.getScriptProperties().getProperty('ETAPA_NOME') || 'contrato'

};};


if (typeof WEBHOOK_ACTIVITIES_USER_ID_CACHE === 'undefined') {
  var WEBHOOK_ACTIVITIES_USER_ID_CACHE = null;
}

/***********************
 *  FUNÇÕES DE FILTRO DO WEBHOOK
 ***********************/
function webhookNormalizeText_(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function webhookGetActivitiesUserId_() {
  if (WEBHOOK_ACTIVITIES_USER_ID_CACHE) return WEBHOOK_ACTIVITIES_USER_ID_CACHE;
  
  try {
    const resp = pd_('/users?limit=500');
    if (resp && resp.data) {
      const user = resp.data.find(u => 
        String(u.email || '').toLowerCase() === WEBHOOK_FILTROS.USUARIO_ATIVIDADES_EMAIL.toLowerCase()
      );
      
      if (user && user.id) {
        WEBHOOK_ACTIVITIES_USER_ID_CACHE = user.id;
        webhookDebug_('Usuário para atividades encontrado', { name: user.name, id: user.id });
        return user.id;
      }
    }
  } catch (err) {
    webhookDebug_('Erro ao buscar usuário', { error: err.message });
  }
  
  webhookDebug_('Usuário não encontrado', { email: WEBHOOK_FILTROS.USUARIO_ATIVIDADES_EMAIL });
  return null;
}

function webhookIsDealInCorrectStage_(deal) {
  try {
    if (!deal.pipeline_id || !deal.stage_id) {
      webhookDebug_('Deal sem pipeline_id ou stage_id', { dealId: deal.id });
      return false;
    }
    
    const pipelineResp = pd_('/pipelines/' + deal.pipeline_id);
    if (!pipelineResp || !pipelineResp.data) {
      webhookDebug_('Pipeline não encontrado', { dealId: deal.id, pipelineId: deal.pipeline_id });
      return false;
    }
    
    const pipeline = pipelineResp.data;
    const pipelineName = webhookNormalizeText_(pipeline.name);
    
    if (pipelineName !== webhookNormalizeText_(WEBHOOK_FILTROS.FUNIL_NOME)) {
      webhookDebug_('Funil incorreto', { 
        dealId: deal.id, 
        expected: WEBHOOK_FILTROS.FUNIL_NOME, 
        actual: pipeline.name 
      });
      return false;
    }
    
    const stageResp = pd_('/stages/' + deal.stage_id);
    if (!stageResp || !stageResp.data) {
      webhookDebug_('Etapa não encontrada', { dealId: deal.id, stageId: deal.stage_id });
      return false;
    }
    
    const stage = stageResp.data;
    const stageName = webhookNormalizeText_(stage.name);
    
    if (stageName !== webhookNormalizeText_(WEBHOOK_FILTROS.ETAPA_NOME)) {
      webhookDebug_('Etapa incorreta', { 
        dealId: deal.id, 
        expected: WEBHOOK_FILTROS.ETAPA_NOME, 
        actual: stage.name 
      });
      return false;
    }
    
    webhookDebug_('Funil e etapa OK', { 
      dealId: deal.id, 
      pipeline: pipeline.name, 
      stage: stage.name 
    });
    return true;
    
  } catch (err) {
    webhookDebug_('Erro ao verificar stage', { dealId: deal.id, error: err.message });
    return false;
  }
}

/***********************
 *  FINGERPRINT SIMPLES (dealId + subject)
 ***********************/
function getActivityFingerprint_(dealId, subject) {
  const normalized = normalizeSubject_(subject);
  const data = `${dealId}|${normalized}`;
  
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    data
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))
   .join('')
   .substring(0, 12);
}

/***********************
 *  LOCK
 ***********************/
function webhookIsProcessing_(dealId, changeHash) {
  const lockKey = `LOCK_${dealId}_${changeHash}`;
  const now = Date.now();
  
  try {
    const lastProcessed = WEBHOOK_LOCK.getProperty(lockKey);
    
    if (lastProcessed) {
      const elapsed = (now - parseInt(lastProcessed)) / 1000;
      if (elapsed < WEBHOOK_CONFIG.LOCK_SECONDS) return true;
    }
    
    WEBHOOK_LOCK.setProperty(lockKey, String(now));
    return false;
  } catch (err) {
    return false;
  }
}

function webhookGetChangeHash_(dealId, plans) {
  const planStr = plans.map(p => p.plan).sort().join('|');
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    `${dealId}_${planStr}`
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 12);
}

/***********************
 *  DEBUG
 ***********************/
function webhookDebug_(message, data) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;
  
  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.DEBUG_SHEET);
    
    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.DEBUG_SHEET);
      const headers = ['Timestamp', 'Mensagem', 'Dados'];
      sh.getRange(1, 1, 1, 3).setValues([headers])
        .setFontWeight('bold').setBackground('#FF9800').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    
    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm:ss');
    const dataStr = data ? JSON.stringify(data, null, 2) : '';
    sh.appendRow([timestamp, String(message), dataStr]);
    
    const lastRow = sh.getLastRow();
    if (lastRow > WEBHOOK_CONFIG.MAX_DEBUG_ROWS + 1) {
      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_DEBUG_ROWS - 1);
    }
  } catch (err) {}
}

/***********************
 *  ✅ VERIFICAÇÃO ÚNICA E SIMPLES
 *  Se existe atividade com mesmo SUBJECT = NÃO CRIA
 ***********************/
function webhookActivityExists_(dealId, subject) {
  const fingerprint = getActivityFingerprint_(dealId, subject);
  const memKey = `ACT_${fingerprint}`;
  
  // Cache em memória
  if (WEBHOOK_ACTIVITIES_CACHE[memKey]) {
    const age = (Date.now() - WEBHOOK_ACTIVITIES_CACHE[memKey]) / 1000;
    if (age < WEBHOOK_CONFIG.MEMORY_CACHE_TTL) {
      return true;
    }
    delete WEBHOOK_ACTIVITIES_CACHE[memKey];
  }
  
  // Cache persistente
  const persistentKey = `ACT_${fingerprint}`;
  try {
    const cached = WEBHOOK_LOCK.getProperty(persistentKey);
    if (cached) {
      const age = (Date.now() - parseInt(cached)) / 1000;
      if (age < WEBHOOK_CONFIG.CACHE_VALIDITY) {
        WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();
        return true;
      }
      WEBHOOK_LOCK.deleteProperty(persistentKey);
    }
  } catch (err) {}
  
  // Verifica na API (ignora data, hora, tudo - só verifica subject)
  try {
    const subjNorm = normalizeSubject_(subject);
    const list = listActivitiesAll_(dealId);
    
    const found = list.find(a => {
      const sameType = (String(a.type || '').trim() === ACTIVITY_TYPE_KEY);
      const sameSubj = (normalizeSubject_(a.subject) === subjNorm);
      return sameType && sameSubj;
    });
    
    if (found) {
      // Salva no cache
      WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();
      try {
        WEBHOOK_LOCK.setProperty(persistentKey, String(Date.now()));
      } catch (err) {}
      
      webhookDebug_('Atividade já existe', { 
        dealId, 
        subject, 
        activityId: found.id,
        dueDate: found.due_date,
        dueTime: found.due_time,
        done: found.done
      });
      
      return true;
    }
    
    return false;
    
  } catch (err) {
    webhookDebug_('Erro ao verificar atividade', { dealId, subject, error: err.message });
    return false;
  }
}

/***********************
 *  DELETA ATIVIDADES INCOMPATÍVEIS
 ***********************/
function webhookDeleteIncompatibleActivities_(dealId, currentPlan) {
  const incompatiblePlans = {
    'IPTU_CEF_INICIAL': ['IPTU_CLIENTE_INICIAL'],
    'IPTU_CLIENTE_INICIAL': ['IPTU_CEF_INICIAL'],
    'IPTU_CEF_BOLETO': ['IPTU_CLIENTE_BOLETO'],
    'IPTU_CLIENTE_BOLETO': ['IPTU_CEF_BOLETO'],
    'IPTU_CEF_SOLICITAR': ['IPTU_CLIENTE_SOLICITAR'],
    'IPTU_CLIENTE_SOLICITAR': ['IPTU_CEF_SOLICITAR']
  };
  
  const toDelete = incompatiblePlans[currentPlan] || [];
  if (toDelete.length === 0) return 0;
  
  let deleted = 0;
  
  try {
    const activities = listActivitiesAll_(dealId);
    
    for (const activity of activities) {
      const activitySubject = normalizeSubject_(activity.subject);
      
      for (const incompatiblePlan of toDelete) {
        const pl = PLAN[incompatiblePlan];
        if (!pl) continue;
        
        for (const config of pl.days) {
          const expectedSubject = normalizeSubject_(pl.title(config.day));
          
          if (activitySubject === expectedSubject) {
            try {
              pd_('/activities/' + activity.id, { method: 'delete' });
              deleted++;
              
              // Remove do cache
              const fp = getActivityFingerprint_(dealId, activity.subject);
              delete WEBHOOK_ACTIVITIES_CACHE[`ACT_${fp}`];
              try {
                WEBHOOK_LOCK.deleteProperty(`ACT_${fp}`);
              } catch (err) {}
              
              webhookDebug_('Atividade deletada', { 
                dealId, 
                activityId: activity.id, 
                subject: activity.subject 
              });
              
            } catch (err) {}
            break;
          }
        }
      }
    }
  } catch (err) {}
  
  return deleted;
}

/***********************
 *  DETECÇÃO DE MUDANÇAS
 ***********************/
function webhookDetectChanges_(currentDeal, previousPayload) {
  const changes = [];
  const currentStatus = currentDeal[FIELD_KEYS.statusIPTU];
  const currentResp = currentDeal[FIELD_KEYS.iptuResponsabilidade];
  
  let previousStatus = null;
  if (previousPayload && previousPayload[FIELD_KEYS.statusIPTU] !== undefined) {
    const val = previousPayload[FIELD_KEYS.statusIPTU];
    previousStatus = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;
  }
  
  let previousResp = null;
  if (previousPayload && previousPayload[FIELD_KEYS.iptuResponsabilidade] !== undefined) {
    const val = previousPayload[FIELD_KEYS.iptuResponsabilidade];
    previousResp = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;
  }
  
  const currentStatusStr = String(currentStatus || '').trim();
  const previousStatusStr = String(previousStatus || '').trim();
  const currentRespStr = String(currentResp || '').trim();
  const previousRespStr = String(previousResp || '').trim();
  
  if (currentStatusStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    return changes;
  }
  
  // Mudança de responsabilidade
  if (previousRespStr && currentRespStr && previousRespStr !== currentRespStr) {
    if (isResponsabilidadeCaixa_(currentResp) && isIniciar_(currentStatus)) {
      changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'resp_change', to: 'cef' });
    }
    if (isResponsabilidadeArrematante_(currentResp) && isIniciar_(currentStatus)) {
      changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'resp_change', to: 'cliente' });
    }
    if (isResponsabilidadeCaixa_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {
      changes.push({ plan: 'IPTU_CEF_BOLETO', from: 'resp_change', to: 'cef_boleto' });
    }
    if (isResponsabilidadeArrematante_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {
      changes.push({ plan: 'IPTU_CLIENTE_BOLETO', from: 'resp_change', to: 'cliente_boleto' });
    }
    if (isResponsabilidadeCaixa_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND) {
      changes.push({ plan: 'IPTU_CEF_SOLICITAR', from: 'resp_change', to: 'cef_solicitar' });
    }
    if (isResponsabilidadeArrematante_(currentResp) && currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND) {
      changes.push({ plan: 'IPTU_CLIENTE_SOLICITAR', from: 'resp_change', to: 'cliente_solicitar' });
    }
  }
  
  // Mudança de status
  if (currentStatusStr === STATUS_IDS.IPTU.INICIAR && previousStatusStr !== STATUS_IDS.IPTU.INICIAR) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CEF_INICIAL')) {
        changes.push({ plan: 'IPTU_CEF_INICIAL', from: previousStatusStr, to: 'iniciar_cef' });
      }
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL')) {
        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: previousStatusStr, to: 'iniciar_cliente' });
      }
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.BOLETO_ENVIADO && previousStatusStr !== STATUS_IDS.IPTU.BOLETO_ENVIADO) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CEF_BOLETO')) {
        changes.push({ plan: 'IPTU_CEF_BOLETO', from: previousStatusStr, to: 'boleto_cef' });
      }
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_BOLETO')) {
        changes.push({ plan: 'IPTU_CLIENTE_BOLETO', from: previousStatusStr, to: 'boleto_cliente' });
      }
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.SOLICITAR_CND && previousStatusStr !== STATUS_IDS.IPTU.SOLICITAR_CND) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CEF_SOLICITAR')) {
        changes.push({ plan: 'IPTU_CEF_SOLICITAR', from: previousStatusStr, to: 'solicitar_cef' });
      }
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_SOLICITAR')) {
        changes.push({ plan: 'IPTU_CLIENTE_SOLICITAR', from: previousStatusStr, to: 'solicitar_cliente' });
      }
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL && previousStatusStr !== STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({ plan: 'IPTU_CEF_PENDENCIA', from: previousStatusStr, to: 'pendencia' });
    }
  }
  
  if (currentStatusStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO && previousStatusStr !== STATUS_IDS.IPTU.ATESTE_RECEBIDO) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      changes.push({ plan: 'IPTU_CEF_ATESTE', from: previousStatusStr, to: 'ateste' });
    }
  }
  
  // Data Triagem preenchida
  const triagemFieldKey = FIELD_KEYS.dataTerminoTriagem;
  const currentTriagem = currentDeal[triagemFieldKey];
  
  let previousTriagem = null;
  if (previousPayload && previousPayload[triagemFieldKey] !== undefined) {
    const val = previousPayload[triagemFieldKey];
    previousTriagem = (val && typeof val === 'object' && val.value !== undefined) ? val.value : val;
  }
  
  if (currentTriagem && !previousTriagem && isIniciar_(currentStatus)) {
    if (isResponsabilidadeCaixa_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CEF_INICIAL')) {
        changes.push({ plan: 'IPTU_CEF_INICIAL', from: 'triagem', to: 'triagem_cef' });
      }
    } else if (isResponsabilidadeArrematante_(currentResp)) {
      if (!changes.some(c => c.plan === 'IPTU_CLIENTE_INICIAL')) {
        changes.push({ plan: 'IPTU_CLIENTE_INICIAL', from: 'triagem', to: 'triagem_cliente' });
      }
    }
  }

  return changes;
}

/***********************
 *  CRIAÇÃO SEGURA (VERIFICA SÓ SUBJECT)
 ***********************/
function webhookCreateActivitySafe_(params) {
  const { deal, subject, note, dueDate, dueTime, priority } = params;
  const dueBday = nextBusinessDay_(dueDate);
  const dueY = ymd_(dueBday);
  
  // ✅ Verificação ÚNICA: Se existe atividade com mesmo subject, NÃO CRIA
  if (webhookActivityExists_(deal.id, subject)) {
    return { created: false, reason: 'exists' };
  }
  
  // Marca no cache ANTES de criar
  const fingerprint = getActivityFingerprint_(deal.id, subject);
  const memKey = `ACT_${fingerprint}`;
  WEBHOOK_ACTIVITIES_CACHE[memKey] = Date.now();
  
  try {
    createActivity_({ deal, subject, note, dueDate: dueBday, dueTime, priority });
    
    // Salva no cache persistente
    try {
      WEBHOOK_LOCK.setProperty(`ACT_${fingerprint}`, String(Date.now()));
    } catch (err) {}
    
    webhookDebug_('Atividade criada', { dealId: deal.id, subject, dueDate: dueY, dueTime });
    
    return { created: true };
  } catch (err) {
    // Remove do cache se falhou
    delete WEBHOOK_ACTIVITIES_CACHE[memKey];
    throw err;
  }
}

/***********************
 *  PROCESSAMENTO - MODIFICADO (SÓ VERIFICA FUNIL/ETAPA)
 ***********************/
function webhookProcessDeal_(deal, statusChanges) {
  const today = tzToday_();
  if (isWeekend_(today)) {
    return { ok:true, skipped:'weekend' };
  }

  // VERIFICAÇÃO: Apenas Funil e Etapa corretos
  if (!webhookIsDealInCorrectStage_(deal)) {
    webhookDebug_('Deal bloqueado: funil/etapa incorreto', { 
      dealId: deal.id,
      pipelineId: deal.pipeline_id,
      stageId: deal.stage_id
    });
    return { ok:true, skipped:'wrong_stage' };
  }

  // Deleta incompatíveis
  let deletedCount = 0;
  for (const change of statusChanges) {
    deletedCount += webhookDeleteIncompatibleActivities_(deal.id, change.plan);
  }

  const baseStr = deal[FIELD_KEYS.dataTerminoTriagem];
  if (!baseStr) {
    return { ok:true, skipped:'missing_triagem' };
  }

  const baseDate = parseLocalDate_(baseStr);

  let created = 0, skipped = 0;
  const createdActivities = [];

  for (const change of statusChanges) {
    const planKey = change.plan;
    const pl = PLAN[planKey];
    
    if (!pl) continue;
    
    const dayConfigs = pl.days.slice();
    const isStatusChange = !planKey.includes('INICIAL');
    
    if (isStatusChange) {
      // Mudança de status: cria a partir de HOJE
      for (let i = 0; i < dayConfigs.length; i++) {
        const config = dayConfigs[i];
        const d = config.day;
        const hour = config.hour;
        const subject = pl.title(d);
        const note = pl.note(d);
        const priority = getPriority_(planKey, d);
        const dueRaw = addDays_(today, d);
        const dueBday = nextBusinessDay_(dueRaw);
        const dueTime = String(hour).padStart(2, '0') + ':00';

        try {
          const result = webhookCreateActivitySafe_({ 
            deal, subject, note, 
            dueDate: dueBday, 
            dueTime, 
            priority
          });
          
          if (result.created) {
            created++;
            createdActivities.push(`✓ ${subject}`);
          } else {
            skipped++;
          }
        } catch (err) {
          webhookDebug_('Erro ao criar atividade', { subject, error: err.message });
        }
      }
    } else {
      // Inicialização: cria BACKLOG + PRÓXIMA
      
      // 1. BACKLOG
      for (let i = 0; i < dayConfigs.length; i++) {
        const config = dayConfigs[i];
        const d = config.day;
        const hour = config.hour;
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        
        if (dueBday <= today) {
          const subject = pl.title(d);
          const note = pl.note(d);
          const priority = getPriority_(planKey, d);
          const dueTime = String(hour).padStart(2, '0') + ':00';

          try {
            const result = webhookCreateActivitySafe_({ 
              deal, subject, note, 
              dueDate: dueBday, 
              dueTime, 
              priority
            });
            
            if (result.created) {
              created++;
              createdActivities.push(`✓ ${subject}`);
            } else {
              skipped++;
            }
          } catch (err) {
            webhookDebug_('Erro ao criar atividade (backlog)', { subject, error: err.message });
          }
        }
      }
      
      // 2. PRÓXIMA
      const nextConfig = dayConfigs.find(cfg => {
        const dueRaw = addDays_(baseDate, cfg.day);
        const dueBday = nextBusinessDay_(dueRaw);
        return dueBday > today;
      });
      
      if (nextConfig) {
        const d = nextConfig.day;
        const hour = nextConfig.hour;
        const subject = pl.title(d);
        const note = pl.note(d);
        const priority = getPriority_(planKey, d);
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        const dueTime = String(hour).padStart(2, '0') + ':00';

        try {
          const result = webhookCreateActivitySafe_({ 
            deal, subject, note, 
            dueDate: dueBday, 
            dueTime, 
            priority
          });
          
          if (result.created) {
            created++;
            createdActivities.push(`✓ ${subject}`);
          } else {
            skipped++;
          }
        } catch (err) {
          webhookDebug_('Erro ao criar atividade (próxima)', { subject, error: err.message });
        }
      }
    }
  }

  return { ok: true, created, skipped, deleted: deletedCount, createdActivities };
}

/***********************
 *  PLANILHA
 ***********************/
function webhookAppendLog_({ timestamp, dealId, title, action, atividadesCriadas, detalhes }) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;
  
  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.LOG_SHEET);
    
    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.LOG_SHEET);
      sh.getRange(1, 1, 1, 6).setValues([['Timestamp', 'DealID', 'Title', 'Action', 'Atividades', 'Detalhes']])
        .setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    
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
    }
    
    if (lastRow > WEBHOOK_CONFIG.MAX_LOG_ROWS + 1) {
      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_LOG_ROWS - 1);
    }
  } catch (err) {}
}

function webhookAppendError_(where, error, eventData) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;
  
  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.ERR_SHEET);
    
    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.ERR_SHEET);
      sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'DealID', 'Erro', 'Stack', 'Payload']])
        .setFontWeight('bold').setBackground('#ea4335').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    
    const timestamp = Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm:ss');
    const errorMessage = (error && error.message) ? String(error.message) : String(error);
    const stackTrace = (error && error.stack) ? String(error.stack) : 'N/A';
    
    let dealId = '', payloadText = '';
    try {
      if (eventData && eventData.postData && eventData.postData.contents) {
        const payload = JSON.parse(eventData.postData.contents);
        const current = payload.data || payload.current || {};
        dealId = String(current.id || '');
        payloadText = JSON.stringify(payload, null, 2);
      }
    } catch (parseErr) {
      payloadText = 'N/A';
    }
    
    if (payloadText.length > 50000) payloadText = payloadText.substring(0, 50000);
    
    sh.appendRow([timestamp, dealId, errorMessage, stackTrace, payloadText]);
    sh.getRange(sh.getLastRow(), 1, 1, 5).setBackground('#f4cccc');
  } catch (err) {}
}

/***********************
 *  HANDLER PRINCIPAL - MODIFICADO
 ***********************/
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    if (!raw) throw new Error('Sem corpo');

    const payload = JSON.parse(raw);
    const meta = payload.meta || {};
    let current = payload.data || payload.current || payload;
    const previous = payload.previous || {};
    
    const dealId = current.id || current.dealId || payload.dealId || '';
    const title = current.title || payload.title || '';
    
    const isDealEvent = !!(dealId && (meta.object === 'deal' || meta.action === 'updated' || meta.action === 'change' || payload.dealId));

    // FILTRO DE TESTE: Apenas deal específico (se configurado)
    if (WEBHOOK_CONFIG.ALLOWED_DEAL && String(dealId) !== String(WEBHOOK_CONFIG.ALLOWED_DEAL)) {
      webhookDebug_('Deal bloqueado por filtro de teste', { 
        dealId, 
        allowedDeal: WEBHOOK_CONFIG.ALLOWED_DEAL 
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        ok: true, 
        skipped: 'deal_not_allowed',
        message: `Webhook em modo teste: apenas deal ${WEBHOOK_CONFIG.ALLOWED_DEAL}`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!isDealEvent || !dealId) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'not_deal' })).setMimeType(ContentService.MimeType.JSON);
    }

    // Busca deal completo
    let fullDeal = current;
    try {
      const r = pd_('/deals/' + dealId);
      if (r && r.data) fullDeal = r.data;
    } catch (errDeal) {}

    // VERIFICAÇÃO: Funil e Etapa
    if (!webhookIsDealInCorrectStage_(fullDeal)) {
      webhookDebug_('Webhook ignorado: funil/etapa incorreto', { dealId, title });
      return ContentService.createTextOutput(JSON.stringify({ 
        ok: true, 
        skipped: 'wrong_stage',
        message: `Deal não está no funil "${WEBHOOK_FILTROS.FUNIL_NOME}" e etapa "${WEBHOOK_FILTROS.ETAPA_NOME}"`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const statusIPTU = String(fullDeal[FIELD_KEYS.statusIPTU] || '').trim();
    
    const isEligible = (
      fullDeal.status === 'open' && 
      fullDeal[FIELD_KEYS.dataTerminoTriagem] && 
      !fullDeal[FIELD_KEYS.dataTerminoIPTU] && 
      fullDeal[FIELD_KEYS.statusIPTU] && 
      fullDeal[FIELD_KEYS.iptuResponsabilidade] && 
      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE
    );

    if (!isEligible) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'not_eligible' })).setMimeType(ContentService.MimeType.JSON);
    }

    const statusChanges = webhookDetectChanges_(fullDeal, previous);
    
    if (statusChanges.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok:true, skipped:'no_changes' })).setMimeType(ContentService.MimeType.JSON);
    }

    const changeHash = webhookGetChangeHash_(dealId, statusChanges);
    
    if (webhookIsProcessing_(dealId, changeHash)) {
      return ContentService.createTextOutput(JSON.stringify({ 
        ok: true, 
        skipped: 'processing' 
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
    service: 'Webhook IPTU v4.1 - Atividades para usuário específico',
    timestamp: new Date().toISOString(),
    author: 'mcemy',
    lockSeconds: WEBHOOK_CONFIG.LOCK_SECONDS,
    testMode: WEBHOOK_CONFIG.ALLOWED_DEAL ? `Apenas deal ${WEBHOOK_CONFIG.ALLOWED_DEAL}` : 'Desativado',
    filters: {
      usuarioAtividades: WEBHOOK_FILTROS.USUARIO_ATIVIDADES_EMAIL,
      funil: WEBHOOK_FILTROS.FUNIL_NOME,
      etapa: WEBHOOK_FILTROS.ETAPA_NOME
    },
    features: [
      '🎯 Verificação APENAS por SUBJECT',
      '💾 Cache 3 camadas',
      '⚡ Lock 30s',
      '🚫 Se existe atividade = NÃO CRIA outra',
      '👤 Atividades sempre para usuário específico',
      '🗂️ Filtro por funil e etapa do deal',
      '🧪 Modo teste: deal específico'
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

/***********************
 *  MANUTENÇÃO
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
    
    Logger.log('✅ %s itens removidos', count);
    return count;
  } catch (err) {
    Logger.log('Erro ao limpar: %s', err.message);
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
    } catch (err) {}
  }
  
  Logger.log('✅ Reset concluído: %s itens removidos', removed);
}
