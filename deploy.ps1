# Safe Ride Network - Production deployment helper (Windows)
# Usage: .\deploy.ps1
#
# Runs a clean Vercel production deploy from the project root.

$ErrorActionPreference = "Stop"

# Allow this script to run in the current PowerShell session only
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Navigate to the directory containing this script (project root)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host ""
Write-Host "Safe Ride Network - Deploying to Vercel (production)" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray
Write-Host ""

# Verify Vercel project is linked (optional warning)
if (-not (Test-Path ".vercel\project.json")) {
    Write-Host "Note: No .vercel\project.json found. First run may prompt to link the project." -ForegroundColor Yellow
}

# Run production deploy
& "C:\Program Files\nodejs\npx.cmd" vercel --prod --yes

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Deploy failed (exit code $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy finished successfully." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Confirm https://www.saferidenetwork.com loads"
Write-Host "  2. Set up Stripe webhook at /api/stripe/webhook (see DEPLOYMENT.md)"
Write-Host "  3. Add STRIPE_WEBHOOK_SECRET to Vercel and redeploy if not set yet"
Write-Host ""