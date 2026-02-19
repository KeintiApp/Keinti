import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  Platform,
  PermissionsAndroid,
  Linking,
  TextInput,
  Easing,
  InteractionManager,
  AppState,
} from 'react-native';
import type { ImageSourcePropType, ViewToken } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MapView, { PROVIDER_GOOGLE, type PoiClickEvent } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

import ImageCropPicker from 'react-native-image-crop-picker';
import ProfilePhotoEdit from './ProfilePhotoEdit';
import CarouselImageEditor from './CarouselImageEditor';
import { deleteDraftUploadedImageByUrl, getAccountAuthStatus, getMyDevicePermissions, getMyUiHints, setMyDevicePermissions, setMyUiHints, updateProfilePhoto, updateSocialNetworks, uploadImage } from '../services/userService';
import { trackAdPaidEvent } from '../services/adRevenueService';
import { API_URL, getServerResourceUrl } from '../config/api';
import { BANNER_AD_UNIT_ID, INTERSTITIAL_AD_UNIT_ID, REWARDED_AD_UNIT_ID } from '../config/admob';
import { POST_TTL_MS } from '../config/postTtl';
import { useI18n } from '../i18n/I18nProvider';
import type { Language, TranslationKey } from '../i18n/translations';

import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BLOCKED_JOINED_GROUP_IDS_KEY = 'keinti.blocked_joined_group_ids';
const PROFILE_YOUR_PROFILE_HINT_SEEN_KEY = 'keinti.hints.profile_your_profile_seen';
const HOME_INTIMIDADES_UNLOCKS_STORAGE_KEY_PREFIX = 'keinti.home_intimidades_unlocks.';
const HOME_LOADER_MIN_MS = 1000;
const HOME_INTERSTITIAL_MIN_VIEWS = 16;
const HOME_INTERSTITIAL_MAX_VIEWS = 18;

// In-memory fallback so the tutorial can still appear once even if
// the backend ui-hints endpoint is temporarily unavailable.
// IMPORTANT: this must be per-user, otherwise one user's swipe would hide the tutorial for everyone.
const homeSwipeTutorialSeenMemoryByEmail = new Set<string>();

const normalizeEmailKey = (raw?: string | null) => String(raw || '').trim().toLowerCase();

const CHANNEL_IMAGE_MESSAGE_PREFIX = '__KIMG__';

const CHANNEL_IMAGE_UNLOCKS_STORAGE_KEY_PREFIX = 'keinti.channel_image_unlocks.';
const CHANNEL_IMAGE_LOCK_OVERLAY_TEXT_TOP = 'Visualizar imagen';
const CHANNEL_IMAGE_LOCK_OVERLAY_TEXT_BOTTOM = '(ver anuncio)';
// RN Image blurRadius is a platform-specific numeric value; this approximates ~80% blur.
const CHANNEL_IMAGE_LOCK_BLUR_RADIUS = 22;

// Height reserved by the custom bottom nav bar (plus a small safety margin).
const BOTTOM_NAV_OVERLAY_HEIGHT = 60;

const hashString = (input: string) => {
  // Simple non-crypto hash for stable storage keys.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

const makeChannelImageUnlockKey = (postId: string, messageKey: string, mediaUri: string) => {
  const safePostId = String(postId || '').trim() || 'unknown';
  const safeMessageKey = String(messageKey || '').trim() || 'unknown';
  const safeUriHash = hashString(String(mediaUri || '').trim());
  return `${safePostId}:${safeMessageKey}:${safeUriHash}`;
};

const encodeChannelImageMessage = (payload: { url: string; caption?: string }) => {
  const safe = {
    url: String(payload?.url || '').trim(),
    caption: String(payload?.caption || ''),
  };
  return `${CHANNEL_IMAGE_MESSAGE_PREFIX}${JSON.stringify(safe)}`;
};

const parseChannelImageMessage = (raw: string): { url: string; caption: string } | null => {
  const text = String(raw || '');
  if (!text.startsWith(CHANNEL_IMAGE_MESSAGE_PREFIX)) return null;
  const json = text.slice(CHANNEL_IMAGE_MESSAGE_PREFIX.length);
  try {
    const parsed = JSON.parse(json);
    const url = String(parsed?.url || '').trim();
    const caption = String(parsed?.caption || '');
    if (!url) return null;
    return { url, caption };
  } catch {
    return null;
  }
};

const withHexAlpha = (color: string, alpha: number) => {
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const raw = String(color || '').trim();
  if (!raw) return `rgba(255,255,255,${a})`;

  if (raw.startsWith('#')) {
    let hex = raw.slice(1);
    if (hex.length === 3) {
      hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every(n => Number.isFinite(n))) {
        return `rgba(${r},${g},${b},${a})`;
      }
    }
  }

  // Fallback (named colors / existing rgba): keep as-is.
  return raw;
};

const GROUP_MEMBERS_VISIBLE_CARDS = 5;
const GROUP_MEMBERS_CARD_GAP = 10;
const GROUP_MEMBERS_LIST_BOTTOM_SPACER = 28;
const GROUP_MEMBER_CARD_ESTIMATED_HEIGHT = 74;
const JOINED_GROUPS_RENDER_BATCH = 24;

const GradientSpinner = ({ size = 44 }: { size?: number }) => {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    anim.start();
    return () => anim.stop();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const strokeWidth = Math.max(3, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(8, circumference * 0.25);

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="grad_spinner_orange_yellow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ff9900" stopOpacity="1" />
            <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#grad_spinner_orange_yellow)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
};

const getAsyncStorageSafe = (): any | null => {
  try {
    // Validate that the native module exists before returning the JS wrapper.
    // If the app wasn't rebuilt after installing the package, AsyncStorage methods throw:
    // "NativeModule: AsyncStorage is null."
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeModules, TurboModuleRegistry } = require('react-native');
    const nativeModule =
      (TurboModuleRegistry?.get?.('RNCAsyncStorage') ?? null) ||
      NativeModules?.RNCAsyncStorage ||
      NativeModules?.RNC_AsyncStorage;

    if (!nativeModule) return null;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    return mod?.default ?? mod;
  } catch (e) {
    // If the native module isn't linked/built yet, importing AsyncStorage can throw.
    return null;
  }
};

const makeHomeIntimidadesUnlockSig = (pubId: string | number, createdAt: unknown) => {
  const id = String(pubId ?? '').trim();
  if (!id) return '';

  const toDate = (value: unknown): Date | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  const raw = String(createdAt ?? '').trim();

  const dt = toDate(createdAt);
  if (dt) {
    return `${id}:${dt.toISOString()}`;
  }

  // Reinforcement:
  // - Always persist something stable even if the device can't parse the date.
  // - Still resets correctly when the post is republished (new id and/or new createdAt string).
  return raw ? `${id}:${raw}` : id;
};

const makeHomeIntimidadesUnlockStorageKey = (email?: string | null) => {
  const emailKey = normalizeEmailKey(email);
  const safe = emailKey || 'anon';
  // Hash to keep key short and consistent.
  return `${HOME_INTIMIDADES_UNLOCKS_STORAGE_KEY_PREFIX}${hashString(safe)}`;
};


const CarouselPaginationDot = ({ active }: { active: boolean }) => {
  const height = 8;
  const activeWidth = 24;
  const radius = 4;

  if (!active) {
    return <View style={styles.carouselDot} />;
  }

  return (
    <Svg width={activeWidth} height={height}>
      <Defs>
        <LinearGradient id="carousel_dot_grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
          <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={activeWidth} height={height} rx={radius} ry={radius} fill="url(#carousel_dot_grad)" />
    </Svg>
  );
};

interface GradientIconProps {
  name: string;
  size: number;
  colors: string[];
}

const GradientIcon = ({ name, size, colors }: GradientIconProps) => {
  if (name === 'panorama-fish-eye') {
    return (
      <Svg height={size} width={size}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={colors[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 2.5) / 2}
          stroke="url(#grad)"
          strokeWidth="2.5"
          fill="none"
        />
      </Svg>
    );
  }

  return <MaterialIcons name={name} size={size} color={colors[1] || colors[0]} />;
};

type BottomNavIconName = 'home' | 'person' | 'forum';

const BottomNavGradientIcon = ({
  name,
  size,
  reverse = false,
  opacity = 1,
  color,
}: {
  name: BottomNavIconName;
  size: number;
  reverse?: boolean;
  opacity?: number;
  color?: string;
}) => {
  const pathByName: Record<BottomNavIconName, string> = {
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    person:
      'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    forum:
      'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={`grad_${name}`} x1="0" y1="0" x2="1" y2="1">
          <Stop
            offset="0"
            stopColor={reverse ? '#ffe45c' : '#FFB74D'}
            stopOpacity={opacity}
          />
          <Stop
            offset="1"
            stopColor={reverse ? '#FFB74D' : '#ffe45c'}
            stopOpacity={opacity}
          />
        </LinearGradient>
      </Defs>
      <Path fill={color || `url(#grad_${name})`} d={pathByName[name]} />
    </Svg>
  );
};

const NextDiscoverIcon = ({ width = 36, height = 24 }: { width?: number; height?: number }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 36 24">
      <Defs>
        <LinearGradient id="next_grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
          <Stop offset="1" stopColor="#ffec5aff" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="1" y="1" width="32" height="20" rx="10" stroke="url(#next_grad)" strokeWidth="2" fill="none" />
      <Path
        d="M14 6 L20 11 L14 16"
        fill="none"
        stroke="url(#next_grad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const NextDiscoverProgressLine = ({ width = 27, height = 5 }: { width?: number; height?: number }) => {
  const radius = height / 2;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="next_progress_grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
          <Stop offset="1" stopColor="#ffec5aff" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} rx={radius} ry={radius} fill="url(#next_progress_grad)" />
    </Svg>
  );
};

const VerifiedBadgeIcon = ({
  size,
  variant = 'solid',
  solidColor = '#FFFFFF',
  solidOpacity = 0.6,
  checkColor = '#000000',
  gradientColors = ['#FFB74D', '#ffec5aff'],
}: {
  size: number;
  variant?: 'solid' | 'gradient';
  solidColor?: string;
  solidOpacity?: number;
  checkColor?: string;
  gradientColors?: [string, string];
}) => {
  const gradientId = useMemo(
    () => `verified_badge_grad_${Math.random().toString(16).slice(2)}`,
    []
  );

  const shieldFill = variant === 'gradient' ? `url(#${gradientId})` : (solidColor as any);
  const shieldOpacity = variant === 'solid' ? solidOpacity : 1;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {variant === 'gradient' ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={gradientColors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradientColors[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path
        d="M23 12l-2.44-2.79.34-3.7-3.61-.82-1.89-3.2L12 2.76 8.6 1.49 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.24l3.4 1.27 1.89-3.2 3.61-.82-.34-3.7L23 12z"
        fill={shieldFill}
        opacity={shieldOpacity}
      />
      <Path
        d="M9 16.17l-3.5-3.5 1.41-1.41L9 13.35l7.09-7.09 1.41 1.41z"
        fill={checkColor}
      />
    </Svg>
  );
};

const GroupAddGradientIcon = ({ size }: { size: number }) => {
  return <MaterialIcons name="group-add" size={size} color="#FFFFFF" />;
};

const FireworkChatIcon = ({ size, onPress, style }: { size: number, onPress: () => void, style?: any }) => {
  const [anims] = useState(Array.from({ length: 8 }, () => new Animated.Value(0)));

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
    };

    const animations = anims.map((anim, i) => createAnimation(anim, i * 200));
    Animated.parallel(animations).start();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} style={[style, { width: size + 10, height: size + 10, justifyContent: 'center', alignItems: 'center' }]}>
      {anims.map((anim, i) => {
        const angle = (i / anims.length) * 2 * Math.PI;
        const radius = size * 0.8;
        const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * radius] });
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * radius] });
        const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] });
        const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: i % 2 === 0 ? '#FF9800' : '#FFEB3B',
              opacity,
              transform: [{ translateX }, { translateY }, { scale }]
            }}
          />
        );
      })}
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="chatGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF9800" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFEB3B" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path
          fill="url(#chatGradient)"
          d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"
        />
      </Svg>
    </TouchableOpacity>
  );
};

const ICON_KEITIN = require('../../assets/images/iconkeitin.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REACTION_ITEM_SIZE = (SCREEN_WIDTH - 40) * 0.16 - 6;
const CHAT_TABS_DEFAULT_OFFSET = 90;
const CHAT_TABS_TOP = 20;
const CHAT_TABS_GAP = 10;

const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
// Some Android devices/ROMs can report StatusBar.currentHeight as 0 even when
// the status bar is visible. Use a small fallback so top headers don't render
// behind the system status bar.
const ANDROID_SAFE_TOP = Platform.OS === 'android' ? (ANDROID_STATUS_BAR_HEIGHT || 24) : 0;

const SOCIAL_PANEL_BASE_HEIGHT = 280;
const SOCIAL_PANEL_HEIGHT = SOCIAL_PANEL_BASE_HEIGHT + ANDROID_SAFE_TOP;

// Extra spacing above the keyboard so the chat input doesn't feel glued/clipped to it.
const CHAT_INPUT_KEYBOARD_GAP = Platform.OS === 'ios' ? 18 : 10;

// Cap the multiline chat input so it doesn't grow indefinitely.
// After reaching this height, the TextInput becomes internally scrollable.
const CHAT_INPUT_MAX_HEIGHT = 140;
const CHANNEL_CHAT_PAGE_SIZE = 40;
const CHANNEL_CHAT_LOAD_OLDER_TOP_THRESHOLD = 100;
const GROUP_CHAT_PAGE_SIZE = 40;
const GROUP_CHAT_LOAD_OLDER_TOP_THRESHOLD = 100;

const GROUP_MEMBERS_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.6);

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

interface Product {
  id: number;
  name: string;
  description: string;
  position?: number;
}

interface Winner {
  position: number;
  user_email: string;
  username: string;
  profile_photo_uri: string | null;
}

interface GiveAway {
  id: string;
  section: string;
  imageUri: string;
  cropData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  position: number;
  products: Product[];
  createdAt: Date;
  publisherUsername?: string;
  publisherProfilePhoto?: string;
  publisherSocialNetworks?: SocialNetwork[];
  totalParticipants?: number;
  completedAt?: string | null;
  winners?: Winner[];
  hashtag?: string;
  category?: string;
}

type CarouselAspectRatio = '3:4';

const PROFILE_TITLE_PREVIEW_LIMIT = 28;
const PROFILE_TEXT_PREVIEW_LIMIT = 80;

interface CroppedProfileImage {
  uri: string;
  width: number;
  height: number;
  mime?: string | null;
  aspectRatio?: CarouselAspectRatio;
}

interface CarouselImageData {
  clientId?: string;
  uri: string;
  cropData: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  };
  aspectRatio?: CarouselAspectRatio;
  isUploading?: boolean;
}

interface Intimidad {
  type: 'text' | 'image' | 'quiz' | 'survey';
  content: string;
  caption?: string;
  quizData?: {
    options: { a: string; b: string; c: string; d: string };
    correctOption: string;
    imageUri?: string | null;
    text?: string;
    userSelection?: string | null;
    stats?: { a: number; b: number; c: number; d: number };
  };
  surveyData?: {
    options: string[];
    imageUri?: string | null;
    text?: string;
    userSelection?: number | null;
    stats?: number[];
  };
}

const resolveIntimidadMediaUri = (raw?: string | null): string | null => {
  if (!raw) return null;
  const uri = String(raw).trim();
  if (!uri) return null;

  // Already a valid URI scheme we can pass directly to <Image />
  if (/^(https?:|file:|content:|data:)/i.test(uri)) return uri;

  // Windows absolute path (dev/test) -> file URI
  if (/^[A-Za-z]:\\/.test(uri)) {
    return `file:///${uri.replace(/\\/g, '/')}`;
  }

  // Absolute path (Android file path or server path)
  if (uri.startsWith('/')) {
    // Server routes used by our backend uploader
    if (uri.startsWith('/api/') || uri.startsWith('/uploads/')) {
      return getServerResourceUrl(uri);
    }
    // Assume local filesystem path
    return `file://${uri}`;
  }

  // Relative server-like paths
  if (uri.startsWith('api/') || uri.startsWith('uploads/')) {
    return getServerResourceUrl(`/${uri}`);
  }

  // Fallback: treat as server resource path
  return getServerResourceUrl(uri);
};

const normalizeIntimidadesMedia = (items: Intimidad[]): Intimidad[] => {
  return items.map((it) => {
    if (it.type === 'image') {
      const resolved = resolveIntimidadMediaUri(it.content);
      return resolved ? { ...it, content: resolved } : it;
    }

    if (it.type === 'quiz' && it.quizData) {
      const resolved = resolveIntimidadMediaUri(it.quizData.imageUri ?? null);
      return resolved
        ? { ...it, quizData: { ...it.quizData, imageUri: resolved } }
        : it;
    }

    if (it.type === 'survey' && it.surveyData) {
      const resolved = resolveIntimidadMediaUri(it.surveyData.imageUri ?? null);
      return resolved
        ? { ...it, surveyData: { ...it.surveyData, imageUri: resolved } }
        : it;
    }

    return it;
  });
};

const CATEGORIES_ES = [
  "Sin categoría", "Videojuegos", "Deportes", "Moda", "Turismo",
  "Entretenimiento", "Tecnología", "Ciencia", "Gastronomía y nutrición",
  "IA", "Política", "Religión", "Emprendimiento", "Economía",
  "Educación", "Hogar", "VR", "Información", "Arte", "Música",
  "Cine", "Motor", "Naturaleza", "Animales", "Cultura"
];

const CATEGORY_LABELS_EN: Record<string, string> = {
  'Sin categoría': 'Uncategorized',
  'Videojuegos': 'Video games',
  'Deportes': 'Sports',
  'Moda': 'Fashion',
  'Turismo': 'Tourism',
  'Entretenimiento': 'Entertainment',
  'Tecnología': 'Technology',
  'Ciencia': 'Science',
  'Gastronomía y nutrición': 'Food & nutrition',
  'IA': 'AI',
  'Política': 'Politics',
  'Religión': 'Religion',
  'Emprendimiento': 'Entrepreneurship',
  'Economía': 'Economy',
  'Educación': 'Education',
  'Hogar': 'Home',
  'VR': 'VR',
  'Información': 'Information',
  'Arte': 'Art',
  'Música': 'Music',
  'Cine': 'Cinema',
  'Motor': 'Automotive',
  'Naturaleza': 'Nature',
  'Animales': 'Animals',
  'Cultura': 'Culture',
};

const REACTION_EMOJIS = Array.from(new Set([
  '👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🔥', '🎉', '💯',
  '😍', '🤔', '😱', '🥳', '😎', '🙌', '👀', '🤝', '🙏', '💪',
  '✨', '🌟', '💫', '💥', '💢', '💤', '👋', '👌', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
  '🖐️', '🖖', '🤏', '✍️', '🤳', '💅', '🙇', '🙋', '💁', '🙆',
  '💩', '🤡', '👻', '👽', '🤖', '👾', '😺', '😸', '😹', '😻',
  '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌',
  '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔',
  '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💣', '🦠',
  '💐', '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷',
  '🚀', '🌈', '🍕', '🍺', '⚽',

  // Extra emojis requested
  '🐶', '👑', '😅', '😉', '🫠', '🤤', '🫡', '😤', '🤯', '🥵', '🥶', '🤑', '😇', '🤥',
  '🦵🏼', '🦿', '🦶🏼', '👂🏼', '👃🏼', '🫶🏼', '✊🏼', '🙅🏼‍♂️', '🎅🏼', '🥷🏼', '👼🏼',
  '🍓', '🍑', '🍊', '🥝', '🥬', '🥞', '🍰', '🍻', '🍷',
  '🧭', '🛸', '🗿', '🗽',
  '⚾', '🏀', '🏐', '🏈', '🎾', '🏸', '🥋', '🏁', '🏴', '🥊',
  '💎', '💻', '⌨️', '📱', '🪫', '🔋', '💡', '🕯️', '🧽',
  '👠', '👞', '☂️', '🌂', '📎', '🖇️', '✒️',
  '📈', '📉', '🔐', '🔓', '🛡️', '⚔️', '📜', '🔮', '🪬', '🛎️', '🗓️', '🔍',
  '🧪', '🩺', '🔭', '🧬', '🔬', '📡', '🛰️',
  '⛔', '🆘', '🆚', '☢️', '☣️', '⚠️', '🔱', '⚜️', '💲', '✅', '❎',
  '🏳️‍🌈', '🏳️‍⚧️',

  // Nationality / country flags (broad coverage)
  '🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇵🇪', '🇨🇱', '🇻🇪', '🇪🇨', '🇧🇴', '🇵🇾', '🇺🇾',
  '🇨🇷', '🇵🇦', '🇬🇹', '🇸🇻', '🇭🇳', '🇳🇮', '🇩🇴', '🇵🇷', '🇨🇺',
  '🇺🇸', '🇨🇦', '🇧🇷', '🇵🇹',
  '🇫🇷', '🇩🇪', '🇮🇹', '🇬🇧', '🇮🇪', '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹',
  '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇱', '🇨🇿', '🇸🇰', '🇭🇺', '🇬🇷', '🇹🇷',
  '🇷🇴', '🇧🇬', '🇺🇦', '🇷🇺', '🇷🇸', '🇭🇷', '🇸🇮', '🇧🇦', '🇲🇪', '🇲🇰', '🇦🇱',
  '🇱🇹', '🇱🇻', '🇪🇪', '🇮🇸',
  '🇮🇱',
  '🇲🇦', '🇩🇿', '🇹🇳', '🇪🇬', '🇿🇦', '🇳🇬', '🇰🇪', '🇬🇭', '🇸🇳', '🇪🇹', '🇹🇿', '🇺🇬',
  '🇸🇦', '🇦🇪', '🇶🇦', '🇰🇼', '🇴🇲', '🇯🇴', '🇱🇧', '🇮🇷', '🇮🇶',
  '🇮🇳', '🇵🇰', '🇧🇩', '🇱🇰', '🇳🇵',
  '🇨🇳', '🇯🇵', '🇰🇷', '🇹🇼', '🇭🇰', '🇸🇬', '🇲🇾', '🇹🇭', '🇻🇳', '🇮🇩', '🇵🇭',
  '🇦🇺', '🇳🇿',
]));

type ProfileRingPoint = {
  id: string;
  imageIndex: number;
  x: number; // 0..1 relative
  y: number; // 0..1 relative
  color: string;
  colorSelected: boolean;
  name: string;
  description: string;
  linkNetwork: string | null;
  linkUrl: string;
  locationLabel: string;
  locationUrl: string;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  isCreated: boolean;
};

interface PresentationContent {
  images: CarouselImageData[];
  title: string;
  text: string;
  category?: string;
  profileRings?: ProfileRingPoint[];
}

interface SocialNetwork {
  id: string;
  link: string;
}

interface Publication {
  id: string;
  user: {
    username: string;
    email?: string;
    profilePhotoUri?: string;
    nationality?: string;
    socialNetworks: SocialNetwork[];
    accountVerified?: boolean;
    keintiVerified?: boolean;
  };
  presentation: PresentationContent;
  reactions: {
    selected: string[];
    counts: Record<string, number>;
    userReaction: string | null;
  };
  intimidades: Intimidad[];
  createdAt: Date;
}

interface Group {
  id: string;
  imageUri: string;
  hashtag: string;
  ownerEmail?: string;
  ownerUsername?: string;
  memberCount?: number;
}

const getGroupMemberCount = (count?: number) => {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : 0;
  return Math.max(0, n);
};

interface FrontScreenProps {
  userEmail?: string;
  username?: string;
  initialProfilePhotoUri?: string;
  initialSocialNetworks?: SocialNetwork[];
  nationality?: string;
  accountVerified?: boolean;
  onProfilePhotoUriChange?: (profilePhotoUri?: string) => void;
  onSocialNetworksChange?: (socialNetworks: SocialNetwork[]) => void;
  onNavigateToPublish?: () => void;
  onNavigateToNotificationpublisher?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToRecompensa?: () => void;
  onNavigateToConfiguration?: () => void;
  onReloadGiveAways?: () => void;
  onReloadApp?: () => void;
  onLogout?: () => void;
  giveAways?: GiveAway[];
  onOpenFilter?: () => void;

  searchHashtag?: string;
  authToken?: string;
}

const parseServerDate = (value: Date | string) => {
  if (value instanceof Date) return value;

  const raw = String(value);
  // If the string already includes a timezone (Z or ±hh:mm), native parsing is safe.
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  if (hasTimezone) return new Date(raw);

  // Normalize common DB formats (timestamp without timezone) and treat them as UTC.
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const looksLikeIsoNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(normalized);
  if (looksLikeIsoNoTz) return new Date(`${normalized}Z`);

  return new Date(raw);
};

const getRemainingTime = (createdAt: Date | string) => {
  const created = parseServerDate(createdAt);
  if (!Number.isFinite(created.getTime())) return 'Tiempo agotado';
  const now = new Date();
  const expiration = new Date(created.getTime() + POST_TTL_MS);
  const diff = expiration.getTime() - now.getTime();

  if (diff <= 0) return 'Tiempo agotado';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `Falta ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else {
    const displayMinutes = minutes === 0 ? 1 : minutes;
    return `Falta ${displayMinutes} ${displayMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
};

const formatRemainingTimeForDisplay = (
  raw: string,
  language: Language,
  t: (key: TranslationKey) => string
) => {
  if (language !== 'en') return raw;

  if (raw === 'Tiempo agotado') return t('chat.timeExpired' as TranslationKey);

  const m = raw.match(/^Falta\s+(\d+)\s+(hora|horas|minuto|minutos)$/i);
  if (!m) return raw;

  const value = Number(m[1]);
  if (!Number.isFinite(value)) return raw;

  const unitRaw = m[2].toLowerCase();
  const isHour = unitRaw.startsWith('hora');
  const unitKey = (isHour
    ? (value === 1 ? 'chat.hour' : 'chat.hours')
    : (value === 1 ? 'chat.minute' : 'chat.minutes')) as TranslationKey;

  return `${t('chat.remainingPrefix' as TranslationKey)} ${value} ${t(unitKey)}`;
};

const CountdownTimer = ({ createdAt, onExpire, style }: { createdAt: Date | string, onExpire?: () => void, style?: any }) => {
  const [timeLeft, setTimeLeft] = useState(getRemainingTime(createdAt));
  const { t, language } = useI18n();

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getRemainingTime(createdAt);
      setTimeLeft(remaining);
      if (remaining === 'Tiempo agotado') {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, onExpire]);

  return (
    <Text style={style ?? { position: 'absolute', left: 0, color: '#6e6e6eff', fontSize: 12 }}>
      {formatRemainingTimeForDisplay(timeLeft, language, t as any)}
    </Text>
  );
};

const MeasuredSvgGradientBackground = ({
  gradientId,
  colors,
  stopOpacity = 1,
}: {
  gradientId: string;
  colors: [string, string];
  stopOpacity?: number;
}) => {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 0, elevation: 0 }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        if (!w || !h) return;
        if (w === size.width && h === size.height) return;
        setSize({ width: w, height: h });
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors[0]} stopOpacity={stopOpacity} />
              <Stop offset="1" stopColor={colors[1]} stopOpacity={stopOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
      )}
    </View>
  );
};

const MeasuredSvgGradientBorder = ({
  gradientId,
  colors,
  borderRadius,
  strokeWidth = 2,
  stopOpacity = 1,
}: {
  gradientId: string;
  colors: [string, string];
  borderRadius: number;
  strokeWidth?: number;
  stopOpacity?: number;
}) => {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 0, elevation: 0 }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        if (!w || !h) return;
        if (w === size.width && h === size.height) return;
        setSize({ width: w, height: h });
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors[0]} stopOpacity={stopOpacity} />
              <Stop offset="1" stopColor={colors[1]} stopOpacity={stopOpacity} />
            </LinearGradient>
          </Defs>
          <Rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, size.width - strokeWidth)}
            height={Math.max(0, size.height - strokeWidth)}
            rx={Math.max(0, borderRadius - strokeWidth / 2)}
            ry={Math.max(0, borderRadius - strokeWidth / 2)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
          />
        </Svg>
      )}
    </View>
  );
};

const FrontScreen = ({
  userEmail,
  username,
  initialProfilePhotoUri,
  initialSocialNetworks,
  nationality,
  accountVerified,
  onProfilePhotoUriChange,
  onSocialNetworksChange,
  onNavigateToPublish,
  onNavigateToNotificationpublisher,
  onNavigateToNotifications,
  onNavigateToRecompensa,
  onNavigateToConfiguration,
  onReloadGiveAways,
  onReloadApp,
  onLogout,
  giveAways = [],

  onOpenFilter,
  searchHashtag,
  authToken,
}: FrontScreenProps) => {
  const { t, language } = useI18n();

  const [adsInitialized, setAdsInitialized] = useState(false);
  const [homeProfileRingBannerReady, setHomeProfileRingBannerReady] = useState(false);
  const [homeProfileRingBannerSize, setHomeProfileRingBannerSize] = useState(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
  const [homeProfileRingBannerRequestKey, setHomeProfileRingBannerRequestKey] = useState(0);
  const safeAreaInsets = useSafeAreaInsets();
  const bottomSystemOffset = safeAreaInsets.bottom;

  const [keintiVerified, setKeintiVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await mobileAds().initialize();
      } catch {
        // ignore
      }
      if (!cancelled) setAdsInitialized(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshKeintiVerified = async () => {
      if (!authToken) {
        if (!cancelled) setKeintiVerified(false);
        return;
      }

      try {
        const status = await getAccountAuthStatus(authToken);
        if (!cancelled) setKeintiVerified(!!status?.keinti_verified);
      } catch {
        // ignore
      }
    };

    refreshKeintiVerified();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Rewarded ad gate for revealing "intimidades" when tapping the Keinti icon.
  // NOTE: We use a rewarded ad here (instead of forcing an interstitial duration)
  // because rewarded is the policy-compliant way to gate content.
  const rewardedAdRef = useRef<ReturnType<typeof RewardedAd.createForAdRequest> | null>(null);
  const rewardedShowRequestedRef = useRef(false);
  const rewardedEarnedRef = useRef(false);
  const rewardedShowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIntimidadesPubIdRef = useRef<string | null>(null);
  const pendingChannelImageUnlockKeyRef = useRef<string | null>(null);
  const [isRewardedLoaded, setIsRewardedLoaded] = useState(false);
  const [pendingHomeIntimidadesUnlockPubId, setPendingHomeIntimidadesUnlockPubId] = useState<string | null>(null);

  const revealIntimidadesForPub = (pubId: string) => {
    setIntimidadesVisible(prev => ({ ...prev, [pubId]: true }));

    // Count an "opening" for the creator when another user reveals this content.
    // Best-effort: never block the UI if the request fails.
    if (authToken) {
      fetch(`${API_URL}/api/posts/${encodeURIComponent(String(pubId))}/intimidades/open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
        },
      }).catch(() => {});
    }
  };

  const resetRewardedGateState = () => {
    rewardedShowRequestedRef.current = false;
    rewardedEarnedRef.current = false;
    pendingIntimidadesPubIdRef.current = null;
    pendingChannelImageUnlockKeyRef.current = null;
    if (rewardedShowTimeoutRef.current) {
      clearTimeout(rewardedShowTimeoutRef.current);
      rewardedShowTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    rewardedAdRef.current = rewarded;

    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsRewardedLoaded(true);

      if (rewardedShowTimeoutRef.current) {
        clearTimeout(rewardedShowTimeoutRef.current);
        rewardedShowTimeoutRef.current = null;
      }

      if (rewardedShowRequestedRef.current) {
        rewardedShowRequestedRef.current = false;
        try {
          rewarded.show();
        } catch (e) {
          const pubId = pendingIntimidadesPubIdRef.current;
          const unlockKey = pendingChannelImageUnlockKeyRef.current;
          resetRewardedGateState();
          if (pubId) {
            // If showing fails, don't block the user from seeing the content.
            revealIntimidadesForPub(pubId);
          } else if (unlockKey) {
            Alert.alert('Anuncio no disponible', 'No se pudo mostrar el anuncio en este momento.');
          }
        }
      }
    });

    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      rewardedEarnedRef.current = true;
    });

    const unsubscribePaid = rewarded.addAdEventListener(AdEventType.PAID, event => {
      const placement = pendingIntimidadesPubIdRef.current
        ? 'home_intimidades_rewarded_unlock'
        : pendingChannelImageUnlockKeyRef.current
          ? 'chat_channel_image_rewarded_unlock'
          : 'rewarded_unknown_placement';

      trackAdPaidEvent({
        format: 'rewarded',
        placement,
        event,
      });
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      const pubId = pendingIntimidadesPubIdRef.current;
      const unlockKey = pendingChannelImageUnlockKeyRef.current;
      const earned = rewardedEarnedRef.current;
      resetRewardedGateState();

      // Preload the next rewarded ad.
      setIsRewardedLoaded(false);
      rewarded.load();

      if (earned && pubId) {
        revealIntimidadesForPub(pubId);
        setPendingHomeIntimidadesUnlockPubId(String(pubId));
      }

      if (earned && unlockKey) {
        markChannelImageUnlocked(unlockKey);
      }
    });

    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      const pubId = pendingIntimidadesPubIdRef.current;
      const unlockKey = pendingChannelImageUnlockKeyRef.current;
      resetRewardedGateState();
      setIsRewardedLoaded(false);
      rewarded.load();

      if (pubId) {
        // If the ad fails, allow continuing without blocking.
        revealIntimidadesForPub(pubId);
      } else if (unlockKey) {
        Alert.alert('Anuncio no disponible', 'No hay anuncios disponibles en este momento.');
      }
    });

    return () => {
      if (rewardedShowTimeoutRef.current) {
        clearTimeout(rewardedShowTimeoutRef.current);
        rewardedShowTimeoutRef.current = null;
      }
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribePaid();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  // Preload the first rewarded ad only after the SDK has fully initialized.
  useEffect(() => {
    if (!adsInitialized) return;
    const rewarded = rewardedAdRef.current;
    if (rewarded && !isRewardedLoaded) {
      rewarded.load();
    }
  }, [adsInitialized]);

  const showRewardedToRevealIntimidades = (pubId: string) => {
    const rewarded = rewardedAdRef.current;
    if (!rewarded) {
      revealIntimidadesForPub(pubId);
      return;
    }

    pendingIntimidadesPubIdRef.current = pubId;
    pendingChannelImageUnlockKeyRef.current = null;
    rewardedEarnedRef.current = false;

    // If already loaded, show immediately. Otherwise request show once loaded.
    if (isRewardedLoaded) {
      try {
        rewarded.show();
      } catch {
        resetRewardedGateState();
        revealIntimidadesForPub(pubId);
      }
      return;
    }

    rewardedShowRequestedRef.current = true;

    // Safety: avoid getting stuck if the SDK never resolves LOADED/ERROR.
    if (rewardedShowTimeoutRef.current) clearTimeout(rewardedShowTimeoutRef.current);
    rewardedShowTimeoutRef.current = setTimeout(() => {
      const stillWaiting = rewardedShowRequestedRef.current;
      if (!stillWaiting) return;
      const pendingPubId = pendingIntimidadesPubIdRef.current;
      resetRewardedGateState();
      setIsRewardedLoaded(false);
      rewarded.load();

      // Don't block the user if the ad can't be shown right now.
      if (pendingPubId) revealIntimidadesForPub(pendingPubId);
    }, 7000);

    rewarded.load();
  };

  const showRewardedToUnlockChannelImage = (unlockKey: string) => {
    const key = String(unlockKey || '').trim();
    if (!key) return;
    if (unlockedChannelImageKeys[key]) return;

    const rewarded = rewardedAdRef.current;
    if (!rewarded) {
      Alert.alert('Anuncio no disponible', 'No se encontró el módulo de anuncios.');
      return;
    }

    pendingChannelImageUnlockKeyRef.current = key;
    pendingIntimidadesPubIdRef.current = null;
    rewardedEarnedRef.current = false;

    if (isRewardedLoaded) {
      try {
        rewarded.show();
      } catch {
        resetRewardedGateState();
        Alert.alert('Anuncio no disponible', 'No se pudo mostrar el anuncio en este momento.');
      }
      return;
    }

    rewardedShowRequestedRef.current = true;

    if (rewardedShowTimeoutRef.current) clearTimeout(rewardedShowTimeoutRef.current);
    rewardedShowTimeoutRef.current = setTimeout(() => {
      const stillWaiting = rewardedShowRequestedRef.current;
      if (!stillWaiting) return;
      const pendingKey = pendingChannelImageUnlockKeyRef.current;
      resetRewardedGateState();
      setIsRewardedLoaded(false);
      rewarded.load();

      if (pendingKey) {
        Alert.alert('Anuncio no disponible', 'No se pudo mostrar el anuncio en este momento.');
      }
    }, 7000);

    rewarded.load();
  };

  const unlockedChannelImagesStorageKey = useMemo(() => {
    const emailKey = normalizeEmailKey(userEmail) || 'anon';
    return `${CHANNEL_IMAGE_UNLOCKS_STORAGE_KEY_PREFIX}${emailKey}`;
  }, [userEmail]);

  const [unlockedChannelImageKeys, setUnlockedChannelImageKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let didCancel = false;
    (async () => {
      const AsyncStorage = getAsyncStorageSafe();
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem(unlockedChannelImagesStorageKey);
        if (didCancel) return;
        const parsed = raw ? JSON.parse(raw) : [];
        const keys = Array.isArray(parsed) ? parsed.map(String) : [];
        const next: Record<string, boolean> = {};
        keys.forEach((k) => {
          const kk = String(k || '').trim();
          if (kk) next[kk] = true;
        });
        setUnlockedChannelImageKeys(next);
      } catch {
        if (!didCancel) setUnlockedChannelImageKeys({});
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [unlockedChannelImagesStorageKey]);

  const persistUnlockedChannelImageKeys = async (next: Record<string, boolean>) => {
    const AsyncStorage = getAsyncStorageSafe();
    if (!AsyncStorage) return;
    try {
      await AsyncStorage.setItem(unlockedChannelImagesStorageKey, JSON.stringify(Object.keys(next)));
    } catch {
      // ignore
    }
  };

  const markChannelImageUnlocked = (unlockKey: string) => {
    const key = String(unlockKey || '').trim();
    if (!key) return;
    setUnlockedChannelImageKeys((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      void persistUnlockedChannelImageKeys(next);
      return next;
    });
  };

  const openChannelImageUnlockAd = (unlockKey: string) => {
    showRewardedToUnlockChannelImage(unlockKey);
  };

  const [showReEnableGalleryPermissionModal, setShowReEnableGalleryPermissionModal] = useState(false);
  const reEnableGalleryPermissionResolveRef = useRef<((ok: boolean) => void) | null>(null);

  const [showDeleteContentModal, setShowDeleteContentModal] = useState(false);
  const [pendingDeleteIntimidadIndex, setPendingDeleteIntimidadIndex] = useState<number | null>(null);

  const [showDeleteCarouselImageModal, setShowDeleteCarouselImageModal] = useState(false);
  const [pendingDeleteCarouselImageIndex, setPendingDeleteCarouselImageIndex] = useState<number | null>(null);

  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<{ id: string } | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [fullScreenAvatarUri, setFullScreenAvatarUri] = useState<string | null>(null);

  const resolveReEnableGalleryPermissionModal = (ok: boolean) => {
    const resolve = reEnableGalleryPermissionResolveRef.current;
    reEnableGalleryPermissionResolveRef.current = null;
    setShowReEnableGalleryPermissionModal(false);
    resolve?.(ok);
  };

  const askToReEnableGalleryPermission = () => {
    return new Promise<boolean>((resolve) => {
      reEnableGalleryPermissionResolveRef.current = resolve;
      setShowReEnableGalleryPermissionModal(true);
    });
  };

  useEffect(() => {
    return () => {
      // If the component unmounts while the promise is pending, resolve safely.
      if (reEnableGalleryPermissionResolveRef.current) {
        const resolve = reEnableGalleryPermissionResolveRef.current;
        reEnableGalleryPermissionResolveRef.current = null;
        resolve(false);
      }
    };
  }, []);

  const formatTemplate = (template: string, vars: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

  const formatUsernameWithAt = (rawUsername?: string) => {
    const trimmed = (rawUsername ?? 'Usuario').trim();
    if (!trimmed) return '@Usuario';
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  };

  const formatGroupHashtagWithHash = (rawHashtag?: string) => {
    const trimmed = (rawHashtag ?? '').trim();
    if (!trimmed) return '#';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  };

  const normalizeSocialIconKey = (raw: any) => {
    const key = String(raw ?? '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'x' || key === 'x_twitter' || key === 'xtwitter') return 'twitter';
    if (key === 'only_fans') return 'onlyfans';
    return key;
  };

  const formatSocialNetworksCount = (count: number) => {
    const suffixKey = count === 1 ? 'front.socialNetworksSingular' : 'front.socialNetworksPlural';
    return `${count} ${t(suffixKey as TranslationKey)}`;
  };

  const getCategoryLabel = (category: string | undefined) => {
    if (!category) return '';
    if (language !== 'en') return category;
    return CATEGORY_LABELS_EN[category] ?? category;
  };

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [blockedJoinedGroupIds, setBlockedJoinedGroupIds] = useState<string[]>([]);
  const [activeGroupOptionsId, setActiveGroupOptionsId] = useState<string | null>(null);
  const [activeJoinedGroupOptionsId, setActiveJoinedGroupOptionsId] = useState<string | null>(null);
  const [joinedOptionsPulseId, setJoinedOptionsPulseId] = useState<string | null>(null);
  const joinedOptionsPulseAnim = useRef(new Animated.Value(0)).current;
  const [groupMembersPulseId, setGroupMembersPulseId] = useState<string | null>(null);
  const groupMembersPulseAnim = useRef(new Animated.Value(0)).current;
  const groupMembersPulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  type GroupMemberProfile = {
    username: string; // always with leading '@'
    member_email?: string;
    profile_photo_uri?: string | null;
    social_networks?: Array<{ id?: string; network?: string; link: string }>;
    is_limited?: boolean;
  };

  const [showGroupMembersPanel, setShowGroupMembersPanel] = useState(false);
  const [groupMembersPanelGroup, setGroupMembersPanelGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberProfile[]>([]);
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false);
  const groupMembersLoadSeqRef = useRef(0);

  const [showGroupMembersActionsMenu, setShowGroupMembersActionsMenu] = useState(false);
  const [groupMembersSelectionMode, setGroupMembersSelectionMode] = useState<'limit' | 'expel' | null>(null);
  const [selectedGroupMemberKeys, setSelectedGroupMemberKeys] = useState<Set<string>>(new Set());
  const [isApplyingGroupMemberLimits, setIsApplyingGroupMemberLimits] = useState(false);
  const [isExpellingGroupMembers, setIsExpellingGroupMembers] = useState(false);

  const getGroupMemberKey = (member: GroupMemberProfile) => String(member.member_email ?? member.username).toLowerCase();

  const closeGroupMembersPanel = () => {
    groupMembersLoadSeqRef.current += 1;
    setShowGroupMembersPanel(false);
    setGroupMembersPanelGroup(null);
    setGroupMembers([]);
    setIsLoadingGroupMembers(false);
    setShowGroupMembersActionsMenu(false);
    setGroupMembersSelectionMode(null);
    setSelectedGroupMemberKeys(new Set());
    setIsApplyingGroupMemberLimits(false);
    setIsExpellingGroupMembers(false);
  };

  const openGroupMembersPanel = (group: Group) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para ver los miembros.');
      return;
    }

    setGroupMembersPanelGroup(group);
    setShowGroupMembersPanel(true);
    setGroupMembers([]);
    setIsLoadingGroupMembers(true);
    setShowGroupMembersActionsMenu(false);
    setGroupMembersSelectionMode(null);
    setSelectedGroupMemberKeys(new Set());
    setIsApplyingGroupMemberLimits(false);
    setIsExpellingGroupMembers(false);
  };

  useEffect(() => {
    if (!showGroupMembersPanel) return;
    if (!groupMembersPanelGroup) return;
    if (!authToken) return;

    const group = groupMembersPanelGroup;
    const seq = (groupMembersLoadSeqRef.current += 1);
    let active = true;

    // Start loading only after the panel opening animation/interaction settles.
    InteractionManager.runAfterInteractions(() => {
      if (!active) return;
      if (!showGroupMembersPanel) return;

      (async () => {
        try {
          const resp = await fetch(`${API_URL}/api/groups/${group.id}/members`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (!active || groupMembersLoadSeqRef.current !== seq) return;

          if (!resp.ok) {
            setGroupMembers([]);
            return;
          }

          const data = await resp.json();
          if (!active || groupMembersLoadSeqRef.current !== seq) return;
          if (!Array.isArray(data)) {
            setGroupMembers([]);
            return;
          }

          const mapped: GroupMemberProfile[] = data.map((row: any) => {
            const rawUsername = row?.username ? String(row.username) : 'Usuario';
            const username = formatUsernameWithAt(rawUsername);
            const profilePhotoRaw = (row?.profile_photo_uri ?? row?.profilePhotoUri ?? null) as (string | null);
            const memberEmail = row?.member_email ?? row?.memberEmail;
            const isLimited = !!(row?.is_limited ?? row?.isLimited);
            let socialRaw: any = row?.social_networks ?? row?.socialNetworks ?? [];
            if (typeof socialRaw === 'string' && socialRaw.trim().length > 0) {
              try {
                socialRaw = JSON.parse(socialRaw);
              } catch {
                // ignore
              }
            }
            const socials = Array.isArray(socialRaw) ? socialRaw : [];

            return {
              username,
              member_email: typeof memberEmail === 'string' ? memberEmail : undefined,
              profile_photo_uri: profilePhotoRaw,
              social_networks: socials,
              is_limited: isLimited,
            };
          });

          setGroupMembers(mapped);
        } catch (e) {
          if (!active || groupMembersLoadSeqRef.current !== seq) return;
          console.error('Error loading group members:', e);
          setGroupMembers([]);
        } finally {
          if (!active || groupMembersLoadSeqRef.current !== seq) return;
          setIsLoadingGroupMembers(false);
        }
      })();
    });

    return () => {
      active = false;
    };
  }, [showGroupMembersPanel, groupMembersPanelGroup?.id, authToken]);

  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = getAsyncStorageSafe();
        if (!AsyncStorage) return;
        const raw = await AsyncStorage.getItem(BLOCKED_JOINED_GROUP_IDS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        setBlockedJoinedGroupIds(parsed.map(String));
      } catch (e) {
        // Don't pass the Error object to console.warn(), it renders as an ERROR warning.
        // This can happen if the native module isn't available in the installed build.
        console.log('Blocked groups storage unavailable');
      }
    })();
  }, []);

  const visibleJoinedGroups = useMemo(() => {
    if (blockedJoinedGroupIds.length === 0) return joinedGroups;
    const blocked = new Set(blockedJoinedGroupIds);
    return joinedGroups.filter(g => !blocked.has(g.id));
  }, [joinedGroups, blockedJoinedGroupIds]);

  const triggerJoinedOptionsPulseAndToggle = (groupId: string) => {
    setActiveGroupOptionsId(null);
    setJoinedOptionsPulseId(groupId);

    joinedOptionsPulseAnim.stopAnimation();
    joinedOptionsPulseAnim.setValue(0);

    Animated.timing(joinedOptionsPulseAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setActiveJoinedGroupOptionsId(prev => (prev === groupId ? null : groupId));
      }

      Animated.timing(joinedOptionsPulseAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setJoinedOptionsPulseId(null);
      });
    });
  };

  useEffect(() => {
    return () => {
      if (groupMembersPulseTimerRef.current) {
        clearTimeout(groupMembersPulseTimerRef.current);
        groupMembersPulseTimerRef.current = null;
      }
    };
  }, []);

  const triggerGroupMembersPulseAndOpen = (group: Group) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para ver los miembros.');
      return;
    }

    if (groupMembersPulseTimerRef.current) {
      clearTimeout(groupMembersPulseTimerRef.current);
      groupMembersPulseTimerRef.current = null;
    }

    setGroupMembersPulseId(group.id);
    groupMembersPulseAnim.stopAnimation();
    groupMembersPulseAnim.setValue(0);

    // Open first (modal slides up), then load members after open.
    openGroupMembersPanel(group);

    // Glow quickly behind the icon and fade out overlapping the modal slide.
    Animated.sequence([
      Animated.timing(groupMembersPulseAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(groupMembersPulseAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setGroupMembersPulseId(null);
    });
  };

  const [showGroupRequestPanel, setShowGroupRequestPanel] = useState(false);
  const [groupRequestTargetUsername, setGroupRequestTargetUsername] = useState<string | null>(null);
  const [selectedRequestGroupId, setSelectedRequestGroupId] = useState<string | null>(null);
  const [isSubmittingGroupRequest, setIsSubmittingGroupRequest] = useState(false);

  type SentGroupRequest = {
    id: number;
    groupId: number;
    status: 'pending' | 'accepted' | 'ignored' | string;
    targetUsername: string;
    groupHashtag: string;
  };

  const [sentGroupRequestStatusByTarget, setSentGroupRequestStatusByTarget] = useState<Record<string, 'pending' | 'accepted' | 'blocked'>>({});

  type NotificationItem = {
    id: number;
    type: 'group_join_request';
    groupId: number;
    postId?: number | null;
    postCreatedAt?: string | null;
    status: 'pending' | 'accepted' | 'ignored' | string;
    createdAt: string;
    requesterUsername: string;
    groupHashtag: string;
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const [pendingJoinedGroupToast, setPendingJoinedGroupToast] = useState<{
    groupHashtag: string;
    requesterUsername: string;
  } | null>(null);

  const [readNotificationIds, setReadNotificationIds] = useState<Record<number, true>>({});

  const markNotificationAsRead = (id: number) => {
    setReadNotificationIds(prev => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => n.status === 'pending' && !readNotificationIds[n.id]).length;
  }, [notifications, readNotificationIds]);

  useEffect(() => {
    if (!authToken) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const resolveGroupImageUri = (raw: any, id: string) => {
    const candidate = String(raw ?? '').trim();
    const fallback = `/api/groups/image/${id}`;
    return getServerResourceUrl(candidate || fallback);
  };

  const handleCreateGroup = async () => {
    if (!groupImageUri || !groupHashtag) return;
    if (!authToken || !accountVerified) {
      showActionToast(t('chat.lockedYourGroupsMessage' as TranslationKey));
      return;
    }
    if (isSavingGroup) return;

    setIsSavingGroup(true);
    try {
      const trimmedUri = (groupImageUri || '').trim();
      const isRemoteImage = trimmedUri.startsWith('http') || trimmedUri.startsWith('/api/');

      if (!editingGroupId && isRemoteImage) {
        throw new Error('Selecciona una imagen para crear el grupo.');
      }

      const formData = new FormData();
      formData.append('hashtag', groupHashtag);

      if (!isRemoteImage) {
        formData.append('image', {
          uri: trimmedUri,
          type: 'image/jpeg',
          name: 'group.jpg',
        } as any);
      }

      if (editingGroupId) {
        const resp = await fetch(`${API_URL}/api/groups/${editingGroupId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || 'Error al actualizar grupo');
        }

        const updated = await resp.json();
        setMyGroups(groups => groups.map(g => g.id === String(updated.id)
          ? {
              ...g,
              hashtag: String(updated.hashtag || ''),
              imageUri: resolveGroupImageUri(updated.image_uri, String(updated.id)),
            }
          : g
        ));
        setEditingGroupId(null);
      } else {
        const resp = await fetch(`${API_URL}/api/groups`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || 'Error al crear grupo');
        }

        const created = await resp.json();
        const newGroup: Group = {
          id: String(created.id),
          hashtag: String(created.hashtag || ''),
          imageUri: resolveGroupImageUri(created.image_uri, String(created.id)),
        };
        setMyGroups(prev => [newGroup, ...prev]);
      }

      setGroupImageUri(null);
      setGroupHashtag('');
      setShowCreateGroupPanel(false);
    } catch (e: any) {
      console.error('Error creating/updating group:', e);
      Alert.alert('Error', e?.message || 'No se pudo guardar el grupo');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [appliedText, setAppliedText] = useState('');
  const [intimidades, setIntimidades] = useState<Intimidad[]>([]);
  const [activeIntimidadIndex, setActiveIntimidadIndex] = useState(0);
  const [publishError, setPublishError] = useState('');
  const [quizPublishError, setQuizPublishError] = useState('');
  const [surveyPublishError, setSurveyPublishError] = useState('');

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | undefined>(
    initialProfilePhotoUri,
  );
  const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>(
    initialSocialNetworks || [],
  );
  const [activeBottomTab, setActiveBottomTab] = useState('home');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bottomNavHeight, setBottomNavHeight] = useState<number>(BOTTOM_NAV_OVERLAY_HEIGHT);
  const [channelInputBarHeight, setChannelInputBarHeight] = useState<number>(72);
  const [groupInputBarHeight, setGroupInputBarHeight] = useState<number>(72);
  const [channelChatMountKey, setChannelChatMountKey] = useState(0);
  const [chatScreenMountKey, setChatScreenMountKey] = useState(0);
  const [chatTopTabsRenderKey, setChatTopTabsRenderKey] = useState(0);
  const [joinedChannelRepaintKey, setJoinedChannelRepaintKey] = useState(0);
  const prevActiveBottomTabRef = useRef<string>('home');
  const [isHomePostsLoading, setIsHomePostsLoading] = useState(false);
  const [hasHomePostsLoadedOnce, setHasHomePostsLoadedOnce] = useState(false);
  const [isHomeMainScrollEnabled, setIsHomeMainScrollEnabled] = useState(true);
  const isHomeCarouselGestureActiveRef = useRef(false);
  const homeTabDidMountRef = useRef(false);
  const homeLoaderPulseAnim = useRef(new Animated.Value(0)).current;
  const homeLoaderPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const homeLoaderRotateAnim = useRef(new Animated.Value(0)).current;
  const homeLoaderRotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const profileEmptyArrowAnim = useRef(new Animated.Value(0)).current;
  const profileEmptyArrowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [hasSeenYourProfileHint, setHasSeenYourProfileHint] = useState<boolean | null>(null);
  const [hasSeenHomeSwipeTutorial, setHasSeenHomeSwipeTutorial] = useState<boolean | null>(null);
  const homeSwipeTutorialAnim = useRef(new Animated.Value(0)).current;
  const homeSwipeTutorialLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const homeLoaderStartedAtRef = useRef<number>(0);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [sidePanelAnimation] = useState(new Animated.Value(-SCREEN_WIDTH * 0.6));
  const [isProfileAvatarPulsing, setIsProfileAvatarPulsing] = useState(false);
  const profileAvatarPulseAnim = useRef(new Animated.Value(0)).current;
  const profileAvatarOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePublishActionGlowAnim = useRef(new Animated.Value(0)).current;
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [showCarouselImageEditor, setShowCarouselImageEditor] = useState(false);
  const [editingCarouselImageUri, setEditingCarouselImageUri] = useState<string | null>(null);
  const [editingCarouselImageIndex, setEditingCarouselImageIndex] = useState<number | null>(null);
  const [pendingCarouselImages, setPendingCarouselImages] = useState<string[]>([]);
  const [currentEditingImageIndex, setCurrentEditingImageIndex] = useState(0);
  const [editedCarouselImages, setEditedCarouselImages] = useState<Record<number, CarouselImageData>>({});
  const [profileView, setProfileView] = useState<'profile' | 'presentation' | 'intimidades'>('profile');
  const [chatView, setChatView] = useState<'channel' | 'channels' | 'groups' | 'groupChat'>('channel');
  const [groupsTab, setGroupsTab] = useState<'tusGrupos' | 'unidos'>('tusGrupos');
  const [joinedGroupsRenderCount, setJoinedGroupsRenderCount] = useState(JOINED_GROUPS_RENDER_BATCH);

  useEffect(() => {
    if (groupsTab !== 'unidos') return;
    setJoinedGroupsRenderCount(JOINED_GROUPS_RENDER_BATCH);
  }, [groupsTab]);

  useEffect(() => {
    setJoinedGroupsRenderCount(prev => {
      const minCount = Math.min(JOINED_GROUPS_RENDER_BATCH, visibleJoinedGroups.length);
      return prev < minCount ? minCount : prev;
    });
  }, [visibleJoinedGroups.length]);

  const pagedVisibleJoinedGroups = useMemo(
    () => visibleJoinedGroups.slice(0, joinedGroupsRenderCount),
    [visibleJoinedGroups, joinedGroupsRenderCount],
  );

  const loadMoreJoinedGroupsIfNeeded = useCallback((event: any) => {
    if (groupsTab !== 'unidos') return;
    if (joinedGroupsRenderCount >= visibleJoinedGroups.length) return;

    const native = event?.nativeEvent;
    if (!native) return;

    const layoutHeight = Number(native.layoutMeasurement?.height ?? 0);
    const offsetY = Number(native.contentOffset?.y ?? 0);
    const contentHeight = Number(native.contentSize?.height ?? 0);
    if (!Number.isFinite(layoutHeight) || !Number.isFinite(offsetY) || !Number.isFinite(contentHeight)) return;

    const distanceToBottom = contentHeight - (offsetY + layoutHeight);
    if (distanceToBottom > 220) return;

    setJoinedGroupsRenderCount(prev => Math.min(prev + JOINED_GROUPS_RENDER_BATCH, visibleJoinedGroups.length));
  }, [groupsTab, joinedGroupsRenderCount, visibleJoinedGroups.length]);

  const [chatInputValue, setChatInputValue] = useState('');
  const [showChannelAttachmentPanel, setShowChannelAttachmentPanel] = useState(false);
  const [showChannelImageComposer, setShowChannelImageComposer] = useState(false);
  const [channelDraftImageUri, setChannelDraftImageUri] = useState<string | null>(null);
  const [channelDraftCaption, setChannelDraftCaption] = useState('');
  const [isSendingChannelImage, setIsSendingChannelImage] = useState(false);
  const [showChannelImageViewer, setShowChannelImageViewer] = useState(false);
  const [channelImageViewerUri, setChannelImageViewerUri] = useState<string | null>(null);
  const [isSendingChannelMessage, setIsSendingChannelMessage] = useState(false);
  const [groupChatInputValue, setGroupChatInputValue] = useState('');
  const [showGroupAttachmentPanel, setShowGroupAttachmentPanel] = useState(false);
  const [showGroupImageComposer, setShowGroupImageComposer] = useState(false);
  const [groupDraftImageUri, setGroupDraftImageUri] = useState<string | null>(null);
  const [groupDraftCaption, setGroupDraftCaption] = useState('');
  const [isSendingGroupImage, setIsSendingGroupImage] = useState(false);
  const [showGroupImageViewer, setShowGroupImageViewer] = useState(false);
  const [groupImageViewerUri, setGroupImageViewerUri] = useState<string | null>(null);
  const [isSendingGroupMessage, setIsSendingGroupMessage] = useState(false);
  const [groupReplyingToMessageId, setGroupReplyingToMessageId] = useState<number | null>(null);
  const [groupReplyingToUsername, setGroupReplyingToUsername] = useState<string | null>(null);
  const [expandedGroupThreadsByRootId, setExpandedGroupThreadsByRootId] = useState<Record<string, boolean>>({});
  const [showCreateGroupPanel, setShowCreateGroupPanel] = useState(false);
  const [groupHashtag, setGroupHashtag] = useState('');
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
  const [showGroupPhotoEditor, setShowGroupPhotoEditor] = useState(false);
  const [tempGroupImageUri, setTempGroupImageUri] = useState<string | null>(null);
  const [isOpeningGroupPhotoEditor, setIsOpeningGroupPhotoEditor] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [replyingToMessageIndex, setReplyingToMessageIndex] = useState<number | null>(null);
  const [replyingToUsername, setReplyingToUsername] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'Tu canal' | 'Grupal'>('Tu canal');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [groupChatMessages, setGroupChatMessages] = useState<any[]>([]);
  const [groupChatLoadingGroupId, setGroupChatLoadingGroupId] = useState<string | null>(null);
  const [groupMessageOptions, setGroupMessageOptions] = useState<{ messageIndex: number; memberEmail: string; username: string } | null>(null);
  const [groupLimitedMemberEmails, setGroupLimitedMemberEmails] = useState<string[]>([]);
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [channelInteractions, setChannelInteractions] = useState<any[]>([]);
  const [channelTab, setChannelTab] = useState<'Tu canal' | 'tusCanales'>('Tu canal');
  const [activeJoinedChannelOptionsKey, setActiveJoinedChannelOptionsKey] = useState<string | null>(null);
  // Used to place chat panels exactly below the top tabs (Groups/Channel).
  const [chatTopTabsHeight, setChatTopTabsHeight] = useState<number>(0);
  const chatPanelsTopOffset = useMemo(() => {
    const measured = CHAT_TABS_TOP + (chatTopTabsHeight || 0) + CHAT_TABS_GAP;
    return Math.max(CHAT_TABS_DEFAULT_OFFSET, measured);
  }, [chatTopTabsHeight]);
  const [channelMessagesTab, setChannelMessagesTab] = useState<'General' | 'Respuestas'>('General');

  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);

  const normalizeChannelMessageUsername = useCallback((msg: any) => {
    if (typeof msg === 'string') return '';
    if (msg?.username) {
      const u = String(msg.username);
      return u.startsWith('@') ? u : `@${u}`;
    }
    return `@${String(msg?.sender_email ?? '')}`;
  }, []);

  // Backend stores created_at as TIMESTAMP (no timezone). Parsing it on device can yield
  // different epoch values depending on user timezone.
  // Use message `id` (monotonic) as the primary ordering key so everyone sees the same order.
  const getChannelMessageSortKey = useCallback((createdAt: any, id?: any) => {
    const n = Number(id);
    if (Number.isFinite(n)) return n;
    const t = Date.parse(String(createdAt ?? ''));
    return Number.isFinite(t) ? t : 0;
  }, []);

  const channelChatRenderModel = useMemo(() => {
    type InlineReply = {
      id?: any;
      created_at?: any;
      content: string;
      author: 'publisher' | 'viewer';
    };

    const repliesByMessageKey: Record<string, InlineReply[]> = {};
    const processedMessages: any[] = [];

    const isViewerMode = !!selectedChannel;
    const ownerEmailForThisChat = selectedChannel ? (selectedChannel as any)?.publisher_email : userEmail;

    if (isViewerMode) {
      // ── Viewer mode: thread messages the same way the host sees them ──
      const lastMessageKeyByUsername: Record<string, string> = {};
      const activeThreadKeyByUsername: Record<string, string> = {};

      chatMessages.forEach((msg: any, rawIndex: number) => {
        const isOwnerMessage = String(msg?.sender_email ?? '') === String(ownerEmailForThisChat ?? '');
        const messageText = String(typeof msg === 'string' ? msg : (msg?.message ?? '')).trim();

        // Link viewer messages as continuation of the active thread (if creator already replied).
        if (!isOwnerMessage) {
          const senderHandle = normalizeChannelMessageUsername(msg);
          const activeKey = senderHandle ? activeThreadKeyByUsername[senderHandle] : '';
          if (activeKey) {
            if (!repliesByMessageKey[activeKey]) repliesByMessageKey[activeKey] = [];
            repliesByMessageKey[activeKey].push({ id: msg?.id, created_at: msg?.created_at, content: messageText, author: 'viewer' });
            return;
          }
        }

        // Creator replies are detected by leading @mention.
        if (isOwnerMessage && messageText.startsWith('@')) {
          const firstSpaceIndex = messageText.indexOf(' ');
          if (firstSpaceIndex > 0) {
            const targetUsername = messageText.substring(0, firstSpaceIndex);
            const content = messageText.substring(firstSpaceIndex + 1);
            const targetMessageKey = activeThreadKeyByUsername[targetUsername] || lastMessageKeyByUsername[targetUsername];
            if (targetMessageKey) {
              if (!repliesByMessageKey[targetMessageKey]) repliesByMessageKey[targetMessageKey] = [];
              repliesByMessageKey[targetMessageKey].push({ id: msg?.id, created_at: msg?.created_at, content, author: 'publisher' });
              activeThreadKeyByUsername[targetUsername] = targetMessageKey;
              return;
            }
          }
        }

        const key = String(msg?.id ?? `idx-${rawIndex}`);
        const decorated = (typeof msg === 'string') ? msg : { ...msg, __key: key };
        processedMessages.push(decorated);

        if (!isOwnerMessage) {
          const senderHandle = normalizeChannelMessageUsername(msg);
          if (senderHandle) {
            lastMessageKeyByUsername[senderHandle] = key;
          }
        }
      });

      processedMessages.sort((a: any, b: any) => {
        const ta = getChannelMessageSortKey(a?.created_at, a?.id);
        const tb = getChannelMessageSortKey(b?.created_at, b?.id);
        if (ta !== tb) return ta - tb;
        const ka = String(a?.__key ?? a?.id ?? '');
        const kb = String(b?.__key ?? b?.id ?? '');
        return ka.localeCompare(kb);
      });
    } else {
      const lastMessageKeyByUsername: Record<string, string> = {};
      const activeThreadKeyByUsername: Record<string, string> = {};

      chatMessages.forEach((msg: any, rawIndex: number) => {
        const isOwnerMessage = String(msg?.sender_email ?? '') === String(ownerEmailForThisChat ?? '');
        const messageText = String(typeof msg === 'string' ? msg : (msg?.message ?? '')).trim();

        // Link viewer messages as continuation of the active thread (if creator already replied).
        if (!isOwnerMessage) {
          const senderHandle = normalizeChannelMessageUsername(msg);
          const activeKey = senderHandle ? activeThreadKeyByUsername[senderHandle] : '';
          if (activeKey) {
            if (!repliesByMessageKey[activeKey]) repliesByMessageKey[activeKey] = [];
            repliesByMessageKey[activeKey].push({ id: msg?.id, created_at: msg?.created_at, content: messageText, author: 'viewer' });
            return;
          }
        }

        // Creator replies are detected by leading @mention.
        if (isOwnerMessage && messageText.startsWith('@')) {
          const firstSpaceIndex = messageText.indexOf(' ');
          if (firstSpaceIndex > 0) {
            const targetUsername = messageText.substring(0, firstSpaceIndex);
            const content = messageText.substring(firstSpaceIndex + 1);
            const targetMessageKey = activeThreadKeyByUsername[targetUsername] || lastMessageKeyByUsername[targetUsername];
            if (targetMessageKey) {
              if (!repliesByMessageKey[targetMessageKey]) repliesByMessageKey[targetMessageKey] = [];
              repliesByMessageKey[targetMessageKey].push({ id: msg?.id, created_at: msg?.created_at, content, author: 'publisher' });
              activeThreadKeyByUsername[targetUsername] = targetMessageKey;
              return;
            }
          }
        }

        const key = String(msg?.id ?? `idx-${rawIndex}`);
        const decorated = (typeof msg === 'string') ? msg : { ...msg, __key: key };
        processedMessages.push(decorated);

        if (!isOwnerMessage) {
          const senderHandle = normalizeChannelMessageUsername(msg);
          if (senderHandle) {
            lastMessageKeyByUsername[senderHandle] = key;
          }
        }
      });

      // Sort conversations (threads and non-threads) by last activity.
      const activityTimeByKey: Record<string, number> = {};
      processedMessages.forEach((m: any, idx: number) => {
        const k = String(m?.__key ?? m?.id ?? `idx-${idx}`);
        activityTimeByKey[k] = getChannelMessageSortKey(m?.created_at, m?.id);
      });
      Object.keys(repliesByMessageKey).forEach((k) => {
        const replies = repliesByMessageKey[k] || [];
        replies.forEach((r) => {
          activityTimeByKey[k] = Math.max(activityTimeByKey[k] || 0, getChannelMessageSortKey(r?.created_at, r?.id));
        });
      });
      processedMessages.sort((a: any, b: any) => {
        const ka = String(a?.__key ?? a?.id ?? '');
        const kb = String(b?.__key ?? b?.id ?? '');
        const ta = activityTimeByKey[ka] || 0;
        const tb = activityTimeByKey[kb] || 0;
        if (ta !== tb) return ta - tb;
        return ka.localeCompare(kb);
      });
    }

    const isChannelHostForThisView = !!userEmail && !!ownerEmailForThisChat && String(userEmail) === String(ownerEmailForThisChat);
    const baseMessagesToRender = (channelMessagesTab === 'Respuestas' && isChannelHostForThisView)
      ? processedMessages.filter((msg: any) => {
        const key = String(msg?.__key ?? msg?.id ?? '');
        if (!key) return false;
        const replies = repliesByMessageKey[key] || [];
        return replies.some(r => r.author === 'publisher');
      })
      : processedMessages;

    return {
      messagesToRender: baseMessagesToRender,
      repliesByMessageKey,
    };
  }, [
    chatMessages,
    selectedChannel,
    userEmail,
    channelMessagesTab,
    getChannelMessageSortKey,
    normalizeChannelMessageUsername,
  ]);

  const setHomeCarouselGestureActive = (active: boolean) => {
    isHomeCarouselGestureActiveRef.current = active;
    const nextScrollEnabled = !active;
    setIsHomeMainScrollEnabled(prev => (prev === nextScrollEnabled ? prev : nextScrollEnabled));
  };

  useEffect(() => {
    if (activeBottomTab !== 'home') {
      isHomeCarouselGestureActiveRef.current = false;
      setIsHomeMainScrollEnabled(true);
    }
  }, [activeBottomTab]);

  useEffect(() => {
    const prev = prevActiveBottomTabRef.current;
    if (activeBottomTab === 'chat' && prev !== 'chat') {
      setChannelChatMountKey(k => k + 1);
    }
    prevActiveBottomTabRef.current = activeBottomTab;
  }, [activeBottomTab]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      setIsKeyboardVisible(true);
      // With edge-to-edge enabled the root view stretches to the screen
      // bottom, so we need the full distance from the screen bottom to the
      // keyboard top (screenH − screenY). Do NOT subtract the nav-bar
      // inset: the view's bottom:0 already sits at the screen edge.
      let h: number;
      if (Platform.OS === 'android' && typeof e?.endCoordinates?.screenY === 'number') {
        const screenH = Dimensions.get('screen').height;
        h = Math.max(0, Math.round(screenH - e.endCoordinates.screenY));
      } else {
        h = e?.endCoordinates?.height;
      }
      setKeyboardHeight(typeof h === 'number' && h > 0 ? h : 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (chatView !== 'channel' || channelTab !== 'Tu canal') {
      setShowChannelAttachmentPanel(false);
      setShowChannelImageComposer(false);
      setChannelDraftImageUri(null);
      setChannelDraftCaption('');
      setIsSendingChannelImage(false);
      setShowChannelImageViewer(false);
      setChannelImageViewerUri(null);
    }
  }, [chatView, channelTab]);

  useEffect(() => {
    if (chatView !== 'groupChat') {
      setShowGroupAttachmentPanel(false);
      setShowGroupImageComposer(false);
      setGroupDraftImageUri(null);
      setGroupDraftCaption('');
      setIsSendingGroupImage(false);
      setShowGroupImageViewer(false);
      setGroupImageViewerUri(null);
    }
  }, [chatView]);

  const openGroupImageViewer = (uri: string) => {
    const resolved = String(uri || '').trim();
    if (!resolved) return;
    setGroupImageViewerUri(resolved);
    setShowGroupImageViewer(true);
  };

  const closeGroupImageViewer = () => {
    setShowGroupImageViewer(false);
    setGroupImageViewerUri(null);
  };

  const handlePickGroupImage = async () => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para enviar imágenes.');
      return;
    }

    if (!selectedGroup?.id) return;

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1440,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image?.path) {
        setShowGroupAttachmentPanel(false);
        setGroupDraftImageUri(image.path);
        setGroupDraftCaption('');
        setShowGroupImageComposer(true);
      }
    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen del grupo:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta de nuevo.');
      }
    }
  };

  const handleCloseGroupImageComposer = () => {
    if (isSendingGroupImage) return;
    setShowGroupImageComposer(false);
    setGroupDraftImageUri(null);
    setGroupDraftCaption('');
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleApplyGroupImage = async () => {
    if (isSendingGroupImage) return;
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para enviar imágenes.');
      return;
    }
    if (!selectedGroup?.id) return;
    if (!groupDraftImageUri) return;

    setIsSendingGroupImage(true);
    try {
      let uploadedUrl = groupDraftImageUri;
      if (!uploadedUrl.startsWith('http')) {
        uploadedUrl = await uploadImage(uploadedUrl, authToken);
      }

      const encoded = encodeChannelImageMessage({
        url: uploadedUrl,
        caption: groupDraftCaption.trim(),
      });

      const resp = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message: encoded, replyToId: groupReplyingToMessageId }),
      });

      if (resp.ok) {
        const newMsg = await resp.json();
        setGroupChatMessages(prev => [...prev, newMsg]);
        setGroupReplyingToMessageId(null);
        setGroupReplyingToUsername(null);
        setShowGroupAttachmentPanel(false);
        handleCloseGroupImageComposer();

        setTimeout(() => {
          groupChatScrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      } else {
        const err = await resp.json().catch(() => ({}));
        const errorMessage = String((err as any)?.error || '').trim();
        if (errorMessage.toLowerCase().includes('limitado') || errorMessage.toLowerCase().includes('limitada') || errorMessage.toLowerCase().includes('restricted')) {
          const host = groupOwnerUsername || 'anfitrión';
          showActionToast(formatHostLimitedInteractions(host));
        } else {
          Alert.alert('Aviso', errorMessage || 'No se pudo enviar la imagen');
        }
      }
    } catch (e) {
      console.error('Error sending group image:', e);
      Alert.alert('Error', 'Error de conexión al enviar la imagen');
    } finally {
      setIsSendingGroupImage(false);
    }
  };

  const openChannelImageViewer = (uri: string) => {
    const resolved = String(uri || '').trim();
    if (!resolved) return;
    setChannelImageViewerUri(resolved);
    setShowChannelImageViewer(true);
  };

  const closeChannelImageViewer = () => {
    setShowChannelImageViewer(false);
    setChannelImageViewerUri(null);
  };

  const handlePickChannelImage = async () => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para enviar imágenes.');
      return;
    }

    const isChannelHost = !!userEmail && !!channelOwnerEmail && String(userEmail) === String(channelOwnerEmail);
    if (!isChannelHost) {
      return;
    }

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1440,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image?.path) {
        setShowChannelAttachmentPanel(false);
        setChannelDraftImageUri(image.path);
        setChannelDraftCaption('');
        setShowChannelImageComposer(true);
      }
    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen del canal:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta de nuevo.');
      }
    }
  };

  const handleCloseChannelImageComposer = () => {
    if (isSendingChannelImage) return;
    setShowChannelImageComposer(false);
    setChannelDraftImageUri(null);
    setChannelDraftCaption('');
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleApplyChannelImage = async () => {
    if (isSendingChannelImage) return;
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para enviar imágenes.');
      return;
    }
    if (!channelDraftImageUri) return;

    const targetPostId = selectedChannel
      ? (selectedChannel.post_id ?? (selectedChannel as any).postId ?? (selectedChannel as any).id)
      : userPublication?.id;
    if (!targetPostId) return;

    setIsSendingChannelImage(true);
    try {
      let uploadedUrl = channelDraftImageUri;
      if (!uploadedUrl.startsWith('http')) {
        uploadedUrl = await uploadImage(uploadedUrl, authToken, { postId: targetPostId, timeoutMs: 120000 });
      }

      const encoded = encodeChannelImageMessage({
        url: uploadedUrl,
        caption: channelDraftCaption.trim(),
      });

      const finalMessage = replyingToUsername ? `${replyingToUsername} ${encoded}` : encoded;

      const response = await fetch(`${API_URL}/api/channels/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          postId: targetPostId,
          message: finalMessage,
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        setChatMessages(prev => [...prev, newMessage]);
        setReplyingToUsername(null);
        setReplyingToMessageIndex(null);
        setShowChannelAttachmentPanel(false);
        handleCloseChannelImageComposer();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = String((errorData as any)?.error || '').trim();

        if ((errorData as any)?.code === 'WAIT_FOR_PUBLISHER_REPLY') {
          showActionToast('Espera la respuesta del creador para poder responder de nuevo');
          return;
        }

        if (response.status === 403) {
          if (errorMessage.toLowerCase().includes('limitado') || errorMessage.includes('restricted')) {
            const publisherName = selectedChannel ? selectedChannel.username : (userPublication?.user?.username || 'usuario');
            showHostLimitWarning(publisherName);
          } else {
            const publisherName = selectedChannel ? selectedChannel.username : 'usuario';
            showLimitWarning(publisherName);
          }
        } else {
          if (errorMessage.toLowerCase().includes('limitado')) {
            const publisherName = selectedChannel ? selectedChannel.username : (userPublication?.user?.username || 'usuario');
            showHostLimitWarning(publisherName);
          } else {
            Alert.alert('Aviso', errorMessage || 'No se pudo enviar la imagen');
          }
        }
      }
    } catch (error) {
      console.error('Error sending image message:', error);
      Alert.alert('Error', 'Error de conexión al enviar la imagen');
    } finally {
      setIsSendingChannelImage(false);
    }
  };

  const selectedGroupIdRef = useRef<string | null>(null);

  // ── Alternar visibilidad de un mensaje (solo anfitrión) ──
  const toggleMessageVisibility = async (messageId: number | string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_URL}/api/channels/messages/${messageId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Actualizar el estado local del mensaje
        setChatMessages(prev =>
          prev.map((msg: any) =>
            String(msg?.id) === String(messageId)
              ? { ...msg, hidden: data.hidden }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error toggling message visibility:', error);
    }
  };

  const groupChatLoadingGroupIdRef = useRef<string | null>(null);
  const groupChatFetchSeqRef = useRef(0);

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroup?.id ?? null;
  }, [selectedGroup?.id]);

  useEffect(() => {
    groupChatLoadingGroupIdRef.current = groupChatLoadingGroupId;
  }, [groupChatLoadingGroupId]);

  const resetGroupChatPaginationState = (clearMessages: boolean = true) => {
    groupChatLastSigRef.current = '';
    groupOldestMessageIdRef.current = null;
    groupOldestFetchInFlightRef.current = null;
    lastGroupChatMessagesLengthRef.current = 0;
    setGroupHasMoreOlderMessages(true);
    setIsLoadingOlderGroupMessages(false);
    if (clearMessages) {
      setGroupChatMessages([]);
    }
  };

  const openGroupChat = (group: Group) => {
    if (!authToken || !accountVerified) {
      const key = groupsTab === 'unidos'
        ? 'chat.lockedJoinedGroupsMessage'
        : 'chat.lockedYourGroupsMessage';
      showActionToast(t(key as TranslationKey));
      return;
    }
    setChatScreenMountKey(k => k + 1);
    setActiveGroupOptionsId(null);
    setActiveJoinedGroupOptionsId(null);
    setSelectedGroup(group);
    setGroupChatInputValue('');
    setGroupReplyingToMessageId(null);
    setGroupReplyingToUsername(null);
    setExpandedGroupThreadsByRootId({});
    setExpandedMention(null);
    setGroupMessageOptions(null);
    setGroupLimitedMemberEmails([]);
    resetGroupChatPaginationState(true);
    pendingGroupScrollToLatestAfterRefreshRef.current = true;
    setIsGroupNearBottom(true);
    setShowGroupScrollToLatest(false);
    setGroupChatLoadingGroupId(group.id);
    setChatView('groupChat');

    requestAnimationFrame(() => {
      setChatScreenMountKey(k => k + 1);
    });
  };

  const markYourProfileHintSeen = () => {
    setHasSeenYourProfileHint(true);
    const AsyncStorage = getAsyncStorageSafe();
    if (!AsyncStorage) return;
    AsyncStorage.setItem(PROFILE_YOUR_PROFILE_HINT_SEEN_KEY, '1').catch(() => { });
  };

  const markHomeSwipeTutorialSeen = () => {
    const emailKey = normalizeEmailKey(userEmail);
    if (emailKey) homeSwipeTutorialSeenMemoryByEmail.add(emailKey);
    setHasSeenHomeSwipeTutorial(true);
    if (!authToken) return;
    setMyUiHints(authToken, { homeSwipeTutorialSeen: true }).catch(() => { });
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const AsyncStorage = getAsyncStorageSafe();

      if (!AsyncStorage) {
        if (!cancelled) setHasSeenYourProfileHint(false);
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(PROFILE_YOUR_PROFILE_HINT_SEEN_KEY);
        if (cancelled) return;
        setHasSeenYourProfileHint(raw === '1');
      } catch {
        if (!cancelled) setHasSeenYourProfileHint(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const emailKey = normalizeEmailKey(userEmail);
      const seenInMemory = !!emailKey && homeSwipeTutorialSeenMemoryByEmail.has(emailKey);

      // Only show when we *know* it's not seen; default to hidden on errors.
      if (!authToken) {
        if (!cancelled) setHasSeenHomeSwipeTutorial(seenInMemory);
        return;
      }

      try {
        const hints = await getMyUiHints(authToken);
        if (cancelled) return;
        if (hints.homeSwipeTutorialSeen) {
          if (emailKey) homeSwipeTutorialSeenMemoryByEmail.add(emailKey);
        }
        setHasSeenHomeSwipeTutorial(hints.homeSwipeTutorialSeen || seenInMemory);
      } catch {
        if (!cancelled) {
          // If we cannot confirm from backend, allow showing it once per app run.
          setHasSeenHomeSwipeTutorial(seenInMemory);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, userEmail]);

  const handleSelectGroupImage = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    // Evitar el “flash” del panel al volver de la galería.
    // Mostramos un overlay bloqueante y ocultamos el panel mientras se prepara el editor.
    setIsOpeningGroupPhotoEditor(true);
    setShowCreateGroupPanel(false);

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1440,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image?.path) {
        setTempGroupImageUri(image.path);
        setShowGroupPhotoEditor(true);
        // Nota: mantenemos el overlay hasta que el modal del editor dispare onShow.
        return;
      }

      // Si no hay path (caso raro), restaurar UI.
      setIsOpeningGroupPhotoEditor(false);
      setShowCreateGroupPanel(true);
    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen del grupo:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta de nuevo.');
      }

      // Cancelación o error: restaurar UI.
      setIsOpeningGroupPhotoEditor(false);
      setShowCreateGroupPanel(true);
    }
  };

  const handleSaveGroupImage = async (croppedImage: { uri: string }) => {
    setGroupImageUri(croppedImage?.uri ?? null);
    setTempGroupImageUri(null);
    setShowGroupPhotoEditor(false);
    setShowCreateGroupPanel(true);
  };

  const loadMyGroups = async () => {
    if (!authToken || !accountVerified) return;

    try {
      const resp = await fetch(`${API_URL}/api/groups/my-groups`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        return;
      }

      const data = await resp.json();
      if (!Array.isArray(data)) return;

      const mapped: Group[] = data.map((row: any) => ({
        id: String(row.id),
        hashtag: String(row.hashtag || ''),
        imageUri: resolveGroupImageUri(row.image_uri ?? row.imageUri, String(row.id)),
        ownerEmail: row.owner_email ? String(row.owner_email) : undefined,
        ownerUsername: row.owner_username ? String(row.owner_username) : (row.ownerUsername ? String(row.ownerUsername) : undefined),
        memberCount: Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : (Number.isFinite(Number(row.memberCount)) ? Number(row.memberCount) : 0),
      }));

      setMyGroups(mapped);
    } catch (e) {
      console.error('Error loading groups:', e);
    }
  };

  const loadJoinedGroups = async () => {
    if (!authToken || !accountVerified) return;

    try {
      const resp = await fetch(`${API_URL}/api/groups/joined-groups`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      });

      if (!resp.ok) {
        setJoinedGroups([]);
        return;
      }

      const data = await resp.json();
      if (!Array.isArray(data)) {
        setJoinedGroups([]);
        return;
      }

      const mapped: Group[] = data.map((row: any) => ({
        id: String(row.id),
        hashtag: String(row.hashtag || ''),
        imageUri: resolveGroupImageUri(row.image_uri ?? row.imageUri, String(row.id)),
        ownerEmail: row.owner_email ? String(row.owner_email) : undefined,
        ownerUsername: row.owner_username ? String(row.owner_username) : (row.ownerUsername ? String(row.ownerUsername) : undefined),
        memberCount: Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : (Number.isFinite(Number(row.memberCount)) ? Number(row.memberCount) : 0),
      }));

      setJoinedGroups(mapped);
    } catch (e) {
      console.error('Error loading joined groups:', e);
    }
  };

  useEffect(() => {
    if (!authToken || !accountVerified) return;
    if (chatView === 'groups' && groupsTab === 'tusGrupos') {
      loadMyGroups();
    }
  }, [chatView, groupsTab, authToken, accountVerified]);

  useEffect(() => {
    if (!authToken || !accountVerified) return;
    if (chatView === 'groups' && groupsTab === 'unidos') {
      loadJoinedGroups();
    }
  }, [chatView, groupsTab, authToken, accountVerified]);

  type MentionProfile = {
    username: string; // always with leading '@'
    profile_photo_uri?: string | null;
    social_networks?: Array<{ id?: string; network?: string; link: string }>;
  };

  const [expandedMention, setExpandedMention] = useState<{ messageIndex: number; username: string } | null>(null);
  const [mentionProfiles, setMentionProfiles] = useState<Record<string, MentionProfile>>({});
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [hostLimitWarning, setHostLimitWarning] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [groupOwnerUsername, setGroupOwnerUsername] = useState<string | null>(null);
  const hostLimitFadeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const actionToastAnim = useRef(new Animated.Value(0)).current;

  const normalizeMentionUsername = (raw?: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  };

  const formatHostLimitedInteractions = (rawHostUsername?: string) => {
    const template = t('chat.hostLimitedInteractions' as TranslationKey);
    const host = normalizeMentionUsername(rawHostUsername || 'usuario') || '@usuario';
    return template.includes('{user}')
      ? template.replace('{user}', host)
      : `${host} ${template}`;
  };

  const shouldShowVerifiedBadgeForHandle = (rawHandle: string) => {
    if (!accountVerified) return false;
    const me = normalizeMentionUsername(username).toLowerCase();
    const other = normalizeMentionUsername(rawHandle).toLowerCase();
    return !!me && !!other && me === other;
  };

  const showActionToast = (message: string) => {
    const msg = String(message || '').trim();
    if (!msg) return;

    setActionToast(msg);
    actionToastAnim.stopAnimation();
    actionToastAnim.setValue(0);

    Animated.sequence([
      Animated.timing(actionToastAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.delay(1700),
      Animated.timing(actionToastAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setActionToast(null);
        requestAnimationFrame(() => {
          setChatTopTabsRenderKey(k => k + 1);
        });
      }
    });
  };

  const fetchMentionProfileIfNeeded = async (mentionUsernameWithAt: string) => {
    const normalized = normalizeMentionUsername(mentionUsernameWithAt);
    if (!normalized) return;
    if (mentionProfiles[normalized]) return;

    const usernameNoAt = normalized.slice(1);
    try {
      const resp = await fetch(`${API_URL}/api/users/profile/${encodeURIComponent(usernameNoAt)}`);
      if (!resp.ok) return;
      const data = await resp.json();

      const rawSocials = data?.social_networks ?? data?.socialNetworks ?? data?.social_network ?? [];
      let parsedSocials: any[] = [];
      if (Array.isArray(rawSocials)) {
        parsedSocials = rawSocials;
      } else if (typeof rawSocials === 'string' && rawSocials.trim().length > 0) {
        try {
          const maybe = JSON.parse(rawSocials);
          if (Array.isArray(maybe)) parsedSocials = maybe;
        } catch {
          // ignore
        }
      }

      const profile: MentionProfile = {
        username: normalizeMentionUsername(data?.username || normalized),
        profile_photo_uri: data?.profile_photo_uri ?? null,
        social_networks: parsedSocials,
      };
      setMentionProfiles(prev => ({ ...prev, [normalized]: profile }));
    } catch (e) {
      console.error('Error fetching mention profile:', e);
    }
  };

  const toggleMentionForMessage = async (
    messageIndex: number,
    mentionUsernameWithAt: string,
    enabled: boolean
  ) => {
    if (!enabled) return;
    const normalized = normalizeMentionUsername(mentionUsernameWithAt);
    if (!normalized) return;

    const isSame = expandedMention?.messageIndex === messageIndex && expandedMention?.username === normalized;
    if (isSame) {
      setExpandedMention(null);
      return;
    }

    setExpandedMention({ messageIndex, username: normalized });
    await fetchMentionProfileIfNeeded(normalized);
  };

  const normalizeExternalUrl = (rawUrl: string): string | null => {
    const trimmed = String(rawUrl ?? '').trim();
    if (!trimmed) return null;

    // Keep URLs with a scheme (https:, http:, mailto:, tel:, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;

    // Handle protocol-relative URLs
    if (trimmed.startsWith('//')) return `https:${trimmed}`;

    // Common: users store links without scheme, e.g. "t.me/user" or "www.example.com"
    return `https://${trimmed}`;
  };

  const resolveGoogleMapsShortUrlIfNeeded = async (url: string): Promise<string> => {
    const candidate = String(url || '').trim();
    if (!/^https?:/i.test(candidate)) return candidate;

    try {
      const hostMatch = candidate.match(/^https?:\/\/([^\/?#]+)/i);
      const host = String(hostMatch?.[1] || '').toLowerCase();
      if (!host) return candidate;

      // Common Google Maps share shorteners.
      const isShortHost = host === 'maps.app.goo.gl' || host === 'goo.gl' || host.endsWith('.goo.gl');
      if (!isShortHost) return candidate;

      // Follow redirects to get a stable https://www.google.com/maps/... URL.
      const resp = await fetch(candidate, { method: 'GET', redirect: 'follow' as any });
      const finalUrl = String((resp as any)?.url || '').trim();
      return finalUrl || candidate;
    } catch {
      return candidate;
    }
  };

  const openExternalLink = async (rawUrl: string) => {
    let url = normalizeExternalUrl(rawUrl);
    if (!url) return;

    url = await resolveGoogleMapsShortUrlIfNeeded(url);

    // Avoid invalid characters breaking Android intents.
    const safeUrl = encodeURI(url);

    try {
      // For normal web links, just attempt to open.
      // On Android, `Linking.canOpenURL` can incorrectly return false for http(s).
      if (/^https?:/i.test(safeUrl)) {
        await Linking.openURL(safeUrl);
        return;
      }

      const canOpen = await Linking.canOpenURL(safeUrl);
      if (!canOpen) {
        Alert.alert('Enlace no soportado', 'No se puede abrir este enlace en tu dispositivo.');
        return;
      }
      await Linking.openURL(safeUrl);
    } catch (err) {
      console.error("Couldn't load page", err);
      Alert.alert('Error', 'No se pudo abrir el enlace');
    }
  };

  const renderTextWithMentions = (
    text: string,
    onPressMention: (mentionUsernameWithAt: string) => void,
    enabled: boolean
  ) => {
    if (!text) return null;

    const parts: Array<{ type: 'text' | 'mention'; value: string }> = [];
    const mentionRegex = /@[\w.]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(text)) !== null) {
      const start = match.index;
      const value = match[0];
      const end = start + value.length;

      if (start > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, start) });
      }
      parts.push({ type: 'mention', value });
      lastIndex = end;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return parts.map((p, i) => {
      if (p.type === 'mention') {
        return (
          <Text
            key={`m-${i}-${p.value}`}
            style={{ color: '#FFB74D', fontWeight: 'bold' }}
            onPress={enabled ? () => onPressMention(p.value) : undefined}
          >
            {p.value}
          </Text>
        );
      }
      return <Text key={`t-${i}`}>{p.value}</Text>;
    });
  };

  const showLimitWarning = (username: string) => {
    const displayUser = username.startsWith('@') ? username : `@${username}`;
    setLimitWarning(displayUser);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2800),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setLimitWarning(null);
    });
  };

  const showHostLimitWarning = (hostUsername: string) => {
    const host = normalizeMentionUsername(hostUsername || 'usuario') || '@usuario';
    setHostLimitWarning(host);
    hostLimitFadeAnim.stopAnimation();
    hostLimitFadeAnim.setValue(0);

    Animated.sequence([
      Animated.timing(hostLimitFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2800),
      Animated.timing(hostLimitFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHostLimitWarning(null);
    });
  };

  useEffect(() => {
    const ownerEmail = String(selectedGroup?.ownerEmail || '').trim();
    if (!authToken || !ownerEmail) {
      setGroupOwnerUsername(null);
      return;
    }

    let didCancel = false;
    (async () => {
      try {
        const resp = await fetch(`${API_URL}/api/users/username-by-email?email=${encodeURIComponent(ownerEmail)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!resp.ok) return;
        const data = await resp.json().catch(() => ({}));
        const name = String(data?.username || '').trim();
        if (!didCancel) {
          setGroupOwnerUsername(name || null);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [authToken, selectedGroup?.ownerEmail]);
  const [channelChatLoadingPostId, setChannelChatLoadingPostId] = useState<string | null>(null);
  const [channelHasMoreOlderMessages, setChannelHasMoreOlderMessages] = useState(true);
  const [isLoadingOlderChannelMessages, setIsLoadingOlderChannelMessages] = useState(false);

  const currentChannelPostIdRef = useRef<string | null>(null);
  const channelChatLoadingPostIdRef = useRef<string | null>(null);
  const channelChatFetchSeqRef = useRef(0);
  const channelInteractionsFetchSeqRef = useRef(0);
  const channelChatLastSigRef = useRef<string>('');
  const channelOldestMessageIdRef = useRef<number | null>(null);
  const channelOldestFetchInFlightRef = useRef<number | null>(null);

  useEffect(() => {
    channelChatLoadingPostIdRef.current = channelChatLoadingPostId;
  }, [channelChatLoadingPostId]);

  const resetChannelChatPaginationState = (clearMessages: boolean = true) => {
    channelChatLastSigRef.current = '';
    channelOldestMessageIdRef.current = null;
    channelOldestFetchInFlightRef.current = null;
    lastChatMessagesLengthRef.current = 0;
    setChannelHasMoreOlderMessages(true);
    setIsLoadingOlderChannelMessages(false);
    if (clearMessages) {
      setChatMessages([]);
    }
  };

  const openJoinedChannelChat = (channel: any) => {
    const postId = String(channel?.post_id ?? channel?.postId ?? channel?.id ?? '').trim();
    setChatScreenMountKey(k => k + 1);
    currentChannelPostIdRef.current = postId || null;
    resetChannelChatPaginationState(true);
    setChannelChatMountKey(k => k + 1);
    pendingChannelScrollToLatestAfterRefreshRef.current = true;
    setIsChannelNearBottom(true);
    setShowChannelScrollToLatest(false);
    // Normalize the shape so the rest of the screen can rely on `post_id`.
    setSelectedChannel(postId ? { ...channel, post_id: postId } : channel);
    setChatView('channel');
    setChannelTab('Tu canal');
    setChannelMessagesTab('General');
    setReplyingToMessageIndex(null);
    setReplyingToUsername(null);
    setExpandedMention(null);
    setChannelInteractions([]);
    // IMPORTANT: set the ref synchronously so the first fetch can reliably clear the loader.
    channelChatLoadingPostIdRef.current = postId || null;
    setChannelChatLoadingPostId(postId || null);

    // Android render workaround: force a repaint across the first two frames
    // when entering a joined channel chat to avoid black/invisible initial draw.
    requestAnimationFrame(() => {
      setJoinedChannelRepaintKey(k => k + 1);
      setTimeout(() => {
        setJoinedChannelRepaintKey(k => k + 1);
      }, 80);
    });
  };

  const fetchMyChannels = async () => {
    try {
      const response = await fetch(`${API_URL}/api/channels/my-channels`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('My Channels Data:', data);
        setMyChannels(data);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchChannelInteractions = async (postId?: string) => {
    if (!authToken) return;

    const idToFetch = postId ? String(postId) : null;
    const fetchSeq = ++channelInteractionsFetchSeqRef.current;

    try {
      console.log('Fetching channel interactions...');
      const url = postId
        ? `${API_URL}/api/channels/interactions/${postId}`
        : `${API_URL}/api/channels/interactions`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (idToFetch) {
        // Track which channel we expect to render (for joined channels).
        currentChannelPostIdRef.current = idToFetch;
      }

      // Ignore if a newer fetch started after this one.
      if (fetchSeq !== channelInteractionsFetchSeqRef.current) return;

      // Ignore if the user already switched to a different channel.
      if (idToFetch && currentChannelPostIdRef.current !== idToFetch) return;

      if (response.ok) {
        const data = await response.json();
        console.log('Channel interactions fetched:', data);
        setChannelInteractions(data);
      } else {
        console.error('Failed to fetch interactions:', response.status);
      }
    } catch (error) {
      console.error('Error fetching interactions:', error);
    }
  };

  const handleEnterChannel = async (pub: Publication) => {
    console.log('Entering channel:', pub.id, pub.user.email);
    try {
      const response = await fetch(`${API_URL}/api/channels/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          publisherEmail: pub.user.email,
          postId: pub.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        // Refresh channels if we are in that view (unlikely but good practice)
        fetchMyChannels();

        const targetWithAt = formatUsernameWithAt(pub?.user?.username);
        showBottomToast(`${t('toast.joinedChannelOf')} ${targetWithAt}`);
      } else {
        // Avisos deshabilitados a petición: no mostrar mensaje.
      }
    } catch (error) {
      console.error('Error entering channel:', error);
    }
  };

  const chatScrollViewRef = useRef<FlatList<any>>(null);
  const groupChatScrollViewRef = useRef<ScrollView>(null);
  const lastChatMessagesLengthRef = useRef(0);
  const lastGroupChatMessagesLengthRef = useRef(0);
  const channelScrollOffsetYRef = useRef(0);
  const channelContentHeightRef = useRef(0);
  const pendingChannelPrependAdjustRef = useRef<{ previousHeight: number; previousOffset: number } | null>(null);
  const pendingChannelScrollToLatestAfterRefreshRef = useRef(false);
  const groupScrollOffsetYRef = useRef(0);
  const groupContentHeightRef = useRef(0);
  const pendingGroupPrependAdjustRef = useRef<{ previousHeight: number; previousOffset: number } | null>(null);
  const pendingGroupScrollToLatestAfterRefreshRef = useRef(false);
  const groupOldestMessageIdRef = useRef<number | null>(null);
  const groupOldestFetchInFlightRef = useRef<number | null>(null);
  const groupChatLastSigRef = useRef<string>('');
  const groupChatPollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelChatPollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const homePostsPollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isChannelNearBottom, setIsChannelNearBottom] = useState(true);
  const [showChannelScrollToLatest, setShowChannelScrollToLatest] = useState(false);
  const [channelScrollToLatestPulse, setChannelScrollToLatestPulse] = useState(false);
  const [channelScrollToLatestLoading, setChannelScrollToLatestLoading] = useState(false);
  const channelScrollToLatestPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isGroupNearBottom, setIsGroupNearBottom] = useState(true);
  const [showGroupScrollToLatest, setShowGroupScrollToLatest] = useState(false);
  const [groupScrollToLatestPulse, setGroupScrollToLatestPulse] = useState(false);
  const [groupScrollToLatestLoading, setGroupScrollToLatestLoading] = useState(false);
  const groupScrollToLatestPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [groupHasMoreOlderMessages, setGroupHasMoreOlderMessages] = useState(true);
  const [isLoadingOlderGroupMessages, setIsLoadingOlderGroupMessages] = useState(false);

  useEffect(() => {
    return () => {
      if (channelScrollToLatestPulseTimerRef.current) {
        clearTimeout(channelScrollToLatestPulseTimerRef.current);
        channelScrollToLatestPulseTimerRef.current = null;
      }

      if (groupScrollToLatestPulseTimerRef.current) {
        clearTimeout(groupScrollToLatestPulseTimerRef.current);
        groupScrollToLatestPulseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const shouldPinToLatest =
      activeBottomTab === 'chat' &&
      chatView === 'channel' &&
      channelTab === 'Tu canal';

    if (!shouldPinToLatest) {
      setShowChannelScrollToLatest(false);
      setIsChannelNearBottom(true);
      return;
    }

    // When (re)entering a channel chat, start at the latest messages.
    setIsChannelNearBottom(true);
    setShowChannelScrollToLatest(false);
    lastChatMessagesLengthRef.current = 0;
    pendingChannelScrollToLatestAfterRefreshRef.current = true;
    // Fallback scroll in case data was already loaded before the flag was armed.
    // On Android the FlatList may need an extra layout pass before content is visible,
    // so we issue multiple deferred scrolls to ensure the content materialises.
    requestAnimationFrame(() => {
      chatScrollViewRef.current?.scrollToEnd({ animated: false });
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: false });
      }, 150);
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: false });
      }, 400);
    });
  }, [activeBottomTab, chatView, channelTab]);

  useEffect(() => {
    const shouldPinGroupToLatest =
      activeBottomTab === 'chat' &&
      chatView === 'groupChat';

    if (!shouldPinGroupToLatest) {
      setShowGroupScrollToLatest(false);
      setIsGroupNearBottom(true);
      return;
    }

    // When (re)entering a group chat, start at the latest messages.
    setIsGroupNearBottom(true);
    setShowGroupScrollToLatest(false);
    lastGroupChatMessagesLengthRef.current = 0;
    pendingGroupScrollToLatestAfterRefreshRef.current = true;
    // Fallback scroll in case data was already loaded before the flag was armed.
    // On Android the ScrollView may need extra layout passes before content is visible,
    // so we issue multiple deferred scrolls.
    requestAnimationFrame(() => {
      groupChatScrollViewRef.current?.scrollToEnd({ animated: false });
      setTimeout(() => {
        groupChatScrollViewRef.current?.scrollToEnd({ animated: false });
      }, 150);
      setTimeout(() => {
        groupChatScrollViewRef.current?.scrollToEnd({ animated: false });
      }, 400);
    });
  }, [activeBottomTab, chatView, selectedGroup?.id]);

  const [presentationTitle, setPresentationTitle] = useState('');
  const [presentationText, setPresentationText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Sin categoría');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [carouselImages, setCarouselImages] = useState<CarouselImageData[]>([]);
  const [activeCarouselImageIndex, setActiveCarouselImageIndex] = useState(0);
  const [activeProfileImageIndex, setActiveProfileImageIndex] = useState(0);
  const [profileViewMountKey, setProfileViewMountKey] = useState(0);
  const [profileCarouselMountKey, setProfileCarouselMountKey] = useState(0);
  const [profilePresentation, setProfilePresentation] = useState<PresentationContent | null>(null);
  const [profilePresentationImagesLoaded, setProfilePresentationImagesLoaded] = useState<Record<number, boolean>>({});
  const profilePresentationPrefetchSigRef = useRef<string>('');
  const profileCarouselRepaintAfterLoadSigRef = useRef<string>('');
  const wasInProfileCarouselRef = useRef(false);
  const wasInProfileMainViewRef = useRef(false);

  const [profileRingHintMessage, setProfileRingHintMessage] = useState<string | null>(null);
  const showProfileRingHint = profileRingHintMessage != null;
  const [profileRingPlacementEnabled, setProfileRingPlacementEnabled] = useState(false);
  const profileRingPlacementEnabledRef = useRef(false);
  const profileRingHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profileRingPoints, setProfileRingPoints] = useState<ProfileRingPoint[]>([]);
  const [profileCarouselImageLayouts, setProfileCarouselImageLayouts] = useState<Record<number, { width: number; height: number }>>({});

  const [isProfileRingsHydrating, setIsProfileRingsHydrating] = useState(false);
  const isProfileRingsHydratingRef = useRef(false);
  const profileRingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRingsLastSavedSigRef = useRef<string>('');

  useEffect(() => {
    isProfileRingsHydratingRef.current = isProfileRingsHydrating;
  }, [isProfileRingsHydrating]);

  const makeProfileRingsSig = useCallback((rings: ProfileRingPoint[]) => {
    const created = (rings || []).filter(r => r?.isCreated).slice(0, 5);
    const stable = created
      .map(r => ({
        id: String(r.id),
        imageIndex: Number(r.imageIndex),
        x: Number(r.x),
        y: Number(r.y),
        color: String(r.color),
        colorSelected: Boolean(r.colorSelected),
        name: String(r.name || ''),
        description: String(r.description || ''),
        linkNetwork: r.linkNetwork ? String(r.linkNetwork) : null,
        linkUrl: String(r.linkUrl || ''),
        locationLabel: String(r.locationLabel || ''),
        locationUrl: String(r.locationUrl || ''),
        locationPlaceId: r.locationPlaceId ? String(r.locationPlaceId) : null,
        locationLat: r.locationLat == null ? null : Number(r.locationLat),
        locationLng: r.locationLng == null ? null : Number(r.locationLng),
        isCreated: true,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(stable);
  }, []);

  const normalizeProfileRingsFromApi = useCallback((raw: any): ProfileRingPoint[] => {
    const arr = Array.isArray(raw) ? raw : [];
    const normalized = arr
      .filter(Boolean)
      .slice(0, 5)
      .map((r: any) => {
        const id = String(r?.id || '').trim();
        const imageIndex = Number(r?.imageIndex);
        const x = Number(r?.x);
        const y = Number(r?.y);
        const color = String(r?.color || '#FFFFFF');
        const colorSelected = r?.colorSelected === true || (color && color.toUpperCase() !== '#FFFFFF');

        const safeX = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5;
        const safeY = Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5;

        const locationLat = r?.locationLat == null ? null : Number(r.locationLat);
        const locationLng = r?.locationLng == null ? null : Number(r.locationLng);
        const locationLabel = String(r?.locationLabel || '');
        const rawLocationUrl = String(r?.locationUrl || '');
        const locationPlaceId = r?.locationPlaceId ? String(r.locationPlaceId) : null;

        // Backfill URL when older data stored an empty URL.
        const trimmedUrl = rawLocationUrl.trim();
        const trimmedLabel = String(locationLabel || '').trim();
        const trimmedPlaceId = String(locationPlaceId || '').trim();

        const locationUrl = trimmedUrl
          ? trimmedUrl
          : trimmedPlaceId
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLabel || `${locationLat},${locationLng}`)}&query_place_id=${encodeURIComponent(trimmedPlaceId)}`
            : trimmedLabel
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLabel)}`
              : (Number.isFinite(locationLat) && Number.isFinite(locationLng)
                  ? `https://www.google.com/maps?q=${locationLat},${locationLng}`
                  : rawLocationUrl);

        return {
          id,
          imageIndex: Number.isFinite(imageIndex) ? Math.max(0, Math.floor(imageIndex)) : 0,
          x: safeX,
          y: safeY,
          color,
          colorSelected,
          name: String(r?.name || ''),
          description: String(r?.description || ''),
          linkNetwork: r?.linkNetwork ? String(r.linkNetwork) : null,
          linkUrl: String(r?.linkUrl || ''),
          locationLabel,
          locationUrl,
          locationPlaceId,
          locationLat: Number.isFinite(locationLat) ? locationLat : null,
          locationLng: Number.isFinite(locationLng) ? locationLng : null,
          isCreated: true,
        } as ProfileRingPoint;
      })
      .filter(r => r.id);

    return normalized;
  }, []);

  // Hydrate created rings from Supabase (via backend) when session starts.
  useEffect(() => {
    if (!authToken) {
      setProfileRingPoints([]);
      profileRingsLastSavedSigRef.current = '';
      return;
    }

    let didCancel = false;
    (async () => {
      setIsProfileRingsHydrating(true);
      isProfileRingsHydratingRef.current = true;

      try {
        const resp = await fetch(`${API_URL}/api/edit-profile/profile-rings`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
          },
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) return;

        const rings = normalizeProfileRingsFromApi((data as any)?.rings);
        const sig = makeProfileRingsSig(rings);
        profileRingsLastSavedSigRef.current = sig;

        if (!didCancel) {
          setProfileRingPoints(rings);
        }
      } catch (e) {
        console.error('Error hydrating profile rings:', e);
      } finally {
        isProfileRingsHydratingRef.current = false;
        if (!didCancel) setIsProfileRingsHydrating(false);
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [API_URL, authToken, makeProfileRingsSig, normalizeProfileRingsFromApi]);

  const createdProfileRings = useMemo(() => (
    profileRingPoints.filter(r => r.isCreated).slice(0, 5)
  ), [profileRingPoints]);

  const createdProfileRingsSig = useMemo(() => (
    makeProfileRingsSig(profileRingPoints)
  ), [makeProfileRingsSig, profileRingPoints]);

  const persistProfileRingsImmediately = useCallback(async (rings: ProfileRingPoint[]) => {
    if (!authToken) return;
    if (isProfileRingsHydratingRef.current) return;

    if (profileRingsSaveTimerRef.current) {
      clearTimeout(profileRingsSaveTimerRef.current);
      profileRingsSaveTimerRef.current = null;
    }

    const created = (rings || []).filter(r => r?.isCreated).slice(0, 5);
    const sig = makeProfileRingsSig(rings);

    try {
      const resp = await fetch(`${API_URL}/api/edit-profile/profile-rings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rings: created }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('Failed to persist profile rings (immediate):', resp.status, err);
        return;
      }

      profileRingsLastSavedSigRef.current = sig;
    } catch (e) {
      console.error('Error persisting profile rings (immediate):', e);
    }
  }, [API_URL, authToken, makeProfileRingsSig]);

  // Persist created rings (debounced) to Supabase via backend.
  useEffect(() => {
    if (!authToken) return;
    if (isProfileRingsHydratingRef.current) return;
    if (createdProfileRingsSig === profileRingsLastSavedSigRef.current) return;

    if (profileRingsSaveTimerRef.current) {
      clearTimeout(profileRingsSaveTimerRef.current);
      profileRingsSaveTimerRef.current = null;
    }

    const sigAtSchedule = createdProfileRingsSig;
    profileRingsSaveTimerRef.current = setTimeout(async () => {
      profileRingsSaveTimerRef.current = null;

      try {
        const resp = await fetch(`${API_URL}/api/edit-profile/profile-rings`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rings: createdProfileRings }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.error('Failed to persist profile rings:', resp.status, err);
          return;
        }

        profileRingsLastSavedSigRef.current = sigAtSchedule;
      } catch (e) {
        console.error('Error persisting profile rings:', e);
      }
    }, 900);
  }, [API_URL, authToken, createdProfileRings, createdProfileRingsSig]);

  useEffect(() => {
    return () => {
      if (profileRingsSaveTimerRef.current) {
        clearTimeout(profileRingsSaveTimerRef.current);
        profileRingsSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    profileRingPlacementEnabledRef.current = profileRingPlacementEnabled;
  }, [profileRingPlacementEnabled]);

  const PROFILE_RING_COLOR_OPTIONS = useMemo(() => ([
    { key: 'pink', color: '#FF4FD8' },
    { key: 'yellow', color: '#ffe45c' },
    { key: 'green', color: '#4DFF88' },
    { key: 'purple', color: '#A855F7' },
    { key: 'orange', color: '#FF9800' },
  ]), []);

  const [showProfileRingColorPanel, setShowProfileRingColorPanel] = useState(false);
  const PROFILE_RING_PANEL_HIDDEN_Y = SCREEN_HEIGHT + 320;
  const [profileRingColorPanelAnimation] = useState(new Animated.Value(PROFILE_RING_PANEL_HIDDEN_Y));
  const profileRingPanelScrollRef = useRef<ScrollView | null>(null);
  const [selectedProfileRingId, setSelectedProfileRingId] = useState<string | null>(null);

  const [showProfileRingViewerPanel, setShowProfileRingViewerPanel] = useState(false);
  const [profileRingViewerPanelAnimation] = useState(new Animated.Value(PROFILE_RING_PANEL_HIDDEN_Y));
  const [viewingProfileRingId, setViewingProfileRingId] = useState<string | null>(null);
  const [viewingProfileRingSource, setViewingProfileRingSource] = useState<'profile' | 'home'>('profile');
  const [viewingProfileRingHomePostId, setViewingProfileRingHomePostId] = useState<string | null>(null);
  const [viewingProfileRingOverride, setViewingProfileRingOverride] = useState<ProfileRingPoint | null>(null);

  const [showDeleteProfileRingModal, setShowDeleteProfileRingModal] = useState(false);
  const [pendingDeleteProfileRingId, setPendingDeleteProfileRingId] = useState<string | null>(null);

  const [isProfileRingLinkExpanded, setIsProfileRingLinkExpanded] = useState(false);
  const [profileRingLinkNetworkDraft, setProfileRingLinkNetworkDraft] = useState<string | null>(null);
  const [profileRingLinkUrlDraft, setProfileRingLinkUrlDraft] = useState('');
  const [profileRingLinkErrorDraft, setProfileRingLinkErrorDraft] = useState('');

  const [profileRingColorDraft, setProfileRingColorDraft] = useState('#FFFFFF');
  const [profileRingColorSelectedDraft, setProfileRingColorSelectedDraft] = useState(false);
  const [profileRingNameDraft, setProfileRingNameDraft] = useState('');
  const [profileRingDescriptionDraft, setProfileRingDescriptionDraft] = useState('');

  const [profileRingLocationLabelDraft, setProfileRingLocationLabelDraft] = useState('');
  const [profileRingLocationUrlDraft, setProfileRingLocationUrlDraft] = useState('');
  const [profileRingLocationPlaceIdDraft, setProfileRingLocationPlaceIdDraft] = useState<string | null>(null);
  const [profileRingLocationLatDraft, setProfileRingLocationLatDraft] = useState<number | null>(null);
  const [profileRingLocationLngDraft, setProfileRingLocationLngDraft] = useState<number | null>(null);

  const makeGoogleMapsLatLngUrl = useCallback((lat: number, lng: number, label?: string | null, placeId?: string | null) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'https://www.google.com/maps';

    const coords = `${lat},${lng}`;
    const safeLabel = String(label || '').trim();
    const safePlaceId = String(placeId || '').trim();

    // If we have a placeId, open the exact place and keep a friendly label.
    if (safePlaceId) {
      const q = safeLabel || coords;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}&query_place_id=${encodeURIComponent(safePlaceId)}`;
    }

    // Otherwise, prefer showing the label in Maps rather than raw coordinates.
    if (safeLabel) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeLabel)}`;
    }

    // Coordinates fallback (keeps commas unescaped).
    return `https://www.google.com/maps?q=${coords}`;
  }, []);

  const [showProfileRingLocationPicker, setShowProfileRingLocationPicker] = useState(false);
  const [profileRingPickedLatLng, setProfileRingPickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [isProfileRingLocating, setIsProfileRingLocating] = useState(false);
  const profileRingLocationMapRef = useRef<MapView | null>(null);
  const profileRingLocationAutoMoveRef = useRef(false);

  const [profileRingPickedLocationLabel, setProfileRingPickedLocationLabel] = useState<string | null>(null);
  const [profileRingPickedLocationPlaceId, setProfileRingPickedLocationPlaceId] = useState<string | null>(null);
  const [profileRingLocationSearchQuery, setProfileRingLocationSearchQuery] = useState('');
  const [profileRingLocationPredictions, setProfileRingLocationPredictions] = useState<Array<{ placeId: string; description: string }>>([]);
  const [isProfileRingLocationSearching, setIsProfileRingLocationSearching] = useState(false);
  const [profileRingLocationSearchError, setProfileRingLocationSearchError] = useState('');

  const selectedProfileRing = useMemo(() => {
    if (!selectedProfileRingId) return null;
    return profileRingPoints.find(p => p.id === selectedProfileRingId) ?? null;
  }, [profileRingPoints, selectedProfileRingId]);

  const viewingProfileRing = useMemo(() => {
    if (!viewingProfileRingId) return null;
    if (viewingProfileRingSource === 'profile') {
      return profileRingPoints.find(p => p.id === viewingProfileRingId) ?? null;
    }

    if (!viewingProfileRingOverride) return null;
    if (String(viewingProfileRingOverride?.id) !== String(viewingProfileRingId)) return null;
    return viewingProfileRingOverride;
  }, [profileRingPoints, viewingProfileRingId, viewingProfileRingOverride, viewingProfileRingSource]);

  const requestLocationPermissionIfNeeded = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const granted = await PermissionsAndroid.request(fine, {
        title: 'Permiso de ubicación',
        message: 'Keinti necesita acceso a tu ubicación para que puedas seleccionar una ubicación en el mapa.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      });

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const openProfileRingLocationPicker = useCallback(async () => {
    const ok = await requestLocationPermissionIfNeeded();
    if (!ok) {
      Alert.alert('Permiso requerido', 'Activa el permiso de ubicación para seleccionar una ubicación.');
      return;
    }

    // Pre-fill search with current draft (or saved) label.
    const savedLabel = String(profileRingLocationLabelDraft || '').trim();
    setProfileRingPickedLocationLabel(savedLabel || null);
    setProfileRingPickedLocationPlaceId(profileRingLocationPlaceIdDraft ? String(profileRingLocationPlaceIdDraft) : null);
    setProfileRingLocationSearchQuery(savedLabel);
    setProfileRingLocationPredictions([]);
    setProfileRingLocationSearchError('');

    // Center the map immediately so the modal doesn't render empty.
    if (!profileRingPickedLatLng) {
      const savedLat = Number(profileRingLocationLatDraft ?? NaN);
      const savedLng = Number(profileRingLocationLngDraft ?? NaN);
      if (Number.isFinite(savedLat) && Number.isFinite(savedLng)) {
        setProfileRingPickedLatLng({ lat: savedLat, lng: savedLng });
      } else {
        setProfileRingPickedLatLng({ lat: 40.4168, lng: -3.7038 }); // Madrid fallback
      }
    }

    setIsProfileRingLocating(true);
    setShowProfileRingLocationPicker(true);

    Geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude);
        const lng = Number(pos?.coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          profileRingLocationAutoMoveRef.current = true;
          setProfileRingPickedLatLng({ lat, lng });
          setProfileRingPickedLocationLabel(null);
          setProfileRingPickedLocationPlaceId(null);
        }
        setIsProfileRingLocating(false);
      },
      () => {
        // If we can't get current location, still show map; user can move.
        setIsProfileRingLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  }, [profileRingLocationLabelDraft, profileRingLocationLatDraft, profileRingLocationLngDraft, profileRingLocationPlaceIdDraft, profileRingPickedLatLng, requestLocationPermissionIfNeeded]);

  const isPlacesSearchEnabled = useMemo(() => {
    // Places search is served by the backend (it holds the API key).
    // We require an auth token because the backend route is protected.
    return !!String(authToken || '').trim();
  }, [authToken]);

  useEffect(() => {
    if (!showProfileRingLocationPicker) return;
    if (!isPlacesSearchEnabled) return;
    const q = String(profileRingLocationSearchQuery || '').trim();
    if (q.length < 3) {
      setProfileRingLocationPredictions([]);
      setProfileRingLocationSearchError('');
      return;
    }

    let isActive = true;
    const timeout = setTimeout(async () => {
      setIsProfileRingLocationSearching(true);
      setProfileRingLocationSearchError('');
      try {
        const resp = await fetch(
          `${API_URL}/api/places/autocomplete?q=${encodeURIComponent(q)}&language=es`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            if (isActive) setProfileRingLocationSearchError('Inicia sesión para buscar ubicaciones.');
          } else if (resp.status === 503) {
            if (isActive) setProfileRingLocationSearchError('Búsqueda de ubicación no configurada en el servidor.');
          } else {
            if (isActive) setProfileRingLocationSearchError('No se pudo buscar la ubicación.');
          }
          if (isActive) setProfileRingLocationPredictions([]);
          return;
        }

        const preds = Array.isArray((data as any)?.predictions) ? (data as any).predictions : [];
        const items = preds
          .map((p: any) => ({
            placeId: String(p?.placeId || p?.place_id || ''),
            description: String(p?.description || ''),
          }))
          .filter((p: any) => p.placeId && p.description)
          .slice(0, 8);

        if (isActive) setProfileRingLocationPredictions(items);
      } catch {
        if (isActive) {
          setProfileRingLocationPredictions([]);
          setProfileRingLocationSearchError('No se pudo buscar la ubicación.');
        }
      } finally {
        if (isActive) setIsProfileRingLocationSearching(false);
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [profileRingLocationSearchQuery, showProfileRingLocationPicker, isPlacesSearchEnabled, authToken, API_URL]);

  const moveProfileRingLocationMapTo = useCallback((lat: number, lng: number) => {
    const region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    profileRingLocationAutoMoveRef.current = true;
    setProfileRingPickedLatLng({ lat, lng });
    requestAnimationFrame(() => {
      profileRingLocationMapRef.current?.animateToRegion(region, 350);
    });
  }, []);

  const handleSelectProfileRingLocationPrediction = useCallback(async (placeId: string, description: string) => {
    if (!isPlacesSearchEnabled) return;
    const safePlaceId = String(placeId || '').trim();
    if (!safePlaceId) return;

    setIsProfileRingLocationSearching(true);
    setProfileRingLocationSearchError('');
    try {
      const resp = await fetch(
        `${API_URL}/api/places/details?placeId=${encodeURIComponent(safePlaceId)}&language=es`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setProfileRingLocationSearchError('No se pudo obtener detalles del lugar.');
        return;
      }

      const lat = Number((data as any)?.lat);
      const lng = Number((data as any)?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setProfileRingLocationSearchError('Ubicación inválida.');
        return;
      }

      const label = String((data as any)?.label || description || '').trim();
      setProfileRingPickedLocationLabel(label || null);
      setProfileRingPickedLocationPlaceId(safePlaceId);
      setProfileRingLocationSearchQuery(label || description);
      setProfileRingLocationPredictions([]);
      moveProfileRingLocationMapTo(lat, lng);
      Keyboard.dismiss();
    } catch {
      setProfileRingLocationSearchError('No se pudo obtener detalles del lugar.');
    } finally {
      setIsProfileRingLocationSearching(false);
    }
  }, [isPlacesSearchEnabled, moveProfileRingLocationMapTo, authToken, API_URL]);

  const closeProfileRingLocationPicker = useCallback(() => {
    setShowProfileRingLocationPicker(false);
    setIsProfileRingLocating(false);
    setProfileRingLocationPredictions([]);
    setProfileRingLocationSearchError('');
    setProfileRingPickedLocationPlaceId(null);
  }, []);

  const applyProfileRingPickedLocation = useCallback(() => {
    if (!selectedProfileRingId) return;
    const picked = profileRingPickedLatLng;
    if (!picked) return;

    const lat = picked.lat;
    const lng = picked.lng;
    const label = String(profileRingPickedLocationLabel || '').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const url = makeGoogleMapsLatLngUrl(lat, lng, label, profileRingPickedLocationPlaceId);

    setProfileRingLocationLatDraft(lat);
    setProfileRingLocationLngDraft(lng);
    setProfileRingLocationLabelDraft(label);
    setProfileRingLocationUrlDraft(url);
    setProfileRingLocationPlaceIdDraft(profileRingPickedLocationPlaceId ? String(profileRingPickedLocationPlaceId) : null);

    closeProfileRingLocationPicker();
  }, [closeProfileRingLocationPicker, makeGoogleMapsLatLngUrl, profileRingPickedLatLng, profileRingPickedLocationLabel, profileRingPickedLocationPlaceId, selectedProfileRingId]);

  const canCreateProfileRingMeta = useMemo(() => {
    const hasColor = !!profileRingColorSelectedDraft;
    const hasName = String(profileRingNameDraft || '').trim().length >= 1;
    const hasDescription = String(profileRingDescriptionDraft || '').trim().length >= 1;
    const hasValidLinkDraft = !profileRingLinkErrorDraft;
    return hasColor && hasName && hasDescription && hasValidLinkDraft;
  }, [profileRingColorSelectedDraft, profileRingDescriptionDraft, profileRingLinkErrorDraft, profileRingNameDraft]);

  const [isProfileTextExpanded, setIsProfileTextExpanded] = useState(false);
  const [isPresentationOverlayVisible, setIsPresentationOverlayVisible] = useState(true);
  const [selectedCorrectOption, setSelectedCorrectOption] = useState<string | null>(null);
  const [optionTextA, setOptionTextA] = useState('');
  const [optionTextB, setOptionTextB] = useState('');
  const [optionTextC, setOptionTextC] = useState('');
  const [optionTextD, setOptionTextD] = useState('');
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', '']);
  const [showExtraOptions1, setShowExtraOptions1] = useState(false);
  const [showExtraOptions2, setShowExtraOptions2] = useState(false);

  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const [reactionPanelAnimation] = useState(new Animated.Value(400)); // Start off-screen (positive value for bottom sheet)

  const [bottomToastMessage, setBottomToastMessage] = useState<string>('');
  const [isBottomToastVisible, setIsBottomToastVisible] = useState(false);
  const bottomToastAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const bottomToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideBottomToast = () => {
    Animated.timing(bottomToastAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsBottomToastVisible(false);
        setBottomToastMessage('');
      }
    });
  };

  const showBottomToast = (message: string) => {
    if (bottomToastTimerRef.current) {
      clearTimeout(bottomToastTimerRef.current);
      bottomToastTimerRef.current = null;
    }

    setBottomToastMessage(message);
    setIsBottomToastVisible(true);

    bottomToastAnim.stopAnimation();
    bottomToastAnim.setValue(0);
    Animated.timing(bottomToastAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    bottomToastTimerRef.current = setTimeout(() => {
      hideBottomToast();
      bottomToastTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (bottomToastTimerRef.current) {
        clearTimeout(bottomToastTimerRef.current);
        bottomToastTimerRef.current = null;
      }
      if (profileRingHintTimerRef.current) {
        clearTimeout(profileRingHintTimerRef.current);
        profileRingHintTimerRef.current = null;
      }
    };
  }, []);

  const closeProfileRingColorPanelAndThen = useCallback((afterClose?: () => void) => {
    if (!showProfileRingColorPanel) {
      afterClose?.();
      return;
    }

    Keyboard.dismiss();
    profileRingColorPanelAnimation.stopAnimation();
    Animated.timing(profileRingColorPanelAnimation, {
      toValue: PROFILE_RING_PANEL_HIDDEN_Y,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShowProfileRingColorPanel(false);
      setSelectedProfileRingId(null);
      setIsProfileRingLinkExpanded(false);
      setProfileRingLinkNetworkDraft(null);
      setProfileRingLinkUrlDraft('');
      setProfileRingLinkErrorDraft('');
      setProfileRingColorDraft('#FFFFFF');
      setProfileRingColorSelectedDraft(false);
      setProfileRingNameDraft('');
      setProfileRingDescriptionDraft('');
      setProfileRingLocationLabelDraft('');
      setProfileRingLocationUrlDraft('');
      setProfileRingLocationPlaceIdDraft(null);
      setProfileRingLocationLatDraft(null);
      setProfileRingLocationLngDraft(null);
      afterClose?.();
    });
  }, [PROFILE_RING_PANEL_HIDDEN_Y, profileRingColorPanelAnimation, showProfileRingColorPanel]);

  const closeProfileRingColorPanel = useCallback(() => {
    closeProfileRingColorPanelAndThen();
  }, [closeProfileRingColorPanelAndThen]);

  const closeProfileRingViewerPanelAndThen = useCallback((afterClose?: () => void) => {
    if (!showProfileRingViewerPanel) {
      setHomeProfileRingBannerReady(false);
      setHomeProfileRingBannerSize(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
      afterClose?.();
      return;
    }

    Keyboard.dismiss();
    profileRingViewerPanelAnimation.stopAnimation();
    Animated.timing(profileRingViewerPanelAnimation, {
      toValue: PROFILE_RING_PANEL_HIDDEN_Y,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShowProfileRingViewerPanel(false);
      setHomeProfileRingBannerReady(false);
      setHomeProfileRingBannerSize(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
      setViewingProfileRingId(null);
      setViewingProfileRingSource('profile');
      setViewingProfileRingHomePostId(null);
      setViewingProfileRingOverride(null);
      afterClose?.();
    });
  }, [PROFILE_RING_PANEL_HIDDEN_Y, profileRingViewerPanelAnimation, showProfileRingViewerPanel]);

  const closeProfileRingViewerPanel = useCallback(() => {
    closeProfileRingViewerPanelAndThen();
  }, [closeProfileRingViewerPanelAndThen]);

  useEffect(() => {
    if (!showProfileRingViewerPanel) return;
    if (!viewingProfileRingId) return;
    if (viewingProfileRing) return;
    closeProfileRingViewerPanel();
  }, [closeProfileRingViewerPanel, showProfileRingViewerPanel, viewingProfileRing, viewingProfileRingId]);

  const openProfileRingColorPanel = useCallback((ringId: string) => {
    const ring = profileRingPoints.find(p => p.id === ringId) ?? null;

    setSelectedProfileRingId(ringId);
    setIsProfileRingLinkExpanded(false);
    setProfileRingLinkNetworkDraft(ring?.linkNetwork ?? null);
    setProfileRingLinkUrlDraft(ring?.linkUrl ?? '');
    setProfileRingLinkErrorDraft('');

    setProfileRingColorDraft(ring?.color ?? '#FFFFFF');
    setProfileRingColorSelectedDraft(Boolean(ring?.colorSelected));
    setProfileRingNameDraft(ring?.name ?? '');
    setProfileRingDescriptionDraft(ring?.description ?? '');
    setProfileRingLocationLabelDraft(ring?.locationLabel ?? '');
    setProfileRingLocationUrlDraft(ring?.locationUrl ?? '');
    setProfileRingLocationPlaceIdDraft(ring?.locationPlaceId ? String(ring.locationPlaceId) : null);
    setProfileRingLocationLatDraft(ring?.locationLat ?? null);
    setProfileRingLocationLngDraft(ring?.locationLng ?? null);

    if (showProfileRingViewerPanel) {
      closeProfileRingViewerPanelAndThen();
    }
    if (showReactionPanel) {
      Animated.timing(reactionPanelAnimation, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowReactionPanel(false));
    }

    if (showProfileRingColorPanel) return;

    profileRingColorPanelAnimation.stopAnimation();
    setShowProfileRingColorPanel(true);
    profileRingColorPanelAnimation.setValue(PROFILE_RING_PANEL_HIDDEN_Y);
    Animated.timing(profileRingColorPanelAnimation, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [PROFILE_RING_PANEL_HIDDEN_Y, closeProfileRingViewerPanelAndThen, profileRingColorPanelAnimation, profileRingPoints, showProfileRingColorPanel, showProfileRingViewerPanel, showReactionPanel, reactionPanelAnimation]);

  const openProfileRingViewerPanel = useCallback((ringId: string) => {
    setViewingProfileRingId(ringId);
    setHomeProfileRingBannerReady(false);
    setHomeProfileRingBannerSize(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
    setHomeProfileRingBannerRequestKey(k => k + 1);

    if (showProfileRingColorPanel) {
      closeProfileRingColorPanelAndThen();
    }

    if (showReactionPanel) {
      Animated.timing(reactionPanelAnimation, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowReactionPanel(false));
    }

    if (showProfileRingViewerPanel) return;

    profileRingViewerPanelAnimation.stopAnimation();
    setShowProfileRingViewerPanel(true);
    profileRingViewerPanelAnimation.setValue(PROFILE_RING_PANEL_HIDDEN_Y);
    Animated.timing(profileRingViewerPanelAnimation, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [PROFILE_RING_PANEL_HIDDEN_Y, closeProfileRingColorPanelAndThen, profileRingViewerPanelAnimation, reactionPanelAnimation, showProfileRingColorPanel, showProfileRingViewerPanel, showReactionPanel]);

  const openHomeProfileRingViewerPanel = useCallback((postId: string | number, ringId: string) => {
    // Backwards compatible signature (old calls) – keep in case some callsite still passes (postId, ringId).
    const rid = String(ringId || '').trim();
    if (!rid) return;
    setViewingProfileRingSource('home');
    setViewingProfileRingHomePostId(String(postId || '').trim() || null);
    setViewingProfileRingOverride(null);
    openProfileRingViewerPanel(rid);
  }, [openProfileRingViewerPanel]);

  const openHomeProfileRingViewerPanelFromRing = useCallback((ring: ProfileRingPoint) => {
    const rid = String(ring?.id || '').trim();
    if (!rid) return;
    setViewingProfileRingSource('home');
    setViewingProfileRingHomePostId(null);
    setViewingProfileRingOverride(ring);
    openProfileRingViewerPanel(rid);
  }, [openProfileRingViewerPanel]);

  const handleEditViewingProfileRing = useCallback(() => {
    if (viewingProfileRingSource !== 'profile') return;
    if (!viewingProfileRingId) return;
    const id = viewingProfileRingId;
    // Open editor immediately; it will close the viewer internally.
    openProfileRingColorPanel(id);
  }, [openProfileRingColorPanel, viewingProfileRingId, viewingProfileRingSource]);

  const requestDeleteViewingProfileRing = useCallback(() => {
    if (viewingProfileRingSource !== 'profile') return;
    if (!viewingProfileRingId) return;
    setPendingDeleteProfileRingId(viewingProfileRingId);
    setShowDeleteProfileRingModal(true);
  }, [viewingProfileRingId, viewingProfileRingSource]);

  const closeDeleteProfileRingModal = useCallback(() => {
    setShowDeleteProfileRingModal(false);
    setPendingDeleteProfileRingId(null);
  }, []);

  const confirmDeleteProfileRing = useCallback(() => {
    const id = pendingDeleteProfileRingId;
    if (!id) return;

    const next = profileRingPoints.filter(p => p.id !== id);
    setProfileRingPoints(next);
    closeProfileRingViewerPanel();
    closeDeleteProfileRingModal();
    void persistProfileRingsImmediately(next);
  }, [closeDeleteProfileRingModal, closeProfileRingViewerPanel, pendingDeleteProfileRingId, persistProfileRingsImmediately, profileRingPoints]);

  const handleProfileRingPress = useCallback((ringId: string) => {
    const ring = profileRingPoints.find(p => p.id === ringId);
    if (!ring) return;
    if (ring.isCreated) {
      setViewingProfileRingSource('profile');
      setViewingProfileRingHomePostId(null);
      setViewingProfileRingOverride(null);
      openProfileRingViewerPanel(ringId);
      return;
    }
    setViewingProfileRingSource('profile');
    setViewingProfileRingHomePostId(null);
    setViewingProfileRingOverride(null);
    openProfileRingColorPanel(ringId);
  }, [openProfileRingColorPanel, openProfileRingViewerPanel, profileRingPoints]);

  const createSelectedProfileRing = useCallback(() => {
    if (!selectedProfileRingId) return;
    if (!canCreateProfileRingMeta) return;

    const ringId = selectedProfileRingId;
    const draftNetwork = String(profileRingLinkNetworkDraft || '').trim();
    const draftUrl = String(profileRingLinkUrlDraft || '').trim();

    const next = profileRingPoints.map(p => {
      if (p.id !== ringId) return p;

      const nextName = String(profileRingNameDraft || '').slice(0, 38);
      const nextDescription = String(profileRingDescriptionDraft || '').slice(0, 280);

      const trimmedLocationLabel = String(profileRingLocationLabelDraft || '').trim();
      const hasAnyLocation = !!trimmedLocationLabel || (profileRingLocationLatDraft != null && profileRingLocationLngDraft != null);

      let nextLinkNetwork: string | null = p.linkNetwork;
      let nextLinkUrl: string = p.linkUrl;
      if (!draftNetwork && !draftUrl) {
        nextLinkNetwork = null;
        nextLinkUrl = '';
      } else if (draftNetwork && draftUrl && !profileRingLinkErrorDraft) {
        nextLinkNetwork = draftNetwork;
        nextLinkUrl = draftUrl;
      }

      return {
        ...p,
        isCreated: true,
        color: String(profileRingColorDraft || '#FFFFFF'),
        colorSelected: Boolean(profileRingColorSelectedDraft),
        name: nextName,
        description: nextDescription,
        linkNetwork: nextLinkNetwork,
        linkUrl: nextLinkUrl,
        locationLabel: hasAnyLocation ? String(profileRingLocationLabelDraft || '') : '',
        locationUrl: hasAnyLocation ? String(profileRingLocationUrlDraft || '') : '',
        locationPlaceId: hasAnyLocation ? (profileRingLocationPlaceIdDraft ? String(profileRingLocationPlaceIdDraft) : null) : null,
        locationLat: hasAnyLocation ? (profileRingLocationLatDraft == null ? null : Number(profileRingLocationLatDraft)) : null,
        locationLng: hasAnyLocation ? (profileRingLocationLngDraft == null ? null : Number(profileRingLocationLngDraft)) : null,
      };
    });

    setProfileRingPoints(next);
    void persistProfileRingsImmediately(next);

    closeProfileRingColorPanelAndThen(() => {
      setViewingProfileRingSource('profile');
      setViewingProfileRingHomePostId(null);
      setViewingProfileRingOverride(null);
      openProfileRingViewerPanel(ringId);
    });
  }, [canCreateProfileRingMeta, closeProfileRingColorPanelAndThen, openProfileRingViewerPanel, persistProfileRingsImmediately, profileRingColorDraft, profileRingColorSelectedDraft, profileRingDescriptionDraft, profileRingLinkErrorDraft, profileRingLinkNetworkDraft, profileRingLinkUrlDraft, profileRingLocationLabelDraft, profileRingLocationLatDraft, profileRingLocationLngDraft, profileRingLocationPlaceIdDraft, profileRingLocationUrlDraft, profileRingNameDraft, profileRingPoints, selectedProfileRingId]);

  const toggleProfileRingLinkExpanded = useCallback(() => {
    setIsProfileRingLinkExpanded(prev => {
      return !prev;
    });
  }, []);

  const handleSelectProfileRingLinkNetwork = useCallback((network: string) => {
    const normalized = String(network || '').trim();
    if (!normalized) return;
    setProfileRingLinkNetworkDraft(prev => (prev === normalized ? null : normalized));
    setProfileRingLinkUrlDraft('');
    setProfileRingLinkErrorDraft('');
  }, []);

  const handleProfileRingLinkUrlChange = useCallback((text: string) => {
    setProfileRingLinkUrlDraft(text);

    const network = profileRingLinkNetworkDraft;
    if (network && text.trim()) {
      const ok = validateSocialLink(network, text);
      if (!ok) {
        const platformNames: Record<string, string> = {
          facebook: 'Facebook',
          instagram: 'Instagram',
          onlyfans: 'OnlyFans',
          pinterest: 'Pinterest',
          telegram: 'Telegram',
          tiktok: 'TikTok',
          twitter: 'X/Twitter',
          youtube: 'YouTube',
          discord: 'Discord',
          threads: 'Threads',
          linkedin: 'LinkedIn',
          kick: 'Kick',
          twitch: 'Twitch',
        };
        setProfileRingLinkErrorDraft(`${t('front.linkMustBeFrom' as TranslationKey)} ${platformNames[network] ?? network}`);
      } else {
        setProfileRingLinkErrorDraft('');
      }
    } else {
      setProfileRingLinkErrorDraft('');
    }
  }, [profileRingLinkNetworkDraft, t]);

  const clearProfileRingLinkDraft = useCallback(() => {
    setProfileRingLinkNetworkDraft(null);
    setProfileRingLinkUrlDraft('');
    setProfileRingLinkErrorDraft('');
    setIsProfileRingLinkExpanded(false);
  }, []);

  const clearProfileRingLocationDraft = useCallback(() => {
    setProfileRingLocationLabelDraft('');
    setProfileRingLocationUrlDraft('');
    setProfileRingLocationPlaceIdDraft(null);
    setProfileRingLocationLatDraft(null);
    setProfileRingLocationLngDraft(null);

    // Also reset picker local state so the next open starts clean.
    setProfileRingPickedLocationLabel(null);
    setProfileRingPickedLocationPlaceId(null);
    setProfileRingLocationSearchQuery('');
    setProfileRingLocationPredictions([]);
    setProfileRingLocationSearchError('');
  }, []);

  const applyProfileRingLinkDraft = useCallback(() => {
    if (!selectedProfileRingId) return;
    if (!profileRingLinkNetworkDraft || !!profileRingLinkErrorDraft) return;
    const link = String(profileRingLinkUrlDraft || '').trim();
    if (!link) return;

    setIsProfileRingLinkExpanded(false);
  }, [profileRingLinkErrorDraft, profileRingLinkNetworkDraft, profileRingLinkUrlDraft, selectedProfileRingId]);

  const applyColorToSelectedRing = useCallback((color: string) => {
    if (!selectedProfileRingId) return;
    setProfileRingColorDraft(color);
    setProfileRingColorSelectedDraft(true);
  }, [selectedProfileRingId]);

  const updateSelectedProfileRingName = useCallback((name: string) => {
    if (!selectedProfileRingId) return;
    setProfileRingNameDraft(name);
  }, [selectedProfileRingId]);

  const updateSelectedProfileRingDescription = useCallback((description: string) => {
    if (!selectedProfileRingId) return;
    setProfileRingDescriptionDraft(description);
  }, [selectedProfileRingId]);

  const ensureProfileRingFocusedFieldVisible = useCallback(() => {
    requestAnimationFrame(() => {
      profileRingPanelScrollRef.current?.scrollToEnd({ animated: true });
    });

    setTimeout(() => {
      profileRingPanelScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const deleteSelectedProfileRing = useCallback(() => {
    if (!selectedProfileRingId) {
      closeProfileRingColorPanel();
      return;
    }

    const next = profileRingPoints.filter(p => p.id !== selectedProfileRingId);
    setProfileRingPoints(next);
    void persistProfileRingsImmediately(next);
    closeProfileRingColorPanel();
  }, [closeProfileRingColorPanel, persistProfileRingsImmediately, profileRingPoints, selectedProfileRingId]);
  
  const handleProfileRingIconPress = useCallback(() => {
    if (profileRingHintTimerRef.current) {
      clearTimeout(profileRingHintTimerRef.current);
      profileRingHintTimerRef.current = null;
    }

    if (profileRingPoints.length >= 5) {
      setProfileRingPlacementEnabled(false);
      setProfileRingHintMessage(t('front.profileRingHintMaxRings' as TranslationKey));
      profileRingHintTimerRef.current = setTimeout(() => {
        setProfileRingHintMessage(null);
        profileRingHintTimerRef.current = null;
      }, 2000);
      return;
    }

    // Toggle off if already enabled or hint showing.
    if (profileRingPlacementEnabled || showProfileRingHint) {
      setProfileRingHintMessage(null);
      setProfileRingPlacementEnabled(false);
      return;
    }

    setProfileRingPlacementEnabled(false);
    setProfileRingHintMessage(t('front.profileRingHintSelect' as TranslationKey));
    profileRingHintTimerRef.current = setTimeout(() => {
      setProfileRingHintMessage(null);
      setProfileRingPlacementEnabled(true);
      profileRingHintTimerRef.current = null;
    }, 2000);
  }, [profileRingPoints.length, profileRingPlacementEnabled, showProfileRingHint, t]);

  const handleProfileCarouselImagePress = useCallback((imageIndex: number, e: any) => {
    // Require explicitly re-enabling ring placement via the ring icon after each ring is added.
    if (!profileRingPlacementEnabledRef.current || showProfileRingHint) return;

    if (profileRingPoints.length >= 5) {
      showActionToast(t('front.profileRingHintMaxRings' as TranslationKey));
      return;
    }

    // Disable placement immediately to avoid rapid taps placing multiple rings.
    profileRingPlacementEnabledRef.current = false;
    setProfileRingPlacementEnabled(false);

    const layout = profileCarouselImageLayouts[imageIndex];
    const locationX = Number(e?.nativeEvent?.locationX ?? NaN);
    const locationY = Number(e?.nativeEvent?.locationY ?? NaN);

    let x = 0.5;
    let y = 0.5;
    if (layout?.width && layout?.height && Number.isFinite(locationX) && Number.isFinite(locationY)) {
      x = Math.max(0, Math.min(1, locationX / layout.width));
      y = Math.max(0, Math.min(1, locationY / layout.height));
    }

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setProfileRingPoints(prev => {
      if (prev.length >= 5) return prev;
      return [...prev, {
        id,
        imageIndex,
        x,
        y,
        color: '#FFFFFF',
        colorSelected: false,
        name: '',
        description: '',
        linkNetwork: null,
        linkUrl: '',
        locationLabel: '',
        locationUrl: '',
        locationPlaceId: null,
        locationLat: null,
        locationLng: null,
        isCreated: false,
      }];
    });
  }, [profileRingPoints.length, showProfileRingHint, profileCarouselImageLayouts, t]);

  const [publications, setPublications] = useState<Publication[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [activePublicationOptionsId, setActivePublicationOptionsId] = useState<string | number | null>(null);
  const [isNextPublicationAnimating, setIsNextPublicationAnimating] = useState(false);
  const nextPublicationAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const nextPublicationLine1Scale = useRef(new Animated.Value(0)).current;
  const nextPublicationLine1Opacity = useRef(new Animated.Value(0)).current;
  const nextPublicationLine2Scale = useRef(new Animated.Value(0)).current;
  const nextPublicationLine2Opacity = useRef(new Animated.Value(0)).current;
  const nextPublicationIconAppearAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const nextPublicationIconScale = useRef(new Animated.Value(1)).current;
  const nextPublicationIconOpacity = useRef(new Animated.Value(1)).current;
  const prevIsNextPublicationAnimatingRef = useRef(false);
  const seenPublicationIdsRef = useRef<Set<string>>(new Set());
  const [myPublication, setMyPublication] = useState<Publication | undefined>(undefined);
  const isPublished = !!myPublication;
  const userPublication = myPublication;
  const channelOwnerEmail = selectedChannel ? selectedChannel.publisher_email : (userPublication ? userPublication.user.email : null);

  const shouldShowHomeSwipeTutorial =
    activeBottomTab === 'home' &&
    hasSeenHomeSwipeTutorial === false &&
    publications.length > 0;

  const profileRingPanelsBottomOffset = Math.max(bottomNavHeight, bottomSystemOffset);

  useEffect(() => {
    if (activeBottomTab !== 'home') {
      setHomeProfileRingBannerReady(false);
      setHomeProfileRingBannerSize(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
    }
  }, [activeBottomTab]);

  const homeSwipeTutorialArrowOpacity = homeSwipeTutorialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });

  const homeSwipeTutorialLeftArrowOffset = homeSwipeTutorialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const homeSwipeTutorialRightArrowOffset = homeSwipeTutorialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });

  useEffect(() => {
    if (!shouldShowHomeSwipeTutorial) {
      if (homeSwipeTutorialLoopRef.current) {
        homeSwipeTutorialLoopRef.current.stop();
        homeSwipeTutorialLoopRef.current = null;
      }
      homeSwipeTutorialAnim.stopAnimation();
      homeSwipeTutorialAnim.setValue(0);
      return;
    }

    if (homeSwipeTutorialLoopRef.current) {
      homeSwipeTutorialLoopRef.current.stop();
      homeSwipeTutorialLoopRef.current = null;
    }

    homeSwipeTutorialAnim.stopAnimation();
    homeSwipeTutorialAnim.setValue(0);

    homeSwipeTutorialLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(homeSwipeTutorialAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(homeSwipeTutorialAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    homeSwipeTutorialLoopRef.current.start();

    return () => {
      if (homeSwipeTutorialLoopRef.current) {
        homeSwipeTutorialLoopRef.current.stop();
        homeSwipeTutorialLoopRef.current = null;
      }
    };
  }, [shouldShowHomeSwipeTutorial, homeSwipeTutorialAnim]);

  useEffect(() => {
    const wasAnimating = prevIsNextPublicationAnimatingRef.current;
    prevIsNextPublicationAnimatingRef.current = isNextPublicationAnimating;

    // Only animate when the icon comes back after the progress sequence.
    if (!wasAnimating || isNextPublicationAnimating) return;

    if (nextPublicationIconAppearAnimRef.current) {
      nextPublicationIconAppearAnimRef.current.stop();
      nextPublicationIconAppearAnimRef.current = null;
    }

    nextPublicationIconScale.stopAnimation();
    nextPublicationIconOpacity.stopAnimation();

    nextPublicationIconScale.setValue(0.86);
    nextPublicationIconOpacity.setValue(0);

    nextPublicationIconAppearAnimRef.current = Animated.parallel([
      Animated.timing(nextPublicationIconScale, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(nextPublicationIconOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    nextPublicationIconAppearAnimRef.current.start(({ finished }) => {
      nextPublicationIconAppearAnimRef.current = null;
      if (!finished) return;
      nextPublicationIconScale.setValue(1);
      nextPublicationIconOpacity.setValue(1);
    });
  }, [isNextPublicationAnimating, nextPublicationIconOpacity, nextPublicationIconScale]);

  const enteredOwnChannelChatRef = useRef(false);

  const togglePublicationOptions = (pubId: string | number) => {
    setActivePublicationOptionsId(prev => (prev === pubId ? null : pubId));
  };

  useEffect(() => {
    const ownPostId = (!selectedChannel && userPublication?.id) ? String(userPublication.id) : null;
    const isInOwnChannelChat =
      activeBottomTab === 'chat' &&
      chatView === 'channel' &&
      channelTab === 'Tu canal' &&
      !selectedChannel &&
      !!ownPostId;

    if (isInOwnChannelChat && !enteredOwnChannelChatRef.current) {
      currentChannelPostIdRef.current = ownPostId;
      resetChannelChatPaginationState(true);
      pendingChannelScrollToLatestAfterRefreshRef.current = true;
      setIsChannelNearBottom(true);
      setShowChannelScrollToLatest(false);
      setChannelInteractions([]);
      setChannelMessagesTab('General');
      setReplyingToMessageIndex(null);
      setReplyingToUsername(null);
      setExpandedMention(null);
      channelChatLoadingPostIdRef.current = ownPostId;
      setChannelChatLoadingPostId(ownPostId);
    }

    enteredOwnChannelChatRef.current = isInOwnChannelChat;
  }, [activeBottomTab, chatView, channelTab, selectedChannel, userPublication?.id]);

  useEffect(() => {
    setActivePublicationOptionsId(null);
  }, [currentPostIndex, activeBottomTab]);

  const startNextPublicationProgressAnimation = () => {
    if (nextPublicationAnimRef.current) {
      nextPublicationAnimRef.current.stop();
      nextPublicationAnimRef.current = null;
    }

    setIsNextPublicationAnimating(true);

    nextPublicationLine1Scale.stopAnimation();
    nextPublicationLine1Opacity.stopAnimation();
    nextPublicationLine2Scale.stopAnimation();
    nextPublicationLine2Opacity.stopAnimation();

    nextPublicationLine1Scale.setValue(0);
    nextPublicationLine1Opacity.setValue(0);
    nextPublicationLine2Scale.setValue(0);
    nextPublicationLine2Opacity.setValue(0);

    const easeOut = Easing.out(Easing.cubic);

    const showLine = (scale: Animated.Value, opacity: Animated.Value) =>
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 260,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]);

    const hideLine = (scale: Animated.Value, opacity: Animated.Value) =>
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: 260,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]);

    nextPublicationAnimRef.current = Animated.sequence([
      showLine(nextPublicationLine1Scale, nextPublicationLine1Opacity),
      Animated.delay(900),
      hideLine(nextPublicationLine1Scale, nextPublicationLine1Opacity),
      Animated.delay(120),
      showLine(nextPublicationLine2Scale, nextPublicationLine2Opacity),
      Animated.delay(900),
      hideLine(nextPublicationLine2Scale, nextPublicationLine2Opacity),
    ]);

    nextPublicationAnimRef.current.start(({ finished }) => {
      nextPublicationAnimRef.current = null;
      if (finished) {
        setIsNextPublicationAnimating(false);
      }
    });
  };

  const getNextHomeInterstitialThreshold = () =>
    HOME_INTERSTITIAL_MIN_VIEWS +
    Math.floor(Math.random() * (HOME_INTERSTITIAL_MAX_VIEWS - HOME_INTERSTITIAL_MIN_VIEWS + 1));

  const homeInterstitialRef = useRef<InterstitialAd | null>(null);
  const isHomeInterstitialLoadedRef = useRef(false);
  const isHomeInterstitialShowingRef = useRef(false);
  const homeViewedPostsSinceAdRef = useRef(0);
  const homeNextAdAtRef = useRef(getNextHomeInterstitialThreshold());

  const maybeShowHomeInterstitial = () => {
    const interstitial = homeInterstitialRef.current;
    if (!interstitial) return;
    if (isHomeInterstitialShowingRef.current) return;

    if (!isHomeInterstitialLoadedRef.current) {
      try {
        interstitial.load();
      } catch {
        // ignore
      }
      return;
    }

    isHomeInterstitialShowingRef.current = true;
    try {
      interstitial.show();
    } catch {
      isHomeInterstitialShowingRef.current = false;
    }
  };

  const trackHomePublicationAdvanceForAds = () => {
    if (activeBottomTab !== 'home') return;
    homeViewedPostsSinceAdRef.current += 1;

    if (homeViewedPostsSinceAdRef.current < homeNextAdAtRef.current) return;

    homeViewedPostsSinceAdRef.current = 0;
    homeNextAdAtRef.current = getNextHomeInterstitialThreshold();
    maybeShowHomeInterstitial();
  };

  useEffect(() => {
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    homeInterstitialRef.current = interstitial;

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isHomeInterstitialLoadedRef.current = true;
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isHomeInterstitialLoadedRef.current = false;
      isHomeInterstitialShowingRef.current = false;
      try {
        interstitial.load();
      } catch {
        // ignore
      }
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      isHomeInterstitialLoadedRef.current = false;
      isHomeInterstitialShowingRef.current = false;
    });

    const unsubscribePaid = interstitial.addAdEventListener(AdEventType.PAID, event => {
      trackAdPaidEvent({
        format: 'interstitial',
        placement: 'home_feed_interstitial_rotation',
        event,
      });
    });

    interstitial.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      unsubscribePaid();
    };
  }, []);

  const handleNextRandomPublication = (options?: { animate?: boolean }) => {
    const shouldAnimate = options?.animate !== false;

    if (shouldAnimate && isNextPublicationAnimating) return;
    if (publications.length <= 1) return;

    const seen = seenPublicationIdsRef.current;

    const candidateIndices = publications
      .map((p, index) => ({
        index,
        idStr: p?.id != null ? String(p.id) : ''
      }))
      .filter(({ index, idStr }) => index !== currentPostIndex && idStr && !seen.has(idStr))
      .map(({ index }) => index);

    // Si ya se vieron todas, reiniciamos el ciclo de vistos manteniendo la actual como vista.
    if (candidateIndices.length === 0) {
      const currentIdStr = publications[currentPostIndex]?.id != null ? String(publications[currentPostIndex].id) : '';
      seen.clear();
      if (currentIdStr) {
        seen.add(currentIdStr);
      }

      const resetCandidates = publications
        .map((p, index) => ({
          index,
          idStr: p?.id != null ? String(p.id) : ''
        }))
        .filter(({ index, idStr }) => index !== currentPostIndex && idStr)
        .map(({ index }) => index);

      if (resetCandidates.length === 0) return;
      const nextIndex = resetCandidates[Math.floor(Math.random() * resetCandidates.length)];
      const nextIdStr = publications[nextIndex]?.id != null ? String(publications[nextIndex].id) : '';
      setCurrentPostIndex(nextIndex);
      if (nextIdStr) {
        seen.add(nextIdStr);
      }
      trackHomePublicationAdvanceForAds();
      if (shouldAnimate) {
        startNextPublicationProgressAnimation();
      }
      return;
    }

    const nextIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    const nextIdStr = publications[nextIndex]?.id != null ? String(publications[nextIndex].id) : '';
    setCurrentPostIndex(nextIndex);
    if (nextIdStr) {
      seen.add(nextIdStr);
    }
    trackHomePublicationAdvanceForAds();
    if (shouldAnimate) {
      startNextPublicationProgressAnimation();
    }
  };

  const publicationSwipeX = useRef(new Animated.Value(0)).current;
  const isPublicationSwipeAnimatingRef = useRef(false);

  useEffect(() => {
    // Ensure we never keep a stale translation when the publication changes.
    publicationSwipeX.stopAnimation();
    publicationSwipeX.setValue(0);
  }, [currentPostIndex, publicationSwipeX]);

  const publicationSwipePanResponder = useMemo(() => {
    const SWIPE_START_PX = 10;
    const SWIPE_TRIGGER_PX = Math.min(120, Math.round(SCREEN_WIDTH * 0.22));

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Only claim the gesture if it is clearly horizontal.
      // This keeps vertical ScrollView scrolling working (and lets horizontal carousels keep priority).
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (activeBottomTab !== 'home') return false;
        if (isHomeCarouselGestureActiveRef.current) return false;
        if (publications.length <= 1) return false;
        if (isPublicationSwipeAnimatingRef.current) return false;

        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        if (dx < SWIPE_START_PX) return false;
        return dx > dy * 1.2;
      },
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderMove: (_evt, gesture) => {
        publicationSwipeX.setValue(gesture.dx);
      },

      onPanResponderRelease: (_evt, gesture) => {
        const dx = gesture.dx;
        const dy = gesture.dy;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (activeBottomTab !== 'home' || publications.length <= 1) {
          Animated.spring(publicationSwipeX, { toValue: 0, useNativeDriver: true }).start();
          return;
        }

        // Trigger when the intent is horizontal and surpasses threshold.
        if (absDx >= SWIPE_TRIGGER_PX && absDx > absDy * 1.1 && !isPublicationSwipeAnimatingRef.current) {
          if (hasSeenHomeSwipeTutorial === false) {
            markHomeSwipeTutorialSeen();
          }
          isPublicationSwipeAnimatingRef.current = true;
          const outTo = dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
          Animated.timing(publicationSwipeX, {
            toValue: outTo,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            publicationSwipeX.setValue(0);
            isPublicationSwipeAnimatingRef.current = false;
            // For swipe UX, change instantly (no "next" button progress animation).
            handleNextRandomPublication({ animate: false });
          });
          return;
        }

        Animated.spring(publicationSwipeX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(publicationSwipeX, { toValue: 0, useNativeDriver: true }).start();
      },
    });
  }, [activeBottomTab, handleNextRandomPublication, hasSeenHomeSwipeTutorial, markHomeSwipeTutorialSeen, publicationSwipeX, publications.length]);

  useEffect(() => {
    return () => {
      if (nextPublicationAnimRef.current) {
        nextPublicationAnimRef.current.stop();
        nextPublicationAnimRef.current = null;
      }

      if (nextPublicationIconAppearAnimRef.current) {
        nextPublicationIconAppearAnimRef.current.stop();
        nextPublicationIconAppearAnimRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const currentPub = publications[currentPostIndex];
    if (currentPub?.id) {
      seenPublicationIdsRef.current.add(String(currentPub.id));
    }
  }, [publications, currentPostIndex]);

  const openGroupRequestPanel = async (targetUsername: string) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para solicitar.');
      return;
    }

    // Only the host (publisher) of your channel can request from here
    if (!userEmail || !channelOwnerEmail || userEmail !== channelOwnerEmail) {
      return;
    }

    setGroupRequestTargetUsername(targetUsername);
    setSelectedRequestGroupId(null);
    setShowGroupRequestPanel(true);

    if (myGroups.length === 0) {
      await loadMyGroups();
    }
  };

  const closeGroupRequestPanel = () => {
    setShowGroupRequestPanel(false);
    setGroupRequestTargetUsername(null);
    setSelectedRequestGroupId(null);
    setIsSubmittingGroupRequest(false);
  };

  const submitGroupRequest = async () => {
    if (!selectedRequestGroupId || !groupRequestTargetUsername) return;
    if (isSubmittingGroupRequest) return;

    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para solicitar.');
      return;
    }

    setIsSubmittingGroupRequest(true);
    try {
      const targetPostId = selectedChannel
        ? (selectedChannel.post_id ?? selectedChannel.postId)
        : (userPublication ? userPublication.id : null);
      const postIdNumber = targetPostId === null || targetPostId === undefined ? null : Number(targetPostId);
      const safePostId = postIdNumber !== null && Number.isFinite(postIdNumber) ? postIdNumber : undefined;

      const resp = await fetch(`${API_URL}/api/group-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: Number(selectedRequestGroupId),
          targetUsername: groupRequestTargetUsername,
          ...(safePostId !== undefined ? { postId: safePostId } : {}),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo enviar la solicitud');
      }

      const safeTarget = String(groupRequestTargetUsername || '').trim();
      const targetWithAt = safeTarget.startsWith('@') ? safeTarget : `@${safeTarget}`;
      showBottomToast(`La solicitud a sido enviada a ${targetWithAt}`);

      // Optimistic UI: show pending immediately
      setSentGroupRequestStatusByTarget(prev => ({
        ...prev,
        [groupRequestTargetUsername]: 'pending',
      }));

      // Sync with backend for accurate status
      fetchSentGroupRequests().catch(() => { });
      closeGroupRequestPanel();
    } finally {
      setIsSubmittingGroupRequest(false);
    }
  };

  const fetchSentGroupRequests = async () => {
    if (!authToken) return;

    try {
      const resp = await fetch(`${API_URL}/api/group-requests/sent`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) return;
      const data = await resp.json();
      if (!Array.isArray(data)) return;

      const rows = data as SentGroupRequest[];
      const byTarget: Record<string, 'pending' | 'accepted' | 'blocked'> = {};

      for (const row of rows) {
        const target = String(row.targetUsername || '').trim();
        if (!target) continue;

        // Prefer blocked > accepted > pending
        if (row.status === 'blocked') {
          byTarget[target] = 'blocked';
        } else if (row.status === 'accepted' && byTarget[target] !== 'blocked') {
          byTarget[target] = 'accepted';
        } else if (row.status === 'pending' && byTarget[target] !== 'accepted' && byTarget[target] !== 'blocked') {
          byTarget[target] = 'pending';
        }
      }

      setSentGroupRequestStatusByTarget(byTarget);
    } catch (e) {
      console.error('Error fetching sent group requests:', e);
    }
  };

  const fetchNotifications = async () => {
    if (!authToken) return;
    if (isLoadingNotifications) return;

    setIsLoadingNotifications(true);
    try {
      const resp = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        setNotifications([]);
        return;
      }

      const data = await resp.json();
      if (Array.isArray(data)) {
        setNotifications(data as NotificationItem[]);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const respondToGroupJoinRequest = async (n: NotificationItem, action: 'accept' | 'ignore') => {
    if (!authToken) return;
    try {
      const resp = await fetch(`${API_URL}/api/group-requests/${n.id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo actualizar la solicitud');
      }

      setNotifications(prev => prev.map(row => row.id === n.id ? { ...row, status: action === 'accept' ? 'accepted' : 'ignored' } : row));

      if (action === 'accept') {
        await loadJoinedGroups();
        setPendingJoinedGroupToast({
          groupHashtag: String(n.groupHashtag ?? ''),
          requesterUsername: String(n.requesterUsername ?? ''),
        });
        setActiveBottomTab('chat');
        setChatView('groups');
        setGroupsTab('unidos');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar la solicitud');
    }
  };

  useEffect(() => {
    if (!pendingJoinedGroupToast) return;
    if (activeBottomTab !== 'chat') return;

    const isOnJoinedGroupsScreen = chatView === 'groups' && groupsTab === 'unidos';
    const isInGroupChat = chatView === 'groupChat';
    if (!isOnJoinedGroupsScreen && !isInGroupChat) return;

    const group = formatGroupHashtagWithHash(pendingJoinedGroupToast.groupHashtag);
    const user = formatUsernameWithAt(pendingJoinedGroupToast.requesterUsername);

    const message = formatTemplate(t('toast.joinedGroupMessage' as TranslationKey), { group, user });

    // Ensure it appears after the UI transition/animations.
    InteractionManager.runAfterInteractions(() => {
      showBottomToast(message);
    });

    setPendingJoinedGroupToast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoinedGroupToast, activeBottomTab, chatView, groupsTab]);

  const fetchGroupChatMessages = async (
    groupId: string,
    mode: 'latest' | 'poll' | 'older' = 'latest'
  ) => {
    if (!authToken) return;

    let beforeId: number | null = null;
    if (mode === 'older') {
      beforeId = groupOldestMessageIdRef.current;
      if (!beforeId || !Number.isFinite(beforeId)) return;
    }

    const fetchSeq = ++groupChatFetchSeqRef.current;

    try {
      const params = new URLSearchParams();
      params.set('limit', String(GROUP_CHAT_PAGE_SIZE));
      if (mode === 'older' && beforeId) {
        params.set('beforeId', String(beforeId));
      }

      const resp = await fetch(`${API_URL}/api/groups/${groupId}/messages?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      });

      // Ignore if a newer fetch started after this one.
      if (fetchSeq !== groupChatFetchSeqRef.current) return;

      // Ignore if the user already switched to a different group.
      if (selectedGroupIdRef.current !== groupId) return;

      if (!resp.ok) return;
      const data = await resp.json().catch(() => ([] as any));
      const pageMessages = Array.isArray(data)
        ? data
        : (Array.isArray((data as any)?.messages) ? (data as any).messages : []);
      const hasMore = Array.isArray(data)
        ? pageMessages.length >= GROUP_CHAT_PAGE_SIZE
        : Boolean((data as any)?.hasMore);

      const getMsgKey = (msg: any, idx: number) => String(msg?.id ?? `${msg?.sender_email ?? 'u'}:${msg?.created_at ?? ''}:${idx}`);
      const buildSig = (messages: any[]) => {
        const firstId = messages.length ? String((messages[0] as any)?.id ?? '') : '';
        const lastId = messages.length ? String((messages[messages.length - 1] as any)?.id ?? '') : '';
        return `${messages.length}:${firstId}:${lastId}`;
      };

      if (mode === 'older') {
        setGroupHasMoreOlderMessages(hasMore);
        if (pageMessages.length === 0) return;

        pendingGroupPrependAdjustRef.current = {
          previousHeight: groupContentHeightRef.current,
          previousOffset: groupScrollOffsetYRef.current,
        };

        setGroupChatMessages((prev) => {
          const seen = new Set(prev.map((m: any, i: number) => getMsgKey(m, i)));
          const toPrepend = pageMessages.filter((m: any, i: number) => !seen.has(getMsgKey(m, i)));
          if (toPrepend.length === 0) return prev;
          const next = [...toPrepend, ...prev];
          const nextOldest = Number((next[0] as any)?.id);
          groupOldestMessageIdRef.current = Number.isFinite(nextOldest) ? nextOldest : null;
          groupChatLastSigRef.current = buildSig(next);
          return next;
        });
        return;
      }

      if (mode === 'latest') {
        const nextSig = buildSig(pageMessages);
        const nextOldest = Number((pageMessages[0] as any)?.id);
        groupOldestMessageIdRef.current = Number.isFinite(nextOldest) ? nextOldest : null;
        setGroupHasMoreOlderMessages(hasMore);
        if (nextSig !== groupChatLastSigRef.current) {
          groupChatLastSigRef.current = nextSig;
          setGroupChatMessages(pageMessages);
        }
        return;
      }

      // poll: merge latest page into the currently loaded slice without dropping older loaded pages.
      setGroupChatMessages((prev) => {
        if (!prev.length) {
          const nextSig = buildSig(pageMessages);
          groupChatLastSigRef.current = nextSig;
          return pageMessages;
        }

        const byKey = new Map<string, any>();
        prev.forEach((m: any, i: number) => byKey.set(getMsgKey(m, i), m));
        pageMessages.forEach((m: any, i: number) => byKey.set(getMsgKey(m, i), m));

        const merged = Array.from(byKey.values()).sort((a: any, b: any) => {
          const ai = Number(a?.id);
          const bi = Number(b?.id);
          if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
          return String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? ''));
        });

        const nextSig = buildSig(merged);
        if (nextSig === groupChatLastSigRef.current) return prev;
        groupChatLastSigRef.current = nextSig;
        return merged;
      });
    } catch (e) {
      console.error('Error fetching group messages:', e);
    } finally {
      // Hide initial loader (if any) after the first fetch attempt for the selected group.
      if (fetchSeq !== groupChatFetchSeqRef.current) return;
      if (selectedGroupIdRef.current !== groupId) return;
      if (groupChatLoadingGroupIdRef.current === groupId) {
        setGroupChatLoadingGroupId(null);
      }
    }
  };

  const loadOlderGroupMessages = async () => {
    if (isLoadingOlderGroupMessages) return;
    if (!groupHasMoreOlderMessages) return;

    const beforeId = groupOldestMessageIdRef.current;
    if (!beforeId || !Number.isFinite(beforeId)) return;
    if (groupOldestFetchInFlightRef.current === beforeId) return;

    const groupId = selectedGroup?.id;
    if (!groupId) return;

    setIsLoadingOlderGroupMessages(true);
    groupOldestFetchInFlightRef.current = beforeId;
    try {
      await fetchGroupChatMessages(groupId, 'older');
    } finally {
      groupOldestFetchInFlightRef.current = null;
      setIsLoadingOlderGroupMessages(false);
    }
  };

  const fetchGroupLimitedMembersIfOwner = async (groupId: string) => {
    if (!authToken) return;
    if (!userEmail || !selectedGroup?.ownerEmail || userEmail !== selectedGroup.ownerEmail) {
      setGroupLimitedMemberEmails([]);
      return;
    }

    try {
      const resp = await fetch(`${API_URL}/api/groups/${groupId}/limited-members`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        const cleaned = data.map((e: any) => String(e || '').trim()).filter(Boolean);
        setGroupLimitedMemberEmails(cleaned);
      }
    } catch (e) {
      console.error('Error fetching limited members:', e);
    }
  };

  const toggleGroupMessageOptions = (messageIndex: number, memberEmail: string, username: string) => {
    const safeEmail = String(memberEmail || '').trim();
    const safeUsername = String(username || '').trim();
    if (!safeEmail || !safeUsername) return;
    setGroupMessageOptions(prev => {
      if (prev && prev.messageIndex === messageIndex) return null;
      return { messageIndex, memberEmail: safeEmail, username: safeUsername };
    });
  };

  const limitGroupMember = async (memberEmail: string, username: string) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para gestionar el grupo.');
      return;
    }
    if (!selectedGroup?.id) return;

    try {
      const resp = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ memberEmail }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo limitar');
      }

      showActionToast(`Has limitado las interacciones de ${normalizeMentionUsername(username)}`);
      if (selectedGroup?.id) {
        fetchGroupLimitedMembersIfOwner(selectedGroup.id);
        // Limitar no debe eliminar mensajes; refrescar asegura que se mantengan visibles.
        fetchGroupChatMessages(selectedGroup.id, 'poll');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo limitar');
    } finally {
      setGroupMessageOptions(null);
    }
  };

  const unlimitGroupMember = async (memberEmail: string, username: string) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para gestionar el grupo.');
      return;
    }
    if (!selectedGroup?.id) return;

    try {
      const resp = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/unlimit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ memberEmail }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo quitar la limitación');
      }

      if (selectedGroup?.id) {
        fetchGroupLimitedMembersIfOwner(selectedGroup.id);
        fetchGroupChatMessages(selectedGroup.id, 'poll');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo quitar la limitación');
    } finally {
      setGroupMessageOptions(null);
    }
  };

  const performExpelGroupMember = async (
    memberEmail: string,
    username: string,
    shouldBlock: boolean = false,
    reason?: string
  ) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para gestionar el grupo.');
      return;
    }
    if (!selectedGroup?.id) return;

    try {
      const finalReason = shouldBlock
        ? (String(reason ?? '').trim().slice(0, 320) || 'Sin motivo')
        : undefined;

      const resp = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/expel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ memberEmail, ...(shouldBlock ? { block: true, reason: finalReason } : {}) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo expulsar');
      }

      showActionToast(
        shouldBlock
          ? `${normalizeMentionUsername(username)} ha sido expulsado y bloqueado`
          : `${normalizeMentionUsername(username)} ha sido expulsado`
      );

      if (selectedGroup?.id) {
        fetchGroupLimitedMembersIfOwner(selectedGroup.id);
      }

      const safeMemberEmail = String(memberEmail || '').trim();
      if (safeMemberEmail) {
        setGroupChatMessages(prev => prev.filter((m: any) => String(m?.sender_email || '').trim() !== safeMemberEmail));
      }

      const normalizedAt = normalizeMentionUsername(username);
      const normalizedNoAt = normalizedAt.replace(/^@/, '').trim();
      // Host-side channel UI state:
      // - expel: "Aceptada" -> show add icon again
      // - expel+block: show "Bloqueado"
      setSentGroupRequestStatusByTarget(prev => {
        const next: Record<string, 'pending' | 'accepted' | 'blocked'> = { ...prev };
        if (!normalizedAt && !normalizedNoAt) return next;

        if (shouldBlock) {
          if (normalizedAt) next[normalizedAt] = 'blocked';
          if (normalizedNoAt) next[normalizedNoAt] = 'blocked';
        } else {
          if (normalizedAt) delete (next as any)[normalizedAt];
          if (normalizedNoAt) delete (next as any)[normalizedNoAt];
        }
        return next;
      });
      fetchSentGroupRequests().catch(() => { });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo expulsar');
    } finally {
      setGroupMessageOptions(null);
    }
  };

  const expelGroupMember = async (memberEmail: string, username: string, shouldBlock: boolean = false) => {
    if (!authToken) {
      Alert.alert('Sesión requerida', 'Inicia sesión para gestionar el grupo.');
      return;
    }
    if (!selectedGroup?.id) return;

    setPendingExpel({ memberEmail, username, shouldBlock: !!shouldBlock });
    setShowBlockReasonField(false);
    setBlockReasonText('');
    setShowExpelModal(true);
    setGroupMessageOptions(null);
  };

  const fetchChannelMessages = async (
    targetPostId?: string,
    mode: 'latest' | 'poll' | 'older' = 'latest'
  ) => {
    if (!authToken) return;
    const idToFetchRaw = targetPostId || (userPublication ? userPublication.id : null);
    if (!idToFetchRaw) return;

    const idToFetch = String(idToFetchRaw);

    let beforeId: number | null = null;
    if (mode === 'older') {
      beforeId = channelOldestMessageIdRef.current;
      if (!beforeId || !Number.isFinite(beforeId)) return;
    }

    const fetchSeq = ++channelChatFetchSeqRef.current;

    // Track expected chat target (covers both own channel and joined channels).
    currentChannelPostIdRef.current = idToFetch;

    try {
      const params = new URLSearchParams();
      params.set('limit', String(CHANNEL_CHAT_PAGE_SIZE));
      if (mode === 'older' && beforeId) {
        params.set('beforeId', String(beforeId));
      }

      const response = await fetch(`${API_URL}/api/channels/messages/${idToFetch}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // Ignore if a newer fetch started after this one.
      if (fetchSeq !== channelChatFetchSeqRef.current) return;

      // Ignore if the user already switched to a different channel.
      if (currentChannelPostIdRef.current !== idToFetch) return;

      if (response.ok) {
        const data = await response.json().catch(() => ([] as any));
        const pageMessages = Array.isArray(data)
          ? data
          : (Array.isArray((data as any)?.messages) ? (data as any).messages : []);
        const hasMore = Array.isArray(data)
          ? pageMessages.length >= CHANNEL_CHAT_PAGE_SIZE
          : Boolean((data as any)?.hasMore);

        const getMsgKey = (msg: any, idx: number) => String(msg?.id ?? `${msg?.sender_email ?? 'u'}:${msg?.created_at ?? ''}:${idx}`);
        const buildSig = (messages: any[]) => {
          const firstId = messages.length ? String((messages[0] as any)?.id ?? '') : '';
          const lastId = messages.length ? String((messages[messages.length - 1] as any)?.id ?? '') : '';
          return `${messages.length}:${firstId}:${lastId}`;
        };

        if (mode === 'older') {
          setChannelHasMoreOlderMessages(hasMore);
          if (pageMessages.length === 0) return;

          pendingChannelPrependAdjustRef.current = {
            previousHeight: channelContentHeightRef.current,
            previousOffset: channelScrollOffsetYRef.current,
          };

          setChatMessages((prev) => {
            const seen = new Set(prev.map((m: any, i: number) => getMsgKey(m, i)));
            const toPrepend = pageMessages.filter((m: any, i: number) => !seen.has(getMsgKey(m, i)));
            if (toPrepend.length === 0) return prev;
            const next = [...toPrepend, ...prev];
            const nextOldest = Number((next[0] as any)?.id);
            channelOldestMessageIdRef.current = Number.isFinite(nextOldest) ? nextOldest : null;
            channelChatLastSigRef.current = buildSig(next);
            return next;
          });
          return;
        }

        if (mode === 'latest') {
          const nextSig = buildSig(pageMessages);
          const nextOldest = Number((pageMessages[0] as any)?.id);
          channelOldestMessageIdRef.current = Number.isFinite(nextOldest) ? nextOldest : null;
          setChannelHasMoreOlderMessages(hasMore);
          if (nextSig !== channelChatLastSigRef.current) {
            channelChatLastSigRef.current = nextSig;
            setChatMessages(pageMessages);
          }
          return;
        }

        // poll: merge latest page into the currently loaded slice without dropping older loaded pages.
        setChatMessages((prev) => {
          if (!prev.length) {
            const nextSig = buildSig(pageMessages);
            channelChatLastSigRef.current = nextSig;
            return pageMessages;
          }

          const byKey = new Map<string, any>();
          prev.forEach((m: any, i: number) => byKey.set(getMsgKey(m, i), m));
          pageMessages.forEach((m: any, i: number) => byKey.set(getMsgKey(m, i), m));

          const merged = Array.from(byKey.values()).sort((a: any, b: any) => {
            const ai = Number(a?.id);
            const bi = Number(b?.id);
            if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
            return String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? ''));
          });

          const nextSig = buildSig(merged);
          if (nextSig === channelChatLastSigRef.current) return prev;
          channelChatLastSigRef.current = nextSig;
          return merged;
        });
      } else {
        // If we cannot fetch messages (expired/not authorized/etc.), avoid leaving the UI stuck behind a loader.
        console.warn('[ChannelChat] Failed to fetch messages:', response.status);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      // Hide initial loader (if any) after the first fetch attempt for the selected joined channel.
      if (fetchSeq !== channelChatFetchSeqRef.current) return;
      if (currentChannelPostIdRef.current !== idToFetch) return;
      if (channelChatLoadingPostIdRef.current === idToFetch) {
        channelChatLoadingPostIdRef.current = null;
        setChannelChatLoadingPostId(null);
      }

    }
  };

  const loadOlderChannelMessages = async () => {
    if (isLoadingOlderChannelMessages) return;
    if (!channelHasMoreOlderMessages) return;

    const beforeId = channelOldestMessageIdRef.current;
    if (!beforeId || !Number.isFinite(beforeId)) return;
    if (channelOldestFetchInFlightRef.current === beforeId) return;

    const targetPostId = String(
      (selectedChannel as any)?.post_id ??
      (selectedChannel as any)?.postId ??
      (selectedChannel as any)?.id ??
      userPublication?.id ??
      ''
    );
    if (!targetPostId) return;

    setIsLoadingOlderChannelMessages(true);
    channelOldestFetchInFlightRef.current = beforeId;
    try {
      await fetchChannelMessages(targetPostId, 'older');
    } finally {
      channelOldestFetchInFlightRef.current = null;
      setIsLoadingOlderChannelMessages(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchMyChannels();
    }
  }, [authToken]);

  useEffect(() => {
    // Keep host-side request status up to date when viewing "Canal"
    if (activeBottomTab !== 'chat') return;
    if (chatView !== 'channel') return;
    if (selectedChannel) return;

    if (userEmail && channelOwnerEmail && userEmail === channelOwnerEmail) {
      fetchSentGroupRequests();
    }
  }, [activeBottomTab, chatView, selectedChannel, userEmail, channelOwnerEmail, authToken]);

  useEffect(() => {
    if (activeBottomTab === 'chat') {
      if (chatView === 'channel' && channelTab === 'tusCanales') {
        fetchMyChannels();
      } else {
        if (selectedChannel) {
          const selectedPostId = (selectedChannel as any)?.post_id ?? (selectedChannel as any)?.postId ?? (selectedChannel as any)?.id;
          fetchChannelInteractions(selectedPostId);
          fetchChannelMessages(selectedPostId, 'latest');
        } else if (userPublication) {
          fetchChannelInteractions();
          fetchChannelMessages(userPublication.id, 'latest');
        }
      }
    }
  }, [activeBottomTab, chatView, channelTab, userPublication, selectedChannel]);

  useEffect(() => {
    if (authToken) return;
    resetChannelChatPaginationState(true);
    setChannelInteractions([]);
    setShowChannelScrollToLatest(false);
    setIsChannelNearBottom(true);
    resetGroupChatPaginationState(true);
    setShowGroupScrollToLatest(false);
    setIsGroupNearBottom(true);
  }, [authToken]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      resetChannelChatPaginationState(true);
      setShowChannelScrollToLatest(false);
      setIsChannelNearBottom(true);
      resetGroupChatPaginationState(true);
      setShowGroupScrollToLatest(false);
      setIsGroupNearBottom(true);
    });

    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (activeBottomTab === 'chat' && chatView === 'groupChat' && selectedGroup?.id) {
      fetchGroupChatMessages(selectedGroup.id, 'latest');
      fetchGroupLimitedMembersIfOwner(selectedGroup.id);
    }
  }, [activeBottomTab, chatView, selectedGroup?.id, authToken]);

  useEffect(() => {
    // Poll group chat messages so all clients see server-side deletions
    // (e.g., after expel/expel+block) without needing to leave/re-enter.
    const shouldPoll = activeBottomTab === 'chat' && chatView === 'groupChat' && !!authToken && !!selectedGroup?.id;

    if (!shouldPoll) {
      if (groupChatPollingTimerRef.current) {
        clearInterval(groupChatPollingTimerRef.current);
        groupChatPollingTimerRef.current = null;
      }
      return;
    }

    // Ensure only one timer
    if (groupChatPollingTimerRef.current) {
      clearInterval(groupChatPollingTimerRef.current);
      groupChatPollingTimerRef.current = null;
    }

    const groupId = selectedGroup!.id;
    groupChatPollingTimerRef.current = setInterval(() => {
      fetchGroupChatMessages(groupId, 'poll');
    }, 4000);

    return () => {
      if (groupChatPollingTimerRef.current) {
        clearInterval(groupChatPollingTimerRef.current);
        groupChatPollingTimerRef.current = null;
      }
    };
  }, [activeBottomTab, chatView, selectedGroup?.id, authToken]);

  useEffect(() => {
    // Poll channel messages so all clients see new messages/replies and
    // the "turn" state updates without needing to leave/re-enter.
    const postIdToPoll = ((selectedChannel as any)?.post_id ?? (selectedChannel as any)?.postId ?? (selectedChannel as any)?.id) ?? userPublication?.id ?? null;
    const shouldPoll =
      activeBottomTab === 'chat' &&
      chatView === 'channel' &&
      channelTab !== 'tusCanales' &&
      !!authToken &&
      !!postIdToPoll &&
      // If the user is reading history (not near bottom), avoid polling updates that re-render the whole chat.
      isChannelNearBottom;

    if (!shouldPoll) {
      if (channelChatPollingTimerRef.current) {
        clearInterval(channelChatPollingTimerRef.current);
        channelChatPollingTimerRef.current = null;
      }
      return;
    }

    // Ensure only one timer
    if (channelChatPollingTimerRef.current) {
      clearInterval(channelChatPollingTimerRef.current);
      channelChatPollingTimerRef.current = null;
    }

    const postId = String(postIdToPoll);
    channelChatPollingTimerRef.current = setInterval(() => {
      fetchChannelMessages(postId, 'poll');
    }, 4000);

    return () => {
      if (channelChatPollingTimerRef.current) {
        clearInterval(channelChatPollingTimerRef.current);
        channelChatPollingTimerRef.current = null;
      }
    };
  }, [activeBottomTab, chatView, channelTab, (selectedChannel as any)?.post_id, (selectedChannel as any)?.postId, (selectedChannel as any)?.id, userPublication?.id, authToken, isChannelNearBottom]);

  useEffect(() => {
    if (activeBottomTab === 'notifications' && authToken) {
      fetchNotifications();
    }
  }, [activeBottomTab, authToken]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExpelModal, setShowExpelModal] = useState(false);
  const [showLeaveBlockModal, setShowLeaveBlockModal] = useState(false);
  const [showPublicationBlockModal, setShowPublicationBlockModal] = useState(false);
  const [pendingPublicationBlock, setPendingPublicationBlock] = useState<{ email: string; username: string } | null>(null);
  const [publicationBlockReasonText, setPublicationBlockReasonText] = useState('');
  const [isBlockingPublicationUser, setIsBlockingPublicationUser] = useState(false);

  const REPORT_REASON_OPTIONS = [
    { value: 'Contenido sexual o desnudos', labelKey: 'report.reason.sexualContent' as const },
    { value: 'Acoso o bullying', labelKey: 'report.reason.harassment' as const },
    { value: 'Lenguaje ofensivo', labelKey: 'report.reason.offensiveLanguage' as const },
    { value: 'Estafa o engaño', labelKey: 'report.reason.scam' as const },
    { value: 'Violencia o amenazas', labelKey: 'report.reason.violence' as const },
    { value: 'Spam', labelKey: 'report.reason.spam' as const },
    { value: 'Suplantación de identidad', labelKey: 'report.reason.impersonation' as const },
    { value: 'Contenido ilegal', labelKey: 'report.reason.illegalContent' as const },
    { value: 'Abuso/sexualización infantil', labelKey: 'report.reason.childSexualAbuse' as const },
    { value: 'Incitación al uso de armas/drogas', labelKey: 'report.reason.weaponsOrDrugsIncitement' as const },
    { value: 'Conducta inapropiada', labelKey: 'report.reason.inappropriateConduct' as const },
    { value: 'Otros', labelKey: 'report.reason.other' as const },
  ] as const;

  type ReportReasonValue = (typeof REPORT_REASON_OPTIONS)[number]['value'];

  const [showPublicationReportModal, setShowPublicationReportModal] = useState(false);
  const [pendingPublicationReport, setPendingPublicationReport] = useState<{
    postId: string;
    email: string;
    username: string;
  } | null>(null);
  const [publicationReportReason, setPublicationReportReason] = useState<ReportReasonValue | null>(null);
  const [isReportingPublicationUser, setIsReportingPublicationUser] = useState(false);
  const [pendingLeaveBlockGroup, setPendingLeaveBlockGroup] = useState<{ id: string; hashtag: string } | null>(null);
  const [leaveBlockReasonText, setLeaveBlockReasonText] = useState('');
  const [isLeavingAndBlocking, setIsLeavingAndBlocking] = useState(false);
  const [pendingExpel, setPendingExpel] = useState<{ memberEmail: string; username: string; shouldBlock: boolean } | null>(null);
  const [showBlockReasonField, setShowBlockReasonField] = useState(false);
  const [blockReasonText, setBlockReasonText] = useState('');

  const openPublicationBlockModal = (pub: Publication) => {
    const targetEmail = String(pub?.user?.email || '').trim();
    if (!targetEmail) return;

    setActivePublicationOptionsId(null);
    setPendingPublicationBlock({
      email: targetEmail,
      username: formatUsernameWithAt(pub?.user?.username || 'usuario'),
    });
    setPublicationBlockReasonText('');
    setShowPublicationBlockModal(true);
  };

  const openPublicationReportModal = (pub: Publication) => {
    const targetEmail = String(pub?.user?.email || '').trim();
    if (!targetEmail) return;

    setActivePublicationOptionsId(null);
    setPendingPublicationReport({
      postId: String(pub?.id || ''),
      email: targetEmail,
      username: formatUsernameWithAt(pub?.user?.username || 'usuario'),
    });
    setPublicationReportReason(null);
    setShowPublicationReportModal(true);
  };

  const getJoinedChannelKey = useCallback((channel: any, fallbackIndex?: number) => {
    return String(
      channel?.post_id ??
      channel?.postId ??
      channel?.id ??
      `${channel?.publisher_email ?? channel?.publisherEmail ?? 'unknown'}-${channel?.post_created_at ?? fallbackIndex ?? ''}`
    );
  }, []);

  const getJoinedChannelPostId = useCallback((channel: any) => {
    return String(channel?.post_id ?? channel?.postId ?? channel?.id ?? '').trim();
  }, []);

  const getJoinedChannelPublisherEmail = useCallback((channel: any) => {
    return String(channel?.publisher_email ?? channel?.publisherEmail ?? '').trim();
  }, []);

  const leaveJoinedChannel = useCallback(async (channel: any) => {
    if (!authToken) {
      Alert.alert(t('auth.sessionRequiredTitle' as TranslationKey), t('auth.signInToBlockUsers' as TranslationKey));
      return;
    }

    const postId = getJoinedChannelPostId(channel);
    if (!postId) return;

    setActiveJoinedChannelOptionsKey(null);
    const channelKey = getJoinedChannelKey(channel);

    // Optimistic UI: remove from list immediately.
    setMyChannels(prev => prev.filter(c => getJoinedChannelKey(c) !== channelKey));

    try {
      const resp = await fetch(`${API_URL}/api/channels/leave/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const contentType = resp.headers.get('content-type') || '';
      const body: any = contentType.includes('application/json')
        ? await resp.json().catch(() => null)
        : { text: await resp.text().catch(() => '') };

      // Treat the "not subscribed" case as success (idempotent leave).
      const isNotSubscribed = resp.status === 404 && String(body?.error || '').includes('No estabas suscrito');

      if (!resp.ok && !isNotSubscribed) {
        const message =
          body?.error ||
          body?.message ||
          (typeof body?.text === 'string' && body.text.trim()) ||
          'No se pudo salir del canal';
        throw new Error(message);
      }

      // Re-sync so Home can immediately show the chat icon again.
      fetchMyChannels();
    } catch (e: any) {
      console.error('Error leaving joined channel:', e);
      // Re-sync list if leaving failed.
      fetchMyChannels();
      Alert.alert('Error', e?.message || 'No se pudo salir del canal');
    }
  }, [authToken, fetchMyChannels, getJoinedChannelKey, getJoinedChannelPostId, t]);

  const leaveAndBlockJoinedChannel = useCallback(async (channel: any) => {
    if (!authToken) {
      Alert.alert(t('auth.sessionRequiredTitle' as TranslationKey), t('auth.signInToBlockUsers' as TranslationKey));
      return;
    }

    const publisherEmail = getJoinedChannelPublisherEmail(channel);
    if (!publisherEmail) return;

    setActiveJoinedChannelOptionsKey(null);

    try {
      const blockResp = await fetch(`${API_URL}/api/group-requests/block`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: publisherEmail }),
      });

      if (!blockResp.ok) {
        const err = await blockResp.json().catch(() => ({}));
        throw new Error(err?.error || t('errors.unableToBlockUser' as TranslationKey));
      }

      // After blocking, the backend won't return this channel anymore.
      await leaveJoinedChannel(channel);
    } catch (e: any) {
      console.error('Error leaving+blocking joined channel:', e);
      Alert.alert('Error', e?.message || t('errors.unableToBlockUser' as TranslationKey));
      fetchMyChannels();
    }
  }, [authToken, fetchMyChannels, getJoinedChannelPublisherEmail, leaveJoinedChannel, t]);

  const reportJoinedChannel = useCallback((channel: any) => {
    const publisherEmail = getJoinedChannelPublisherEmail(channel);
    if (!publisherEmail) return;

    const postId = getJoinedChannelPostId(channel);
    if (!postId) return;

    setActiveJoinedChannelOptionsKey(null);
    openPublicationReportModal({
      id: postId,
      user: {
        email: publisherEmail,
        username: String(channel?.username || 'usuario'),
      },
    } as any);
  }, [getJoinedChannelPostId, getJoinedChannelPublisherEmail, openPublicationReportModal]);

  const [activeIntimidadIndices, setActiveIntimidadIndices] = useState<Record<string, number>>({});
  const [intimidadesVisible, setIntimidadesVisible] = useState<Record<string, boolean>>({});
  const [homeIntimidadesUnlockSigs, setHomeIntimidadesUnlockSigs] = useState<Record<string, 1>>({});
  const homeIntimidadesSigByPubIdRef = useRef<Record<string, string>>({});
  const [activePresentationIndices, setActivePresentationIndices] = useState<Record<string, number>>({});
  const [presentationOverlayVisible, setPresentationOverlayVisible] = useState<Record<string, boolean>>({});
  const [expandedProfileTexts, setExpandedProfileTexts] = useState<Record<string, boolean>>({});

  // Load persisted unlocks for the current user (so the Keitin panel stays open after restart).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const AsyncStorage = getAsyncStorageSafe();
      if (!AsyncStorage) {
        if (!cancelled) setHomeIntimidadesUnlockSigs({});
        return;
      }

      try {
        const key = makeHomeIntimidadesUnlockStorageKey(userEmail);
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;

        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object') {
          setHomeIntimidadesUnlockSigs(parsed as Record<string, 1>);
        } else {
          setHomeIntimidadesUnlockSigs({});
        }
      } catch {
        if (!cancelled) setHomeIntimidadesUnlockSigs({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  // When a rewarded ad is earned for a publication, persist its unlock signature.
  useEffect(() => {
    if (!pendingHomeIntimidadesUnlockPubId) return;

    const pubIdStr = String(pendingHomeIntimidadesUnlockPubId || '').trim();
    if (!pubIdStr) {
      setPendingHomeIntimidadesUnlockPubId(null);
      return;
    }

    const pub = publications.find(p => String(p?.id) === pubIdStr);
    const sig = pub ? makeHomeIntimidadesUnlockSig(pub.id, pub.createdAt) : '';
    if (!sig) {
      setPendingHomeIntimidadesUnlockPubId(null);
      return;
    }

    setHomeIntimidadesUnlockSigs(prev => {
      if (prev[sig] === 1) return prev;
      const next = { ...prev, [sig]: 1 as const };

      const AsyncStorage = getAsyncStorageSafe();
      if (AsyncStorage) {
        const key = makeHomeIntimidadesUnlockStorageKey(userEmail);
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => { });
      }

      return next;
    });

    setPendingHomeIntimidadesUnlockPubId(null);
  }, [pendingHomeIntimidadesUnlockPubId, publications, userEmail]);

  // Sync persisted unlocks into runtime visibility state.
  // Also reset visibility if the same publication id is republished with a new createdAt.
  useEffect(() => {
    if (!publications.length) return;

    const presentIds = new Set(publications.map(p => String(p?.id ?? '')));
    const sigById = homeIntimidadesSigByPubIdRef.current;
    Object.keys(sigById).forEach((id) => {
      if (!presentIds.has(id)) delete sigById[id];
    });

    setIntimidadesVisible(prev => {
      let changed = false;
      const next = { ...prev };

      for (const pub of publications) {
        const id = String(pub?.id ?? '').trim();
        if (!id) continue;

        const sig = makeHomeIntimidadesUnlockSig(pub.id, pub.createdAt);
        const prevSig = sigById[id];

        if (sig) {
          if (prevSig && prevSig !== sig) {
            // Republished (or changed) -> reset to locked.
            if (next[id]) {
              next[id] = false;
              changed = true;
            }
          }
          sigById[id] = sig;
        }

        const unlocked = !!sig && homeIntimidadesUnlockSigs[sig] === 1;
        if (unlocked && !next[id]) {
          next[id] = true;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [publications, homeIntimidadesUnlockSigs]);

  // Home: show/hide profile rings overlay per publication (default: hidden)
  const [homeProfileRingsVisibleByPostId, setHomeProfileRingsVisibleByPostId] = useState<Record<string, boolean>>({});

  // Home: track carousel layout per publication+image index so rings can be placed correctly.
  const [homePresentationImageLayouts, setHomePresentationImageLayouts] = useState<Record<string, Record<number, { width: number; height: number }>>>({});

  const setHomePresentationImageLayout = useCallback((pubId: string | number, imageIndex: number, width: number, height: number) => {
    const key = String(pubId || '');
    if (!key) return;
    const idx = Number(imageIndex);
    if (!Number.isFinite(idx) || idx < 0) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

    setHomePresentationImageLayouts(prev => {
      const current = prev[key] || {};
      const existing = current[idx];
      if (existing && existing.width === width && existing.height === height) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          [idx]: { width, height },
        },
      };
    });
  }, []);

  const toggleHomeProfileRingsVisible = useCallback((postId: string) => {
    const key = String(postId || '');
    if (!key) return;
    setHomeProfileRingsVisibleByPostId(prev => {
      const isVisible = prev[key] === true;
      return { ...prev, [key]: !isVisible };
    });
  }, []);

  // Home: track which carousel images have finished loading per publication.
  // This lets us show a loader overlay until all images are ready.
  const [homePresentationImagesLoaded, setHomePresentationImagesLoaded] = useState<Record<string, Record<number, boolean>>>({});
  const homePresentationPrefetchSigRef = useRef<string>('');
  const homePresentationActiveIndexRef = useRef<Record<string, number>>({});
  const [homeCarouselMountKeysByPubId, setHomeCarouselMountKeysByPubId] = useState<Record<string, number>>({});
  const homeCarouselRepaintAfterLoadSigByPubIdRef = useRef<Record<string, string>>({});

  const markHomePresentationImageLoaded = useCallback((pubId: string | number, imageIndex: number) => {
    const key = String(pubId || '');
    if (!key) return;
    const idx = Number(imageIndex);
    if (!Number.isFinite(idx) || idx < 0) return;

    setHomePresentationImagesLoaded(prev => {
      const current = prev[key] || {};
      if (current[idx]) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          [idx]: true,
        },
      };
    });
  }, []);

  const updateHomePresentationActiveIndexFromScroll = useCallback((
    pubId: string | number,
    contentOffsetX: number,
    layoutWidth: number,
    imagesCount: number
  ) => {
    const key = String(pubId || '');
    if (!key) return;
    const total = Math.max(0, Number(imagesCount) || 0);
    if (total <= 1) {
      homePresentationActiveIndexRef.current[key] = 0;
      if ((activePresentationIndices[key] || 0) !== 0) {
        setActivePresentationIndices(prev => ({ ...prev, [key]: 0 }));
      }
      return;
    }

    const w = Math.max(1, Number(layoutWidth) || (SCREEN_WIDTH - 4));
    const x = Math.max(0, Number(contentOffsetX) || 0);
    const nextIndex = Math.max(0, Math.min(total - 1, Math.floor((x + w / 2) / w)));

    const prevIndex = homePresentationActiveIndexRef.current[key];
    if (prevIndex === nextIndex) return;
    homePresentationActiveIndexRef.current[key] = nextIndex;

    setActivePresentationIndices(prev => {
      const current = prev[key] ?? 0;
      if (current === nextIndex) return prev;
      return { ...prev, [key]: nextIndex };
    });
  }, [activePresentationIndices]);

  const markProfilePresentationImageLoaded = useCallback((imageIndex: number) => {
    const idx = Number(imageIndex);
    if (!Number.isFinite(idx) || idx < 0) return;
    setProfilePresentationImagesLoaded(prev => {
      if (prev[idx]) return prev;
      return { ...prev, [idx]: true };
    });
  }, []);

  const profilePresentationLoadedCount = useMemo(() => {
    const total = profilePresentation?.images?.length ?? 0;
    if (total <= 0) return 0;
    let count = 0;
    for (let i = 0; i < total; i += 1) {
      if (profilePresentationImagesLoaded[i]) count += 1;
    }
    return count;
  }, [profilePresentation?.images, profilePresentationImagesLoaded]);

  useEffect(() => {
    const isInProfileMainView = activeBottomTab === 'profile' && profileView === 'profile';

    if (isInProfileMainView && !wasInProfileMainViewRef.current) {
      setProfileViewMountKey(prev => prev + 1);
    }

    wasInProfileMainViewRef.current = isInProfileMainView;
  }, [activeBottomTab, profileView]);

  useEffect(() => {
    const isInProfileCarousel =
      activeBottomTab === 'profile' &&
      profileView === 'profile' &&
      !!profilePresentation?.images?.length;

    if (isInProfileCarousel && !wasInProfileCarouselRef.current) {
      setProfileCarouselMountKey(prev => prev + 1);
      setProfileCarouselImageLayouts({});
    }

    wasInProfileCarouselRef.current = isInProfileCarousel;
  }, [activeBottomTab, profileView, profilePresentation?.images?.length]);

  useEffect(() => {
    if (activeBottomTab !== 'profile') return;
    if (profileView !== 'profile') return;
    if (!profilePresentation?.images || profilePresentation.images.length === 0) return;

    const uris = profilePresentation.images
      .map(img => getServerResourceUrl(String((img as any)?.uri || '').trim()))
      .filter(Boolean);

    const sig = uris.join('|');
    if (profilePresentationPrefetchSigRef.current === sig) return;
    profilePresentationPrefetchSigRef.current = sig;
    profileCarouselRepaintAfterLoadSigRef.current = '';

    // Reset loading map when the carousel images change.
    setProfilePresentationImagesLoaded({});

    // Prefetch to make the first swipe feel instant.
    // If a URI isn't http(s), mark it loaded so the overlay can finish.
    uris.forEach((uri, idx) => {
      if (!/^https?:\/\//i.test(uri)) {
        markProfilePresentationImageLoaded(idx);
        return;
      }

      try {
        Image.prefetch(uri)
          .then(() => markProfilePresentationImageLoaded(idx))
          .catch(() => markProfilePresentationImageLoaded(idx));
      } catch {
        markProfilePresentationImageLoaded(idx);
      }
    });
  }, [activeBottomTab, profileView, profilePresentation, markProfilePresentationImageLoaded]);

  useEffect(() => {
    if (activeBottomTab !== 'profile') return;
    if (profileView !== 'profile') return;
    if (!profilePresentation?.images || profilePresentation.images.length === 0) return;

    const total = profilePresentation.images.length;
    if (profilePresentationLoadedCount < total) return;

    const sig = `${profilePresentation.images.map((img: any) => String(img?.uri || '')).join('|')}::${total}`;
    if (profileCarouselRepaintAfterLoadSigRef.current === sig) return;
    profileCarouselRepaintAfterLoadSigRef.current = sig;

    requestAnimationFrame(() => {
      setProfileCarouselMountKey(prev => prev + 1);
      setProfileCarouselImageLayouts({});
    });
  }, [activeBottomTab, profileView, profilePresentation, profilePresentationLoadedCount]);

  useEffect(() => {
    if (activeBottomTab !== 'home') return;

    const pub = publications?.[currentPostIndex];
    if (!pub || !pub.presentation?.images || pub.presentation.images.length === 0) return;

    const pubId = String(pub.id || '');
    if (!pubId) return;

    const uris = pub.presentation.images
      .map(img => getServerResourceUrl(String(img?.uri || '')))
      .filter(u => /^https?:\/\//i.test(u));

    if (uris.length === 0) return;

    const sig = `${pubId}:${uris.join('|')}`;
    if (homePresentationPrefetchSigRef.current === sig) return;
    homePresentationPrefetchSigRef.current = sig;

    // Prefetch all images so the carousel doesn't feel "stuck" on the first render.
    // If prefetch fails, mark as loaded anyway to avoid an infinite spinner.
    uris.forEach((uri, idx) => {
      try {
        Image.prefetch(uri)
          .then(() => markHomePresentationImageLoaded(pubId, idx))
          .catch(() => markHomePresentationImageLoaded(pubId, idx));
      } catch {
        markHomePresentationImageLoaded(pubId, idx);
      }
    });
  }, [activeBottomTab, currentPostIndex, publications, markHomePresentationImageLoaded]);

  useEffect(() => {
    if (activeBottomTab !== 'home') return;

    const pub = publications?.[currentPostIndex];
    if (!pub || !pub.presentation?.images || pub.presentation.images.length === 0) return;

    const pubId = String(pub.id || '');
    if (!pubId) return;

    const total = pub.presentation.images.length;
    const loadedMap = homePresentationImagesLoaded[pubId] || {};
    let loadedCount = 0;
    for (let i = 0; i < total; i += 1) {
      if (loadedMap[i]) loadedCount += 1;
    }
    if (loadedCount < total) return;

    const sig = `${pub.presentation.images.map((img: any) => String(img?.uri || '')).join('|')}::${total}`;
    if (homeCarouselRepaintAfterLoadSigByPubIdRef.current[pubId] === sig) return;
    homeCarouselRepaintAfterLoadSigByPubIdRef.current[pubId] = sig;

    requestAnimationFrame(() => {
      setHomeCarouselMountKeysByPubId(prev => ({
        ...prev,
        [pubId]: (prev[pubId] || 0) + 1,
      }));
    });
  }, [activeBottomTab, currentPostIndex, publications, homePresentationImagesLoaded]);

  const publicationAnimations = useRef<Record<string, { scale: Animated.Value, opacity: Animated.Value }>>({});
  const publicationLastTaps = useRef<Record<string, number>>({});
  const homeRingTapSuppressUntilRef = useRef<Record<string, number>>({});
  const [publicationDoubleTapState, setPublicationDoubleTapState] = useState<Record<string, { visible: boolean, emoji: string }>>({});


  const applyPublicationReaction = (
    pubId: string,
    reactions: { selected: string[], counts: Record<string, number>, userReaction: string | null },
    nextEmoji: string
  ) => {
    if (!nextEmoji) return;
    if (!reactions.selected.includes(nextEmoji)) return;
    if (reactions.userReaction === nextEmoji) return;

    setPublications(prev => prev.map(p => {
      if (p.id === pubId) {
        const newCounts = { ...p.reactions.counts };
        if (p.reactions.userReaction && newCounts[p.reactions.userReaction] > 0) {
          newCounts[p.reactions.userReaction] -= 1;
        }
        newCounts[nextEmoji] = (newCounts[nextEmoji] || 0) + 1;
        return {
          ...p,
          reactions: {
            ...p.reactions,
            counts: newCounts,
            userReaction: nextEmoji
          }
        };
      }
      return p;
    }));

    // Persistir reacción en el servidor
    if (authToken) {
      fetch(`${API_URL}/api/posts/${pubId}/react`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          emoji: nextEmoji,
          previousEmoji: reactions.userReaction
        })
      }).catch(err => console.error('Error updating reaction', err));
    }

    if (!publicationAnimations.current[pubId]) {
      publicationAnimations.current[pubId] = {
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0)
      };
    }

    const anims = publicationAnimations.current[pubId];

    setPublicationDoubleTapState(prev => ({
      ...prev,
      [pubId]: { visible: true, emoji: nextEmoji }
    }));

    anims.scale.setValue(0);
    anims.opacity.setValue(1);

    Animated.sequence([
      Animated.spring(anims.scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.timing(anims.opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPublicationDoubleTapState(prev => ({
        ...prev,
        [pubId]: { ...prev[pubId], visible: false }
      }));
    });
  };


  const handlePublicationDoubleTap = (pubId: string, reactions: { selected: string[], counts: Record<string, number>, userReaction: string | null }) => {
    const now = Date.now();

    const suppressUntil = homeRingTapSuppressUntilRef.current[String(pubId)] || 0;
    if (now < suppressUntil) {
      publicationLastTaps.current[pubId] = now;
      return;
    }

    const DOUBLE_PRESS_DELAY = 300;
    const lastTap = publicationLastTaps.current[pubId] || 0;

    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      if (reactions.selected.length > 0) {
        let nextEmoji = '';

        if (reactions.selected.length === 1) {
          nextEmoji = reactions.selected[0];
          if (reactions.userReaction === nextEmoji) {
            publicationLastTaps.current[pubId] = now;
            return;
          }
        } else {
          const available = reactions.selected.filter(e => e !== reactions.userReaction);
          if (available.length > 0) {
            const randomIndex = Math.floor(Math.random() * available.length);
            nextEmoji = available[randomIndex];
          } else {
            nextEmoji = reactions.selected[0];
          }
        }

        applyPublicationReaction(pubId, reactions, nextEmoji);
      }
    }

    publicationLastTaps.current[pubId] = now;
  };

  const handlePublish = async () => {
    if (intimidades.length === 0) {
      return;
    }

    if (!profilePresentation) {
      Alert.alert("Error", "Primero debes crear tu presentación.");
      return;
    }

    const createdProfileRings: ProfileRingPoint[] = (profileRingPoints || [])
      .filter(r => r?.isCreated)
      .slice(0, 5)
      .map(r => ({
        id: String(r.id),
        imageIndex: Number(r.imageIndex),
        x: Number(r.x),
        y: Number(r.y),
        color: String(r.color || '#FFFFFF'),
        colorSelected: Boolean(r.colorSelected),
        name: String(r.name || ''),
        description: String(r.description || ''),
        linkNetwork: r.linkNetwork ? String(r.linkNetwork) : null,
        linkUrl: String(r.linkUrl || ''),
        locationLabel: String(r.locationLabel || ''),
        locationUrl: String(r.locationUrl || ''),
        locationPlaceId: r.locationPlaceId ? String(r.locationPlaceId) : null,
        locationLat: r.locationLat == null ? null : Number(r.locationLat),
        locationLng: r.locationLng == null ? null : Number(r.locationLng),
        isCreated: true,
      }));

    const presentationToPublish: PresentationContent = {
      ...profilePresentation,
      profileRings: createdProfileRings,
    };

    const tempId = Date.now().toString();
    const newPublication: Publication = {
      id: tempId,
      user: {
        username: username || 'Usuario',
        email: userEmail,
        profilePhotoUri: profilePhotoUri,
        nationality: nationality,
        socialNetworks: linkedSocialNetworks.map(sn => ({ id: sn.network, link: sn.link })),
      },
      presentation: presentationToPublish,
      reactions: {
        selected: [...selectedReactions],
        counts: { ...reactionCounts },
        userReaction: null,
      },
      intimidades: [...intimidades],
      createdAt: new Date(),
    };

    setMyPublication(newPublication);
    setActiveBottomTab('home');

    if (authToken) {
      try {
        const response = await fetch(`${API_URL}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            presentation: presentationToPublish,
            intimidades: intimidades,
            reactions: {
              selected: selectedReactions,
              counts: reactionCounts,
              userReaction: null
            }
          })
        });

        if (response.ok) {
          const savedPost = await response.json();
          setMyPublication(prev => prev && prev.id === tempId ? { ...prev, id: savedPost.id } : prev);
          showBottomToast(t('toast.published'));
        } else {
          console.error('Error saving post:', await response.text());
          Alert.alert("Error", "Hubo un problema al guardar tu publicación en el servidor.");
        }
      } catch (error) {
        console.error('Error saving post:', error);
        Alert.alert("Error", "Hubo un problema de conexión al guardar tu publicación.");
      }
    } else {
      showBottomToast(t('toast.published'));
    }
  };

  const handleDeletePublication = () => {
    setShowDeleteModal(true);
  };

  const confirmDeletePublication = async (source: 'manual' | 'expire' = 'manual') => {
    const postToDelete = myPublication;
    setMyPublication(undefined);

    if (source === 'manual') {
      // Manual delete: keep the previous behavior
      setChatMessages([]);
      setChannelInteractions([]);
      setShowDeleteModal(false);
      setActiveBottomTab('profile');
    } else {
      // Auto-expire: keep automatic cleanup behavior (chat + notifications)
      setChatMessages([]);
      setChannelInteractions([]);
      setActiveBottomTab('profile');
      setShowDeleteModal(false);

      // Remove any pending join-request notifications locally and refresh from server.
      setNotifications(prev => prev.filter(n => !(n.type === 'group_join_request' && n.status === 'pending')));
      if (authToken) {
        fetchNotifications().catch(() => { });
        fetchSentGroupRequests().catch(() => { });
      }
    }

    // Expire/delete: the publication is no longer active
    showBottomToast(t('toast.publicationNotActiveHome'));

    // Importante: no enviar DELETE al servidor cuando expira automáticamente.
    // La expiración (24h) se controla por tiempo, pero el post debe quedar guardado
    // para verificación/métricas. Solo se elimina en servidor cuando el usuario lo borra manualmente.
    if (source === 'manual' && postToDelete && authToken) {
      try {
        const response = await fetch(`${API_URL}/api/posts/${postToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) return;

        // If server already removed it (e.g., background cleanup), treat as success.
        if (response.status === 404) return;

        if (source === 'manual') {
          console.error('Error deleting post:', await response.text());
          Alert.alert("Advertencia", "Se elimin f3 localmente pero hubo un error en el servidor.");
        } else {
          // Avoid noisy errors on auto-expire; local state is already updated.
          console.warn('Auto-expire delete failed:', await response.text());
        }
      } catch (error) {
        console.error('Error deleting post:', error);
        Alert.alert("Advertencia", "Se elimin f3 localmente pero hubo un error de conexi f3n.");
      }
    } else {
      // Avisos deshabilitados a petición: no mostrar mensaje.
    }
  };
  const [selectedReactions, setSelectedReactions] = useState<string[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [currentUserReaction, setCurrentUserReaction] = useState<string | null>(null);

  const [showDoubleTapAnimation, setShowDoubleTapAnimation] = useState(false);
  const [doubleTapEmoji, setDoubleTapEmoji] = useState('');
  const doubleTapScale = useRef(new Animated.Value(0)).current;
  const doubleTapOpacity = useRef(new Animated.Value(0)).current;

  // Estados para el segundo contenedor (Quiz)
  const [quizImageUri, setQuizImageUri] = useState<string | null>(null);
  const [isUploadingQuizImage, setIsUploadingQuizImage] = useState(false);
  const [showQuizTextInput, setShowQuizTextInput] = useState(false);
  const [quizTextInputValue, setQuizTextInputValue] = useState('');
  const [quizAppliedText, setQuizAppliedText] = useState('');
  const [showQuizImageEditor, setShowQuizImageEditor] = useState(false);
  const [editingQuizImageUri, setEditingQuizImageUri] = useState<string | null>(null);
  const [tempQuizImage, setTempQuizImage] = useState<CarouselImageData | null>(null);

  // Estados para el tercer contenedor (Survey)
  const [surveyImageUri, setSurveyImageUri] = useState<string | null>(null);
  const [isUploadingSurveyImage, setIsUploadingSurveyImage] = useState(false);
  const [showSurveyTextInput, setShowSurveyTextInput] = useState(false);
  const [surveyTextInputValue, setSurveyTextInputValue] = useState('');
  const [surveyAppliedText, setSurveyAppliedText] = useState('');
  const [showSurveyImageEditor, setShowSurveyImageEditor] = useState(false);
  const [editingSurveyImageUri, setEditingSurveyImageUri] = useState<string | null>(null);
  const [tempSurveyImage, setTempSurveyImage] = useState<CarouselImageData | null>(null);

  // Estados para imagen de Intimidades
  const [intimidadesImageUri, setIntimidadesImageUri] = useState<string | null>(null);
  const [isUploadingIntimidadesImage, setIsUploadingIntimidadesImage] = useState(false);
  const [showIntimidadesImageEditor, setShowIntimidadesImageEditor] = useState(false);
  const [editingIntimidadesImageUri, setEditingIntimidadesImageUri] = useState<string | null>(null);
  const [tempIntimidadesImage, setTempIntimidadesImage] = useState<CarouselImageData | null>(null);

  const handleAddSurveyOption = () => {
    if (surveyOptions.length < 6) {
      setSurveyOptions([...surveyOptions, '']);
    }
  };

  const handleUpdateSurveyOption = (text: string, index: number) => {
    const newOptions = [...surveyOptions];
    newOptions[index] = text;
    setSurveyOptions(newOptions);
  };

  const handleRemoveSurveyOption = (index: number) => {
    if (surveyOptions.length > 2) {
      const newOptions = surveyOptions.filter((_, i) => i !== index);
      setSurveyOptions(newOptions);
    }
  };

  const toggleReactionPanel = () => {
    if (showReactionPanel) {
      // Hide
      Animated.timing(reactionPanelAnimation, {
        toValue: 400,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowReactionPanel(false);
        if (activeBottomTab === 'profile' && profileView === 'profile') {
          setProfileViewMountKey(prev => prev + 1);
          setProfileCarouselMountKey(prev => prev + 1);
          setProfileCarouselImageLayouts({});
        }
      });
    } else {
      // Show
      setShowReactionPanel(true);
      Animated.timing(reactionPanelAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleReactionSelect = (emoji: string) => {
    if (selectedReactions.includes(emoji)) {
      setSelectedReactions(selectedReactions.filter(e => e !== emoji));
    } else {
      if (selectedReactions.length < 3) {
        setSelectedReactions([...selectedReactions, emoji]);
        if (reactionCounts[emoji] === undefined) {
          setReactionCounts(prev => ({ ...prev, [emoji]: 0 }));
        }
      }
    }
  };

  const lastTap = useRef<number>(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      if (selectedReactions.length > 0) {
        let nextEmoji = '';

        if (selectedReactions.length === 1) {
          nextEmoji = selectedReactions[0];
          if (currentUserReaction === nextEmoji) {
            lastTap.current = now;
            return;
          }
        } else {
          const available = selectedReactions.filter(e => e !== currentUserReaction);
          if (available.length > 0) {
            const randomIndex = Math.floor(Math.random() * available.length);
            nextEmoji = available[randomIndex];
          } else {
            nextEmoji = selectedReactions[0];
          }
        }

        setReactionCounts(prev => {
          const newCounts = { ...prev };
          if (currentUserReaction && newCounts[currentUserReaction] > 0) {
            newCounts[currentUserReaction] -= 1;
          }
          newCounts[nextEmoji] = (newCounts[nextEmoji] || 0) + 1;
          return newCounts;
        });

        setCurrentUserReaction(nextEmoji);

        // Trigger Animation
        setDoubleTapEmoji(nextEmoji);
        setShowDoubleTapAnimation(true);
        doubleTapScale.setValue(0);
        doubleTapOpacity.setValue(1);

        Animated.sequence([
          Animated.spring(doubleTapScale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.delay(500),
          Animated.timing(doubleTapOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowDoubleTapAnimation(false);
        });
      }
    }
    lastTap.current = now;
  };

  const handleReactionPress = (emoji: string) => {
    if (currentUserReaction === emoji) {
      return;
    }

    setReactionCounts(prev => {
      const newCounts = { ...prev };
      if (currentUserReaction && newCounts[currentUserReaction] > 0) {
        newCounts[currentUserReaction] -= 1;
      }
      newCounts[emoji] = (newCounts[emoji] || 0) + 1;
      return newCounts;
    });
    setCurrentUserReaction(emoji);
  };

  const hasPresentationImage = carouselImages.length > 0;
  const titleReady = presentationTitle.trim().length >= 1;
  const textReady = presentationText.trim().length >= 1;
  const hasUploadingCarouselImages = carouselImages.some(img => img.isUploading);
  // Con sesión, exigimos URLs remotas antes de permitir aplicar (si no, se guardaría una ruta local).
  const hasOnlyRemoteCarouselImages = !authToken || carouselImages.every(img => String(img.uri || '').startsWith('http'));
  const canApplyPresentation = hasPresentationImage && titleReady && textReady && !hasUploadingCarouselImages && hasOnlyRemoteCarouselImages;

  const SOCIAL_ICONS = {
    facebook: require('../../assets/images/facebook.png'),
    instagram: require('../../assets/images/instagram.png'),
    onlyfans: require('../../assets/images/onlyfans.png'),
    pinterest: require('../../assets/images/pinterest.png'),
    telegram: require('../../assets/images/telegram.png'),
    tiktok: require('../../assets/images/tiktok.png'),
    twitter: require('../../assets/images/x_twitter.png'),
    youtube: require('../../assets/images/youtube.png'),
    discord: require('../../assets/images/discord.png'),
    threads: require('../../assets/images/threads.png'),
    linkedin: require('../../assets/images/linkedin.png'),
    kick: require('../../assets/images/kick.png'),
    twitch: require('../../assets/images/twitch.png'),
  };

  const [showSocialPanel, setShowSocialPanel] = useState(false);
  const [socialPanelAnimation] = useState(new Animated.Value(-SOCIAL_PANEL_HEIGHT));
  const [selectedSocialNetwork, setSelectedSocialNetwork] = useState<string | null>(null);
  const [socialLink, setSocialLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkedSocialNetworks, setLinkedSocialNetworks] = useState<Array<{ network: string; link: string }>>(
    (initialSocialNetworks || []).map(sn => ({ network: sn.id, link: sn.link }))
  );
  const [showLinkedSocials, setShowLinkedSocials] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showLinkedSocials) {
      timer = setTimeout(() => {
        setShowLinkedSocials(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showLinkedSocials]);

  useEffect(() => {
    if (initialSocialNetworks) {
      setLinkedSocialNetworks(initialSocialNetworks.map(sn => ({ network: sn.id, link: sn.link })));
    }
  }, [initialSocialNetworks]);

  const fetchHomePosts = async (opts?: { preservePosition?: boolean; showLoader?: boolean }) => {
    const shouldShowLoader = opts?.showLoader ?? publications.length === 0;

    if (shouldShowLoader) {
      homeLoaderStartedAtRef.current = Date.now();
      setIsHomePostsLoading(true);
    }

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_URL}/api/posts`, { headers });

      if (!response.ok) {
        console.error('Error fetching posts:', response.status);
        return;
      }

      const data = (await response.json()) as Publication[];

      if (userEmail) {
        const myPost = data.find((p: Publication) => p.user.email === userEmail);
        setMyPublication(myPost);
        if (myPost) {
          setProfilePresentation(myPost.presentation);
          setIntimidades(normalizeIntimidadesMedia(myPost.intimidades));
          setSelectedReactions(myPost.reactions.selected);
          setReactionCounts(myPost.reactions.counts);
        }
      }

      const filteredData: Publication[] = userEmail ? data.filter((p) => p.user.email !== userEmail) : data;

      if (opts?.preservePosition && publications.length > 0) {
        const currentId = publications[currentPostIndex]?.id;
        const byId = new Map(filteredData.map(p => [String(p.id), p] as const));

        const kept = publications
          .map(p => byId.get(String(p.id)))
          .filter(Boolean) as Publication[];

        const existingIds = new Set(kept.map(p => String(p.id)));
        const appended = filteredData.filter(p => !existingIds.has(String(p.id)));
        const nextList = [...kept, ...appended];
        setPublications(nextList);

        if (currentId != null) {
          const nextIndex = nextList.findIndex(p => String(p.id) === String(currentId));
          setCurrentPostIndex(nextIndex >= 0 ? nextIndex : 0);
        } else {
          setCurrentPostIndex(0);
        }
        return;
      }

      const shuffled = shuffleArray(filteredData);
      setPublications(shuffled);
      setCurrentPostIndex(0);
      seenPublicationIdsRef.current = new Set(shuffled[0]?.id != null ? [String(shuffled[0].id)] : []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setHasHomePostsLoadedOnce(true);
      if (shouldShowLoader) {
        const elapsed = Date.now() - (homeLoaderStartedAtRef.current || Date.now());
        const remaining = HOME_LOADER_MIN_MS - elapsed;
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        setIsHomePostsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!authToken) return;
    setHasHomePostsLoadedOnce(false);
    fetchHomePosts({ showLoader: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]); // Re-fetch when authToken changes

  useEffect(() => {
    // When returning to the Home tab, refresh the feed.
    if (!homeTabDidMountRef.current) {
      homeTabDidMountRef.current = true;
      return;
    }

    if (activeBottomTab !== 'home') return;
    if (!authToken) return;

    fetchHomePosts({ preservePosition: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBottomTab]);

  useEffect(() => {
    const shouldAnimate = isHomePostsLoading || !hasHomePostsLoadedOnce;

    if (!shouldAnimate) {
      if (homeLoaderRotateLoopRef.current) {
        homeLoaderRotateLoopRef.current.stop();
        homeLoaderRotateLoopRef.current = null;
      }
      homeLoaderPulseAnim.setValue(0);
      homeLoaderRotateAnim.setValue(0);
      return;
    }

    // Animación visible durante la carga:
    // - Mantener el avatar estable (sin bombeo)
    // - Aro con rotación continua (sin parpadeo)
    homeLoaderPulseAnim.setValue(0);
    homeLoaderRotateAnim.setValue(0);

    const rotateLoop = Animated.loop(
      Animated.timing(homeLoaderRotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    homeLoaderRotateLoopRef.current = rotateLoop;
    rotateLoop.start();

    return () => {
      rotateLoop.stop();
      if (homeLoaderRotateLoopRef.current === rotateLoop) {
        homeLoaderRotateLoopRef.current = null;
      }
    };
  }, [homeLoaderPulseAnim, homeLoaderRotateAnim, hasHomePostsLoadedOnce, isHomePostsLoading]);

  useEffect(() => {
    if (activeBottomTab === 'profile' && profileView === 'profile' && !profilePresentation && hasSeenYourProfileHint === false) {
      profileEmptyArrowAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(profileEmptyArrowAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(profileEmptyArrowAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      profileEmptyArrowLoopRef.current = loop;
      loop.start();
      return () => {
        loop.stop();
        profileEmptyArrowLoopRef.current = null;
      };
    } else {
      if (profileEmptyArrowLoopRef.current) {
        profileEmptyArrowLoopRef.current.stop();
        profileEmptyArrowLoopRef.current = null;
      }
      profileEmptyArrowAnim.setValue(0);
    }
  }, [activeBottomTab, profileView, profilePresentation, profileEmptyArrowAnim, hasSeenYourProfileHint]);

  useEffect(() => {
    // Poll Home feed to reflect creator blocks without requiring app restart.
    const shouldPoll = activeBottomTab === 'home' && !!authToken;

    if (!shouldPoll) {
      if (homePostsPollingTimerRef.current) {
        clearInterval(homePostsPollingTimerRef.current);
        homePostsPollingTimerRef.current = null;
      }
      return;
    }

    if (homePostsPollingTimerRef.current) {
      clearInterval(homePostsPollingTimerRef.current);
      homePostsPollingTimerRef.current = null;
    }

    homePostsPollingTimerRef.current = setInterval(() => {
      fetchHomePosts({ preservePosition: true, showLoader: false });
    }, 6000);

    return () => {
      if (homePostsPollingTimerRef.current) {
        clearInterval(homePostsPollingTimerRef.current);
        homePostsPollingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBottomTab, authToken, currentPostIndex, publications]);

  // Cargar perfil editado (borrador) al iniciar
  useEffect(() => {
    const fetchEditProfile = async () => {
      if (authToken) {
        try {
          const response = await fetch(`${API_URL}/api/edit-profile`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.presentation && Object.keys(data.presentation).length > 0) {
              setProfilePresentation(data.presentation);
            }
            if (data.intimidades && data.intimidades.length > 0) {
              setIntimidades(normalizeIntimidadesMedia(data.intimidades));
            }
            if (data.reactions) {
              setSelectedReactions(data.reactions.selected || []);
              setReactionCounts(data.reactions.counts || {});
              setCurrentUserReaction(data.reactions.userReaction || null);
            }
          }
        } catch (error) {
          console.error('Error fetching edit profile:', error);
        }
      }
    };

    fetchEditProfile();
  }, [authToken]);

  // Función para guardar el perfil editado en el servidor
  const saveEditProfile = async (
    newPresentation: PresentationContent | null,
    newIntimidades: Intimidad[],
    newReactions?: { selected: string[], counts: Record<string, number>, userReaction: string | null }
  ) => {
    if (authToken) {
      const reactionsToSave = newReactions || {
        selected: selectedReactions,
        counts: reactionCounts,
        userReaction: currentUserReaction
      };

      try {
        const resp = await fetch(`${API_URL}/api/edit-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            presentation: newPresentation || {},
            intimidades: newIntimidades,
            reactions: reactionsToSave
          })
        });
        return resp;
      } catch (error) {
        console.error('Error saving edit profile:', error);
        return null;
      }
    }

    return null;
  };

  const getIntimidadDraftImageUrls = (item: Intimidad | null | undefined): string[] => {
    if (!item) return [];

    const urls: string[] = [];

    if (item.type === 'image') {
      const u = String((item as any).content || '').trim();
      if (u) urls.push(u);
    }

    const quizUri = (item as any)?.quizData?.imageUri;
    if (quizUri) {
      const u = String(quizUri).trim();
      if (u) urls.push(u);
    }

    const surveyUri = (item as any)?.surveyData?.imageUri;
    if (surveyUri) {
      const u = String(surveyUri).trim();
      if (u) urls.push(u);
    }

    return urls;
  };

  const collectDraftImageUrlsFromIntimidades = (items: Intimidad[]): Set<string> => {
    const set = new Set<string>();
    for (const it of (items || [])) {
      for (const url of getIntimidadDraftImageUrls(it)) {
        set.add(url);
      }
    }
    return set;
  };

  const getPresentationDraftImageUrls = (presentation: PresentationContent | null | undefined): string[] => {
    if (!presentation) return [];
    const imgs = (presentation as any)?.images;
    if (!Array.isArray(imgs)) return [];
    return imgs
      .map((img: any) => String(img?.uri || '').trim())
      .filter((u: string) => !!u);
  };

  const validateSocialLink = (platform: string, link: string): boolean => {
    if (!link.trim()) return true; // Allow empty

    const validators: Record<string, RegExp> = {
      facebook: /^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i,
      instagram: /^https?:\/\/(www\.)?instagram\.com\/.+/i,
      onlyfans: /^https?:\/\/(www\.)?onlyfans\.com\/.+/i,
      pinterest: /^https?:\/\/(www\.)?(pinterest\.(com|es)|pin\.it)\/.+/i,
      telegram: /^(https?:\/\/)?(t\.me|telegram\.me)\/.+/i,
      // Accept common TikTok URL shapes:
      // - https://www.tiktok.com/@user
      // - https://www.tiktok.com/@user/video/123
      // - https://tiktok.com/t/...
      // - https://vm.tiktok.com/...
      // - https://vt.tiktok.com/...
      tiktok: /^(https?:\/\/)?((www|m|vm|vt)\.)?tiktok\.com\/.+/i,
      twitter: /^https?:\/\/(www\.)?(twitter|x)\.com\/.+/i,
      youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
      discord: /^https?:\/\/(www\.)?(discord\.(com|gg)|discordapp\.com)\/.+/i,
      threads: /^https?:\/\/(www\.)?threads\.(net|com)\/@.+/i,
      linkedin: /^https?:\/\/(?:[\w-]+\.)*linkedin\.com\/.+/i,
      kick: /^https?:\/\/(www\.)?kick\.com\/.+/i,
      twitch: /^https?:\/\/((www|m)\.)?twitch\.tv\/.+/i,
    };

    return validators[platform]?.test(link.trim()) ?? false;
  };

  const toggleSocialPanel = () => {
    const toValue = showSocialPanel ? -SOCIAL_PANEL_HEIGHT : 0;
    Animated.timing(socialPanelAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowSocialPanel(!showSocialPanel);
  };

  const handleSelectSocialNetwork = (network: string) => {
    const newSelection = selectedSocialNetwork === network ? null : network;
    setSelectedSocialNetwork(newSelection);
    // Clear link and error when switching platforms
    setSocialLink('');
    setLinkError('');
  };

  const handleSocialLinkChange = (text: string) => {
    setSocialLink(text);

    if (selectedSocialNetwork && text.trim()) {
      const isValid = validateSocialLink(selectedSocialNetwork, text);
      if (!isValid) {
        const platformNames: Record<string, string> = {
          facebook: 'Facebook',
          instagram: 'Instagram',
          onlyfans: 'OnlyFans',
          pinterest: 'Pinterest',
          telegram: 'Telegram',
          tiktok: 'TikTok',
          twitter: 'X/Twitter',
          youtube: 'YouTube',
          discord: 'Discord',
          threads: 'Threads',
          linkedin: 'LinkedIn',
          kick: 'Kick',
          twitch: 'Twitch',
        };
        setLinkError(`${t('front.linkMustBeFrom' as TranslationKey)} ${platformNames[selectedSocialNetwork]}`);
      } else {
        setLinkError('');
      }
    } else {
      setLinkError('');
    }
  };

  const handleLinkSocialNetwork = async () => {
    if (selectedSocialNetwork && socialLink && !linkError) {
      const newSocialNetworks = linkedSocialNetworks.filter(item => item.network !== selectedSocialNetwork);
      const updatedList = [...newSocialNetworks, { network: selectedSocialNetwork, link: socialLink }];

      setLinkedSocialNetworks(updatedList);
      const networksForBackend = updatedList.map(n => ({ id: n.network, link: n.link }));
      setSocialNetworks(networksForBackend);
      onSocialNetworksChange?.(networksForBackend);

      if (authToken) {
        try {
          await updateSocialNetworks({
            token: authToken,
            socialNetworks: networksForBackend
          });
          console.log('✅ Redes sociales actualizadas en servidor');
        } catch (error) {
          console.error('❌ Error al actualizar redes sociales:', error);
          Alert.alert('Error', 'No se pudieron guardar los cambios en el servidor.');
        }
      }

      toggleSocialPanel();
      handleSelectSocialNetwork(selectedSocialNetwork); // This toggles it off
    }
  };

  const handleUnlinkSocialNetwork = async (network: string) => {
    const updatedList = linkedSocialNetworks.filter(item => item.network !== network);
    setLinkedSocialNetworks(updatedList);

    const networksForBackend = updatedList.map(n => ({ id: n.network, link: n.link }));
    setSocialNetworks(networksForBackend);
    onSocialNetworksChange?.(networksForBackend);

    if (authToken) {
      try {
        await updateSocialNetworks({
          token: authToken,
          socialNetworks: networksForBackend
        });
        console.log('✅ Redes sociales actualizadas en servidor (desvinculación)');
      } catch (error) {
        console.error('❌ Error al actualizar redes sociales:', error);
      }
    }

    if (selectedSocialNetwork === network) {
      handleSelectSocialNetwork(network); // Deselect if currently selected
    }
  };

  const createCarouselImageData = (
    uri: string,
    aspectRatio: CarouselAspectRatio = '3:4',
  ): CarouselImageData => ({
    clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    uri,
    cropData: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scale: 1,
    },
    aspectRatio,
  });

  const withClientId = (img: CarouselImageData): CarouselImageData => {
    if (img.clientId) return img;
    return { ...img, clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}` };
  };

  const carouselViewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 });

  const handleCarouselViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!viewableItems?.length) {
        return;
      }
      const nextIndex = viewableItems[0]?.index ?? 0;
      if (typeof nextIndex === 'number') {
        setActiveCarouselImageIndex(nextIndex);
      }
    },
  );

  const handleProfileViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!viewableItems?.length) {
        return;
      }
      const nextIndex = viewableItems[0]?.index ?? 0;
      if (typeof nextIndex === 'number') {
        setActiveProfileImageIndex(nextIndex);
      }
    },
  );

  useEffect(() => {
    setProfilePhotoUri(initialProfilePhotoUri);
  }, [initialProfilePhotoUri]);

  useEffect(() => {
    if (carouselImages.length === 0 && activeCarouselImageIndex !== 0) {
      setActiveCarouselImageIndex(0);
    } else if (
      carouselImages.length > 0 &&
      activeCarouselImageIndex >= carouselImages.length
    ) {
      setActiveCarouselImageIndex(carouselImages.length - 1);
    }
  }, [activeCarouselImageIndex, carouselImages.length]);

  useEffect(() => {
    setIsProfileTextExpanded(false);
  }, [profilePresentation?.title, profilePresentation?.text]);

  const isEditingExistingCarouselImage = editingCarouselImageIndex !== null;
  const totalImagesToEdit = Math.max(pendingCarouselImages.length, 1);

  const currentTotalImages = isEditingExistingCarouselImage
    ? carouselImages.length + Math.max(0, pendingCarouselImages.length - 1)
    : carouselImages.length + pendingCarouselImages.length;

  const currentImagePosition = isEditingExistingCarouselImage && pendingCarouselImages.length <= 1 ? 0 : currentEditingImageIndex;
  const editorThumbnails = pendingCarouselImages.length > 0
    ? pendingCarouselImages.map((uri, idx) => editedCarouselImages[idx]?.uri ?? uri)
    : editingCarouselImageUri
      ? [
        // Si estamos editando una imagen existente, mostramos esa y las que se añadan
        ...(editingCarouselImageIndex !== null && carouselImages[editingCarouselImageIndex]
          ? [editedCarouselImages[0]?.uri ?? carouselImages[editingCarouselImageIndex].uri]
          : [editedCarouselImages[0]?.uri ?? editingCarouselImageUri]),
        // Añadir las imágenes adicionales que se hayan seleccionado en este flujo
        ...pendingCarouselImages.slice(1).map((uri, idx) => editedCarouselImages[idx + 1]?.uri ?? uri)
      ]
      : [];

  const requestGalleryPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // En Android 13+ (API 33+) usar READ_MEDIA_IMAGES
        const permission = Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        // Estado persistente (backend) para decidir si Keinti debe volver a pedir permiso.
        // Importante: NO cacheamos esto indefinidamente porque puede cambiar desde Configuración.
        let appGranted = false;
        if (authToken) {
          try {
            const perms = await getMyDevicePermissions(authToken);
            appGranted = perms.galleryPermissionGranted === true;
          } catch {
            // Si no podemos leer backend, hacemos un fallback conservador: tratamos como NO concedido
            // para evitar reactivar el permiso sin confirmación.
            appGranted = false;
          }
        } else {
          // Sin sesión, usamos solo el permiso del sistema.
          appGranted = true;
        }

        // Primero verificar si ya tiene el permiso
        const checkResult = await PermissionsAndroid.check(permission);

        // Si el sistema lo tiene y Keinti también lo considera concedido, no pedir otra vez.
        if (checkResult && appGranted) {
          if (authToken) {
            // Mantener backend sincronizado por si venimos de una instalación previa.
            setMyDevicePermissions(authToken, { galleryPermissionGranted: true }).catch(() => {});
          }
          return true;
        }

        // Si Keinti está en "No concedido" (aunque el sistema lo tenga), pedimos confirmación al usuario
        // antes de reactivar el permiso a nivel app/backend.
        if (!appGranted && authToken) {
          const ok = await askToReEnableGalleryPermission();
          if (!ok) {
            return false;
          }

          // Si el sistema ya tiene el permiso, basta con reactivar en backend.
          if (checkResult) {
            setMyDevicePermissions(authToken, { galleryPermissionGranted: true }).catch(() => {});
            return true;
          }
        }

        // Si Keinti está en "No concedido" (aunque el sistema lo tenga) o si el sistema no lo tiene,
        // volvemos a desplegar la solicitud de permisos.
        const granted = await PermissionsAndroid.request(
          permission,
          {
            title: t('devicePermissions.osRequestTitle'),
            message: t('devicePermissions.osRequestMessage'),
            buttonNeutral: t('devicePermissions.osRequestAskLater'),
            buttonNegative: t('devicePermissions.osRequestDeny'),
            buttonPositive: t('devicePermissions.osRequestAllow'),
          },
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          if (authToken) {
            setMyDevicePermissions(authToken, { galleryPermissionGranted: true }).catch(() => {});
          }
          return true;
        } else {
          // Permiso denegado, abrir configuración directamente
          await Linking.openSettings();
          if (authToken) {
            setMyDevicePermissions(authToken, { galleryPermissionGranted: false }).catch(() => {});
          }
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const openSidePanel = () => {
    setShowSidePanel(true);
    Animated.timing(sidePanelAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const triggerProfileAvatarPulseAndOpenSidePanel = () => {
    setIsProfileAvatarPulsing(true);

    if (profileAvatarOpenTimeoutRef.current) {
      clearTimeout(profileAvatarOpenTimeoutRef.current);
      profileAvatarOpenTimeoutRef.current = null;
    }

    profileAvatarPulseAnim.stopAnimation();
    profileAvatarPulseAnim.setValue(0);

    // Ensure the panel opens reliably even if the animation is interrupted.
    profileAvatarOpenTimeoutRef.current = setTimeout(() => {
      openSidePanel();
      profileAvatarOpenTimeoutRef.current = null;
    }, 90);

    Animated.timing(profileAvatarPulseAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      Animated.timing(profileAvatarPulseAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setIsProfileAvatarPulsing(false);
      });
    });
  };

  const closeSidePanel = () => {
    Animated.timing(sidePanelAnimation, {
      toValue: -SCREEN_WIDTH * 0.6,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowSidePanel(false);
    });
  };

  const handleSelectProfilePhoto = async () => {
    closeSidePanel();

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      // Seleccionar imagen sin cropping
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.9,
        includeBase64: false,
        writeTempFile: true, // Asegurar que se escribe en archivo temporal
      });

      if (image && image.path) {
        console.log('Imagen seleccionada:', image.path);
        // Usar la ruta tal como viene del picker
        const imagePath = image.path;
        setSelectedImageUri(imagePath);
        setShowPhotoEditor(true);
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen:', error);
        Alert.alert(
          'Error',
          'No se pudo seleccionar la imagen. Intenta de nuevo.',
        );
      }
    }
  };

  const handleSaveProfilePhoto = async (croppedImage: CroppedProfileImage) => {
    try {
      // 1. Actualizar visualmente de inmediato (optimistic update)
      setProfilePhotoUri(croppedImage.uri);

      // Cerrar el editor
      setShowPhotoEditor(false);
      setSelectedImageUri(null);

      // 2. Subir al servidor si tenemos token
      if (authToken) {
        try {
          const response = await updateProfilePhoto({
            token: authToken,
            photoUri: croppedImage.uri
          });

          if (response && response.profile_photo_uri) {
            console.log('✅ Foto actualizada en servidor:', response.profile_photo_uri);
            // Actualizar con la URL real del servidor para persistencia futura
            // Nota: getServerResourceUrl se encargará de añadir el dominio si es necesario
            setProfilePhotoUri(response.profile_photo_uri);
            onProfilePhotoUriChange?.(response.profile_photo_uri);
          }
        } catch (uploadError) {
          console.error('❌ Error al subir foto:', uploadError);
          Alert.alert('Advertencia', 'La foto se guardó localmente pero hubo un error al subirla al servidor.');
        }
      } else {
        console.log('⚠️ No hay token de autenticación, solo se guarda localmente');
      }

    } catch (error) {
      console.error('Error al guardar foto de perfil:', error);
      Alert.alert(
        'Error',
        'No se pudo guardar la foto de perfil. Intenta de nuevo.',
      );
    }
  };

  const handleCancelPhotoEdit = () => {
    setShowPhotoEditor(false);
    setSelectedImageUri(null);
    // Limpiar archivos temporales
    ImageCropPicker.clean().catch(() => undefined);
  };

  const startCarouselBatchEditing = (imagePaths: string[]) => {
    if (imagePaths.length === 0) {
      return;
    }

    setPendingCarouselImages(imagePaths);
    setEditingCarouselImageIndex(null);
    setCurrentEditingImageIndex(0);
    setEditedCarouselImages({});
    setEditingCarouselImageUri(imagePaths[0]);
    setShowCarouselImageEditor(true);
  };

  const handleSelectCarouselImages = async () => {
    const remainingSlots = 3 - carouselImages.length;

    if (remainingSlots <= 0) {
      Alert.alert(
        'Límite alcanzado',
        'Ya has añadido el máximo de 3 imágenes al carrusel.',
      );
      return;
    }

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      // Seleccionar múltiples imágenes
      const images = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        multiple: true,
        maxFiles: remainingSlots,
        // Reduce peso para que la confirmación (subida) sea rápida.
        // Sin esto, si el usuario no recorta, se sube el original (p.ej. 12MP/HEIC) y tarda mucho.
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1080,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (images && images.length > 0) {
        const imagePaths = images.map(img => img.path);
        startCarouselBatchEditing(imagePaths);
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imágenes:', error);
        Alert.alert(
          'Error',
          'No se pudo seleccionar las imágenes. Intenta de nuevo.',
        );
      }
    }
  };

  const handleAddMoreImages = async () => {
    // Calcular cuántas imágenes ya tenemos (confirmadas + pendientes en esta sesión de edición)
    // Si estamos editando una existente, cuenta como 1.
    // Si estamos en batch inicial, pendingCarouselImages tiene todas.

    let currentCount = 0;
    if (editingCarouselImageIndex !== null) {
      // Editando existente: cuenta las que ya están en el carrusel (menos la que se edita, que se mantiene) + las pendientes nuevas
      currentCount = carouselImages.length + Math.max(0, pendingCarouselImages.length - 1);
    } else {
      // Creando nuevas: pendingCarouselImages tiene todas
      currentCount = carouselImages.length + pendingCarouselImages.length;
    }

    const remainingSlots = 3 - currentCount;

    if (remainingSlots <= 0) {
      Alert.alert(
        'Límite alcanzado',
        'Ya has añadido el máximo de 3 imágenes.',
      );
      return;
    }

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const isMultiple = remainingSlots > 1;
      const result = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        multiple: isMultiple,
        maxFiles: isMultiple ? remainingSlots : undefined,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1080,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (result) {
        // Normalizar resultado a array
        const images = Array.isArray(result) ? result : [result];

        if (images.length > 0) {
          const newPaths = images.map(img => img.path);

          // Añadir a pendingCarouselImages
          // Si estamos editando una existente, pendingCarouselImages[0] es la original (o su reemplazo),
          // así que añadimos al final.
          setPendingCarouselImages(prev => [...prev, ...newPaths]);
        }
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al añadir más imágenes:', error);
        Alert.alert('Error', 'No se pudo añadir las imágenes.');
      }
    }
  };

  const handleTempCarouselEdit = (index: number, croppedImage: CroppedProfileImage) => {
    if (index < 0) {
      return;
    }

    const updatedImage: CarouselImageData = {
      uri: croppedImage.uri,
      cropData: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scale: 1,
      },
      aspectRatio: croppedImage.aspectRatio ?? '3:4',
    };

    setEditedCarouselImages(prev => ({
      ...prev,
      [index]: updatedImage,
    }));

    setEditingCarouselImageUri(updatedImage.uri);
  };

  const resetCarouselEditorState = () => {
    setShowCarouselImageEditor(false);
    setEditingCarouselImageUri(null);
    setEditingCarouselImageIndex(null);
    setPendingCarouselImages([]);
    setCurrentEditingImageIndex(0);
    setEditedCarouselImages({});
  };

  const handleConfirmCarouselEdits = async () => {
    if (pendingCarouselImages.length === 0 && editingCarouselImageIndex === null) {
      resetCarouselEditorState();
      return;
    }

    // 1) Actualizar UI inmediatamente (sin esperar subidas)
    // 2) Subir en segundo plano y reemplazar URIs locales por URLs
    try {
      const shouldUpload = !!authToken;
      const needsUpload = (uri: string) => !!(shouldUpload && uri && !uri.startsWith('http'));

      const queueUploads = async (items: CarouselImageData[]) => {
        if (!authToken) return;
        for (const item of items) {
          if (!item.clientId) continue;
          if (!item.isUploading) continue;
          try {
            const url = await uploadImage(item.uri, authToken);
            setCarouselImages(prev => prev.map(img => {
              if (img.clientId !== item.clientId) return img;
              return { ...img, uri: url, isUploading: false };
            }));
          } catch (e) {
            console.error('Failed to upload carousel image', e);
            setCarouselImages(prev => prev.map(img => {
              if (img.clientId !== item.clientId) return img;
              return { ...img, isUploading: false };
            }));
          }
        }
      };

      if (editingCarouselImageIndex !== null) {
        const fallbackExisting = carouselImages[editingCarouselImageIndex];
        const editedMain = editedCarouselImages[0] ?? fallbackExisting;
        if (!editedMain?.uri) {
          resetCarouselEditorState();
          ImageCropPicker.clean().catch(() => undefined);
          return;
        }

        const mainWithId = withClientId({
          ...editedMain,
          isUploading: needsUpload(editedMain.uri),
        });

        const updatedImages = [...carouselImages];
        updatedImages[editingCarouselImageIndex] = mainWithId;

        const newImages = pendingCarouselImages.length > 1
          ? pendingCarouselImages.slice(1)
            .map((uri, idx) => editedCarouselImages[idx + 1] ?? createCarouselImageData(uri))
            .filter(img => img && img.uri)
          : [];

        const newWithIds = newImages.map(img => withClientId({
          ...img,
          isUploading: needsUpload(img.uri),
        }));

        setCarouselImages([...updatedImages, ...newWithIds]);

        // cerrar editor ya
        resetCarouselEditorState();
        ImageCropPicker.clean().catch(() => undefined);

        // subir en background
        void queueUploads([mainWithId, ...newWithIds]);
        return;
      }

      if (pendingCarouselImages.length > 0) {
        const orderedImages = pendingCarouselImages
          .map((uri, idx) => editedCarouselImages[idx] ?? createCarouselImageData(uri))
          .filter(img => img && img.uri)
          .map(img => withClientId({
            ...img,
            isUploading: needsUpload(img.uri),
          }));

        if (orderedImages.length > 0) {
          setCarouselImages(prev => [...prev, ...orderedImages]);
        }

        resetCarouselEditorState();
        ImageCropPicker.clean().catch(() => undefined);

        void queueUploads(orderedImages);
        return;
      }
    } catch (error) {
      console.error('Error confirming carousel edits:', error);
      resetCarouselEditorState();
      ImageCropPicker.clean().catch(() => undefined);
    }
  };

  const handleCancelCarouselEdit = () => {
    resetCarouselEditorState();
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleEditCarouselImage = (index: number) => {
    const image = carouselImages[index];
    setPendingCarouselImages([image.uri]); // Inicializamos con la imagen actual
    setEditingCarouselImageIndex(index);
    setEditedCarouselImages({ 0: image });
    setCurrentEditingImageIndex(0);
    setEditingCarouselImageUri(image.uri);
    setShowCarouselImageEditor(true);
  };

  const handleSelectPendingImageForEditing = (index: number) => {
    if (index < 0 || index >= pendingCarouselImages.length) {
      return;
    }
    const existingEdit = editedCarouselImages[index];
    const nextUri = existingEdit?.uri ?? pendingCarouselImages[index];
    setCurrentEditingImageIndex(index);
    setEditingCarouselImageUri(nextUri);
  };



  const handleRemoveCarouselImage = (index: number) => {
    setPendingDeleteCarouselImageIndex(index);
    setShowDeleteCarouselImageModal(true);
  };

  const confirmDeleteCarouselImage = () => {
    const index = pendingDeleteCarouselImageIndex;
    if (index === null) {
      setShowDeleteCarouselImageModal(false);
      return;
    }

    const newImages = carouselImages.filter((_, i) => i !== index);
    setCarouselImages(newImages);

    const nextActiveIndex = (() => {
      if (newImages.length === 0) return 0;
      if (index < activeCarouselImageIndex) return Math.max(0, activeCarouselImageIndex - 1);
      if (activeCarouselImageIndex >= newImages.length) return newImages.length - 1;
      return activeCarouselImageIndex;
    })();
    setActiveCarouselImageIndex(nextActiveIndex);

    setPendingDeleteCarouselImageIndex(null);
    setShowDeleteCarouselImageModal(false);
  };

  const handleDeleteIntimidad = (index: number) => {
    setPendingDeleteIntimidadIndex(index);
    setShowDeleteContentModal(true);
  };

  const confirmDeleteIntimidad = async () => {
    const index = pendingDeleteIntimidadIndex;
    if (index === null) {
      setShowDeleteContentModal(false);
      return;
    }

    const removed = intimidades[index] || null;

    const newIntimidades = intimidades.filter((_, i) => i !== index);
    setIntimidades(newIntimidades);

    // Keep active index in range (and stable when deleting items before it)
    const nextActiveIndex = (() => {
      if (newIntimidades.length === 0) return 0;
      if (index < activeIntimidadIndex) return Math.max(0, activeIntimidadIndex - 1);
      if (activeIntimidadIndex >= newIntimidades.length) return newIntimidades.length - 1;
      return activeIntimidadIndex;
    })();
    setActiveIntimidadIndex(nextActiveIndex);

    await saveEditProfile(profilePresentation, newIntimidades);

    // Best-effort cleanup of orphaned draft images in Supabase/Postgres.
    // Only delete URLs that are no longer referenced after the update.
    if (authToken && removed) {
      const remainingUrls = collectDraftImageUrlsFromIntimidades(newIntimidades);
      const removedUrls = getIntimidadDraftImageUrls(removed).filter(u => !remainingUrls.has(u));

      for (const url of removedUrls) {
        deleteDraftUploadedImageByUrl(url, authToken).catch(() => undefined);
      }
    }

    setPendingDeleteIntimidadIndex(null);
    setShowDeleteContentModal(false);
  };

  const confirmDeleteGroup = async () => {
    if (!pendingDeleteGroup) {
      setShowDeleteGroupModal(false);
      return;
    }

    if (!authToken) {
      setShowDeleteGroupModal(false);
      setPendingDeleteGroup(null);
      Alert.alert('Sesión requerida', 'Inicia sesión para eliminar un grupo.');
      return;
    }

    if (isDeletingGroup) return;
    setIsDeletingGroup(true);
    try {
      const resp = await fetch(`${API_URL}/api/groups/${pendingDeleteGroup.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al eliminar grupo');
      }

      setMyGroups(currentGroups => currentGroups.filter(g => g.id !== pendingDeleteGroup.id));
      setShowDeleteGroupModal(false);
      setPendingDeleteGroup(null);
    } catch (e: any) {
      console.error('Error deleting group:', e);
      Alert.alert('Error', e?.message || 'No se pudo eliminar el grupo');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const resetPresentationComposer = () => {
    setCarouselImages([]);
    setPresentationTitle('');
    setPresentationText('');
    setActiveCarouselImageIndex(0);
    setSelectedCategory('Sin categoría');
  };

  const handleApplyPresentation = async () => {
    if (!canApplyPresentation) {
      return;
    }

    const previousPresentation = profilePresentation;

    const payload: PresentationContent = {
      images: carouselImages.map(image => ({
        uri: image.uri,
        cropData: image.cropData,
        aspectRatio: image.aspectRatio,
      })),
      title: presentationTitle.trim(),
      text: presentationText.trim(),
      category: selectedCategory,
      // Preserve profile rings so the POST /api/edit-profile payload doesn't lose them.
      ...(profilePresentation?.profileRings ? { profileRings: profilePresentation.profileRings } : {}),
    };

    setProfilePresentation(payload);

    const resp = await saveEditProfile(payload, intimidades);

    // Best-effort cleanup: when a user replaces the presentation, old draft uploads can become orphaned.
    // Delete only images that were in the previous presentation and are no longer referenced after save.
    if (authToken && resp?.ok && previousPresentation) {
      const prevUrls = getPresentationDraftImageUrls(previousPresentation);
      const stillReferenced = new Set<string>([
        ...getPresentationDraftImageUrls(payload),
        ...Array.from(collectDraftImageUrlsFromIntimidades(intimidades)),
      ]);

      const toDelete = prevUrls.filter(u => !stillReferenced.has(u));
      for (const url of toDelete) {
        deleteDraftUploadedImageByUrl(url, authToken).catch(() => undefined);
      }
    }

    resetPresentationComposer();
    setProfileView('profile');
    setActiveBottomTab('profile');
  };

  const handleRemoveImageFromEditor = (index: number) => {
    if (pendingCarouselImages.length > 0) {
      // Escenario A: Edición por lotes (nuevas imágenes)
      const newPending = [...pendingCarouselImages];
      newPending.splice(index, 1);

      // Si no quedan imágenes, cerramos el editor
      if (newPending.length === 0) {
        resetCarouselEditorState();
        return;
      }

      // Actualizar editedCarouselImages: desplazar índices
      const newEdited: Record<number, CarouselImageData> = {};
      Object.keys(editedCarouselImages).forEach(key => {
        const keyNum = parseInt(key, 10);
        if (keyNum < index) {
          newEdited[keyNum] = editedCarouselImages[keyNum];
        } else if (keyNum > index) {
          newEdited[keyNum - 1] = editedCarouselImages[keyNum];
        }
        // Si keyNum === index, se elimina (no se copia)
      });

      setPendingCarouselImages(newPending);
      setEditedCarouselImages(newEdited);

      // Ajustar índice actual si es necesario
      if (currentEditingImageIndex >= newPending.length) {
        const nextIndex = Math.max(0, newPending.length - 1);
        setCurrentEditingImageIndex(nextIndex);
        setEditingCarouselImageUri(newEdited[nextIndex]?.uri ?? newPending[nextIndex]);
      } else if (currentEditingImageIndex === index) {
        // Si borramos la que estábamos viendo, actualizamos la URI
        setEditingCarouselImageUri(newEdited[currentEditingImageIndex]?.uri ?? newPending[currentEditingImageIndex]);
      }
    } else if (editingCarouselImageIndex !== null) {
      // Escenario B: Edición de imagen existente única
      // En este caso, index debería ser 0 porque solo hay una en el editor
      handleRemoveCarouselImage(editingCarouselImageIndex);
      resetCarouselEditorState();
    }
  };

  const handleEditSurveyOption = (index: number) => {
    // Lógica para editar una opción de encuesta existente
  };

  const handleSelectQuizImage = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1080,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image && image.path) {
        setEditingQuizImageUri(image.path);
        setTempQuizImage({
          uri: image.path,
          cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
          aspectRatio: '3:4'
        });
        setShowQuizImageEditor(true);
        // Si seleccionamos imagen, limpiamos el modo texto si estaba activo
        setShowQuizTextInput(false);
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen para quiz:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen.');
      }
    }
  };

  const handleCancelQuizEdit = () => {
    setShowQuizImageEditor(false);
    setEditingQuizImageUri(null);
    setTempQuizImage(null);
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleTempQuizEdit = (index: number, croppedImage: CroppedProfileImage) => {
    setTempQuizImage({
      uri: croppedImage.uri,
      cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
      aspectRatio: '3:4'
    });
  };

  const handleApplyQuizImage = async () => {
    let uriToUse = null;
    if (tempQuizImage) {
      uriToUse = tempQuizImage.uri;
    } else if (editingQuizImageUri) {
      uriToUse = editingQuizImageUri;
    }

    if (uriToUse) {
      setQuizImageUri(uriToUse);

      const localRef = uriToUse;
      const shouldUpload = !!(authToken && !String(uriToUse).startsWith('http'));
      setIsUploadingQuizImage(shouldUpload);

      if (shouldUpload && authToken) {
        uploadImage(uriToUse, authToken)
          .then((url) => {
            setQuizImageUri(prev => (prev === localRef ? url : prev));
          })
          .catch((e) => {
            console.error('Failed to upload quiz image', e);
          })
          .finally(() => {
            setIsUploadingQuizImage(false);
          });
      }
    }

    setShowQuizImageEditor(false);
    setEditingQuizImageUri(null);
    setTempQuizImage(null);
    setShowExtraOptions1(false);
  };

  const handleSelectIntimidadesImage = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1080,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image && image.path) {
        setEditingIntimidadesImageUri(image.path);
        // Inicializamos el temp con la imagen sin recortar por si acaso, 
        // aunque el editor debería llamar a onTempSave al iniciar o recortar
        setTempIntimidadesImage({
          uri: image.path,
          cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
          aspectRatio: '3:4'
        });
        setShowIntimidadesImageEditor(true);
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen para intimidades:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen.');
      }
    }
  };

  const handleCancelIntimidadesEdit = () => {
    setShowIntimidadesImageEditor(false);
    setEditingIntimidadesImageUri(null);
    setTempIntimidadesImage(null);
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleTempIntimidadesEdit = (index: number, croppedImage: CroppedProfileImage) => {
    setTempIntimidadesImage({
      uri: croppedImage.uri,
      cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
      aspectRatio: '3:4'
    });
  };

  const handleApplyIntimidadesImage = async () => {
    let uriToUse = null;
    if (tempIntimidadesImage) {
      uriToUse = tempIntimidadesImage.uri;
    } else if (editingIntimidadesImageUri) {
      uriToUse = editingIntimidadesImageUri;
    }

    if (uriToUse) {
      setIntimidadesImageUri(uriToUse);

      const localRef = uriToUse;
      const shouldUpload = !!(authToken && !String(uriToUse).startsWith('http'));
      setIsUploadingIntimidadesImage(shouldUpload);

      if (shouldUpload && authToken) {
        uploadImage(uriToUse, authToken)
          .then((url) => {
            setIntimidadesImageUri(prev => (prev === localRef ? url : prev));
          })
          .catch((e) => {
            console.error('Failed to upload intimidades image', e);
          })
          .finally(() => {
            setIsUploadingIntimidadesImage(false);
          });
      }
    }

    setShowIntimidadesImageEditor(false);
    setEditingIntimidadesImageUri(null);
    setTempIntimidadesImage(null);
  };

  const handleSelectSurveyImage = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.82,
        compressImageMaxWidth: 1080,
        compressImageMaxHeight: 1440,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
      });

      if (image && image.path) {
        setEditingSurveyImageUri(image.path);
        setTempSurveyImage({
          uri: image.path,
          cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
          aspectRatio: '3:4'
        });
        setShowSurveyImageEditor(true);
        setShowSurveyTextInput(false);
      }
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen para encuesta:', error);
        Alert.alert('Error', 'No se pudo seleccionar la imagen.');
      }
    }
  };

  const handleCancelSurveyEdit = () => {
    setShowSurveyImageEditor(false);
    setEditingSurveyImageUri(null);
    setTempSurveyImage(null);
    ImageCropPicker.clean().catch(() => undefined);
  };

  const handleTempSurveyEdit = (index: number, croppedImage: CroppedProfileImage) => {
    setTempSurveyImage({
      uri: croppedImage.uri,
      cropData: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
      aspectRatio: '3:4'
    });
  };

  const handleApplySurveyImage = async () => {
    let uriToUse = null;
    if (tempSurveyImage) {
      uriToUse = tempSurveyImage.uri;
    } else if (editingSurveyImageUri) {
      uriToUse = editingSurveyImageUri;
    }

    if (uriToUse) {
      setSurveyImageUri(uriToUse);

      const localRef = uriToUse;
      const shouldUpload = !!(authToken && !String(uriToUse).startsWith('http'));
      setIsUploadingSurveyImage(shouldUpload);

      if (shouldUpload && authToken) {
        uploadImage(uriToUse, authToken)
          .then((url) => {
            setSurveyImageUri(prev => (prev === localRef ? url : prev));
          })
          .catch((e) => {
            console.error('Failed to upload survey image', e);
          })
          .finally(() => {
            setIsUploadingSurveyImage(false);
          });
      }
    }

    setShowSurveyImageEditor(false);
    setEditingSurveyImageUri(null);
    setTempSurveyImage(null);
    setShowExtraOptions2(false);
  };

  if (showPhotoEditor && selectedImageUri) {
    return (
      <ProfilePhotoEdit
        imageUri={selectedImageUri}
        onBack={handleCancelPhotoEdit}
        onSave={handleSaveProfilePhoto}
      />
    );
  }

  if (showQuizImageEditor && editingQuizImageUri) {
    return (
      <CarouselImageEditor
        imageUri={editingQuizImageUri}
        onBack={handleCancelQuizEdit}
        onSave={handleApplyQuizImage}
        currentIndex={0}
        totalImages={1}
        thumbnails={[]}
        onSelectImage={() => { }}
        onTempSave={handleTempQuizEdit}
        activeImageIndex={0}
        initialAspectRatio={'3:4'}
        allowAddMore={false}
      />
    );
  }

  if (showIntimidadesImageEditor && editingIntimidadesImageUri) {
    return (
      <CarouselImageEditor
        imageUri={editingIntimidadesImageUri}
        onBack={handleCancelIntimidadesEdit}
        onSave={handleApplyIntimidadesImage}
        currentIndex={0}
        totalImages={1}
        thumbnails={[]}
        onSelectImage={() => { }}
        onTempSave={handleTempIntimidadesEdit}
        activeImageIndex={0}
        initialAspectRatio={'3:4'}
        allowAddMore={false}
      />
    );
  }

  if (showSurveyImageEditor && editingSurveyImageUri) {
    return (
      <CarouselImageEditor
        imageUri={editingSurveyImageUri}
        onBack={handleCancelSurveyEdit}
        onSave={handleApplySurveyImage}
        currentIndex={0}
        totalImages={1}
        thumbnails={[]}
        onSelectImage={() => { }}
        onTempSave={handleTempSurveyEdit}
        activeImageIndex={0}
        initialAspectRatio={'3:4'}
        allowAddMore={false}
      />
    );
  }

  if (showCarouselImageEditor && editingCarouselImageUri) {
    const existingAspectRatio = isEditingExistingCarouselImage && editingCarouselImageIndex !== null
      ? carouselImages[editingCarouselImageIndex]?.aspectRatio
      : undefined;
    const currentEditorAspectRatio = editedCarouselImages[currentEditingImageIndex]?.aspectRatio
      ?? existingAspectRatio
      ?? '3:4';

    return (
      <CarouselImageEditor
        imageUri={editingCarouselImageUri}
        onBack={handleCancelCarouselEdit}
        onSave={handleConfirmCarouselEdits}
        currentIndex={currentImagePosition}
        totalImages={totalImagesToEdit}
        thumbnails={editorThumbnails}
        onSelectImage={handleSelectPendingImageForEditing}
        onTempSave={handleTempCarouselEdit}
        activeImageIndex={currentEditingImageIndex}
        initialAspectRatio={currentEditorAspectRatio}
        onAddImage={handleAddMoreImages}
        allowAddMore={currentTotalImages < 3}
        onRemoveImage={handleRemoveImageFromEditor}
      />
    );
  }

  const trimmedProfileTitle = profilePresentation?.title?.trim() ?? '';
  const trimmedProfileText = profilePresentation?.text?.trim() ?? '';

  const hasImageOrTextIntimidad = intimidades.some(i => i.type === 'image' || i.type === 'text');
  const hasQuizIntimidad = intimidades.some(i => i.type === 'quiz');
  const hasSurveyIntimidad = intimidades.some(i => i.type === 'survey');

  // const hasProfileTitleOverflow = trimmedProfileTitle.length > PROFILE_TITLE_PREVIEW_LIMIT; // Removed
  const hasProfileTextOverflow = trimmedProfileText.length > PROFILE_TEXT_PREVIEW_LIMIT;
  // const profileTitlePreview = ... // Removed
  const profileTextPreview = isProfileTextExpanded || !hasProfileTextOverflow
    ? trimmedProfileText
    : trimmedProfileText.slice(0, PROFILE_TEXT_PREVIEW_LIMIT);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#000000"
        barStyle="light-content"
      />

      {actionToast && (
        <Modal transparent visible animationType="none" onRequestClose={() => { }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                bottom: Math.max((bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT) + 14, bottomSystemOffset + 24),
                opacity: actionToastAnim,
                transform: [
                  {
                    translateY: actionToastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              }}
            >
              <View
                style={{
                  backgroundColor: 'rgba(50,50,50,0.95)',
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>{actionToast}</Text>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
      {/* Header superior izquierdo - Perfil */}
      {activeBottomTab !== 'notifications' && activeBottomTab !== 'home' && activeBottomTab !== 'chat' && (
        <View style={styles.topLeftContainer}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={[styles.profileIconCircle, profilePhotoUri ? { shadowOpacity: 0, elevation: 0, borderWidth: 0 } : null]}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={triggerProfileAvatarPulseAndOpenSidePanel}>
              {isProfileAvatarPulsing && (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    borderRadius: 999,
                    backgroundColor: '#FFB74D',
                    opacity: profileAvatarPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.18],
                    }),
                    transform: [
                      {
                        scale: profileAvatarPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.12],
                        }),
                      },
                    ],
                  }}
                />
              )}
              {profilePhotoUri ? (
                <Image
                  source={{ uri: getServerResourceUrl(profilePhotoUri) }}
                  style={styles.profileImage}
                />
              ) : (
                <MaterialIcons name="person" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            {activeBottomTab === 'profile' && profileView === 'profile' && unreadNotificationsCount > 0 && (
              <View pointerEvents="none" style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountBadgeText}>{unreadNotificationsCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {accountVerified ? (
                <VerifiedBadgeIcon size={16} solidColor="#FFFFFF" solidOpacity={0.6} />
              ) : null}
              <Text style={styles.usernameText}>{username || 'Usuario'}</Text>
              {keintiVerified ? (
                <VerifiedBadgeIcon size={16} variant="gradient" />
              ) : null}
            </View>
            {linkedSocialNetworks.length > 0 ? (
              <View style={styles.linkedIconsContainer}>
                {!showLinkedSocials && (
                  <TouchableOpacity
                    onPress={() => setShowLinkedSocials(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 4 }}
                  >
                    <MaterialIcons
                      name="link"
                      size={14}
                      color="rgba(255, 183, 77, 0.7)"
                    />
                  </TouchableOpacity>
                )}
                {showLinkedSocials && linkedSocialNetworks.map((item) => (
                  <TouchableOpacity
                    key={item.network}
                    onPress={() => openExternalLink(item.link)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={SOCIAL_ICONS[item.network as keyof typeof SOCIAL_ICONS]}
                      style={styles.linkedHeaderIcon}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity onPress={toggleSocialPanel} activeOpacity={0.7}>
                <Text style={styles.socialText}>{t('front.yourSocialNetworks')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Social Media Panel Overlay */}
      {
        showSocialPanel && (
          <TouchableWithoutFeedback onPress={toggleSocialPanel}>
            <View style={styles.socialPanelOverlay} />
          </TouchableWithoutFeedback>
        )
      }

      {/* Social Media Panel */}
      <Animated.View style={[styles.socialPanel, { transform: [{ translateY: socialPanelAnimation }] }]}>
        <View style={styles.socialIconsRow}>
          {Object.entries(SOCIAL_ICONS).map(([key, source]) => {
            const isLinked = linkedSocialNetworks.some(item => item.network === key);
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleSelectSocialNetwork(key)}
                activeOpacity={0.7}
                style={[
                  styles.socialIconContainer,
                  selectedSocialNetwork === key && styles.socialIconSelected
                ]}
              >
                <Image source={source} style={styles.socialIcon} />
                {isLinked && (
                  <TouchableOpacity
                    style={styles.unlinkBadge}
                    onPress={() => handleUnlinkSocialNetwork(key)}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <MaterialIcons name="close" size={10} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Link Input Field */}
        <View style={styles.socialLinkInputContainer}>
          <TextInput
            style={[
              styles.socialPanelInput,
              !selectedSocialNetwork && styles.socialPanelInputDisabled,
              linkError ? styles.socialPanelInputError : null
            ]}
            placeholder={selectedSocialNetwork ? t('front.link' as TranslationKey) : t('front.selectSocialNetwork' as TranslationKey)}
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            value={socialLink}
            onChangeText={handleSocialLinkChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!!selectedSocialNetwork}
            selectTextOnFocus={!!selectedSocialNetwork}
          />
          {selectedSocialNetwork && linkError ? (
            <Text style={styles.socialPanelErrorText}>{linkError}</Text>
          ) : null}
        </View>

        {/* Link Button */}
        <TouchableOpacity
          style={[
            styles.linkButton,
            (!selectedSocialNetwork || !socialLink || !!linkError) && styles.linkButtonDisabled
          ]}
          onPress={handleLinkSocialNetwork}
          disabled={!selectedSocialNetwork || !socialLink || !!linkError}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.linkButtonText,
            (!selectedSocialNetwork || !socialLink || !!linkError) && styles.linkButtonTextDisabled
          ]}>
            {t('common.apply' as TranslationKey)}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Reaction Panel Overlay */}
      {showReactionPanel && (
        <TouchableWithoutFeedback onPress={toggleReactionPanel}>
          <View style={styles.socialPanelOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Profile ring color panel overlay */}
      {showProfileRingColorPanel && (
        <TouchableWithoutFeedback onPress={closeProfileRingColorPanel}>
          <View style={styles.socialPanelOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Profile ring viewer panel overlay */}
      {showProfileRingViewerPanel && (
        <TouchableWithoutFeedback onPress={closeProfileRingViewerPanel}>
          <View style={styles.socialPanelOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Reaction Panel */}
      <Animated.View
        style={[
          styles.reactionPanel,
          {
            bottom: (!isKeyboardVisible && activeBottomTab !== 'notifications')
              ? (bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT)
              : 0,
            transform: [{ translateY: reactionPanelAnimation }],
          },
        ]}
      >
        <View style={styles.reactionPanelHeader}>
          <Text style={styles.reactionPanelTitle}>{t('front.reactions' as TranslationKey)} ({selectedReactions.length}/3)</Text>
          <TouchableOpacity onPress={toggleReactionPanel}>
            <MaterialIcons name="check" size={24} color="#FFB74D" />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.reactionScrollView}
          contentContainerStyle={styles.reactionGrid}
          showsVerticalScrollIndicator={false}
        >
          {REACTION_EMOJIS.map((emoji, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.reactionItem,
                selectedReactions.includes(emoji) && styles.reactionItemSelected
              ]}
              onPress={() => handleReactionSelect(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Profile ring color panel */}
      {showProfileRingColorPanel && (
        <Animated.View
          style={[
            styles.profileRingColorPanel,
            isKeyboardVisible && keyboardHeight > 0
              ? { bottom: keyboardHeight }
              : { bottom: profileRingPanelsBottomOffset },
            { transform: [{ translateY: profileRingColorPanelAnimation }] },
          ]}
        >
          <View style={styles.profileRingColorPanelHeader}>
            <TouchableOpacity
              onPress={createSelectedProfileRing}
              activeOpacity={0.8}
              disabled={!canCreateProfileRingMeta}
              style={styles.profileRingApplyAction}
            >
              <MaterialIcons name="check" size={22} color="#FFFFFF" />
              <Text style={styles.profileRingApplyActionText}>{t('common.create' as TranslationKey)}</Text>
              {!canCreateProfileRingMeta && (
                <View style={styles.profileRingApplyActionDisabledOverlay} pointerEvents="none" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteSelectedProfileRing}
              activeOpacity={0.8}
              style={styles.profileRingDeleteAction}
            >
              <MaterialIcons name="delete" size={18} color="#FFFFFF" />
              <Text style={styles.profileRingDeleteActionText}>{t('front.profileRingDelete' as TranslationKey)}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={profileRingPanelScrollRef}
            style={styles.profileRingPanelScroll}
            contentContainerStyle={styles.profileRingPanelScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileRingColorOptionsRow}>
              {PROFILE_RING_COLOR_OPTIONS.map(opt => {
                const selectedColor = String(profileRingColorDraft || '').toLowerCase();
                const isSelected = selectedColor === opt.color.toLowerCase();
                const innerSize = 34;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    activeOpacity={0.8}
                    onPress={() => applyColorToSelectedRing(opt.color)}
                    style={[
                      styles.profileRingColorOptionOuter,
                      isSelected && styles.profileRingColorOptionOuterSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.profileRingColorOptionInner,
                        { width: innerSize, height: innerSize, borderRadius: innerSize / 2, borderColor: opt.color },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.profileRingMetaContainer}>
              <Text style={styles.profileRingFieldLabel}>{t('front.profileRingNameLabel' as TranslationKey)}</Text>
              <Text style={styles.profileRingFieldHelper}>{t('front.profileRingNameHelper' as TranslationKey)}</Text>
              <TextInput
                style={styles.profileRingTextInput}
                value={profileRingNameDraft}
                onChangeText={updateSelectedProfileRingName}
                maxLength={38}
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCapitalize="sentences"
                autoCorrect
              />

              <Text style={styles.profileRingFieldLabel}>{t('front.profileRingDescriptionLabel' as TranslationKey)}</Text>
              <TextInput
                style={[styles.profileRingTextInput, styles.profileRingTextArea]}
                value={profileRingDescriptionDraft}
                onChangeText={updateSelectedProfileRingDescription}
                onFocus={ensureProfileRingFocusedFieldVisible}
                maxLength={280}
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCapitalize="sentences"
                autoCorrect
                multiline
                textAlignVertical="top"
              />

              <View style={styles.profileRingLinkLocationContainer}>
                <View style={styles.profileRingLinkLocationBlock}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={toggleProfileRingLinkExpanded}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <View style={styles.profileRingLinkLocationRow}>
                      <MaterialIcons name="link" size={18} color="#FFFFFF" />
                      <Text style={styles.profileRingLinkLocationText}>{t('front.profileRingLinkLabel' as TranslationKey)}</Text>
                      <View style={{ flex: 1 }} />
                      <MaterialIcons
                        name={isProfileRingLinkExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={22}
                        color="rgba(255, 255, 255, 0.8)"
                      />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.profileRingLinkLocationHelper}>{t('front.profileRingLinkHelper' as TranslationKey)}</Text>

                  {!!(profileRingLinkNetworkDraft && profileRingLinkUrlDraft) && !isProfileRingLinkExpanded && (() => {
                    const key = String(profileRingLinkNetworkDraft || '').trim();
                    const url = String(profileRingLinkUrlDraft || '').trim();
                    if (!key || !url) return null;
                    const source = (SOCIAL_ICONS as any)[key];

                    return (
                      <View style={styles.profileRingLinkPreviewRow}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={clearProfileRingLinkDraft}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Eliminar enlace"
                          style={styles.profileRingPreviewRemoveBtn}
                        >
                          <MaterialIcons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                        {source ? (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => openExternalLink(url)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Image source={source} style={styles.profileRingLinkedIcon} />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => openExternalLink(url)}
                          style={{ flex: 1 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.profileRingLinkPreviewText} numberOfLines={1}>
                            {url}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  {isProfileRingLinkExpanded && (
                    <View style={styles.profileRingLinkPickerContainer}>
                      <View style={styles.socialIconsRow}>
                        {Object.entries(SOCIAL_ICONS).map(([key, source]) => (
                          <TouchableOpacity
                            key={key}
                            onPress={() => handleSelectProfileRingLinkNetwork(key)}
                            activeOpacity={0.7}
                            style={[
                              styles.socialIconContainer,
                              profileRingLinkNetworkDraft === key && styles.socialIconSelected,
                            ]}
                          >
                            <Image source={source as any} style={[styles.socialIcon, styles.profileRingSocialIcon]} />
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.profileRingLinkInputContainer}>
                        <TextInput
                          style={[
                            styles.socialPanelInput,
                            !profileRingLinkNetworkDraft && styles.socialPanelInputDisabled,
                            profileRingLinkErrorDraft ? styles.socialPanelInputError : null,
                            { marginTop: 0 },
                          ]}
                          placeholder={profileRingLinkNetworkDraft ? t('front.link' as TranslationKey) : t('front.selectSocialNetwork' as TranslationKey)}
                          placeholderTextColor="rgba(255, 255, 255, 0.3)"
                          value={profileRingLinkUrlDraft}
                          onChangeText={handleProfileRingLinkUrlChange}
                          onFocus={ensureProfileRingFocusedFieldVisible}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                          editable={!!profileRingLinkNetworkDraft}
                          selectTextOnFocus={!!profileRingLinkNetworkDraft}
                        />
                        {profileRingLinkNetworkDraft && profileRingLinkErrorDraft ? (
                          <Text style={styles.socialPanelErrorText}>{profileRingLinkErrorDraft}</Text>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.linkButton,
                          (!profileRingLinkNetworkDraft || !profileRingLinkUrlDraft || !!profileRingLinkErrorDraft) && styles.linkButtonDisabled,
                          styles.profileRingLinkApplyButton,
                        ]}
                        onPress={applyProfileRingLinkDraft}
                        disabled={!profileRingLinkNetworkDraft || !profileRingLinkUrlDraft || !!profileRingLinkErrorDraft}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.linkButtonText,
                            (!profileRingLinkNetworkDraft || !profileRingLinkUrlDraft || !!profileRingLinkErrorDraft) && styles.linkButtonTextDisabled,
                          ]}
                        >
                          {t('common.apply' as TranslationKey)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.profileRingLinkLocationBlock}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={openProfileRingLocationPicker}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <View style={styles.profileRingLinkLocationRow}>
                      <MaterialIcons name="location-on" size={18} color="#FFFFFF" />
                      <Text style={styles.profileRingLinkLocationText}>{t('front.profileRingLocationLabel' as TranslationKey)}</Text>
                      <View style={{ flex: 1 }} />
                      <MaterialIcons name="add" size={22} color="rgba(255, 255, 255, 0.8)" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.profileRingLinkLocationHelper}>{t('front.profileRingLocationHelper' as TranslationKey)}</Text>

                  {!!(profileRingLocationLabelDraft) && (
                    <View style={styles.profileRingLocationPreviewRow}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={clearProfileRingLocationDraft}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar ubicación"
                        style={styles.profileRingPreviewRemoveBtn}
                      >
                        <MaterialIcons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => openExternalLink(profileRingLocationUrlDraft || 'https://www.google.com/maps')}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <MaterialIcons name="place" size={16} color="rgba(255, 183, 77, 0.9)" />
                        <Text style={styles.profileRingLocationPreviewText} numberOfLines={1}>
                          {profileRingLocationLabelDraft}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Profile ring viewer panel */}
      {showProfileRingViewerPanel && viewingProfileRing && (
        <Animated.View
          style={[
            styles.profileRingViewerPanel,
            { bottom: profileRingPanelsBottomOffset },
            { borderTopColor: viewingProfileRing.color || '#FFB74D' },
            { transform: [{ translateY: profileRingViewerPanelAnimation }] },
          ]}
        >
          <View style={styles.profileRingViewerHeader}>
            <View style={[styles.profileRingViewerColorDot, { borderColor: viewingProfileRing.color || '#FFFFFF' }]} />
            <View style={{ flex: 1 }} />
            {viewingProfileRingSource === 'profile' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  onPress={handleEditViewingProfileRing}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Editar aro"
                >
                  <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={requestDeleteViewingProfileRing}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar aro"
                >
                  <MaterialIcons name="delete" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.profileRingViewerScrollContent}
          >
            <Text style={styles.profileRingViewerName}>
              {viewingProfileRing.name}
            </Text>
            <Text style={styles.profileRingViewerDescription}>
              {viewingProfileRing.description}
            </Text>

            {!!(viewingProfileRing.linkNetwork && viewingProfileRing.linkUrl) && (
              <View style={styles.profileRingViewerMetaSection}>
                <Text style={styles.profileRingViewerMetaLabel}>{t('front.profileRingLinkLabel' as TranslationKey)}</Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => openExternalLink(viewingProfileRing.linkUrl)}
                  style={styles.profileRingViewerMetaRow}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {(() => {
                    const key = String(viewingProfileRing.linkNetwork || '').trim();
                    const source = (SOCIAL_ICONS as any)[key];
                    if (!source) return null;
                    return (
                      <Image
                        source={source}
                        style={styles.profileRingViewerLinkLogo}
                      />
                    );
                  })()}
                  <Text style={styles.profileRingViewerMetaText} numberOfLines={2}>
                    {viewingProfileRing.linkUrl}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!!(viewingProfileRing.locationLabel) && (
              <View style={styles.profileRingViewerMetaSection}>
                <Text style={styles.profileRingViewerMetaLabel}>{t('front.profileRingLocationLabel' as TranslationKey)}</Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => openExternalLink(viewingProfileRing.locationUrl || 'https://www.google.com/maps')}
                  style={styles.profileRingViewerMetaRow}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialIcons name="place" size={18} color="#FFB74D" />
                  <Text style={styles.profileRingViewerMetaText} numberOfLines={2}>
                    {viewingProfileRing.locationLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          {(viewingProfileRingSource === 'home' || activeBottomTab === 'home') && adsInitialized && (
            <View style={[styles.profileRingViewerAdContainer, !homeProfileRingBannerReady && { minHeight: 0, marginTop: 0 }]}>
              <BannerAd
                key={`ring-banner-${viewingProfileRingId || 'none'}-${homeProfileRingBannerSize}-${homeProfileRingBannerRequestKey}`}
                unitId={BANNER_AD_UNIT_ID}
                size={homeProfileRingBannerSize}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                onPaid={(event) => {
                  trackAdPaidEvent({
                    format: 'banner',
                    placement: 'home_profile_ring_viewer_banner',
                    event,
                  });
                }}
                onAdLoaded={() => setHomeProfileRingBannerReady(true)}
                onAdFailedToLoad={(error) => {
                  setHomeProfileRingBannerReady(false);

                  if (homeProfileRingBannerSize === BannerAdSize.ANCHORED_ADAPTIVE_BANNER) {
                    setHomeProfileRingBannerSize(BannerAdSize.BANNER);
                    setHomeProfileRingBannerRequestKey(k => k + 1);
                    return;
                  }

                  console.warn('[AdMob] Home profile ring banner failed to load', {
                    unitId: BANNER_AD_UNIT_ID,
                    size: homeProfileRingBannerSize,
                    isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : undefined,
                    error,
                  });
                }}
              />
            </View>
          )}
        </Animated.View>
      )}

      {/* Confirm delete profile ring (styled modal) */}
      <Modal
        visible={showDeleteProfileRingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDeleteProfileRingModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={closeDeleteProfileRingModal}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.deleteModalContainer, { width: '92%', borderWidth: 1, borderColor: 'rgba(255, 183, 77, 0.35)' }]}>
              <Text style={styles.deleteModalTitle}>Eliminar aro</Text>
              <Text style={[styles.deleteModalText, styles.deleteModalTextJustified]}>
                ¿Seguro que quieres eliminar este aro y toda su información?
              </Text>
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                  onPress={closeDeleteProfileRingModal}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteModalButtonTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm]}
                  onPress={confirmDeleteProfileRing}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteModalButtonTextConfirm}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Profile ring location picker modal (Google Maps via react-native-maps) */}
      <Modal
        visible={showProfileRingLocationPicker}
        transparent
        animationType="fade"
        onRequestClose={closeProfileRingLocationPicker}
      >
        <View style={styles.profileRingLocationModalOverlay}>
          <View style={styles.profileRingLocationModalCard}>
            <View style={styles.profileRingLocationModalHeader}>
              <Text style={styles.profileRingLocationModalTitle}>Selecciona una ubicación</Text>
              <TouchableOpacity onPress={closeProfileRingLocationPicker} hitSlop={10}>
                <MaterialIcons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileRingLocationMapContainer}>
              {profileRingPickedLatLng && (
                <MapView
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  ref={(r) => {
                    profileRingLocationMapRef.current = r;
                  }}
                  style={StyleSheet.absoluteFill}
                  initialRegion={{
                    latitude: profileRingPickedLatLng.lat,
                    longitude: profileRingPickedLatLng.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  showsUserLocation
                  showsMyLocationButton
                  onRegionChangeComplete={(r) => {
                    const lat = Number((r as any)?.latitude);
                    const lng = Number((r as any)?.longitude);
                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                      setProfileRingPickedLatLng({ lat, lng });
                      if (profileRingLocationAutoMoveRef.current) {
                        profileRingLocationAutoMoveRef.current = false;
                      } else {
                        setProfileRingPickedLocationLabel(null);
                      }
                    }
                  }}
                  onPoiClick={(e: PoiClickEvent) => {
                    const { coordinate, name, placeId } = e.nativeEvent;
                    if (coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)) {
                      setProfileRingPickedLocationLabel(name || null);
                      setProfileRingPickedLocationPlaceId(placeId || null);
                      setProfileRingLocationSearchQuery(name || '');
                      moveProfileRingLocationMapTo(coordinate.latitude, coordinate.longitude);
                    }
                  }}
                  onPress={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                      moveProfileRingLocationMapTo(latitude, longitude);
                    }
                  }}
                />
              )}

              {/* Search overlay */}
              <View style={styles.profileRingLocationSearchContainer} pointerEvents="box-none">
                <View style={styles.profileRingLocationSearchBar}>
                  <MaterialIcons name="search" size={18} color="rgba(255,255,255,0.75)" />
                  <TextInput
                    style={styles.profileRingLocationSearchInput}
                    placeholder={isPlacesSearchEnabled ? 'Buscar ubicación…' : 'Inicia sesión para buscar…'}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={profileRingLocationSearchQuery}
                    onChangeText={(v) => {
                      setProfileRingLocationSearchQuery(v);
                      setProfileRingPickedLocationLabel(null);
                    }}
                    editable={isPlacesSearchEnabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {isProfileRingLocationSearching ? (
                    <ActivityIndicator size="small" color="#FFB74D" />
                  ) : profileRingLocationSearchQuery ? (
                    <TouchableOpacity
                      onPress={() => {
                        setProfileRingLocationSearchQuery('');
                        setProfileRingLocationPredictions([]);
                        setProfileRingLocationSearchError('');
                        Keyboard.dismiss();
                      }}
                      hitSlop={10}
                    >
                      <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {!!profileRingLocationSearchError && (
                  <View style={styles.profileRingLocationSearchErrorRow}>
                    <Text style={styles.profileRingLocationSearchErrorText}>{profileRingLocationSearchError}</Text>
                  </View>
                )}

                {profileRingLocationPredictions.length > 0 && (
                  <View style={styles.profileRingLocationPredictionsCard}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {profileRingLocationPredictions.map((p) => (
                        <TouchableOpacity
                          key={p.placeId}
                          style={styles.profileRingLocationPredictionRow}
                          activeOpacity={0.75}
                          onPress={() => handleSelectProfileRingLocationPrediction(p.placeId, p.description)}
                        >
                          <MaterialIcons name="place" size={16} color="rgba(255,183,77,0.9)" />
                          <Text style={styles.profileRingLocationPredictionText} numberOfLines={2}>
                            {p.description}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Center pin */}
              <View pointerEvents="none" style={styles.profileRingLocationCenterPin}>
                <MaterialIcons name="place" size={34} color="#FFB74D" />
              </View>

              {isProfileRingLocating && (
                <View style={styles.profileRingLocationLocatingOverlay}>
                  <ActivityIndicator color="#FFB74D" />
                  <Text style={styles.profileRingLocationLocatingText}>Obteniendo ubicación…</Text>
                </View>
              )}
            </View>

            <View style={styles.profileRingLocationModalButtonsRow}>
              <TouchableOpacity
                style={[styles.profileRingLocationModalButton, styles.profileRingLocationModalButtonSecondary]}
                onPress={closeProfileRingLocationPicker}
                activeOpacity={0.7}
              >
                <Text style={styles.profileRingLocationModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.profileRingLocationModalButton,
                  (!profileRingPickedLatLng) && styles.profileRingLocationModalButtonDisabled,
                ]}
                onPress={applyProfileRingPickedLocation}
                disabled={!profileRingPickedLatLng}
                activeOpacity={0.7}
              >
                <Text style={styles.profileRingLocationModalButtonTextPrimary}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header superior derecho - Descubre (visible cuando Home está activo) */}
      {
        activeBottomTab === 'home' && false && (
          <View style={styles.topRightContainer}>
            <Text style={styles.discoverText}>Descubre</Text>
            <View style={styles.blueDot} />
          </View>
        )
      }

      {
        activeBottomTab === 'profile' && (
          <TouchableOpacity
            style={styles.topRightContainer}
            activeOpacity={0.7}
            onPress={() => {
              if (profileView === 'profile') {
                markYourProfileHintSeen();
                setProfileView('presentation');
              } else if (profileView === 'presentation') {
                setProfileView('intimidades');
              } else {
                setProfileView('profile');
              }
            }}>
            <Text style={styles.discoverText}>
              {profileView === 'profile'
                ? t('front.yourProfile' as TranslationKey)
                : profileView === 'presentation'
                  ? t('front.yourPresentation' as TranslationKey)
                  : t('front.intimacies' as TranslationKey)}
            </Text>
            <View style={styles.blueDot} />
          </TouchableOpacity>
        )
      }

      {/* Header superior derecho - Canal (visible cuando Chat está activo) */}
      {
        activeBottomTab === 'chat' && chatView !== 'groupChat' && !(chatView === 'channel' && !!selectedChannel) && (
          <View
            key={`chat-top-tabs-${chatTopTabsRenderKey}-${chatView}-${groupsTab}-${channelTab}`}
            style={[styles.topCenterContainer, { top: ANDROID_SAFE_TOP + CHAT_TABS_TOP }]}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              if (Number.isFinite(height) && height > 0 && height !== chatTopTabsHeight) {
                setChatTopTabsHeight(height);
              }
            }}
          >
            {chatView === 'groups' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '90%' }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedChannel(null);
                    setChatView('groups');
                    setGroupsTab('tusGrupos');
                    if (!authToken || !accountVerified) {
                      showActionToast(t('chat.lockedYourGroupsMessage' as TranslationKey));
                    }
                  }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: groupsTab === 'tusGrupos' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 15,
                    fontWeight: 'bold',
                    marginBottom: 6,
                  }}>
                    {t('chat.tabYourGroups' as TranslationKey)}
                  </Text>
                  {groupsTab === 'tusGrupos' && (
                    <Svg width="40" height="3" style={{ marginTop: 0 }}>
                      <Defs>
                        <LinearGradient id="grad_line_tus_grupos_top" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                          <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="40" height="3" fill="url(#grad_line_tus_grupos_top)" rx="1.5" />
                    </Svg>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    setChatView(prev => {
                      return prev === 'groups' ? 'channel' : 'groups';
                    });
                  }}
                >
                  <Text style={styles.discoverText}>{t('chat.tabGroups' as TranslationKey)}</Text>
                  <View style={styles.blueDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedChannel(null);
                    setChatView('groups');
                    setGroupsTab('unidos');
                    if (!authToken || !accountVerified) {
                      showActionToast(t('chat.lockedJoinedGroupsMessage' as TranslationKey));
                    }
                  }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: groupsTab === 'unidos' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 15,
                    fontWeight: 'bold',
                    marginBottom: 6,
                  }}>
                    {t('chat.tabJoined' as TranslationKey)}
                  </Text>
                  {groupsTab === 'unidos' && (
                    <Svg width="40" height="3" style={{ marginTop: 0 }}>
                      <Defs>
                        <LinearGradient id="grad_line_unidos_top" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                          <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="40" height="3" fill="url(#grad_line_unidos_top)" rx="1.5" />
                    </Svg>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '90%' }}>
                <TouchableOpacity
                  onPress={() => setChannelTab('Tu canal')}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: channelTab === 'Tu canal' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 15,
                    fontWeight: 'bold',
                    marginBottom: 6,
                  }}>
                    {t('chat.tabYourChannel' as TranslationKey)}
                  </Text>
                  {channelTab === 'Tu canal' && (
                    <Svg width="40" height="3" style={{ marginTop: 0 }}>
                      <Defs>
                        <LinearGradient id="grad_line_tu_canal_top" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                          <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="40" height="3" fill="url(#grad_line_tu_canal_top)" rx="1.5" />
                    </Svg>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    setChatView(prev => {
                      return prev === 'groups' ? 'channel' : 'groups';
                    });
                  }}
                >
                  <Text style={styles.discoverText}>{t('chat.tabChannel' as TranslationKey)}</Text>
                  <View style={styles.blueDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setChannelTab('tusCanales')}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: channelTab === 'tusCanales' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 15,
                    fontWeight: 'bold',
                    marginBottom: 6,
                  }}>
                    {t('chat.tabJoined' as TranslationKey)}
                  </Text>
                  {channelTab === 'tusCanales' && (
                    <Svg width="40" height="3" style={{ marginTop: 0 }}>
                      <Defs>
                        <LinearGradient id="grad_line_tus_canales_top" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                          <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="40" height="3" fill="url(#grad_line_tus_canales_top)" rx="1.5" />
                    </Svg>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      }

      {/* Contenido principal */}
      <View style={styles.content}>
        {/* Pantalla Home */}
        {activeBottomTab === 'home' && (
          <View style={[styles.homeScreenContainer, { paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT + 8 : 8, paddingBottom: 0 }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: bottomNavHeight + 16 }}
              scrollEnabled={isHomeMainScrollEnabled}
            >
              {giveAways.length === 0 && publications.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  {isHomePostsLoading || !hasHomePostsLoadedOnce ? (
                    <View style={styles.homeLoadingContainer}>
                      <View>
                        <View style={styles.homeLoadingAvatarFrame}>
                          {profilePhotoUri ? (
                            <Image
                              source={{ uri: getServerResourceUrl(profilePhotoUri) }}
                              style={styles.homeLoadingAvatarImage}
                            />
                          ) : (
                            <Image
                              source={require('../../assets/images/2logokeinti.png')}
                              style={styles.homeLoadingAvatarImage}
                              resizeMode="contain"
                            />
                          )}

                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.homeLoadingRingContainer,
                              {
                                opacity: 1,
                                transform: [
                                  {
                                    rotate: homeLoaderRotateAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ['0deg', '360deg'],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          >
                            <Svg width={88} height={88} viewBox="0 0 88 88">
                              <Defs>
                                <LinearGradient id="home_loader_ring_grad" x1="0" y1="0" x2="1" y2="1">
                                  <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                                  <Stop offset="1" stopColor="#FFF176" stopOpacity="1" />
                                </LinearGradient>
                              </Defs>
                              {/* Aro con pequeño hueco para que se note el giro */}
                              <Circle
                                cx="44"
                                cy="44"
                                r="41"
                                fill="none"
                                stroke="url(#home_loader_ring_grad)"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="220 60"
                              />
                            </Svg>
                          </Animated.View>
                        </View>
                      </View>

                      <Image
                        source={require('../../assets/images/logokeinti.png')}
                        style={styles.homeLoadingBottomLogo}
                        resizeMode="contain"
                      />
                    </View>
                  ) : (
                    <Text style={styles.emptyStateText}>
                      {t('front.noPublicationsAvailable' as TranslationKey)}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  {publications.slice(currentPostIndex, currentPostIndex + 1).map((pub) => {
                    const activeIndex = activeIntimidadIndices[pub.id] || 0;
                    const activePresentationIndex = activePresentationIndices[pub.id] || 0;
                    const isOverlayVisible = presentationOverlayVisible[pub.id] !== false;
                    const isTextExpanded = expandedProfileTexts[pub.id] || false;

                    const ringsVisible = homeProfileRingsVisibleByPostId[String(pub.id)] === true;
                    const presentationRings: ProfileRingPoint[] = Array.isArray(pub.presentation?.profileRings)
                      ? (pub.presentation.profileRings as ProfileRingPoint[])
                      : [];
                    const hasPresentationRings = presentationRings.length > 0;

                    const trimmedTitle = pub.presentation.title?.trim() ?? '';
                    const trimmedText = pub.presentation.text?.trim() ?? '';
                    const hasTextOverflow = trimmedText.length > PROFILE_TEXT_PREVIEW_LIMIT;
                    const textPreview = isTextExpanded || !hasTextOverflow
                      ? trimmedText
                      : trimmedText.slice(0, PROFILE_TEXT_PREVIEW_LIMIT);

                    const isJoined = myChannels.some(ch => String(ch?.post_id ?? ch?.postId ?? ch?.id) === String(pub.id));

                    // Initialize animations if not present
                    if (!publicationAnimations.current[pub.id]) {
                      publicationAnimations.current[pub.id] = {
                        scale: new Animated.Value(0),
                        opacity: new Animated.Value(0)
                      };
                    }
                    const pubAnims = publicationAnimations.current[pub.id];
                    const pubDoubleTap = publicationDoubleTapState[pub.id] || { visible: false, emoji: '' };

                    return (
                      <Animated.View
                        key={pub.id}
                        style={{ marginBottom: 0, transform: [{ translateX: publicationSwipeX }] }}
                        {...publicationSwipePanResponder.panHandlers}
                      >
                        {shouldShowHomeSwipeTutorial && (
                          <Pressable
                            style={styles.homeSwipeTutorialContainer}
                            onPress={markHomeSwipeTutorialSeen}
                            disabled={hasSeenHomeSwipeTutorial !== false}
                            accessibilityRole="button"
                          >
                            <Animated.View
                              style={{
                                opacity: homeSwipeTutorialArrowOpacity,
                                transform: [{ translateX: homeSwipeTutorialLeftArrowOffset }],
                              }}
                            >
                              <MaterialIcons name="keyboard-arrow-left" size={26} color="#FFB74D" />
                            </Animated.View>

                            <Text style={styles.homeSwipeTutorialText}>
                              {t('front.homeSwipeTutorialHint' as TranslationKey)}
                            </Text>

                            <Animated.View
                              style={{
                                opacity: homeSwipeTutorialArrowOpacity,
                                transform: [{ translateX: homeSwipeTutorialRightArrowOffset }],
                              }}
                            >
                              <MaterialIcons name="keyboard-arrow-right" size={26} color="#FFB74D" />
                            </Animated.View>
                          </Pressable>
                        )}
                        <View style={styles.presentationHeaderContainer}>
                          <View style={styles.presentationUserInfo}>
                            <TouchableOpacity
                              style={[styles.presentationAvatarContainer, { borderWidth: 0 }]}
                              activeOpacity={0.8}
                              onPress={() => {
                                if (pub.user.profilePhotoUri) {
                                  setFullScreenAvatarUri(getServerResourceUrl(pub.user.profilePhotoUri));
                                }
                              }}
                            >
                              {pub.user.profilePhotoUri ? (
                                <Image
                                  source={{ uri: getServerResourceUrl(pub.user.profilePhotoUri) }}
                                  style={styles.presentationAvatar}
                                />
                              ) : (
                                <MaterialIcons name="person" size={24} color="#FFFFFF" />
                              )}
                            </TouchableOpacity>
                            <View style={styles.presentationUserDetails}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {pub.user.accountVerified ? (
                                  <View style={{ marginRight: 6 }}>
                                    <VerifiedBadgeIcon size={14} solidColor="#FFFFFF" solidOpacity={0.6} />
                                  </View>
                                ) : null}
                                <Text style={styles.presentationUsername}>
                                  {(pub.user.username || 'Usuario').startsWith('@')
                                    ? (pub.user.username || 'Usuario')
                                    : `@${pub.user.username || 'Usuario'}`}
                                </Text>
                                {pub.user.keintiVerified ? (
                                  <View style={{ marginLeft: 6 }}>
                                    <VerifiedBadgeIcon size={14} variant="gradient" />
                                  </View>
                                ) : null}
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                {intimidadesVisible[pub.id] && !isJoined && (
                                  <FireworkChatIcon
                                    size={18}
                                    onPress={() => handleEnterChannel(pub)}
                                    style={{ marginRight: 4 }}
                                  />
                                )}
                                <Text style={{ color: '#FFFFFF', fontSize: 12 }}>
                                  {formatSocialNetworksCount(pub.user.socialNetworks.length)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ justifyContent: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {!!pub.user.nationality && (
                                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>{pub.user.nationality}</Text>
                              )}

                              <View style={{ position: 'relative', marginLeft: 6, zIndex: 80, elevation: 80 }}>
                                <TouchableOpacity
                                  onPress={() => togglePublicationOptions(pub.id)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  accessibilityRole="button"
                                  accessibilityLabel="Opciones"
                                >
                                  <MaterialIcons name="more-vert" size={18} color="rgba(255,255,255,0.9)" />
                                </TouchableOpacity>

                                {activePublicationOptionsId === pub.id && (
                                  <View style={styles.publicationOptionsMenu}>
                                    <TouchableOpacity
                                      style={styles.publicationOptionsMenuItem}
                                      onPress={() => {
                                        openPublicationReportModal(pub);
                                      }}
                                    >
                                      <Text style={styles.publicationOptionsMenuText}>{t('common.report' as TranslationKey)}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.publicationOptionsMenuItem}
                                      onPress={() => {
                                        openPublicationBlockModal(pub);
                                      }}
                                    >
                                      <Text style={styles.publicationOptionsMenuTextDanger}>{t('common.block' as TranslationKey)}</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>

                        {pub.presentation.images.length > 0 && (
                          <View>
                            <View style={styles.profilePresentationCarousel}>
                              {(() => {
                                const total = pub.presentation.images.length;
                                const loadedMap = homePresentationImagesLoaded[String(pub.id)] || {};
                                const loadedCount = Math.min(total, Object.values(loadedMap).filter(Boolean).length);
                                const isLoading = loadedCount < total;

                                if (!isLoading) return null;

                                return (
                                  <View style={styles.homeCarouselLoadingOverlay} pointerEvents="none">
                                    <GradientSpinner size={34} />
                                    <View style={styles.homeCarouselLoadingPill}>
                                      <Text style={styles.homeCarouselLoadingText}>{t('front.loadingImages' as TranslationKey)}</Text>
                                      <Text style={styles.homeCarouselLoadingSubText}>{loadedCount}/{total}</Text>
                                    </View>
                                  </View>
                                );
                              })()}
                              <FlatList
                                key={`home-carousel-${String(pub.id)}-${homeCarouselMountKeysByPubId[String(pub.id)] || 0}-${pub.presentation.images.length}`}
                                data={pub.presentation.images}
                                keyExtractor={(_, index) => `pub-${pub.id}-image-${index}`}
                                extraData={homePresentationImagesLoaded[String(pub.id)]}
                                horizontal
                                pagingEnabled
                                bounces={false}
                                showsHorizontalScrollIndicator={false}
                                snapToAlignment="center"
                                snapToInterval={SCREEN_WIDTH - 4}
                                decelerationRate="fast"
                                scrollEventThrottle={16}
                                removeClippedSubviews={false}
                                onScrollBeginDrag={() => setHomeCarouselGestureActive(true)}
                                onScrollEndDrag={() => setHomeCarouselGestureActive(false)}
                                onMomentumScrollBegin={() => setHomeCarouselGestureActive(true)}
                                onScroll={(event) => {
                                  updateHomePresentationActiveIndexFromScroll(
                                    pub.id,
                                    event.nativeEvent.contentOffset.x,
                                    event.nativeEvent.layoutMeasurement.width,
                                    pub.presentation.images.length
                                  );
                                }}
                                onMomentumScrollEnd={(event) => {
                                  updateHomePresentationActiveIndexFromScroll(
                                    pub.id,
                                    event.nativeEvent.contentOffset.x,
                                    event.nativeEvent.layoutMeasurement.width,
                                    pub.presentation.images.length
                                  );
                                  setHomeCarouselGestureActive(false);
                                }}
                                renderItem={({ item, index }) => (
                                  <View style={styles.profilePresentationSlide}>
                                    <TouchableWithoutFeedback onPress={() => handlePublicationDoubleTap(pub.id, pub.reactions)}>
                                      <View style={[
                                        styles.carouselImageFrame,
                                        item.aspectRatio === '3:4' ? styles.carouselImageFramePortrait : styles.carouselImageFrameSquare,
                                        { width: '100%' }
                                      ]}
                                        onLayout={(e) => {
                                          const { width, height } = e.nativeEvent.layout;
                                          setHomePresentationImageLayout(pub.id, index, width, height);
                                        }}
                                      >
                                        <Image
                                          source={{ uri: getServerResourceUrl(item.uri) }}
                                          style={styles.carouselImage}
                                          resizeMode="cover"
                                          onLoadEnd={() => markHomePresentationImageLoaded(pub.id, index)}
                                          onError={() => markHomePresentationImageLoaded(pub.id, index)}
                                        />

                                        {(() => {
                                          if (!hasPresentationRings || !ringsVisible) return null;
                                          const layout = homePresentationImageLayouts[String(pub.id)]?.[index];
                                          if (!layout) return null;

                                          const ringSize = 18;
                                          const ringRadius = ringSize / 2;
                                          const points = presentationRings.filter(p => Number(p?.imageIndex) === index);
                                          if (points.length === 0) return null;

                                          return points.map((p) => {
                                            const x = Number(p?.x);
                                            const y = Number(p?.y);
                                            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

                                            const left = Math.max(0, Math.min(layout.width - ringSize, x * layout.width - ringRadius));
                                            const top = Math.max(0, Math.min(layout.height - ringSize, y * layout.height - ringRadius));

                                            return (
                                                <Pressable
                                                key={String(p.id)}
                                                  onPress={() => {
                                                    homeRingTapSuppressUntilRef.current[String(pub.id)] = Date.now() + 350;
                                                    openHomeProfileRingViewerPanelFromRing(p as ProfileRingPoint);
                                                  }}
                                                  hitSlop={10}
                                                style={{
                                                  position: 'absolute',
                                                  left,
                                                  top,
                                                  width: ringSize,
                                                  height: ringSize,
                                                  borderRadius: ringRadius,
                                                  borderWidth: 3,
                                                  borderColor: p.color || '#FFFFFF',
                                                  backgroundColor: withHexAlpha(p.color || '#FFFFFF', 0.4),
                                                }}
                                              />
                                            );
                                          });
                                        })()}

                                        {/* Double Tap Animation */}
                                        {pubDoubleTap.visible && (
                                          <View style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            zIndex: 20,
                                            pointerEvents: 'none'
                                          }}>
                                            <Animated.Text style={{
                                              fontSize: 100,
                                              transform: [{ scale: pubAnims.scale }],
                                              opacity: pubAnims.opacity,
                                              textShadowColor: 'rgba(0, 0, 0, 0.3)',
                                              textShadowOffset: { width: 0, height: 2 },
                                              textShadowRadius: 4
                                            }}>
                                              {pubDoubleTap.emoji}
                                            </Animated.Text>
                                          </View>
                                        )}
                                      </View>
                                    </TouchableWithoutFeedback>
                                  </View>
                                )}
                              />

                              <View style={styles.profilePresentationOverlay} pointerEvents="box-none">
                                {isOverlayVisible && (
                                  <View style={styles.profilePresentationOverlayContent}>
                                    <Text style={styles.profilePresentationOverlayTitle}>
                                      {trimmedTitle}
                                    </Text>
                                    <Text style={styles.profilePresentationOverlayText}>
                                      {textPreview}
                                      {hasTextOverflow && (
                                        <Text
                                          style={styles.profilePresentationToggleLink}
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            setExpandedProfileTexts(prev => ({
                                              ...prev,
                                              [pub.id]: !isTextExpanded
                                            }));
                                          }}>
                                          {' '}
                                          {isTextExpanded ? 'Leer menos' : 'Leer más...'}
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                )}

                                <View style={styles.carouselPagination}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setPresentationOverlayVisible(prev => ({
                                        ...prev,
                                        [pub.id]: !isOverlayVisible
                                      }));
                                    }}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  >
                                    <View style={styles.carouselDots}>
                                      {pub.presentation.images.map((_, dotIndex) => (
                                        <CarouselPaginationDot
                                          key={`pub-${pub.id}-dot-${dotIndex}`}
                                          active={dotIndex === activePresentationIndex}
                                        />
                                      ))}
                                    </View>
                                  </TouchableOpacity>
                                </View>

                                {pub.presentation.category && pub.presentation.category !== 'Sin categoría' && (
                                  <View style={styles.categoryBelowIndicator}>
                                    <Text style={styles.categoryBelowIndicatorText}>{getCategoryLabel(pub.presentation.category)}</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={[styles.profileMetaContainer, { paddingBottom: 0 }]}>
                              <View style={styles.profileLikeRow}>
                                <View style={{ position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                      if (!hasPresentationRings) return;
                                      toggleHomeProfileRingsVisible(String(pub.id));
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={{ paddingVertical: 2, paddingHorizontal: 2, opacity: hasPresentationRings ? 1 : 0.35 }}
                                  >
                                    <GradientIcon
                                      name="panorama-fish-eye"
                                      size={16}
                                      colors={['#FFB74D', '#ffe45c']}
                                    />
                                  </TouchableOpacity>

                                  <CountdownTimer
                                    createdAt={pub.createdAt}
                                    style={{ color: '#6e6e6eff', fontSize: 12 }}
                                    onExpire={() => {
                                      // Eliminar localmente cuando expire
                                      setPublications(prev => prev.filter(p => p.id !== pub.id));
                                    }}
                                  />
                                </View>
                                <View style={styles.profileLikeGroup}>
                                  {pub.reactions.selected.map((emoji, index) => (
                                    <TouchableOpacity
                                      key={index}
                                      onPress={() => applyPublicationReaction(pub.id, pub.reactions, emoji)}
                                      activeOpacity={0.75}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                      <Text style={{ fontSize: 18, color: '#FFFFFF', opacity: 1 }}>{emoji}</Text>
                                      <Text style={{ color: '#FFFFFF', fontSize: 12, marginLeft: 2, fontWeight: 'bold', opacity: 1 }}>{pub.reactions.counts[emoji] || 0}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            </View>

                            {/* Intimidades Container */}
                            {pub.intimidades.length > 0 && intimidadesVisible[pub.id] && (
                              <View style={{
                                width: SCREEN_WIDTH - 4,
                                alignSelf: 'center',
                                backgroundColor: '#000000',
                                borderRadius: 10,
                                marginTop: 20,
                                position: 'relative',
                                overflow: 'hidden',
                                minHeight: 110,
                              }}>
                                <View style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  borderWidth: 2.4,
                                  borderColor: '#FFB74D',
                                  borderRadius: 10,
                                  zIndex: 10,
                                  pointerEvents: 'none',
                                }} />

                                {pub.intimidades[activeIndex].type === 'image' ? (
                                  <View style={{ width: '100%' }}>
                                    <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                      <Image
                                        source={{ uri: pub.intimidades[activeIndex].content }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="cover"
                                      />
                                    </View>
                                    {pub.intimidades[activeIndex].caption ? (
                                      <View style={{ padding: 15 }}>
                                        <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                          {pub.intimidades[activeIndex].caption || ''}
                                        </Text>
                                      </View>
                                    ) : (
                                      <View style={{ height: 15 }} />
                                    )}
                                  </View>
                                ) : pub.intimidades[activeIndex].type === 'quiz' ? (
                                  <View style={{ width: '100%' }}>
                                    {pub.intimidades[activeIndex].quizData?.imageUri && (
                                      <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                        <Image
                                          source={{ uri: pub.intimidades[activeIndex].quizData?.imageUri ?? undefined }}
                                          style={{ width: '100%', height: '100%' }}
                                          resizeMode="cover"
                                        />
                                      </View>
                                    )}
                                    <View style={{ padding: 10 }}>
                                      {pub.intimidades[activeIndex].quizData?.text ? (
                                        <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'justify' }}>
                                          {pub.intimidades[activeIndex].quizData?.text || ''}
                                        </Text>
                                      ) : null}
                                      <View style={{ width: '100%' }}>
                                        {(() => {
                                          const quizData = pub.intimidades[activeIndex].quizData;
                                          const stats = quizData?.stats;
                                          const correctOption = quizData?.correctOption;
                                          if (!stats || !correctOption) return null;

                                          const total = stats.a + stats.b + stats.c + stats.d;
                                          if (total <= 0) return null;

                                          const correctCount = stats[correctOption as keyof typeof stats] ?? 0;
                                          return (
                                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 5, marginLeft: 5 }}>
                                              {correctCount} acertantes
                                            </Text>
                                          );
                                        })()}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                          {['a', 'b'].map((optionKey) => {
                                            const userSelection = pub.intimidades[activeIndex].quizData?.userSelection;
                                            const isSelected = userSelection === optionKey;
                                            const isCorrect = pub.intimidades[activeIndex].quizData?.correctOption === optionKey;
                                            const hasAnswered = !!userSelection;

                                            const showCheck = hasAnswered && isCorrect;
                                            const showX = isSelected && !isCorrect;

                                            let percentage = 0;
                                            const quizStats = pub.intimidades[activeIndex].quizData?.stats;
                                            if (hasAnswered && quizStats) {
                                              const totalVotes = quizStats.a + quizStats.b + quizStats.c + quizStats.d;
                                              const optionVotes = quizStats[optionKey as 'a' | 'b' | 'c' | 'd'];
                                              if (totalVotes > 0) {
                                                percentage = Math.round((optionVotes / totalVotes) * 100);
                                              }
                                            }

                                            return (
                                              <View key={optionKey} style={{ flex: 1, marginLeft: optionKey === 'b' ? 5 : 0, marginRight: optionKey === 'a' ? 5 : 0 }}>
                                                <TouchableOpacity
                                                  onPress={() => {
                                                    if (!pub.intimidades[activeIndex].quizData?.userSelection) {
                                                      setPublications(prev => prev.map(p => {
                                                        if (p.id === pub.id) {
                                                          const newIntimidades = [...p.intimidades];
                                                          if (newIntimidades[activeIndex].quizData) {
                                                            const existingQuizData = newIntimidades[activeIndex].quizData!;
                                                            const currentStats = existingQuizData.stats || { a: 0, b: 0, c: 0, d: 0 };
                                                            const newStats = { ...currentStats };
                                                            newStats[optionKey as 'a' | 'b' | 'c' | 'd'] = (newStats[optionKey as 'a' | 'b' | 'c' | 'd'] || 0) + 1;

                                                            newIntimidades[activeIndex].quizData = {
                                                              options: existingQuizData.options,
                                                              correctOption: existingQuizData.correctOption,
                                                              imageUri: existingQuizData.imageUri,
                                                              text: existingQuizData.text,
                                                              userSelection: optionKey,
                                                              stats: newStats
                                                            };
                                                          }
                                                          return { ...p, intimidades: newIntimidades };
                                                        }
                                                        return p;
                                                      }));

                                                      fetch(`${API_URL}/api/posts/${pub.id}/vote`, {
                                                        method: 'POST',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          'Authorization': `Bearer ${authToken}`
                                                        },
                                                        body: JSON.stringify({
                                                          intimidadIndex: activeIndex,
                                                          optionKey: optionKey
                                                        })
                                                      }).then(res => res.json())
                                                        .then(data => {
                                                          if (data.success) {
                                                            setPublications(prev => prev.map(p => {
                                                              if (p.id === pub.id) {
                                                                const newIntimidades = [...p.intimidades];
                                                                if (newIntimidades[activeIndex].quizData) {
                                                                  const existingQuizData = newIntimidades[activeIndex].quizData!;
                                                                  const newStats = { a: 0, b: 0, c: 0, d: 0 };
                                                                  Object.keys(data.counts).forEach(key => {
                                                                    if (key === 'a' || key === 'b' || key === 'c' || key === 'd') {
                                                                      newStats[key] = data.counts[key];
                                                                    }
                                                                  });

                                                                  newIntimidades[activeIndex].quizData = {
                                                                    options: existingQuizData.options,
                                                                    correctOption: existingQuizData.correctOption,
                                                                    imageUri: existingQuizData.imageUri,
                                                                    text: existingQuizData.text,
                                                                    userSelection: optionKey,
                                                                    stats: newStats
                                                                  };
                                                                }
                                                                return { ...p, intimidades: newIntimidades };
                                                              }
                                                              return p;
                                                            }));
                                                          }
                                                        })
                                                        .catch(err => console.error('Error voting:', err));
                                                    }
                                                  }}
                                                  activeOpacity={0.7}
                                                  style={{
                                                    borderWidth: 1,
                                                    borderColor: showCheck ? '#FFB74D' : showX ? '#F44336' : '#FFB74D',
                                                    borderRadius: 15,
                                                    padding: 5,
                                                    minHeight: 30,
                                                    justifyContent: 'center',
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                  }}
                                                >
                                                  <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                    <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{optionKey}. </Text>
                                                    {pub.intimidades[activeIndex].quizData?.options[optionKey as 'a' | 'b'] || ''}
                                                  </Text>
                                                  {showCheck && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                      <Text style={{ color: '#FFB74D', fontSize: 10, marginRight: 2 }}>{percentage}%</Text>
                                                      <MaterialIcons name="check-circle" size={16} color="#FFB74D" style={{ marginLeft: 4 }} />
                                                    </View>
                                                  )}
                                                  {showX && <MaterialIcons name="cancel" size={16} color="#F44336" style={{ marginLeft: 4 }} />}
                                                </TouchableOpacity>
                                              </View>
                                            );
                                          })}
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                          {['c', 'd'].map((optionKey) => {
                                            const userSelection = pub.intimidades[activeIndex].quizData?.userSelection;
                                            const isSelected = userSelection === optionKey;
                                            const isCorrect = pub.intimidades[activeIndex].quizData?.correctOption === optionKey;
                                            const hasAnswered = !!userSelection;

                                            const showCheck = hasAnswered && isCorrect;
                                            const showX = isSelected && !isCorrect;

                                            let percentage = 0;
                                            const quizStats = pub.intimidades[activeIndex].quizData?.stats;
                                            if (hasAnswered && quizStats) {
                                              const totalVotes = quizStats.a + quizStats.b + quizStats.c + quizStats.d;
                                              const optionVotes = quizStats[optionKey as 'a' | 'b' | 'c' | 'd'];
                                              if (totalVotes > 0) {
                                                percentage = Math.round((optionVotes / totalVotes) * 100);
                                              }
                                            }

                                            return (
                                              <View key={optionKey} style={{ flex: 1, marginLeft: optionKey === 'd' ? 5 : 0, marginRight: optionKey === 'c' ? 5 : 0 }}>
                                                <TouchableOpacity
                                                  onPress={() => {
                                                    if (!pub.intimidades[activeIndex].quizData?.userSelection) {
                                                      setPublications(prev => prev.map(p => {
                                                        if (p.id === pub.id) {
                                                          const newIntimidades = [...p.intimidades];
                                                          if (newIntimidades[activeIndex].quizData) {
                                                            const existingQuizData = newIntimidades[activeIndex].quizData!;
                                                            const currentStats = existingQuizData.stats || { a: 0, b: 0, c: 0, d: 0 };
                                                            const newStats = { ...currentStats };
                                                            newStats[optionKey as 'a' | 'b' | 'c' | 'd'] = (newStats[optionKey as 'a' | 'b' | 'c' | 'd'] || 0) + 1;

                                                            newIntimidades[activeIndex].quizData = {
                                                              options: existingQuizData.options,
                                                              correctOption: existingQuizData.correctOption,
                                                              imageUri: existingQuizData.imageUri,
                                                              text: existingQuizData.text,
                                                              userSelection: optionKey,
                                                              stats: newStats
                                                            };
                                                          }
                                                          return { ...p, intimidades: newIntimidades };
                                                        }
                                                        return p;
                                                      }));

                                                      fetch(`${API_URL}/api/posts/${pub.id}/vote`, {
                                                        method: 'POST',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          'Authorization': `Bearer ${authToken}`
                                                        },
                                                        body: JSON.stringify({
                                                          intimidadIndex: activeIndex,
                                                          optionKey: optionKey
                                                        })
                                                      }).then(res => res.json())
                                                        .then(data => {
                                                          if (data.success) {
                                                            setPublications(prev => prev.map(p => {
                                                              if (p.id === pub.id) {
                                                                const newIntimidades = [...p.intimidades];
                                                                if (newIntimidades[activeIndex].quizData) {
                                                                  const existingQuizData = newIntimidades[activeIndex].quizData!;
                                                                  const newStats = { a: 0, b: 0, c: 0, d: 0 };
                                                                  Object.keys(data.counts).forEach(key => {
                                                                    if (key === 'a' || key === 'b' || key === 'c' || key === 'd') {
                                                                      newStats[key] = data.counts[key];
                                                                    }
                                                                  });

                                                                  newIntimidades[activeIndex].quizData = {
                                                                    options: existingQuizData.options,
                                                                    correctOption: existingQuizData.correctOption,
                                                                    imageUri: existingQuizData.imageUri,
                                                                    text: existingQuizData.text,
                                                                    userSelection: optionKey,
                                                                    stats: newStats
                                                                  };
                                                                }
                                                                return { ...p, intimidades: newIntimidades };
                                                              }
                                                              return p;
                                                            }));
                                                          }
                                                        })
                                                        .catch(err => console.error('Error voting:', err));
                                                    }
                                                  }}
                                                  activeOpacity={0.7}
                                                  style={{
                                                    borderWidth: 1,
                                                    borderColor: showCheck ? '#FFB74D' : showX ? '#F44336' : '#FFB74D',
                                                    borderRadius: 15,
                                                    padding: 5,
                                                    minHeight: 30,
                                                    justifyContent: 'center',
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                  }}
                                                >
                                                  <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                    <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{optionKey}. </Text>
                                                    {pub.intimidades[activeIndex].quizData?.options[optionKey as 'c' | 'd'] || ''}
                                                  </Text>
                                                  {showCheck && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                      <Text style={{ color: '#FFB74D', fontSize: 10, marginRight: 2 }}>{percentage}%</Text>
                                                      <MaterialIcons name="check-circle" size={16} color="#FFB74D" style={{ marginLeft: 4 }} />
                                                    </View>
                                                  )}
                                                  {showX && <MaterialIcons name="cancel" size={16} color="#F44336" style={{ marginLeft: 4 }} />}
                                                </TouchableOpacity>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      </View>
                                    </View>
                                  </View>
                                ) : pub.intimidades[activeIndex].type === 'survey' ? (
                                  <View style={{ width: '100%' }}>
                                    {pub.intimidades[activeIndex].surveyData?.imageUri && (
                                      <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                        <Image
                                          source={{ uri: pub.intimidades[activeIndex].surveyData?.imageUri ?? undefined }}
                                          style={{ width: '100%', height: '100%' }}
                                          resizeMode="cover"
                                        />
                                      </View>
                                    )}
                                    <View style={{ padding: 10 }}>
                                      {pub.intimidades[activeIndex].surveyData?.text ? (
                                        <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'justify' }}>
                                          {pub.intimidades[activeIndex].surveyData?.text || ''}
                                        </Text>
                                      ) : null}
                                      <View style={{ width: '100%' }}>
                                        {(() => {
                                          const stats = pub.intimidades[activeIndex].surveyData?.stats;
                                          if (!stats) return null;
                                          const totalVotes = stats.reduce((a, b) => a + b, 0);
                                          if (totalVotes <= 0) return null;
                                          return (
                                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 5, marginLeft: 5 }}>
                                              {totalVotes} votos
                                            </Text>
                                          );
                                        })()}
                                        {pub.intimidades[activeIndex].surveyData?.options.map((option, idx) => {
                                          const userSelection = pub.intimidades[activeIndex].surveyData?.userSelection;
                                          const isSelected = userSelection === idx;
                                          const hasAnswered = userSelection !== null && userSelection !== undefined;

                                          let percentage = 0;
                                          if (hasAnswered && pub.intimidades[activeIndex].surveyData?.stats) {
                                            const stats = pub.intimidades[activeIndex].surveyData?.stats;
                                            const totalVotes = stats ? stats.reduce((a, b) => a + b, 0) : 0;
                                            const optionVotes = stats ? stats[idx] : 0;
                                            if (totalVotes > 0) {
                                              percentage = Math.round((optionVotes / totalVotes) * 100);
                                            }
                                          }

                                          return (
                                            <TouchableOpacity
                                              key={idx}
                                              onPress={() => {
                                                if (pub.intimidades[activeIndex].surveyData?.userSelection === null || pub.intimidades[activeIndex].surveyData?.userSelection === undefined) {
                                                  setPublications(prev => prev.map(p => {
                                                    if (p.id === pub.id) {
                                                      const newIntimidades = [...p.intimidades];
                                                      if (newIntimidades[activeIndex].surveyData) {
                                                        const existingSurveyData = newIntimidades[activeIndex].surveyData!;
                                                        const currentStats = existingSurveyData.stats || new Array(existingSurveyData.options.length).fill(0);
                                                        const newStats = [...currentStats];
                                                        newStats[idx] = (newStats[idx] || 0) + 1;

                                                        newIntimidades[activeIndex].surveyData = {
                                                          options: existingSurveyData.options,
                                                          imageUri: existingSurveyData.imageUri,
                                                          text: existingSurveyData.text,
                                                          userSelection: idx,
                                                          stats: newStats
                                                        };
                                                      }
                                                      return { ...p, intimidades: newIntimidades };
                                                    }
                                                    return p;
                                                  }));

                                                  fetch(`${API_URL}/api/posts/${pub.id}/vote`, {
                                                    method: 'POST',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                      'Authorization': `Bearer ${authToken}`
                                                    },
                                                    body: JSON.stringify({
                                                      intimidadIndex: activeIndex,
                                                      optionKey: idx.toString()
                                                    })
                                                  }).then(res => res.json())
                                                    .then(data => {
                                                      if (data.success) {
                                                        setPublications(prev => prev.map(p => {
                                                          if (p.id === pub.id) {
                                                            const newIntimidades = [...p.intimidades];
                                                            if (newIntimidades[activeIndex].surveyData) {
                                                              const existingSurveyData = newIntimidades[activeIndex].surveyData!;
                                                              const optionsCount = existingSurveyData.options.length;
                                                              const newStats = new Array(optionsCount).fill(0);
                                                              Object.keys(data.counts).forEach(key => {
                                                                const index = parseInt(key);
                                                                if (!isNaN(index) && index < optionsCount) {
                                                                  newStats[index] = data.counts[key];
                                                                }
                                                              });

                                                              newIntimidades[activeIndex].surveyData = {
                                                                options: existingSurveyData.options,
                                                                imageUri: existingSurveyData.imageUri,
                                                                text: existingSurveyData.text,
                                                                userSelection: existingSurveyData.userSelection,
                                                                stats: newStats
                                                              };
                                                            }
                                                            return { ...p, intimidades: newIntimidades };
                                                          }
                                                          return p;
                                                        }));
                                                      }
                                                    })
                                                    .catch(err => console.error('Error voting:', err));
                                                }
                                              }}
                                              activeOpacity={0.7}
                                              style={{
                                                borderWidth: 1,
                                                borderColor: isSelected ? '#FFB74D' : '#FFB74D',
                                                backgroundColor: isSelected ? 'rgba(255, 183, 77, 0.1)' : 'transparent',
                                                borderRadius: 15,
                                                padding: 8,
                                                marginBottom: 8,
                                                justifyContent: 'center',
                                                flexDirection: 'row',
                                                alignItems: 'center'
                                              }}
                                            >
                                              <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{String.fromCharCode(97 + idx)}. </Text>
                                                {option || ''}
                                              </Text>
                                              {hasAnswered && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                  <Text style={{ color: '#FFB74D', fontSize: 10, marginRight: 2 }}>{percentage}%</Text>
                                                  {isSelected && <MaterialIcons name="check-circle" size={16} color="#FFB74D" style={{ marginLeft: 4 }} />}
                                                </View>
                                              )}
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={{ padding: 15, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 110 }}>
                                    <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                      {pub.intimidades[activeIndex].content || ''}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )
                            }

                            {/* ICON_KEITIN Container */}
                            < View style={[styles.profileMetaContainer, { paddingTop: 0 }]} >
                              <TouchableOpacity
                                style={styles.bottomPanel}
                                activeOpacity={0.7}
                                onPress={() => {
                                  if (pub.intimidades.length > 0) {
                                    if (!intimidadesVisible[pub.id]) {
                                      showRewardedToRevealIntimidades(pub.id);
                                    } else if (pub.intimidades.length > 1) {
                                      setActiveIntimidadIndices(prev => ({
                                        ...prev,
                                        [pub.id]: ((prev[pub.id] || 0) + 1) % pub.intimidades.length
                                      }));
                                    }
                                  }
                                }}
                              >
                                <Image source={ICON_KEITIN} style={styles.profileBrandIcon} resizeMode="contain" />
                                {pub.intimidades.length > 0 && (
                                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
                                    {pub.intimidades.map((_, idx) => (
                                      <View
                                        key={idx}
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: 3,
                                          backgroundColor: idx === activeIndex ? '#FFB74D' : 'rgba(255, 183, 77, 0.3)',
                                        }}
                                      />
                                    ))}
                                  </View>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                      </Animated.View>
                    );
                  })}
                  {
                    giveAways.map((giveaway, index) => (
                      <View key={giveaway.id} style={styles.giveAwayCard}>
                        <Text style={styles.giveAwayPulsacionesText}>
                          Sorteo {index + 1}
                        </Text>
                        {/* TODO: Renderizar cada sorteo completo */}
                      </View>
                    ))
                  }
                </>
              )
              }
            </ScrollView >
          </View >
        )}

        {/* Pantalla Profile */}
        {
          activeBottomTab === 'profile' && (
            <View style={[styles.profileScreenContainer, { paddingBottom: bottomNavHeight + 16 }]}>
              {profileView === 'profile' ? (
                <ScrollView key={`profile-main-view-${profileViewMountKey}`} contentContainerStyle={styles.profileScrollContent}>
                  {profilePresentation ? (
                    <>
                      <View style={styles.presentationHeaderContainer}>
                        {/* En "Tu perfil" ocultamos avatar/@usuario/redes y dejamos solo la acción + país */}
                        <TouchableOpacity
                          onPress={() => {
                            if (isPublished) {
                              setTimeout(() => {
                                handleDeletePublication();
                              }, 200);
                            } else {
                              handlePublish();
                            }
                          }}
                          onPressIn={() => {
                            if (!isPublished) return;
                            profilePublishActionGlowAnim.stopAnimation();
                            profilePublishActionGlowAnim.setValue(0);
                            Animated.sequence([
                              Animated.timing(profilePublishActionGlowAnim, {
                                toValue: 1,
                                duration: 80,
                                useNativeDriver: false,
                              }),
                              Animated.timing(profilePublishActionGlowAnim, {
                                toValue: 0,
                                duration: 120,
                                useNativeDriver: false,
                              }),
                            ]).start();
                          }}
                          disabled={!isPublished && intimidades.length === 0}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{
                            alignItems: 'flex-start',
                            opacity: (isPublished || intimidades.length > 0) ? 1 : 0.5,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            position: 'relative',
                          }}
                          activeOpacity={0.85}
                        >
                          {isPublished && (
                            <Animated.View
                              pointerEvents="none"
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                                borderRadius: 12,
                                backgroundColor: profilePublishActionGlowAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['rgba(255, 183, 77, 0)', 'rgba(255, 255, 255, 0.25)'],
                                }),
                                borderWidth: 0,
                                borderColor: 'rgba(255, 183, 77, 0)',
                                shadowColor: '#ffffffba',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: profilePublishActionGlowAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 0.6],
                                }) as any,
                                shadowRadius: 8,
                              }}
                            />
                          )}
                          <Text style={{
                            color: isPublished ? 'rgba(255,255,255,0.7)' : '#FFFFFF',
                            fontSize: 14,
                            fontWeight: isPublished ? 'normal' : 'bold',
                            marginBottom: isPublished ? 0 : 4,
                          }}>
                            {isPublished ? t('front.remove' as TranslationKey) : t('front.publish' as TranslationKey)}
                          </Text>
                          {!isPublished && (
                            <View style={{
                              width: 40,
                              height: 3,
                              backgroundColor: '#ffae35ff',
                              borderRadius: 1.5
                            }} />
                          )}
                        </TouchableOpacity>

                        <View style={{ justifyContent: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>{nationality}</Text>
                        </View>
                      </View>
                      {profilePresentation.images.length > 0 && (
                        <View>
                          <View style={styles.profilePresentationCarousel}>
                            {(() => {
                              const total = profilePresentation.images.length;
                              const loadedCount = Math.min(total, profilePresentationLoadedCount);
                              const isLoading = loadedCount < total;
                              if (!isLoading) return null;

                              return (
                                <View style={styles.profileCarouselLoadingOverlay} pointerEvents="none">
                                  <GradientSpinner size={34} />
                                  <View style={styles.profileCarouselLoadingPill}>
                                    <Text style={styles.profileCarouselLoadingText}>{t('front.loadingImages' as TranslationKey)}</Text>
                                    <Text style={styles.profileCarouselLoadingSubText}>{loadedCount}/{total}</Text>
                                  </View>
                                </View>
                              );
                            })()}
                            <FlatList
                              key={`profile-presentation-carousel-${profileCarouselMountKey}-${profilePresentation.images.length}-${profilePresentationLoadedCount}`}
                              data={profilePresentation.images}
                              keyExtractor={(_, index) => `profile-presentation-image-${index}`}
                              extraData={profilePresentationImagesLoaded}
                              horizontal
                              pagingEnabled
                              bounces={false}
                              decelerationRate="fast"
                              snapToAlignment="center"
                              snapToInterval={SCREEN_WIDTH - 4}
                              showsHorizontalScrollIndicator={false}
                              removeClippedSubviews={false}
                              onViewableItemsChanged={handleProfileViewableItemsChanged.current}
                              viewabilityConfig={carouselViewabilityConfig.current}
                              renderItem={({ item, index }) => (
                                <View style={styles.profilePresentationSlide}>
                                  <View
                                    style={[
                                      styles.carouselImageFrame,
                                      item.aspectRatio === '3:4'
                                        ? styles.carouselImageFramePortrait
                                        : styles.carouselImageFrameSquare,
                                      { width: '100%' }
                                    ]}>
                                    <Pressable
                                      style={{ width: '100%', height: '100%' }}
                                      onLayout={(e) => {
                                        const { width, height } = e.nativeEvent.layout;
                                        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
                                        setProfileCarouselImageLayouts(prev => {
                                          const prevEntry = prev[index];
                                          if (prevEntry && prevEntry.width === width && prevEntry.height === height) return prev;
                                          return { ...prev, [index]: { width, height } };
                                        });
                                      }}
                                      onPress={(e) => handleProfileCarouselImagePress(index, e)}
                                    >
                                      <Image
                                        source={{ uri: getServerResourceUrl(item.uri) }}
                                        style={styles.carouselImage}
                                        resizeMode="cover"
                                        onLoadEnd={() => markProfilePresentationImageLoaded(index)}
                                        onError={() => markProfilePresentationImageLoaded(index)}
                                      />
                                      {(() => {
                                        const layout = profileCarouselImageLayouts[index];
                                        if (!layout) return null;

                                        const ringSize = 18;
                                        const ringRadius = ringSize / 2;
                                        const points = profileRingPoints.filter(p => p.imageIndex === index);
                                        if (points.length === 0) return null;

                                        return points.map(p => {
                                          const left = Math.max(0, Math.min(layout.width - ringSize, p.x * layout.width - ringRadius));
                                          const top = Math.max(0, Math.min(layout.height - ringSize, p.y * layout.height - ringRadius));
                                          return (
                                            <Pressable
                                              key={p.id}
                                              onPress={() => handleProfileRingPress(p.id)}
                                              hitSlop={10}
                                              style={{
                                                position: 'absolute',
                                                left,
                                                top,
                                                width: ringSize,
                                                height: ringSize,
                                                borderRadius: ringRadius,
                                                borderWidth: 3,
                                                borderColor: p.color || '#FFFFFF',
                                                backgroundColor: withHexAlpha(p.color || '#FFFFFF', 0.4),
                                              }}
                                            />
                                          );
                                        });
                                      })()}
                                    </Pressable>
                                  </View>
                                </View>
                              )}
                            />

                            {showProfileRingHint && (
                              <View style={styles.profileRingHintOverlay} pointerEvents="none">
                                <View style={styles.profileRingHintPill}>
                                  <Text style={styles.profileRingHintText}>
                                    {profileRingHintMessage}
                                  </Text>
                                </View>
                              </View>
                            )}

                            <View style={styles.profilePresentationOverlay} pointerEvents="box-none">
                              {isPresentationOverlayVisible && (
                                <View style={styles.profilePresentationOverlayContent}>
                                  <Text style={styles.profilePresentationOverlayTitle}>
                                    {trimmedProfileTitle}
                                  </Text>
                                  <Text style={styles.profilePresentationOverlayText}>
                                    {profileTextPreview}
                                    {hasProfileTextOverflow && (
                                      <Text
                                        style={styles.profilePresentationToggleLink}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          setIsProfileTextExpanded(prev => !prev);
                                        }}>
                                        {' '}
                                        {isProfileTextExpanded ? 'Leer menos' : 'Leer más...'}
                                      </Text>
                                    )}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.carouselPagination}>
                                <TouchableOpacity
                                  onPress={() => setIsPresentationOverlayVisible(prev => !prev)}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <View style={styles.carouselDots}>
                                    {profilePresentation.images.map((_, index) => (
                                      <CarouselPaginationDot
                                        key={`profile-dot-${index}`}
                                        active={index === activeProfileImageIndex}
                                      />
                                    ))}
                                  </View>
                                </TouchableOpacity>
                              </View>
                              {profilePresentation.category && profilePresentation.category !== 'Sin categoría' && (
                                <View style={styles.categoryBelowIndicator}>
                                  <Text style={styles.categoryBelowIndicatorText}>{getCategoryLabel(profilePresentation.category)}</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={[styles.profileMetaContainer, { paddingBottom: 0 }]}>
                            <View style={styles.profileLikeRow}>
                              <View style={{ position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={handleProfileRingIconPress}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={{ paddingVertical: 2, paddingHorizontal: 2 }}
                                >
                                  <GradientIcon
                                    name="panorama-fish-eye"
                                    size={16}
                                    colors={['#FFB74D', '#ffe45c']}
                                  />
                                </TouchableOpacity>
                                {isPublished && myPublication ? (
                                  <CountdownTimer
                                    createdAt={myPublication.createdAt}
                                    style={{ color: '#6e6e6eff', fontSize: 12 }}
                                    onExpire={() => {
                                      void confirmDeletePublication('expire');
                                    }}
                                  />
                                ) : (
                                  <Text style={{ color: '#6e6e6eff', fontSize: 12 }}>{t('front.time' as TranslationKey)}</Text>
                                )}
                              </View>
                              <View style={styles.profileLikeGroup}>
                                {!isPublished && (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                    activeOpacity={0.7}
                                    onPress={toggleReactionPanel}
                                  >
                                    {/* Placeholder for iconoreaccion */}
                                    <GradientIcon name="add-reaction" size={24} colors={['#FFFFFF', '#FFB74D']} />
                                  </TouchableOpacity>
                                )}
                                {selectedReactions.map((emoji, index) => (
                                  <View
                                    key={index}
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                  >
                                    <Text style={{ fontSize: 18, color: '#FFFFFF', opacity: 1 }}>{emoji}</Text>
                                    {isPublished && myPublication ? (
                                      <Text style={{ color: '#FFFFFF', fontSize: 12, marginLeft: 2, fontWeight: 'bold', opacity: 1 }}>
                                        {myPublication?.reactions?.counts?.[emoji] ?? reactionCounts?.[emoji] ?? 0}
                                      </Text>
                                    ) : null}
                                  </View>
                                ))}
                              </View>
                            </View>
                          </View>

                          {(() => {
                            if (intimidades.length === 0) return null;
                            const safeIndex = Math.min(activeIntimidadIndex, intimidades.length - 1);
                            const activeIntimidad = intimidades[safeIndex];
                            if (!activeIntimidad) return null;

                            return (
                              <View style={{
                                width: SCREEN_WIDTH - 4,
                                alignSelf: 'center',
                                marginTop: 20,
                                position: 'relative'
                              }}>
                                <View style={{
                                  width: '100%',
                                  backgroundColor: '#000000',
                                  borderRadius: 10,
                                  position: 'relative',
                                  overflow: 'hidden',
                                  minHeight: 110,
                                }}>
                                  <View style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    borderWidth: 2.4,
                                    borderColor: '#FFB74D',
                                    borderRadius: 10,
                                    zIndex: 10,
                                    pointerEvents: 'none',
                                  }} />

                                  {activeIntimidad.type === 'image' ? (
                                    <View style={{ width: '100%' }}>
                                      <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                        <Image
                                          source={{ uri: activeIntimidad.content }}
                                          style={{ width: '100%', height: '100%' }}
                                          resizeMode="cover"
                                        />
                                      </View>
                                      {activeIntimidad.caption ? (
                                        <View style={{ padding: 15 }}>
                                          <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                            {activeIntimidad.caption}
                                          </Text>
                                        </View>
                                      ) : (
                                        <View style={{ height: 15 }} />
                                      )}
                                    </View>
                                  ) : activeIntimidad.type === 'quiz' ? (
                                    <View style={{ width: '100%' }}>
                                      {/* Updated quiz view for profile */}
                                      {activeIntimidad.quizData?.imageUri && (
                                        <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                          <Image
                                            source={{ uri: activeIntimidad.quizData?.imageUri ?? undefined }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                          />
                                        </View>
                                      )}
                                      <View style={{ padding: 10 }}>
                                        {activeIntimidad.quizData?.text ? (
                                          <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'justify' }}>
                                            {activeIntimidad.quizData?.text}
                                          </Text>
                                        ) : null}
                                        <View style={{ width: '100%' }}>
                                          {(() => {
                                            // Mostrar stats SOLO cuando la publicación esté activa en Home (24h)
                                            if (!isPublished || !myPublication) return null;

                                            const created = parseServerDate(myPublication.createdAt as any);
                                            if (!Number.isFinite(created.getTime())) return null;
                                            const expiresAt = created.getTime() + POST_TTL_MS;
                                            if (Date.now() >= expiresAt) return null;

                                            const quizData = activeIntimidad.quizData;
                                            const stats = quizData?.stats;
                                            const correctOption = quizData?.correctOption as ('a' | 'b' | 'c' | 'd' | undefined);
                                            if (!stats || !correctOption) return null;

                                            const total = stats.a + stats.b + stats.c + stats.d;
                                            if (total <= 0) return null;

                                            const correctCount = stats[correctOption] ?? 0;
                                            return (
                                              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 5, marginLeft: 5 }}>
                                                {correctCount} acertantes
                                              </Text>
                                            );
                                          })()}
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                            {['a', 'b'].map((optionKey) => {
                                              const quizData = activeIntimidad.quizData;
                                              const stats = quizData?.stats;
                                              const correctOption = quizData?.correctOption as ('a' | 'b' | 'c' | 'd' | undefined);

                                              const created = myPublication ? parseServerDate(myPublication.createdAt as any) : null;
                                              const isActive = !!(isPublished && myPublication && created && Number.isFinite(created.getTime()) && (Date.now() < (created.getTime() + POST_TTL_MS)));
                                              const canShowStats = isActive && !!stats && !!correctOption;

                                              const totalVotes = canShowStats ? (stats!.a + stats!.b + stats!.c + stats!.d) : 0;
                                              const optionVotes = canShowStats ? (stats![optionKey as 'a' | 'b' | 'c' | 'd'] ?? 0) : 0;
                                              const percentage = canShowStats && totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                              const isCorrect = canShowStats && correctOption === optionKey;

                                              return (
                                                <View key={optionKey} style={{ flex: 1, marginLeft: optionKey === 'b' ? 5 : 0, marginRight: optionKey === 'a' ? 5 : 0 }}>
                                                  <View
                                                    style={{
                                                      borderWidth: 1,
                                                      borderColor: '#FFB74D',
                                                      borderRadius: 15,
                                                      padding: 5,
                                                      minHeight: 30,
                                                      justifyContent: 'center',
                                                      flexDirection: 'row',
                                                      alignItems: 'center'
                                                    }}
                                                  >
                                                    <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                      <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{optionKey}. </Text>
                                                      {activeIntimidad.quizData?.options[optionKey as 'a' | 'b']}
                                                    </Text>
                                                    {canShowStats && totalVotes > 0 ? (
                                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={{ color: '#FFB74D', fontSize: 10, marginRight: 2 }}>{percentage}%</Text>
                                                        {isCorrect ? (
                                                          <MaterialIcons name="check-circle" size={16} color="#FFB74D" style={{ marginLeft: 4 }} />
                                                        ) : null}
                                                      </View>
                                                    ) : null}
                                                  </View>
                                                </View>
                                              );
                                            })}
                                          </View>
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            {['c', 'd'].map((optionKey) => {
                                              const quizData = activeIntimidad.quizData;
                                              const stats = quizData?.stats;
                                              const correctOption = quizData?.correctOption as ('a' | 'b' | 'c' | 'd' | undefined);

                                              const created = myPublication ? new Date(myPublication.createdAt as any) : null;
                                              const isActive = !!(isPublished && myPublication && created && Number.isFinite(created.getTime()) && (Date.now() < (created.getTime() + POST_TTL_MS)));
                                              const canShowStats = isActive && !!stats && !!correctOption;

                                              const totalVotes = canShowStats ? (stats!.a + stats!.b + stats!.c + stats!.d) : 0;
                                              const optionVotes = canShowStats ? (stats![optionKey as 'a' | 'b' | 'c' | 'd'] ?? 0) : 0;
                                              const percentage = canShowStats && totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                              const isCorrect = canShowStats && correctOption === optionKey;

                                              return (
                                                <View key={optionKey} style={{ flex: 1, marginLeft: optionKey === 'd' ? 5 : 0, marginRight: optionKey === 'c' ? 5 : 0 }}>
                                                  <View
                                                    style={{
                                                      borderWidth: 1,
                                                      borderColor: '#FFB74D',
                                                      borderRadius: 15,
                                                      padding: 5,
                                                      minHeight: 30,
                                                      justifyContent: 'center',
                                                      flexDirection: 'row',
                                                      alignItems: 'center'
                                                    }}
                                                  >
                                                    <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                      <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{optionKey}. </Text>
                                                      {activeIntimidad.quizData?.options[optionKey as 'c' | 'd']}
                                                    </Text>
                                                    {canShowStats && totalVotes > 0 ? (
                                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={{ color: '#FFB74D', fontSize: 10, marginRight: 2 }}>{percentage}%</Text>
                                                        {isCorrect ? (
                                                          <MaterialIcons name="check-circle" size={16} color="#FFB74D" style={{ marginLeft: 4 }} />
                                                        ) : null}
                                                      </View>
                                                    ) : null}
                                                  </View>
                                                </View>
                                              );
                                            })}
                                          </View>
                                        </View>
                                      </View>
                                    </View>
                                  ) : activeIntimidad.type === 'survey' ? (
                                    <View style={{ width: '100%' }}>
                                      {activeIntimidad.surveyData?.imageUri && (
                                        <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                                          <Image
                                            source={{ uri: activeIntimidad.surveyData?.imageUri ?? undefined }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                          />
                                        </View>
                                      )}
                                      <View style={{ padding: 10 }}>
                                        {activeIntimidad.surveyData?.text ? (
                                          <Text style={{ color: '#FFFFFF', marginBottom: 10, textAlign: 'justify' }}>
                                            {activeIntimidad.surveyData?.text}
                                          </Text>
                                        ) : null}
                                        <View style={{ width: '100%' }}>
                                          {(() => {
                                            const created = myPublication ? new Date(myPublication.createdAt as any) : null;
                                            const isActive = !!(isPublished && myPublication && created && Number.isFinite(created.getTime()) && (Date.now() < (created.getTime() + POST_TTL_MS)));

                                            const stats = activeIntimidad.surveyData?.stats;
                                            const totalVotes = isActive && stats ? stats.reduce((a, b) => a + b, 0) : 0;

                                            return (
                                              <>
                                                {isActive && totalVotes > 0 ? (
                                                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 5, marginLeft: 5 }}>
                                                    {totalVotes} votos
                                                  </Text>
                                                ) : null}

                                                {activeIntimidad.surveyData?.options.map((option, idx) => {
                                                  const optionVotes = isActive && stats ? (stats[idx] ?? 0) : 0;
                                                  const percentage = isActive && totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

                                                  return (
                                                    <View
                                                      key={idx}
                                                      style={{
                                                        borderWidth: 1,
                                                        borderColor: '#FFB74D',
                                                        borderRadius: 15,
                                                        padding: 8,
                                                        marginBottom: 8,
                                                        justifyContent: 'center',
                                                        flexDirection: 'row',
                                                        alignItems: 'center'
                                                      }}
                                                    >
                                                      <Text style={{ color: '#FFFFFF', fontSize: 12, flex: 1 }}>
                                                        <Text style={{ fontWeight: 'bold', color: '#FFB74D' }}>{String.fromCharCode(97 + idx)}. </Text>
                                                        {option}
                                                      </Text>
                                                      {isActive && totalVotes > 0 ? (
                                                        <Text style={{ color: '#FFB74D', fontSize: 10, marginLeft: 6 }}>{percentage}%</Text>
                                                      ) : null}
                                                    </View>
                                                  );
                                                })}
                                              </>
                                            );
                                          })()}
                                        </View>
                                      </View>
                                    </View>
                                  ) : (
                                    <View style={{ padding: 15, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 110 }}>
                                      <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                        {activeIntimidad.content}
                                      </Text>
                                    </View>
                                  )}

                                </View>

                                <TouchableOpacity
                                  style={{
                                    position: 'absolute',
                                    bottom: -32,
                                    right: 0,
                                    zIndex: 20,
                                    padding: 5
                                  }}
                                  onPress={() => handleDeleteIntimidad(safeIndex)}
                                >
                                  <MaterialIcons name="delete" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            );
                          })()}
                          <View style={[styles.profileMetaContainer, { paddingTop: 0, marginTop: 24 }]}>
                            <TouchableOpacity
                              style={styles.bottomPanel}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (intimidades.length === 0) {
                                  setProfileView('intimidades');
                                  return;
                                }

                                if (intimidades.length > 1) {
                                  setActiveIntimidadIndex((prev) => (prev + 1) % intimidades.length);
                                }
                              }}
                            >
                              <Image source={ICON_KEITIN} style={styles.profileBrandIcon} resizeMode="contain" />
                              {intimidades.length > 0 && (
                                <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
                                  {intimidades.map((_, idx) => (
                                    <View
                                      key={idx}
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: idx === Math.min(activeIntimidadIndex, intimidades.length - 1) ? '#FFB74D' : 'rgba(255, 183, 77, 0.3)',
                                      }}
                                    />
                                  ))}
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Text style={styles.profileEmptyPrimaryMessage}>
                        {t('front.profileEmptyPrimaryMessage' as TranslationKey)}
                      </Text>
                      <Text style={styles.profileEmptySecondaryMessage}>
                        {t('front.profileEmptySecondaryMessage' as TranslationKey)}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              ) : profileView === 'presentation' ? (
                <View style={{ flex: 1 }}>
                  <ScrollView
                    scrollEnabled={!isPublished}
                    contentContainerStyle={{ paddingTop: 0, paddingBottom: 80 }}
                  >
                    <View style={styles.categorySelectorContainer}>
                    <Text style={styles.categoryLabel}>{t('front.category' as TranslationKey)}</Text>
                    <TouchableOpacity
                      style={styles.categoryButton}
                      onPress={() => setShowCategoryModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.categoryButtonText}>{getCategoryLabel(selectedCategory)}</Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#FFB74D" />
                    </TouchableOpacity>
                    </View>

                  {/* Carrusel de imágenes */}
                  {carouselImages.length > 0 && (
                    <View style={styles.carouselViewer}>
                      <FlatList
                        data={carouselImages}
                        keyExtractor={(_, index) => `carousel-image-${index}`}
                        horizontal
                        pagingEnabled
                        bounces={false}
                        decelerationRate="fast"
                        snapToAlignment="center"
                        snapToInterval={SCREEN_WIDTH}
                        showsHorizontalScrollIndicator={false}
                        removeClippedSubviews={false}
                        onViewableItemsChanged={handleCarouselViewableItemsChanged.current}
                        viewabilityConfig={carouselViewabilityConfig.current}
                        renderItem={({ item, index }) => (
                          <View style={styles.carouselImageSlide}>
                            <View
                              style={[
                                styles.carouselImageFrame,
                                item.aspectRatio === '3:4'
                                  ? styles.carouselImageFramePortrait
                                  : styles.carouselImageFrameSquare,
                              ]}>
                              <Image
                                source={{ uri: item.uri }}
                                style={styles.carouselImage}
                                resizeMode="cover"
                              />
                              <View style={styles.presentationOverlay} pointerEvents="box-none">
                                <View style={styles.overlayField}>
                                  <Text style={styles.overlayLabel}>{t('front.presentationTitleLabel' as TranslationKey)}</Text>
                                  <TextInput
                                    style={styles.overlayInput}
                                    placeholder={t('front.presentationTitlePlaceholder' as TranslationKey)}
                                    placeholderTextColor="rgba(255, 255, 255, 0.27)"
                                    value={presentationTitle}
                                    onChangeText={text => {
                                      if (text.length <= 120) {
                                        setPresentationTitle(text);
                                      }
                                    }}
                                    maxLength={120}
                                  />
                                  <Text style={styles.overlayCount}>
                                    {presentationTitle.length}/120
                                  </Text>
                                </View>
                                <View style={[styles.overlayField, styles.overlayFieldLarge]}>
                                  <Text style={styles.overlayLabel}>{t('front.presentationBodyLabel' as TranslationKey)}</Text>
                                  <TextInput
                                    style={[styles.overlayInput, styles.overlayInputMultiline]}
                                    placeholder={t('front.presentationBodyPlaceholder' as TranslationKey)}
                                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                    value={presentationText}
                                    onChangeText={text => {
                                      if (text.length <= 480) {
                                        setPresentationText(text);
                                      }
                                    }}
                                    maxLength={480}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                  />
                                  <Text style={styles.overlayCount}>
                                    {presentationText.length}/480
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.imageActionsOverlay}>
                                <TouchableOpacity
                                  style={styles.editImageButton}
                                  onPress={() => handleEditCarouselImage(index)}
                                  activeOpacity={0.7}>
                                  <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.removeImageButton}
                                  onPress={() => handleRemoveCarouselImage(index)}
                                  activeOpacity={0.7}>
                                  <MaterialIcons name="close" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        )}
                        style={styles.carouselFlatList}
                      />
                      <View style={styles.carouselPagination}>
                        <View style={styles.carouselDots}>
                          {carouselImages.map((_, index) => (
                            <CarouselPaginationDot
                              key={`carousel-dot-${index}`}
                              active={index === activeCarouselImageIndex}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {carouselImages.length === 0 && (
                    <View style={styles.addCarouselSection}>
                      <TouchableOpacity
                        style={styles.plusIconContainer}
                        onPress={handleSelectCarouselImages}
                        activeOpacity={0.7}>
                        <View style={[styles.plusLine, styles.plusLineVertical]} />
                        <View style={[styles.plusLine, styles.plusLineHorizontal]} />
                      </TouchableOpacity>
                      <Text style={styles.addCarouselText}>
                        {t('front.presentationAddCarouselHint' as TranslationKey)}
                      </Text>
                    </View>
                  )}

                  {/* Botón Aplicar */}
                  <TouchableOpacity
                    style={[styles.applyButton, canApplyPresentation ? styles.applyButtonActive : styles.applyButtonDisabled]}
                    activeOpacity={canApplyPresentation ? 0.7 : 1}
                    onPress={handleApplyPresentation}
                    disabled={!canApplyPresentation}>
                    <Text style={[styles.applyButtonText, canApplyPresentation ? styles.applyButtonTextActive : styles.applyButtonTextDisabled]}>{t('common.apply' as TranslationKey)}</Text>
                  </TouchableOpacity>
                  </ScrollView>

                  {isPublished && (
                    <View style={styles.profilePresentationLockedOverlay} pointerEvents="auto">
                      <View style={styles.profilePresentationLockedCard}>
                        <Text style={styles.profilePresentationLockedTitle}>
                          {t('front.presentationLockedTitle' as TranslationKey)}
                        </Text>
                        <Text style={styles.profilePresentationLockedText}>
                          {t('front.presentationLockedBody' as TranslationKey)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <KeyboardAvoidingView
                  style={{ flex: 1 }}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : (ANDROID_STATUS_BAR_HEIGHT || 0)}
                >
                <ScrollView
                  contentContainerStyle={{ paddingTop: 20, paddingBottom: isKeyboardVisible ? (keyboardHeight || 0) + 40 : 80 }}
                  keyboardShouldPersistTaps="handled"
                >

                  <View
                    pointerEvents={hasImageOrTextIntimidad ? 'none' : 'auto'}
                    style={{
                      width: '100%',
                      minHeight: 110,
                      backgroundColor: '#000000',
                      borderRadius: 10,
                      marginBottom: 20,
                      justifyContent: intimidadesImageUri ? 'flex-start' : 'center',
                      alignItems: 'center',
                      paddingTop: intimidadesImageUri ? 0 : 2,
                      paddingBottom: intimidadesImageUri ? 8 : 18,
                      position: 'relative',
                      overflow: 'hidden',
                      opacity: hasImageOrTextIntimidad ? 0.5 : 1,
                    }}>
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderWidth: 2.4,
                      borderColor: '#FFB74D',
                      borderRadius: 10,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }} />
                    <View style={{
                      width: '100%',
                      marginTop: intimidadesImageUri ? 0 : 15,
                      paddingHorizontal: intimidadesImageUri ? 0 : 10
                    }}>
                      {intimidadesImageUri ? (
                        <View style={{ width: '100%' }}>
                          <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                            <Image
                              source={{ uri: intimidadesImageUri }}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 }}
                              onPress={() => {
                                setIntimidadesImageUri(null);
                                setIsUploadingIntimidadesImage(false);
                              }}
                            >
                              <MaterialIcons name="close" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                            <TextInput
                              style={{
                                color: '#FFFFFF',
                                fontSize: 14,
                                textAlignVertical: 'top',
                                minHeight: 40,
                              }}
                              multiline
                              maxLength={480}
                              placeholder="Escribe un pie de foto..."
                              placeholderTextColor="rgba(255, 255, 255, 0.5)"
                              value={textInputValue}
                              onChangeText={setTextInputValue}
                            />
                            <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                              {textInputValue.length}/480
                            </Text>
                          </View>
                        </View>
                      ) : showTextInput ? (
                        <View style={{ backgroundColor: 'rgba(45, 27, 14, 0.5)', borderRadius: 10, padding: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <TouchableOpacity onPress={() => setShowTextInput(false)}>
                              <MaterialIcons name="chevron-left" size={24} color="#FFB74D" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setAppliedText(textInputValue);
                                setShowTextInput(false);
                              }}
                              disabled={textInputValue.length === 0}
                            >
                              <Text style={{
                                color: textInputValue.length > 0 ? '#FFB74D' : 'rgba(255, 183, 77, 0.5)',
                                fontWeight: 'bold',
                                fontSize: 14
                              }}>
                                {t('common.apply' as TranslationKey)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: 8,
                              color: '#FFFFFF',
                              padding: 10,
                              height: 100,
                              textAlignVertical: 'top',
                              fontSize: 14,
                            }}
                            multiline
                            maxLength={480}
                            placeholder={t('front.draftIntimacyPlaceholder' as TranslationKey)}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={textInputValue}
                            onChangeText={setTextInputValue}
                          />
                          <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                            {textInputValue.length}/480
                          </Text>
                        </View>
                      ) : (
                        <View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: 10, padding: 10 }}>
                            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSelectIntimidadesImage}>
                              <GradientIcon name="image" size={26} colors={['#FFB74D', '#FFFFFF']} />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowTextInput(true)}>
                              <GradientIcon name="text-fields" size={26} colors={['#FFB74D', '#FFFFFF']} />
                            </TouchableOpacity>
                          </View>
                          {appliedText.length > 0 && (
                            <Text style={{ color: '#FFFFFF', marginTop: 10, textAlign: 'justify', paddingHorizontal: 10 }}>{appliedText}</Text>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.publishButton,
                        ((appliedText.length === 0 && !intimidadesImageUri) || isUploadingIntimidadesImage) && styles.publishButtonDisabled
                      ]}
                      disabled={(appliedText.length === 0 && !intimidadesImageUri) || isUploadingIntimidadesImage}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!profilePresentation) {
                          setPublishError(t('front.intimaciesPublishBlocked' as TranslationKey));
                          setTimeout(() => setPublishError(''), 5000);
                        } else {
                          let newIntimidad: Intimidad | null = null;

                          if (intimidadesImageUri) {
                            newIntimidad = {
                              type: 'image',
                              content: intimidadesImageUri,
                              caption: textInputValue
                            };
                          } else if (appliedText.length > 0) {
                            newIntimidad = {
                              type: 'text',
                              content: appliedText
                            };
                          }

                          if (newIntimidad) {
                            const updatedIntimidades = [newIntimidad!, ...intimidades];
                            setIntimidades(updatedIntimidades);
                            saveEditProfile(profilePresentation, updatedIntimidades); // Guardar cambios
                          }

                          setActiveIntimidadIndex(0);
                          setAppliedText('');
                          setTextInputValue('');
                          setIntimidadesImageUri(null); // Limpiamos la imagen después de publicar
                          setIsUploadingIntimidadesImage(false);
                          setPublishError('');
                        }
                      }}
                    >
                      <Text style={[
                        styles.publishButtonText,
                        (appliedText.length === 0 && !intimidadesImageUri) && styles.publishButtonTextDisabled
                      ]}>
                        {t('front.incorporate' as TranslationKey)}
                      </Text>
                    </TouchableOpacity>
                    {
                      publishError ? (
                        <Text style={{ color: '#ff5757', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                          {publishError}
                        </Text>
                      ) : null
                    }
                  </View >

                  <View
                    pointerEvents={hasQuizIntimidad ? 'none' : 'auto'}
                    style={{
                      width: '100%',
                      minHeight: 160,
                      backgroundColor: '#000000',
                      borderWidth: 2.4,
                      borderColor: '#FFB74D',
                      borderRadius: 10,
                      marginBottom: 20,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      paddingTop: quizImageUri ? 0 : 10,
                      paddingBottom: 20,
                      overflow: 'hidden',
                      opacity: hasQuizIntimidad ? 0.5 : 1,
                    }}>
                    {!quizImageUri && (
                      <TouchableOpacity
                        onPress={() => setShowExtraOptions1(!showExtraOptions1)}
                        style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}
                      >
                        <View style={{
                          position: 'absolute',
                          width: 20,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: '#FFB74D',
                        }} />
                        <View style={{
                          position: 'absolute',
                          width: 4,
                          height: 20,
                          borderRadius: 2,
                          backgroundColor: '#FFB74D',
                        }} />
                      </TouchableOpacity>
                    )}

                    <View style={{ width: '100%', paddingHorizontal: 0, marginBottom: 10 }}>
                      {quizImageUri ? (
                        <View style={{ width: '100%' }}>
                          <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                            <Image
                              source={{ uri: quizImageUri }}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 }}
                              onPress={() => {
                                setQuizImageUri(null);
                                setIsUploadingQuizImage(false);
                              }}
                            >
                              <MaterialIcons name="close" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                          <View style={{ paddingVertical: 10, paddingHorizontal: 10 }}>
                            <TextInput
                              style={{
                                color: '#FFFFFF',
                                fontSize: 14,
                                textAlignVertical: 'top',
                                minHeight: 40,
                              }}
                              multiline
                              maxLength={480}
                              placeholder="Escribe un pie de foto..."
                              placeholderTextColor="rgba(255, 255, 255, 0.5)"
                              value={quizTextInputValue}
                              onChangeText={setQuizTextInputValue}
                            />
                            <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                              {quizTextInputValue.length}/480
                            </Text>
                          </View>
                        </View>
                      ) : showQuizTextInput ? (
                        <View style={{ backgroundColor: 'rgba(45, 27, 14, 0.5)', borderRadius: 10, padding: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <TouchableOpacity onPress={() => setShowQuizTextInput(false)}>
                              <MaterialIcons name="chevron-left" size={24} color="#FFB74D" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setQuizAppliedText(quizTextInputValue);
                                setShowQuizTextInput(false);
                              }}
                              disabled={quizTextInputValue.length === 0}
                            >
                              <Text style={{
                                color: quizTextInputValue.length > 0 ? '#FFB74D' : 'rgba(255, 183, 77, 0.5)',
                                fontWeight: 'bold',
                                fontSize: 14
                              }}>
                                {t('common.apply' as TranslationKey)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: 8,
                              color: '#FFFFFF',
                              padding: 10,
                              height: 100,
                              textAlignVertical: 'top',
                              fontSize: 14,
                            }}
                            multiline
                            maxLength={480}
                            placeholder={t('front.draftPlaceholder' as TranslationKey)}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={quizTextInputValue}
                            onChangeText={setQuizTextInputValue}
                          />
                          <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                            {quizTextInputValue.length}/480
                          </Text>
                        </View>
                      ) : quizAppliedText.length > 0 ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 }}>
                          <Text style={{ color: '#FFFFFF', textAlign: 'justify', flex: 1, marginRight: 10 }}>{quizAppliedText}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => { setShowQuizTextInput(true); setQuizTextInputValue(quizAppliedText); }} style={{ marginRight: 10 }}>
                              <MaterialIcons name="edit" size={20} color="#FFB74D" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setQuizAppliedText(''); setQuizTextInputValue(''); }}>
                              <MaterialIcons name="delete" size={20} color="#FFB74D" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ width: '100%', paddingHorizontal: 15, flex: 1 }}>
                      {/* Row 1 */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                          <View style={{
                            flex: 1,
                            minHeight: 30,
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: '#FFB74D',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}>
                            {optionTextA.length > 0 && (
                              <Text style={{ fontWeight: 'bold', color: '#FFFFFF', marginRight: 4, fontSize: 12 }}>a.</Text>
                            )}
                            <TextInput
                              placeholder={optionTextA.length === 0 ? `a. ${t('front.answerPlaceholder' as TranslationKey)}` : ""}
                              placeholderTextColor="rgba(255, 183, 77, 0.5)"
                              value={optionTextA}
                              onChangeText={setOptionTextA}
                              multiline
                              maxLength={42}
                              style={{
                                flex: 1,
                                color: '#FFFFFF',
                                fontSize: 12,
                                padding: 0,
                                textAlignVertical: 'center',
                              }}
                            />
                          </View>
                          <TouchableOpacity onPress={() => setSelectedCorrectOption('a')}>
                            <MaterialIcons
                              name={selectedCorrectOption === 'a' ? "check-circle-outline" : "radio-button-unchecked"}
                              size={20}
                              color={selectedCorrectOption === 'a' ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                              style={{ marginLeft: 5 }}
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                          <TouchableOpacity onPress={() => setSelectedCorrectOption('b')}>
                            <MaterialIcons
                              name={selectedCorrectOption === 'b' ? "check-circle-outline" : "radio-button-unchecked"}
                              size={20}
                              color={selectedCorrectOption === 'b' ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                              style={{ marginRight: 5 }}
                            />
                          </TouchableOpacity>
                          <View style={{
                            flex: 1,
                            minHeight: 30,
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: '#FFB74D',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}>
                            {optionTextB.length > 0 && (
                              <Text style={{ fontWeight: 'bold', color: '#FFFFFF', marginRight: 4, fontSize: 12 }}>b.</Text>
                            )}
                            <TextInput
                              placeholder={optionTextB.length === 0 ? `b. ${t('front.answerPlaceholder' as TranslationKey)}` : ""}
                              placeholderTextColor="rgba(255, 183, 77, 0.5)"
                              value={optionTextB}
                              onChangeText={setOptionTextB}
                              multiline
                              maxLength={42}
                              style={{
                                flex: 1,
                                color: '#FFFFFF',
                                fontSize: 12,
                                padding: 0,
                                textAlignVertical: 'center',
                              }}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Row 2 */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                          <View style={{
                            flex: 1,
                            minHeight: 30,
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: '#FFB74D',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}>
                            {optionTextC.length > 0 && (
                              <Text style={{ fontWeight: 'bold', color: '#FFFFFF', marginRight: 4, fontSize: 12 }}>c.</Text>
                            )}
                            <TextInput
                              placeholder={optionTextC.length === 0 ? `c. ${t('front.answerPlaceholder' as TranslationKey)}` : ""}
                              placeholderTextColor="rgba(255, 183, 77, 0.5)"
                              value={optionTextC}
                              onChangeText={setOptionTextC}
                              multiline
                              maxLength={42}
                              style={{
                                flex: 1,
                                color: '#FFFFFF',
                                fontSize: 12,
                                padding: 0,
                                textAlignVertical: 'center',
                              }}
                            />
                          </View>
                          <TouchableOpacity onPress={() => setSelectedCorrectOption('c')}>
                            <MaterialIcons
                              name={selectedCorrectOption === 'c' ? "check-circle-outline" : "radio-button-unchecked"}
                              size={20}
                              color={selectedCorrectOption === 'c' ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                              style={{ marginLeft: 5 }}
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                          <TouchableOpacity onPress={() => setSelectedCorrectOption('d')}>
                            <MaterialIcons
                              name={selectedCorrectOption === 'd' ? "check-circle-outline" : "radio-button-unchecked"}
                              size={20}
                              color={selectedCorrectOption === 'd' ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                              style={{ marginRight: 5 }}
                            />
                          </TouchableOpacity>
                          <View style={{
                            flex: 1,
                            minHeight: 30,
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: '#FFB74D',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}>
                            {optionTextD.length > 0 && (
                              <Text style={{ fontWeight: 'bold', color: '#FFFFFF', marginRight: 4, fontSize: 12 }}>d.</Text>
                            )}
                            <TextInput
                              placeholder={optionTextD.length === 0 ? `d. ${t('front.answerPlaceholder' as TranslationKey)}` : ""}
                              placeholderTextColor="rgba(255, 183, 77, 0.5)"
                              value={optionTextD}
                              onChangeText={setOptionTextD}
                              multiline
                              maxLength={42}
                              style={{
                                flex: 1,
                                color: '#FFFFFF',
                                fontSize: 12,
                                padding: 0,
                                textAlignVertical: 'center',
                              }}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                    <Text style={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: 10,
                      marginBottom: 5,
                      marginTop: 10,
                    }}>
                      {t('front.chooseCorrectOption' as TranslationKey)}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.publishButton,
                        !((optionTextA && optionTextB && optionTextC && optionTextD && selectedCorrectOption) && ((quizAppliedText.length > 0) || (!!quizImageUri && !isUploadingQuizImage))) && styles.publishButtonDisabled
                      ]}
                      disabled={!((optionTextA && optionTextB && optionTextC && optionTextD && selectedCorrectOption) && ((quizAppliedText.length > 0) || (!!quizImageUri && !isUploadingQuizImage)))}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!profilePresentation) {
                          setQuizPublishError(t('front.intimaciesPublishBlocked' as TranslationKey));
                          setTimeout(() => setQuizPublishError(''), 5000);
                        } else {
                          if (selectedCorrectOption) {
                            const newQuiz: Intimidad = {
                              type: 'quiz',
                              content: 'Encuesta',
                              quizData: {
                                options: {
                                  a: optionTextA,
                                  b: optionTextB,
                                  c: optionTextC,
                                  d: optionTextD
                                },
                                correctOption: selectedCorrectOption,
                                imageUri: quizImageUri,
                                text: (quizAppliedText || quizTextInputValue || '').trim(),
                                stats: {
                                  a: 0,
                                  b: 0,
                                  c: 0,
                                  d: 0
                                }
                              }
                            };
                            const updatedIntimidades = [newQuiz, ...intimidades];
                            setIntimidades(updatedIntimidades);
                            saveEditProfile(profilePresentation, updatedIntimidades); // Guardar cambios
                          }

                          setOptionTextA('');
                          setOptionTextB('');
                          setOptionTextC('');
                          setOptionTextD('');
                          setSelectedCorrectOption(null);
                          setQuizImageUri(null);
                          setIsUploadingQuizImage(false);
                          setQuizAppliedText('');
                          setQuizTextInputValue('');
                        }
                      }}
                    >
                      <Text style={[
                        styles.publishButtonText,
                        !((optionTextA && optionTextB && optionTextC && optionTextD && selectedCorrectOption) && ((quizAppliedText.length > 0) || (!!quizImageUri && !isUploadingQuizImage))) && styles.publishButtonTextDisabled
                      ]}>
                        {t('front.incorporate' as TranslationKey)}
                      </Text>
                    </TouchableOpacity>
                    {quizPublishError ? (
                      <Text style={{ color: '#ff5757', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                        {quizPublishError}
                      </Text>
                    ) : null}
                    {showExtraOptions1 && (
                      <View style={{ width: '100%', marginTop: 15, paddingHorizontal: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(45, 27, 14, 0.5)', borderRadius: 10, padding: 10 }}>
                          <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSelectQuizImage}>
                            <MaterialIcons name="image" size={20} color="#FFB74D" />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, marginTop: 4 }}>{t('front.image' as TranslationKey)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowQuizTextInput(true)}>
                            <MaterialIcons name="text-fields" size={20} color="#FFB74D" />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, marginTop: 4 }}>{t('front.text' as TranslationKey)}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Contenedor Encuesta */}
                  <View
                    pointerEvents={hasSurveyIntimidad ? 'none' : 'auto'}
                    style={{
                      width: '100%',
                      minHeight: 160,
                      backgroundColor: '#000000',
                      borderWidth: 2.4,
                      borderColor: '#FFB74D',
                      borderRadius: 10,
                      marginBottom: 20,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      paddingTop: surveyImageUri ? 0 : 10,
                      paddingBottom: 20,
                      overflow: 'hidden',
                      opacity: hasSurveyIntimidad ? 0.5 : 1,
                    }}>
                    {!surveyImageUri && (
                      <TouchableOpacity
                        onPress={() => setShowExtraOptions2(!showExtraOptions2)}
                        style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}
                      >
                        <View style={{ position: 'absolute', width: 20, height: 4, borderRadius: 2, backgroundColor: '#FFB74D' }} />
                        <View style={{ position: 'absolute', width: 4, height: 20, borderRadius: 2, backgroundColor: '#FFB74D' }} />
                      </TouchableOpacity>
                    )}

                    <View style={{ width: '100%', paddingHorizontal: 0, marginBottom: 10 }}>
                      {surveyImageUri ? (
                        <View style={{ width: '100%' }}>
                          <View style={{ width: '100%', aspectRatio: 3 / 4 }}>
                            <Image
                              source={{ uri: surveyImageUri }}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 }}
                              onPress={() => {
                                setSurveyImageUri(null);
                                setIsUploadingSurveyImage(false);
                              }}
                            >
                              <MaterialIcons name="close" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                          <View style={{ paddingVertical: 10, paddingHorizontal: 10 }}>
                            <TextInput
                              style={{
                                color: '#FFFFFF',
                                fontSize: 14,
                                textAlignVertical: 'top',
                                minHeight: 40,
                              }}
                              multiline
                              maxLength={480}
                              placeholder="Escribe un pie de foto..."
                              placeholderTextColor="rgba(255, 255, 255, 0.5)"
                              value={surveyTextInputValue}
                              onChangeText={setSurveyTextInputValue}
                            />
                            <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                              {surveyTextInputValue.length}/480
                            </Text>
                          </View>
                        </View>
                      ) : showSurveyTextInput ? (
                        <View style={{ backgroundColor: 'rgba(45, 27, 14, 0.5)', borderRadius: 10, padding: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <TouchableOpacity onPress={() => setShowSurveyTextInput(false)}>
                              <MaterialIcons name="chevron-left" size={24} color="#FFB74D" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setSurveyAppliedText(surveyTextInputValue);
                                setShowSurveyTextInput(false);
                              }}
                              disabled={surveyTextInputValue.length === 0}
                            >
                              <Text style={{
                                color: surveyTextInputValue.length > 0 ? '#FFB74D' : 'rgba(255, 183, 77, 0.5)',
                                fontWeight: 'bold',
                                fontSize: 14
                              }}>
                                {t('common.apply' as TranslationKey)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: 8,
                              color: '#FFFFFF',
                              padding: 10,
                              height: 100,
                              textAlignVertical: 'top',
                              fontSize: 14,
                            }}
                            multiline
                            maxLength={480}
                            placeholder={t('front.draftPlaceholder' as TranslationKey)}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={surveyTextInputValue}
                            onChangeText={setSurveyTextInputValue}
                          />
                          <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textAlign: 'right', marginTop: 5 }}>
                            {surveyTextInputValue.length}/480
                          </Text>
                        </View>
                      ) : surveyAppliedText.length > 0 ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 }}>
                          <Text style={{ color: '#FFFFFF', textAlign: 'justify', flex: 1, marginRight: 10 }}>{surveyAppliedText}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => { setShowSurveyTextInput(true); setSurveyTextInputValue(surveyAppliedText); }} style={{ marginRight: 10 }}>
                              <MaterialIcons name="edit" size={20} color="#FFB74D" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setSurveyAppliedText(''); setSurveyTextInputValue(''); }}>
                              <MaterialIcons name="delete" size={20} color="#FFB74D" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ width: '100%', paddingHorizontal: 15, flex: 1 }}>
                      {surveyOptions.map((option, index) => (
                        <View key={index} style={{
                          width: '100%',
                          minHeight: 40,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: '#FFB74D',
                          paddingHorizontal: 15,
                          paddingVertical: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginBottom: 10,
                        }}>
                          <Text style={{ fontWeight: 'bold', color: '#FFFFFF', marginRight: 8, fontSize: 14 }}>
                            {String.fromCharCode(97 + index)}.
                          </Text>
                          <TextInput
                            placeholder={t('front.answerPlaceholder' as TranslationKey)}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={option}
                            onChangeText={(text) => handleUpdateSurveyOption(text, index)}
                            multiline
                            style={{
                              flex: 1,
                              color: '#FFFFFF',
                              fontSize: 14,
                              padding: 0,
                              textAlignVertical: 'center',
                            }}
                          />
                          {index >= 2 && (
                            <TouchableOpacity
                              onPress={() => handleRemoveSurveyOption(index)}
                              style={{
                                marginLeft: 10,
                                padding: 6,
                              }}
                            >
                              <MaterialIcons
                                name="delete"
                                size={16}
                                color="#FFB74D"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View >

                    {/* Bottom Plus Icon and Text */}
                    < View style={{ alignItems: 'center', marginTop: 5, width: '100%' }}>
                      <TouchableOpacity onPress={handleAddSurveyOption} disabled={surveyOptions.length >= 6}>
                        <MaterialIcons
                          name="add"
                          size={24}
                          color={surveyOptions.length >= 6 ? "rgba(255, 183, 77, 0.3)" : "#FFB74D"}
                          style={{ marginBottom: 5 }}
                        />
                      </TouchableOpacity>
                      <Text style={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: 10,
                        marginBottom: 5,
                        marginTop: 5,
                      }}>
                        {t('front.addMoreSurveyOptions' as TranslationKey)}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.publishButton,
                          !(((surveyAppliedText.length > 0) || (!!surveyImageUri && !isUploadingSurveyImage)) && surveyOptions[0]?.trim().length > 0 && surveyOptions[1]?.trim().length > 0) && styles.publishButtonDisabled
                        ]}
                        disabled={!(((surveyAppliedText.length > 0) || (!!surveyImageUri && !isUploadingSurveyImage)) && surveyOptions[0]?.trim().length > 0 && surveyOptions[1]?.trim().length > 0)}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!profilePresentation) {
                            setSurveyPublishError(t('front.intimaciesPublishBlocked' as TranslationKey));
                            setTimeout(() => setSurveyPublishError(''), 5000);
                          } else {
                            const newSurvey: Intimidad = {
                              type: 'survey',
                              content: 'Encuesta',
                              surveyData: {
                                options: surveyOptions.filter(opt => opt.trim().length > 0),
                                imageUri: surveyImageUri,
                                text: (surveyAppliedText || surveyTextInputValue || '').trim(),
                                userSelection: null,
                                stats: surveyOptions.filter(opt => opt.trim().length > 0).map(() => 0)
                              }
                            };

                            const updatedIntimidades = [newSurvey, ...intimidades];
                            setIntimidades(updatedIntimidades);
                            saveEditProfile(profilePresentation, updatedIntimidades); // Guardar cambios
                            setActiveIntimidadIndex(0);

                            // Reset form
                            setSurveyOptions(['', '']);
                            setSurveyImageUri(null);
                            setIsUploadingSurveyImage(false);
                            setSurveyAppliedText('');
                            setSurveyTextInputValue('');
                            setShowExtraOptions2(false);
                          }
                        }}
                      >
                        <Text style={[
                          styles.publishButtonText,
                          !(((surveyAppliedText.length > 0) || (!!surveyImageUri && !isUploadingSurveyImage)) && surveyOptions[0]?.trim().length > 0 && surveyOptions[1]?.trim().length > 0) && styles.publishButtonTextDisabled
                        ]}>
                          {t('front.incorporate' as TranslationKey)}
                        </Text>
                      </TouchableOpacity>
                      {surveyPublishError ? (
                        <Text style={{ color: '#ff5757', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                          {surveyPublishError}
                        </Text>
                      ) : null}
                    </View >
                    {showExtraOptions2 && (
                      <View style={{ width: '100%', marginTop: 15, paddingHorizontal: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(45, 27, 14, 0.5)', borderRadius: 10, padding: 10 }}>
                          <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSelectSurveyImage}>
                            <MaterialIcons name="image" size={20} color="#FFB74D" />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, marginTop: 4 }}>{t('front.image' as TranslationKey)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowSurveyTextInput(true)}>
                            <MaterialIcons name="text-fields" size={20} color="#FFB74D" />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, marginTop: 4 }}>{t('front.text' as TranslationKey)}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View >


                </ScrollView >
                </KeyboardAvoidingView>
              )
              }
            </View >
          )
        }

        {/* Pantalla Chat */}
        {
          activeBottomTab === 'chat' && (
            <KeyboardAvoidingView
              key={`chat-root-${chatScreenMountKey}`}
              style={{ flex: 1 }}
              enabled={false}
              behavior={undefined}
              keyboardVerticalOffset={0}
            >
              {chatView === 'groupChat' ? (
                <View style={{ flex: 1, backgroundColor: '#000000' }}>
                  <View style={{
                    position: 'absolute',
                    top: ANDROID_STATUS_BAR_HEIGHT + 10,
                    left: 10,
                    zIndex: 10,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedGroup(null);
                        setGroupChatInputValue('');
                        setGroupReplyingToMessageId(null);
                        setGroupReplyingToUsername(null);
                        setExpandedGroupThreadsByRootId({});
                        setExpandedMention(null);
                        setGroupMessageOptions(null);
                        setGroupChatLoadingGroupId(null);
                        setChatView('groups');
                      }}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 20,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      <MaterialIcons name="arrow-back" size={24} color="#FFB74D" />
                      <Text style={{ color: '#FFF', marginLeft: 5 }}>{t('chat.back' as TranslationKey)}</Text>
                    </TouchableOpacity>
                  </View>

                  {groupChatLoadingGroupId && selectedGroup?.id && groupChatLoadingGroupId === selectedGroup.id ? (
                    <View style={{ flex: 1, marginTop: 60, justifyContent: 'center', alignItems: 'center' }}>
                      <GradientSpinner size={54} />
                    </View>
                  ) : <ScrollView
                    style={[styles.scrollContainer, { paddingTop: 0, paddingBottom: 0, marginTop: 60, flex: 1 }]}
                    contentContainerStyle={{
                      flexGrow: 1,
                      justifyContent: 'flex-end',
                      paddingBottom:
                        (groupInputBarHeight || 72) +
                        (isKeyboardVisible
                          ? (keyboardHeight || 0) + CHAT_INPUT_KEYBOARD_GAP + 12
                          : (bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT) + 12),
                    }}
                    ref={groupChatScrollViewRef}
                    scrollEventThrottle={16}
                    onScroll={(e) => {
                      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                      groupScrollOffsetYRef.current = contentOffset.y;
                      groupContentHeightRef.current = contentSize.height;
                      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                      const nearBottom = distanceFromBottom <= 40;
                      const nearTop = contentOffset.y <= GROUP_CHAT_LOAD_OLDER_TOP_THRESHOLD;

                      setIsGroupNearBottom(prev => (prev === nearBottom ? prev : nearBottom));
                      setShowGroupScrollToLatest(prev => {
                        const next = !nearBottom;
                        return prev === next ? prev : next;
                      });

                      if (nearTop) {
                        loadOlderGroupMessages();
                      }
                    }}
                    onContentSizeChange={(_w, h) => {
                      groupContentHeightRef.current = h;

                      let didScrollToLatest = false;
                      if (pendingGroupScrollToLatestAfterRefreshRef.current && groupChatMessages.length > 0) {
                        pendingGroupScrollToLatestAfterRefreshRef.current = false;
                        didScrollToLatest = true;
                        setIsGroupNearBottom(true);
                        setShowGroupScrollToLatest(false);
                        // Immediate + deferred scroll to ensure Android renders content
                        groupChatScrollViewRef.current?.scrollToEnd({ animated: false });
                        requestAnimationFrame(() => {
                          groupChatScrollViewRef.current?.scrollToEnd({ animated: false });
                        });
                      }

                      const pendingAdjust = pendingGroupPrependAdjustRef.current;
                      if (pendingAdjust) {
                        const delta = h - pendingAdjust.previousHeight;
                        if (delta > 0) {
                          groupChatScrollViewRef.current?.scrollTo({
                            y: Math.max(0, pendingAdjust.previousOffset + delta),
                            animated: false,
                          });
                        }
                        pendingGroupPrependAdjustRef.current = null;
                      }

                      if (!didScrollToLatest) {
                        const currentLen = groupChatMessages.length;
                        const prevLen = lastGroupChatMessagesLengthRef.current;
                        if (currentLen !== prevLen) {
                          lastGroupChatMessagesLengthRef.current = currentLen;
                          if (currentLen > prevLen) {
                            if (isGroupNearBottom) {
                              groupChatScrollViewRef.current?.scrollToEnd({ animated: true });
                            } else {
                              setShowGroupScrollToLatest(true);
                            }
                          }
                        }
                      } else {
                        lastGroupChatMessagesLengthRef.current = groupChatMessages.length;
                      }
                    }}
                  >
                    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                      {isLoadingOlderGroupMessages && (
                        <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                          <ActivityIndicator color="#FFB74D" size="small" />
                        </View>
                      )}
                      {(() => {
                        const allMessages = Array.isArray(groupChatMessages) ? groupChatMessages : [];
                        const messageById: Record<string, any> = {};

                        allMessages.forEach((m: any) => {
                          const mid = Number(m?.id);
                          if (Number.isFinite(mid)) messageById[String(mid)] = m;
                        });

                        const getThreadRootId = (m: any): number | null => {
                          const startId = Number(m?.id);
                          if (!Number.isFinite(startId)) return null;

                          let current: any = m;
                          // Walk up reply_to_id until we reach a root or missing link.
                          // Guard against cycles with a hard cap.
                          for (let i = 0; i < 25; i++) {
                            const replyTo = current?.reply_to_id ?? current?.replyToId ?? null;
                            if (replyTo === null || replyTo === undefined || replyTo === '') return Number(current?.id) || startId;

                            const nextId = Number(replyTo);
                            if (!Number.isFinite(nextId)) return Number(current?.id) || startId;

                            const parent = messageById[String(nextId)];
                            if (!parent) return nextId; // best effort
                            current = parent;
                          }

                          return startId;
                        };

                        const rootMessages: any[] = [];
                        const repliesByRootId: Record<string, any[]> = {};

                        allMessages.forEach((m: any) => {
                          const hasReplyTo = m?.reply_to_id ?? m?.replyToId ?? null;
                          if (hasReplyTo) {
                            const rootId = getThreadRootId(m);
                            if (rootId === null) return;
                            const key = String(rootId);
                            if (!repliesByRootId[key]) repliesByRootId[key] = [];
                            repliesByRootId[key].push(m);
                          } else {
                            rootMessages.push(m);
                          }
                        });

                        // Sort replies inside each thread by id ASC (chronological)
                        Object.keys(repliesByRootId).forEach((k) => {
                          repliesByRootId[k].sort((a: any, b: any) => {
                            const ia = Number(a?.id);
                            const ib = Number(b?.id);
                            if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib) return ia - ib;
                            return String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? ''));
                          });
                        });

                        // Order roots by last activity in their thread so most recent goes last (bottom).
                        const activityIdByRoot: Record<string, number> = {};
                        rootMessages.forEach((m: any) => {
                          const rid = Number(m?.id);
                          if (Number.isFinite(rid)) activityIdByRoot[String(rid)] = rid;
                        });
                        Object.keys(repliesByRootId).forEach((k) => {
                          const base = Number(activityIdByRoot[k] ?? Number(k));
                          const maxReplyId = (repliesByRootId[k] || []).reduce((acc: number, r: any) => {
                            const n = Number(r?.id);
                            return Number.isFinite(n) ? Math.max(acc, n) : acc;
                          }, Number.isFinite(base) ? base : 0);
                          activityIdByRoot[k] = maxReplyId;
                        });

                        rootMessages.sort((a: any, b: any) => {
                          const ka = String(a?.id ?? '');
                          const kb = String(b?.id ?? '');
                          const ta = activityIdByRoot[ka] ?? Number(a?.id) ?? 0;
                          const tb = activityIdByRoot[kb] ?? Number(b?.id) ?? 0;
                          if (ta !== tb) return ta - tb;
                          return ka.localeCompare(kb);
                        });

                        return rootMessages.map((msg: any, index: number) => {
                          const isMe = msg?.sender_email === userEmail;
                          const isCreatorMessage = !!selectedGroup?.ownerEmail && msg?.sender_email === selectedGroup.ownerEmail;
                          const messageText = String(msg?.message ?? '');
                          const msgUsernameRaw = msg?.username ? String(msg.username) : (msg?.sender_email ? String(msg.sender_email) : '');
                          const msgUsername = msgUsernameRaw.startsWith('@') ? msgUsernameRaw : (msgUsernameRaw ? `@${msgUsernameRaw}` : '');
                          const canShowOwnerOptions = !!userEmail && !!selectedGroup?.ownerEmail && userEmail === selectedGroup.ownerEmail && !isMe;
                          const isLimitedByOwner = canShowOwnerOptions && !!msg?.sender_email && groupLimitedMemberEmails.includes(String(msg.sender_email));

                          const rootId = Number(msg?.id);
                          const rootKey = Number.isFinite(rootId) ? String(rootId) : '';
                          const myReplies = (rootKey && repliesByRootId[rootKey]) ? repliesByRootId[rootKey] : [];

                          const canInspectMentions = true;
                          const expandedMentionForThisMessage = expandedMention?.messageIndex === index ? expandedMention : null;
                          const expandedProfile = expandedMentionForThisMessage ? mentionProfiles[expandedMentionForThisMessage.username] : undefined;
                          const expandedAvatarUri = expandedProfile?.profile_photo_uri ? getServerResourceUrl(expandedProfile.profile_photo_uri) : null;
                          const expandedSocials = Array.isArray(expandedProfile?.social_networks) ? expandedProfile!.social_networks! : [];

                          const bubbleShapeStyle = {
                            borderRadius: 10,
                            borderBottomRightRadius: isMe ? 2 : 10,
                            borderBottomLeftRadius: isMe ? 10 : 2,
                            overflow: 'hidden' as const,
                          };

                          const minBubbleWidth = !isMe
                            ? (expandedMentionForThisMessage ? 170 : (msgUsername ? 140 : 110))
                            : undefined;

                          return (
                            <View key={msg?.id ?? `${msg?.created_at ?? ''}-${index}`} style={{
                              marginBottom: 10,
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '90%',
                              zIndex: groupMessageOptions?.messageIndex === index ? 1000 : 1,
                              elevation: groupMessageOptions?.messageIndex === index ? 1000 : 1,
                            }}>
                              <View style={styles.groupMessageRow}>
                                <View style={{ ...bubbleShapeStyle, backgroundColor: isCreatorMessage ? 'transparent' : '#333', flexShrink: 1, minWidth: minBubbleWidth }}>
                                  {isCreatorMessage && (
                                    <MeasuredSvgGradientBackground
                                      gradientId={`ownerMsgGrad-${msg?.id ?? index}`}
                                      colors={['#cf800aff', '#ddc513ff']}
                                    />
                                  )}

                                  <View style={{ padding: 10 }}>
                                    {!isMe && !!msgUsername && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {shouldShowVerifiedBadgeForHandle(msgUsername) ? (
                                          <View style={{ marginRight: 6, marginTop: 1 }}>
                                            <VerifiedBadgeIcon size={12} solidColor="#FFFFFF" solidOpacity={0.6} />
                                          </View>
                                        ) : null}
                                        <Text
                                          style={{ color: '#FFFFFF', fontSize: 10, marginBottom: 2, fontWeight: 'bold', flexShrink: 1 }}
                                          onPress={canInspectMentions ? () => toggleMentionForMessage(index, msgUsername, true) : undefined}
                                        >
                                          {msgUsername}
                                        </Text>
                                      </View>
                                    )}

                                    {expandedMentionForThisMessage && (
                                      <View style={{ marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          {expandedAvatarUri ? (
                                            <Image
                                              source={{ uri: expandedAvatarUri }}
                                              style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }}
                                            />
                                          ) : (
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                                              <MaterialIcons name="person" size={18} color="#FFF" />
                                            </View>
                                          )}

                                          <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                              {shouldShowVerifiedBadgeForHandle(expandedMentionForThisMessage.username) ? (
                                                <View style={{ marginRight: 8 }}>
                                                  <VerifiedBadgeIcon size={14} solidColor="#FFFFFF" solidOpacity={0.6} />
                                                </View>
                                              ) : null}
                                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                                                {expandedMentionForThisMessage.username}
                                              </Text>
                                            </View>
                                            {expandedSocials.length > 0 && (
                                              <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                style={{ marginTop: 6, width: expandedSocials.length >= 2 ? 60 : undefined, height: 24 }}
                                                contentContainerStyle={{ alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}
                                              >
                                                {expandedSocials.map((sn: any, sIdx: number) => {
                                                  const key = ((sn.id || sn.network) || '').toLowerCase();
                                                  const iconSource = SOCIAL_ICONS[key as keyof typeof SOCIAL_ICONS];
                                                  if (!iconSource || !sn.link) return null;
                                                  return (
                                                    <TouchableOpacity
                                                      key={`${key}-${sIdx}`}
                                                      onPress={() => openExternalLink(sn.link)}
                                                      style={{ marginRight: 10, paddingVertical: 2 }}
                                                    >
                                                      <Image source={iconSource} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
                                                    </TouchableOpacity>
                                                  );
                                                })}
                                              </ScrollView>
                                            )}
                                          </View>
                                        </View>
                                      </View>
                                    )}

                                    {(() => {
                                      const parsedImage = parseChannelImageMessage(String(messageText || '').trim());
                                      if (parsedImage) {
                                        let mediaUri = String(parsedImage.url || '').trim();
                                        if (mediaUri && !/^(https?:|file:|content:|data:)/i.test(mediaUri)) {
                                          if (mediaUri.startsWith('/api/') || mediaUri.startsWith('/uploads/')) {
                                            mediaUri = getServerResourceUrl(mediaUri);
                                          } else if (mediaUri.startsWith('api/') || mediaUri.startsWith('uploads/')) {
                                            mediaUri = getServerResourceUrl(`/${mediaUri}`);
                                          }
                                        }

                                        return (
                                          <>
                                            <TouchableOpacity activeOpacity={0.9} onPress={() => openGroupImageViewer(mediaUri)}>
                                              <Image
                                                source={{ uri: mediaUri }}
                                                style={{ width: 220, height: 220, borderRadius: 10, marginBottom: parsedImage.caption.trim() ? 8 : 0 }}
                                                resizeMode="cover"
                                              />
                                            </TouchableOpacity>
                                            {parsedImage.caption.trim() ? (
                                              <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                                {renderTextWithMentions(
                                                  parsedImage.caption,
                                                  (mention) => toggleMentionForMessage(index, mention, true),
                                                  true
                                                )}
                                              </Text>
                                            ) : null}
                                          </>
                                        );
                                      }

                                      return (
                                        <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                          {renderTextWithMentions(
                                            messageText,
                                            (mention) => toggleMentionForMessage(index, mention, true),
                                            true
                                          )}
                                        </Text>
                                      );
                                    })()}

                                    {myReplies.length > 0 && (
                                      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10 }}>
                                        {(() => {
                                          const isExpanded = !!expandedGroupThreadsByRootId[rootKey];
                                          const repliesToRender = isExpanded ? myReplies : myReplies.slice(-2);

                                          return repliesToRender.map((reply: any, rIdx: number) => {
                                            const replyText = String(reply?.message ?? '');
                                            const replyUsernameRaw = reply?.username ? String(reply.username) : (reply?.sender_email ? String(reply.sender_email) : '');
                                            const replyUsername = replyUsernameRaw.startsWith('@') ? replyUsernameRaw : (replyUsernameRaw ? `@${replyUsernameRaw}` : '');

                                            return (
                                              <View key={reply?.id ?? `${rootKey}-r-${rIdx}`} style={{ marginBottom: 8 }}>
                                                {!!replyUsername && (
                                                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 'bold' }}>
                                                    {replyUsername}
                                                  </Text>
                                                )}
                                                <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>{replyText}</Text>
                                              </View>
                                            );
                                          });
                                        })()}
                                      </View>
                                    )}
                                  </View>
                                </View>

                                {canShowOwnerOptions && !!msgUsername && (
                                  <View style={styles.groupMessageRightActions}>
                                    <TouchableOpacity
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      onPress={() => toggleGroupMessageOptions(index, String(msg?.sender_email || ''), msgUsername)}
                                      style={styles.groupMessageOptionsButton}
                                    >
                                      <MaterialIcons name="more-vert" size={18} color="rgba(255,255,255,0.9)" />
                                    </TouchableOpacity>

                                    {groupMessageOptions?.messageIndex === index && (
                                      <View style={styles.groupMessageOptionsMenu}>
                                        <TouchableOpacity
                                          style={styles.groupMessageOptionsMenuItem}
                                          onPress={() => {
                                            if (isLimitedByOwner) {
                                              unlimitGroupMember(groupMessageOptions.memberEmail, groupMessageOptions.username);
                                              return;
                                            }
                                            limitGroupMember(groupMessageOptions.memberEmail, groupMessageOptions.username);
                                          }}
                                        >
                                          <Text style={styles.groupMessageOptionsMenuText}>
                                            {isLimitedByOwner
                                              ? t('groups.limited' as TranslationKey)
                                              : t('groups.limit' as TranslationKey)}
                                          </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.groupMessageOptionsMenuItem}
                                          onPress={() => expelGroupMember(groupMessageOptions.memberEmail, groupMessageOptions.username)}
                                        >
                                          <Text style={styles.groupMessageOptionsMenuTextDanger}>{t('groups.expel' as TranslationKey)}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.groupMessageOptionsMenuItem}
                                          onPress={() => expelGroupMember(groupMessageOptions.memberEmail, groupMessageOptions.username, true)}
                                        >
                                          <Text style={styles.groupMessageOptionsMenuTextDanger}>{t('groups.expelAndBlock' as TranslationKey)}</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>

                              {(() => {
                                const isGroupOwner = !!userEmail && !!selectedGroup?.ownerEmail && String(userEmail) === String(selectedGroup.ownerEmail);
                                const canReplyHere = (!isMe) || isGroupOwner;
                                if (!canReplyHere) return null;
                                if (!Number.isFinite(rootId) || !msgUsername) return null;

                                return (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                  {/* Desplegar/colapsar hilo (lado opuesto) */}
                                  {myReplies.length > 2 && !!rootKey && (
                                    <TouchableOpacity
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      onPress={() => {
                                        setExpandedGroupThreadsByRootId(prev => ({
                                          ...prev,
                                          [rootKey]: !prev[rootKey],
                                        }));
                                      }}
                                      style={{ alignSelf: 'flex-start' }}
                                    >
                                      <MaterialIcons
                                        name={expandedGroupThreadsByRootId[rootKey] ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                                        size={20}
                                        color="#FFFFFF"
                                      />
                                    </TouchableOpacity>
                                  )}

                                  {/* Responder (derecha) */}
                                  <TouchableOpacity
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    onPress={() => {
                                      if (groupReplyingToMessageId === rootId) {
                                        setGroupReplyingToMessageId(null);
                                        setGroupReplyingToUsername(null);
                                      } else {
                                        setGroupReplyingToMessageId(rootId);
                                        setGroupReplyingToUsername(msgUsername);
                                      }
                                    }}
                                    style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
                                  >
                                    <MaterialIcons name="reply" size={18} color="#FFB74D" />
                                  </TouchableOpacity>
                                </View>
                                );
                              })()}
                            </View>
                          );
                        });
                      })()}
                    </View>
                  </ScrollView>}

                  <View
                    onLayout={(e) => {
                      const h = Math.ceil(e.nativeEvent.layout.height);
                      if (h > 0) setGroupInputBarHeight(prev => (prev === h ? prev : h));
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: isKeyboardVisible
                        ? (keyboardHeight || 0) + CHAT_INPUT_KEYBOARD_GAP
                        : (bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT),
                      paddingHorizontal: 20,
                      paddingTop: 20,
                      paddingBottom: isKeyboardVisible ? 8 : 0,
                    }}
                  >
                    {showGroupScrollToLatest && (
                      <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={async () => {
                            setGroupScrollToLatestLoading(true);

                            const groupId = selectedGroup?.id;
                            if (groupId) {
                              resetGroupChatPaginationState(false);
                              pendingGroupScrollToLatestAfterRefreshRef.current = true;
                              await fetchGroupChatMessages(groupId, 'latest');
                            }

                            // Fallback: scroll with increasing delays to handle varied render timings.
                            const doScrollToBottom = () => {
                              groupChatScrollViewRef.current?.scrollToEnd({ animated: true });
                              setIsGroupNearBottom(true);
                              setShowGroupScrollToLatest(false);
                            };
                            requestAnimationFrame(doScrollToBottom);
                            setTimeout(doScrollToBottom, 200);
                            setTimeout(() => {
                              doScrollToBottom();
                              setGroupScrollToLatestLoading(false);
                            }, 500);
                          }}
                          style={{
                            width: 36,
                            height: 36,
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'relative',
                          }}
                        >
                          <View style={{ zIndex: 1 }}>
                            {groupScrollToLatestLoading
                              ? <ActivityIndicator size="small" color="#FFB74D" />
                              : <MaterialIcons name="arrow-downward" size={20} color="#FFB74D" />
                            }
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    {(() => {
                      const isGroupOwner = !!userEmail && !!selectedGroup?.ownerEmail && String(userEmail) === String(selectedGroup.ownerEmail);
                      if (!isGroupOwner) return null;
                      if (!showGroupAttachmentPanel) return null;

                      return (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 16,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            marginBottom: 10,
                          }}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handlePickGroupImage}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              backgroundColor: 'rgba(0,0,0,0.25)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MaterialIcons name="image" size={24} color="#FFB74D" />
                          </TouchableOpacity>
                        </View>
                      );
                    })()}

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: 20,
                      paddingRight: 10,
                    }}>
                      {(() => {
                        const isGroupOwner = !!userEmail && !!selectedGroup?.ownerEmail && String(userEmail) === String(selectedGroup.ownerEmail);
                        if (!isGroupOwner) return null;
                        return (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => setShowGroupAttachmentPanel(prev => !prev)}
                            style={{ paddingLeft: 12, paddingRight: 6, paddingVertical: 8 }}
                          >
                            <MaterialIcons name="attach-file" size={22} color="#FFB74D" />
                          </TouchableOpacity>
                        );
                      })()}
                      {groupReplyingToUsername && (
                        <Text style={{ color: '#FFB74D', marginLeft: 15, fontWeight: 'bold' }}>{groupReplyingToUsername}</Text>
                      )}
                      <TextInput
                        style={{
                          flex: 1,
                          paddingHorizontal: 15,
                          paddingLeft: groupReplyingToUsername ? 5 : 15,
                          paddingVertical: 10,
                          maxHeight: CHAT_INPUT_MAX_HEIGHT,
                          color: '#FFFFFF',
                        }}
                        placeholder={t('chat.interactPlaceholder' as TranslationKey)}
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={groupChatInputValue}
                        onChangeText={setGroupChatInputValue}
                        multiline
                        scrollEnabled
                        textAlignVertical="top"
                      />
                      <TouchableOpacity
                        disabled={groupChatInputValue.trim().length === 0 || isSendingGroupMessage}
                        onPress={async () => {
                          if (isSendingGroupMessage) return;
                          if (!authToken) {
                            Alert.alert('Sesión requerida', 'Inicia sesión para enviar mensajes.');
                            return;
                          }
                          if (!selectedGroup?.id) return;
                          const trimmed = groupChatInputValue.trim();
                          if (!trimmed) return;

                          setIsSendingGroupMessage(true);
                          try {
                            const resp = await fetch(`${API_URL}/api/groups/${selectedGroup.id}/messages`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`,
                              },
                              body: JSON.stringify({ message: trimmed, replyToId: groupReplyingToMessageId }),
                            });

                            if (resp.ok) {
                              const newMsg = await resp.json();
                              setGroupChatMessages(prev => [...prev, newMsg]);
                              setGroupChatInputValue('');
                              setShowGroupAttachmentPanel(false);
                              setGroupReplyingToMessageId(null);
                              setGroupReplyingToUsername(null);

                              // After sending, pin to latest (matches Channel UX).
                              setIsGroupNearBottom(true);
                              setShowGroupScrollToLatest(false);
                              setTimeout(() => {
                                groupChatScrollViewRef.current?.scrollToEnd({ animated: true });
                              }, 60);
                            } else {
                              const err = await resp.json().catch(() => ({}));
                              const errorMessage = String(err?.error || '').trim();
                              if (errorMessage.toLowerCase().includes('limitado') || errorMessage.toLowerCase().includes('limitada') || errorMessage.toLowerCase().includes('restricted')) {
                                const host = groupOwnerUsername || 'anfitrión';
                                showActionToast(formatHostLimitedInteractions(host));
                              } else {
                                Alert.alert('Aviso', errorMessage || 'No se pudo enviar el mensaje');
                              }
                            }
                          } catch (e) {
                            console.error('Error sending group message:', e);
                            Alert.alert('Error', 'Error de conexión al enviar el mensaje');
                          } finally {
                            setIsSendingGroupMessage(false);
                          }
                        }}
                      >
                        {isSendingGroupMessage ? (
                          <ActivityIndicator color="#FFB74D" />
                        ) : (
                          <MaterialIcons
                            name="send"
                            size={24}
                            color={groupChatInputValue.trim().length > 0 ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Modal
                    visible={showGroupImageComposer}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={handleCloseGroupImageComposer}
                  >
                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingTop: ANDROID_STATUS_BAR_HEIGHT + 14,
                          paddingBottom: 10,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={handleCloseGroupImageComposer}
                          disabled={isSendingGroupImage}
                          style={{ padding: 8 }}
                        >
                          <MaterialIcons name="arrow-back" size={24} color="#FFB74D" />
                        </TouchableOpacity>

                        <View style={{ width: 40, height: 40 }} />
                      </View>

                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}>
                        {!!groupDraftImageUri && (
                          <Image
                            source={{ uri: groupDraftImageUri }}
                            style={{ width: '100%', height: '70%', borderRadius: 12 }}
                            resizeMode="contain"
                          />
                        )}
                      </View>

                      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                          }}
                        >
                          <TextInput
                            style={{
                              flex: 1,
                              minHeight: 44,
                              maxHeight: 120,
                              borderRadius: 18,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              backgroundColor: 'rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                            }}
                            placeholder="Añade un pie de foto..."
                            placeholderTextColor="rgba(255,255,255,0.55)"
                            value={groupDraftCaption}
                            onChangeText={setGroupDraftCaption}
                            multiline
                            textAlignVertical="top"
                            editable={!isSendingGroupImage}
                          />
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleApplyGroupImage}
                            disabled={isSendingGroupImage || !groupDraftImageUri}
                            style={{ marginLeft: 10, padding: 10 }}
                          >
                            {isSendingGroupImage ? (
                              <ActivityIndicator color="#FFB74D" />
                            ) : (
                              <MaterialIcons name="send" size={26} color="#FFB74D" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </KeyboardAvoidingView>
                    </View>
                  </Modal>

                  <Modal
                    visible={showGroupImageViewer}
                    transparent
                    animationType="fade"
                    onRequestClose={closeGroupImageViewer}
                  >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.98)' }}>
                      <View style={{ position: 'absolute', top: ANDROID_STATUS_BAR_HEIGHT + 12, left: 12, zIndex: 10 }}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={closeGroupImageViewer}
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.45)',
                            borderRadius: 18,
                            padding: 8,
                          }}
                        >
                          <MaterialIcons name="arrow-back" size={24} color="#FFB74D" />
                        </TouchableOpacity>
                      </View>

                      <TouchableWithoutFeedback onPress={closeGroupImageViewer}>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
                          {!!groupImageViewerUri && (
                            <Image
                              source={{ uri: groupImageViewerUri }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="contain"
                            />
                          )}
                        </View>
                      </TouchableWithoutFeedback>
                    </View>
                  </Modal>
                </View>
              ) : chatView === 'channel' ? (
                <View
                  key={`channel-view-${String(selectedChannel?.post_id ?? selectedChannel?.postId ?? selectedChannel?.id ?? userPublication?.id ?? 'none')}-${channelChatMountKey}-${joinedChannelRepaintKey}`}
                  style={{ flex: 1 }}
                >
                  {/* Header for viewer mode */}
                  {selectedChannel && (
                    <View style={{
                      position: 'absolute',
                      top: ANDROID_STATUS_BAR_HEIGHT + 10,
                      left: 10,
                      zIndex: 10,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedChannel(null);
                          setChannelChatLoadingPostId(null);
                          setChatView('channel');
                          setChannelTab('tusCanales');
                        }}
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: 20,
                          padding: 8,
                          flexDirection: 'row',
                          alignItems: 'center'
                        }}
                      >
                        <MaterialIcons name="arrow-back" size={24} color="#FFB74D" />
                        <Text style={{ color: '#FFF', marginLeft: 5 }}>{t('chat.back' as TranslationKey)}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {channelTab === 'Tu canal' ? (
                    (!selectedChannel && channelChatLoadingPostId && (userPublication || selectedChannel) && channelChatLoadingPostId === String(
                      selectedChannel?.post_id ??
                      selectedChannel?.postId ??
                      selectedChannel?.id ??
                      userPublication?.id ??
                      ''
                    )) ? (
                      <View style={{ flex: 1, marginTop: chatPanelsTopOffset, justifyContent: 'center', alignItems: 'center' }}>
                        <GradientSpinner size={54} />
                      </View>
                    ) : (!userPublication && !selectedChannel) ? (
                      <View style={[styles.scrollContainer, { paddingTop: 0, paddingBottom: 0, marginTop: chatPanelsTopOffset, flex: 1 }]}>
                        <View style={[styles.chatContainer, { flex: 1, justifyContent: 'center' }]}>
                          <View style={styles.emptyStateContainer}>
                            <MaterialIcons name="forum" size={60} color="rgba(255, 255, 255, 0.3)" />
                            <Text style={styles.emptyStateText}>
                              {t('chat.postOnHomeToActivateChannel' as TranslationKey)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      (() => {
                          const resolveChannelMediaUri = (raw: string) => {
                            const uri = String(raw || '').trim();
                            if (!uri) return uri;
                            if (/^(https?:|file:|content:|data:)/i.test(uri)) return uri;
                            if (uri.startsWith('/api/') || uri.startsWith('/uploads/')) return getServerResourceUrl(uri);
                            if (uri.startsWith('api/') || uri.startsWith('uploads/')) return getServerResourceUrl(`/${uri}`);
                            return uri;
                          };

                          const { messagesToRender, repliesByMessageKey } = channelChatRenderModel;

                          const renderChannelRichContent = (rawText: string, onMentionPress: (m: string) => void) => {
                            const parsedImage = parseChannelImageMessage(rawText.trim());
                            if (parsedImage) {
                              const mediaUri = resolveChannelMediaUri(parsedImage.url);
                              return (
                                <>
                                  <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => openChannelImageViewer(mediaUri)}
                                  >
                                    <Image
                                      source={{ uri: mediaUri }}
                                      style={{ width: 220, height: 220, borderRadius: 10, marginBottom: parsedImage.caption.trim() ? 8 : 0 }}
                                      resizeMode="cover"
                                    />
                                  </TouchableOpacity>
                                  {parsedImage.caption.trim() ? (
                                    <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                      {renderTextWithMentions(
                                        parsedImage.caption,
                                        (mention) => onMentionPress(mention),
                                        true,
                                      )}
                                    </Text>
                                  ) : null}
                                </>
                              );
                            }

                            return (
                              <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                {renderTextWithMentions(
                                  rawText,
                                  (mention) => onMentionPress(mention),
                                  true
                                )}
                              </Text>
                            );
                          };

                          const renderChannelRichContentWithGate = (
                            rawText: string,
                            onMentionPress: (m: string) => void,
                            options?: {
                              lockImage?: boolean;
                              onPressLockedImage?: () => void;
                              onOpenImage?: (mediaUri: string) => void;
                            }
                          ) => {
                            const parsedImage = parseChannelImageMessage(rawText.trim());
                            if (parsedImage) {
                              const mediaUri = resolveChannelMediaUri(parsedImage.url);
                              const shouldLock = !!options?.lockImage;

                              return (
                                <>
                                  {shouldLock ? (
                                    <TouchableOpacity activeOpacity={0.9} onPress={options?.onPressLockedImage}>
                                      <View
                                        style={{
                                          width: 220,
                                          height: 220,
                                          borderRadius: 10,
                                          overflow: 'hidden',
                                          marginBottom: parsedImage.caption.trim() ? 8 : 0,
                                        }}
                                      >
                                        <Image
                                          source={{ uri: mediaUri }}
                                          style={{ width: '100%', height: '100%' }}
                                          resizeMode="cover"
                                          blurRadius={CHANNEL_IMAGE_LOCK_BLUR_RADIUS}
                                        />
                                        <View
                                          pointerEvents="none"
                                          style={{
                                            ...StyleSheet.absoluteFillObject,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingHorizontal: 14,
                                          }}
                                        >
                                          <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 10 }}>
                                            <Text style={{ color: '#ffffffff', fontWeight: 'bold', textAlign: 'center' }}>
                                              {CHANNEL_IMAGE_LOCK_OVERLAY_TEXT_TOP}
                                            </Text>
                                            <Text style={{ color: '#ffffffff', fontWeight: 'normal', textAlign: 'center' }}>
                                              {CHANNEL_IMAGE_LOCK_OVERLAY_TEXT_BOTTOM}
                                            </Text>
                                          </View>
                                        </View>
                                      </View>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      activeOpacity={0.9}
                                      onPress={() => (options?.onOpenImage ? options.onOpenImage(mediaUri) : openChannelImageViewer(mediaUri))}
                                    >
                                      <Image
                                        source={{ uri: mediaUri }}
                                        style={{ width: 220, height: 220, borderRadius: 10, marginBottom: parsedImage.caption.trim() ? 8 : 0 }}
                                        resizeMode="cover"
                                      />
                                    </TouchableOpacity>
                                  )}
                                  {parsedImage.caption.trim() ? (
                                    <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                      {renderTextWithMentions(
                                        parsedImage.caption,
                                        (mention) => onMentionPress(mention),
                                        true,
                                      )}
                                    </Text>
                                  ) : null}
                                </>
                              );
                            }

                            return (
                              <Text style={{ color: '#FFFFFF', textAlign: 'justify' }}>
                                {renderTextWithMentions(
                                  rawText,
                                  (mention) => onMentionPress(mention),
                                  true
                                )}
                              </Text>
                            );
                          };

                          return (
                            <View style={{ flex: 1, marginTop: chatPanelsTopOffset, overflow: Platform.OS === 'android' ? 'visible' : 'hidden' as any }}>
                              <FlatList
                              key={`channel-chat-${channelChatMountKey}-${String(selectedChannel?.post_id ?? selectedChannel?.postId ?? selectedChannel?.id ?? userPublication?.id ?? 'none')}`}
                              style={[styles.scrollContainer, { paddingTop: 0, paddingBottom: 0, flex: 1 }]}
                              contentContainerStyle={{
                                flexGrow: 1,
                                justifyContent: 'flex-end',
                                paddingHorizontal: 20,
                                paddingTop: 20,
                                paddingBottom:
                                  (channelInputBarHeight || 72) +
                                  (isKeyboardVisible
                                    ? (keyboardHeight || 0) + CHAT_INPUT_KEYBOARD_GAP + 12
                                    : (bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT) + 12),
                              }}
                              data={messagesToRender}
                              keyExtractor={(msg: any, index: number) => String((msg as any)?.__key ?? (msg as any)?.id ?? `idx-${index}`)}
                              initialNumToRender={20}
                              maxToRenderPerBatch={20}
                              windowSize={11}
                              removeClippedSubviews={false}
                              keyboardShouldPersistTaps="handled"
                              nestedScrollEnabled
                              showsVerticalScrollIndicator={false}
                              ref={chatScrollViewRef}
                              ListHeaderComponent={isLoadingOlderChannelMessages ? (
                                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                                  <ActivityIndicator color="#FFB74D" size="small" />
                                </View>
                              ) : null}
                              ListEmptyComponent={selectedChannel && channelChatLoadingPostId ? (
                                <View style={{ paddingVertical: 22, alignItems: 'center' }}>
                                  <ActivityIndicator color="#FFB74D" size="small" />
                                </View>
                              ) : null}
                              scrollEventThrottle={16}
                              onScroll={(e) => {
                                const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                                channelScrollOffsetYRef.current = contentOffset.y;
                                channelContentHeightRef.current = contentSize.height;
                                const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                                const nearBottom = distanceFromBottom <= 40;
                                const nearTop = contentOffset.y <= CHANNEL_CHAT_LOAD_OLDER_TOP_THRESHOLD;

                                setIsChannelNearBottom(prev => (prev === nearBottom ? prev : nearBottom));
                                setShowChannelScrollToLatest(prev => {
                                  const next = !nearBottom;
                                  return prev === next ? prev : next;
                                });

                                if (nearTop) {
                                  loadOlderChannelMessages();
                                }
                              }}
                              onContentSizeChange={(_w, h) => {
                                channelContentHeightRef.current = h;

                                let didScrollToLatest = false;
                                if (pendingChannelScrollToLatestAfterRefreshRef.current && messagesToRender.length > 0) {
                                  pendingChannelScrollToLatestAfterRefreshRef.current = false;
                                  didScrollToLatest = true;
                                  setIsChannelNearBottom(true);
                                  setShowChannelScrollToLatest(false);
                                  // Use scrollToEnd instead of offset=contentHeight: on some Android devices
                                  // offset-based jumps can temporarily land in a blank viewport until a later
                                  // layout pass (e.g. focusing input). Repeating scrollToEnd is more stable.
                                  chatScrollViewRef.current?.scrollToEnd({ animated: false });
                                  requestAnimationFrame(() => {
                                    chatScrollViewRef.current?.scrollToEnd({ animated: false });
                                  });
                                  setTimeout(() => {
                                    chatScrollViewRef.current?.scrollToEnd({ animated: false });
                                  }, 140);
                                }

                                const pendingAdjust = pendingChannelPrependAdjustRef.current;
                                if (pendingAdjust) {
                                  const delta = h - pendingAdjust.previousHeight;
                                  if (delta > 0) {
                                    chatScrollViewRef.current?.scrollToOffset({
                                      offset: Math.max(0, pendingAdjust.previousOffset + delta),
                                      animated: false,
                                    });
                                  }
                                  pendingChannelPrependAdjustRef.current = null;
                                }

                                if (!didScrollToLatest) {
                                  const currentLen = chatMessages.length;
                                  const prevLen = lastChatMessagesLengthRef.current;
                                  if (currentLen !== prevLen) {
                                    lastChatMessagesLengthRef.current = currentLen;
                                    if (currentLen > prevLen) {
                                      if (isChannelNearBottom) {
                                        chatScrollViewRef.current?.scrollToEnd({ animated: true });
                                      } else {
                                        setShowChannelScrollToLatest(true);
                                      }
                                    }
                                  }
                                } else {
                                  lastChatMessagesLengthRef.current = chatMessages.length;
                                }
                              }}
                              onLayout={() => {
                                if (pendingChannelScrollToLatestAfterRefreshRef.current && messagesToRender.length > 0) {
                                  pendingChannelScrollToLatestAfterRefreshRef.current = false;
                                  setIsChannelNearBottom(true);
                                  setShowChannelScrollToLatest(false);
                                  chatScrollViewRef.current?.scrollToEnd({ animated: false });
                                  requestAnimationFrame(() => {
                                    chatScrollViewRef.current?.scrollToEnd({ animated: false });
                                  });
                                }
                              }}
                              renderItem={({ item: msg, index }) => {
                            const isOwnerMessage = msg.sender_email === channelOwnerEmail;
                            const isMe = msg.sender_email === userEmail;
                            const messageText = String(typeof msg === 'string' ? msg : (msg?.message ?? ''));
                            const hasRealUsername = typeof msg !== 'string' && !!msg?.username;
                            const msgUsername = typeof msg === 'string'
                              ? ''
                              : (msg.username ? (msg.username.startsWith('@') ? msg.username : `@${msg.username}`) : `@${msg.sender_email}`);
                            const messageKey = String((msg as any)?.__key ?? msg?.id ?? `idx-${index}`);
                            const myReplies = repliesByMessageKey[messageKey] || [];

                            const activeChannelPostId = String(
                              selectedChannel?.post_id ??
                              selectedChannel?.postId ??
                              selectedChannel?.id ??
                              userPublication?.id ??
                              ''
                            );

                            const isViewerInJoinedChannel =
                              !!selectedChannel &&
                              !!userEmail &&
                              !!channelOwnerEmail &&
                              String(userEmail) !== String(channelOwnerEmail);

                            const parsedOwnerImage = (isViewerInJoinedChannel && isOwnerMessage)
                              ? parseChannelImageMessage(messageText.trim())
                              : null;

                            const ownerImageMediaUri = parsedOwnerImage ? resolveChannelMediaUri(parsedOwnerImage.url) : '';
                            const ownerImageUnlockKey = parsedOwnerImage
                              ? makeChannelImageUnlockKey(activeChannelPostId, messageKey, ownerImageMediaUri)
                              : '';
                            const isOwnerImageLocked = !!parsedOwnerImage && !unlockedChannelImageKeys[ownerImageUnlockKey];
                            const canInspectMentions = true;
                            const expandedMentionForThisMessage = expandedMention?.messageIndex === index ? expandedMention : null;
                            const expandedProfile = expandedMentionForThisMessage ? mentionProfiles[expandedMentionForThisMessage.username] : undefined;
                            const expandedAvatarUri = expandedProfile?.profile_photo_uri ? getServerResourceUrl(expandedProfile.profile_photo_uri) : null;
                            const expandedSocials = Array.isArray(expandedProfile?.social_networks) ? expandedProfile!.social_networks! : [];

                            return (
                              <View style={{
                                marginBottom: 10,
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                              }}>
                                <View style={{
                                  borderRadius: 10,
                                  borderBottomRightRadius: isMe ? 2 : 10,
                                  borderBottomLeftRadius: isMe ? 10 : 2,
                                  overflow: 'hidden',
                                  backgroundColor: isOwnerMessage ? 'transparent' : '#333',
                                  // Prevent ultra-narrow bubbles that wrap username/message letter-by-letter
                                  // (happens especially with very short interactions)
                                  minWidth: (!isMe && !!msgUsername) ? 120 : undefined,
                                }}>
                                  {isOwnerMessage && (
                                    <MeasuredSvgGradientBackground
                                      gradientId={`channelOwnerMsgGrad-${msg?.id ?? index}`}
                                      colors={['#ff9900ff', '#ffe45c']}
                                      stopOpacity={0.8}
                                    />
                                  )}
                                  <View style={{ padding: 10, position: 'relative', zIndex: 1, elevation: 1 }}>
                                    {!isMe && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'nowrap' }}>
                                        {shouldShowVerifiedBadgeForHandle(msgUsername) ? (
                                          <View style={{ marginRight: 6 }}>
                                            <VerifiedBadgeIcon size={12} solidColor="#FFFFFF" solidOpacity={0.6} />
                                          </View>
                                        ) : null}
                                        <Text
                                          style={{ color: '#FFFFFF', fontSize: 10, fontWeight: isOwnerMessage ? 'normal' : 'bold', flexShrink: 1, marginRight: 8 }}
                                          onPress={(canInspectMentions && hasRealUsername) ? () => toggleMentionForMessage(index, msgUsername, true) : undefined}
                                        >
                                          {msgUsername}
                                        </Text>
                                        {!selectedChannel && userEmail && channelOwnerEmail && userEmail === channelOwnerEmail && (
                                          sentGroupRequestStatusByTarget[msgUsername] === 'blocked' ? (
                                            <Text style={{ color: 'rgba(255, 183, 77, 0.95)', fontSize: 10, fontWeight: 'bold' }}>
                                              {t('chat.requestBlocked' as TranslationKey)}
                                            </Text>
                                          ) : sentGroupRequestStatusByTarget[msgUsername] === 'accepted' ? (
                                            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 10, fontWeight: 'bold' }}>
                                              {t('chat.requestAccepted' as TranslationKey)}
                                            </Text>
                                          ) : sentGroupRequestStatusByTarget[msgUsername] === 'pending' ? (
                                            <Text style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 10, fontWeight: 'bold' }}>
                                              {t('chat.requestPending' as TranslationKey)}
                                            </Text>
                                          ) : (
                                            <TouchableOpacity
                                              style={{}}
                                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                              onPress={() => {
                                                openGroupRequestPanel(msgUsername);
                                              }}
                                            >
                                              <GroupAddGradientIcon size={16} />
                                            </TouchableOpacity>
                                          )
                                        )}
                                        {/* Icono de visibilidad (ojo) — solo visible para el anfitrión en su propio canal */}
                                        {!selectedChannel && userEmail && channelOwnerEmail && userEmail === channelOwnerEmail && !isOwnerMessage && msg?.id && (
                                          <>
                                            <View style={{ flex: 1, minWidth: 12 }} />
                                            <TouchableOpacity
                                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                              onPress={() => toggleMessageVisibility(msg.id)}
                                            >
                                              <MaterialIcons
                                                name={(msg as any)?.hidden ? 'visibility-off' : 'visibility'}
                                                size={16}
                                                color={(msg as any)?.hidden ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}
                                              />
                                            </TouchableOpacity>
                                          </>
                                        )}
                                      </View>
                                    )}

                                    {expandedMentionForThisMessage && (
                                      <View style={{ marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          {expandedAvatarUri ? (
                                            <Image
                                              source={{ uri: expandedAvatarUri }}
                                              style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }}
                                            />
                                          ) : (
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                                              <MaterialIcons name="person" size={18} color="#FFF" />
                                            </View>
                                          )}

                                          <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                              {shouldShowVerifiedBadgeForHandle(expandedMentionForThisMessage.username) ? (
                                                <View style={{ marginRight: 8 }}>
                                                  <VerifiedBadgeIcon size={14} solidColor="#FFFFFF" solidOpacity={0.6} />
                                                </View>
                                              ) : null}
                                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                                                {expandedMentionForThisMessage.username}
                                              </Text>
                                            </View>
                                            {expandedSocials.length > 0 && (
                                              <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                style={{ marginTop: 6, width: expandedSocials.length >= 2 ? 60 : undefined, height: 24 }}
                                                contentContainerStyle={{ alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}
                                              >
                                                {expandedSocials.map((sn: any, sIdx: number) => {
                                                  const key = ((sn.id || sn.network) || '').toLowerCase();
                                                  const iconSource = SOCIAL_ICONS[key as keyof typeof SOCIAL_ICONS];
                                                  if (!iconSource || !sn.link) return null;
                                                  return (
                                                    <TouchableOpacity
                                                      key={`${key}-${sIdx}`}
                                                      onPress={() => openExternalLink(sn.link)}
                                                      style={{ marginRight: 10, paddingVertical: 2 }}
                                                    >
                                                      <Image source={iconSource} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
                                                    </TouchableOpacity>
                                                  );
                                                })}
                                              </ScrollView>
                                            )}
                                          </View>
                                        </View>
                                      </View>
                                    )}

                                    <View style={(msg as any)?.hidden ? { opacity: 0.35 } : undefined}>
                                    {renderChannelRichContentWithGate(
                                      messageText,
                                      (mention) => toggleMentionForMessage(index, mention, true),
                                      isOwnerImageLocked ? {
                                        lockImage: true,
                                        onPressLockedImage: () => openChannelImageUnlockAd(ownerImageUnlockKey),
                                      } : undefined
                                    )}
                                    </View>
                                    {myReplies.length > 0 && (
                                      <View style={[{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10 }, (msg as any)?.hidden ? { opacity: 0.35 } : undefined]}>
                                        {myReplies.map((reply, rIdx) => {
                                          const publisherUsername = selectedChannel ? selectedChannel.username : (userPublication ? userPublication.user.username : 'Publicador');
                                          const displayPublisherName = publisherUsername.startsWith('@') ? publisherUsername : `@${publisherUsername}`;
                                          return (
                                            <View key={rIdx} style={{ marginBottom: 5 }}>
                                              {reply.author === 'publisher' ? (
                                                <>
                                                  <TouchableOpacity
                                                    activeOpacity={0.8}
                                                    onPress={() => toggleMentionForMessage(index, displayPublisherName, true)}
                                                  >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                      {shouldShowVerifiedBadgeForHandle(displayPublisherName) ? (
                                                        <View style={{ marginRight: 6 }}>
                                                          <VerifiedBadgeIcon size={12} solidColor="#FFFFFF" solidOpacity={0.6} />
                                                        </View>
                                                      ) : null}
                                                      <Svg height="16" width="200">
                                                        <Defs>
                                                          <LinearGradient id={`gradReplyUser-${index}-${rIdx}`} x1="0" y1="0" x2="1" y2="0">
                                                            <Stop offset="0" stopColor="#ff9900" stopOpacity="1" />
                                                            <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                                                          </LinearGradient>
                                                        </Defs>
                                                        <SvgText
                                                          fill={`url(#gradReplyUser-${index}-${rIdx})`}
                                                          stroke="none"
                                                          fontSize="12"
                                                          fontWeight="bold"
                                                          x="0"
                                                          y="12"
                                                        >
                                                          {displayPublisherName}
                                                        </SvgText>
                                                      </Svg>
                                                    </View>
                                                  </TouchableOpacity>
                                                  {(() => {
                                                    const replyIsOwnerImageCandidate = isViewerInJoinedChannel && reply.author === 'publisher';
                                                    const parsedReplyImage = replyIsOwnerImageCandidate
                                                      ? parseChannelImageMessage(String(reply.content || '').trim())
                                                     : null;
                                                    const replyMediaUri = parsedReplyImage ? resolveChannelMediaUri(parsedReplyImage.url) : '';
                                                    const replyKey = String(reply?.id ?? `${messageKey}-r-${rIdx}`);
                                                    const replyUnlockKey = parsedReplyImage
                                                      ? makeChannelImageUnlockKey(activeChannelPostId, replyKey, replyMediaUri)
                                                      : '';
                                                    const isReplyImageLocked = !!parsedReplyImage && !unlockedChannelImageKeys[replyUnlockKey];

                                                    return renderChannelRichContentWithGate(
                                                      reply.content,
                                                      (mention) => toggleMentionForMessage(index, mention, true),
                                                      isReplyImageLocked ? {
                                                        lockImage: true,
                                                        onPressLockedImage: () => openChannelImageUnlockAd(replyUnlockKey),
                                                      } : undefined
                                                    );
                                                  })()}
                                                </>
                                              ) : (
                                                <>
                                                  {!!msgUsername && (
                                                    <Text
                                                      style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 'bold' }}
                                                      onPress={(canInspectMentions && hasRealUsername) ? () => toggleMentionForMessage(index, msgUsername, true) : undefined}
                                                    >
                                                      {msgUsername}
                                                    </Text>
                                                  )}
                                                  {renderChannelRichContentWithGate(reply.content, (mention) => toggleMentionForMessage(index, mention, true))}
                                                </>
                                              )}
                                            </View>
                                          );
                                        })}
                                      </View>
                                    )}
                                  </View>
                                </View>
                                {!isMe && !selectedChannel && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (replyingToMessageIndex === index) {
                                        setReplyingToMessageIndex(null);
                                        setReplyingToUsername(null);
                                      } else {
                                        setReplyingToMessageIndex(index);
                                        setReplyingToUsername(msgUsername);
                                      }
                                    }}
                                    style={{ alignSelf: 'flex-end', marginTop: 4 }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <MaterialIcons
                                      name="reply"
                                      size={20}
                                      color={replyingToMessageIndex === index ? '#FFB74D' : 'rgba(255,255,255,0.7)'}
                                      style={{ transform: [{ scaleX: -1 }] }}
                                    />
                                  </TouchableOpacity>
                                )}
                                {/* Botón Responder para el viewer en un canal unido — solo activo si la última respuesta del hilo es del publisher */}
                                {isMe && !!selectedChannel && (() => {
                                  const lastReply = myReplies.length > 0 ? myReplies[myReplies.length - 1] : null;
                                  const canReply = !!lastReply && lastReply.author === 'publisher';
                                  if (!canReply) return null;
                                  return (
                                    <TouchableOpacity
                                      onPress={() => {
                                        // No se necesita replyingToUsername; el mensaje del viewer
                                        // se encadenará automáticamente al hilo activo.
                                        // Solo aseguramos que el input se desbloquea visualmente.
                                        setReplyingToMessageIndex(replyingToMessageIndex === index ? null : index);
                                      }}
                                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <MaterialIcons
                                        name="reply"
                                        size={20}
                                        color={replyingToMessageIndex === index ? '#FFB74D' : 'rgba(255,255,255,0.7)'}
                                        style={{ transform: [{ scaleX: -1 }] }}
                                      />
                                    </TouchableOpacity>
                                  );
                                })()}
                              </View>
                            )
                          }}
                            />
                            </View>
                          );
                        })()
                    )
                  ) : (
                    <ScrollView style={[styles.scrollContainer, { flex: 1, paddingTop: 0, paddingBottom: bottomNavHeight + 16, marginTop: chatPanelsTopOffset }]}>
                      <View style={styles.chatContainer}>
                        {myChannels.filter(c => getRemainingTime(c.post_created_at) !== 'Tiempo agotado').length === 0 ? (
                          <View style={styles.emptyStateContainer}>
                            <MaterialIcons name="forum" size={60} color="rgba(255, 255, 255, 0.3)" />
                            <Text style={styles.emptyStateText}>
                              {t('chat.noChannelsYet' as TranslationKey)}
                            </Text>
                          </View>
                        ) : (
                          myChannels
                            .filter(c => getRemainingTime(c.post_created_at) !== 'Tiempo agotado')
                            .map((channel, index) => {
                              const channelKey = String(
                                channel.post_id ??
                                channel.postId ??
                                channel.id ??
                                `${channel.publisher_email ?? 'unknown'}-${channel.post_created_at ?? index}`
                              );

                              const socials = Array.isArray(channel.social_networks) ? channel.social_networks : [];
                              const visibleSocials = socials
                                .map((sn: any) => {
                                  const key = normalizeSocialIconKey(sn?.id ?? sn?.network);
                                  const iconSource = SOCIAL_ICONS[key as keyof typeof SOCIAL_ICONS];
                                  return { sn, key, iconSource };
                                })
                                .filter((x: any) => !!x.iconSource && !!x?.sn?.link);
                              const SOCIAL_ICON_SIZE = 18;
                              const SOCIAL_ICON_GAP = 10;
                              const SOCIAL_ICONS_VIEWPORT_COUNT = 3;
                              const totalSocialCount = visibleSocials.length;
                              const viewportCount = Math.min(totalSocialCount, SOCIAL_ICONS_VIEWPORT_COUNT);
                              const socialIconsViewportWidth =
                                viewportCount > 0
                                  ? (viewportCount * SOCIAL_ICON_SIZE) + ((viewportCount - 1) * SOCIAL_ICON_GAP)
                                  : 0;

                              const CHAT_ICON_SIZE = 18;
                              const CHAT_HALO_SIZE = 30;
                              // SVG gradient ids must be stable and avoid special chars (e.g. '@', ':', spaces).
                              const safeChatGradientSuffix = hashString(`joined-chat-icon:${channelKey}`);
                              const CHAT_GRADIENT_ID = `joined_chat_icon_grad_${safeChatGradientSuffix}`;
                              const CHAT_RING_GRADIENT_ID = `joined_chat_icon_ring_grad_${safeChatGradientSuffix}`;

                              return (
                                <View
                                  key={channelKey}
                                  style={{
                                    backgroundColor: '#1E1E1E',
                                    borderRadius: 10,
                                    paddingHorizontal: 15,
                                    paddingTop: 15,
                                    paddingBottom: 10,
                                    marginBottom: 15,
                                    borderWidth: 1,
                                    borderColor: '#ffbe73ff'
                                  }}
                                >
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                                      <Pressable
                                        onPress={() => openJoinedChannelChat(channel)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Abrir chat"
                                        style={{ marginRight: 8 }}
                                      >
                                        {({ pressed }) => (
                                          <View
                                            style={{
                                              width: CHAT_HALO_SIZE,
                                              height: CHAT_HALO_SIZE,
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <View
                                              pointerEvents="none"
                                              style={{
                                                position: 'absolute',
                                                width: CHAT_HALO_SIZE,
                                                height: CHAT_HALO_SIZE,
                                                borderRadius: CHAT_HALO_SIZE / 2,
                                                backgroundColor: pressed ? 'rgba(255, 183, 77, 0.18)' : 'transparent',
                                              }}
                                            />

                                            {pressed ? (
                                              <Svg
                                                pointerEvents="none"
                                                width={CHAT_HALO_SIZE}
                                                height={CHAT_HALO_SIZE}
                                                style={{ position: 'absolute' }}
                                              >
                                                <Defs>
                                                  <LinearGradient id={CHAT_RING_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
                                                    <Stop offset="0" stopColor="#FFB74D" stopOpacity="0.9" />
                                                    <Stop offset="1" stopColor="#FFF176" stopOpacity="0.9" />
                                                  </LinearGradient>
                                                </Defs>
                                                <Circle
                                                  cx={CHAT_HALO_SIZE / 2}
                                                  cy={CHAT_HALO_SIZE / 2}
                                                  r={(CHAT_HALO_SIZE / 2) - 1}
                                                  fill="none"
                                                  stroke={`url(#${CHAT_RING_GRADIENT_ID})`}
                                                  strokeWidth={1.5}
                                                  opacity={0.75}
                                                />
                                              </Svg>
                                            ) : null}

                                            <Svg width={CHAT_ICON_SIZE} height={CHAT_ICON_SIZE} viewBox="0 0 24 24" pointerEvents="none">
                                              <Defs>
                                                <LinearGradient id={CHAT_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                                                  <Stop offset="0" stopColor="#FFB74D" stopOpacity="1" />
                                                  <Stop offset="1" stopColor="#FFF176" stopOpacity="1" />
                                                </LinearGradient>
                                              </Defs>
                                              {/* Simple chat bubble icon (SVG) filled with the Keinti gradient */}
                                              <Path
                                                d="M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                                                fill={`url(#${CHAT_GRADIENT_ID})`}
                                              />
                                            </Svg>
                                          </View>
                                        )}
                                      </Pressable>

                                      <Text
                                        numberOfLines={1}
                                        style={{ color: '#ffffffff', fontSize: 12, fontWeight: 'bold', flexShrink: 1 }}
                                      >
                                        {getCategoryLabel(channel.category)}
                                      </Text>
                                    </View>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <CountdownTimer
                                          createdAt={channel.post_created_at}
                                          style={{ color: '#AAA', fontSize: 12 }}
                                          onExpire={() => {
                                            setActiveJoinedChannelOptionsKey(prev => (prev === channelKey ? null : prev));
                                            setMyChannels(prev => prev.filter(c => String(
                                              c.post_id ??
                                              c.postId ??
                                              c.id ??
                                              `${c.publisher_email ?? 'unknown'}-${c.post_created_at ?? ''}`
                                            ) !== channelKey));
                                          }}
                                        />

                                        <View style={{ position: 'relative', marginLeft: 6, zIndex: 120, elevation: 12 }}>
                                          <TouchableOpacity
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            activeOpacity={0.8}
                                            onPress={() => {
                                              setActiveJoinedChannelOptionsKey(prev => prev === channelKey ? null : channelKey);
                                            }}
                                            style={{ paddingVertical: 2, paddingHorizontal: 2 }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Opciones"
                                          >
                                            <MaterialIcons name="more-vert" size={18} color="rgba(255,255,255,0.75)" />
                                          </TouchableOpacity>

                                          {activeJoinedChannelOptionsKey === channelKey && (
                                            <View
                                              style={{
                                                position: 'absolute',
                                                top: -6,
                                                right: 22,
                                                backgroundColor: '#1E1E1E',
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: 'rgba(255,255,255,0.12)',
                                                overflow: 'hidden',
                                                zIndex: 220,
                                                elevation: 16,
                                                minWidth: 150,
                                              }}
                                            >
                                              <TouchableOpacity
                                                style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                                onPress={() => leaveJoinedChannel(channel)}
                                              >
                                                <Text style={{ color: '#ffffffff', fontSize: 14 }}>Salir</Text>
                                              </TouchableOpacity>

                                              <TouchableOpacity
                                                style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                                onPress={() => leaveAndBlockJoinedChannel(channel)}
                                              >
                                                <Text style={{ color: '#ffb74dff', fontSize: 14, fontWeight: '700' }}>Salir y bloquear</Text>
                                              </TouchableOpacity>

                                              <TouchableOpacity
                                                style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                                onPress={() => reportJoinedChannel(channel)}
                                              >
                                                <Text style={{ color: '#ffffffff', fontSize: 14 }}>{t('common.report' as TranslationKey)}</Text>
                                              </TouchableOpacity>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                  </View>

                                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                                    {channel.profile_photo_uri ? (
                                      <Image
                                        source={{ uri: getServerResourceUrl(channel.profile_photo_uri) }}
                                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
                                      />
                                    ) : (
                                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                                        <MaterialIcons name="person" size={24} color="#FFF" />
                                      </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        {channel.account_verified ? (
                                          <View style={{ marginRight: 6 }}>
                                            <VerifiedBadgeIcon size={14} solidColor="#FFFFFF" solidOpacity={0.6} />
                                          </View>
                                        ) : null}
                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                                          {(String(channel.username || 'Usuario').startsWith('@'))
                                            ? String(channel.username || 'Usuario')
                                            : `@${String(channel.username || 'Usuario')}`}
                                        </Text>
                                        {channel.keinti_verified ? (
                                          <View style={{ marginLeft: 6 }}>
                                            <VerifiedBadgeIcon size={14} variant="gradient" />
                                          </View>
                                        ) : null}
                                      </View>
                                      {totalSocialCount > 0 && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <View style={{ width: socialIconsViewportWidth, height: 24, overflow: 'hidden' }}>
                                            <ScrollView
                                              horizontal
                                              showsHorizontalScrollIndicator={false}
                                              scrollEnabled={totalSocialCount > SOCIAL_ICONS_VIEWPORT_COUNT}
                                              style={{ height: 24 }}
                                              contentContainerStyle={{ alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}
                                            >
                                              {visibleSocials.map(({ sn, key, iconSource }: any, sIdx: number) => {
                                                const isLast = sIdx === visibleSocials.length - 1;
                                                return (
                                                  <TouchableOpacity
                                                    key={`${key}-${sIdx}`}
                                                    onPress={() => openExternalLink(sn.link)}
                                                    style={{ marginRight: isLast ? 0 : SOCIAL_ICON_GAP, paddingVertical: 2 }}
                                                  >
                                                    <Image
                                                      source={iconSource}
                                                      style={{ width: SOCIAL_ICON_SIZE, height: SOCIAL_ICON_SIZE, resizeMode: 'contain' }}
                                                    />
                                                  </TouchableOpacity>
                                                );
                                              })}
                                            </ScrollView>
                                          </View>

                                          <Text style={{ marginLeft: 6, color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>
                                            {totalSocialCount}
                                          </Text>
                                        </View>
                                      )}
                                    </View>

                                    <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'flex-end', marginLeft: 10 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialIcons name="person" size={14} color="#ffffff77" style={{ marginRight: 4 }} />
                                        <Text style={{ color: '#ffffff77', fontSize: 12 }}>
                                          {channel.subscriber_count || '0'}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              );
                            })
                        )}
                      </View>
                    </ScrollView>
                  )}
                  {(userPublication || selectedChannel) && channelTab === 'Tu canal' && (
                    <View
                      onLayout={(e) => {
                        const h = Math.ceil(e.nativeEvent.layout.height);
                        if (h > 0) setChannelInputBarHeight(prev => (prev === h ? prev : h));
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: isKeyboardVisible
                          ? (keyboardHeight || 0) + CHAT_INPUT_KEYBOARD_GAP
                          : (bottomNavHeight || BOTTOM_NAV_OVERLAY_HEIGHT),
                        paddingHorizontal: 10,
                        paddingTop: 10,
                        paddingBottom: isKeyboardVisible ? 8 : 4,
                      }}
                    >
                        {showChannelScrollToLatest && (
                          <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={async () => {
                                setChannelScrollToLatestLoading(true);

                                const targetPostId = String(
                                  selectedChannel?.post_id ??
                                  selectedChannel?.postId ??
                                  selectedChannel?.id ??
                                  userPublication?.id ??
                                  ''
                                );

                                if (targetPostId) {
                                  resetChannelChatPaginationState(false);
                                  pendingChannelScrollToLatestAfterRefreshRef.current = true;
                                  await fetchChannelMessages(targetPostId, 'latest');
                                }

                                // Fallback: scroll with increasing delays to handle varied render timings.
                                const doScrollToBottom = () => {
                                  chatScrollViewRef.current?.scrollToOffset({ offset: 999999, animated: true });
                                  setIsChannelNearBottom(true);
                                  setShowChannelScrollToLatest(false);
                                };
                                requestAnimationFrame(doScrollToBottom);
                                setTimeout(doScrollToBottom, 200);
                                setTimeout(() => {
                                  doScrollToBottom();
                                  setChannelScrollToLatestLoading(false);
                                }, 500);
                              }}
                              style={{
                                width: 36,
                                height: 36,
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                              }}
                            >
                              <View
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  bottom: 0,
                                  left: 0,
                                  borderRadius: 18,
                                  backgroundColor: channelScrollToLatestPulse ? 'rgba(255, 255, 255, 0.28)' : 'transparent',
                                }}
                              />
                              <View style={{ zIndex: 1 }}>
                                {channelScrollToLatestLoading
                                  ? <ActivityIndicator size="small" color="#FFB74D" />
                                  : <MaterialIcons name="arrow-downward" size={20} color="#FFB74D" />
                                }
                              </View>
                            </TouchableOpacity>
                          </View>
                        )}
                        {limitWarning && (
                          <Animated.View style={{ opacity: fadeAnim, marginBottom: 5 }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 12, textAlign: 'center' }}>
                              {(() => {
                                const template = t('chat.limitWarningMessage' as TranslationKey);
                                const parts = template.split('{user}');
                                if (parts.length < 2) {
                                  return (
                                    <>
                                      {template}{' '}
                                      <Text style={{ fontWeight: 'bold' }}>{limitWarning}</Text>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    {parts[0]}
                                    <Text style={{ fontWeight: 'bold' }}>{limitWarning}</Text>
                                    {parts.slice(1).join('{user}')}
                                  </>
                                );
                              })()}
                            </Text>
                          </Animated.View>
                        )}
                        {(() => {
                          const postCreatedAt = selectedChannel ? selectedChannel.post_created_at : (userPublication?.createdAt || new Date(0).toISOString());
                          const expired = getRemainingTime(postCreatedAt) === 'Tiempo agotado';
                          const isViewer = !!userEmail && !!channelOwnerEmail && userEmail !== channelOwnerEmail;

                          const viewerTurnMustWait = (() => {
                            if (expired) return false;
                            if (!isViewer) return false;

                            const myHandle = username
                              ? (String(username).trim().startsWith('@') ? String(username).trim() : `@${String(username).trim()}`)
                              : '';
                            const myEmailHandle = userEmail ? `@${String(userEmail).trim()}` : '';

                            const toMsgId = (m: any) => {
                              const n = Number(m?.id);
                              return Number.isFinite(n) ? n : NaN;
                            };

                            const lastMy = [...chatMessages]
                              .reverse()
                              .find((m: any) => String(m?.sender_email ?? '') === String(userEmail));
                            if (!lastMy?.id) return false; // nunca has enviado

                            const lastMyId = toMsgId(lastMy);
                            if (!Number.isFinite(lastMyId)) return false;

                            const hasPublisherReplyAfter = chatMessages.some((m: any) => {
                              if (String(m?.sender_email ?? '') !== String(channelOwnerEmail)) return false;
                              const mid = toMsgId(m);
                              if (!Number.isFinite(mid) || mid <= lastMyId) return false;
                              const text = String(m?.message ?? '').trim();
                              if (myHandle && text.startsWith(`${myHandle} `)) return true;
                              if (myEmailHandle && text.startsWith(`${myEmailHandle} `)) return true;
                              return false;
                            });

                            return !hasPublisherReplyAfter;
                          })();

                          return (
                            <>
                              {viewerTurnMustWait && (
                                <View style={{ marginBottom: 5 }}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 12, textAlign: 'center', fontWeight: 'bold' }}>
                                    Espera la respuesta del anfitrión para continuar con el hilo
                                  </Text>
                                </View>
                              )}
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderRadius: 20,
                                paddingRight: 10,
                                marginBottom: 0,
                                position: 'relative'
                              }}>
                                {(channelTab === 'Tu canal' && userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail)) && showChannelAttachmentPanel && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      left: 15,
                                      bottom: '100%',
                                      marginBottom: 8,
                                      backgroundColor: 'rgba(255,255,255,0.1)',
                                      borderRadius: 14,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      zIndex: 11,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <TouchableOpacity activeOpacity={0.8} onPress={handlePickChannelImage}>
                                      <MaterialIcons name="image" size={22} color="#FFB74D" />
                                    </TouchableOpacity>
                                  </View>
                                )}

                                {hostLimitWarning && (
                                  <Animated.View style={{
                                    opacity: hostLimitFadeAnim,
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(50,50,50,0.95)',
                                    borderRadius: 20,
                                    zIndex: 10
                                  }}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 12, textAlign: 'center' }}>
                                      {formatHostLimitedInteractions(hostLimitWarning || 'usuario')}
                                    </Text>
                                  </Animated.View>
                                )}

                                {(channelTab === 'Tu canal' && userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail)) && (
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setShowChannelAttachmentPanel(prev => !prev)}
                                    style={{
                                      paddingLeft: 12,
                                      paddingRight: 6,
                                      paddingVertical: 8,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <MaterialIcons name="attach-file" size={22} color="#FFB74D" />
                                  </TouchableOpacity>
                                )}

                                {replyingToUsername && (
                                  <Text style={{ color: '#FFB74D', marginLeft: channelTab === 'Tu canal' ? 6 : 15, fontWeight: 'bold' }}>{replyingToUsername}</Text>
                                )}
                                <TextInput
                                  style={{
                                    flex: 1,
                                    paddingHorizontal: 15,
                                    paddingLeft: replyingToUsername ? 5 : 15,
                                    paddingVertical: 10,
                                    maxHeight: CHAT_INPUT_MAX_HEIGHT,
                                    color: '#FFFFFF',
                                  }}
                                  placeholder={t('chat.interactPlaceholder' as TranslationKey)}
                                  placeholderTextColor="rgba(255,255,255,0.5)"
                                  value={chatInputValue}
                                  onChangeText={setChatInputValue}
                                  multiline
                                  scrollEnabled
                                  textAlignVertical="top"
                                  maxLength={isViewer ? 280 : undefined}
                                  editable={!expired}
                                />
                                <TouchableOpacity
                                  disabled={
                                    expired ||
                                    chatInputValue.length === 0 ||
                                    isSendingChannelMessage
                                  }
                                  onPress={async () => {
                                    if (isSendingChannelMessage) return;
                                    const trimmed = chatInputValue.trim();
                                    if (!trimmed) return;

                                    setIsSendingChannelMessage(true);
                                    try {
                                      const targetPostId = selectedChannel ? selectedChannel.post_id : userPublication?.id;
                                      const finalMessage = replyingToUsername ? `${replyingToUsername} ${trimmed}` : trimmed;
                                      const response = await fetch(`${API_URL}/api/channels/messages`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${authToken}`
                                        },
                                        body: JSON.stringify({
                                          postId: targetPostId,
                                          message: finalMessage
                                        })
                                      });
                                      if (response.ok) {
                                        const newMessage = await response.json();
                                        setChatMessages(prev => [...prev, newMessage]);
                                        setChatInputValue('');
                                        setReplyingToUsername(null);
                                        setReplyingToMessageIndex(null);
                                        setShowChannelAttachmentPanel(false);
                                      } else {
                                        const errorData = await response.json();
                                        const errorMessage = errorData.error || '';

                                        if (errorData?.code === 'WAIT_FOR_PUBLISHER_REPLY') {
                                          showActionToast('Espera la respuesta del creador para poder responder de nuevo');
                                          return;
                                        }

                                        if (response.status === 403) {
                                          if (errorMessage.toLowerCase().includes('limitado') || errorMessage.includes('restricted')) {
                                            const publisherName = selectedChannel ? selectedChannel.username : (userPublication?.user?.username || 'usuario');
                                            showHostLimitWarning(publisherName);
                                          } else {
                                            const publisherName = selectedChannel ? selectedChannel.username : 'usuario';
                                            showLimitWarning(publisherName);
                                          }
                                        } else {
                                          if (errorMessage.toLowerCase().includes('limitado')) {
                                            const publisherName = selectedChannel ? selectedChannel.username : (userPublication?.user?.username || 'usuario');
                                            showHostLimitWarning(publisherName);
                                          } else {
                                            Alert.alert('Aviso', errorMessage || 'No se pudo enviar el mensaje');
                                          }
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error sending message:', error);
                                      Alert.alert('Error', 'Error de conexión al enviar el mensaje');
                                    } finally {
                                      setIsSendingChannelMessage(false);
                                    }
                                  }}
                                >
                                  {isSendingChannelMessage ? (
                                    <ActivityIndicator color="#FFB74D" />
                                  ) : (
                                    <MaterialIcons
                                      name="send"
                                      size={24}
                                      color={(!expired && chatInputValue.length > 0) ? "#FFB74D" : "rgba(255, 255, 255, 0.3)"}
                                    />
                                  )}
                                </TouchableOpacity>
                              </View>
                            </>
                          );
                        })()}

                        {!isKeyboardVisible && (
                          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'relative', marginTop: 8 }}>
                            {(userPublication || selectedChannel) && channelTab === 'Tu canal' ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', left: 0 }}>
                                <MaterialIcons name="person" size={14} color="#6e6e6eff" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#6e6e6eff', fontSize: 12 }}>
                                  {channelInteractions.length}
                                </Text>
                              </View>
                            ) : null}

                            {(userPublication || selectedChannel) && channelTab === 'Tu canal' && userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail) && (
                              <View style={{ position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' }}>
                                {(userEmail && channelOwnerEmail && userEmail !== channelOwnerEmail) && (
                                  <Text style={{ color: '#6e6e6eff', fontSize: 12, marginRight: 10 }}>
                                    ({chatInputValue.length}/280)
                                  </Text>
                                )}

                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() => {
                                    setChannelMessagesTab(prev => prev === 'General' ? 'Respuestas' : 'General');
                                    setReplyingToMessageIndex(null);
                                    setReplyingToUsername(null);
                                    setExpandedMention(null);
                                  }}
                                  style={{ paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center' }}
                                >
                                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                                    {channelMessagesTab === 'General'
                                      ? 'General'
                                      : ((userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail)) ? 'Tus hilos' : 'Respuesta')}
                                  </Text>
                                  <Svg
                                    height="3"
                                    width={channelMessagesTab === 'General' ? 26 : ((userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail)) ? 60 : 30)}
                                    style={{ marginTop: 3 }}
                                  >
                                    <Defs>
                                      <LinearGradient id="grad_line_channel_toggle" x1="0" y1="0" x2="1" y2="0">
                                        <Stop offset="0" stopColor="#ff9900" stopOpacity="1" />
                                        <Stop offset="1" stopColor="#ffe45c" stopOpacity="1" />
                                      </LinearGradient>
                                    </Defs>
                                    <Rect
                                      x="0"
                                      y="0"
                                      width={channelMessagesTab === 'General' ? 26 : ((userEmail && channelOwnerEmail && String(userEmail) === String(channelOwnerEmail)) ? 60 : 30)}
                                      height="3"
                                      fill="url(#grad_line_channel_toggle)"
                                      rx="1.5"
                                    />
                                  </Svg>
                                </TouchableOpacity>
                              </View>
                            )}

                            {!selectedChannel && (
                              <></>
                            )}

                            {(userPublication || selectedChannel) && channelTab === 'Tu canal' ? (
                              <CountdownTimer
                                createdAt={selectedChannel ? selectedChannel.post_created_at : (userPublication?.createdAt || new Date(0).toISOString())}
                                style={{ color: '#6e6e6eff', fontSize: 12 }}
                              />
                            ) : null}
                          </View>
                        )}

                    </View>
                  )}

                        <Modal
                          visible={showChannelImageComposer}
                          transparent={false}
                          animationType="slide"
                          onRequestClose={handleCloseChannelImageComposer}
                        >
                          <View style={{ flex: 1, backgroundColor: '#000' }}>
                            <StatusBar barStyle="light-content" />

                            <View
                              style={{
                                height: 56,
                                paddingHorizontal: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#000',
                              }}
                            >
                              <TouchableOpacity
                                onPress={handleCloseChannelImageComposer}
                                disabled={isSendingChannelImage}
                                style={{ padding: 8 }}
                              >
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                              </TouchableOpacity>

                              <View style={{ width: 36, height: 36 }} />
                            </View>

                            <View style={{ flex: 1, backgroundColor: '#000' }}>
                              {!!channelDraftImageUri && (
                                <Image
                                  source={{ uri: channelDraftImageUri }}
                                  style={{ flex: 1, width: '100%' }}
                                  resizeMode="contain"
                                />
                              )}
                            </View>

                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                              <View
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  backgroundColor: 'rgba(20,20,20,0.95)',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                }}
                              >
                                <TextInput
                                  style={{
                                    flex: 1,
                                    color: '#FFF',
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    backgroundColor: 'rgba(255,255,255,0.08)',
                                    borderRadius: 18,
                                    marginRight: 10,
                                  }}
                                  placeholder="Pie de imagen..."
                                  placeholderTextColor="rgba(255,255,255,0.6)"
                                  value={channelDraftCaption}
                                  onChangeText={setChannelDraftCaption}
                                  editable={!isSendingChannelImage}
                                />
                                <TouchableOpacity
                                  onPress={handleApplyChannelImage}
                                  disabled={isSendingChannelImage || !channelDraftImageUri}
                                  style={{ padding: 6 }}
                                >
                                  {isSendingChannelImage ? (
                                    <ActivityIndicator color="#FFB74D" />
                                  ) : (
                                    <MaterialIcons
                                      name="send"
                                      size={26}
                                      color={channelDraftImageUri ? "#FFB74D" : "rgba(255,255,255,0.3)"}
                                    />
                                  )}
                                </TouchableOpacity>
                              </View>
                            </KeyboardAvoidingView>
                          </View>
                        </Modal>

                        <Modal
                          visible={showChannelImageViewer}
                          transparent={false}
                          animationType="fade"
                          onRequestClose={closeChannelImageViewer}
                        >
                          <View style={{ flex: 1, backgroundColor: '#000' }}>
                            <StatusBar barStyle="light-content" />
                            <View
                              style={{
                                height: 56,
                                paddingHorizontal: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#000',
                              }}
                            >
                              <TouchableOpacity onPress={closeChannelImageViewer} style={{ padding: 8 }}>
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                              </TouchableOpacity>
                              <View style={{ width: 36, height: 36 }} />
                            </View>

                            <View style={{ flex: 1, backgroundColor: '#000' }}>
                              {!!channelImageViewerUri && (
                                <Image
                                  source={{ uri: channelImageViewerUri }}
                                  style={{ flex: 1, width: '100%' }}
                                  resizeMode="contain"
                                />
                              )}
                            </View>
                          </View>
                        </Modal>

                </View>
              ) : (
                <View style={{ flex: 1, position: 'relative', paddingBottom: bottomNavHeight + 16 }}>
                  <ScrollView
                    style={{ flex: 1, width: '100%', marginTop: chatPanelsTopOffset + 12 }}
                    contentContainerStyle={{ alignItems: 'center', paddingTop: 6, paddingBottom: 2 }}
                    showsVerticalScrollIndicator={false}
                    onScroll={loadMoreJoinedGroupsIfNeeded}
                    scrollEventThrottle={16}
                  >
                    {(!authToken || !accountVerified) ? (
                      <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 22, paddingTop: 44 }}>
                        <MaterialIcons name="lock" size={44} color="rgba(255,255,255,0.7)" />
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 14,
                            fontWeight: '700',
                            textAlign: 'center',
                            marginTop: 14,
                            lineHeight: 20,
                          }}
                        >
                          {groupsTab === 'tusGrupos'
                            ? t('chat.lockedYourGroupsMessage' as TranslationKey)
                            : t('chat.lockedJoinedGroupsMessage' as TranslationKey)}
                        </Text>
                      </View>
                    ) : (
                      <>
                        {groupsTab === 'tusGrupos' && (
                          <View style={{ alignItems: 'center', width: '100%' }}>
                            {/* Lista de Grupos Creados */}
                            {myGroups.map((group) => (
                          <View
                            key={group.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: '#1E1E1E',
                              borderRadius: 12,
                              padding: 10,
                              marginBottom: 15,
                              width: '90%',
                              borderWidth: 1,
                              borderColor: '#333',
                              position: 'relative'
                            }}
                          >
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 35 }}
                              activeOpacity={0.8}
                              onPress={() => {
                                openGroupChat(group);
                              }}
                            >
                              <Image
                                source={{ uri: group.imageUri }}
                                style={{ width: 50, height: 50, borderRadius: 25, marginRight: 15 }}
                              />
                              <View>
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                  {group.hashtag}
                                </Text>
                                <TouchableOpacity
                                  activeOpacity={0.75}
                                  hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                  onPress={() => triggerGroupMembersPulseAndOpen(group)}
                                  style={{ flexDirection: 'row', alignItems: 'center' }}
                                >
                                  <Text style={{ color: '#ffffffff', fontSize: 12 }}>
                                    {getGroupMemberCount(group.memberCount)}
                                  </Text>
                                  <View style={{
                                    marginLeft: 6,
                                    width: 28,
                                    height: 28,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                  }}>
                                    {groupMembersPulseId === group.id && (
                                      <Animated.View
                                        pointerEvents="none"
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          right: 0,
                                          bottom: 0,
                                          left: 0,
                                          borderRadius: 16,
                                          backgroundColor: '#FFFFFF',
                                          opacity: groupMembersPulseAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, 0.7],
                                          }),
                                          zIndex: 0,
                                        }}
                                      />
                                    )}
                                    <View style={{ zIndex: 1 }}>
                                      <BottomNavGradientIcon name="person" size={16} />
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 10, right: 10 }}
                              onPress={() => {
                                if (activeGroupOptionsId === group.id) {
                                  setActiveGroupOptionsId(null);
                                } else {
                                  setActiveGroupOptionsId(group.id);
                                }
                              }}
                            >
                              <MaterialIcons name="more-vert" size={20} color="#888" />
                            </TouchableOpacity>

                            {/* Options Panel */}
                            {activeGroupOptionsId === group.id && (
                              <View
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 44,
                                  backgroundColor: '#1E1E1E',
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255,255,255,0.12)',
                                  overflow: 'hidden',
                                  zIndex: 200,
                                  elevation: 8,
                                }}
                              >
                                <TouchableOpacity
                                  style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                  onPress={() => {
                                    setActiveGroupOptionsId(null);
                                    setEditingGroupId(group.id);
                                    setGroupImageUri(group.imageUri);
                                    setGroupHashtag(group.hashtag);
                                    setShowCreateGroupPanel(true);
                                  }}
                                >
                                  <MaterialIcons name="edit" size={16} color="#ffffffff" style={{ marginRight: 8 }} />
                                  <Text style={{ color: '#ffffffff', fontSize: 14 }}>{t('groups.edit' as TranslationKey)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                  onPress={async () => {
                                    setActiveGroupOptionsId(null);
                                    setPendingDeleteGroup({ id: group.id });
                                    setShowDeleteGroupModal(true);
                                  }}
                                >
                                  <MaterialIcons name="delete" size={16} color="#ff5b5bff" style={{ marginRight: 8 }} />
                                  <Text style={{ color: '#ffffffff', fontSize: 14 }}>{t('groups.delete' as TranslationKey)}</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ))}

                        {/* Botón Crear Grupo */}
                        {myGroups.length < 5 && (
                          <TouchableOpacity
                            style={{ alignItems: 'center', marginTop: myGroups.length > 0 ? 20 : 0 }}
                            onPress={() => setShowCreateGroupPanel(true)}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="group-add" size={40} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 5 }}>
                              {t('chat.createGroup' as TranslationKey)}
                            </Text>
                          </TouchableOpacity>
                        )}
                          </View>
                        )}

                        {groupsTab === 'unidos' && (
                          <View style={{ alignItems: 'center', width: '100%' }}>
                            {visibleJoinedGroups.length === 0 ? (
                              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('chat.notJoinedAnyGroupYet' as TranslationKey)}</Text>
                              </View>
                            ) : (
                              pagedVisibleJoinedGroups.map((group) => (
                            <View
                              key={group.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#1E1E1E',
                                borderRadius: 12,
                                padding: 10,
                                marginBottom: 15,
                                width: '90%',
                                borderWidth: 1,
                                borderColor: '#333',
                                position: 'relative',
                              }}
                            >
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 35 }}
                                activeOpacity={0.8}
                                onPress={() => {
                                  openGroupChat(group);
                                }}
                              >
                                <Image
                                  source={{ uri: group.imageUri }}
                                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 15 }}
                                />
                                <View>
                                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                    {group.hashtag}
                                  </Text>
                                  <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                                    {formatUsernameWithAt(group.ownerUsername)}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#888', fontSize: 12 }}>
                                      {getGroupMemberCount(group.memberCount)}
                                    </Text>
                                    <MaterialIcons name="person" size={14} color="#888" style={{ marginLeft: 6 }} />
                                  </View>
                                </View>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 6,
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'transparent',
                                }}
                                activeOpacity={0.7}
                                onPress={() => {
                                  triggerJoinedOptionsPulseAndToggle(group.id);
                                }}
                              >
                                {joinedOptionsPulseId === group.id && (
                                  <Animated.View
                                    pointerEvents="none"
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      bottom: 0,
                                      left: 0,
                                      borderRadius: 16,
                                      backgroundColor: '#ffffffe4',
                                      opacity: joinedOptionsPulseAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 0.18],
                                      }),
                                      transform: [
                                        {
                                          scale: joinedOptionsPulseAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [1, 1.12],
                                          }),
                                        },
                                      ],
                                    }}
                                  />
                                )}
                                <MaterialIcons name="more-vert" size={18} color="rgba(255, 255, 255, 0.7)" />
                              </TouchableOpacity>

                              {activeJoinedGroupOptionsId === group.id && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 44,
                                    backgroundColor: '#1E1E1E',
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.12)',
                                    overflow: 'hidden',
                                    zIndex: 200,
                                    elevation: 8,
                                  }}
                                >
                                  <TouchableOpacity
                                    style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={async () => {
                                      setActiveJoinedGroupOptionsId(null);
                                      if (!authToken) {
                                        Alert.alert('Sesión requerida', 'Inicia sesión para salir del grupo.');
                                        return;
                                      }

                                      try {
                                        const resp = await fetch(`${API_URL}/api/groups/${group.id}/leave`, {
                                          method: 'POST',
                                          headers: {
                                            Authorization: `Bearer ${authToken}`,
                                          },
                                        });

                                        if (!resp.ok) {
                                          const err = await resp.json().catch(() => ({}));
                                          throw new Error(err?.error || 'Error al salir del grupo');
                                        }

                                        setJoinedGroups(current => current.filter(g => g.id !== group.id));
                                      } catch (e: any) {
                                        console.error('Error leaving group:', e);
                                        Alert.alert('Error', e?.message || 'No se pudo salir del grupo');
                                      }
                                    }}
                                  >
                                    <MaterialIcons name="exit-to-app" size={16} color="#FFB74D" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#FFFFFF', fontSize: 14 }}>{t('groups.leaveGroup' as TranslationKey)}</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={async () => {
                                      setActiveJoinedGroupOptionsId(null);
                                      if (!authToken) {
                                        Alert.alert('Sesión requerida', 'Inicia sesión para salir del grupo.');
                                        return;
                                      }

                                      setPendingLeaveBlockGroup({ id: group.id, hashtag: group.hashtag });
                                      setLeaveBlockReasonText('');
                                      setShowLeaveBlockModal(true);
                                    }}
                                  >
                                    <MaterialIcons name="block" size={16} color="#FFB74D" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#FFFFFF', fontSize: 14 }}>{t('groups.leaveAndBlock' as TranslationKey)}</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                              ))
                            )}
                            {visibleJoinedGroups.length > pagedVisibleJoinedGroups.length && (
                              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </ScrollView>

                </View>
              )}
            </KeyboardAvoidingView>
          )
        }

        {/* Pantalla Notificaciones */}
        {activeBottomTab === 'notifications' && (
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <View
              style={[
                styles.header,
                {
                  paddingTop: ANDROID_STATUS_BAR_HEIGHT,
                  height: 56 + ANDROID_STATUS_BAR_HEIGHT,
                  alignItems: 'flex-end',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setActiveBottomTab('profile')}
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.title}>{t('common.notifications' as TranslationKey)}</Text>
              <View style={styles.headerRightSpacer}>
                {unreadNotificationsCount > 0 && (
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#ffffff38',
                    }}
                  >
                    <Text style={{ color: '#ffffffff', fontSize: 11, fontWeight: 'bold' }}>
                      {unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 30 }}>
              {isLoadingNotifications ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Cargando...</Text>
                </View>
              ) : (
                (() => {
                  const pending = notifications.filter(n => n.type === 'group_join_request' && n.status === 'pending');
                  if (pending.length === 0) {
                    return (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('notifications.empty' as TranslationKey)}</Text>
                      </View>
                    );
                  }

                  return pending.map(n => {
                    const isRead = !!readNotificationIds[n.id];
                    const gradientId = `notif_border_${n.id}`;

                    const handleMarkRead = () => markNotificationAsRead(n.id);

                    const cardContent = (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
                            {formatRemainingTimeForDisplay(
                              getRemainingTime((n.postCreatedAt ?? n.createdAt) as any),
                              language,
                              t as any
                            )}
                          </Text>
                          <Text
                            style={{
                              color: isRead ? 'rgba(255, 255, 255, 0.6)' : '#FFB74D',
                              fontSize: 12,
                              fontWeight: '600',
                            }}
                          >
                            {isRead ? 'Leido' : 'No leido'}
                          </Text>
                        </View>

                        <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                          {formatTemplate(
                            t('notifications.groupJoinRequestMessage' as TranslationKey),
                            { user: String(n.requesterUsername ?? ''), group: String(n.groupHashtag ?? '') }
                          )}
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              handleMarkRead();
                              respondToGroupJoinRequest(n, 'ignore');
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 10,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: '#FFB74D',
                              backgroundColor: 'transparent',
                            }}
                          >
                            <Text style={{ color: '#FFB74D', fontWeight: 'bold' }}>{t('notifications.ignore' as TranslationKey)}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              handleMarkRead();
                              respondToGroupJoinRequest(n, 'accept');
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 10,
                              alignItems: 'center',
                              backgroundColor: '#FFB74D',
                            }}
                          >
                            <Text style={{ color: '#000000', fontWeight: 'bold' }}>{t('notifications.accept' as TranslationKey)}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );

                    if (isRead) {
                      return (
                        <TouchableOpacity
                          key={n.id}
                          activeOpacity={1}
                          onPress={handleMarkRead}
                          style={{ marginBottom: 12 }}
                        >
                          <View
                            style={{
                              backgroundColor: '#1E1E1E',
                              borderRadius: 12,
                              padding: 14,
                              borderWidth: 1,
                              borderColor: '#333',
                            }}
                          >
                            {cardContent}
                          </View>
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={n.id}
                        activeOpacity={0.95}
                        onPress={handleMarkRead}
                        style={{ marginBottom: 12 }}
                      >
                        <View
                          style={{
                            backgroundColor: '#1E1E1E',
                            borderRadius: 12,
                            padding: 14,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <MeasuredSvgGradientBorder
                            gradientId={gradientId}
                            colors={['#FF9800', '#FFEB3B']}
                            borderRadius={12}
                            strokeWidth={2}
                          />

                          {cardContent}
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })()
              )}
            </ScrollView>
          </View>
        )
        }
      </View >

      {/* Modal de Permiso de Galería (estilo similar a Eliminar cuenta) */}
      <Modal
        visible={showReEnableGalleryPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => resolveReEnableGalleryPermissionModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => resolveReEnableGalleryPermissionModal(false)}>
          <View style={styles.galleryPermissionOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.galleryPermissionPanel}>
                <Text style={styles.galleryPermissionTitle}>{t('devicePermissions.reEnableConfirmTitle')}</Text>
                <Text style={styles.galleryPermissionBody}>
                  {t('devicePermissions.reEnableConfirmBody')}
                </Text>

                <View style={styles.galleryPermissionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonSecondary]}
                    activeOpacity={0.8}
                    onPress={() => resolveReEnableGalleryPermissionModal(false)}
                  >
                    <Text style={styles.galleryPermissionButtonSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonPrimary]}
                    activeOpacity={0.8}
                    onPress={() => resolveReEnableGalleryPermissionModal(true)}
                  >
                    <Text style={styles.galleryPermissionButtonPrimaryText}>{t('common.confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: Eliminar contenido (perfil) */}
      <Modal
        visible={showDeleteContentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteContentModal(false);
          setPendingDeleteIntimidadIndex(null);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setShowDeleteContentModal(false);
            setPendingDeleteIntimidadIndex(null);
          }}
        >
          <View style={styles.galleryPermissionOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.galleryPermissionPanel}>
                <Text style={styles.galleryPermissionTitle}>{t('profile.deleteContentTitle')}</Text>
                <Text style={styles.galleryPermissionBody}>{t('profile.deleteContentBody')}</Text>

                <View style={styles.galleryPermissionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonSecondary]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowDeleteContentModal(false);
                      setPendingDeleteIntimidadIndex(null);
                    }}
                  >
                    <Text style={styles.galleryPermissionButtonSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonPrimary]}
                    activeOpacity={0.8}
                    onPress={confirmDeleteIntimidad}
                  >
                    <Text style={styles.galleryPermissionButtonPrimaryText}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: Eliminar imagen (carrusel - Tu presentación) */}
      <Modal
        visible={showDeleteCarouselImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteCarouselImageModal(false);
          setPendingDeleteCarouselImageIndex(null);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setShowDeleteCarouselImageModal(false);
            setPendingDeleteCarouselImageIndex(null);
          }}
        >
          <View style={styles.galleryPermissionOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.galleryPermissionPanel}>
                <Text style={styles.galleryPermissionTitle}>Eliminar imagen</Text>
                <Text style={styles.galleryPermissionBody}>
                  ¿Estás seguro de que quieres eliminar esta imagen del carrusel?
                </Text>

                <View style={styles.galleryPermissionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonSecondary]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowDeleteCarouselImageModal(false);
                      setPendingDeleteCarouselImageIndex(null);
                    }}
                  >
                    <Text style={styles.galleryPermissionButtonSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonPrimary]}
                    activeOpacity={0.8}
                    onPress={confirmDeleteCarouselImage}
                  >
                    <Text style={styles.galleryPermissionButtonPrimaryText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: Confirmar eliminación (grupo) */}
      <Modal
        visible={showDeleteGroupModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isDeletingGroup) return;
          setShowDeleteGroupModal(false);
          setPendingDeleteGroup(null);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            if (isDeletingGroup) return;
            setShowDeleteGroupModal(false);
            setPendingDeleteGroup(null);
          }}
        >
          <View style={styles.galleryPermissionOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.galleryPermissionPanel}>
                <Text style={styles.galleryPermissionTitle}>{t('groups.deleteConfirmTitle' as TranslationKey)}</Text>
                <Text style={styles.galleryPermissionBody}>{t('groups.deleteConfirmBody' as TranslationKey)}</Text>

                <View style={styles.galleryPermissionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonSecondary]}
                    activeOpacity={0.8}
                    disabled={isDeletingGroup}
                    onPress={() => {
                      setShowDeleteGroupModal(false);
                      setPendingDeleteGroup(null);
                    }}
                  >
                    <Text style={styles.galleryPermissionButtonSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.galleryPermissionButton, styles.galleryPermissionButtonPrimary]}
                    activeOpacity={0.8}
                    disabled={isDeletingGroup}
                    onPress={confirmDeleteGroup}
                  >
                    {isDeletingGroup ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.galleryPermissionButtonPrimaryText}>{t('common.confirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal de Categorías */}
      < Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.categoryModalContent}>
            <Text style={styles.categoryModalTitle}>{t('front.selectCategory')}</Text>
            <ScrollView style={styles.categoryList}>
              {CATEGORIES_ES.map((cat, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryOption}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    selectedCategory === cat && styles.categoryOptionTextSelected
                  ]}>
                    {getCategoryLabel(cat)}
                  </Text>
                  {selectedCategory === cat && (
                    <MaterialIcons name="check" size={20} color="#FFB74D" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal >

      {/* Modal de opciones */}
      < Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowOptionsModal(false)}>
          <View style={styles.optionsModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.optionsPanel}>
                <TouchableOpacity
                  style={[styles.optionItem, styles.lastOptionItem]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    onNavigateToConfiguration?.();
                  }}>
                  <MaterialIcons name="settings" size={24} color="#FFFFFF" />
                  <Text style={styles.optionText}>{t('config.title')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal >

      {/* Panel lateral de opciones */}
      < Modal
        visible={showSidePanel}
        transparent
        animationType="none"
        onRequestClose={closeSidePanel} >
        <TouchableWithoutFeedback onPress={closeSidePanel}>
          <View style={styles.sidePanelOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.sidePanel,
                  {
                    transform: [{ translateX: sidePanelAnimation }],
                  },
                ]}>
                {/* Header del panel */}
                <View style={styles.sidePanelHeader}>
                  <TouchableOpacity
                    style={[styles.profileIconCircleLarge, profilePhotoUri ? { shadowOpacity: 0, elevation: 0, borderWidth: 0 } : null]}
                    activeOpacity={0.7}>
                    {profilePhotoUri ? (
                      <Image
                        source={{ uri: getServerResourceUrl(profilePhotoUri) }}
                        style={styles.profileImageLarge}
                      />
                    ) : (
                      <MaterialIcons name="person" size={40} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.sidePanelUsername}>
                    {username || t('front.userPlaceholder')}
                  </Text>
                </View>

                {/* Opciones del panel */}
                <View style={styles.sidePanelOptions}>
                  <TouchableOpacity
                    style={styles.sidePanelOption}
                    onPress={() => {
                      handleSelectProfilePhoto();
                    }}>
                    <MaterialIcons name="photo-camera" size={24} color="#FFB74D" />
                    <Text style={styles.sidePanelOptionText}>
                      {t('front.editProfilePhoto')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sidePanelOption}
                    onPress={() => {
                      closeSidePanel();
                      onNavigateToConfiguration?.();
                    }}>
                    <MaterialIcons name="settings" size={24} color="#FFB74D" />
                    <Text style={styles.sidePanelOptionText}>
                      {t('config.title')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sidePanelOption}
                    onPress={() => {
                      closeSidePanel();
                      setActiveBottomTab('notifications');
                    }}>
                    <View style={{ position: 'relative' }}>
                      <MaterialIcons name="notifications" size={24} color="#FFB74D" />
                      {unreadNotificationsCount > 0 && (
                        <View pointerEvents="none" style={styles.unreadCountBadge}>
                          <Text style={styles.unreadCountBadgeText}>{unreadNotificationsCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sidePanelOptionText}>
                      {t('common.notifications')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sidePanelOption}
                    onPress={() => {
                      closeSidePanel();
                      toggleSocialPanel();
                    }}>
                    <MaterialIcons name="link" size={24} color="#FFB74D" />
                    <Text style={styles.sidePanelOptionText}>
                      {t('front.yourSocialNetworks')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal >

      {/* Barra de navegación inferior */}
      {activeBottomTab !== 'notifications' && !isKeyboardVisible && (
        <View
          style={[
            styles.bottomNavBar,
            {
              justifyContent: 'space-evenly',
              bottom: 0,
              paddingBottom: bottomSystemOffset + 6,
            },
          ]}
          pointerEvents={(activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)) ? 'none' : 'auto'}
          onLayout={(e) => {
            const h = e?.nativeEvent?.layout?.height;
            if (typeof h === 'number' && h > 0) {
              setBottomNavHeight(prev => (prev === h ? prev : h));
            }
          }}
        >
            {/* Chat (Left) */}
            <TouchableOpacity
              style={[styles.bottomNavItem, (activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)) && { opacity: 0.3 }]}
              onPress={() => {
                setActiveBottomTab('chat');
                setProfileView('profile');
              }}
              activeOpacity={0.7}
              disabled={activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)}>
              {activeBottomTab === 'chat' ? (
                <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={40} height={40} style={{ position: 'absolute' }}>
                      <Defs>
                        <LinearGradient id="grad_circle_chat" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#FFB74D" />
                          <Stop offset="1" stopColor="#FFEB3B" />
                        </LinearGradient>
                      </Defs>
                      <Circle cx={20} cy={20} r={20} fill="url(#grad_circle_chat)" />
                    </Svg>
                    <BottomNavGradientIcon name="forum" size={24} color="#000000" />
                    <Svg width="16" height="3" style={{ marginTop: 2 }}>
                      <Rect x="0" y="0" width="16" height="3" fill="#000000" rx="1.5" />
                    </Svg>
                </View>
              ) : (
                <BottomNavGradientIcon name="forum" size={20} opacity={0.5} />
              )}
            </TouchableOpacity>

            {/* Home (Center) */}
            <TouchableOpacity
              style={[styles.bottomNavItem, (activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)) && { opacity: 0.3 }]}
              onPress={() => {
                setActiveBottomTab('home');
                setProfileView('profile');
              }}
              activeOpacity={0.7}
              disabled={activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)}>
              {activeBottomTab === 'home' ? (
                <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={40} height={40} style={{ position: 'absolute' }}>
                      <Defs>
                        <LinearGradient id="grad_circle_home" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#FFB74D" />
                          <Stop offset="1" stopColor="#FFEB3B" />
                        </LinearGradient>
                      </Defs>
                      <Circle cx={20} cy={20} r={20} fill="url(#grad_circle_home)" />
                    </Svg>
                    <BottomNavGradientIcon name="home" size={24} color="#000000" />
                    <Svg width="16" height="3" style={{ marginTop: 2 }}>
                      <Rect x="0" y="0" width="16" height="3" fill="#000000" rx="1.5" />
                    </Svg>
                </View>
              ) : (
                <BottomNavGradientIcon name="home" size={20} opacity={0.5} />
              )}
            </TouchableOpacity>

            {/* Profile (Right) */}
            <TouchableOpacity
              style={[styles.bottomNavItem, (activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)) && { opacity: 0.3 }]}
              onPress={() => {
                setActiveBottomTab('profile');
                setProfileView('profile');
              }}
              activeOpacity={0.7}
              disabled={activeBottomTab === 'home' && (isHomePostsLoading || !hasHomePostsLoadedOnce)}>
              {activeBottomTab === 'profile' ? (
                <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={40} height={40} style={{ position: 'absolute' }}>
                      <Defs>
                        <LinearGradient id="grad_circle_profile" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#FFB74D" />
                          <Stop offset="1" stopColor="#FFEB3B" />
                        </LinearGradient>
                      </Defs>
                      <Circle cx={20} cy={20} r={20} fill="url(#grad_circle_profile)" />
                    </Svg>
                    <BottomNavGradientIcon name="person" size={24} color="#000000" />
                    <Svg width="16" height="3" style={{ marginTop: 2 }}>
                      <Rect x="0" y="0" width="16" height="3" fill="#000000" rx="1.5" />
                    </Svg>
                </View>
              ) : (
                <BottomNavGradientIcon name="person" size={20} opacity={0.5} />
              )}
            </TouchableOpacity>
        </View>
      )}

      {isBottomToastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bottomToastContainer,
            {
              bottom: bottomNavHeight + 20,
              opacity: bottomToastAnim,
              transform: [
                {
                  translateY: bottomToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [120, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.bottomToastPanel}>
            <Text style={styles.bottomToastText}>{bottomToastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Modal Solicitar (agregar a grupo desde Canal) */}
      <Modal
        visible={showGroupMembersPanel}
        transparent
        animationType="slide"
        onRequestClose={closeGroupMembersPanel}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeGroupMembersPanel}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: GROUP_MEMBERS_PANEL_HEIGHT,
            backgroundColor: '#000000',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderTopColor: '#FFB74D',
            padding: 20,
            paddingBottom: 30,
          }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                  {t('chat.members' as TranslationKey)} {groupMembersPanelGroup?.hashtag ? `· ${groupMembersPanelGroup.hashtag}` : ''}
                </Text>

                <View style={{ position: 'relative' }}>
                  {showGroupMembersActionsMenu && (
                    <View style={{
                      position: 'absolute',
                      right: 26,
                      top: -6,
                      backgroundColor: '#1E1E1E',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#FFB74D',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      minWidth: 170,
                      zIndex: 999,
                      elevation: 10,
                    }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setShowGroupMembersActionsMenu(false);
                          setSelectedGroupMemberKeys(new Set());
                          setGroupMembersSelectionMode(prev => (prev === 'limit' ? null : 'limit'));
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 6 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 13 }}>
                          {t('groups.limitUsers' as TranslationKey)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setShowGroupMembersActionsMenu(false);
                          setSelectedGroupMemberKeys(new Set());
                          setGroupMembersSelectionMode(prev => (prev === 'expel' ? null : 'expel'));
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 6 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 13 }}>
                          {t('groups.expelUsers' as TranslationKey)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setShowGroupMembersActionsMenu(v => !v)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingLeft: 10, paddingVertical: 4 }}
                  >
                    <MaterialIcons name="more-vert" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="person" size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginRight: 6 }} />
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>
                    {isLoadingGroupMembers ? 'Cargando...' : `${groupMembers.length}`}
                  </Text>
                </View>

                {!!groupMembersSelectionMode && (
                  <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, fontWeight: 'bold' }}>
                    {groupMembersSelectionMode === 'limit'
                      ? t('groups.limitUsers' as TranslationKey)
                      : t('groups.expelUsers' as TranslationKey)}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1, width: '100%' }}>
                {isLoadingGroupMembers ? (
                  <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                    <ActivityIndicator color="#FFB74D" />
                  </View>
                ) : groupMembers.length === 0 ? (
                  <View style={{ paddingVertical: 10 }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>
                      {t('groups.noMembersToShow' as TranslationKey)}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={groupMembers}
                    keyExtractor={(m, idx) => `${getGroupMemberKey(m)}-${idx}`}
                    showsVerticalScrollIndicator={false}
                    style={{
                      flex: 1,
                      width: '100%',
                    }}
                    ListFooterComponent={() => <View style={{ height: GROUP_MEMBERS_LIST_BOTTOM_SPACER }} />}
                    ItemSeparatorComponent={() => <View style={{ height: GROUP_MEMBERS_CARD_GAP }} />}
                    renderItem={({ item: m, index: _index }) => {
                      const memberKey = getGroupMemberKey(m);
                      const avatarUri = m.profile_photo_uri ? getServerResourceUrl(String(m.profile_photo_uri)) : null;
                      const socials = Array.isArray(m.social_networks) ? m.social_networks : [];
                      const visibleSocials = socials
                        .map((sn: any) => {
                          const key = normalizeSocialIconKey(sn?.id ?? sn?.network);
                          const iconSource = SOCIAL_ICONS[key as keyof typeof SOCIAL_ICONS];
                          return { sn, key, iconSource };
                        })
                        .filter((x: any) => !!x.iconSource && !!x?.sn?.link);
                      const SOCIAL_ICON_SIZE = 18;
                      const SOCIAL_ICON_GAP = 10;
                      const SOCIAL_ICONS_VIEWPORT_COUNT = 3;
                      const totalSocialCount = visibleSocials.length;
                      const viewportCount = Math.min(totalSocialCount, SOCIAL_ICONS_VIEWPORT_COUNT);
                      const socialIconsViewportWidth =
                        viewportCount > 0
                          ? (viewportCount * SOCIAL_ICON_SIZE) + ((viewportCount - 1) * SOCIAL_ICON_GAP)
                          : 0;

                      return (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#1E1E1E',
                            borderRadius: 12,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: '#333',
                          }}
                        >
                          {avatarUri ? (
                            <Image
                              source={{ uri: avatarUri }}
                              style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 21,
                                backgroundColor: '#333',
                                marginRight: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MaterialIcons name="person" size={22} color="#FFF" />
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>
                                {m.username}
                              </Text>

                              {groupMembersSelectionMode === 'limit' && !!m.is_limited && (
                                <View style={{
                                  marginLeft: 10,
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                  backgroundColor: 'rgba(255, 183, 77, 0.18)',
                                  borderWidth: 1,
                                  borderColor: '#FFB74D',
                                }}>
                                  <Text style={{ color: '#FFB74D', fontSize: 11, fontWeight: 'bold' }}>
                                    {t('groups.limited' as TranslationKey)}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                              {visibleSocials.length > 0 ? (
                                <View style={{ width: socialIconsViewportWidth, height: 24, overflow: 'hidden' }}>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    scrollEnabled={totalSocialCount > SOCIAL_ICONS_VIEWPORT_COUNT}
                                    style={{ height: 24 }}
                                    contentContainerStyle={{ alignItems: 'center', paddingVertical: 2, paddingRight: 4 }}
                                  >
                                    {visibleSocials.map(({ sn, key, iconSource }: any, sIdx: number) => {
                                      const isLast = sIdx === visibleSocials.length - 1;
                                      return (
                                        <TouchableOpacity
                                          key={`${key}-${sIdx}`}
                                          onPress={() => openExternalLink(sn.link)}
                                          style={{ marginRight: isLast ? 0 : SOCIAL_ICON_GAP, paddingVertical: 2 }}
                                        >
                                          <Image source={iconSource} style={{ width: SOCIAL_ICON_SIZE, height: SOCIAL_ICON_SIZE, resizeMode: 'contain' }} />
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              ) : (
                                <View style={{ height: 24, width: 0 }} />
                              )}

                              {totalSocialCount > 0 && (
                                <Text style={{ marginLeft: 6, color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>
                                  {totalSocialCount}
                                </Text>
                              )}
                            </View>
                          </View>

                          {groupMembersSelectionMode && (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => {
                                setSelectedGroupMemberKeys(prev => {
                                  const next = new Set(prev);
                                  if (next.has(memberKey)) next.delete(memberKey);
                                  else next.add(memberKey);
                                  return next;
                                });
                              }}
                              style={{
                                marginLeft: 10,
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#FFB74D',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: selectedGroupMemberKeys.has(memberKey) ? '#FFB74D' : 'transparent',
                              }}
                            >
                              {selectedGroupMemberKeys.has(memberKey) && (
                                <MaterialIcons name="check" size={16} color="#000" />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    }}
                  />
                )}
              </View>

              {groupMembersSelectionMode && !isLoadingGroupMembers && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      if (groupMembers.length === 0) return;
                      const allSelected = groupMembers.every(m => selectedGroupMemberKeys.has(getGroupMemberKey(m)));
                      if (allSelected) {
                        setSelectedGroupMemberKeys(new Set());
                        return;
                      }

                      setSelectedGroupMemberKeys(new Set(groupMembers.map(m => getGroupMemberKey(m))));
                    }}
                  >
                    <Text style={{ color: '#FFB74D', fontSize: 13, fontWeight: 'bold' }}>
                      {groupMembers.length > 0 && groupMembers.every(m => selectedGroupMemberKeys.has(getGroupMemberKey(m)))
                        ? t('groups.deselect' as TranslationKey)
                        : t('groups.selectAll' as TranslationKey)}
                    </Text>
                  </TouchableOpacity>

                  {(groupMembersSelectionMode === 'limit' || groupMembersSelectionMode === 'expel') && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={
                        (groupMembersSelectionMode === 'limit' ? isApplyingGroupMemberLimits : isExpellingGroupMembers)
                        || selectedGroupMemberKeys.size === 0
                      }
                      onPress={async () => {
                        if (!authToken) return;
                        if (!groupMembersPanelGroup) return;
                        if (selectedGroupMemberKeys.size === 0) return;

                        const targetMembers = groupMembers
                          .filter(m => selectedGroupMemberKeys.has(getGroupMemberKey(m)))
                          .filter(m => typeof m.member_email === 'string' && m.member_email.trim().length > 0);

                        if (targetMembers.length === 0) return;

                        if (groupMembersSelectionMode === 'expel') {
                          setIsExpellingGroupMembers(true);
                          try {
                            const expelledKeys = new Set<string>();
                            const failures: string[] = [];

                            const settled = await Promise.allSettled(
                              targetMembers.map(async (m) => {
                                const memberEmail = String(m.member_email).trim();
                                const resp = await fetch(`${API_URL}/api/groups/${groupMembersPanelGroup.id}/expel`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${authToken}`,
                                  },
                                  body: JSON.stringify({ memberEmail }),
                                });

                                if (!resp.ok) {
                                  let msg = '';
                                  try {
                                    const data = await resp.json();
                                    msg = data?.error ? String(data.error) : '';
                                  } catch {
                                    // ignore
                                  }
                                  throw new Error(msg || `HTTP ${resp.status}`);
                                }

                                expelledKeys.add(getGroupMemberKey(m));

                                // Keep host-side channel UI consistent: expel => remove "Aceptada" status.
                                const normalizedAt = normalizeMentionUsername(m.username);
                                const normalizedNoAt = normalizedAt.replace(/^@/, '').trim();
                                setSentGroupRequestStatusByTarget(prev => {
                                  const next: Record<string, 'pending' | 'accepted' | 'blocked'> = { ...prev };
                                  if (normalizedAt) delete (next as any)[normalizedAt];
                                  if (normalizedNoAt) delete (next as any)[normalizedNoAt];
                                  return next;
                                });
                              })
                            );

                            settled.forEach((r) => {
                              if (r.status === 'rejected') {
                                failures.push(String(r.reason?.message ?? r.reason ?? 'Error'));
                              }
                            });

                            if (expelledKeys.size > 0) {
                              setGroupMembers(prev => prev.filter(m => !expelledKeys.has(getGroupMemberKey(m))));
                            }
                            setSelectedGroupMemberKeys(new Set());

                            fetchSentGroupRequests().catch(() => { });

                            if (failures.length > 0) {
                              Alert.alert('Error', failures[0]);
                            }
                          } finally {
                            setIsExpellingGroupMembers(false);
                          }

                          return;
                        }

                        setIsApplyingGroupMemberLimits(true);
                        try {
                          const updates = new Map<string, boolean>();
                          const failures: string[] = [];

                          const settled = await Promise.allSettled(
                            targetMembers.map(async (m) => {
                              const memberEmail = String(m.member_email).trim();
                              const willUnlimit = !!m.is_limited;
                              const endpoint = willUnlimit ? 'unlimit' : 'limit';
                              const resp = await fetch(`${API_URL}/api/groups/${groupMembersPanelGroup.id}/${endpoint}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${authToken}`,
                                },
                                body: JSON.stringify({ memberEmail }),
                              });

                              if (!resp.ok) {
                                let msg = '';
                                try {
                                  const data = await resp.json();
                                  msg = data?.error ? String(data.error) : '';
                                } catch {
                                  // ignore
                                }
                                throw new Error(msg || `HTTP ${resp.status}`);
                              }

                              updates.set(getGroupMemberKey(m), !willUnlimit);
                            })
                          );

                          settled.forEach((r) => {
                            if (r.status === 'rejected') {
                              failures.push(String(r.reason?.message ?? r.reason ?? 'Error'));
                            }
                          });

                          if (updates.size > 0) {
                            setGroupMembers(prev => prev.map(m => {
                              const key = getGroupMemberKey(m);
                              if (!updates.has(key)) return m;
                              return { ...m, is_limited: updates.get(key) };
                            }));
                          }

                          setSelectedGroupMemberKeys(new Set());

                          if (failures.length > 0) {
                            Alert.alert('Error', failures[0]);
                          }
                        } finally {
                          setIsApplyingGroupMemberLimits(false);
                        }
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selectedGroupMemberKeys.size === 0 ? 'rgba(255, 183, 77, 0.35)' : '#FFB74D',
                        backgroundColor: (
                          (groupMembersSelectionMode === 'limit' ? isApplyingGroupMemberLimits : isExpellingGroupMembers)
                          || selectedGroupMemberKeys.size === 0
                        ) ? 'transparent' : '#FFB74D',
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: 'bold',
                        color: (
                          (groupMembersSelectionMode === 'limit' ? isApplyingGroupMemberLimits : isExpellingGroupMembers)
                          || selectedGroupMemberKeys.size === 0
                        ) ? 'rgba(255, 255, 255, 0.45)' : '#000',
                      }}>
                        {t('common.confirm' as TranslationKey)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGroupRequestPanel}
        transparent
        animationType="slide"
        onRequestClose={closeGroupRequestPanel}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeGroupRequestPanel}
        >
          <TouchableWithoutFeedback>
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#000000',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderTopColor: '#FFB74D',
              padding: 20,
              paddingBottom: 30,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>
                {t('chat.selectGroup' as TranslationKey)}
              </Text>
              {!!groupRequestTargetUsername && (
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, marginBottom: 14 }}>
                  {t('chat.toPrefix' as TranslationKey)} {groupRequestTargetUsername}
                </Text>
              )}

              <ScrollView
                style={{ width: '100%', maxHeight: 320 }}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {myGroups.length === 0 ? (
                  <View style={{ paddingVertical: 10 }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>
                      No tienes grupos creados
                    </Text>
                  </View>
                ) : (
                  myGroups.map((group) => {
                    const isSelected = selectedRequestGroupId === group.id;
                    return (
                      <TouchableOpacity
                        key={group.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedRequestGroupId(group.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#1E1E1E',
                          borderRadius: 12,
                          padding: 10,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: isSelected ? '#FFB74D' : '#333',
                        }}
                      >
                        <Image
                          source={{ uri: group.imageUri }}
                          style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }}
                        />
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>
                          {group.hashtag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!selectedRequestGroupId || isSubmittingGroupRequest}
                onPress={submitGroupRequest}
                style={{
                  marginTop: 10,
                  width: '100%',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFB74D',
                  opacity: (!selectedRequestGroupId || isSubmittingGroupRequest) ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 14 }}>
                  {t('chat.request' as TranslationKey)}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Modal Crear Grupo */}
      <Modal
        visible={showCreateGroupPanel}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isSavingGroup) return;
          setShowCreateGroupPanel(false);
          setEditingGroupId(null);
          setGroupImageUri(null);
          setGroupHashtag('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (isSavingGroup) return;
            setShowCreateGroupPanel(false);
            setEditingGroupId(null);
            setGroupImageUri(null);
            setGroupHashtag('');
          }}
        >
          <TouchableWithoutFeedback>
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#000000',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderTopColor: '#FFB74D',
              padding: 20,
              alignItems: 'center',
              paddingBottom: 40
            }}>
              <TouchableOpacity
                onPress={handleSelectGroupImage}
                activeOpacity={0.8}
                disabled={isSavingGroup}
                style={{ opacity: isSavingGroup ? 0.6 : 1 }}
              >
                {groupImageUri ? (
                  <Image
                    source={{ uri: groupImageUri }}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      marginBottom: 20,
                      borderWidth: 2,
                      borderColor: '#FFB74D'
                    }}
                  />
                ) : (
                  <Svg width="50" height="50" viewBox="0 0 50 50" style={{ marginBottom: 20 }}>
                    <Circle cx="25" cy="25" r="23" stroke="#FFB74D" strokeWidth="2" fill="transparent" />
                    <Path
                      d="M25 15 V35 M15 25 H35"
                      stroke="#FFB74D"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>

              <View style={{ width: '100%', marginBottom: 20 }}>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    padding: 12,
                    color: '#FFFFFF',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#FFB74D'
                  }}
                  placeholder="#Hashtag"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={groupHashtag}
                  maxLength={28}
                  editable={!isSavingGroup}
                  onChangeText={(text) => {
                    const noSpaces = text.replace(/\s/g, '');
                    if (noSpaces.length > 0 && !noSpaces.startsWith('#')) {
                      setGroupHashtag('#' + noSpaces);
                    } else {
                      setGroupHashtag(noSpaces);
                    }
                  }}
                />
              </View>

              <TouchableOpacity
                disabled={isSavingGroup || !groupImageUri || groupHashtag.length < 2}
                style={{
                  backgroundColor: (!isSavingGroup && groupImageUri && groupHashtag.length >= 2) ? '#000000' : 'rgba(0, 0, 0, 0.5)',
                  paddingVertical: 12,
                  paddingHorizontal: 40,
                  borderRadius: 25,
                  marginTop: 10,
                  width: '50%',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: (!isSavingGroup && groupImageUri && groupHashtag.length >= 2) ? '#FFB74D' : 'rgba(255, 183, 77, 0.3)',
                  opacity: isSavingGroup ? 0.7 : 1,
                }}
                onPress={handleCreateGroup}
              >
                {isSavingGroup ? (
                  <ActivityIndicator color="#FFB74D" />
                ) : (
                  <Text style={{
                    color: groupImageUri && groupHashtag.length >= 2 ? '#FFB74D' : 'rgba(255, 183, 77, 0.3)',
                    fontWeight: 'bold',
                    fontSize: 16
                  }}>
                    {t('common.apply' as TranslationKey)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Expel Confirmation Modal (same design as delete publication modal) */}
      <Modal
        visible={showExpelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowExpelModal(false);
          setPendingExpel(null);
          setShowBlockReasonField(false);
          setBlockReasonText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.deleteModalContainer,
              pendingExpel?.shouldBlock ? { width: '92%' } : null,
            ]}
          >
            <Text style={styles.deleteModalTitle}>{pendingExpel?.shouldBlock ? 'Expulsar y Bloquear' : 'Expulsar'}</Text>
            <Text style={styles.deleteModalText}>
              {pendingExpel?.shouldBlock
                ? `¿Quieres expulsar y bloquear a ${normalizeMentionUsername(pendingExpel.username)}?`
                : `¿Quieres expulsar a ${(pendingExpel ? normalizeMentionUsername(pendingExpel.username) : '@usuario')} del grupo?`}
            </Text>

            {pendingExpel?.shouldBlock && (
              <View style={{ marginTop: 8, width: '100%', alignSelf: 'stretch' }}>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#FFFFFF',
                    width: '100%',
                    alignSelf: 'stretch',
                  }}
                  placeholder="Motivo del bloqueo..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={blockReasonText}
                  onChangeText={(txt) => setBlockReasonText(String(txt).slice(0, 320))}
                  maxLength={320}
                  multiline
                  textAlignVertical="top"
                />
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.65)',
                    textAlign: 'right',
                  }}
                >
                  {`${blockReasonText.length}/320`}
                </Text>
              </View>
            )}

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={() => {
                  setShowExpelModal(false);
                  setPendingExpel(null);
                  setShowBlockReasonField(false);
                  setBlockReasonText('');
                }}
              >
                <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel' as TranslationKey)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonConfirm]}
                onPress={() => {
                  const current = pendingExpel;
                  if (!current) return;

                  const reason = current.shouldBlock
                    ? (String(blockReasonText || '').trim().slice(0, 320) || 'Sin motivo')
                    : undefined;

                  setShowExpelModal(false);
                  setPendingExpel(null);
                  setShowBlockReasonField(false);
                  setBlockReasonText('');
                  performExpelGroupMember(current.memberEmail, current.username, current.shouldBlock, reason);
                }}
              >
                <Text
                  style={styles.deleteModalButtonTextConfirm}
                  numberOfLines={1}
                >
                  {pendingExpel?.shouldBlock ? 'Expulsar y Bloquear' : 'Expulsar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Publication Block Modal */}
      <Modal
        visible={showPublicationBlockModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (isBlockingPublicationUser) return;
          setShowPublicationBlockModal(false);
          setPendingPublicationBlock(null);
          setPublicationBlockReasonText('');
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => {
            if (isBlockingPublicationUser) return;
            setShowPublicationBlockModal(false);
            setPendingPublicationBlock(null);
            setPublicationBlockReasonText('');
          }}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.deleteModalContainer, { width: '92%' }]}>
              <Text style={styles.deleteModalTitle}>{t('common.block' as TranslationKey)}</Text>
              <Text style={styles.deleteModalText}>
                {t('home.blockConfirmQuestion' as TranslationKey).replace('{user}', pendingPublicationBlock?.username || '@usuario')}
              </Text>

              <View style={{ marginTop: 8, width: '100%', alignSelf: 'stretch' }}>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#FFFFFF',
                    width: '100%',
                    alignSelf: 'stretch',
                    minHeight: 86,
                  }}
                  placeholder={t('home.blockReasonPlaceholder' as TranslationKey)}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={publicationBlockReasonText}
                  onChangeText={(txt) => setPublicationBlockReasonText(String(txt).slice(0, 320))}
                  maxLength={320}
                  multiline
                  textAlignVertical="top"
                  editable={!isBlockingPublicationUser}
                />
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.65)',
                    textAlign: 'right',
                  }}
                >
                  {`${publicationBlockReasonText.length}/320`}
                </Text>
              </View>

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonCancel, isBlockingPublicationUser ? { opacity: 0.6 } : null]}
                  disabled={isBlockingPublicationUser}
                  onPress={() => {
                    if (isBlockingPublicationUser) return;
                    setShowPublicationBlockModal(false);
                    setPendingPublicationBlock(null);
                    setPublicationBlockReasonText('');
                  }}
                >
                  <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel' as TranslationKey)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm, isBlockingPublicationUser ? { opacity: 0.6 } : null]}
                  disabled={isBlockingPublicationUser || !authToken || !pendingPublicationBlock?.email}
                  onPress={async () => {
                    if (!authToken) {
                      Alert.alert(t('auth.sessionRequiredTitle' as TranslationKey), t('auth.signInToBlockUsers' as TranslationKey));
                      return;
                    }

                    const current = pendingPublicationBlock;
                    if (!current?.email) return;

                    const reason = String(publicationBlockReasonText || '').trim().slice(0, 320);

                    setIsBlockingPublicationUser(true);
                    try {
                      const resp = await fetch(`${API_URL}/api/group-requests/block`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${authToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email: current.email, ...(reason ? { reason } : {}) }),
                      });

                      if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err?.error || t('errors.unableToBlockUser' as TranslationKey));
                      }

                      setShowPublicationBlockModal(false);
                      setPendingPublicationBlock(null);
                      setPublicationBlockReasonText('');

                      // Refresh feed to remove current + future posts from that user.
                      fetchHomePosts({ preservePosition: true, showLoader: false });
                      showBottomToast(t('toast.blocked' as TranslationKey));
                    } catch (e: any) {
                      console.error('Error blocking publication user:', e);
                      Alert.alert('Error', e?.message || t('errors.unableToBlockUser' as TranslationKey));
                    } finally {
                      setIsBlockingPublicationUser(false);
                    }
                  }}
                >
                  <Text style={styles.deleteModalButtonTextConfirm}>{t('common.confirm' as TranslationKey)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Publication Report Modal */}
      <Modal
        visible={showPublicationReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (isReportingPublicationUser) return;
          setShowPublicationReportModal(false);
          setPendingPublicationReport(null);
          setPublicationReportReason(null);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => {
            if (isReportingPublicationUser) return;
            setShowPublicationReportModal(false);
            setPendingPublicationReport(null);
            setPublicationReportReason(null);
          }}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.deleteModalContainer, { width: '92%' }]}>
              <Text style={styles.deleteModalTitle}>{t('common.report' as TranslationKey)}</Text>
              <Text style={styles.deleteModalText}>
                {t('home.reportSelectReason' as TranslationKey).replace('{user}', pendingPublicationReport?.username || '@usuario')}
              </Text>

              <View style={{ marginTop: 10, width: '100%' }}>
                {REPORT_REASON_OPTIONS.map((opt) => {
                  const selected = publicationReportReason === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      disabled={isReportingPublicationUser}
                      onPress={() => setPublicationReportReason(opt.value)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: selected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                        {t(opt.labelKey as TranslationKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonCancel, isReportingPublicationUser ? { opacity: 0.6 } : null]}
                  disabled={isReportingPublicationUser}
                  onPress={() => {
                    if (isReportingPublicationUser) return;
                    setShowPublicationReportModal(false);
                    setPendingPublicationReport(null);
                    setPublicationReportReason(null);
                  }}
                >
                  <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel' as TranslationKey)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm, isReportingPublicationUser ? { opacity: 0.6 } : null]}
                  disabled={isReportingPublicationUser || !authToken || !pendingPublicationReport?.email || !publicationReportReason}
                  onPress={async () => {
                    if (!authToken) {
                      Alert.alert(t('auth.sessionRequiredTitle' as TranslationKey), t('auth.signInToReportUsers' as TranslationKey));
                      return;
                    }

                    const current = pendingPublicationReport;
                    if (!current?.email) return;
                    if (!publicationReportReason) return;

                    setIsReportingPublicationUser(true);
                    try {
                      const resp = await fetch(`${API_URL}/api/reports`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${authToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          targetEmail: current.email,
                          reason: publicationReportReason,
                          postId: current.postId,
                        }),
                      });

                      if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err?.error || t('errors.unableToSendReport' as TranslationKey));
                      }

                      setShowPublicationReportModal(false);
                      setPendingPublicationReport(null);
                      setPublicationReportReason(null);
                      showBottomToast(t('toast.reportSent' as TranslationKey));
                    } catch (e: any) {
                      console.error('Error reporting publication user:', e);
                      Alert.alert('Error', e?.message || t('errors.unableToSendReport' as TranslationKey));
                    } finally {
                      setIsReportingPublicationUser(false);
                    }
                  }}
                >
                  <Text style={styles.deleteModalButtonTextConfirm}>{t('common.confirm' as TranslationKey)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Leave + Block Reason Modal */}
      <Modal
        visible={showLeaveBlockModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (isLeavingAndBlocking) return;
          setShowLeaveBlockModal(false);
          setPendingLeaveBlockGroup(null);
          setLeaveBlockReasonText('');
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => {
            if (isLeavingAndBlocking) return;
            setShowLeaveBlockModal(false);
            setPendingLeaveBlockGroup(null);
            setLeaveBlockReasonText('');
          }}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.deleteModalContainer, { width: '92%' }]}>
              <Text style={styles.deleteModalTitle}>Salir y Bloquear</Text>
              <Text style={styles.deleteModalText}>
                {`¿Quieres salir y bloquear al anfitrión de ${pendingLeaveBlockGroup?.hashtag || '#grupo'}?`}
              </Text>

              <View style={{ marginTop: 8, width: '100%', alignSelf: 'stretch' }}>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#FFFFFF',
                    width: '100%',
                    alignSelf: 'stretch',
                    minHeight: 86,
                  }}
                  placeholder="Comentanos el motivo del bloqueo..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={leaveBlockReasonText}
                  onChangeText={(txt) => setLeaveBlockReasonText(String(txt).slice(0, 320))}
                  maxLength={320}
                  multiline
                  textAlignVertical="top"
                  editable={!isLeavingAndBlocking}
                />
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.65)',
                    textAlign: 'right',
                  }}
                >
                  {`${leaveBlockReasonText.length}/320`}
                </Text>
              </View>

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm, isLeavingAndBlocking ? { opacity: 0.6 } : null]}
                  disabled={isLeavingAndBlocking || !authToken || !pendingLeaveBlockGroup?.id}
                  onPress={async () => {
                    if (!authToken) {
                      Alert.alert('Sesión requerida', 'Inicia sesión para salir del grupo.');
                      return;
                    }
                    const current = pendingLeaveBlockGroup;
                    if (!current?.id) return;

                    const reason = String(leaveBlockReasonText || '').trim().slice(0, 320);

                    setIsLeavingAndBlocking(true);
                    try {
                      const resp = await fetch(`${API_URL}/api/groups/${current.id}/leave`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${authToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ block: true, ...(reason ? { reason } : {}) }),
                      });

                      if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err?.error || 'Error al salir del grupo');
                      }

                      setJoinedGroups(currentGroups => currentGroups.filter(g => g.id !== current.id));
                      setBlockedJoinedGroupIds(prev => {
                        const next = prev.includes(current.id) ? prev : [current.id, ...prev];
                        const AsyncStorage = getAsyncStorageSafe();
                        if (AsyncStorage) {
                          AsyncStorage.setItem(BLOCKED_JOINED_GROUP_IDS_KEY, JSON.stringify(next)).catch(() => { });
                        }
                        return next;
                      });

                      setShowLeaveBlockModal(false);
                      setPendingLeaveBlockGroup(null);
                      setLeaveBlockReasonText('');
                    } catch (e: any) {
                      console.error('Error leaving & blocking group:', e);
                      Alert.alert('Error', e?.message || 'No se pudo salir del grupo');
                    } finally {
                      setIsLeavingAndBlocking(false);
                    }
                  }}
                >
                  <Text style={styles.deleteModalButtonTextConfirm}>{t('common.confirm' as TranslationKey)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      < Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalContainer, { width: '96%' }]}>
            <Text style={styles.deleteModalTitle}>{t('front.deletePublicationTitle' as TranslationKey)}</Text>
            <Text style={[styles.deleteModalText, styles.deleteModalTextJustified]}>
              {t('front.deletePublicationBody' as TranslationKey)}
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalButtonTextCancel}>{t('common.cancel' as TranslationKey)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonConfirm]}
                onPress={() => {
                  void confirmDeletePublication('manual');
                }}
              >
                <Text style={styles.deleteModalButtonTextConfirm}>{t('common.confirm' as TranslationKey)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal >

      {/* Group Photo Editor Opening Overlay */}
      <Modal
        visible={isOpeningGroupPhotoEditor}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Bloqueante: no permitir cerrar con back mientras se abre el editor.
        }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ marginTop: 12, color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
            Cargando editor de recorte...
          </Text>
        </View>
      </Modal>

      {/* Group Photo Editor Modal */}
      <Modal
        visible={showGroupPhotoEditor}
        animationType="fade"
        onShow={() => {
          setIsOpeningGroupPhotoEditor(false);
        }}
        onRequestClose={() => {
          setIsOpeningGroupPhotoEditor(false);
          setShowGroupPhotoEditor(false);
          setShowCreateGroupPanel(true);
        }}>
        {tempGroupImageUri && (
          <ProfilePhotoEdit
            imageUri={tempGroupImageUri}
            onBack={() => {
              setIsOpeningGroupPhotoEditor(false);
              setShowGroupPhotoEditor(false);
              setShowCreateGroupPanel(true);
            }}
            onSave={handleSaveGroupImage}
          />
        )}
      </Modal>

      {/* Full Screen Avatar Modal */}
      <Modal
        visible={!!fullScreenAvatarUri}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenAvatarUri(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 20,
              padding: 8,
            }}
            onPress={() => setFullScreenAvatarUri(null)}
          >
            <MaterialIcons name="arrow-back" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenAvatarUri && (
            <Image
              source={{ uri: fullScreenAvatarUri }}
              style={{ width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9, borderRadius: (SCREEN_WIDTH * 0.9) / 2 }}
              resizeMode="cover"
            />
          )}
        </View>
      </Modal>
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  topLeftContainer: {
    position: 'absolute',
    top: ANDROID_SAFE_TOP + 20,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topCenterContainer: {
    position: 'absolute',
    top: ANDROID_SAFE_TOP + 10,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  topRightContainer: {
    position: 'absolute',
    top: ANDROID_SAFE_TOP + 20,
    right: 20,
    zIndex: 10,
    alignItems: 'center',
  },
  discoverText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFB74D',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D1B0E',
    borderWidth: 2,
    borderColor: '#2D1B0E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  unreadCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffb941d7',
  },
  unreadCountBadgeText: {
    color: '#ffffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profileTextContainer: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  socialText: {
    color: '#FFB74D',
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
  },
  topRightLogo: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingTop: 80,
    paddingBottom: 80,
  },
  homeScreenContainer: {
    flex: 1,
    paddingTop: 64,
    paddingBottom: 0,
  },
  homeSwipeTutorialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.35)',
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  homeSwipeTutorialText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  optionsPanel: {
    backgroundColor: '#2D1B0E',
    borderWidth: 2,
    borderColor: '#2D1B0E',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 0.1)',
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    textAlign: 'center',
  },
  profileEmptyHint: {
    position: 'absolute',
    top: 12,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#FFB74D',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  profileEmptyHintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileEmptyHintIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileEmptyPrimaryMessage: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  profileEmptySecondaryMessage: {
    color: 'rgba(255, 255, 255, 0.52)',
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 26,
    marginTop: 10,
  },
  homeLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  homeLoadingBottomLogo: {
    position: 'absolute',
    bottom: 92,
    width: 150,
    height: 44,
    opacity: 0.95,
  },
  homeLoadingAvatarFrame: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  homeLoadingAvatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  homeLoadingRingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainerCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    marginTop: 10,
    marginBottom: 10,
  },
  giveAwayCard: {
    marginBottom: 30,
  },
  giveAwayPulsacionesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#000000',
    paddingTop: 0,
    paddingBottom: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  bottomNavLeft: {
    flexDirection: 'row',
    gap: 20,
  },
  bottomNavItem: {
    paddingTop: 1,
    paddingBottom: 2,
    paddingHorizontal: 8,
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPublicationProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 54,
    minHeight: 16,
  },
  nextPublicationProgressLine: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPublicationCooldownText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
    minWidth: 24,
    textAlign: 'center',
  },
  bottomNavItemActive: {
    backgroundColor: '#000000',
    borderRadius: 50,
    width: 39,
    height: 39,
    borderWidth: 2,
    borderColor: '#FFB74D',
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomToastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    zIndex: 9999,
  },
  bottomToastPanel: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    maxWidth: '92%',
  },
  bottomToastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sidePanelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidePanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '60%',
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  sidePanelHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#2D1B0E',
    alignItems: 'center',
  },
  profileIconCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2D1B0E',
    borderWidth: 2,
    borderColor: '#2D1B0E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  sidePanelUsername: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sidePanelEmail: {
    color: '#FFB74D',
    fontSize: 14,
    opacity: 0.8,
  },
  sidePanelOptions: {
    flex: 1,
    paddingTop: 20,
  },
  sidePanelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sidePanelOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  sidePanelFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#2D1B0E',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  logoutButtonText: {
    color: '#FFB74D',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  // Estilos para pantalla Profile
  profileScreenContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? ANDROID_SAFE_TOP + 68 : 68,
    paddingBottom: 0,
    paddingHorizontal: 2,
  },
  profileScrollContent: {
    flexGrow: 1,
    paddingBottom: 2,
  },
  profileContentWrapper: {
    flex: 1,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileContentBox: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#FFB74D',
    borderRadius: 20,
    overflow: 'hidden',
  },
  addCarouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  addCarouselSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 40,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  carouselViewer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 32,
  },
  carouselFlatList: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
  },
  carouselImageSlide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselImageFrame: {
    width: SCREEN_WIDTH,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: '#000000',
    position: 'relative',
  },
  carouselImageFrameSquare: {
    aspectRatio: 1,
  },
  carouselImageFramePortrait: {
    aspectRatio: 3 / 4,
  },
  deleteModalContainer: {
    width: '80%',
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalTextJustified: {
    textAlign: 'justify',
    alignSelf: 'stretch',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  deleteModalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  deleteModalButtonConfirm: {
    backgroundColor: '#ff6d5dff',
  },
  deleteModalButtonTextCancel: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deleteModalButtonTextConfirm: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPagination: {
    marginTop: 18,
    alignItems: 'center',
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  carouselDotActive: {
    width: 24,
    borderRadius: 4,
  },

  homeCarouselLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeCarouselLoadingPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  homeCarouselLoadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  homeCarouselLoadingSubText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: 'bold',
  },

  profileCarouselLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCarouselLoadingPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  profileCarouselLoadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileCarouselLoadingSubText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: 'bold',
  },
  imageActionsOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 15,
  },
  editImageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 0,
  },
  removeImageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  plusLine: {
    backgroundColor: '#FFB74D',
    position: 'absolute',
    borderRadius: 10,
  },
  plusLineVertical: {
    width: 6,
    height: 60,
  },
  plusLineHorizontal: {
    width: 60,
    height: 6,
  },
  addCarouselText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  addCarouselTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  plusLineDisabled: {
    backgroundColor: 'rgba(255, 183, 77, 0.3)',
  },
  presentationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 20,
  },
  overlayField: {
    width: '100%',
    marginBottom: 14,
  },
  overlayFieldLarge: {
    minHeight: 140,
    marginBottom: 0,
  },
  overlayLabel: {
    color: '#FFB74D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  overlayInput: {
    backgroundColor: 'rgba(45, 27, 14, 0.27)',
    borderWidth: 1,
    borderColor: '#2D1B0E',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  overlayInputMultiline: {
    minHeight: 90,
  },
  overlayCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  profilePresentationCarousel: {
    width: SCREEN_WIDTH - 4,
    alignSelf: 'center',
    marginBottom: 8,
  },
  profilePresentationSlide: {
    width: SCREEN_WIDTH - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePresentationOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    justifyContent: 'flex-end',
  },
  profileRingHintOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  profileRingHintPill: {
    maxWidth: 360,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileRingHintText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  profilePresentationOverlayContent: {
    backgroundColor: 'rgba(45, 27, 14, 0.54)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: '#FFB74D',
  },
  profilePresentationOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'justify',
  },
  profilePresentationToggleLink: {
    color: '#FFB74D',
    fontSize: 10,
    fontWeight: '600',
  },
  profilePresentationOverlayText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'justify',
  },
  profileMetaContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  profileLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  profileLikeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    right: 0,
  },
  profileLikeCount: {
    color: '#ffffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileBrandIcon: {
    width: 24,
    height: 24,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  profilePhotoContainer: {
    marginBottom: 16,
  },
  profilePhotoLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#2D1B0E',
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2D1B0E',
    borderWidth: 3,
    borderColor: '#2D1B0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileUsername: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  profileEmail: {
    color: '#FFB74D',
    fontSize: 14,
    opacity: 0.8,
  },
  profileSection: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2D1B0E',
  },
  profileSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFB74D',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
  },
  // Estilos para pantalla Chat
  chatContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  groupMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupMessageRightActions: {
    marginLeft: 6,
    paddingTop: 2,
    position: 'relative',
    zIndex: 60,
    elevation: 60,
  },
  groupMessageOptionsButton: {
    paddingLeft: 6,
    paddingVertical: 2,
  },
  groupMessageOptionsMenu: {
    position: 'absolute',
    top: 20,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 12,
    minWidth: 130,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  groupMessageOptionsMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  groupMessageOptionsMenuText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  groupMessageOptionsMenuTextDanger: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  publicationOptionsMenu: {
    position: 'absolute',
    top: -6,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 12,
    minWidth: 130,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  publicationOptionsMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  publicationOptionsMenuText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  publicationOptionsMenuTextDanger: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  // Estilos para pantalla Intimidades
  intimaciesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Botón Publicar
  publishButton: {
    marginTop: 10,
    width: '40%',
    backgroundColor: '#000000',
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFB74D',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  publishButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(255, 183, 77, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  publishButtonText: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  publishButtonTextDisabled: {
    color: 'rgba(255, 183, 77, 0.3)',
  },

  // Botón Aplicar
  applyButton: {
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  applyButtonActive: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  applyButtonDisabled: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#2d150eff',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  applyButtonTextActive: {
    color: '#FFB74D',
  },
  applyButtonTextDisabled: {
    color: '#2d150eff',
  },
  profilePresentationLockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  profilePresentationLockedCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  profilePresentationLockedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  profilePresentationLockedText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  bottomPanel: {
    width: SCREEN_WIDTH - 6,
    minHeight: 46,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFB74D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SOCIAL_PANEL_HEIGHT,
    backgroundColor: '#000000',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 999,
    paddingTop: Platform.OS === 'ios' ? 40 : ANDROID_STATUS_BAR_HEIGHT + 10,
    borderBottomWidth: 0,
  },
  socialIconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  socialIconContainer: {
    marginHorizontal: 1, // 2px separation (1px each side)
    padding: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  socialIconSelected: {
    borderColor: '#FFB74D',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  socialIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  socialPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
    backgroundColor: 'transparent',
  },
  socialLinkInputContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  socialPanelInput: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',

    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFB74D',
    marginTop: 8,
  },
  socialPanelInputDisabled: {
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
    borderColor: 'rgba(255, 152, 0, 0.1)',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  socialPanelInputError: {
    borderColor: '#D84315',
  },

  socialPanelErrorText: {
    color: '#D84315',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  linkButton: {
    backgroundColor: '#FFB74D',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  linkButtonDisabled: {
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.2)',
  },
  linkButtonText: {
    color: '#2D1B0E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  linkButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  linkedIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  linkedHeaderIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  unlinkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(90, 77, 12, 1)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33, 30, 16, 1)',
    zIndex: 10,
  },
  categorySelectorContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  categoryLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 27, 14, 0.27)',
    borderWidth: 1,
    borderColor: '#2D1B0E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  categoryModalContent: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#FFB74D',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#FFB74D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  categoryOptionTextSelected: {
    color: '#FFB74D',
    fontWeight: 'bold',
  },
  appliedCategoryContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedCategoryText: {
    color: '#ffffffff',
    fontSize: 12,
    fontWeight: 'normal',
  },
  presentationHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
    width: '100%',
    position: 'relative',
  },
  presentationUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  presentationAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: '#2D1B0E',
    borderWidth: 1,
    borderColor: '#FFB74D',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  presentationAvatar: {
    width: '100%',
    height: '100%',
  },
  presentationUserDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  presentationUsername: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'normal',
    marginBottom: 2,
  },
  presentationNationality: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  presentationSocialsContainer: {
    height: 20,
    width: 60,
  },
  presentationSocialsContent: {
    alignItems: 'center',
    paddingRight: 10,
  },
  presentationSocialIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    marginRight: 8,
  },
  categoryBelowIndicator: {
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  categoryBelowIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileLikeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileLikeButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reactionPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 250,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#FFB74D',
    zIndex: 11000,
    elevation: 11000,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  reactionPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  reactionPanelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reactionScrollView: {
    flex: 1,
  },
  reactionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    flexGrow: 0,
    paddingBottom: 0,
  },
  reactionItem: {
    width: REACTION_ITEM_SIZE,
    height: REACTION_ITEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: REACTION_ITEM_SIZE / 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionItemSelected: {
    borderColor: '#FFB74D',
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
  },
  reactionEmoji: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  profileRingColorPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#FFB74D',
    zIndex: 11000,
    elevation: 11000,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: Math.round(SCREEN_HEIGHT * 0.62),
  },
  profileRingViewerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    borderTopColor: '#FFB74D',
    zIndex: 11000,
    elevation: 11000,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: Math.round(SCREEN_HEIGHT * 0.62),
  },
  profileRingViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  profileRingViewerColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  profileRingViewerHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    maxWidth: Math.round(SCREEN_WIDTH * 0.62),
  },
  profileRingViewerScrollContent: {
    paddingBottom: 10,
  },
  profileRingViewerAdContainer: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  profileRingViewerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'justify',
  },
  profileRingViewerDescription: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'justify',
  },
  profileRingViewerMetaSection: {
    marginTop: 16,
  },
  profileRingViewerMetaLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  profileRingViewerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  profileRingViewerLinkLogo: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  profileRingViewerMetaText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 13,
    lineHeight: 18,
  },
  profileRingColorPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileRingApplyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
    position: 'relative',
  },
  profileRingApplyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileRingApplyActionDisabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
  },
  profileRingDeleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  profileRingDeleteActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  profileRingColorOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  profileRingColorOptionOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRingColorOptionOuterSelected: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  profileRingColorOptionInner: {
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  profileRingPanelScroll: {
    flexGrow: 0,
  },
  profileRingPanelScrollContent: {
    paddingBottom: 8,
  },
  profileRingMetaContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  profileRingFieldLabel: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  profileRingFieldHelper: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontWeight: '400',
    marginTop: -2,
    marginBottom: 10,
  },
  profileRingTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  profileRingTextArea: {
    minHeight: 92,
    maxHeight: 160,
  },
  profileRingLinkLocationContainer: {
    marginTop: 14,
  },
  profileRingLinkLocationBlock: {
    paddingVertical: 6,
  },
  profileRingLinkLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  profileRingLinkLocationHelper: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: -6,
    marginLeft: 28,
    lineHeight: 16,
  },
  profileRingLinkPreviewText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 10,
  },
  profileRingLinkPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
    paddingRight: 6,
    gap: 8,
  },
  profileRingPreviewRemoveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  profileRingLinkedIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  profileRingLocationPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
    gap: 8,
    paddingRight: 6,
  },
  profileRingLocationPreviewText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  profileRingLocationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  profileRingLocationModalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.55)',
    overflow: 'hidden',
  },
  profileRingLocationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 183, 77, 0.22)',
  },
  profileRingLocationModalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileRingLocationMapContainer: {
    width: '100%',
    height: Math.round(SCREEN_HEIGHT * 0.45),
    backgroundColor: '#111111',
  },
  profileRingLocationSearchContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
  },
  profileRingLocationSearchBar: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.28)',
    paddingHorizontal: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileRingLocationSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  profileRingLocationSearchErrorRow: {
    marginTop: 8,
    backgroundColor: 'rgba(216, 67, 21, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216, 67, 21, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileRingLocationSearchErrorText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  profileRingLocationPredictionsCard: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.22)',
    overflow: 'hidden',
    maxHeight: 220,
  },
  profileRingLocationPredictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  profileRingLocationPredictionText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  profileRingLocationCenterPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -17 }, { translateY: -34 }],
  },
  profileRingLocationLocatingOverlay: {
    position: 'absolute',
    left: 12,
    top: 12,
    right: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileRingLocationLocatingText: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    fontWeight: '600',
  },
  profileRingLocationModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileRingLocationModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFB74D',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRingLocationModalButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.35)',
  },
  profileRingLocationModalButtonDisabled: {
    backgroundColor: 'rgba(255, 183, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.2)',
  },
  profileRingLocationModalButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  profileRingLocationModalButtonTextPrimary: {
    color: '#2D1B0E',
    fontSize: 13,
    fontWeight: '800',
  },
  profileRingLinkPickerContainer: {
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 183, 77, 0.25)',
  },
  profileRingLinkInputContainer: {
    width: '100%',
    paddingHorizontal: 6,
    marginTop: 4,
  },
  profileRingLinkApplyButton: {
    alignSelf: 'center',
    marginTop: 12,
  },
  profileRingSocialIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  profileRingLinkLocationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  galleryPermissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  galleryPermissionPanel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
    padding: 18,
  },
  galleryPermissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  galleryPermissionBody: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  galleryPermissionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  channelImageUnlockAdPanel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
    padding: 14,
  },
  channelImageUnlockAdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  channelImageUnlockAdTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  channelImageUnlockAdCloseButton: {
    padding: 6,
  },
  channelImageUnlockAdBodyCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  channelImageUnlockAdHintText: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  channelImageUnlockAdErrorText: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 13,
    textAlign: 'center',
  },
  nativeAdContainer: {
    width: '100%',
  },
  nativeAdAttributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  nativeAdBadge: {
    backgroundColor: '#FFB74D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nativeAdBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  nativeAdHeadline: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  nativeAdMedia: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  nativeAdBody: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
  nativeAdCta: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFB74D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeAdCtaText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  galleryPermissionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPermissionButtonSecondary: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  galleryPermissionButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  galleryPermissionButtonPrimary: {
    backgroundColor: '#FFB74D',
  },
  galleryPermissionButtonPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default FrontScreen;
