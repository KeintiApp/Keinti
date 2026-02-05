# Guía de Configuración - KeintiApp App

## 🔧 Configuración Inicial

> Nota: el backend puede usar PostgreSQL **local** o el **Postgres de Supabase**.
> Si quieres administrar tablas (bloqueos/rectificaciones) desde el panel de Supabase, debes usar Supabase Postgres.

### 1. Instalar PostgreSQL
- Descargar e instalar PostgreSQL desde https://www.postgresql.org/download/windows/
- Durante la instalación, establecer contraseña para el usuario `postgres`
- Por defecto el puerto es `5432`

### 2. Configurar Base de Datos
Abrir pgAdmin o usar línea de comandos:
```sql
CREATE DATABASE KeintiApp;
```

### 3. Configurar IP Local para Android

#### Encontrar tu IP local:
```powershell
ipconfig
```
Busca la línea "IPv4 Address" en tu adaptador de red activo (ejemplo: 192.168.1.10)

#### Actualizar configuración del Frontend:
En **desarrollo** (cuando ejecutas `npx react-native start`), la app intenta detectar automáticamente el host/IP del Metro Bundler y usarlo también para el backend.

Si estás usando un **APK/Release** (sin Metro), entonces sí necesitas fijar la IP del PC en [Frontend/src/config/api.ts](Frontend/src/config/api.ts) cambiando `DEFAULT_API_HOST`:
```typescript
const DEFAULT_API_HOST = 'TU_IP_LOCAL';
```
Ejemplo:
```typescript
const DEFAULT_API_HOST = '192.168.1.10';
```

### 4. Configurar Backend (si es necesario)
Editar `Backend/.env` y verificar/modificar:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=KeintiApp
DB_USER=postgres
DB_PASSWORD=tu_contraseña_postgres
```

### 4A. (Opción A) Configurar Backend con Supabase Postgres
Si quieres ver/editar las tablas desde Supabase (Table Editor), configura el backend para conectarse al Postgres de tu proyecto Supabase.

1) En Supabase abre:
- **Project Settings → Database → Connection string**

2) En `Backend/.env` añade (recomendado):
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DB_SSL=true
```

Notas:
- Supabase requiere SSL → `DB_SSL=true`.
- Si usas el **Transaction pooler** (pgBouncer), el puerto suele ser `6543`.

3) Arranca el backend: al iniciar ejecuta `initDatabase()` y creará las tablas en Supabase.

4) Verifica en Supabase:
- **Database → Table Editor**: ahora sí aparecerán tus tablas (por ejemplo `users`, `email_verification_codes`, `email_verification_rectifications`).

## 🚀 Comandos para Iniciar la App

### Terminal 1 - Backend:
```powershell
cd "C:\Users\Antonio David\Documents\KeintiApp"
.\start-backend.ps1
```

### Terminal 2 - Metro Bundler:
```powershell
cd "C:\Users\Antonio David\Documents\KeintiApp\Frontend"
npx react-native start --reset-cache
```

### Terminal 3 - Instalar en Android:
```powershell
cd "C:\Users\Antonio David\Documents\KeintiApp\Frontend"
npx react-native run-android
```

## 📱 Requisitos Android

1. **Habilitar modo desarrollador** en tu dispositivo Android
2. **Conectar por USB** y autorizar depuración USB
3. **Verificar conexión**: `adb devices`
4. **Asegurar que el dispositivo esté en la misma red WiFi** que tu PC

## 🗺️ Google Maps / Places (sin exponer claves)

### Android (mapa nativo)
La clave de **Google Maps SDK for Android** no debe commitearse. Configúrala en `Frontend/android/local.properties` (este archivo ya está en `.gitignore`):

```properties
GOOGLE_MAPS_API_KEY=TU_CLAVE
```

### Places (búsqueda de ubicaciones)
La búsqueda (autocomplete + details) se hace ahora **vía backend** para no exponer la clave en la app.

En `Backend/.env`:

```env
GOOGLE_PLACES_API_KEY=TU_CLAVE
```

## 🔍 Solución de Problemas

### Backend no se conecta:
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `.env`
- Verificar que el puerto 3000 esté disponible

### Frontend no conecta con Backend:
- Verificar que la IP del PC **no haya cambiado** (Windows puede pasar de 192.168.0.97 a 192.168.0.98, etc.)
- Probar desde el móvil (navegador): `http://IP_DEL_PC:3000/` debe devolver JSON
- Verificar que el firewall permita conexiones al puerto 3000 (Node.js) en red **Privada**
- Verificar que el router no tenga “AP/client isolation” activado (bloquea dispositivos entre sí)

#### Alternativa (recomendada si el Wi‑Fi bloquea conexiones): ADB reverse
Si tienes **Depuración USB** activada, puedes hacer que el móvil acceda al backend como si fuera `localhost`:
```powershell
adb reverse tcp:3000 tcp:3000
```
En ese caso, el backend queda accesible como `http://127.0.0.1:3000` desde el dispositivo.

### Clean de Android:
```powershell
cd "C:\Users\Antonio David\Documents\KeintiApp\Frontend"
cd android
.\gradlew clean
cd ..
```

## 📋 Estructura de Pantallas

1. **LoginScreen** - Inicio de sesión
2. **RegisterScreen** - Registro de nuevo usuario (4 pasos)
3. **ProfilePhotoEdit** - Edición de foto de perfil (recorte circular)
4. **FrontScreen** - Pantalla principal con sorteos

## 🗄️ Base de Datos

El Backend crea automáticamente las siguientes tablas:
- `users` - Usuarios de la app
- `giveaways` - Sorteos publicados
- `participations` - Participaciones en sorteos

## 🔐 Autenticación

La app usa JWT (JSON Web Tokens) para autenticación:
- El token se obtiene al hacer login
- Se debe incluir en el header: `Authorization: Bearer TOKEN`
- Expira en 7 días
