const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getPostTtlMinutes } = require('../config/postTtl');
const {
  parseChannelEventMessage,
  computeChannelEventExpiresAt,
  injectChannelEventExpiresAt,
  createChannelEventTaskRewardRecords,
  getChannelEventTaskRewardsByMessageIds,
  refundExpiredPendingChannelEventTaskRewards,
  completeChannelEventTaskReward,
} = require('../services/channelEventRewardsService');

const POST_TTL_MINUTES = getPostTtlMinutes();
const CHANNEL_EVENT_MESSAGE_PREFIX = '__KEVT__';
const CHANNEL_READING_MESSAGE_PREFIX = '__KREAD__';
const CHANNEL_RING_RECOMMENDATION_MESSAGE_PREFIX = '__KRREC__';
const CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX = '__KRRTH__';
const HYPE_VIRAL_DEFAULT_LIMIT = 40;
const HYPE_VIRAL_MAX_LIMIT = 100;
const HYPE_VIRAL_FETCH_CHUNK_MIN = 40;
const HYPE_VIRAL_FETCH_CHUNK_MULTIPLIER = 4;
const HYPE_MOST_VIRAL_CATEGORY = 'hype.category.mostViral';

function normalizeEmailKey(rawValue) {
  return String(rawValue || '').trim().toLowerCase();
}

function normalizeOptionalString(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || null;
}

function normalizeRecommendationThreadUsername(value) {
  const normalizedValue = String(value ?? '').trim().replace(/^@+/, '').trim();
  return normalizedValue || null;
}

async function getActivePostInfo(postId) {
  const result = await pool.query(
    `SELECT user_email
            , created_at
     FROM Post_users
     WHERE id = $1
       AND deleted_at IS NULL
       AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
     LIMIT 1`,
    [postId, POST_TTL_MINUTES]
  );

  const row = result.rows?.[0];
  if (!row) {return null;}

  return {
    publisherEmail: row.user_email || null,
    createdAt: row.created_at || null,
  };
}

async function getActivePostPublisherEmail(postId) {
  const postInfo = await getActivePostInfo(postId);
  return postInfo?.publisherEmail || null;
}

function parseChannelReadingMessage(rawMessage) {
  const text = String(rawMessage || '');
  if (!text.startsWith(CHANNEL_READING_MESSAGE_PREFIX)) {return null;}

  try {
    const parsed = JSON.parse(text.slice(CHANNEL_READING_MESSAGE_PREFIX.length));
    const title = String(parsed?.title || '').trim();
    const subtitle = String(parsed?.subtitle || '').trim();
    const lead = String(parsed?.lead || '').trim();
    const hypeCost = Math.max(0, Math.floor(Number(parsed?.hypeCost) || 0));

    if (!title || !subtitle || !lead) {return null;}

    return {
      category: String(parsed?.category || '').trim(),
      hypeCost,
    };
  } catch {
    return null;
  }
}

function parseChannelReadingDonationPayload(rawMessage) {
  const payload = parseChannelReadingMessage(rawMessage);
  if (!payload) {return null;}

  return {
    hypeCost: payload.hypeCost,
  };
}

function parseChannelRingRecommendationMessage(rawMessage) {
  const text = String(rawMessage || '');
  if (!text.startsWith(CHANNEL_RING_RECOMMENDATION_MESSAGE_PREFIX)) {return null;}

  try {
    const parsed = JSON.parse(text.slice(CHANNEL_RING_RECOMMENDATION_MESSAGE_PREFIX.length));
    const sourcePublicationId = String(parsed?.sourcePublicationId || '').trim();
    const sourceImageUrl = String(parsed?.sourceImageUrl || '').trim();
    const ringId = String(parsed?.ring?.id || '').trim();
    const creatorUsername = String(parsed?.creator?.username || '').trim();

    if (!sourcePublicationId || !sourceImageUrl || !ringId || !creatorUsername) {
      return null;
    }

    return {
      sourcePublicationId,
      ringId,
      creatorUsername,
    };
  } catch {
    return null;
  }
}

function buildChannelRingRecommendationSignature(payload) {
  const sourcePublicationId = String(payload?.sourcePublicationId || '').trim();
  const ringId = String(payload?.ringId ?? payload?.ring?.id ?? '').trim();
  if (!sourcePublicationId || !ringId) {
    return '';
  }

  return `${sourcePublicationId}:${ringId}`;
}

async function listChannelRingRecommendationSignatures(db, postId, publisherEmail) {
  const result = await db.query(
    `SELECT sender_email, message
     FROM channel_messages
     WHERE post_id = $1
       AND message LIKE $2`,
    [postId, `${CHANNEL_RING_RECOMMENDATION_MESSAGE_PREFIX}%`]
  );

  const ownerEmailKey = normalizeEmailKey(publisherEmail);
  const signatures = new Set();
  result.rows.forEach((row) => {
    if (ownerEmailKey && normalizeEmailKey(row?.sender_email) !== ownerEmailKey) {
      return;
    }

    const payload = parseChannelRingRecommendationMessage(row?.message);
    const signature = buildChannelRingRecommendationSignature(payload);
    if (signature) {
      signatures.add(signature);
    }
  });

  return Array.from(signatures);
}

async function listSourcePublicationRingRecommendationCounts(db, sourcePublicationId) {
  const normalizedSourcePublicationId = String(sourcePublicationId || '').trim();
  if (!normalizedSourcePublicationId) {
    return {};
  }

  const result = await db.query(
    `SELECT cm.sender_email, cm.message
     FROM channel_messages cm
     INNER JOIN Post_users pu
       ON pu.id = cm.post_id
     WHERE cm.message LIKE $1
       AND pu.deleted_at IS NULL
       AND pu.created_at >= NOW() - ($2 * INTERVAL '1 minute')`,
    [`${CHANNEL_RING_RECOMMENDATION_MESSAGE_PREFIX}%`, POST_TTL_MINUTES]
  );

  const distinctSendersBySignature = new Map();
  result.rows.forEach((row) => {
    const payload = parseChannelRingRecommendationMessage(row?.message);
    if (!payload || String(payload.sourcePublicationId || '').trim() !== normalizedSourcePublicationId) {
      return;
    }

    const signature = buildChannelRingRecommendationSignature(payload);
    const senderEmailKey = normalizeEmailKey(row?.sender_email);
    if (!signature || !senderEmailKey) {
      return;
    }

    let distinctSenders = distinctSendersBySignature.get(signature);
    if (!distinctSenders) {
      distinctSenders = new Set();
      distinctSendersBySignature.set(signature, distinctSenders);
    }
    distinctSenders.add(senderEmailKey);
  });

  const counts = {};
  distinctSendersBySignature.forEach((distinctSenders, signature) => {
    if (signature && distinctSenders.size > 0) {
      counts[signature] = distinctSenders.size;
    }
  });

  return counts;
}

function encodeChannelRingRecommendationThreadMessage(payload) {
  const normalizedEntryKind = payload?.entryKind === 'host-global'
    ? 'host-global'
    : payload?.entryKind === 'host-direct'
      ? 'host-direct'
      : 'viewer-root';

  const safe = {
    recommendationMessageId: String(payload?.recommendationMessageId || '').trim(),
    entryKind: normalizedEntryKind,
    text: String(payload?.text || '').trim(),
    viewerEmail: normalizeOptionalString(payload?.viewerEmail),
    viewerUsername: normalizeRecommendationThreadUsername(payload?.viewerUsername),
  };

  return `${CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX}${JSON.stringify(safe)}`;
}

function parseChannelRingRecommendationThreadMessage(rawMessage) {
  const text = String(rawMessage || '');
  if (!text.startsWith(CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX)) {return null;}

  try {
    const parsed = JSON.parse(text.slice(CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX.length));
    const recommendationMessageId = String(parsed?.recommendationMessageId || '').trim();
    const entryKind = parsed?.entryKind === 'host-global'
      ? 'host-global'
      : parsed?.entryKind === 'host-direct'
        ? 'host-direct'
        : parsed?.entryKind === 'viewer-root'
          ? 'viewer-root'
          : null;
    const textContent = String(parsed?.text || '').trim();
    const viewerEmail = normalizeOptionalString(parsed?.viewerEmail);
    const viewerUsername = normalizeRecommendationThreadUsername(parsed?.viewerUsername);

    if (!recommendationMessageId || !entryKind || !textContent) {
      return null;
    }

    if (entryKind !== 'host-global' && !viewerEmail && !viewerUsername) {
      return null;
    }

    return {
      recommendationMessageId,
      entryKind,
      text: textContent,
      viewerEmail,
      viewerUsername,
    };
  } catch {
    return null;
  }
}

function sanitizeHypeViralLimit(rawLimit) {
  const parsedLimit = Number(rawLimit);
  return Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(HYPE_VIRAL_MAX_LIMIT, Math.trunc(parsedLimit)))
    : HYPE_VIRAL_DEFAULT_LIMIT;
}

function normalizeHypeViralCategory(rawCategory) {
  const normalizedCategory = String(rawCategory || '').trim();
  if (!normalizedCategory || normalizedCategory === HYPE_MOST_VIRAL_CATEGORY) {
    return '';
  }

  return normalizedCategory;
}

function normalizeHypeViralCursorTimestamp(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {return null;}

  const parsedDate = new Date(rawValue);
  if (!Number.isFinite(parsedDate.getTime())) {return null;}

  return parsedDate.toISOString();
}

function buildHypeViralCursorToken(cursor) {
  const payload = {
    donationTotal: Math.max(0, Math.floor(Number(cursor?.donationTotal) || 0)),
    createdAt: normalizeHypeViralCursorTimestamp(cursor?.createdAt),
    id: Number(cursor?.id),
  };

  if (!payload.createdAt || !Number.isFinite(payload.id) || payload.id <= 0) {
    return null;
  }

  return Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseHypeViralCursorToken(rawCursor) {
  const normalizedCursor = String(rawCursor || '').trim();
  if (!normalizedCursor) {return null;}

  try {
    const base64Value = normalizedCursor.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64Value.length % 4 || 4)) % 4);
    const decoded = JSON.parse(Buffer.from(`${base64Value}${padding}`, 'base64').toString('utf8'));
    const createdAt = normalizeHypeViralCursorTimestamp(decoded?.createdAt);
    const id = Number(decoded?.id);
    if (!createdAt || !Number.isFinite(id) || id <= 0) {
      return null;
    }

    return {
      donationTotal: Math.max(0, Math.floor(Number(decoded?.donationTotal) || 0)),
      createdAt,
      id: Math.trunc(id),
    };
  } catch {
    return null;
  }
}

function buildHypeViralCursorFromRow(row) {
  return {
    donationTotal: Math.max(0, Math.floor(Number(row?.channel_event_donation_total) || 0)),
    createdAt: normalizeHypeViralCursorTimestamp(row?.created_at),
    id: Number(row?.id),
  };
}

function buildHypeViralCursorWhereClause(cursor, firstParamIndex) {
  if (!cursor) {
    return {
      clause: '',
      params: [],
    };
  }

  return {
    clause: `
         AND (
           COALESCE(donations.total_donated, 0) < $${firstParamIndex}
           OR (
             COALESCE(donations.total_donated, 0) = $${firstParamIndex}
             AND cm.created_at < $${firstParamIndex + 1}
           )
           OR (
             COALESCE(donations.total_donated, 0) = $${firstParamIndex}
             AND cm.created_at = $${firstParamIndex + 1}
             AND cm.id < $${firstParamIndex + 2}
           )
         )`,
    params: [cursor.donationTotal, cursor.createdAt, cursor.id],
  };
}

async function fetchHypeViralChannelRowsPage({
  requesterEmail,
  messagePrefix,
  limit,
  category,
  cursor,
  parsePayload,
  getCategory,
}) {
  const requestedPageSize = Math.max(1, Math.trunc(limit)) + 1;
  const chunkSize = Math.min(
    HYPE_VIRAL_MAX_LIMIT,
    Math.max(HYPE_VIRAL_FETCH_CHUNK_MIN, requestedPageSize * HYPE_VIRAL_FETCH_CHUNK_MULTIPLIER)
  );

  const matchedRows = [];
  let scanCursor = cursor;
  let reachedEnd = false;

  while (matchedRows.length < requestedPageSize && !reachedEnd) {
    const queryParams = [requesterEmail, POST_TTL_MINUTES, `${messagePrefix}%`];
    const cursorWhere = buildHypeViralCursorWhereClause(scanCursor, queryParams.length + 1);
    queryParams.push(...cursorWhere.params);
    queryParams.push(chunkSize);

    const limitParamIndex = queryParams.length;
    const result = await pool.query(
      `SELECT
         cm.*,
         p.user_email AS publisher_email,
         (p.created_at AT TIME ZONE 'UTC') AS post_created_at,
         u.username AS publisher_username,
         u.profile_photo_uri AS publisher_profile_photo_uri,
         u.social_networks AS publisher_social_networks,
         aa.verified AS publisher_account_verified,
         aa.keinti_verified AS publisher_keinti_verified,
         COALESCE(donations.total_donated, 0) AS channel_event_donation_total,
         CASE
           WHEN LOWER(COALESCE(p.user_email, '')) = $1 THEN TRUE
           WHEN viewer_sub.post_id IS NOT NULL THEN TRUE
           ELSE FALSE
         END AS viewer_is_subscribed
       FROM channel_messages cm
       JOIN Post_users p
         ON p.id = cm.post_id
       JOIN users u
         ON u.email = p.user_email
       LEFT JOIN account_auth aa
         ON aa.user_email = u.email
       LEFT JOIN (
         SELECT channel_message_id, COALESCE(SUM(donation_amount), 0) AS total_donated
         FROM channel_event_donations
         GROUP BY channel_message_id
       ) donations
         ON donations.channel_message_id = cm.id
       LEFT JOIN channel_subscriptions viewer_sub
         ON viewer_sub.post_id = cm.post_id
        AND LOWER(COALESCE(viewer_sub.viewer_email, '')) = $1
       WHERE cm.hidden = FALSE
         AND cm.sender_email = p.user_email
         AND cm.message LIKE $3
         AND COALESCE(donations.total_donated, 0) >= 1
         AND p.deleted_at IS NULL
         AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
         AND NOT EXISTS (
           SELECT 1
           FROM group_join_requests r
           WHERE r.status = 'blocked'
             AND (
               (LOWER(COALESCE(r.requester_email, '')) = $1 AND LOWER(COALESCE(r.target_email, '')) = LOWER(COALESCE(p.user_email, '')))
               OR (LOWER(COALESCE(r.requester_email, '')) = LOWER(COALESCE(p.user_email, '')) AND LOWER(COALESCE(r.target_email, '')) = $1)
             )
         )${cursorWhere.clause}
       ORDER BY COALESCE(donations.total_donated, 0) DESC, cm.created_at DESC, cm.id DESC
       LIMIT $${limitParamIndex}`,
      queryParams
    );

    const rows = result.rows || [];
    if (rows.length === 0) {
      reachedEnd = true;
      break;
    }

    rows.forEach((row) => {
      if (matchedRows.length >= requestedPageSize) {return;}

      const payload = parsePayload(row?.message);
      if (!payload) {return;}

      const rowCategory = String(getCategory(payload) || '').trim();
      if (category && rowCategory !== category) {return;}

      matchedRows.push(row);
    });

    if (rows.length < chunkSize) {
      reachedEnd = true;
      break;
    }

    scanCursor = buildHypeViralCursorFromRow(rows[rows.length - 1]);
  }

  const pageRows = matchedRows.slice(0, limit);
  const pageHasMore = matchedRows.length > limit;
  const nextCursor = pageHasMore && pageRows.length > 0
    ? buildHypeViralCursorToken(buildHypeViralCursorFromRow(pageRows[pageRows.length - 1]))
    : null;

  return {
    rows: pageRows,
    hasMore: pageHasMore,
    nextCursor,
  };
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

async function resolveChannelReplyNotificationRecipient(client, { postId, publisherEmail, message }) {
  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage.startsWith('@')) {return null;}

  const firstSpaceIndex = trimmedMessage.indexOf(' ');
  if (firstSpaceIndex <= 0) {return null;}

  const targetToken = trimmedMessage.substring(0, firstSpaceIndex).trim().replace(/^@+/, '');
  if (!targetToken) {return null;}

  const result = await client.query(
    `SELECT u.email, u.username
     FROM users u
     JOIN channel_subscriptions cs
       ON cs.viewer_email = u.email
      AND cs.post_id = $1
      AND cs.publisher_email = $2
     WHERE LOWER(COALESCE(u.username, '')) = LOWER($3)
        OR LOWER(u.email) = LOWER($4)
     LIMIT 1`,
    [postId, publisherEmail, targetToken, targetToken]
  );

  const row = result.rows?.[0];
  if (!row?.email) {return null;}

  const viewerEmail = String(row.email).trim();
  if (!viewerEmail || viewerEmail === String(publisherEmail).trim()) {return null;}

  return {
    email: viewerEmail,
    username: String(row.username || '').trim(),
  };
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
     WHERE viewer_email = $1
       AND post_id = $2
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

function attachChannelEventRewards(rows, rewardsByMessageId, postCreatedAt = null) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    channel_event_task_rewards: rewardsByMessageId[String(row?.id)] || [],
    channel_event_donation_total: Math.max(0, Math.floor(Number(row?.channel_event_donation_total) || 0)),
    channel_event_expires_at: (() => {
      const payload = parseChannelEventMessage(row?.message);
      if (!payload || payload.durationMinutes <= 0) {return null;}
      const rowPostCreatedAt = postCreatedAt ?? row?.post_created_at ?? row?.postCreatedAt ?? null;
      return payload.expiresAt || computeChannelEventExpiresAt({
        eventCreatedAt: row?.created_at,
        postCreatedAt: rowPostCreatedAt,
        durationMinutes: payload.durationMinutes,
      });
    })(),
  }));
}

async function getChannelEventDonationTotalsByMessageIds(messageIds) {
  const normalizedMessageIds = Array.from(new Set(
    (Array.isArray(messageIds) ? messageIds : [])
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0)
  ));

  if (normalizedMessageIds.length === 0) {return {};}

  const result = await pool.query(
    `SELECT channel_message_id, COALESCE(SUM(donation_amount), 0) AS total_donated
       FROM channel_event_donations
      WHERE channel_message_id = ANY($1::int[])
      GROUP BY channel_message_id`,
    [normalizedMessageIds]
  );

  return (result.rows || []).reduce((accumulator, row) => {
    const messageId = String(row?.channel_message_id || '').trim();
    if (!messageId) {return accumulator;}
    accumulator[messageId] = Math.max(0, Math.floor(Number(row?.total_donated) || 0));
    return accumulator;
  }, {});
}

router.get('/events/viral', authenticateToken, async (req, res) => {
  const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
  const limit = sanitizeHypeViralLimit(req.query?.limit);
  const category = normalizeHypeViralCategory(req.query?.category);
  const rawCursor = String(req.query?.cursor || '').trim();
  const cursor = rawCursor ? parseHypeViralCursorToken(rawCursor) : null;

  if (rawCursor && !cursor) {
    return res.status(400).json({ error: 'cursor inválido' });
  }

  try {
    await refundExpiredPendingChannelEventTaskRewards().catch(() => []);

    const page = await fetchHypeViralChannelRowsPage({
      requesterEmail,
      messagePrefix: CHANNEL_EVENT_MESSAGE_PREFIX,
      limit,
      category,
      cursor,
      parsePayload: parseChannelEventMessage,
      getCategory: (payload) => payload?.typeKey,
    });

    const messageIds = page.rows.map(row => row.id);
    const rewardsByMessageId = await getChannelEventTaskRewardsByMessageIds(messageIds);

    const events = attachChannelEventRewards(page.rows, rewardsByMessageId);

    return res.json({
      events,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    console.error('Error al obtener eventos virales del canal:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/readings/viral', authenticateToken, async (req, res) => {
  const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
  const limit = sanitizeHypeViralLimit(req.query?.limit);
  const category = normalizeHypeViralCategory(req.query?.category);
  const rawCursor = String(req.query?.cursor || '').trim();
  const cursor = rawCursor ? parseHypeViralCursorToken(rawCursor) : null;

  if (rawCursor && !cursor) {
    return res.status(400).json({ error: 'cursor inválido' });
  }

  try {
    await refundExpiredPendingChannelEventTaskRewards().catch(() => []);

    const page = await fetchHypeViralChannelRowsPage({
      requesterEmail,
      messagePrefix: CHANNEL_READING_MESSAGE_PREFIX,
      limit,
      category,
      cursor,
      parsePayload: parseChannelReadingMessage,
      getCategory: (payload) => payload?.category,
    });

    const messageIds = page.rows.map(row => row.id);
    const rewardsByMessageId = await getChannelEventTaskRewardsByMessageIds(messageIds);

    const readings = attachChannelEventRewards(page.rows, rewardsByMessageId);

    return res.json({
      readings,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    console.error('Error al obtener lecturas virales del canal:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

    // Crear suscripción de forma idempotente para tolerar taps/reintentos duplicados.
    const insertResult = await pool.query(
      `INSERT INTO channel_subscriptions (viewer_email, publisher_email, post_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (viewer_email, post_id) DO NOTHING
       RETURNING *`,
      [viewerEmail, publisherEmail, numericPostId]
    );

    if (insertResult.rows.length > 0) {
      return res.status(201).json({
        message: 'Has entrado al canal',
        joined: true,
        subscription: insertResult.rows[0],
      });
    }

    const existing = await pool.query(
      'SELECT * FROM channel_subscriptions WHERE viewer_email = $1 AND post_id = $2 LIMIT 1',
      [viewerEmail, numericPostId]
    );

    return res.json({
      message: 'Ya estás en este canal',
      joined: false,
      subscription: existing.rows[0] || null,
    });
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
      `DELETE FROM channel_subscriptions
       WHERE viewer_email = $1
         AND post_id = $2`,
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
      WITH latest_active_posts AS (
        SELECT DISTINCT ON (p.user_email)
          p.id AS post_id,
          p.user_email AS publisher_email,
          p.presentation,
          (p.created_at AT TIME ZONE 'UTC') AS post_created_at
        FROM Post_users p
        WHERE p.deleted_at IS NULL
          AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
        ORDER BY p.user_email, p.created_at DESC, p.id DESC
      )
      SELECT
        cs.viewer_email,
        lap.publisher_email,
        cs.created_at,
        lap.post_id,
        u.username, u.profile_photo_uri, u.social_networks,
        aa.verified AS account_verified,
        aa.keinti_verified AS keinti_verified,
        lap.presentation,
        lap.post_created_at,
        (
          SELECT COUNT(DISTINCT sub.viewer_email)::int
          FROM channel_subscriptions sub
          WHERE sub.post_id = lap.post_id
        ) AS subscriber_count
      FROM latest_active_posts lap
      JOIN channel_subscriptions cs
        ON cs.post_id = lap.post_id
       AND cs.viewer_email = $1
      JOIN users u ON lap.publisher_email = u.email
      LEFT JOIN account_auth aa ON aa.user_email = u.email
      WHERE NOT EXISTS (
          SELECT 1
          FROM group_join_requests r
          WHERE r.status = 'blocked'
            AND (
              (r.requester_email = $1 AND r.target_email = lap.publisher_email)
              OR (r.requester_email = lap.publisher_email AND r.target_email = $1)
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

// Progreso acumulativo: cuántos usuarios se han unido a mis chats (suscripciones) en total.
// Cuenta TODAS las suscripciones históricas (sin filtro mensual ni dependencia del post).
router.get('/me/joins-progress', authenticateToken, async (req, res) => {
  const publisherEmail = req.user?.email;
  if (!publisherEmail) return res.status(401).json({ error: 'No autorizado' });

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM channel_subscriptions
       WHERE publisher_email = $1`,
      [publisherEmail]
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
      SELECT subscriber_rows.*
      FROM (
        SELECT DISTINCT ON (LOWER(COALESCE(cs.viewer_email, '')))
          cs.*,
          u.username, u.profile_photo_uri, u.social_networks
        FROM channel_subscriptions cs
        JOIN users u ON cs.viewer_email = u.email
        WHERE cs.post_id = $1
        ORDER BY LOWER(COALESCE(cs.viewer_email, '')), cs.created_at DESC, cs.id DESC
      ) AS subscriber_rows
      ORDER BY subscriber_rows.created_at DESC, subscriber_rows.id DESC
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
    const activePost = await getActivePostInfo(numericPostId);
    const publisherEmail = activePost?.publisherEmail || null;
    const postCreatedAt = activePost?.createdAt ?? null;
    const parsedEventPayload = parseChannelEventMessage(message);
    const parsedRecommendationPayload = parseChannelRingRecommendationMessage(message);
    const parsedRecommendationThreadPayload = parseChannelRingRecommendationThreadMessage(message);
    const hasRewardedTasks = !!parsedEventPayload && (parsedEventPayload.taskRewardAmounts || []).some(amount => Number(amount) > 0);
    
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    if (hasRewardedTasks && senderEmail !== publisherEmail) {
      return res.status(403).json({ error: 'Solo el anfitrión puede reservar llaves para tareas recompensadas' });
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let messageToStore = message;

      if (parsedRecommendationPayload) {
        if (senderEmail !== publisherEmail) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            error: 'Solo el anfitrión puede recomendar aros en este canal',
            code: 'RECOMMENDATION_HOST_ONLY',
          });
        }

        const recommendationSignature = buildChannelRingRecommendationSignature(parsedRecommendationPayload);
        if (!recommendationSignature) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'La recomendación indicada no es válida',
            code: 'INVALID_RECOMMENDATION_MESSAGE',
          });
        }

        const recommendationSignatures = await listChannelRingRecommendationSignatures(client, numericPostId, publisherEmail);
        if (recommendationSignatures.includes(recommendationSignature)) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Este aro ya fue recomendado en este canal',
            code: 'RECOMMENDATION_ALREADY_POSTED',
          });
        }
      }

      if (parsedRecommendationThreadPayload) {
        const recommendationMessageId = Number(parsedRecommendationThreadPayload.recommendationMessageId);
        if (!Number.isFinite(recommendationMessageId) || recommendationMessageId <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'La recomendación indicada no es válida',
            code: 'INVALID_RECOMMENDATION_THREAD_ROOT',
          });
        }

        const recommendationRowResult = await client.query(
          `SELECT id, sender_email, message
           FROM channel_messages
           WHERE id = $1
             AND post_id = $2
           LIMIT 1`,
          [recommendationMessageId, numericPostId]
        );
        const recommendationRow = recommendationRowResult.rows?.[0] || null;

        if (
          !recommendationRow ||
          normalizeEmailKey(recommendationRow.sender_email) !== normalizeEmailKey(publisherEmail) ||
          !parseChannelRingRecommendationMessage(recommendationRow.message)
        ) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'La recomendación indicada no existe en este canal',
            code: 'RECOMMENDATION_THREAD_ROOT_NOT_FOUND',
          });
        }

        const recommendationThreadRowsResult = await client.query(
          `SELECT id, sender_email, message
           FROM channel_messages
           WHERE post_id = $1
             AND message LIKE $2
           ORDER BY id ASC`,
          [numericPostId, `${CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX}%`]
        );

        const threadRows = recommendationThreadRowsResult.rows
          .map((row) => ({
            row,
            payload: parseChannelRingRecommendationThreadMessage(row?.message),
          }))
          .filter((item) => item.payload && item.payload.recommendationMessageId === String(recommendationMessageId));

        if (senderEmail !== publisherEmail) {
          if (parsedRecommendationThreadPayload.entryKind !== 'viewer-root') {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'Solo el anfitrión puede enviar ese tipo de respuesta en la recomendación',
              code: 'RECOMMENDATION_THREAD_KIND_FORBIDDEN',
            });
          }

          const normalizedSenderEmail = normalizeEmailKey(senderEmail);
          const existingViewerReply = threadRows.some((item) => (
            item.payload?.entryKind === 'viewer-root' && (
              normalizeEmailKey(item.payload?.viewerEmail || item.row?.sender_email) === normalizedSenderEmail
            )
          ));

          if (existingViewerReply) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'Ya respondiste a esta recomendación',
              code: 'RECOMMENDATION_ALREADY_REPLIED',
            });
          }

          const viewerRow = await client.query(
            'SELECT username FROM users WHERE email = $1',
            [senderEmail]
          );

          const viewerUsername = normalizeRecommendationThreadUsername(
            viewerRow.rows?.[0]?.username ?? parsedRecommendationThreadPayload.viewerUsername
          );

          messageToStore = encodeChannelRingRecommendationThreadMessage({
            recommendationMessageId: String(recommendationMessageId),
            entryKind: 'viewer-root',
            text: parsedRecommendationThreadPayload.text,
            viewerEmail: normalizedSenderEmail,
            viewerUsername,
          });
        } else {
          if (parsedRecommendationThreadPayload.entryKind === 'viewer-root') {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'El anfitrión no puede usar ese tipo de respuesta en la recomendación',
              code: 'RECOMMENDATION_THREAD_KIND_FORBIDDEN',
            });
          }

          if (parsedRecommendationThreadPayload.entryKind === 'host-global') {
            messageToStore = encodeChannelRingRecommendationThreadMessage({
              recommendationMessageId: String(recommendationMessageId),
              entryKind: 'host-global',
              text: parsedRecommendationThreadPayload.text,
            });
          } else {
            const targetViewerEmail = normalizeEmailKey(parsedRecommendationThreadPayload.viewerEmail);
            const targetViewerUsername = normalizeRecommendationThreadUsername(parsedRecommendationThreadPayload.viewerUsername);
            const targetViewerReply = threadRows.find((item) => {
              if (item.payload?.entryKind !== 'viewer-root') {return false;}

              const itemViewerEmail = normalizeEmailKey(item.payload?.viewerEmail || item.row?.sender_email);
              const itemViewerUsername = normalizeRecommendationThreadUsername(item.payload?.viewerUsername);

              if (targetViewerEmail && itemViewerEmail === targetViewerEmail) {
                return true;
              }

              return !!targetViewerUsername && itemViewerUsername === targetViewerUsername;
            });

            if (!targetViewerReply) {
              await client.query('ROLLBACK');
              return res.status(404).json({
                error: 'No existe una respuesta de ese usuario para esta recomendación',
                code: 'RECOMMENDATION_THREAD_TARGET_NOT_FOUND',
              });
            }

            messageToStore = encodeChannelRingRecommendationThreadMessage({
              recommendationMessageId: String(recommendationMessageId),
              entryKind: 'host-direct',
              text: parsedRecommendationThreadPayload.text,
              viewerEmail: normalizeEmailKey(targetViewerReply.payload?.viewerEmail || targetViewerReply.row?.sender_email),
              viewerUsername: normalizeRecommendationThreadUsername(targetViewerReply.payload?.viewerUsername),
            });
          }
        }
      }

      if (!parsedRecommendationThreadPayload && senderEmail !== publisherEmail) {
        const viewerRow = await client.query(
          'SELECT username FROM users WHERE email = $1',
          [senderEmail]
        );

        const rawUsername = String(viewerRow.rows?.[0]?.username ?? '').trim();
        const atUsername = rawUsername
          ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`)
          : '';
        const atEmail = `@${String(senderEmail || '').trim()}`;

        const lastViewerMsg = await client.query(
          `SELECT id
           FROM channel_messages
           WHERE post_id = $1
             AND sender_email = $2
             AND message NOT LIKE $3
           ORDER BY id DESC
           LIMIT 1`,
          [postId, senderEmail, `${CHANNEL_RING_RECOMMENDATION_THREAD_MESSAGE_PREFIX}%`]
        );

        if (lastViewerMsg.rows.length > 0) {
          const lastViewerMsgId = Number(lastViewerMsg.rows[0].id);
          const patterns = [];
          if (atUsername) patterns.push(`${atUsername} %`);
          patterns.push(`${atEmail} %`);

          const replyCheck = await client.query(
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
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'Debes esperar una respuesta del creador para poder enviar otro mensaje',
              code: 'WAIT_FOR_PUBLISHER_REPLY'
            });
          }
        }
      }

      const result = await client.query(
        'INSERT INTO channel_messages (post_id, sender_email, message) VALUES ($1, $2, $3) RETURNING *',
        [numericPostId, senderEmail, messageToStore]
      );

      let insertedMessage = result.rows[0];
      let storedMessage = messageToStore;
      let hostWhiteKeysBalance = null;
      let channelEventTaskRewards = [];

      if (insertedMessage && senderEmail === publisherEmail && !parsedRecommendationThreadPayload) {
        const computedExpiresAt = parsedEventPayload?.expiresAt || computeChannelEventExpiresAt({
          eventCreatedAt: insertedMessage.created_at,
          postCreatedAt,
          durationMinutes: parsedEventPayload?.durationMinutes,
        });

        if (computedExpiresAt) {
          const messageWithExpiresAt = injectChannelEventExpiresAt(storedMessage, computedExpiresAt);
          if (messageWithExpiresAt !== storedMessage) {
            const updatedMessageResult = await client.query(
              'UPDATE channel_messages SET message = $1 WHERE id = $2 RETURNING *',
              [messageWithExpiresAt, insertedMessage.id]
            );
            insertedMessage = updatedMessageResult.rows?.[0] || { ...insertedMessage, message: messageWithExpiresAt };
            storedMessage = messageWithExpiresAt;
          }
        }

        const rewardReservation = await createChannelEventTaskRewardRecords(client, {
          channelMessageId: insertedMessage.id,
          postId: numericPostId,
          hostEmail: senderEmail,
          createdAt: insertedMessage.created_at,
          rawMessage: storedMessage,
        });

        if (typeof rewardReservation?.hostWhiteKeysBalance === 'number') {
          hostWhiteKeysBalance = rewardReservation.hostWhiteKeysBalance;
        }
        channelEventTaskRewards = Array.isArray(rewardReservation?.rewards) ? rewardReservation.rewards : [];

        const replyNotificationRecipient = await resolveChannelReplyNotificationRecipient(client, {
          postId: numericPostId,
          publisherEmail,
          message: storedMessage,
        });

        if (replyNotificationRecipient?.email) {
          await client.query(
            `INSERT INTO channel_reply_notifications (
               post_id,
               channel_message_id,
               publisher_email,
               viewer_email,
               created_at
             )
             VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP))
             ON CONFLICT (channel_message_id) DO NOTHING`,
            [
              numericPostId,
              insertedMessage.id,
              senderEmail,
              replyNotificationRecipient.email,
              insertedMessage.created_at || null,
            ]
          );
        }
      }

      const responseEventExpiresAt = parsedEventPayload
        ? (parseChannelEventMessage(insertedMessage?.message)?.expiresAt || parsedEventPayload.expiresAt || computeChannelEventExpiresAt({
          eventCreatedAt: insertedMessage?.created_at,
          postCreatedAt,
          durationMinutes: parsedEventPayload.durationMinutes,
        }))
        : null;

      await client.query('COMMIT');
      res.status(201).json({
        ...insertedMessage,
        channel_event_task_rewards: channelEventTaskRewards,
        channel_event_expires_at: responseEventExpiresAt,
        host_white_keys_balance: hostWhiteKeysBalance,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Error interno del servidor', code: error?.code });
  }
});

router.get('/messages/:postId/recommendation-signatures', authenticateToken, async (req, res) => {
  const numericPostId = Number(req.params.postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const activePost = await getActivePostInfo(numericPostId);
    const publisherEmail = activePost?.publisherEmail || null;
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    try {
      await ensureChannelAccessOrThrow({ userEmail: req.user.email, postId: numericPostId, publisherEmail });
    } catch (e) {
      const status = e?.statusCode || 403;
      return res.status(status).json({ error: e?.message || 'No autorizado', code: e?.code });
    }

    const recommendationSignatures = await listChannelRingRecommendationSignatures(pool, numericPostId, publisherEmail);
    return res.json({ recommendationSignatures });
  } catch (error) {
    console.error('Error listing channel ring recommendation signatures:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/source-publications/:sourcePostId/recommendation-counts', authenticateToken, async (req, res) => {
  const numericSourcePostId = Number(req.params.sourcePostId);
  if (!Number.isFinite(numericSourcePostId)) {
    return res.status(400).json({ error: 'sourcePostId inválido' });
  }

  try {
    const activeSourcePost = await getActivePostInfo(numericSourcePostId);
    if (!activeSourcePost?.publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    const recommendationCounts = await listSourcePublicationRingRecommendationCounts(pool, numericSourcePostId);
    return res.json({ recommendationCounts });
  } catch (error) {
    console.error('Error listing source publication ring recommendation counts:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener mensajes del canal general
router.get('/messages/:postId', authenticateToken, async (req, res) => {
  const { postId } = req.params;
  const requesterEmail = req.user.email;
  const hasPaginationParams = (req.query?.limit !== undefined) || (req.query?.beforeId !== undefined);

  const parsedLimit = Number(req.query?.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(parsedLimit)))
    : 40;

  const parsedBeforeId = Number(req.query?.beforeId);
  const beforeId = Number.isFinite(parsedBeforeId) ? Math.trunc(parsedBeforeId) : null;

  const numericPostId = Number(postId);
  if (!Number.isFinite(numericPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const activePost = await getActivePostInfo(numericPostId);
    const publisherEmail = activePost?.publisherEmail || null;
    const postCreatedAt = activePost?.createdAt ?? null;
    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    await refundExpiredPendingChannelEventTaskRewards({ postIds: [numericPostId] }).catch(() => []);

    try {
      await ensureChannelAccessOrThrow({ userEmail: requesterEmail, postId: numericPostId, publisherEmail });
    } catch (e) {
      const status = e?.statusCode || 403;
      return res.status(status).json({ error: e?.message || 'No autorizado', code: e?.code });
    }

    // El publicador ve todos los mensajes (incluidos los ocultos, con su flag).
    // Los demás usuarios solo ven los mensajes no ocultos.
    const isPublisher = requesterEmail === publisherEmail;

    if (!hasPaginationParams) {
      const result = await pool.query(
        `SELECT cm.*, u.username 
         FROM channel_messages cm
         JOIN users u ON cm.sender_email = u.email
         WHERE cm.post_id = $1
           ${isPublisher ? '' : 'AND cm.hidden = FALSE'}
         ORDER BY cm.id ASC`,
        [numericPostId]
      );
      const messageIds = (result.rows || []).map(row => row.id);
      const rewardsByMessageId = await getChannelEventTaskRewardsByMessageIds(messageIds);
      const donationTotalsByMessageId = await getChannelEventDonationTotalsByMessageIds(messageIds);
      res.json(attachChannelEventRewards(
        (result.rows || []).map(row => ({
          ...row,
          channel_event_donation_total: donationTotalsByMessageId[String(row?.id)] || 0,
        })),
        rewardsByMessageId,
        postCreatedAt,
      ));
      return;
    }

    const whereBeforeClause = beforeId ? 'AND cm.id < $2' : '';
    const queryParams = beforeId
      ? [numericPostId, beforeId, limit + 1]
      : [numericPostId, limit + 1];

    const result = await pool.query(
      `SELECT page.*, u.username
       FROM (
         SELECT cm.*
         FROM channel_messages cm
         WHERE cm.post_id = $1
           ${isPublisher ? '' : 'AND cm.hidden = FALSE'}
           ${whereBeforeClause}
         ORDER BY cm.id DESC
         LIMIT $${beforeId ? 3 : 2}
       ) AS page
       JOIN users u ON page.sender_email = u.email
       ORDER BY page.id DESC`,
      queryParams
    );

    const rowsDesc = result.rows || [];
    const hasMore = rowsDesc.length > limit;
    const pageRowsAsc = rowsDesc.slice(0, limit).reverse();
    const pageMessageIds = pageRowsAsc.map(row => row.id);
    const rewardsByMessageId = await getChannelEventTaskRewardsByMessageIds(pageMessageIds);
    const donationTotalsByMessageId = await getChannelEventDonationTotalsByMessageIds(pageMessageIds);

    res.json({
      messages: attachChannelEventRewards(
        pageRowsAsc.map(row => ({
          ...row,
          channel_event_donation_total: donationTotalsByMessageId[String(row?.id)] || 0,
        })),
        rewardsByMessageId,
        postCreatedAt,
      ),
      hasMore,
    });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/messages/:messageId/tasks/:taskIndex/complete', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const numericMessageId = Number(req.params.messageId);
  const numericTaskIndex = Number(req.params.taskIndex);

  if (!Number.isFinite(numericMessageId) || !Number.isFinite(numericTaskIndex)) {
    return res.status(400).json({ error: 'Identificador de mensaje o tarea inválido' });
  }

  try {
    const result = await completeChannelEventTaskReward({
      messageId: numericMessageId,
      taskIndex: numericTaskIndex,
      requesterEmail,
    });

    if (!result?.reward) {
      return res.status(404).json({ error: 'Recompensa de tarea no encontrada' });
    }

    return res.json({
      ok: result.outcome === 'completed',
      outcome: result.outcome,
      reward: result.reward,
    });
  } catch (error) {
    console.error('Error al completar la recompensa de la tarea:', error);
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error?.message || 'Error interno del servidor' });
  }
});

router.post('/messages/:messageId/donate', authenticateToken, async (req, res) => {
  const requesterEmail = String(req.user.email || '').trim().toLowerCase();
  const numericMessageId = Number(req.params.messageId);

  if (!Number.isFinite(numericMessageId)) {
    return res.status(400).json({ error: 'Identificador de mensaje inválido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const messageResult = await client.query(
      `SELECT id, post_id, message
         FROM channel_messages
        WHERE id = $1
        LIMIT 1`,
      [numericMessageId]
    );

    if (messageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const messageRow = messageResult.rows[0];
    const numericPostId = Number(messageRow.post_id);
    const activePost = await getActivePostInfo(numericPostId);
    const publisherEmail = String(activePost?.publisherEmail || '').trim().toLowerCase();

    await ensureChannelAccessOrThrow({ userEmail: requesterEmail, postId: numericPostId, publisherEmail });

    if (!publisherEmail) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    if (requesterEmail === publisherEmail) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'El anfitrión no puede donar a su propio contenido', code: 'HOST_CANNOT_DONATE' });
    }

    const parsedEventPayload = parseChannelEventMessage(messageRow.message);
    const parsedReadingPayload = parseChannelReadingDonationPayload(messageRow.message);
    const donationAmount = Math.max(0, Math.floor(Number(parsedEventPayload?.hypeCost ?? parsedReadingPayload?.hypeCost) || 0));

    if ((!parsedEventPayload && !parsedReadingPayload) || donationAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta interacción no admite donaciones', code: 'MESSAGE_DONATION_NOT_AVAILABLE' });
    }

    const donorResult = await client.query(
      `SELECT email, white_keys_balance
         FROM users
        WHERE lower(email) = $1
        LIMIT 1
        FOR UPDATE`,
      [requesterEmail]
    );

    const hostResult = await client.query(
      `SELECT email, white_keys_balance
         FROM users
        WHERE lower(email) = $1
        LIMIT 1
        FOR UPDATE`,
      [publisherEmail]
    );

    if (donorResult.rows.length === 0 || hostResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const donorWhiteKeysBalance = Math.max(0, Math.floor(Number(donorResult.rows[0].white_keys_balance) || 0));
    const hostWhiteKeysBalance = Math.max(0, Math.floor(Number(hostResult.rows[0].white_keys_balance) || 0));

    if (donorWhiteKeysBalance < donationAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'No tienes suficientes llaves para donar',
        code: 'INSUFFICIENT_WHITE_KEYS_FOR_DONATION',
      });
    }

    const nextDonorBalance = donorWhiteKeysBalance - donationAmount;

    await client.query(
      `UPDATE users
          SET white_keys_balance = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE lower(email) = $2`,
      [nextDonorBalance, requesterEmail]
    );

    const donationInsertResult = await client.query(
      `INSERT INTO channel_event_donations (
         channel_message_id,
         post_id,
         donor_email,
         host_email,
         donation_amount
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [numericMessageId, numericPostId, requesterEmail, publisherEmail, donationAmount]
    );

    const donationTotalResult = await client.query(
      `SELECT COALESCE(SUM(donation_amount), 0) AS total_donated
         FROM channel_event_donations
        WHERE channel_message_id = $1`,
      [numericMessageId]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      donationAmount,
      donationId: Number(donationInsertResult.rows?.[0]?.id || 0) || null,
      channelEventDonationTotal: Math.max(0, Math.floor(Number(donationTotalResult.rows?.[0]?.total_donated) || 0)),
      donorWhiteKeysBalance: nextDonorBalance,
      hostWhiteKeysBalance,
      messageId: numericMessageId,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al donar llaves del evento del canal:', error);
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error?.message || 'Error interno del servidor', code: error?.code });
  } finally {
    client.release();
  }
});

// Alternar visibilidad de un mensaje del canal (solo el anfitrión)
router.patch('/messages/:messageId/visibility', authenticateToken, async (req, res) => {
  const { messageId } = req.params;
  const requesterEmail = req.user.email;

  const numericMessageId = Number(messageId);
  if (!Number.isFinite(numericMessageId)) {
    return res.status(400).json({ error: 'messageId inválido' });
  }

  try {
    // Obtener el mensaje y verificar que el solicitante es el anfitrión del canal
    const msgResult = await pool.query(
      `SELECT cm.id, cm.post_id, cm.hidden
       FROM channel_messages cm
       WHERE cm.id = $1
       LIMIT 1`,
      [numericMessageId]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const message = msgResult.rows[0];
    const publisherEmail = await getActivePostPublisherEmail(message.post_id);

    if (!publisherEmail) {
      return res.status(410).json({ error: 'Publicación no encontrada o expirada' });
    }

    if (requesterEmail !== publisherEmail) {
      return res.status(403).json({ error: 'Solo el anfitrión puede ocultar o mostrar mensajes' });
    }

    // Alternar: si estaba oculto lo hacemos visible, y viceversa
    const newHidden = !message.hidden;

    await pool.query(
      'UPDATE channel_messages SET hidden = $1 WHERE id = $2',
      [newHidden, numericMessageId]
    );

    res.json({ ok: true, messageId: numericMessageId, hidden: newHidden });
  } catch (error) {
    console.error('Error al alternar visibilidad del mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
