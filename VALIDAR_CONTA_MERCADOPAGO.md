# Como Validar Conta do Mercado Pago

## 🔍 Verificar Status da Conta

### 1. Acessar o Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/home
2. Faça login com sua conta
3. Vá em **"Seu negócio"** ou **"Configurações"**

### 2. Verificar Pendências

No painel, procure por:

#### ✅ Status da Conta
- **Conta verificada**: ✅ Tudo OK
- **Conta pendente**: ⚠️ Precisa validar documentos
- **Conta bloqueada**: ❌ Conta bloqueada, entre em contato

#### 📋 Documentos Necessários

O Mercado Pago pode solicitar:

1. **CPF/CNPJ**
   - CPF para pessoa física
   - CNPJ para pessoa jurídica

2. **Documento de Identidade**
   - RG, CNH ou Passaporte
   - Foto nítida, frente e verso (se necessário)

3. **Comprovante de Endereço**
   - Conta de luz, água, telefone
   - Extrato bancário
   - Comprovante de residência recente (máximo 3 meses)

4. **Dados Bancários** (para receber pagamentos)
   - Banco
   - Agência
   - Conta corrente ou poupança

### 3. Verificar no Painel de Desenvolvedores

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Verifique se há avisos ou pendências
3. Veja se há mensagens sobre:
   - Conta não verificada
   - Documentos pendentes
   - Limitações de API

## 🚨 Problemas Comuns

### Problema: "Cadastro inválido"

**Possíveis causas:**
1. **Dados incompletos**
   - Nome, CPF/CNPJ, endereço incompletos
   - Email não confirmado
   - Telefone não verificado

2. **Documentos não enviados**
   - CPF/CNPJ não cadastrado
   - Documento de identidade não enviado
   - Comprovante de endereço ausente

3. **Documentos rejeitados**
   - Foto de baixa qualidade
   - Documento ilegível
   - Documento expirado
   - Dados não conferem

### Problema: "Conta não verificada"

**Solução:**
1. Acesse: https://www.mercadopago.com.br/home
2. Vá em **"Verificar minha conta"** ou **"Completar cadastro"**
3. Envie os documentos solicitados
4. Aguarde a análise (geralmente 24-48 horas)

### Problema: "Token não funciona"

**Possíveis causas:**
1. Conta não verificada
2. Aplicação não criada
3. Token expirado ou inválido
4. Conta bloqueada

## 📝 Passo a Passo para Validar

### Passo 1: Completar Cadastro Pessoal

1. Acesse: https://www.mercadopago.com.br/home
2. Clique em **"Meu perfil"** ou **"Configurações"**
3. Complete todos os campos:
   - ✅ Nome completo
   - ✅ CPF/CNPJ
   - ✅ Data de nascimento
   - ✅ Endereço completo
   - ✅ Telefone
   - ✅ Email confirmado

### Passo 2: Enviar Documentos

1. Vá em **"Verificar minha conta"**
2. Envie os documentos solicitados:
   - **CPF/CNPJ**: Foto nítida
   - **RG/CNH**: Frente e verso
   - **Comprovante de endereço**: Recente (últimos 3 meses)

**Dicas:**
- Use fotos nítidas e bem iluminadas
- Certifique-se de que todos os dados estão visíveis
- Não corte partes importantes do documento
- Use formato JPG ou PNG

### Passo 3: Verificar Dados Bancários

1. Vá em **"Como receber"** ou **"Conta bancária"**
2. Adicione sua conta bancária:
   - Banco
   - Tipo de conta (corrente/poupança)
   - Agência
   - Número da conta
   - CPF/CNPJ do titular

### Passo 4: Aguardar Análise

- A análise geralmente leva **24 a 48 horas**
- Você receberá um email quando a análise for concluída
- Verifique o status no painel

### Passo 5: Criar Aplicação (Para Desenvolvedores)

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Clique em **"Criar aplicação"** ou **"Suas integrações"**
3. Preencha os dados:
   - Nome da aplicação
   - Descrição
   - URL do site
   - URLs de retorno (se aplicável)

4. Após criar, copie o **Access Token**

## 🔐 Verificar Credenciais

### Credenciais de Teste

1. Acesse: https://www.mercadopago.com.br/developers/panel/test-credentials
2. Verifique se há credenciais de teste disponíveis
3. Se não houver, crie uma aplicação primeiro

### Credenciais de Produção

1. Acesse: https://www.mercadopago.com.br/developers/panel/credentials
2. Verifique se há credenciais de produção
3. Se não houver, pode ser porque:
   - Conta não está verificada
   - Aplicação não foi criada
   - Conta está bloqueada

## ⚠️ Mensagens de Erro Comuns

### "Conta não verificada"
**Solução**: Complete o cadastro e envie os documentos

### "Documentos pendentes"
**Solução**: Envie os documentos solicitados

### "Cadastro inválido"
**Solução**: 
- Verifique se todos os dados estão corretos
- Reenvie os documentos com fotos melhores
- Entre em contato com o suporte

### "Token não autorizado"
**Solução**:
- Verifique se a conta está verificada
- Gere um novo token
- Verifique se está usando o token correto (teste vs produção)

## 📞 Contato com Suporte

Se tiver problemas:

1. **Chat Online**: https://www.mercadopago.com.br/developers/pt/support
2. **Email**: Através do painel do Mercado Pago
3. **Telefone**: Verifique no site do Mercado Pago

## ✅ Checklist de Validação

- [ ] Cadastro pessoal completo (nome, CPF, endereço, telefone)
- [ ] Email confirmado
- [ ] CPF/CNPJ cadastrado
- [ ] Documento de identidade enviado (RG/CNH)
- [ ] Comprovante de endereço enviado
- [ ] Conta bancária cadastrada (se for receber pagamentos)
- [ ] Conta verificada pelo Mercado Pago
- [ ] Aplicação criada no painel de desenvolvedores
- [ ] Access Token gerado e copiado
- [ ] Token configurado no servidor

## 🔗 Links Úteis

- [Painel do Mercado Pago](https://www.mercadopago.com.br/home)
- [Painel de Desenvolvedores](https://www.mercadopago.com.br/developers/panel)
- [Verificar Conta](https://www.mercadopago.com.br/home)
- [Suporte](https://www.mercadopago.com.br/developers/pt/support)
- [Documentação](https://www.mercadopago.com.br/developers/pt/docs)

