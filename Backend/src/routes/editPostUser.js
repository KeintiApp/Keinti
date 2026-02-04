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

// =========================================================
// Profile rings (stored inside presentation.profileRings)
// Only persists rings that are already "created" by the user.
// =========================================================

router.get('/profile-rings', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const result = await pool.query(
      `SELECT COALESCE(presentation -> 'profileRings', '[]'::jsonb) AS rings
       FROM Edit_post_user
       WHERE user_email = $1
       LIMIT 1`,
      [userEmail]
    );

    if ((result.rows?.length || 0) === 0) {
      return res.json({ rings: [] });
    }

    return res.json({ rings: result.rows[0]?.rings ?? [] });
  } catch (error) {
    console.error('Error al obtener profile rings:', error);
    return res.status(500).json({ error: 'Error al obtener profile rings' });
  }
});

router.put('/profile-rings', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const raw = (req.body && req.body.rings) ?? [];

  const rings = Array.isArray(raw) ? raw : [];
  const createdRings = rings
    .filter((r) => r && r.isCreated === true)
    .slice(0, 5)
    .map((r) => ({
      id: String(r.id || ''),
      imageIndex: Number.isFinite(Number(r.imageIndex)) ? Number(r.imageIndex) : 0,
      x: Number.isFinite(Number(r.x)) ? Number(r.x) : 0.5,
      y: Number.isFinite(Number(r.y)) ? Number(r.y) : 0.5,
      color: String(r.color || '#FFFFFF'),
      colorSelected: r.colorSelected === true,
      name: String(r.name || ''),
      description: String(r.description || ''),
      linkNetwork: r.linkNetwork ? String(r.linkNetwork) : null,
      linkUrl: String(r.linkUrl || ''),
      locationLabel: String(r.locationLabel || ''),
      locationUrl: String(r.locationUrl || ''),
      locationPlaceId: r.locationPlaceId ? String(r.locationPlaceId) : null,
      locationLat: r.locationLat === null || r.locationLat === undefined ? null : Number(r.locationLat),
      locationLng: r.locationLng === null || r.locationLng === undefined ? null : Number(r.locationLng),
      isCreated: true,
    }))
    .filter((r) => r.id);

  try {
    const ringsJson = JSON.stringify(createdRings);

    const result = await pool.query(
      `INSERT INTO Edit_post_user (user_email, presentation)
       VALUES ($2, jsonb_build_object('profileRings', $1::jsonb))
       ON CONFLICT (user_email) DO UPDATE
       SET presentation = COALESCE(Edit_post_user.presentation, '{}'::jsonb)
                        || jsonb_build_object('profileRings', $1::jsonb),
           updated_at = CURRENT_TIMESTAMP
       RETURNING COALESCE(presentation -> 'profileRings', '[]'::jsonb) AS rings`,
      [ringsJson, userEmail]
    );

    return res.json({ ok: true, rings: result.rows?.[0]?.rings ?? [] });
  } catch (error) {
    console.error('Error al guardar profile rings:', error);
    return res.status(500).json({ error: 'Error al guardar profile rings' });
  }
});

module.exports = router;
