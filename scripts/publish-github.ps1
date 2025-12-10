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
} else {
  Write-Warning "Nenhum remote 'origin' configurado. Exemplo: setx GITHUB_REPO_URL https://github.com/usuario/repo.git"
}