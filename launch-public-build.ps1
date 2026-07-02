Write-Host "Building Premium AI website for one-port public launch..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\web"
"VITE_API_URL=/api" | Set-Content .env.production
npm run build
Write-Host "Build complete. Now start server:" -ForegroundColor Green
Write-Host "cd \"$PSScriptRoot\server\"" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:8080" -ForegroundColor Green
Write-Host "For public URL, run: cloudflared tunnel --url http://localhost:8080" -ForegroundColor Cyan
