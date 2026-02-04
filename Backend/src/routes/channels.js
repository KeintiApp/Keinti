const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');

const POST_TTL_MINUTES = getPostTtlMinutes();

async function getActivePostPublisherEmail(postId) {
  const result = await pool.query(
    `SELECT user_email
     FROM Post_users
     WHERE id = $1
       AND deleted_at IS NULL
       AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
     LIMIT 1`,
    [postId, POST_TTL_MINUTES]
  );

  return result.rows?.[0]?.user_email || null;
}

async function isBlockedBetween(emailA, emailB) {
  const result = await pool.query(
    `SELECT 1
     FROM group_join_requests r
     WHERE r.status = 'blocked'
       AND (
         (r.requester_email = $1 AND r.target_email = $2)
         OR (r.requester_email = $2 AND r.target_email = $1)
       )
     LIMIT 1`,
    [emailA, emailB]
  );

  return (result.rows?.length || 0) > 0;
}

async function ensureChannelAccessOrThrow({ userEmail, postId, publisherEmail }) {
  if (!publisherEmail) {
    const err = new Error('Publicación no encontrada o expirada');
    // @ts-ignore
    err.statusCode = 410;
    throw err;
  }

  if (await isBlockedBetween(userEmail, publisherEmail)) {
    const err = new Error('No autorizado');
    // @ts-ignore
    err.statusCode = 403;
    throw err;
  }

  if (userEmail === publisherEmail) return;

  const sub = await pool.query(
    `SELECT 1
     FROM channel_subscriptions
     WHERE viewer_email = $1 AND post_id = $2
     LIMIT 1`,
    [userEmail, postId]
  );
  if ((sub.rows?.length || 0) === 0) {
    const err = new Error('No estás suscrito a este canal');
    // @ts-ignore
    err.statusCode = 403;
    // @ts-ignore
    err.code = 'NOT_SUBSCRIBED';
    throw err;
  }
}

// Entrar a un canal (Suscribirse)
router.post('/enter', authenticateToken, async (req, res) => {
  const { publisherEmail: publisherEmailFromClient, postId } = req.body;
  const viewerEmail = req.user.email;

  if (!postId) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const publisherEmail = await getActivePostPublisherEmail(numericPostId);
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    // (Compatibilidad) Si el cliente envía publisherEmail, lo validamos pero no lo confiamos.
    if (publisherEmailFromClient && String(publisherEmailFromClient).trim() !== String(publisherEmail).trim()) {
      return res.status(400).json({ error: 'publisherEmail no coincide con la publicación' });
    }

    if (viewerEmail === publisherEmail) {
      return res.status(400).json({ error: 'No puedes entrar a tu propio canal' });
    }

    if (await isBlockedBetween(viewerEmail, publisherEmail)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Verificar si ya existe la suscripción
    const check = await pool.query(
      'SELECT * FROM channel_subscriptions WHERE viewer_email = $1 AND post_id = $2',
      [viewerEmail, numericPostId]
    );

    if (check.rows.length > 0) {
      return res.json({ message: 'Ya estás en este canal', subscription: check.rows[0] });
    }

    // Crear suscripción
    const result = await pool.query(
      'INSERT INTO channel_subscriptions (viewer_email, publisher_email, post_id) VALUES ($1, $2, $3) RETURNING *',
      [viewerEmail, publisherEmail, numericPostId]
    );

    res.status(201).json({ message: 'Has entrado al canal', subscription: result.rows[0] });
  } catch (error) {
    console.error('Error al entrar al canal:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Salir de un canal (Desuscribirse)
router.delete('/leave/:postId', authenticateToken, async (req, res) => {
  const viewerEmail = req.user.email;
  const { postId } = req.params;

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM channel_subscriptions WHERE viewer_email = $1 AND post_id = $2',
      [viewerEmail, numericPostId]
    );

    // pg returns rowCount for DELETE
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No estabas suscrito a este canal' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al salir del canal:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener mis canales (Canales donde soy viewer)
router.get('/my-channels', authenticateToken, async (req, res) => {
  const viewerEmail = req.user.email;

  try {
    const result = await pool.query(`
      SELECT 
        cs.*,
        u.username, u.profile_photo_uri, u.social_networks,
        aa.verified AS account_verified,
        aa.keinti_verified AS keinti_verified,
        p.presentation, p.created_at as post_created_at,
        (SELECT COUNT(*) FROM channel_subscriptions sub WHERE sub.post_id = cs.post_id) as subscriber_count
      FROM channel_subscriptions cs
      JOIN users u ON cs.publisher_email = u.email
      LEFT JOIN account_auth aa ON aa.user_email = u.email
      JOIN Post_users p ON cs.post_id = p.id
      WHERE cs.viewer_email = $1
        AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
        AND NOT EXISTS (
          SELECT 1
          FROM group_join_requests r
          WHERE r.status = 'blocked'
            AND (
              (r.requester_email = $1 AND r.target_email = cs.publisher_email)
              OR (r.requester_email = cs.publisher_email AND r.target_email = $1)
            )
        )
      ORDER BY cs.created_at DESC
    `, [viewerEmail, POST_TTL_MINUTES]);

    // Parsear presentation si es string (aunque pg lo devuelve como objeto si es jsonb)
    const channels = result.rows.map(row => ({
      ...row,
      category: row.presentation.category || 'Sin categoría'
    }));

    res.json(channels);
  } catch (error) {
    console.error('Error al obtener canales:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener interacciones de mi canal (Usuarios que entraron a mis posts)
router.get('/interactions', authenticateToken, async (req, res) => {
  const publisherEmail = req.user.email;

  try {
    const result = await pool.query(`
      SELECT 
        cs.*,
        u.username, u.profile_photo_uri, u.social_networks
      FROM channel_subscriptions cs
      JOIN users u ON cs.viewer_email = u.email
      JOIN Post_users p ON p.id = cs.post_id
      WHERE cs.publisher_email = $1
        AND p.deleted_at IS NULL
        AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
      ORDER BY cs.created_at DESC
    `, [publisherEmail, POST_TTL_MINUTES]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener interacciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Progreso mensual: cuántos usuarios se han unido a mis chats (suscripciones) este mes.
router.get('/me/joins-progress', authenticateToken, async (req, res) => {
  const publisherEmail = req.user?.email;
  if (!publisherEmail) return res.status(401).json({ error: 'No autorizado' });

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM channel_subscriptions cs
       JOIN Post_users p ON p.id = cs.post_id
       WHERE cs.publisher_email = $1
         AND cs.created_at >= date_trunc('month', NOW())
         AND (
           p.deleted_at IS NULL
           OR p.deleted_at >= p.created_at + ($2 * INTERVAL '1 minute')
         )`,
      [publisherEmail, POST_TTL_MINUTES]
    );

    const total = result.rows?.[0]?.total ?? 0;
    res.json({ total });
  } catch (error) {
    console.error('Error getting channel joins progress:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener interacciones de un post específico (para viewers)
router.get('/interactions/:postId', authenticateToken, async (req, res) => {
  const { postId } = req.params;
  const requesterEmail = req.user.email;

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const publisherEmail = await getActivePostPublisherEmail(numericPostId);
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    // Permitir ver interacciones solo al publisher o a viewers suscritos
    try {
      await ensureChannelAccessOrThrow({ userEmail: requesterEmail, postId: numericPostId, publisherEmail });
    } catch (e) {
      const status = e?.statusCode || 403;
      return res.status(status).json({ error: e?.message || 'No autorizado', code: e?.code });
    }

    const result = await pool.query(`
      SELECT 
        cs.*,
        u.username, u.profile_photo_uri, u.social_networks
      FROM channel_subscriptions cs
      JOIN users u ON cs.viewer_email = u.email
      WHERE cs.post_id = $1
      ORDER BY cs.created_at DESC
    `, [numericPostId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener interacciones del post:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Enviar mensaje al canal general
router.post('/messages', authenticateToken, async (req, res) => {
  const { postId, message } = req.body;
  const senderEmail = req.user.email;

  if (!postId || !message) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    // Verificar post activo y obtener publicador
    const publisherEmail = await getActivePostPublisherEmail(numericPostId);
    
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    // Control de acceso al canal
    try {
      await ensureChannelAccessOrThrow({ userEmail: senderEmail, postId: numericPostId, publisherEmail });
    } catch (e) {
      const status = e?.statusCode || 403;
      return res.status(status).json({ error: e?.message || 'No autorizado', code: e?.code });
    }

    console.log(`[DEBUG] Message attempt: Sender=${senderEmail}, Publisher=${publisherEmail}, PostId=${postId}`);

    // Turnos por usuario:
    // - El publicador puede enviar siempre.
    // - Un viewer solo puede enviar si:
    //    a) nunca ha enviado antes, o
    //    b) el publicador ya respondió a su ÚLTIMO mensaje.
    if (senderEmail !== publisherEmail) {
      const viewerRow = await pool.query(
        'SELECT username FROM users WHERE email = $1',
        [senderEmail]
      );

      const rawUsername = String(viewerRow.rows?.[0]?.username ?? '').trim();
      const atUsername = rawUsername
        ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`)
        : '';
      const atEmail = `@${String(senderEmail || '').trim()}`;

      const lastViewerMsg = await pool.query(
        'SELECT id FROM channel_messages WHERE post_id = $1 AND sender_email = $2 ORDER BY id DESC LIMIT 1',
        [postId, senderEmail]
      );

      if (lastViewerMsg.rows.length > 0) {
        const lastViewerMsgId = Number(lastViewerMsg.rows[0].id);
        const patterns = [];
        if (atUsername) patterns.push(`${atUsername} %`);
        patterns.push(`${atEmail} %`);

        const replyCheck = await pool.query(
          `SELECT 1
           FROM channel_messages
           WHERE post_id = $1
             AND sender_email = $2
             AND id > $3
             AND (message LIKE ANY($4::text[]))
           LIMIT 1`,
          [postId, publisherEmail, lastViewerMsgId, patterns]
        );

        if (replyCheck.rows.length === 0) {
          console.log('[DEBUG] Blocking message: Waiting for publisher reply');
          return res.status(403).json({
            error: 'Debes esperar una respuesta del creador para poder enviar otro mensaje',
            code: 'WAIT_FOR_PUBLISHER_REPLY'
          });
        }
      }
    }

    const result = await pool.query(
      'INSERT INTO channel_messages (post_id, sender_email, message) VALUES ($1, $2, $3) RETURNING *',
      [numericPostId, senderEmail, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener mensajes del canal general
router.get('/messages/:postId', authenticateToken, async (req, res) => {
  const { postId } = req.params;
  const requesterEmail = req.user.email;

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const publisherEmail = await getActivePostPublisherEmail(numericPostId);
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    try {
      await ensureChannelAccessOrThrow({ userEmail: requesterEmail, postId: numericPostId, publisherEmail });
    } catch (e) {
      const status = e?.statusCode || 403;
      return res.status(status).json({ error: e?.message || 'No autorizado', code: e?.code });
    }

    const result = await pool.query(
      `SELECT cm.*, u.username 
       FROM channel_messages cm
       JOIN users u ON cm.sender_email = u.email
       WHERE cm.post_id = $1 
       ORDER BY cm.id ASC`,
      [numericPostId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
