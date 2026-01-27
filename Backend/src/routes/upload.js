const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');
const {
  buildObjectPath,
  uploadBuffer,
  deleteObject,
  createSignedReadUrl,
  isSupabaseConfigured,
} = require('../services/supabaseStorageService');

const POST_TTL_MINUTES = getPostTtlMinutes();

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
  // 32 bytes => 64 hex chars, suficientemente no-adivinable para URLs
  return crypto.randomBytes(32).toString('hex');
}

function setImageResponseHeaders(res, mimeType) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Cache moderado: reduce carga sin dejarlo "inmutable" por si cambias estrategia
  res.setHeader('Cache-Control', 'public, max-age=86400');
}

function setRedirectHeaders(res) {
  // Redirect responses are stable for the lifetime of the signed URL.
  // Cache them for a bit to avoid a backend round-trip per image render.
  // The signed URL is currently generated with ~15min expiration.
  res.setHeader('Cache-Control', 'public, max-age=900');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

async function validateOwnedActivePost(postId, ownerEmail) {
  const pid = Number(postId);
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, status: 400, error: 'postId inválido' };
  const email = ownerEmail ? String(ownerEmail) : '';
  if (!email) return { ok: false, status: 401, error: 'No autorizado' };

  const result = await pool.query(
    `SELECT 1
     FROM Post_users
     WHERE id = $1
       AND user_email = $2
       AND deleted_at IS NULL
       AND created_at >= NOW() - ($3 * INTERVAL '1 minute')
     LIMIT 1`,
    [pid, email, POST_TTL_MINUTES]
  );

  if ((result.rows?.length || 0) === 0) {
    return { ok: false, status: 403, error: 'Post no encontrado, no autorizado o expirado' };
  }

  return { ok: true, postId: pid };
}

async function validateOwnedGroup(groupId, ownerEmail) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) return { ok: false, status: 400, error: 'groupId inválido' };
  const email = ownerEmail ? String(ownerEmail) : '';
  if (!email) return { ok: false, status: 401, error: 'No autorizado' };

  const result = await pool.query(
    `SELECT 1
     FROM user_groups
     WHERE id = $1
       AND owner_email = $2
     LIMIT 1`,
    [gid, email]
  );

  if ((result.rows?.length || 0) === 0) {
    return { ok: false, status: 403, error: 'Grupo no encontrado o no autorizado' };
  }

  return { ok: true, groupId: gid };
}

// Ruta para subir imagen
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const ownerEmail = req.user?.email || null;
    const mimeType = req.file.mimetype || 'application/octet-stream';

    // Optional: link upload to a specific 24h post so it expires with it.
    let postId = null;
    // Optional: link upload to a group so it is deleted when the group is deleted.
    let groupId = null;

    const postIdRaw = req.body?.postId;
    const groupIdRaw = req.body?.groupId;

    const hasPostId = postIdRaw !== undefined && postIdRaw !== null && String(postIdRaw).trim() !== '';
    const hasGroupId = groupIdRaw !== undefined && groupIdRaw !== null && String(groupIdRaw).trim() !== '';

    if (hasPostId && hasGroupId) {
      return res.status(400).json({ error: 'No puedes enviar postId y groupId a la vez' });
    }

    if (hasPostId) {
      const validation = await validateOwnedActivePost(postIdRaw, ownerEmail);
      if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
      }
      postId = validation.postId;
    }

    if (hasGroupId) {
      const validation = await validateOwnedGroup(groupIdRaw, ownerEmail);
      if (!validation.ok) {
        return res.status(validation.status).json({ error: validation.error });
      }
      groupId = validation.groupId;
    }

    const accessToken = generateAccessToken();

    // Fallback: if Supabase is not configured yet, store in Postgres (legacy behavior).
    if (!isSupabaseConfigured()) {
      const result = await pool.query(
        'INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [ownerEmail, postId, groupId, req.file.buffer, mimeType, accessToken]
      );

      const id = result.rows[0].id;
      const imageUrl = `/api/upload/image/${id}?token=${accessToken}`;
      return res.json({ url: imageUrl, id, token: accessToken, storage: 'db' });
    }

    // Store the binary in Supabase Storage; keep DB row as a pointer.
    const objectPath = buildObjectPath({
      kind: 'uploads',
      ownerEmail,
      postId,
      groupId,
      mimeType,
    });

    const uploaded = await uploadBuffer({
      buffer: req.file.buffer,
      mimeType,
      path: objectPath,
    });

    const result = await pool.query(
      `INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token, storage_bucket, storage_path)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)
       RETURNING id`,
      [ownerEmail, postId, groupId, mimeType, accessToken, uploaded.bucket, uploaded.path]
    );

    const id = result.rows[0].id;
    // IMPORTANT: RN <Image> typically can't send Authorization headers.
    // Keep the existing token URL contract and serve via a signed redirect.
    const imageUrl = `/api/upload/image/${id}?token=${accessToken}`;
    res.json({ url: imageUrl, id, token: accessToken });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir imagen desde BD
router.get('/image/:id', async (req, res) => {
  try {
    // Opcional: desactivar endpoint legacy por id en producción
    if (String(process.env.DISABLE_LEGACY_IMAGE_ID_ENDPOINT || '').toLowerCase() === 'true') {
      return res.status(404).send('No encontrado');
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID inválido');
    }

    const result = await pool.query(
      'SELECT image_data, mime_type, access_token, storage_bucket, storage_path FROM uploaded_images WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Imagen no encontrada');
    }

    const row = result.rows[0];

    const providedToken = String(req.query?.token || '').trim();
    const storedToken = row.access_token ? String(row.access_token).trim() : '';

    // Si el registro tiene access_token, podemos exigirlo con un flag.
    const requireToken = String(process.env.REQUIRE_IMAGE_TOKEN || '').toLowerCase() === 'true';
    if (storedToken) {
      const matches = providedToken && storedToken && crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(storedToken)
      );

      if (!matches) {
        if (requireToken) {
          return res.status(403).send('No autorizado');
        }
        // Compatibilidad: permitir legacy sin token mientras migras URLs existentes.
        res.setHeader('X-Keinti-Image-Access', 'legacy-without-token');
      }
    } else {
      // Imagen antigua sin token: si activas REQUIRE_IMAGE_TOKEN, ya no se sirve.
      if (requireToken) {
        return res.status(403).send('No autorizado');
      }
      res.setHeader('X-Keinti-Image-Access', 'legacy-no-token-stored');
    }

    // Prefer Supabase Storage if present.
    if (row.storage_path && isSupabaseConfigured()) {
      const signed = await createSignedReadUrl({
        bucket: row.storage_bucket,
        path: row.storage_path,
        expiresInSeconds: 15 * 60,
      });
      if (signed) {
        setRedirectHeaders(res);
        return res.redirect(302, signed);
      }
    }

    // Legacy fallback: serve from DB.
    setImageResponseHeaders(res, row.mime_type);
    res.send(row.image_data);
  } catch (error) {
    console.error('Error al obtener imagen:', error);
    res.status(500).send('Error al obtener imagen');
  }
});

// Endpoint recomendado: servir por token (no-adivinable, sin necesidad de headers)
router.get('/image-token/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 40) {
      return res.status(400).send('Token inválido');
    }

    const result = await pool.query(
      'SELECT image_data, mime_type, storage_bucket, storage_path FROM uploaded_images WHERE access_token = $1 LIMIT 1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Imagen no encontrada');
    }

    const row = result.rows[0];

    if (row.storage_path && isSupabaseConfigured()) {
      const signed = await createSignedReadUrl({
        bucket: row.storage_bucket,
        path: row.storage_path,
        expiresInSeconds: 15 * 60,
      });
      if (signed) {
        setRedirectHeaders(res);
        return res.redirect(302, signed);
      }
    }

    setImageResponseHeaders(res, row.mime_type);
    res.send(row.image_data);
  } catch (error) {
    console.error('Error al obtener imagen por token:', error);
    res.status(500).send('Error al obtener imagen');
  }
});

// Eliminar una imagen subida por el usuario (solo borradores: sin postId ni groupId)
// - Requiere auth
// - Best-effort: también borra el objeto en Supabase Storage si existe
// - Protege contra borrar imágenes aún referenciadas en el borrador (Edit_post_user)
router.delete('/image/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  const userEmail = req.user?.email;

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!userEmail) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // Only allow deleting draft uploads (not tied to posts or groups).
    const rowRes = await pool.query(
      `SELECT id, owner_email, post_id, group_id, storage_bucket, storage_path
       FROM uploaded_images
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if ((rowRes.rows?.length || 0) === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const row = rowRes.rows[0];
    const ownerEmail = row.owner_email ? String(row.owner_email) : '';
    if (!ownerEmail || ownerEmail.toLowerCase() !== String(userEmail).toLowerCase()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (row.post_id !== null || row.group_id !== null) {
      return res.status(409).json({ error: 'No se puede borrar una imagen asociada a un post o grupo' });
    }

    // If the image is still referenced in the current edit-profile draft, refuse deletion.
    // Frontend can retry after saving an updated draft without this image.
    const needle = `%/api/upload/image/${id}%`;
    const inUse = await pool.query(
      `SELECT 1
       FROM Edit_post_user
       WHERE user_email = $1
         AND (
           CAST(presentation AS TEXT) ILIKE $2
           OR CAST(intimidades AS TEXT) ILIKE $2
         )
       LIMIT 1`,
      [ownerEmail, needle]
    );

    if ((inUse.rows?.length || 0) > 0) {
      return res.status(409).json({ error: 'Imagen aún en uso en el borrador' });
    }

    const delRes = await pool.query(
      `DELETE FROM uploaded_images
       WHERE id = $1
         AND owner_email = $2
         AND post_id IS NULL
         AND group_id IS NULL
       RETURNING storage_bucket, storage_path`,
      [id, ownerEmail]
    );

    if ((delRes.rows?.length || 0) === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const bucket = delRes.rows[0].storage_bucket || null;
    const path = delRes.rows[0].storage_path || null;
    if (bucket && path) {
      await deleteObject({ bucket, path }).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
