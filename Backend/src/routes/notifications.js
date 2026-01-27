const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');

const POST_TTL_MINUTES = getPostTtlMinutes();

const router = express.Router();

// Listar notificaciones (por ahora: solicitudes pendientes para unirse a grupos)
router.get('/', authenticateToken, async (req, res) => {
  const email = req.user.email;

  try {
        // Limpieza inmediata: eliminar solicitudes pendientes expiradas
        // - Si hay post_id: expira con el post (created_at + 24h)
    // - Si no hay post_id (solicitudes antiguas): fallback a created_at de la solicitud
    await pool.query(
      `DELETE FROM group_join_requests r
       USING Post_users p
       WHERE r.post_id = p.id
         AND r.status = 'pending'
          AND (p.created_at < NOW() - ($1 * INTERVAL '1 minute') OR p.deleted_at IS NOT NULL)`
      ,
      [POST_TTL_MINUTES]
    );

    await pool.query(
      `DELETE FROM group_join_requests
       WHERE post_id IS NULL
         AND status = 'pending'
         AND created_at < NOW() - ($1 * INTERVAL '1 minute')`
      ,
      [POST_TTL_MINUTES]
    );

    const result = await pool.query(
      `SELECT
         r.id,
         r.group_id,
         r.post_id,
         r.status,
         r.created_at,
         u.username AS requester_username,
         g.hashtag AS group_hashtag,
         p.created_at AS post_created_at
       FROM group_join_requests r
       JOIN users u ON u.email = r.requester_email
       JOIN user_groups g ON g.id = r.group_id
       LEFT JOIN Post_users p ON p.id = r.post_id
       WHERE r.target_email = $1
       ORDER BY r.created_at DESC`,
      [email]
    );

    const notifications = result.rows.map(row => ({
      id: Number(row.id),
      type: 'group_join_request',
      groupId: Number(row.group_id),
      postId: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
      postCreatedAt: row.post_created_at || null,
      status: String(row.status),
      createdAt: row.created_at,
      requesterUsername: String(row.requester_username || ''),
      groupHashtag: String(row.group_hashtag || ''),
    }));

    return res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
