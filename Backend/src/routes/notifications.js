const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');

const POST_TTL_MINUTES = getPostTtlMinutes();

const router = express.Router();

const CHANNEL_REPLY_TARGET_TOKEN_SQL = "split_part(regexp_replace(trim(cm.message), '^@+', ''), ' ', 1)";
const CHANNEL_REPLY_VIEWER_MATCH_SQL = `(
  lower(coalesce(viewer.username, '')) = lower(${CHANNEL_REPLY_TARGET_TOKEN_SQL})
  OR lower(ltrim(coalesce(viewer.username, ''), '@')) = lower(${CHANNEL_REPLY_TARGET_TOKEN_SQL})
  OR lower(viewer.email) = lower(${CHANNEL_REPLY_TARGET_TOKEN_SQL})
)`;

async function cleanupExpiredPendingNotifications() {
  await pool.query(
    `DELETE FROM group_join_requests r
     USING Post_users p
     WHERE r.post_id = p.id
       AND r.status = 'pending'
       AND (p.created_at < NOW() - ($1 * INTERVAL '1 minute') OR p.deleted_at IS NOT NULL)`,
    [POST_TTL_MINUTES]
  );

  await pool.query(
    `DELETE FROM group_join_requests
     WHERE post_id IS NULL
       AND status = 'pending'
       AND created_at < NOW() - ($1 * INTERVAL '1 minute')`,
    [POST_TTL_MINUTES]
  );

  await pool.query(
    `DELETE FROM channel_reply_notifications n
     USING Post_users p
     WHERE n.post_id = p.id
       AND (p.created_at < NOW() - ($1 * INTERVAL '1 minute') OR p.deleted_at IS NOT NULL)`,
    [POST_TTL_MINUTES]
  );
}

router.get('/unread-count', authenticateToken, async (req, res) => {
  const email = req.user.email;

  try {
    await cleanupExpiredPendingNotifications();

    const groupRequestsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM group_join_requests
       WHERE target_email = $1
         AND status = 'pending'
         AND read_at IS NULL`,
      [email]
    );

    const channelRepliesResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT cm.post_id
         FROM channel_messages cm
         JOIN Post_users p ON p.id = cm.post_id
         JOIN channel_subscriptions cs
           ON cs.post_id = cm.post_id
          AND cs.publisher_email = cm.sender_email
         JOIN users viewer
           ON viewer.email = cs.viewer_email
         LEFT JOIN channel_reply_notifications n
           ON n.channel_message_id = cm.id
          AND n.viewer_email = cs.viewer_email
         WHERE cs.viewer_email = $1
           AND p.deleted_at IS NULL
           AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
           AND cm.sender_email = cs.publisher_email
           AND trim(cm.message) LIKE '@% %'
           AND COALESCE(n.dismissed_at IS NULL, true)
           AND ${CHANNEL_REPLY_VIEWER_MATCH_SQL}
         GROUP BY cm.post_id
         HAVING COUNT(*) FILTER (WHERE n.read_at IS NULL) > 0
       ) grouped_unread_channel_replies`,
      [email, POST_TTL_MINUTES]
    );

    return res.json({
      count: Number(groupRequestsResult.rows[0]?.count || 0) + Number(channelRepliesResult.rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('Error fetching unread notifications count:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar notificaciones (por ahora: solicitudes pendientes para unirse a grupos)
router.get('/', authenticateToken, async (req, res) => {
  const email = req.user.email;

  try {
    await cleanupExpiredPendingNotifications();

    const groupRequestsResult = await pool.query(
      `SELECT
         r.id,
         r.group_id,
         r.post_id,
         r.status,
         r.created_at,
         r.read_at,
         u.username AS requester_username,
         g.hashtag AS group_hashtag,
        (p.created_at AT TIME ZONE 'UTC') AS post_created_at
       FROM group_join_requests r
       JOIN users u ON u.email = r.requester_email
       JOIN user_groups g ON g.id = r.group_id
       LEFT JOIN Post_users p ON p.id = r.post_id
       WHERE r.target_email = $1
       ORDER BY r.created_at DESC`,
      [email]
    );

    const channelRepliesResult = await pool.query(
      `SELECT
         -cm.post_id::int AS id,
         cm.post_id,
        (p.created_at AT TIME ZONE 'UTC') AS post_created_at,
         publisher.username AS publisher_username,
         MAX(cm.created_at) AS created_at,
         COUNT(*) FILTER (WHERE n.read_at IS NULL)::int AS unread_count,
         CASE
           WHEN COUNT(*) FILTER (WHERE n.read_at IS NULL) > 0 THEN NULL
           ELSE MAX(COALESCE(n.read_at, cm.created_at))
         END AS read_at
       FROM channel_messages cm
       JOIN Post_users p ON p.id = cm.post_id
       JOIN users publisher ON publisher.email = cm.sender_email
       JOIN channel_subscriptions cs
         ON cs.post_id = cm.post_id
        AND cs.publisher_email = cm.sender_email
       JOIN users viewer
         ON viewer.email = cs.viewer_email
       LEFT JOIN channel_reply_notifications n
         ON n.channel_message_id = cm.id
        AND n.viewer_email = cs.viewer_email
       WHERE cs.viewer_email = $1
         AND p.deleted_at IS NULL
         AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
         AND cm.sender_email = cs.publisher_email
         AND trim(cm.message) LIKE '@% %'
         AND COALESCE(n.dismissed_at IS NULL, true)
         AND ${CHANNEL_REPLY_VIEWER_MATCH_SQL}
       GROUP BY cm.post_id, p.created_at, publisher.username
       ORDER BY MAX(cm.created_at) DESC`,
      [email, POST_TTL_MINUTES]
    );

    const notifications = groupRequestsResult.rows.map(row => ({
      id: Number(row.id),
      type: 'group_join_request',
      groupId: Number(row.group_id),
      postId: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
      postCreatedAt: row.post_created_at || null,
      status: String(row.status),
      createdAt: row.created_at,
      readAt: row.read_at || null,
      requesterUsername: String(row.requester_username || ''),
      groupHashtag: String(row.group_hashtag || ''),
    })).concat(channelRepliesResult.rows.map(row => ({
      id: Number(row.id),
      type: 'channel_host_reply',
      groupId: null,
      postId: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
      postCreatedAt: row.post_created_at || null,
      status: 'pending',
      createdAt: row.created_at,
      readAt: row.read_at || null,
      requesterUsername: '',
      groupHashtag: '',
      publisherUsername: String(row.publisher_username || ''),
      unreadCount: Number(row.unread_count || 0),
    }))).sort((left, right) => {
      const leftTime = Date.parse(String(left.createdAt || ''));
      const rightTime = Date.parse(String(right.createdAt || ''));
      return rightTime - leftTime;
    });

    return res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/read', authenticateToken, async (req, res) => {
  const email = req.user.email;
  const rawId = Number(req.params.id);

  if (!Number.isFinite(rawId) || rawId === 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const isChannelReplyNotification = rawId < 0;
  const id = Math.abs(rawId);

  try {
    const result = isChannelReplyNotification
      ? await pool.query(
        `INSERT INTO channel_reply_notifications (
           post_id,
           channel_message_id,
           publisher_email,
           viewer_email,
           read_at,
           created_at
         )
         SELECT
           cm.post_id,
           cm.id,
           cm.sender_email,
           cs.viewer_email,
           CURRENT_TIMESTAMP,
           cm.created_at
         FROM channel_messages cm
         JOIN channel_subscriptions cs
           ON cs.post_id = cm.post_id
          AND cs.publisher_email = cm.sender_email
         JOIN users viewer
           ON viewer.email = cs.viewer_email
         WHERE cm.post_id = $1
           AND cs.viewer_email = $2
           AND cm.sender_email = cs.publisher_email
           AND trim(cm.message) LIKE '@% %'
           AND ${CHANNEL_REPLY_VIEWER_MATCH_SQL}
         ON CONFLICT (channel_message_id) DO UPDATE
           SET read_at = COALESCE(channel_reply_notifications.read_at, EXCLUDED.read_at)
         RETURNING read_at`,
        [id, email]
      )
      : await pool.query(
        `UPDATE group_join_requests
         SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = $1
           AND target_email = $2
         RETURNING read_at`,
        [id, email]
      );

    if ((result.rowCount || 0) === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.json({ ok: true, readAt: result.rows[0]?.read_at || null });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/channel-replies/:postId/dismiss', authenticateToken, async (req, res) => {
  const email = req.user.email;
  const postId = Number(req.params.postId);

  if (!Number.isFinite(postId) || postId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO channel_reply_notifications (
         post_id,
         channel_message_id,
         publisher_email,
         viewer_email,
         dismissed_at,
         created_at
       )
       SELECT
         cm.post_id,
         cm.id,
         cm.sender_email,
         cs.viewer_email,
         CURRENT_TIMESTAMP,
         cm.created_at
       FROM channel_messages cm
       JOIN channel_subscriptions cs
         ON cs.post_id = cm.post_id
        AND cs.publisher_email = cm.sender_email
       JOIN users viewer
         ON viewer.email = cs.viewer_email
       WHERE cm.post_id = $1
         AND cs.viewer_email = $2
         AND cm.sender_email = cs.publisher_email
         AND trim(cm.message) LIKE '@% %'
         AND ${CHANNEL_REPLY_VIEWER_MATCH_SQL}
       ON CONFLICT (channel_message_id) DO UPDATE
         SET dismissed_at = EXCLUDED.dismissed_at
       RETURNING channel_message_id`,
      [postId, email]
    );

    return res.json({ ok: true, dismissedCount: Number(result.rowCount || 0) });
  } catch (error) {
    console.error('Error dismissing channel reply notification:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
