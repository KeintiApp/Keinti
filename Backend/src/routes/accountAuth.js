const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const speakeasy = require('speakeasy');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');
const { buildObjectPath, uploadBuffer, deleteObject, isSupabaseConfigured } = require('../services/supabaseStorageService');

const router = express.Router();

const POST_TTL_MINUTES = getPostTtlMinutes();

// Por defecto: 365 días.
// Se puede sobrescribir con env var (milisegundos) sin tocar código.
const ACCOUNT_VERIFICATION_TTL_MS = Math.max(
  0,
  Number(process.env.ACCOUNT_VERIFICATION_TTL_MS || 365 * 24 * 60 * 60 * 1000)
);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeSelfieStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pending' || s === 'accepted' || s === 'failed' || s === 'not_submitted') return s;
  return 'not_submitted';
}

async function requireBackendAdmin(req, res) {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }

  const ok = await pool
    .query('SELECT 1 FROM backend_admins WHERE lower(email) = $1 LIMIT 1', [email])
    .then((r) => (r.rows?.length || 0) > 0)
    .catch(() => false);

  if (!ok) {
    res.status(403).json({ error: 'No autorizado' });
    return null;
  }

  return email;
}

function normalizeAdminAction(raw) {
  const a = String(raw || '').trim().toLowerCase();
  if (a === 'accepted' || a === 'failed' || a === 'blocked' || a === 'unblocked') return a;
  return '';
}

async function deleteUploadedImageById(id) {
  const imgId = Number(id);
  if (!Number.isFinite(imgId) || imgId <= 0) return;
  try {
    const row = await pool.query(
      'SELECT storage_bucket, storage_path FROM uploaded_images WHERE id = $1 LIMIT 1',
      [imgId]
    );
    const bucket = row.rows?.[0]?.storage_bucket || null;
    const path = row.rows?.[0]?.storage_path || null;

    await pool.query('DELETE FROM uploaded_images WHERE id = $1', [imgId]).catch(() => {});
    if (bucket && path) {
      await deleteObject({ bucket, path });
    }
  } catch {
    await pool.query('DELETE FROM uploaded_images WHERE id = $1', [imgId]).catch(() => {});
  }
}

function computeVerificationExpiresAtMs(verifiedAt) {
  if (!verifiedAt) return null;
  const ts = new Date(verifiedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  if (ACCOUNT_VERIFICATION_TTL_MS <= 0) return null;
  return ts + ACCOUNT_VERIFICATION_TTL_MS;
}

async function resetAccountAuthToInitialState(email, selfieImageId) {
  if (!email) return;

  if (selfieImageId) {
    await deleteUploadedImageById(selfieImageId);
  }

  await pool.query(
    `UPDATE account_auth
     SET
       verified = FALSE,
       verified_at = NULL,
       totp_enabled = FALSE,
       totp_enabled_at = NULL,
       totp_secret = NULL,
       selfie_status = 'not_submitted',
       selfie_submitted_at = NULL,
       selfie_reviewed_at = NULL,
       selfie_fail_reason = NULL,
       selfie_image_id = NULL
     WHERE user_email = $1`,
    [email]
  );
}

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const email = req.user?.email;
    const result = await pool.query(
      `SELECT
         u.email,
         aa.verified AS account_verified,
         aa.verified_at AS account_verified_at,
         aa.keinti_verified AS keinti_verified,
         aa.keinti_verified_at AS keinti_verified_at,
         aa.selfie_status AS account_selfie_status,
         aa.selfie_image_id AS account_selfie_image_id,
         aa.selfie_submitted_at AS account_selfie_submitted_at,
         aa.selfie_reviewed_at AS account_selfie_reviewed_at,
         aa.selfie_fail_reason AS account_selfie_fail_reason,
         aa.selfie_blocked AS account_selfie_blocked,
         aa.selfie_blocked_reason AS account_selfie_blocked_reason,
         aa.totp_enabled AS totp_enabled,
         aa.totp_enabled_at AS totp_enabled_at
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    let selfieStatus = normalizeSelfieStatus(row.account_selfie_status || 'not_submitted');
    let totpEnabled = row.totp_enabled === true;
    let accountVerified = row.account_verified === true;
    let verifiedAt = row.account_verified_at || null;

    // Expiración de la insignia: si expiró, revierte todo al estado inicial.
    const expiresAtMs = accountVerified ? computeVerificationExpiresAtMs(verifiedAt) : null;
    if (accountVerified && expiresAtMs && Date.now() >= expiresAtMs) {
      await resetAccountAuthToInitialState(email, row.account_selfie_image_id);
      selfieStatus = 'not_submitted';
      totpEnabled = false;
      accountVerified = false;
      verifiedAt = null;
    }

    // Privacidad: si el selfie está marcado como fallido y aún existe la imagen,
    // elimínala del backend tras devolver el estado de "Fallo" al usuario.
    // (Best-effort: no romper la respuesta si falla el borrado.)
    if (selfieStatus === 'failed' && row.account_selfie_image_id) {
      const selfieImageId = row.account_selfie_image_id;
      await deleteUploadedImageById(selfieImageId);
      await pool
        .query(
          `UPDATE account_auth
           SET selfie_image_id = NULL
           WHERE user_email = $1 AND selfie_image_id = $2`,
          [email, selfieImageId]
        )
        .catch(() => {});
    }

    const safeExpiresAtMs = accountVerified ? computeVerificationExpiresAtMs(verifiedAt) : null;

    res.json({
      selfie: {
        status: selfieStatus,
        submitted_at: row.account_selfie_submitted_at,
        reviewed_at: row.account_selfie_reviewed_at,
        fail_reason: row.account_selfie_fail_reason || null,
        blocked: row.account_selfie_blocked === true,
        blocked_reason: row.account_selfie_blocked_reason || null,
      },
      totp: {
        enabled: totpEnabled,
        enabled_at: row.totp_enabled_at,
      },
      account_verified: accountVerified,
      account_verified_at: verifiedAt,
      account_verified_expires_at: safeExpiresAtMs ? new Date(safeExpiresAtMs).toISOString() : null,
      keinti_verified: row.keinti_verified === true,
      keinti_verified_at: row.keinti_verified_at || null,
      step2_available: selfieStatus === 'accepted',
    });
  } catch (error) {
    console.error('Error getting account auth status:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar Keinti (cuando el usuario completa los objetivos)
router.post('/keinti/verify', authenticateToken, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: 'No autorizado' });

  try {
    // 1) Debe tener cuenta autenticada.
    const authRes = await pool.query(
      'SELECT verified, keinti_verified FROM account_auth WHERE user_email = $1 LIMIT 1',
      [email]
    );

    const isAccountVerified = authRes.rows?.[0]?.verified === true;
    const alreadyKeintiVerified = authRes.rows?.[0]?.keinti_verified === true;

    if (!isAccountVerified) {
      return res.status(400).json({ error: 'Primero debes autentificar tu cuenta.' });
    }

    if (alreadyKeintiVerified) {
      return res.json({ ok: true, keinti_verified: true, alreadyVerified: true });
    }

    // 2) Validar objetivos.
    const [intimidadesRes, profilePublishesRes, joinsRes, groupsRes, activeMembersRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM post_intimidades_opens io
         JOIN Post_users p ON p.id = io.post_id
         WHERE io.creator_email = $1
           AND io.created_at >= date_trunc('month', NOW())
           AND (
             p.deleted_at IS NULL
             OR p.deleted_at >= p.created_at + ($2 * INTERVAL '1 minute')
           )`,
        [email, POST_TTL_MINUTES]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM Post_users p
         WHERE p.user_email = $1
           AND p.created_at < NOW() - ($2 * INTERVAL '1 minute')
           AND (
             p.deleted_at IS NULL
             OR p.deleted_at >= p.created_at + ($2 * INTERVAL '1 minute')
           )`,
        [email, POST_TTL_MINUTES]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM channel_subscriptions cs
         JOIN Post_users p ON p.id = cs.post_id
         WHERE cs.publisher_email = $1
           AND cs.created_at >= date_trunc('month', NOW())
           AND (
             p.deleted_at IS NULL
             OR p.deleted_at >= p.created_at + ($2 * INTERVAL '1 minute')
           )`,
        [email, POST_TTL_MINUTES]
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM user_groups WHERE owner_email = $1', [email]),
      pool.query(
        `SELECT COUNT(DISTINCT gm.member_email)::int AS total
         FROM user_groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE g.owner_email = $1`,
        [email]
      ),
    ]);

    const intimidades = intimidadesRes.rows?.[0]?.total ?? 0;
    const profilePublishes = profilePublishesRes.rows?.[0]?.total ?? 0;
    const joins = joinsRes.rows?.[0]?.total ?? 0;
    const groupsCreated = groupsRes.rows?.[0]?.total ?? 0;
    const activeMembers = activeMembersRes.rows?.[0]?.total ?? 0;

    const missing = [];
    if (Number(intimidades) < 10) missing.push('intimidades');
    if (Number(profilePublishes) < 4) missing.push('profile_publishes');
    if (Number(joins) < 10) missing.push('channel_joins');
    if (Number(groupsCreated) < 1) missing.push('groups_created');
    if (Number(activeMembers) < 4) missing.push('group_active_members');

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Aún no has completado todos los objetivos.',
        missing,
        progress: {
          intimidades: Number(intimidades) || 0,
          profilePublishes: Number(profilePublishes) || 0,
          channelJoins: Number(joins) || 0,
          groupsCreated: Number(groupsCreated) || 0,
          activeMembers: Number(activeMembers) || 0,
        },
      });
    }

    // 3) Marcar verificado (idempotente mediante upsert).
    const upsert = await pool.query(
      `INSERT INTO account_auth (user_email, keinti_verified, keinti_verified_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (user_email)
       DO UPDATE SET keinti_verified = TRUE, keinti_verified_at = NOW()
       RETURNING keinti_verified_at`,
      [email]
    );

    return res.json({ ok: true, keinti_verified: true, keinti_verified_at: upsert.rows?.[0]?.keinti_verified_at || null });
  } catch (error) {
    console.error('Error verifying Keinti:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paso 1: subir selfie
router.post('/selfie', authenticateToken, upload.single('selfie'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const email = req.user?.email;

    // Si el admin bloqueó el reintento de selfie, no permitir nuevas subidas.
    const blockedRes = await pool.query(
      'SELECT selfie_blocked, selfie_blocked_reason FROM account_auth WHERE user_email = $1 LIMIT 1',
      [email]
    );
    const isBlocked = blockedRes.rows?.[0]?.selfie_blocked === true;
    if (isBlocked) {
      return res.status(403).json({
        error: 'No puedes enviar más selfies. Tu verificación está bloqueada.',
        code: 'SELFIE_BLOCKED',
        blocked_reason: blockedRes.rows?.[0]?.selfie_blocked_reason || null,
      });
    }

    const mimeType = req.file.mimetype || 'application/octet-stream';
    const accessToken = generateAccessToken();

    // Pre-check (Opción B lite): filtrar basura obvia para reducir carga de revisión.
    // Nota: esto no sustituye liveness/edad real; solo evita imágenes vacías o demasiado pequeñas.
    const minBytes = Math.max(5_000, Number(process.env.ACCOUNT_SELFIE_MIN_BYTES || 10_000));
    if (Buffer.isBuffer(req.file.buffer) && req.file.buffer.length > 0 && req.file.buffer.length < minBytes) {
      await pool.query(
        `INSERT INTO account_auth (
           user_email,
           selfie_status,
           selfie_reviewed_at,
           selfie_fail_reason,
           selfie_blocked,
           selfie_blocked_at,
           selfie_blocked_reason,
           selfie_blocked_by
         ) VALUES ($1, 'failed', NOW(), $2, FALSE, NULL, NULL, NULL)
         ON CONFLICT (user_email) DO UPDATE SET
           selfie_status = 'failed',
           selfie_reviewed_at = NOW(),
           selfie_fail_reason = EXCLUDED.selfie_fail_reason,
           selfie_blocked = FALSE,
           selfie_blocked_at = NULL,
           selfie_blocked_reason = NULL,
           selfie_blocked_by = NULL`,
        [email, 'La imagen es demasiado pequeña o no parece una selfie válida. Reintenta con buena iluminación y encuadre.']
      );

      return res.status(400).json({
        error: 'Selfie rechazado automáticamente por calidad insuficiente. Reintenta.',
        code: 'SELFIE_AUTO_REJECTED',
      });
    }

    const storageEnabled = isSupabaseConfigured();
    let uploaded = null;
    if (storageEnabled) {
      const objectPath = buildObjectPath({
        kind: 'account-selfies',
        ownerEmail: email,
        mimeType,
      });

      uploaded = await uploadBuffer({
        buffer: req.file.buffer,
        mimeType,
        path: objectPath,
      });
    }

    // Si había un selfie anterior guardado, lo borramos para minimizar retención.
    const prev = await pool.query(
      'SELECT selfie_image_id FROM account_auth WHERE user_email = $1 LIMIT 1',
      [email]
    );
    const prevId = prev.rows?.[0]?.selfie_image_id;
    if (prevId) {
      await deleteUploadedImageById(prevId);
    }

    const insert = storageEnabled
      ? await pool.query(
          `INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token, storage_bucket, storage_path)
           VALUES ($1, NULL, NULL, NULL, $2, $3, $4, $5)
           RETURNING id`,
          [email, mimeType, accessToken, uploaded.bucket, uploaded.path]
        )
      : await pool.query(
          `INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token)
           VALUES ($1, NULL, NULL, $2, $3, $4)
           RETURNING id`,
          [email, req.file.buffer, mimeType, accessToken]
        );

    const imageId = insert.rows[0].id;

    await pool.query(
      `INSERT INTO account_auth (
         user_email,
         selfie_status,
         selfie_image_id,
         selfie_submitted_at,
         selfie_reviewed_at,
         selfie_fail_reason,
         selfie_blocked,
         selfie_blocked_at,
         selfie_blocked_reason,
         selfie_blocked_by
       ) VALUES ($1, 'pending', $2, NOW(), NULL, NULL, FALSE, NULL, NULL, NULL)
       ON CONFLICT (user_email) DO UPDATE SET
         selfie_status = 'pending',
         selfie_image_id = EXCLUDED.selfie_image_id,
         selfie_submitted_at = NOW(),
         selfie_reviewed_at = NULL,
         selfie_fail_reason = NULL,
         selfie_blocked = FALSE,
         selfie_blocked_at = NULL,
         selfie_blocked_reason = NULL,
         selfie_blocked_by = NULL`,
      [email, imageId]
    );

    res.json({
      selfie: {
        status: 'pending',
        submitted_at: new Date().toISOString(),
      },
      message: 'Selfie recibido. La revisión puede tardar hasta 24 horas.',
    });
  } catch (error) {
    console.error('Error uploading selfie:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paso 2: generar secreto para Google Authenticator (TOTP)
router.get('/totp/setup', authenticateToken, async (req, res) => {
  try {
    const email = req.user?.email;
    const rowRes = await pool.query(
      `SELECT
         u.email,
         aa.selfie_status AS account_selfie_status,
         aa.totp_secret,
         aa.totp_enabled
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    if (rowRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const row = rowRes.rows[0];
    const selfieStatus = normalizeSelfieStatus(row.account_selfie_status || 'not_submitted');
    if (selfieStatus !== 'accepted') {
      return res.status(403).json({ error: 'El selfie debe estar aceptado para activar Google Authenticator.' });
    }
    if (row.totp_enabled === true) {
      return res.status(409).json({ error: 'Google Authenticator ya está activado.' });
    }

    let secretBase32 = row.totp_secret ? String(row.totp_secret) : '';
    if (!secretBase32) {
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `Keinti (${email})`,
        issuer: 'Keinti',
      });
      secretBase32 = secret.base32;
      await pool.query(
        `INSERT INTO account_auth (user_email, totp_secret)
         VALUES ($1, $2)
         ON CONFLICT (user_email) DO UPDATE SET totp_secret = EXCLUDED.totp_secret`,
        [email, secretBase32]
      );
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secretBase32,
      label: `Keinti (${email})`,
      issuer: 'Keinti',
      encoding: 'base32',
    });

    res.json({
      secret: secretBase32,
      otpauth_url: otpauthUrl,
    });
  } catch (error) {
    console.error('Error generating totp setup:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/totp/verify', authenticateToken, async (req, res) => {
  try {
    const email = req.user?.email;
    const code = String(req.body?.code || '').trim();
    if (!/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const rowRes = await pool.query(
      `SELECT
         u.email,
         aa.selfie_status AS account_selfie_status,
         aa.selfie_image_id AS account_selfie_image_id,
         aa.totp_secret,
         aa.totp_enabled,
         aa.verified AS account_verified
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    if (rowRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const row = rowRes.rows[0];
    const selfieStatus = normalizeSelfieStatus(row.account_selfie_status || 'not_submitted');
    if (selfieStatus !== 'accepted') {
      return res.status(403).json({ error: 'El selfie debe estar aceptado antes de verificar el código.' });
    }
    if (row.totp_enabled === true) {
      return res.status(409).json({ error: 'Google Authenticator ya está activado.' });
    }

    const secretBase32 = row.totp_secret ? String(row.totp_secret) : '';
    if (!secretBase32) {
      return res.status(400).json({ error: 'No hay secreto configurado. Genera la configuración primero.' });
    }

    const ok = speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!ok) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    await pool.query(
      `INSERT INTO account_auth (
         user_email,
         totp_enabled,
         totp_enabled_at,
         verified,
         verified_at
       ) VALUES ($1, TRUE, NOW(), TRUE, NOW())
       ON CONFLICT (user_email) DO UPDATE SET
         totp_enabled = TRUE,
         totp_enabled_at = NOW(),
         verified = TRUE,
         verified_at = NOW()`,
      [email]
    );

    // Eliminar selfie automáticamente una vez completada la verificación.
    if (row.account_selfie_image_id) {
      await deleteUploadedImageById(row.account_selfie_image_id);
      await pool.query(
        `UPDATE account_auth
         SET selfie_image_id = NULL
         WHERE user_email = $1`,
        [email]
      );
    }

    res.json({
      message: 'Autenticación completada',
      account_verified: true,
    });
  } catch (error) {
    console.error('Error verifying totp:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: servir la imagen de selfie (proxy). Útil para RN (evita data URLs gigantes o incompatibles).
router.get('/admin/selfie-image/:imageId', authenticateToken, async (req, res) => {
  const adminEmail = await requireBackendAdmin(req, res);
  if (!adminEmail) return;

  try {
    const imageId = Number(req.params?.imageId);
    if (!Number.isFinite(imageId) || imageId <= 0) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const q = await pool.query(
      `SELECT id, image_data, mime_type, storage_bucket, storage_path
       FROM uploaded_images
       WHERE id = $1
       LIMIT 1`,
      [imageId]
    );

    if (q.rows.length === 0) return res.status(404).json({ error: 'Imagen no encontrada' });
    const row = q.rows[0];

    if (row.storage_path) {
      const { createSignedReadUrl } = require('../services/supabaseStorageService');
      const signedUrl = await createSignedReadUrl({
        bucket: row.storage_bucket,
        path: row.storage_path,
        expiresInSeconds: 10 * 60,
      }).catch(() => null);

      if (signedUrl) {
        return res.redirect(302, signedUrl);
      }
    }

    const mime = row.mime_type || 'application/octet-stream';
    const buf = row.image_data;
    const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || '');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(data);
  } catch (error) {
    console.error('Error serving admin selfie image:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: listar selfies pendientes (para revisión humana)
router.get('/admin/pending-selfies', authenticateToken, async (req, res) => {
  const adminEmail = await requireBackendAdmin(req, res);
  if (!adminEmail) return;

  try {
    const q = await pool.query(
      `SELECT
         u.email,
         u.username,
         aa.selfie_submitted_at,
         aa.selfie_image_id,
         ui.image_data,
         ui.mime_type,
         ui.storage_bucket,
         ui.storage_path,
         ui.access_token
       FROM account_auth aa
       JOIN users u ON u.email = aa.user_email
       JOIN uploaded_images ui ON ui.id = aa.selfie_image_id
       WHERE aa.selfie_status = 'pending'
         AND COALESCE(aa.selfie_blocked, FALSE) = FALSE
       ORDER BY aa.selfie_submitted_at DESC NULLS LAST
       LIMIT 100`
    );

    const items = await Promise.all(
      (q.rows || []).map(async (r) => {
        const mime = r.mime_type || 'image/jpeg';
        const imageId = Number(r.selfie_image_id ?? NaN);

        const imagePath = Number.isFinite(imageId) && imageId > 0
          ? `/api/account-auth/admin/selfie-image/${imageId}`
          : null;

        // Prefer Storage signed URL when available.
        if (r.storage_path) {
          const { createSignedReadUrl } = require('../services/supabaseStorageService');
          const signedUrl = await createSignedReadUrl({
            bucket: r.storage_bucket,
            path: r.storage_path,
            expiresInSeconds: 15 * 60,
          }).catch(() => null);

          if (signedUrl) {
            return {
              email: r.email,
              username: r.username,
              submitted_at: r.selfie_submitted_at,
              image_url: signedUrl,
              selfie_image_id: Number.isFinite(imageId) ? imageId : null,
              image_path: imagePath,
            };
          }
        }

        // Fallback: use proxy path, and keep data URL as a last resort.
        const buf = r.image_data;
        const base64 = Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(buf || '').toString('base64');
        return {
          email: r.email,
          username: r.username,
          submitted_at: r.selfie_submitted_at,
          image_url: imagePath || `data:${mime};base64,${base64}`,
          selfie_image_id: Number.isFinite(imageId) ? imageId : null,
          image_path: imagePath,
        };
      })
    );

    return res.json({ items });
  } catch (error) {
    console.error('Error listing pending selfies:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: listar usuarios bloqueados por selfie
router.get('/admin/blocked-selfies', authenticateToken, async (req, res) => {
  const adminEmail = await requireBackendAdmin(req, res);
  if (!adminEmail) return;

  try {
    const q = await pool.query(
      `SELECT
         u.email,
         u.username,
         aa.selfie_blocked_at,
         aa.selfie_blocked_reason
       FROM account_auth aa
       JOIN users u ON u.email = aa.user_email
       WHERE aa.selfie_blocked = TRUE
       ORDER BY aa.selfie_blocked_at DESC NULLS LAST
       LIMIT 200`
    );

    return res.json({
      items: (q.rows || []).map((r) => ({
        email: String(r.email || ''),
        username: String(r.username || ''),
        blocked_at: r.selfie_blocked_at,
        reason: r.selfie_blocked_reason || null,
      })),
    });
  } catch (error) {
    console.error('Error listing blocked selfies:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: aceptar/rechazar/bloquear/desbloquear selfie
router.post('/admin/selfie-review', authenticateToken, async (req, res) => {
  const adminEmail = await requireBackendAdmin(req, res);
  if (!adminEmail) return;

  try {
    const userEmail = String(req.body?.email || '').trim().toLowerCase();
    const action = normalizeAdminAction(req.body?.status || req.body?.action);
    const reasonRaw = String(req.body?.reason || '').trim();
    const reason = reasonRaw ? reasonRaw.slice(0, 320) : '';

    if (!userEmail || !action) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const prev = await pool.query(
      `SELECT u.email, aa.selfie_image_id AS account_selfie_image_id
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE lower(u.email) = lower($1)
       LIMIT 1`,
      [userEmail]
    );
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const prevId = prev.rows[0].account_selfie_image_id;

    if (action === 'accepted') {
      await pool.query(
        `INSERT INTO account_auth (
           user_email,
           selfie_status,
           selfie_reviewed_at,
           selfie_fail_reason,
           selfie_blocked,
           selfie_blocked_at,
           selfie_blocked_reason,
           selfie_blocked_by
         ) VALUES ($1, 'accepted', NOW(), NULL, FALSE, NULL, NULL, NULL)
         ON CONFLICT (user_email) DO UPDATE SET
           selfie_status = 'accepted',
           selfie_reviewed_at = NOW(),
           selfie_fail_reason = NULL,
           selfie_blocked = FALSE,
           selfie_blocked_at = NULL,
           selfie_blocked_reason = NULL,
           selfie_blocked_by = NULL`,
        [userEmail]
      );
    } else if (action === 'failed') {
      await pool.query(
        `INSERT INTO account_auth (
           user_email,
           selfie_status,
           selfie_reviewed_at,
           selfie_fail_reason,
           selfie_blocked,
           selfie_blocked_at,
           selfie_blocked_reason,
           selfie_blocked_by
         ) VALUES ($1, 'failed', NOW(), $2, FALSE, NULL, NULL, NULL)
         ON CONFLICT (user_email) DO UPDATE SET
           selfie_status = 'failed',
           selfie_reviewed_at = NOW(),
           selfie_fail_reason = EXCLUDED.selfie_fail_reason,
           selfie_blocked = FALSE,
           selfie_blocked_at = NULL,
           selfie_blocked_reason = NULL,
           selfie_blocked_by = NULL`,
        [userEmail, reason || 'Selfie no válido. Reintenta con buena iluminación y encuadre.']
      );
    } else if (action === 'blocked') {
      await pool.query(
        `INSERT INTO account_auth (
           user_email,
           selfie_status,
           selfie_reviewed_at,
           selfie_fail_reason,
           selfie_blocked,
           selfie_blocked_at,
           selfie_blocked_reason,
           selfie_blocked_by
         ) VALUES ($1, 'failed', NOW(), $2, TRUE, NOW(), $3, $4)
         ON CONFLICT (user_email) DO UPDATE SET
           selfie_status = 'failed',
           selfie_reviewed_at = NOW(),
           selfie_fail_reason = EXCLUDED.selfie_fail_reason,
           selfie_blocked = TRUE,
           selfie_blocked_at = NOW(),
           selfie_blocked_reason = EXCLUDED.selfie_blocked_reason,
           selfie_blocked_by = EXCLUDED.selfie_blocked_by`,
        [
          userEmail,
          reason || 'Bloqueado por moderación.',
          reason || 'Bloqueado por moderación.',
          adminEmail,
        ]
      );
    } else if (action === 'unblocked') {
      await pool.query(
        `INSERT INTO account_auth (
           user_email,
           selfie_status,
           selfie_reviewed_at,
           selfie_fail_reason,
           selfie_blocked,
           selfie_blocked_at,
           selfie_blocked_reason,
           selfie_blocked_by
         ) VALUES ($1, 'not_submitted', NOW(), NULL, FALSE, NULL, NULL, NULL)
         ON CONFLICT (user_email) DO UPDATE SET
           selfie_status = 'not_submitted',
           selfie_reviewed_at = NOW(),
           selfie_fail_reason = NULL,
           selfie_blocked = FALSE,
           selfie_blocked_at = NULL,
           selfie_blocked_reason = NULL,
           selfie_blocked_by = NULL`,
        [userEmail]
      );
    }

    // Por privacidad, borra la imagen tras cualquier decisión.
    if (prevId) {
      await deleteUploadedImageById(prevId);
      await pool.query(
        `UPDATE account_auth
         SET selfie_image_id = NULL
         WHERE user_email = $1`,
        [userEmail]
      );
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error admin selfie review:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
