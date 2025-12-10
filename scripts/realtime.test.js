const { WebSocket } = require('ws');

async function jsonPost(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'http-error');
  return data;
}

async function jsonPatch(url, headers, body) {
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'http-error');
  return data;
}

function waitForEvent(ws, missionId, expectedStatus, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, timeoutMs);
    ws.on('message', (buf) => {
      if (done) return;
      try {
        const msg = JSON.parse(buf.toString());
        if (msg && msg.type === 'mission_status' && msg.payload && msg.payload.id === missionId && msg.payload.status === expectedStatus) {
          done = true; clearTimeout(t); resolve(msg.payload);
        }
      } catch (_) {}
    });
  });
}

async function run() {
  try {
    const Base = 'http://localhost:3000';
    const json = { 'Content-Type': 'application/json' };
    const now = Date.now();
    const cliEmail = `rt_cli_${now}@example.com`;
    const preEmail = `rt_pre_${now}@example.com`;
    const doc = String(Math.floor(10000000000 + Math.random() * 89999999999));
    try { await jsonPost(`${Base}/api/auth/register`, json, { name: 'RT Cliente', email: cliEmail, password: 'segura', role: 'cliente' }); } catch {}
    try { await jsonPost(`${Base}/api/auth/register`, json, { name: 'RT Prest', email: preEmail, password: 'segura', role: 'prestador', company_name: 'RT', document: doc }); } catch {}

    const cLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: cliEmail, password: 'segura' });
    const pLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: preEmail, password: 'segura' });

    const ctoken = cLogin.token; const ptoken = pLogin.token;
    const authCli = { 'Content-Type': 'application/json', Authorization: `Bearer ${ctoken}` };
    const authPre = { 'Content-Type': 'application/json', Authorization: `Bearer ${ptoken}` };

    const mission = await jsonPost(`${Base}/api/missions`, authCli, { title: 'RealTime Test', description: 'Fluxo', location: 'Rua', budget: 10 });
    const mid = mission.mission.id;

    const ws = new WebSocket('ws://localhost:3000/ws');
    await new Promise((r) => ws.on('open', r));

    await jsonPost(`${Base}/api/missions/${mid}/accept`, authPre, {});
    await waitForEvent(ws, mid, 'in_progress', 12000);

    await jsonPost(`${Base}/api/missions/${mid}/provider-status`, authPre, { status: 'awaiting_confirmation' });
    await waitForEvent(ws, mid, 'awaiting_confirmation', 12000);

    await jsonPatch(`${Base}/api/missions/${mid}`, authCli, { status: 'completed' });
    await waitForEvent(ws, mid, 'completed', 12000);

    console.log('OK realtime');
    process.exit(0);
  } catch (e) {
    console.error('FAIL realtime');
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  }
}

run();