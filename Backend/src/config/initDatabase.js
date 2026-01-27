const pool = require('./database');

async function initDatabase() {
  try {
    // Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255),
        birth_date DATE,
        nationality VARCHAR(100),
        gender VARCHAR(20) NOT NULL DEFAULT 'No especificar',
        profile_photo_uri TEXT,
        social_networks JSONB DEFAULT '[]',
        preferred_language VARCHAR(5) NOT NULL DEFAULT 'es',
        balance INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Supabase Auth linkage (migration-safe)
    await pool
      .query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID NULL;`)
      .catch(() => {});
    await pool
      .query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id
         ON users (supabase_user_id)
         WHERE supabase_user_id IS NOT NULL;`
      )
      .catch(() => {});

    // Allow password to be NULL for Supabase-managed users.
    await pool
      .query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`)
      .catch(() => {});

    // Eliminación de columnas obsoletas si existen (migración suave)
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS language;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS phone_number;`).catch(() => {});

    // Preferencia de idioma del usuario (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'es';`
    ).catch(() => {});

    // Datos personales: género (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'No especificar';`
    ).catch(() => {});

    // Seguridad: intentos y bloqueos de comprobación de contraseña (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_check_failed_attempts INTEGER NOT NULL DEFAULT 0;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_check_lock_until TIMESTAMP NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_check_lockouts INTEGER NOT NULL DEFAULT 0;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});

    // Moderación: bloqueos por denuncias (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_blocked BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_block_type VARCHAR(20) NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_block_until TIMESTAMP NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_block_reason TEXT NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_blocked_at TIMESTAMP NULL;`
    ).catch(() => {});

    // Permisos del dispositivo (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gallery_permission_granted BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gallery_permission_updated_at TIMESTAMP NULL;`
    ).catch(() => {});

    // UI hints (migración suave)
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS home_swipe_tutorial_seen BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});

    // Verificación de email (registro): códigos temporales y bloqueos por intentos.
    // Nota: no hay FK a users porque se usa ANTES de crear la cuenta.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        email VARCHAR(255) PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        send_count INTEGER NOT NULL DEFAULT 1,
        verify_failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at
       ON email_verification_codes (expires_at);`
    ).catch(() => {});

    // Rectificaciones/reclamaciones por bloqueo de email en verificación (registro).
    // Tabla sin FK a users porque se usa ANTES de crear la cuenta.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_rectifications (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        message VARCHAR(220) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        reviewed_by VARCHAR(255) NULL,
        decision_reason TEXT NULL
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_email_verification_rectifications_email_created_at
       ON email_verification_rectifications (email, created_at DESC);`
    ).catch(() => {});

    // Admin workflow support:
    // - When an admin changes rectification status to accepted/rejected, auto-fill review fields.
    // - When accepted, automatically unlock the email in email_verification_codes.
    await pool
      .query(`
        CREATE OR REPLACE FUNCTION trg_set_rectification_review_fields()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted', 'rejected') THEN
            IF NEW.reviewed_at IS NULL THEN
              NEW.reviewed_at = NOW();
            END IF;
            IF NEW.reviewed_by IS NULL THEN
              NEW.reviewed_by = CURRENT_USER;
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)
      .catch(() => {});

    await pool
      .query(`
        DROP TRIGGER IF EXISTS set_rectification_review_fields ON email_verification_rectifications;
        CREATE TRIGGER set_rectification_review_fields
        BEFORE UPDATE ON email_verification_rectifications
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_rectification_review_fields();
      `)
      .catch(() => {});

    await pool
      .query(`
        CREATE OR REPLACE FUNCTION trg_unlock_email_on_rectification_accept()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'accepted' THEN
            UPDATE email_verification_codes
            SET locked_until = NULL,
                verify_failed_attempts = 0,
                send_count = 0,
                verified = FALSE,
                verified_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE email = NEW.email;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)
      .catch(() => {});

    await pool
      .query(`
        DROP TRIGGER IF EXISTS unlock_email_on_rectification_accept ON email_verification_rectifications;
        CREATE TRIGGER unlock_email_on_rectification_accept
        AFTER UPDATE OF status ON email_verification_rectifications
        FOR EACH ROW
        EXECUTE FUNCTION trg_unlock_email_on_rectification_accept();
      `)
      .catch(() => {});

    // Recuperación de contraseña: códigos temporales y token de confirmación.
    // Nota: sin FK a users para permitir borrar usuario sin depender de esta tabla.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        email VARCHAR(255) PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        send_count INTEGER NOT NULL DEFAULT 1,
        verify_failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        reset_token_hash TEXT NULL,
        reset_token_expires_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at
       ON password_reset_codes (expires_at);`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_password_reset_codes_reset_token_expires_at
       ON password_reset_codes (reset_token_expires_at);`
    ).catch(() => {});

    // Crear tabla de posts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Post_users (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        presentation JSONB NOT NULL,
        intimidades JSONB DEFAULT '[]',
        reactions JSONB DEFAULT '{"selected": [], "counts": {}, "userReaction": null}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Soft delete: permite conservar el post para métricas/verificación incluso tras expirar,
    // y excluir solo cuando el usuario lo borra antes de las 24h.
    await pool.query(
      `ALTER TABLE Post_users
       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_users_created_at
       ON Post_users (created_at DESC);`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_users_deleted_at
       ON Post_users (deleted_at);`
    ).catch(() => {});

    // Canales: suscripciones y mensajes (para chat por post)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_subscriptions (
        id SERIAL PRIMARY KEY,
        viewer_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        publisher_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(viewer_email, post_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_messages (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        sender_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Índices útiles
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_messages_post_id_id
       ON channel_messages (post_id, id);`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_post_id
       ON channel_subscriptions (post_id);`
    ).catch(() => {});

    // Crear tabla de edición de perfil (borrador)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Edit_post_user (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) UNIQUE REFERENCES users(email) ON DELETE CASCADE,
        presentation JSONB DEFAULT '{}',
        intimidades JSONB DEFAULT '[]',
        reactions JSONB DEFAULT '{"selected": [], "counts": {}, "userReaction": null}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de reacciones individuales
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_reactions (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_email)
      );
    `);

    // Votos de encuestas/quizzes por intimidad
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_poll_votes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        intimidad_index INTEGER NOT NULL,
        option_key VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_email, intimidad_index)
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_poll_votes_post_intimidad
       ON post_poll_votes (post_id, intimidad_index);`
    ).catch(() => {});


    // Crear tabla de grupos del usuario (paneles de Grupos)
    // Imagen almacenada en BD (no en disco)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id SERIAL PRIMARY KEY,
        owner_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        hashtag VARCHAR(80) NOT NULL,
        image_uri TEXT,
        image_data BYTEA,
        mime_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Avatares (foto de perfil) almacenados en BD
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_avatars (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_avatars_user_email ON user_avatars (user_email);`
    ).catch(() => {});

    // Migración suave si la tabla ya existía con image_uri NOT NULL
    await pool.query(`ALTER TABLE user_groups ALTER COLUMN image_uri DROP NOT NULL;`).catch(() => {});
    await pool.query(`ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS image_data BYTEA;`).catch(() => {});
    await pool.query(`ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);`).catch(() => {});
    await pool.query(`ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS image_storage_bucket TEXT;`).catch(() => {});
    await pool.query(`ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS image_storage_path TEXT;`).catch(() => {});

    // Tabla genérica para /api/upload (imagenes en BD, no en /uploads/images)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id SERIAL PRIMARY KEY,
        owner_email VARCHAR(255) REFERENCES users(email) ON DELETE SET NULL,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
        image_data BYTEA,
        mime_type VARCHAR(100) NOT NULL,
        access_token TEXT UNIQUE,
        storage_bucket TEXT,
        storage_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migración suave: permitir uploads almacenados fuera de la BD (Supabase Storage)
    await pool.query(`ALTER TABLE uploaded_images ALTER COLUMN image_data DROP NOT NULL;`).catch(() => {});
    await pool.query(`ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS storage_bucket TEXT;`).catch(() => {});
    await pool.query(`ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS storage_path TEXT;`).catch(() => {});

    // Autenticación de cuenta (selfie + Google Authenticator) en tabla separada.
    // Motivo: mantener users más limpia y aislar datos sensibles.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_auth (
        user_email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        keinti_verified BOOLEAN NOT NULL DEFAULT FALSE,
        keinti_verified_at TIMESTAMP NULL,
        selfie_status VARCHAR(20) NOT NULL DEFAULT 'not_submitted',
        selfie_image_id INTEGER NULL,
        selfie_submitted_at TIMESTAMP NULL,
        selfie_reviewed_at TIMESTAMP NULL,
        selfie_fail_reason TEXT NULL,
        selfie_blocked BOOLEAN NOT NULL DEFAULT FALSE,
        selfie_blocked_at TIMESTAMP NULL,
        selfie_blocked_reason TEXT NULL,
        selfie_blocked_by VARCHAR(255) NULL,
        totp_secret TEXT NULL,
        totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        totp_enabled_at TIMESTAMP NULL
      );
    `).catch(() => {});

    // Admin allow-list (server-only): who can review account selfies in production.
    // Note: this is separate from Supabase RLS app_admins to avoid requiring Supabase Auth for admins.
    await pool
      .query(`
        CREATE TABLE IF NOT EXISTS backend_admins (
          email VARCHAR(255) PRIMARY KEY,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)
      .catch(() => {});

    // Migración suave: verificación de Keinti (objetivos completados)
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS keinti_verified BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS keinti_verified_at TIMESTAMP NULL;`
    ).catch(() => {});

    // Migración suave: bloqueo de reintentos de selfie (p.ej. menor de edad o fraude evidente)
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS selfie_blocked BOOLEAN NOT NULL DEFAULT FALSE;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS selfie_blocked_at TIMESTAMP NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS selfie_blocked_reason TEXT NULL;`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE account_auth ADD COLUMN IF NOT EXISTS selfie_blocked_by VARCHAR(255) NULL;`
    ).catch(() => {});

    // FK opcional: selfie_image_id apunta a uploaded_images.
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE account_auth
        ADD CONSTRAINT fk_account_auth_selfie_image_id
        FOREIGN KEY (selfie_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_account_auth_selfie_status ON account_auth (selfie_status);`
    ).catch(() => {});

    // Migración desde columnas antiguas en users (si existían) -> account_auth.
    // Best-effort: si ya se eliminaron columnas o no existen, ignorar.
    await pool.query(`
      INSERT INTO account_auth (
        user_email,
        verified,
        verified_at,
        selfie_status,
        selfie_image_id,
        selfie_submitted_at,
        selfie_reviewed_at,
        selfie_fail_reason,
        totp_secret,
        totp_enabled,
        totp_enabled_at
      )
      SELECT
        email,
        account_verified,
        account_verified_at,
        account_selfie_status,
        account_selfie_image_id,
        account_selfie_submitted_at,
        account_selfie_reviewed_at,
        account_selfie_fail_reason,
        totp_secret,
        totp_enabled,
        totp_enabled_at
      FROM users
      ON CONFLICT (user_email) DO NOTHING;
    `).catch(() => {});

    // Eliminar columnas antiguas de users (ya no se usan).
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_verified;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_verified_at;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_selfie_status;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_selfie_image_id;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_selfie_submitted_at;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_selfie_reviewed_at;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS account_selfie_fail_reason;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled;`).catch(() => {});
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled_at;`).catch(() => {});

    // Migración suave: enlazar imágenes a un post para expiración automática
    await pool.query(
      `ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS post_id INTEGER;`
    ).catch(() => {});

    // Añadir FK (sin IF NOT EXISTS en Postgres). Ignorar si ya existe.
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE uploaded_images
        ADD CONSTRAINT fk_uploaded_images_post_id
        FOREIGN KEY (post_id) REFERENCES Post_users(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_uploaded_images_post_id
       ON uploaded_images (post_id);`
    ).catch(() => {});

    // Migración suave: enlazar imágenes a un grupo para borrado al eliminar el grupo
    await pool.query(
      `ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS group_id INTEGER;`
    ).catch(() => {});

    // Añadir FK (sin IF NOT EXISTS en Postgres). Ignorar si ya existe.
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE uploaded_images
        ADD CONSTRAINT fk_uploaded_images_group_id
        FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_uploaded_images_group_id
       ON uploaded_images (group_id);`
    ).catch(() => {});

    // Migración suave: token de acceso para servir imágenes sin headers (React Native Image)
    await pool.query(
      `ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_uploaded_images_access_token
       ON uploaded_images (access_token);`
    ).catch(() => {});

    // Contador de aperturas de Intimidades por publicación (para objetivos de verificación).
    // Cada fila representa "un usuario X abrió las intimidades del post Y (creador Z)" una vez.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_intimidades_opens (
        post_id INTEGER NOT NULL REFERENCES Post_users(id) ON DELETE CASCADE,
        creator_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        opener_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, opener_email)
      );
    `).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_post_intimidades_opens_creator_created_at
       ON post_intimidades_opens (creator_email, created_at DESC);`
    ).catch(() => {});

    // Mensajes de grupos (chat grupal)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
        sender_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        message TEXT NOT NULL,
        reply_to_id INTEGER REFERENCES group_messages(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Threading support for group chat messages
    // (for existing DBs, CREATE TABLE IF NOT EXISTS won't add the column)
    await pool.query(`
      ALTER TABLE group_messages
      ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES group_messages(id) ON DELETE SET NULL;
    `);

    // Miembros del grupo (para uniones aceptadas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
        member_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        added_by_email VARCHAR(255) REFERENCES users(email) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, member_email)
      );
    `);

    // Miembros limitados (no pueden enviar mensajes en el grupo)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_member_limits (
        group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
        member_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        limited_by_email VARCHAR(255) REFERENCES users(email) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, member_email)
      );
    `);

    // Solicitudes para unirse a un grupo (notificaciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_join_requests (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE SET NULL,
        requester_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        target_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        block_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        UNIQUE (group_id, requester_email, target_email)
      );
    `);

    // Migración suave: añadir post_id si la tabla existía sin esa columna
    await pool
      .query(`ALTER TABLE group_join_requests ADD COLUMN IF NOT EXISTS post_id INTEGER REFERENCES Post_users(id) ON DELETE SET NULL;`)
      .catch(() => {});

    // Migración suave: añadir block_reason si la tabla existía sin esa columna
    await pool
      .query(`ALTER TABLE group_join_requests ADD COLUMN IF NOT EXISTS block_reason TEXT;`)
      .catch(() => {});

    // Migración suave: si ya existía la FK con ON DELETE CASCADE, cambiarla a ON DELETE SET NULL
    // para que estados como 'blocked' sobrevivan aunque el post se elimine y se vuelva a publicar.
    await pool.query(`
      DO $$
      DECLARE
        fk_name text;
      BEGIN
        SELECT c.conname
        INTO fk_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_class ft ON ft.oid = c.confrelid
        WHERE c.contype = 'f'
          AND t.relname = 'group_join_requests'
          AND ft.relname = 'post_users'
          AND (
            SELECT a.attname
            FROM unnest(c.conkey) AS attnum
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = attnum
            LIMIT 1
          ) = 'post_id'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE group_join_requests DROP CONSTRAINT %I', fk_name);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- ignore
      END $$;
    `).catch(() => {});

    await pool.query(
      `ALTER TABLE group_join_requests
       ADD CONSTRAINT group_join_requests_post_id_fkey
       FOREIGN KEY (post_id) REFERENCES Post_users(id) ON DELETE SET NULL;`
    ).catch(() => {});

    // Denuncias / Reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id SERIAL PRIMARY KEY,
        reporter_email VARCHAR(255) REFERENCES users(email) ON DELETE SET NULL,
        reporter_username TEXT NOT NULL,
        reported_email VARCHAR(255) REFERENCES users(email) ON DELETE SET NULL,
        reported_username TEXT NOT NULL,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE SET NULL,
        reason VARCHAR(60) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_reports_reason_check CHECK (
          reason IN (
            'Contenido sexual o desnudos',
            'Acoso o bullying',
            'Lenguaje ofensivo',
            'Estafa o engaño',
            'Violencia o amenazas',
            'Spam',
            'Suplantación de identidad',
            'Contenido ilegal',
            'Conducta inapropiada',
            'Otros'
          )
        )
      );
    `);

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_reports_reported_reason_created_at ON user_reports (reported_email, reason, created_at DESC);`
    ).catch(() => {});

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_reported_reason_created_at ON user_reports (reporter_email, reported_email, reason, created_at DESC);`
    ).catch(() => {});

    console.log('✅ Tabla users creada/verificada');
    console.log('✅ Tabla Post_users creada/verificada');
    console.log('✅ Tabla Edit_post_user creada/verificada');
    console.log('✅ Tabla post_reactions creada/verificada');
    console.log('✅ Tabla post_poll_votes creada/verificada');
    console.log('✅ Tabla user_groups creada/verificada');
    console.log('✅ Tabla uploaded_images creada/verificada');
    console.log('✅ Tabla group_messages creada/verificada');
    console.log('✅ Tabla group_members creada/verificada');
    console.log('✅ Tabla group_member_limits creada/verificada');
    console.log('✅ Tabla group_join_requests creada/verificada');
    console.log('✅ Tabla user_reports creada/verificada');
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
}

module.exports = initDatabase;
