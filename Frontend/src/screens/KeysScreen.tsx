import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import {
  claimChannelAudience10000GoalReward,
  claimChannelAudience1000GoalReward,
  claimChannelAudience100GoalReward,
  claimChannelEventCreateGoalReward,
  claimChannelHostImageGoalReward,
  claimChannelHostThreadGoalReward,
  claimChannelImageShareGoalReward,
  claimHomeIntimidadesDailyGoalReward,
  claimProfilePublishGoalReward,
  loadHomeIntimidadesDailyGoalProgress,
  type HomeIntimidadesDailyGoalProgress,
} from '../services/whiteKeysProgress';

interface KeysScreenProps {
  onBack: () => void;
  authToken?: string;
  accountVerified?: boolean;
  onNavigateToAccountAuth?: () => void;
  userEmail?: string;
}

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-PT',
  de: 'de-DE',
  it: 'it-IT',
};

const DAILY_GOALS = [
  { textKey: 'keys.dailyGoal1', max: 20 },
  { textKey: 'keys.dailyGoal2', max: 20 },
  { textKey: 'keys.dailyGoal3', max: 50 },
  { textKey: 'keys.dailyGoal4', max: 10 },
  { textKey: 'keys.dailyGoal5', max: 10 },
  { textKey: 'keys.dailyGoal6', max: 10 },
  { textKey: 'keys.dailyGoal7', max: 100 },
  { textKey: 'keys.dailyGoal8', max: 1000 },
  { textKey: 'keys.dailyGoal9', max: 10000 },
] as const;

const KEY_ICON_SIZE = 44;

const KeyIcon = ({ size = KEY_ICON_SIZE }: { size?: number }) => (
  <MaterialCommunityIcons name="key-outline" size={size} color="#FFFFFF" />
);

const ActiveIndicator = () => (
  <Svg height="3" width="42">
    <Defs>
      <LinearGradient id="keys_tab_indicator_gradient" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#ff9900" stopOpacity="1" />
        <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="42" height="3" fill="url(#keys_tab_indicator_gradient)" rx="1.5" />
  </Svg>
);

const formatGoalValue = (value: number, language: string) => value.toLocaleString(LANGUAGE_TO_LOCALE[language] || 'en-US');

const formatCountdown = (timeRemainingMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

const DailyGoalProgress = ({ max, value, language }: { max: number; value: number; language: string }) => {
  const safeValue = Math.max(0, Math.min(value, max));
  const progressPercent = max > 0 ? (safeValue / max) * 100 : 0;

  return (
    <View style={styles.dailyGoalProgressContainer}>
      <View style={styles.dailyGoalTrack}>
        <View style={[styles.dailyGoalTrackFill, { width: `${progressPercent}%` }]} />
        <View style={[styles.dailyGoalThumb, { left: `${progressPercent}%` }]} />
        <View style={[styles.dailyGoalDot, styles.dailyGoalDotLeft]} />
        <View style={[styles.dailyGoalDot, styles.dailyGoalDotRight]} />
      </View>
      <View style={styles.dailyGoalScaleLabels}>
        <Text style={styles.dailyGoalScaleText}>{formatGoalValue(safeValue, language)}</Text>
        <Text style={styles.dailyGoalScaleText}>{formatGoalValue(max, language)}</Text>
      </View>
    </View>
  );
};

const useDailyGoalCountdown = (
  expiresAt: string | null,
  setExpiresAt: React.Dispatch<React.SetStateAction<string | null>>,
  setTimeRemainingMs: React.Dispatch<React.SetStateAction<number>>,
  reloadProgress: () => Promise<void>,
) => {
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemainingMs(0);
      return;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) {
      setExpiresAt(null);
      setTimeRemainingMs(0);
      return;
    }

    let cancelled = false;
    let didReloadAfterExpiry = false;

    const updateTimeRemaining = () => {
      const remaining = Math.max(0, expiresAtMs - Date.now());
      if (!cancelled) {
        setTimeRemainingMs(remaining);
      }

      if (remaining === 0 && !didReloadAfterExpiry) {
        didReloadAfterExpiry = true;
        reloadProgress().catch(() => {});
      }
    };

    updateTimeRemaining();
    const intervalId = setInterval(updateTimeRemaining, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [expiresAt, reloadProgress, setExpiresAt, setTimeRemainingMs]);
};

const KeysScreen = ({ onBack, authToken, accountVerified, onNavigateToAccountAuth, userEmail }: KeysScreenProps) => {
  const safeAreaInsets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const isLocked = !authToken || !accountVerified;
  const [dailyGoal1Progress, setDailyGoal1Progress] = useState(0);
  const [dailyGoal1RewardClaimed, setDailyGoal1RewardClaimed] = useState(false);
  const [dailyGoal1ExpiresAt, setDailyGoal1ExpiresAt] = useState<string | null>(null);
  const [dailyGoal1TimeRemainingMs, setDailyGoal1TimeRemainingMs] = useState(0);
  const [dailyGoal2Progress, setDailyGoal2Progress] = useState(0);
  const [dailyGoal2RewardClaimed, setDailyGoal2RewardClaimed] = useState(false);
  const [dailyGoal2ExpiresAt, setDailyGoal2ExpiresAt] = useState<string | null>(null);
  const [dailyGoal2TimeRemainingMs, setDailyGoal2TimeRemainingMs] = useState(0);
  const [dailyGoal3Progress, setDailyGoal3Progress] = useState(0);
  const [dailyGoal3RewardClaimed, setDailyGoal3RewardClaimed] = useState(false);
  const [dailyGoal3ExpiresAt, setDailyGoal3ExpiresAt] = useState<string | null>(null);
  const [dailyGoal3TimeRemainingMs, setDailyGoal3TimeRemainingMs] = useState(0);
  const [dailyGoal4Progress, setDailyGoal4Progress] = useState(0);
  const [dailyGoal4RewardClaimed, setDailyGoal4RewardClaimed] = useState(false);
  const [dailyGoal4ExpiresAt, setDailyGoal4ExpiresAt] = useState<string | null>(null);
  const [dailyGoal4TimeRemainingMs, setDailyGoal4TimeRemainingMs] = useState(0);
  const [dailyGoal5Progress, setDailyGoal5Progress] = useState(0);
  const [dailyGoal5RewardClaimed, setDailyGoal5RewardClaimed] = useState(false);
  const [dailyGoal5ExpiresAt, setDailyGoal5ExpiresAt] = useState<string | null>(null);
  const [dailyGoal5TimeRemainingMs, setDailyGoal5TimeRemainingMs] = useState(0);
  const [dailyGoal6Progress, setDailyGoal6Progress] = useState(0);
  const [dailyGoal6RewardClaimed, setDailyGoal6RewardClaimed] = useState(false);
  const [dailyGoal6ExpiresAt, setDailyGoal6ExpiresAt] = useState<string | null>(null);
  const [dailyGoal6TimeRemainingMs, setDailyGoal6TimeRemainingMs] = useState(0);
  const [dailyGoal7Progress, setDailyGoal7Progress] = useState(0);
  const [dailyGoal7RewardClaimed, setDailyGoal7RewardClaimed] = useState(false);
  const [dailyGoal7ExpiresAt, setDailyGoal7ExpiresAt] = useState<string | null>(null);
  const [dailyGoal7TimeRemainingMs, setDailyGoal7TimeRemainingMs] = useState(0);
  const [dailyGoal8Progress, setDailyGoal8Progress] = useState(0);
  const [dailyGoal8RewardClaimed, setDailyGoal8RewardClaimed] = useState(false);
  const [dailyGoal8ExpiresAt, setDailyGoal8ExpiresAt] = useState<string | null>(null);
  const [dailyGoal8TimeRemainingMs, setDailyGoal8TimeRemainingMs] = useState(0);
  const [dailyGoal9Progress, setDailyGoal9Progress] = useState(0);
  const [dailyGoal9RewardClaimed, setDailyGoal9RewardClaimed] = useState(false);
  const [dailyGoal9ExpiresAt, setDailyGoal9ExpiresAt] = useState<string | null>(null);
  const [dailyGoal9TimeRemainingMs, setDailyGoal9TimeRemainingMs] = useState(0);
  const [whiteKeysBalance, setWhiteKeysBalance] = useState(0);
  const [isClaimingDailyGoal1Reward, setIsClaimingDailyGoal1Reward] = useState(false);
  const [isClaimingDailyGoal2Reward, setIsClaimingDailyGoal2Reward] = useState(false);
  const [isClaimingDailyGoal3Reward, setIsClaimingDailyGoal3Reward] = useState(false);
  const [isClaimingDailyGoal4Reward, setIsClaimingDailyGoal4Reward] = useState(false);
  const [isClaimingDailyGoal5Reward, setIsClaimingDailyGoal5Reward] = useState(false);
  const [isClaimingDailyGoal6Reward, setIsClaimingDailyGoal6Reward] = useState(false);
  const [isClaimingDailyGoal7Reward, setIsClaimingDailyGoal7Reward] = useState(false);
  const [isClaimingDailyGoal8Reward, setIsClaimingDailyGoal8Reward] = useState(false);
  const [isClaimingDailyGoal9Reward, setIsClaimingDailyGoal9Reward] = useState(false);

  const applyProgressState = (progress: HomeIntimidadesDailyGoalProgress) => {
    setDailyGoal1Progress(progress.progress);
    setDailyGoal1RewardClaimed(progress.rewardClaimed);
    setDailyGoal1ExpiresAt(progress.expiresAt);
    setDailyGoal1TimeRemainingMs(progress.timeRemainingMs);
    setDailyGoal2Progress(progress.channelHostThreadProgress);
    setDailyGoal2RewardClaimed(progress.channelHostThreadRewardClaimed);
    setDailyGoal2ExpiresAt(progress.channelHostThreadExpiresAt);
    setDailyGoal2TimeRemainingMs(progress.channelHostThreadTimeRemainingMs);
    setDailyGoal3Progress(progress.channelHostImageProgress);
    setDailyGoal3RewardClaimed(progress.channelHostImageRewardClaimed);
    setDailyGoal3ExpiresAt(progress.channelHostImageExpiresAt);
    setDailyGoal3TimeRemainingMs(progress.channelHostImageTimeRemainingMs);
    setDailyGoal4Progress(progress.profilePublishProgress);
    setDailyGoal4RewardClaimed(progress.profilePublishRewardClaimed);
    setDailyGoal4ExpiresAt(progress.profilePublishExpiresAt);
    setDailyGoal4TimeRemainingMs(progress.profilePublishTimeRemainingMs);
    setDailyGoal5Progress(progress.channelEventCreateProgress);
    setDailyGoal5RewardClaimed(progress.channelEventCreateRewardClaimed);
    setDailyGoal5ExpiresAt(progress.channelEventCreateExpiresAt);
    setDailyGoal5TimeRemainingMs(progress.channelEventCreateTimeRemainingMs);
    setDailyGoal6Progress(progress.channelImageShareProgress);
    setDailyGoal6RewardClaimed(progress.channelImageShareRewardClaimed);
    setDailyGoal6ExpiresAt(progress.channelImageShareExpiresAt);
    setDailyGoal6TimeRemainingMs(progress.channelImageShareTimeRemainingMs);
    setDailyGoal7Progress(progress.channelAudience100Progress);
    setDailyGoal7RewardClaimed(progress.channelAudience100RewardClaimed);
    setDailyGoal7ExpiresAt(progress.channelAudience100ExpiresAt);
    setDailyGoal7TimeRemainingMs(progress.channelAudience100TimeRemainingMs);
    setDailyGoal8Progress(progress.channelAudience1000Progress);
    setDailyGoal8RewardClaimed(progress.channelAudience1000RewardClaimed);
    setDailyGoal8ExpiresAt(progress.channelAudience1000ExpiresAt);
    setDailyGoal8TimeRemainingMs(progress.channelAudience1000TimeRemainingMs);
    setDailyGoal9Progress(progress.channelAudience10000Progress);
    setDailyGoal9RewardClaimed(progress.channelAudience10000RewardClaimed);
    setDailyGoal9ExpiresAt(progress.channelAudience10000ExpiresAt);
    setDailyGoal9TimeRemainingMs(progress.channelAudience10000TimeRemainingMs);
    setWhiteKeysBalance(progress.whiteKeysBalance);
  };

  const loadDailyGoalProgress = useCallback(async (email = userEmail) => {
    if (isLocked) {return;}

    const progress = await loadHomeIntimidadesDailyGoalProgress({
      email,
      token: authToken,
    });
    applyProgressState(progress);
  }, [authToken, isLocked, userEmail]);

  useEffect(() => {
    if (isLocked) {return;}

    let didCancel = false;

    const loadProgress = async () => {
      const progress = await loadHomeIntimidadesDailyGoalProgress({
        email: userEmail,
        token: authToken,
      });
      if (!didCancel) {
        applyProgressState(progress);
      }
    };

    loadProgress();

    return () => {
      didCancel = true;
    };
  }, [authToken, isLocked, userEmail]);

  const reloadCurrentProgress = useCallback(async () => {
    await loadDailyGoalProgress(userEmail);
  }, [loadDailyGoalProgress, userEmail]);

  useDailyGoalCountdown(isLocked ? null : dailyGoal1ExpiresAt, setDailyGoal1ExpiresAt, setDailyGoal1TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal2ExpiresAt, setDailyGoal2ExpiresAt, setDailyGoal2TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal3ExpiresAt, setDailyGoal3ExpiresAt, setDailyGoal3TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal4ExpiresAt, setDailyGoal4ExpiresAt, setDailyGoal4TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal5ExpiresAt, setDailyGoal5ExpiresAt, setDailyGoal5TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal6ExpiresAt, setDailyGoal6ExpiresAt, setDailyGoal6TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal7ExpiresAt, setDailyGoal7ExpiresAt, setDailyGoal7TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal8ExpiresAt, setDailyGoal8ExpiresAt, setDailyGoal8TimeRemainingMs, reloadCurrentProgress);
  useDailyGoalCountdown(isLocked ? null : dailyGoal9ExpiresAt, setDailyGoal9ExpiresAt, setDailyGoal9TimeRemainingMs, reloadCurrentProgress);

  const handleClaimDailyGoal1Reward = async () => {
    if (isClaimingDailyGoal1Reward) {return;}

    setIsClaimingDailyGoal1Reward(true);
    try {
      const result = await claimHomeIntimidadesDailyGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal1Reward(false);
    }
  };

  const handleClaimDailyGoal2Reward = async () => {
    if (isClaimingDailyGoal2Reward) {return;}

    setIsClaimingDailyGoal2Reward(true);
    try {
      const result = await claimChannelHostThreadGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal2Reward(false);
    }
  };

  const handleClaimDailyGoal3Reward = async () => {
    if (isClaimingDailyGoal3Reward) {return;}

    setIsClaimingDailyGoal3Reward(true);
    try {
      const result = await claimChannelHostImageGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal3Reward(false);
    }
  };

  const handleClaimDailyGoal4Reward = async () => {
    if (isClaimingDailyGoal4Reward) {return;}

    setIsClaimingDailyGoal4Reward(true);
    try {
      const result = await claimProfilePublishGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal4Reward(false);
    }
  };

  const handleClaimDailyGoal5Reward = async () => {
    if (isClaimingDailyGoal5Reward) {return;}

    setIsClaimingDailyGoal5Reward(true);
    try {
      const result = await claimChannelEventCreateGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal5Reward(false);
    }
  };

  const handleClaimDailyGoal6Reward = async () => {
    if (isClaimingDailyGoal6Reward) {return;}

    setIsClaimingDailyGoal6Reward(true);
    try {
      const result = await claimChannelImageShareGoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal6Reward(false);
    }
  };

  const handleClaimDailyGoal7Reward = async () => {
    if (isClaimingDailyGoal7Reward) {return;}

    setIsClaimingDailyGoal7Reward(true);
    try {
      const result = await claimChannelAudience100GoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal7Reward(false);
    }
  };

  const handleClaimDailyGoal8Reward = async () => {
    if (isClaimingDailyGoal8Reward) {return;}

    setIsClaimingDailyGoal8Reward(true);
    try {
      const result = await claimChannelAudience1000GoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal8Reward(false);
    }
  };

  const handleClaimDailyGoal9Reward = async () => {
    if (isClaimingDailyGoal9Reward) {return;}

    setIsClaimingDailyGoal9Reward(true);
    try {
      const result = await claimChannelAudience10000GoalReward({
        email: userEmail,
        token: authToken,
      });
      applyProgressState(result);
    } finally {
      setIsClaimingDailyGoal9Reward(false);
    }
  };

  const getDailyGoalState = (textKey: (typeof DAILY_GOALS)[number]['textKey']) => {
    switch (textKey) {
      case 'keys.dailyGoal1':
        return {
          progress: dailyGoal1Progress,
          rewardClaimed: dailyGoal1RewardClaimed,
          isClaiming: isClaimingDailyGoal1Reward,
          timeRemainingMs: dailyGoal1TimeRemainingMs,
          onClaim: handleClaimDailyGoal1Reward,
        };
      case 'keys.dailyGoal2':
        return {
          progress: dailyGoal2Progress,
          rewardClaimed: dailyGoal2RewardClaimed,
          isClaiming: isClaimingDailyGoal2Reward,
          timeRemainingMs: dailyGoal2TimeRemainingMs,
          onClaim: handleClaimDailyGoal2Reward,
        };
      case 'keys.dailyGoal3':
        return {
          progress: dailyGoal3Progress,
          rewardClaimed: dailyGoal3RewardClaimed,
          isClaiming: isClaimingDailyGoal3Reward,
          timeRemainingMs: dailyGoal3TimeRemainingMs,
          onClaim: handleClaimDailyGoal3Reward,
        };
      case 'keys.dailyGoal4':
        return {
          progress: dailyGoal4Progress,
          rewardClaimed: dailyGoal4RewardClaimed,
          isClaiming: isClaimingDailyGoal4Reward,
          timeRemainingMs: dailyGoal4TimeRemainingMs,
          onClaim: handleClaimDailyGoal4Reward,
        };
      case 'keys.dailyGoal5':
        return {
          progress: dailyGoal5Progress,
          rewardClaimed: dailyGoal5RewardClaimed,
          isClaiming: isClaimingDailyGoal5Reward,
          timeRemainingMs: dailyGoal5TimeRemainingMs,
          onClaim: handleClaimDailyGoal5Reward,
        };
      case 'keys.dailyGoal6':
        return {
          progress: dailyGoal6Progress,
          rewardClaimed: dailyGoal6RewardClaimed,
          isClaiming: isClaimingDailyGoal6Reward,
          timeRemainingMs: dailyGoal6TimeRemainingMs,
          onClaim: handleClaimDailyGoal6Reward,
        };
      case 'keys.dailyGoal7':
        return {
          progress: dailyGoal7Progress,
          rewardClaimed: dailyGoal7RewardClaimed,
          isClaiming: isClaimingDailyGoal7Reward,
          timeRemainingMs: dailyGoal7TimeRemainingMs,
          onClaim: handleClaimDailyGoal7Reward,
        };
      case 'keys.dailyGoal8':
        return {
          progress: dailyGoal8Progress,
          rewardClaimed: dailyGoal8RewardClaimed,
          isClaiming: isClaimingDailyGoal8Reward,
          timeRemainingMs: dailyGoal8TimeRemainingMs,
          onClaim: handleClaimDailyGoal8Reward,
        };
      case 'keys.dailyGoal9':
        return {
          progress: dailyGoal9Progress,
          rewardClaimed: dailyGoal9RewardClaimed,
          isClaiming: isClaimingDailyGoal9Reward,
          timeRemainingMs: dailyGoal9TimeRemainingMs,
          onClaim: handleClaimDailyGoal9Reward,
        };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { height: 56 + safeAreaInsets.top, paddingTop: safeAreaInsets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('common.keys')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {isLocked ? (
          <View style={styles.lockedContent}>
            <MaterialIcons name="lock" size={44} color="rgba(255,255,255,0.7)" />
            <Text style={styles.lockedText}>{t('keys.lockedMessage')}</Text>
            {onNavigateToAccountAuth ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onNavigateToAccountAuth}
                style={styles.lockedActionButton}
              >
                <Svg
                  pointerEvents="none"
                  style={styles.lockedActionButtonBorder}
                  viewBox="0 0 100 48"
                  preserveAspectRatio="none"
                >
                  <Defs>
                    <LinearGradient id="keys_locked_action_button_gradient" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                      <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x="1"
                    y="1"
                    width="98"
                    height="46"
                    rx="14"
                    fill="none"
                    stroke="url(#keys_locked_action_button_gradient)"
                    strokeWidth="2"
                  />
                </Svg>
                <MaterialIcons name="verified-user" size={18} color="#FFFFFF" />
                <Text style={styles.lockedActionButtonText}>{t('securityControl.accountAuth')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.dailyGoalsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dailyGoalsPanel}>
              <Text style={styles.dailyGoalsPanelTitle}>{t('keys.dailyGoals')}</Text>
              {DAILY_GOALS.map((goal, index) => {
                const goalState = getDailyGoalState(goal.textKey);
                const isCompleted = goalState.progress >= goal.max;
                const isButtonEnabled = isCompleted && !goalState.rewardClaimed && !goalState.isClaiming;
                const shouldShowCountdown = goalState.timeRemainingMs > 0;

                return (
                  <View key={`${index}-${goal.max}`} style={styles.dailyGoalItem}>
                    <Text style={styles.dailyGoalText}>{t(goal.textKey)}</Text>
                    <DailyGoalProgress max={goal.max} value={goalState.progress} language={language} />
                    <View style={styles.dailyGoalActionRow}>
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled={!isButtonEnabled}
                        onPress={goalState.onClaim}
                        style={[
                          styles.dailyGoalCompleteButton,
                          !isButtonEnabled ? styles.dailyGoalCompleteButtonDisabled : null,
                        ]}
                      >
                        <Text style={styles.dailyGoalCompleteButtonText}>{t('verifyKeinti.completed')}</Text>
                      </TouchableOpacity>
                      {shouldShowCountdown ? (
                        <View style={styles.dailyGoalCountdownPill}>
                          <MaterialIcons name="schedule" size={13} color="#FFB74D" />
                          <Text style={styles.dailyGoalCountdownText}>{formatCountdown(goalState.timeRemainingMs)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {!isLocked ? (
        <View style={[styles.bottomTabsShell, { paddingBottom: Math.max(safeAreaInsets.bottom, 18) }]}>
          <View style={styles.bottomTabsRow}>
            <View style={styles.bottomTab}>
              <KeyIcon />
              <Text style={[styles.counterText, styles.counterTextActive]}>
                {formatGoalValue(whiteKeysBalance, language)}
              </Text>
              <View style={styles.indicatorSlot}>
                <ActiveIndicator />
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#000000',
  },
  lockedContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 44,
  },
  lockedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  lockedActionButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  lockedActionButtonBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  lockedActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dailyGoalsContent: {
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  dailyGoalsPanel: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dailyGoalsPanelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  dailyGoalItem: {
    marginBottom: 18,
  },
  dailyGoalText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  dailyGoalProgressContainer: {
    marginTop: 4,
  },
  dailyGoalTrack: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    position: 'relative',
    marginHorizontal: 8,
    marginVertical: 10,
  },
  dailyGoalTrackFill: {
    height: '100%',
    backgroundColor: '#FFB74D',
    borderRadius: 2,
  },
  dailyGoalThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFB74D',
    marginLeft: -8,
  },
  dailyGoalDot: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dailyGoalDotLeft: {
    left: -4,
    backgroundColor: '#FFB74D',
  },
  dailyGoalDotRight: {
    right: -4,
    backgroundColor: '#555555',
  },
  dailyGoalScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dailyGoalScaleText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  dailyGoalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  dailyGoalCompleteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  dailyGoalCompleteButtonDisabled: {
    opacity: 0.4,
  },
  dailyGoalCompleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dailyGoalCountdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.45)',
  },
  dailyGoalCountdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bottomTabsShell: {
    backgroundColor: '#000000',
    paddingTop: 12,
  },
  bottomTabsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  bottomTab: {
    width: 108,
    alignItems: 'center',
  },
  counterText: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 24,
    letterSpacing: 0.2,
  },
  counterTextActive: {
    fontWeight: '700',
  },
  indicatorSlot: {
    marginTop: 8,
    minHeight: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default KeysScreen;
