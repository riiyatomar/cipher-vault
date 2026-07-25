
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  CipherVault - Starting Backend      " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$env:USE_SQLITE = "true"
$env:SKIP_REDIS = "true"
$env:JWT_SECRET_KEY = "dev_jwt_secret_key_change_in_production_please"
$env:JWT_ALGORITHM = "HS256"
$env:JWT_ACCESS_TOKEN_EXPIRE_MINUTES = "30"
$env:JWT_REFRESH_TOKEN_EXPIRE_DAYS = "7"
$env:AUTH_SERVICE_URL = "http://localhost:8001"
$env:DOCUMENT_SERVICE_URL = "http://localhost:8002"
$env:ENCRYPTION_SERVICE_URL = "http://localhost:8003"
$env:STORAGE_SERVICE_URL = "http://localhost:8004"
$env:AUDIT_SERVICE_URL = "http://localhost:8005"
$env:CORS_ORIGINS = "http://localhost:3000"
$env:PYTHONPATH = "c:\Users\HP\CipherVault\services"

$authDir = "c:\Users\HP\CipherVault\services\auth-service"
$gatewayDir = "c:\Users\HP\CipherVault\services\api-gateway"

Write-Host "[1/2] Starting Auth Service on port 8001..." -ForegroundColor Yellow
$auth = Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","8001" -WorkingDirectory $authDir -PassThru
Start-Sleep -Seconds 3

Write-Host "[2/2] Starting API Gateway on port 8000..." -ForegroundColor Yellow
$gateway = Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","8000" -WorkingDirectory $gatewayDir -PassThru
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Backend is RUNNING!" -ForegroundColor Green
Write-Host "  API Gateway:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Auth Service: http://localhost:8001" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press ENTER to stop both services..." -ForegroundColor Gray

Read-Host

Write-Host "Stopping services..." -ForegroundColor Yellow
if ($auth -and !$auth.HasExited) { Stop-Process -Id $auth.Id -Force -ErrorAction SilentlyContinue }
if ($gateway -and !$gateway.HasExited) { Stop-Process -Id $gateway.Id -Force -ErrorAction SilentlyContinue }
Write-Host "All services stopped." -ForegroundColor Red
