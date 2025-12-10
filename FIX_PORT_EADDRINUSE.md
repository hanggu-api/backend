# Como Resolver Erro EADDRINUSE - Porta em Uso

## 🔴 Problema

Erro: `EADDRINUSE: address already in use 0.0.0.0:4001`

Isso significa que a porta 4001 já está sendo usada por outro processo.

## ✅ Soluções

### Solução 1: Parar Processo na Porta (Recomendado)

#### No Linux/Mac:
```bash
# Encontrar processo usando a porta 4001
lsof -i :4001
# ou
netstat -tulpn | grep 4001

# Matar o processo (substitua PID pelo número do processo)
kill -9 <PID>
```

#### No Windows:
```powershell
# Encontrar processo usando a porta 4001
netstat -ano | findstr :4001

# Matar o processo (substitua PID pelo número do processo)
taskkill /PID <PID> /F
```

### Solução 2: Usar PM2 para Gerenciar

Se estiver usando PM2:

```bash
# Parar todos os processos PM2
pm2 stop all

# Ou parar processo específico
pm2 stop appmissao-backend

# Deletar processo
pm2 delete appmissao-backend

# Reiniciar
pm2 start ecosystem.config.js
```

### Solução 3: Mudar a Porta

Se não conseguir liberar a porta, mude para outra:

#### No `ecosystem.config.js`:
```javascript
env: {
  PORT: 4002, // Mude para outra porta
  // ...
}
```

#### No `.env`:
```env
PORT=4002
```

### Solução 4: Verificar se o Servidor Já Está Rodando

```bash
# Ver processos Node.js
ps aux | grep node
# ou no Windows
tasklist | findstr node

# Ver processos PM2
pm2 list
```

## 🔍 Diagnóstico

### Verificar o que está usando a porta

```bash
# Linux/Mac
sudo lsof -i :4001

# Windows
netstat -ano | findstr :4001
```

### Verificar processos PM2

```bash
pm2 list
pm2 logs
```

## ⚠️ Importante

Se o servidor já estiver rodando via PM2, **não inicie novamente diretamente**. Use:

```bash
pm2 restart appmissao-backend
```

## 📝 Checklist

- [ ] Verificou se há outro processo usando a porta 4001
- [ ] Parou o processo antigo (se necessário)
- [ ] Verificou processos PM2
- [ ] Reiniciou via PM2 (não iniciou diretamente)
- [ ] Ou mudou a porta se necessário

