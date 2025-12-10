async function jsonPost(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const ctype = String(res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) { throw new Error(`non-json-response ${res.status} ${ctype}`); }
  if (!res.ok) throw new Error(data.message || 'http-error');
  return data;
}

async function jsonGet(url, headers) {
  const res = await fetch(url, { headers });
  const ctype = String(res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) { throw new Error(`non-json-response ${res.status} ${ctype}`); }
  if (!res.ok) throw new Error(data.message || 'http-error');
  return data;
}

async function run() {
  try {
    const Base = 'http://localhost:3000';
    const json = { 'Content-Type': 'application/json' };
    const now = Date.now();
    const cliEmail = `chat_cli_${now}@example.com`;
    const preEmail = `chat_pre_${now}@example.com`;
    const doc = String(Math.floor(10000000000 + Math.random() * 89999999999));

    try { await jsonPost(`${Base}/api/auth/register`, json, { name: 'Chat Cliente', email: cliEmail, password: 'segura', role: 'cliente' }); } catch (e) { throw new Error(`register-cli ${String(e.message)}`); }
    try { await jsonPost(`${Base}/api/auth/register`, json, { name: 'Chat Prest', email: preEmail, password: 'segura', role: 'prestador', company_name: 'Chat', document: doc }); } catch (e) { throw new Error(`register-pre ${String(e.message)}`); }

    let cLogin; let pLogin;
    try { cLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: cliEmail, password: 'segura' }); } catch (e) { throw new Error(`login-cli ${String(e.message)}`); }
    try { pLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: preEmail, password: 'segura' }); } catch (e) { throw new Error(`login-pre ${String(e.message)}`); }
    const authCli = { 'Content-Type': 'application/json', Authorization: `Bearer ${cLogin.token}` };
    const authPre = { 'Content-Type': 'application/json', Authorization: `Bearer ${pLogin.token}` };

    const mission = await jsonPost(`${Base}/api/missions`, authCli, { title: 'Chat Missão', description: '', location: 'Rua', budget: 10 });
    if (!mission || !mission.mission || !mission.mission.id) throw new Error('mission-create-failed');
    const mid = mission.mission.id;
    try { await jsonPost(`${Base}/api/missions/${mid}/accept`, authPre, {}); } catch (e) { throw new Error(`accept ${String(e.message)}`); }

    try { await jsonPost(`${Base}/api/missions/${mid}/chat/messages`, authCli, { type: 'text', content: 'Olá!' }); } catch (e) { throw new Error(`send-cli ${String(e.message)}`); }
    try { await jsonPost(`${Base}/api/missions/${mid}/chat/messages`, authPre, { type: 'text', content: 'Oi, tudo bem?' }); } catch (e) { throw new Error(`send-pre ${String(e.message)}`); }
    try { await jsonPost(`${Base}/api/missions/${mid}/chat/messages`, authCli, { type: 'image', content: 'https://picsum.photos/300' }); } catch (e) { throw new Error(`send-img ${String(e.message)}`); }

    const histCli = await jsonGet(`${Base}/api/missions/${mid}/chat`, { Authorization: `Bearer ${cLogin.token}` });
    const histPre = await jsonGet(`${Base}/api/missions/${mid}/chat`, { Authorization: `Bearer ${pLogin.token}` });
    if ((histCli.items || []).length < 3) throw new Error('chat-history-too-small');
    if ((histPre.items || []).length !== (histCli.items || []).length) throw new Error('chat-history-mismatch');

    console.log('OK chat');
    process.exit(0);
  } catch (e) {
    console.error('FAIL chat');
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  }
}

run();