# deploy.ps1 — buduje aplikację i publikuje na GitHub Pages (branch main)
# Uruchom: .\deploy.ps1

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $env:TEMP "shol-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "1/4 Budowanie aplikacji..." -ForegroundColor Cyan
Set-Location $projectDir
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build nie powiódł się." -ForegroundColor Red; exit 1 }

Write-Host "2/4 Przygotowanie paczki do publikacji..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Copy-Item -Recurse "$projectDir\dist\*" $tempDir
New-Item -ItemType File -Force -Path "$tempDir\.nojekyll" | Out-Null

Write-Host "3/4 Publikacja na GitHub Pages..." -ForegroundColor Cyan
Set-Location $tempDir
git init -b main | Out-Null
git add .
git commit -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
git remote add origin "https://github.com/marcindev1504-cmyk/shol.git"
git push -f origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push nie powiódł się — sprawdź token/logowanie." -ForegroundColor Red; exit 1 }

Write-Host "4/4 Sprzątanie..." -ForegroundColor Cyan
Set-Location $projectDir
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "Gotowe! https://marcindev1504-cmyk.github.io/shol/" -ForegroundColor Green
