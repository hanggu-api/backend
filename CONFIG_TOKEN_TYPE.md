# Configuração do Tipo de Token do Mercado Pago

## 📝 Sobre

O Mercado Pago possui dois tipos de tokens:
- **Teste**: Para desenvolvimento e testes
- **Produção**: Para ambiente real

Alguns tokens de teste podem começar com `APP_USR-` (igual aos de produção), então é necessário especificar explicitamente o tipo.

## ⚙️ Como Configurar

### Opção 1: Variável de Ambiente MP_TOKEN_TYPE

Adicione a variável `MP_TOKEN_TYPE` no seu arquivo de configuração:

#### No `ecosystem.config.js` (PM2):
```javascript
env: {
  MP_ACCESS_TOKEN: 'APP_USR-7034531044731441-121009-...',
  MP_TOKEN_TYPE: 'test', // ou 'production'
  // ... outras variáveis
}
```

#### No `.env`:
```env
MP_ACCESS_TOKEN=APP_USR-7034531044731441-121009-...
MP_TOKEN_TYPE=test
```

### Valores Aceitos

- `test` ou `teste` - Token de teste
- `production` ou `producao` - Token de produção

## 🔍 Detecção Automática

Se você **não** configurar `MP_TOKEN_TYPE`, o sistema tentará detectar automaticamente:

- Tokens que começam com `TEST-` → **TESTE**
- Tokens que começam com `APP_USR-` → **PRODUÇÃO** (padrão)

**⚠️ IMPORTANTE**: Se seu token de teste começa com `APP_USR-`, você **deve** configurar `MP_TOKEN_TYPE=test` explicitamente.

## ✅ Verificação

Após configurar, reinicie o servidor e verifique os logs:

**Token de Teste:**
```
✅ Mercado Pago configurado - Token: APP_USR-70...3119 (TESTE)
```

**Token de Produção:**
```
✅ Mercado Pago configurado - Token: APP_USR-70...3119 (PRODUÇÃO)
```

## 🔗 Links Úteis

- [Credenciais de Teste](https://www.mercadopago.com.br/developers/panel/test-credentials)
- [Credenciais de Produção](https://www.mercadopago.com.br/developers/panel/credentials)

