const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')
const Client = require('ssh2-sftp-client')

const host = process.env.SFTP_HOST
const port = Number(process.env.SFTP_PORT || 22)
const username = process.env.SFTP_USER
const password = process.env.SFTP_PASSWORD
const remoteBase = String(process.env.SFTP_REMOTE_BASE || '/root/appmissao').replace(/\/+$/,'')
const cwd = process.cwd()

if (!host || !username || !password) {
  console.error('SFTP inválido')
  process.exit(1)
}

const ignoreDirs = new Set(['node_modules','.git'])
function isIgnored(file) {
  const rel = path.relative(cwd, file)
  if (!rel || rel.startsWith('..')) return true
  const parts = rel.split(path.sep)
  if (parts.some(p => ignoreDirs.has(p))) return true
  if (/(^|\/)\.env(\.|$)/i.test(rel)) return true
  if (/\.log$/i.test(rel)) return true
  return false
}

const sftp = new Client()
let connected = false
let connecting = false
let queue = []
let running = false

async function ensureConn() {
  if (connected || connecting) return
  connecting = true
  try {
    await sftp.connect({ host, port, username, password })
    connected = true
  } catch (e) {
    connecting = false
    setTimeout(ensureConn, 1500)
  }
}

async function ensureDir(remoteDir) {
  const parts = remoteDir.split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur += '/' + p
    try { await sftp.mkdir(cur, true) } catch (_) {}
  }
}

async function upload(file) {
  const rel = path.relative(cwd, file).replace(/\\/g,'/')
  const remote = `${remoteBase}/${rel}`
  const rdir = path.posix.dirname(remote)
  await ensureDir(rdir)
  await sftp.fastPut(file, remote)
}

async function worker() {
  if (running) return
  running = true
  while (queue.length) {
    const item = queue.shift()
    try {
      if (!connected) await ensureConn()
      await upload(item)
      process.stdout.write(`enviado: ${item}\n`)
    } catch (_) {
      connected = false
      try { await sftp.end() } catch (_) {}
      setTimeout(() => { queue.unshift(item); running = false; worker() }, 1500)
      return
    }
  }
  running = false
}

function enqueue(file) {
  if (isIgnored(file)) return
  queue.push(file)
  worker()
}

const watcher = chokidar.watch(cwd, { ignoreInitial: true, persistent: true, awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 } })
watcher.on('add', enqueue)
watcher.on('change', enqueue)
process.on('SIGINT', async () => { try { await sftp.end() } catch (_) {} process.exit(0) })
ensureConn()