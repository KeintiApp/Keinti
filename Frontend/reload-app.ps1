# Script para recargar la aplicación React Native automáticamente
# Envía el comando 'r' (reload) al Metro Bundler

Write-Host "🔄 Recargando aplicación React Native..." -ForegroundColor Cyan
Write-Host ""

# Verificar si Metro está corriendo
$metroProcess = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue

if ($metroProcess) {
    Write-Host "✅ Metro Bundler detectado en puerto 8081" -ForegroundColor Green
    
    # Mostrar instrucciones manuales
    Write-Host ""
    Write-Host "� Para recargar la aplicación:" -ForegroundColor Cyan
    Write-Host "   1. En tu dispositivo Android, agita para abrir el menú de desarrollo" -ForegroundColor White
    Write-Host "   2. Selecciona 'Reload' o presiona R+R" -ForegroundColor White
    Write-Host ""
    Write-Host "   O en la terminal donde corre Metro, presiona: r" -ForegroundColor White
} else {
    Write-Host "❌ Metro Bundler NO está corriendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "🚀 Para iniciar Metro con caché limpia:" -ForegroundColor Cyan
    Write-Host "   cd Frontend" -ForegroundColor White
    Write-Host "   npm start -- --reset-cache" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "📝 Después de recargar, prueba escribir: @gonza" -ForegroundColor Cyan
Write-Host "   Debe aparecer: ✓ Usuario @gonza encontrado" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
