# deploy.ps1 - deployuje TYLKO kod aplikacji słuchacza na GitHub Pages (main)
# Usage: .\deploy.ps1
#
# Model: paczki żyją WYŁĄCZNIE na gałęzi main w katalogu paczki/ — instruktorzy
# wgrywają je ręcznie przez web UI GitHuba. public/paczki/ lokalnie służy tylko
# do testów dev i NIGDY nie trafia na Pages. Przed force-pushem skrypt pobiera
# paczki z main i dokłada je do deployu, żeby ich nie skasować.
#
# UWAGA: push jest wymuszony (-f) — zawartość main zostaje zastąpiona tym, co
# skrypt przygotuje. Dlatego bez udanego pobrania listy paczek deploy jest
# przerywany, żeby nie wyczyścić paczek na GitHubie.

$ErrorActionPreference = "Continue"   # git pisze ostrzezenia na stderr - o bledzie decyduje kod wyjscia
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $env:TEMP "shol-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

function Invoke-Git { & git -c core.autocrlf=false -c core.safecrlf=false @args 2>&1 | Where-Object { "$_" -notmatch 'credential-manager|LF will be replaced|original line endings' }; if ($LASTEXITCODE -ne 0) { Write-Host "git $($args[0]) failed." -ForegroundColor Red; Set-Location $projectDir; exit 1 } }

Write-Host "1/4 Building app (learner mode)..." -ForegroundColor Cyan
Set-Location $projectDir
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
# Build prosto do folderu deployu — dist/ zostaje nietkniete (to build instruktora
# dla lokalnego serwera na :8080)
npx vite build --mode learner --outDir "$tempDir" --emptyOutDir
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }

Write-Host "2/4 Preparing deploy package..." -ForegroundColor Cyan
New-Item -ItemType File -Force -Path "$tempDir\.nojekyll" | Out-Null

# Lokalne paczki z public/paczki trafia do builda — wyrzucamy je.
# Na Pages mają trafić wyłącznie paczki żyjące już na main.
$packsDir = "$tempDir\paczki"
if (Test-Path $packsDir) { Remove-Item -Recurse -Force $packsDir }
New-Item -ItemType Directory -Force -Path $packsDir | Out-Null
# .gitkeep — folder paczki/ widoczny na GitHubie nawet gdy pusty (git nie sledzi pustych katalogow)
New-Item -ItemType File -Force -Path "$packsDir\.gitkeep" | Out-Null

try {
  $listing = @(Invoke-RestMethod "https://api.github.com/repos/marcindev1504-cmyk/shol/contents/paczki?ref=main" -Headers @{ "User-Agent" = "kompas-deploy" })
  $remote = @($listing | Where-Object { $_.name -like "kompas-paczka-*.json" })
  foreach ($file in $remote) {
    Invoke-WebRequest -UseBasicParsing $file.download_url -OutFile (Join-Path $packsDir $file.name)
  }
} catch {
  # 404 = katalog paczki/ nie istnieje jeszcze na main — deploy bez paczek jest OK
  if ($_.Exception.Response.StatusCode.value__ -eq 404) {
    $remote = @()
  } else {
    Write-Host "Nie udalo sie pobrac listy paczek z GitHuba - deploy przerwany, zeby nie skasowac paczek na main." -ForegroundColor Red
    Set-Location $projectDir
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    exit 1
  }
}
Write-Host "    paczki zachowane z GitHuba: $($remote.Count) ($(($remote | ForEach-Object { $_.name }) -join ', '))"

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
