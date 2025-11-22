# 🏠 Atividades de IPTU - Sistema Automatizado

<div align="center">

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Pipedrive](https://img.shields.io/badge/Pipedrive-FF6B35?style=for-the-badge&logo=pipedrive&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)

[![Status](https://img.shields.io/badge/Status-✅%20Ativo-brightgreen?style=flat-square)](https://github.com/mcemy/Atividades-de-IPTU)
[![Version](https://img.shields.io/badge/Version-2.0-blue?style=flat-square)](https://github.com/mcemy/Atividades-de-IPTU/releases)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained-Yes-green?style=flat-square)](https://github.com/mcemy/Atividades-de-IPTU/graphs/commit-activity)

</div>

---

## 🎯 **Sobre o Projeto**

Sistema automatizado para **criação e gerenciamento de atividades** relacionadas ao processo de IPTU no Pipedrive, desenvolvido em **Google Apps Script**. Organiza tarefas em cronogramas específicos baseados no status do negócio e responsabilidade pelo pagamento.

### ✨ **Principais Funcionalidades**

<table>
<tr>
<td>🤖</td>
<td><strong>Automação Completa</strong><br/>Criação automática de atividades baseadas em cronogramas pré-definidos</td>
</tr>
<tr>
<td>📊</td>
<td><strong>Gestão de Cronogramas</strong><br/>Diferentes fluxos para CEF e Cliente final com priorização inteligente</td>
</tr>
<tr>
<td>🔗</td>
<td><strong>Webhook Integrado</strong><br/>Resposta automática a mudanças nos negócios em tempo real</td>
</tr>
<tr>
<td>🎯</td>
<td><strong>Filtros Inteligentes</strong><br/>Processa apenas negócios em funis/etapas específicas</td>
</tr>
<tr>
<td>⏰</td>
<td><strong>Horários Padronizados</strong><br/>Todas as atividades vencem às <strong>23:59 (horário local)</strong></td>
</tr>
<tr>
<td>🛡️</td>
<td><strong>Anti-duplicação Avançada</strong><br/>Sistema de cache 3 camadas para evitar atividades duplicatas</td>
</tr>
<tr>
<td>📝</td>
<td><strong>Logs Detalhados</strong><br/>Sistema completo de logging para auditoria e troubleshooting</td>
</tr>
<tr>
<td>🔄</td>
<td><strong>Backlog Automático</strong><br/>Cria atividades vencidas quando necessário</td>
</tr>
</table>

---

## 📁 **Estrutura do Projeto**

```
📦 Atividades-de-IPTU/
├── 🗂️ src/
│   ├── 🏗️ main.gs          # Business Logic (30 funções) - 39KB
│   └── 🌐 webhook.gs       # HTTP Handlers & Logging (7 funções) - 6KB
├── 📖 README.md            # Documentação - 8KB
└── ⚙️ SETUP.md            # Guia de Configuração - 4KB
```

<details>
<summary><strong>🏗️ main.gs - Business Logic</strong></summary>

- ✅ Processamento de deals e criação de atividades
- ✅ Cronogramas específicos (CEF vs Cliente)
- ✅ Integração com API do Pipedrive
- ✅ Validações e verificações de duplicatas
- ✅ Funções utilitárias de data e timezone

</details>

<details>
<summary><strong>🌐 webhook.gs - HTTP Handlers</strong></summary>

- ✅ `doPost()` e `doGet()` para webhooks
- ✅ Logging para Google Sheets
- ✅ Cache management
- ✅ Debug e error handling

</details>

---

## ⚡ **Performance & Otimizações**

<div align="center">

|      Métrica      |   Antes    |  Depois   |      Melhoria      |
| :---------------: | :--------: | :-------: | :----------------: |
| **Tamanho Total** |    72KB    |   45KB    |     **🔽 37%**     |
|   **Arquivos**    |     4      |     2     |     **🔽 50%**     |
|    **Funções**    | Duplicadas | 37 únicas | **✅ Organizadas** |
|  **Duplicações**  |   Muitas   |   Zero    |   **✅ Limpas**    |

</div>

---

## 🚀 **Tecnologias Utilizadas**

<div align="center">

|                                                  Tecnologia                                                  |         Uso          | Versão  |
| :----------------------------------------------------------------------------------------------------------: | :------------------: | :-----: |
|  ![GAS](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=flat&logo=google&logoColor=white)   | Plataforma Principal | Latest  |
| ![Pipedrive](https://img.shields.io/badge/Pipedrive%20API-FF6B35?style=flat&logo=pipedrive&logoColor=white)  |    Integração CRM    |   v1    |
| ![Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=flat&logo=google-sheets&logoColor=white) | Logging & Auditoria  | Latest  |
|       ![JS](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)       |      Linguagem       | ES2020+ |

</div>

---

## ⚙️ **Configuração Rápida**

### 📋 **Variáveis de Ambiente**

```javascript
// Google Apps Script Properties
PIPEDRIVE_TOKEN = "seu_token_aqui";
TIMEZONE = "America/Sao_Paulo";
USUARIO_ATIVIDADES_EMAIL = "seu_email@dominio.com";
FUNIL_NOME = "pos arrematação";
ETAPA_NOME = "contrato";
SHEET_ID = "id_da_planilha_logs";
TEST_DEAL_ID = "id_deal_teste"; // opcional
```

### 🔗 **Configuração de Webhook**

1. **Configure** o webhook no Pipedrive para apontar para a URL do Google Apps Script
2. **Selecione** os eventos: `deal.updated`
3. **O sistema** filtrará automaticamente pelos campos configurados

---

## ⏰ **Configuração de Horários**

> **⚠️ IMPORTANTE**: Todas as atividades foram padronizadas para vencer às **02:59 UTC** (equivale a 23:59 no fuso horário brasileiro UTC-3).

```javascript
// Configuração em todos os PLANs
time: "02:59"; // 🕚 23:59 horário local (Brasília)
```

---

## 📊 **Cronogramas de Atividades**

### 🏦 **IPTU CEF** (Responsabilidade: Caixa Econômica)

<details>
<summary><strong>📋 Status: Iniciar</strong></summary>

- **Dia 1**: Ligar solicitando os documentos (Prioridade: 3)
- **Dia 2**: Segunda ligação solicitando os documentos (Prioridade: 3)
- **Dia 3**: Terceira ligação solicitando os documentos (Prioridade: 3)
- **Dia 4**: Quarta ligação solicitando os documentos (Prioridade: 2)
- **Dia 5**: Quinta ligação solicitando os documentos (Prioridade: 1)

</details>

<details>
<summary><strong>💰 Status: Boleto Enviado</strong></summary>

- **Dia 1**: Ligar informando o boleto para pagamento (Prioridade: 3)
- **Dia 2**: Segunda ligação informando o boleto para pagamento (Prioridade: 2)
- **Dia 3**: Terceira ligação informando o boleto para pagamento (Prioridade: 1)

</details>

<details>
<summary><strong>📄 Status: Solicitar CND</strong></summary>

- **Dia 1**: Ligar solicitando a CND (Prioridade: 3)
- **Dia 2**: Segunda ligação solicitando a CND (Prioridade: 2)
- **Dia 3**: Terceira ligação solicitando a CND (Prioridade: 1)

</details>

<details>
<summary><strong>⚠️ Outros Status</strong></summary>

- **Pendência Documental**: Dia 1 - Ligar para resolver pendência (Prioridade: 1)
- **Ateste Recebido**: Dia 1 - Ligar agradecendo o ateste (Prioridade: 3)

</details>

### 👤 **IPTU Cliente** (Responsabilidade: Arrematante)

<details>
<summary><strong>📋 Status: Iniciar</strong></summary>

- **Dia 1**: Ligar solicitando os documentos (Prioridade: 3)
- **Dia 5**: Quinta ligação solicitando os documentos (Prioridade: 1)

</details>

<details>
<summary><strong>💰 Status: Boleto Enviado</strong></summary>

- **Dia 1**: Ligar informando o boleto para pagamento (Prioridade: 3)
- **Dia 3**: Terceira ligação informando o boleto para pagamento (Prioridade: 1)

</details>

<details>
<summary><strong>📄 Status: Solicitar CND</strong></summary>

- **Dia 1**: Ligar solicitando a CND (Prioridade: 3)
- **Dia 3**: Terceira ligação solicitando a CND (Prioridade: 1)

</details>

---

## 🔄 **Webhook - Eventos Processados**

### 📈 **Mudanças de Status**

- **Iniciar** → Cria cronograma inicial
- **Boleto Enviado** → Cria cronograma de cobrança
- **Solicitar CND** → Cria cronograma de solicitação
- **Pendência Documental** → Cria atividade de resolução
- **Ateste Recebido** → Cria atividade de agradecimento

### 🔄 **Mudanças de Responsabilidade**

- **CEF ↔ Cliente** → Remove atividades incompatíveis e cria novas

### 🎯 **Filtros Aplicados**

- **Funil**: "pos arrematação"
- **Etapa**: "contrato"
- **Campos obrigatórios**: Data de término da triagem preenchida

---

## 🛠️ **Funcionalidades Avançadas**

### 🛡️ **Sistema Anti-duplicação**

- ✅ Verificação por fingerprint (dealId + subject normalizado)
- ✅ Cache em memória e persistente
- ✅ Detecção inteligente de atividades similares

### 📅 **Processamento de Backlog**

- ✅ Criação de atividades vencidas quando necessário
- ✅ Próximo dia útil para datas de vencimento
- ✅ Respeito a finais de semana e feriados

### 📊 **Logging Inteligente**

- **WebhookLog**: Registros de sucesso
- **WebhookErrors**: Erros de processamento
- **WebhookDebug**: Informações detalhadas
- **Rotação automática** de logs (limites configuráveis)

---

## 🚀 **Como Usar**

### 🔧 **Funções Principais**

```javascript
// main.gs - Funções Essenciais
tick(); // Processamento manual/cronometrado
testarNegocio(id); // Teste de um negócio específico
processWebhookData(e); // Processamento de webhooks
createActivity_(); // Criação de atividades
getPlansToCreate_(); // Determinação de cronogramas
```

```javascript
// webhook.gs - Funções de Suporte
doPost(e); // Handler principal de webhook
webhookLog_(); // Logging de sucessos
webhookError_(); // Logging de erros
webhookDebug_(); // Logging de debug
clearWebhookCache(); // Limpeza de cache
```

---

## 🎉 **Melhorias v2.0**

<div align="center">

### ✅ **Concluídas**

![Concluído](https://img.shields.io/badge/✅-Padronização%20de%20Horários-brightgreen?style=flat-square)
![Concluído](https://img.shields.io/badge/✅-Remoção%20de%20Duplicatas-brightgreen?style=flat-square)
![Concluído](https://img.shields.io/badge/✅-Arquitetura%20Modular-brightgreen?style=flat-square)
![Concluído](https://img.shields.io/badge/✅-Documentação%20Atualizada-brightgreen?style=flat-square)
![Concluído](https://img.shields.io/badge/✅-Backup%20Seguro-brightgreen?style=flat-square)

### 🏆 **Resultados**

|        Melhoria         |              Resultado               |
| :---------------------: | :----------------------------------: |
|  **Redução de Código**  |       72KB → 45KB (37% menor)        |
|   **Arquivos Limpos**   |      4 → 2 arquivos principais       |
| **Funções Organizadas** |   30 em main.gs + 7 em webhook.gs    |
|     **Performance**     |   Eliminação de códigos duplicados   |
|  **Manutenibilidade**   | Separação clara de responsabilidades |

</div>

---

## 📞 **Suporte & Contribuição**

<div align="center">

[![Issues](https://img.shields.io/github/issues/mcemy/Atividades-de-IPTU?style=for-the-badge)](https://github.com/mcemy/Atividades-de-IPTU/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/mcemy/Atividades-de-IPTU?style=for-the-badge)](https://github.com/mcemy/Atividades-de-IPTU/pulls)
[![Contributors](https://img.shields.io/github/contributors/mcemy/Atividades-de-IPTU?style=for-the-badge)](https://github.com/mcemy/Atividades-de-IPTU/graphs/contributors)

</div>

### 🆘 **Para dúvidas ou problemas:**

1. 📋 Verifique os logs na planilha configurada
2. 🔍 Use as funções de debug disponíveis
3. 📖 Consulte a documentação de configuração (SETUP.md)
4. 🐛 Abra uma [issue](https://github.com/mcemy/Atividades-de-IPTU/issues) se necessário

---

<div align="center">

### 🏷️ **Versão 2.0** | 📅 **Novembro 2025**

[![Feito com Google Apps Script](https://img.shields.io/badge/Feito%20com-Google%20Apps%20Script-4285F4?style=flat-square&logo=google)](https://script.google.com/)
[![Powered by Pipedrive](https://img.shields.io/badge/Powered%20by-Pipedrive-FF6B35?style=flat-square&logo=pipedrive)](https://www.pipedrive.com/)

</div>
