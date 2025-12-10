# Como Resolver Erro 401 - Token do Mercado Pago

## 🔴 Problema

Erro `401 - unauthorized` com mensagem "Must provide your access_token to proceed"

Isso indica que o token do Mercado Pago não está sendo enviado corretamente ou está inválido.

## ✅ Soluções

### 1. Verificar se o Token Está Configurado

Acesse a rota de status para verificar:

```bash
GET https://api.seudominio.com/api/payments/mp/status
```

Isso retornará:
- Se o token está configurado
- Se o token é válido
- Tipo do token (test/production)
- Recomendações

### 2. Verificar a Variável de Ambiente

O token deve estar configurado na variável `MP_ACCESS_TOKEN`:

#### No arquivo `.env`:
```env
MP_ACCESS_TOKEN=APP_USR-7034531044731441-121009-293b90e1c6ea8a8473b79d4efbc2c45f-2535373119
```

#### No `ecosystem.config.js` (PM2):
```javascript
env: {
  MP_ACCESS_TOKEN: 'APP_USR-7034531044731441-121009-293b90e1c6ea8a8473b79d4efbc2c45f-2535373119'
}
```

### 3. Obter um Token Válido

1. Acesse: https://www.mercadopago.com.br/developers/panel/credentials
2. Faça login com sua conta
3. Selecione sua aplicação
4. Copie o **Access Token** (Production ou Test)
5. Cole no arquivo de configuração

### 4. Verificar se o Token Está Correto

O token deve começar com:
- **Produção**: `APP_USR-`
- **Teste**: `TEST-`

**⚠️ IMPORTANTE**: Não use tokens de exemplo como `APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 5. Reiniciar o Servidor

Após atualizar o token, **sempre reinicie o servidor**:

```bash
# Se estiver usando PM2
pm2 restart appmissao-backend

# Ou se estiver rodando diretamente
# Pare o servidor (Ctrl+C) e inicie novamente
npm start
```

### 6. Verificar os Logs

Os logs agora mostram avisos quando o token não está configurado:

```
MP_ACCESS_TOKEN não configurado ou inválido
```

## 🔍 Diagnóstico

### Teste 1: Verificar Status do Token

```bash
curl https://api.seudominio.com/api/payments/mp/status
```

Resposta esperada se o token estiver OK:
```json
{
  "status": "ok",
  "token": {
    "configured": true,
    "preview": "APP_USR-70...3119",
    "type": "production",
    "status": "valid",
    "valid": true
  }
}
```

### Teste 2: Testar Token Diretamente

```bash
curl -X GET "https://api.mercadopago.com/v1/payment_methods" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

- **200 OK**: Token válido ✅
- **401 Unauthorized**: Token inválido ou expirado ❌

## 🛠️ Melhorias Implementadas

### 1. Validação do Token
- ✅ Verifica se o token está configurado
- ✅ Detecta tokens de exemplo/inválidos
- ✅ Valida o formato do token
- ✅ Logs detalhados quando o token está ausente

### 2. Tratamento de Erros 401
- ✅ Mensagens de erro mais claras
- ✅ Logs detalhados para debug
- ✅ Sugestões de como resolver

### 3. Rota de Status
- ✅ Nova rota `/api/payments/mp/status` para verificar o token
- ✅ Valida o token fazendo uma requisição de teste
- ✅ Retorna recomendações baseadas no status

## 📝 Checklist

- [ ] Token configurado na variável `MP_ACCESS_TOKEN`
- [ ] Token não é um exemplo (não contém `xxxxx`)
- [ ] Token começa com `APP_USR-` (produção) ou `TEST-` (teste)
- [ ] Servidor reiniciado após atualizar o token
- [ ] Rota `/api/payments/mp/status` retorna `valid: true`
- [ ] Logs não mostram "MP_ACCESS_TOKEN não configurado"

## 🚨 Erros Comuns

### Erro: "MP_ACCESS_TOKEN não configurado"
**Solução**: Configure a variável de ambiente `MP_ACCESS_TOKEN`

### Erro: "Token inválido (401)"
**Solução**: 
1. Gere um novo token no painel do Mercado Pago
2. Atualize a variável de ambiente
3. Reinicie o servidor

### Erro: Token parece estar configurado mas ainda dá 401
**Solução**:
1. Verifique se não há espaços extras no token
2. Verifique se o token não expirou
3. Gere um novo token
4. Reinicie o servidor

## 🔗 Links Úteis

- [Painel de Credenciais](https://www.mercadopago.com.br/developers/panel/credentials)
- [Documentação de Autenticação](https://www.mercadopago.com.br/developers/pt/docs/security/credentials)
- [Rota de Status](/api/payments/mp/status)

## 💡 Dica

Use a rota `/api/payments/mp/status` regularmente para verificar se o token está válido. Isso ajuda a identificar problemas antes que afetem os usuários.

