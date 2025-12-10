param(
  [string]$Remote,
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location ..

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git não encontrado no PATH"
}

if (-not (Test-Path ".git")) { git init }

if ($env:GIT_USER_NAME) { git config user.name $env:GIT_USER_NAME }
if ($env:GIT_USER_EMAIL) { git config user.email $env:GIT_USER_EMAIL }

$Remote = if ($Remote -and $Remote.Trim().Length -gt 0) { $Remote } elseif ($env:GITHUB_REPO_URL) { $env:GITHUB_REPO_URL } else { $null }

# Opcional: usar PAT via variáveis de ambiente
if ($Remote -and $env:GITHUB_USER -and $env:GITHUB_PAT) {
  if ($Remote.StartsWith('https://')) {
    $Remote = $Remote -replace '^https://', "https://$($env:GITHUB_USER):$($env:GITHUB_PAT)@"
  }
}

function Get-RepoNameFromRemote([string]$remoteUrl) {
  if (-not $remoteUrl) { return (Split-Path -Leaf (Get-Location)) }
  $m = [regex]::Match($remoteUrl, '/([^/]+?)(?:\.git)?$')
  if ($m.Success) { return $m.Groups[1].Value } else { return (Split-Path -Leaf (Get-Location)) }
}

function New-GitHubRepo([string]$name, [bool]$isPrivate) {
  if (-not $env:GITHUB_PAT) { Write-Warning "GITHUB_PAT não definido"; return $false }
  $headers = @{ Authorization = "Bearer $($env:GITHUB_PAT)"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
  $body = @{ name = $name; private = $isPrivate; description = 'Backend AppMissao' } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Method Post -Uri 'https://api.github.com/user/repos' -Headers $headers -Body $body
    if ($resp.name -eq $name) { Write-Host "Repositório criado: $name"; return $true } else { return $false }
  } catch { Write-Warning "Falha ao criar repositório: $($_.Exception.Message)"; return $false }
}

$origin = ""
try { $origin = git remote get-url origin | Select-Object -First 1 } catch { $origin = "" }
if ($Remote -and $Remote.Trim().Length -gt 0) {
  if ($origin) { git remote set-url origin $Remote } else { git remote add origin $Remote }
  $origin = $Remote
}

git add -A
try { git commit -m ("Auto push: " + (Get-Date -Format s)) } catch { Write-Host "Nenhuma alteração para commit" }

git branch -M $Branch
if ($origin) {
  git push -u origin $Branch
  if ($LASTEXITCODE -ne 0) {
    $repoName = Get-RepoNameFromRemote($Remote)
    if (-not $env:GITHUB_USER) { $env:GITHUB_USER = $repoName } # fallback
    $created = New-GitHubRepo -name $repoName -isPrivate:$true
    if ($created) {
      $newRemote = "https://github.com/$($env:GITHUB_USER)/$repoName.git"
      if ($env:GITHUB_USER -and $env:GITHUB_PAT) { $newRemote = $newRemote -replace '^https://', "https://$($env:GITHUB_USER):$($env:GITHUB_PAT)@" }
      git remote set-url origin $newRemote
      git push -u origin $Branch
    }
  }
} else {
  Write-Warning "Nenhum remote 'origin' configurado. Exemplo: setx GITHUB_REPO_URL https://github.com/usuario/repo.git"
}