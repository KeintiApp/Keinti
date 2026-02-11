const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');
const { deleteObject } = require('../services/supabaseStorageService');
const { verifySupabaseJwt } = require('../services/supabaseJwtService');

const POST_TTL_MINUTES = getPostTtlMinutes();

function isMissingRelationError(err, relationName) {
  if (!err || err.code !== '42P01') return false;
  if (!relationName) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes(`relation "${String(relationName).toLowerCase()}" does not exist`);
}

async function isPostActive(postId) {
  const result = await pool.query(
    `SELECT 1
     FROM Post_users
     WHERE id = $1
       AND deleted_at IS NULL
       AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
     LIMIT 1`,
    [postId, POST_TTL_MINUTES]
  );

  return (result.rows?.length || 0) > 0;
}

// Obtener todas las publicaciones
router.get('/', async (req, res) => {
  // Intentar obtener el email del usuario si hay token (opcional)
  let currentUserEmail = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserEmail = decoded.email;
      } catch (e) {
        // Fallback: allow Supabase Auth JWT as well.
        try {
          const payload = await verifySupabaseJwt(token);
          const email = payload?.email ? String(payload.email).trim().toLowerCase() : '';
          if (email) currentUserEmail = email;
        } catch {
          /* ignore invalid token */
        }
      }
    }
  }

  try {
    // Obtener posts
    const result = await pool.query(
          `SELECT
            p.id,
            p.user_email,
            p.presentation,
            p.intimidades,
            p.reactions,
            (p.created_at AT TIME ZONE 'UTC') AS created_at,
            (p.updated_at AT TIME ZONE 'UTC') AS updated_at,
            (p.deleted_at AT TIME ZONE 'UTC') AS deleted_at,
            u.username, u.profile_photo_uri, u.nationality, u.social_networks,
              aa.verified AS account_verified,
              aa.keinti_verified AS keinti_verified
       FROM Post_users p
       JOIN users u ON p.user_email = u.email
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE (
         $1::text IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM group_join_requests r
           WHERE r.status = 'blocked'
             AND (
               (r.requester_email = $1 AND r.target_email = p.user_email)
               OR (r.requester_email = p.user_email AND r.target_email = $1)
             )
         )
       )
           AND p.deleted_at IS NULL
       AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
       AND (
         u.moderation_blocked IS DISTINCT FROM TRUE
         OR (u.moderation_block_until IS NOT NULL AND u.moderation_block_until <= NOW())
       )
       ORDER BY p.created_at DESC`,
      [currentUserEmail, POST_TTL_MINUTES]
    );

    const activePostIds = result.rows.map(r => r.id).filter(id => Number.isFinite(Number(id)));
    if (activePostIds.length === 0) {
      return res.json([]);
    }

    // Obtener todas las reacciones de la tabla post_reactions
    let reactionsResult = { rows: [] };
    try {
      reactionsResult = await pool.query(
        `SELECT post_id, emoji, user_email
         FROM post_reactions
         WHERE post_id = ANY($1::int[])`,
        [activePostIds]
      );
    } catch (err) {
      if (!isMissingRelationError(err, 'post_reactions')) throw err;
    }

    // Obtener votos de encuestas
    let pollVotesResult = { rows: [] };
    try {
      pollVotesResult = await pool.query(
        `SELECT post_id, user_email, intimidad_index, option_key
         FROM post_poll_votes
         WHERE post_id = ANY($1::int[])`,
        [activePostIds]
      );
    } catch (err) {
      if (!isMissingRelationError(err, 'post_poll_votes')) throw err;
    }

    // Agrupar reacciones por post
    const reactionsMap = {}; // { postId: { counts: { emoji: count }, userReactions: { email: emoji } } }
    
    reactionsResult.rows.forEach(row => {
      if (!reactionsMap[row.post_id]) {
        reactionsMap[row.post_id] = { counts: {}, userReactions: {} };
      }
      
      // Count
      reactionsMap[row.post_id].counts[row.emoji] = (reactionsMap[row.post_id].counts[row.emoji] || 0) + 1;
      
      // User reaction
      reactionsMap[row.post_id].userReactions[row.user_email] = row.emoji;
    });

    // Agrupar votos por post
    const pollVotesMap = {}; // { postId: { intimidadIndex: { counts: {}, userSelections: {} } } }
    
    pollVotesResult.rows.forEach(row => {
      if (!pollVotesMap[row.post_id]) {
        pollVotesMap[row.post_id] = {};
      }
      if (!pollVotesMap[row.post_id][row.intimidad_index]) {
        pollVotesMap[row.post_id][row.intimidad_index] = { counts: {}, userSelections: {} };
      }
      
      const voteData = pollVotesMap[row.post_id][row.intimidad_index];
      
      // Count
      voteData.counts[row.option_key] = (voteData.counts[row.option_key] || 0) + 1;
      
      // User selection
      voteData.userSelections[row.user_email] = row.option_key;
    });

    const posts = result.rows.map(row => {
      const postReactions = reactionsMap[row.id] || { counts: {}, userReactions: {} };
      const baseReactions = row.reactions || { selected: [], counts: {}, userReaction: null };
      
      // Determinar la reacción del usuario actual
      const myReaction = currentUserEmail ? postReactions.userReactions[currentUserEmail] : null;

      let intimidades = row.intimidades || [];

      // Inject poll votes
      if (pollVotesMap[row.id]) {
        intimidades = intimidades.map((intimidad, idx) => {
          if (pollVotesMap[row.id][idx]) {
             const votes = pollVotesMap[row.id][idx];
             const myVote = currentUserEmail ? votes.userSelections[currentUserEmail] : null;
             
             if (intimidad.type === 'quiz' && intimidad.quizData) {
                // Update quizData
                const stats = { a: 0, b: 0, c: 0, d: 0 };
                Object.keys(votes.counts).forEach(key => {
                    if (stats[key] !== undefined) stats[key] = votes.counts[key];
                });
                
                return {
                    ...intimidad,
                    quizData: {
                        ...intimidad.quizData,
                        stats: stats,
                        userSelection: myVote
                    }
                };
             } else if (intimidad.type === 'survey' && intimidad.surveyData) {
                // Update surveyData
                const optionsCount = intimidad.surveyData.options.length;
                const stats = new Array(optionsCount).fill(0);
                
                Object.keys(votes.counts).forEach(key => {
                    const index = parseInt(key);
                    if (!isNaN(index) && index < optionsCount) {
                        stats[index] = votes.counts[key];
                    }
                });
                
                return {
                    ...intimidad,
                    surveyData: {
                        ...intimidad.surveyData,
                        stats: stats,
                        userSelection: myVote !== null ? parseInt(myVote) : null
                    }
                };
             }
          }
          return intimidad;
        });
      }

      return {
        id: row.id.toString(),
        user: {
          username: row.username,
          email: row.user_email,
          profilePhotoUri: row.profile_photo_uri,
          nationality: row.nationality,
          socialNetworks: row.social_networks || [],
          accountVerified: row.account_verified === true,
          keintiVerified: row.keinti_verified === true,
        },
        presentation: row.presentation,
        intimidades: intimidades,
        reactions: {
          selected: baseReactions.selected || [],
          counts: postReactions.counts, // Usar conteos reales de la tabla
          userReaction: myReaction // Reacción específica del usuario
        },
        createdAt: row.created_at
      };
    });

    res.json(posts);
  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// Crear una nueva publicación
router.post('/', authenticateToken, async (req, res) => {
  const { presentation, intimidades, reactions } = req.body;
  const userEmail = req.user.email;

  try {
    const result = await pool.query(
      `INSERT INTO Post_users (user_email, presentation, intimidades, reactions)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         user_email,
         presentation,
         intimidades,
         reactions,
         (created_at AT TIME ZONE 'UTC') AS created_at,
         (updated_at AT TIME ZONE 'UTC') AS updated_at,
         (deleted_at AT TIME ZONE 'UTC') AS deleted_at`,
      [userEmail, JSON.stringify(presentation), JSON.stringify(intimidades), JSON.stringify(reactions)]
    );

    const newPost = result.rows[0];
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Error al crear publicación:', error);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

// Registrar apertura de "intimidades" para un post.
// - Solo usuarios autenticados.
// - No cuenta aperturas del propio creador.
// - Evita duplicados por (post, opener) para que un usuario no infle el contador.
router.post('/:postId/intimidades/open', authenticateToken, async (req, res) => {
  const postId = Number(req.params.postId);
  const openerEmail = req.user?.email;

  if (!Number.isFinite(postId) || postId <= 0) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    // El post debe existir y estar activo (24h).
    const postRes = await pool.query(
      `SELECT user_email
       FROM Post_users
       WHERE id = $1
         AND deleted_at IS NULL
         AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
       LIMIT 1`,
      [postId, POST_TTL_MINUTES]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    const creatorEmail = postRes.rows[0].user_email;
    if (!creatorEmail || !openerEmail) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // No contar auto-aperturas.
    if (String(creatorEmail).toLowerCase() === String(openerEmail).toLowerCase()) {
      return res.json({ ok: true, counted: false });
    }

    const insert = await pool.query(
      `INSERT INTO post_intimidades_opens (post_id, creator_email, opener_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, opener_email) DO NOTHING`,
      [postId, creatorEmail, openerEmail]
    );

    return res.json({ ok: true, counted: (insert.rowCount || 0) > 0 });
  } catch (error) {
    console.error('Error recording intimidades open:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Progreso acumulativo de aperturas de "intimidades" para el usuario autenticado (creador).
// Cuenta TODAS las aperturas históricas (sin filtro mensual ni dependencia del post).
router.get('/me/intimidades/opens-progress', authenticateToken, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: 'No autorizado' });

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM post_intimidades_opens
       WHERE creator_email = $1`,
      [email]
    );

    const total = result.rows?.[0]?.total ?? 0;
    res.json({ total });
  } catch (error) {
    console.error('Error getting intimidades opens progress:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Progreso de publicaciones del perfil en Home que han completado su duración (TTL).
// - Cuenta publicaciones creadas por el usuario que ya han expirado por tiempo.
// - Excluye publicaciones retiradas (deleted_at) antes de completar su TTL.
router.get('/me/profile/publishes-progress', authenticateToken, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: 'No autorizado' });

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM Post_users p
       WHERE p.user_email = $1
         AND p.created_at < NOW() - ($2 * INTERVAL '1 minute')
         AND (
           p.deleted_at IS NULL
           OR p.deleted_at >= p.created_at + ($2 * INTERVAL '1 minute')
         )`,
      [email, POST_TTL_MINUTES]
    );

    const total = result.rows?.[0]?.total ?? 0;
    return res.json({ total });
  } catch (error) {
    console.error('Error getting profile publishes progress:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar una publicación
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userEmail = req.user.email;
  const postId = Number(id);

  if (!Number.isFinite(postId) || postId <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const objectsToDelete = [];

    await pool.query('BEGIN');

    // Importante: si el post tiene solicitudes con estado 'blocked', queremos conservar el bloqueo
    // aunque el usuario elimine su publicación. Para ello, desvinculamos el post_id antes de borrar el post.
    // Esto también protege en caso de que la FK aún estuviera configurada con ON DELETE CASCADE.
    await pool.query(
      `UPDATE group_join_requests
       SET post_id = NULL
       WHERE post_id = $1 AND status = 'blocked'`,
      [postId]
    );

    // Si el post se elimina manualmente, las solicitudes pendientes asociadas dejan de tener sentido.
    await pool.query(
      `DELETE FROM group_join_requests
       WHERE post_id = $1 AND status = 'pending'`,
      [postId]
    ).catch(() => {});

    const result = await pool.query(
      `UPDATE Post_users
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_email = $2 AND deleted_at IS NULL
       RETURNING id`,
      [postId, userEmail]
    );

    if (result.rowCount === 0) {
      // Idempotencia: si ya está borrado, seguimos limpiando media si el post es del usuario.
      const already = await pool.query(
        'SELECT 1 FROM Post_users WHERE id = $1 AND user_email = $2 LIMIT 1',
        [postId, userEmail]
      );
      if ((already.rows?.length || 0) === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Publicación no encontrada o no autorizada' });
      }
    }

    // Eliminar media asociado a la publicación (incluye imágenes compartidas en canales ligados al post).
    // Esto borra punteros (y legacy BYTEA) en la BD y agenda borrado en Storage.
    // También borra datos del canal (suscripciones y mensajes) porque el canal vive solo mientras el post está activo.
    // NOTA: post_intimidades_opens y channel_subscriptions NO se eliminan.
    // Se conservan para el progreso de verificación ("Verifica tu Keinti").
    await pool.query('DELETE FROM post_reactions WHERE post_id = $1', [postId]).catch(() => {});
    await pool.query('DELETE FROM post_poll_votes WHERE post_id = $1', [postId]).catch(() => {});
    await pool.query('DELETE FROM channel_messages WHERE post_id = $1', [postId]).catch(() => {});

    const mediaRows = await pool.query(
      'DELETE FROM uploaded_images WHERE post_id = $1 RETURNING storage_bucket, storage_path',
      [postId]
    );

    for (const r of (mediaRows.rows || [])) {
      const bucket = r.storage_bucket || null;
      const path = r.storage_path || null;
      if (bucket && path) objectsToDelete.push({ bucket, path });
    }

    await pool.query('COMMIT');

    // Best-effort: borrar objetos de Supabase Storage fuera de la transacción.
    for (const obj of objectsToDelete) {
      await deleteObject(obj).catch(() => {});
    }

    return res.json({ message: 'Publicación eliminada exitosamente' });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Error al eliminar publicación:', error);
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

// Actualizar reacción
router.put('/:id/react', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body; // Ya no necesitamos previousEmoji del cliente
  const userEmail = req.user.email;

  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    if (!(await isPostActive(postId))) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    // Verificar si el usuario ya reaccionó a este post con este emoji
    let existingReaction;
    try {
      existingReaction = await pool.query(
        'SELECT emoji FROM post_reactions WHERE post_id = $1 AND user_email = $2',
        [postId, userEmail]
      );
    } catch (err) {
      if (isMissingRelationError(err, 'post_reactions')) {
        return res.status(503).json({ error: 'Reacciones no disponibles (migración de BD incompleta)' });
      }
      throw err;
    }

    if (existingReaction.rows.length > 0) {
      const currentEmoji = existingReaction.rows[0].emoji;
      if (currentEmoji === emoji) {
        // Si es el mismo emoji, no hacemos nada (o podríamos quitar la reacción si quisiéramos toggle)
        return res.json({ success: true, message: 'Reacción ya existente' });
      } else {
        // Si es diferente, actualizamos
        try {
          await pool.query(
            'UPDATE post_reactions SET emoji = $1, created_at = CURRENT_TIMESTAMP WHERE post_id = $2 AND user_email = $3',
            [emoji, id, userEmail]
          );
        } catch (err) {
          if (isMissingRelationError(err, 'post_reactions')) {
            return res.status(503).json({ error: 'Reacciones no disponibles (migración de BD incompleta)' });
          }
          throw err;
        }
      }
    } else {
      // Si no existe, insertamos
      try {
        await pool.query(
          'INSERT INTO post_reactions (post_id, user_email, emoji) VALUES ($1, $2, $3)',
          [postId, userEmail, emoji]
        );
      } catch (err) {
        if (isMissingRelationError(err, 'post_reactions')) {
          return res.status(503).json({ error: 'Reacciones no disponibles (migración de BD incompleta)' });
        }
        throw err;
      }
    }

    // Devolver los nuevos conteos para que el frontend se actualice
    let countsResult;
    try {
      countsResult = await pool.query(
        'SELECT emoji, COUNT(*) as count FROM post_reactions WHERE post_id = $1 GROUP BY emoji',
        [postId]
      );
    } catch (err) {
      if (isMissingRelationError(err, 'post_reactions')) {
        return res.status(503).json({ error: 'Reacciones no disponibles (migración de BD incompleta)' });
      }
      throw err;
    }

    const newCounts = {};
    countsResult.rows.forEach(row => {
      newCounts[row.emoji] = parseInt(row.count);
    });

    res.json({ success: true, counts: newCounts, userReaction: emoji });
  } catch (error) {
    console.error('Error al actualizar reacción:', error);
    res.status(500).json({ error: 'Error al actualizar reacción' });
  }
});

// Votar en encuesta/quiz
router.post('/:id/vote', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { intimidadIndex, optionKey } = req.body;
  const userEmail = req.user.email;

  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    if (!(await isPostActive(postId))) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    // Upsert vote
    try {
      await pool.query(
        `
        INSERT INTO post_poll_votes (post_id, user_email, intimidad_index, option_key)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (post_id, user_email, intimidad_index)
        DO UPDATE SET option_key = EXCLUDED.option_key, created_at = CURRENT_TIMESTAMP
        `,
        [postId, userEmail, intimidadIndex, optionKey]
      );
    } catch (err) {
      if (isMissingRelationError(err, 'post_poll_votes')) {
        return res.status(503).json({ error: 'Encuestas no disponibles (migración de BD incompleta)' });
      }
      throw err;
    }

    // Return updated stats for this poll
    let votesResult;
    try {
      votesResult = await pool.query(
        `
          SELECT option_key, COUNT(*) as count 
          FROM post_poll_votes 
          WHERE post_id = $1 AND intimidad_index = $2 
          GROUP BY option_key
        `,
        [postId, intimidadIndex]
      );
    } catch (err) {
      if (isMissingRelationError(err, 'post_poll_votes')) {
        return res.status(503).json({ error: 'Encuestas no disponibles (migración de BD incompleta)' });
      }
      throw err;
    }
    
    const counts = {};
    votesResult.rows.forEach(row => {
        counts[row.option_key] = parseInt(row.count);
    });

    res.json({ success: true, counts });
  } catch (error) {
    console.error('Error al votar:', error);
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

module.exports = router;
