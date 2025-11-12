# 🏠 Atividades de IPTU - Sistema Automatizado

> **Status**: ✅ Ativo | ✅ Finalizado | 🚀 Pronto para uso

Sistema automatizado para criação e gerenciamento de atividades relacionadas ao processo de IPTU no Pipedrive, desenvolvido em Google Apps Script.

## 📋 Sobre o Projeto

Este sistema automatiza a criação de atividades para acompanhamento do processo de obtenção de certidões de IPTU, organizando tarefas em cronogramas específicos baseados no status do negócio e responsabilidade pelo pagamento.

### Principais Funcionalidades

- **Automação de Atividades**: Criação automática de atividades baseadas em cronogramas pré-definidos
- **Gestão de Cronogramas**: Diferentes fluxos para CEF e Cliente final
- **Webhooks**: Processamento de eventos do Pipedrive em tempo real
- **Priorização Inteligente**: Classificação automática de prioridades das atividades
- **Webhook Integrado**: Responde automaticamente a mudanças nos negócios
- **Filtros Inteligentes**: Processa apenas negócios em funis/etapas específicas
- **Horários Padronizados**: Todas as atividades vencem às **23:59 (horário local)**
- **Anti-duplicação**: Evita criação de atividades duplicatas
- **Backlog Automático**: Cria atividades vencidas quando necessário
- **Controle de Duplicatas**: Prevenção de criação de atividades duplicadas com sistema de cache 3 camadas
- **Atribuição Específica**: Atividades sempre criadas para usuário específico (configurável)
- **Filtro por Funil/Etapa**: Processa apenas deals no funil e etapa corretos
- **Modo Teste**: Suporte para testes com deal específico
- **Logs Detalhados**: Sistema de logging para auditoria e troubleshooting

## 🚀 Tecnologias Utilizadas

- **Google Apps Script (GAS)**: Plataforma de desenvolvimento
- **Pipedrive API**: Integração com CRM
- **Google Sheets**: Logging e auditoria
- **JavaScript**: Linguagem de programação

## 📁 Estrutura do Projeto

```
Atividades-de-IPTU/
├── src/
│   ├── main.gs          # Lógica principal (30 funções) - 39KB
│   └── webhook.gs       # Handlers HTTP e logging (7 funções) - 6KB
├── README.md            # Este arquivo - 8KB
└── SETUP.md            # Instruções de configuração - 4KB
```

### **main.gs** - Business Logic

Contém toda a lógica de negócio do sistema:

- Processamento de deals e criação de atividades
- Cronogramas específicos (CEF vs Cliente)
- Integração com API do Pipedrive
- Validações e verificações de duplicatas
- Funções utilitárias de data e timezone

### **webhook.gs** - HTTP Handlers

Apenas handlers básicos e funções de suporte:

- `doPost()` e `doGet()` para webhooks
- Logging para Google Sheets
- Cache management
- Debug e error handling

## ⏰ Configuração de Horários

**IMPORTANTE**: Todas as atividades foram padronizadas para vencer às **02:59 UTC** (equivale a 23:59 no fuso horário brasileiro UTC-3).

```javascript
// Configuração em todos os PLANs
time: "02:59"; // 23:59 horário local (Brasília)
```

## 🔧 Configuração

### Variáveis de Ambiente

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

### Configuração de Webhook

1. Configure o webhook no Pipedrive para apontar para a URL do Google Apps Script
2. Selecione os eventos: `deal.updated`
3. O sistema filtrará automaticamente pelos campos configurados

## 📊 Cronogramas de Atividades

### IPTU CEF (Responsabilidade: Caixa Econômica)

**Status: Iniciar**

- Dia 1: Ligar solicitando os documentos (Prioridade: 3)
- Dia 2: Segunda ligação solicitando os documentos (Prioridade: 3)
- Dia 3: Terceira ligação solicitando os documentos (Prioridade: 3)
- Dia 4: Quarta ligação solicitando os documentos (Prioridade: 2)
- Dia 5: Quinta ligação solicitando os documentos (Prioridade: 1)

**Status: Boleto Enviado**

- Dia 1: Ligar informando o boleto para pagamento (Prioridade: 3)
- Dia 2: Segunda ligação informando o boleto para pagamento (Prioridade: 2)
- Dia 3: Terceira ligação informando o boleto para pagamento (Prioridade: 1)

**Status: Solicitar CND**

- Dia 1: Ligar solicitando a CND (Prioridade: 3)
- Dia 2: Segunda ligação solicitando a CND (Prioridade: 2)
- Dia 3: Terceira ligação solicitando a CND (Prioridade: 1)

**Status: Pendência Documental**

- Dia 1: Ligar para resolver pendência (Prioridade: 1)

**Status: Ateste Recebido**

- Dia 1: Ligar agradecendo o ateste (Prioridade: 3)

### IPTU Cliente (Responsabilidade: Arrematante)

**Status: Iniciar**

- Dia 1: Ligar solicitando os documentos (Prioridade: 3)
- Dia 5: Quinta ligação solicitando os documentos (Prioridade: 1)

**Status: Boleto Enviado**

- Dia 1: Ligar informando o boleto para pagamento (Prioridade: 3)
- Dia 3: Terceira ligação informando o boleto para pagamento (Prioridade: 1)

**Status: Solicitar CND**

- Dia 1: Ligar solicitando a CND (Prioridade: 3)
- Dia 3: Terceira ligação solicitando a CND (Prioridade: 1)

## 🔄 Webhook - Eventos Processados

O sistema responde aos seguintes eventos do Pipedrive:

### Mudanças de Status

- **Iniciar** → Cria cronograma inicial
- **Boleto Enviado** → Cria cronograma de cobrança
- **Solicitar CND** → Cria cronograma de solicitação
- **Pendência Documental** → Cria atividade de resolução
- **Ateste Recebido** → Cria atividade de agradecimento

### Mudanças de Responsabilidade

- **CEF ↔ Cliente** → Remove atividades incompatíveis e cria novas

### Filtros Aplicados

- **Funil**: "pos arrematação"
- **Etapa**: "contrato"
- **Campos obrigatórios**: Data de término da triagem preenchida

## 📈 Funcionalidades Avançadas

### Anti-duplicação

- Verificação por fingerprint (dealId + subject normalizado)
- Cache em memória e persistente
- Detecção inteligente de atividades similares

### Processamento de Backlog

- Criação de atividades vencidas quando necessário
- Próximo dia útil para datas de vencimento
- Respeito a finais de semana e feriados

### Logging Inteligente

- **WebhookLog**: Registros de sucesso
- **WebhookErrors**: Erros de processamento
- **WebhookDebug**: Informações detalhadas
- Rotação automática de logs (limites configuráveis)

## 🔧 Funções Principais

### main.gs - Funções Essenciais

```javascript
tick(); // Processamento manual/cronometrado
testarNegocio(id); // Teste de um negócio específico
processWebhookData(e); // Processamento de webhooks
createActivity_(); // Criação de atividades
getPlansToCreate_(); // Determinação de cronogramas
```

### webhook.gs - Funções de Suporte

```javascript
doPost(e); // Handler principal de webhook
webhookLog_(); // Logging de sucessos
webhookError_(); // Logging de erros
webhookDebug_(); // Logging de debug
clearWebhookCache(); // Limpeza de cache
```

## 🎯 Melhorias Implementadas na v2.0

### ✅ Concluídas

- [x] **Padronização de Horários**: Todas as atividades às 02:59 UTC (23:59 local)
- [x] **Remoção de Duplicatas**: Código completamente limpo
- [x] **Arquitetura Modular**: main.gs (business) + webhook.gs (handlers)
- [x] **Documentação Atualizada**: README completo com nova estrutura
- [x] **Backup Seguro**: Preservação do código original

### 🏆 Resultados

- **Redução de Código**: 72KB → 45KB total (37% menor)
- **Arquivos Limpos**: Apenas 2 arquivos principais (main.gs + webhook.gs)
- **Funções Organizadas**: 30 em main.gs + 7 em webhook.gs
- **Performance**: Eliminação de códigos duplicados
- **Manutenibilidade**: Separação clara de responsabilidades

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique os logs na planilha configurada
2. Use as funções de debug disponíveis
3. Consulte a documentação de configuração (SETUP.md)

---

**Versão**: 2.0 | **Última atualização**: Novembro 2025
