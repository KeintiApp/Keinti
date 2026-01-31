const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');
const { deleteObject, isSupabaseConfigured } = require('../services/supabaseStorageService');

const POST_TTL_MINUTES = getPostTtlMinutes();

function extractDraftUploadImageIds(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    if (!text) return new Set();

    const ids = new Set();
    const re = /\/api\/upload\/image\/(\d+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const id = Number(m[1]);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

async function hasActivePost(userEmail) {
  if (!userEmail) return false;
  try {
    const res = await pool.query(
      `SELECT 1
       FROM Post_users
       WHERE user_email = $1
         AND deleted_at IS NULL
         AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
       LIMIT 1`,
      [userEmail, POST_TTL_MINUTES]
    );
    return (res.rows?.length || 0) > 0;
  } catch {
    return false;
  }
}

// Obtener el perfil editado del usuario
router.get('/', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const result = await pool.query(
      'SELECT * FROM Edit_post_user WHERE user_email = $1',
      [userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ presentation: null, intimidades: [] });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener perfil editado:', error);
    res.status(500).json({ error: 'Error al obtener perfil editado' });
  }
});

// Guardar o actualizar el perfil editado
router.post('/', authenticateToken, async (req, res) => {
  const { presentation, intimidades, reactions } = req.body;
  const userEmail = req.user.email;

  try {
    const nextPresentation = presentation || {};
    const nextIntimidades = intimidades || [];
    const nextReactions = reactions || { selected: [], counts: {}, userReaction: null };

    // Fetch previous draft (if any) so we can remove orphaned uploaded images.
    const prevRes = await pool.query(
      'SELECT id, presentation, intimidades FROM Edit_post_user WHERE user_email = $1 LIMIT 1',
      [userEmail]
    );

    const prevRow = (prevRes.rows?.length || 0) > 0 ? prevRes.rows[0] : null;
    const prevIds = new Set([
      ...Array.from(extractDraftUploadImageIds(prevRow?.presentation)),
      ...Array.from(extractDraftUploadImageIds(prevRow?.intimidades)),
    ]);

    const nextIds = new Set([
      ...Array.from(extractDraftUploadImageIds(nextPresentation)),
      ...Array.from(extractDraftUploadImageIds(nextIntimidades)),
    ]);

    if (prevRow) {
      // Actualizar
      const updateResult = await pool.query(
        `UPDATE Edit_post_user 
         SET presentation = $1, intimidades = $2, reactions = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_email = $4
         RETURNING *`,
        [JSON.stringify(nextPresentation), JSON.stringify(nextIntimidades), JSON.stringify(nextReactions), userEmail]
      );

      // Best-effort cleanup of orphaned draft uploads.
      // Do not do this while a 24h post is active (editing should be locked, but keep it safe).
      const removedIds = Array.from(prevIds).filter((id) => !nextIds.has(id));
      if (removedIds.length > 0 && !(await hasActivePost(userEmail))) {
        for (const imgId of removedIds) {
          try {
            const del = await pool.query(
              `DELETE FROM uploaded_images
               WHERE id = $1
                 AND owner_email = $2
                 AND post_id IS NULL
                 AND group_id IS NULL
               RETURNING storage_bucket, storage_path`,
              [imgId, userEmail]
            );

            const bucket = del.rows?.[0]?.storage_bucket || null;
            const path = del.rows?.[0]?.storage_path || null;
            if (bucket && path && isSupabaseConfigured()) {
              await deleteObject({ bucket, path }).catch(() => {});
            }
          } catch {
            // Ignore per-image failures; draft save must succeed.
          }
        }
      }

      res.json(updateResult.rows[0]);
    } else {
      // Insertar
      const insertResult = await pool.query(
        `INSERT INTO Edit_post_user (user_email, presentation, intimidades, reactions)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userEmail, JSON.stringify(nextPresentation), JSON.stringify(nextIntimidades), JSON.stringify(nextReactions)]
      );
      res.status(201).json(insertResult.rows[0]);
    }
  } catch (error) {
    console.error('Error al guardar perfil editado:', error);
    res.status(500).json({ error: 'Error al guardar perfil editado' });
  }
});

module.exports = router;
