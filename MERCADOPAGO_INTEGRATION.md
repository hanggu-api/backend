# Integração Mercado Pago - Documentação

Esta documentação descreve a integração do Mercado Pago no projeto AppMissao Backend.

## Configuração

### Variáveis de Ambiente

As seguintes variáveis de ambiente são necessárias:

```env
MP_ACCESS_TOKEN=APP_USR-7034531044731441-121009-293b90e1c6ea8a8473b79d4efbc2c45f-2535373119
MP_WEBHOOK_URL=https://api.seudominio.com/api/payments/mp/webhook
MP_SPONSOR_ID= (opcional)
BASE_URL=https://cardapyia.com/
PAYMENT_DEPOSIT_PERCENT=30
PAYMENT_SECOND_PERCENT=75
```

### Token do Mercado Pago

O token está configurado no arquivo `ecosystem.config.js` e deve ser obtido em:
- **Produção**: https://www.mercadopago.com.br/developers/panel/credentials
- **Teste**: Use o token de teste para desenvolvimento

## Endpoints da API

### 1. Criar Preferência de Pagamento

**POST** `/api/missions/:id/payments/preference`

Cria uma preferência de pagamento para uma missão específica.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{
  "kind": "deposit" | "remainder" | "full"
}
```

**Resposta:**
```json
{
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...",
  "preference_id": "123456789-abc-def-ghi"
}
```

**Tipos de pagamento:**
- `deposit`: Pagamento de entrada (30% por padrão)
- `remainder`: Pagamento restante (75% por padrão)
- `full`: Pagamento completo (100%)

### 2. Listar Pagamentos de uma Missão

**GET** `/api/missions/:id/payments`

Lista todos os pagamentos de uma missão específica.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Resposta:**
```json
{
  "items": [
    {
      "id": 1,
      "mission_id": 123,
      "status": "approved",
      "amount": 100.00,
      "currency": "BRL",
      "mp_payment_id": "123456789",
      "mp_preference_id": "987654321",
      "external_ref": "mission:123:deposit",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Webhook do Mercado Pago

**POST** `/api/payments/mp/webhook`

Endpoint para receber notificações do Mercado Pago sobre mudanças de status de pagamento.

**Configuração no Mercado Pago:**
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Configure a URL do webhook: `https://api.seudominio.com/api/payments/mp/webhook`
3. O webhook será chamado automaticamente quando houver mudanças no pagamento

**Comportamento:**
- Atualiza o status do pagamento no banco de dados
- Se o pagamento for aprovado, atualiza o status da missão para `in_progress`
- Envia notificações via WebSocket para clientes conectados

## Status de Pagamento

Os seguintes status são suportados:

- `pending`: Pagamento pendente
- `approved`: Pagamento aprovado
- `authorized`: Pagamento autorizado
- `in_process`: Pagamento em processo
- `in_mediation`: Pagamento em mediação
- `rejected`: Pagamento rejeitado
- `cancelled`: Pagamento cancelado
- `refunded`: Pagamento reembolsado
- `charged_back`: Pagamento estornado

## Fluxo de Pagamento

1. **Criação da Missão**: Quando uma missão é criada com orçamento, um pagamento de entrada é criado automaticamente (se configurado)

2. **Criação de Preferência**: O cliente cria uma preferência de pagamento através do endpoint `/api/missions/:id/payments/preference`

3. **Redirecionamento**: O cliente é redirecionado para o checkout do Mercado Pago usando o `init_point` retornado

4. **Pagamento**: O cliente realiza o pagamento no checkout do Mercado Pago

5. **Webhook**: O Mercado Pago envia uma notificação para o webhook quando o status muda

6. **Atualização**: O sistema atualiza o status do pagamento e da missão automaticamente

## Funções Auxiliares

### `getMP()`
Retorna a instância do SDK v1 do Mercado Pago configurada.

### `getMPClient()`
Retorna a instância do SDK v2 do Mercado Pago (MercadoPagoConfig).

### `createMpPreferenceForAmount({ mission, amount, kind, userEmail })`
Cria uma preferência de pagamento no Mercado Pago.

**Parâmetros:**
- `mission`: Objeto da missão
- `amount`: Valor do pagamento
- `kind`: Tipo de pagamento (deposit, remainder, full)
- `userEmail`: Email do pagador

**Retorna:**
```javascript
{
  id: "preference_id",
  init_point: "https://...",
  currency: "BRL",
  external_ref: "mission:123:deposit"
}
```

## Tratamento de Erros

A integração inclui tratamento robusto de erros:

- **Token não configurado**: Retorna erro 503
- **Pagamento não encontrado**: Retorna erro 404
- **Erros da API do MP**: Loga detalhes e retorna mensagem amigável
- **Webhook**: Sempre retorna 200 para evitar retentativas desnecessárias

## Segurança

- ✅ Tokens nunca são expostos em logs
- ✅ Validação de permissões em todos os endpoints
- ✅ Webhook processa apenas notificações válidas
- ✅ Referências externas validadas antes de processar

## Testes

Para testar a integração:

1. Use o token de teste do Mercado Pago
2. Configure o webhook para um serviço como ngrok em desenvolvimento
3. Use cartões de teste do Mercado Pago:
   - Aprovado: 5031 4332 1540 6351
   - Rejeitado: 5031 4332 1540 6351 (CVV: 123)

## Troubleshooting

### Webhook não está sendo chamado
- Verifique se a URL está configurada corretamente no painel do Mercado Pago
- Certifique-se de que a URL é HTTPS (obrigatório)
- Verifique os logs do servidor

### Pagamento não atualiza o status
- Verifique se o webhook está recebendo as notificações
- Verifique os logs para erros
- Consulte o pagamento diretamente usando a API do Mercado Pago

### Erro "mp-unavailable"
- Verifique se `MP_ACCESS_TOKEN` está configurado
- Verifique se o token é válido
- Verifique a conexão com a API do Mercado Pago

## Referências

- [Documentação Oficial do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs)
- [SDK Node.js do Mercado Pago](https://github.com/mercadopago/sdk-nodejs)
- [API de Pagamentos](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get)

