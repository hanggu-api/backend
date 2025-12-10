async function health() {
  const res = await fetch('http://localhost:3000/api/auth');
  if (!res.ok) throw new Error('health-failed');
  const json = await res.json();
  if (json.status !== 'ok') throw new Error('health-invalid');
}

async function run() {
  try {
    await health();
    console.log('OK backend');
    process.exit(0);
  } catch (e) {
    console.error('FAIL backend');
    process.exit(1);
  }
}

run();