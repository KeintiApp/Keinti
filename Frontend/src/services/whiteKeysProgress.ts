import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

const WHITE_KEYS_DAILY_GOALS_STORAGE_KEY_PREFIX = 'keinti.white_keys.daily_goals.';

export const HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS = 20;
export const HOME_INTIMIDADES_DAILY_GOAL_REWARD_STEP = 2;
export const HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS = 20;
export const CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS = 50;
export const CHANNEL_HOST_IMAGE_GOAL_REWARD_STEP = 10;
export const PROFILE_PUBLISH_GOAL_MAX_PROGRESS = 10;
export const CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS = 10;
export const CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS = 10;
export const CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS = 100;
export const CHANNEL_AUDIENCE_100_GOAL_REWARD = 1000;
export const CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS = 1000;
export const CHANNEL_AUDIENCE_1000_GOAL_REWARD = 10000;
export const CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS = 10000;
export const CHANNEL_AUDIENCE_10000_GOAL_REWARD = 100000;
export const WHITE_TO_GRADIENT_KEYS_RATE = 10;

type WhiteKeysDailyGoalsState = {
  homeIntimidadesUnlockSignatures: string[];
  homeIntimidadesWindowStartedAt: string | null;
  homeIntimidadesGoalRewardClaimed: boolean;
  channelHostThreadCompletedAt: string | null;
  channelHostThreadRewardClaimed: boolean;
  channelHostImageUnlockKeys: string[];
  channelHostImageWindowStartedAt: string | null;
  channelHostImageRewardClaimed: boolean;
  profilePublishCompletedAt: string | null;
  profilePublishRewardClaimed: boolean;
  channelEventCreateCompletedAt: string | null;
  channelEventCreateRewardClaimed: boolean;
  channelImageShareCompletedAt: string | null;
  channelImageShareRewardClaimed: boolean;
  channelAudience100BaselineCount: number;
  channelAudience100CompletedAt: string | null;
  channelAudience100RewardClaimed: boolean;
  channelAudience1000BaselineCount: number;
  channelAudience1000CompletedAt: string | null;
  channelAudience1000RewardClaimed: boolean;
  channelAudience10000BaselineCount: number;
  channelAudience10000CompletedAt: string | null;
  channelAudience10000RewardClaimed: boolean;
};

type WhiteKeysDailyGoalsStore = {
  version: 1;
  homeIntimidadesUnlockSignatures: string[];
  homeIntimidadesWindowStartedAt: string | null;
  homeIntimidadesGoalRewardClaimed: boolean;
  channelHostThreadCompletedAt: string | null;
  channelHostThreadRewardClaimed: boolean;
  channelHostImageUnlockKeys: string[];
  channelHostImageWindowStartedAt: string | null;
  channelHostImageRewardClaimed: boolean;
  profilePublishCompletedAt: string | null;
  profilePublishRewardClaimed: boolean;
  channelEventCreateCompletedAt: string | null;
  channelEventCreateRewardClaimed: boolean;
  channelImageShareCompletedAt: string | null;
  channelImageShareRewardClaimed: boolean;
  channelAudience100BaselineCount: number;
  channelAudience100CompletedAt: string | null;
  channelAudience100RewardClaimed: boolean;
  channelAudience1000BaselineCount: number;
  channelAudience1000CompletedAt: string | null;
  channelAudience1000RewardClaimed: boolean;
  channelAudience10000BaselineCount: number;
  channelAudience10000CompletedAt: string | null;
  channelAudience10000RewardClaimed: boolean;
  channelAudienceCount: number;
  whiteKeysBalance: number;
  gradientKeysBalance: number;
};

export type WhiteKeysProgressAuth = {
  email?: string | null;
  token?: string | null;
};

export type HomeIntimidadesDailyGoalProgress = {
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
  whiteKeysBalance: number;
  gradientKeysBalance: number;
  unlockedPublicationSignatures: string[];
  windowStartedAt: string | null;
  expiresAt: string | null;
  timeRemainingMs: number;
  channelHostThreadProgress: number;
  channelHostThreadCompleted: boolean;
  channelHostThreadRewardClaimed: boolean;
  channelHostThreadWindowStartedAt: string | null;
  channelHostThreadExpiresAt: string | null;
  channelHostThreadTimeRemainingMs: number;
  channelHostImageProgress: number;
  channelHostImageCompleted: boolean;
  channelHostImageRewardClaimed: boolean;
  channelHostImageUnlockKeys: string[];
  channelHostImageWindowStartedAt: string | null;
  channelHostImageExpiresAt: string | null;
  channelHostImageTimeRemainingMs: number;
  profilePublishProgress: number;
  profilePublishCompleted: boolean;
  profilePublishRewardClaimed: boolean;
  profilePublishWindowStartedAt: string | null;
  profilePublishExpiresAt: string | null;
  profilePublishTimeRemainingMs: number;
  channelEventCreateProgress: number;
  channelEventCreateCompleted: boolean;
  channelEventCreateRewardClaimed: boolean;
  channelEventCreateWindowStartedAt: string | null;
  channelEventCreateExpiresAt: string | null;
  channelEventCreateTimeRemainingMs: number;
  channelImageShareProgress: number;
  channelImageShareCompleted: boolean;
  channelImageShareRewardClaimed: boolean;
  channelImageShareWindowStartedAt: string | null;
  channelImageShareExpiresAt: string | null;
  channelImageShareTimeRemainingMs: number;
  channelAudienceCount: number;
  channelAudience100Progress: number;
  channelAudience100Completed: boolean;
  channelAudience100RewardClaimed: boolean;
  channelAudience100WindowStartedAt: string | null;
  channelAudience100ExpiresAt: string | null;
  channelAudience100TimeRemainingMs: number;
  channelAudience1000Progress: number;
  channelAudience1000Completed: boolean;
  channelAudience1000RewardClaimed: boolean;
  channelAudience1000WindowStartedAt: string | null;
  channelAudience1000ExpiresAt: string | null;
  channelAudience1000TimeRemainingMs: number;
  channelAudience10000Progress: number;
  channelAudience10000Completed: boolean;
  channelAudience10000RewardClaimed: boolean;
  channelAudience10000WindowStartedAt: string | null;
  channelAudience10000ExpiresAt: string | null;
  channelAudience10000TimeRemainingMs: number;
};

export type WhiteToGradientConversionResult = HomeIntimidadesDailyGoalProgress & {
  converted: boolean;
  convertedWhiteKeys: number;
  receivedGradientKeys: number;
  reason: 'invalid-amount' | 'insufficient-balance' | null;
};

type RemoteWhiteKeysProgressPayload = HomeIntimidadesDailyGoalProgress & {
  whiteKeysDailyGoalsState?: WhiteKeysDailyGoalsState;
};

const normalizeEmailKey = (raw?: string | null) => String(raw || '').trim().toLowerCase();

const hashString = (input: string) => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash, 31) + input.charCodeAt(index);
  }
  return String(hash >= 0 ? hash : hash + 0x100000000);
};

const makeWhiteKeysDailyGoalsStorageKey = (email?: string | null) => {
  const safeEmail = normalizeEmailKey(email) || 'anon';
  return `${WHITE_KEYS_DAILY_GOALS_STORAGE_KEY_PREFIX}${hashString(safeEmail)}`;
};

const safeJsonParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const sanitizeUnlockSignatures = (value: unknown) => {
  if (!Array.isArray(value)) {return [] as string[];}

  const seen = new Set<string>();
  const next: string[] = [];

  value.forEach((entry) => {
    const signature = String(entry || '').trim();
    if (!signature || seen.has(signature)) {return;}
    seen.add(signature);
    next.push(signature);
  });

  return next;
};

const sanitizeBalance = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {return 0;}
  return Math.max(0, Math.floor(numeric));
};

const parseTimestamp = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) {return null;}

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {return null;}
  return parsed;
};

const sanitizeWindowStartedAt = (value: unknown) => parseTimestamp(value)?.toISOString() ?? null;

const hasAuthToken = (token?: string | null) => String(token || '').trim().length > 0;

const resetHomeIntimidadesGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  homeIntimidadesUnlockSignatures: [],
  homeIntimidadesWindowStartedAt: null,
  homeIntimidadesGoalRewardClaimed: false,
});

const resetChannelHostThreadGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  channelHostThreadCompletedAt: null,
  channelHostThreadRewardClaimed: false,
});

const resetChannelHostImageGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  channelHostImageUnlockKeys: [],
  channelHostImageWindowStartedAt: null,
  channelHostImageRewardClaimed: false,
});

const resetProfilePublishGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  profilePublishCompletedAt: null,
  profilePublishRewardClaimed: false,
});

const resetChannelEventCreateGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  channelEventCreateCompletedAt: null,
  channelEventCreateRewardClaimed: false,
});

const resetChannelImageShareGoalWindow = (store: WhiteKeysDailyGoalsStore): WhiteKeysDailyGoalsStore => ({
  ...store,
  channelImageShareCompletedAt: null,
  channelImageShareRewardClaimed: false,
});

const resetChannelAudienceGoalWindow = (
  store: WhiteKeysDailyGoalsStore,
  baselineKey: 'channelAudience100BaselineCount' | 'channelAudience1000BaselineCount' | 'channelAudience10000BaselineCount',
  completedAtKey: 'channelAudience100CompletedAt' | 'channelAudience1000CompletedAt' | 'channelAudience10000CompletedAt',
  rewardClaimedKey: 'channelAudience100RewardClaimed' | 'channelAudience1000RewardClaimed' | 'channelAudience10000RewardClaimed',
  baselineCount: number,
): WhiteKeysDailyGoalsStore => ({
  ...store,
  [baselineKey]: sanitizeBalance(baselineCount),
  [completedAtKey]: null,
  [rewardClaimedKey]: false,
});

const normalizeWhiteKeysDailyGoalsStore = (store: WhiteKeysDailyGoalsStore, nowMs: number) => {
  const sourceSignatures = Array.isArray(store.homeIntimidadesUnlockSignatures)
    ? store.homeIntimidadesUnlockSignatures
    : [];
  const sanitizedSignatures = sanitizeUnlockSignatures(sourceSignatures);
  const sanitizedWindowStartedAt = sanitizeWindowStartedAt(store.homeIntimidadesWindowStartedAt);

  let nextStore: WhiteKeysDailyGoalsStore = {
    version: 1,
    homeIntimidadesUnlockSignatures: sanitizedSignatures,
    homeIntimidadesWindowStartedAt: sanitizedWindowStartedAt,
    homeIntimidadesGoalRewardClaimed: !!store.homeIntimidadesGoalRewardClaimed,
    channelHostThreadCompletedAt: sanitizeWindowStartedAt(store.channelHostThreadCompletedAt),
    channelHostThreadRewardClaimed: !!store.channelHostThreadRewardClaimed,
    channelHostImageUnlockKeys: sanitizeUnlockSignatures(store.channelHostImageUnlockKeys),
    channelHostImageWindowStartedAt: sanitizeWindowStartedAt(store.channelHostImageWindowStartedAt),
    channelHostImageRewardClaimed: !!store.channelHostImageRewardClaimed,
    profilePublishCompletedAt: sanitizeWindowStartedAt(store.profilePublishCompletedAt),
    profilePublishRewardClaimed: !!store.profilePublishRewardClaimed,
    channelEventCreateCompletedAt: sanitizeWindowStartedAt(store.channelEventCreateCompletedAt),
    channelEventCreateRewardClaimed: !!store.channelEventCreateRewardClaimed,
    channelImageShareCompletedAt: sanitizeWindowStartedAt(store.channelImageShareCompletedAt),
    channelImageShareRewardClaimed: !!store.channelImageShareRewardClaimed,
    channelAudience100BaselineCount: sanitizeBalance(store.channelAudience100BaselineCount),
    channelAudience100CompletedAt: sanitizeWindowStartedAt(store.channelAudience100CompletedAt),
    channelAudience100RewardClaimed: !!store.channelAudience100RewardClaimed,
    channelAudience1000BaselineCount: sanitizeBalance(store.channelAudience1000BaselineCount),
    channelAudience1000CompletedAt: sanitizeWindowStartedAt(store.channelAudience1000CompletedAt),
    channelAudience1000RewardClaimed: !!store.channelAudience1000RewardClaimed,
    channelAudience10000BaselineCount: sanitizeBalance(store.channelAudience10000BaselineCount),
    channelAudience10000CompletedAt: sanitizeWindowStartedAt(store.channelAudience10000CompletedAt),
    channelAudience10000RewardClaimed: !!store.channelAudience10000RewardClaimed,
    channelAudienceCount: sanitizeBalance(store.channelAudienceCount),
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance),
    gradientKeysBalance: sanitizeBalance(store.gradientKeysBalance),
  };

  const hasGoal1State = nextStore.homeIntimidadesUnlockSignatures.length > 0 || nextStore.homeIntimidadesGoalRewardClaimed;
  if (!nextStore.homeIntimidadesWindowStartedAt && hasGoal1State) {
    nextStore = resetHomeIntimidadesGoalWindow(nextStore);
  }

  const parsedWindowStart = parseTimestamp(nextStore.homeIntimidadesWindowStartedAt);
  if (parsedWindowStart) {
    const expiresAtMs = parsedWindowStart.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      nextStore = resetHomeIntimidadesGoalWindow(nextStore);
    }
  }

  const parsedChannelHostThreadCompletedAt = parseTimestamp(nextStore.channelHostThreadCompletedAt);
  if (parsedChannelHostThreadCompletedAt) {
    const expiresAtMs = parsedChannelHostThreadCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelHostThreadRewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS,
        };
      }
      nextStore = resetChannelHostThreadGoalWindow(nextStore);
    }
  }

  const hasGoal3State = nextStore.channelHostImageUnlockKeys.length > 0 || nextStore.channelHostImageRewardClaimed;
  if (!nextStore.channelHostImageWindowStartedAt && hasGoal3State) {
    nextStore = resetChannelHostImageGoalWindow(nextStore);
  }

  const parsedChannelHostImageWindowStartedAt = parseTimestamp(nextStore.channelHostImageWindowStartedAt);
  if (parsedChannelHostImageWindowStartedAt) {
    const expiresAtMs = parsedChannelHostImageWindowStartedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelHostImageRewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
        };
      }
      nextStore = resetChannelHostImageGoalWindow(nextStore);
    }
  }

  const parsedProfilePublishCompletedAt = parseTimestamp(nextStore.profilePublishCompletedAt);
  if (parsedProfilePublishCompletedAt) {
    const expiresAtMs = parsedProfilePublishCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.profilePublishRewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + PROFILE_PUBLISH_GOAL_MAX_PROGRESS,
        };
      }
      nextStore = resetProfilePublishGoalWindow(nextStore);
    }
  }

  const parsedChannelEventCreateCompletedAt = parseTimestamp(nextStore.channelEventCreateCompletedAt);
  if (parsedChannelEventCreateCompletedAt) {
    const expiresAtMs = parsedChannelEventCreateCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelEventCreateRewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS,
        };
      }
      nextStore = resetChannelEventCreateGoalWindow(nextStore);
    }
  }

  const parsedChannelImageShareCompletedAt = parseTimestamp(nextStore.channelImageShareCompletedAt);
  if (parsedChannelImageShareCompletedAt) {
    const expiresAtMs = parsedChannelImageShareCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelImageShareRewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS,
        };
      }
      nextStore = resetChannelImageShareGoalWindow(nextStore);
    }
  }

  const currentAudienceCount = sanitizeBalance(nextStore.channelAudienceCount);

  let parsedChannelAudience100CompletedAt = parseTimestamp(nextStore.channelAudience100CompletedAt);
  if (parsedChannelAudience100CompletedAt) {
    const expiresAtMs = parsedChannelAudience100CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelAudience100RewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_AUDIENCE_100_GOAL_REWARD,
        };
      }
      nextStore = resetChannelAudienceGoalWindow(nextStore, 'channelAudience100BaselineCount', 'channelAudience100CompletedAt', 'channelAudience100RewardClaimed', currentAudienceCount);
      parsedChannelAudience100CompletedAt = null;
    }
  }
  const channelAudience100Progress = Math.min(
    Math.max(0, currentAudienceCount - sanitizeBalance(nextStore.channelAudience100BaselineCount)),
    CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS,
  );
  if (!parsedChannelAudience100CompletedAt && channelAudience100Progress >= CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS) {
    nextStore = {
      ...nextStore,
      channelAudience100CompletedAt: new Date(nowMs).toISOString(),
      channelAudience100RewardClaimed: false,
    };
  }

  let parsedChannelAudience1000CompletedAt = parseTimestamp(nextStore.channelAudience1000CompletedAt);
  if (parsedChannelAudience1000CompletedAt) {
    const expiresAtMs = parsedChannelAudience1000CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelAudience1000RewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_AUDIENCE_1000_GOAL_REWARD,
        };
      }
      nextStore = resetChannelAudienceGoalWindow(nextStore, 'channelAudience1000BaselineCount', 'channelAudience1000CompletedAt', 'channelAudience1000RewardClaimed', currentAudienceCount);
      parsedChannelAudience1000CompletedAt = null;
    }
  }
  const channelAudience1000Progress = Math.min(
    Math.max(0, currentAudienceCount - sanitizeBalance(nextStore.channelAudience1000BaselineCount)),
    CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS,
  );
  if (!parsedChannelAudience1000CompletedAt && channelAudience1000Progress >= CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS) {
    nextStore = {
      ...nextStore,
      channelAudience1000CompletedAt: new Date(nowMs).toISOString(),
      channelAudience1000RewardClaimed: false,
    };
  }

  let parsedChannelAudience10000CompletedAt = parseTimestamp(nextStore.channelAudience10000CompletedAt);
  if (parsedChannelAudience10000CompletedAt) {
    const expiresAtMs = parsedChannelAudience10000CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS;
    if (nowMs >= expiresAtMs) {
      if (!nextStore.channelAudience10000RewardClaimed) {
        nextStore = {
          ...nextStore,
          whiteKeysBalance: sanitizeBalance(nextStore.whiteKeysBalance) + CHANNEL_AUDIENCE_10000_GOAL_REWARD,
        };
      }
      nextStore = resetChannelAudienceGoalWindow(nextStore, 'channelAudience10000BaselineCount', 'channelAudience10000CompletedAt', 'channelAudience10000RewardClaimed', currentAudienceCount);
      parsedChannelAudience10000CompletedAt = null;
    }
  }
  const channelAudience10000Progress = Math.min(
    Math.max(0, currentAudienceCount - sanitizeBalance(nextStore.channelAudience10000BaselineCount)),
    CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS,
  );
  if (!parsedChannelAudience10000CompletedAt && channelAudience10000Progress >= CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS) {
    nextStore = {
      ...nextStore,
      channelAudience10000CompletedAt: new Date(nowMs).toISOString(),
      channelAudience10000RewardClaimed: false,
    };
  }

  const changed =
    sanitizedSignatures.length !== sourceSignatures.length
    || sanitizedSignatures.some((signature, index) => signature !== sourceSignatures[index])
    || nextStore.homeIntimidadesWindowStartedAt !== (store.homeIntimidadesWindowStartedAt ?? null)
    || nextStore.homeIntimidadesGoalRewardClaimed !== !!store.homeIntimidadesGoalRewardClaimed
    || nextStore.channelHostThreadCompletedAt !== (store.channelHostThreadCompletedAt ?? null)
    || nextStore.channelHostThreadRewardClaimed !== !!store.channelHostThreadRewardClaimed
    || nextStore.channelHostImageWindowStartedAt !== (store.channelHostImageWindowStartedAt ?? null)
    || nextStore.channelHostImageRewardClaimed !== !!store.channelHostImageRewardClaimed
    || nextStore.profilePublishCompletedAt !== (store.profilePublishCompletedAt ?? null)
    || nextStore.profilePublishRewardClaimed !== !!store.profilePublishRewardClaimed
    || nextStore.channelEventCreateCompletedAt !== (store.channelEventCreateCompletedAt ?? null)
    || nextStore.channelEventCreateRewardClaimed !== !!store.channelEventCreateRewardClaimed
    || nextStore.channelImageShareCompletedAt !== (store.channelImageShareCompletedAt ?? null)
    || nextStore.channelImageShareRewardClaimed !== !!store.channelImageShareRewardClaimed
    || nextStore.channelAudience100BaselineCount !== sanitizeBalance(store.channelAudience100BaselineCount)
    || nextStore.channelAudience100CompletedAt !== (store.channelAudience100CompletedAt ?? null)
    || nextStore.channelAudience100RewardClaimed !== !!store.channelAudience100RewardClaimed
    || nextStore.channelAudience1000BaselineCount !== sanitizeBalance(store.channelAudience1000BaselineCount)
    || nextStore.channelAudience1000CompletedAt !== (store.channelAudience1000CompletedAt ?? null)
    || nextStore.channelAudience1000RewardClaimed !== !!store.channelAudience1000RewardClaimed
    || nextStore.channelAudience10000BaselineCount !== sanitizeBalance(store.channelAudience10000BaselineCount)
    || nextStore.channelAudience10000CompletedAt !== (store.channelAudience10000CompletedAt ?? null)
    || nextStore.channelAudience10000RewardClaimed !== !!store.channelAudience10000RewardClaimed
    || nextStore.channelAudienceCount !== sanitizeBalance(store.channelAudienceCount)
    || nextStore.channelHostImageUnlockKeys.length !== sanitizeUnlockSignatures(store.channelHostImageUnlockKeys).length
    || nextStore.channelHostImageUnlockKeys.some((signature, index) => signature !== sanitizeUnlockSignatures(store.channelHostImageUnlockKeys)[index])
    || nextStore.whiteKeysBalance !== sanitizeBalance(store.whiteKeysBalance)
    || nextStore.gradientKeysBalance !== sanitizeBalance(store.gradientKeysBalance)
    || store.version !== 1;

  return { store: nextStore, changed };
};

const buildProgress = (store: WhiteKeysDailyGoalsStore, nowMs: number): HomeIntimidadesDailyGoalProgress => {
  const sanitized = sanitizeUnlockSignatures(store.homeIntimidadesUnlockSignatures);
  const progress = Math.min(
    sanitized.length * HOME_INTIMIDADES_DAILY_GOAL_REWARD_STEP,
    HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
  );
  const parsedWindowStart = parseTimestamp(store.homeIntimidadesWindowStartedAt);
  const expiresAtMs = parsedWindowStart
    ? parsedWindowStart.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const timeRemainingMs = expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : 0;
  const parsedChannelHostThreadCompletedAt = parseTimestamp(store.channelHostThreadCompletedAt);
  const channelHostThreadExpiresAtMs = parsedChannelHostThreadCompletedAt
    ? parsedChannelHostThreadCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelHostThreadTimeRemainingMs = channelHostThreadExpiresAtMs
    ? Math.max(0, channelHostThreadExpiresAtMs - nowMs)
    : 0;
  const channelHostThreadProgress = parsedChannelHostThreadCompletedAt ? CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS : 0;
  const sanitizedChannelHostImageUnlockKeys = sanitizeUnlockSignatures(store.channelHostImageUnlockKeys);
  const parsedChannelHostImageWindowStartedAt = parseTimestamp(store.channelHostImageWindowStartedAt);
  const channelHostImageExpiresAtMs = parsedChannelHostImageWindowStartedAt
    ? parsedChannelHostImageWindowStartedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelHostImageTimeRemainingMs = channelHostImageExpiresAtMs
    ? Math.max(0, channelHostImageExpiresAtMs - nowMs)
    : 0;
  const channelHostImageProgress = Math.min(
    sanitizedChannelHostImageUnlockKeys.length * CHANNEL_HOST_IMAGE_GOAL_REWARD_STEP,
    CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
  );
  const parsedProfilePublishCompletedAt = parseTimestamp(store.profilePublishCompletedAt);
  const profilePublishExpiresAtMs = parsedProfilePublishCompletedAt
    ? parsedProfilePublishCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const profilePublishTimeRemainingMs = profilePublishExpiresAtMs
    ? Math.max(0, profilePublishExpiresAtMs - nowMs)
    : 0;
  const profilePublishProgress = parsedProfilePublishCompletedAt ? PROFILE_PUBLISH_GOAL_MAX_PROGRESS : 0;
  const parsedChannelEventCreateCompletedAt = parseTimestamp(store.channelEventCreateCompletedAt);
  const channelEventCreateExpiresAtMs = parsedChannelEventCreateCompletedAt
    ? parsedChannelEventCreateCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelEventCreateTimeRemainingMs = channelEventCreateExpiresAtMs
    ? Math.max(0, channelEventCreateExpiresAtMs - nowMs)
    : 0;
  const channelEventCreateProgress = parsedChannelEventCreateCompletedAt ? CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS : 0;
  const parsedChannelImageShareCompletedAt = parseTimestamp(store.channelImageShareCompletedAt);
  const channelImageShareExpiresAtMs = parsedChannelImageShareCompletedAt
    ? parsedChannelImageShareCompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelImageShareTimeRemainingMs = channelImageShareExpiresAtMs
    ? Math.max(0, channelImageShareExpiresAtMs - nowMs)
    : 0;
  const channelImageShareProgress = parsedChannelImageShareCompletedAt ? CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS : 0;
  const channelAudienceCount = sanitizeBalance(store.channelAudienceCount);
  const channelAudience100Progress = Math.min(
    Math.max(0, channelAudienceCount - sanitizeBalance(store.channelAudience100BaselineCount)),
    CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS,
  );
  const parsedChannelAudience100CompletedAt = parseTimestamp(store.channelAudience100CompletedAt);
  const channelAudience100ExpiresAtMs = parsedChannelAudience100CompletedAt
    ? parsedChannelAudience100CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelAudience100TimeRemainingMs = channelAudience100ExpiresAtMs
    ? Math.max(0, channelAudience100ExpiresAtMs - nowMs)
    : 0;
  const channelAudience1000Progress = Math.min(
    Math.max(0, channelAudienceCount - sanitizeBalance(store.channelAudience1000BaselineCount)),
    CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS,
  );
  const parsedChannelAudience1000CompletedAt = parseTimestamp(store.channelAudience1000CompletedAt);
  const channelAudience1000ExpiresAtMs = parsedChannelAudience1000CompletedAt
    ? parsedChannelAudience1000CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelAudience1000TimeRemainingMs = channelAudience1000ExpiresAtMs
    ? Math.max(0, channelAudience1000ExpiresAtMs - nowMs)
    : 0;
  const channelAudience10000Progress = Math.min(
    Math.max(0, channelAudienceCount - sanitizeBalance(store.channelAudience10000BaselineCount)),
    CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS,
  );
  const parsedChannelAudience10000CompletedAt = parseTimestamp(store.channelAudience10000CompletedAt);
  const channelAudience10000ExpiresAtMs = parsedChannelAudience10000CompletedAt
    ? parsedChannelAudience10000CompletedAt.getTime() + HOME_INTIMIDADES_DAILY_GOAL_WINDOW_MS
    : null;
  const channelAudience10000TimeRemainingMs = channelAudience10000ExpiresAtMs
    ? Math.max(0, channelAudience10000ExpiresAtMs - nowMs)
    : 0;

  return {
    progress,
    completed: progress >= HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
    rewardClaimed: !!store.homeIntimidadesGoalRewardClaimed,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance),
    gradientKeysBalance: sanitizeBalance(store.gradientKeysBalance),
    unlockedPublicationSignatures: sanitized,
    windowStartedAt: parsedWindowStart?.toISOString() ?? null,
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    timeRemainingMs,
    channelHostThreadProgress,
    channelHostThreadCompleted: channelHostThreadProgress >= CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS,
    channelHostThreadRewardClaimed: !!store.channelHostThreadRewardClaimed,
    channelHostThreadWindowStartedAt: parsedChannelHostThreadCompletedAt?.toISOString() ?? null,
    channelHostThreadExpiresAt: channelHostThreadExpiresAtMs ? new Date(channelHostThreadExpiresAtMs).toISOString() : null,
    channelHostThreadTimeRemainingMs,
    channelHostImageProgress,
    channelHostImageCompleted: channelHostImageProgress >= CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
    channelHostImageRewardClaimed: !!store.channelHostImageRewardClaimed,
    channelHostImageUnlockKeys: sanitizedChannelHostImageUnlockKeys,
    channelHostImageWindowStartedAt: parsedChannelHostImageWindowStartedAt?.toISOString() ?? null,
    channelHostImageExpiresAt: channelHostImageExpiresAtMs ? new Date(channelHostImageExpiresAtMs).toISOString() : null,
    channelHostImageTimeRemainingMs,
    profilePublishProgress,
    profilePublishCompleted: profilePublishProgress >= PROFILE_PUBLISH_GOAL_MAX_PROGRESS,
    profilePublishRewardClaimed: !!store.profilePublishRewardClaimed,
    profilePublishWindowStartedAt: parsedProfilePublishCompletedAt?.toISOString() ?? null,
    profilePublishExpiresAt: profilePublishExpiresAtMs ? new Date(profilePublishExpiresAtMs).toISOString() : null,
    profilePublishTimeRemainingMs,
    channelEventCreateProgress,
    channelEventCreateCompleted: channelEventCreateProgress >= CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS,
    channelEventCreateRewardClaimed: !!store.channelEventCreateRewardClaimed,
    channelEventCreateWindowStartedAt: parsedChannelEventCreateCompletedAt?.toISOString() ?? null,
    channelEventCreateExpiresAt: channelEventCreateExpiresAtMs ? new Date(channelEventCreateExpiresAtMs).toISOString() : null,
    channelEventCreateTimeRemainingMs,
    channelImageShareProgress,
    channelImageShareCompleted: channelImageShareProgress >= CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS,
    channelImageShareRewardClaimed: !!store.channelImageShareRewardClaimed,
    channelImageShareWindowStartedAt: parsedChannelImageShareCompletedAt?.toISOString() ?? null,
    channelImageShareExpiresAt: channelImageShareExpiresAtMs ? new Date(channelImageShareExpiresAtMs).toISOString() : null,
    channelImageShareTimeRemainingMs,
    channelAudienceCount,
    channelAudience100Progress,
    channelAudience100Completed: channelAudience100Progress >= CHANNEL_AUDIENCE_100_GOAL_MAX_PROGRESS,
    channelAudience100RewardClaimed: !!store.channelAudience100RewardClaimed,
    channelAudience100WindowStartedAt: parsedChannelAudience100CompletedAt?.toISOString() ?? null,
    channelAudience100ExpiresAt: channelAudience100ExpiresAtMs ? new Date(channelAudience100ExpiresAtMs).toISOString() : null,
    channelAudience100TimeRemainingMs,
    channelAudience1000Progress,
    channelAudience1000Completed: channelAudience1000Progress >= CHANNEL_AUDIENCE_1000_GOAL_MAX_PROGRESS,
    channelAudience1000RewardClaimed: !!store.channelAudience1000RewardClaimed,
    channelAudience1000WindowStartedAt: parsedChannelAudience1000CompletedAt?.toISOString() ?? null,
    channelAudience1000ExpiresAt: channelAudience1000ExpiresAtMs ? new Date(channelAudience1000ExpiresAtMs).toISOString() : null,
    channelAudience1000TimeRemainingMs,
    channelAudience10000Progress,
    channelAudience10000Completed: channelAudience10000Progress >= CHANNEL_AUDIENCE_10000_GOAL_MAX_PROGRESS,
    channelAudience10000RewardClaimed: !!store.channelAudience10000RewardClaimed,
    channelAudience10000WindowStartedAt: parsedChannelAudience10000CompletedAt?.toISOString() ?? null,
    channelAudience10000ExpiresAt: channelAudience10000ExpiresAtMs ? new Date(channelAudience10000ExpiresAtMs).toISOString() : null,
    channelAudience10000TimeRemainingMs,
  };
};

const progressToStore = (progress: HomeIntimidadesDailyGoalProgress): WhiteKeysDailyGoalsStore => ({
  version: 1,
  homeIntimidadesUnlockSignatures: sanitizeUnlockSignatures(progress.unlockedPublicationSignatures),
  homeIntimidadesWindowStartedAt: sanitizeWindowStartedAt(progress.windowStartedAt),
  homeIntimidadesGoalRewardClaimed: !!progress.rewardClaimed,
  channelHostThreadCompletedAt: sanitizeWindowStartedAt(progress.channelHostThreadWindowStartedAt),
  channelHostThreadRewardClaimed: !!progress.channelHostThreadRewardClaimed,
  channelHostImageUnlockKeys: sanitizeUnlockSignatures(progress.channelHostImageUnlockKeys),
  channelHostImageWindowStartedAt: sanitizeWindowStartedAt(progress.channelHostImageWindowStartedAt),
  channelHostImageRewardClaimed: !!progress.channelHostImageRewardClaimed,
  profilePublishCompletedAt: sanitizeWindowStartedAt(progress.profilePublishWindowStartedAt),
  profilePublishRewardClaimed: !!progress.profilePublishRewardClaimed,
  channelEventCreateCompletedAt: sanitizeWindowStartedAt(progress.channelEventCreateWindowStartedAt),
  channelEventCreateRewardClaimed: !!progress.channelEventCreateRewardClaimed,
  channelImageShareCompletedAt: sanitizeWindowStartedAt(progress.channelImageShareWindowStartedAt),
  channelImageShareRewardClaimed: !!progress.channelImageShareRewardClaimed,
  channelAudience100BaselineCount: Math.max(0, sanitizeBalance(progress.channelAudienceCount) - sanitizeBalance(progress.channelAudience100Progress)),
  channelAudience100CompletedAt: sanitizeWindowStartedAt(progress.channelAudience100WindowStartedAt),
  channelAudience100RewardClaimed: !!progress.channelAudience100RewardClaimed,
  channelAudience1000BaselineCount: Math.max(0, sanitizeBalance(progress.channelAudienceCount) - sanitizeBalance(progress.channelAudience1000Progress)),
  channelAudience1000CompletedAt: sanitizeWindowStartedAt(progress.channelAudience1000WindowStartedAt),
  channelAudience1000RewardClaimed: !!progress.channelAudience1000RewardClaimed,
  channelAudience10000BaselineCount: Math.max(0, sanitizeBalance(progress.channelAudienceCount) - sanitizeBalance(progress.channelAudience10000Progress)),
  channelAudience10000CompletedAt: sanitizeWindowStartedAt(progress.channelAudience10000WindowStartedAt),
  channelAudience10000RewardClaimed: !!progress.channelAudience10000RewardClaimed,
  channelAudienceCount: sanitizeBalance(progress.channelAudienceCount),
  whiteKeysBalance: sanitizeBalance(progress.whiteKeysBalance),
  gradientKeysBalance: sanitizeBalance(progress.gradientKeysBalance),
});

const storesAreEqual = (left: WhiteKeysDailyGoalsStore, right: WhiteKeysDailyGoalsStore) => (
  left.homeIntimidadesWindowStartedAt === right.homeIntimidadesWindowStartedAt
  && left.homeIntimidadesGoalRewardClaimed === right.homeIntimidadesGoalRewardClaimed
  && left.channelHostThreadCompletedAt === right.channelHostThreadCompletedAt
  && left.channelHostThreadRewardClaimed === right.channelHostThreadRewardClaimed
  && left.channelHostImageWindowStartedAt === right.channelHostImageWindowStartedAt
  && left.channelHostImageRewardClaimed === right.channelHostImageRewardClaimed
  && left.profilePublishCompletedAt === right.profilePublishCompletedAt
  && left.profilePublishRewardClaimed === right.profilePublishRewardClaimed
  && left.channelEventCreateCompletedAt === right.channelEventCreateCompletedAt
  && left.channelEventCreateRewardClaimed === right.channelEventCreateRewardClaimed
  && left.channelImageShareCompletedAt === right.channelImageShareCompletedAt
  && left.channelImageShareRewardClaimed === right.channelImageShareRewardClaimed
  && left.channelAudience100BaselineCount === right.channelAudience100BaselineCount
  && left.channelAudience100CompletedAt === right.channelAudience100CompletedAt
  && left.channelAudience100RewardClaimed === right.channelAudience100RewardClaimed
  && left.channelAudience1000BaselineCount === right.channelAudience1000BaselineCount
  && left.channelAudience1000CompletedAt === right.channelAudience1000CompletedAt
  && left.channelAudience1000RewardClaimed === right.channelAudience1000RewardClaimed
  && left.channelAudience10000BaselineCount === right.channelAudience10000BaselineCount
  && left.channelAudience10000CompletedAt === right.channelAudience10000CompletedAt
  && left.channelAudience10000RewardClaimed === right.channelAudience10000RewardClaimed
  && left.channelAudienceCount === right.channelAudienceCount
  && left.whiteKeysBalance === right.whiteKeysBalance
  && left.gradientKeysBalance === right.gradientKeysBalance
  && left.homeIntimidadesUnlockSignatures.length === right.homeIntimidadesUnlockSignatures.length
  && left.homeIntimidadesUnlockSignatures.every((signature, index) => signature === right.homeIntimidadesUnlockSignatures[index])
  && left.channelHostImageUnlockKeys.length === right.channelHostImageUnlockKeys.length
  && left.channelHostImageUnlockKeys.every((signature, index) => signature === right.channelHostImageUnlockKeys[index])
);

const mergeStoresForRemoteSync = (
  remoteStore: WhiteKeysDailyGoalsStore,
  localStore: WhiteKeysDailyGoalsStore,
  nowMs: number,
) => {
  const normalizedRemote = normalizeWhiteKeysDailyGoalsStore(remoteStore, nowMs).store;
  const normalizedLocal = normalizeWhiteKeysDailyGoalsStore(localStore, nowMs).store;
  const remoteHasGoal1 = normalizedRemote.homeIntimidadesUnlockSignatures.length > 0 || normalizedRemote.homeIntimidadesGoalRewardClaimed;
  const localHasGoal1 = normalizedLocal.homeIntimidadesUnlockSignatures.length > 0 || normalizedLocal.homeIntimidadesGoalRewardClaimed;

  let mergedGoal1State = {
    homeIntimidadesUnlockSignatures: [...normalizedRemote.homeIntimidadesUnlockSignatures],
    homeIntimidadesWindowStartedAt: normalizedRemote.homeIntimidadesWindowStartedAt,
    homeIntimidadesGoalRewardClaimed: normalizedRemote.homeIntimidadesGoalRewardClaimed,
  };

  if (!remoteHasGoal1 && localHasGoal1) {
    mergedGoal1State = {
      homeIntimidadesUnlockSignatures: [...normalizedLocal.homeIntimidadesUnlockSignatures],
      homeIntimidadesWindowStartedAt: normalizedLocal.homeIntimidadesWindowStartedAt,
      homeIntimidadesGoalRewardClaimed: normalizedLocal.homeIntimidadesGoalRewardClaimed,
    };
  } else if (remoteHasGoal1 && localHasGoal1) {
    const mergedUnlocks = sanitizeUnlockSignatures([
      ...normalizedRemote.homeIntimidadesUnlockSignatures,
      ...normalizedLocal.homeIntimidadesUnlockSignatures,
    ]);
    const remoteWindowStartMs = parseTimestamp(normalizedRemote.homeIntimidadesWindowStartedAt)?.getTime() ?? null;
    const localWindowStartMs = parseTimestamp(normalizedLocal.homeIntimidadesWindowStartedAt)?.getTime() ?? null;
    const mergedWindowStartMs = [remoteWindowStartMs, localWindowStartMs]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .sort((left, right) => left - right)[0] ?? null;

    mergedGoal1State = {
      homeIntimidadesUnlockSignatures: mergedUnlocks,
      homeIntimidadesWindowStartedAt: mergedWindowStartMs ? new Date(mergedWindowStartMs).toISOString() : null,
      homeIntimidadesGoalRewardClaimed:
        normalizedRemote.homeIntimidadesGoalRewardClaimed || normalizedLocal.homeIntimidadesGoalRewardClaimed,
    };
  }

  const remoteGoal2CompletedAtMs = parseTimestamp(normalizedRemote.channelHostThreadCompletedAt)?.getTime() ?? null;
  const localGoal2CompletedAtMs = parseTimestamp(normalizedLocal.channelHostThreadCompletedAt)?.getTime() ?? null;
  const mergedGoal2CompletedAtMs = [remoteGoal2CompletedAtMs, localGoal2CompletedAtMs]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right)[0] ?? null;

  const remoteProfilePublishCompletedAtMs = parseTimestamp(normalizedRemote.profilePublishCompletedAt)?.getTime() ?? null;
  const localProfilePublishCompletedAtMs = parseTimestamp(normalizedLocal.profilePublishCompletedAt)?.getTime() ?? null;
  const mergedProfilePublishCompletedAtMs = [remoteProfilePublishCompletedAtMs, localProfilePublishCompletedAtMs]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right)[0] ?? null;

  const remoteChannelEventCreateCompletedAtMs = parseTimestamp(normalizedRemote.channelEventCreateCompletedAt)?.getTime() ?? null;
  const localChannelEventCreateCompletedAtMs = parseTimestamp(normalizedLocal.channelEventCreateCompletedAt)?.getTime() ?? null;
  const mergedChannelEventCreateCompletedAtMs = [remoteChannelEventCreateCompletedAtMs, localChannelEventCreateCompletedAtMs]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right)[0] ?? null;

  const remoteChannelImageShareCompletedAtMs = parseTimestamp(normalizedRemote.channelImageShareCompletedAt)?.getTime() ?? null;
  const localChannelImageShareCompletedAtMs = parseTimestamp(normalizedLocal.channelImageShareCompletedAt)?.getTime() ?? null;
  const mergedChannelImageShareCompletedAtMs = [remoteChannelImageShareCompletedAtMs, localChannelImageShareCompletedAtMs]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right)[0] ?? null;

  const mergeAudienceGoal = (
    remoteBaselineCount: number,
    remoteCompletedAt: string | null,
    remoteRewardClaimed: boolean,
    localBaselineCount: number,
    localCompletedAt: string | null,
    localRewardClaimed: boolean,
  ) => {
    const remoteHasState = remoteBaselineCount > 0 || !!remoteCompletedAt || remoteRewardClaimed;
    const localHasState = localBaselineCount > 0 || !!localCompletedAt || localRewardClaimed;

    if (!remoteHasState && localHasState) {
      return {
        baselineCount: localBaselineCount,
        completedAt: localCompletedAt,
        rewardClaimed: localRewardClaimed,
      };
    }

    if (remoteHasState && localHasState) {
      const remoteCompletedAtMs = parseTimestamp(remoteCompletedAt)?.getTime() ?? null;
      const localCompletedAtMs = parseTimestamp(localCompletedAt)?.getTime() ?? null;
      const mergedCompletedAtMs = [remoteCompletedAtMs, localCompletedAtMs]
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        .sort((left, right) => left - right)[0] ?? null;

      return {
        baselineCount: Math.max(remoteBaselineCount, localBaselineCount),
        completedAt: mergedCompletedAtMs ? new Date(mergedCompletedAtMs).toISOString() : null,
        rewardClaimed: remoteRewardClaimed || localRewardClaimed,
      };
    }

    return {
      baselineCount: remoteBaselineCount,
      completedAt: remoteCompletedAt,
      rewardClaimed: remoteRewardClaimed,
    };
  };

  const mergedAudience100Goal = mergeAudienceGoal(
    sanitizeBalance(normalizedRemote.channelAudience100BaselineCount),
    normalizedRemote.channelAudience100CompletedAt,
    normalizedRemote.channelAudience100RewardClaimed,
    sanitizeBalance(normalizedLocal.channelAudience100BaselineCount),
    normalizedLocal.channelAudience100CompletedAt,
    normalizedLocal.channelAudience100RewardClaimed,
  );
  const mergedAudience1000Goal = mergeAudienceGoal(
    sanitizeBalance(normalizedRemote.channelAudience1000BaselineCount),
    normalizedRemote.channelAudience1000CompletedAt,
    normalizedRemote.channelAudience1000RewardClaimed,
    sanitizeBalance(normalizedLocal.channelAudience1000BaselineCount),
    normalizedLocal.channelAudience1000CompletedAt,
    normalizedLocal.channelAudience1000RewardClaimed,
  );
  const mergedAudience10000Goal = mergeAudienceGoal(
    sanitizeBalance(normalizedRemote.channelAudience10000BaselineCount),
    normalizedRemote.channelAudience10000CompletedAt,
    normalizedRemote.channelAudience10000RewardClaimed,
    sanitizeBalance(normalizedLocal.channelAudience10000BaselineCount),
    normalizedLocal.channelAudience10000CompletedAt,
    normalizedLocal.channelAudience10000RewardClaimed,
  );

  const remoteHasGoal3 = normalizedRemote.channelHostImageUnlockKeys.length > 0 || normalizedRemote.channelHostImageRewardClaimed;
  const localHasGoal3 = normalizedLocal.channelHostImageUnlockKeys.length > 0 || normalizedLocal.channelHostImageRewardClaimed;
  let mergedGoal3UnlockKeys = [...normalizedRemote.channelHostImageUnlockKeys];
  let mergedGoal3WindowStartedAt = normalizedRemote.channelHostImageWindowStartedAt;
  let mergedGoal3RewardClaimed = normalizedRemote.channelHostImageRewardClaimed;

  if (!remoteHasGoal3 && localHasGoal3) {
    mergedGoal3UnlockKeys = [...normalizedLocal.channelHostImageUnlockKeys];
    mergedGoal3WindowStartedAt = normalizedLocal.channelHostImageWindowStartedAt;
    mergedGoal3RewardClaimed = normalizedLocal.channelHostImageRewardClaimed;
  } else if (remoteHasGoal3 && localHasGoal3) {
    mergedGoal3UnlockKeys = sanitizeUnlockSignatures([
      ...normalizedRemote.channelHostImageUnlockKeys,
      ...normalizedLocal.channelHostImageUnlockKeys,
    ]);
    const remoteWindowStartMs = parseTimestamp(normalizedRemote.channelHostImageWindowStartedAt)?.getTime() ?? null;
    const localWindowStartMs = parseTimestamp(normalizedLocal.channelHostImageWindowStartedAt)?.getTime() ?? null;
    const mergedWindowStartMs = [remoteWindowStartMs, localWindowStartMs]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .sort((left, right) => left - right)[0] ?? null;
    mergedGoal3WindowStartedAt = mergedWindowStartMs ? new Date(mergedWindowStartMs).toISOString() : null;
    mergedGoal3RewardClaimed = normalizedRemote.channelHostImageRewardClaimed || normalizedLocal.channelHostImageRewardClaimed;
  }

  return normalizeWhiteKeysDailyGoalsStore({
    version: 1,
    homeIntimidadesUnlockSignatures: mergedGoal1State.homeIntimidadesUnlockSignatures,
    homeIntimidadesWindowStartedAt: mergedGoal1State.homeIntimidadesWindowStartedAt,
    homeIntimidadesGoalRewardClaimed: mergedGoal1State.homeIntimidadesGoalRewardClaimed,
    channelHostThreadCompletedAt: mergedGoal2CompletedAtMs ? new Date(mergedGoal2CompletedAtMs).toISOString() : null,
    channelHostThreadRewardClaimed:
      normalizedRemote.channelHostThreadRewardClaimed || normalizedLocal.channelHostThreadRewardClaimed,
    channelHostImageUnlockKeys: mergedGoal3UnlockKeys,
    channelHostImageWindowStartedAt: mergedGoal3WindowStartedAt,
    channelHostImageRewardClaimed: mergedGoal3RewardClaimed,
    profilePublishCompletedAt: mergedProfilePublishCompletedAtMs ? new Date(mergedProfilePublishCompletedAtMs).toISOString() : null,
    profilePublishRewardClaimed:
      normalizedRemote.profilePublishRewardClaimed || normalizedLocal.profilePublishRewardClaimed,
    channelEventCreateCompletedAt: mergedChannelEventCreateCompletedAtMs ? new Date(mergedChannelEventCreateCompletedAtMs).toISOString() : null,
    channelEventCreateRewardClaimed:
      normalizedRemote.channelEventCreateRewardClaimed || normalizedLocal.channelEventCreateRewardClaimed,
    channelImageShareCompletedAt: mergedChannelImageShareCompletedAtMs ? new Date(mergedChannelImageShareCompletedAtMs).toISOString() : null,
    channelImageShareRewardClaimed:
      normalizedRemote.channelImageShareRewardClaimed || normalizedLocal.channelImageShareRewardClaimed,
    channelAudience100BaselineCount: mergedAudience100Goal.baselineCount,
    channelAudience100CompletedAt: mergedAudience100Goal.completedAt,
    channelAudience100RewardClaimed: mergedAudience100Goal.rewardClaimed,
    channelAudience1000BaselineCount: mergedAudience1000Goal.baselineCount,
    channelAudience1000CompletedAt: mergedAudience1000Goal.completedAt,
    channelAudience1000RewardClaimed: mergedAudience1000Goal.rewardClaimed,
    channelAudience10000BaselineCount: mergedAudience10000Goal.baselineCount,
    channelAudience10000CompletedAt: mergedAudience10000Goal.completedAt,
    channelAudience10000RewardClaimed: mergedAudience10000Goal.rewardClaimed,
    channelAudienceCount: normalizedRemote.channelAudienceCount,
    whiteKeysBalance: normalizedRemote.whiteKeysBalance,
    gradientKeysBalance: normalizedRemote.gradientKeysBalance,
  }, nowMs).store;
};

const loadWhiteKeysDailyGoalsStore = async (email?: string | null): Promise<WhiteKeysDailyGoalsStore> => {
  try {
    const raw = await AsyncStorage.getItem(makeWhiteKeysDailyGoalsStorageKey(email));
    const parsed = safeJsonParse(raw);

    return {
      version: 1,
      homeIntimidadesUnlockSignatures: sanitizeUnlockSignatures(parsed?.homeIntimidadesUnlockSignatures),
      homeIntimidadesWindowStartedAt: sanitizeWindowStartedAt(parsed?.homeIntimidadesWindowStartedAt),
      homeIntimidadesGoalRewardClaimed: !!parsed?.homeIntimidadesGoalRewardClaimed,
      channelHostThreadCompletedAt: sanitizeWindowStartedAt(parsed?.channelHostThreadCompletedAt),
      channelHostThreadRewardClaimed: !!parsed?.channelHostThreadRewardClaimed,
      channelHostImageUnlockKeys: sanitizeUnlockSignatures(parsed?.channelHostImageUnlockKeys),
      channelHostImageWindowStartedAt: sanitizeWindowStartedAt(parsed?.channelHostImageWindowStartedAt),
      channelHostImageRewardClaimed: !!parsed?.channelHostImageRewardClaimed,
      profilePublishCompletedAt: sanitizeWindowStartedAt(parsed?.profilePublishCompletedAt),
      profilePublishRewardClaimed: !!parsed?.profilePublishRewardClaimed,
      channelEventCreateCompletedAt: sanitizeWindowStartedAt(parsed?.channelEventCreateCompletedAt),
      channelEventCreateRewardClaimed: !!parsed?.channelEventCreateRewardClaimed,
      channelImageShareCompletedAt: sanitizeWindowStartedAt(parsed?.channelImageShareCompletedAt),
      channelImageShareRewardClaimed: !!parsed?.channelImageShareRewardClaimed,
      channelAudience100BaselineCount: sanitizeBalance(parsed?.channelAudience100BaselineCount),
      channelAudience100CompletedAt: sanitizeWindowStartedAt(parsed?.channelAudience100CompletedAt),
      channelAudience100RewardClaimed: !!parsed?.channelAudience100RewardClaimed,
      channelAudience1000BaselineCount: sanitizeBalance(parsed?.channelAudience1000BaselineCount),
      channelAudience1000CompletedAt: sanitizeWindowStartedAt(parsed?.channelAudience1000CompletedAt),
      channelAudience1000RewardClaimed: !!parsed?.channelAudience1000RewardClaimed,
      channelAudience10000BaselineCount: sanitizeBalance(parsed?.channelAudience10000BaselineCount),
      channelAudience10000CompletedAt: sanitizeWindowStartedAt(parsed?.channelAudience10000CompletedAt),
      channelAudience10000RewardClaimed: !!parsed?.channelAudience10000RewardClaimed,
      channelAudienceCount: sanitizeBalance(parsed?.channelAudienceCount),
      whiteKeysBalance: sanitizeBalance(parsed?.whiteKeysBalance),
      gradientKeysBalance: sanitizeBalance(parsed?.gradientKeysBalance),
    };
  } catch {
    return {
      version: 1,
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
      channelAudienceCount: 0,
      whiteKeysBalance: 0,
      gradientKeysBalance: 0,
    };
  }
};

const saveWhiteKeysDailyGoalsStore = async (email: string | null | undefined, store: WhiteKeysDailyGoalsStore) => {
  await AsyncStorage.setItem(makeWhiteKeysDailyGoalsStorageKey(email), JSON.stringify(store));
};

const loadNormalizedWhiteKeysDailyGoalsStore = async (email?: string | null, nowMs = Date.now()) => {
  const store = await loadWhiteKeysDailyGoalsStore(email);
  const normalized = normalizeWhiteKeysDailyGoalsStore(store, nowMs);

  if (normalized.changed) {
    await saveWhiteKeysDailyGoalsStore(email, normalized.store);
  }

  return normalized.store;
};

const parseRemoteProgressPayload = (payload: RemoteWhiteKeysProgressPayload): HomeIntimidadesDailyGoalProgress => ({
  progress: sanitizeBalance(payload?.progress),
  completed: payload?.completed === true,
  rewardClaimed: payload?.rewardClaimed === true,
  whiteKeysBalance: sanitizeBalance(payload?.whiteKeysBalance),
  gradientKeysBalance: sanitizeBalance(payload?.gradientKeysBalance),
  unlockedPublicationSignatures: sanitizeUnlockSignatures(payload?.unlockedPublicationSignatures),
  windowStartedAt: sanitizeWindowStartedAt(payload?.windowStartedAt),
  expiresAt: sanitizeWindowStartedAt(payload?.expiresAt),
  timeRemainingMs: sanitizeBalance(payload?.timeRemainingMs),
  channelHostThreadProgress: sanitizeBalance((payload as any)?.channelHostThreadProgress),
  channelHostThreadCompleted: (payload as any)?.channelHostThreadCompleted === true,
  channelHostThreadRewardClaimed: (payload as any)?.channelHostThreadRewardClaimed === true,
  channelHostThreadWindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelHostThreadWindowStartedAt),
  channelHostThreadExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelHostThreadExpiresAt),
  channelHostThreadTimeRemainingMs: sanitizeBalance((payload as any)?.channelHostThreadTimeRemainingMs),
  channelHostImageProgress: sanitizeBalance((payload as any)?.channelHostImageProgress),
  channelHostImageCompleted: (payload as any)?.channelHostImageCompleted === true,
  channelHostImageRewardClaimed: (payload as any)?.channelHostImageRewardClaimed === true,
  channelHostImageUnlockKeys: sanitizeUnlockSignatures((payload as any)?.channelHostImageUnlockKeys),
  channelHostImageWindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelHostImageWindowStartedAt),
  channelHostImageExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelHostImageExpiresAt),
  channelHostImageTimeRemainingMs: sanitizeBalance((payload as any)?.channelHostImageTimeRemainingMs),
  profilePublishProgress: sanitizeBalance((payload as any)?.profilePublishProgress),
  profilePublishCompleted: (payload as any)?.profilePublishCompleted === true,
  profilePublishRewardClaimed: (payload as any)?.profilePublishRewardClaimed === true,
  profilePublishWindowStartedAt: sanitizeWindowStartedAt((payload as any)?.profilePublishWindowStartedAt),
  profilePublishExpiresAt: sanitizeWindowStartedAt((payload as any)?.profilePublishExpiresAt),
  profilePublishTimeRemainingMs: sanitizeBalance((payload as any)?.profilePublishTimeRemainingMs),
  channelEventCreateProgress: sanitizeBalance((payload as any)?.channelEventCreateProgress),
  channelEventCreateCompleted: (payload as any)?.channelEventCreateCompleted === true,
  channelEventCreateRewardClaimed: (payload as any)?.channelEventCreateRewardClaimed === true,
  channelEventCreateWindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelEventCreateWindowStartedAt),
  channelEventCreateExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelEventCreateExpiresAt),
  channelEventCreateTimeRemainingMs: sanitizeBalance((payload as any)?.channelEventCreateTimeRemainingMs),
  channelImageShareProgress: sanitizeBalance((payload as any)?.channelImageShareProgress),
  channelImageShareCompleted: (payload as any)?.channelImageShareCompleted === true,
  channelImageShareRewardClaimed: (payload as any)?.channelImageShareRewardClaimed === true,
  channelImageShareWindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelImageShareWindowStartedAt),
  channelImageShareExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelImageShareExpiresAt),
  channelImageShareTimeRemainingMs: sanitizeBalance((payload as any)?.channelImageShareTimeRemainingMs),
  channelAudienceCount: sanitizeBalance((payload as any)?.channelAudienceCount),
  channelAudience100Progress: sanitizeBalance((payload as any)?.channelAudience100Progress),
  channelAudience100Completed: (payload as any)?.channelAudience100Completed === true,
  channelAudience100RewardClaimed: (payload as any)?.channelAudience100RewardClaimed === true,
  channelAudience100WindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelAudience100WindowStartedAt),
  channelAudience100ExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelAudience100ExpiresAt),
  channelAudience100TimeRemainingMs: sanitizeBalance((payload as any)?.channelAudience100TimeRemainingMs),
  channelAudience1000Progress: sanitizeBalance((payload as any)?.channelAudience1000Progress),
  channelAudience1000Completed: (payload as any)?.channelAudience1000Completed === true,
  channelAudience1000RewardClaimed: (payload as any)?.channelAudience1000RewardClaimed === true,
  channelAudience1000WindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelAudience1000WindowStartedAt),
  channelAudience1000ExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelAudience1000ExpiresAt),
  channelAudience1000TimeRemainingMs: sanitizeBalance((payload as any)?.channelAudience1000TimeRemainingMs),
  channelAudience10000Progress: sanitizeBalance((payload as any)?.channelAudience10000Progress),
  channelAudience10000Completed: (payload as any)?.channelAudience10000Completed === true,
  channelAudience10000RewardClaimed: (payload as any)?.channelAudience10000RewardClaimed === true,
  channelAudience10000WindowStartedAt: sanitizeWindowStartedAt((payload as any)?.channelAudience10000WindowStartedAt),
  channelAudience10000ExpiresAt: sanitizeWindowStartedAt((payload as any)?.channelAudience10000ExpiresAt),
  channelAudience10000TimeRemainingMs: sanitizeBalance((payload as any)?.channelAudience10000TimeRemainingMs),
});

const fetchRemoteProgress = async (token: string): Promise<HomeIntimidadesDailyGoalProgress> => {
  const response = await fetch(`${API_URL}/api/users/me/keys-progress`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch remote keys progress');
  }

  const payload = await response.json() as RemoteWhiteKeysProgressPayload;
  return parseRemoteProgressPayload(payload);
};

const syncRemoteProgressSnapshot = async (token: string, store: WhiteKeysDailyGoalsStore) => {
  const response = await fetch(`${API_URL}/api/users/me/keys-progress`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance),
      gradientKeysBalance: sanitizeBalance(store.gradientKeysBalance),
      whiteKeysDailyGoalsState: {
        homeIntimidadesUnlockSignatures: sanitizeUnlockSignatures(store.homeIntimidadesUnlockSignatures),
        homeIntimidadesWindowStartedAt: sanitizeWindowStartedAt(store.homeIntimidadesWindowStartedAt),
        homeIntimidadesGoalRewardClaimed: !!store.homeIntimidadesGoalRewardClaimed,
        channelHostThreadCompletedAt: sanitizeWindowStartedAt(store.channelHostThreadCompletedAt),
        channelHostThreadRewardClaimed: !!store.channelHostThreadRewardClaimed,
        channelHostImageUnlockKeys: sanitizeUnlockSignatures(store.channelHostImageUnlockKeys),
        channelHostImageWindowStartedAt: sanitizeWindowStartedAt(store.channelHostImageWindowStartedAt),
        channelHostImageRewardClaimed: !!store.channelHostImageRewardClaimed,
        profilePublishCompletedAt: sanitizeWindowStartedAt(store.profilePublishCompletedAt),
        profilePublishRewardClaimed: !!store.profilePublishRewardClaimed,
        channelEventCreateCompletedAt: sanitizeWindowStartedAt(store.channelEventCreateCompletedAt),
        channelEventCreateRewardClaimed: !!store.channelEventCreateRewardClaimed,
        channelImageShareCompletedAt: sanitizeWindowStartedAt(store.channelImageShareCompletedAt),
        channelImageShareRewardClaimed: !!store.channelImageShareRewardClaimed,
        channelAudience100BaselineCount: sanitizeBalance(store.channelAudience100BaselineCount),
        channelAudience100CompletedAt: sanitizeWindowStartedAt(store.channelAudience100CompletedAt),
        channelAudience100RewardClaimed: !!store.channelAudience100RewardClaimed,
        channelAudience1000BaselineCount: sanitizeBalance(store.channelAudience1000BaselineCount),
        channelAudience1000CompletedAt: sanitizeWindowStartedAt(store.channelAudience1000CompletedAt),
        channelAudience1000RewardClaimed: !!store.channelAudience1000RewardClaimed,
        channelAudience10000BaselineCount: sanitizeBalance(store.channelAudience10000BaselineCount),
        channelAudience10000CompletedAt: sanitizeWindowStartedAt(store.channelAudience10000CompletedAt),
        channelAudience10000RewardClaimed: !!store.channelAudience10000RewardClaimed,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to sync remote keys progress');
  }

  const payload = await response.json() as RemoteWhiteKeysProgressPayload;
  return parseRemoteProgressPayload(payload);
};

const cacheProgressLocally = async (
  email: string | null | undefined,
  progress: HomeIntimidadesDailyGoalProgress,
) => {
  await saveWhiteKeysDailyGoalsStore(email, progressToStore(progress));
};

const ensureRemoteState = async (
  auth: WhiteKeysProgressAuth,
  nowMs = Date.now(),
) => {
  const email = auth.email;
  const token = String(auth.token || '').trim();
  const localStore = await loadNormalizedWhiteKeysDailyGoalsStore(email, nowMs);

  if (!hasAuthToken(token)) {
    return {
      mode: 'local' as const,
      localStore,
      progress: buildProgress(localStore, nowMs),
    };
  }

  const remoteProgress = await fetchRemoteProgress(token);
  const remoteStore = progressToStore(remoteProgress);
  const mergedStore = mergeStoresForRemoteSync(remoteStore, localStore, nowMs);

  if (!storesAreEqual(mergedStore, remoteStore)) {
    const hydrated = await syncRemoteProgressSnapshot(token, mergedStore);
    await cacheProgressLocally(email, hydrated);
    return {
      mode: 'remote' as const,
      localStore,
      progress: hydrated,
    };
  }

  await cacheProgressLocally(email, remoteProgress);
  return {
    mode: 'remote' as const,
    localStore,
    progress: remoteProgress,
  };
};

const postRemoteOperation = async <T>(
  token: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  if (!response.ok) {
    throw new Error(`Remote operation failed for ${path}`);
  }

  return response.json() as Promise<T>;
};

export const makeHomeIntimidadesUnlockSignature = (pubId: string | number, createdAt: unknown) => {
  const id = String(pubId ?? '').trim();
  if (!id) {return '';}

  const toDate = (value: unknown): Date | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {return value;}

    const raw = String(value ?? '').trim();
    if (!raw) {return null;}

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {return null;}
    return parsed;
  };

  const rawCreatedAt = String(createdAt ?? '').trim();
  const parsedCreatedAt = toDate(createdAt);

  if (parsedCreatedAt) {
    return `${id}:${parsedCreatedAt.toISOString()}`;
  }

  return rawCreatedAt ? `${id}:${rawCreatedAt}` : id;
};

export const loadHomeIntimidadesDailyGoalProgress = async (auth: WhiteKeysProgressAuth = {}): Promise<HomeIntimidadesDailyGoalProgress> => {
  const nowMs = Date.now();

  try {
    const ensured = await ensureRemoteState(auth, nowMs);
    return ensured.progress;
  } catch {
    const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
    return buildProgress(store, nowMs);
  }
};

export const recordHomeIntimidadesUnlock = async (auth: WhiteKeysProgressAuth = {}, unlockSignature: string) => {
  const signature = String(unlockSignature || '').trim();
  const nowMs = Date.now();
  const token = String(auth.token || '').trim();

  try {
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyRecorded: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/home-intimidades/unlock',
        { unlockSignature: signature },
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (!signature || store.homeIntimidadesUnlockSignatures.includes(signature)) {
    return {
      alreadyRecorded: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    homeIntimidadesWindowStartedAt: store.homeIntimidadesWindowStartedAt ?? new Date(nowMs).toISOString(),
    homeIntimidadesUnlockSignatures: [...store.homeIntimidadesUnlockSignatures, signature],
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyRecorded: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimHomeIntimidadesDailyGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/home-intimidades/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.completed || progress.rewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    homeIntimidadesGoalRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + HOME_INTIMIDADES_DAILY_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const recordChannelHostThreadGoalCompletion = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyCompleted: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-host-thread/complete',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (store.channelHostThreadCompletedAt) {
    return {
      alreadyCompleted: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelHostThreadCompletedAt: new Date(nowMs).toISOString(),
    channelHostThreadRewardClaimed: false,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyCompleted: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelHostThreadGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-host-thread/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelHostThreadCompleted || progress.channelHostThreadRewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelHostThreadRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_HOST_THREAD_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const recordChannelHostImageUnlock = async (auth: WhiteKeysProgressAuth = {}, unlockKey: string) => {
  const signature = String(unlockKey || '').trim();
  const nowMs = Date.now();
  const token = String(auth.token || '').trim();

  try {
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyRecorded: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-host-images/unlock',
        { unlockKey: signature },
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (!signature || store.channelHostImageUnlockKeys.includes(signature)) {
    return {
      alreadyRecorded: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelHostImageWindowStartedAt: store.channelHostImageWindowStartedAt ?? new Date(nowMs).toISOString(),
    channelHostImageUnlockKeys: [...store.channelHostImageUnlockKeys, signature],
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyRecorded: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelHostImageGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-host-images/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelHostImageCompleted || progress.channelHostImageRewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelHostImageRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_HOST_IMAGE_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const recordProfilePublishGoalCompletion = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyCompleted: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/profile-publish/complete',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (store.profilePublishCompletedAt) {
    return {
      alreadyCompleted: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    profilePublishCompletedAt: new Date(nowMs).toISOString(),
    profilePublishRewardClaimed: false,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyCompleted: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimProfilePublishGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/profile-publish/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.profilePublishCompleted || progress.profilePublishRewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    profilePublishRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + PROFILE_PUBLISH_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const recordChannelEventCreateGoalCompletion = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyCompleted: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-event-create/complete',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (store.channelEventCreateCompletedAt) {
    return {
      alreadyCompleted: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelEventCreateCompletedAt: new Date(nowMs).toISOString(),
    channelEventCreateRewardClaimed: false,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyCompleted: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelEventCreateGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-event-create/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelEventCreateCompleted || progress.channelEventCreateRewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelEventCreateRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_EVENT_CREATE_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const recordChannelImageShareGoalCompletion = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ alreadyCompleted: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-image-share/complete',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  if (store.channelImageShareCompletedAt) {
    return {
      alreadyCompleted: true,
      ...buildProgress(store, nowMs),
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelImageShareCompletedAt: new Date(nowMs).toISOString(),
    channelImageShareRewardClaimed: false,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    alreadyCompleted: false,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelImageShareGoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-image-share/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelImageShareCompleted || progress.channelImageShareRewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelImageShareRewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_IMAGE_SHARE_GOAL_MAX_PROGRESS,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelAudience100GoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-audience-100/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelAudience100Completed || progress.channelAudience100RewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelAudience100RewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_AUDIENCE_100_GOAL_REWARD,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelAudience1000GoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-audience-1000/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelAudience1000Completed || progress.channelAudience1000RewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelAudience1000RewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_AUDIENCE_1000_GOAL_REWARD,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const claimChannelAudience10000GoalReward = async (auth: WhiteKeysProgressAuth = {}) => {
  const nowMs = Date.now();

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<{ claimedNow: boolean } & HomeIntimidadesDailyGoalProgress>(
        token,
        '/api/users/me/keys-progress/channel-audience-10000/claim',
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const progress = buildProgress(store, nowMs);

  if (!progress.channelAudience10000Completed || progress.channelAudience10000RewardClaimed) {
    return {
      claimedNow: false,
      ...progress,
    };
  }

  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    channelAudience10000RewardClaimed: true,
    whiteKeysBalance: sanitizeBalance(store.whiteKeysBalance) + CHANNEL_AUDIENCE_10000_GOAL_REWARD,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    claimedNow: true,
    ...buildProgress(nextStore, nowMs),
  };
};

export const convertWhiteKeysToGradientKeys = async (
  auth: WhiteKeysProgressAuth = {},
  whiteKeysAmount: number,
): Promise<WhiteToGradientConversionResult> => {
  const nowMs = Date.now();
  const sanitizedWhiteKeysAmount = sanitizeBalance(whiteKeysAmount);

  try {
    const token = String(auth.token || '').trim();
    if (hasAuthToken(token)) {
      await ensureRemoteState(auth, nowMs);
      const result = await postRemoteOperation<WhiteToGradientConversionResult>(
        token,
        '/api/users/me/keys-progress/convert-white-to-gradient',
        { whiteKeysAmount: sanitizedWhiteKeysAmount },
      );
      await cacheProgressLocally(auth.email, result);
      return result;
    }
  } catch {
    // Fall back to local persistence below.
  }

  const store = await loadNormalizedWhiteKeysDailyGoalsStore(auth.email, nowMs);
  const currentProgress = buildProgress(store, nowMs);

  if (
    sanitizedWhiteKeysAmount <= 0
    || sanitizedWhiteKeysAmount % WHITE_TO_GRADIENT_KEYS_RATE !== 0
  ) {
    return {
      converted: false,
      convertedWhiteKeys: 0,
      receivedGradientKeys: 0,
      reason: 'invalid-amount',
      ...currentProgress,
    };
  }

  const currentWhiteKeysBalance = sanitizeBalance(store.whiteKeysBalance);
  if (sanitizedWhiteKeysAmount > currentWhiteKeysBalance) {
    return {
      converted: false,
      convertedWhiteKeys: 0,
      receivedGradientKeys: 0,
      reason: 'insufficient-balance',
      ...currentProgress,
    };
  }

  const receivedGradientKeys = sanitizedWhiteKeysAmount / WHITE_TO_GRADIENT_KEYS_RATE;
  const nextStore: WhiteKeysDailyGoalsStore = {
    ...store,
    whiteKeysBalance: currentWhiteKeysBalance - sanitizedWhiteKeysAmount,
    gradientKeysBalance: sanitizeBalance(store.gradientKeysBalance) + receivedGradientKeys,
  };

  await saveWhiteKeysDailyGoalsStore(auth.email, nextStore);

  return {
    converted: true,
    convertedWhiteKeys: sanitizedWhiteKeysAmount,
    receivedGradientKeys,
    reason: null,
    ...buildProgress(nextStore, nowMs),
  };
};
