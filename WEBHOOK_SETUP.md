# Configuração do Webhook do Mercado Pago

Este guia explica como configurar a rota de notificações (webhook) do Mercado Pago no painel do desenvolvedor.

## 📍 URL do Webhook

A URL do webhook deve ser configurada como:

```
https://api.seudominio.com/api/payments/mp/webhook
```

**Importante**: Substitua `api.seudominio.com` pelo seu domínio real.

## 🔧 Passo a Passo para Configurar

### 1. Acessar o Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login com sua conta do Mercado Pago
3. Selecione sua aplicação (ou crie uma nova se necessário)

### 2. Configurar o Webhook

#### Opção A: Via Painel de Aplicações

1. No painel, vá em **"Suas integrações"** ou **"Aplicações"**
2. Clique na sua aplicação
3. Procure pela seção **"Webhooks"** ou **"Notificações IPN"**
4. Clique em **"Configurar webhooks"** ou **"Adicionar URL"**
5. Cole a URL: `https://api.seudominio.com/api/payments/mp/webhook`
6. Selecione os eventos que deseja receber:
   - ✅ **Pagamentos** (payment)
   - ✅ **Preferências** (opcional)
7. Clique em **"Salvar"** ou **"Confirmar"**

#### Opção B: Via API (Alternativa)

Você também pode configurar via API usando o Access Token:

```bash
curl -X POST "https://api.mercadopago.com/v1/webhooks" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.seudominio.com/api/payments/mp/webhook",
    "events": ["payment"]
  }'
```

### 3. Verificar a Configuração

Após configurar, você pode testar se o webhook está funcionando:

#### Teste 1: Verificar Status do Webhook

```bash
GET https://api.seudominio.com/api/payments/mp/webhook
```

Resposta esperada:
```json
{
  "status": "ok",
  "message": "Webhook do Mercado Pago está ativo",
  "webhook_url": "https://api.seudominio.com/api/payments/mp/webhook",
  "instructions": { ... }
}
```

#### Teste 2: Criar um Pagamento de Teste

1. Crie uma preferência de pagamento
2. Realize um pagamento de teste
3. Verifique os logs do servidor para ver se a notificação foi recebida

### 4. Configurar Variável de Ambiente

Certifique-se de que a variável de ambiente está configurada:

```env
MP_WEBHOOK_URL=https://api.seudominio.com/api/payments/mp/webhook
```

## 🔍 Monitoramento

### Logs do Servidor

O webhook agora registra logs detalhados. Procure por:

```
=== Webhook MP Recebido ===
=== Webhook Processado com Sucesso ===
```

### Verificar Notificações Recebidas

Os logs incluem:
- Tipo de notificação
- ID do pagamento
- Status do pagamento
- Tempo de processamento
- Erros (se houver)

## ⚠️ Requisitos Importantes

### 1. HTTPS Obrigatório

O Mercado Pago **só aceita URLs HTTPS** para webhooks. Certifique-se de que:
- Seu servidor tem certificado SSL válido
- A URL começa com `https://`
- O certificado não está expirado

### 2. URL Pública

A URL do webhook deve ser acessível publicamente. Não pode ser:
- `localhost`
- `127.0.0.1`
- IP privado
- URL com autenticação básica

### 3. Resposta Rápida

O webhook deve responder em até **30 segundos**. Caso contrário, o Mercado Pago pode considerar como falha.

### 4. Código de Status HTTP

O webhook deve retornar:
- **200 OK**: Notificação processada com sucesso
- **200 OK** (mesmo com erros): Para evitar retentativas desnecessárias

## 🧪 Testando em Desenvolvimento

Para testar localmente, você pode usar:

### Opção 1: ngrok

```bash
# Instalar ngrok
npm install -g ngrok

# Criar túnel
ngrok http 4001

# Usar a URL fornecida pelo ngrok
# Exemplo: https://abc123.ngrok.io/api/payments/mp/webhook
```

### Opção 2: Cloudflare Tunnel

```bash
# Usar cloudflared (já incluído no projeto)
cloudflared tunnel --url http://localhost:4001
```

## 📊 Eventos Suportados

Atualmente, o webhook processa:

- ✅ **payment**: Notificações de pagamento
  - `payment.created`
  - `payment.updated`
  - `payment.approved`
  - `payment.rejected`
  - etc.

## 🔐 Segurança

### Validação de Origem (Recomendado)

Para maior segurança, você pode validar se a notificação realmente veio do Mercado Pago:

1. Verificar o header `x-signature` (se configurado)
2. Validar o IP de origem (ranges do Mercado Pago)
3. Verificar o token de autenticação

**Nota**: O código atual confia na validação via API do Mercado Pago (buscar dados do pagamento).

## 🐛 Troubleshooting

### Webhook não está recebendo notificações

1. ✅ Verifique se a URL está configurada corretamente no painel
2. ✅ Verifique se a URL é HTTPS
3. ✅ Verifique se o servidor está acessível publicamente
4. ✅ Verifique os logs do servidor
5. ✅ Teste a URL manualmente: `GET /api/payments/mp/webhook`

### Erro 404 ao receber notificação

- Verifique se a rota está correta: `/api/payments/mp/webhook`
- Verifique se o servidor está rodando
- Verifique se há algum proxy/load balancer bloqueando

### Notificações duplicadas

- O Mercado Pago pode enviar múltiplas notificações para o mesmo evento
- O código já trata isso atualizando registros existentes
- Verifique os logs para confirmar

### Timeout

- Verifique se o processamento está demorando muito
- Otimize consultas ao banco de dados
- Considere processar notificações de forma assíncrona

## 📝 Exemplo de Notificação

O Mercado Pago envia notificações no seguinte formato:

```json
{
  "type": "payment",
  "data": {
    "id": "123456789"
  },
  "action": "payment.updated",
  "date_created": "2024-01-01T00:00:00.000Z"
}
```

O webhook então busca os dados completos do pagamento na API do Mercado Pago.

## 🔗 Links Úteis

- [Documentação de Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Painel de Desenvolvedores](https://www.mercadopago.com.br/developers/panel)
- [API de Pagamentos](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get)

## ✅ Checklist de Configuração

- [ ] URL do webhook configurada no painel do Mercado Pago
- [ ] URL é HTTPS e acessível publicamente
- [ ] Variável `MP_WEBHOOK_URL` configurada no servidor
- [ ] Teste manual da rota GET `/api/payments/mp/webhook` funcionando
- [ ] Logs do servidor configurados para monitorar notificações
- [ ] Certificado SSL válido no servidor
- [ ] Teste de pagamento realizado e notificação recebida

