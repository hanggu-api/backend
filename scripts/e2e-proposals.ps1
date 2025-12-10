param(
  [string]$Base = "http://localhost:3000"
)

$ErrorActionPreference = 'Stop'

function JsonPost($url, $headers, $body) {
  return Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body ($body | ConvertTo-Json)
}

function JsonPatch($url, $headers, $body) {
  return Invoke-RestMethod -Uri $url -Method PATCH -Headers $headers -Body ($body | ConvertTo-Json)
}

$json = @{ 'Content-Type' = 'application/json' }

try { $null = JsonPost "$Base/api/auth/register" $json @{ name='Cliente'; email='cliente@example.com'; password='segura'; role='cliente' } } catch {}
try { $null = JsonPost "$Base/api/auth/register" $json @{ name='Prestador'; email='prestador@example.com'; password='segura'; role='prestador'; company_name='Empresa X'; document='00000000000'; phone='55999999999'; category='Pintura' } } catch {}

$clienteLogin = JsonPost "$Base/api/auth/login" $json @{ email='cliente@example.com'; password='segura' }
$prestLogin   = JsonPost "$Base/api/auth/login" $json @{ email='prestador@example.com'; password='segura' }

$ctoken = $clienteLogin.token
$ptoken = $prestLogin.token

$authCli = @{ 'Content-Type'='application/json'; Authorization="Bearer $ctoken" }
$authPre = @{ 'Content-Type'='application/json'; Authorization="Bearer $ptoken" }

$mission = JsonPost "$Base/api/missions" $authCli @{ title='Pintura'; description='Sala toda'; location='Av. Central, Centro, Cidade - UF, 00000-000'; lat=-5.5; lng=-47.45; budget=250 }
$mid = $mission.mission.id

$proposal = JsonPost "$Base/api/proposals" $authPre @{ mission_id=$mid; price=300; deadline_days=5 }

$list = Invoke-RestMethod -Uri "$Base/api/missions/$mid/proposals" -Headers @{ Authorization="Bearer $ctoken" }
if (-not $list.items -or $list.items.Count -eq 0) {
  $proposal = JsonPost "$Base/api/proposals" $authPre @{ mission_id=$mid; price=280; deadline_days=4 }
  $list = Invoke-RestMethod -Uri "$Base/api/missions/$mid/proposals" -Headers @{ Authorization="Bearer $ctoken" }
}

$propId = $list.items[0].id

$accept = JsonPatch "$Base/api/proposals/$propId" $authCli @{ status='accepted' }

$stats = Invoke-RestMethod -Uri "$Base/api/proposals/stats" -Headers @{ Authorization="Bearer $ptoken" }

$missionOut = Invoke-RestMethod -Uri "$Base/api/missions/$mid"

$pref = JsonPost "$Base/api/missions/$mid/payments/preference" $authCli @{}

$summary = [PSCustomObject]@{ missionId=$mid; proposalId=$propId; missionStatus=$missionOut.mission.status; stats=$stats; preference=$pref }
$summary | ConvertTo-Json -Depth 6