/***********************
 *  CONFIG
 ***********************/

const CFG = (() => {
  const props = PropertiesService.getScriptProperties();
  return {
    TOKEN: props.getProperty("PIPEDRIVE_API_TOKEN"),
    BASE:
      props.getProperty("PIPEDRIVE_BASE_URL") || "https://api.pipedrive.com/v1",
    TZ: props.getProperty("TIMEZONE") || "America/Sao_Paulo",
  };
})();

if (!CFG.TOKEN) {
  throw new Error("Defina PIPEDRIVE_API_TOKEN nas Propriedades do Script.");
}

const ACTIVITY_TYPE_KEY = "condominio"; // Key do tipo IPTU

const FIELD_KEYS = {
  dataTerminoTriagem: "fb1aa427746a8e05d6dadc6eccfc51dd1cdc992d",
  dataTerminoIPTU: "46f5eea72dbdcd18c9c19d2ddee73bff046fc14b",
  statusIPTU: "f6e1f351857746dc37fbf68c57946dc98a8a5d65",
  iptuResponsabilidade: "f3fa85b1fa8b1d474df7e2ddc35d703fcf7cb3de",
};

const STATUS_IDS = {
  IPTU: {
    INICIAR: "1079",
    BOLETO_ENVIADO: "209",
    PENDENCIA_DOCUMENTAL: "235",
    ATESTE_RECEBIDO: "172",
    SOLICITAR_CND: "587",
    CND_SALVA_DRIVE: "143",
  },
};

const RESPONSABILIDADE_IDS = {
  ARREMATANTE: "363",
  CAIXA: "364",
};

/***********************
 *  CACHE DE PRIORIDADES
 ***********************/

if (typeof PRIORITY_IDS_CACHE === "undefined") {
  var PRIORITY_IDS_CACHE = null;
}

if (typeof ACTIVITIES_USER_ID_CACHE === "undefined") {
  var ACTIVITIES_USER_ID_CACHE = null;
}

function getPriorityIds_() {
  if (PRIORITY_IDS_CACHE) return PRIORITY_IDS_CACHE;

  try {
    const resp = pd_("/activityFields");
    if (resp && resp.data) {
      const priorityField = resp.data.find((f) => f.key === "priority");

      if (
        priorityField &&
        priorityField.options &&
        Array.isArray(priorityField.options)
      ) {
        const options = {};
        priorityField.options.forEach((opt) => {
          if (opt.label && opt.id !== undefined) {
            const label = String(opt.label).toLowerCase();
            if (label.includes("high") || label.includes("alta")) {
              options.HIGH = opt.id;
            } else if (label.includes("medium") || label.includes("média")) {
              options.MEDIUM = opt.id;
            } else if (label.includes("low") || label.includes("baixa")) {
              options.LOW = opt.id;
            }
          }
        });

        if (Object.keys(options).length > 0) {
          PRIORITY_IDS_CACHE = options;
          return PRIORITY_IDS_CACHE;
        }
      }
    }
  } catch (err) {
    Logger.log("⚠️ Erro ao carregar IDs de prioridade: " + err.message);
  }

  PRIORITY_IDS_CACHE = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  return PRIORITY_IDS_CACHE;
}

function getPriorityValue_(priority) {
  const ids = getPriorityIds_();

  switch (priority) {
    case "high":
      return ids.HIGH || 2;
    case "medium":
      return ids.MEDIUM || 1;
    case "low":
      return ids.LOW || 0;
    default:
      return ids.MEDIUM || 1;
  }
}

/***********************
 *  HELPERS TEXTO
 ***********************/

function normalizeText_(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/***********************
 *  HELPERS DATAS
 ***********************/

function tzToday_() {
  const now = new Date();
  const str = Utilities.formatDate(now, CFG.TZ, "yyyy-MM-dd");
  return new Date(str + "T00:00:00");
}

function parseLocalDate_(yyyy_mm_dd) {
  return new Date(yyyy_mm_dd + "T00:00:00");
}

function addDays_(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function ymd_(date) {
  return Utilities.formatDate(date, CFG.TZ, "yyyy-MM-dd");
}

function isWeekend_(date) {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function nextBusinessDay_(date) {
  let d = new Date(date.getTime());
  while (isWeekend_(d)) d = addDays_(d, 1);
  return d;
}

/***********************
 *  FILTROS
 ***********************/

const FILTROS = {
  USUARIO_ATIVIDADES_EMAIL:
    PropertiesService.getScriptProperties().getProperty(
      "USUARIO_ATIVIDADES_EMAIL"
    ) || "lucastolentino.smart@gmail.com",
  FUNIL_NOME:
    PropertiesService.getScriptProperties().getProperty("FUNIL_NOME") ||
    "pos arrematação",
  ETAPA_NOME:
    PropertiesService.getScriptProperties().getProperty("ETAPA_NOME") ||
    "contrato",
};

function getActivitiesUserId_() {
  if (ACTIVITIES_USER_ID_CACHE) return ACTIVITIES_USER_ID_CACHE;

  try {
    const resp = pd_("/users?limit=500");
    if (resp && resp.data) {
      const user = resp.data.find(
        (u) =>
          String(u.email || "").toLowerCase() ===
          FILTROS.USUARIO_ATIVIDADES_EMAIL.toLowerCase()
      );

      if (user && user.id) {
        ACTIVITIES_USER_ID_CACHE = user.id;
        return ACTIVITIES_USER_ID_CACHE;
      }
    }
  } catch (err) {
    Logger.log("⚠️ Erro ao buscar usuário: " + err.message);
  }

  Logger.log("❌ Usuário %s não encontrado", FILTROS.USUARIO_ATIVIDADES_EMAIL);
  return null;
}

function isDealInCorrectStage_(deal) {
  try {
    if (!deal.pipeline_id || !deal.stage_id) {
      Logger.log("⚠️ Deal %s sem pipeline_id ou stage_id", deal.id);
      return false;
    }

    const pipelineResp = pd_("/pipelines/" + deal.pipeline_id);
    if (!pipelineResp || !pipelineResp.data) {
      Logger.log("❌ Pipeline %s não encontrado", deal.pipeline_id);
      return false;
    }

    const pipeline = pipelineResp.data;
    const pipelineName = normalizeText_(pipeline.name);

    if (pipelineName !== normalizeText_(FILTROS.FUNIL_NOME)) {
      Logger.log(
        "⊘ Deal %s não está no funil '%s' (está em '%s')",
        deal.id,
        FILTROS.FUNIL_NOME,
        pipeline.name
      );
      return false;
    }

    const stageResp = pd_("/stages/" + deal.stage_id);
    if (!stageResp || !stageResp.data) {
      Logger.log("❌ Etapa %s não encontrada", deal.stage_id);
      return false;
    }

    const stage = stageResp.data;
    const stageName = normalizeText_(stage.name);

    if (stageName !== normalizeText_(FILTROS.ETAPA_NOME)) {
      Logger.log(
        "⊘ Deal %s não está na etapa '%s' (está em '%s')",
        deal.id,
        FILTROS.ETAPA_NOME,
        stage.name
      );
      return false;
    }

    Logger.log(
      "✅ Deal %s está no funil '%s' e etapa '%s'",
      deal.id,
      pipeline.name,
      stage.name
    );
    return true;
  } catch (err) {
    Logger.log(
      "❌ Erro ao verificar stage do deal %s: %s",
      deal.id,
      err.message
    );
    return false;
  }
}

/***********************
 *  HELPERS DE STATUS
 ***********************/

function normalizeStatus_(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  const s2 = s.replace(/^\d+[\.\-\s]+/, "").trim();
  return s2;
}

function isIniciar_(v) {
  if (!v) return false;
  const vStr = String(v).trim();

  if (STATUS_IDS.IPTU.INICIAR && vStr === String(STATUS_IDS.IPTU.INICIAR)) {
    return true;
  }

  const normalized = normalizeStatus_(v);
  return /^iniciar$/i.test(normalized);
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
  const url =
    CFG.BASE +
    path +
    (path.includes("?") ? "&" : "?") +
    "api_token=" +
    CFG.TOKEN;

  const params = Object.assign(
    {
      method: "get",
      muteHttpExceptions: true,
      contentType: "application/json",
    },
    opt || {}
  );

  const res = UrlFetchApp.fetch(url, params);
  const code = res.getResponseCode();

  if (code < 200 || code >= 300)
    throw new Error(
      "PD " +
        (params.method || "GET") +
        " " +
        path +
        " " +
        code +
        " " +
        res.getContentText()
    );

  return JSON.parse(res.getContentText());
}

/***********************
 *  NEGÓCIOS ELEGÍVEIS
 ***********************/

function fetchCandidateDeals_() {
  const resp = pd_("/deals?limit=500&status=open");
  const deals = resp.data || [];

  return deals.filter((d) => {
    const statusIPTU = String(d[FIELD_KEYS.statusIPTU] || "").trim();

    const hasRequiredFields =
      d[FIELD_KEYS.dataTerminoTriagem] &&
      !d[FIELD_KEYS.dataTerminoIPTU] &&
      statusIPTU !== STATUS_IDS.IPTU.CND_SALVA_DRIVE;

    if (!hasRequiredFields) return false;

    if (!isDealInCorrectStage_(d)) return false;

    return true;
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
    const r = pd_(
      `/activities?deal_id=${dealId}&done=0&start=${start}&limit=${limit}`
    );
    const arr = r.data || [];
    all.push.apply(all, arr);
    const pg = r.additional_data && r.additional_data.pagination;
    if (!pg || !pg.more_items_in_collection) break;
    start = pg.next_start;
  }

  start = 0;
  while (true) {
    const r = pd_(
      `/activities?deal_id=${dealId}&done=1&start=${start}&limit=${limit}`
    );
    const arr = r.data || [];
    all.push.apply(all, arr);
    const pg = r.additional_data && r.additional_data.pagination;
    if (!pg || !pg.more_items_in_collection) break;
    start = pg.next_start;
  }

  return all;
}

function normalizeSubject_(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function activityExistsStrong_({ dealId, subject, dueDateYmd, dueTime }) {
  const subjN = normalizeSubject_(subject);
  const list = listActivitiesAll_(dealId);

  return list.some((a) => {
    const sameType = String(a.type || "").trim() === ACTIVITY_TYPE_KEY;
    const sameDue = String(a.due_date || "") === String(dueDateYmd);
    const sameTime = String(a.due_time || "") === String(dueTime);
    const sameSubj = normalizeSubject_(a.subject) === subjN;
    return sameType && sameDue && sameTime && sameSubj;
  });
}

function activityExistsBySubjectType_({ dealId, subject }) {
  const subjN = normalizeSubject_(subject);
  const list = listActivitiesAll_(dealId);

  return list.some((a) => {
    const sameType = String(a.type || "").trim() === ACTIVITY_TYPE_KEY;
    const sameSubj = normalizeSubject_(a.subject) === subjN;
    return sameType && sameSubj;
  });
}

/***********************
 *  FORMATAÇÃO DO NOTE
 ***********************/

function escapeHtml_(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function formatNote_(rawNote) {
  if (!rawNote) return "";
  var s = String(rawNote).trim();
  s = s.replace(/—\s*Lembre-se:/gi, "Observação:");
  var lines = s.split("\n");
  var out = [];

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    if (raw.trim() === "") continue;
    var content = raw.replace(/^\s*[•◉\-—–→]\s*/, "").trimEnd();
    var bullet = /^Observa[cç][aã]o:/i.test(content) ? "" : "• ";
    out.push("<p>" + bullet + escapeHtml_(content) + "</p>");
  }

  return out.join("");
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
    },
    BOLETO_ENVIADO: {
      5: `Verificar se a CEF enviou retorno quanto ao boleto anexado.
Em caso de análise documental, atualizar o pipe, enviar mensagem padrão de Análise Documental para o cliente e tomar as medidas necessárias para corrigir a documentação e protocolar novamente em 3 dias úteis.
Em caso de Ateste, atualizar o pipe, enviar mensagem padrão de Ateste para o cliente.`,
    },
    SOLICITAR_CND: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.
Enviar a mensagem padrão de finalização de processo para o cliente.`,
    },
    PENDENCIA_DOCUMENTAL: {
      3: `Verificar se foi possível corrigir a documentação conforme retorno da CEF.
Caso positivo, anexar os boletos corrigidos na plataforma da CEF.
Caso negativo, entrar em contato com o cliente para entender o motivo e orientar sobre os próximos passos.`,
    },
    ATESTE_RECEBIDO: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.
Enviar a mensagem padrão de finalização de processo para o cliente.`,
    },
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
Lembrar de preencher os campos "IPTU: Valor da Dívida".
Validar a documentação, analisando se foi emitido todos os boletos em aberto (lembrar de analisar Dívida Ativa), endereço, unidade do imóvel, e se as dívidas prescritas estão acompanhadas do nº do processo, ou protesto ou confissão de dívida, caso contrario, deverá ser dado baixa.`,
      7: `Enviar os boletos para o cliente com instruções de pagamento.
Orientar sobre os prazos e consequências do não pagamento.
Acompanhar o status do pagamento e atualizar o pipe conforme necessário.`,
      9: `Verificar se o cliente fez o pagamento dos boletos.
Caso ainda não tenha pagado, entrar em contato para lembrar dos prazos e orientar sobre as consequências.`,
    },
    BOLETO_ENVIADO: {
      3: `Verificar se o cliente pagou os boletos enviados.
Em caso de pagamento, solicitar o comprovante e atualizar o status.
Em caso de não pagamento, entrar em contato para orientar sobre os prazos.`,
    },
    SOLICITAR_CND: {
      7: `Verificar se recebeu a CND e após confirmação, atualizar: lateral, checklist, nota detalhada, barra verde e concluir atividades.
Enviar a mensagem padrão de finalização de processo para o cliente.`,
    },
  },
};

const TITLE_IPTU_CEF_INICIAL = {
  1: "INICIAR",
  2: "TENTATIVAS VIRTUAIS",
  4: "VERIFICAR NECESSIDADE DE DILIGÊNCIA",
  6: "CONFIRMAÇÃO DE EMISSÃO",
  7: "ENVIO DA DOCUMENTAÇÃO PARA A CEF",
  9: "ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA",
};

const TITLE_IPTU_CLIENTE_INICIAL = {
  1: "INICIAR",
  2: "TENTATIVAS VIRTUAIS",
  4: "VERIFICAR NECESSIDADE DE DILIGÊNCIA",
  6: "CONFIRMAÇÃO DE EMISSÃO",
  7: "ENVIO DA DOCUMENTAÇÃO PARA QUITAÇÃO",
  9: "ALERTA: VERIFICAR SE A DOCUMENTAÇÃO FOI ENVIADA",
};

const PRIORITY_MAP = {
  IPTU_CEF_INICIAL: {
    high: new Set([1, 7, 9]),
    medium: new Set([2, 4]),
    low: new Set([6]),
  },
  IPTU_CEF_BOLETO: { high: new Set(), medium: new Set([5]), low: new Set() },
  IPTU_CEF_SOLICITAR: { high: new Set(), medium: new Set(), low: new Set([7]) },
  IPTU_CEF_PENDENCIA: { high: new Set(), medium: new Set([3]), low: new Set() },
  IPTU_CEF_ATESTE: { high: new Set(), medium: new Set(), low: new Set([7]) },
  IPTU_CLIENTE_INICIAL: {
    high: new Set([1, 7, 9]),
    medium: new Set([2, 4]),
    low: new Set([6]),
  },
  IPTU_CLIENTE_BOLETO: {
    high: new Set(),
    medium: new Set([3]),
    low: new Set(),
  },
  IPTU_CLIENTE_SOLICITAR: {
    high: new Set(),
    medium: new Set(),
    low: new Set([7]),
  },
};

function getPriority_(planKey, day) {
  const pm = PRIORITY_MAP[planKey];
  if (!pm) return "low";
  if (pm.high.has(day)) return "high";
  if (pm.medium.has(day)) return "medium";
  if (pm.low.has(day)) return "low";
  return "low";
}

const PLAN = {
  IPTU_CEF_INICIAL: {
    days: [
      { day: 1, hour: 2, minute: 59 },
      { day: 2, hour: 2, minute: 59 },
      { day: 4, hour: 2, minute: 59 },
      { day: 6, hour: 2, minute: 59 },
      { day: 7, hour: 2, minute: 59 },
      { day: 9, hour: 2, minute: 59 },
    ],
    title: (d) =>
      `IPTU - ${d} DIA${d > 1 ? "S" : ""} - ${TITLE_IPTU_CEF_INICIAL[d]}`,
    note: (d) => formatNote_(TXT.IPTU_CEF.INICIAL[d]),
  },
  IPTU_CEF_BOLETO: {
    days: [{ day: 5, hour: 2, minute: 59 }],
    title: (d) => `IPTU - VERIFICAR RETORNO DA CEF SOBRE O BOLETO ENVIADO`,
    note: (d) => formatNote_(TXT.IPTU_CEF.BOLETO_ENVIADO[d]),
  },
  IPTU_CEF_SOLICITAR: {
    days: [{ day: 7, hour: 2, minute: 59 }],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CEF.SOLICITAR_CND[d]),
  },
  IPTU_CEF_PENDENCIA: {
    days: [{ day: 3, hour: 2, minute: 59 }],
    title: (d) => `IPTU - ENVIAR DOCUMENTAÇÃO CORRIGIDA PARA A CEF`,
    note: (d) => formatNote_(TXT.IPTU_CEF.PENDENCIA_DOCUMENTAL[d]),
  },
  IPTU_CEF_ATESTE: {
    days: [{ day: 7, hour: 2, minute: 59 }],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CEF.ATESTE_RECEBIDO[d]),
  },
  IPTU_CLIENTE_INICIAL: {
    days: [
      { day: 1, hour: 2, minute: 59 },
      { day: 2, hour: 2, minute: 59 },
      { day: 4, hour: 2, minute: 59 },
      { day: 6, hour: 2, minute: 59 },
      { day: 7, hour: 2, minute: 59 },
      { day: 9, hour: 2, minute: 59 },
    ],
    title: (d) =>
      `IPTU - ${d} DIA${d > 1 ? "S" : ""} - ${TITLE_IPTU_CLIENTE_INICIAL[d]}`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.INICIAL[d]),
  },
  IPTU_CLIENTE_BOLETO: {
    days: [{ day: 3, hour: 2, minute: 59 }],
    title: (d) => `IPTU - VERIFICAR SE O CLIENTE PAGOU O BOLETO`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.BOLETO_ENVIADO[d]),
  },
  IPTU_CLIENTE_SOLICITAR: {
    days: [{ day: 7, hour: 2, minute: 59 }],
    title: (d) => `IPTU - EMITIR CND E FINALIZAR O IMÓVEL`,
    note: (d) => formatNote_(TXT.IPTU_CLIENTE.SOLICITAR_CND[d]),
  },
};

/***********************
 *  DECIDIR PLANOS A CRIAR
 ***********************/

function getPlansToCreate_(deal) {
  const plans = [];
  const statusIPTU = deal[FIELD_KEYS.statusIPTU];
  const statusIPTUStr = String(statusIPTU || "").trim();
  const responsabilidade = deal[FIELD_KEYS.iptuResponsabilidade];

  // Bloqueia se CND já foi salva
  if (statusIPTUStr === STATUS_IDS.IPTU.CND_SALVA_DRIVE) {
    return plans;
  }

  if (isIniciar_(statusIPTU)) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push("IPTU_CEF_INICIAL");
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push("IPTU_CLIENTE_INICIAL");
    }
  }

  if (statusIPTUStr === STATUS_IDS.IPTU.BOLETO_ENVIADO) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push("IPTU_CEF_BOLETO");
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push("IPTU_CLIENTE_BOLETO");
    }
  }

  if (statusIPTUStr === STATUS_IDS.IPTU.SOLICITAR_CND) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push("IPTU_CEF_SOLICITAR");
    } else if (isResponsabilidadeArrematante_(responsabilidade)) {
      plans.push("IPTU_CLIENTE_SOLICITAR");
    }
  }

  if (statusIPTUStr === STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push("IPTU_CEF_PENDENCIA");
    }
  }

  if (statusIPTUStr === STATUS_IDS.IPTU.ATESTE_RECEBIDO) {
    if (isResponsabilidadeCaixa_(responsabilidade)) {
      plans.push("IPTU_CEF_ATESTE");
    }
  }

  return plans;
}

/***********************
 *  CRIAÇÃO DE ATIVIDADES
 ***********************/

function createActivity_({ deal, subject, note, dueDate, dueTime, priority }) {
  const activitiesUserId = getActivitiesUserId_();
  if (!activitiesUserId) {
    throw new Error("Usuário para atividades não encontrado");
  }

  const priorityValue = getPriorityValue_(priority);

  const payload = {
    subject: subject,
    note: note,
    due_date: ymd_(dueDate),
    due_time: dueTime,
    deal_id: deal.id,
    person_id: deal.person_id ? deal.person_id.value : null,
    org_id: deal.org_id ? deal.org_id.value : null,
    user_id: activitiesUserId,
    type: ACTIVITY_TYPE_KEY,
    priority: priorityValue,
  };

  const result = pd_("/activities", {
    method: "post",
    payload: JSON.stringify(payload),
  });

  if (result && result.data && result.data.id) {
    Logger.log("  ✅ Criada ID: %s", result.data.id);
  } else {
    Logger.log("  ❌ Falha ao criar atividade: %s", JSON.stringify(result));
  }

  return result;
}

/***********************
 *  FUNÇÃO PRINCIPAL
 ***********************/

function tick() {
  const today = tzToday_();
  Logger.log("=== TICK %s ===", ymd_(today));

  const deals = fetchCandidateDeals_();
  Logger.log("📋 %s negócios encontrados", deals.length);

  let created = 0;
  let skipped = 0;
  let checked = 0;

  deals.forEach((deal) => {
    checked++;
    Logger.log("\n🔍 Analisando negócio %s", deal.id);

    const plans = getPlansToCreate_(deal);
    if (plans.length === 0) {
      Logger.log("  ⊘ Nenhum plano aplicável");
      return;
    }

    const baseDate = parseLocalDate_(deal[FIELD_KEYS.dataTerminoTriagem]);

    for (const planKey of plans) {
      const pl = PLAN[planKey];
      if (!pl) continue;

      Logger.log("  📋 Plano: %s", planKey);

      const dayConfigs = pl.days || [];

      // Backlog - criar atividades vencidas
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const minute = config.minute || 0;
        const dueTime =
          String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
        const s = pl.title(d);
        const n = pl.note(d);
        const p = getPriority_(planKey, d);
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        const dueY = ymd_(dueBday);

        if (dueBday <= today) {
          if (
            !activityExistsStrong_({
              dealId: deal.id,
              subject: s,
              dueDateYmd: dueY,
              dueTime,
            }) &&
            !activityExistsBySubjectType_({ dealId: deal.id, subject: s })
          ) {
            createActivity_({
              deal,
              subject: s,
              note: n,
              dueDate: dueBday,
              dueTime,
              priority: p,
            });
            created++;
          } else {
            skipped++;
          }
        }
      });

      // Próxima atividade futura
      const nextConfig = dayConfigs.find((cfg) => {
        const dueRaw = addDays_(baseDate, cfg.day);
        const dueBday = nextBusinessDay_(dueRaw);
        return dueBday > today;
      });

      if (nextConfig) {
        const nextD = nextConfig.day;
        const nextHour = nextConfig.hour;
        const nextMinute = nextConfig.minute || 0;
        const subjectN = pl.title(nextD);
        const noteN = pl.note(nextD);
        const priorityN = getPriority_(planKey, nextD);
        const dueRawN = addDays_(baseDate, nextD);
        const dueBdayN = nextBusinessDay_(dueRawN);
        const dueTimeN =
          String(nextHour).padStart(2, "0") +
          ":" +
          String(nextMinute).padStart(2, "0");

        if (
          !activityExistsStrong_({
            dealId: deal.id,
            subject: subjectN,
            dueDateYmd: ymd_(dueBdayN),
            dueTime: dueTimeN,
          }) &&
          !activityExistsBySubjectType_({ dealId: deal.id, subject: subjectN })
        ) {
          createActivity_({
            deal,
            subject: subjectN,
            note: noteN,
            dueDate: dueBdayN,
            dueTime: dueTimeN,
            priority: priorityN,
          });
          created++;
        } else {
          skipped++;
        }
      }
    }
  });

  Logger.log(
    JSON.stringify({ ok: true, created, skipped, checked, date: ymd_(today) })
  );
}

/***********************
 *  FUNÇÃO DE TESTE
 ***********************/

function testarNegocio(id) {
  const TEST_DEAL_ID =
    PropertiesService.getScriptProperties().getProperty("TEST_DEAL_ID") ||
    "11176";
  const DEAL_ID = id || TEST_DEAL_ID;
  const today = tzToday_();

  Logger.log("=== TESTE DO NEGÓCIO %s ===", DEAL_ID);
  Logger.log("Data de hoje: %s\n", ymd_(today));

  Logger.log("🔍 Carregando configurações de filtro...");
  Logger.log(
    "👤 Usuário para ATIVIDADES: %s",
    FILTROS.USUARIO_ATIVIDADES_EMAIL
  );
  Logger.log("🗂️ Funil esperado: %s", FILTROS.FUNIL_NOME);
  Logger.log("📍 Etapa esperada: %s\n", FILTROS.ETAPA_NOME);

  const activitiesUserId = getActivitiesUserId_();
  if (!activitiesUserId) {
    Logger.log(
      "❌ Usuário não encontrado! Verifique USUARIO_ATIVIDADES_EMAIL."
    );
    return;
  }

  Logger.log("✅ Usuário encontrado: ID = %s\n", activitiesUserId);
  Logger.log("🔍 Carregando negócio %s...", DEAL_ID);

  const dealResp = pd_("/deals/" + DEAL_ID);
  if (!dealResp || !dealResp.data) {
    Logger.log("❌ Negócio %s não encontrado!", DEAL_ID);
    return;
  }

  const deal = dealResp.data;
  Logger.log("✅ Negócio carregado: %s", deal.title || "(sem título)");

  Logger.log("\n📊 Campos do negócio:");
  Logger.log(
    "  • Data término triagem: %s",
    deal[FIELD_KEYS.dataTerminoTriagem] || "(vazio)"
  );
  Logger.log(
    "  • Data término IPTU: %s",
    deal[FIELD_KEYS.dataTerminoIPTU] || "(vazio)"
  );
  Logger.log("  • Status IPTU: %s", deal[FIELD_KEYS.statusIPTU] || "(vazio)");
  Logger.log(
    "  • Responsabilidade: %s",
    deal[FIELD_KEYS.iptuResponsabilidade] || "(vazio)"
  );

  Logger.log("\n🔧 Status de referência:");
  Logger.log("  • INICIAR: %s", STATUS_IDS.IPTU.INICIAR);
  Logger.log("  • BOLETO_ENVIADO: %s", STATUS_IDS.IPTU.BOLETO_ENVIADO);
  Logger.log(
    "  • PENDENCIA_DOCUMENTAL: %s",
    STATUS_IDS.IPTU.PENDENCIA_DOCUMENTAL
  );
  Logger.log("  • ATESTE_RECEBIDO: %s", STATUS_IDS.IPTU.ATESTE_RECEBIDO);
  Logger.log("  • SOLICITAR_CND: %s", STATUS_IDS.IPTU.SOLICITAR_CND);
  Logger.log("  • CND_SALVA_DRIVE: %s", STATUS_IDS.IPTU.CND_SALVA_DRIVE);

  if (!isDealInCorrectStage_(deal)) {
    Logger.log(
      "\n❌ Negócio não está no funil/etapa corretos. Abortando teste."
    );
    return;
  }

  const plans = getPlansToCreate_(deal);
  Logger.log("\n📋 Planos identificados: %s", plans.join(", ") || "(nenhum)");

  if (plans.length === 0) {
    Logger.log("⊘ Nenhum plano aplicável. Verifique os campos do negócio.");
    return;
  }

  const baseDate = parseLocalDate_(deal[FIELD_KEYS.dataTerminoTriagem]);
  Logger.log("📅 Data base: %s", ymd_(baseDate));

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const planKey of plans) {
    const pl = PLAN[planKey];
    if (!pl) {
      Logger.log("❌ Plano %s não encontrado!", planKey);
      continue;
    }

    Logger.log("\n📋 Processando plano: %s", planKey);

    const dayConfigs = pl.days || [];
    Logger.log("  📅 Configurações: %s dias", dayConfigs.length);

    Logger.log("  📋 Criando atividades de backlog (vencidas):");

    dayConfigs.forEach((config) => {
      const d = config.day;
      const hour = config.hour;
      const minute = config.minute || 0;
      const dueTime =
        String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
      const s = pl.title(d);
      const n = pl.note(d);
      const p = getPriority_(planKey, d);
      const pValue = getPriorityValue_(p);
      const dueRaw = addDays_(baseDate, d);
      const dueBday = nextBusinessDay_(dueRaw);
      const dueY = ymd_(dueBday);

      if (dueBday <= today) {
        if (
          !activityExistsStrong_({
            dealId: DEAL_ID,
            subject: s,
            dueDateYmd: dueY,
            dueTime,
          }) &&
          !activityExistsBySubjectType_({ dealId: DEAL_ID, subject: s })
        ) {
          createActivity_({
            deal,
            subject: s,
            note: n,
            dueDate: dueBday,
            dueTime,
            priority: p,
          });
          Logger.log(
            "  ✔ Backlog: D+%s vence %s %s | %s | prio %s (ID=%s)",
            d,
            dueY,
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
      const nextMinute = nextConfig.minute || 0;
      const sN = pl.title(nextD);
      const nN = pl.note(nextD);
      const pN = getPriority_(planKey, nextD);
      const pValueN = getPriorityValue_(pN);
      const dueRawN = addDays_(baseDate, nextD);
      const dueBN = nextBusinessDay_(dueRawN);
      const dueYN = ymd_(dueBN);
      const dueTimeN =
        String(nextHour).padStart(2, "0") +
        ":" +
        String(nextMinute).padStart(2, "0");

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

    Logger.log("");
  }

  Logger.log("=== RESUMO ===");
  Logger.log("✅ Atividades criadas: %s", totalCreated);
  Logger.log("⊘ Atividades puladas: %s", totalSkipped);
  Logger.log("🎯 Total processado: %s", totalCreated + totalSkipped);
  Logger.log("\n=== FIM DO TESTE ===");
}

/***********************
 *  FUNÇÕES PARA WEBHOOK
 ***********************/

function processWebhookData(deal) {
  try {
    // 1. Verificar se o deal está no funil/etapa corretos
    if (!isDealInCorrectStage_(deal)) {
      return { ok: true, filtered: true, reason: "wrong_stage" };
    }

    // 2. Verificar campos obrigatórios
    const hasRequiredFields =
      deal[FIELD_KEYS.dataTerminoTriagem] &&
      !deal[FIELD_KEYS.dataTerminoIPTU] &&
      String(deal[FIELD_KEYS.statusIPTU] || "").trim() !==
        STATUS_IDS.IPTU.CND_SALVA_DRIVE;

    if (!hasRequiredFields) {
      return { ok: true, filtered: true, reason: "missing_fields" };
    }

    // 3. Determinar planos aplicáveis
    const plans = getPlansToCreate_(deal);
    if (plans.length === 0) {
      return { ok: true, filtered: true, reason: "no_plans" };
    }

    // 4. Processar atividades
    return processWebhookActivities_(deal, plans);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function processWebhookActivities_(deal, plans) {
  let created = 0;
  let skipped = 0;
  const createdActivities = [];
  const today = tzToday_();

  plans.forEach((planKey) => {
    const pl = PLAN[planKey];
    if (!pl) return;

    const baseDate = parseLocalDate_(deal[FIELD_KEYS.dataTerminoTriagem]);
    const dayConfigs = pl.days.slice();
    const isStatusChange = !planKey.includes("INICIAL");

    if (isStatusChange) {
      // Mudança de status: cria a partir de HOJE
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const minute = config.minute || 0;
        const subject = pl.title(d);
        const note = pl.note(d);
        const priority = getPriority_(planKey, d);
        const dueRaw = addDays_(today, d);
        const dueBday = nextBusinessDay_(dueRaw);
        const dueTime =
          String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");

        if (
          !activityExistsStrong_({
            dealId: deal.id,
            subject: subject,
            dueDateYmd: ymd_(dueBday),
            dueTime: dueTime,
          }) &&
          !activityExistsBySubjectType_({ dealId: deal.id, subject: subject })
        ) {
          createActivity_({
            deal,
            subject,
            note,
            dueDate: dueBday,
            dueTime,
            priority,
          });
          created++;
          createdActivities.push(`✓ ${subject}`);
        } else {
          skipped++;
        }
      });
    } else {
      // Inicialização: cria BACKLOG + PRÓXIMA

      // 1. BACKLOG
      dayConfigs.forEach((config) => {
        const d = config.day;
        const hour = config.hour;
        const minute = config.minute || 0;
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);

        if (dueBday <= today) {
          const subject = pl.title(d);
          const note = pl.note(d);
          const priority = getPriority_(planKey, d);
          const dueTime =
            String(hour).padStart(2, "0") +
            ":" +
            String(minute).padStart(2, "0");

          if (
            !activityExistsStrong_({
              dealId: deal.id,
              subject: subject,
              dueDateYmd: ymd_(dueBday),
              dueTime: dueTime,
            }) &&
            !activityExistsBySubjectType_({ dealId: deal.id, subject: subject })
          ) {
            createActivity_({
              deal,
              subject,
              note,
              dueDate: dueBday,
              dueTime,
              priority,
            });
            created++;
            createdActivities.push(`✓ ${subject}`);
          } else {
            skipped++;
          }
        }
      });

      // 2. PRÓXIMA
      const nextConfig = dayConfigs.find((cfg) => {
        const dueRaw = addDays_(baseDate, cfg.day);
        const dueBday = nextBusinessDay_(dueRaw);
        return dueBday > today;
      });

      if (nextConfig) {
        const d = nextConfig.day;
        const hour = nextConfig.hour;
        const minute = nextConfig.minute || 0;
        const subject = pl.title(d);
        const note = pl.note(d);
        const priority = getPriority_(planKey, d);
        const dueRaw = addDays_(baseDate, d);
        const dueBday = nextBusinessDay_(dueRaw);
        const dueTime =
          String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");

        if (
          !activityExistsStrong_({
            dealId: deal.id,
            subject: subject,
            dueDateYmd: ymd_(dueBday),
            dueTime: dueTime,
          }) &&
          !activityExistsBySubjectType_({ dealId: deal.id, subject: subject })
        ) {
          createActivity_({
            deal,
            subject,
            note,
            dueDate: dueBday,
            dueTime,
            priority,
          });
          created++;
          createdActivities.push(`✓ ${subject}`);
        } else {
          skipped++;
        }
      }
    }
  });

  return {
    ok: true,
    created,
    skipped,
    createdActivities,
  };
}
