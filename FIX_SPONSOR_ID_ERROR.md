# Como Resolver Erro de sponsor_id

## 🔴 Problema

Erro: `sponsor_id should be different than collector_id` (Status 400)

Este erro ocorre quando o `sponsor_id` configurado é igual ao `collector_id` (ID da conta do token).

## ✅ Solução

O código já trata esse erro automaticamente. Quando detecta o erro de `sponsor_id`, ele:

1. Remove o `sponsor_id` do payload
2. Tenta criar a preferência novamente sem o `sponsor_id`
3. Usa uma versão minimal da preferência

## 🔍 O que é sponsor_id?

O `sponsor_id` é usado para indicar um parceiro/afiliado que recebe uma comissão sobre o pagamento. Ele **deve ser diferente** do ID da conta que está criando a preferência.

## ⚙️ Configuração

### Se você NÃO precisa de sponsor_id:

**Remova ou deixe vazio** a variável `MP_SPONSOR_ID`:

```javascript
// No ecosystem.config.js - REMOVER ou deixar vazio
// MP_SPONSOR_ID: '', // Não configurado
```

### Se você PRECISA de sponsor_id:

1. Certifique-se de que o `sponsor_id` é **diferente** do ID da sua conta
2. Obtenha o `sponsor_id` correto do parceiro/afiliado
3. Configure no `ecosystem.config.js`:

```javascript
MP_SPONSOR_ID: '123456789', // ID do parceiro (diferente do seu collector_id)
```

## 🔧 Correção Automática

O código agora detecta automaticamente esse erro e:

1. ✅ Remove o `sponsor_id` automaticamente
2. ✅ Tenta criar a preferência novamente
3. ✅ Loga o processo para debug

## 📝 Logs Esperados

Quando o erro ocorrer e for corrigido automaticamente, você verá:

```
⚠️  Erro de sponsor_id detectado - removendo sponsor_id e tentando novamente...
   Erro: sponsor_id não pode ser igual ao collector_id
✅ Preferência criada com sucesso (sem sponsor_id)!
```

## ⚠️ Importante

- O `sponsor_id` é **opcional**
- Se não for necessário, **não configure** a variável `MP_SPONSOR_ID`
- O código funciona perfeitamente sem `sponsor_id`

## 🔗 Links Úteis

- [Documentação do Mercado Pago sobre sponsor_id](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/checkout-customization/preferences)

