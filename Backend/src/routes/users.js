const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const { buildObjectPath, uploadBuffer, deleteObject, isSupabaseConfigured: isSupabaseStorageConfigured } = require('../services/supabaseStorageService');
const {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  isSupabaseConfigured: isSupabaseAdminConfigured,
  isSupabaseAuthConfigured,
} = require('../config/supabase');

const router = express.Router();

const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

function isStrongPassword(pass) {
  const value = String(pass || '');
  if (value.length < 10) return false;
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
  return specialCharRegex.test(value);
}

async function findSupabaseUserIdByEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  if (!isSupabaseAdminConfigured()) return null;

  const admin = getSupabaseAdminClient();
  const perPage = 200;
  const maxPages = Math.max(1, Number(process.env.SUPABASE_ADMIN_MAX_USER_PAGES || 20));

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = Array.isArray(data?.users) ? data.users : [];
    for (const u of users) {
      if (normalizeEmail(u?.email) === e) {
        return u?.id ? String(u.id) : null;
      }
    }
    if (users.length < perPage) break;
  }
  return null;
}

// Configurar multer para subida de imágenes
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

function generateAccessToken() {
  // 32 bytes => 64 hex chars
  return crypto.randomBytes(32).toString('hex');
}

// Obtener perfil de usuario
router.get('/profile/:username', async (req, res) => {
  try {
    const raw = (req.params.username || '').trim();
    const noAt = raw.replace(/^@/, '');
    const candidates = Array.from(new Set([raw, noAt, `@${noAt}`].filter(Boolean)));

    const result = await pool.query(
      'SELECT username, profile_photo_uri, social_networks FROM users WHERE username = ANY($1)',
      [candidates]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    let socialNetworks = row.social_networks;

    if (typeof socialNetworks === 'string' && socialNetworks.trim().length > 0) {
      try {
        socialNetworks = JSON.parse(socialNetworks);
      } catch {
        // ignore
      }
    }

    if (!Array.isArray(socialNetworks)) {
      socialNetworks = [];
    }

    res.json({
      ...row,
      social_networks: socialNetworks,
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Obtener username por email (requiere sesión)
router.get('/username-by-email', authenticateToken, async (req, res) => {
  try {
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'email requerido' });
    }

    const result = await pool.query('SELECT username FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ username: result.rows[0].username });
  } catch (error) {
    console.error('Error al obtener username por email:', error);
    return res.status(500).json({ error: 'Error al obtener username' });
  }
});

// Actualizar foto de perfil
router.post('/profile-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó una imagen' });
    }

    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const prev = await pool.query('SELECT profile_photo_uri FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    const previousPhotoUri = prev.rows?.[0]?.profile_photo_uri ? String(prev.rows[0].profile_photo_uri) : null;

    // Guardar avatar en PostgreSQL (sin procesado nativo) para evitar fallos de decodificación
    // que pueden tumbar la conexión y aparecer como "Network request failed" en React Native.
    const ownerEmail = email;
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const accessToken = generateAccessToken();

    if (!isSupabaseStorageConfigured()) {
      await pool.query(
        'INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token) VALUES ($1, $2, $3, $4, $5, $6)',
        [ownerEmail, null, null, req.file.buffer, mimeType, accessToken]
      );

      const photoUri = `/api/upload/image-token/${accessToken}`;
      await pool.query(
        'UPDATE users SET profile_photo_uri = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [photoUri, email]
      );

      // Eliminar avatar anterior (best-effort)
      if (previousPhotoUri && previousPhotoUri !== photoUri) {
        const mToken = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/upload\/image-token\/([^/?#]+)$/i);
        if (mToken?.[1]) {
          const del = await pool
            .query(
              'DELETE FROM uploaded_images WHERE access_token = $1 AND (owner_email = $2 OR owner_email IS NULL) RETURNING storage_bucket, storage_path',
              [mToken[1], email]
            )
            .catch(() => null);
          const bucket = del?.rows?.[0]?.storage_bucket || null;
          const path = del?.rows?.[0]?.storage_path || null;
          if (bucket && path) {
            await deleteObject({ bucket, path }).catch(() => {});
          }
        } else {
          const mLegacy = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/users\/avatar\/(\d+)(?:\?.*)?$/i);
          if (mLegacy?.[1]) {
            await pool.query('DELETE FROM user_avatars WHERE id = $1 AND user_email = $2', [Number(mLegacy[1]), email]).catch(() => {});
          }
        }
      }

      return res.json({ profile_photo_uri: photoUri });
    }

    const objectPath = buildObjectPath({
      kind: 'avatars',
      ownerEmail,
      mimeType,
    });

    const uploaded = await uploadBuffer({
      buffer: req.file.buffer,
      mimeType,
      path: objectPath,
    });

    await pool.query(
      `INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token, storage_bucket, storage_path)
       VALUES ($1, NULL, NULL, NULL, $2, $3, $4, $5)`,
      [ownerEmail, mimeType, accessToken, uploaded.bucket, uploaded.path]
    );

    const photoUri = `/api/upload/image-token/${accessToken}`;

    // Actualizar en base de datos de usuarios
    await pool.query(
      'UPDATE users SET profile_photo_uri = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [photoUri, email]
    );

    // Eliminar avatar anterior (best-effort) en DB + Storage
    if (previousPhotoUri && previousPhotoUri !== photoUri) {
      const mToken = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/upload\/image-token\/([^/?#]+)$/i);
      if (mToken?.[1]) {
        const del = await pool
          .query(
            'DELETE FROM uploaded_images WHERE access_token = $1 AND (owner_email = $2 OR owner_email IS NULL) RETURNING storage_bucket, storage_path',
            [mToken[1], email]
          )
          .catch(() => null);

        const bucket = del?.rows?.[0]?.storage_bucket || null;
        const path = del?.rows?.[0]?.storage_path || null;
        if (bucket && path) {
          await deleteObject({ bucket, path }).catch(() => {});
        }
      } else {
        const mLegacy = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/users\/avatar\/(\d+)(?:\?.*)?$/i);
        if (mLegacy?.[1]) {
          await pool.query('DELETE FROM user_avatars WHERE id = $1 AND user_email = $2', [Number(mLegacy[1]), email]).catch(() => {});
        }
      }
    }

    res.json({ profile_photo_uri: photoUri });
  } catch (error) {
    console.error('Error al actualizar foto de perfil:', error);
    res.status(500).json({ error: 'Error al actualizar foto de perfil' });
  }
});

// Servir foto de perfil desde DB
router.get('/avatar/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT image_data, mime_type FROM user_avatars WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Avatar no encontrado');
    }

    const avatar = result.rows[0];
    res.setHeader('Content-Type', avatar.mime_type);
    res.send(avatar.image_data);
  } catch (error) {
    console.error('Error al obtener avatar:', error);
    res.status(500).send('Error al obtener avatar');
  }
});

// Actualizar redes sociales
router.put('/social-networks', authenticateToken, async (req, res) => {
  const { social_networks } = req.body;

  try {
    await pool.query(
      'UPDATE users SET social_networks = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [JSON.stringify(social_networks), req.user.email]
    );

    res.json({ message: 'Redes sociales actualizadas', social_networks });
  } catch (error) {
    console.error('Error al actualizar redes sociales:', error);
    res.status(500).json({ error: 'Error al actualizar redes sociales' });
  }
});

// Actualizar preferencia de idioma
router.put('/language', authenticateToken, async (req, res) => {
  const raw = (req.body?.language ?? '').toString().trim().toLowerCase();
  const language = raw === 'en' ? 'en' : raw === 'es' ? 'es' : null;

  if (!language) {
    return res.status(400).json({ error: 'Idioma inválido' });
  }

  try {
    await pool.query(
      'UPDATE users SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [language, req.user.email]
    );

    res.json({ preferred_language: language });
  } catch (error) {
    console.error('Error al actualizar idioma:', error);
    res.status(500).json({ error: 'Error al actualizar idioma' });
  }
});

// Eliminar mi cuenta (requiere sesión)
// Borra datos del usuario en distintas tablas y finalmente elimina el registro en users.
// Obtener mis datos personales (requiere sesión)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const [result, adminRes] = await Promise.all([
      pool.query(
        'SELECT email, username, birth_date, gender, nationality, gallery_permission_granted, gallery_permission_updated_at FROM users WHERE lower(email) = $1 LIMIT 1',
        [email]
      ),
      pool
        .query('SELECT 1 FROM backend_admins WHERE lower(email) = $1 LIMIT 1', [email])
        .catch(() => ({ rows: [] })),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      email: row.email,
      username: row.username,
      birth_date: row.birth_date,
      gender: row.gender,
      nationality: row.nationality,
      gallery_permission_granted: row.gallery_permission_granted === true,
      gallery_permission_updated_at: row.gallery_permission_updated_at,
      is_admin: (adminRes?.rows?.length || 0) > 0,
    });
  } catch (error) {
    console.error('Error al obtener mis datos:', error);
    return res.status(500).json({ error: 'Error al obtener mis datos' });
  }
});

// Actualizar mi nacionalidad (requiere sesión)
router.put('/me/nationality', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const nationality = String(req.body?.nationality ?? '').trim();
    if (!nationality) {
      return res.status(400).json({ error: 'nationality requerida' });
    }

    const result = await pool.query(
      'UPDATE users SET nationality = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING nationality',
      [nationality, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ nationality: result.rows[0].nationality });
  } catch (error) {
    console.error('Error al actualizar mi nacionalidad:', error);
    return res.status(500).json({ error: 'Error al actualizar mi nacionalidad' });
  }
});

// Obtener permisos del dispositivo (requiere sesión)
router.get('/me/device-permissions', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const result = await pool.query(
      'SELECT gallery_permission_granted, gallery_permission_updated_at FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      galleryPermissionGranted: row.gallery_permission_granted === true,
      updatedAt: row.gallery_permission_updated_at,
    });
  } catch (error) {
    console.error('Error al obtener permisos del dispositivo:', error);
    return res.status(500).json({ error: 'Error al obtener permisos del dispositivo' });
  }
});

// Actualizar permisos del dispositivo (requiere sesión)
router.put('/me/device-permissions', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const galleryPermissionGranted = req.body?.galleryPermissionGranted;
    if (typeof galleryPermissionGranted !== 'boolean') {
      return res.status(400).json({ error: 'galleryPermissionGranted debe ser boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET gallery_permission_granted = $1, gallery_permission_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING gallery_permission_granted, gallery_permission_updated_at',
      [galleryPermissionGranted, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      galleryPermissionGranted: row.gallery_permission_granted === true,
      updatedAt: row.gallery_permission_updated_at,
    });
  } catch (error) {
    console.error('Error al actualizar permisos del dispositivo:', error);
    return res.status(500).json({ error: 'Error al actualizar permisos del dispositivo' });
  }
});

// Obtener hints de UI (requiere sesión)
router.get('/me/ui-hints', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const result = await pool.query(
      'SELECT home_swipe_tutorial_seen FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      homeSwipeTutorialSeen: row.home_swipe_tutorial_seen === true,
    });
  } catch (error) {
    console.error('Error al obtener ui-hints:', error);
    return res.status(500).json({ error: 'Error al obtener ui-hints' });
  }
});

// Actualizar hints de UI (requiere sesión)
router.put('/me/ui-hints', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const homeSwipeTutorialSeen = req.body?.homeSwipeTutorialSeen;
    if (typeof homeSwipeTutorialSeen !== 'boolean') {
      return res.status(400).json({ error: 'homeSwipeTutorialSeen debe ser boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET home_swipe_tutorial_seen = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING home_swipe_tutorial_seen',
      [homeSwipeTutorialSeen, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      homeSwipeTutorialSeen: row.home_swipe_tutorial_seen === true,
    });
  } catch (error) {
    console.error('Error al actualizar ui-hints:', error);
    return res.status(500).json({ error: 'Error al actualizar ui-hints' });
  }
});

// Verificar mi contraseña actual (requiere sesión)
router.post('/verify-password', authenticateToken, async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    const password = String(req.body?.password || '');

    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Contraseña requerida' });
    }

    const result = await pool.query(
      'SELECT password, supabase_user_id, password_check_failed_attempts, password_check_lock_until, password_check_lockouts, account_locked FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    if (row.account_locked === true) {
      return res.status(403).json({ valid: false, accountLocked: true, error: 'Cuenta bloqueada' });
    }

    const lockUntil = row.password_check_lock_until ? new Date(row.password_check_lock_until) : null;
    if (lockUntil && lockUntil.getTime() > Date.now()) {
      return res.status(429).json({
        valid: false,
        locked: true,
        lockUntil: lockUntil.toISOString(),
        error: 'Campo bloqueado temporalmente',
      });
    }

    let ok = false;
    // Prefer Supabase Auth when configured.
    if (isSupabaseAuthConfigured()) {
      const supabaseAnon = getSupabaseAnonClient();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (!error && data?.user?.id) {
        ok = true;
        const supabaseUserId = String(data.user.id);
        if (!row.supabase_user_id) {
          await pool
            .query(
              'UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)',
              [email, supabaseUserId]
            )
            .catch(() => {});
        }
      }
    }

    // Legacy bcrypt fallback (for old accounts during migration).
    if (!ok && row.password) {
      const hash = String(row.password);
      ok = await bcrypt.compare(password, hash);
    }

    if (ok) {
      await pool.query(
        'UPDATE users SET password_check_failed_attempts = 0, password_check_lock_until = NULL WHERE lower(email) = $1',
        [email]
      );

      return res.json({ valid: true, attemptsRemaining: 5 });
    }

    const failedAttempts = Number(row.password_check_failed_attempts || 0) + 1;
    const attemptsRemaining = Math.max(0, 5 - failedAttempts);

    if (failedAttempts >= 5) {
      const newLockouts = Number(row.password_check_lockouts || 0) + 1;
      const lockUntilDate = new Date(Date.now() + 30 * 60 * 1000);

      if (newLockouts >= 3) {
        await pool.query(
          'UPDATE users SET account_locked = TRUE, password_check_failed_attempts = 0, password_check_lockouts = $1, password_check_lock_until = $2 WHERE lower(email) = $3',
          [newLockouts, lockUntilDate.toISOString(), email]
        );

        return res.status(403).json({
          valid: false,
          accountLocked: true,
          lockUntil: lockUntilDate.toISOString(),
          error: 'Cuenta bloqueada',
        });
      }

      await pool.query(
        'UPDATE users SET password_check_failed_attempts = 0, password_check_lockouts = $1, password_check_lock_until = $2 WHERE lower(email) = $3',
        [newLockouts, lockUntilDate.toISOString(), email]
      );

      return res.status(429).json({
        valid: false,
        locked: true,
        lockUntil: lockUntilDate.toISOString(),
        attemptsRemaining: 0,
        error: 'Campo bloqueado temporalmente',
      });
    }

    await pool.query(
      'UPDATE users SET password_check_failed_attempts = $1 WHERE lower(email) = $2',
      [failedAttempts, email]
    );

    return res.status(401).json({ valid: false, attemptsRemaining, error: 'Contraseña incorrecta' });
  } catch (error) {
    console.error('Error al verificar contraseña:', error);
    return res.status(500).json({ error: 'Error al verificar contraseña' });
  }
});

// Cambiar mi contraseña (requiere sesión)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: 'La contraseña no cumple los requisitos' });
    }

    const result = await pool.query('SELECT password, supabase_user_id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    let currentOk = false;

    if (isSupabaseAuthConfigured()) {
      const supabaseAnon = getSupabaseAnonClient();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: currentPassword });
      if (!error && data?.user?.id) {
        currentOk = true;
        if (!row.supabase_user_id) {
          await pool
            .query('UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)', [email, String(data.user.id)])
            .catch(() => {});
          row.supabase_user_id = String(data.user.id);
        }
      }
    }

    // Legacy fallback
    if (!currentOk && row.password) {
      currentOk = await bcrypt.compare(currentPassword, String(row.password));
    }

    if (!currentOk) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    // Prefer changing password in Supabase.
    let supabaseUserId = row.supabase_user_id ? String(row.supabase_user_id) : null;
    if (!supabaseUserId) {
      supabaseUserId = await findSupabaseUserIdByEmail(email);
      if (supabaseUserId) {
        await pool
          .query('UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)', [email, supabaseUserId])
          .catch(() => {});
      }
    }

    if (supabaseUserId && isSupabaseAdminConfigured()) {
      const admin = getSupabaseAdminClient();
      const { error: updateError } = await admin.auth.admin.updateUserById(String(supabaseUserId), { password: newPassword });
      if (!updateError) {
        await pool.query(
          'UPDATE users SET password = NULL, account_locked = FALSE, password_check_failed_attempts = 0, password_check_lock_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)',
          [email]
        );

        return res.json({ success: true });
      }

      console.error('Supabase updateUserById error:', updateError);
      // fallback below
    }

    // Local fallback
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2',
      [newHash, email]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

router.delete('/me', authenticateToken, async (req, res) => {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email de usuario inválido' });
  }

  const client = await pool.connect();
  let objectsToDelete = [];
  try {
    await client.query('BEGIN');

    // Collect storage objects first (delete after COMMIT to keep DB fast/atomic).
    const mediaRows = await client
      .query(
        'SELECT storage_bucket, storage_path FROM uploaded_images WHERE owner_email = $1 AND storage_path IS NOT NULL',
        [email]
      )
      .catch(() => null);
    objectsToDelete = (mediaRows?.rows || [])
      .map(r => ({ bucket: r.storage_bucket, path: r.storage_path }))
      .filter(o => o.bucket && o.path);

    // Tablas que NO tienen ON DELETE CASCADE garantizado o que deben eliminarse por requisito
    await client.query('DELETE FROM user_avatars WHERE user_email = $1', [email]).catch(() => {});
    await client.query('DELETE FROM uploaded_images WHERE owner_email = $1', [email]).catch(() => {});

    // Limpiar referencias que podrían quedar como NULL por FK (opcional, pero elimina trazas del email)
    await client.query('UPDATE group_members SET added_by_email = NULL WHERE added_by_email = $1', [email]).catch(() => {});
    await client.query('UPDATE group_member_limits SET limited_by_email = NULL WHERE limited_by_email = $1', [email]).catch(() => {});

    // Finalmente, eliminar usuario (el resto debería caer por ON DELETE CASCADE en la mayoría de tablas)
    const result = await client.query('DELETE FROM users WHERE lower(email) = $1 RETURNING email', [email]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await client.query('COMMIT');

    // Best-effort cleanup in Storage.
    for (const obj of objectsToDelete) {
      await deleteObject(obj);
    }

    return res.json({ success: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Error al eliminar cuenta:', error);
    return res.status(500).json({ error: 'Error al eliminar la cuenta' });
  } finally {
    client.release();
  }
});

module.exports = router;
