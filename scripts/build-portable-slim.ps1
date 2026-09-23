# Buduje SLIM paczke portable Kompas Wiedzy — bez Ollamy i modeli AI:
#   dist/ + server.mjs + node.exe + START.bat + run.vbs + stop.bat + icon.ico
# Wynik: portable\kompas-wiedzy-portable-slim.zip (~50 MB)
# Generowanie AI wymaga wowczas wlasnej Ollamy na komputerze instruktora.
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$portableDir = Join-Path $root 'portable'
$bundle = Join-Path $portableDir 'kompas-wiedzy-slim'
$zip = Join-Path $portableDir 'kompas-wiedzy-portable-slim.zip'

Write-Host '==> npm run build'
Push-Location $root
try { & npm.cmd run build | Out-Null } finally { Pop-Location }

Write-Host '==> skladanie folderu paczki'
if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path "$bundle\dist" -Force | Out-Null

Copy-Item "$root\dist\*" "$bundle\dist" -Recurse
Copy-Item "$root\server.mjs" $bundle
Copy-Item (Get-Command node).Source "$bundle\node.exe"

Copy-Item "$PSScriptRoot\portable\START.bat" $bundle
Copy-Item "$PSScriptRoot\portable\run-slim.vbs" "$bundle\run.vbs"
Copy-Item "$PSScriptRoot\portable\stop.bat" $bundle
Copy-Item "$PSScriptRoot\portable\CZYTAJMNIE-slim.txt" "$bundle\CZYTAJMNIE.txt"

Write-Host '==> ikona skrotu (PNG w ICO)'
$png = [IO.File]::ReadAllBytes("$root\public\icon-192.png")
$ms = New-Object IO.MemoryStream
$bw = New-Object IO.BinaryWriter $ms
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)   # ICONDIR: 1 obraz
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0) # w/h=256, paleta, rez
$bw.Write([UInt16]1); $bw.Write([UInt16]32)                     # planes, bpp
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)           # rozmiar, offset danych
$bw.Write($png)
[IO.File]::WriteAllBytes("$bundle\icon.ico", $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

Write-Host '==> kompresja ZIP'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$bundle\*" -DestinationPath $zip -CompressionLevel Optimal

Write-Host "Gotowe: $zip"
Write-Host "Rozmiar: $([math]::Round((Get-Item $zip).Length / 1MB, 1)) MB"
