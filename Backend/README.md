# Keinti Backend

Backend básico para Keinti

## Instalación
```bash
npm install
```

## Ejecutar
```bash
npm start
```

## Base de datos en Supabase (recomendado)
Por defecto este backend usa PostgreSQL vía `pg`. Si quieres administrar bloqueos/rectificaciones desde Supabase (Table Editor), conecta el backend al **Postgres de Supabase**.

### 1) Copiar credenciales en Supabase
En tu proyecto Supabase:

- **Project Settings → Database → Connection string**
	- Puedes usar **Direct connection** o **Transaction pooler** (pgBouncer).

Recomendación:
- Dev/local: Direct connection
- Producción: Transaction pooler (mejor para límites de conexiones)

### 2) Configurar `Backend/.env`
Opción más simple (recomendada): usar `DATABASE_URL`.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DB_SSL=true
```

Notas:
- En Supabase casi siempre necesitas `DB_SSL=true`.
- Si usas **Transaction pooler**, el puerto suele ser `6543`.

### 3) Arrancar backend y crear tablas
Al arrancar, el backend ejecuta `initDatabase()` y crea/actualiza las tablas automáticamente.

### 4) Verificar en Supabase
En Supabase:

- **Database → Table Editor**: deberías ver tablas como `users`, `email_verification_codes`, `email_verification_rectifications`.

O en **SQL Editor**:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Supabase Storage (multimedia)
El backend puede guardar multimedia en Supabase Storage y servirla mediante URLs firmadas (ideal para React Native `<Image />`, que normalmente no envía headers).

Configura estas variables en `Backend/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo backend; NO exponer al móvil)
- `SUPABASE_STORAGE_BUCKET` (por defecto `keinti_media`)

Políticas RLS de ejemplo: ver [supabase/README.md](../supabase/README.md).

## Supabase Auth (login/registro)
Si usas Supabase para autenticar (email+password u OTP), este backend verifica credenciales contra **Supabase Auth** y guarda en la tabla `users` solo el perfil público.

Variables necesarias en `Backend/.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (se usa en el backend para `signInWithPassword`)

Opcional pero recomendado (operaciones admin, migraciones y recuperaciones):

- `SUPABASE_SERVICE_ROLE_KEY` (solo backend; NO exponer al móvil)

Notas:

- En modo Supabase Auth, el campo `users.password` puede aparecer como `NULL` (esto es correcto): la contraseña vive en Supabase Auth.
- Si falta `SUPABASE_ANON_KEY`, el endpoint `/api/auth/login` no podrá validar contraseñas de usuarios Supabase y devolverá un error de configuración.

## Verificación de email (registro)
Para que el flujo de registro envíe un código al email, configura estas variables en `Backend/.env`:

- `EMAIL_VERIFICATION_SMTP_USER` (por ejemplo: `keinticode@gmail.com`)
- `EMAIL_VERIFICATION_SMTP_PASS` (contraseña de aplicación de Gmail)

Opcionales (con valores por defecto):

- `EMAIL_VERIFICATION_TTL_SECONDS` (por defecto: `300` = 5 minutos)
- `EMAIL_VERIFICATION_MAX_SENDS` (por defecto: `2`)
- `EMAIL_VERIFICATION_MAX_ATTEMPTS` (por defecto: `6`)
- `EMAIL_VERIFICATION_LOCK_MINUTES` (por defecto: `30`)
- `EMAIL_VERIFICATION_VERIFIED_TTL_MINUTES` (por defecto: `10`)
