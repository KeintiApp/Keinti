<#
  start-backend.ps1
  Script para iniciar el Backend de Keinti(version compatible con PowerShell 5.1)
  - Evita caracteres Unicode/emojis para prevenir errores de parseo por encoding
  - Crea un archivo .env si no existe
  - Instala dependencias y arranca el servidor con `npm start`
#>

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Iniciando Keinti Backend" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Navegar al directorio del Backend
Set-Location "C:\Users\Antonio David\Documents\KeintiApp\Backend"

# Verificar si node_modules existe
if (-Not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al instalar dependencias" -ForegroundColor Red
        exit 1
    }
}

# Verificar si .env existe
if (-Not (Test-Path ".env")) {
    Write-Host "Archivo .env no encontrado" -ForegroundColor Yellow
    Write-Host "Creando .env con valores por defecto..." -ForegroundColor Yellow

    # Generate a random JWT secret for local dev. Do not hardcode secrets in git.
    $jwtSecret = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")

    $envContent = @'
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=KeintiApp
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret
JWT_SECRET=__JWT_SECRET__

# Upload Paths
UPLOAD_PATH=./uploads
PROFILE_PHOTOS_PATH=./uploads/profile_photos
'@

    $envContent = $envContent.Replace('__JWT_SECRET__', $jwtSecret)

    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host ".env creado" -ForegroundColor Green
}

Write-Host "Iniciando servidor..." -ForegroundColor Green
npm start
