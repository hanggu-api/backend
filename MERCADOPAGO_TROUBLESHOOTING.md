# Troubleshooting - Erro PolicyAgent do Mercado Pago

## Problema

Erro `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` (403) ao criar preferências de pagamento.

## Causas Possíveis

### 1. Token Inválido ou Expirado
- O token pode estar incorreto
- O token pode ter expirado
- O token pode ser de teste tentando usar em produção (ou vice-versa)

### 2. Políticas de Segurança do Mercado Pago
- O PolicyAgent do Mercado Pago pode estar bloqueando por:
  - URL do webhook não autorizada
  - URL de retorno (back_urls) não autorizada
  - Domínio não verificado
  - Conta em processo de verificação

### 3. Configuração da Conta
- Conta do Mercado Pago pode estar em processo de verificação
- Pode haver restrições na conta
- Pode ser necessário verificar a conta no painel do Mercado Pago

## Soluções

### Solução 1: Verificar o Token

1. Acesse o painel do Mercado Pago:
   - Produção: https://www.mercadopago.com.br/developers/panel/credentials
   - Teste: https://www.mercadopago.com.br/developers/panel/test-credentials

2. Verifique se o token está correto e ativo

3. Se necessário, gere um novo token

### Solução 2: Verificar URLs no Painel

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Verifique se as URLs estão configuradas corretamente:
   - URL de retorno (redirect URLs)
   - URL do webhook

3. Adicione as URLs necessárias se não estiverem configuradas

### Solução 3: Usar Versão Minimal (Já Implementado)

O código já tenta criar uma preferência "ultra minimal" quando detecta o erro PolicyAgent. Isso remove:
- Webhook URL
- Back URLs
- Auto return
- Sponsor ID
- Metadata

### Solução 4: Verificar Status da Conta

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Verifique se há pendências na conta
3. Complete a verificação se necessário

### Solução 5: Usar Token de Teste para Desenvolvimento

Se estiver em desenvolvimento, use o token de teste:

```env
MP_ACCESS_TOKEN=TEST-xxxxx-xxxxx-xxxxx
```

### Solução 6: Verificar Logs Melhorados

O código agora inclui logs detalhados. Verifique os logs para ver:
- Qual tentativa falhou
- Qual campo pode estar causando o problema
- Tracking ID para suporte do Mercado Pago

## Verificação Rápida

Execute este comando para verificar se o token está funcionando:

```bash
curl -X GET "https://api.mercadopago.com/v1/payment_methods" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

Se retornar 401, o token está inválido.
Se retornar 200, o token está OK e o problema pode ser nas políticas.

## Contato com Suporte

Se nenhuma solução funcionar:

1. Coletar informações:
   - Tracking ID dos logs (x-meli-tracking-id)
   - Token (mascarado)
   - URLs configuradas
   - Erro completo

2. Contatar suporte do Mercado Pago:
   - https://www.mercadopago.com.br/developers/pt/support

## Melhorias Implementadas

✅ Logs detalhados para debug
✅ Tentativa automática com versão minimal
✅ Validação de formato de valores
✅ Limitação de tamanho de campos
✅ Mensagens de erro mais claras
✅ Detecção de erros de autenticação

## Próximos Passos

1. Verificar os logs melhorados no servidor
2. Tentar criar uma preferência novamente
3. Se ainda falhar, verificar o token e URLs no painel
4. Se persistir, contatar suporte do Mercado Pago com os logs

