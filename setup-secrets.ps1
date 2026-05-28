# PowerShell script a Cloudflare Worker secrets beállításához

# FONTOS: Ezt a scriptet futtasd az ErnaRoland2026 mappában!
# PowerShell: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountJsonPath,
    
    [Parameter(Mandatory=$true)]
    [string]$AdminTokenHash
)

# Ellenőrzés
if (-not (Test-Path $ServiceAccountJsonPath)) {
    Write-Host "HIBA: Fájl nem található: $ServiceAccountJsonPath" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Service Account JSON beolvasása..." -ForegroundColor Cyan
$jsonContent = Get-Content -Path $ServiceAccountJsonPath -Raw

# JSON validáció
try {
    $parsed = $jsonContent | ConvertFrom-Json
    Write-Host "✅ JSON formátum OK" -ForegroundColor Green
} catch {
    Write-Host "❌ HIBA: Hibás JSON formátum!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Tömörítés egyetlen sorba
Write-Host "📦 JSON tömörítése..." -ForegroundColor Cyan
$jsonCompressed = $jsonContent | ConvertFrom-Json | ConvertTo-Json -Compress

Write-Host "✅ Tömörítés kész" -ForegroundColor Green
Write-Host "JSON hossz: $($jsonCompressed.Length) karakter" -ForegroundColor Gray

# CF_SERVICE_KEY secret beállítása
Write-Host "`n🔐 CF_SERVICE_KEY secret beállítása..." -ForegroundColor Cyan
$jsonCompressed | wrangler secret put CF_SERVICE_KEY --env production

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CF_SERVICE_KEY beállítva!" -ForegroundColor Green
} else {
    Write-Host "❌ HIBA: CF_SERVICE_KEY beállítása sikertelen!" -ForegroundColor Red
    exit 1
}

# ADMIN_TOKEN secret beállítása
Write-Host "`n🔐 ADMIN_TOKEN secret beállítása..." -ForegroundColor Cyan
$AdminTokenHash | wrangler secret put ADMIN_TOKEN --env production

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ADMIN_TOKEN beállítva!" -ForegroundColor Green
} else {
    Write-Host "❌ HIBA: ADMIN_TOKEN beállítása sikertelen!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Mindkét secret sikeresen beállítva!" -ForegroundColor Green
Write-Host "`n🧪 Teszt:" -ForegroundColor Cyan
Write-Host "curl https://eskuvo-upload-production.gergely-botond.workers.dev/files" -ForegroundColor Yellow
