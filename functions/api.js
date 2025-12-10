import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ status: 'online', message: 'API funcionando na Cloudflare' }))
app.get('/hello', (c) => c.text('Olá Cloudflare!'))

export default app