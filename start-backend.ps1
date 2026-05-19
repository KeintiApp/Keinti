<#
  start-backend.ps1
  Script para iniciar el Backend de Keinti(version compatible con PowerShell 5.1)
  - Evita caracteres Unicode/emojis para prevenir errores de parseo por encoding
  - Crea un archivo .env si no existe
  - Configura adb reverse tcp:3000 para todos los Android conectados por USB
  - Instala dependencias y arranca el servidor con `npm start`
#>

param(
    [switch]$SkipServerStart
)

function Set-AndroidBackendReverse {
    $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
    if (-Not $adbCommand) {
        Write-Host "adb no esta disponible. Omitiendo adb reverse para Android." -ForegroundColor Yellow
        return
    }

    $deviceLines = (& adb devices) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and -not $_.StartsWith('List of devices attached') -and -not $_.StartsWith('*') }

    if (-Not $deviceLines) {
        Write-Host "No hay dispositivos Android conectados. Omitiendo adb reverse." -ForegroundColor Yellow
        return
    }

    $readySerials = @()

    foreach ($line in $deviceLines) {
        $parts = $line -split '\s+'
        if ($parts.Count -lt 2) {
            continue
        }

        $serial = $parts[0]
        $state = $parts[1]

        if ($state -eq 'device') {
            $readySerials += $serial
            continue
        }

        Write-Host ("Dispositivo omitido ({0}): estado {1}" -f $serial, $state) -ForegroundColor Yellow
    }

    if (-Not $readySerials.Count) {
        Write-Host "No hay dispositivos Android listos en estado 'device'." -ForegroundColor Yellow
        return
    }

    Write-Host "Configurando adb reverse tcp:3000 en todos los dispositivos conectados..." -ForegroundColor Cyan

    foreach ($serial in $readySerials) {
        & adb -s $serial reverse tcp:3000 tcp:3000 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host ("adb reverse tcp:3000 listo en {0}" -f $serial) -ForegroundColor Green
        } else {
            Write-Host ("No se pudo configurar adb reverse tcp:3000 en {0}" -f $serial) -ForegroundColor Red
        }
    }
}

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

Set-AndroidBackendReverse

if ($SkipServerStart) {
    Write-Host "Configuracion completada. No se iniciara el backend porque se uso -SkipServerStart." -ForegroundColor Cyan
    return
}

Write-Host "Iniciando servidor..." -ForegroundColor Green
npm start
