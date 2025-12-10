# Diagnóstico do Token do Mercado Pago

## 🔍 Como Diagnosticar Problemas com o Token

### 1. Verificar Logs na Inicialização

Quando o servidor inicia, você deve ver uma das seguintes mensagens:

**✅ Token Configurado:**
```
✅ Mercado Pago configurado - Token: APP_USR-70...3119 (PRODUÇÃO)
```

**❌ Token Não Configurado:**
```
⚠️  AVISO: MP_ACCESS_TOKEN não configurado ou inválido
   Configure a variável MP_ACCESS_TOKEN no arquivo .env ou ecosystem.config.js
```

### 2. Verificar Status do Token

Acesse a rota de status:

```bash
GET https://api.seudominio.com/api/payments/mp/status
```

Isso retornará informações detalhadas sobre o token.

### 3. Verificar Variáveis de Ambiente no PM2

Se estiver usando PM2, verifique se as variáveis estão sendo carregadas:

```bash
# Ver variáveis de ambiente do processo
pm2 env <process_id>

# Ou verificar o ecosystem.config.js
cat ecosystem.config.js
```

### 4. Verificar Logs de Erro

Procure nos logs por:

- `❌ MP Preference Error` - Erro ao criar preferência
- `🔴 ERRO 401` - Token não autorizado
- `MP_ACCESS_TOKEN não configurado` - Token ausente

### 5. Testar Token Manualmente

```bash
# Substitua SEU_TOKEN pelo token real
curl -X GET "https://api.mercadopago.com/v1/payment_methods" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"
```

**Resposta esperada:**
- **200 OK**: Token válido ✅
- **401 Unauthorized**: Token inválido ❌

## 🛠️ Soluções Comuns

### Problema: Token não está sendo carregado

**Solução:**
1. Verifique se o token está no `ecosystem.config.js` (se usar PM2)
2. Verifique se o token está no `.env` (se usar dotenv)
3. Reinicie o servidor após atualizar

### Problema: Token está configurado mas ainda dá 401

**Solução:**
1. Verifique se o token não tem espaços extras
2. Verifique se o token não expirou
3. Gere um novo token no painel do Mercado Pago
4. Reinicie o servidor

### Problema: Logs mostram "Token não configurado" mas está no arquivo

**Solução:**
1. Verifique se o arquivo `.env` está na raiz do projeto
2. Verifique se o PM2 está usando o `ecosystem.config.js` correto
3. Reinicie o servidor completamente

## 📝 Checklist de Diagnóstico

- [ ] Logs na inicialização mostram token configurado
- [ ] Rota `/api/payments/mp/status` retorna `valid: true`
- [ ] Token testado manualmente retorna 200 OK
- [ ] Variável `MP_ACCESS_TOKEN` está no arquivo de configuração
- [ ] Servidor foi reiniciado após atualizar o token
- [ ] Token não contém espaços ou caracteres especiais
- [ ] Token começa com `APP_USR-` (produção) ou `TEST-` (teste)

## 🔗 Links Úteis

- [Painel de Credenciais](https://www.mercadopago.com.br/developers/panel/credentials)
- [Rota de Status](/api/payments/mp/status)
- [Documentação de Autenticação](https://www.mercadopago.com.br/developers/pt/docs/security/credentials)

