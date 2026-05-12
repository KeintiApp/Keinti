const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const { buildObjectPath, uploadBuffer, deleteObject, isSupabaseConfigured: isSupabaseStorageConfigured } = require('../services/supabaseStorageService');
const {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  isSupabaseConfigured: isSupabaseAdminConfigured,
  isSupabaseAuthConfigured,
} = require('../config/supabase');

const router = express.Router();

const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

function isStrongPassword(pass) {
  const value = String(pass || '');
  if (value.length < 10) return false;
  if (value.length > 20) return false;
  const lowercaseRegex = /[a-z]/;
  const uppercaseRegex = /[A-Z]/;
  const numberRegex = /\d/;
  const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;
  return lowercaseRegex.test(value) && uppercaseRegex.test(value) && numberRegex.test(value) && specialCharRegex.test(value);
}

function getSupabasePasswordUpdateFailure(updateError) {
  const code = String(updateError?.code || '').trim().toLowerCase();
  const message = String(updateError?.message || '').trim().toLowerCase();

  if (code === 'weak_password' || Number(updateError?.status) === 422) {
    return {
      status: 400,
      body: { error: 'Contraseña inválida', code: 'INVALID_PASSWORD' },
    };
  }

  if (code === 'user_not_found' || (message.includes('user') && message.includes('not found'))) {
    return {
      status: 500,
      body: {
        error: 'No se pudo localizar la cuenta principal para actualizar la contraseña.',
        code: 'SUPABASE_USER_NOT_FOUND',
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'No se pudo actualizar la contraseña principal.',
      code: 'SUPABASE_PASSWORD_UPDATE_FAILED',
    },
  };
}

async function findSupabaseUserIdByEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  if (!isSupabaseAdminConfigured()) return null;

  const admin = getSupabaseAdminClient();
  const perPage = 200;
  const maxPages = Math.max(1, Number(process.env.SUPABASE_ADMIN_MAX_USER_PAGES || 20));

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = Array.isArray(data?.users) ? data.users : [];
    for (const u of users) {
      if (normalizeEmail(u?.email) === e) {
        return u?.id ? String(u.id) : null;
      }
    }
    if (users.length < perPage) break;
  }
  return null;
}

async function resolveCanonicalSupabaseUserId(email, currentSupabaseUserId = null) {
  const resolvedSupabaseUserId = await findSupabaseUserIdByEmail(email);
  const fallbackSupabaseUserId = currentSupabaseUserId ? String(currentSupabaseUserId) : null;
  const canonicalSupabaseUserId = resolvedSupabaseUserId || fallbackSupabaseUserId;

  if (canonicalSupabaseUserId && canonicalSupabaseUserId !== fallbackSupabaseUserId) {
    await pool
      .query('UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)', [email, canonicalSupabaseUserId])
      .catch(() => {});
  }

  return canonicalSupabaseUserId;
}

// Configurar multer para subida de imágenes
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
  // 32 bytes => 64 hex chars
  return crypto.randomBytes(32).toString('hex');
}

const HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS = 20;
const HOME_INTIMIDADES_DAILY_GOAL_REWARD_STEP = 2;
const HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS = 20;
const CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS = 50;
const CHANNEL_HOST_IMAGE_GOAL_REWARD_STEP = 10;
const PROFILE_PUBLISH_GOAL_MAX_PROGRESS = 10;
const CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS = 10;
const CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS = 10;
const CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS = 100;
const CHANNEL_AUDIENCE_100_GOAL_REWARD = 1000;
const CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS = 1000;
const CHANNEL_AUDIENCE_1000_GOAL_REWARD = 10000;
const CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS = 10000;
const CHANNEL_AUDIENCE_10000_GOAL_REWARD = 100000;
const WHITE_TO_GRADIENT_KEYS_RATE = 10;

function sanitizeNonNegativeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function parseIsoTimestamp(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sanitizeUnlockSignatures(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const next = [];
  value.forEach((entry) => {
    const signature = String(entry || '').trim();
    if (!signature || seen.has(signature)) return;
    seen.add(signature);
    next.push(signature);
  });

  return next;
}

function getDefaultWhiteKeysDailyGoalsState() {
  return {
    homeIntimidadesUnlockSignatures: [],
    homeIntimidadesWindowStartedAt: null,
    homeIntimidadesGoalRewardClaimed: false,
    channelHostThreadCompletedAt: null,
    channelHostThreadRewardClaimed: false,
    channelHostImageUnlockKeys: [],
    channelHostImageWindowStartedAt: null,
    channelHostImageRewardClaimed: false,
    profilePublishCompletedAt: null,
    profilePublishRewardClaimed: false,
    channelEventCreateCompletedAt: null,
    channelEventCreateRewardClaimed: false,
    channelImageShareCompletedAt: null,
    channelImageShareRewardClaimed: false,
    channelAudience100BaselineCount: 0,
    channelAudience100CompletedAt: null,
    channelAudience100RewardClaimed: false,
    channelAudience1000BaselineCount: 0,
    channelAudience1000CompletedAt: null,
    channelAudience1000RewardClaimed: false,
    channelAudience10000BaselineCount: 0,
    channelAudience10000CompletedAt: null,
    channelAudience10000RewardClaimed: false,
  };
}

function sanitizeWhiteKeysDailyGoalsState(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};

  return {
    homeIntimidadesUnlockSignatures: sanitizeUnlockSignatures(raw.homeIntimidadesUnlockSignatures),
    homeIntimidadesWindowStartedAt: parseIsoTimestamp(raw.homeIntimidadesWindowStartedAt)?.toISOString() ?? null,
    homeIntimidadesGoalRewardClaimed: raw.homeIntimidadesGoalRewardClaimed === true,
    channelHostThreadCompletedAt: parseIsoTimestamp(raw.channelHostThreadCompletedAt)?.toISOString() ?? null,
    channelHostThreadRewardClaimed: raw.channelHostThreadRewardClaimed === true,
    channelHostImageUnlockKeys: sanitizeUnlockSignatures(raw.channelHostImageUnlockKeys),
    channelHostImageWindowStartedAt: parseIsoTimestamp(raw.channelHostImageWindowStartedAt)?.toISOString() ?? null,
    channelHostImageRewardClaimed: raw.channelHostImageRewardClaimed === true,
    profilePublishCompletedAt: parseIsoTimestamp(raw.profilePublishCompletedAt)?.toISOString() ?? null,
    profilePublishRewardClaimed: raw.profilePublishRewardClaimed === true,
    channelEventCreateCompletedAt: parseIsoTimestamp(raw.channelEventCreateCompletedAt)?.toISOString() ?? null,
    channelEventCreateRewardClaimed: raw.channelEventCreateRewardClaimed === true,
    channelImageShareCompletedAt: parseIsoTimestamp(raw.channelImageShareCompletedAt)?.toISOString() ?? null,
    channelImageShareRewardClaimed: raw.channelImageShareRewardClaimed === true,
    channelAudience100BaselineCount: sanitizeNonNegativeInteger(raw.channelAudience100BaselineCount),
    channelAudience100CompletedAt: parseIsoTimestamp(raw.channelAudience100CompletedAt)?.toISOString() ?? null,
    channelAudience100RewardClaimed: raw.channelAudience100RewardClaimed === true,
    channelAudience1000BaselineCount: sanitizeNonNegativeInteger(raw.channelAudience1000BaselineCount),
    channelAudience1000CompletedAt: parseIsoTimestamp(raw.channelAudience1000CompletedAt)?.toISOString() ?? null,
    channelAudience1000RewardClaimed: raw.channelAudience1000RewardClaimed === true,
    channelAudience10000BaselineCount: sanitizeNonNegativeInteger(raw.channelAudience10000BaselineCount),
    channelAudience10000CompletedAt: parseIsoTimestamp(raw.channelAudience10000CompletedAt)?.toISOString() ?? null,
    channelAudience10000RewardClaimed: raw.channelAudience10000RewardClaimed === true,
  };
}

function resetHomeIntimidadesGoalWindow(state) {
  return {
    ...state,
    homeIntimidadesUnlockSignatures: [],
    homeIntimidadesWindowStartedAt: null,
    homeIntimidadesGoalRewardClaimed: false,
  };
}

function resetChannelHostThreadGoalWindow(state) {
  return {
    ...state,
    channelHostThreadCompletedAt: null,
    channelHostThreadRewardClaimed: false,
  };
}

function resetChannelHostImageGoalWindow(state) {
  return {
    ...state,
    channelHostImageUnlockKeys: [],
    channelHostImageWindowStartedAt: null,
    channelHostImageRewardClaimed: false,
  };
}

function resetProfilePublishGoalWindow(state) {
  return {
    ...state,
    profilePublishCompletedAt: null,
    profilePublishRewardClaimed: false,
  };
}

function resetChannelEventCreateGoalWindow(state) {
  return {
    ...state,
    channelEventCreateCompletedAt: null,
    channelEventCreateRewardClaimed: false,
  };
}

function resetChannelImageShareGoalWindow(state) {
  return {
    ...state,
    channelImageShareCompletedAt: null,
    channelImageShareRewardClaimed: false,
  };
}

function resetChannelAudienceGoalWindow(state, baselineKey, completedAtKey, rewardClaimedKey, baselineCount) {
  return {
    ...state,
    [baselineKey]: sanitizeNonNegativeInteger(baselineCount),
    [completedAtKey]: null,
    [rewardClaimedKey]: false,
  };
}

async function getCurrentChannelAudienceCount(email) {
  const result = await pool.query(
    `SELECT COALESCE((
        SELECT COUNT(*)::int
        FROM channel_subscriptions cs
        WHERE cs.post_id = p.id
      ), 0) AS subscriber_count
     FROM Post_users p
     WHERE lower(p.user_email) = $1
       AND p.deleted_at IS NULL
       AND p.created_at >= NOW() - ($2 * INTERVAL '1 minute')
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [email, Number(process.env.POST_TTL_MINUTES || 60 * 24)]
  );

  return sanitizeNonNegativeInteger(result.rows?.[0]?.subscriber_count);
}

function applyChannelAudienceGoalState({
  state,
  whiteKeysBalance,
  currentAudienceCount,
  progressMax,
  rewardAmount,
  baselineKey,
  completedAtKey,
  rewardClaimedKey,
  nowMs,
}) {
  let nextState = {
    ...state,
    [baselineKey]: sanitizeNonNegativeInteger(state[baselineKey]),
  };
  let nextWhiteKeysBalance = sanitizeNonNegativeInteger(whiteKeysBalance);
  let parsedCompletedAt = parseIsoTimestamp(nextState[completedAtKey]);

  if (parsedCompletedAt) {
    const expiresAtMs = parsedCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (nextState[rewardClaimedKey] !== true) {
        nextWhiteKeysBalance += rewardAmount;
      }
      nextState = resetChannelAudienceGoalWindow(
        nextState,
        baselineKey,
        completedAtKey,
        rewardClaimedKey,
        currentAudienceCount,
      );
      parsedCompletedAt = null;
    }
  }

  const baselineCount = sanitizeNonNegativeInteger(nextState[baselineKey]);
  const progress = Math.min(
    Math.max(0, sanitizeNonNegativeInteger(currentAudienceCount) - baselineCount),
    progressMax,
  );

  if (!parsedCompletedAt && progress >= progressMax) {
    nextState = {
      ...nextState,
      [completedAtKey]: new Date(nowMs).toISOString(),
      [rewardClaimedKey]: false,
    };
    parsedCompletedAt = parseIsoTimestamp(nextState[completedAtKey]);
  }

  const expiresAtMs = parsedCompletedAt
    ? parsedCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;

  return {
    state: nextState,
    whiteKeysBalance: nextWhiteKeysBalance,
    progress,
    completed: progress >= progressMax,
    rewardClaimed: nextState[rewardClaimedKey] === true,
    windowStartedAt: parsedCompletedAt ? parsedCompletedAt.toISOString() : null,
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    timeRemainingMs: expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : 0,
  };
}

function normalizeWhiteKeysSnapshot(rawRow, nowMs = Date.now()) {
  const rawState = rawRow?.white_keys_daily_goals_state;
  let state = sanitizeWhiteKeysDailyGoalsState(rawState);
  let whiteKeysBalance = sanitizeNonNegativeInteger(rawRow?.white_keys_balance);
  const gradientKeysBalance = sanitizeNonNegativeInteger(rawRow?.gradient_keys_balance);
  const hasGoalState = state.homeIntimidadesUnlockSignatures.length > 0 || state.homeIntimidadesGoalRewardClaimed;

  if (!state.homeIntimidadesWindowStartedAt && hasGoalState) {
    state = resetHomeIntimidadesGoalWindow(state);
  }

  const parsedWindowStart = parseIsoTimestamp(state.homeIntimidadesWindowStartedAt);
  if (parsedWindowStart) {
    const expiresAtMs = parsedWindowStart.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      state = resetHomeIntimidadesGoalWindow(state);
    }
  }

  const parsedChannelHostThreadCompletedAt = parseIsoTimestamp(state.channelHostThreadCompletedAt);
  if (parsedChannelHostThreadCompletedAt) {
    const expiresAtMs = parsedChannelHostThreadCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!state.channelHostThreadRewardClaimed) {
        whiteKeysBalance += CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS;
      }
      state = resetChannelHostThreadGoalWindow(state);
    }
  }

  const hasGoal3State = state.channelHostImageUnlockKeys.length > 0 || state.channelHostImageRewardClaimed;
  if (!state.channelHostImageWindowStartedAt && hasGoal3State) {
    state = resetChannelHostImageGoalWindow(state);
  }

  const parsedChannelHostImageWindowStartedAt = parseIsoTimestamp(state.channelHostImageWindowStartedAt);
  if (parsedChannelHostImageWindowStartedAt) {
    const expiresAtMs = parsedChannelHostImageWindowStartedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!state.channelHostImageRewardClaimed) {
        whiteKeysBalance += CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS;
      }
      state = resetChannelHostImageGoalWindow(state);
    }
  }

  const parsedProfilePublishCompletedAt = parseIsoTimestamp(state.profilePublishCompletedAt);
  if (parsedProfilePublishCompletedAt) {
    const expiresAtMs = parsedProfilePublishCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!state.profilePublishRewardClaimed) {
        whiteKeysBalance += PROFILE_PUBLISH_GOAL_MAX_PROGRESS;
      }
      state = resetProfilePublishGoalWindow(state);
    }
  }

  const parsedChannelEventCreateCompletedAt = parseIsoTimestamp(state.channelEventCreateCompletedAt);
  if (parsedChannelEventCreateCompletedAt) {
    const expiresAtMs = parsedChannelEventCreateCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!state.channelEventCreateRewardClaimed) {
        whiteKeysBalance += CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS;
      }
      state = resetChannelEventCreateGoalWindow(state);
    }
  }

  const parsedChannelImageShareCompletedAt = parseIsoTimestamp(state.channelImageShareCompletedAt);
  if (parsedChannelImageShareCompletedAt) {
    const expiresAtMs = parsedChannelImageShareCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!state.channelImageShareRewardClaimed) {
        whiteKeysBalance += CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS;
      }
      state = resetChannelImageShareGoalWindow(state);
    }
  }

  return {
    state,
    whiteKeysBalance,
    gradientKeysBalance,
  };
}

function buildWhiteKeysResponse(row, nowMs = Date.now(), currentAudienceCount = 0) {
  const snapshot = normalizeWhiteKeysSnapshot(row, nowMs);
  let state = snapshot.state;
  let whiteKeysBalance = snapshot.whiteKeysBalance;
  const channelAudienceCount = sanitizeNonNegativeInteger(currentAudienceCount);
  const parsedWindowStart = parseIsoTimestamp(state.homeIntimidadesWindowStartedAt);
  const expiresAtMs = parsedWindowStart
    ? parsedWindowStart.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const timeRemainingMs = expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : 0;
  const progress = Math.min(
    state.homeIntimidadesUnlockSignatures.length * HOME_INTIMIDADES_DAILY_GOAL_REWARD_STEP,
    HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
  );
  const parsedChannelHostThreadCompletedAt = parseIsoTimestamp(state.channelHostThreadCompletedAt);
  const channelHostThreadExpiresAtMs = parsedChannelHostThreadCompletedAt
    ? parsedChannelHostThreadCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelHostThreadTimeRemainingMs = channelHostThreadExpiresAtMs
    ? Math.max(0, channelHostThreadExpiresAtMs - nowMs)
    : 0;
  const channelHostThreadProgress = parsedChannelHostThreadCompletedAt ? CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS : 0;
  const parsedChannelHostImageWindowStartedAt = parseIsoTimestamp(state.channelHostImageWindowStartedAt);
  const channelHostImageExpiresAtMs = parsedChannelHostImageWindowStartedAt
    ? parsedChannelHostImageWindowStartedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelHostImageTimeRemainingMs = channelHostImageExpiresAtMs
    ? Math.max(0, channelHostImageExpiresAtMs - nowMs)
    : 0;
  const channelHostImageProgress = Math.min(
    state.channelHostImageUnlockKeys.length * CHANNEL_HOST_IMAGE_GOAL_REWARD_STEP,
    CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
  );
  const parsedProfilePublishCompletedAt = parseIsoTimestamp(state.profilePublishCompletedAt);
  const profilePublishExpiresAtMs = parsedProfilePublishCompletedAt
    ? parsedProfilePublishCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const profilePublishTimeRemainingMs = profilePublishExpiresAtMs
    ? Math.max(0, profilePublishExpiresAtMs - nowMs)
    : 0;
  const profilePublishProgress = parsedProfilePublishCompletedAt ? PROFILE_PUBLISH_GOAL_MAX_PROGRESS : 0;
  const parsedChannelEventCreateCompletedAt = parseIsoTimestamp(state.channelEventCreateCompletedAt);
  const channelEventCreateExpiresAtMs = parsedChannelEventCreateCompletedAt
    ? parsedChannelEventCreateCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelEventCreateTimeRemainingMs = channelEventCreateExpiresAtMs
    ? Math.max(0, channelEventCreateExpiresAtMs - nowMs)
    : 0;
  const channelEventCreateProgress = parsedChannelEventCreateCompletedAt ? CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS : 0;
  const parsedChannelImageShareCompletedAt = parseIsoTimestamp(state.channelImageShareCompletedAt);
  const channelImageShareExpiresAtMs = parsedChannelImageShareCompletedAt
    ? parsedChannelImageShareCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelImageShareTimeRemainingMs = channelImageShareExpiresAtMs
    ? Math.max(0, channelImageShareExpiresAtMs - nowMs)
    : 0;
  const channelImageShareProgress = parsedChannelImageShareCompletedAt ? CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS : 0;
  const channelAudience100Goal = applyChannelAudienceGoalState({
    state,
    whiteKeysBalance,
    currentAudienceCount: channelAudienceCount,
    progressMax: CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS,
    rewardAmount: CHANNEL_AUDIENCE_100_GOAL_REWARD,
    baselineKey: 'channelAudience100BaselineCount',
    completedAtKey: 'channelAudience100CompletedAt',
    rewardClaimedKey: 'channelAudience100RewardClaimed',
    nowMs,
  });
  state = channelAudience100Goal.state;
  whiteKeysBalance = channelAudience100Goal.whiteKeysBalance;
  const channelAudience1000Goal = applyChannelAudienceGoalState({
    state,
    whiteKeysBalance,
    currentAudienceCount: channelAudienceCount,
    progressMax: CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS,
    rewardAmount: CHANNEL_AUDIENCE_1000_GOAL_REWARD,
    baselineKey: 'channelAudience1000BaselineCount',
    completedAtKey: 'channelAudience1000CompletedAt',
    rewardClaimedKey: 'channelAudience1000RewardClaimed',
    nowMs,
  });
  state = channelAudience1000Goal.state;
  whiteKeysBalance = channelAudience1000Goal.whiteKeysBalance;
  const channelAudience10000Goal = applyChannelAudienceGoalState({
    state,
    whiteKeysBalance,
    currentAudienceCount: channelAudienceCount,
    progressMax: CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS,
    rewardAmount: CHANNEL_AUDIENCE_10000_GOAL_REWARD,
    baselineKey: 'channelAudience10000BaselineCount',
    completedAtKey: 'channelAudience10000CompletedAt',
    rewardClaimedKey: 'channelAudience10000RewardClaimed',
    nowMs,
  });
  state = channelAudience10000Goal.state;
  whiteKeysBalance = channelAudience10000Goal.whiteKeysBalance;

  return {
    progress,
    completed: progress >= HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
    rewardClaimed: state.homeIntimidadesGoalRewardClaimed === true,
    whiteKeysBalance,
    gradientKeysBalance: snapshot.gradientKeysBalance,
    unlockedPublicationSignatures: state.homeIntimidadesUnlockSignatures,
    windowStartedAt: parsedWindowStart ? parsedWindowStart.toISOString() : null,
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    timeRemainingMs,
    channelHostThreadProgress,
    channelHostThreadCompleted: channelHostThreadProgress >= CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS,
    channelHostThreadRewardClaimed: state.channelHostThreadRewardClaimed === true,
    channelHostThreadWindowStartedAt: parsedChannelHostThreadCompletedAt ? parsedChannelHostThreadCompletedAt.toISOString() : null,
    channelHostThreadExpiresAt: channelHostThreadExpiresAtMs ? new Date(channelHostThreadExpiresAtMs).toISOString() : null,
    channelHostThreadTimeRemainingMs,
    channelHostImageProgress,
    channelHostImageCompleted: channelHostImageProgress >= CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
    channelHostImageRewardClaimed: state.channelHostImageRewardClaimed === true,
    channelHostImageUnlockKeys: state.channelHostImageUnlockKeys,
    channelHostImageWindowStartedAt: parsedChannelHostImageWindowStartedAt ? parsedChannelHostImageWindowStartedAt.toISOString() : null,
    channelHostImageExpiresAt: channelHostImageExpiresAtMs ? new Date(channelHostImageExpiresAtMs).toISOString() : null,
    channelHostImageTimeRemainingMs,
    profilePublishProgress,
    profilePublishCompleted: profilePublishProgress >= PROFILE_PUBLISH_GOAL_MAX_PROGRESS,
    profilePublishRewardClaimed: state.profilePublishRewardClaimed === true,
    profilePublishWindowStartedAt: parsedProfilePublishCompletedAt ? parsedProfilePublishCompletedAt.toISOString() : null,
    profilePublishExpiresAt: profilePublishExpiresAtMs ? new Date(profilePublishExpiresAtMs).toISOString() : null,
    profilePublishTimeRemainingMs,
    channelEventCreateProgress,
    channelEventCreateCompleted: channelEventCreateProgress >= CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS,
    channelEventCreateRewardClaimed: state.channelEventCreateRewardClaimed === true,
    channelEventCreateWindowStartedAt: parsedChannelEventCreateCompletedAt ? parsedChannelEventCreateCompletedAt.toISOString() : null,
    channelEventCreateExpiresAt: channelEventCreateExpiresAtMs ? new Date(channelEventCreateExpiresAtMs).toISOString() : null,
    channelEventCreateTimeRemainingMs,
    channelImageShareProgress,
    channelImageShareCompleted: channelImageShareProgress >= CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS,
    channelImageShareRewardClaimed: state.channelImageShareRewardClaimed === true,
    channelImageShareWindowStartedAt: parsedChannelImageShareCompletedAt ? parsedChannelImageShareCompletedAt.toISOString() : null,
    channelImageShareExpiresAt: channelImageShareExpiresAtMs ? new Date(channelImageShareExpiresAtMs).toISOString() : null,
    channelImageShareTimeRemainingMs,
    channelAudienceCount,
    channelAudience100Progress: channelAudience100Goal.progress,
    channelAudience100Completed: channelAudience100Goal.completed,
    channelAudience100RewardClaimed: channelAudience100Goal.rewardClaimed,
    channelAudience100WindowStartedAt: channelAudience100Goal.windowStartedAt,
    channelAudience100ExpiresAt: channelAudience100Goal.expiresAt,
    channelAudience100TimeRemainingMs: channelAudience100Goal.timeRemainingMs,
    channelAudience1000Progress: channelAudience1000Goal.progress,
    channelAudience1000Completed: channelAudience1000Goal.completed,
    channelAudience1000RewardClaimed: channelAudience1000Goal.rewardClaimed,
    channelAudience1000WindowStartedAt: channelAudience1000Goal.windowStartedAt,
    channelAudience1000ExpiresAt: channelAudience1000Goal.expiresAt,
    channelAudience1000TimeRemainingMs: channelAudience1000Goal.timeRemainingMs,
    channelAudience10000Progress: channelAudience10000Goal.progress,
    channelAudience10000Completed: channelAudience10000Goal.completed,
    channelAudience10000RewardClaimed: channelAudience10000Goal.rewardClaimed,
    channelAudience10000WindowStartedAt: channelAudience10000Goal.windowStartedAt,
    channelAudience10000ExpiresAt: channelAudience10000Goal.expiresAt,
    channelAudience10000TimeRemainingMs: channelAudience10000Goal.timeRemainingMs,
    whiteKeysDailyGoalsState: state,
  };
}

async function buildWhiteKeysResponseForEmail(email, row, nowMs = Date.now()) {
  const currentAudienceCount = await getCurrentChannelAudienceCount(email);
  return buildWhiteKeysResponse(row, nowMs, currentAudienceCount);
}

async function getUserKeysRow(email) {
  const result = await pool.query(
    `SELECT email, white_keys_balance, gradient_keys_balance, white_keys_daily_goals_state
       FROM users
      WHERE lower(email) = $1
      LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function saveUserKeysState(email, next) {
  const result = await pool.query(
    `UPDATE users
        SET white_keys_balance = $1,
            gradient_keys_balance = $2,
            white_keys_daily_goals_state = $3::jsonb,
            updated_at = CURRENT_TIMESTAMP
      WHERE lower(email) = $4
      RETURNING email, white_keys_balance, gradient_keys_balance, white_keys_daily_goals_state`,
    [
      sanitizeNonNegativeInteger(next.whiteKeysBalance),
      sanitizeNonNegativeInteger(next.gradientKeysBalance),
      JSON.stringify(normalizeWhiteKeysSnapshot({
        white_keys_balance: next.whiteKeysBalance,
        gradient_keys_balance: next.gradientKeysBalance,
        white_keys_daily_goals_state: next.whiteKeysDailyGoalsState,
      }).state),
      email,
    ]
  );

  return result.rows[0] || null;
}

router.get('/search-by-username', async (req, res) => {
  try {
    const normalizedQuery = String(req.query?.q || '').trim().replace(/^@+/, '').toLowerCase();
    const requestedLimit = Number.parseInt(String(req.query?.limit || '5'), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 10)
      : 5;

    if (!normalizedQuery) {
      return res.json({ items: [] });
    }

    const likeValue = `${normalizedQuery}%`;
    const result = await pool.query(
      `SELECT username, profile_photo_uri, social_networks
         FROM users
        WHERE username IS NOT NULL
          AND btrim(username) <> ''
          AND lower(ltrim(username, '@')) LIKE $1
        ORDER BY CASE
                   WHEN lower(ltrim(username, '@')) = $2 THEN 0
                   ELSE 1
                 END,
                 char_length(ltrim(username, '@')) ASC,
                 lower(ltrim(username, '@')) ASC
        LIMIT $3`,
      [likeValue, normalizedQuery, limit]
    );

    return res.json({
      items: result.rows.map((row) => ({
        username: row.username,
        profile_photo_uri: row.profile_photo_uri || null,
        social_networks: Array.isArray(row.social_networks) ? row.social_networks : [],
      })),
    });
  } catch (error) {
    console.error('Error al buscar usuarios por username:', error);
    return res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// Obtener perfil de usuario
router.get('/profile/:username', async (req, res) => {
  try {
    const raw = (req.params.username || '').trim();
    const noAt = raw.replace(/^@/, '');
    const candidates = Array.from(new Set([raw, noAt, `@${noAt}`].filter(Boolean)));

    const result = await pool.query(
      'SELECT username, profile_photo_uri, social_networks FROM users WHERE username = ANY($1)',
      [candidates]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    let socialNetworks = row.social_networks;

    if (typeof socialNetworks === 'string' && socialNetworks.trim().length > 0) {
      try {
        socialNetworks = JSON.parse(socialNetworks);
      } catch {
        // ignore
      }
    }

    if (!Array.isArray(socialNetworks)) {
      socialNetworks = [];
    }

    res.json({
      ...row,
      social_networks: socialNetworks,
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Obtener username por email (requiere sesión)
router.get('/username-by-email', authenticateToken, async (req, res) => {
  try {
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'email requerido' });
    }

    const result = await pool.query('SELECT username FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ username: result.rows[0].username });
  } catch (error) {
    console.error('Error al obtener username por email:', error);
    return res.status(500).json({ error: 'Error al obtener username' });
  }
});

// Actualizar foto de perfil
router.post('/profile-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó una imagen' });
    }

    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const prev = await pool.query('SELECT profile_photo_uri FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    const previousPhotoUri = prev.rows?.[0]?.profile_photo_uri ? String(prev.rows[0].profile_photo_uri) : null;

    // Guardar avatar en PostgreSQL (sin procesado nativo) para evitar fallos de decodificación
    // que pueden tumbar la conexión y aparecer como "Network request failed" en React Native.
    const ownerEmail = email;
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const accessToken = generateAccessToken();

    if (!isSupabaseStorageConfigured()) {
      await pool.query(
        'INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token) VALUES ($1, $2, $3, $4, $5, $6)',
        [ownerEmail, null, null, req.file.buffer, mimeType, accessToken]
      );

      const photoUri = `/api/upload/image-token/${accessToken}`;
      await pool.query(
        'UPDATE users SET profile_photo_uri = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [photoUri, email]
      );

      // Eliminar avatar anterior (best-effort)
      if (previousPhotoUri && previousPhotoUri !== photoUri) {
        const mToken = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/upload\/image-token\/([^/?#]+)$/i);
        if (mToken?.[1]) {
          const del = await pool
            .query(
              'DELETE FROM uploaded_images WHERE access_token = $1 AND (owner_email = $2 OR owner_email IS NULL) RETURNING storage_bucket, storage_path',
              [mToken[1], email]
            )
            .catch(() => null);
          const bucket = del?.rows?.[0]?.storage_bucket || null;
          const path = del?.rows?.[0]?.storage_path || null;
          if (bucket && path) {
            await deleteObject({ bucket, path }).catch(() => {});
          }
        } else {
          const mLegacy = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/users\/avatar\/(\d+)(?:\?.*)?$/i);
          if (mLegacy?.[1]) {
            await pool.query('DELETE FROM user_avatars WHERE id = $1 AND user_email = $2', [Number(mLegacy[1]), email]).catch(() => {});
          }
        }
      }

      return res.json({ profile_photo_uri: photoUri });
    }

    const objectPath = buildObjectPath({
      kind: 'avatars',
      ownerEmail,
      mimeType,
    });

    const uploaded = await uploadBuffer({
      buffer: req.file.buffer,
      mimeType,
      path: objectPath,
    });

    await pool.query(
      `INSERT INTO uploaded_images (owner_email, post_id, group_id, image_data, mime_type, access_token, storage_bucket, storage_path)
       VALUES ($1, NULL, NULL, NULL, $2, $3, $4, $5)`,
      [ownerEmail, mimeType, accessToken, uploaded.bucket, uploaded.path]
    );

    const photoUri = `/api/upload/image-token/${accessToken}`;

    // Actualizar en base de datos de usuarios
    await pool.query(
      'UPDATE users SET profile_photo_uri = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [photoUri, email]
    );

    // Eliminar avatar anterior (best-effort) en DB + Storage
    if (previousPhotoUri && previousPhotoUri !== photoUri) {
      const mToken = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/upload\/image-token\/([^/?#]+)$/i);
      if (mToken?.[1]) {
        const del = await pool
          .query(
            'DELETE FROM uploaded_images WHERE access_token = $1 AND (owner_email = $2 OR owner_email IS NULL) RETURNING storage_bucket, storage_path',
            [mToken[1], email]
          )
          .catch(() => null);

        const bucket = del?.rows?.[0]?.storage_bucket || null;
        const path = del?.rows?.[0]?.storage_path || null;
        if (bucket && path) {
          await deleteObject({ bucket, path }).catch(() => {});
        }
      } else {
        const mLegacy = previousPhotoUri.match(/^(?:https?:\/\/[^/]+)?\/api\/users\/avatar\/(\d+)(?:\?.*)?$/i);
        if (mLegacy?.[1]) {
          await pool.query('DELETE FROM user_avatars WHERE id = $1 AND user_email = $2', [Number(mLegacy[1]), email]).catch(() => {});
        }
      }
    }

    res.json({ profile_photo_uri: photoUri });
  } catch (error) {
    console.error('Error al actualizar foto de perfil:', error);
    res.status(500).json({ error: 'Error al actualizar foto de perfil' });
  }
});

// Servir foto de perfil desde DB
router.get('/avatar/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT image_data, mime_type FROM user_avatars WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Avatar no encontrado');
    }

    const avatar = result.rows[0];
    res.setHeader('Content-Type', avatar.mime_type);
    res.send(avatar.image_data);
  } catch (error) {
    console.error('Error al obtener avatar:', error);
    res.status(500).send('Error al obtener avatar');
  }
});

// Actualizar redes sociales
router.put('/social-networks', authenticateToken, async (req, res) => {
  const { social_networks } = req.body;

  try {
    await pool.query(
      'UPDATE users SET social_networks = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [JSON.stringify(social_networks), req.user.email]
    );

    res.json({ message: 'Redes sociales actualizadas', social_networks });
  } catch (error) {
    console.error('Error al actualizar redes sociales:', error);
    res.status(500).json({ error: 'Error al actualizar redes sociales' });
  }
});

// Actualizar preferencia de idioma
router.put('/language', authenticateToken, async (req, res) => {
  const raw = (req.body?.language ?? '').toString().trim().toLowerCase();
  const language = ['es', 'en', 'fr', 'pt'].includes(raw) ? raw : null;

  if (!language) {
    return res.status(400).json({ error: 'Idioma inválido' });
  }

  try {
    await pool.query(
      'UPDATE users SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [language, req.user.email]
    );

    res.json({ preferred_language: language });
  } catch (error) {
    console.error('Error al actualizar idioma:', error);
    res.status(500).json({ error: 'Error al actualizar idioma' });
  }
});

// Eliminar mi cuenta (requiere sesión)
// Borra datos del usuario en distintas tablas y finalmente elimina el registro en users.
// Obtener mis datos personales (requiere sesión)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const [result, adminRes] = await Promise.all([
      pool.query(
        'SELECT email, username, birth_date, gender, nationality, gallery_permission_granted, gallery_permission_updated_at FROM users WHERE lower(email) = $1 LIMIT 1',
        [email]
      ),
      pool
        .query('SELECT 1 FROM backend_admins WHERE lower(email) = $1 LIMIT 1', [email])
        .catch(() => ({ rows: [] })),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      email: row.email,
      username: row.username,
      birth_date: row.birth_date,
      gender: row.gender,
      nationality: row.nationality,
      gallery_permission_granted: row.gallery_permission_granted === true,
      gallery_permission_updated_at: row.gallery_permission_updated_at,
      is_admin: (adminRes?.rows?.length || 0) > 0,
    });
  } catch (error) {
    console.error('Error al obtener mis datos:', error);
    return res.status(500).json({ error: 'Error al obtener mis datos' });
  }
});

router.get('/me/keys-progress', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const payload = await buildWhiteKeysResponseForEmail(email, row, Date.now());
    const normalizedState = payload.whiteKeysDailyGoalsState;
    const currentState = sanitizeWhiteKeysDailyGoalsState(row.white_keys_daily_goals_state);

    if (
      JSON.stringify(currentState) !== JSON.stringify(normalizedState)
      || sanitizeNonNegativeInteger(row.white_keys_balance) !== payload.whiteKeysBalance
      || sanitizeNonNegativeInteger(row.gradient_keys_balance) !== payload.gradientKeysBalance
    ) {
      await saveUserKeysState(email, {
        whiteKeysBalance: payload.whiteKeysBalance,
        gradientKeysBalance: payload.gradientKeysBalance,
        whiteKeysDailyGoalsState: normalizedState,
      });
    }

    return res.json(payload);
  } catch (error) {
    console.error('Error al obtener progreso de llaves:', error);
    return res.status(500).json({ error: 'Error al obtener progreso de llaves' });
  }
});

router.put('/me/keys-progress', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);

    const nextState = {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: req.body?.whiteKeysDailyGoalsState,
    };

    const saved = await saveUserKeysState(email, nextState);
    return res.json(await buildWhiteKeysResponseForEmail(email, saved, nowMs));
  } catch (error) {
    console.error('Error al sincronizar progreso de llaves:', error);
    return res.status(500).json({ error: 'Error al sincronizar progreso de llaves' });
  }
});

router.post('/me/keys-progress/home-intimidades/unlock', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const unlockSignature = String(req.body?.unlockSignature || '').trim();
    if (!unlockSignature) {
      return res.status(400).json({ error: 'unlockSignature requerido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (state.homeIntimidadesUnlockSignatures.includes(unlockSignature)) {
      return res.json({ alreadyRecorded: true, ...current });
    }

    const nextState = {
      ...state,
      homeIntimidadesWindowStartedAt: state.homeIntimidadesWindowStartedAt || new Date(nowMs).toISOString(),
      homeIntimidadesUnlockSignatures: [...state.homeIntimidadesUnlockSignatures, unlockSignature],
    };

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: nextState,
    });

    return res.json({ alreadyRecorded: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al registrar desbloqueo de intimidades:', error);
    return res.status(500).json({ error: 'Error al registrar desbloqueo de intimidades' });
  }
});

router.post('/me/keys-progress/home-intimidades/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.completed || current.rewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        homeIntimidadesGoalRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar recompensa de llaves:', error);
    return res.status(500).json({ error: 'Error al reclamar recompensa de llaves' });
  }
});

router.post('/me/keys-progress/channel-host-thread/complete', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (current.channelHostThreadCompleted) {
      return res.json({ alreadyCompleted: true, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelHostThreadCompletedAt: new Date(nowMs).toISOString(),
        channelHostThreadRewardClaimed: false,
      },
    });

    return res.json({ alreadyCompleted: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al completar objetivo de hilo con anfitrión:', error);
    return res.status(500).json({ error: 'Error al completar objetivo de hilo con anfitrión' });
  }
});

router.post('/me/keys-progress/channel-host-thread/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelHostThreadCompleted || current.channelHostThreadRewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelHostThreadRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de hilo con anfitrión:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de hilo con anfitrión' });
  }
});

router.post('/me/keys-progress/channel-host-images/unlock', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const unlockKey = String(req.body?.unlockKey || '').trim();
    if (!unlockKey) {
      return res.status(400).json({ error: 'unlockKey requerido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (state.channelHostImageUnlockKeys.includes(unlockKey)) {
      return res.json({ alreadyRecorded: true, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelHostImageWindowStartedAt: state.channelHostImageWindowStartedAt || new Date(nowMs).toISOString(),
        channelHostImageUnlockKeys: [...state.channelHostImageUnlockKeys, unlockKey],
      },
    });

    return res.json({ alreadyRecorded: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al registrar desbloqueo de imagen de canal:', error);
    return res.status(500).json({ error: 'Error al registrar desbloqueo de imagen de canal' });
  }
});

router.post('/me/keys-progress/channel-host-images/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelHostImageCompleted || current.channelHostImageRewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelHostImageRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de imágenes de canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de imágenes de canal' });
  }
});

router.post('/me/keys-progress/profile-publish/complete', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (current.profilePublishCompleted) {
      return res.json({ alreadyCompleted: true, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        profilePublishCompletedAt: new Date(nowMs).toISOString(),
        profilePublishRewardClaimed: false,
      },
    });

    return res.json({ alreadyCompleted: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al completar objetivo de publicar perfil:', error);
    return res.status(500).json({ error: 'Error al completar objetivo de publicar perfil' });
  }
});

router.post('/me/keys-progress/profile-publish/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.profilePublishCompleted || current.profilePublishRewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + PROFILE_PUBLISH_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        profilePublishRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de publicar perfil:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de publicar perfil' });
  }
});

router.post('/me/keys-progress/channel-event-create/complete', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (current.channelEventCreateCompleted) {
      return res.json({ alreadyCompleted: true, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelEventCreateCompletedAt: new Date(nowMs).toISOString(),
        channelEventCreateRewardClaimed: false,
      },
    });

    return res.json({ alreadyCompleted: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al completar objetivo de crear evento en canal:', error);
    return res.status(500).json({ error: 'Error al completar objetivo de crear evento en canal' });
  }
});

router.post('/me/keys-progress/channel-event-create/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelEventCreateCompleted || current.channelEventCreateRewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelEventCreateRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de crear evento en canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de crear evento en canal' });
  }
});

router.post('/me/keys-progress/channel-image-share/complete', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (current.channelImageShareCompleted) {
      return res.json({ alreadyCompleted: true, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelImageShareCompletedAt: new Date(nowMs).toISOString(),
        channelImageShareRewardClaimed: false,
      },
    });

    return res.json({ alreadyCompleted: false, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al completar objetivo de compartir imagen en canal:', error);
    return res.status(500).json({ error: 'Error al completar objetivo de compartir imagen en canal' });
  }
});

router.post('/me/keys-progress/channel-image-share/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelImageShareCompleted || current.channelImageShareRewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelImageShareRewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });

router.post('/me/keys-progress/channel-audience-100/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelAudience100Completed || current.channelAudience100RewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_AUDIENCE_100_GOAL_REWARD,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelAudience100RewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de audiencia 100 del canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de audiencia 100 del canal' });
  }
});

router.post('/me/keys-progress/channel-audience-1000/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelAudience1000Completed || current.channelAudience1000RewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_AUDIENCE_1000_GOAL_REWARD,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelAudience1000RewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de audiencia 1000 del canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de audiencia 1000 del canal' });
  }
});

router.post('/me/keys-progress/channel-audience-10000/claim', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);
    const state = current.whiteKeysDailyGoalsState;

    if (!current.channelAudience10000Completed || current.channelAudience10000RewardClaimed) {
      return res.json({ claimedNow: false, ...current });
    }

    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance + CHANNEL_AUDIENCE_10000_GOAL_REWARD,
      gradientKeysBalance: current.gradientKeysBalance,
      whiteKeysDailyGoalsState: {
        ...state,
        channelAudience10000RewardClaimed: true,
      },
    });

    return res.json({ claimedNow: true, ...(await buildWhiteKeysResponseForEmail(email, saved, nowMs)) });
  } catch (error) {
    console.error('Error al reclamar objetivo de audiencia 10000 del canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de audiencia 10000 del canal' });
  }
});
  } catch (error) {
    console.error('Error al reclamar objetivo de compartir imagen en canal:', error);
    return res.status(500).json({ error: 'Error al reclamar objetivo de compartir imagen en canal' });
  }
});

router.post('/me/keys-progress/convert-white-to-gradient', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const row = await getUserKeysRow(email);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nowMs = Date.now();
    const whiteKeysAmount = sanitizeNonNegativeInteger(req.body?.whiteKeysAmount);
    const current = await buildWhiteKeysResponseForEmail(email, row, nowMs);

    if (whiteKeysAmount <= 0 || whiteKeysAmount % WHITE_TO_GRADIENT_KEYS_RATE !== 0) {
      return res.json({
        converted: false,
        convertedWhiteKeys: 0,
        receivedGradientKeys: 0,
        reason: 'invalid-amount',
        ...current,
      });
    }

    if (whiteKeysAmount > current.whiteKeysBalance) {
      return res.json({
        converted: false,
        convertedWhiteKeys: 0,
        receivedGradientKeys: 0,
        reason: 'insufficient-balance',
        ...current,
      });
    }

    const receivedGradientKeys = whiteKeysAmount / WHITE_TO_GRADIENT_KEYS_RATE;
    const saved = await saveUserKeysState(email, {
      whiteKeysBalance: current.whiteKeysBalance - whiteKeysAmount,
      gradientKeysBalance: current.gradientKeysBalance + receivedGradientKeys,
      whiteKeysDailyGoalsState: current.whiteKeysDailyGoalsState,
    });

    return res.json({
      converted: true,
      convertedWhiteKeys: whiteKeysAmount,
      receivedGradientKeys,
      reason: null,
      ...buildWhiteKeysResponse(saved, nowMs),
    });
  } catch (error) {
    console.error('Error al convertir llaves blancas a gradient:', error);
    return res.status(500).json({ error: 'Error al convertir llaves blancas a gradient' });
  }
});

// Actualizar mi nacionalidad (requiere sesión)
router.put('/me/nationality', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const nationality = String(req.body?.nationality ?? '').trim();
    if (!nationality) {
      return res.status(400).json({ error: 'nationality requerida' });
    }

    const result = await pool.query(
      'UPDATE users SET nationality = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING nationality',
      [nationality, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ nationality: result.rows[0].nationality });
  } catch (error) {
    console.error('Error al actualizar mi nacionalidad:', error);
    return res.status(500).json({ error: 'Error al actualizar mi nacionalidad' });
  }
});

// Obtener permisos del dispositivo (requiere sesión)
router.get('/me/device-permissions', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const result = await pool.query(
      'SELECT gallery_permission_granted, gallery_permission_updated_at FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      galleryPermissionGranted: row.gallery_permission_granted === true,
      updatedAt: row.gallery_permission_updated_at,
    });
  } catch (error) {
    console.error('Error al obtener permisos del dispositivo:', error);
    return res.status(500).json({ error: 'Error al obtener permisos del dispositivo' });
  }
});

// Actualizar permisos del dispositivo (requiere sesión)
router.put('/me/device-permissions', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const galleryPermissionGranted = req.body?.galleryPermissionGranted;
    if (typeof galleryPermissionGranted !== 'boolean') {
      return res.status(400).json({ error: 'galleryPermissionGranted debe ser boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET gallery_permission_granted = $1, gallery_permission_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING gallery_permission_granted, gallery_permission_updated_at',
      [galleryPermissionGranted, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      galleryPermissionGranted: row.gallery_permission_granted === true,
      updatedAt: row.gallery_permission_updated_at,
    });
  } catch (error) {
    console.error('Error al actualizar permisos del dispositivo:', error);
    return res.status(500).json({ error: 'Error al actualizar permisos del dispositivo' });
  }
});

// Obtener hints de UI (requiere sesión)
router.get('/me/ui-hints', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const result = await pool.query(
      'SELECT home_swipe_tutorial_seen FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      homeSwipeTutorialSeen: row.home_swipe_tutorial_seen === true,
    });
  } catch (error) {
    console.error('Error al obtener ui-hints:', error);
    return res.status(500).json({ error: 'Error al obtener ui-hints' });
  }
});

// Actualizar hints de UI (requiere sesión)
router.put('/me/ui-hints', authenticateToken, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }

    const homeSwipeTutorialSeen = req.body?.homeSwipeTutorialSeen;
    if (typeof homeSwipeTutorialSeen !== 'boolean') {
      return res.status(400).json({ error: 'homeSwipeTutorialSeen debe ser boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET home_swipe_tutorial_seen = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2 RETURNING home_swipe_tutorial_seen',
      [homeSwipeTutorialSeen, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    return res.json({
      homeSwipeTutorialSeen: row.home_swipe_tutorial_seen === true,
    });
  } catch (error) {
    console.error('Error al actualizar ui-hints:', error);
    return res.status(500).json({ error: 'Error al actualizar ui-hints' });
  }
});

// Verificar mi contraseña actual (requiere sesión)
router.post('/verify-password', authenticateToken, async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    const password = String(req.body?.password || '');

    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Contraseña requerida' });
    }

    const result = await pool.query(
      'SELECT password, supabase_user_id, password_check_failed_attempts, password_check_lock_until, password_check_lockouts, account_locked FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    if (row.account_locked === true) {
      return res.status(403).json({ valid: false, accountLocked: true, error: 'Cuenta bloqueada' });
    }

    const lockUntil = row.password_check_lock_until ? new Date(row.password_check_lock_until) : null;
    if (lockUntil && lockUntil.getTime() > Date.now()) {
      return res.status(429).json({
        valid: false,
        locked: true,
        lockUntil: lockUntil.toISOString(),
        error: 'Campo bloqueado temporalmente',
      });
    }

    let ok = false;
    // Prefer Supabase Auth when configured.
    if (isSupabaseAuthConfigured()) {
      const supabaseAnon = getSupabaseAnonClient();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (!error && data?.user?.id) {
        ok = true;
        const supabaseUserId = String(data.user.id);
        if (!row.supabase_user_id) {
          await pool
            .query(
              'UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)',
              [email, supabaseUserId]
            )
            .catch(() => {});
        }
      }
    }

    // Legacy bcrypt fallback (for old accounts during migration).
    if (!ok && row.password) {
      const hash = String(row.password);
      ok = await bcrypt.compare(password, hash);
    }

    if (ok) {
      await pool.query(
        'UPDATE users SET password_check_failed_attempts = 0, password_check_lock_until = NULL WHERE lower(email) = $1',
        [email]
      );

      return res.json({ valid: true, attemptsRemaining: 5 });
    }

    const failedAttempts = Number(row.password_check_failed_attempts || 0) + 1;
    const attemptsRemaining = Math.max(0, 5 - failedAttempts);

    if (failedAttempts >= 5) {
      const newLockouts = Number(row.password_check_lockouts || 0) + 1;
      const lockUntilDate = new Date(Date.now() + 30 * 60 * 1000);

      if (newLockouts >= 3) {
        await pool.query(
          'UPDATE users SET account_locked = TRUE, password_check_failed_attempts = 0, password_check_lockouts = $1, password_check_lock_until = $2 WHERE lower(email) = $3',
          [newLockouts, lockUntilDate.toISOString(), email]
        );

        return res.status(403).json({
          valid: false,
          accountLocked: true,
          lockUntil: lockUntilDate.toISOString(),
          error: 'Cuenta bloqueada',
        });
      }

      await pool.query(
        'UPDATE users SET password_check_failed_attempts = 0, password_check_lockouts = $1, password_check_lock_until = $2 WHERE lower(email) = $3',
        [newLockouts, lockUntilDate.toISOString(), email]
      );

      return res.status(429).json({
        valid: false,
        locked: true,
        lockUntil: lockUntilDate.toISOString(),
        attemptsRemaining: 0,
        error: 'Campo bloqueado temporalmente',
      });
    }

    await pool.query(
      'UPDATE users SET password_check_failed_attempts = $1 WHERE lower(email) = $2',
      [failedAttempts, email]
    );

    return res.status(401).json({ valid: false, attemptsRemaining, error: 'Contraseña incorrecta' });
  } catch (error) {
    console.error('Error al verificar contraseña:', error);
    return res.status(500).json({ error: 'Error al verificar contraseña' });
  }
});

// Cambiar mi contraseña (requiere sesión)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!email) {
      return res.status(400).json({ error: 'Email de usuario inválido' });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: 'La contraseña no cumple los requisitos' });
    }

    const result = await pool.query('SELECT password, supabase_user_id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    const hasLocalPassword = !!String(row.password || '').trim();
    let currentOk = false;
    let supabaseCurrentAuthClient = null;
    let verifiedSupabaseUserId = row.supabase_user_id ? String(row.supabase_user_id) : null;

    if (isSupabaseAuthConfigured()) {
      const supabaseAnon = getSupabaseAnonClient();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: currentPassword });
      if (!error && data?.user?.id) {
        currentOk = true;
        supabaseCurrentAuthClient = supabaseAnon;
        verifiedSupabaseUserId = String(data.user.id);
        if (!row.supabase_user_id) {
          await pool
            .query('UPDATE users SET supabase_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)', [email, String(data.user.id)])
            .catch(() => {});
          row.supabase_user_id = String(data.user.id);
        }
      }
    }

    // Legacy fallback
    if (!currentOk && row.password) {
      currentOk = await bcrypt.compare(currentPassword, String(row.password));
    }

    if (!currentOk) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    if (supabaseCurrentAuthClient && verifiedSupabaseUserId) {
      const { error: updateSelfError } = await supabaseCurrentAuthClient.auth.updateUser({ password: newPassword });
      if (updateSelfError) {
        console.error('Supabase auth.updateUser error:', updateSelfError);
        return res.status(500).json({
          error: 'No se pudo actualizar la contraseña principal.',
          code: 'SUPABASE_PASSWORD_UPDATE_FAILED',
        });
      }

      const clearLocalPasswordResult = await pool.query(
        'UPDATE users SET password = NULL, account_locked = FALSE, password_check_failed_attempts = 0, password_check_lock_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)',
        [email]
      );

      if (!Number.isFinite(Number(clearLocalPasswordResult?.rowCount)) || Number(clearLocalPasswordResult.rowCount) < 1) {
        throw new Error('Could not clear local password state after changing password');
      }

      return res.json({ success: true });
    }

    // Prefer changing password in Supabase.
    let supabaseUserId = await resolveCanonicalSupabaseUserId(email, verifiedSupabaseUserId);

    const requiresSupabasePasswordUpdate = !!supabaseUserId || !hasLocalPassword;

    if (requiresSupabasePasswordUpdate && !supabaseUserId) {
      return res.status(500).json({
        error: 'No se pudo localizar la cuenta principal para actualizar la contraseña.',
        code: 'SUPABASE_USER_NOT_FOUND',
      });
    }

    if (requiresSupabasePasswordUpdate && !isSupabaseAdminConfigured()) {
      return res.status(500).json({
        error: 'El servidor no está configurado para actualizar la contraseña principal.',
        code: 'SUPABASE_ADMIN_NOT_CONFIGURED',
      });
    }

    if (requiresSupabasePasswordUpdate) {
      const admin = getSupabaseAdminClient();
      const { error: updateError } = await admin.auth.admin.updateUserById(String(supabaseUserId), { password: newPassword });
      if (!updateError) {
        const clearLocalPasswordResult = await pool.query(
          'UPDATE users SET password = NULL, account_locked = FALSE, password_check_failed_attempts = 0, password_check_lock_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = lower($1)',
          [email]
        );

        if (!Number.isFinite(Number(clearLocalPasswordResult?.rowCount)) || Number(clearLocalPasswordResult.rowCount) < 1) {
          throw new Error('Could not clear local password state after changing password');
        }

        return res.json({ success: true });
      }

      console.error('Supabase updateUserById error:', updateError);
      const failure = getSupabasePasswordUpdateFailure(updateError);
      return res.status(failure.status).json(failure.body);
    }

    // Local fallback
    const newHash = await bcrypt.hash(newPassword, 10);
    const updateLocalPasswordResult = await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = $2',
      [newHash, email]
    );

    if (!Number.isFinite(Number(updateLocalPasswordResult?.rowCount)) || Number(updateLocalPasswordResult.rowCount) < 1) {
      throw new Error('Could not update local password during password change');
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

router.delete('/me', authenticateToken, async (req, res) => {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email de usuario inválido' });
  }

  const client = await pool.connect();
  let objectsToDelete = [];
  try {
    await client.query('BEGIN');

    // Collect storage objects first (delete after COMMIT to keep DB fast/atomic).
    const mediaRows = await client
      .query(
        'SELECT storage_bucket, storage_path FROM uploaded_images WHERE owner_email = $1 AND storage_path IS NOT NULL',
        [email]
      )
      .catch(() => null);
    objectsToDelete = (mediaRows?.rows || [])
      .map(r => ({ bucket: r.storage_bucket, path: r.storage_path }))
      .filter(o => o.bucket && o.path);

    // Tablas que NO tienen ON DELETE CASCADE garantizado o que deben eliminarse por requisito
    await client.query('DELETE FROM user_avatars WHERE user_email = $1', [email]).catch(() => {});
    await client.query('DELETE FROM uploaded_images WHERE owner_email = $1', [email]).catch(() => {});

    // Limpiar referencias que podrían quedar como NULL por FK (opcional, pero elimina trazas del email)
    await client.query('UPDATE group_members SET added_by_email = NULL WHERE added_by_email = $1', [email]).catch(() => {});
    await client.query('UPDATE group_member_limits SET limited_by_email = NULL WHERE limited_by_email = $1', [email]).catch(() => {});

    // Finalmente, eliminar usuario (el resto debería caer por ON DELETE CASCADE en la mayoría de tablas)
    const result = await client.query('DELETE FROM users WHERE lower(email) = $1 RETURNING email', [email]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await client.query('COMMIT');

    // Best-effort cleanup in Storage.
    for (const obj of objectsToDelete) {
      await deleteObject(obj);
    }

    return res.json({ success: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Error al eliminar cuenta:', error);
    return res.status(500).json({ error: 'Error al eliminar la cuenta' });
  } finally {
    client.release();
  }
});

module.exports = router;
