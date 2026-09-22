# Buduje paczke portable Kompas Wiedzy:
#   dist/ + server.mjs + node.exe + ollama.exe (portable) + modele AI + START.bat
# Wynik: portable\kompas-wiedzy-portable.zip
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$portableDir = Join-Path $root 'portable'
$bundle = Join-Path $portableDir 'kompas-wiedzy'
$zip = Join-Path $portableDir 'kompas-wiedzy-portable.zip'

Write-Host '==> npm run build'
Push-Location $root
try { & npm.cmd run build | Out-Null } finally { Pop-Location }

Write-Host '==> skladanie folderu paczki'
if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force }
New-Item -ItemType Directory -Path "$bundle\dist", "$bundle\ollama\models" -Force | Out-Null

Copy-Item "$root\dist\*" "$bundle\dist" -Recurse
Copy-Item "$root\server.mjs" $bundle
Copy-Item (Get-Command node).Source "$bundle\node.exe"

Write-Host '==> kopiowanie portable Ollamy'
$ollamaDir = Split-Path (Get-Command ollama).Source -Parent
Copy-Item "$ollamaDir\*" "$bundle\ollama" -Recurse -Exclude 'Ollama app.exe', 'unins*'

Write-Host '==> pobieranie modeli (qwen3:8b, qwen3:4b)'
$models = 'qwen3:8b', 'qwen3:4b'
foreach ($m in $models) { ollama pull $m }

Write-Host '==> kopiowanie tylko domyslnych modeli do paczki'
$modelsSrc = Join-Path $env:USERPROFILE '.ollama\models'
$blobsDest = Join-Path $bundle 'ollama\models\blobs'
New-Item -ItemType Directory -Path $blobsDest -Force | Out-Null
foreach ($m in $models) {
  $name, $tag = $m.Split(':')
  $manifestPath = Join-Path $modelsSrc "manifests\registry.ollama.ai\library\$name\$tag"
  if (-not (Test-Path $manifestPath)) { throw "Brak manifestu modelu $m w $modelsSrc" }
  $manifestDest = Join-Path $bundle "ollama\models\manifests\registry.ollama.ai\library\$name"
  New-Item -ItemType Directory -Path $manifestDest -Force | Out-Null
  Copy-Item $manifestPath $manifestDest
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $digests = @($manifest.config.digest) + @($manifest.layers | ForEach-Object { $_.digest }) | Sort-Object -Unique
  foreach ($d in $digests) {
    $blob = Join-Path $modelsSrc ('blobs\' + $d.Replace(':', '-'))
    if (-not (Test-Path $blob)) { throw "Brak blobu $d dla modelu $m" }
    Copy-Item $blob $blobsDest -Force
  }
}

Copy-Item "$PSScriptRoot\portable\START.bat" $bundle
Copy-Item "$PSScriptRoot\portable\CZYTAJMNIE.txt" $bundle

Write-Host '==> kompresja ZIP (tar - duze pliki >4GB)'
if (Test-Path $zip) { Remove-Item $zip -Force }
& "$env:SystemRoot\System32\tar.exe" -a -cf $zip -C $bundle .
if ($LASTEXITCODE -ne 0) { throw 'tar.exe nie utworzyl archiwum' }

Write-Host "Gotowe: $zip"
Write-Host "Rozmiar: $([math]::Round((Get-Item $zip).Length / 1GB, 2)) GB"
