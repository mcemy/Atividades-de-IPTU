# Guia de Configuração - Pipedrive IPTU Automation

## 📋 Propriedades do Script (Google Apps Script)

Configure as seguintes propriedades em **Configurações** > **Propriedades do Script**:

### API e Configurações Base
```
PIPEDRIVE_API_TOKEN=seu_token_do_pipedrive
PIPEDRIVE_BASE_URL=https://api.pipedrive.com/v1
TIMEZONE=America/Sao_Paulo
ACTIVITY_TYPE_KEY=escritura
```

### Google Sheets (Logs)
```
SHEET_ID=id_da_planilha_de_logs
```

### IDs dos Campos Personalizados
> ⚠️ **Importante**: Obtenha estes IDs através da API do Pipedrive ou inspecionando os elementos na interface

```
FIELD_DATA_TERMINO_TRIAGEM=campo_id_data_termino_triagem
FIELD_DATA_TERMINO_IPTU=campo_id_data_termino_iptu
FIELD_STATUS_IPTU=campo_id_status_iptu
FIELD_IPTU_RESPONSABILIDADE=campo_id_responsabilidade
```

### IDs dos Status
```
STATUS_INICIAR=id_status_iniciar
STATUS_BOLETO_ENVIADO=id_status_boleto_enviado
STATUS_PENDENCIA_DOCUMENTAL=id_status_pendencia
STATUS_ATESTE_RECEBIDO=id_status_ateste
STATUS_SOLICITAR_CND=id_status_solicitar_cnd
STATUS_CND_SALVA_DRIVE=id_status_cnd_salva
```

### IDs de Responsabilidade
```
RESPONSABILIDADE_ARREMATANTE=id_responsabilidade_arrematante
RESPONSABILIDADE_CAIXA=id_responsabilidade_caixa
```

### Configurações do Webhook (Opcionais)
```
DEBOUNCE_SECONDS=15
GLOBAL_COOLDOWN_MINUTES=2
CACHE_LOCK_SECONDS=30
ALLOWED_DEAL_ID=id_do_deal_permitido_ou_vazio_para_todos
```

## 🔍 Como Obter os IDs dos Campos

### Método 1: API do Pipedrive
```javascript
// Execute no Google Apps Script para listar campos
function listarCampos() {
  const response = UrlFetchApp.fetch('https://api.pipedrive.com/v1/dealFields?api_token=SEU_TOKEN');
  const data = JSON.parse(response.getContentText());
  console.log(data);
}
```

### Método 2: Inspeção do Browser
1. Abra um negócio no Pipedrive
2. Clique com botão direito no campo desejado
3. Selecione "Inspecionar elemento"
4. Procure por atributos como `data-field-key` ou `name`

## 🚀 Deploy e Configuração

### 1. Deploy como Web App
1. No Google Apps Script, clique em **Deploy** > **New deployment**
2. Selecione tipo: **Web app**
3. Execute como: **Eu**
4. Quem tem acesso: **Qualquer pessoa**
5. Copie a URL do Web App

### 2. Configurar Webhook no Pipedrive
1. Vá em **Configurações** > **Webhooks** no Pipedrive
2. Adicione nova webhook
3. Cole a URL do Web App
4. Selecione eventos: `deal.updated`
5. Ative a webhook

### 3. Configurar Triggers (Opcional)
Para execução periódica da função `tick()`:
1. No Google Apps Script: **Triggers** > **Add Trigger**
2. Função: `tick`
3. Origem do evento: **Baseado no tempo**
4. Tipo: **Timer**
5. Intervalo: A cada hora

## 🔧 Testes e Validação

### Testar Webhook
Acesse a URL do Web App no browser - deve retornar status online.

### Testar Negócio Específico
```javascript
// Execute no Google Apps Script
testarNegocio(ID_DO_NEGOCIO);
```

### Logs
Verifique os logs nas abas:
- **WebhookLog**: Atividades do webhook
- **WebhookErrors**: Erros e exceções

## 🛠️ Troubleshooting

### Problemas Comuns
1. **Token inválido**: Verifique se o token do Pipedrive está correto
2. **Campos não encontrados**: Confirme os IDs dos campos personalizados
3. **Webhook não responde**: Verifique se a URL está correta e o deploy foi feito
4. **Atividades não sendo criadas**: Verifique os logs de erro e elegibilidade do negócio

### Comandos de Diagnóstico
```javascript
// Limpar locks de processamento
limparLocks();

// Limpar cache de atividades
limparCacheAtividades();
```