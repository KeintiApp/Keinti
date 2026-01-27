#!/usr/bin/env node

/**
 * Script de Prueba para Foto de Perfil
 * 
 * Este script ayuda a diagnosticar problemas con la funcionalidad
 * de foto de perfil en la app Keinti.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de foto de perfil...\n');

const checks = [];

// 1. Verificar que react-native-image-crop-picker está instalado
console.log('📦 Verificando dependencias...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const cropPickerVersion = packageJson.dependencies['react-native-image-crop-picker'];
  
  if (cropPickerVersion) {
    console.log(`  ✅ react-native-image-crop-picker: ${cropPickerVersion}`);
    checks.push({ name: 'Dependencia instalada', status: 'ok' });
  } else {
    console.log('  ❌ react-native-image-crop-picker NO está instalado');
    checks.push({ name: 'Dependencia instalada', status: 'error' });
  }
} else {
  console.log('  ❌ package.json no encontrado');
  checks.push({ name: 'package.json', status: 'error' });
}

// 2. Verificar AndroidManifest.xml
console.log('\n📱 Verificando permisos de Android...');
const manifestPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  
  const requiredPermissions = [
    'android.permission.CAMERA',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_EXTERNAL_STORAGE',
  ];
  
  let allPermissionsFound = true;
  requiredPermissions.forEach(permission => {
    if (manifest.includes(permission)) {
      console.log(`  ✅ ${permission}`);
    } else {
      console.log(`  ❌ ${permission} - FALTANTE`);
      allPermissionsFound = false;
    }
  });
  
  checks.push({ 
    name: 'Permisos de Android', 
    status: allPermissionsFound ? 'ok' : 'warning' 
  });
} else {
  console.log('  ❌ AndroidManifest.xml no encontrado');
  checks.push({ name: 'AndroidManifest.xml', status: 'error' });
}

// 3. Verificar archivos principales
console.log('\n📄 Verificando archivos...');
const requiredFiles = [
  'src/screens/ProfilePhotoEdit.tsx',
  'src/screens/FrontScreen.tsx',
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar que tenga los imports necesarios
    if (file.includes('ProfilePhotoEdit')) {
      if (content.includes('react-native-image-crop-picker')) {
        console.log(`  ✅ ${file}`);
        checks.push({ name: file, status: 'ok' });
      } else {
        console.log(`  ⚠️  ${file} - Falta import de image-crop-picker`);
        checks.push({ name: file, status: 'warning' });
      }
    } else {
      console.log(`  ✅ ${file}`);
      checks.push({ name: file, status: 'ok' });
    }
  } else {
    console.log(`  ❌ ${file} - NO ENCONTRADO`);
    checks.push({ name: file, status: 'error' });
  }
});

// 4. Verificar funciones clave en ProfilePhotoEdit
console.log('\n🔧 Verificando implementación...');
const profilePhotoEditPath = path.join(__dirname, 'src', 'screens', 'ProfilePhotoEdit.tsx');
if (fs.existsSync(profilePhotoEditPath)) {
  const content = fs.readFileSync(profilePhotoEditPath, 'utf8');
  
  const requiredFunctions = [
    'openNativeCropper',
    'handleApply',
    'handleRecrop',
  ];
  
  let allFunctionsFound = true;
  requiredFunctions.forEach(func => {
    if (content.includes(func)) {
      console.log(`  ✅ Función ${func} encontrada`);
    } else {
      console.log(`  ❌ Función ${func} - FALTANTE`);
      allFunctionsFound = false;
    }
  });
  
  // Verificar manejo de content://
  if (content.includes('content://')) {
    console.log('  ✅ Manejo de URIs content:// implementado');
  } else {
    console.log('  ⚠️  Manejo de URIs content:// NO encontrado');
    allFunctionsFound = false;
  }
  
  checks.push({ 
    name: 'Implementación de funciones', 
    status: allFunctionsFound ? 'ok' : 'warning' 
  });
}

// 5. Verificar dependencias AndroidX en build.gradle
console.log('\n📦 Verificando dependencias AndroidX...');
const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  
  const requiredDependencies = [
    'androidx.transition:transition',
    'androidx.core:core',
    'androidx.appcompat:appcompat',
    'androidx.exifinterface:exifinterface',
  ];
  
  let allDependenciesFound = true;
  requiredDependencies.forEach(dep => {
    if (buildGradle.includes(dep)) {
      console.log(`  ✅ ${dep}`);
    } else {
      console.log(`  ❌ ${dep} - FALTANTE (CRÍTICO)`);
      allDependenciesFound = false;
    }
  });
  
  if (allDependenciesFound) {
    checks.push({ name: 'Dependencias AndroidX', status: 'ok' });
  } else {
    checks.push({ name: 'Dependencias AndroidX', status: 'error' });
    console.log('\n  ⚠️  IMPORTANTE: Sin estas dependencias, el editor de fotos crasheará');
  }
} else {
  console.log('  ❌ build.gradle no encontrado');
  checks.push({ name: 'Dependencias AndroidX', status: 'error' });
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE VERIFICACIÓN\n');

const okCount = checks.filter(c => c.status === 'ok').length;
const warningCount = checks.filter(c => c.status === 'warning').length;
const errorCount = checks.filter(c => c.status === 'error').length;

console.log(`✅ Verificaciones exitosas: ${okCount}`);
console.log(`⚠️  Advertencias: ${warningCount}`);
console.log(`❌ Errores: ${errorCount}`);

if (errorCount === 0 && warningCount === 0) {
  console.log('\n🎉 ¡Todo está configurado correctamente!');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Ejecuta: npm install');
  console.log('   2. Ejecuta: cd android && .\\gradlew clean && cd ..');
  console.log('   3. Ejecuta: npx react-native run-android');
  console.log('   4. Prueba seleccionar una foto de perfil');
} else if (errorCount === 0) {
  console.log('\n⚠️  Hay algunas advertencias, pero debería funcionar.');
  console.log('   Si experimentas problemas, revisa las advertencias.');
} else {
  console.log('\n❌ Se encontraron errores críticos.');
  console.log('   Por favor, corrige los errores antes de continuar.');
}

console.log('\n' + '='.repeat(50));

// Salir con código apropiado
process.exit(errorCount > 0 ? 1 : 0);
