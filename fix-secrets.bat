@echo off
REM A service account JSON-t újra kell beállítani helyesen
REM Ez a script kijavítja a CF_SERVICE_KEY secret-et

cd /d D:\Informatika\ErnaRoland2026\worker

echo.
echo ================================
echo Secrets Reset es Fix
echo ================================
echo.

REM CF_SERVICE_KEY torlese (hogy ujra beallithassuk)
echo Trying to remove old CF_SERVICE_KEY...
wrangler secret delete CF_SERVICE_KEY --env production --force 2>nul

REM Fajl keresese
echo.
echo Keresem a service-account.json fajlt...

if exist "%USERPROFILE%\Desktop\service-account.json" (
    echo Megtalaltam: %USERPROFILE%\Desktop\service-account.json
    set JSON_PATH=%USERPROFILE%\Desktop\service-account.json
) else if exist "%USERPROFILE%\Downloads\service-account.json" (
    echo Megtalaltam: %USERPROFILE%\Downloads\service-account.json
    set JSON_PATH=%USERPROFILE%\Downloads\service-account.json
) else if exist "D:\Informatika\service-account.json" (
    echo Megtalaltam: D:\Informatika\service-account.json
    set JSON_PATH=D:\Informatika\service-account.json
) else (
    echo HIBA: service-account.json nem talalhato!
    echo Kereslem ezekben a helyeken:
    echo - %USERPROFILE%\Desktop\
    echo - %USERPROFILE%\Downloads\
    echo - D:\Informatika\
    echo.
    echo Kolcs add meg a fajl eleres utvonalat!
    pause
    exit /b 1
)

echo.
echo ✓ JSON fajl: %JSON_PATH%
echo.
echo Beallitom CF_SERVICE_KEY secret-et...
echo.

REM PowerShell parancs a JSON tomorites es secret beallitasahoz
powershell -NoProfile -Command ^
  "$json = Get-Content '%JSON_PATH%' -Raw | ConvertFrom-Json | ConvertTo-Json -Compress; ^
   $json | wrangler secret put CF_SERVICE_KEY --env production; ^
   if ($?) { Write-Host 'OK: CF_SERVICE_KEY beallitva!' -ForegroundColor Green } ^
   else { Write-Host 'HIBA!' -ForegroundColor Red }"

echo.
pause
