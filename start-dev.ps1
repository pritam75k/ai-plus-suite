Write-Host "Starting AI Plus server and website..." -ForegroundColor Cyan

if (!(Test-Path "$PSScriptRoot\server\.env")) {
  Copy-Item "$PSScriptRoot\server\.env.example" "$PSScriptRoot\server\.env"
  Write-Host "Created server\.env" -ForegroundColor Yellow
}

if (!(Test-Path "$PSScriptRoot\web\.env")) {
  Copy-Item "$PSScriptRoot\web\.env.example" "$PSScriptRoot\web\.env"
  Write-Host "Created web\.env" -ForegroundColor Yellow
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npm install; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\web'; npm install; npm run dev"

Write-Host "Server:  http://localhost:8080/api/health" -ForegroundColor Green
Write-Host "Website: http://localhost:5173" -ForegroundColor Green
Write-Host "OTP email ke liye server\.env me SMTP settings bharo." -ForegroundColor Yellow
Write-Host "Mobile app ke liye mobile folder me: npm install; npx expo start" -ForegroundColor Yellow
