# Configuração do Mercado Pago MCP Server

Este guia explica como configurar o Mercado Pago MCP Server no Cursor para usar no projeto.

## Pré-requisitos

1. **Access Token do Mercado Pago**: Você precisa ter um Access Token válido do Mercado Pago
   - Acesse: https://www.mercadopago.com.br/developers/panel/credentials
   - Copie seu Access Token (Production ou Test)

2. **Cursor**: Certifique-se de estar usando o Cursor versão 1 ou superior

## Configuração

### Passo 1: Criar o arquivo de configuração

Crie o arquivo `.cursor/mcp.json` na raiz do projeto com o seguinte conteúdo:

```json
{
  "mcpServers": {
    "mercadopago-mcp-server-prod": {
      "url": "https://mcp.mercadopago.com/mcp",
      "headers": {
        "Authorization": "Bearer SEU_ACCESS_TOKEN_AQUI"
      }
    }
  }
}
```

### Passo 2: Substituir o Access Token

Substitua `SEU_ACCESS_TOKEN_AQUI` pelo seu Access Token real do Mercado Pago.

**Importante**: 
- Use o token de produção se estiver em produção
- Use o token de teste para desenvolvimento
- O token está disponível no arquivo `ecosystem.config.js` na variável `MP_ACCESS_TOKEN`

### Passo 3: Reiniciar o Cursor

Após criar/editar o arquivo `.cursor/mcp.json`, reinicie o Cursor para aplicar as mudanças.

## Verificação

Para verificar se a configuração está funcionando, você pode:

1. Verificar nas configurações do Cursor se o MCP Server aparece como disponível
2. Testar fazendo uma pergunta ao assistente sobre a documentação do Mercado Pago:
   ```
   Busque na documentação do Mercado Pago como integrar o Checkout Pro.
   ```

## Ferramentas Disponíveis

O MCP Server do Mercado Pago oferece várias ferramentas, incluindo:

- `search-documentation`: Buscar na documentação do Mercado Pago
- Outras ferramentas da API do Mercado Pago

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite o arquivo `.cursor/mcp.json` com tokens reais no Git
- Adicione `.cursor/mcp.json` ao `.gitignore` se ainda não estiver
- Use variáveis de ambiente quando possível

## Exemplo de Configuração com Variável de Ambiente

Se preferir usar variáveis de ambiente, você pode criar um script que gera o arquivo:

```bash
# No PowerShell
$token = $env:MP_ACCESS_TOKEN
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
$config | Out-File -FilePath ".cursor/mcp.json" -Encoding utf8
```

