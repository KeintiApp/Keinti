import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, GestureResponderEvent, Image, Linking, Modal, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import ImageCropPicker from 'react-native-image-crop-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import { API_URL, getServerResourceUrl } from '../config/api';
import { POLICY_URLS, type PolicyUrlKey } from '../config/policies';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { adminReviewAccountSelfie, changeMyPassword, deleteMyAccount, getAccountAuthStatus, getAdminBlockedAccountSelfies, getAdminPendingAccountSelfies, getMyChannelJoinsProgress, getMyDevicePermissions, getMyGroupsActiveMembersProgress, getMyIntimidadesOpensProgress, getMyPersonalData, getMyProfilePublishesProgress, getTotpSetup, setMyDevicePermissions, updateMyNationality, updatePreferredLanguage, uploadAccountSelfie, verifyKeintiAccount, verifyMyPassword, verifyTotpCode } from '../services/userService';
import PasswordResetModal from '../components/PasswordResetModal';
import HighlightedI18nText from '../components/HighlightedI18nText';
import { COUNTRIES } from '../constants/countries';

const ANDROID_TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

interface ConfigurationProps {
  onBack: () => void;
  authToken: string;
  onLogout: () => void;
  onAccountVerifiedChange?: (verified: boolean) => void;
}

type Language = 'es' | 'en';
type Screen =
  | 'main'
  | 'accountCenter'
  | 'personalData'
  | 'securityControl'
  | 'accountAuth'
  | 'adminSelfies'
  | 'verifyKeinti'
  | 'privacyPolicy'
  | 'cookiesAdPolicy'
  | 'termsOfUse'
  | 'changePassword'
  | 'blockedUsers'
  | 'devicePermissions'
  | 'aboutKeinti'
  | 'moreAboutKeinti';

type GalleryPermissionStatus = 'granted' | 'denied' | 'unknown';

const VerifiedBadgeIcon = ({
  size,
  variant = 'solid',
  solidColor = '#FFFFFF',
  solidOpacity = 0.6,
  gradientColors = ['#FFB74D', '#ffec5aff'],
  checkColor = '#000000',
}: {
  size: number;
  variant?: 'solid' | 'gradient';
  solidColor?: string;
  solidOpacity?: number;
  gradientColors?: [string, string];
  checkColor?: string;
}) => {
  const gradientIdRef = useRef(`verified_badge_${size}_${Math.random().toString(16).slice(2)}`);
  const gradientId = gradientIdRef.current;

  const badgeFill =
    variant === 'gradient'
      ? (`url(#${gradientId})` as any)
      : (solidColor as any);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {variant === 'gradient' ? (
        <Defs>
          {/* Same gradient used in FrontScreen.tsx (next_grad) */}
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={gradientColors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradientColors[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
      ) : null}

      {/* Badge */}
      <Path
        d="M23 12l-2.44-2.79.34-3.7-3.61-.82-1.89-3.2L12 2.76 8.6 1.49 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.24l3.4 1.27 1.89-3.2 3.61-.82-.34-3.7L23 12z"
        fill={badgeFill}
        opacity={variant === 'solid' ? solidOpacity : 1}
      />

      {/* Check */}
      <Path
        d="M9 16.17l-3.5-3.5 1.41-1.41L9 13.35l7.09-7.09 1.41 1.41z"
        fill={checkColor}
      />
    </Svg>
  );
};

const getAndroidGalleryPermission = () => {
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  return apiLevel >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
};

type BlockedUser = {
  group_id: number;
  group_hashtag?: string | null;
  email: string;
  username: string;
  profile_photo_uri?: string | null;
  block_reason?: string | null;
};

const SettingRow = ({
  title,
  leftIcon,
  leftIconColor = '#FFB74D',
  right,
  onPress,
  showTopBorder = true,
  showChevron = true,
}: {
  title: string;
  leftIcon: string;
  leftIconColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  showTopBorder?: boolean;
  showChevron?: boolean;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, !showTopBorder && styles.rowNoTopBorder]}
    >
      <View style={styles.rowLeft}>
        <MaterialIcons name={leftIcon} size={22} color={leftIconColor} />
        <Text style={styles.rowTitle}>{title}</Text>
      </View>

      <View style={styles.rowRight}>
        {right}
        {showChevron ? <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  );
};

const SimpleSettingRow = ({
  title,
  showTopBorder = true,
  onPress,
  rightIconName,
  right,
  showChevron = true,
}: {
  title: string;
  showTopBorder?: boolean;
  onPress?: () => void;
  rightIconName?: string;
  right?: React.ReactNode;
  showChevron?: boolean;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, !showTopBorder && styles.rowNoTopBorder]}
    >
      <Text style={styles.rowTitle}>{title}</Text>
      {right ??
        (rightIconName ? (
          <MaterialIcons name={rightIconName as any} size={22} color="#FFFFFF" style={{ opacity: 0.6 }} />
        ) : showChevron ? (
          <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
        ) : null)}
    </TouchableOpacity>
  );
};

const PersonalDataItem = ({
  title,
  value,
  isFirst = false,
  onPress,
  children,
}: {
  title: string;
  value?: string;
  isFirst?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) => {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.personalDataItem, isFirst && styles.personalDataItemNoTopBorder]}
    >
      <Text style={styles.personalDataItemTitle}>{title}</Text>
      {value ? <Text style={styles.personalDataItemValue}>{value}</Text> : null}
      {children}
    </Container>
  );
};

const Configuration = ({ onBack, authToken, onLogout, onAccountVerifiedChange }: ConfigurationProps) => {
  const { language, setLanguage, t } = useI18n();
  const safeAreaInsets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('main');
  const [verifyTab, setVerifyTab] = useState<'objectives' | 'benefits'>('objectives');
  const [showImportantNoticePanel, setShowImportantNoticePanel] = useState(false);

  // Merge static content padding with the dynamic bottom safe-area inset so
  // scroll content is never hidden behind the Android navigation bar.
  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: 24 + safeAreaInsets.bottom }],
    [safeAreaInsets.bottom],
  );

  const formatNumber = useMemo(() => {
    try {
      const locale = language === 'es' ? 'es-ES' : 'en-US';
      const nf = new Intl.NumberFormat(locale);
      return (n: number) => nf.format(Math.floor(Number(n) || 0));
    } catch {
      return (n: number) => String(Math.floor(Number(n) || 0));
    }
  }, [language]);

  const openPolicyUrl = async (key: PolicyUrlKey) => {
    const url = POLICY_URLS[key];
    if (!url) {
      Alert.alert('URL no configurada', 'Configura una URL pública para esta política.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(language === 'en' ? 'Cannot open link' : 'No se puede abrir el enlace', url);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(language === 'en' ? 'Cannot open link' : 'No se pudo abrir el enlace', url);
    }
  };

  const [verifyObjective2Progress, setVerifyObjective2Progress] = useState<number>(0);
  const VERIFY_OBJECTIVE2_TARGET = 100000;
  const verifyObjective2ProgressClamped = Math.min(
    VERIFY_OBJECTIVE2_TARGET,
    Math.max(0, Math.floor(verifyObjective2Progress))
  );
  const isVerifyObjective2Completed = verifyObjective2ProgressClamped >= VERIFY_OBJECTIVE2_TARGET;
  const [verifyObjective6Progress, setVerifyObjective6Progress] = useState<number>(0);
  const VERIFY_OBJECTIVE6_TARGET = 40;
  const verifyObjective6ProgressClamped = Math.min(
    VERIFY_OBJECTIVE6_TARGET,
    Math.max(0, Math.floor(verifyObjective6Progress))
  );
  const isVerifyObjective6Completed = verifyObjective6ProgressClamped >= VERIFY_OBJECTIVE6_TARGET;

  const [verifyObjective4Progress, setVerifyObjective4Progress] = useState<number>(0);
  const VERIFY_OBJECTIVE4_TARGET = 100000;
  const verifyObjective4ProgressClamped = Math.min(
    VERIFY_OBJECTIVE4_TARGET,
    Math.max(0, Math.floor(verifyObjective4Progress))
  );
  const isVerifyObjective4Completed = verifyObjective4ProgressClamped >= VERIFY_OBJECTIVE4_TARGET;

  const [verifyObjective5GroupsCreated, setVerifyObjective5GroupsCreated] = useState<number>(0);
  const [verifyObjective5ActiveMembers, setVerifyObjective5ActiveMembers] = useState<number>(0);
  const VERIFY_OBJECTIVE5_TARGET = 200;
  const verifyObjective5ProgressClamped = Math.min(
    VERIFY_OBJECTIVE5_TARGET,
    Math.max(0, Math.floor(verifyObjective5ActiveMembers))
  );
  const isVerifyObjective5Completed =
    Math.max(0, Math.floor(verifyObjective5GroupsCreated)) >= 1 &&
    verifyObjective5ProgressClamped >= VERIFY_OBJECTIVE5_TARGET;


  const getLocalizedGender = (rawGender: string) => {
    const normalized = String(rawGender || '').trim().toLowerCase();
    if (!normalized) return '';

    // Backend might store Spanish values from registration (e.g. Hombre/Mujer/No especificar)
    // or canonical-ish values. We map known values to translated labels.
    if (['hombre', 'man', 'male', 'm'].includes(normalized)) return t('gender.male');
    if (['mujer', 'woman', 'female', 'f'].includes(normalized)) return t('gender.female');
    if (
      [
        'no especificar',
        'no especificado',
        'unspecified',
        'prefer not to say',
        'prefer_not_to_say',
        'none',
      ].includes(normalized)
    ) {
      return t('gender.unspecified');
    }

    return rawGender;
  };

  const CONTACT_EMAIL = 'keintisoporte@gmail.com';

  const [galleryPermissionStatus, setGalleryPermissionStatus] = useState<GalleryPermissionStatus>('unknown');
  const [isCheckingDevicePermissions, setIsCheckingDevicePermissions] = useState(false);
  const lastSyncedGalleryPermissionRef = useRef<GalleryPermissionStatus>('unknown');

  const [isLoadingPersonalData, setIsLoadingPersonalData] = useState(false);
  const [myEmail, setMyEmail] = useState<string>('');
  const [myBirthDate, setMyBirthDate] = useState<string>('');
  const [myGender, setMyGender] = useState<string>('');
  const [myNationality, setMyNationality] = useState<string>('');
  const [myUsername, setMyUsername] = useState<string>('');
  const [isBackendAdmin, setIsBackendAdmin] = useState(false);

  const [adminSelfiesTab, setAdminSelfiesTab] = useState<'pending' | 'blocked'>('pending');
  const [isLoadingAdminSelfies, setIsLoadingAdminSelfies] = useState(false);
  const [adminPendingSelfies, setAdminPendingSelfies] = useState<any[]>([]);
  const [adminBlockedSelfies, setAdminBlockedSelfies] = useState<any[]>([]);
  const [adminReasonByEmail, setAdminReasonByEmail] = useState<Record<string, string>>({});
  const [adminSelfiePreviewUri, setAdminSelfiePreviewUri] = useState<string | null>(null);

  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isUpdatingNationality, setIsUpdatingNationality] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(false);
  const [showCurrentPasswordError, setShowCurrentPasswordError] = useState(false);
  const [currentPasswordAttemptsRemaining, setCurrentPasswordAttemptsRemaining] = useState<number | null>(null);
  const [currentPasswordLockUntil, setCurrentPasswordLockUntil] = useState<string | null>(null);
  const [lockNowTick, setLockNowTick] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [repeatNewPassword, setRepeatNewPassword] = useState('');
  const [showRepeatNewPassword, setShowRepeatNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordResetVisible, setPasswordResetVisible] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [expandedBlockedReasons, setExpandedBlockedReasons] = useState<Record<string, boolean>>({});
  const [userToUnlock, setUserToUnlock] = useState<BlockedUser | null>(null);
  const [unlockPosition, setUnlockPosition] = useState<{ top: number; right: number } | null>(null);
  const [isUnlockingUser, setIsUnlockingUser] = useState(false);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const deleteAccountSheetAnim = useRef(new Animated.Value(0)).current;

  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutSheetAnim = useRef(new Animated.Value(0)).current;

  const [showAuthSuccessModal, setShowAuthSuccessModal] = useState(false);
  const [showRevokeGalleryPermissionModal, setShowRevokeGalleryPermissionModal] = useState(false);
  const [isRevokingGalleryPermission, setIsRevokingGalleryPermission] = useState(false);

  const [isLoadingAccountAuth, setIsLoadingAccountAuth] = useState(false);
  const [accountSelfieStatus, setAccountSelfieStatus] = useState<'not_submitted' | 'pending' | 'accepted' | 'failed'>('not_submitted');
  const [accountSelfieFailReason, setAccountSelfieFailReason] = useState<string | null>(null);
  const [accountSelfieBlocked, setAccountSelfieBlocked] = useState(false);
  const [accountSelfieBlockedReason, setAccountSelfieBlockedReason] = useState<string | null>(null);
  const [accountTotpEnabled, setAccountTotpEnabled] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [keintiVerified, setKeintiVerified] = useState(false);
  const [isVerifyingKeinti, setIsVerifyingKeinti] = useState(false);
  const [accountVerifiedExpiresAtMs, setAccountVerifiedExpiresAtMs] = useState<number | null>(null);
  const [accountVerifiedCountdownNowMs, setAccountVerifiedCountdownNowMs] = useState<number>(Date.now());
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [isLoadingTotpSetup, setIsLoadingTotpSetup] = useState(false);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);

  const formatCountdown = (ms: number) => {
    // Usamos ceil para evitar mostrar 00:00:00 antes de tiempo.
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

  const expireVerificationLocal = () => {
    setAccountVerified(false);
    setAccountTotpEnabled(false);
    setAccountVerifiedExpiresAtMs(null);
    setTotpSecret('');
    setTotpCode('');
    setAccountSelfieStatus('not_submitted');
    setAccountSelfieFailReason(null);
    setAccountSelfieBlocked(false);
    setAccountSelfieBlockedReason(null);
    onAccountVerifiedChange?.(false);
    refreshAccountAuth();
  };

  const languageLabel = useMemo(
    () => (language === 'es' ? t('language.spanish') : t('language.english')),
    [language, t]
  );

  const handleBack = () => {
    if (screen === 'devicePermissions') {
      setScreen('main');
      return;
    }

    if (screen === 'aboutKeinti') {
      setScreen('main');
      return;
    }

    if (screen === 'moreAboutKeinti') {
      setScreen('aboutKeinti');
      return;
    }

    if (screen === 'privacyPolicy') {
      setScreen('aboutKeinti');
      return;
    }

    if (screen === 'cookiesAdPolicy') {
      setScreen('aboutKeinti');
      return;
    }

    if (screen === 'termsOfUse') {
      setScreen('aboutKeinti');
      return;
    }

    if (screen === 'verifyKeinti') {
      setScreen('securityControl');
      return;
    }

    if (screen === 'personalData') {
      setScreen('accountCenter');
      return;
    }

    if (screen === 'securityControl') {
      setScreen('accountCenter');
      return;
    }

    if (screen === 'accountAuth') {
      setScreen('securityControl');
      return;
    }

    if (screen === 'adminSelfies') {
      setScreen('accountCenter');
      return;
    }

    if (screen === 'changePassword') {
      setScreen('securityControl');
      return;
    }

    if (screen === 'accountCenter' || screen === 'blockedUsers') {
      setScreen('main');
      return;
    }

    onBack();
  };

  const refreshAccountAuth = async () => {
    if (!authToken) return;
    if (screen !== 'accountAuth' && screen !== 'verifyKeinti') return;

    setIsLoadingAccountAuth(true);
    try {
      const data = await getAccountAuthStatus(authToken);
      setAccountSelfieStatus(data.selfie.status);
      setAccountSelfieFailReason(data.selfie.fail_reason);
      setAccountSelfieBlocked(!!(data.selfie as any)?.blocked);
      setAccountSelfieBlockedReason(((data.selfie as any)?.blocked_reason ?? null) as any);
      setAccountTotpEnabled(!!data.totp.enabled);
      setAccountVerified(!!data.account_verified);
      setKeintiVerified(!!(data as any)?.keinti_verified);

      const expiresAt = data.account_verified_expires_at;
      const expiresAtMs = expiresAt ? new Date(String(expiresAt)).getTime() : NaN;
      setAccountVerifiedExpiresAtMs(Number.isFinite(expiresAtMs) ? expiresAtMs : null);

      // Si el backend ya lo marcó como no verificado, limpiamos inputs.
      if (!data.account_verified) {
        setTotpSecret('');
        setTotpCode('');
      }
    } catch {
      // ignore (UI will show last known state)
    } finally {
      setIsLoadingAccountAuth(false);
    }
  };

  // Keep admin flag reasonably fresh (used to show admin-only tools).
  useEffect(() => {
    const fetchAdminFlag = async () => {
      if (!authToken) {
        setIsBackendAdmin(false);
        return;
      }

      try {
        const me = await getMyPersonalData(authToken);
        setIsBackendAdmin(!!(me as any)?.is_admin);
      } catch {
        setIsBackendAdmin(false);
      }
    };

    fetchAdminFlag();
  }, [authToken]);

  const canVerifyKeinti =
    accountVerified &&
    isVerifyObjective2Completed &&
    isVerifyObjective6Completed &&
    isVerifyObjective4Completed &&
    isVerifyObjective5Completed;

  const lockVerifyKeintiObjectivesAsCompleted = () => {
    setVerifyObjective2Progress(VERIFY_OBJECTIVE2_TARGET);
    setVerifyObjective6Progress(VERIFY_OBJECTIVE6_TARGET);
    setVerifyObjective4Progress(VERIFY_OBJECTIVE4_TARGET);
    setVerifyObjective5GroupsCreated((prev) => Math.max(1, Math.floor(Number(prev) || 0)));
    setVerifyObjective5ActiveMembers(VERIFY_OBJECTIVE5_TARGET);
  };

  const handleVerifyKeinti = async () => {
    if (!authToken) return;
    if (!canVerifyKeinti) return;
    if (isVerifyingKeinti || keintiVerified) return;

    setIsVerifyingKeinti(true);
    try {
      await verifyKeintiAccount(authToken);
      lockVerifyKeintiObjectivesAsCompleted();
      setKeintiVerified(true);
      refreshAccountAuth();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', msg || 'No se pudo verificar');
    } finally {
      setIsVerifyingKeinti(false);
    }
  };

  const refreshVerifyKeintiProgress = async () => {
    if (!authToken) return;
    if (screen !== 'verifyKeinti') return;
    // Once Keinti is verified, keep objectives fixed (no more resets due to refreshes).
    if (keintiVerified) return;

    try {
      const [intimidades, profilePublishes, joins, groups] = await Promise.all([
        getMyIntimidadesOpensProgress(authToken),
        getMyProfilePublishesProgress(authToken),
        getMyChannelJoinsProgress(authToken),
        getMyGroupsActiveMembersProgress(authToken),
      ]);

      const totalIntimidades = Number((intimidades as any)?.total);
      setVerifyObjective2Progress(Number.isFinite(totalIntimidades) ? Math.max(0, totalIntimidades) : 0);
      const totalProfilePublishes = Number((profilePublishes as any)?.total);
      setVerifyObjective6Progress(Number.isFinite(totalProfilePublishes) ? Math.max(0, totalProfilePublishes) : 0);

      const totalJoins = Number((joins as any)?.total);
      setVerifyObjective4Progress(Number.isFinite(totalJoins) ? Math.max(0, totalJoins) : 0);

      const groupsCreated = Number((groups as any)?.groupsCreated);
      setVerifyObjective5GroupsCreated(Number.isFinite(groupsCreated) ? Math.max(0, groupsCreated) : 0);

      const activeMembers = Number((groups as any)?.activeMembers);
      setVerifyObjective5ActiveMembers(Number.isFinite(activeMembers) ? Math.max(0, activeMembers) : 0);
    } catch {
      // ignore (keep last known value)
    }
  };

  // If the backend reports Keinti already verified, lock the UI objectives as completed.
  useEffect(() => {
    if (!keintiVerified) return;
    lockVerifyKeintiObjectivesAsCompleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keintiVerified]);

  // Tick del contador de expiración mientras esté verificado.
  useEffect(() => {
    if (!accountVerified || !accountVerifiedExpiresAtMs) return;
    const id = setInterval(() => setAccountVerifiedCountdownNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [accountVerified, accountVerifiedExpiresAtMs]);

  // Expira exactamente al finalizar la cuenta atrás.
  useEffect(() => {
    if (!accountVerified || !accountVerifiedExpiresAtMs) return;

    const msLeft = accountVerifiedExpiresAtMs - Date.now();
    if (msLeft <= 0) {
      expireVerificationLocal();
      return;
    }

    const timeoutId = setTimeout(() => {
      setAccountVerifiedCountdownNowMs(Date.now());
      expireVerificationLocal();
    }, msLeft);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountVerified, accountVerifiedExpiresAtMs]);

  const refreshDevicePermissions = async () => {
    if (screen !== 'devicePermissions') return;

    setIsCheckingDevicePermissions(true);
    try {
      // 1) Base: estado que la app tiene registrado en backend (persistente)
      if (authToken) {
        const backend = await getMyDevicePermissions(authToken);
        const backendStatus: GalleryPermissionStatus = backend.galleryPermissionGranted ? 'granted' : 'denied';
        setGalleryPermissionStatus(backendStatus);
        lastSyncedGalleryPermissionRef.current = backendStatus;

        // 2) En Android, si backend dice granted pero el sistema no lo tiene, corregimos a denied.
        if (backend.galleryPermissionGranted && Platform.OS === 'android') {
          const permission = getAndroidGalleryPermission();
          if (permission) {
            const osGranted = await PermissionsAndroid.check(permission);
            if (!osGranted) {
              setGalleryPermissionStatus('denied');
              lastSyncedGalleryPermissionRef.current = 'denied';
              setMyDevicePermissions(authToken, { galleryPermissionGranted: false }).catch(() => {});
            }
          }
        }

        return;
      }

      // Sin sesión: solo podemos reflejar estado del sistema (Android). En iOS queda unknown.
      if (Platform.OS !== 'android') {
        setGalleryPermissionStatus('unknown');
        return;
      }

      const permission = getAndroidGalleryPermission();
      if (!permission) {
        setGalleryPermissionStatus('unknown');
        return;
      }

      const osGranted = await PermissionsAndroid.check(permission);
      setGalleryPermissionStatus(osGranted ? 'granted' : 'denied');
    } catch {
      setGalleryPermissionStatus('unknown');
    } finally {
      setIsCheckingDevicePermissions(false);
    }
  };

  useEffect(() => {
    refreshDevicePermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    refreshAccountAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    refreshVerifyKeintiProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, authToken]);


  useEffect(() => {
    if (screen !== 'devicePermissions') return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshDevicePermissions();
      }
    });

    return () => {
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const requestOrOpenGalleryPermission = async () => {
    if (Platform.OS !== 'android') {
      // En iOS solo podemos abrir ajustes de la app.
      await Linking.openSettings();
      return;
    }

    const permission = getAndroidGalleryPermission();

    if (!permission) {
      return;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(permission);
      if (alreadyGranted) {
        // Aunque el sistema ya lo tenga, si estamos aquí es porque el estado de la app era "No concedido".
        // Marcamos el estado como concedido en backend.
        if (authToken) {
          await setMyDevicePermissions(authToken, { galleryPermissionGranted: true }).catch(() => {});
          lastSyncedGalleryPermissionRef.current = 'granted';
          setGalleryPermissionStatus('granted');
        } else {
          setGalleryPermissionStatus('granted');
        }
        return;
      }

      const result = await PermissionsAndroid.request(permission, {
        title: t('devicePermissions.osRequestTitle'),
        message: t('devicePermissions.osRequestMessage'),
        buttonNeutral: t('devicePermissions.osRequestAskLater'),
        buttonNegative: t('devicePermissions.osRequestDeny'),
        buttonPositive: t('devicePermissions.osRequestAllow'),
      });

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        if (authToken) {
          await setMyDevicePermissions(authToken, { galleryPermissionGranted: true }).catch(() => {});
          lastSyncedGalleryPermissionRef.current = 'granted';
        }
        setGalleryPermissionStatus('granted');
        return;
      }

      // Si está denegado permanentemente, llevar a ajustes.
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permiso requerido',
          'Para concederlo, abre Ajustes > Permisos y permite el acceso a Fotos.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
          ]
        );
      }

      setGalleryPermissionStatus('denied');
      if (authToken) {
        await setMyDevicePermissions(authToken, { galleryPermissionGranted: false }).catch(() => {});
        lastSyncedGalleryPermissionRef.current = 'denied';
      }
    } catch {
      // ignore
    } finally {
      // Si el usuario concedió desde ajustes o diálogo, se reflejará al volver/recargar
      refreshDevicePermissions();
    }
  };

  const confirmRevokeGalleryPermission = () => {
    setShowRevokeGalleryPermissionModal(true);
  };

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (screen !== 'blockedUsers') return;
      if (!authToken) {
        setBlockedUsers([]);
        setExpandedBlockedReasons({});
        return;
      }

      setIsLoadingBlockedUsers(true);
      try {
        const resp = await fetch(`${API_URL}/api/group-requests/blocked`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!resp.ok) {
          setBlockedUsers([]);
          return;
        }

        const data = await resp.json();
        if (!Array.isArray(data)) {
          setBlockedUsers([]);
          return;
        }

        const cleaned = (data as any[])
          .map((u: any) => ({
            group_id: Number(u?.group_id ?? u?.groupId ?? 0),
            group_hashtag: u?.group_hashtag ?? u?.groupHashtag ?? u?.group_hashtag ?? null,
            email: String(u?.email || '').trim(),
            username: String(u?.username || '').trim(),
            profile_photo_uri: u?.profile_photo_uri ?? null,
            block_reason: u?.block_reason ?? u?.blockReason ?? u?.reason ?? null,
          }))
          .filter(u => !!u.email && Number.isFinite(u.group_id) && u.group_id > 0);

        setBlockedUsers(cleaned);
        setExpandedBlockedReasons({});
      } catch {
        setBlockedUsers([]);
        setExpandedBlockedReasons({});
      } finally {
        setIsLoadingBlockedUsers(false);
      }
    };

    fetchBlockedUsers();
  }, [screen, authToken]);

  useEffect(() => {
    const fetchMyPersonalData = async () => {
      if (screen !== 'personalData') return;
      if (!authToken) {
        setMyEmail('');
        setMyBirthDate('');
        setMyGender('');
        setMyNationality('');
        setMyUsername('');
        return;
      }

      setIsLoadingPersonalData(true);
      try {
        const data = await getMyPersonalData(authToken);
        setMyEmail(String(data?.email || '').trim());
        setMyUsername(String(data?.username || '').trim());
        setMyGender(String((data as any)?.gender || '').trim());
        setMyNationality(String(data?.nationality || '').trim());

        const raw = data?.birth_date;
        if (!raw) {
          setMyBirthDate('');
          return;
        }

        const rawStr = String(raw);
        const ymdMatch = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let dateObj: Date | null = null;
        if (ymdMatch) {
          const y = Number(ymdMatch[1]);
          const m = Number(ymdMatch[2]);
          const d = Number(ymdMatch[3]);
          dateObj = new Date(Date.UTC(y, m - 1, d));
        } else {
          const parsed = new Date(rawStr);
          dateObj = isNaN(parsed.getTime()) ? null : parsed;
        }

        if (!dateObj) {
          setMyBirthDate('');
          return;
        }

        const locale = language === 'en' ? 'en-US' : 'es-ES';
        const formatted = new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(dateObj);

        setMyBirthDate(formatted);
      } catch {
        setMyEmail('');
        setMyBirthDate('');
        setMyGender('');
        setMyNationality('');
        setMyUsername('');
      } finally {
        setIsLoadingPersonalData(false);
      }
    };

    fetchMyPersonalData();
  }, [screen, authToken, language]);

  useEffect(() => {
    const ensureUsernameLoaded = async () => {
      if (screen !== 'changePassword') return;
      if (!authToken) {
        setMyUsername('');
        return;
      }

      if (myUsername.trim().length > 0) return;
      try {
        const data = await getMyPersonalData(authToken);
        setMyUsername(String(data?.username || '').trim());
      } catch {
        setMyUsername('');
      }
    };

    ensureUsernameLoaded();
  }, [screen, authToken, myUsername]);

  useEffect(() => {
    const fetchAdminSelfies = async () => {
      if (screen !== 'adminSelfies') return;
      if (!authToken) return;
      if (!isBackendAdmin) return;

      const normalizeEmail = (v: unknown) => String(v || '').trim().toLowerCase();

      const dedupeByEmailKeepLatest = (items: any[], dateField: 'submitted_at' | 'blocked_at') => {
        const map = new Map<string, any>();
        for (const item of Array.isArray(items) ? items : []) {
          const email = normalizeEmail(item?.email);
          if (!email) continue;

          const existing = map.get(email);
          if (!existing) {
            map.set(email, item);
            continue;
          }

          const existingTime = existing?.[dateField] ? new Date(String(existing[dateField])).getTime() : 0;
          const itemTime = item?.[dateField] ? new Date(String(item[dateField])).getTime() : 0;
          if (itemTime >= existingTime) map.set(email, { ...existing, ...item });
        }

        const list = Array.from(map.values());
        list.sort((a, b) => {
          const aTime = a?.[dateField] ? new Date(String(a[dateField])).getTime() : 0;
          const bTime = b?.[dateField] ? new Date(String(b[dateField])).getTime() : 0;
          return bTime - aTime;
        });
        return list;
      };

      setIsLoadingAdminSelfies(true);
      try {
        const [pending, blocked] = await Promise.all([
          getAdminPendingAccountSelfies(authToken),
          getAdminBlockedAccountSelfies(authToken),
        ]);
        setAdminPendingSelfies(dedupeByEmailKeepLatest(pending.items || [], 'submitted_at'));
        setAdminBlockedSelfies(dedupeByEmailKeepLatest(blocked.items || [], 'blocked_at'));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Error', msg || 'No se pudo cargar');
        setAdminPendingSelfies([]);
        setAdminBlockedSelfies([]);
      } finally {
        setIsLoadingAdminSelfies(false);
      }
    };

    fetchAdminSelfies();
  }, [screen, authToken, isBackendAdmin]);

  useEffect(() => {
    if (screen !== 'adminSelfies' && adminSelfiePreviewUri) setAdminSelfiePreviewUri(null);
  }, [screen, adminSelfiePreviewUri]);

  useEffect(() => {
    if (!currentPasswordLockUntil) return;
    const until = new Date(currentPasswordLockUntil);
    if (isNaN(until.getTime())) return;
    if (until.getTime() <= Date.now()) return;

    const id = setInterval(() => setLockNowTick((v) => v + 1), 15_000);
    return () => clearInterval(id);
  }, [currentPasswordLockUntil]);

  const isCurrentPasswordFieldLocked = (() => {
    if (!currentPasswordLockUntil) return false;
    const until = new Date(currentPasswordLockUntil);
    if (isNaN(until.getTime())) return false;
    return until.getTime() > Date.now();
  })();

  const canUseNewPasswordFields = isCurrentPasswordValid;
  const meetsNewPasswordRules = newPassword.length >= 10 && /[#!@_$€%]/.test(newPassword);
  const newPasswordsMatch = newPassword.length > 0 && newPassword === repeatNewPassword;
  const canSubmitPasswordChange = canUseNewPasswordFields && meetsNewPasswordRules && newPasswordsMatch && !isChangingPassword;

  const aboutKeintiParagraphs = useMemo(() => {
    const raw = String(t('aboutKeinti.body') || '');
    const base = raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const creationDateIso = '2026-02-01';
    const extra =
      language === 'en'
        ? ['CEO: Antonio David González Macías', 'Created in: Seville, Spain', `Creation date: ${creationDateIso}`]
        : ['CEO: Antonio David González Macías', 'Creada en: Sevilla, España', 'Fecha de creación: 01/02/2026'];

    return [...base, ...extra];
  }, [t, language]);

  const privacyPolicyParagraphs = useMemo(() => {
    const rawEs =
      'POLÍTICA DE PRIVACIDAD – KEINTI\n\n' +
      'Última actualización: 18/01/2026\n\n' +
      '1. Responsable del tratamiento\n\n' +
      'De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la normativa de privacidad aplicable (incluida la normativa de Estados Unidos cuando corresponda), se informa a los usuarios de que el responsable del tratamiento de los datos personales en la aplicación Keinti es:\n\n' +
      'Responsable: Antonio David González Macías\n\n' +
      'Correo electrónico de contacto: keintisoporte@gmail.com\n\n' +
      '2. Alcance y requisitos de edad\n\n' +
      'Esta Política de Privacidad regula el tratamiento de datos personales de los usuarios de la aplicación móvil Keinti.\n\n' +
      'Keinti está destinada exclusivamente a personas mayores de 18 años. Si detectamos o tenemos indicios razonables de que una cuenta pertenece a una persona menor de edad, podremos suspenderla y eliminarla.\n\n' +
      '3. Datos personales que se recopilan\n\n' +
      '3.1 Datos facilitados por el usuario\n\n' +
      'Durante el registro y el uso de la aplicación, el usuario puede facilitar:\n\n' +
      'Correo electrónico\n\n' +
      'Método de acceso: email/contraseña o inicio de sesión con Google (OAuth), si el usuario lo elige\n\n' +
      'Contraseña (solo si el usuario elige email/contraseña; se gestiona por el proveedor de autenticación y nunca se almacena en texto plano)\n\n' +
      'Fecha de nacimiento (para verificar mayoría de edad, +18)\n\n' +
      'Nacionalidad\n\n' +
      'Datos de perfil (según elija el usuario): nombre de usuario, avatar, presentación pública, imágenes de presentación e intimidades, y enlaces a otras redes\n\n' +
      'Contenido e interacciones: publicaciones, mensajes, hilos, reacciones y votos en encuestas, según se habiliten en la app\n\n' +
      '3.2 Datos técnicos y de uso recopilados automáticamente\n\n' +
      'Cuando el usuario utiliza Keinti, podemos recopilar datos técnicos necesarios para que el servicio funcione, para prevenir fraude y para mantener la seguridad, como:\n\n' +
      'Dirección IP\n\n' +
      'Identificadores del dispositivo y del sistema (por ejemplo, tipo de dispositivo, sistema operativo y versión)\n\n' +
      'Datos de uso y registros técnicos (por ejemplo, eventos de funcionamiento, métricas de rendimiento y errores)\n\n' +
      'Identificadores publicitarios (por ejemplo, Advertising ID u otros equivalentes) cuando sea relevante para publicidad\n\n' +
      '3.3 Datos vinculados a “Autenticación de la cuenta” (selfie + TOTP)\n\n' +
      'En “Configuración > Control de Seguridad > Autenticación de la cuenta”, Keinti puede tratar datos adicionales únicamente para reforzar la seguridad, reducir suplantaciones y aumentar la confianza en la comunidad:\n\n' +
      'Selfie de verificación (imagen capturada con la cámara frontal)\n\n' +
      'Estado de revisión del selfie (no enviado, pendiente, aceptado o fallido), fechas de envío/revisión y motivo de rechazo cuando aplique\n\n' +
      'Datos de configuración TOTP (secreto) y el estado/fecha de activación (para uso con una app autenticadora compatible, por ejemplo Google Authenticator)\n\n' +
      'La selfie se utiliza únicamente para verificación y seguridad. No se utiliza para reconocimiento facial automatizado ni para fines publicitarios.\n\n' +
      'La app autenticadora (por ejemplo, Google Authenticator) funciona en el dispositivo del usuario. Keinti no recibe datos de esa app; únicamente valida códigos TOTP.\n\n' +
      '4. Finalidades del tratamiento\n\n' +
      'Tratamos los datos personales para:\n\n' +
      'Crear y administrar la cuenta\n\n' +
      'Verificar la mayoría de edad\n\n' +
      'Permitir la interacción social (home, canales, grupos, chat e hilos)\n\n' +
      'Almacenar, servir y mostrar contenido multimedia (por ejemplo, avatares, imágenes de grupos y media asociado a publicaciones y chats)\n\n' +
      'Aplicar moderación, prevenir abusos y hacer cumplir las normas\n\n' +
      'Mantener la seguridad del servicio y de las cuentas (incluida la “Autenticación de la cuenta” cuando el usuario la active)\n\n' +
      'Mostrar anuncios en la app mediante Google AdMob, cuando corresponda\n\n' +
      'Cumplir obligaciones legales y atender solicitudes de usuarios\n\n' +
      '5. Base jurídica\n\n' +
      'En la Unión Europea/EEE y donde corresponda, la base jurídica puede incluir:\n\n' +
      'Ejecución del contrato (prestación del servicio y funcionalidades principales)\n\n' +
      'Consentimiento (por ejemplo, cuando el usuario elige usar el inicio de sesión con Google o cuando sea exigible para publicidad/personalización)\n\n' +
      'Interés legítimo (seguridad, prevención del fraude, mantenimiento del servicio y moderación)\n\n' +
      'Cumplimiento de obligaciones legales\n\n' +
      'El usuario puede retirar su consentimiento cuando proceda, sin afectar a la licitud del tratamiento previo.\n\n' +
      '6. Inicio de sesión con Google (OAuth)\n\n' +
      'Keinti puede ofrecer el inicio de sesión con Google. Si el usuario lo utiliza, Google gestiona el proceso de autenticación y Keinti recibe datos básicos del perfil necesarios para crear/iniciar la sesión (por ejemplo, correo electrónico y datos de perfil como nombre/foto, según la configuración y permisos).\n\n' +
      'Google actúa como responsable independiente respecto a los datos tratados en ese flujo, conforme a sus políticas.\n\n' +
      'Política de privacidad de Google:\n\n' +
      'https://policies.google.com/privacy\n\n' +
      '7. Publicidad y Google AdMob\n\n' +
      'Keinti puede mostrar anuncios dentro de la aplicación mediante Google AdMob (Google LLC). Para servir y medir anuncios, Google puede tratar datos como el identificador publicitario del dispositivo (por ejemplo, Advertising ID), información del dispositivo, dirección IP y datos relacionados con la interacción con anuncios y el uso de la app.\n\n' +
      'En función de la ubicación del usuario y de la normativa aplicable, los anuncios podrán ser personalizados o no personalizados. Cuando sea legalmente exigible, Keinti solicitará el consentimiento antes de mostrar publicidad personalizada y/o antes de usar identificadores publicitarios con fines publicitarios.\n\n' +
      'El usuario puede gestionar o limitar la personalización publicitaria desde la configuración del dispositivo y, cuando esté disponible, desde mecanismos de la propia aplicación.\n\n' +
      '8. Proveedores tecnológicos (Supabase) y alojamiento\n\n' +
      'Keinti utiliza Supabase (Supabase Inc.) como proveedor tecnológico que actúa como encargado del tratamiento para proporcionar infraestructura, incluyendo:\n\n' +
      'Base de datos y servicios backend\n\n' +
      'Autenticación (Supabase Auth)\n\n' +
      'Almacenamiento de archivos (Supabase Storage) para contenido multimedia (por ejemplo, avatares, imágenes de grupos, media de publicaciones/canales y selfies de verificación)\n\n' +
      'Política de privacidad de Supabase:\n\n' +
      'https://supabase.com/privacy\n\n' +
      'Los datos personales pueden ser tratados o almacenados en servidores ubicados fuera del país del usuario, incluidos Estados Unidos. Cuando aplique, las transferencias internacionales se realizan con garantías adecuadas conforme a la normativa aplicable (por ejemplo, Cláusulas Contractuales Tipo y medidas suplementarias cuando proceda).\n\n' +
      '9. Conservación y eliminación\n\n' +
      'Conservamos los datos durante el tiempo necesario para prestar el servicio y para las finalidades descritas. En particular:\n\n' +
      'Datos de cuenta: mientras la cuenta esté activa\n\n' +
      'Eliminación de cuenta: el usuario puede solicitarla desde la configuración; al eliminarla, los datos se eliminan o se anonimizan conforme a requisitos técnicos y legales\n\n' +
      'Contenido en canales públicos vinculado a publicaciones: se concibe como temporal; por defecto, las publicaciones en “Home” y contenido asociado pueden expirar y retirarse automáticamente, junto con interacciones relacionadas\n\n' +
      'Registros técnicos y de seguridad: se conservan el tiempo mínimo necesario para seguridad, mantenimiento y cumplimiento\n\n' +
      'Autenticación de la cuenta: la selfie se conserva únicamente el tiempo necesario para su revisión y se elimina automáticamente tras la revisión (aceptada o fallida). La verificación puede tener vigencia limitada; por defecto expira a los 365 días, y al expirar se reinicia el estado y se eliminan datos asociados (por ejemplo, el secreto TOTP)\n\n' +
      '10. Destinatarios y cesiones\n\n' +
      'Los datos personales pueden ser tratados por proveedores que prestan servicios a Keinti, principalmente:\n\n' +
      'Supabase (infraestructura, base de datos, autenticación y almacenamiento)\n\n' +
      'Google (inicio de sesión con Google OAuth, si el usuario lo elige)\n\n' +
      'Google (AdMob, para publicidad)\n\n' +
      'Keinti no vende datos personales a terceros.\n\n' +
      '11. Derechos de los usuarios\n\n' +
      'Usuarios en la Unión Europea/EEE (y donde corresponda): acceso, rectificación, supresión, oposición, limitación, portabilidad y retirada del consentimiento.\n\n' +
      'Usuarios en Estados Unidos (y donde corresponda): derechos de acceso/conocimiento, eliminación y opciones relacionadas con publicidad personalizada conforme a la normativa aplicable (por ejemplo, CCPA/CPRA y otras leyes estatales).\n\n' +
      'Las solicitudes pueden enviarse a keintisoporte@gmail.com. También pueden existir opciones en la app (por ejemplo, eliminación de cuenta).\n\n' +
      '12. Seguridad\n\n' +
      'Aplicamos medidas técnicas y organizativas razonables para proteger los datos, incluyendo controles de acceso, medidas de seguridad en infraestructura y prácticas de minimización.\n\n' +
      'En “Autenticación de la cuenta”, el acceso a información de revisión (incluida la selfie) está restringido a personal/administración autorizado únicamente para validar el proceso.\n\n' +
      '13. Cambios en esta política\n\n' +
      'Podemos actualizar esta Política de Privacidad para reflejar cambios legales, técnicos o de producto. Si los cambios son relevantes, lo notificaremos a través de la aplicación.\n\n' +
      '14. Legislación aplicable\n\n' +
      'Esta política se rige por el RGPD cuando aplique y por la normativa de privacidad aplicable en la jurisdicción del usuario (incluida normativa estatal de EE. UU. cuando corresponda).\n\n' +
      '15. Seguridad infantil y denuncias\n\n' +
      'Keinti mantiene una política de tolerancia cero frente a cualquier contenido relacionado con explotación o abuso sexual infantil (EASI/CSAE). Los usuarios pueden denunciar contenido o cuentas desde la app y/o contactar con soporte en keintisoporte@gmail.com.';

    const rawEn =
      'PRIVACY POLICY – KEINTI\n\n' +
      'Last updated: 01/18/2026\n\n' +
      '1. Data controller\n\n' +
      'In accordance with Regulation (EU) 2016/679 (GDPR) and applicable privacy laws (including U.S. laws where applicable), users are informed that the controller of personal data processed in the Keinti app is:\n\n' +
      'Controller: Antonio David González Macías\n\n' +
      'Contact email: keintisoporte@gmail.com\n\n' +
      '2. Scope and age requirement\n\n' +
      'This Privacy Policy governs the processing of personal data of users of the Keinti mobile app.\n\n' +
      'Keinti is intended exclusively for people over 18 years of age. If we detect or reasonably suspect an account belongs to a minor, we may suspend and delete it.\n\n' +
      '3. Personal data collected\n\n' +
      '3.1 Data provided by the user\n\n' +
      'During registration and use of the app, the user may provide:\n\n' +
      'Email address\n\n' +
      'Sign-in method: email/password or Google sign-in (OAuth), if the user chooses it\n\n' +
      'Password (only if the user chooses email/password; it is handled by the authentication provider and is never stored in plain text)\n\n' +
      'Date of birth (to verify legal age, 18+)\n\n' +
      'Nationality\n\n' +
      'Profile data (as chosen by the user): username, avatar, public presentation, presentation images and intimacies, and social links\n\n' +
      'Content and interactions: posts, messages, threads, reactions and poll votes, depending on features available in the app\n\n' +
      '3.2 Technical and usage data collected automatically\n\n' +
      'When the user uses Keinti, we may collect technical data required to operate the service, prevent fraud and keep it secure, such as:\n\n' +
      'IP address\n\n' +
      'Device and system identifiers (e.g., device type, operating system and version)\n\n' +
      'Usage and technical logs (e.g., operational events, performance metrics and errors)\n\n' +
      'Advertising identifiers (e.g., Advertising ID or equivalent identifiers) when relevant for ads\n\n' +
      '3.3 Data related to “Account Authentication” (selfie + TOTP)\n\n' +
      'In “Settings > Security Control > Account Authentication”, Keinti may process additional data solely to strengthen security, reduce impersonation and increase trust in the community:\n\n' +
      'Verification selfie (captured with the device front camera)\n\n' +
      'Selfie review status (not submitted, pending, accepted or failed), submission/review timestamps and a rejection reason when applicable\n\n' +
      'TOTP setup data (secret) and enablement status/date (for use with a compatible authenticator app, e.g., Google Authenticator)\n\n' +
      'The selfie is used only for verification and security. We do not use automated facial recognition and we do not use it for advertising profiling.\n\n' +
      'Authenticator apps (e.g., Google Authenticator) run on the user’s device. Keinti does not receive data from those apps; it only validates TOTP codes.\n\n' +
      '4. Purposes of processing\n\n' +
      'We process personal data to:\n\n' +
      'Create and manage the account\n\n' +
      'Verify legal age\n\n' +
      'Enable social interaction (home, channels, groups, chat and threads)\n\n' +
      'Store, serve and display media content (e.g., avatars, group images and media linked to posts and chats)\n\n' +
      'Moderate content, prevent abuse and enforce rules\n\n' +
      'Maintain service and account security (including “Account Authentication” when enabled by the user)\n\n' +
      'Display ads in the app via Google AdMob, where applicable\n\n' +
      'Comply with legal obligations and respond to user requests\n\n' +
      '5. Legal bases\n\n' +
      'In the EU/EEA and where applicable, legal bases may include:\n\n' +
      'Performance of a contract (providing the service and core features)\n\n' +
      'Consent (e.g., when the user chooses Google sign-in, or where required for ads/personalization)\n\n' +
      'Legitimate interests (security, fraud prevention, service maintenance and moderation)\n\n' +
      'Compliance with legal obligations\n\n' +
      'Users may withdraw consent where applicable, without affecting the lawfulness of prior processing.\n\n' +
      '6. Google sign-in (OAuth)\n\n' +
      'Keinti may offer Google sign-in. If the user uses it, Google handles the authentication flow and Keinti receives basic profile data needed to create/sign in to the account (e.g., email and profile data such as name/photo, depending on configuration and permissions).\n\n' +
      'Google acts as an independent controller for data processed in that flow, under its own policies.\n\n' +
      'Google Privacy Policy:\n\n' +
      'https://policies.google.com/privacy\n\n' +
      '7. Advertising and Google AdMob\n\n' +
      'Keinti may display ads through Google AdMob (Google LLC). To serve and measure ads, Google may process data such as the device advertising identifier (e.g., Advertising ID), device information, IP address and data related to ad interactions and app usage.\n\n' +
      'Depending on the user’s location and applicable regulations, ads may be personalized or non-personalized. Where legally required, Keinti will request consent before showing personalized advertising and/or using advertising identifiers for ad purposes.\n\n' +
      'Users can manage or limit ad personalization through device settings and, when available, through in-app mechanisms.\n\n' +
      '8. Technology providers (Supabase) and hosting\n\n' +
      'Keinti uses Supabase (Supabase Inc.) as a technology provider acting as a data processor to provide infrastructure, including:\n\n' +
      'Database and backend services\n\n' +
      'Authentication (Supabase Auth)\n\n' +
      'File storage (Supabase Storage) for media content (e.g., avatars, group images, posts/channels media and verification selfies)\n\n' +
      'Supabase Privacy Policy:\n\n' +
      'https://supabase.com/privacy\n\n' +
      'Personal data may be processed or stored on servers located outside the user’s country, including the United States. Where applicable, international transfers are carried out with appropriate safeguards under applicable law (e.g., Standard Contractual Clauses and supplementary measures where required).\n\n' +
      '9. Retention and deletion\n\n' +
      'We retain data for as long as necessary to provide the service and for the purposes described. In particular:\n\n' +
      'Account data: while the account is active\n\n' +
      'Account deletion: the user may request deletion from the app settings; upon deletion, data are deleted or anonymized in accordance with technical and legal requirements\n\n' +
      'Public channel content linked to posts: designed to be temporary; by default, “Home” posts and related content may expire and be removed automatically, together with related interactions\n\n' +
      'Technical and security logs: retained for the minimum time required for security, maintenance and compliance\n\n' +
      'Account Authentication: selfie images are retained only as long as needed for review and are automatically deleted after review (accepted or failed). Verification may have a limited validity; by default it expires 365 days after verification, and upon expiry the status is reset and associated data (e.g., TOTP secret) are removed\n\n' +
      '10. Recipients\n\n' +
      'Personal data may be processed by service providers supporting Keinti, mainly:\n\n' +
      'Supabase (infrastructure, database, authentication and storage)\n\n' +
      'Google (Google OAuth sign-in, if the user chooses it)\n\n' +
      'Google (AdMob, advertising)\n\n' +
      'Keinti does not sell personal data to third parties.\n\n' +
      '11. User rights\n\n' +
      'EU/EEA users (and where applicable): access, rectification, erasure, objection, restriction, portability and withdrawal of consent.\n\n' +
      'U.S. users (and where applicable): rights to know/access, delete and choices related to personalized advertising under applicable laws (e.g., CCPA/CPRA and other state laws).\n\n' +
      'Requests can be sent to keintisoporte@gmail.com. The app may also provide options (e.g., account deletion).\n\n' +
      '12. Security\n\n' +
      'We apply reasonable technical and organizational measures to protect data, including access controls, infrastructure security and data minimization practices.\n\n' +
      'Within “Account Authentication”, access to review information (including the selfie) is restricted to authorized staff/administration solely to validate the process.\n\n' +
      '13. Changes to this policy\n\n' +
      'We may update this Privacy Policy to reflect legal, technical or product changes. If changes are material, we will notify users through the app.\n\n' +
      '14. Applicable law\n\n' +
      'This policy is governed by the GDPR where applicable and by the privacy laws applicable in the user’s jurisdiction (including U.S. state laws where applicable).\n\n' +
      '15. Child safety and reporting\n\n' +
      'Keinti maintains a zero-tolerance policy for any content related to child sexual exploitation or abuse (CSEA/CSAM). Users can report content or accounts from the app and/or contact support at keintisoporte@gmail.com.';

    const raw = language === 'en' ? rawEn : rawEs;

    return raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [language]);

  const filteredNationalities = useMemo(() => {
    const q = nationalitySearch.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((country) => country.toLowerCase().includes(q));
  }, [nationalitySearch]);

  const saveNationality = async (nextNationality: string) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para actualizar tu nacionalidad.');
      return;
    }

    const clean = String(nextNationality || '').trim();
    if (!clean) return;

    const previous = myNationality;
    setMyNationality(clean);
    setShowNationalityPicker(false);
    setNationalitySearch('');
    setIsUpdatingNationality(true);

    try {
      const resp = await updateMyNationality(authToken, clean);
      setMyNationality(String(resp?.nationality || clean).trim());
    } catch (e) {
      setMyNationality(previous);
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setIsUpdatingNationality(false);
    }
  };

  const cookiesAdPolicyParagraphs = useMemo(() => {
    const rawEs =
      'POLÍTICA DE COOKIES Y PUBLICIDAD – KEINTI\n\n' +
      'Última actualización: 18/01/2026\n\n' +
      '1. Introducción\n\n' +
      'La presente Política de Cookies y Publicidad explica cómo la aplicación móvil Keinti utiliza tecnologías equivalentes a “cookies” en entornos móviles (por ejemplo, almacenamiento local y SDKs), así como identificadores publicitarios y tecnologías de medición relacionadas con la publicidad.\n\n' +
      'Keinti muestra anuncios dentro de la aplicación. Para servir, limitar y medir la publicidad, prevenir fraude y garantizar la seguridad, pueden utilizarse identificadores publicitarios, señales técnicas del dispositivo y eventos de uso dentro de la app, conforme a la normativa aplicable.\n\n' +
      'Esta política debe leerse conjuntamente con la Política de Privacidad de Keinti. En caso de discrepancia, prevalecerá la Política de Privacidad para lo relativo al tratamiento general de datos personales.\n\n' +
      '2. ¿Qué son las “cookies” y tecnologías similares en una app móvil?\n\n' +
      'En aplicaciones móviles no suelen existir cookies de navegador tradicionales. En su lugar, se utilizan tecnologías equivalentes, como por ejemplo:\n\n' +
      '• Identificadores publicitarios del sistema (p. ej., Advertising ID en Android o identificadores equivalentes).\n\n' +
      '• SDKs de terceros (p. ej., SDK publicitario).\n\n' +
      '• Almacenamiento local del dispositivo (p. ej., preferencias de la app).\n\n' +
      '• Tecnologías de medición y atribución (p. ej., para medir impresiones/clics).\n\n' +
      'Estas tecnologías permiten, entre otras cosas, el funcionamiento de la app, la medición del rendimiento, la seguridad y la visualización y medición de anuncios.\n\n' +
      '3. Qué tecnologías utilizamos y con qué finalidad\n\n' +
      'En Keinti utilizamos tecnologías técnicas necesarias para:\n\n' +
      '• Funcionamiento básico de la aplicación (p. ej., recordar ajustes o estado de sesión).\n\n' +
      '• Seguridad y prevención de abusos/fraude (p. ej., detección de actividad anómala).\n\n' +
      '• Mantenimiento y mejora del servicio (p. ej., estabilidad, errores y métricas).\n\n' +
      '• Publicidad: mostrar anuncios, limitar frecuencia (frequency capping), medir rendimiento y detectar fraude.\n\n' +
      'Dependiendo de tu región y de tus elecciones de privacidad, la publicidad puede ser:\n\n' +
      '• No personalizada (contextual), o\n\n' +
      '• Personalizada, cuando la normativa aplicable lo permita y, cuando corresponda, exista consentimiento válido.\n\n' +
      '4. Publicidad y Google AdMob\n\n' +
      'Keinti integra publicidad mediante Google AdMob (Google LLC). Al mostrarse anuncios, Google y/o sus socios pueden recopilar o recibir información como:\n\n' +
      '• Identificadores publicitarios y señales del dispositivo (p. ej., modelo, versión del sistema, idioma, IP aproximada).\n\n' +
      '• Datos de uso relacionados con anuncios (p. ej., impresiones, clics, interacciones y métricas antifraude).\n\n' +
      'Google puede actuar como responsable independiente (o entidad equivalente) respecto de determinados tratamientos vinculados a la publicidad.\n\n' +
      'Más información:\n\n' +
      'Política de Privacidad de Google: https://policies.google.com/privacy\n\n' +
      'Cómo usa Google la información de sitios o apps que usan sus servicios: https://policies.google.com/technologies/partner-sites\n\n' +
      '5. Consentimiento (UE/EEE/Reino Unido y otras regiones)\n\n' +
      'Cuando la normativa aplicable lo exija (por ejemplo, en la Unión Europea, el Espacio Económico Europeo y el Reino Unido), Keinti solicitará tu consentimiento antes de habilitar publicidad personalizada y/o el uso de determinados identificadores con fines publicitarios.\n\n' +
      'Para ello, Keinti puede utilizar una plataforma de gestión del consentimiento (CMP) y/o la Google User Messaging Platform (UMP) u otras soluciones equivalentes.\n\n' +
      'Podrás, en su caso:\n\n' +
      '• Aceptar o rechazar publicidad personalizada.\n\n' +
      '• Modificar o retirar tu consentimiento en cualquier momento desde la configuración de la aplicación (o desde el propio banner de consentimiento cuando se muestre).\n\n' +
      '6. Cómo limitar la publicidad desde el dispositivo\n\n' +
      'Además de las opciones dentro de Keinti, puedes gestionar preferencias de anuncios desde tu dispositivo:\n\n' +
      '• Android: puedes restablecer/eliminar el identificador publicitario o desactivar la personalización de anuncios desde los ajustes del sistema (según versión).\n\n' +
      '• iOS: puedes gestionar el seguimiento y el acceso a identificadores desde los ajustes de privacidad (según versión).\n\n' +
      'Ten en cuenta que limitar estos ajustes puede reducir la personalización, pero no necesariamente eliminar todos los anuncios.\n\n' +
      '7. Transferencias y proveedores\n\n' +
      'Los proveedores publicitarios pueden tratar datos desde ubicaciones fuera de tu país. Cuando sea aplicable, se aplicarán salvaguardas legales (por ejemplo, cláusulas contractuales tipo u otros mecanismos reconocidos).\n\n' +
      '8. Privacidad de menores\n\n' +
      'Keinti está destinada exclusivamente a personas mayores de 18 años. No mostramos intencionadamente publicidad dirigida a menores ni utilizamos tecnologías publicitarias con ese fin.\n\n' +
      '9. Cambios en esta política\n\n' +
      'Podemos actualizar esta Política de Cookies y Publicidad para reflejar cambios legales, técnicos o de negocio. Cuando el cambio sea relevante, lo comunicaremos a través de la aplicación y/o actualizando la fecha indicada al inicio.\n\n' +
      '10. Contacto\n\n' +
      'Para cualquier duda relacionada con esta política, puedes contactar en:\n\n' +
      'keintisoporte@gmail.com';

    const rawEn =
      'COOKIES AND ADVERTISING POLICY – KEINTI\n\n' +
      'Last updated: 01/18/2026\n\n' +
      '1. Introduction\n\n' +
      'This Cookies and Advertising Policy explains how the Keinti mobile application uses “cookie-like” technologies in mobile environments (such as local storage and SDKs), as well as advertising identifiers and ad measurement technologies.\n\n' +
      'Keinti displays ads in the app. To serve, limit and measure advertising, prevent fraud, and ensure security, advertising identifiers, technical device signals, and in-app usage events may be processed in accordance with applicable law.\n\n' +
      'This policy should be read together with Keinti’s Privacy Policy. In case of conflict, the Privacy Policy prevails regarding general personal data processing.\n\n' +
      '2. What are “cookies” and similar technologies in a mobile app?\n\n' +
      'In mobile app environments, traditional browser cookies are often not used. Instead, equivalent technologies may be used, such as:\n\n' +
      '• Advertising identifiers provided by the operating system (e.g., Android Advertising ID or equivalent identifiers).\n\n' +
      '• Third-party SDKs (e.g., an ad SDK).\n\n' +
      '• Local device storage (e.g., app preferences).\n\n' +
      '• Measurement and attribution technologies (e.g., for ad impression/click measurement).\n\n' +
      'These technologies help enable core app functionality, performance measurement, security, and the display/measurement of ads.\n\n' +
      '3. What we use and why\n\n' +
      'Keinti uses technical technologies necessary for:\n\n' +
      '• Core app functionality (e.g., remembering settings or session state).\n\n' +
      '• Security and fraud/abuse prevention (e.g., detecting abnormal activity).\n\n' +
      '• Maintenance and service improvement (e.g., stability and diagnostics).\n\n' +
      '• Advertising: displaying ads, frequency capping, performance measurement, and fraud detection.\n\n' +
      'Depending on your region and your privacy choices, ads may be:\n\n' +
      '• Non-personalized (contextual), or\n\n' +
      '• Personalized, where permitted by law and, where required, based on valid user consent.\n\n' +
      '4. Advertising and Google AdMob\n\n' +
      'Keinti integrates advertising through Google AdMob (Google LLC). When ads are displayed, Google and/or its partners may collect or receive information such as:\n\n' +
      '• Advertising identifiers and device signals (e.g., device model, OS version, language, approximate IP).\n\n' +
      '• Ad-related usage data (e.g., impressions, clicks, interactions and anti-fraud signals).\n\n' +
      'Google may act as an independent controller (or equivalent role) for certain advertising-related processing.\n\n' +
      'More information:\n\n' +
      'Google Privacy Policy: https://policies.google.com/privacy\n\n' +
      'How Google uses information from sites or apps that use its services: https://policies.google.com/technologies/partner-sites\n\n' +
      '5. Consent (EU/EEA/UK and other regions)\n\n' +
      'Where required by applicable law (for example, in the European Union, the European Economic Area and the United Kingdom), Keinti will request your consent before enabling personalized advertising and/or certain ad identifiers.\n\n' +
      'Keinti may use a Consent Management Platform (CMP) and/or Google User Messaging Platform (UMP) or equivalent solutions to collect and manage your choices.\n\n' +
      'Where available, you can:\n\n' +
      '• Accept or reject personalized advertising.\n\n' +
      '• Change or withdraw your consent at any time from the app settings (or from the consent prompt when shown).\n\n' +
      '6. How to limit advertising from your device\n\n' +
      'In addition to any in-app controls, you may manage ad preferences from your device:\n\n' +
      '• Android: you may reset/remove the advertising identifier or disable ad personalization in system settings (varies by version).\n\n' +
      '• iOS: you may manage tracking permissions and identifier access in privacy settings (varies by version).\n\n' +
      'Limiting these settings may reduce personalization, but it may not remove all ads.\n\n' +
      '7. International transfers and providers\n\n' +
      'Advertising providers may process data from locations outside your country. Where applicable, appropriate legal safeguards will be used (e.g., Standard Contractual Clauses or other recognized mechanisms).\n\n' +
      '8. Minors’ privacy\n\n' +
      'Keinti is intended exclusively for persons over 18 years of age. We do not knowingly serve ads targeted to minors or use ad technologies for that purpose.\n\n' +
      '9. Policy changes\n\n' +
      'We may update this Cookies and Advertising Policy to reflect legal, technical, or business changes. When changes are material, we will notify users through the app and/or by updating the date at the top.\n\n' +
      '10. Contact\n\n' +
      'For any questions related to this policy, you may contact:\n\n' +
      'keintisoporte@gmail.com';

    const raw = language === 'en' ? rawEn : rawEs;

    return raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [language]);

  const verifyKeintiParagraphs = useMemo(() => {
    const rawEs =
      'VERIFICACIÓN DE KEINTI\n\n' +
      'Objetivos para conseguir Keinti verificado:\n\n' +
      '• Autentifica tu cuenta primero.\n\n' +
      '• Obtén 100.000 aperturas en tus publicaciones de tus intimidades.\n\n' +
      '• Publica tu perfil al menos 40 veces en la “Home”.\n\n' +
      '• Haz que 100.000 usuarios se unan al chat de “Tu canal”.\n\n' +
      '• Crea al menos un grupo en \'Tus grupos\' y haz que se unan a estos grupos al menos 200 miembros activos.\n\n' +
      'Beneficios por conseguir Keinti verificado:\n\n' +
      '• Genera ingresos por cada uno de los usuarios que accedan a los chats de “Tu canal”.\n\n' +
      '• Obtén la insignia dorada.\n\n' +
      '• Generas ingresos por cada 1.000 visualizaciones de las tarjetas de los aros.\n\n' +
      '• Obtén otros privilegios futuros ofrecidos por Keinti.';

    const rawEn =
      'KEINTI VERIFICATION\n\n' +
      'Goals to become Keinti Verified:\n\n' +
      '• Authenticate your account first.\n\n' +
      '• Get 100,000 openings on your intimacy posts.\n\n' +
      '• Publish your profile at least 40 times in the “Home”.\n\n' +
      '• Get 100,000 users to join your “Your channel” chat.\n\n' +
      '• Create at least one group in \'Your groups\' and have at least 200 active members join these groups.\n\n' +
      'Benefits of becoming Keinti Verified:\n\n' +
      '• Generate income for each user who accesses “Your channel” chats.\n\n' +
      '• Get the golden badge.\n\n' +
      '• Generate income for every 1,000 views of ring cards.\n\n' +
      '• Get other future privileges offered by Keinti.';

    const raw = language === 'en' ? rawEn : rawEs;

    return raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [language]);

  const termsOfUseParagraphs = useMemo(() => {
    const rawEs =
      'TÉRMINOS Y CONDICIONES DE USO – KEINTI\n\n' +
      'Última actualización: 18/01/2026\n\n' +
      '1. Aceptación de los Términos\n\n' +
      'Al crear una cuenta o utilizar Keinti (la “App”), el usuario acepta estos Términos y Condiciones de Uso (los “Términos”). Si el usuario no está de acuerdo, debe dejar de usar la App.\n\n' +
      'Estos Términos deben leerse junto con la Política de Privacidad y la Política de Cookies y Publicidad disponibles en “Control de Seguridad”.\n\n' +
      '2. Requisitos de edad (18+)\n\n' +
      'La App está destinada exclusivamente a personas mayores de 18 años. No se permite el registro ni el uso por menores. Si detectamos o tenemos indicios razonables de que una cuenta pertenece a una persona menor de edad, podremos suspenderla y eliminarla.\n\n' +
      '3. Cuenta de usuario, acceso y seguridad\n\n' +
      'Para usar la App, el usuario debe crear una cuenta y elegir un método de acceso disponible (por ejemplo, email/contraseña o inicio de sesión con Google mediante OAuth).\n\n' +
      'El usuario se compromete a proporcionar información veraz y a mantener actualizados los datos esenciales de su cuenta.\n\n' +
      'El usuario es responsable de mantener la confidencialidad de sus credenciales y del acceso a su dispositivo. Cualquier actividad realizada desde su cuenta se considerará realizada por el usuario, salvo prueba en contrario y en la medida permitida por la ley.\n\n' +
      'Por razones de seguridad, Keinti puede aplicar medidas de protección ante intentos reiterados de acceso, verificación de contraseña o actividad sospechosa (por ejemplo, limitaciones, bloqueos temporales o restricción de la cuenta).\n\n' +
      '3.1 Autenticación de la cuenta (selfie + TOTP)\n\n' +
      'Keinti puede ofrecer al usuario, dentro de “Configuración > Control de Seguridad > Autenticación de la cuenta”, un proceso adicional de verificación para aumentar la seguridad y reducir suplantaciones.\n\n' +
      'Este proceso puede incluir:\n\n' +
      'Captura y envío de una selfie para revisión\n\n' +
      'Activación de un segundo factor mediante un código TOTP de 6 dígitos generado por una app autenticadora compatible (por ejemplo, Google Authenticator)\n\n' +
      'La revisión del selfie puede tardar hasta 24 horas. Keinti puede rechazar selfies que no permitan una verificación razonable (por ejemplo, mala iluminación, rostro no visible o imagen no válida) y solicitar un reintento.\n\n' +
      'El usuario se compromete a enviar únicamente una selfie propia, actual y sin manipulación. Cualquier intento de fraude, suplantación o elusión de medidas de seguridad puede conllevar restricciones, suspensión o eliminación de la cuenta.\n\n' +
      'El usuario es responsable de mantener el control de su dispositivo y de su app autenticadora. Si sospecha un acceso no autorizado, debe cambiar su contraseña, revisar la seguridad de su dispositivo y contactar con soporte.\n\n' +
      '4. Descripción del servicio\n\n' +
      'Keinti es una aplicación social que permite, entre otras funcionalidades:\n\n' +
      'Publicar contenido (texto e imágenes) y realizar interacciones (por ejemplo, reacciones, respuestas, encuestas y otras dinámicas, según se habiliten).\n\n' +
      'Crear y participar en grupos privados visibles únicamente para sus miembros, con mensajería, hilos e intercambio de imágenes.\n\n' +
      'Unirse a canales asociados a publicaciones y utilizar mensajería dentro de dichos canales.\n\n' +
      'Configurar datos del perfil, como foto/imagen de perfil y enlaces a redes sociales.\n\n' +
      '5. Contenido efímero, disponibilidad y cambios\n\n' +
      'El usuario comprende que parte del contenido en Keinti es efímero. En particular, determinadas publicaciones en “Home” y contenido asociado (incluidas interacciones y canales vinculados) pueden estar disponibles durante un tiempo limitado (por ejemplo, hasta 24 horas) y retirarse automáticamente al expirar o al ser eliminado por el usuario.\n\n' +
      'Keinti puede modificar, suspender o interrumpir total o parcialmente funcionalidades por mantenimiento, seguridad o evolución del producto.\n\n' +
      '6. Grupos, solicitudes, expulsiones y bloqueos\n\n' +
      'Los creadores/propietarios de grupos pueden gestionar la pertenencia y la interacción dentro del grupo, incluyendo aceptar o ignorar solicitudes y expulsar, bloquear o limitar a miembros, conforme a las funciones disponibles.\n\n' +
      'El usuario reconoce que si es expulsado o bloqueado en un grupo, su acceso al contenido del grupo puede finalizar y parte de su contenido asociado al grupo puede eliminarse o dejar de estar disponible.\n\n' +
      '7. Normas de conducta y usos prohibidos\n\n' +
      'El usuario se compromete a usar Keinti de forma responsable, respetuosa y conforme a la ley. Queda prohibido, entre otros:\n\n' +
      'Publicar contenido ilegal, difamatorio, amenazante, violento, discriminatorio o que incite al odio.\n\n' +
      'Publicar contenido sexual que involucre a menores o que los sexualice (tolerancia cero).\n\n' +
      'Acosar, intimidar, extorsionar o suplantar a otros usuarios.\n\n' +
      'Compartir malware, enlaces maliciosos, phishing o cualquier contenido destinado a comprometer la seguridad de otros.\n\n' +
      'Infringir derechos de propiedad intelectual o de imagen (por ejemplo, publicar contenido sin derechos o sin autorización).\n\n' +
      'Recopilar datos personales de otros usuarios sin base legítima, realizar scraping o intentar reidentificar información.\n\n' +
      'Realizar spam, automatizaciones no autorizadas, manipulación de métricas o cualquier abuso del servicio.\n\n' +
      'Intentar eludir restricciones, acceder sin autorización o interferir con el funcionamiento de la App.\n\n' +
      '8. Moderación y medidas de cumplimiento\n\n' +
      'Keinti podrá revisar, retirar o restringir contenido y aplicar medidas sobre cuentas (por ejemplo, advertencias, limitaciones, suspensiones o eliminación) cuando existan indicios razonables de incumplimiento de estos Términos, de la ley o por motivos de seguridad.\n\n' +
      'La moderación puede apoyarse en reportes de usuarios y en medidas técnicas para prevenir abuso. Keinti no garantiza la revisión previa de todo el contenido.\n\n' +
      '9. Derechos sobre el contenido y licencia\n\n' +
      'El usuario conserva los derechos sobre el contenido que publica. No obstante, al publicar contenido en Keinti, el usuario concede a Keinti una licencia no exclusiva, mundial y limitada para alojar, almacenar, reproducir, mostrar y distribuir dicho contenido dentro de la App, únicamente con el fin de operar, mantener, moderar y proporcionar el servicio.\n\n' +
      'El usuario declara que dispone de los derechos necesarios sobre el contenido que publica (por ejemplo, imágenes) y que su publicación no infringe derechos de terceros.\n\n' +
      '10. Servicios de terceros, inicio de sesión con Google y publicidad\n\n' +
      'La App puede integrar servicios de terceros (por ejemplo, Google para inicio de sesión OAuth y Google AdMob para publicidad). El uso de esos servicios puede estar sujeto a términos y políticas del tercero correspondiente.\n\n' +
      'Keinti puede mostrar anuncios dentro de la App. En función de la normativa aplicable, los anuncios podrán ser personalizados o no personalizados y podrán requerir el consentimiento previo del usuario. La información sobre datos y consentimiento se describe en la Política de Cookies y Publicidad y en la Política de Privacidad.\n\n' +
      '11. Eliminación, suspensión y cierre de cuenta\n\n' +
      'El usuario puede solicitar la eliminación de su cuenta desde la configuración de la App. Al eliminar la cuenta, los datos se eliminarán o anonimizan conforme a la Política de Privacidad y a requisitos técnicos y legales aplicables.\n\n' +
      'Keinti puede suspender o cerrar cuentas, total o parcialmente, por incumplimiento de estos Términos, por motivos de seguridad o cuando la ley lo requiera.\n\n' +
      '12. Limitación de responsabilidad\n\n' +
      'Keinti se ofrece “tal cual” y “según disponibilidad”. En la medida permitida por la ley aplicable, Keinti no garantiza que el servicio sea ininterrumpido, libre de errores o completamente seguro.\n\n' +
      'En ningún caso Keinti será responsable de daños indirectos o consecuenciales derivados del uso o la imposibilidad de uso del servicio, salvo que la ley aplicable disponga lo contrario.\n\n' +
      '13. Cambios en los Términos\n\n' +
      'Keinti podrá modificar estos Términos para reflejar cambios legales, técnicos o de producto. Si los cambios son relevantes, se informará al usuario a través de la App. El uso continuado de la App tras la entrada en vigor de los cambios implica la aceptación de los Términos actualizados.\n\n' +
      '14. Contacto\n\n' +
      'Para consultas sobre estos Términos, el usuario puede contactar en: keintisoporte@gmail.com';

    const rawEn =
      'TERMS AND CONDITIONS OF USE – KEINTI\n\n' +
      'Last updated: 01/18/2026\n\n' +
      '1. Acceptance of the Terms\n\n' +
      'By creating an account or using Keinti (the “App”), the user accepts these Terms and Conditions of Use (the “Terms”). If the user does not agree, they must stop using the App.\n\n' +
      'These Terms must be read together with the Privacy Policy and the Cookies and Advertising Policy available under “Security Control”.\n\n' +
      '2. Age requirement (18+)\n\n' +
      'The App is intended exclusively for people over 18 years of age. Registration and use by minors is not permitted. If we detect or reasonably suspect an account belongs to a minor, we may suspend and delete it.\n\n' +
      '3. User account, access and security\n\n' +
      'To use the App, the user must create an account and choose an available sign-in method (for example, email/password or Google sign-in via OAuth).\n\n' +
      'The user agrees to provide accurate information and keep essential account data up to date.\n\n' +
      'The user is responsible for keeping credentials confidential and maintaining control of their device. Activity performed from the account will be treated as performed by the user, except where applicable law provides otherwise.\n\n' +
      'For security reasons, Keinti may apply protections against repeated sign-in attempts, password verification attempts or suspicious activity (e.g., limitations, temporary lockouts or account restriction).\n\n' +
      '3.1 Account Authentication (selfie + TOTP)\n\n' +
      'Keinti may offer, within “Settings > Security Control > Account Authentication”, an additional verification process to strengthen security and reduce impersonation.\n\n' +
      'This process may include:\n\n' +
      'Capturing and submitting a selfie for review\n\n' +
      'Enabling a second factor using a 6-digit TOTP code generated by a compatible authenticator app (e.g., Google Authenticator)\n\n' +
      'Selfie review may take up to 24 hours. Keinti may reject selfies that do not allow reasonable verification (e.g., poor lighting, face not visible or invalid image) and request a retry.\n\n' +
      'The user agrees to submit only their own, current, unedited selfie. Any attempt to commit fraud, impersonate others or bypass security measures may result in restrictions, suspension or account deletion.\n\n' +
      'The user is responsible for maintaining control of their device and authenticator app. If they suspect unauthorized access, they must change their password, review device security and contact support.\n\n' +
      '4. Service description\n\n' +
      'Keinti is a social application that enables, among other features:\n\n' +
      'Posting content (text and images) and interacting through reactions and dynamics (e.g., polls or quizzes).\n\n' +
      'Creating and participating in private groups, visible only to members, where messages, threads and images can be posted.\n\n' +
      'Subscribing (“joining”) channels associated with posts and using messaging within the channel.\n\n' +
      'Configuring certain profile data, such as profile photo and links to social networks.\n\n' +
      '5. Ephemeral content, availability and changes\n\n' +
      'The user understands that some content in Keinti is ephemeral. In particular, certain “Home” posts and associated content (including interactions and linked channels) may be available for a limited time (e.g., up to 24 hours) and may be removed automatically when they expire or are deleted by the user.\n\n' +
      'Keinti may modify, suspend or discontinue, in whole or in part, App features for maintenance, security or product evolution.\n\n' +
      '6. Groups, requests, removals and blocks\n\n' +
      'Group creators/owners may manage membership and interaction within a group, including accepting or ignoring requests, and removing, blocking or limiting members, depending on available features.\n\n' +
      'If the user is removed or blocked from a group, access to the group content may end and some group-related content may be deleted or become unavailable.\n\n' +
      '7. Conduct rules and prohibited uses\n\n' +
      'The user agrees to use Keinti responsibly, respectfully and in accordance with the law. Prohibited activities include, among others:\n\n' +
      'Posting illegal, defamatory, threatening, violent, discriminatory content or content that incites hatred.\n\n' +
      'Posting sexual content involving minors or sexualizing minors (zero tolerance).\n\n' +
      'Harassing, intimidating, extorting or impersonating other users.\n\n' +
      'Sharing malware, malicious links, phishing or any content intended to compromise others’ security.\n\n' +
      'Infringing intellectual property or image rights (e.g., posting content without rights or permission).\n\n' +
      'Collecting other users’ personal data without a legitimate basis, scraping, or attempting to re-identify information.\n\n' +
      'Spamming, unauthorized automation, metric manipulation or any abuse of the service.\n\n' +
      'Attempting to bypass restrictions, gain unauthorized access, or interfere with the App’s operation.\n\n' +
      '8. Moderation and enforcement\n\n' +
      'Keinti may review, remove or restrict content and apply measures to accounts (e.g., warnings, limitations, suspensions or deletion) when there are reasonable indications of violations of these Terms, the law, or for security reasons.\n\n' +
      'Moderation may rely on user reports and technical measures to prevent abuse. Keinti does not guarantee prior review of all content.\n\n' +
      '9. Content rights and license\n\n' +
      'The user retains rights to the content they post. However, by posting content on Keinti, the user grants Keinti a non-exclusive, worldwide, limited license to host, store, reproduce, display and distribute that content within the App solely to operate, maintain, moderate and provide the service.\n\n' +
      'The user represents they have the necessary rights to the content they post (e.g., images) and that posting does not infringe third-party rights.\n\n' +
      '10. Third-party services, Google sign-in and advertising\n\n' +
      'The App may integrate third-party services (e.g., Google for OAuth sign-in and Google AdMob for advertising). Use of those services may be subject to the third party’s terms and policies.\n\n' +
      'Keinti may display ads in the App. Depending on applicable regulations, ads may be personalized or non-personalized and may require the user’s prior consent. Data processing and consent management (where applicable) are described in the Cookies and Advertising Policy and the Privacy Policy.\n\n' +
      '11. Account deletion, suspension and termination\n\n' +
      'The user may request deletion of their account from the App settings. When the account is deleted, data will be deleted or anonymized in accordance with the Privacy Policy and applicable technical and legal requirements.\n\n' +
      'Keinti may suspend or terminate accounts, in whole or in part, for violations of these Terms, for security reasons, or when required by law.\n\n' +
      '12. Limitation of liability\n\n' +
      'Keinti is provided “as is” and “as available”. To the extent permitted by applicable law, Keinti does not guarantee that the service will be uninterrupted, error-free, or completely secure.\n\n' +
      'In no event will Keinti be liable for indirect or consequential damages arising from the use of, or inability to use, the service, except where applicable law provides otherwise.\n\n' +
      '13. Changes to the Terms\n\n' +
      'Keinti may modify these Terms to reflect legal, technical or product changes. If changes are material, users will be informed through the App. Continued use of the App after the effective date of changes constitutes acceptance of the updated Terms.\n\n' +
      '14. Contact\n\n' +
      'For questions about these Terms, the user may contact: keintisoporte@gmail.com';

    const raw = language === 'en' ? rawEn : rawEs;

    return raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [language]);

  const renderPolicyParagraph = (paragraph: string, idx: number) => {
    const isHeading =
      /^(POLÍTICA DE PRIVACIDAD|PRIVACY POLICY)/i.test(paragraph) ||
      /^(POLÍTICA DE COOKIES Y PUBLICIDAD|COOKIES AND ADVERTISING POLICY)/i.test(paragraph) ||
      /^(TÉRMINOS Y CONDICIONES DE USO|TERMS AND CONDITIONS OF USE)/i.test(paragraph) ||
      /^(Última actualización:|Last updated:)/i.test(paragraph) ||
      /^\d+\./.test(paragraph);

    const tokenRegex = /(https?:\/\/[^\s]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    const parts = paragraph.split(tokenRegex).filter((p) => p.length > 0);

    return (
      <Text
        key={`pp-${idx}`}
        style={[styles.letterParagraph, isHeading ? styles.policyHeadingParagraph : null]}
      >
        {parts.map((part, partIdx) => {
          const isUrl = /^https?:\/\//i.test(part);
          const isEmail = !isUrl && /@/.test(part) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part);

          if (isUrl) {
            return (
              <Text
                key={`pp-${idx}-u-${partIdx}`}
                style={styles.letterEmail}
                onPress={() => Linking.openURL(part)}
                suppressHighlighting
              >
                {part}
              </Text>
            );
          }

          if (isEmail) {
            return (
              <Text
                key={`pp-${idx}-e-${partIdx}`}
                style={styles.letterEmail}
                onPress={() => Linking.openURL(`mailto:${part}`)}
                suppressHighlighting
              >
                {part}
              </Text>
            );
          }

          return (
            <Text key={`pp-${idx}-t-${partIdx}`}>
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const openLogoutConfirm = () => {
    setIsLoggingOut(false);
    setShowLogoutConfirmModal(true);
    logoutSheetAnim.setValue(0);

    if (authToken && myUsername.trim().length === 0) {
      getMyPersonalData(authToken)
        .then((data) => {
          const next = String(data?.username || '').trim();
          if (next) setMyUsername(next);
        })
        .catch(() => {});
    }

    requestAnimationFrame(() => {
      Animated.timing(logoutSheetAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const closeLogoutConfirm = () => {
    if (isLoggingOut) return;

    Animated.timing(logoutSheetAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowLogoutConfirmModal(false);
    });
  };

  const openDeleteAccountConfirm = () => {
    setShowDeleteAccountModal(true);
    deleteAccountSheetAnim.setValue(0);

    requestAnimationFrame(() => {
      Animated.timing(deleteAccountSheetAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const closeDeleteAccountConfirm = () => {
    if (isDeletingAccount) return;

    Animated.timing(deleteAccountSheetAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowDeleteAccountModal(false);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {screen === 'main'
            ? t('config.title')
            : screen === 'devicePermissions'
              ? t('config.devicePermissions')
            : screen === 'aboutKeinti'
              ? t('aboutKeinti.title')
            : screen === 'moreAboutKeinti'
              ? t('aboutKeinti.moreAboutKeinti' as TranslationKey)
            : screen === 'privacyPolicy'
              ? t('securityControl.privacyPolicy')
            : screen === 'cookiesAdPolicy'
              ? t('securityControl.cookiesAdPolicy')
            : screen === 'termsOfUse'
              ? t('securityControl.termsOfUse')
            : screen === 'personalData'
              ? t('personalData.title')
              : screen === 'securityControl'
                ? t('accountCenter.securityControl')
                : screen === 'changePassword'
                  ? t('accountCenter.changePassword')
            : screen === 'blockedUsers'
              ? t('blockedUsers.title')
              : screen === 'adminSelfies'
                ? t('adminSelfies.title')
              : t('accountCenter.title')}
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {screen === 'main' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.section}>
            <View style={styles.languageRow}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="language" size={22} color="#FFB74D" />
                <Text style={styles.rowTitle}>{t('language.label')}</Text>
              </View>

              <View style={styles.languageRight}>
                <View style={{ flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 2 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      if (language === 'es') return;
                      const prevLanguage: Language = language;
                      setLanguage('es');

                      if (!authToken) return;
                      try {
                        await updatePreferredLanguage({ token: authToken, language: 'es' });
                      } catch {
                        setLanguage(prevLanguage);
                      }
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: language === 'es' ? '#FFB74D' : 'transparent',
                    }}
                  >
                    <Text style={{ color: language === 'es' ? '#000000' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>ES</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => {
                      if (language === 'en') return;
                      const prevLanguage: Language = language;
                      setLanguage('en');

                      if (!authToken) return;
                      try {
                        await updatePreferredLanguage({ token: authToken, language: 'en' });
                      } catch {
                        setLanguage(prevLanguage);
                      }
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: language === 'en' ? '#FFB74D' : 'transparent',
                    }}
                  >
                    <Text style={{ color: language === 'en' ? '#000000' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>EN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <SettingRow title={t('config.accountCenter')} leftIcon="manage-accounts" onPress={() => setScreen('accountCenter')} />
            <SettingRow title={t('config.blockedUsers')} leftIcon="block" onPress={() => setScreen('blockedUsers')} />
            <SettingRow title={t('config.devicePermissions')} leftIcon="security" onPress={() => setScreen('devicePermissions')} />
            <SettingRow title={t('config.information')} leftIcon="info-outline" onPress={() => setScreen('aboutKeinti')} />
          </View>


        </ScrollView>
      ) : screen === 'aboutKeinti' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('aboutKeinti.title')}</Text>
          </View>

          <View style={styles.section}>
            <SimpleSettingRow
              title={t('securityControl.privacyPolicy')}
              showTopBorder={false}
              onPress={() => setScreen('privacyPolicy')}
            />
            <SimpleSettingRow
              title={t('securityControl.cookiesAdPolicy')}
              onPress={() => setScreen('cookiesAdPolicy')}
            />
            <SimpleSettingRow
              title={t('securityControl.termsOfUse')}
              onPress={() => setScreen('termsOfUse')}
            />
            <SimpleSettingRow
              title={t('securityControl.childSafetyStandards')}
              onPress={() => openPolicyUrl('childSafetyStandards')}
            />
            <SimpleSettingRow
              title={t('securityControl.accountDeletionPolicy')}
              onPress={() => openPolicyUrl('accountDeletion')}
            />
            <SimpleSettingRow
              title={t('aboutKeinti.moreAboutKeinti' as TranslationKey)}
              onPress={() => setScreen('moreAboutKeinti')}
            />
          </View>
        </ScrollView>
      ) : screen === 'moreAboutKeinti' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('aboutKeinti.moreAboutKeinti' as TranslationKey)}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.letterBody}>
              {aboutKeintiParagraphs.map((paragraph, idx) => {
                const hasEmail = paragraph.includes(CONTACT_EMAIL);
                if (!hasEmail) {
                  return (
                    <Text key={`p-${idx}`} style={styles.letterParagraph}>
                      {paragraph}
                    </Text>
                  );
                }

                const parts = paragraph.split(CONTACT_EMAIL);
                return (
                  <Text key={`p-${idx}`} style={styles.letterParagraph}>
                    {parts[0]}
                    <Text
                      style={styles.letterEmail}
                      onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                      suppressHighlighting
                    >
                      {CONTACT_EMAIL}
                    </Text>
                    {parts[1]}
                  </Text>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : screen === 'devicePermissions' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('config.devicePermissions')}</Text>
            <Text style={styles.personalDataDescription}>{t('devicePermissions.description')}</Text>
          </View>

          <View style={styles.section}>
            <View style={[styles.personalDataItem, styles.personalDataItemNoTopBorder]}>
              <View style={styles.permissionRowTop}>
                <Text style={styles.personalDataItemTitle}>{t('devicePermissions.galleryTitle')}</Text>

                {isCheckingDevicePermissions ? (
                  <ActivityIndicator color="#FFB74D" />
                ) : (
                  <TouchableOpacity
                    activeOpacity={galleryPermissionStatus === 'unknown' ? 1 : 0.75}
                    disabled={galleryPermissionStatus === 'unknown'}
                    onPress={() => {
                      if (galleryPermissionStatus === 'denied') requestOrOpenGalleryPermission();
                      if (galleryPermissionStatus === 'granted') confirmRevokeGalleryPermission();
                    }}
                    style={[
                      styles.permissionBadge,
                      galleryPermissionStatus === 'granted'
                        ? styles.permissionBadgeGranted
                        : galleryPermissionStatus === 'denied'
                          ? styles.permissionBadgeDenied
                          : styles.permissionBadgeUnknown,
                    ]}
                  >
                    <Text style={styles.permissionBadgeText}>
                      {galleryPermissionStatus === 'granted'
                        ? t('devicePermissions.statusGranted')
                        : galleryPermissionStatus === 'denied'
                          ? t('devicePermissions.statusDenied')
                          : t('devicePermissions.statusUnknown')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.permissionDescription}>{t('devicePermissions.galleryDescription')}</Text>
              {Platform.OS !== 'android' ? (
                <Text style={styles.permissionSystemHint}>{t('devicePermissions.iosHint')}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      ) : screen === 'accountCenter' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.section}>
            <SettingRow
              title={t('accountCenter.personalData')}
              leftIcon="person-outline"
              showTopBorder={false}
              onPress={() => setScreen('personalData')}
            />
            <SettingRow
              title={t('accountCenter.securityControl')}
              leftIcon="admin-panel-settings"
              onPress={() => setScreen('securityControl')}
            />
            {isBackendAdmin ? (
              <SettingRow
                title={t('accountCenter.adminSelfies')}
                leftIcon="verified-user"
                onPress={() => setScreen('adminSelfies')}
              />
            ) : null}
            <SettingRow
              title={t('accountCenter.closeAccount')}
              leftIcon="logout"
              showChevron={false}
              onPress={() => {
                openLogoutConfirm();
              }}
            />
            <SettingRow
              title={t('accountCenter.deleteAccount')}
              leftIcon="delete-outline"
              leftIconColor="#fb6159ff"
              showChevron={false}
              onPress={() => {
                if (!authToken) {
                  Alert.alert('Sesión requerida', 'Inicia sesión para eliminar tu cuenta.');
                  return;
                }
                openDeleteAccountConfirm();
              }}
            />
          </View>
        </ScrollView>
      ) : screen === 'adminSelfies' ? (
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text style={styles.personalDataTitle}>{t('adminSelfies.title')}</Text>
          <Text style={styles.sectionDescription}>
            {isBackendAdmin ? 'Herramientas de moderación (solo admins).' : 'No autorizado.'}
          </Text>

          {isBackendAdmin ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.checkButton, adminSelfiesTab !== 'pending' && styles.checkButtonDisabled, { flex: 1, marginTop: 0 }]}
                  activeOpacity={0.8}
                  onPress={() => setAdminSelfiesTab('pending')}
                >
                  <Text style={styles.checkButtonText}>{t('adminSelfies.tabPending')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.checkButton, adminSelfiesTab !== 'blocked' && styles.checkButtonDisabled, { flex: 1, marginTop: 0 }]}
                  activeOpacity={0.8}
                  onPress={() => setAdminSelfiesTab('blocked')}
                >
                  <Text style={styles.checkButtonText}>{t('adminSelfies.tabBlocked')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 12 }, isLoadingAdminSelfies && styles.primaryButtonDisabled]}
                activeOpacity={0.8}
                disabled={isLoadingAdminSelfies}
                onPress={async () => {
                  if (!authToken) return;
                  setIsLoadingAdminSelfies(true);
                  try {
                    const normalizeEmail = (v: unknown) => String(v || '').trim().toLowerCase();

                    const dedupeByEmailKeepLatest = (items: any[], dateField: 'submitted_at' | 'blocked_at') => {
                      const map = new Map<string, any>();
                      for (const item of Array.isArray(items) ? items : []) {
                        const email = normalizeEmail(item?.email);
                        if (!email) continue;

                        const existing = map.get(email);
                        if (!existing) {
                          map.set(email, item);
                          continue;
                        }

                        const existingTime = existing?.[dateField] ? new Date(String(existing[dateField])).getTime() : 0;
                        const itemTime = item?.[dateField] ? new Date(String(item[dateField])).getTime() : 0;
                        if (itemTime >= existingTime) map.set(email, { ...existing, ...item });
                      }

                      const list = Array.from(map.values());
                      list.sort((a, b) => {
                        const aTime = a?.[dateField] ? new Date(String(a[dateField])).getTime() : 0;
                        const bTime = b?.[dateField] ? new Date(String(b[dateField])).getTime() : 0;
                        return bTime - aTime;
                      });
                      return list;
                    };

                    const [pending, blocked] = await Promise.all([
                      getAdminPendingAccountSelfies(authToken),
                      getAdminBlockedAccountSelfies(authToken),
                    ]);
                    setAdminPendingSelfies(dedupeByEmailKeepLatest(pending.items || [], 'submitted_at'));
                    setAdminBlockedSelfies(dedupeByEmailKeepLatest(blocked.items || [], 'blocked_at'));
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    Alert.alert('Error', msg || 'No se pudo actualizar');
                  } finally {
                    setIsLoadingAdminSelfies(false);
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>{t('adminSelfies.refresh')}</Text>
              </TouchableOpacity>

              {isLoadingAdminSelfies ? (
                <View style={styles.centeredBox}>
                  <ActivityIndicator color="#FFB74D" />
                  <Text style={styles.placeholderText}>{t('common.loading')}</Text>
                </View>
              ) : adminSelfiesTab === 'pending' ? (
                adminPendingSelfies.length === 0 ? (
                  <Text style={styles.placeholderText}>{t('adminSelfies.emptyPending')}</Text>
                ) : (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    {adminPendingSelfies.map((item: any) => {
                      const email = String(item?.email || '').trim();
                      const username = item?.username ? String(item.username).trim() : '';
                      const submitted = item?.submitted_at ? new Date(String(item.submitted_at)).toLocaleString() : '';
                      const rawImageUrl = item?.image_url ? String(item.image_url) : '';
                      const rawImagePath = item?.image_path ? String(item.image_path) : '';
                      const imageUri = rawImageUrl
                        ? rawImageUrl.startsWith('/')
                          ? `${API_URL}${rawImageUrl}`
                          : rawImageUrl
                        : rawImagePath
                          ? rawImagePath.startsWith('/')
                            ? `${API_URL}${rawImagePath}`
                            : rawImagePath
                          : '';
                      const reason = adminReasonByEmail[email] ?? '';

                      return (
                        <View key={`p-${email}-${String(item?.submitted_at || '')}-${String(item?.image_id || item?.imageId || '')}`} style={styles.section}>
                          <View style={[styles.letterBody, styles.rowNoTopBorder]}>
                            <Text style={styles.blockedUsername} numberOfLines={1}>{username || email}</Text>
                            <Text style={styles.blockedEmail} numberOfLines={1}>{email}</Text>
                            {submitted ? <Text style={styles.helperText}>{submitted}</Text> : null}

                            {imageUri ? (
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => setAdminSelfiePreviewUri(imageUri)}
                              >
                                <Image
                                  source={{ uri: imageUri }}
                                  style={{ width: '100%', height: 280, borderRadius: 12, marginTop: 12, backgroundColor: '#1E1E1E' }}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ) : null}

                            <TextInput
                              value={reason}
                              onChangeText={(txt) => setAdminReasonByEmail((prev) => ({ ...prev, [email]: txt }))}
                              placeholder={t('adminSelfies.reasonPlaceholder')}
                              placeholderTextColor="#7a7a7a"
                              style={[styles.input, { marginTop: 12 }]}
                            />

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                              <TouchableOpacity
                                style={[styles.checkButton, { flex: 1, marginTop: 0 }]}
                                activeOpacity={0.8}
                                onPress={async () => {
                                  if (!authToken) return;
                                  try {
                                    await adminReviewAccountSelfie(authToken, { email, action: 'accepted' });
                                    setAdminPendingSelfies((prev) => prev.filter((p: any) => String(p?.email || '').trim() !== email));
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : String(e);
                                    Alert.alert('Error', msg || 'No se pudo aceptar');
                                  }
                                }}
                              >
                                <Text style={styles.checkButtonText}>{t('adminSelfies.accept')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.checkButton, { flex: 1, marginTop: 0 }]}
                                activeOpacity={0.8}
                                onPress={async () => {
                                  if (!authToken) return;
                                  try {
                                    await adminReviewAccountSelfie(authToken, { email, action: 'failed', reason });
                                    setAdminPendingSelfies((prev) => prev.filter((p: any) => String(p?.email || '').trim() !== email));
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : String(e);
                                    Alert.alert('Error', msg || 'No se pudo rechazar');
                                  }
                                }}
                              >
                                <Text style={styles.checkButtonText}>{t('adminSelfies.reject')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.checkButton, { flex: 1, marginTop: 0 }]}
                                activeOpacity={0.8}
                                onPress={async () => {
                                  if (!authToken) return;
                                  try {
                                    await adminReviewAccountSelfie(authToken, { email, action: 'blocked', reason });
                                    setAdminPendingSelfies((prev) => prev.filter((p: any) => String(p?.email || '').trim() !== email));
                                    setAdminBlockedSelfies((prev) => {
                                      const normalized = String(email || '').trim().toLowerCase();
                                      const nextItem = {
                                        email,
                                        username,
                                        blocked_at: new Date().toISOString(),
                                        reason: reason || null,
                                      };
                                      const without = (Array.isArray(prev) ? prev : []).filter(
                                        (p: any) => String(p?.email || '').trim().toLowerCase() !== normalized,
                                      );
                                      return [nextItem, ...without];
                                    });
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : String(e);
                                    Alert.alert('Error', msg || 'No se pudo bloquear');
                                  }
                                }}
                              >
                                <Text style={styles.checkButtonText}>{t('adminSelfies.block')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              ) : (
                adminBlockedSelfies.length === 0 ? (
                  <Text style={styles.placeholderText}>{t('adminSelfies.emptyBlocked')}</Text>
                ) : (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    {adminBlockedSelfies.map((item: any, idx: number) => {
                      const email = String(item?.email || '').trim();
                      const username = item?.username ? String(item.username).trim() : '';
                      const blockedAt = item?.blocked_at ? new Date(String(item.blocked_at)).toLocaleString() : '';
                      const reason = item?.reason ? String(item.reason) : '';

                      return (
                        <View key={`b-${email}-${String(item?.blocked_at || '')}-${idx}`} style={styles.section}>
                          <View style={[styles.letterBody, styles.rowNoTopBorder]}>
                            <Text style={styles.blockedUsername} numberOfLines={1}>{username || email}</Text>
                            <Text style={styles.blockedEmail} numberOfLines={1}>{email}</Text>
                            {blockedAt ? <Text style={styles.helperText}>{blockedAt}</Text> : null}
                            {reason ? <Text style={styles.errorText}>{reason}</Text> : null}

                            <TouchableOpacity
                              style={[styles.primaryButton, { marginTop: 12 }]}
                              activeOpacity={0.8}
                              onPress={async () => {
                                if (!authToken) return;
                                try {
                                  await adminReviewAccountSelfie(authToken, { email, action: 'unblocked' });
                                  setAdminBlockedSelfies((prev) => prev.filter((p: any) => String(p?.email || '').trim() !== email));
                                } catch (e) {
                                  const msg = e instanceof Error ? e.message : String(e);
                                  Alert.alert('Error', msg || 'No se pudo desbloquear');
                                }
                              }}
                            >
                              <Text style={styles.primaryButtonText}>{t('adminSelfies.unblock')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              )}
            </>
          ) : null}
        </ScrollView>
      ) : screen === 'personalData' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('personalData.title')}</Text>
            <Text style={styles.personalDataDescription}>{t('personalData.description')}</Text>
          </View>

          <View style={styles.section}>
            {isLoadingPersonalData ? (
              <View style={styles.centeredBox}>
                <ActivityIndicator color="#FFB74D" />
                <Text style={styles.placeholderText}>{t('common.loading')}</Text>
              </View>
            ) : (
              <>
                <PersonalDataItem title={t('personalData.contactInfo')} value={myEmail} isFirst />
                <PersonalDataItem title={t('personalData.birthDate')} value={myBirthDate} />
                <PersonalDataItem title={t('personalData.gender')} value={getLocalizedGender(myGender)} />
                <PersonalDataItem
                  title={t('personalData.nationality')}
                  value={myNationality}
                  onPress={() => {
                    setShowNationalityPicker((v) => !v);
                    setNationalitySearch('');
                  }}
                >
                  {isUpdatingNationality ? (
                    <View style={styles.nationalitySavingRow}>
                      <ActivityIndicator color="#FFB74D" size="small" />
                      <Text style={styles.nationalitySavingText}>{t('common.loading')}</Text>
                    </View>
                  ) : null}

                  {showNationalityPicker ? (
                    <View style={styles.nationalityPickerContainer}>
                      <TextInput
                        style={styles.nationalitySearchInput}
                        placeholder={t('register.searchCountry')}
                        placeholderTextColor="#ffffffff"
                        value={nationalitySearch}
                        onChangeText={setNationalitySearch}
                        autoCapitalize="words"
                      />

                      <ScrollView style={styles.nationalityList} nestedScrollEnabled={true}>
                        {filteredNationalities.length > 0 ? (
                          filteredNationalities.map((country) => (
                            <TouchableOpacity
                              key={country}
                              style={styles.nationalityItem}
                              onPress={() => saveNationality(country)}
                              activeOpacity={0.7}
                              disabled={isUpdatingNationality}
                            >
                              <Text style={styles.nationalityItemText}>{country}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.noResultsContainer}>
                            <Text style={styles.noResultsText}>{t('register.noCountriesFound')}</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  ) : null}
                </PersonalDataItem>
              </>
            )}
          </View>
        </ScrollView>
      ) : screen === 'securityControl' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <Text style={styles.personalDataTitle}>{t('accountCenter.securityControl')}</Text>

          <Text style={styles.sectionCaption}>{t('securityControl.passwordAndAuth')}</Text>
          <Text style={styles.sectionDescription}>{t('securityControl.passwordAndAuthDescription')}</Text>
          <View style={styles.section}>
            <SimpleSettingRow
              title={t('accountCenter.changePassword')}
              showTopBorder={false}
              onPress={() => {
                setCurrentPassword('');
                setNewPassword('');
                setRepeatNewPassword('');
                setIsCurrentPasswordValid(false);
                setShowCurrentPasswordError(false);
                setCurrentPasswordAttemptsRemaining(null);
                setCurrentPasswordLockUntil(null);
                setScreen('changePassword');
              }}
            />
            <SimpleSettingRow
              title={t('securityControl.accountAuth')}
              right={<VerifiedBadgeIcon size={22} variant="solid" solidColor="#FFFFFF" solidOpacity={0.6} />}
              showChevron={false}
              onPress={() => setScreen('accountAuth')}
            />
            <SimpleSettingRow
              title={t('securityControl.verifyYourKeinti')}
              right={<VerifiedBadgeIcon size={22} variant="gradient" />}
              showChevron={false}
              onPress={() => setScreen('verifyKeinti')}
            />
          </View>
        </ScrollView>
      ) : screen === 'verifyKeinti' ? (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <View style={styles.verifyContainer}>
            <View style={styles.verifyHeaderRow}>
              <Text style={styles.verifyTitle}>{t('securityControl.verifyYourKeinti')}</Text>
              {keintiVerified ? (
                <View style={styles.verifyVerifiedRow}>
                  <Text style={styles.verifyVerifiedText}>{t('verifyKeinti.accountVerifiedLabel' as TranslationKey)}</Text>
                  <VerifiedBadgeIcon size={22} variant="gradient" />
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.verifyCheckButton,
                    (!canVerifyKeinti || isVerifyingKeinti) && styles.verifyCheckButtonDisabled,
                  ]}
                  disabled={!canVerifyKeinti || isVerifyingKeinti}
                  onPress={handleVerifyKeinti}
                  activeOpacity={0.7}
                >
                  {isVerifyingKeinti ? (
                    <View style={styles.verifyCheckButtonLoadingRow}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.verifyCheckButtonText}>{t('common.loading')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.verifyCheckButtonText}>
                      {canVerifyKeinti ? t('verifyKeinti.verifyAction' as TranslationKey) : t('common.check')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.verifySubtitle}>{t('securityControl.verifyYourKeinti')}</Text>

            {verifyTab === 'objectives' ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.verifySectionTitle}>{t('verifyKeinti.objectivesTitle')}</Text>

                <View style={styles.verifyItem}>
                  <Text style={styles.verifyItemText}>{t('verifyKeinti.objective1')}</Text>
                  <View style={styles.verifyCheckRow}>
                    <View style={[styles.verifyRadioCircle, (keintiVerified || accountVerified) && styles.verifyRadioCircleCompleted]}>
                      {keintiVerified || accountVerified ? (
                        <MaterialIcons name="check" size={14} color="#000000" />
                      ) : null}
                    </View>
                    <Text style={styles.verifyCheckLabel}>
                      {keintiVerified || accountVerified ? t('verifyKeinti.completed') : t('verifyKeinti.complete')}
                    </Text>
                  </View>
                </View>

                {/* Objective 2 */}
                <View style={styles.verifyItem}>
                  <Text style={styles.verifyItemText}>{t('verifyKeinti.objective2')}</Text>
                  <View style={styles.verifyCheckRow}>
                    <View style={[styles.verifyRadioCircle, (keintiVerified || isVerifyObjective2Completed) && styles.verifyRadioCircleCompleted]}>
                      {keintiVerified || isVerifyObjective2Completed ? (
                        <MaterialIcons name="check" size={14} color="#000000" />
                      ) : null}
                    </View>
                    <Text style={styles.verifyCheckLabel}>
                      {keintiVerified || isVerifyObjective2Completed ? t('verifyKeinti.completed') : t('verifyKeinti.complete')}
                    </Text>
                  </View>
                  {!keintiVerified ? (
                    <View style={styles.verifyProgressContainer}>
                      <View style={styles.verifyTrack}>
                         <View
                           style={[
                             styles.verifyTrackFill,
                             {
                               width: `${Math.min(100, Math.max(0, (verifyObjective2ProgressClamped / VERIFY_OBJECTIVE2_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View
                           style={[
                             styles.verifyThumb,
                             {
                               left: `${Math.min(100, Math.max(0, (verifyObjective2ProgressClamped / VERIFY_OBJECTIVE2_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View style={[styles.verifyDot, styles.verifyDotLeft]} />
                         <View style={[styles.verifyDot, styles.verifyDotRight]} />
                      </View>
                      <View style={styles.verifyScaleLabels}>
                        <Text style={styles.verifyScaleText}>{formatNumber(verifyObjective2ProgressClamped)}</Text>
                        <Text style={styles.verifyScaleText}>{formatNumber(VERIFY_OBJECTIVE2_TARGET)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Objective 6 */}
                <View style={styles.verifyItem}>
                  <Text style={styles.verifyItemText}>{t('verifyKeinti.objective6' as TranslationKey)}</Text>
                  <View style={styles.verifyCheckRow}>
                    <View style={[styles.verifyRadioCircle, (keintiVerified || isVerifyObjective6Completed) && styles.verifyRadioCircleCompleted]}>
                      {keintiVerified || isVerifyObjective6Completed ? <MaterialIcons name="check" size={14} color="#000000" /> : null}
                    </View>
                    <Text style={styles.verifyCheckLabel}>
                      {keintiVerified || isVerifyObjective6Completed ? t('verifyKeinti.completed') : t('verifyKeinti.complete')}
                    </Text>
                  </View>
                  {!keintiVerified ? (
                    <View style={styles.verifyProgressContainer}>
                      <View style={styles.verifyTrack}>
                        <View
                          style={[
                            styles.verifyTrackFill,
                            {
                              width: `${Math.min(100, Math.max(0, (verifyObjective6ProgressClamped / VERIFY_OBJECTIVE6_TARGET) * 100))}%`,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.verifyThumb,
                            {
                              left: `${Math.min(100, Math.max(0, (verifyObjective6ProgressClamped / VERIFY_OBJECTIVE6_TARGET) * 100))}%`,
                            },
                          ]}
                        />
                        <View style={[styles.verifyDot, styles.verifyDotLeft]} />
                        <View style={[styles.verifyDot, styles.verifyDotRight]} />
                      </View>
                      <View style={styles.verifyScaleLabels}>
                        <Text style={styles.verifyScaleText}>{formatNumber(verifyObjective6ProgressClamped)}</Text>
                        <Text style={styles.verifyScaleText}>{formatNumber(VERIFY_OBJECTIVE6_TARGET)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                 {/* Objective 4 */}
                <View style={styles.verifyItem}>
                  <Text style={styles.verifyItemText}>{t('verifyKeinti.objective4')}</Text>
                  <View style={styles.verifyCheckRow}>
                    <View style={[styles.verifyRadioCircle, (keintiVerified || isVerifyObjective4Completed) && styles.verifyRadioCircleCompleted]}>
                      {keintiVerified || isVerifyObjective4Completed ? (
                        <MaterialIcons name="check" size={14} color="#000000" />
                      ) : null}
                    </View>
                    <Text style={styles.verifyCheckLabel}>
                      {keintiVerified || isVerifyObjective4Completed ? t('verifyKeinti.completed') : t('verifyKeinti.complete')}
                    </Text>
                  </View>
                  {!keintiVerified ? (
                    <View style={styles.verifyProgressContainer}>
                      <View style={styles.verifyTrack}>
                         <View
                           style={[
                             styles.verifyTrackFill,
                             {
                               width: `${Math.min(100, Math.max(0, (verifyObjective4ProgressClamped / VERIFY_OBJECTIVE4_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View
                           style={[
                             styles.verifyThumb,
                             {
                               left: `${Math.min(100, Math.max(0, (verifyObjective4ProgressClamped / VERIFY_OBJECTIVE4_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View style={[styles.verifyDot, styles.verifyDotLeft]} />
                         <View style={[styles.verifyDot, styles.verifyDotRight]} />
                      </View>
                      <View style={styles.verifyScaleLabels}>
                        <Text style={styles.verifyScaleText}>{formatNumber(verifyObjective4ProgressClamped)}</Text>
                        <Text style={styles.verifyScaleText}>{formatNumber(VERIFY_OBJECTIVE4_TARGET)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                 {/* Objective 5 */}
                <View style={styles.verifyItem}>
                  <Text style={styles.verifyItemText}>{t('verifyKeinti.objective5')}</Text>
                  <View style={styles.verifyCheckRow}>
                    <View style={[styles.verifyRadioCircle, (keintiVerified || isVerifyObjective5Completed) && styles.verifyRadioCircleCompleted]}>
                      {keintiVerified || isVerifyObjective5Completed ? (
                        <MaterialIcons name="check" size={14} color="#000000" />
                      ) : null}
                    </View>
                    <Text style={styles.verifyCheckLabel}>
                      {keintiVerified || isVerifyObjective5Completed ? t('verifyKeinti.completed') : t('verifyKeinti.complete')}
                    </Text>
                  </View>
                  {!keintiVerified ? (
                    <View style={styles.verifyProgressContainer}>
                      <View style={styles.verifyTrack}>
                         <View
                           style={[
                             styles.verifyTrackFill,
                             {
                               width: `${Math.min(100, Math.max(0, (verifyObjective5ProgressClamped / VERIFY_OBJECTIVE5_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View
                           style={[
                             styles.verifyThumb,
                             {
                               left: `${Math.min(100, Math.max(0, (verifyObjective5ProgressClamped / VERIFY_OBJECTIVE5_TARGET) * 100))}%`,
                             },
                           ]}
                         />
                         <View style={[styles.verifyDot, styles.verifyDotLeft]} />
                         <View style={[styles.verifyDot, styles.verifyDotRight]} />
                      </View>
                      <View style={styles.verifyScaleLabels}>
                        <Text style={styles.verifyScaleText}>{formatNumber(verifyObjective5ProgressClamped)}</Text>
                        <Text style={styles.verifyScaleText}>{formatNumber(VERIFY_OBJECTIVE5_TARGET)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                 <Text style={styles.verifySectionTitle}>{t('verifyKeinti.benefitsTitle')}</Text>

                 <View style={styles.verifyItem}>
                    <Text style={styles.verifyItemText}>{t('verifyKeinti.benefit1')}</Text>
                 </View>

                 <View style={styles.verifyItem}>
                    <Text style={styles.verifyItemText}>{t('verifyKeinti.benefit2')}</Text>
                 </View>

                 <View style={styles.verifyItem}>
                    <Text style={styles.verifyItemText}>{t('verifyKeinti.benefit3')}</Text>
                 </View>

                 <View style={styles.verifyItem}>
                    <Text style={styles.verifyItemText}>{t('verifyKeinti.benefit4')}</Text>
                 </View>
              </ScrollView>
            )}
          </View>

          <View style={[styles.verifyBottomBar, { paddingBottom: 20 + safeAreaInsets.bottom }]}>
             <View style={styles.verifyTabRow}>
                <TouchableOpacity onPress={() => setVerifyTab('objectives')} style={styles.verifyTabButton}>
                    <Text style={[styles.verifyTabText, verifyTab === 'objectives' && styles.verifyTabTextActive]}>{t('verifyKeinti.tabObjectives')}</Text>
                    {verifyTab === 'objectives' && <View style={styles.verifyTabIndicator} />}
                </TouchableOpacity>
                 <TouchableOpacity onPress={() => setVerifyTab('benefits')} style={styles.verifyTabButton}>
                    <Text style={[styles.verifyTabText, verifyTab === 'benefits' && styles.verifyTabTextActive]}>{t('verifyKeinti.tabBenefits')}</Text>
                    {verifyTab === 'benefits' && <View style={styles.verifyTabIndicator} />}
                </TouchableOpacity>
             </View>
             {showImportantNoticePanel && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 50 + safeAreaInsets.bottom,
                    marginHorizontal: 20,
                    backgroundColor: '#1E1E1E',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#FFB74D',
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    elevation: 8,
                    zIndex: 9999,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
                    Los usuarios que obtengan la verificación de su cuenta en Keinti no podrán monetizar por ahora. Para recibir sus primeros ingresos, deberán esperar a la próxima actualización de Keinti, que se lanzará en los próximos meses.
                  </Text>
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 5, right: 5, padding: 5 }}
                    onPress={() => setShowImportantNoticePanel(false)}
                  >
                    <MaterialIcons name="close" size={18} color="#FFFFFF" style={{ opacity: 0.6 }} />
                  </TouchableOpacity>
                </View>
             )}
             <TouchableOpacity
               onPress={() => setShowImportantNoticePanel(!showImportantNoticePanel)}
               activeOpacity={0.7}
               style={styles.verifyFooterRow}
             >
                <MaterialIcons name="info-outline" size={16} color="#888" />
                <Text style={styles.verifyFooterText}>{t('verifyKeinti.importantNotice')}</Text>
             </TouchableOpacity>
          </View>
        </View>
      ) : screen === 'accountAuth' ? (
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text style={styles.personalDataTitle}>{t('securityControl.accountAuth')}</Text>
          <Text style={styles.sectionDescription}>{t('accountAuth.description')}</Text>

          <Text style={styles.sectionCaption}>{t('accountAuth.step1Title')}</Text>
          <Text style={styles.sectionDescription}>{t('accountAuth.step1Body')}</Text>
          <View style={styles.section}>
            <View style={[styles.letterBody, styles.rowNoTopBorder]}>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                <Svg width={220} height={220} viewBox="0 0 220 220">
                  <Path
                    d="M110 12c54.124 0 98 43.876 98 98s-43.876 98-98 98S12 164.124 12 110 55.876 12 110 12z"
                    fill="none"
                    stroke="#1E1E1E"
                    strokeWidth={2}
                  />
                  <Path
                    d="M110 35c33 0 60 32 60 75s-27 75-60 75-60-32-60-75 27-75 60-75z"
                    fill="none"
                    stroke="#FFB74D"
                    strokeWidth={3}
                    opacity={0.9}
                  />
                </Svg>
              </View>

              <Text style={styles.permissionDescription}>{t('accountAuth.step1Hint')}</Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                {accountSelfieStatus !== 'accepted' ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, (isUploadingSelfie || accountSelfieStatus === 'pending' || accountSelfieBlocked) && styles.primaryButtonDisabled, { flex: 1 }]}
                    activeOpacity={0.8}
                    disabled={isUploadingSelfie || accountSelfieStatus === 'pending' || accountSelfieBlocked}
                    onPress={async () => {
                      if (!authToken) return;
                      if (accountSelfieBlocked) return;
                      setIsUploadingSelfie(true);
                      try {
                        const img = await ImageCropPicker.openCamera({
                          mediaType: 'photo',
                          useFrontCamera: true,
                          cropping: false,
                          compressImageQuality: 0.9,
                          includeBase64: false,
                          writeTempFile: true,
                        });
                        if (img?.path) {
                          await uploadAccountSelfie(img.path, authToken);
                          await refreshAccountAuth();
                        }
                      } catch (e: any) {
                        if (e?.code !== 'E_PICKER_CANCELLED') {
                          Alert.alert(t('accountAuth.errorTitle'), t('accountAuth.selfieUploadError'));
                        }
                      } finally {
                        setIsUploadingSelfie(false);
                      }
                    }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {accountSelfieBlocked
                        ? t('accountAuth.step1Blocked')
                        : accountSelfieStatus === 'pending'
                          ? t('accountAuth.step1Pending')
                          : t('accountAuth.step1Action')}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.checkButton, (isLoadingAccountAuth || accountSelfieStatus === 'accepted') && styles.checkButtonDisabled, { flex: 1 }]}
                  activeOpacity={0.8}
                  disabled={isLoadingAccountAuth || accountSelfieStatus === 'accepted'}
                  onPress={refreshAccountAuth}
                >
                  <Text style={styles.checkButtonText}>
                    {accountSelfieStatus === 'accepted' ? t('accountAuth.selfieAccepted') : t('accountAuth.refreshStatus')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.helperText}>
                  {accountSelfieBlocked
                    ? t('accountAuth.statusBlocked')
                    : accountSelfieStatus === 'not_submitted'
                    ? t('accountAuth.statusNotSubmitted')
                    : accountSelfieStatus === 'pending'
                      ? t('accountAuth.statusPending')
                      : accountSelfieStatus === 'accepted'
                        ? t('accountAuth.statusAccepted')
                        : t('accountAuth.statusFailed')}
                </Text>
                {accountSelfieBlocked && (accountSelfieBlockedReason || accountSelfieFailReason) ? (
                  <Text style={styles.errorText}>{accountSelfieBlockedReason || accountSelfieFailReason}</Text>
                ) : accountSelfieStatus === 'failed' && accountSelfieFailReason ? (
                  <Text style={styles.errorText}>{accountSelfieFailReason}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={[styles.sectionCaption, { marginTop: 18 }]}>{t('accountAuth.step2Title')}</Text>
          <Text style={styles.sectionDescription}>{t('accountAuth.step2Body')}</Text>
          <View style={styles.section}>
            <View style={[styles.letterBody, styles.rowNoTopBorder]}>
              <Text style={styles.helperText}>
                {accountSelfieStatus !== 'accepted'
                  ? t('accountAuth.step2Locked')
                  : accountVerified
                    ? t('accountAuth.completed')
                    : accountTotpEnabled
                      ? t('accountAuth.step2AlreadyEnabled')
                      : t('accountAuth.step2Ready')}
              </Text>

              {accountSelfieStatus === 'accepted' && !accountTotpEnabled && !accountVerified ? (
                <>
                  <TouchableOpacity
                    style={[styles.checkButton, isLoadingTotpSetup && styles.checkButtonDisabled]}
                    activeOpacity={0.8}
                    disabled={isLoadingTotpSetup}
                    onPress={async () => {
                      if (!authToken) return;
                      setIsLoadingTotpSetup(true);
                      try {
                        const setup = await getTotpSetup(authToken);
                        setTotpSecret(String(setup?.secret || ''));
                      } catch (e: any) {
                        Alert.alert(t('accountAuth.errorTitle'), String(e?.message || t('accountAuth.totpSetupError')));
                      } finally {
                        setIsLoadingTotpSetup(false);
                      }
                    }}
                  >
                    <Text style={styles.checkButtonText}>{t('accountAuth.generateTotp')}</Text>
                  </TouchableOpacity>

                  {totpSecret ? (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.inputLabel}>{t('accountAuth.secretLabel')}</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          Clipboard.setString(totpSecret);
                          if (Platform.OS === 'android') {
                            const { ToastAndroid } = require('react-native');
                            ToastAndroid.show(language === 'en' ? 'Copied!' : '¡Copiado!', ToastAndroid.SHORT);
                          } else {
                            Alert.alert(language === 'en' ? 'Copied!' : '¡Copiado!');
                          }
                        }}
                        style={[styles.passwordRow, { minHeight: 52, height: undefined, paddingVertical: 12, alignItems: 'flex-start' }]}
                      > 
                        <Text selectable style={[styles.passwordInput, { flex: 1 }]}>
                          {totpSecret}
                        </Text>
                        <MaterialIcons name="content-copy" size={20} color="#FFB74D" style={{ marginLeft: 8, marginTop: 2 }} />
                      </TouchableOpacity>
                      <Text style={styles.helperText}>{t('accountAuth.secretHint')}</Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>{t('accountAuth.codeLabel')}</Text>
                    <TextInput
                      style={styles.input}
                      value={totpCode}
                      onChangeText={(v) => setTotpCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      placeholder={t('accountAuth.codePlaceholder')}
                      placeholderTextColor="#FFFFFF"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.primaryButton, (!/^[0-9]{6}$/.test(totpCode) || isVerifyingTotp) && styles.primaryButtonDisabled, { marginTop: 12 }]}
                      activeOpacity={0.8}
                      disabled={!/^[0-9]{6}$/.test(totpCode) || isVerifyingTotp}
                      onPress={async () => {
                        if (!authToken) return;
                        setIsVerifyingTotp(true);
                        try {
                          const resp = await verifyTotpCode(authToken, totpCode);
                          if (resp?.account_verified) {
                            setAccountVerified(true);
                            setAccountTotpEnabled(true);
                            onAccountVerifiedChange?.(true);
                            setShowAuthSuccessModal(true);
                          }
                          await refreshAccountAuth();
                        } catch (e: any) {
                          Alert.alert(t('accountAuth.errorTitle'), String(e?.message || t('accountAuth.verifyError')));
                        } finally {
                          setIsVerifyingTotp(false);
                        }
                      }}
                    >
                      <Text style={styles.primaryButtonText}>{t('accountAuth.verifyCode')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {accountVerified ? (
                <View style={{ marginTop: 14, alignItems: 'center', gap: 10 }}>
                  <VerifiedBadgeIcon size={28} variant="solid" solidColor="#FFFFFF" solidOpacity={0.6} />
                  <Text style={[styles.helperText, { textAlign: 'center' }]}>{t('accountAuth.completed')}</Text>
                  {accountVerifiedExpiresAtMs ? (
                    <Text style={[styles.helperText, { textAlign: 'center' }]}>
                      {t('accountAuth.badgeExpiresIn')} {formatCountdown(accountVerifiedExpiresAtMs - accountVerifiedCountdownNowMs)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      ) : screen === 'cookiesAdPolicy' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('securityControl.cookiesAdPolicy')}</Text>

            <TouchableOpacity
              style={styles.checkButton}
              activeOpacity={0.8}
              onPress={() => openPolicyUrl('cookiesAdPolicy')}
            >
              <Text style={styles.checkButtonText}>
                {language === 'en' ? 'Open web version' : 'Abrir versión web'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.letterBody}>
              {cookiesAdPolicyParagraphs.map((p, idx) => renderPolicyParagraph(p, idx))}
            </View>
          </View>
        </ScrollView>
      ) : screen === 'termsOfUse' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('securityControl.termsOfUse')}</Text>

            <TouchableOpacity
              style={styles.checkButton}
              activeOpacity={0.8}
              onPress={() => openPolicyUrl('termsOfUse')}
            >
              <Text style={styles.checkButtonText}>
                {language === 'en' ? 'Open web version' : 'Abrir versión web'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.letterBody}>
              {termsOfUseParagraphs.map((p, idx) => renderPolicyParagraph(p, idx))}
            </View>
          </View>
        </ScrollView>
      ) : screen === 'privacyPolicy' ? (
        <ScrollView contentContainerStyle={contentStyle}>
          <View style={styles.personalDataHeaderBox}>
            <Text style={styles.personalDataTitle}>{t('securityControl.privacyPolicy')}</Text>

            <TouchableOpacity
              style={styles.checkButton}
              activeOpacity={0.8}
              onPress={() => openPolicyUrl('privacyPolicy')}
            >
              <Text style={styles.checkButtonText}>
                {language === 'en' ? 'Open web version' : 'Abrir versión web'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.letterBody}>
              {privacyPolicyParagraphs.map((p, idx) => renderPolicyParagraph(p, idx))}

              <Text style={styles.letterParagraph}>
                {language === 'en'
                  ? (
                    <>
                      For more information about the use of cookies, advertising identifiers and consent management, the user
                      can consult the{' '}
                      <Text
                        style={styles.letterEmail}
                        onPress={() => setScreen('cookiesAdPolicy')}
                        suppressHighlighting
                      >
                        Keinti Cookies and Advertising Policy
                      </Text>
                      .
                    </>
                  )
                  : (
                    <>
                      Para más información sobre el uso de cookies, identificadores publicitarios y gestión del consentimiento, el
                      usuario puede consultar la{' '}
                      <Text
                        style={styles.letterEmail}
                        onPress={() => setScreen('cookiesAdPolicy')}
                        suppressHighlighting
                      >
                        Política de Cookies y Publicidad de Keinti
                      </Text>
                      .
                    </>
                  )}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : screen === 'changePassword' ? (
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text style={styles.appLine}>
            {(myUsername || '@usuario').startsWith('@') ? (myUsername || '@usuario') : `@${myUsername || 'usuario'}`} - Keinti
          </Text>

          <Text style={styles.personalDataTitle}>{t('accountCenter.changePassword')}</Text>
          <Text style={styles.sectionDescription}>{t('changePassword.requirements')}</Text>

          <View style={styles.section}>
            <View style={[styles.inputBlock, styles.rowNoTopBorder]}>
              <Text style={styles.inputLabel}>{t('changePassword.currentPassword')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('changePassword.currentPassword')}
                  placeholderTextColor="#FFFFFF"
                  value={currentPassword}
                  onChangeText={(v) => {
                    setCurrentPassword(v);
                    setIsCurrentPasswordValid(false);
                    setShowCurrentPasswordError(false);
                    setCurrentPasswordAttemptsRemaining(null);
                    setCurrentPasswordLockUntil(null);
                    setNewPassword('');
                    setRepeatNewPassword('');
                  }}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  editable={!isVerifyingCurrentPassword && !isChangingPassword && !isCurrentPasswordFieldLocked}
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                  disabled={isVerifyingCurrentPassword || isChangingPassword}
                  onPress={() => setShowCurrentPassword((v) => !v)}
                >
                  <MaterialIcons
                    name={showCurrentPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color="#FFFFFF"
                    style={{ opacity: 0.6 }}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.checkButton,
                  (!authToken || !currentPassword || isVerifyingCurrentPassword || isChangingPassword || isCurrentPasswordFieldLocked || isCurrentPasswordValid)
                    ? styles.checkButtonDisabled
                    : null,
                ]}
                activeOpacity={0.8}
                disabled={!authToken || !currentPassword || isVerifyingCurrentPassword || isChangingPassword || isCurrentPasswordFieldLocked || isCurrentPasswordValid}
                onPress={async () => {
                  if (!authToken) return;
                  if (!currentPassword) return;
                  if (isVerifyingCurrentPassword) return;
                  if (isCurrentPasswordFieldLocked) return;
                  if (isCurrentPasswordValid) return;

                  setIsVerifyingCurrentPassword(true);
                  try {
                    const result = await verifyMyPassword(authToken, currentPassword);

                    if (result.ok) {
                      setIsCurrentPasswordValid(true);
                      setShowCurrentPasswordError(false);
                      setCurrentPasswordAttemptsRemaining(null);
                      setCurrentPasswordLockUntil(null);
                      return;
                    }

                    if (result.accountLocked) {
                      Alert.alert('Error', t('changePassword.accountLocked'));
                      onLogout();
                      return;
                    }

                    if (result.locked && result.lockUntil) {
                      setIsCurrentPasswordValid(false);
                      setShowCurrentPasswordError(false);
                      setCurrentPasswordAttemptsRemaining(0);
                      setCurrentPasswordLockUntil(result.lockUntil);
                      return;
                    }

                    setIsCurrentPasswordValid(false);
                    setShowCurrentPasswordError(true);
                    if (typeof result.attemptsRemaining === 'number') {
                      setCurrentPasswordAttemptsRemaining(result.attemptsRemaining);
                    }
                  } finally {
                    setIsVerifyingCurrentPassword(false);
                  }
                }}
              >
                {isVerifyingCurrentPassword ? (
                  <ActivityIndicator color="#FFB74D" />
                ) : (
                  <Text style={styles.checkButtonText}>
                    {isCurrentPasswordValid ? t('changePassword.checkCompleted') : t('common.check')}
                  </Text>
                )}
              </TouchableOpacity>

              {isVerifyingCurrentPassword ? (
                <Text style={styles.helperText}>{t('common.loading')}</Text>
              ) : showCurrentPasswordError ? (
                <Text style={styles.errorText}>{t('changePassword.currentPasswordInvalid')}</Text>
              ) : isCurrentPasswordFieldLocked ? (
                <Text style={styles.errorText}>{t('changePassword.locked')}</Text>
              ) : null}

              {typeof currentPasswordAttemptsRemaining === 'number' ? (
                <Text style={styles.helperText}>
                  {t('changePassword.attemptsRemaining').replace('{count}', String(currentPasswordAttemptsRemaining))}
                </Text>
              ) : null}
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.inputLabel, !canUseNewPasswordFields ? styles.disabledText : null]}>
                {t('changePassword.newPassword')}
              </Text>
              <View style={[styles.passwordRow, !canUseNewPasswordFields ? styles.inputDisabled : null]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('changePassword.newPassword')}
                  placeholderTextColor="#FFFFFF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={canUseNewPasswordFields && !isChangingPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                  disabled={!canUseNewPasswordFields || isChangingPassword}
                  onPress={() => setShowNewPassword((v) => !v)}
                >
                  <MaterialIcons
                    name={showNewPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color="#FFFFFF"
                    style={{ opacity: 0.6 }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.inputLabel, !canUseNewPasswordFields ? styles.disabledText : null]}>
                {t('changePassword.repeatNewPassword')}
              </Text>
              <View style={[styles.passwordRow, !canUseNewPasswordFields ? styles.inputDisabled : null]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('changePassword.repeatNewPassword')}
                  placeholderTextColor="#FFFFFF"
                  value={repeatNewPassword}
                  onChangeText={setRepeatNewPassword}
                  secureTextEntry={!showRepeatNewPassword}
                  autoCapitalize="none"
                  editable={canUseNewPasswordFields && !isChangingPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                  disabled={!canUseNewPasswordFields || isChangingPassword}
                  onPress={() => setShowRepeatNewPassword((v) => !v)}
                >
                  <MaterialIcons
                    name={showRepeatNewPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color="#FFFFFF"
                    style={{ opacity: 0.6 }}
                  />
                </TouchableOpacity>
              </View>
              {canUseNewPasswordFields && repeatNewPassword.length > 0 && !newPasswordsMatch ? (
                <Text style={styles.errorText}>{t('changePassword.passwordsDontMatch')}</Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={isChangingPassword}
            onPress={() => setPasswordResetVisible(true)}
          >
            <HighlightedI18nText i18nKey="common.forgotPassword" style={styles.forgotPassword} />
          </TouchableOpacity>

          <PasswordResetModal
            visible={passwordResetVisible}
            onClose={() => setPasswordResetVisible(false)}
            initialEmail={myEmail}
            disabled={isChangingPassword}
          />

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmitPasswordChange ? styles.primaryButtonDisabled : null]}
            activeOpacity={0.8}
            disabled={!canSubmitPasswordChange}
            onPress={async () => {
              if (!authToken) return;
              if (!canSubmitPasswordChange) return;

              setIsChangingPassword(true);
              try {
                await changeMyPassword(authToken, currentPassword, newPassword);
                Alert.alert(t('common.confirm'), t('changePassword.success'));
                setCurrentPassword('');
                setNewPassword('');
                setRepeatNewPassword('');
                setIsCurrentPasswordValid(false);
                setShowCurrentPasswordError(false);
                setScreen('securityControl');
              } catch (e: any) {
                Alert.alert('Error', e?.message || 'No se pudo cambiar la contraseña');
              } finally {
                setIsChangingPassword(false);
              }
            }}
          >
            {isChangingPassword ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('accountCenter.changePassword')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={[contentStyle, { flex: 1 }]}>
          <View style={[styles.section, { flex: 1 }]}>
            {isLoadingBlockedUsers ? (
              <View style={styles.centeredBox}>
                <ActivityIndicator color="#FFB74D" />
                <Text style={styles.placeholderText}>{t('common.loading')}</Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(u, idx) => `${u.group_id}-${u.email}-${idx}`}
                ListEmptyComponent={
                  <View style={styles.centeredBox}>
                    <Text style={styles.placeholderText}>{t('blockedUsers.empty')}</Text>
                  </View>
                }
                renderItem={({ item: u, index: idx }) => {
                  const avatarUri = u.profile_photo_uri ? getServerResourceUrl(String(u.profile_photo_uri)) : '';
                  const displayName = u.username
                    ? (u.username.startsWith('@') ? u.username : `@${u.username}`)
                    : '@Usuario';
                  const key = `${u.group_id}:${u.email}`;
                  const isExpanded = !!expandedBlockedReasons[key];
                  return (
                    <View
                      style={[styles.blockedRow, idx === 0 ? styles.blockedRowNoTopBorder : null]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => {
                          setExpandedBlockedReasons(prev => ({ ...prev, [key]: !prev[key] }));
                        }}
                        style={styles.blockedLeft}
                      >
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.blockedAvatar} />
                        ) : (
                          <View style={styles.blockedAvatarPlaceholder}>
                            <MaterialIcons name="person" size={20} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.blockedUsername} numberOfLines={1}>
                            {displayName}
                          </Text>
                          {String(u.group_hashtag || '').trim().length > 0 ? (
                            <Text style={styles.blockedEmail} numberOfLines={1}>
                              #{String(u.group_hashtag || '').trim()}
                            </Text>
                          ) : null}
                          <Text
                            style={styles.blockedEmail}
                            numberOfLines={isExpanded ? undefined : 1}
                            ellipsizeMode={isExpanded ? undefined : 'tail'}
                          >
                            {String(u.block_reason || '').trim() || 'sin motivo'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e: GestureResponderEvent) => {
                          setUserToUnlock(u);
                          // Position slightly above the touch point and to the left
                          setUnlockPosition({ top: e.nativeEvent.pageY - 15, right: 50 });
                        }}
                      >
                        <MaterialIcons name="block" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      )}



      <Modal
        visible={showAuthSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAuthSuccessModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAuthSuccessModal(false)}>
          <View style={styles.authSuccessOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.authSuccessPanel}>
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <VerifiedBadgeIcon size={38} variant="gradient" gradientColors={['#FFB74D', '#ffec5aff']} checkColor="#000000" />
                </View>
                <Text style={styles.authSuccessTitle}>{t('accountAuth.successTitle')}</Text>
                <Text style={styles.authSuccessBody}>{t('accountAuth.successBody')}</Text>
                <TouchableOpacity
                  style={styles.authSuccessButton}
                  activeOpacity={0.7}
                  onPress={() => setShowAuthSuccessModal(false)}
                >
                  <Text style={styles.authSuccessButtonText}>{t('common.accept' as TranslationKey)}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!adminSelfiePreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setAdminSelfiePreviewUri(null)}
      >
        <TouchableWithoutFeedback onPress={() => setAdminSelfiePreviewUri(null)}>
          <View style={styles.imagePreviewOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.imagePreviewContent}>
                {adminSelfiePreviewUri ? (
                  <Image
                    source={{ uri: adminSelfiePreviewUri }}
                    style={styles.imagePreviewImage}
                    resizeMode="contain"
                  />
                ) : null}

                <TouchableOpacity
                  style={styles.imagePreviewClose}
                  activeOpacity={0.85}
                  onPress={() => setAdminSelfiePreviewUri(null)}
                >
                  <MaterialIcons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!userToUnlock}
        transparent
        animationType="fade"
        onRequestClose={() => setUserToUnlock(null)}
      >
        <TouchableWithoutFeedback onPress={() => setUserToUnlock(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.unlockPanel,
                  unlockPosition ? { position: 'absolute', top: unlockPosition.top, right: unlockPosition.right } : {},
                ]}
              >
                <TouchableOpacity
                  style={styles.unlockOption}
                  onPress={() => {
                    const target = userToUnlock;
                    if (!target?.email) {
                      setUserToUnlock(null);
                      setUnlockPosition(null);
                      return;
                    }
                    if (!authToken) {
                      Alert.alert('Sesión requerida', 'Inicia sesión para desbloquear.');
                      setUserToUnlock(null);
                      setUnlockPosition(null);
                      return;
                    }
                    if (isUnlockingUser) return;

                    setIsUnlockingUser(true);
                    fetch(`${API_URL}/api/group-requests/unblock`, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${authToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ email: target.email, groupId: target.group_id }),
                    })
                      .then(async (resp) => {
                        if (!resp.ok) {
                          const err = await resp.json().catch(() => ({}));
                          throw new Error(err?.error || 'No se pudo desbloquear');
                        }
                        setBlockedUsers(prev => prev.filter(u => !(u.email === target.email && u.group_id === target.group_id)));
                        setExpandedBlockedReasons(prev => {
                          const next = { ...prev };
                          delete next[`${target.group_id}:${target.email}`];
                          return next;
                        });
                        setUserToUnlock(null);
                        setUnlockPosition(null);
                      })
                      .catch((e: any) => {
                        Alert.alert('Error', e?.message || 'No se pudo desbloquear');
                        setUserToUnlock(null);
                        setUnlockPosition(null);
                      })
                      .finally(() => setIsUnlockingUser(false));
                  }}
                  disabled={isUnlockingUser}
                >
                  <Text style={styles.unlockText}>{t('common.unlock')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showLogoutConfirmModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeLogoutConfirm}
      >
        <TouchableWithoutFeedback onPress={closeLogoutConfirm}>
          <Animated.View
            style={[
              styles.logoutOverlay,
              {
                opacity: logoutSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.62],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <View style={styles.logoutSheetRoot} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.logoutSheet,
              {
                paddingBottom: 18 + safeAreaInsets.bottom,
                transform: [
                  {
                    translateY: logoutSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [340, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View>
                <View style={styles.logoutHandle} />

                <View style={styles.logoutHeaderRow}>
                  <View style={styles.logoutIconWrap}>
                    <View style={styles.logoutIconGlow} />
                    <MaterialIcons name="logout" size={22} color="#000000" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.logoutTitle}>
                      {language === 'en' ? 'Log out?' : '¿Cerrar sesión?'}
                    </Text>
                    <Text style={styles.logoutSubtitle}>
                      {language === 'en'
                        ? 'You’ll need to sign in again on this device.'
                        : 'Tendrás que iniciar sesión de nuevo en este dispositivo.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.logoutInfoBox}>
                  <Text style={styles.logoutInfoText}>
                    {language === 'en'
                      ? `Signed in as @${(myUsername || '').trim().replace(/^@+/, '') || '...'}`
                      : `Has iniciado sesión como @${(myUsername || '').trim().replace(/^@+/, '') || '...'}`}
                  </Text>
                </View>

                <View style={styles.logoutButtonsRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.logoutButton, styles.logoutButtonSecondary]}
                    disabled={isLoggingOut}
                    onPress={closeLogoutConfirm}
                  >
                    <Text style={styles.logoutButtonSecondaryText}>
                      {language === 'en' ? 'Stay' : 'Mantener sesión'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.logoutButton, styles.logoutButtonPrimary, isLoggingOut && styles.logoutButtonDisabled]}
                    disabled={isLoggingOut}
                    onPress={() => {
                      if (isLoggingOut) return;
                      setIsLoggingOut(true);

                      Animated.timing(logoutSheetAnim, {
                        toValue: 0,
                        duration: 160,
                        easing: Easing.in(Easing.cubic),
                        useNativeDriver: true,
                      }).start(() => {
                        setShowLogoutConfirmModal(false);
                        onLogout();
                      });
                    }}
                  >
                    {isLoggingOut ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.logoutButtonPrimaryText}>
                        {language === 'en' ? 'Log out' : 'Cerrar sesión'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.logoutFootnote}>
                  {language === 'en'
                    ? 'Tip: If you’re on a shared device, logging out helps protect your account.'
                    : 'Consejo: si estás en un dispositivo compartido, cerrar sesión protege tu cuenta.'}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteAccountModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDeleteAccountConfirm}
      >
        <TouchableWithoutFeedback onPress={closeDeleteAccountConfirm}>
          <Animated.View
            style={[
              styles.deleteAccountOverlay,
              {
                opacity: deleteAccountSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.72],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <View style={styles.deleteAccountSheetRoot} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.deleteAccountSheet,
              {
                paddingBottom: 18 + safeAreaInsets.bottom,
                transform: [
                  {
                    translateY: deleteAccountSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [420, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View>
                <View style={styles.deleteAccountHandle} />

                <View style={styles.deleteAccountHeaderRow}>
                  <View style={styles.deleteAccountIconWrap}>
                    <View style={styles.deleteAccountIconGlow} />
                    <MaterialIcons name="delete-forever" size={22} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.deleteAccountTitle}>{t('accountCenter.deleteAccountConfirmTitle')}</Text>
                    <Text style={styles.deleteAccountSubtitle}>{t('accountCenter.deleteAccountConfirmBody')}</Text>
                  </View>
                </View>

                <View style={styles.deleteAccountWarningBox}>
                  <Text style={styles.deleteAccountWarningText}>
                    {language === 'en'
                      ? 'This action is irreversible. Your account and data will be permanently removed.'
                      : 'Esta acción es irreversible. Tu cuenta y tus datos se eliminarán permanentemente.'}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => openPolicyUrl('accountDeletion')}
                  disabled={isDeletingAccount}
                  style={{ marginTop: 12 }}
                >
                  <View style={styles.deleteAccountPolicyLinkRow}>
                    <Text style={styles.deleteAccountPolicyLinkText}>
                      {t('accountCenter.accountDeletionPolicyLink')}
                    </Text>
                    <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
                  </View>
                </TouchableOpacity>

                <View style={styles.deleteAccountButtonsRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.deleteAccountButton, styles.deleteAccountButtonSecondary]}
                    disabled={isDeletingAccount}
                    onPress={closeDeleteAccountConfirm}
                  >
                    <Text style={styles.deleteAccountButtonSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.deleteAccountButton, styles.deleteAccountButtonDanger, isDeletingAccount && styles.deleteAccountButtonDisabled]}
                    disabled={isDeletingAccount}
                    onPress={async () => {
                      if (!authToken) return;
                      if (isDeletingAccount) return;

                      setIsDeletingAccount(true);
                      try {
                        await deleteMyAccount(authToken);
                        Animated.timing(deleteAccountSheetAnim, {
                          toValue: 0,
                          duration: 160,
                          easing: Easing.in(Easing.cubic),
                          useNativeDriver: true,
                        }).start(() => {
                          setShowDeleteAccountModal(false);
                          onLogout();
                        });
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'No se pudo eliminar la cuenta');
                      } finally {
                        setIsDeletingAccount(false);
                      }
                    }}
                  >
                    {isDeletingAccount ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.deleteAccountButtonDangerText}>
                        {language === 'en' ? 'Delete' : 'Eliminar'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.deleteAccountFootnote}>
                  {language === 'en'
                    ? 'If this was a mistake, cancel and review the policy first.'
                    : 'Si esto fue un error, cancela y revisa la política primero.'}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showRevokeGalleryPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isRevokingGalleryPermission) return;
          setShowRevokeGalleryPermissionModal(false);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            if (isRevokingGalleryPermission) return;
            setShowRevokeGalleryPermissionModal(false);
          }}
        >
          <View style={styles.deleteOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.deletePanel}>
                <Text style={styles.deleteTitle}>{t('devicePermissions.revokeConfirmTitle')}</Text>
                <Text style={styles.deleteBody}>{t('devicePermissions.revokeConfirmBody')}</Text>

                <View style={styles.deleteButtonsRow}>
                  <TouchableOpacity
                    style={[styles.deleteButton, styles.deleteButtonSecondary]}
                    activeOpacity={0.8}
                    disabled={isRevokingGalleryPermission}
                    onPress={() => setShowRevokeGalleryPermissionModal(false)}
                  >
                    <Text style={styles.deleteButtonSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteButton, styles.deleteButtonPrimary]}
                    activeOpacity={0.8}
                    disabled={isRevokingGalleryPermission}
                    onPress={async () => {
                      if (isRevokingGalleryPermission) return;

                      setIsRevokingGalleryPermission(true);
                      try {
                        setGalleryPermissionStatus('denied');
                        lastSyncedGalleryPermissionRef.current = 'denied';
                        if (authToken) {
                          await setMyDevicePermissions(authToken, { galleryPermissionGranted: false }).catch(() => {});
                        }
                        setShowRevokeGalleryPermissionModal(false);
                      } finally {
                        setIsRevokingGalleryPermission(false);
                      }
                    }}
                  >
                    {isRevokingGalleryPermission ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.deleteButtonPrimaryText}>{t('common.confirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56 + ANDROID_TOP_INSET,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: ANDROID_TOP_INSET,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightSpacer: {
    width: 44,
    height: 44,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  centeredBox: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  section: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  blockedRowNoTopBorder: {
    borderTopWidth: 0,
  },
  blockedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  blockedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E1E1E',
  },
  blockedAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedUsername: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  blockedEmail: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  rowNoTopBorder: {
    borderTopWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  personalDataHeaderBox: {
    marginBottom: 14,
  },
  personalDataTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  personalDataDescription: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 14,
    lineHeight: 20,
  },

  letterBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  letterParagraph: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'justify',
    marginBottom: 12,
  },
  letterEmail: {
    color: '#FFB74D',
    fontWeight: '800',
  },
  policyHeadingParagraph: {
    opacity: 0.95,
    fontWeight: '800',
  },
  personalDataItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  personalDataItemNoTopBorder: {
    borderTopWidth: 0,
  },
  personalDataItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  personalDataItemValue: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.7,
    marginTop: 6,
  },

  nationalitySavingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  nationalitySavingText: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 12,
    fontWeight: '700',
  },
  nationalityPickerContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    paddingTop: 12,
  },
  nationalitySearchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    backgroundColor: '#000000',
  },
  nationalityList: {
    marginTop: 10,
    maxHeight: 220,
  },
  nationalityItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  nationalityItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  noResultsContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 13,
  },

  permissionRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  permissionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  permissionBadgeGranted: {
    borderColor: '#FFB74D',
  },
  permissionBadgeDenied: {
    borderColor: '#fb6159ff',
  },
  permissionBadgeUnknown: {
    borderColor: '#1E1E1E',
  },
  permissionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.95,
  },
  permissionDescription: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  permissionSystemHint: {
    color: '#FFFFFF',
    opacity: 0.6,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },

  sectionCaption: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionDescription: {
    color: '#FFFFFF',
    opacity: 0.6,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },

  appLine: {
    color: '#FFFFFF',
    opacity: 0.6,
    fontSize: 13,
    marginBottom: 8,
  },
  inputBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    backgroundColor: '#000000',
  },
  passwordRow: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 14,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  helperText: {
    color: '#FFFFFF',
    opacity: 0.6,
    fontSize: 12,
    marginTop: 8,
  },
  checkButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#fb6159ff',
    fontSize: 12,
    marginTop: 8,
  },
  disabledText: {
    opacity: 0.5,
  },
  forgotPassword: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 18,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFB74D',
  },
  primaryButtonDisabled: {
    backgroundColor: '#1E1E1E',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  languageRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageValue: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // More transparent for context menu feel
  },
  unlockPanel: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  unlockOption: {
    paddingVertical: 4,
  },
  unlockText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  authSuccessOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  authSuccessPanel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  authSuccessTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSuccessBody: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
  },
  authSuccessButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#FFB74D',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authSuccessButtonText: {
    color: '#FFB74D',
    fontSize: 14,
    fontWeight: '700',
  },
  deletePanel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
    padding: 18,
  },
  deleteTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  deleteBody: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 0) + 10,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonSecondary: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  deleteButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButtonPrimary: {
    backgroundColor: '#FFB74D',
  },
  deleteButtonPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  logoutSheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logoutSheet: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: 16,
    paddingBottom: 18,
  },
  logoutHandle: {
    alignSelf: 'center',
    width: 56,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#1E1E1E',
    marginBottom: 14,
  },
  logoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFB74D',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoutIconGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 183, 77, 0.35)',
  },
  logoutTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  logoutSubtitle: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  logoutInfoBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#050505',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logoutInfoText: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  logoutButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonSecondary: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#000000',
  },
  logoutButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.9,
  },
  logoutButtonPrimary: {
    backgroundColor: '#FFB74D',
  },
  logoutButtonPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  logoutButtonDisabled: {
    opacity: 0.75,
  },
  logoutFootnote: {
    marginTop: 12,
    color: '#FFFFFF',
    opacity: 0.55,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },

  deleteAccountOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  deleteAccountSheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  deleteAccountSheet: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: 16,
    paddingBottom: 18,
  },
  deleteAccountHandle: {
    alignSelf: 'center',
    width: 56,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#1E1E1E',
    marginBottom: 14,
  },
  deleteAccountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAccountIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fb6159ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deleteAccountIconGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(251, 97, 89, 0.28)',
  },
  deleteAccountTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  deleteAccountSubtitle: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  deleteAccountWarningBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 97, 89, 0.55)',
    backgroundColor: 'rgba(251, 97, 89, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteAccountWarningText: {
    color: '#FFFFFF',
    opacity: 0.86,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  deleteAccountButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteAccountButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButtonSecondary: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#000000',
  },
  deleteAccountButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.9,
  },
  deleteAccountButtonDanger: {
    backgroundColor: '#fb6159ff',
  },
  deleteAccountButtonDangerText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  deleteAccountButtonDisabled: {
    opacity: 0.75,
  },
  deleteAccountFootnote: {
    marginTop: 12,
    color: '#FFFFFF',
    opacity: 0.55,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  deleteAccountPolicyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteAccountPolicyLinkText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    opacity: 0.9,
  },
  verifyContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flex: 1,
  },
  verifyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  verifyCheckButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
  },
  verifyCheckButtonDisabled: {
    opacity: 0.5,
  },
  verifyCheckButtonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyCheckButtonText: {
    color: '#FFFFFF',
    opacity: 0.95,
    fontSize: 12,
    fontWeight: '700',
  },
  verifyVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyVerifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  verifySubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  verifySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  verifyItem: {
    marginBottom: 20,
  },
  verifyItemText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  verifyCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verifyRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyRadioCircleCompleted: {
    backgroundColor: '#FFB74D',
    borderColor: '#FFB74D',
  },
  verifyCheckLabel: {
    color: '#AAA',
    fontSize: 14,
  },
  verifyProgressContainer: {
    marginTop: 4,
  },
  verifyTrack: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    position: 'relative',
    marginHorizontal: 8, 
    marginVertical: 10,
  },
  verifyTrackFill: {
    height: '100%',
    backgroundColor: '#FFB74D',
    borderRadius: 2,
  },
  verifyThumb: {
    position: 'absolute',
    top: -6, 
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFB74D',
    marginLeft: -8, // Center thumb
  },
  verifyDot: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verifyDotLeft: {
    left: -4,
    backgroundColor: '#FFB74D',
  },
  verifyDotRight: {
    right: -4,
    backgroundColor: '#555',
  },
  verifyScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  verifyScaleText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  verifyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    paddingBottom: 20,
    alignItems: 'center',
  },
  verifyTabRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  verifyTabButton: {
    alignItems: 'center',
    paddingBottom: 4,
    minWidth: 80,
  },
  verifyTabText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  verifyTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 30,
    height: 3,
    backgroundColor: '#FFB74D',
    borderRadius: 1.5,
  },
  verifyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.6,
  },
  verifyFooterText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});

export default Configuration;
