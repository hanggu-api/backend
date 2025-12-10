# Como Resolver Erro Code 5 do Mercado Pago

## 🔴 Problema

Erro **Code 5** com mensagem: "Must provide your access_token to proceed"

Este erro indica que o token do Mercado Pago **não está sendo enviado** nas requisições à API.

## ✅ Solução

### 1. Verificar se o Token Está Configurado

O token **DEVE** estar configurado em um dos seguintes lugares:

#### Opção A: No `ecosystem.config.js` (PM2) - RECOMENDADO

```javascript
env: {
  MP_ACCESS_TOKEN: 'APP_USR-7034531044731441-121009-293b90e1c6ea8a8473b79d4efbc2c45f-2535373119',
  MP_TOKEN_TYPE: 'test',
  // ... outras variáveis
}
```

#### Opção B: No arquivo `.env`

```env
MP_ACCESS_TOKEN=APP_USR-7034531044731441-121009-293b90e1c6ea8a8473b79d4efbc2c45f-2535373119
MP_TOKEN_TYPE=test
```

### 2. Verificar os Logs na Inicialização

Quando o servidor inicia, você deve ver:

**✅ Token Configurado:**
```
✅ Mercado Pago configurado - Token: APP_USR-70...3119 (TESTE)
```

**❌ Token NÃO Configurado:**
```
⚠️  AVISO: MP_ACCESS_TOKEN não configurado ou inválido
   Configure a variável MP_ACCESS_TOKEN no arquivo .env ou ecosystem.config.js
```

### 3. Reiniciar o Servidor

**IMPORTANTE**: Após adicionar ou atualizar o token, **sempre reinicie o servidor**:

```bash
# Se estiver usando PM2
pm2 restart appmissao-backend

# Verificar se reiniciou corretamente
pm2 logs appmissao-backend --lines 20
```

### 4. Verificar se o Token Está Sendo Carregado

Acesse a rota de status:

```bash
GET /api/payments/mp/status
```

Deve retornar:
```json
{
  "status": "ok",
  "token": {
    "configured": true,
    "preview": "APP_USR-70...3119",
    "type": "test",
    "status": "valid",
    "valid": true
  }
}
```

## 🔍 Diagnóstico

### Verificar Variáveis de Ambiente no PM2

```bash
# Ver todas as variáveis do processo
pm2 env <process_id>

# Ou verificar o ecosystem.config.js
cat ecosystem.config.js | grep MP_ACCESS_TOKEN
```

### Verificar Logs de Erro

Procure nos logs por:
- `❌ MP_ACCESS_TOKEN não configurado`
- `Token vazio ao tentar criar preferência`
- `Erro 401 - Token não autorizado`

## ⚠️ Problemas Comuns

### Problema: Token foi removido do ecosystem.config.js

**Sintoma**: Logs mostram "MP_ACCESS_TOKEN não configurado"

**Solução**: Adicione o token de volta no `ecosystem.config.js`:
```javascript
MP_ACCESS_TOKEN: 'SEU_TOKEN_AQUI',
```

### Problema: Token está no .env mas PM2 não carrega

**Sintoma**: Token funciona localmente mas não no servidor

**Solução**: Adicione o token no `ecosystem.config.js` também, pois o PM2 pode não carregar o `.env` automaticamente.

### Problema: Servidor não foi reiniciado

**Sintoma**: Token foi adicionado mas ainda dá erro

**Solução**: **Sempre reinicie o servidor** após alterar variáveis de ambiente:
```bash
pm2 restart appmissao-backend
```

## 📝 Checklist

- [ ] Token está no `ecosystem.config.js` OU no `.env`
- [ ] Token não é um exemplo (não contém `xxxxx`)
- [ ] Token começa com `APP_USR-` ou `TEST-`
- [ ] `MP_TOKEN_TYPE` está configurado se necessário
- [ ] Servidor foi **reiniciado** após adicionar o token
- [ ] Logs na inicialização mostram "✅ Mercado Pago configurado"
- [ ] Rota `/api/payments/mp/status` retorna `configured: true`

## 🔗 Links Úteis

- [Painel de Credenciais](https://www.mercadopago.com.br/developers/panel/credentials)
- [Credenciais de Teste](https://www.mercadopago.com.br/developers/panel/test-credentials)
- [Rota de Status](/api/payments/mp/status)

## 💡 Dica

Se você estiver usando PM2, **sempre configure as variáveis no `ecosystem.config.js`**, pois o PM2 pode não carregar o arquivo `.env` automaticamente dependendo da configuração.

