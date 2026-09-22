# deploy.ps1 - builds learner-only PWA and deploys to GitHub Pages (main branch)
# Usage: .\deploy.ps1
#
# Paczki: pliki z public/paczki/ trafiaja do dist/. Dodatkowo przed pushem skrypt
# dolacza paczki juz istniejace na galezi main (wgrane np. przez innych instruktorow
# przez web UI GitHuba), wiec deploy nie kasuje cudzych paczek.

$ErrorActionPreference = "Continue"   # git pisze ostrzezenia na stderr - o bledzie decyduje kod wyjscia
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $env:TEMP "shol-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

function Invoke-Git { & git -c core.autocrlf=false -c core.safecrlf=false @args 2>&1 | Where-Object { "$_" -notmatch 'credential-manager|LF will be replaced|original line endings' }; if ($LASTEXITCODE -ne 0) { Write-Host "git $($args[0]) failed." -ForegroundColor Red; Set-Location $projectDir; exit 1 } }

Write-Host "1/4 Building app (learner mode)..." -ForegroundColor Cyan
Set-Location $projectDir
npx vite build --mode learner
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }

Write-Host "2/4 Preparing deploy package..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Copy-Item -Recurse "$projectDir\dist\*" $tempDir
New-Item -ItemType File -Force -Path "$tempDir\.nojekyll" | Out-Null

# Dolacz paczki istniejace juz na main (wgrane np. przez innych instruktorow)
$packsDir = "$tempDir\paczki"
New-Item -ItemType Directory -Force -Path $packsDir | Out-Null
try {
  $listing = Invoke-RestMethod "https://api.github.com/repos/marcindev1504-cmyk/shol/contents/paczki?ref=main" -Headers @{ "User-Agent" = "kompas-deploy" }
  $missing = @($listing | Where-Object { $_.name -like "kompas-paczka-*.json" -and -not (Test-Path (Join-Path $packsDir $_.name)) })
  foreach ($file in $missing) {
    Invoke-WebRequest -UseBasicParsing $file.download_url -OutFile (Join-Path $packsDir $file.name)
  }
  if ($missing.Count -gt 0) { Write-Host "    dolaczono z GitHuba: $($missing.Count) ($(($missing | ForEach-Object { $_.name }) -join ', '))" }
} catch {
  Write-Host "    nie udalo sie pobrac listy paczek z GitHuba - deploy tylko z lokalnych" -ForegroundColor Yellow
}

$packs = @(Get-ChildItem "$packsDir\*.json" -ErrorAction SilentlyContinue)
Write-Host "    paczki w deployu: $($packs.Count) ($(($packs | ForEach-Object { $_.BaseName -replace 'kompas-paczka-','' }) -join ', '))"

Write-Host "3/4 Pushing to GitHub Pages..." -ForegroundColor Cyan
Set-Location $tempDir
Invoke-Git init -q
Invoke-Git checkout -q -b main
Invoke-Git add .
Invoke-Git commit -q -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Invoke-Git remote add origin "https://github.com/marcindev1504-cmyk/shol.git"
Invoke-Git push -f origin main

Write-Host "4/4 Cleanup..." -ForegroundColor Cyan
Set-Location $projectDir
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "Done! https://marcindev1504-cmyk.github.io/shol/" -ForegroundColor Green
