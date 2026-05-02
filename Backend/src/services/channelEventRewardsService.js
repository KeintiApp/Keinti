const pool = require('../config/database');
const { getPostTtlMinutes } = require('../config/postTtl');

const CHANNEL_EVENT_MESSAGE_PREFIX = '__KEVT__';
const POST_TTL_MS = getPostTtlMinutes() * 60 * 1000;

const CHANNEL_EVENT_TASK_REWARD_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
};

function sanitizePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {return 0;}
  return Math.max(0, Math.floor(numeric));
}

function normalizeTaskUsername(value) {
  const raw = String(value || '').trim();
  if (!raw) {return '';}
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function normalizeIsoTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) {return null;}

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {return null;}

  return parsed.toISOString();
}

function parseStoredTimestamp(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {return null;}
    return new Date(Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    ));
  }

  const raw = String(value || '').trim();
  if (!raw) {return null;}

  if (/[zZ]|[+\-]\d{2}(?::?\d{2})$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const normalized = raw.replace(' ', 'T');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.(\d{1,6}))?)?$/);
  if (!match) {
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const fractional = String(match[8] || '');
  const milliseconds = fractional ? Number((fractional + '000').slice(0, 3)) : 0;
  const parsedMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || '0'),
    milliseconds,
  );
  return Number.isFinite(parsedMs) ? new Date(parsedMs) : null;
}

function computeChannelEventExpiresAt({ eventCreatedAt, postCreatedAt, durationMinutes }) {
  const safeDurationMinutes = sanitizePositiveInteger(durationMinutes);
  if (safeDurationMinutes <= 0) {return null;}

  const eventCreatedAtMs = new Date(eventCreatedAt).getTime();
  if (!Number.isFinite(eventCreatedAtMs)) {return null;}

  let expiresAtMs = eventCreatedAtMs + (safeDurationMinutes * 60 * 1000);
  const postCreatedAtMs = new Date(postCreatedAt).getTime();
  if (Number.isFinite(postCreatedAtMs)) {
    const channelExpiresAtMs = postCreatedAtMs + POST_TTL_MS;
    if (channelExpiresAtMs > eventCreatedAtMs) {
      const channelRemainingMinutes = Math.max(1, Math.floor((channelExpiresAtMs - eventCreatedAtMs) / (60 * 1000)));
      if (safeDurationMinutes >= channelRemainingMinutes) {
        expiresAtMs = channelExpiresAtMs;
      } else {
        expiresAtMs = Math.min(expiresAtMs, channelExpiresAtMs);
      }
    }
  }

  if (!Number.isFinite(expiresAtMs)) {return null;}
  return new Date(expiresAtMs).toISOString();
}

function parseChannelEventMessage(rawMessage) {
  const text = String(rawMessage || '');
  if (!text.startsWith(CHANNEL_EVENT_MESSAGE_PREFIX)) {return null;}

  try {
    const parsed = JSON.parse(text.slice(CHANNEL_EVENT_MESSAGE_PREFIX.length));
    const typeKey = typeof parsed?.typeKey === 'string' ? parsed.typeKey.trim() : '';
    const taskDescriptions = Array.isArray(parsed?.taskDescriptions)
      ? parsed.taskDescriptions.map(item => String(item || '').trim()).filter(Boolean)
      : [];

    const taskAssignments = Array.isArray(parsed?.taskAssignments)
      ? parsed.taskAssignments.map(taskAssignmentList => (
        Array.isArray(taskAssignmentList)
          ? taskAssignmentList
            .map(item => ({
              username: normalizeTaskUsername(item?.username),
              memberEmail: typeof item?.memberEmail === 'string' ? item.memberEmail.trim().toLowerCase() : '',
            }))
            .filter(item => item.username)
          : []
      ))
      : [];

    const taskRewardAmounts = Array.isArray(parsed?.taskRewardAmounts)
      ? parsed.taskRewardAmounts.map(item => sanitizePositiveInteger(item))
      : [];
    const hypeCost = sanitizePositiveInteger(parsed?.hypeCost);

    return {
      typeKey,
      tasksEnabled: parsed?.tasksEnabled === true || taskDescriptions.length > 0,
      durationMinutes: sanitizePositiveInteger(parsed?.durationMinutes),
      expiresAt: normalizeIsoTimestamp(parsed?.expiresAt),
      hypeCost,
      taskDescriptions,
      taskAssignments,
      taskRewardAmounts,
    };
  } catch {
    return null;
  }
}

function injectChannelEventExpiresAt(rawMessage, expiresAt) {
  const normalizedExpiresAt = normalizeIsoTimestamp(expiresAt);
  const text = String(rawMessage || '');
  if (!normalizedExpiresAt || !text.startsWith(CHANNEL_EVENT_MESSAGE_PREFIX)) {
    return text;
  }

  try {
    const parsed = JSON.parse(text.slice(CHANNEL_EVENT_MESSAGE_PREFIX.length));
    if (normalizeIsoTimestamp(parsed?.expiresAt) === normalizedExpiresAt) {
      return text;
    }

    parsed.expiresAt = normalizedExpiresAt;
    return `${CHANNEL_EVENT_MESSAGE_PREFIX}${JSON.stringify(parsed)}`;
  } catch {
    return text;
  }
}

function serializeRewardRow(row) {
  return {
    id: Number(row?.id),
    taskIndex: sanitizePositiveInteger(row?.task_index),
    rewardAmount: sanitizePositiveInteger(row?.reward_amount),
    status: String(row?.status || CHANNEL_EVENT_TASK_REWARD_STATUS.PENDING),
    assigneeEmail: String(row?.assignee_email || '').trim().toLowerCase(),
    assigneeUsername: normalizeTaskUsername(row?.assignee_username),
    hostEmail: String(row?.host_email || '').trim().toLowerCase(),
    expiresAt: parseStoredTimestamp(row?.expires_at)?.toISOString() || null,
    completedAt: parseStoredTimestamp(row?.completed_at)?.toISOString() || null,
    refundedAt: parseStoredTimestamp(row?.refunded_at)?.toISOString() || null,
  };
}

function mapRewardsByMessageId(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
    const messageId = String(row?.channel_message_id || '').trim();
    if (!messageId) {return accumulator;}
    if (!accumulator[messageId]) {accumulator[messageId] = [];}
    accumulator[messageId].push(serializeRewardRow(row));
    accumulator[messageId].sort((left, right) => left.taskIndex - right.taskIndex);
    return accumulator;
  }, {});
}

async function refundLockedRows(client, lockedRows) {
  const rows = Array.isArray(lockedRows) ? lockedRows : [];
  if (rows.length === 0) {return [];} 

  const refundTotalsByHost = rows.reduce((accumulator, row) => {
    const hostEmail = String(row?.host_email || '').trim().toLowerCase();
    if (!hostEmail) {return accumulator;}
    accumulator.set(hostEmail, (accumulator.get(hostEmail) || 0) + sanitizePositiveInteger(row?.reward_amount));
    return accumulator;
  }, new Map());

  for (const [hostEmail, amount] of refundTotalsByHost.entries()) {
    await client.query(
      `UPDATE users
          SET white_keys_balance = COALESCE(white_keys_balance, 0) + $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE lower(email) = $2`,
      [amount, hostEmail]
    );
  }

  const rewardIds = rows.map(row => Number(row.id)).filter(id => Number.isFinite(id) && id > 0);
  let updatedRows = rows;
  if (rewardIds.length > 0) {
    const updateResult = await client.query(
      `UPDATE channel_event_task_rewards
          SET status = $1,
              refunded_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::int[])
        RETURNING *`,
      [CHANNEL_EVENT_TASK_REWARD_STATUS.REFUNDED, rewardIds]
    );
    if (Array.isArray(updateResult.rows) && updateResult.rows.length > 0) {
      updatedRows = updateResult.rows;
    }
  }

  return updatedRows.map(serializeRewardRow);
}

async function withManagedTransaction(existingClient, work) {
  if (existingClient) {
    return work(existingClient);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createChannelEventTaskRewardRecords(client, {
  channelMessageId,
  postId,
  hostEmail,
  createdAt,
  rawMessage,
}) {
  const payload = parseChannelEventMessage(rawMessage);
  if (!payload?.tasksEnabled || payload.durationMinutes <= 0) {
    return { totalReserved: 0, rewards: [] };
  }

  const computedExpiresAt = payload.expiresAt || computeChannelEventExpiresAt({
    eventCreatedAt: createdAt,
    durationMinutes: payload.durationMinutes,
  });
  const expiresAt = new Date(String(computedExpiresAt || ''));
  if (!Number.isFinite(expiresAt.getTime())) {
    return { totalReserved: 0, rewards: [] };
  }

  const rewardEntries = payload.taskDescriptions.reduce((accumulator, _taskDescription, taskIndex) => {
    const rewardAmount = sanitizePositiveInteger(payload.taskRewardAmounts?.[taskIndex]);
    if (rewardAmount <= 0) {return accumulator;}

    const assignee = Array.isArray(payload.taskAssignments?.[taskIndex])
      ? payload.taskAssignments[taskIndex].find(item => String(item?.memberEmail || '').trim())
      : null;

    if (!assignee?.memberEmail) {
      const error = new Error('Rewarded tasks require an assigned channel member');
      error.statusCode = 400;
      throw error;
    }

    accumulator.push({
      taskIndex,
      rewardAmount,
      assigneeEmail: String(assignee.memberEmail || '').trim().toLowerCase(),
      assigneeUsername: normalizeTaskUsername(assignee.username),
    });
    return accumulator;
  }, []);

  if (rewardEntries.length === 0) {
    return { totalReserved: 0, rewards: [] };
  }

  const totalReserved = rewardEntries.reduce((total, item) => total + item.rewardAmount, 0);

  const hostResult = await client.query(
    `SELECT email, white_keys_balance
       FROM users
      WHERE lower(email) = $1
      LIMIT 1
      FOR UPDATE`,
    [String(hostEmail || '').trim().toLowerCase()]
  );

  if (hostResult.rows.length === 0) {
    const error = new Error('Host user not found');
    error.statusCode = 404;
    throw error;
  }

  const currentHostBalance = sanitizePositiveInteger(hostResult.rows[0].white_keys_balance);
  if (currentHostBalance < totalReserved) {
    const error = new Error('Not enough white keys to reserve task rewards');
    error.statusCode = 400;
    error.code = 'INSUFFICIENT_WHITE_KEYS';
    throw error;
  }

  await client.query(
    `UPDATE users
        SET white_keys_balance = $1,
            updated_at = CURRENT_TIMESTAMP
      WHERE lower(email) = $2`,
    [currentHostBalance - totalReserved, String(hostEmail || '').trim().toLowerCase()]
  );

  const insertedRewards = [];
  for (const entry of rewardEntries) {
    const insertResult = await client.query(
      `INSERT INTO channel_event_task_rewards (
         channel_message_id,
         post_id,
         task_index,
         host_email,
         assignee_email,
         assignee_username,
         reward_amount,
         status,
         expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        channelMessageId,
        postId,
        entry.taskIndex,
        String(hostEmail || '').trim().toLowerCase(),
        entry.assigneeEmail,
        entry.assigneeUsername,
        entry.rewardAmount,
        CHANNEL_EVENT_TASK_REWARD_STATUS.PENDING,
        expiresAt.toISOString(),
      ]
    );
    if (insertResult.rows[0]) {
      insertedRewards.push(serializeRewardRow(insertResult.rows[0]));
    }
  }

  return {
    totalReserved,
    rewards: insertedRewards,
    hostWhiteKeysBalance: currentHostBalance - totalReserved,
  };
}

async function getChannelEventTaskRewardsByMessageIds(messageIds, existingClient = null) {
  const ids = Array.isArray(messageIds)
    ? messageIds.map(Number).filter(id => Number.isFinite(id) && id > 0)
    : [];
  if (ids.length === 0) {return {};}

  return withManagedTransaction(existingClient, async (client) => {
    const result = await client.query(
      `SELECT *
         FROM channel_event_task_rewards
        WHERE channel_message_id = ANY($1::int[])
        ORDER BY channel_message_id ASC, task_index ASC, id ASC`,
      [ids]
    );
    return mapRewardsByMessageId(result.rows || []);
  });
}

async function refundExpiredPendingChannelEventTaskRewards(options = {}, existingClient = null) {
  const { postIds, includeAllPending = false } = options || {};
  const filteredPostIds = Array.isArray(postIds)
    ? postIds.map(Number).filter(id => Number.isFinite(id) && id > 0)
    : [];

  return withManagedTransaction(existingClient, async (client) => {
    const conditions = ['status = $1'];
    const params = [CHANNEL_EVENT_TASK_REWARD_STATUS.PENDING];

    if (!includeAllPending) {
      params.push(new Date().toISOString());
      conditions.push(`expires_at <= $${params.length}`);
    }

    if (filteredPostIds.length > 0) {
      params.push(filteredPostIds);
      conditions.push(`post_id = ANY($${params.length}::int[])`);
    }

    const result = await client.query(
      `SELECT *
         FROM channel_event_task_rewards
        WHERE ${conditions.join(' AND ')}
        FOR UPDATE SKIP LOCKED`,
      params
    );

    return refundLockedRows(client, result.rows || []);
  });
}

async function completeChannelEventTaskReward({ messageId, taskIndex, requesterEmail }, existingClient = null) {
  return withManagedTransaction(existingClient, async (client) => {
    const normalizedRequesterEmail = String(requesterEmail || '').trim().toLowerCase();
    const rewardResult = await client.query(
      `SELECT *
         FROM channel_event_task_rewards
        WHERE channel_message_id = $1
          AND task_index = $2
        LIMIT 1
        FOR UPDATE`,
      [Number(messageId), Number(taskIndex)]
    );

    if (rewardResult.rows.length === 0) {
      return { reward: null, outcome: 'not-found' };
    }

    const rewardRow = rewardResult.rows[0];

    if (String(rewardRow.host_email || '').trim().toLowerCase() !== normalizedRequesterEmail) {
      const error = new Error('Only the host can complete rewarded tasks');
      error.statusCode = 403;
      throw error;
    }

    if (String(rewardRow.status) === CHANNEL_EVENT_TASK_REWARD_STATUS.COMPLETED) {
      return { reward: serializeRewardRow(rewardRow), outcome: 'already-completed' };
    }

    if (String(rewardRow.status) === CHANNEL_EVENT_TASK_REWARD_STATUS.REFUNDED) {
      return { reward: serializeRewardRow(rewardRow), outcome: 'already-refunded' };
    }

    const expiresAtMs = parseStoredTimestamp(rewardRow.expires_at)?.getTime() ?? NaN;
    if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
      const refunded = await refundLockedRows(client, [rewardRow]);
      return { reward: refunded[0] || serializeRewardRow(rewardRow), outcome: 'expired-refunded' };
    }

    await client.query(
      `UPDATE users
          SET white_keys_balance = COALESCE(white_keys_balance, 0) + $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE lower(email) = $2`,
      [sanitizePositiveInteger(rewardRow.reward_amount), String(rewardRow.assignee_email || '').trim().toLowerCase()]
    );

    const updateResult = await client.query(
      `UPDATE channel_event_task_rewards
          SET status = $1,
              completed_at = CURRENT_TIMESTAMP,
              completed_by_email = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *`,
      [CHANNEL_EVENT_TASK_REWARD_STATUS.COMPLETED, normalizedRequesterEmail, Number(rewardRow.id)]
    );

    return {
      reward: serializeRewardRow(updateResult.rows[0] || rewardRow),
      outcome: 'completed',
    };
  });
}

module.exports = {
  CHANNEL_EVENT_TASK_REWARD_STATUS,
  parseChannelEventMessage,
  computeChannelEventExpiresAt,
  injectChannelEventExpiresAt,
  createChannelEventTaskRewardRecords,
  getChannelEventTaskRewardsByMessageIds,
  refundExpiredPendingChannelEventTaskRewards,
  completeChannelEventTaskReward,
};