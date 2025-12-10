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

async function jsonGet(url, headers) {
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'http-error');
  return data;
}

async function run() {
  try {
    const Base = 'http://localhost:3000';
    const json = { 'Content-Type': 'application/json' };
    const now = Date.now();
    const cliEmail = `rtb_cli_${now}@example.com`;
    const preEmail = `rtb_pre_${now}@example.com`;
    const doc = String(Math.floor(10000000000 + Math.random() * 89999999999));

    await jsonPost(`${Base}/api/auth/register`, json, { name: 'RTB Cliente', email: cliEmail, password: 'segura', role: 'cliente' });
    await jsonPost(`${Base}/api/auth/register`, json, { name: 'RTB Prest', email: preEmail, password: 'segura', role: 'prestador', company_name: 'RTB', document: doc });

    const cLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: cliEmail, password: 'segura' });
    const pLogin = await jsonPost(`${Base}/api/auth/login`, json, { email: preEmail, password: 'segura' });
    const authCli = { 'Content-Type': 'application/json', Authorization: `Bearer ${cLogin.token}` };
    const authPre = { 'Content-Type': 'application/json', Authorization: `Bearer ${pLogin.token}` };

    const mission = await jsonPost(`${Base}/api/missions`, authCli, { title: 'Badge Test', description: '', location: 'Rua', budget: 10 });
    const mid = mission.mission.id;

    await jsonPost(`${Base}/api/missions/${mid}/accept`, authPre, {});
    await jsonPost(`${Base}/api/missions/${mid}/provider-status`, authPre, { status: 'awaiting_confirmation' });

    const mineAwait = await jsonGet(`${Base}/api/missions/mine`, { Authorization: `Bearer ${cLogin.token}` });
    const awaitingCount = (mineAwait.items || []).filter(m => m.status === 'awaiting_confirmation').length;
    if (awaitingCount < 1) throw new Error('badge-not-incremented');

    await jsonPatch(`${Base}/api/missions/${mid}`, authCli, { status: 'completed' });
    const mineAfter = await jsonGet(`${Base}/api/missions/mine`, { Authorization: `Bearer ${cLogin.token}` });
    const awaitingCountAfter = (mineAfter.items || []).filter(m => m.status === 'awaiting_confirmation').length;
    if (awaitingCountAfter !== 0) throw new Error('badge-not-decremented');

    const assigned = await jsonGet(`${Base}/api/missions/assigned`, { Authorization: `Bearer ${pLogin.token}` });
    const thisMission = (assigned.items || []).find(m => m.id === mid);
    if (!thisMission || thisMission.status !== 'completed') throw new Error('provider-not-updated');

    console.log('OK badge+provider');
    process.exit(0);
  } catch (e) {
    console.error('FAIL badge+provider');
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  }
}

run();