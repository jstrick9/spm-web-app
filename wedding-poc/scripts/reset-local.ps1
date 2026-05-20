# PowerShell version of reset-local.sh
# Resets the local POC to a clean state on Windows.
#
# Usage from D:\spm\wedding-poc:
#     npm run reset:win
# or:
#     powershell -ExecutionPolicy Bypass -File scripts\reset-local.ps1
#
# NOTE: This file is intentionally ASCII-only (no em-dashes, smart quotes,
# emoji, etc.) because Windows PowerShell 5.1 reads .ps1 files as ANSI by
# default and any non-ASCII character can corrupt parsing.

$ErrorActionPreference = "Stop"

# Move to the repo root regardless of where the script was invoked from
Set-Location -Path "$PSScriptRoot\.."

Write-Host "[reset] stopping anything on port 3000..." -ForegroundColor Cyan
try {
    $procs = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
             Select-Object -ExpandProperty OwningProcess -Unique
    if ($procs) {
        $procs | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Write-Host "  stopped processes: $($procs -join ', ')" -ForegroundColor DarkGray
    } else {
        Write-Host "  nothing was listening" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  (could not check port 3000; that is fine if nothing is running)" -ForegroundColor DarkGray
}

Write-Host "[reset] removing existing database..." -ForegroundColor Cyan
if (Test-Path "server\data") {
    Remove-Item -Recurse -Force "server\data"
}

Write-Host "[reset] running migrate..." -ForegroundColor Cyan
npm --prefix server run migrate
if ($LASTEXITCODE -ne 0) { throw "migrate failed" }

Write-Host "[reset] seeding demo data..." -ForegroundColor Cyan
npm --prefix server run seed
if ($LASTEXITCODE -ne 0) { throw "seed failed" }

Write-Host ""
Write-Host "[OK] ready. start the dev servers with:" -ForegroundColor Green
Write-Host "      npm run dev:server   (terminal 1)" -ForegroundColor Yellow
Write-Host "      npm run dev:client   (terminal 2)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   then visit http://localhost:5173/" -ForegroundColor Green
