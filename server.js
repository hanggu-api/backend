const dotenv = require('dotenv');
dotenv.config();

// Verificar configuração do Mercado Pago no início
const mpToken = process.env.MP_ACCESS_TOKEN;
const mpTokenType = process.env.MP_TOKEN_TYPE || ''; // Permite forçar o tipo: 'test' ou 'production'
if (!mpToken || mpToken.trim() === '' || mpToken === 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
  console.warn('⚠️  AVISO: MP_ACCESS_TOKEN não configurado ou inválido');
  console.warn('   Configure a variável MP_ACCESS_TOKEN no arquivo .env ou ecosystem.config.js');
  console.warn('   Obtenha o token em: https://www.mercadopago.com.br/developers/panel/credentials');
} else {
  const tokenPreview = `${mpToken.substring(0, 10)}...${mpToken.substring(mpToken.length - 5)}`;
  // Detectar tipo do token - pode ser forçado via MP_TOKEN_TYPE ou detectado automaticamente
  let tokenType = 'DESCONHECIDO';
  if (mpTokenType.toLowerCase() === 'test' || mpTokenType.toLowerCase() === 'teste') {
    tokenType = 'TESTE';
  } else if (mpTokenType.toLowerCase() === 'production' || mpTokenType.toLowerCase() === 'producao') {
    tokenType = 'PRODUÇÃO';
  } else if (mpToken.startsWith('TEST-')) {
    tokenType = 'TESTE';
  } else if (mpToken.startsWith('APP_USR-')) {
    // Por padrão, APP_USR- é produção, mas pode ser teste também
    // Se não especificado, assumir produção mas avisar
    tokenType = 'PRODUÇÃO (se for teste, configure MP_TOKEN_TYPE=test)';
  }
  console.log(`✅ Mercado Pago configurado - Token: ${tokenPreview} (${tokenType})`);
}
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { pool } = require('./db');
const mysql = require('mysql2/promise');
const { protect } = require('./authMiddleware');

const app = express();
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "script-src 'self' https://static.cloudflareinsights.com; script-src-elem 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com");
  next();
});

app.post('/api/notifications/device-register', protect, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const platform = String(req.body.platform || '').trim() || null;
    if (!token) return res.status(400).json({ message: 'Token inválido' });
    await pool.query('INSERT INTO notification_devices (user_id, token, platform, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE platform = VALUES(platform), last_seen_at = CURRENT_TIMESTAMP', [req.user.id, token, platform]);
    const [rows] = await pool.query('SELECT * FROM notification_devices WHERE user_id = ? ORDER BY last_seen_at DESC', [req.user.id]);
    res.json({ devices: rows });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/notifications/prefs', protect, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notification_prefs WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!rows.length) {
      await pool.query('INSERT INTO notification_prefs (user_id) VALUES (?)', [req.user.id]);
      const [rows2] = await pool.query('SELECT * FROM notification_prefs WHERE user_id = ? LIMIT 1', [req.user.id]);
      return res.json({ prefs: rows2[0] });
    }
    res.json({ prefs: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.patch('/api/notifications/prefs', protect, async (req, res) => {
  try {
    const allowed = ['allow_payment','allow_mission','allow_chat','allow_general'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k] ? 1 : 0;
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nenhuma alteração' });
    const setSql = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).map(k => updates[k]);
    values.push(req.user.id);
    await pool.query(`UPDATE notification_prefs SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM notification_prefs WHERE user_id = ? LIMIT 1', [req.user.id]);
    res.json({ prefs: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/notifications/test', protect, async (req, res) => {
  try {
    await notifyUsers([req.user.id], 'general', 'Teste de Push', 'Notificação de teste', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});
const http = require('http');
const { WebSocketServer } = require('ws');
const serverless = require('serverless-http');
const isVercel = !!process.env.VERCEL;
const server = isVercel ? null : http.createServer(app);
const wss = isVercel ? null : new WebSocketServer({ server });
const multer = require('multer');
const upload = multer();
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mercadopago = require('mercadopago');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

function getMP() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token || token.trim() === '' || token === 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    console.warn('MP_ACCESS_TOKEN não configurado ou inválido');
    return null;
  }
  try { 
    mercadopago.configure({ access_token: token.trim() }); 
    return mercadopago; 
  } catch (err) { 
    console.error('Erro ao configurar Mercado Pago SDK v1:', err.message);
    return null; 
  }
}

function getMPClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token || token.trim() === '' || token === 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    console.warn('MP_ACCESS_TOKEN não configurado ou inválido');
    return null;
  }
  try { 
    return new MercadoPagoConfig({ access_token: token.trim() }); 
  } catch (err) { 
    console.error('Erro ao configurar Mercado Pago SDK v2:', err.message);
    return null; 
  }
}

function getMPToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token || token.trim() === '' || token === 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    return null;
  }
  return token.trim();
}

function readPercentEnv(name, def) {
  const v = Number(process.env[name]);
  if (!isFinite(v) || v <= 0) return def;
  return Math.min(100, Math.max(1, Math.round(v)));
}

async function createMpPreferenceForAmount({ mission, amount, kind, userEmail }) {
  const token = getMPToken();
  if (!token) {
    console.error('❌ MP_ACCESS_TOKEN não configurado ao criar preferência');
    console.error('   Verifique se a variável MP_ACCESS_TOKEN está definida no ambiente');
    throw new Error('mp-unavailable: Token do Mercado Pago não configurado. Verifique a variável MP_ACCESS_TOKEN.');
  }
  
  // Log de debug (apenas preview do token)
  const tokenPreview = `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
  console.log(`🔐 Criando preferência MP com token: ${tokenPreview}`);
  const currency = 'BRL';
  const external_ref = `mission:${mission.id}:${kind || 'full'}`;
  const webhook = String(process.env.MP_WEBHOOK_URL || '');
  const hasHttpsWebhook = /^https:\/\//i.test(webhook);
  const base = String(process.env.BASE_URL || '').replace(/\/+$/,'');
  
  
  // Função para criar preferência - versão ultra minimal para evitar PolicyAgent
  const makePref = (ultraMinimal = false) => {
    const p = {
      items: [{ 
        title: (mission.title || 'Serviço').substring(0, 127), // Limitar tamanho do título
        quantity: 1, 
        currency_id: currency, 
        unit_price: parseFloat(amount.toFixed(2)) // Garantir formato correto
      }],
      external_reference: external_ref
    };
    
    // Versão ultra minimal - apenas o essencial
    if (ultraMinimal) {
      return p;
    }
    
    // Adicionar metadata apenas se não for ultra minimal
    p.metadata = { mission_id: mission.id, kind: kind || 'full' };
    
    // Adicionar campos opcionais gradualmente
    if (hasHttpsWebhook && webhook) {
      p.notification_url = webhook;
    }
    
    if (userEmail && String(userEmail).includes('@')) {
      p.payer = { email: String(userEmail).trim().substring(0, 254) };
    }
    
    if (base) {
      p.back_urls = { 
        success: base, 
        pending: base, 
        failure: base 
      };
      p.auto_return = 'approved';
    }
    
    
    
    return p;
  };
  
  // Validar token antes de fazer requisição
  if (!token || token.trim() === '') {
    console.error('❌ Token vazio ao tentar criar preferência');
    throw new Error('mp-unavailable: Token do Mercado Pago está vazio. Verifique a variável MP_ACCESS_TOKEN.');
  }
  
  // Tentar criar preferência completa primeiro
  let payload = makePref(false);
  console.log('📤 Enviando requisição para criar preferência MP:', {
    url: 'https://api.mercadopago.com/checkout/preferences',
    token_preview: `${token.substring(0, 10)}...${token.substring(token.length - 5)}`,
    has_token: !!token,
    token_length: token.length
  });
  
  let resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`, 
      'Content-Type': 'application/json',
      'User-Agent': 'AppMissao-Backend/1.0'
    },
    body: JSON.stringify(payload)
  });
  
  if (!resp.ok) {
    let bodyText = await resp.text();
    let bodyJson = null;
    try { bodyJson = JSON.parse(bodyText); } catch (_) {}
    const track = resp.headers.get('x-meli-tracking-id') || '';
    
    // Log detalhado do erro
    console.error('❌ MP Preference Error (primeira tentativa):', {
      status: resp.status,
      code: bodyJson?.code,
      message: bodyJson?.message,
      error: bodyJson?.error,
      blocked_by: bodyJson?.blocked_by,
      tracking: track,
      token_preview: token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : 'N/A',
      has_token: !!token,
      token_length: token ? token.length : 0
    });
    
    // Se for erro 401, logar mais detalhes
    if (resp.status === 401) {
      console.error('🔴 ERRO 401 - Token não autorizado:', {
        token_starts_with: token ? token.substring(0, 15) : 'N/A',
        token_type: token ? (token.startsWith('TEST-') ? 'TEST' : token.startsWith('APP_USR-') ? 'PROD' : 'UNKNOWN') : 'N/A',
        error_details: bodyJson
      });
    }
    
    const policyUnauthorized = resp.status === 403 && bodyJson && (
      bodyJson.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || 
      /PolicyAgent/i.test(String(bodyJson.blocked_by || ''))
    );
    
    // Verificar erro específico de sponsor_id
    const sponsorIdError = resp.status === 400 && bodyJson && (
      (bodyJson.message && /sponsor_id.*collector_id|collector_id.*sponsor_id/i.test(String(bodyJson.message))) ||
      (bodyJson.error === 'bad_request' && /sponsor_id/i.test(String(bodyJson.message || '')))
    );
    
    // Se for erro de sponsor_id, remover do payload e tentar novamente
    if (sponsorIdError) {
      console.log('⚠️  Erro de sponsor_id detectado - removendo sponsor_id e tentando novamente...');
      console.log('   Erro: sponsor_id não pode ser igual ao collector_id');
      // Criar novo payload sem sponsor_id (versão minimal para garantir)
      payload = makePref(true); // Ultra minimal - não tem sponsor_id
      
      resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json',
          'User-Agent': 'AppMissao-Backend/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) {
        bodyText = await resp.text();
        try { bodyJson = JSON.parse(bodyText); } catch (_) {}
        const newTrack = resp.headers.get('x-meli-tracking-id') || '';
        
        console.error('MP Preference Error (sem sponsor_id):', {
          status: resp.status,
          code: bodyJson?.code,
          message: bodyJson?.message,
          tracking: newTrack
        });
      } else {
        console.log('✅ Preferência criada com sucesso (sem sponsor_id)!');
        // Se funcionou, sair da função de tratamento de erro
        const pref = await resp.json();
        return { 
          id: pref.id || pref.preference_id, 
          init_point: pref.sandbox_init_point || pref.init_point, 
          currency, 
          external_ref 
        };
      }
    }
    
    // Se for erro de PolicyAgent, tentar versão minimal
    if (!resp.ok && policyUnauthorized) {
      console.log('Tentando criar preferência minimal devido ao PolicyAgent...');
      payload = makePref(true); // Ultra minimal
      
      resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json',
          'User-Agent': 'AppMissao-Backend/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) {
        bodyText = await resp.text();
        try { bodyJson = JSON.parse(bodyText); } catch (_) {}
        const newTrack = resp.headers.get('x-meli-tracking-id') || '';
        
        console.error('MP Preference Error (tentativa minimal):', {
          status: resp.status,
          code: bodyJson?.code,
          message: bodyJson?.message,
          blocked_by: bodyJson?.blocked_by,
          causes: bodyJson?.causes,
          tracking: newTrack
        });
      } else {
        console.log('Preferência minimal criada com sucesso!');
        // Se funcionou, sair da função de tratamento de erro
        const pref = await resp.json();
        return { 
          id: pref.id || pref.preference_id, 
          init_point: pref.sandbox_init_point || pref.init_point, 
          currency, 
          external_ref 
        };
      }
    }
    
    // Se ainda falhou, lançar erro
    if (!resp.ok) {
      const msg = bodyJson && bodyJson.message ? bodyJson.message : bodyText;
      const details = bodyJson && Array.isArray(bodyJson.causes) && bodyJson.causes.length 
        ? bodyJson.causes.map(c => c.description || c.code || '').filter(Boolean).join('; ') 
        : '';
      const out = details ? `${msg} - ${details}` : msg;
      console.error('mp-preference-error-final', resp.status, out, track);
      
      // Verificar se é problema de token (401)
      if (resp.status === 401) {
        const tokenPreview = token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : 'não configurado';
        console.error('Erro 401 - Token inválido ou não autorizado:', {
          token_preview: tokenPreview,
          error: bodyJson,
          tracking: track
        });
        throw new Error(`Erro de autenticação do Mercado Pago (401). O token pode estar inválido, expirado ou não autorizado. Verifique a variável MP_ACCESS_TOKEN no servidor.`);
      }
      
      // Verificar se é problema de PolicyAgent (403)
      if (resp.status === 403 && policyUnauthorized) {
        throw new Error(`Erro de autorização do Mercado Pago (403 - PolicyAgent). As políticas de segurança estão bloqueando a criação da preferência. Tente configurar as URLs no painel do Mercado Pago.`);
      }
      
      throw new Error(`mp-preference-failed ${resp.status} ${out}`);
    }
  }
  
  const pref = await resp.json();
  console.log('Preferência criada com sucesso:', { 
    id: pref.id || pref.preference_id,
    has_init_point: !!pref.init_point,
    has_sandbox_init_point: !!pref.sandbox_init_point
  });
  
  return { 
    id: pref.id || pref.preference_id, 
    init_point: pref.sandbox_init_point || pref.init_point, 
    currency, 
    external_ref 
  };
}

function broadcast(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    try { client.send(msg); } catch (_) {}
  });

if (isVercel) {
  module.exports = serverless(app);
}
}

if (wss) {
  wss.on('connection', (ws) => {
    ws.on('error', () => {});
  });
}

async function ensureDatabase() {
  const host = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
  const user = process.env.MYSQL_USER || process.env.DB_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const dbName = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'appmissao';
  const conn = await mysql.createConnection({ host, user, password, port });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
  await conn.end();
}

async function ensureUsersTable() {
  const sql = `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureRoleColumn() {
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  const names = rows.map(r => r.Field);
  if (!names.includes('role')) {
    await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'cliente'");
  }
}

async function ensureMissionsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS missions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    lat DECIMAL(9,6),
    lng DECIMAL(9,6),
    budget DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureMissionColumns() {
  const [rows] = await pool.query('SHOW COLUMNS FROM missions');
  const names = rows.map(r => r.Field);
  if (!names.includes('location')) {
    await pool.query('ALTER TABLE missions ADD COLUMN location VARCHAR(255) NULL');
  }
  if (!names.includes('lat')) {
    await pool.query('ALTER TABLE missions ADD COLUMN lat DECIMAL(9,6) NULL');
  }
  if (!names.includes('lng')) {
    await pool.query('ALTER TABLE missions ADD COLUMN lng DECIMAL(9,6) NULL');
  }
  if (!names.includes('budget')) {
    await pool.query('ALTER TABLE missions ADD COLUMN budget DECIMAL(10,2) NULL');
  }
  if (!names.includes('category')) {
    await pool.query('ALTER TABLE missions ADD COLUMN category VARCHAR(64) NULL');
  }
  if (!names.includes('provider_id')) {
    await pool.query('ALTER TABLE missions ADD COLUMN provider_id INT NULL');
  }
  const statusCol = rows.find(r => r.Field === 'status');
  if (statusCol) {
    const m = String(statusCol.Type || '').match(/varchar\((\d+)\)/i);
    const len = m ? Number(m[1]) : 0;
    if (len && len < 32) {
      await pool.query("ALTER TABLE missions MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'open'");
    }
  }
}

async function ensureDiscoveryIndexes() {
  const [idx] = await pool.query('SHOW INDEX FROM missions');
  const names = idx.map(i => i.Key_name);
  if (!names.includes('idx_status')) {
    await pool.query('CREATE INDEX idx_status ON missions (status)');
  }
  if (!names.includes('idx_created')) {
    await pool.query('CREATE INDEX idx_created ON missions (created_at)');
  }
  if (!names.includes('idx_category')) {
    await pool.query('CREATE INDEX idx_category ON missions (category)');
  }
  if (!names.includes('idx_geo')) {
    await pool.query('CREATE INDEX idx_geo ON missions (lat, lng)');
  }
}

async function ensureProvidersTable() {
  const sql = `CREATE TABLE IF NOT EXISTS providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    document VARCHAR(32) NOT NULL,
    phone VARCHAR(32) NULL,
    category VARCHAR(64) NULL,
    bio TEXT NULL,
    service_radius_km INT NOT NULL DEFAULT 25,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_document (document),
    INDEX idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureProviderColumns() {
  const [rows] = await pool.query('SHOW COLUMNS FROM providers');
  const names = rows.map(r => r.Field);
  if (!names.includes('service_radius_km')) {
    await pool.query('ALTER TABLE providers ADD COLUMN service_radius_km INT NOT NULL DEFAULT 25');
  }
}

async function ensureProviderRadiusColumnSchema() {
  const [rows] = await pool.query('SHOW COLUMNS FROM providers');
  const col = rows.find(r => r.Field === 'service_radius_km');
  if (!col) return;
  const allowsNull = String(col.Null || '').toUpperCase() === 'YES';
  const hasDefault = col.Default != null;
  if (allowsNull || !hasDefault) {
    await pool.query('UPDATE providers SET service_radius_km = 25 WHERE service_radius_km IS NULL');
    await pool.query('ALTER TABLE providers MODIFY COLUMN service_radius_km INT NOT NULL DEFAULT 25');
  }
}

async function ensureProposalsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS proposals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    user_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    deadline_days INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role || 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findProviderByDocument(document) {
  const digits = String(document || '').replace(/\D+/g, '');
  const [rows] = await pool.query("SELECT * FROM providers WHERE REPLACE(REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', ''), ' ', '') = ? LIMIT 1", [digits]);
  return rows[0] || null;
}

async function findProviderByPhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  const [rows] = await pool.query("SELECT * FROM providers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '(', ''), ')', ''), '-', ''), ' ', '') = ? LIMIT 1", [digits]);
  return rows[0] || null;
}

async function resolvePasswordColumn() {
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  const names = rows.map(r => r.Field);
  if (names.includes('password_hash')) return 'password_hash';
  if (names.includes('password')) return 'password';
  if (names.includes('senha_hash')) return 'senha_hash';
  if (names.includes('senha')) return 'senha';
  return 'password_hash';
}

function normalizeUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role || 'cliente' };
}

function onlyDigits(s) {
  return String(s || '').replace(/\D+/g, '');
}

function validateCPF(cpf) {
  const d = onlyDigits(cpf);
  if (!d || d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0; for (let i = 0; i < 9; i++) sum += parseInt(d.charAt(i)) * (10 - i);
  let r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0; if (r !== parseInt(d.charAt(9))) return false;
  sum = 0; for (let i = 0; i < 10; i++) sum += parseInt(d.charAt(i)) * (11 - i);
  r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0; return r === parseInt(d.charAt(10));
}

function validateCNPJ(cnpj) {
  const d = onlyDigits(cnpj);
  if (!d || d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (base) => {
    let len = base.length, sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) { sum += parseInt(base[len - i]) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.substring(0, 12));
  const d2 = calc(d.substring(0, 12) + String(d1));
  return d.endsWith(String(d1) + String(d2));
}

function validatePhoneBR(phone) {
  const d = onlyDigits(phone);
  return d.length >= 10 && d.length <= 11;
}

function rateLimit(windowMs, max) {
  const store = new Map();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = store.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    store.set(key, entry);
    if (entry.count > max) return res.status(429).json({ message: 'Muitas requisições' });
    next();
  };
}

const RL_DISABLE = String(process.env.RATE_LIMIT_DISABLE || '0') === '1';
const RL_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RL_AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX || 30);
const authLimiter = RL_DISABLE ? ((req, res, next) => next()) : rateLimit(RL_WINDOW_MS, RL_AUTH_MAX);

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Dados inválidos' });
    const r = (role || 'cliente').toLowerCase();
    if (!['cliente', 'prestador'].includes(r)) return res.status(400).json({ message: 'Role inválido' });
    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) return res.status(400).json({ message: 'Email inválido' });
    if (String(password).length < 6) return res.status(400).json({ message: 'Senha curta' });
  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ message: 'E-mail já cadastrado' });
  const hash = await bcrypt.hash(password, 10);
  const passCol = await resolvePasswordColumn();
  const [result] = await pool.query(`INSERT INTO users (name, email, ${passCol}, role) VALUES (?, ?, ?, ?)`, [name, email, hash, r]);
  const user = { id: result.insertId, name, email, role: r };
  if (r === 'prestador') {
    const company_name = String(req.body.company_name || req.body.company || '').trim();
    const document = String(req.body.document || '').trim();
    const phone = String(req.body.phone || '').trim();
    const category = String(req.body.category || '').trim();
    const bio = String(req.body.bio || '').trim();
    if (!company_name || !document) return res.status(400).json({ message: 'Campos obrigatórios do prestador: empresa e documento' });
    const docExists = await findProviderByDocument(document);
    if (docExists) return res.status(409).json({ message: 'Documento já cadastrado' });
    if (phone) {
      const phoneExists = await findProviderByPhone(phone);
      if (phoneExists) return res.status(409).json({ message: 'Telefone já cadastrado' });
    }
    await pool.query('INSERT INTO providers (user_id, company_name, document, phone, category, bio) VALUES (?, ?, ?, ?, ?, ?)', [user.id, company_name, document, phone || null, category || null, bio || null]);
  }
  const token = signToken(user);
  res.status(201).json({ token, user });
} catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Dados inválidos' });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });
    const hash = user.password_hash || user.password || user.senha_hash || user.senha;
    if (!hash) return res.status(401).json({ message: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });
    const token = signToken(user);
    res.json({ token, user: normalizeUser(user) });
  } catch (err) {
    console.error(err);
    const msg = err && err.message ? String(err.message) : 'Erro interno';
    res.status(500).json({ message: msg });
  }
});

app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.json({ user: normalizeUser(req.user) });
    res.json({ user: normalizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/auth', (req, res) => {
  res.json({ status: 'ok', base: '/api/auth', endpoints: ['POST /login', 'POST /register', 'GET /me'] });
});

app.get('/api/auth/check-unique', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    const phone = String(req.query.phone || '').trim();
    const document = String(req.query.document || '').trim();
  const emailValid = email ? /.+@.+\..+/.test(email) : false;
  const phoneValid = phone ? validatePhoneBR(phone) : false;
  const docDigits = onlyDigits(document);
  const qType = String(req.query.type || '').toLowerCase();
  const docType = ['cpf', 'cnpj'].includes(qType) ? qType : (docDigits.length === 11 ? 'cpf' : (docDigits.length === 14 ? 'cnpj' : null));
  const docValid = Boolean(docDigits.length > 0);
  const emailTaken = email ? Boolean(await findUserByEmail(email)) : false;
  const phoneTaken = phone ? Boolean(await findProviderByPhone(phone)) : false;
  const documentTaken = document ? Boolean(await findProviderByDocument(document)) : false;
  res.json({ email: { valid: emailValid, taken: emailTaken }, phone: { valid: phoneValid, taken: phoneTaken }, document: { valid: docValid, taken: documentTaken, type: docType } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions', protect, async (req, res) => {
  try {
    const { title, description, location, budget, lat, lng } = req.body;
    if (!title || String(title).trim().length < 3) return res.status(400).json({ message: 'Título inválido' });
    const status = 'open';
    const userId = req.user.id;
    const b = budget != null ? Number(budget) : null;
    const la = lat != null ? Number(lat) : null;
    const lo = lng != null ? Number(lng) : null;
    const [result] = await pool.query(
      'INSERT INTO missions (user_id, title, description, location, lat, lng, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, String(title).trim(), description || null, location || null, la, lo, b, status]
    );
    const [rows] = await pool.query('SELECT * FROM missions WHERE id = ?', [result.insertId]);
    const mission = rows[0];
    try {
      const depoPct = readPercentEnv('PAYMENT_DEPOSIT_PERCENT', 30);
      const total = Number(mission.budget || 0);
      if (total > 0 && depoPct > 0) {
        const amount = Math.round((total * depoPct / 100) * 100) / 100;
        const pref = await createMpPreferenceForAmount({ mission, amount, kind: 'deposit', userEmail: req.user.email });
        await pool.query('INSERT INTO payments (mission_id, proposal_id, user_id, provider_id, amount, currency, status, mp_preference_id, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [mission.id, null, req.user.id, mission.provider_id || null, amount, pref.currency, 'pending', pref.id || null, pref.external_ref]);
        try { broadcast('payment_created', { mission_id: mission.id, kind: 'deposit', init_point: pref.init_point }); } catch (_) {}
        try { await notifyUsers([mission.user_id], 'payment', 'Pagamento iniciado', `Depósito da missão #${mission.id}`, { mission_id: mission.id, kind: 'deposit' }); } catch (_) {}
      }
    } catch (_) {}
    res.status(201).json({ mission });
    try { broadcast('mission_created', mission); } catch (_) {}
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
    const status = req.query.status || null;
    const offset = (page - 1) * pageSize;
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status, pageSize, offset] : [pageSize, offset];
    const [rows] = await pool.query(`SELECT * FROM missions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params);
    const [cnt] = await pool.query(`SELECT COUNT(*) as total FROM missions ${status ? 'WHERE status = ?' : ''}`, status ? [status] : []);
    res.json({ items: rows, page, pageSize, total: cnt[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/discover', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
    const offset = (page - 1) * pageSize;
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim() || null;
    const minBudget = req.query.minBudget != null ? Number(req.query.minBudget) : null;
    const maxBudget = req.query.maxBudget != null ? Number(req.query.maxBudget) : null;
    const order = String(req.query.order || 'newest');
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const radiusKm = req.query.radius_km != null ? Number(req.query.radius_km) : null;

    const whereClauses = ['status = \"open\"'];
    const params = [];
    if (category) { whereClauses.push('category = ?'); params.push(category); }
    if (minBudget != null) { whereClauses.push('budget IS NOT NULL AND budget >= ?'); params.push(minBudget); }
    if (maxBudget != null) { whereClauses.push('budget IS NOT NULL AND budget <= ?'); params.push(maxBudget); }
    if (q) { whereClauses.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    let distanceExpr = null;
    if (lat != null && lng != null) {
      distanceExpr = '6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(lat))))';
      if (radiusKm != null) {
        whereClauses.push(`lat IS NOT NULL AND lng IS NOT NULL AND (${distanceExpr}) <= ?`);
        params.push(lat, lng, lat, radiusKm);
      }
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    let selectSql = 'SELECT id, user_id, title, description, location, lat, lng, budget, status, created_at';
    if (distanceExpr) selectSql += `, ${distanceExpr} AS distance_km`;
    selectSql += ` FROM missions ${whereSql}`;

    let orderSql = ' ORDER BY created_at DESC';
    if (order === 'budget_high') orderSql = ' ORDER BY budget DESC, created_at DESC';
    if (order === 'distance' && distanceExpr) orderSql = ' ORDER BY distance_km ASC, created_at DESC';

    const limitSql = ' LIMIT ? OFFSET ?';
    const selParams = distanceExpr ? [...params, lat, lng, lat, pageSize, offset] : [...params, pageSize, offset];
    const [rows] = await pool.query(selectSql + orderSql + limitSql, selParams);

    const cntParams = params;
    const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM missions ${whereSql}`, cntParams);
    res.json({ items: rows, page, pageSize, total: cnt[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/mine', protect, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM missions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/assigned', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM missions WHERE provider_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Missão não encontrada' });
    res.json({ mission: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.patch('/api/missions/:id', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Missão não encontrada' });
    if (current.user_id !== req.user.id) return res.status(403).json({ message: 'Sem permissão' });
    const allowed = ['title', 'description', 'location', 'lat', 'lng', 'budget', 'status'];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if (updates.title && String(updates.title).trim().length < 3) return res.status(400).json({ message: 'Título inválido' });
    if (updates.status && !['open', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled'].includes(String(updates.status))) return res.status(400).json({ message: 'Status inválido' });
    const fields = Object.keys(updates);
  if (fields.length === 0) return res.json({ mission: current });
  const setSql = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => f === 'budget' ? Number(updates[f]) : updates[f]);
  values.push(id);
  await pool.query(`UPDATE missions SET ${setSql} WHERE id = ?`, values);
  const [out] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
  res.json({ mission: out[0] });
  try {
    broadcast('mission_updated', out[0]);
    broadcast('mission_status', { id: out[0].id, status: out[0].status, user_id: out[0].user_id, provider_id: out[0].provider_id });
    await notifyUsers([out[0].user_id, out[0].provider_id].filter(Boolean), 'mission', 'Missão atualizada', `Status: ${out[0].status}`, { mission_id: out[0].id, status: out[0].status });
  } catch (_) {}
  if (String(updates.status || '') === 'completed') {
    try {
      await pool.query("UPDATE payments SET status = 'released' WHERE mission_id = ? AND status = 'approved'", [id]);
      try { broadcast('payment_released', { mission_id: id }); } catch (_) {}
      try { await notifyUsers([out[0].provider_id].filter(Boolean), 'payment', 'Pagamento liberado', `Missão #${id} concluída`, { mission_id: id, kind: 'release' }); } catch (_) {}
    } catch (_) {}
  }
  if (String(updates.status || '') === 'cancelled') {
    try {
      const ext = `mission:${id}:deposit`;
      await pool.query("UPDATE payments SET status = 'released' WHERE mission_id = ? AND status = 'approved' AND external_ref = ?", [id, ext]);
      try { broadcast('payment_released', { mission_id: id, kind: 'deposit' }); } catch (_) {}
    } catch (_) {}
  }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/accept', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
    const mission = rows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    if (mission.status !== 'open') return res.status(400).json({ message: 'Missão indisponível' });
  await pool.query('UPDATE missions SET status = ?, provider_id = ? WHERE id = ?', ['in_progress', req.user.id, id]);
  const [out] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
  res.json({ mission: out[0] });
  try { broadcast('mission_status', { id: out[0].id, status: out[0].status, user_id: out[0].user_id, provider_id: out[0].provider_id }); } catch (_) {}
  try { await notifyUsers([out[0].user_id, out[0].provider_id].filter(Boolean), 'mission', 'Missão aceita', `Missão #${out[0].id} em progresso`, { mission_id: out[0].id, status: out[0].status }); } catch (_) {}
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/provider-status', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.user.role || 'cliente';
    const { status } = req.body;
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    if (!['awaiting_confirmation', 'cancelled'].includes(String(status))) return res.status(400).json({ message: 'Status inválido' });
    const [rows] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
    const mission = rows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    if (mission.provider_id !== req.user.id) return res.status(403).json({ message: 'Sem permissão' });
    if (!['in_progress', 'awaiting_confirmation'].includes(String(mission.status))) return res.status(400).json({ message: 'Estado atual não permite atualização' });
  await pool.query('UPDATE missions SET status = ? WHERE id = ?', [String(status), id]);
  const [out] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
  res.json({ mission: out[0] });
  try { broadcast('mission_status', { id: out[0].id, status: out[0].status, user_id: out[0].user_id, provider_id: out[0].provider_id }); } catch (_) {}
  if (String(status) === 'awaiting_confirmation') {
    try {
      const [props] = await pool.query("SELECT * FROM proposals WHERE mission_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1", [id]);
      const accepted = props[0] || null;
      const total = accepted ? Number(accepted.price) : Number(out[0].budget || 0);
      const remPct = readPercentEnv('PAYMENT_SECOND_PERCENT', 75);
      if (total > 0 && remPct > 0) {
        const amount = Math.round((total * remPct / 100) * 100) / 100;
        const pref = await createMpPreferenceForAmount({ mission: out[0], amount, kind: 'remainder', userEmail: null });
        await pool.query('INSERT INTO payments (mission_id, proposal_id, user_id, provider_id, amount, currency, status, mp_preference_id, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, accepted ? accepted.id : null, out[0].user_id, out[0].provider_id || null, amount, pref.currency, 'pending', pref.id || null, pref.external_ref]);
        try { broadcast('payment_created', { mission_id: id, kind: 'remainder', init_point: pref.init_point }); } catch (_) {}
      }
    } catch (_) {}
  }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/:id/chat', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM messages WHERE mission_id = ? ORDER BY created_at ASC, id ASC', [id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/chat/messages', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { type, content } = req.body;
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    if (!['in_progress', 'awaiting_confirmation'].includes(String(mission.status))) return res.status(400).json({ message: 'Chat disponível apenas para missões ativas' });
    const t = ['text', 'image'].includes(String(type || 'text')) ? String(type || 'text') : 'text';
    const c = String(content || '').trim();
    if (!c) return res.status(400).json({ message: 'Conteúdo vazio' });
    const [existingRows] = await pool.query(
      'SELECT * FROM messages WHERE mission_id = ? AND sender_id = ? AND content = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND) ORDER BY id DESC LIMIT 1',
      [id, req.user.id, c]
    );
    if (existingRows[0]) {
      const message = existingRows[0];
      return res.status(200).json({ message });
    }
    const [result] = await pool.query('INSERT INTO messages (mission_id, sender_id, type, content) VALUES (?, ?, ?, ?)', [id, req.user.id, t, c]);
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const message = rows[0];
    res.status(201).json({ message });
  try { broadcast('chat_message', { mission_id: id, message }); } catch (_) {}
  try {
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    const target = req.user.id === mission.user_id ? mission.provider_id : mission.user_id;
    if (target) await notifyUsers([target], 'chat', 'Nova mensagem', String(message.content || 'Mensagem'), { mission_id: id });
  } catch (_) {}
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/payments/preference', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    if (!owner) return res.status(403).json({ message: 'Sem permissão' });
    const [props] = await pool.query("SELECT * FROM proposals WHERE mission_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1", [id]);
  const accepted = props[0] || null;
  const kind = String(req.body.kind || 'full');
  const total = accepted ? Number(accepted.price) : Number(mission.budget || 0);
  let amount = total;
  if (kind === 'deposit') {
    const depoPct = readPercentEnv('PAYMENT_DEPOSIT_PERCENT', 30);
    amount = Math.round((total * depoPct / 100) * 100) / 100;
  } else if (kind === 'remainder') {
    const remPct = readPercentEnv('PAYMENT_SECOND_PERCENT', 75);
    amount = Math.round((total * remPct / 100) * 100) / 100;
  }
  if (!(amount > 0)) return res.status(400).json({ message: 'Valor inválido para pagamento' });
  const pref = await createMpPreferenceForAmount({ mission, amount, kind, userEmail: req.user.email });
  await pool.query('INSERT INTO payments (mission_id, proposal_id, user_id, provider_id, amount, currency, status, mp_preference_id, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, accepted ? accepted.id : null, req.user.id, mission.provider_id || null, amount, pref.currency, 'pending', pref.id || null, pref.external_ref]);
  res.json({ init_point: pref.init_point, preference_id: pref.id });
  try { await notifyUsers([mission.user_id], 'payment', 'Pagamento iniciado', `Missão #${id}`, { mission_id: id, kind }); } catch (_) {}
  } catch (err) {
    console.error(err);
    const msg = err && err.message ? String(err.message) : 'Erro interno';
    res.status(500).json({ message: msg });
  }
});

app.get('/api/payments/mp/public-key', async (req, res) => {
  try {
    const pub = process.env.MP_PUBLIC_KEY || '';
    if (!pub) return res.status(404).json({ message: 'MP_PUBLIC_KEY não configurado' });
    res.json({ public_key: pub });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/payments/card', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    if (!owner) return res.status(403).json({ message: 'Sem permissão' });
    const [props] = await pool.query("SELECT * FROM proposals WHERE mission_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1", [id]);
    const accepted = props[0] || null;
    const kind = String(req.body.kind || 'full');
    const total = accepted ? Number(accepted.price) : Number(mission.budget || 0);
    let amount = total;
    if (kind === 'deposit') {
      const depoPct = readPercentEnv('PAYMENT_DEPOSIT_PERCENT', 30);
      amount = Math.round((total * depoPct / 100) * 100) / 100;
    } else if (kind === 'remainder') {
      const remPct = readPercentEnv('PAYMENT_SECOND_PERCENT', 75);
      amount = Math.round((total * remPct / 100) * 100) / 100;
    }
    if (!(amount > 0)) return res.status(400).json({ message: 'Valor inválido para pagamento' });

    const token = String(req.body.token || '').trim();
    const payment_method_id = String(req.body.payment_method_id || '').trim();
    const installments = Number(req.body.installments || 1);
    const issuer_id = req.body.issuer_id != null ? Number(req.body.issuer_id) : undefined;
    const identification_type = String(req.body.identification_type || '').trim() || undefined;
    const identification_number = String(req.body.identification_number || '').trim() || undefined;
    if (!token || !payment_method_id) return res.status(400).json({ message: 'Dados de cartão incompletos' });

    const mpClient = getMPClient();
    if (!mpClient) return res.status(503).json({ message: 'Mercado Pago não configurado' });
    const external_ref = `mission:${mission.id}:${kind || 'full'}`;
    const body = {
      transaction_amount: parseFloat(amount.toFixed(2)),
      token,
      description: `Missão ${mission.id}`,
      payment_method_id,
      installments,
      external_reference: external_ref,
      payer: {
        email: req.user.email,
        identification: identification_type && identification_number ? { type: identification_type, number: identification_number } : undefined
      },
      issuer_id: issuer_id
    };

    let created = null;
    try {
      const payApi = new Payment(mpClient);
      const resp = await payApi.create({ body });
      created = resp && resp.body ? resp.body : resp;
    } catch (e) {
      const msg = e && e.message ? e.message : 'Falha ao criar pagamento';
      return res.status(400).json({ message: msg });
    }

    const status = String(created.status || 'pending');
    const paymentId = String(created.id || created.payment_id || '');
    await pool.query('INSERT INTO payments (mission_id, proposal_id, user_id, provider_id, amount, currency, status, mp_payment_id, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP', [id, accepted ? accepted.id : null, req.user.id, mission.provider_id || null, amount, 'BRL', status, paymentId || null, external_ref]);
    if (status === 'approved') {
      if (mission.status !== 'in_progress') {
        await pool.query('UPDATE missions SET status = ? WHERE id = ?', ['in_progress', id]);
        const [out] = await pool.query('SELECT * FROM missions WHERE id = ?', [id]);
        try {
          broadcast('mission_updated', out[0]);
          broadcast('mission_status', { id: out[0].id, status: out[0].status, user_id: out[0].user_id, provider_id: out[0].provider_id });
          await notifyUsers([out[0].user_id, out[0].provider_id].filter(Boolean), 'mission', 'Missão em progresso', `Pagamento aprovado na missão #${out[0].id}`, { mission_id: out[0].id, status: out[0].status });
        } catch (_) {}
      }
    } else {
      try { await notifyUsers([mission.user_id], 'payment', 'Pagamento iniciado', `Missão #${id}`, { mission_id: id, kind }); } catch (_) {}
    }

    res.json({ ok: true, status, payment_id: paymentId });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/reviews', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rating = Number(req.body.rating || 0);
    const comment = String(req.body.comment || '').trim();
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Nota inválida' });
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    if (!mrows.length) return res.status(404).json({ message: 'Missão não encontrada' });
    const mission = mrows[0];
    if (String(mission.status) !== 'completed') return res.status(400).json({ message: 'Avaliação permitida apenas após conclusão' });
    if (req.user.id !== mission.user_id) return res.status(403).json({ message: 'Apenas o cliente pode avaliar' });
    if (!mission.provider_id) return res.status(400).json({ message: 'Missão sem prestador' });
    const [exists] = await pool.query('SELECT * FROM reviews WHERE mission_id = ? AND rater_id = ? LIMIT 1', [id, req.user.id]);
    if (exists.length) return res.status(400).json({ message: 'Avaliação já registrada' });
    const abuses = [];
    const lower = comment.toLowerCase();
    const bad = ['idiota','burro','lixo','ofensa','palavrão'];
    if (comment.length > 0) {
      for (const w of bad) { if (lower.includes(w)) abuses.push(w); }
      const repeated = /(.)\1{5,}/.test(comment);
      const tooLong = comment.length > 1000;
      if (repeated) abuses.push('repeticao');
      if (tooLong) abuses.push('muito_longo');
    }
    const moderated = abuses.length ? 1 : 0;
    const status = moderated ? 'blocked' : 'published';
    await pool.query('INSERT INTO reviews (mission_id, provider_id, rater_id, rating, comment, status, moderated, abuse_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, mission.provider_id, req.user.id, rating, comment || null, status, moderated, abuses.length ? JSON.stringify(abuses) : null]);
    const [prow] = await pool.query('SELECT rating_avg, rating_count FROM providers WHERE id = ? LIMIT 1', [mission.provider_id]);
    let avg = 0, count = 0;
    if (prow.length) { avg = Number(prow[0].rating_avg || 0); count = Number(prow[0].rating_count || 0); }
    const newCount = count + 1;
    const newAvg = Number(((avg * count + rating) / newCount).toFixed(2));
    await pool.query('UPDATE providers SET rating_avg = ?, rating_count = ?, last_review_at = CURRENT_TIMESTAMP WHERE id = ?', [newAvg, newCount, mission.provider_id]);
    res.json({ ok: true, rating: newAvg, count: newCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/providers/:id/rating', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT rating_avg, rating_count, last_review_at FROM providers WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Prestador não encontrado' });
    res.json({ rating: Number(rows[0].rating_avg || 0), count: Number(rows[0].rating_count || 0), last_review_at: rows[0].last_review_at });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/providers/:id/reviews', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;
    const [rows] = await pool.query('SELECT r.id, r.rating, r.comment, r.status, r.moderated, r.created_at, u.name AS rater_name FROM reviews r JOIN users u ON u.id = r.rater_id WHERE r.provider_id = ? AND r.status = "published" ORDER BY r.created_at DESC LIMIT ? OFFSET ?', [id, limit, offset]);
    res.json({ reviews: rows, page, limit });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/payments/:id', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Pagamento não encontrado' });
    const p = rows[0];
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [p.mission_id]);
    if (!mrows.length) return res.status(404).json({ message: 'Missão não encontrada' });
    const mission = mrows[0];
    if (req.user.id !== mission.client_id && req.user.id !== mission.provider_id) return res.status(403).json({ message: 'Sem permissão' });
    res.json({ payment: p });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/payments/:id/refund', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Pagamento não encontrado' });
    const p = rows[0];
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [p.mission_id]);
    if (!mrows.length) return res.status(404).json({ message: 'Missão não encontrada' });
    const mission = mrows[0];
    if (req.user.id !== mission.client_id) return res.status(403).json({ message: 'Apenas o cliente pode solicitar estorno' });
    if (!p.mp_payment_id) return res.status(400).json({ message: 'Pagamento MP inexistente' });
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ message: 'Mercado Pago não configurado' });
    const body = amount > 0 ? { amount } : {};
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${p.mp_payment_id}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const txt = await r.text();
    let data = null;
    try { data = JSON.parse(txt); } catch (_) {}
    if (!r.ok) return res.status(r.status).json({ message: (data && data.message) || txt });
    const refunds = Array.isArray(data) ? data : [data];
    const total = refunds.reduce((s, rf) => s + Number(rf && rf.amount || 0), 0);
    const refAt = refunds.length ? (refunds[0].date_created || null) : null;
    await pool.query('UPDATE payments SET refund_status = ?, refund_amount = ?, refunded_at = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['refunded', total || null, refAt, 'refunded', id]);
    res.json({ ok: true, refunds });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno' });
  }
});
// Rota GET para verificar status do token do Mercado Pago
app.get('/api/payments/mp/status', async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    const tokenPreview = token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : null;
    const hasToken = !!token;
    const mpTokenType = process.env.MP_TOKEN_TYPE || '';
    // Detectar tipo do token - pode ser forçado via MP_TOKEN_TYPE
    let isTestToken = false;
    let isProdToken = false;
    if (token) {
      if (mpTokenType.toLowerCase() === 'test' || mpTokenType.toLowerCase() === 'teste') {
        isTestToken = true;
      } else if (mpTokenType.toLowerCase() === 'production' || mpTokenType.toLowerCase() === 'producao') {
        isProdToken = true;
      } else if (token.startsWith('TEST-')) {
        isTestToken = true;
      } else if (token.startsWith('APP_USR-')) {
        // Por padrão assume produção, mas pode ser teste também
        // Se não especificado, assumir produção
        isProdToken = true;
      }
    }
    
    let tokenStatus = 'unknown';
    let tokenValid = false;
    
    if (hasToken) {
      // Tentar validar o token fazendo uma requisição simples
      try {
        const testResp = await fetch('https://api.mercadopago.com/v1/payment_methods', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (testResp.ok) {
          tokenStatus = 'valid';
          tokenValid = true;
        } else if (testResp.status === 401) {
          tokenStatus = 'invalid_or_expired';
          tokenValid = false;
        } else {
          tokenStatus = 'error';
          tokenValid = false;
        }
      } catch (err) {
        tokenStatus = 'validation_error';
        tokenValid = false;
      }
    }
    
    res.json({
      status: 'ok',
      token: {
        configured: hasToken,
        preview: tokenPreview,
        type: isTestToken ? 'test' : isProdToken ? 'production' : 'unknown',
        status: tokenStatus,
        valid: tokenValid
      },
      webhook: { url: process.env.MP_WEBHOOK_URL || 'Não configurado', configured: !!process.env.MP_WEBHOOK_URL },
      recommendations: !hasToken ? [
        'Configure a variável MP_ACCESS_TOKEN no servidor',
        'Obtenha o token em: https://www.mercadopago.com.br/developers/panel/credentials'
      ] : !tokenValid ? [
        'O token parece estar inválido ou expirado',
        'Gere um novo token em: https://www.mercadopago.com.br/developers/panel/credentials',
        'Reinicie o servidor após atualizar o token'
      ] : []
    });
  } catch (err) {
    console.error('Erro ao verificar status do MP:', err);
    res.status(500).json({ message: 'Erro ao verificar status do Mercado Pago', error: err.message });
  }
});

// Rota GET para testar se o webhook está configurado corretamente
app.get('/api/payments/mp/webhook', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
    const webhookUrl = `${baseUrl}/api/payments/mp/webhook`;
    const token = process.env.MP_ACCESS_TOKEN;
    
    res.json({
      status: 'ok',
      message: 'Webhook do Mercado Pago está ativo',
      webhook_url: webhookUrl,
      instructions: {
        step1: 'Acesse: https://www.mercadopago.com.br/developers/panel/app',
        step2: 'Selecione sua aplicação',
        step3: 'Vá em "Webhooks" ou "Notificações IPN"',
        step4: `Configure a URL: ${webhookUrl}`,
        step5: 'Salve as configurações'
      },
      current_config: {
        mp_webhook_url: process.env.MP_WEBHOOK_URL || 'Não configurado',
        mp_access_token: token ? 'Configurado' : 'Não configurado',
        token_valid: token ? 'Verifique em /api/payments/mp/status' : 'N/A'
      }
    });
  } catch (err) {
    console.error('Erro ao verificar webhook:', err);
    res.status(500).json({ message: 'Erro ao verificar configuração do webhook' });
  }
});

// Rota POST para receber notificações do Mercado Pago
app.post('/api/payments/mp/webhook', async (req, res) => {
  const startTime = Date.now();
  let notificationData = {
    type: null,
    payment_id: null,
    received_at: new Date().toISOString(),
    processed: false,
    error: null
  };

  try {
    // Log da notificação recebida
    const type = String(req.body.type || req.query.type || '');
    const id = Number((req.body.data && req.body.data.id) || req.query['data.id'] || 0);
    
    notificationData.type = type;
    notificationData.payment_id = id;
    
    console.log('=== Webhook MP Recebido ===', {
      type,
      id,
      timestamp: new Date().toISOString(),
      body: req.body,
      query: req.query,
      headers: {
        'user-agent': req.get('user-agent'),
        'x-forwarded-for': req.get('x-forwarded-for'),
        'x-real-ip': req.get('x-real-ip')
      }
    });

    // Validar se é uma notificação de pagamento
    if (type !== 'payment' || !id) {
      console.log('Notificação ignorada - tipo ou ID inválido:', { type, id });
      notificationData.error = 'Tipo ou ID inválido';
      return res.status(200).json({ 
        ok: true, 
        message: 'Notificação recebida mas ignorada (tipo ou ID inválido)',
        type,
        id 
      });
    }

    // Buscar dados do pagamento no Mercado Pago
    const token = getMPToken();
    if (!token) {
      console.error('MP_ACCESS_TOKEN não configurado - não é possível processar webhook');
      notificationData.error = 'Token não configurado';
      return res.status(503).json({ 
        ok: false,
        message: 'Mercado Pago não configurado. Verifique a variável MP_ACCESS_TOKEN.' 
      });
    }

    const client = getMPClient();
    let paymentData = null;
    let pay = null;

    try {
      if (client) {
        try {
          const payApi = new Payment(client);
          pay = await payApi.get({ id });
          paymentData = pay && pay.body ? pay.body : pay;
        } catch (e) {
          console.log('Erro ao buscar com SDK v2, tentando v1:', e.message);
          // Verificar se é erro 401
          if (e.status === 401 || (e.response && e.response.status === 401)) {
            console.error('Erro 401 ao buscar pagamento - token inválido');
            notificationData.error = 'Token inválido (401)';
            return res.status(200).json({ 
              ok: false,
              message: 'Token do Mercado Pago inválido. Verifique MP_ACCESS_TOKEN.' 
            });
          }
          const mpv1 = getMP();
          if (!mpv1) {
            console.error('Mercado Pago não configurado');
            notificationData.error = 'Mercado Pago não configurado';
            return res.status(503).json({ message: 'Mercado Pago não configurado' });
          }
          pay = await mpv1.payment.get(id);
          paymentData = pay && pay.body ? pay.body : pay;
        }
      } else {
        const mpv1 = getMP();
        if (!mpv1) {
          console.error('Mercado Pago não configurado');
          notificationData.error = 'Mercado Pago não configurado';
          return res.status(503).json({ message: 'Mercado Pago não configurado' });
        }
        try {
          pay = await mpv1.payment.get(id);
          paymentData = pay && pay.body ? pay.body : pay;
        } catch (e) {
          // Verificar se é erro 401
          if (e.status === 401 || (e.response && e.response.status === 401)) {
            console.error('Erro 401 ao buscar pagamento - token inválido');
            notificationData.error = 'Token inválido (401)';
            return res.status(200).json({ 
              ok: false,
              message: 'Token do Mercado Pago inválido. Verifique MP_ACCESS_TOKEN.' 
            });
          }
          throw e;
        }
      }

      if (!paymentData) {
        console.error('Dados do pagamento não encontrados no MP');
        notificationData.error = 'Pagamento não encontrado';
        return res.status(404).json({ message: 'Pagamento não encontrado' });
      }

      const status = String(paymentData.status || 'pending');
      const amount = Number(paymentData.transaction_amount || 0);
      const ext = String(paymentData.external_reference || '');
      const currencyId = String(paymentData.currency_id || 'BRL');
      const statusDetail = String(paymentData.status_detail || '');
      const methodId = String(paymentData.payment_method_id || '');
      const payerEmail = String((paymentData.payer && paymentData.payer.email) || '');
      const collectorId = String(paymentData.collector_id || '');
      const netReceived = Number(paymentData.net_received_amount || 0);
      const feeAmount = Array.isArray(paymentData.fee_details) ? paymentData.fee_details.reduce((s, f) => s + Number(f && f.amount || 0), 0) : null;
      const installments = Number(paymentData.installments || 0);
      const cardLastFour = String((paymentData.card && paymentData.card.last_four_digits) || '');
      const orderId = String((paymentData.order && paymentData.order.id) || '');
      const moneyReleaseDate = paymentData.money_release_date ? new Date(paymentData.money_release_date) : null;
      const refunds = Array.isArray(paymentData.refunds) ? paymentData.refunds : [];
      const refundStatus = refunds.length ? 'refunded' : null;
      const refundAmount = refunds.length ? refunds.reduce((s, r) => s + Number(r && r.amount || 0), 0) : null;
      const refundedAt = refunds.length ? (refunds[0].date_created || null) : null;
      const canceledAt = status === 'cancelled' ? new Date().toISOString() : null;
      let missionId = null;
      const mMatch = ext.match(/mission:(\d+)/);
      if (mMatch) missionId = Number(mMatch[1]);

      console.log('Processando pagamento:', {
        payment_id: paymentData.id,
        status,
        amount,
        external_ref: ext,
        mission_id: missionId
      });

      // Atualizar ou criar registro de pagamento
      const [existing] = await pool.query(
        'SELECT * FROM payments WHERE mp_payment_id = ? OR external_ref = ? LIMIT 1', 
        [String(paymentData.id), ext]
      );
      
      if (existing.length > 0) {
        const oldStatus = existing[0].status;
        await pool.query(
          'UPDATE payments SET mp_payment_id = ?, status = ?, status_detail = ?, amount = ?, currency = ?, payment_method_id = ?, payer_email = ?, collector_id = ?, net_received = ?, fee_amount = ?, installments = ?, card_last_four = ?, order_id = ?, money_release_date = ?, refund_status = ?, refund_amount = ?, refunded_at = ?, canceled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          [String(paymentData.id), status, statusDetail, amount, currencyId, methodId, payerEmail, collectorId || null, netReceived || null, feeAmount || null, installments || null, cardLastFour || null, orderId || null, moneyReleaseDate || null, refundStatus || null, refundAmount || null, refundedAt || null, canceledAt || null, existing[0].id]
        );
        console.log('Pagamento atualizado:', {
          payment_db_id: existing[0].id,
          old_status: oldStatus,
          new_status: status
        });
      } else if (ext) {
        await pool.query(
          'INSERT INTO payments (mission_id, mp_payment_id, amount, currency, status, status_detail, payment_method_id, payer_email, collector_id, net_received, fee_amount, installments, card_last_four, order_id, money_release_date, refund_status, refund_amount, refunded_at, canceled_at, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [missionId, String(paymentData.id), amount, currencyId, status, statusDetail || null, methodId || null, payerEmail || null, collectorId || null, netReceived || null, feeAmount || null, installments || null, cardLastFour || null, orderId || null, moneyReleaseDate || null, refundStatus || null, refundAmount || null, refundedAt || null, canceledAt || null, ext]
        );
        console.log('Novo pagamento criado no banco');
      }

      // Atualizar status da missão se pagamento aprovado
      if (missionId && status === 'approved') {
        const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [missionId]);
        const mission = mrows[0];
        if (mission && mission.status !== 'in_progress') {
          const newStatus = 'in_progress';
          await pool.query('UPDATE missions SET status = ? WHERE id = ?', [newStatus, missionId]);
          const [out] = await pool.query('SELECT * FROM missions WHERE id = ?', [missionId]);
          console.log('Missão atualizada para in_progress:', { mission_id: missionId });
          try {
            broadcast('mission_updated', out[0]);
            broadcast('mission_status', { 
              id: out[0].id, 
              status: out[0].status, 
              user_id: out[0].user_id, 
              provider_id: out[0].provider_id 
            });
            await notifyUsers([out[0].user_id, out[0].provider_id].filter(Boolean), 'mission', 'Missão em progresso', `Pagamento aprovado na missão #${out[0].id}`, { mission_id: out[0].id, status: out[0].status });
          } catch (err) {
            console.error('Erro ao fazer broadcast:', err);
          }
        }
      }

      notificationData.processed = true;
      const processingTime = Date.now() - startTime;
      
      console.log('=== Webhook Processado com Sucesso ===', {
        payment_id: paymentData.id,
        status,
        mission_id: missionId,
        processing_time_ms: processingTime
      });

      res.json({ 
        ok: true, 
        message: 'Notificação processada com sucesso',
        payment_id: paymentData.id,
        status,
        mission_id: missionId
      });
    } catch (err) {
      console.error('Erro ao processar webhook do pagamento:', err);
      notificationData.error = err.message;
      // Sempre retornar 200 para evitar retentativas desnecessárias do MP
      res.status(200).json({ 
        ok: false, 
        error: 'Erro ao processar notificação (logado para investigação)',
        message: err.message 
      });
    }
  } catch (err) {
    console.error('Erro geral no webhook:', err);
    notificationData.error = err.message;
    // Sempre retornar 200 para evitar retentativas do Mercado Pago
    res.status(200).json({ 
      ok: false, 
      error: 'Erro processado',
      message: err.message 
    });
  }
});

app.get('/api/missions/:id/payments', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM payments WHERE mission_id = ? ORDER BY created_at DESC', [id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/chat/summary', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    const uid = req.user.id;
    const items = [];
    if (role === 'cliente') {
      const [missions] = await pool.query('SELECT id, title, provider_id FROM missions WHERE user_id = ? ORDER BY created_at DESC', [uid]);
      for (const m of missions) {
        const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM messages WHERE mission_id = ? AND sender_id = ? AND seen_by_user_at IS NULL', [m.id, m.provider_id]);
        const [lastRows] = await pool.query('SELECT id, type, content, created_at, sender_id FROM messages WHERE mission_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [m.id]);
        items.push({ mission_id: m.id, title: m.title, unread: unread || 0, last_message: lastRows[0] || null });
      }
    } else {
      const [missions] = await pool.query('SELECT id, title, user_id FROM missions WHERE provider_id = ? ORDER BY created_at DESC', [uid]);
      for (const m of missions) {
        const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM messages WHERE mission_id = ? AND sender_id = ? AND seen_by_provider_at IS NULL', [m.id, m.user_id]);
        const [lastRows] = await pool.query('SELECT id, type, content, created_at, sender_id FROM messages WHERE mission_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [m.id]);
        items.push({ mission_id: m.id, title: m.title, unread: unread || 0, last_message: lastRows[0] || null });
      }
    }
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn('R2 client não inicializado', {
      endpoint: endpoint || null,
      accountId: accountId || null,
      hasAccessKey: !!accessKeyId,
      hasSecretKey: !!secretAccessKey
    });
    return null;
  }
  return new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sanitizeExt(s) {
  const e = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return e || 'bin';
}

function slugify(s) {
  const t = String(s || '').toLowerCase().trim();
  const a = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return a.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';
}

function allowContentType(ct) {
  const s = String(ct || '').toLowerCase();
  return s.startsWith('image/') || s === 'application/octet-stream';
}

function buildPublicUrl(key) {
  const baseRaw = String(process.env.R2_PUBLIC_BASE_URL || '').trim();
  const bucket = process.env.R2_BUCKET;
  if (!baseRaw || !bucket || !key) return null;
  const base = baseRaw.replace(/`/g, '').replace(/\/+$/,'');
  const endsWithBucket = base.endsWith(`/${bucket}`);
  const pathBase = endsWithBucket ? base : `${base}/${bucket}`;
  return `${pathBase}/${key}`;
}

async function maybePublicUrl(key) {
  try {
    const url = buildPublicUrl(key);
    if (!url) return null;
    const res = await fetch(url, { method: 'HEAD' });
    return res && res.ok ? url : null;
  } catch (_) {
    return null;
  }
}

app.post('/api/media/presign', protect, async (req, res) => {
  try {
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET;
    if (!r2 || !bucket) {
      console.warn('R2 indisponível para presign', {
        hasClient: !!r2,
        bucket: bucket || null,
        endpoint: process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null),
        accessKeyId: !!process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
        accountId: !!process.env.R2_ACCOUNT_ID
      });
      return res.status(500).json({ message: 'Storage indisponível' });
    }
    const scope = String(req.body.scope || 'mission');
    const kind = String(req.body.kind || 'image');
    const contentType = String(req.body.contentType || 'application/octet-stream');
    const ext = sanitizeExt(req.body.ext || 'bin');
    if (!allowContentType(contentType)) return res.status(400).json({ message: 'Tipo não permitido' });
    let missionId = Number(req.body.mission_id || 0);
    let prefix = `uploads/${scope}/${req.user.id}`;
    if (scope === 'mission') {
      if (!missionId) return res.status(400).json({ message: 'Missão inválida' });
      const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [missionId]);
      const mission = mrows[0];
      if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
      const owner = mission.user_id === req.user.id;
      const provider = mission.provider_id === req.user.id;
      if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
      const cat = slugify(mission.category);
      prefix = `app/${cat}/mission/${missionId}`;
    }
    if (scope === 'portfolio') {
      const [prows] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
      const providerRow = prows[0];
      const cat = slugify(providerRow && providerRow.category);
      prefix = `app/${cat}/portfolio/${req.user.id}`;
    }
    const key = `${prefix}/${randomId()}.${ext}`;
    const put = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(r2, put, { expiresIn: 900 });
    const publicUrl = buildPublicUrl(key);
    let viewUrl = publicUrl;
    if (!viewUrl) {
      const get = new GetObjectCommand({ Bucket: bucket, Key: key });
      viewUrl = await getSignedUrl(r2, get, { expiresIn: 900 });
    }
    res.json({ uploadUrl, viewUrl, key, kind, maxSize: 8388608 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/media/upload', protect, upload.single('file'), async (req, res) => {
  try {
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET;
    if (!r2 || !bucket) return res.status(500).json({ message: 'Storage indisponível' });
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Arquivo ausente' });
    const contentType = String(file.mimetype || 'application/octet-stream');
    if (!allowContentType(contentType)) return res.status(400).json({ message: 'Tipo não permitido' });
    const max = 8388608;
    if (file.size != null && file.size > max) return res.status(413).json({ message: 'Arquivo muito grande' });
    const scope = String(req.body.scope || 'mission');
    const kind = String(req.body.kind || 'image');
    let prefix = `uploads/${scope}/${req.user.id}`;
    if (scope === 'mission') {
      const missionId = Number(req.body.mission_id || 0);
      if (!missionId) return res.status(400).json({ message: 'Missão inválida' });
      const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [missionId]);
      const mission = mrows[0];
      if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
      const owner = mission.user_id === req.user.id;
      const provider = mission.provider_id === req.user.id;
      if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
      const cat = slugify(mission.category);
      prefix = `app/${cat}/mission/${missionId}`;
    }
    if (scope === 'portfolio') {
      const role = req.user.role || 'cliente';
      if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
      const [prows] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
      const providerRow = prows[0];
      const cat = slugify(providerRow && providerRow.category);
      prefix = `app/${cat}/portfolio/${req.user.id}`;
    }
    const ext = sanitizeExt(String((file.originalname || '').split('.').pop() || 'bin'));
    const key = `${prefix}/${randomId()}.${ext}`;
    await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: contentType }));
    if (scope === 'mission') {
      const missionId = Number(req.body.mission_id || 0);
      await pool.query('INSERT INTO mission_media (mission_id, user_id, kind, s3_key) VALUES (?, ?, ?, ?)', [missionId, req.user.id, kind, key]);
      const [rows] = await pool.query('SELECT * FROM mission_media WHERE mission_id = ? ORDER BY created_at DESC', [missionId]);
      return res.status(201).json({ items: rows });
    }
    if (scope === 'portfolio') {
      await pool.query('INSERT INTO provider_media (user_id, kind, s3_key) VALUES (?, ?, ?)', [req.user.id, kind, key]);
      const [rows] = await pool.query('SELECT * FROM provider_media WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      return res.status(201).json({ items: rows });
    }
    const publicUrl = buildPublicUrl(key);
    if (publicUrl) {
      return res.status(201).json({ key, url: publicUrl });
    }
    const get = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(r2, get, { expiresIn: 900 });
    res.status(201).json({ key, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/media', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { key, kind } = req.body;
    if (!key) return res.status(400).json({ message: 'Chave inválida' });
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    await pool.query('INSERT INTO mission_media (mission_id, user_id, kind, s3_key) VALUES (?, ?, ?, ?)', [id, req.user.id, String(kind || 'image'), String(key)]);
    const [rows] = await pool.query('SELECT * FROM mission_media WHERE mission_id = ? ORDER BY created_at DESC', [id]);
    res.status(201).json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/:id/media', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM mission_media WHERE mission_id = ? ORDER BY created_at DESC', [id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.delete('/api/missions/:id/media/:mid', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const mid = Number(req.params.mid);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    const [[media]] = await pool.query('SELECT * FROM mission_media WHERE id = ? AND mission_id = ? LIMIT 1', [mid, id]);
    if (!media) return res.status(404).json({ message: 'Mídia não encontrada' });
    await pool.query('DELETE FROM mission_media WHERE id = ?', [mid]);
    try {
      const r2 = getR2Client();
      const bucket = process.env.R2_BUCKET;
      if (r2 && bucket) {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.s3_key }));
      }
    } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/media/view', protect, async (req, res) => {
  try {
    const bucket = process.env.R2_BUCKET;
    const key = String(req.query.key || '');
    if (!key) return res.status(400).json({ message: 'Chave inválida' });
    const publicUrl = await maybePublicUrl(key);
    if (publicUrl) return res.json({ url: publicUrl });
    const r2 = getR2Client();
    if (!r2 || !bucket) return res.status(500).json({ message: 'Storage indisponível' });
    const get = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(r2, get, { expiresIn: 900 });
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});
app.get('/api/provider/media', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM provider_media WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/provider/media', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const { key, kind } = req.body;
    if (!key) return res.status(400).json({ message: 'Chave inválida' });
    await pool.query('INSERT INTO provider_media (user_id, kind, s3_key) VALUES (?, ?, ?)', [req.user.id, String(kind || 'image'), String(key)]);
    const [rows] = await pool.query('SELECT * FROM provider_media WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.status(201).json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.delete('/api/provider/media/:mid', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const mid = Number(req.params.mid);
    const [[media]] = await pool.query('SELECT * FROM provider_media WHERE id = ? AND user_id = ? LIMIT 1', [mid, req.user.id]);
    if (!media) return res.status(404).json({ message: 'Mídia não encontrada' });
    await pool.query('DELETE FROM provider_media WHERE id = ?', [mid]);
    try {
      const r2 = getR2Client();
      const bucket = process.env.R2_BUCKET;
      if (r2 && bucket) await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.s3_key }));
    } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/media/cleanup', protect, async (req, res) => {
  try {
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET;
    if (!r2 || !bucket) return res.status(500).json({ message: 'Storage indisponível' });
    const scope = String(req.body.scope || 'mission');
    if (scope === 'mission') {
      const mid = Number(req.body.mission_id || 0);
      if (!mid) return res.status(400).json({ message: 'Missão inválida' });
      const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [mid]);
      const mission = mrows[0];
      if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
      const owner = mission.user_id === req.user.id;
      const provider = mission.provider_id === req.user.id;
      if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
      const cat = slugify(mission.category);
      const prefix = `app/${cat}/mission/${mid}`;
      const [rows] = await pool.query('SELECT s3_key FROM mission_media WHERE mission_id = ?', [mid]);
      const existing = new Set(rows.map(r => r.s3_key));
      const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
      const contents = listed.Contents || [];
      let removed = 0;
      for (const obj of contents) {
        const key = obj.Key;
        if (key && !existing.has(key)) {
          await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          removed++;
        }
      }
      return res.json({ ok: true, removed });
    }
    if (scope === 'portfolio') {
      const role = req.user.role || 'cliente';
      if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
      const [prows] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
      const providerRow = prows[0];
      const cat = slugify(providerRow && providerRow.category);
      const prefix = `app/${cat}/portfolio/${req.user.id}`;
      const [rows] = await pool.query('SELECT s3_key FROM provider_media WHERE user_id = ?', [req.user.id]);
      const existing = new Set(rows.map(r => r.s3_key));
      const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
      const contents = listed.Contents || [];
      let removed = 0;
      for (const obj of contents) {
        const key = obj.Key;
        if (key && !existing.has(key)) {
          await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          removed++;
        }
      }
      return res.json({ ok: true, removed });
    }
    res.status(400).json({ message: 'Scope inválido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/missions/:id/chat/seen', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === req.user.id;
    const provider = mission.provider_id === req.user.id;
    if (!owner && !provider) return res.status(403).json({ message: 'Sem permissão' });
    if (owner) {
      const [toMark] = await pool.query('SELECT id FROM messages WHERE mission_id = ? AND sender_id = ? AND seen_by_user_at IS NULL', [id, mission.provider_id]);
      const ids = toMark.map(r => r.id);
      if (ids.length > 0) {
        await pool.query('UPDATE messages SET seen_by_user_at = CURRENT_TIMESTAMP WHERE mission_id = ? AND sender_id = ? AND seen_by_user_at IS NULL', [id, mission.provider_id]);
      }
      res.json({ updated: ids.length, ids, viewer: 'owner' });
      try { broadcast('chat_seen', { mission_id: id, ids, viewer: 'owner' }); } catch (_) {}
      return;
    }
    if (provider) {
      const [toMark] = await pool.query('SELECT id FROM messages WHERE mission_id = ? AND sender_id = ? AND seen_by_provider_at IS NULL', [id, mission.user_id]);
      const ids = toMark.map(r => r.id);
      if (ids.length > 0) {
        await pool.query('UPDATE messages SET seen_by_provider_at = CURRENT_TIMESTAMP WHERE mission_id = ? AND sender_id = ? AND seen_by_provider_at IS NULL', [id, mission.user_id]);
      }
      res.json({ updated: ids.length, ids, viewer: 'provider' });
      try { broadcast('chat_seen', { mission_id: id, ids, viewer: 'provider' }); } catch (_) {}
      return;
    }
    res.json({ updated: 0, ids: [], viewer: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/proposals', protect, async (req, res) => {
  try {
    const { mission_id, price, deadline_days } = req.body;
    const userId = req.user.id;
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const mid = Number(mission_id);
    if (!mid || price == null || deadline_days == null) return res.status(400).json({ message: 'Dados inválidos' });
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [mid]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    if (mission.status !== 'open') return res.status(400).json({ message: 'Missão indisponível' });
    const p = Number(price);
    const d = Number(deadline_days);
    if (!(p > 0) || !(d > 0)) return res.status(400).json({ message: 'Valores inválidos' });
    const [result] = await pool.query(
      'INSERT INTO proposals (mission_id, user_id, price, deadline_days) VALUES (?, ?, ?, ?)',
      [mid, userId, p, d]
    );
    const [rows] = await pool.query('SELECT * FROM proposals WHERE id = ?', [result.insertId]);
    res.status(201).json({ proposal: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/missions/:id/proposals', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    const owner = mission.user_id === userId;
    const role = req.user.role || 'cliente';
    if (!owner && role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query(owner ? 'SELECT * FROM proposals WHERE mission_id = ? ORDER BY created_at DESC' : 'SELECT * FROM proposals WHERE mission_id = ? AND user_id = ? ORDER BY created_at DESC', owner ? [id] : [id, userId]);
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.patch('/api/proposals/:id', protect, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const userId = req.user.id;
    if (!['accepted', 'rejected'].includes(String(status))) return res.status(400).json({ message: 'Status inválido' });
    const [prows] = await pool.query('SELECT * FROM proposals WHERE id = ? LIMIT 1', [id]);
    const prop = prows[0];
    if (!prop) return res.status(404).json({ message: 'Proposta não encontrada' });
    const [mrows] = await pool.query('SELECT * FROM missions WHERE id = ? LIMIT 1', [prop.mission_id]);
    const mission = mrows[0];
    if (!mission) return res.status(404).json({ message: 'Missão não encontrada' });
    if (mission.user_id !== userId) return res.status(403).json({ message: 'Sem permissão' });
    await pool.query('UPDATE proposals SET status = ? WHERE id = ?', [String(status), id]);
    if (status === 'accepted') {
      await pool.query('UPDATE missions SET status = ? WHERE id = ?', ['in_progress', mission.id]);
      try { broadcast('mission_status', { id: mission.id, status: 'in_progress', user_id: mission.user_id, provider_id: mission.provider_id }); } catch (_) {}
    }
    const [out] = await pool.query('SELECT * FROM proposals WHERE id = ?', [id]);
    res.json({ proposal: out[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/proposals/stats', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const uid = req.user.id;
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM proposals WHERE user_id = ?', [uid]);
    const [[{ sent }]] = await pool.query("SELECT COUNT(*) AS sent FROM proposals WHERE user_id = ? AND status = 'sent'", [uid]);
    const [[{ accepted }]] = await pool.query("SELECT COUNT(*) AS accepted FROM proposals WHERE user_id = ? AND status = 'accepted'", [uid]);
    const [[{ rejected }]] = await pool.query("SELECT COUNT(*) AS rejected FROM proposals WHERE user_id = ? AND status = 'rejected'", [uid]);
    const active = accepted; // missões em progresso associadas a propostas aceitas
    res.json({ total, sent, accepted, rejected, active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/providers/featured', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(s.accepted_count, 0) AS accepted_count
       FROM providers p
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS accepted_count
         FROM proposals
         WHERE status = 'accepted' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         GROUP BY user_id
       ) s ON s.user_id = p.user_id
       ORDER BY accepted_count DESC, p.created_at DESC
       LIMIT 10`
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.get('/api/providers/me', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Perfil não encontrado' });
    res.json({ provider: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.patch('/api/providers/me', protect, async (req, res) => {
  try {
    const role = req.user.role || 'cliente';
    if (role !== 'prestador') return res.status(403).json({ message: 'Sem permissão' });
    const [rows] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Perfil não encontrado' });
    const allowed = ['phone', 'category', 'bio', 'service_radius_km'];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if ('service_radius_km' in updates) {
      const v = Number(updates.service_radius_km);
      if (!(v > 0) || v > 200) return res.status(400).json({ message: 'Raio inválido' });
      updates.service_radius_km = Math.round(v);
    }
    const fields = Object.keys(updates);
    if (!fields.length) return res.json({ provider: current });
    const setSql = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(req.user.id);
    await pool.query(`UPDATE providers SET ${setSql} WHERE user_id = ?`, values);
    const [out] = await pool.query('SELECT * FROM providers WHERE user_id = ? LIMIT 1', [req.user.id]);
    res.json({ provider: out[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno' });
  }
});

const port = Number(process.env.PORT || 4001);
ensureDatabase()
  .then(() => ensureUsersTable())
  .then(() => ensureRoleColumn())
  .then(() => ensureProvidersTable())
  .then(() => ensureProviderColumns())
  .then(() => ensureProviderRadiusColumnSchema())
  .then(() => ensureMissionsTable())
  .then(() => ensureMissionColumns())
  .then(() => ensureDiscoveryIndexes())
  .then(() => ensureProposalsTable())
  .then(() => ensureMessagesTable())
  .then(() => ensureMissionMediaTable())
  .then(() => ensureProviderMediaTable())
  .then(() => ensurePaymentsTable())
  .then(() => ensurePaymentColumns())
  .then(() => ensureReviewsTable())
  .then(() => ensureProviderReputationColumns())
  .then(() => ensureNotificationDevicesTable())
  .then(() => ensureNotificationPrefsTable())
  .catch(err => { console.error(err); })
  .finally(() => {
    if (!isVercel && server) {
      server.listen(port, '0.0.0.0', () => {
        console.log(`Servidor iniciado na porta ${port}`);
      });
    }
  });
async function ensureMessagesTable() {
  const sql = `CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    sender_id INT NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen_by_user_at TIMESTAMP NULL DEFAULT NULL,
    seen_by_provider_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_mission (mission_id),
    INDEX idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM messages');
    const names = cols.map(c => c.Field);
    if (!names.includes('seen_by_user_at')) {
      await pool.query('ALTER TABLE messages ADD COLUMN seen_by_user_at TIMESTAMP NULL DEFAULT NULL');
    }
    if (!names.includes('seen_by_provider_at')) {
      await pool.query('ALTER TABLE messages ADD COLUMN seen_by_provider_at TIMESTAMP NULL DEFAULT NULL');
    }
  } catch (_) {}
}

async function ensureMissionMediaTable() {
  const sql = `CREATE TABLE IF NOT EXISTS mission_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    user_id INT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mission (mission_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureProviderMediaTable() {
  const sql = `CREATE TABLE IF NOT EXISTS provider_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensurePaymentsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    proposal_id INT NULL,
    user_id INT NOT NULL,
    provider_id INT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    mp_preference_id VARCHAR(64) NULL,
    mp_payment_id VARCHAR(64) NULL,
    external_ref VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_mission (mission_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureReviewsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    provider_id INT NOT NULL,
    rater_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'published',
    moderated TINYINT NOT NULL DEFAULT 0,
    abuse_flags TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uniq_mission_rater (mission_id, rater_id),
    INDEX idx_provider (provider_id),
    INDEX idx_mission (mission_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureProviderReputationColumns() {
  const [rows] = await pool.query('SHOW COLUMNS FROM providers');
  const names = rows.map(r => r.Field);
  const add = async (sql) => { try { await pool.query(sql); } catch (_) {} };
  if (!names.includes('rating_avg')) await add("ALTER TABLE providers ADD COLUMN rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00");
  if (!names.includes('rating_count')) await add("ALTER TABLE providers ADD COLUMN rating_count INT NOT NULL DEFAULT 0");
  if (!names.includes('last_review_at')) await add("ALTER TABLE providers ADD COLUMN last_review_at TIMESTAMP NULL DEFAULT NULL");
}

async function ensureNotificationDevicesTable() {
  const sql = `CREATE TABLE IF NOT EXISTS notification_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(256) NOT NULL,
    platform VARCHAR(32) NULL,
    last_seen_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uniq_user_token (user_id, token),
    INDEX idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function ensureNotificationPrefsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id INT PRIMARY KEY,
    allow_payment TINYINT NOT NULL DEFAULT 1,
    allow_mission TINYINT NOT NULL DEFAULT 1,
    allow_chat TINYINT NOT NULL DEFAULT 1,
    allow_general TINYINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  await pool.query(sql);
}

async function expoSend(to, title, body, data, badge) {
  try {
    const payload = { to, title, body, sound: 'default', data: data || {}, badge: badge != null ? badge : undefined };
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { try { console.error('expo-push-failed', r.status, await r.text()); } catch (_) {} }
  } catch (_) {}
}

async function notifyUsers(userIds, type, title, body, data) {
  try {
    if (!Array.isArray(userIds) || !userIds.length) return;
    const ids = userIds.filter(Boolean);
    if (!ids.length) return;
    const [prefs] = await pool.query(`SELECT * FROM notification_prefs WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);
    const allowMap = new Map(prefs.map(p => [p.user_id, p]));
    const [devs] = await pool.query(`SELECT user_id, token, platform FROM notification_devices WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);
    for (const d of devs) {
      const p = allowMap.get(d.user_id);
      const allow = !p ? true : (
        type === 'payment' ? !!p.allow_payment :
        type === 'mission' ? !!p.allow_mission :
        type === 'chat' ? !!p.allow_chat : !!p.allow_general
      );
      if (!allow) continue;
      await expoSend(d.token, title, body, data || {}, undefined);
      try { await pool.query('UPDATE notification_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token = ?', [d.user_id, d.token]); } catch (_) {}
    }
  } catch (_) {}
}

async function ensurePaymentColumns() {
  const [rows] = await pool.query('SHOW COLUMNS FROM payments');
  const names = rows.map(r => r.Field);
  const add = async (sql) => { try { await pool.query(sql); } catch (_) {} };
  if (!names.includes('status_detail')) await add("ALTER TABLE payments ADD COLUMN status_detail VARCHAR(64) NULL");
  if (!names.includes('payment_method_id')) await add("ALTER TABLE payments ADD COLUMN payment_method_id VARCHAR(32) NULL");
  if (!names.includes('payer_email')) await add("ALTER TABLE payments ADD COLUMN payer_email VARCHAR(255) NULL");
  if (!names.includes('collector_id')) await add("ALTER TABLE payments ADD COLUMN collector_id VARCHAR(32) NULL");
  if (!names.includes('net_received')) await add("ALTER TABLE payments ADD COLUMN net_received DECIMAL(10,2) NULL");
  if (!names.includes('fee_amount')) await add("ALTER TABLE payments ADD COLUMN fee_amount DECIMAL(10,2) NULL");
  if (!names.includes('installments')) await add("ALTER TABLE payments ADD COLUMN installments INT NULL");
  if (!names.includes('card_last_four')) await add("ALTER TABLE payments ADD COLUMN card_last_four VARCHAR(8) NULL");
  if (!names.includes('order_id')) await add("ALTER TABLE payments ADD COLUMN order_id VARCHAR(64) NULL");
  if (!names.includes('refund_status')) await add("ALTER TABLE payments ADD COLUMN refund_status VARCHAR(32) NULL");
  if (!names.includes('refund_amount')) await add("ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(10,2) NULL");
  if (!names.includes('refunded_at')) await add("ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMP NULL DEFAULT NULL");
  if (!names.includes('canceled_at')) await add("ALTER TABLE payments ADD COLUMN canceled_at TIMESTAMP NULL DEFAULT NULL");
  if (!names.includes('money_release_date')) await add("ALTER TABLE payments ADD COLUMN money_release_date TIMESTAMP NULL DEFAULT NULL");
  const [idx] = await pool.query('SHOW INDEX FROM payments');
  const idxNames = idx.map(i => i.Key_name);
  if (!idxNames.includes('idx_payment_id')) await add('CREATE INDEX idx_payment_id ON payments (mp_payment_id)');
  if (!idxNames.includes('idx_external')) await add('CREATE INDEX idx_external ON payments (external_ref)');
}