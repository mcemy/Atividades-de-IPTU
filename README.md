# Automação de Atividades IPTU - Pipedrive

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Pipedrive](https://img.shields.io/badge/Pipedrive-00A86B?style=for-the-badge&logo=pipedrive&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-4.1.0-blue.svg?style=flat-square)](https://github.com/mcemy/Atividades-de-IPTU)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=flat-square)](https://github.com/mcemy/Atividades-de-IPTU/graphs/commit-activity)

Sistema automatizado para criação e gerenciamento de atividades relacionadas ao processo de IPTU no Pipedrive, desenvolvido em Google Apps Script.

> **Status**: ✅ Ativo | ✅ Finalizado | 🚀 Pronto para uso

## 📋 Sobre o Projeto

Este sistema automatiza a criação de atividades para acompanhamento do processo de obtenção de certidões de IPTU, organizando tarefas em cronogramas específicos baseados no status do negócio e responsabilidade pelo pagamento.

### Principais Funcionalidades

- **Automação de Atividades**: Criação automática de atividades baseadas em cronogramas pré-definidos
- **Gestão de Cronogramas**: Diferentes fluxos para CEF e Cliente final
- **Webhooks**: Processamento de eventos do Pipedrive em tempo real
- **Priorização Inteligente**: Classificação automática de prioridades das atividades
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
.
├── src/
│   ├── main.gs          # Lógica principal de automação
│   └── webhook.gs       # Manipulador de webhooks do Pipedrive
├── .env.example         # Exemplo de configuração de ambiente
├── .gitignore          # Arquivos ignorados pelo Git
├── SETUP.md            # Guia de configuração detalhado
└── README.md           # Documentação do projeto
```

## ⚙️ Configuração

### 1. Pré-requisitos

- Conta no Google (para Google Apps Script)
- Acesso ao Pipedrive com permissões de API
- Token de API do Pipedrive

### 2. Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example` e configure as seguintes variáveis:

```env
# API do Pipedrive
PIPEDRIVE_API_TOKEN=seu_token_aqui
PIPEDRIVE_BASE_URL=https://api.pipedrive.com/v1

# Configurações Gerais
TIMEZONE=America/Sao_Paulo
ACTIVITY_TYPE_KEY=escritura

# Google Sheets (para logs)
SHEET_ID=id_da_planilha_de_logs

# IDs dos Campos Personalizados (obtidos via API)
FIELD_DATA_TERMINO_TRIAGEM=campo_id
FIELD_DATA_TERMINO_IPTU=campo_id
FIELD_STATUS_IPTU=campo_id
FIELD_IPTU_RESPONSABILIDADE=campo_id
```

### 3. Instalação no Google Apps Script

1. Acesse [Google Apps Script](https://script.google.com/)
2. Crie um novo projeto
3. Copie o conteúdo dos arquivos `src/main.gs` e `src/webhook.gs`
4. Configure as propriedades do script com suas variáveis de ambiente
5. Configure os triggers necessários

### 4. Configuração de Propriedades do Script

No Google Apps Script, vá em **Configurações** > **Propriedades do Script** e adicione:

```
PIPEDRIVE_API_TOKEN: seu_token_do_pipedrive
PIPEDRIVE_BASE_URL: https://api.pipedrive.com/v1
TIMEZONE: America/Sao_Paulo
ACTIVITY_TYPE_KEY: escritura
SHEET_ID: id_da_sua_planilha_de_logs
```

## 🔧 Como Usar

### Execução Manual

Para testar o sistema com um negócio específico:

```javascript
// Execute no editor do Google Apps Script
testarNegocio(ID_DO_NEGOCIO);
```

### Execução Automática

Configure um trigger para executar a função `tick()` periodicamente:

1. No Google Apps Script, vá em **Triggers**
2. Crie um novo trigger
3. Selecione a função `tick`
4. Configure para executar a cada hora (ou conforme necessário)

### Webhook do Pipedrive

Para receber eventos em tempo real:

1. Deploy o script como Web App
2. Configure o webhook no Pipedrive apontando para a URL do Web App
3. Configure os eventos desejados (deal.updated, etc.)

## 📊 Fluxos de Trabalho

### IPTU - Responsabilidade CEF

1. **Dia 1**: Início do processo e tentativas virtuais
2. **Dia 2**: Confirmação de tentativas remotas
3. **Dia 4**: Verificação de necessidade de diligência
4. **Dia 6**: Confirmação de emissão
5. **Dia 7**: Envio da documentação
6. **Dia 9-11**: Alertas e acompanhamento

### IPTU - Responsabilidade Cliente

Similar ao fluxo CEF, mas com adaptações específicas para quando o cliente é responsável pelo pagamento.

### Status Específicos

- **Boleto Enviado**: Verificação de retorno
- **Pendência Documental**: Correção e reenvio
- **Ateste Recebido**: Emissão de CND
- **Solicitar CND**: Finalização do processo

## 🛠️ Manutenção

### Logs e Monitoramento

O sistema registra todas as operações em planilhas do Google Sheets:

- **WebhookLog**: Registros de webhooks recebidos
- **WebhookErrors**: Erros e exceções

### Troubleshooting

1. **Atividades não sendo criadas**: Verifique os logs de execução
2. **Webhooks não funcionando**: Confirme a URL do Web App
3. **Problemas de token**: Verifique validade do token do Pipedrive


## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:

- Abra uma [issue](https://github.com/mcemy/Atividades-de-IPTU/issues) no GitHub
- Consulte a documentação do [Pipedrive API](https://developers.pipedrive.com/docs/api/v1)
- Documentação do [Google Apps Script](https://developers.google.com/apps-script)

---

**Desenvolvido para otimizar processos de IPTU e melhorar a produtividade da equipe.**
