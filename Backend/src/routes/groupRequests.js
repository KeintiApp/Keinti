const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');

const POST_TTL_MINUTES = getPostTtlMinutes();

const router = express.Router();

const SYSTEM_BLOCKS_GROUP_HASHTAG = '__keinti_blocks__';

async function getOrCreateSystemBlocksGroupId() {
  const existing = await pool.query(
    `SELECT id FROM user_groups WHERE owner_email IS NULL AND hashtag = $1 LIMIT 1`,
    [SYSTEM_BLOCKS_GROUP_HASHTAG]
  );

  const found = existing.rows[0]?.id;
  if (found) return Number(found);

  const inserted = await pool.query(
    `INSERT INTO user_groups (owner_email, hashtag, image_uri, created_at, updated_at)
     VALUES (NULL, $1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id`,
    [SYSTEM_BLOCKS_GROUP_HASHTAG]
  );

  return Number(inserted.rows[0]?.id);
}

function normalizeUsernameCandidates(raw) {
  const trimmed = String(raw || '').trim();
  const noAt = trimmed.replace(/^@/, '');
  return Array.from(new Set([trimmed, noAt, `@${noAt}`].filter(Boolean)));
}

async function findUserByUsername(username) {
  const candidates = normalizeUsernameCandidates(username);
  if (candidates.length === 0) return null;

  const result = await pool.query(
    `SELECT email, username FROM users WHERE username = ANY($1::text[]) LIMIT 1`,
    [candidates]
  );

  return result.rows[0] || null;
}

// Crear solicitud para que un usuario se una a un grupo
router.post('/', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const groupId = Number(req.body.groupId);
  const targetUsername = String(req.body.targetUsername || '').trim();
  const postIdRaw = req.body.postId;
  const postId = postIdRaw === undefined || postIdRaw === null || postIdRaw === '' ? null : Number(postIdRaw);

  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: 'groupId inválido' });
  }
  if (postId !== null && !Number.isFinite(postId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }
  if (!targetUsername) {
    return res.status(400).json({ error: 'targetUsername requerido' });
  }

  try {
    // Verificar que el solicitante sea dueño del grupo
    const groupCheck = await pool.query(
      'SELECT id, owner_email, hashtag FROM user_groups WHERE id = $1',
      [groupId]
    );

    const group = groupCheck.rows[0];
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (group.owner_email !== requesterEmail) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (postId !== null) {
      const postCheck = await pool.query(
        'SELECT id, user_email, created_at, deleted_at FROM Post_users WHERE id = $1',
        [postId]
      );

      const post = postCheck.rows[0];
      if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
      if (post.deleted_at) return res.status(410).json({ error: 'Publicación expirada' });
      if (post.user_email !== requesterEmail) {
        return res.status(403).json({ error: 'No autorizado para esta publicación' });
      }

      // No permitir solicitudes sobre publicaciones expiradas
      const expiredCheck = await pool.query(
        `SELECT 1
         FROM Post_users
         WHERE id = $1
           AND deleted_at IS NULL
           AND created_at < NOW() - ($2 * INTERVAL '1 minute')
         LIMIT 1`,
        [postId, POST_TTL_MINUTES]
      );

      if ((expiredCheck.rows?.length || 0) > 0) {
        return res.status(410).json({ error: 'Publicación expirada' });
      }
    }

    const targetUser = await findUserByUsername(targetUsername);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario objetivo no encontrado' });
    }

    if (targetUser.email === requesterEmail) {
      return res.status(400).json({ error: 'No puedes solicitarte a ti mismo' });
    }

    const upsert = await pool.query(
      `INSERT INTO group_join_requests (group_id, post_id, requester_email, target_email, status, created_at, responded_at)
       VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (group_id, requester_email, target_email)
       DO UPDATE SET status = 'pending', created_at = CURRENT_TIMESTAMP, responded_at = NULL, post_id = EXCLUDED.post_id
       RETURNING id, group_id, post_id, requester_email, target_email, status, created_at`,
      [groupId, postId, requesterEmail, targetUser.email]
    );

    return res.status(201).json({
      request: upsert.rows[0],
      group: { id: String(group.id), hashtag: String(group.hashtag || '') },
      targetUser: { email: targetUser.email, username: targetUser.username },
    });
  } catch (error) {
    console.error('Error creating group join request:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar solicitudes enviadas por el usuario autenticado (para reflejar estado en UI del anfitrión)
router.get('/sent', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;

  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.group_id,
         r.status,
         r.created_at,
         r.responded_at,
         tu.username AS target_username,
         g.hashtag AS group_hashtag
       FROM group_join_requests r
       JOIN users tu ON tu.email = r.target_email
       JOIN user_groups g ON g.id = r.group_id
       WHERE r.requester_email = $1
       ORDER BY r.created_at DESC`,
      [requesterEmail]
    );

    const rows = result.rows.map(row => ({
      id: Number(row.id),
      groupId: Number(row.group_id),
      status: String(row.status),
      createdAt: row.created_at,
      respondedAt: row.responded_at,
      targetUsername: String(row.target_username || ''),
      groupHashtag: String(row.group_hashtag || ''),
    }));

    return res.json(rows);
  } catch (error) {
    console.error('Error fetching sent group join requests:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar usuarios bloqueados por el usuario autenticado
router.get('/blocked', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;

  try {
    const result = await pool.query(
      `SELECT
         r.group_id,
         g.hashtag AS group_hashtag,
         u.email,
         u.username,
         u.profile_photo_uri,
         COALESCE(NULLIF(TRIM(r.block_reason), ''), 'sin motivo') AS block_reason,
         r.responded_at,
         r.created_at
       FROM group_join_requests r
       JOIN users u ON u.email = r.target_email
       JOIN user_groups g ON g.id = r.group_id
       WHERE r.requester_email = $1
         AND r.status = 'blocked'
       ORDER BY r.responded_at DESC NULLS LAST, r.created_at DESC`,
      [requesterEmail]
    );

    return res.json(
      result.rows.map(r => ({
        group_id: Number(r.group_id),
        group_hashtag: String(r.group_hashtag || ''),
        email: String(r.email),
        username: String(r.username || ''),
        profile_photo_uri: r.profile_photo_uri ? String(r.profile_photo_uri) : null,
        block_reason: String(r.block_reason || 'sin motivo'),
      }))
    );
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Desbloquear usuario (restablecer relación a estado original)
// Nota: elimina el bloqueo en ambos sentidos para que ambos usuarios vuelvan
// a poder ver el contenido del otro.
router.post('/unblock', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const targetEmail = String(req.body?.email || req.body?.targetEmail || '').trim();
  const groupIdRaw = req.body?.groupId ?? req.body?.group_id;
  const groupId = groupIdRaw === undefined || groupIdRaw === null || groupIdRaw === '' ? null : Number(groupIdRaw);

  if (!targetEmail) {
    return res.status(400).json({ error: 'email requerido' });
  }
  if (targetEmail === requesterEmail) {
    return res.status(400).json({ error: 'No puedes desbloquearte a ti mismo' });
  }
  if (groupId !== null && !Number.isFinite(groupId)) {
    return res.status(400).json({ error: 'groupId inválido' });
  }

  try {
    // Bloqueo por grupo: si llega groupId, solo se desbloquea esa relación en ese grupo.
    // Compatibilidad: si no llega groupId, se desbloquean todos los bloqueos del usuario autenticado hacia target.
    const result = groupId !== null
      ? await pool.query(
          `UPDATE group_join_requests
           SET status = 'left',
               responded_at = CURRENT_TIMESTAMP,
               block_reason = NULL
           WHERE status = 'blocked'
             AND group_id = $3
             AND requester_email = $1
             AND target_email = $2`,
          [requesterEmail, targetEmail, groupId]
        )
      : await pool.query(
          `UPDATE group_join_requests
           SET status = 'left',
               responded_at = CURRENT_TIMESTAMP,
               block_reason = NULL
           WHERE status = 'blocked'
             AND requester_email = $1
             AND target_email = $2`,
          [requesterEmail, targetEmail]
        );

    return res.json({ ok: true, updated: result.rowCount || 0 });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Bloquear usuario (global: afecta publicaciones actuales y futuras en ambos sentidos)
router.post('/block', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const targetEmail = String(req.body?.email || req.body?.targetEmail || '').trim();
  const rawReason = String(req.body?.reason ?? req.body?.blockReason ?? '').trim();
  const reasonOrNull = rawReason ? rawReason.slice(0, 320) : null;

  if (!targetEmail) {
    return res.status(400).json({ error: 'email requerido' });
  }
  if (targetEmail === requesterEmail) {
    return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
  }

  try {
    const groupId = await getOrCreateSystemBlocksGroupId();

    await pool.query(
      `INSERT INTO group_join_requests (group_id, requester_email, target_email, status, block_reason, created_at, responded_at)
       VALUES ($1, $2, $3, 'blocked', $4::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (group_id, requester_email, target_email)
       DO UPDATE SET status = 'blocked',
                     block_reason = EXCLUDED.block_reason,
                     responded_at = CURRENT_TIMESTAMP`,
      [groupId, requesterEmail, targetEmail, reasonOrNull]
    );

    return res.json({ ok: true, groupId, targetEmail });
  } catch (error) {
    console.error('Error blocking user:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Aceptar solicitud
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const targetEmail = req.user.email;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const requestResult = await pool.query(
      `SELECT id, group_id, requester_email, target_email, status
       FROM group_join_requests
       WHERE id = $1`,
      [id]
    );

    const row = requestResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (row.target_email !== targetEmail) return res.status(403).json({ error: 'No autorizado' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'Solicitud ya gestionada' });

    await pool.query(
      `INSERT INTO group_members (group_id, member_email, added_by_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, member_email) DO NOTHING`,
      [row.group_id, targetEmail, row.requester_email]
    );

    await pool.query(
      `UPDATE group_join_requests
       SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error accepting group join request:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ignorar solicitud
router.post('/:id/ignore', authenticateToken, async (req, res) => {
  const targetEmail = req.user.email;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const requestResult = await pool.query(
      `SELECT id, target_email, status
       FROM group_join_requests
       WHERE id = $1`,
      [id]
    );

    const row = requestResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (row.target_email !== targetEmail) return res.status(403).json({ error: 'No autorizado' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'Solicitud ya gestionada' });

    await pool.query(
      `UPDATE group_join_requests
       SET status = 'ignored', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error ignoring group join request:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
