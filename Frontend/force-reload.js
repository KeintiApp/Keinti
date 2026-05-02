// Script para forzar recarga de la aplicación React Native
const http = require('http');

console.log('🔄 Intentando recargar la aplicación React Native...\n');

// Opción 1: Endpoint de recarga
const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/reload',
  method: 'POST',
};

const req = http.request(options, (res) => {
  console.log(`✅ Respuesta del servidor: ${res.statusCode}`);

  res.on('data', (d) => {
    process.stdout.write(d);
  });

  res.on('end', () => {
    console.log('\n\n📱 La aplicación debería recargarse ahora en tu dispositivo.');
    console.log('Si no se recarga automáticamente:');
    console.log('  1. Agita tu dispositivo');
    console.log('  2. Selecciona "Reload"\n');
  });
});

req.on('error', (error) => {
  console.error('❌ Error al conectar con Metro:', error.message);
  console.log('\n🔧 Solución manual:');
  console.log('  1. En tu dispositivo, agita para abrir el menú');
  console.log('  2. Selecciona "Reload" o presiona R+R');
  console.log('  3. O en la terminal de Metro, presiona: r\n');
});

req.end();
