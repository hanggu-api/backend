#!/usr/bin/env node

/**
 * Script de teste para integração do Mercado Pago
 * Uso: node scripts/test-mercadopago.js
 */

require('dotenv').config();

// Usar fetch nativo do Node.js 18+ ou node-fetch
let fetch;
try {
  // Tentar usar fetch nativo (Node.js 18+)
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  // Fallback para node-fetch
  fetch = require('node-fetch');
}

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function testToken() {
  log('\n📋 Teste 1: Verificar Token do Mercado Pago', 'blue');
  log('='.repeat(50));
  
  const token = process.env.MP_ACCESS_TOKEN;
  const tokenType = process.env.MP_TOKEN_TYPE || '';
  
  if (!token || token.trim() === '' || token === 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    logError('Token não configurado!');
    logInfo('Configure MP_ACCESS_TOKEN no .env ou ecosystem.config.js');
    return false;
  }
  
  const tokenPreview = `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
  logSuccess(`Token encontrado: ${tokenPreview}`);
  
  // Detectar tipo
  let detectedType = 'DESCONHECIDO';
  if (tokenType.toLowerCase() === 'test' || tokenType.toLowerCase() === 'teste') {
    detectedType = 'TESTE';
  } else if (tokenType.toLowerCase() === 'production' || tokenType.toLowerCase() === 'producao') {
    detectedType = 'PRODUÇÃO';
  } else if (token.startsWith('TEST-')) {
    detectedType = 'TESTE';
  } else if (token.startsWith('APP_USR-')) {
    detectedType = 'PRODUÇÃO (assumido)';
  }
  
  logInfo(`Tipo do token: ${detectedType}`);
  
  return { token, tokenPreview, detectedType };
}

async function testAPIConnection(token) {
  log('\n📋 Teste 2: Testar Conexão com API do Mercado Pago', 'blue');
  log('='.repeat(50));
  
  try {
    logInfo('Fazendo requisição para: https://api.mercadopago.com/v1/payment_methods');
    
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess(`Conexão OK! Status: ${response.status}`);
      logInfo(`Métodos de pagamento disponíveis: ${data.length || 0}`);
      return true;
    } else {
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (_) {}
      
      logError(`Erro na conexão! Status: ${response.status}`);
      if (errorJson) {
        logError(`Mensagem: ${errorJson.message || errorText}`);
        if (errorJson.error) {
          logError(`Tipo: ${errorJson.error}`);
        }
        if (errorJson.cause && Array.isArray(errorJson.cause)) {
          errorJson.cause.forEach(cause => {
            logError(`  - ${cause.description || cause.code}`);
          });
        }
      } else {
        logError(`Resposta: ${errorText.substring(0, 200)}`);
      }
      
      if (response.status === 401) {
        logWarning('Erro 401: Token inválido ou expirado');
        logInfo('Gere um novo token em: https://www.mercadopago.com.br/developers/panel/credentials');
      }
      
      return false;
    }
  } catch (error) {
    logError(`Erro ao conectar: ${error.message}`);
    return false;
  }
}

async function testCreatePreference(token, tokenType) {
  log('\n📋 Teste 3: Criar Preferência de Pagamento (Teste)', 'blue');
  log('='.repeat(50));
  
  const testPreference = {
    items: [
      {
        title: 'Teste de Integração',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: 10.00
      }
    ],
    external_reference: 'test-integration-' + Date.now(),
    notification_url: process.env.MP_WEBHOOK_URL || '',
    back_urls: {
      success: process.env.BASE_URL || 'http://localhost:4001',
      pending: process.env.BASE_URL || 'http://localhost:4001',
      failure: process.env.BASE_URL || 'http://localhost:4001'
    }
  };
  
  // Se for teste, remover campos que podem causar PolicyAgent
  if (tokenType.includes('TESTE') || !process.env.MP_WEBHOOK_URL) {
    delete testPreference.notification_url;
    logInfo('Modo teste: removendo notification_url para evitar PolicyAgent');
  }
  
  try {
    logInfo('Criando preferência de teste...');
    
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AppMissao-Backend-Test/1.0'
      },
      body: JSON.stringify(testPreference)
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess('Preferência criada com sucesso!');
      logInfo(`ID da preferência: ${data.id}`);
      logInfo(`URL de checkout: ${data.init_point || data.sandbox_init_point || 'N/A'}`);
      
      if (data.sandbox_init_point) {
        logWarning('Usando URL de sandbox (modo teste)');
      }
      
      return { success: true, preference: data };
    } else {
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (_) {}
      
      logError(`Erro ao criar preferência! Status: ${response.status}`);
      
      if (errorJson) {
        logError(`Mensagem: ${errorJson.message || errorText}`);
        logError(`Código: ${errorJson.code || 'N/A'}`);
        
        if (errorJson.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES') {
          logWarning('Erro PolicyAgent: As políticas de segurança estão bloqueando');
          logInfo('Tentando criar preferência minimal...');
          
          // Tentar versão minimal
          const minimalPref = {
            items: testPreference.items,
            external_reference: testPreference.external_reference
          };
          
          const minimalResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(minimalPref)
          });
          
          if (minimalResponse.ok) {
            const minimalData = await minimalResponse.json();
            logSuccess('Preferência minimal criada com sucesso!');
            logInfo(`ID: ${minimalData.id}`);
            return { success: true, preference: minimalData, minimal: true };
          } else {
            logError('Falha mesmo com preferência minimal');
          }
        }
        
        if (errorJson.cause && Array.isArray(errorJson.cause)) {
          errorJson.cause.forEach(cause => {
            logError(`  - ${cause.description || cause.code}`);
          });
        }
      } else {
        logError(`Resposta: ${errorText.substring(0, 200)}`);
      }
      
      return { success: false };
    }
  } catch (error) {
    logError(`Erro ao criar preferência: ${error.message}`);
    return { success: false };
  }
}

async function testWebhook() {
  log('\n📋 Teste 4: Verificar Configuração do Webhook', 'blue');
  log('='.repeat(50));
  
  const webhookUrl = process.env.MP_WEBHOOK_URL;
  const baseUrl = process.env.BASE_URL;
  
  if (!webhookUrl) {
    logWarning('MP_WEBHOOK_URL não configurado');
    logInfo('Configure no .env ou ecosystem.config.js');
    return false;
  }
  
  logSuccess(`Webhook URL configurado: ${webhookUrl}`);
  
  if (!webhookUrl.startsWith('https://')) {
    logWarning('Webhook deve usar HTTPS (obrigatório pelo Mercado Pago)');
  }
  
  if (baseUrl) {
    logInfo(`BASE_URL: ${baseUrl}`);
  }
  
  return true;
}

async function runTests() {
  log('\n🚀 Iniciando Testes de Integração do Mercado Pago', 'cyan');
  log('='.repeat(50));
  
  const results = {
    token: false,
    api: false,
    preference: false,
    webhook: false
  };
  
  // Teste 1: Token
  const tokenResult = await testToken();
  if (tokenResult) {
    results.token = true;
    
    // Teste 2: API Connection
    results.api = await testAPIConnection(tokenResult.token);
    
    // Teste 3: Create Preference
    if (results.api) {
      const prefResult = await testCreatePreference(tokenResult.token, tokenResult.detectedType);
      results.preference = prefResult.success || false;
    }
  }
  
  // Teste 4: Webhook
  results.webhook = await testWebhook();
  
  // Resumo
  log('\n📊 Resumo dos Testes', 'blue');
  log('='.repeat(50));
  log(`${results.token ? '✅' : '❌'} Token configurado`);
  log(`${results.api ? '✅' : '❌'} Conexão com API`);
  log(`${results.preference ? '✅' : '❌'} Criar preferência`);
  log(`${results.webhook ? '✅' : '⚠️ '} Webhook configurado`);
  
  const allPassed = results.token && results.api && results.preference;
  
  if (allPassed) {
    log('\n🎉 Todos os testes principais passaram!', 'green');
    log('A integração está funcionando corretamente.', 'green');
  } else {
    log('\n⚠️  Alguns testes falharam', 'yellow');
    log('Verifique os erros acima e corrija a configuração.', 'yellow');
  }
  
  log('\n');
  process.exit(allPassed ? 0 : 1);
}

// Executar testes
runTests().catch(error => {
  logError(`Erro fatal: ${error.message}`);
  console.error(error);
  process.exit(1);
});

