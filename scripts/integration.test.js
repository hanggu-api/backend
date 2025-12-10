const { pool } = require('../db');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/auth';

function randEmail() {
  const ts = Date.now();
  return `test+${ts}@example.com`;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`http-${res.status}`);
  return res.json();
}

async function cleanup(email) {
  try {
    await pool.query('DELETE FROM users WHERE email = ?', [email]);
  } catch (e) {
    // swallow cleanup errors
  }
}

async function run() {
  const email = randEmail();
  const password = 'integrationPass123!';
  const name = 'Integration User';

  try {
    const reg = await request('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (!reg.token || !reg.user || !reg.user.id) throw new Error('register-invalid');

    const log = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (!log.token) throw new Error('login-invalid');

    const me = await request('/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${log.token}` }
    });
    if (!me.user || me.user.email !== email) throw new Error('me-invalid');

    console.log('OK integration');
    await cleanup(email);
    process.exit(0);
  } catch (e) {
    console.error('FAIL integration', e.message);
    await cleanup(email);
    process.exit(1);
  }
}

run();