/**********************************************/
/* WEBHOOK HANDLER - LOGGING E CACHE APENAS  */
/**********************************************/

const WEBHOOK_CONFIG = (() => {
  const props = PropertiesService.getScriptProperties();
  return {
    SHEET_ID: props.getProperty("SHEET_ID"),
    LOG_SHEET: "WebhookLog",
    ERR_SHEET: "WebhookErrors",
    DEBUG_SHEET: "WebhookDebug",
    ALLOWED_DEAL: props.getProperty("TEST_DEAL_ID") || null,
    MAX_LOG_ROWS: 200,
    MAX_ERR_ROWS: 100,
    MAX_DEBUG_ROWS: 500,
  };
})();

if (typeof WEBHOOK_ACTIVITIES_CACHE === "undefined") {
  var WEBHOOK_ACTIVITIES_CACHE = {};
}

const WEBHOOK_LOCK = PropertiesService.getScriptProperties();

/***********************
 *  HANDLERS HTTP
 ***********************/
function doPost(e) {
  try {
    // Filtro por deal específico se configurado
    if (WEBHOOK_CONFIG.ALLOWED_DEAL) {
      const payload = JSON.parse(e.postData.contents);
      if (
        payload.current &&
        payload.current.id != WEBHOOK_CONFIG.ALLOWED_DEAL
      ) {
        return ContentService.createTextOutput("Deal filtered").setMimeType(
          ContentService.MimeType.TEXT
        );
      }
    }

    // Chama função do main.gs para processar
    const result = processWebhookData(e);

    webhookLog_("Webhook processado", {
      success: result.success,
      message: result.message,
      processed: result.processed || 0,
    });

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    webhookError_("Erro no webhook", err);
    return ContentService.createTextOutput("Error").setMimeType(
      ContentService.MimeType.TEXT
    );
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook ativo").setMimeType(
    ContentService.MimeType.TEXT
  );
}

/***********************
 *  LOGGING FUNCTIONS
 ***********************/
function webhookLog_(message, data) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;

  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.LOG_SHEET);

    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.LOG_SHEET);
      const headers = ["Timestamp", "Mensagem", "Dados"];
      sh.getRange(1, 1, 1, 3)
        .setValues([headers])
        .setFontWeight("bold")
        .setBackground("#4CAF50")
        .setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }

    const timestamp = Utilities.formatDate(
      new Date(),
      CFG.TZ,
      "dd/MM/yyyy HH:mm:ss"
    );
    const dataStr = data ? JSON.stringify(data, null, 2) : "";
    sh.appendRow([timestamp, String(message), dataStr]);

    const lastRow = sh.getLastRow();
    if (lastRow > WEBHOOK_CONFIG.MAX_LOG_ROWS + 1) {
      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_LOG_ROWS - 1);
    }
  } catch (err) {}
}

function webhookError_(message, error) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;

  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.ERR_SHEET);

    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.ERR_SHEET);
      const headers = ["Timestamp", "Mensagem", "Erro", "Stack"];
      sh.getRange(1, 1, 1, 4)
        .setValues([headers])
        .setFontWeight("bold")
        .setBackground("#F44336")
        .setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }

    const timestamp = Utilities.formatDate(
      new Date(),
      CFG.TZ,
      "dd/MM/yyyy HH:mm:ss"
    );
    const errorStr = String(error.message || error);
    const stackStr = String(error.stack || "");
    sh.appendRow([timestamp, String(message), errorStr, stackStr]);

    const lastRow = sh.getLastRow();
    if (lastRow > WEBHOOK_CONFIG.MAX_ERR_ROWS + 1) {
      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_ERR_ROWS - 1);
    }
  } catch (err) {}
}

function webhookDebug_(message, data) {
  if (!WEBHOOK_CONFIG.SHEET_ID) return;

  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_CONFIG.SHEET_ID);
    let sh = ss.getSheetByName(WEBHOOK_CONFIG.DEBUG_SHEET);

    if (!sh) {
      sh = ss.insertSheet(WEBHOOK_CONFIG.DEBUG_SHEET);
      const headers = ["Timestamp", "Mensagem", "Dados"];
      sh.getRange(1, 1, 1, 3)
        .setValues([headers])
        .setFontWeight("bold")
        .setBackground("#FF9800")
        .setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }

    const timestamp = Utilities.formatDate(
      new Date(),
      CFG.TZ,
      "dd/MM/yyyy HH:mm:ss"
    );
    const dataStr = data ? JSON.stringify(data, null, 2) : "";
    sh.appendRow([timestamp, String(message), dataStr]);

    const lastRow = sh.getLastRow();
    if (lastRow > WEBHOOK_CONFIG.MAX_DEBUG_ROWS + 1) {
      sh.deleteRows(2, lastRow - WEBHOOK_CONFIG.MAX_DEBUG_ROWS - 1);
    }
  } catch (err) {}
}

/***********************
 *  CACHE FUNCTIONS
 ***********************/
function clearWebhookCache() {
  try {
    WEBHOOK_ACTIVITIES_CACHE = {};

    // Limpa cache persistente de atividades
    const props = PropertiesService.getScriptProperties();
    const keys = props.getKeys();

    let cleared = 0;
    for (const key of keys) {
      if (key.startsWith("ACT_") || key.startsWith("LOCK_")) {
        props.deleteProperty(key);
        cleared++;
      }
    }

    webhookLog_("Cache limpo", { cleared });
    return { success: true, cleared };
  } catch (err) {
    webhookError_("Erro ao limpar cache", err);
    return { success: false, error: err.message };
  }
}

function getWebhookCacheStats() {
  try {
    const memoryCount = Object.keys(WEBHOOK_ACTIVITIES_CACHE).length;

    const props = PropertiesService.getScriptProperties();
    const keys = props.getKeys();
    const persistentCount = keys.filter(
      (k) => k.startsWith("ACT_") || k.startsWith("LOCK_")
    ).length;

    return {
      memory: memoryCount,
      persistent: persistentCount,
      total: memoryCount + persistentCount,
    };
  } catch (err) {
    return { error: err.message };
  }
}
