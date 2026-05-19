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

### 3. Configurar acceso al backend en Android

En **desarrollo por USB**, el frontend usa `http://127.0.0.1:3000` y depende de `adb reverse`.
No hace falta cambiar ninguna IP local en la app.

Al arrancar `start-backend.ps1`, el script aplica automáticamente `adb reverse tcp:3000 tcp:3000` a todos los dispositivos Android conectados en estado `device`.

Si conectas un segundo móvil despues de haber arrancado el backend, vuelve a ejecutar:
```powershell
cd "C:\Users\Antonio David\Documents\KeintiApp"
.\start-backend.ps1 -SkipServerStart
```

En **builds Release / Google Play**, la app ya no usa `127.0.0.1`: debes configurar un backend público HTTPS en [Frontend/src/config/api.ts](Frontend/src/config/api.ts) cambiando `PROD_API_URL`.

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

Nota: este script deja configurado `adb reverse` para el puerto `3000` en todos los Android conectados por USB.

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
4. **Si usas dos o más dispositivos por USB**, recuerda que `adb reverse` debe aplicarse por cada serial. `start-backend.ps1` ya lo hace automáticamente para el puerto `3000`.

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
- Verificar que `start-backend.ps1` se haya ejecutado con los móviles ya conectados
- Si conectaste otro dispositivo despues, ejecutar `.\start-backend.ps1 -SkipServerStart` para reaplicar `adb reverse` sin reiniciar Node
- Comprobar por serial con `adb -s SERIAL reverse --list` que exista `tcp:3000 tcp:3000`
- Si quieres verificar desde el dispositivo: `adb -s SERIAL shell "curl -I http://127.0.0.1:3000"`

#### Alternativa (recomendada si el Wi‑Fi bloquea conexiones): ADB reverse
Si tienes **Depuración USB** activada, puedes hacer que cada móvil acceda al backend como si fuera `localhost`:
```powershell
adb -s SERIAL_1 reverse tcp:3000 tcp:3000
adb -s SERIAL_2 reverse tcp:3000 tcp:3000
```
Sin `-s`, cuando hay varios dispositivos conectados, el comando no deja configurado el tunnel en todos.

En ese caso, el backend queda accesible como `http://127.0.0.1:3000` desde cada dispositivo.

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
