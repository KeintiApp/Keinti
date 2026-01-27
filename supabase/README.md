# Supabase (Storage + RLS) para Keinti

## 1) Objetivo
- Mover los archivos multimedia (avatares, imágenes de grupos, media de posts/Home, media de canales y selfies de verificación) a **Supabase Storage**.
- Usar **RLS** como "guardián" cuando el cliente interactúe directamente con Supabase.
- Mientras el backend siga siendo el punto de entrada (JWT propio), el backend sube/lee con **Service Role** y entrega **URLs firmadas** para que React Native pueda mostrar imágenes sin headers.

## 2) Variables de entorno (backend)
En `Backend/.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_STORAGE_BUCKET` (por defecto `keinti_media`)

## 2.1) Admins para revisión de selfies (Paso 1)
La moderación de selfies en producción se hace con endpoints autenticados del backend y una allow-list en la tabla:
- `public.backend_admins`

Para dar permisos de admin a un email (desde Supabase Dashboard → SQL Editor):
```sql
insert into public.backend_admins(email)
values ('tuadmin@correo.com')
on conflict (email) do nothing;
```

## 3) Buckets
Crea un bucket en Supabase Storage:
- `keinti_media`

Puedes hacerlo desde la UI de Supabase (Storage → Create bucket).

## 4) Políticas RLS (Storage)
Aplica el SQL en [supabase/rls_storage.sql](rls_storage.sql) desde Supabase (SQL Editor).

Notas:
- Si NO usas Supabase Auth aún, estas políticas no se aplicarán a tu app porque el backend opera con Service Role.
- Si más adelante migras Auth y el cliente sube directamente, estas políticas ya te sirven como base.

## 5) Integración actual en el repo
Backend:
- `/api/upload` sube a Storage y guarda puntero en `uploaded_images`.
- `/api/upload/image-token/:token` redirige a una URL firmada (signed URL).
- `user_groups` ahora puede guardar `image_uri` + `image_storage_*`.

Autenticación (selfie + TOTP):
- El selfie del Paso 1 se guarda bajo `account-selfies/...` y se borra tras la revisión (privacy best-effort).
- Los admins revisan desde la app (no hay panel localhost) usando `backend_admins`.

## 6) RLS en PostgreSQL (si mantienes tu Postgres fuera de Supabase)
Si sigues con PostgreSQL autogestionado (pgAdmin), puedes aplicar RLS igualmente, pero necesitas una forma de pasar la identidad al DB.

Patrón recomendado:
1) En cada request autenticada, en el backend abre transacción y ejecuta:
   - `SET LOCAL app.user_email = '<email>';`
2) Activa RLS en tablas y crea políticas usando:
   - `current_setting('app.user_email', true)`

Ejemplo:
```sql
ALTER TABLE post_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_owner_select
ON post_users
FOR SELECT
USING (lower(user_email) = lower(current_setting('app.user_email', true)));
```

Esto requiere que tus queries que deban estar protegidas usen transacciones y el `SET LOCAL` por conexión.
