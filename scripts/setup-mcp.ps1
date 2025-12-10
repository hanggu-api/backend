# Script para configurar o Mercado Pago MCP Server
# Uso: .\scripts\setup-mcp.ps1

Write-Host "Configurando Mercado Pago MCP Server..." -ForegroundColor Cyan

# Verificar se o diretório .cursor existe
if (-not (Test-Path .cursor)) {
    New-Item -ItemType Directory -Path .cursor | Out-Null
    Write-Host "Diretório .cursor criado." -ForegroundColor Green
}

# Obter o token do ambiente ou solicitar ao usuário
$token = $env:MP_ACCESS_TOKEN

if (-not $token) {
    Write-Host "Token do Mercado Pago não encontrado nas variáveis de ambiente." -ForegroundColor Yellow
    $token = Read-Host "Digite seu Access Token do Mercado Pago"
}

if (-not $token -or $token -eq "") {
    Write-Host "Erro: Token não fornecido. Abortando configuração." -ForegroundColor Red
    exit 1
}

# Criar a configuração JSON
$config = @{
    mcpServers = @{
        "mercadopago-mcp-server-prod" = @{
            url = "https://mcp.mercadopago.com/mcp"
            headers = @{
                Authorization = "Bearer $token"
            }
        }
    }
} | ConvertTo-Json -Depth 10

# Salvar no arquivo
$configPath = ".cursor/mcp.json"
$config | Out-File -FilePath $configPath -Encoding utf8 -NoNewline

Write-Host "`nConfiguração salva em: $configPath" -ForegroundColor Green
Write-Host "`nPróximos passos:" -ForegroundColor Cyan
Write-Host "1. Reinicie o Cursor para aplicar as mudanças" -ForegroundColor White
Write-Host "2. Verifique se o MCP Server aparece nas configurações do Cursor" -ForegroundColor White
Write-Host "`n⚠️  IMPORTANTE: Adicione .cursor/mcp.json ao .gitignore para não commitar o token!" -ForegroundColor Yellow

