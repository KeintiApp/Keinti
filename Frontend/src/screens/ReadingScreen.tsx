import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaskedView from '@react-native-masked-view/masked-view';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import audioRecorderPlayer, {
  AudioEncoderAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  OutputFormatAndroidType,
  type AudioSet,
  type RecordBackType,
} from '../services/audioRecorderPlayer';
import ImageCropPicker from 'react-native-image-crop-picker';
import VoiceNotePlayer, { stopSharedVoiceNotePlayback } from '../components/VoiceNotePlayer';
import { API_URL, getServerResourceUrl } from '../config/api';
import {
  CHANNEL_EVENT_SOCIAL_OPTIONS,
  normalizeExternalUrl,
  normalizeSocialNetworkKey,
  SOCIAL_ICONS,
  SOCIAL_PLATFORM_NAMES,
  type ChannelEventSocialOption,
  validateSocialLink,
} from '../constants/socialLinks';
import { searchUsersByUsername, type UsernameSuggestion, uploadImage } from '../services/userService';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface ReadingScreenProps {
  onBack: () => void;
  authToken?: string;
  channelPostId?: string | number | null;
}

type VoiceNotePlacement = 'intro' | 'inline' | 'outro';

const READING_MAX_VOICE_NOTES = 3;
const READING_MAX_INLINE_VOICE_NOTES = 1;
const READING_MAX_VOICE_NOTE_DURATION_SECONDS = 60;
const READING_MAX_VOICE_NOTE_DURATION_MS = READING_MAX_VOICE_NOTE_DURATION_SECONDS * 1000;
const READING_VOICE_NOTE_TEXT_MAX_LENGTH = 40;
const READING_VOICE_NOTE_MIME_TYPE = 'audio/mp4';

const READING_VOICE_NOTE_AUDIO_SET: AudioSet = {
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioChannelsAndroid: 1,
  AudioSamplingRateAndroid: 44100,
  AudioEncodingBitRateAndroid: 64000,
  MaxDurationMillis: READING_MAX_VOICE_NOTE_DURATION_MS,
  AVFormatIDKeyIOS: AVEncodingOption.aac as AudioSet['AVFormatIDKeyIOS'],
  AVNumberOfChannelsKeyIOS: 1,
  AVSampleRateKeyIOS: 44100,
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
  AVEncoderBitRateKeyIOS: 64000,
};
type ReadingInsertion =
  | {
      type: 'image';
      uri: string;
    }
  | {
      type: 'intertitle';
      text: string;
    }
  | {
      type: 'voice-note';
      uri: string;
      durationSeconds: number;
      mimeType?: string | null;
      noteText?: string | null;
    }
  | {
      type: 'social-link';
      network: string;
      link: string;
    };

type ReadingVoiceNote = {
  uri: string;
  durationSeconds: number;
  mimeType?: string | null;
  noteText?: string | null;
};

const TITLE_MAX_LENGTH = 80;
const SUBTITLE_MAX_LENGTH = 120;
const LEAD_MAX_LENGTH = 240;
type ChannelReadingMessageInsertion =
  | {
      type: 'image';
      url: string;
    }
  | {
      type: 'intertitle';
      text: string;
    }
  | {
      type: 'voice-note';
      url: string;
      durationSeconds: number;
      mimeType?: string | null;
      noteText?: string | null;
    }
  | {
      type: 'social-link';
      network: string;
      link: string;
    };

type ChannelReadingMessageVoiceNote = {
  url: string;
  durationSeconds: number;
  mimeType?: string | null;
  noteText?: string | null;
};

type ChannelReadingMessagePayload = {
  title: string;
  subtitle: string;
  lead: string;
  date: string;
  category: string;
  hypeCost?: number | null;
  introAudio?: ChannelReadingMessageVoiceNote | null;
  bodySections: string[];
  insertions: ChannelReadingMessageInsertion[];
  outroAudio?: ChannelReadingMessageVoiceNote | null;
  imageUrls: string[];
  citations: Array<{
    id: string;
    sectionIndex: number;
    start: number;
    end: number;
    text: string;
    appearance: CitationAppearance;
    users: SelectedCitedUser[];
  }>;
};
const BODY_MIN_LENGTH = 800;
const READING_MAX_IMAGES = 3;
const INTERTITLE_MAX_LENGTH = 80;
const MAX_VISIBLE_CITED_USERS = 5;
const CHANNEL_READING_MESSAGE_PREFIX = '__KREAD__';

type BodySelectionState = {
  sectionIndex: number;
  start: number;
  end: number;
  text: string;
};

type SelectedCitedUser = {
  username: string;
  profile_photo_uri?: string | null;
  social_networks?: Array<{ network: string; link?: string | null }>;
};

type CitationAppearance = 'white' | 'gradient';

type ReadingCitation = {
  id: string;
  sectionIndex: number;
  start: number;
  end: number;
  text: string;
  users: SelectedCitedUser[];
  appearance: CitationAppearance;
};

const READING_CATEGORY_OPTIONS = [
  'event.typeOption.social',
  'event.typeOption.cultural',
  'event.typeOption.artistic',
  'event.typeOption.business',
  'event.typeOption.economic',
  'event.typeOption.academic',
  'event.typeOption.sports',
  'event.typeOption.entertainment',
  'event.typeOption.political',
  'event.typeOption.religious',
  'event.typeOption.marketing',
  'event.typeOption.charity',
  'event.typeOption.audiovisual',
  'event.typeOption.scientific',
  'event.typeOption.technological',
  'event.typeOption.children',
  'event.typeOption.musical',
  'event.typeOption.automotive',
  'event.typeOption.fitness',
  'event.typeOption.gastronomic',
  'event.typeOption.work',
] as const satisfies readonly TranslationKey[];

type ReadingCategoryOption = typeof READING_CATEGORY_OPTIONS[number];

const APPLY_BUTTON_GRADIENT_COLORS = ['#FFB74D', '#ffe45c'];
const CITATION_USER_SOCIAL_ICON_SIZE = 18;
const CITATION_USER_SOCIAL_ICON_GAP = 10;
const CITATION_USER_SOCIAL_VIEWPORT_COUNT = 3;

const normalizeMentionUsername = (value: string) => String(value || '').trim().replace(/^@+/, '');
const formatReadingIntegerInput = (raw: string) => {
  const digitsOnly = String(raw || '').replace(/\D+/g, '');
  if (!digitsOnly) {return '';}

  const normalizedDigits = digitsOnly.replace(/^0+(?=\d)/, '');
  return normalizedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const sanitizeReadingAmountInput = (value: string) => value.replace(/\D+/g, '').replace(/^0+(?=\d)/, '');

const sanitizeVoiceNoteTextInput = (value: string) => String(value || '').slice(0, READING_VOICE_NOTE_TEXT_MAX_LENGTH);

const normalizeVoiceNoteText = (value: unknown) => {
  const text = sanitizeVoiceNoteTextInput(String(value ?? '')).trim();
  return text || null;
};

const sanitizeChannelReadingVoiceNote = (audio: ChannelReadingMessageVoiceNote | null | undefined) => {
  const url = String(audio?.url || '').trim();
  if (!url) {
    return null;
  }

  return {
    url,
    durationSeconds: Math.max(0, Math.floor(Number(audio?.durationSeconds) || 0)),
    mimeType: typeof audio?.mimeType === 'string' ? audio.mimeType.trim() || null : null,
    noteText: normalizeVoiceNoteText(audio?.noteText),
  };
};

const encodeChannelReadingMessage = (payload: ChannelReadingMessagePayload) => {
  const safe = {
    title: String(payload?.title || '').trim(),
    subtitle: String(payload?.subtitle || '').trim(),
    lead: String(payload?.lead || '').trim(),
    date: String(payload?.date || '').trim(),
    category: String(payload?.category || '').trim(),
    hypeCost: typeof payload?.hypeCost === 'number' && Number.isFinite(payload.hypeCost)
      ? Math.max(0, Math.floor(payload.hypeCost))
      : null,
    introAudio: sanitizeChannelReadingVoiceNote(payload?.introAudio),
    bodySections: Array.isArray(payload?.bodySections)
      ? payload.bodySections.map((section) => String(section || ''))
      : [],
    insertions: Array.isArray(payload?.insertions)
      ? payload.insertions.reduce<ChannelReadingMessageInsertion[]>((accumulator, insertion) => {
        if (insertion?.type === 'image') {
          const url = String(insertion?.url || '').trim();
          if (url) {
            accumulator.push({ type: 'image', url });
          }
          return accumulator;
        }

        if (insertion?.type === 'intertitle') {
          const text = String(insertion?.text || '').trim();
          if (text) {
            accumulator.push({ type: 'intertitle', text });
          }
          return accumulator;
        }

        if (insertion?.type === 'voice-note') {
          const url = String(insertion?.url || '').trim();
          if (url) {
            accumulator.push({
              type: 'voice-note',
              url,
              durationSeconds: Math.max(0, Math.floor(Number(insertion?.durationSeconds) || 0)),
              mimeType: typeof insertion?.mimeType === 'string' ? insertion.mimeType.trim() || null : null,
              noteText: normalizeVoiceNoteText(insertion?.noteText),
            });
          }
          return accumulator;
        }

        if (insertion?.type === 'social-link') {
          const network = normalizeSocialNetworkKey(insertion?.network);
          const link = String(insertion?.link || '').trim();
          if (network && link && validateSocialLink(network, link)) {
            accumulator.push({ type: 'social-link', network, link });
          }
        }

        return accumulator;
      }, [])
      : [],
    outroAudio: sanitizeChannelReadingVoiceNote(payload?.outroAudio),
    imageUrls: Array.isArray(payload?.imageUrls)
      ? payload.imageUrls.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    citations: Array.isArray(payload?.citations)
      ? payload.citations.reduce<ChannelReadingMessagePayload['citations']>((accumulator, citation) => {
        const text = String(citation?.text || '').trim();
        if (!text) {
          return accumulator;
        }

        accumulator.push({
          id: String(citation?.id || '').trim() || `citation-${accumulator.length}`,
          sectionIndex: Math.max(0, Math.floor(Number(citation?.sectionIndex) || 0)),
          start: Math.max(0, Math.floor(Number(citation?.start) || 0)),
          end: Math.max(0, Math.floor(Number(citation?.end) || 0)),
          text,
          appearance: citation?.appearance === 'gradient' ? 'gradient' : 'white',
          users: Array.isArray(citation?.users)
            ? citation.users.reduce<SelectedCitedUser[]>((usersAccumulator, user) => {
              const username = String(user?.username || '').trim();
              if (!username) {
                return usersAccumulator;
              }

              usersAccumulator.push({
                username,
                profile_photo_uri: typeof user?.profile_photo_uri === 'string' ? user.profile_photo_uri.trim() : null,
                social_networks: Array.isArray(user?.social_networks)
                  ? user.social_networks
                    .map((social) => ({
                      network: String(social?.network || '').trim(),
                      link: typeof social?.link === 'string' ? social.link.trim() : null,
                    }))
                    .filter((social) => social.network)
                  : [],
              });
              return usersAccumulator;
            }, [])
            : [],
        });
        return accumulator;
      }, [])
      : [],
  };

  return `${CHANNEL_READING_MESSAGE_PREFIX}${JSON.stringify(safe)}`;
};

const normalizeCitationSocialIconKey = (raw: unknown) => normalizeSocialNetworkKey(raw);

const getRenderableReadingSocialLink = (rawNetwork: unknown, rawLink: unknown) => {
  const key = normalizeCitationSocialIconKey(rawNetwork);
  const displayLink = String(rawLink ?? '').trim();
  if (!key || !displayLink) {
    return null;
  }

  const normalizedLink = normalizeExternalUrl(displayLink);
  if (!normalizedLink) {
    return null;
  }

  const iconSource = SOCIAL_ICONS[key as keyof typeof SOCIAL_ICONS];
  if (!iconSource) {
    return null;
  }

  return {
    key,
    iconSource,
    link: normalizedLink,
    displayLink,
  };
};

const getRenderableCitationUserSocials = (socialNetworks?: Array<{ network: string; link?: string | null }>) => {
  if (!Array.isArray(socialNetworks)) {
    return [];
  }

  const seen = new Set<string>();
  return socialNetworks.reduce<Array<{ key: string; iconSource: any; link: string }>>((accumulator, social) => {
    const renderableSocialLink = getRenderableReadingSocialLink(social?.network, social?.link);
    if (!renderableSocialLink || seen.has(renderableSocialLink.key)) {
      return accumulator;
    }

    seen.add(renderableSocialLink.key);
    accumulator.push({
      key: renderableSocialLink.key,
      iconSource: renderableSocialLink.iconSource,
      link: renderableSocialLink.link,
    });
    return accumulator;
  }, []);
};

const getNearestTextMatchIndex = (sourceText: string, queryText: string, preferredIndex: number) => {
  const normalizedQuery = String(queryText || '');
  if (!normalizedQuery) {
    return -1;
  }

  let matchIndex = sourceText.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return -1;
  }

  let nearestIndex = matchIndex;
  let smallestDistance = Math.abs(matchIndex - preferredIndex);

  while (matchIndex !== -1) {
    const nextDistance = Math.abs(matchIndex - preferredIndex);
    if (nextDistance < smallestDistance) {
      nearestIndex = matchIndex;
      smallestDistance = nextDistance;
    }

    matchIndex = sourceText.indexOf(normalizedQuery, matchIndex + 1);
  }

  return nearestIndex;
};

const formatReadingDateDigits = (digits: string) => {
  const cleaned = String(digits || '').replace(/[^0-9]/g, '').slice(0, 8);
  if (cleaned.length <= 2) {return cleaned;}
  if (cleaned.length <= 4) {return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;}
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
};

const hexToRgb = (value: string) => {
  const normalized = String(value || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16),
  };
};

const interpolateHexColor = (startColor: string, endColor: string, ratio: number) => {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  const channelToHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

  const red = start.red + ((end.red - start.red) * clampedRatio);
  const green = start.green + ((end.green - start.green) * clampedRatio);
  const blue = start.blue + ((end.blue - start.blue) * clampedRatio);

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
};

const renderGradientTextContent = ({
  text,
  keyPrefix,
  startColor,
  endColor,
}: {
  text: string;
  keyPrefix: string;
  startColor: string;
  endColor: string;
}) => {
  const characters = Array.from(String(text || ''));
  const denominator = Math.max(1, characters.length - 1);

  return characters.map((character, index) => (
    <Text
      key={`${keyPrefix}-${index}`}
      style={{ color: interpolateHexColor(startColor, endColor, index / denominator) }}
    >
      {character}
    </Text>
  ));
};

const renderReadingTextFragments = ({
  text,
  citations,
  keyPrefix,
  plainTextStyle,
  whiteCitationStyle,
  gradientCitationStyle,
  onPressCitation,
  useGradientCharacterColors = true,
}: {
  text: string;
  citations: ReadingCitation[];
  keyPrefix: string;
  plainTextStyle: any;
  whiteCitationStyle: any;
  gradientCitationStyle: any;
  onPressCitation?: (citation: ReadingCitation) => void;
  useGradientCharacterColors?: boolean;
}) => {
  if (!citations.length) {
    return text;
  }

  const fragments: React.ReactNode[] = [];
  let cursor = 0;

  citations.forEach((citation, citationIndex) => {
    if (cursor < citation.start) {
      fragments.push(
        <Text
          key={`${keyPrefix}-plain-${citationIndex}-${cursor}`}
          style={plainTextStyle}
        >
          {text.slice(cursor, citation.start)}
        </Text>
      );
    }

    fragments.push(
      <Text
        key={`${keyPrefix}-citation-${citation.id}`}
        style={citation.appearance === 'gradient' ? gradientCitationStyle : whiteCitationStyle}
        onPress={onPressCitation ? () => onPressCitation(citation) : undefined}
        suppressHighlighting={!!onPressCitation}
      >
          {citation.appearance === 'gradient' && useGradientCharacterColors
          ? renderGradientTextContent({
            text: text.slice(citation.start, citation.end),
            keyPrefix: `${keyPrefix}-gradient-${citation.id}`,
            startColor: APPLY_BUTTON_GRADIENT_COLORS[0],
            endColor: APPLY_BUTTON_GRADIENT_COLORS[1],
          })
          : text.slice(citation.start, citation.end)}
      </Text>
    );

    cursor = citation.end;
  });

  if (cursor < text.length) {
    fragments.push(
      <Text key={`${keyPrefix}-plain-tail-${cursor}`} style={plainTextStyle}>
        {text.slice(cursor)}
      </Text>
    );
  }

  return fragments;
};

const reconcileSectionCitations = (nextText: string, citations: ReadingCitation[]) => {
  const normalizedText = String(nextText || '');
  if (!normalizedText.trim()) {
    return [];
  }

  return citations.reduce<ReadingCitation[]>((accumulator, citation) => {
    const expectedText = String(citation.text || '');
    if (!expectedText) {
      return accumulator;
    }

    const currentSlice = normalizedText.slice(citation.start, citation.end);
    if (currentSlice === expectedText) {
      accumulator.push({
        ...citation,
        end: citation.start + expectedText.length,
      });
      return accumulator;
    }

    const nextStart = getNearestTextMatchIndex(normalizedText, expectedText, citation.start);
    if (nextStart === -1) {
      return accumulator;
    }

    accumulator.push({
      ...citation,
      start: nextStart,
      end: nextStart + expectedText.length,
    });
    return accumulator;
  }, []);
};

const getAndroidGalleryPermission = () => {
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  return apiLevel >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
};

const ReadingScreen = ({ onBack, authToken, channelPostId }: ReadingScreenProps) => {
  const { t } = useI18n();
  const safeAreaInsets = useSafeAreaInsets();
  const currentVoiceNoteRecordingUriRef = useRef<string | null>(null);
  const voiceNoteRecordingTargetRef = useRef<VoiceNotePlacement | null>(null);
  const voiceNoteRecordingDurationMsRef = useRef(0);
  const voiceNoteRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingVoiceNoteRecordingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [lead, setLead] = useState('');
  const [readingDate, setReadingDate] = useState('');
  const [selectedReadingCategory, setSelectedReadingCategory] = useState<ReadingCategoryOption | null>(null);
  const [showReadingCategoryOptions, setShowReadingCategoryOptions] = useState(false);
  const [readingCategorySearchQuery, setReadingCategorySearchQuery] = useState('');
  const [readingHypeCostInput, setReadingHypeCostInput] = useState('');
  const [showReadingHypeCostInfo, setShowReadingHypeCostInfo] = useState(false);
  const [introVoiceNote, setIntroVoiceNote] = useState<ReadingVoiceNote | null>(null);
  const [bodySections, setBodySections] = useState<string[]>(['']);
  const [readingInsertions, setReadingInsertions] = useState<ReadingInsertion[]>([]);
  const [outroVoiceNote, setOutroVoiceNote] = useState<ReadingVoiceNote | null>(null);
  const [voiceNoteDraftTexts, setVoiceNoteDraftTexts] = useState<Record<VoiceNotePlacement, string>>({
    intro: '',
    inline: '',
    outro: '',
  });
  const [focusedBodySectionIndex, setFocusedBodySectionIndex] = useState(0);
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [isCiteSelectionMode, setIsCiteSelectionMode] = useState(false);
  const [bodySelection, setBodySelection] = useState<BodySelectionState | null>(null);
  const [citedUsername, setCitedUsername] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [usernameSuggestions, setUsernameSuggestions] = useState<UsernameSuggestion[]>([]);
  const [isLoadingUsernameSuggestions, setIsLoadingUsernameSuggestions] = useState(false);
  const [selectedCitedUsers, setSelectedCitedUsers] = useState<SelectedCitedUser[]>([]);
  const [selectedCitationAppearance, setSelectedCitationAppearance] = useState<CitationAppearance>('white');
  const [editingBodySectionIndex, setEditingBodySectionIndex] = useState<number | null>(0);
  const [bodySectionSelections, setBodySectionSelections] = useState<Record<number, { start: number; end: number }>>({});
  const [programmaticSelectionSectionIndex, setProgrammaticSelectionSectionIndex] = useState<number | null>(null);
  const [readingCitations, setReadingCitations] = useState<ReadingCitation[]>([]);
  const [expandedCitation, setExpandedCitation] = useState<ReadingCitation | null>(null);
  const [showReadingSocialLinkComposer, setShowReadingSocialLinkComposer] = useState(false);
  const [showReadingSocialNetworkOptions, setShowReadingSocialNetworkOptions] = useState(false);
  const [selectedReadingSocialNetwork, setSelectedReadingSocialNetwork] = useState<ChannelEventSocialOption | null>(null);
  const [readingSocialLinkInput, setReadingSocialLinkInput] = useState('');
  const [readingSocialLinkError, setReadingSocialLinkError] = useState('');
  const [isCreatingReading, setIsCreatingReading] = useState(false);
  const [recordingVoiceNoteTarget, setRecordingVoiceNoteTarget] = useState<VoiceNotePlacement | null>(null);
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [isVoiceNoteOperationPending, setIsVoiceNoteOperationPending] = useState(false);
  const [recordingVoiceNoteDurationMs, setRecordingVoiceNoteDurationMs] = useState(0);
  const actionToastAnim = useRef(new Animated.Value(0)).current;
  const bodyInputRefs = useRef<Array<TextInput | null>>([]);
  const readingDateInputRef = useRef<TextInput | null>(null);

  const totalBodyLength = bodySections.reduce((total, section) => total + section.length, 0);
  const selectedImageCount = readingInsertions.filter(insertion => insertion.type === 'image').length;
  const selectedVoiceNoteCount = readingInsertions.filter(insertion => insertion.type === 'voice-note').length
    + (introVoiceNote ? 1 : 0)
    + (outroVoiceNote ? 1 : 0);
  const hasInlineVoiceNote = readingInsertions.filter(insertion => insertion.type === 'voice-note').length >= READING_MAX_INLINE_VOICE_NOTES;
  const isCreateEnabled = [title, subtitle, lead].every((value) => String(value).trim().length > 0)
    && totalBodyLength >= BODY_MIN_LENGTH;
  const isCreateActionEnabled = isCreateEnabled && !isRecordingVoiceNote && !isVoiceNoteOperationPending;
  const readingSocialLinkCanApply = !!selectedReadingSocialNetwork
    && !!readingSocialLinkInput.trim()
    && !readingSocialLinkError;
  const filteredReadingCategoryOptions = useMemo(() => {
    const query = readingCategorySearchQuery.trim().toLowerCase();
    if (!query) {
      return READING_CATEGORY_OPTIONS;
    }

    return READING_CATEGORY_OPTIONS.filter((option) => t(option).toLowerCase().includes(query));
  }, [readingCategorySearchQuery, t]);

  useEffect(() => {
    return () => {
      if (voiceNoteRecordingTimeoutRef.current) {
        clearTimeout(voiceNoteRecordingTimeoutRef.current);
        voiceNoteRecordingTimeoutRef.current = null;
      }
      ImageCropPicker.clean().catch(() => undefined);
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.stopRecorder().catch(() => undefined);
      stopSharedVoiceNotePlayback().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    voiceNoteRecordingDurationMsRef.current = recordingVoiceNoteDurationMs;
  }, [recordingVoiceNoteDurationMs]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event: any) => {
      const nextHeight = Math.max(0, Number(event?.endCoordinates?.height || 0) - safeAreaInsets.bottom);
      setKeyboardHeight(nextHeight);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [safeAreaInsets.bottom]);

  useEffect(() => {
    if (!isCiteSelectionMode) {
      setUsernameSuggestions([]);
      setIsLoadingUsernameSuggestions(false);
      return;
    }

    const normalizedQuery = normalizeMentionUsername(citedUsername);
    if (!normalizedQuery) {
      setUsernameSuggestions([]);
      setIsLoadingUsernameSuggestions(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setIsLoadingUsernameSuggestions(true);

      searchUsersByUsername(normalizedQuery, 5)
        .then((items) => {
          if (cancelled) {
            return;
          }
          setUsernameSuggestions(items);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setUsernameSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingUsernameSuggestions(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [citedUsername, isCiteSelectionMode]);

  useEffect(() => {
    if (editingBodySectionIndex === null) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      bodyInputRefs.current[editingBodySectionIndex]?.focus();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [editingBodySectionIndex, bodySections.length]);

  const focusBodySection = (sectionIndex: number, selectionMode: 'preserve' | 'end' = 'end') => {
    if (selectionMode === 'end') {
      const nextCursorIndex = String(bodySections[sectionIndex] || '').length;
      setBodySectionSelections(previous => ({
        ...previous,
        [sectionIndex]: { start: nextCursorIndex, end: nextCursorIndex },
      }));
      setProgrammaticSelectionSectionIndex(sectionIndex);
    }

    setFocusedBodySectionIndex(sectionIndex);
    setEditingBodySectionIndex(sectionIndex);
  };

  const showActionToast = (message: string) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {return;}

    setActionToast(normalizedMessage);
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
      }
    });
  };

  const clearCiteSelection = () => {
    setBodySelection(null);
    setCitedUsername('');
    setUsernameSuggestions([]);
    setIsLoadingUsernameSuggestions(false);
    setSelectedCitedUsers([]);
  };

  const resetReadingSocialLinkDraft = () => {
    setShowReadingSocialNetworkOptions(false);
    setSelectedReadingSocialNetwork(null);
    setReadingSocialLinkInput('');
    setReadingSocialLinkError('');
  };

  const closeReadingSocialLinkComposer = () => {
    setShowReadingSocialLinkComposer(false);
    resetReadingSocialLinkDraft();
  };

  const clearExpandedCitation = () => {
    setExpandedCitation(null);
  };

  const handleRemoveExpandedCitation = () => {
    const citationId = String(expandedCitation?.id || '').trim();
    if (!citationId) {
      return;
    }

    setReadingCitations((previous) => previous.filter((citation) => citation.id !== citationId));
    setExpandedCitation(null);
  };

  const handleToggleCiteSelectionMode = () => {
    closeReadingSocialLinkComposer();
    setIsCiteSelectionMode(previous => {
      const nextValue = !previous;

      if (nextValue) {
        showActionToast(t('reading.citeSelectionToastBody' as TranslationKey));
      }

      if (!nextValue) {
        clearCiteSelection();
      }

      return nextValue;
    });
  };

  const handleBodySelectionChange = (index: number, start: number, end: number) => {
    const normalizedStart = Math.max(0, Math.min(start, end));
    const normalizedEnd = Math.max(normalizedStart, Math.max(start, end));

    if (programmaticSelectionSectionIndex === index) {
      setProgrammaticSelectionSectionIndex(null);
    }

    setBodySectionSelections(previous => {
      const currentSelection = previous[index];
      if (currentSelection?.start === normalizedStart && currentSelection?.end === normalizedEnd) {
        return previous;
      }

      return {
        ...previous,
        [index]: { start: normalizedStart, end: normalizedEnd },
      };
    });

    if (!isCiteSelectionMode) {
      return;
    }

    const sectionText = String(bodySections[index] || '');

    if (normalizedEnd <= normalizedStart) {
      setBodySelection(previous => {
        if (!previous || previous.sectionIndex !== index) {
          return previous;
        }

        return null;
      });
      return;
    }

    const selectedText = sectionText.slice(normalizedStart, normalizedEnd).trim();
    if (!selectedText) {
      setBodySelection(previous => {
        if (!previous || previous.sectionIndex !== index) {
          return previous;
        }

        return null;
      });
      return;
    }

    setBodySelection({
      sectionIndex: index,
      start: normalizedStart,
      end: normalizedEnd,
      text: selectedText,
    });
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = getAndroidGalleryPermission();
    if (!permission) {
      return false;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(permission);
      if (alreadyGranted) {
        return true;
      }

      const result = await PermissionsAndroid.request(permission, {
        title: t('reading.galleryPermissionTitle' as TranslationKey),
        message: t('reading.galleryPermissionMessage' as TranslationKey),
        buttonNeutral: t('reading.galleryPermissionAskLater' as TranslationKey),
        buttonNegative: t('common.cancel' as TranslationKey),
        buttonPositive: t('common.accept' as TranslationKey),
      });

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          t('reading.galleryPermissionRequiredTitle' as TranslationKey),
          t('reading.galleryPermissionRequiredBody' as TranslationKey),
          [
            { text: t('common.cancel' as TranslationKey), style: 'cancel' },
            { text: t('reading.openSettings' as TranslationKey), onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      // ignore
    }

    return false;
  };

  const requestRecordAudioPermission = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Grabacion no disponible', 'La nota de voz esta disponible solo en Android.');
      return false;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (alreadyGranted) {
        return true;
      }

      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Permiso de microfono',
        message: 'Keinti necesita acceso al microfono para grabar la nota de voz.',
        buttonNeutral: t('reading.galleryPermissionAskLater' as TranslationKey),
        buttonNegative: t('common.cancel' as TranslationKey),
        buttonPositive: t('common.accept' as TranslationKey),
      });

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permiso requerido',
          'Activa el microfono en Ajustes para poder grabar notas de voz.',
          [
            { text: t('common.cancel' as TranslationKey), style: 'cancel' },
            { text: t('reading.openSettings' as TranslationKey), onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      // ignore
    }

    return false;
  };

  const resetVoiceNoteRecordingState = () => {
    if (voiceNoteRecordingTimeoutRef.current) {
      clearTimeout(voiceNoteRecordingTimeoutRef.current);
      voiceNoteRecordingTimeoutRef.current = null;
    }
    currentVoiceNoteRecordingUriRef.current = null;
    voiceNoteRecordingTargetRef.current = null;
    voiceNoteRecordingDurationMsRef.current = 0;
    isStoppingVoiceNoteRecordingRef.current = false;
    setRecordingVoiceNoteTarget(null);
    setIsRecordingVoiceNote(false);
    setRecordingVoiceNoteDurationMs(0);
  };

  const handleChangeVoiceNoteDraftText = (target: VoiceNotePlacement, nextValue: string) => {
    const normalizedValue = sanitizeVoiceNoteTextInput(nextValue);

    setVoiceNoteDraftTexts(previous => (
      previous[target] === normalizedValue
        ? previous
        : { ...previous, [target]: normalizedValue }
    ));

    if (target === 'intro') {
      setIntroVoiceNote(previous => (previous ? { ...previous, noteText: normalizedValue } : previous));
      return;
    }

    if (target === 'outro') {
      setOutroVoiceNote(previous => (previous ? { ...previous, noteText: normalizedValue } : previous));
      return;
    }

    setReadingInsertions(previous => previous.map((insertion) => (
      insertion.type === 'voice-note'
        ? { ...insertion, noteText: normalizedValue }
        : insertion
    )));
  };

  const persistVoiceNoteInTarget = (target: VoiceNotePlacement, voiceNote: ReadingVoiceNote) => {
    const voiceNoteWithText = {
      ...voiceNote,
      noteText: voiceNoteDraftTexts[target],
    };

    if (target === 'intro') {
      setIntroVoiceNote(voiceNoteWithText);
      return;
    }

    if (target === 'outro') {
      setOutroVoiceNote(voiceNoteWithText);
      return;
    }

    insertReadingInsertion({
      type: 'voice-note',
      uri: voiceNoteWithText.uri,
      durationSeconds: voiceNoteWithText.durationSeconds,
      mimeType: voiceNoteWithText.mimeType,
      noteText: voiceNoteWithText.noteText,
    });
  };

  const handleStopVoiceNoteRecording = async (reachedLimit = false) => {
    const recordingTarget = voiceNoteRecordingTargetRef.current;
    if (!recordingTarget || isStoppingVoiceNoteRecordingRef.current) {
      return;
    }

    if (voiceNoteRecordingTimeoutRef.current) {
      clearTimeout(voiceNoteRecordingTimeoutRef.current);
      voiceNoteRecordingTimeoutRef.current = null;
    }
    isStoppingVoiceNoteRecordingRef.current = true;
    setIsVoiceNoteOperationPending(true);
    try {
      const fallbackUri = currentVoiceNoteRecordingUriRef.current;
      const stoppedUri = await audioRecorderPlayer.stopRecorder().catch(() => fallbackUri || '');
      audioRecorderPlayer.removeRecordBackListener();

      const nextUri = String(stoppedUri || fallbackUri || '').trim();
      const durationSeconds = Math.max(
        1,
        Math.min(READING_MAX_VOICE_NOTE_DURATION_SECONDS, Math.ceil(voiceNoteRecordingDurationMsRef.current / 1000)),
      );

      if (!nextUri) {
        Alert.alert('Error', 'No se pudo guardar la grabacion.');
        return;
      }

      persistVoiceNoteInTarget(recordingTarget, {
        uri: nextUri,
        durationSeconds,
        mimeType: READING_VOICE_NOTE_MIME_TYPE,
      });

      if (reachedLimit) {
        showActionToast('La nota de voz alcanzo 60 segundos y se guardo.');
      }
    } catch (error) {
      console.error('Error al detener la nota de voz:', error);
      Alert.alert('Error', 'No se pudo detener la grabacion.');
    } finally {
      resetVoiceNoteRecordingState();
      setIsVoiceNoteOperationPending(false);
    }
  };

  const handleStartVoiceNoteRecording = async (target: VoiceNotePlacement) => {
    if (isRecordingVoiceNote || isVoiceNoteOperationPending) {
      showActionToast('Finaliza la grabacion actual antes de continuar.');
      return;
    }

    if (target === 'inline' && hasInlineVoiceNote) {
      showActionToast('Solo puedes insertar una nota de voz en el cuerpo.');
      return;
    }

    const targetAlreadyOccupied = target === 'intro'
      ? !!introVoiceNote
      : target === 'outro'
        ? !!outroVoiceNote
        : false;

    if (!targetAlreadyOccupied && selectedVoiceNoteCount >= READING_MAX_VOICE_NOTES) {
      showActionToast('Solo puedes anadir 3 notas de voz por lectura.');
      return;
    }

    const hasPermission = await requestRecordAudioPermission();
    if (!hasPermission) {
      return;
    }

    setIsVoiceNoteOperationPending(true);
    try {
      await stopSharedVoiceNotePlayback();
      await audioRecorderPlayer.stopRecorder().catch(() => undefined);
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.setSubscriptionDuration(0.2);

      currentVoiceNoteRecordingUriRef.current = null;
      voiceNoteRecordingTargetRef.current = target;
      voiceNoteRecordingDurationMsRef.current = 0;
      setRecordingVoiceNoteDurationMs(0);
      setRecordingVoiceNoteTarget(target);

      const startedUri = await audioRecorderPlayer.startRecorder(undefined, READING_VOICE_NOTE_AUDIO_SET, false);
      currentVoiceNoteRecordingUriRef.current = String(startedUri || '').trim() || null;
      setIsRecordingVoiceNote(true);
      voiceNoteRecordingTimeoutRef.current = setTimeout(() => {
        voiceNoteRecordingDurationMsRef.current = READING_MAX_VOICE_NOTE_DURATION_MS;
        setRecordingVoiceNoteDurationMs(READING_MAX_VOICE_NOTE_DURATION_MS);
        audioRecorderPlayer.removeRecordBackListener();
        void handleStopVoiceNoteRecording(true);
      }, READING_MAX_VOICE_NOTE_DURATION_MS);

      audioRecorderPlayer.addRecordBackListener((event: RecordBackType) => {
        const nextDurationMs = Math.max(0, Math.floor(Number(event.currentPosition) || 0));
        if (nextDurationMs >= READING_MAX_VOICE_NOTE_DURATION_MS && !isStoppingVoiceNoteRecordingRef.current) {
          if (voiceNoteRecordingTimeoutRef.current) {
            clearTimeout(voiceNoteRecordingTimeoutRef.current);
            voiceNoteRecordingTimeoutRef.current = null;
          }
          voiceNoteRecordingDurationMsRef.current = READING_MAX_VOICE_NOTE_DURATION_MS;
          setRecordingVoiceNoteDurationMs(READING_MAX_VOICE_NOTE_DURATION_MS);
          audioRecorderPlayer.removeRecordBackListener();
          void handleStopVoiceNoteRecording(true);
          return;
        }

        voiceNoteRecordingDurationMsRef.current = nextDurationMs;
        setRecordingVoiceNoteDurationMs(nextDurationMs);
      });
    } catch (error) {
      console.error('Error al iniciar la nota de voz:', error);
      resetVoiceNoteRecordingState();
      Alert.alert('Error', 'No se pudo iniciar la grabacion de audio.');
    } finally {
      setIsVoiceNoteOperationPending(false);
    }
  };

  const insertReadingInsertion = (insertion: ReadingInsertion) => {
    const insertionIndex = Math.max(0, Math.min(focusedBodySectionIndex, bodySections.length - 1));

    setReadingInsertions(previous => [
      ...previous.slice(0, insertionIndex),
      insertion,
      ...previous.slice(insertionIndex),
    ]);
    setBodySections(previous => [
      ...previous.slice(0, insertionIndex + 1),
      '',
      ...previous.slice(insertionIndex + 1),
    ]);
    setFocusedBodySectionIndex(insertionIndex + 1);
  };

  const handlePickReadingImage = async () => {
    if (selectedImageCount >= READING_MAX_IMAGES) {
      Alert.alert(
        t('reading.imageLimitReachedTitle' as TranslationKey),
        t('reading.imageLimitReachedBody' as TranslationKey)
      );
      return;
    }

    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {return;}

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
        insertReadingInsertion({ type: 'image', uri: image.path });
      }
    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED') {
        console.error('Error al seleccionar imagen de la lectura:', error);
        Alert.alert(
          t('reading.imagePickErrorTitle' as TranslationKey),
          t('reading.imagePickErrorBody' as TranslationKey)
        );
      }
    }
  };

  const handleInsertIntertitle = () => {
    const insertionIndex = Math.max(0, Math.min(focusedBodySectionIndex, bodySections.length - 1));
    const previousInsertion = insertionIndex > 0 ? readingInsertions[insertionIndex - 1] : null;
    const currentBodySection = String(bodySections[insertionIndex] || '').trim();

    if (previousInsertion?.type === 'intertitle' && currentBodySection.length === 0) {
      showActionToast(t('reading.intertitleToastBody' as TranslationKey));
      return;
    }

    insertReadingInsertion({ type: 'intertitle', text: '' });
  };

  const handleToggleReadingSocialLinkComposer = () => {
    Keyboard.dismiss();

    if (showReadingSocialLinkComposer) {
      closeReadingSocialLinkComposer();
      return;
    }

    if (isCiteSelectionMode) {
      setIsCiteSelectionMode(false);
      clearCiteSelection();
    }

    setShowReadingSocialLinkComposer(true);
    resetReadingSocialLinkDraft();
  };

  const handleSelectReadingSocialNetwork = (network: ChannelEventSocialOption) => {
    setSelectedReadingSocialNetwork(prev => (prev === network ? null : network));
    setReadingSocialLinkInput('');
    setReadingSocialLinkError('');
  };

  const handleReadingSocialLinkChange = (text: string) => {
    setReadingSocialLinkInput(text);

    if (selectedReadingSocialNetwork && text.trim()) {
      const isValid = validateSocialLink(selectedReadingSocialNetwork, text);
      if (!isValid) {
        setReadingSocialLinkError(
          `${t('front.linkMustBeFrom' as TranslationKey)} ${SOCIAL_PLATFORM_NAMES[selectedReadingSocialNetwork] ?? selectedReadingSocialNetwork}`,
        );
      } else {
        setReadingSocialLinkError('');
      }
    } else {
      setReadingSocialLinkError('');
    }
  };

  const handleApplyReadingSocialLink = () => {
    if (!selectedReadingSocialNetwork || !readingSocialLinkInput.trim() || readingSocialLinkError) {
      return;
    }

    insertReadingInsertion({
      type: 'social-link',
      network: selectedReadingSocialNetwork,
      link: readingSocialLinkInput.trim(),
    });
    closeReadingSocialLinkComposer();
  };

  const handleRemoveReadingInsertion = (indexToRemove: number) => {
    setReadingInsertions(previous => previous.filter((_, index) => index !== indexToRemove));
    setBodySections(previous => {
      if (indexToRemove < 0 || indexToRemove >= previous.length - 1) {
        return previous;
      }

      const mergedSection = `${previous[indexToRemove]}${previous[indexToRemove + 1]}`;
      return [
        ...previous.slice(0, indexToRemove),
        mergedSection,
        ...previous.slice(indexToRemove + 2),
      ];
    });
    setFocusedBodySectionIndex(previous => Math.max(0, Math.min(previous, bodySections.length - 2)));
    setBodySelection(previous => {
      if (!previous) {
        return previous;
      }

      if (previous.sectionIndex === indexToRemove) {
        return null;
      }

      if (previous.sectionIndex > indexToRemove) {
        return {
          ...previous,
          sectionIndex: previous.sectionIndex - 1,
        };
      }

      return previous;
    });
    setReadingCitations(previous => previous.filter((citation) => citation.sectionIndex < indexToRemove));
  };

  const handleChangeBodySection = (index: number, nextValue: string) => {
    setBodySections(previous => previous.map((section, sectionIndex) => (
      sectionIndex === index ? nextValue : section
    )));

    setBodySectionSelections(previous => {
      const currentSelection = previous[index];
      if (!currentSelection) {
        return previous;
      }

      const nextStart = Math.max(0, Math.min(currentSelection.start, nextValue.length));
      const nextEnd = Math.max(nextStart, Math.min(currentSelection.end, nextValue.length));

      return {
        ...previous,
        [index]: { start: nextStart, end: nextEnd },
      };
    });

    setBodySelection(previous => {
      if (!previous || previous.sectionIndex !== index) {
        return previous;
      }

      const nextStart = Math.max(0, Math.min(previous.start, nextValue.length));
      const nextEnd = Math.max(nextStart, Math.min(previous.end, nextValue.length));
      const nextSelectedText = nextValue.slice(nextStart, nextEnd).trim();

      if (!nextSelectedText) {
        return null;
      }

      return {
        ...previous,
        start: nextStart,
        end: nextEnd,
        text: nextSelectedText,
      };
    });

    setReadingCitations(previous => {
      const currentSectionCitations = previous.filter((citation) => citation.sectionIndex === index);
      const nextSectionCitations = reconcileSectionCitations(nextValue, currentSectionCitations);

      return [
        ...previous.filter((citation) => citation.sectionIndex !== index),
        ...nextSectionCitations,
      ].sort((left, right) => (
        left.sectionIndex === right.sectionIndex
          ? left.start - right.start
          : left.sectionIndex - right.sectionIndex
      ));
    });
  };

  const handleChangeIntertitle = (index: number, nextValue: string) => {
    setReadingInsertions(previous => previous.map((insertion, insertionIndex) => {
      if (insertionIndex !== index || insertion.type !== 'intertitle') {
        return insertion;
      }

      return {
        ...insertion,
        text: nextValue,
      };
    }));
  };

  const openReadingImageViewer = (uri: string) => {
    const resolved = String(uri || '').trim();
    if (!resolved) {return;}
    setImageViewerUri(resolved);
  };

  const handleOpenCitationSocialLink = async (rawUrl: string) => {
    const normalizedUrl = normalizeExternalUrl(rawUrl);
    if (!normalizedUrl) {
      return;
    }

    const safeUrl = encodeURI(normalizedUrl);

    try {
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
    } catch (error) {
      console.error('No se pudo abrir el enlace social citado:', error);
      Alert.alert('Error', 'No se pudo abrir el enlace.');
    }
  };

  const closeReadingImageViewer = () => {
    setImageViewerUri(null);
  };

  const handleChangeReadingDate = (nextValue: string) => {
    setReadingDate(formatReadingDateDigits(nextValue));
  };

  const handleToggleReadingCategoryOptions = () => {
    readingDateInputRef.current?.blur();
    setShowReadingCategoryOptions((previous) => {
      const nextValue = !previous;
      if (!nextValue) {
        setReadingCategorySearchQuery('');
      }
      return nextValue;
    });
  };

  const handleSelectReadingCategory = (category: ReadingCategoryOption) => {
    setSelectedReadingCategory(category);
    setShowReadingCategoryOptions(false);
    setReadingCategorySearchQuery('');
  };

  const handleReadingHypeCostInputChange = (nextValue: string) => {
    setReadingHypeCostInput(formatReadingIntegerInput(nextValue));
  };

  const handleToggleReadingHypeCostInfo = () => {
    setShowReadingHypeCostInfo(previous => !previous);
  };

  const handleApplyCitation = () => {
    if (!bodySelection?.text || selectedCitedUsers.length === 0) {
      return;
    }

    const citationId = `citation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextCitation: ReadingCitation = {
      id: citationId,
      sectionIndex: bodySelection.sectionIndex,
      start: bodySelection.start,
      end: bodySelection.end,
      text: bodySelection.text,
      users: selectedCitedUsers,
      appearance: selectedCitationAppearance,
    };

    setReadingCitations((previous) => {
      const next = previous.filter((citation) => {
        if (citation.sectionIndex !== nextCitation.sectionIndex) {
          return true;
        }

        return citation.end <= nextCitation.start || citation.start >= nextCitation.end;
      });

      return [...next, nextCitation].sort((left, right) => (
        left.sectionIndex === right.sectionIndex
          ? left.start - right.start
          : left.sectionIndex - right.sectionIndex
      ));
    });

    const sectionIndex = bodySelection.sectionIndex;
    const cursorIndex = String(bodySections[sectionIndex] || '').length;
    setBodySectionSelections(previous => ({
      ...previous,
      [sectionIndex]: { start: cursorIndex, end: cursorIndex },
    }));
    setProgrammaticSelectionSectionIndex(sectionIndex);

    setFocusedBodySectionIndex(sectionIndex);
    setEditingBodySectionIndex(null);

    setIsCiteSelectionMode(false);
    clearCiteSelection();
  };

  const handleCreateReading = async () => {
    if (!isCreateActionEnabled || isCreatingReading) {
      return;
    }

    const normalizedToken = String(authToken || '').trim();
    const normalizedChannelPostId = String(channelPostId ?? '').trim();

    if (!normalizedToken) {
      Alert.alert('Error', 'No se pudo autenticar la creación de la lectura.');
      return;
    }

    if (!normalizedChannelPostId) {
      Alert.alert('Error', 'No se encontró el canal donde publicar esta lectura.');
      return;
    }

    setIsCreatingReading(true);
    try {
      const uploadReadingVoiceNote = async (voiceNote: ReadingVoiceNote | null): Promise<ChannelReadingMessageVoiceNote | null> => {
        if (!voiceNote) {
          return null;
        }

        let uploadedUrl = String(voiceNote.uri || '').trim();
        if (uploadedUrl && !uploadedUrl.startsWith('http')) {
          uploadedUrl = await uploadImage(uploadedUrl, normalizedToken, {
            postId: normalizedChannelPostId,
            timeoutMs: 120000,
            mimeType: voiceNote.mimeType || READING_VOICE_NOTE_MIME_TYPE,
          });
        }

        if (!uploadedUrl) {
          return null;
        }

        return {
          url: uploadedUrl,
          durationSeconds: Math.max(1, Math.floor(Number(voiceNote.durationSeconds) || 0)),
          mimeType: voiceNote.mimeType || READING_VOICE_NOTE_MIME_TYPE,
          noteText: normalizeVoiceNoteText(voiceNote.noteText),
        };
      };

      const [uploadedIntroAudio, uploadedInsertions, uploadedOutroAudio] = await Promise.all([
        uploadReadingVoiceNote(introVoiceNote),
        Promise.all(readingInsertions.map(async (insertion) => {
          if (insertion.type === 'intertitle') {
            return {
              type: 'intertitle' as const,
              text: String(insertion.text || '').trim(),
            };
          }

          if (insertion.type === 'voice-note') {
            let uploadedUrl = String(insertion.uri || '').trim();
            if (uploadedUrl && !uploadedUrl.startsWith('http')) {
              uploadedUrl = await uploadImage(uploadedUrl, normalizedToken, {
                postId: normalizedChannelPostId,
                timeoutMs: 120000,
                mimeType: insertion.mimeType || READING_VOICE_NOTE_MIME_TYPE,
              });
            }

            return {
              type: 'voice-note' as const,
              url: uploadedUrl,
              durationSeconds: Math.max(1, Math.floor(Number(insertion.durationSeconds) || 0)),
              mimeType: insertion.mimeType || READING_VOICE_NOTE_MIME_TYPE,
              noteText: normalizeVoiceNoteText(insertion.noteText),
            };
          }

          if (insertion.type === 'social-link') {
            return {
              type: 'social-link' as const,
              network: normalizeSocialNetworkKey(insertion.network),
              link: String(insertion.link || '').trim(),
            };
          }

          let uploadedUrl = String(insertion.uri || '').trim();
          if (uploadedUrl && !uploadedUrl.startsWith('http')) {
            uploadedUrl = await uploadImage(uploadedUrl, normalizedToken, {
              postId: normalizedChannelPostId,
              timeoutMs: 120000,
            });
          }

          return {
            type: 'image' as const,
            url: uploadedUrl,
          };
        })),
        uploadReadingVoiceNote(outroVoiceNote),
      ]);

      const imageUrls = uploadedInsertions.reduce<string[]>((accumulator, insertion) => {
        if (insertion.type === 'image' && insertion.url) {
          accumulator.push(insertion.url);
        }
        return accumulator;
      }, []);

      const encodedMessage = encodeChannelReadingMessage({
        title,
        subtitle,
        lead,
        date: readingDate,
        category: selectedReadingCategory || '',
        hypeCost: Number.parseInt(sanitizeReadingAmountInput(readingHypeCostInput), 10) || 0,
        introAudio: uploadedIntroAudio,
        bodySections,
        insertions: uploadedInsertions,
        outroAudio: uploadedOutroAudio,
        imageUrls,
        citations: readingCitations,
      });

      const response = await fetch(`${API_URL}/api/channels/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${normalizedToken}`,
        },
        body: JSON.stringify({
          postId: normalizedChannelPostId,
          message: encodedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create channel reading');
      }

      onBack();
    } catch (error) {
      console.error('Error al crear la lectura del canal:', error);
      Alert.alert('Error', 'No se pudo crear la lectura. Intenta de nuevo.');
    } finally {
      setIsCreatingReading(false);
    }
  };

  const handleChangeCitedUsername = (nextValue: string) => {
    setCitedUsername(nextValue);
  };

  const handlePickUsernameSuggestion = (username: string) => {
    const normalizedUsername = normalizeMentionUsername(username);
    if (!normalizedUsername) {
      return;
    }

    const selectedSuggestion = usernameSuggestions.find((item) => normalizeMentionUsername(item.username) === normalizedUsername);

    setSelectedCitedUsers((previous) => {
      if (previous.some((item) => normalizeMentionUsername(item.username) === normalizedUsername)) {
        return previous;
      }

      return [
        ...previous,
        {
          username: `@${normalizedUsername}`,
          profile_photo_uri: selectedSuggestion?.profile_photo_uri ?? null,
          social_networks: selectedSuggestion?.social_networks ?? [],
        },
      ];
    });

    setCitedUsername('');
    setUsernameSuggestions([]);
  };

  const isApplyEnabled = !!bodySelection?.text && selectedCitedUsers.length > 0;

  const citationsBySection = useMemo(() => {
    return readingCitations.reduce<Record<number, ReadingCitation[]>>((accumulator, citation) => {
      if (!accumulator[citation.sectionIndex]) {
        accumulator[citation.sectionIndex] = [];
      }

      accumulator[citation.sectionIndex].push(citation);
      accumulator[citation.sectionIndex].sort((left, right) => left.start - right.start);
      return accumulator;
    }, {});
  }, [readingCitations]);

  const renderBodySectionPreview = (sectionText: string, sectionIndex: number) => {
    const sectionCitations = citationsBySection[sectionIndex] || [];
    if (sectionCitations.length === 0) {
      return (
        <View style={styles.bodyPreviewContainer}>
          <Text style={styles.bodyPreviewPlainText}>
            {sectionText}
          </Text>
        </View>
      );
    }

    return (
      <View collapsable={false} style={styles.bodyPreviewContainer}>
        <Text style={styles.bodyPreviewPlainText}>
          {renderReadingTextFragments({
            text: sectionText,
            citations: sectionCitations,
            keyPrefix: `reading-preview-${sectionIndex}`,
            plainTextStyle: styles.bodyPreviewPlainText,
            whiteCitationStyle: styles.bodyPreviewCitationTextWhite,
            gradientCitationStyle: styles.bodyPreviewEditorCitationTextGradient,
            onPressCitation: setExpandedCitation,
          })}
        </Text>
      </View>
    );
  };

  const renderBodySectionEditorBackdrop = (sectionText: string, sectionIndex: number) => {
    const sectionCitations = citationsBySection[sectionIndex] || [];
    if (sectionCitations.length === 0) {
      return <Text style={styles.bodyPreviewEditorPlainText}>{sectionText}</Text>;
    }

    return (
      <Text style={styles.bodyPreviewEditorPlainText}>
        {renderReadingTextFragments({
          text: sectionText,
          citations: sectionCitations,
          keyPrefix: `reading-editor-${sectionIndex}`,
          plainTextStyle: styles.bodyPreviewEditorPlainText,
          whiteCitationStyle: styles.bodyPreviewEditorCitationTextWhite,
          gradientCitationStyle: styles.bodyPreviewEditorCitationTextGradient,
          useGradientCharacterColors: false,
        })}
      </Text>
    );
  };

  function renderVoiceNoteTextInput(
    value: string,
    onChangeText: (nextValue: string) => void,
    placeholder: string,
  ) {
    return (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        style={styles.voiceNoteTextInput}
        maxLength={READING_VOICE_NOTE_TEXT_MAX_LENGTH}
        autoCapitalize="sentences"
        autoCorrect
      />
    );
  }

  function renderVoiceNoteRecordingCard(
    titleText: string,
    statusText: string,
    noteText: string,
    onChangeNoteText: (nextValue: string) => void,
    notePlaceholderText: string,
  ) {
    return (
      <View style={styles.voiceNoteRecordingCard}>
        <View style={styles.voiceNoteRecordingIndicator} />
        <View style={styles.voiceNoteRecordingCopy}>
          <Text style={styles.voiceNoteRecordingTitle}>{titleText}</Text>
          {renderVoiceNoteTextInput(noteText, onChangeNoteText, notePlaceholderText)}
          <Text style={styles.voiceNoteRecordingStatus}>{statusText}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => { void handleStopVoiceNoteRecording(); }}
          style={styles.voiceNoteRecordingStopButton}
        >
          <MaterialIcons name="stop" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  const renderVoiceNoteSlot = ({
    titleText,
    noteText,
    notePlaceholderText,
    voiceNote,
    onRemove,
    onRecord,
    isRecording,
    onChangeNoteText,
  }: {
    titleText: string;
    noteText: string;
    notePlaceholderText: string;
    voiceNote: ReadingVoiceNote | null;
    onRemove: () => void;
    onRecord: () => void;
    isRecording: boolean;
    onChangeNoteText: (nextValue: string) => void;
  }) => {
    const recordingSeconds = Math.min(
      READING_MAX_VOICE_NOTE_DURATION_SECONDS,
      Math.max(1, Math.ceil(recordingVoiceNoteDurationMs / 1000)),
    );

    return (
      <View style={styles.voiceNoteSlotSection}>
        {isRecording ? renderVoiceNoteRecordingCard(
          titleText,
          `${t('reading.voiceNoteRecordingStatus' as TranslationKey)} ${recordingSeconds}/${READING_MAX_VOICE_NOTE_DURATION_SECONDS} s`,
          noteText,
          onChangeNoteText,
          notePlaceholderText,
        ) : voiceNote ? (
          <>
            <VoiceNotePlayer
              uri={voiceNote.uri}
              durationSeconds={voiceNote.durationSeconds}
              title={titleText}
              subtitleInputValue={noteText}
              onChangeSubtitleInput={onChangeNoteText}
              subtitleInputPlaceholder={notePlaceholderText}
              subtitleInputMaxLength={READING_VOICE_NOTE_TEXT_MAX_LENGTH}
              onRemove={onRemove}
              variant="composer"
            />

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={onRecord}
              style={styles.voiceNoteSecondaryButton}
            >
              <MaterialIcons name="keyboard-voice" size={16} color="#FFFFFF" />
              <Text style={styles.voiceNoteSecondaryButtonText}>{t('reading.voiceNoteRerecordAction' as TranslationKey)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.voiceNotePrimaryButton}>
            <View style={styles.voiceNotePrimaryButtonHeader}>
              <MaterialIcons name="keyboard-voice" size={18} color="#FFFFFF" />
              <View style={styles.voiceNotePrimaryButtonCopy}>
                <Text style={styles.voiceNotePrimaryButtonTitle}>{titleText}</Text>
                {renderVoiceNoteTextInput(noteText, onChangeNoteText, notePlaceholderText)}
              </View>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={onRecord}
              style={styles.voiceNotePrimaryButtonAction}
            >
              <MaterialIcons name="keyboard-voice" size={16} color="#FFFFFF" />
              <Text style={styles.voiceNotePrimaryButtonActionText}>{t('reading.voiceNoteRecordAction' as TranslationKey)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents={isCreatingReading ? 'none' : 'auto'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.topBar}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={onBack}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back-ios-new" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.headerRow}>
              <Text style={styles.screenTitle}>{t('reading.screenTitle' as TranslationKey)}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={isCreateActionEnabled && !isCreatingReading ? 0.85 : 1}
                disabled={!isCreateActionEnabled || isCreatingReading}
                onPress={handleCreateReading}
                style={[
                  styles.createButton,
                  isCreateActionEnabled ? styles.createButtonEnabled : styles.createButtonDisabled,
                ]}
              >
                <CreateButtonGradientBorder visible={isCreateActionEnabled} />
                {isCreatingReading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createButtonText}>{t('common.create' as TranslationKey)}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.textBlock}>
              {renderVoiceNoteSlot({
                titleText: t('reading.voiceNoteIntroTitle' as TranslationKey),
                noteText: voiceNoteDraftTexts.intro,
                notePlaceholderText: t('reading.voiceNoteIntroDescription' as TranslationKey),
                voiceNote: introVoiceNote,
                onRemove: () => setIntroVoiceNote(null),
                onRecord: () => { void handleStartVoiceNoteRecording('intro'); },
                isRecording: recordingVoiceNoteTarget === 'intro' && isRecordingVoiceNote,
                onChangeNoteText: (nextValue) => handleChangeVoiceNoteDraftText('intro', nextValue),
              })}

              <View style={styles.fieldBlock}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('reading.titlePlaceholder' as TranslationKey)}
                  placeholderTextColor="#FFFFFF"
                  style={styles.titleInput}
                  maxLength={TITLE_MAX_LENGTH}
                  autoCapitalize="sentences"
                  autoCorrect
                />
                <Text style={styles.fieldCounter}>{`${title.length}/${TITLE_MAX_LENGTH}`}</Text>
              </View>

              <View style={styles.fieldBlock}>
                <TextInput
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder={t('reading.subtitlePlaceholder' as TranslationKey)}
                  placeholderTextColor="#FFFFFF"
                  style={styles.subtitleInput}
                  maxLength={SUBTITLE_MAX_LENGTH}
                  autoCapitalize="sentences"
                  autoCorrect
                />
                <Text style={styles.fieldCounter}>{`${subtitle.length}/${SUBTITLE_MAX_LENGTH}`}</Text>
              </View>

              <View style={styles.fieldBlock}>
                <TextInput
                  value={lead}
                  onChangeText={setLead}
                  placeholder={t('reading.leadPlaceholder' as TranslationKey)}
                  placeholderTextColor="rgba(255,255,255,0.52)"
                  style={styles.leadInput}
                  maxLength={LEAD_MAX_LENGTH}
                  autoCapitalize="sentences"
                  autoCorrect
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                />
                <Text style={styles.fieldCounter}>{`${lead.length}/${LEAD_MAX_LENGTH}`}</Text>
              </View>

              {bodySections.map((bodySection, index) => {
                const trailingInsertion = readingInsertions[index] ?? null;
                const renderableSocialLink = trailingInsertion?.type === 'social-link'
                  ? getRenderableReadingSocialLink(trailingInsertion.network, trailingInsertion.link)
                  : null;
                const shouldRenderSection = bodySection.length > 0 || index === bodySections.length - 1;
                const sectionCitations = citationsBySection[index] || [];
                const isEditingBodySection = sectionCitations.length === 0 || editingBodySectionIndex === index;

                return (
                  <React.Fragment key={`body-section-${index}`}>
                    {shouldRenderSection ? (
                      <View style={styles.fieldBlock}>
                        {sectionCitations.length > 0 ? (
                          <TouchableOpacity activeOpacity={1} onPress={() => focusBodySection(index)}>
                            <View style={styles.bodyPreviewContainer}>
                              {editingBodySectionIndex === index ? (
                                <View style={styles.bodyCitationEditorLayer}>
                                  {renderBodySectionEditorBackdrop(bodySection, index)}

                                  <TextInput
                                    ref={(input) => {
                                      bodyInputRefs.current[index] = input;
                                    }}
                                    value={bodySection}
                                    onChangeText={(nextValue) => handleChangeBodySection(index, nextValue)}
                                    onFocus={() => {
                                      setFocusedBodySectionIndex(index);
                                      setEditingBodySectionIndex(index);
                                    }}
                                    onBlur={() => setEditingBodySectionIndex(null)}
                                    onSelectionChange={(event) => handleBodySelectionChange(index, event.nativeEvent.selection.start, event.nativeEvent.selection.end)}
                                    selection={programmaticSelectionSectionIndex === index ? bodySectionSelections[index] : undefined}
                                    selectionColor="rgba(140, 239, 255, 0.9)"
                                    style={styles.bodyCitationEditorInput}
                                    autoCapitalize="sentences"
                                    autoCorrect
                                    multiline
                                    scrollEnabled={false}
                                    textAlignVertical="top"
                                  />
                                </View>
                              ) : renderBodySectionPreview(bodySection, index)}
                            </View>
                          </TouchableOpacity>
                        ) : isEditingBodySection ? (
                          <TextInput
                            ref={(input) => {
                              bodyInputRefs.current[index] = input;
                            }}
                            value={bodySection}
                            onChangeText={(nextValue) => handleChangeBodySection(index, nextValue)}
                            onFocus={() => {
                              setFocusedBodySectionIndex(index);
                              setEditingBodySectionIndex(index);
                            }}
                            onBlur={() => setEditingBodySectionIndex(null)}
                            onSelectionChange={(event) => handleBodySelectionChange(index, event.nativeEvent.selection.start, event.nativeEvent.selection.end)}
                            selection={programmaticSelectionSectionIndex === index ? bodySectionSelections[index] : undefined}
                            placeholder={totalBodyLength === 0 && index === bodySections.length - 1 ? t('reading.bodyPlaceholder' as TranslationKey) : ''}
                            placeholderTextColor="#FFFFFF"
                            style={styles.bodyInput}
                            autoCapitalize="sentences"
                            autoCorrect
                            multiline
                            scrollEnabled={false}
                            textAlignVertical="top"
                          />
                        ) : renderBodySectionPreview(bodySection, index)}
                      </View>
                    ) : null}

                    {trailingInsertion?.type === 'image' ? (
                      <View style={index === 0 ? styles.selectedImageAboveBodySection : styles.selectedImagesSection}>
                        <View style={styles.selectedImageCard}>
                          <TouchableOpacity activeOpacity={0.92} onPress={() => openReadingImageViewer(trailingInsertion.uri)}>
                            <Image source={{ uri: trailingInsertion.uri }} style={styles.selectedImage} resizeMode="cover" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            onPress={() => handleRemoveReadingInsertion(index)}
                            style={styles.removeImageButton}
                          >
                            <MaterialIcons name="close" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {trailingInsertion?.type === 'intertitle' ? (
                      <View style={styles.intertitleSection}>
                        <View style={styles.intertitleHeaderRow}>
                          <TextInput
                            value={trailingInsertion.text}
                            onChangeText={(nextValue) => handleChangeIntertitle(index, nextValue)}
                            onFocus={() => setFocusedBodySectionIndex(index + 1)}
                            placeholder={t('reading.intertitlePlaceholder' as TranslationKey)}
                            placeholderTextColor="#FFFFFF"
                            style={styles.intertitleInput}
                            autoCapitalize="sentences"
                            autoCorrect
                            maxLength={INTERTITLE_MAX_LENGTH}
                          />
                          <TouchableOpacity
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            onPress={() => handleRemoveReadingInsertion(index)}
                            style={styles.removeIntertitleButton}
                          >
                            <MaterialIcons name="close" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.fieldCounter}>{`${trailingInsertion.text.length}/${INTERTITLE_MAX_LENGTH}`}</Text>
                      </View>
                    ) : null}

                    {trailingInsertion?.type === 'voice-note' ? (
                      <View style={styles.voiceNoteInlineSection}>
                        <VoiceNotePlayer
                          uri={trailingInsertion.uri}
                          durationSeconds={trailingInsertion.durationSeconds}
                          title={t('reading.voiceNoteInlineTitle' as TranslationKey)}
                          subtitleInputValue={voiceNoteDraftTexts.inline}
                          onChangeSubtitleInput={(nextValue) => handleChangeVoiceNoteDraftText('inline', nextValue)}
                          subtitleInputPlaceholder={t('reading.voiceNoteInlineDescription' as TranslationKey)}
                          subtitleInputMaxLength={READING_VOICE_NOTE_TEXT_MAX_LENGTH}
                          onRemove={() => handleRemoveReadingInsertion(index)}
                          variant="composer"
                        />
                      </View>
                    ) : null}

                    {trailingInsertion?.type === 'social-link' && renderableSocialLink ? (
                      <View style={styles.readingSocialLinkSection}>
                        <View style={styles.readingSocialLinkCard}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            onPress={() => handleRemoveReadingInsertion(index)}
                            style={styles.readingSocialLinkRemoveButton}
                          >
                            <MaterialIcons name="close" size={15} color="#FFFFFF" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            accessibilityRole="button"
                            activeOpacity={0.82}
                            onPress={() => { void handleOpenCitationSocialLink(renderableSocialLink.displayLink); }}
                            style={styles.readingSocialLinkPressable}
                          >
                            <View style={styles.readingSocialLinkIconShell}>
                              <Image
                                source={renderableSocialLink.iconSource}
                                style={styles.readingSocialLinkIcon}
                                resizeMode="contain"
                              />
                            </View>

                            <View style={styles.readingSocialLinkValueBox}>
                              <Text style={styles.readingSocialLinkValueText} numberOfLines={1}>
                                {renderableSocialLink.displayLink}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </React.Fragment>
                );
              })}

            </View>

            <View style={styles.bodyActionsRow}>
              <View style={styles.bodyActionsButtonsRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={handleInsertIntertitle}
                  style={styles.intertitleActionButton}
                >
                  <IntertitleActionGlyph />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={handleToggleCiteSelectionMode}
                  style={[
                    styles.citeActionButton,
                    isCiteSelectionMode ? styles.citeActionButtonActive : null,
                  ]}
                >
                  <CiteActionGlyph />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={handleToggleReadingSocialLinkComposer}
                  style={[
                    styles.voiceNoteActionButton,
                    showReadingSocialLinkComposer ? styles.citeActionButtonActive : null,
                  ]}
                >
                  <MaterialIcons name="link" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={!hasInlineVoiceNote && !isRecordingVoiceNote && !isVoiceNoteOperationPending ? 0.85 : 1}
                  disabled={hasInlineVoiceNote || isRecordingVoiceNote || isVoiceNoteOperationPending}
                  onPress={() => { void handleStartVoiceNoteRecording('inline'); }}
                  style={[
                    styles.voiceNoteActionButton,
                    hasInlineVoiceNote || isRecordingVoiceNote || isVoiceNoteOperationPending
                      ? styles.voiceNoteActionButtonDisabled
                      : null,
                  ]}
                >
                  <MaterialIcons name="graphic-eq" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.bodyActionsCounter}>{`${totalBodyLength}/${BODY_MIN_LENGTH} ${t('reading.bodyMinSuffix' as TranslationKey)}`}</Text>
            </View>

            {showReadingSocialLinkComposer ? (
              <View style={styles.readingSocialComposerSection}>
                <View style={styles.readingSocialComposerHeader}>
                  <Text style={styles.readingSocialComposerLabel}>{t('event.link' as TranslationKey)}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    onPress={closeReadingSocialLinkComposer}
                    style={styles.readingSocialComposerCloseButton}
                  >
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => setShowReadingSocialNetworkOptions(prev => !prev)}
                  style={styles.readingSocialTrigger}
                >
                  <View style={styles.readingSocialInlineLabelRow}>
                    <View style={styles.readingSocialTriggerLabelRow}>
                      {selectedReadingSocialNetwork ? (
                        <Image
                          source={SOCIAL_ICONS[selectedReadingSocialNetwork] as any}
                          style={styles.readingSocialSelectedIcon}
                        />
                      ) : null}
                      <Text style={styles.readingSocialPrimaryText}>{t('event.selectSocialNetwork' as TranslationKey)}</Text>
                    </View>
                    <MaterialIcons
                      name={showReadingSocialNetworkOptions ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                </TouchableOpacity>

                {showReadingSocialNetworkOptions ? (
                  <View style={styles.readingSocialOptionsPanel}>
                    <View style={styles.readingSocialGrid}>
                      {CHANNEL_EVENT_SOCIAL_OPTIONS.map((key) => (
                        <TouchableOpacity
                          key={key}
                          accessibilityRole="button"
                          activeOpacity={0.85}
                          onPress={() => handleSelectReadingSocialNetwork(key)}
                          style={[
                            styles.readingSocialOption,
                            selectedReadingSocialNetwork === key ? styles.readingSocialOptionSelected : null,
                          ]}
                        >
                          <Image source={SOCIAL_ICONS[key] as any} style={styles.readingSocialOptionIcon} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.readingSocialLinkInputShell,
                    !selectedReadingSocialNetwork ? styles.readingSocialLinkInputShellDisabled : null,
                    readingSocialLinkError ? styles.readingSocialLinkInputShellError : null,
                  ]}
                >
                  <TextInput
                    value={readingSocialLinkInput}
                    onChangeText={handleReadingSocialLinkChange}
                    placeholder={selectedReadingSocialNetwork ? t('event.addLink' as TranslationKey) : t('event.selectSocialNetwork' as TranslationKey)}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.readingSocialLinkInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    editable={!!selectedReadingSocialNetwork}
                    selectTextOnFocus={!!selectedReadingSocialNetwork}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={readingSocialLinkCanApply ? 0.8 : 1}
                    disabled={!readingSocialLinkCanApply}
                    onPress={handleApplyReadingSocialLink}
                    style={styles.readingSocialLinkApplyAction}
                  >
                    <MaterialIcons
                      name={
                        !selectedReadingSocialNetwork || !readingSocialLinkInput.trim()
                          ? 'check-circle-outline'
                          : readingSocialLinkError
                            ? 'error-outline'
                            : 'check-circle'
                      }
                      size={21}
                      color={
                        !selectedReadingSocialNetwork || !readingSocialLinkInput.trim()
                          ? 'rgba(255,255,255,0.26)'
                          : readingSocialLinkError
                            ? '#D84315'
                            : '#FFB74D'
                      }
                    />
                  </TouchableOpacity>
                </View>

                {selectedReadingSocialNetwork && readingSocialLinkError ? (
                  <Text style={styles.readingSocialLinkErrorText}>{readingSocialLinkError}</Text>
                ) : null}
              </View>
            ) : null}

            {recordingVoiceNoteTarget === 'inline' && isRecordingVoiceNote ? (
              <View style={styles.voiceNoteInlineComposerSection}>
                {renderVoiceNoteRecordingCard(
                  t('reading.voiceNoteInlineTitle' as TranslationKey),
                  `${t('reading.voiceNoteRecordingStatus' as TranslationKey)} ${Math.min(READING_MAX_VOICE_NOTE_DURATION_SECONDS, Math.max(1, Math.ceil(recordingVoiceNoteDurationMs / 1000)))}/${READING_MAX_VOICE_NOTE_DURATION_SECONDS} s`,
                  voiceNoteDraftTexts.inline,
                  (nextValue) => handleChangeVoiceNoteDraftText('inline', nextValue),
                  t('reading.voiceNoteInlineDescription' as TranslationKey),
                )}
              </View>
            ) : null}

            <View style={styles.outroVoiceNoteSection}>
              {renderVoiceNoteSlot({
                titleText: t('reading.voiceNoteOutroTitle' as TranslationKey),
                noteText: voiceNoteDraftTexts.outro,
                notePlaceholderText: t('reading.voiceNoteOutroDescription' as TranslationKey),
                voiceNote: outroVoiceNote,
                onRemove: () => setOutroVoiceNote(null),
                onRecord: () => { void handleStartVoiceNoteRecording('outro'); },
                isRecording: recordingVoiceNoteTarget === 'outro' && isRecordingVoiceNote,
                onChangeNoteText: (nextValue) => handleChangeVoiceNoteDraftText('outro', nextValue),
              })}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={selectedImageCount >= READING_MAX_IMAGES ? 1 : 0.85}
              disabled={selectedImageCount >= READING_MAX_IMAGES}
              onPress={handlePickReadingImage}
              style={styles.imageSection}
            >
              <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
              <Text style={styles.imageLabel}>{t('reading.addImage' as TranslationKey)}</Text>
              <Text style={styles.imageHint}>{t('reading.maxImagesHint' as TranslationKey)}</Text>
            </TouchableOpacity>

            <View style={styles.fieldBlock}>
              <Text style={styles.readingDateLabel}>{t('reading.dateLabel' as TranslationKey)}</Text>
              <View style={styles.readingDateInputContainer}>
                <TextInput
                  ref={readingDateInputRef}
                  value={readingDate}
                  onChangeText={handleChangeReadingDate}
                  placeholder={t('reading.datePlaceholder' as TranslationKey)}
                  placeholderTextColor="#FFFFFF"
                  style={styles.readingDateInput}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  onPress={() => readingDateInputRef.current?.focus()}
                  style={styles.readingDateIconButton}
                >
                  <MaterialIcons name="calendar-month" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.readingCategorySection,
                showReadingCategoryOptions ? styles.readingCategorySectionExpanded : null,
              ]}
            >
              <Text style={styles.readingDateLabel}>{t('reading.chooseCategoryLabel' as TranslationKey)}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={handleToggleReadingCategoryOptions}
                style={styles.readingCategoryTrigger}
              >
                <View style={styles.readingCategoryInlineLabelRow}>
                  <Text style={styles.readingCategoryTriggerText}>
                    {selectedReadingCategory ? t(selectedReadingCategory) : t('reading.categoryLabel' as TranslationKey)}
                  </Text>
                  <MaterialIcons
                    name={showReadingCategoryOptions ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
              </TouchableOpacity>

              {showReadingCategoryOptions ? (
                <View style={styles.readingCategoryOptionsPanel}>
                  <TextInput
                    value={readingCategorySearchQuery}
                    onChangeText={setReadingCategorySearchQuery}
                    placeholder={t('reading.searchCategoryPlaceholder' as TranslationKey)}
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    style={styles.readingCategorySearchInput}
                  />

                  {filteredReadingCategoryOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      onPress={() => handleSelectReadingCategory(option)}
                      style={styles.readingCategoryOption}
                    >
                      <Text
                        style={[
                          styles.readingCategoryOptionText,
                          selectedReadingCategory === option ? styles.readingCategoryOptionTextSelected : null,
                        ]}
                      >
                        {t(option)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.readingHypeCostSection}>
              <View style={styles.readingHypeCostInfoAnchor}>
                <View style={styles.readingHypeCostLabelRow}>
                  <Text style={styles.readingHypeCostLabel}>{t('reading.hypeCostLabel' as TranslationKey)}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.75}
                    onPress={handleToggleReadingHypeCostInfo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.readingHypeCostInfoButton}
                  >
                    <MaterialIcons name="info-outline" size={18} color="rgba(255,255,255,0.58)" />
                  </TouchableOpacity>
                </View>

                {showReadingHypeCostInfo ? (
                  <View style={styles.readingHypeCostInfoPanel}>
                    <Text style={styles.readingHypeCostInfoText}>{t('reading.hypeCostInfo' as TranslationKey)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.readingHypeCostField}>
                <TextInput
                  value={readingHypeCostInput}
                  onChangeText={handleReadingHypeCostInputChange}
                  placeholder={t('reading.hypeCostAmountLabel' as TranslationKey)}
                  placeholderTextColor="#FFFFFF"
                  style={styles.readingHypeCostFieldInput}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <MaterialCommunityIcons name="key-outline" size={16} color="rgba(255,255,255,0.78)" />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {actionToast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.actionToastContainer,
            { bottom: Math.max(18, safeAreaInsets.bottom + keyboardHeight + (bodySelection && isCiteSelectionMode ? 220 : 12)) },
            {
              opacity: actionToastAnim,
              transform: [
                {
                  translateY: actionToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.actionToastText}>{actionToast}</Text>
        </Animated.View>
      ) : null}

      {isCiteSelectionMode && bodySelection?.text ? (
        <View style={[
          styles.citePanel,
          {
            bottom: keyboardHeight,
            paddingBottom: Math.max(16, safeAreaInsets.bottom + 8),
          },
        ]}>
          <View style={styles.citePanelHeaderRow}>
            <Text style={styles.citePanelLabel}>{t('reading.selectedCitationLabel' as TranslationKey)}</Text>

            <View style={styles.citePanelAppearancePicker}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => setSelectedCitationAppearance('white')}
                style={[
                  styles.citePanelAppearanceButton,
                  selectedCitationAppearance === 'white'
                    ? styles.citePanelAppearanceButtonActive
                    : styles.citePanelAppearanceButtonInactive,
                ]}
              >
                <View style={styles.citePanelAppearanceWhiteFill} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => setSelectedCitationAppearance('gradient')}
                style={[
                  styles.citePanelAppearanceButton,
                  selectedCitationAppearance === 'gradient'
                    ? styles.citePanelAppearanceButtonActive
                    : styles.citePanelAppearanceButtonInactive,
                ]}
              >
                <GradientCitationSwatch />
              </TouchableOpacity>
            </View>
          </View>
          {selectedCitationAppearance === 'gradient' ? (
            <GradientCitePanelPreviewText text={bodySelection.text} />
          ) : (
            <Text style={styles.citePanelPreview}>{bodySelection.text}</Text>
          )}

          <View style={styles.citePanelInputBlock}>
            <View style={styles.citePanelInputHeaderRow}>
              <Text style={styles.citePanelInputLabel}>{t('reading.citedUsersInputLabel' as TranslationKey)}</Text>
              <MaterialIcons name="search" size={18} color="rgba(255, 255, 255, 0.56)" />
            </View>

            <TextInput
              value={citedUsername}
              onChangeText={handleChangeCitedUsername}
              placeholder={t('reading.citedUsersInputLabel' as TranslationKey)}
              placeholderTextColor="rgba(255, 255, 255, 0.42)"
              style={styles.citePanelInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {selectedCitedUsers.length > 0 ? (
              <ScrollView
                nestedScrollEnabled
                style={styles.citeSelectedUsersInlineList}
                contentContainerStyle={styles.citeSelectedUsersInlineListContent}
                showsVerticalScrollIndicator={selectedCitedUsers.length > MAX_VISIBLE_CITED_USERS}
              >
                {selectedCitedUsers.map((selectedUser) => {
                  const normalizedSelectedUsername = normalizeMentionUsername(selectedUser.username);
                  const displayUsername = selectedUser.username.startsWith('@') ? selectedUser.username : `@${selectedUser.username}`;

                  return (
                    <View key={normalizedSelectedUsername} style={styles.citeSelectedUserInlineRow}>
                      {selectedUser.profile_photo_uri ? (
                        <Image
                          source={{ uri: getServerResourceUrl(String(selectedUser.profile_photo_uri)) }}
                          style={styles.citeSelectedUserInlineAvatar}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.citeSelectedUserInlineAvatarFallback}>
                          <MaterialIcons name="person" size={12} color="#FFFFFF" />
                        </View>
                      )}
                      <Text style={styles.citeSelectedUserInlineText} numberOfLines={1}>
                        {displayUsername}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            {(isLoadingUsernameSuggestions || usernameSuggestions.length > 0) ? (
              <View style={styles.citeSuggestionsList}>
                {isLoadingUsernameSuggestions ? (
                  <View style={styles.citeSuggestionsLoadingRow}>
                    <ActivityIndicator size="small" color="#FFB74D" />
                  </View>
                ) : null}

                {!isLoadingUsernameSuggestions ? usernameSuggestions.map((suggestion) => {
                  const normalizedUsername = String(suggestion.username || '').trim();
                  const displayUsername = normalizedUsername.startsWith('@') ? normalizedUsername : `@${normalizedUsername}`;
                  const avatarUri = suggestion.profile_photo_uri
                    ? getServerResourceUrl(String(suggestion.profile_photo_uri))
                    : '';

                  return (
                    <TouchableOpacity
                      key={displayUsername.toLowerCase()}
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      onPress={() => handlePickUsernameSuggestion(normalizedUsername)}
                      style={styles.citeSuggestionItem}
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.citeSuggestionAvatar} resizeMode="cover" />
                      ) : (
                        <View style={styles.citeSuggestionAvatarFallback}>
                          <MaterialIcons name="person" size={16} color="#FFFFFF" />
                        </View>
                      )}
                      <Text style={styles.citeSuggestionText} numberOfLines={1}>{displayUsername}</Text>
                    </TouchableOpacity>
                  );
                }) : null}
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={isApplyEnabled ? 0.85 : 1}
            disabled={!isApplyEnabled}
            onPress={handleApplyCitation}
            style={[
              styles.citePanelApplyButton,
              isApplyEnabled ? styles.citePanelApplyButtonEnabled : styles.citePanelApplyButtonDisabled,
            ]}
          >
            <ApplyButtonGradientBorder visible={isApplyEnabled} />
            <Text style={[
              styles.citePanelApplyButtonText,
              isApplyEnabled ? styles.citePanelApplyButtonTextEnabled : styles.citePanelApplyButtonTextDisabled,
            ]}>{t('common.apply' as TranslationKey)}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isCreatingReading ? (
        <View pointerEvents="auto" style={styles.uploadBlockingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      <Modal
        visible={!!expandedCitation}
        transparent
        animationType="fade"
        onRequestClose={clearExpandedCitation}
      >
        <View style={styles.citationUsersOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={clearExpandedCitation}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.citationUsersSheet,
              { paddingBottom: Math.max(16, safeAreaInsets.bottom + 8) },
            ]}
          >
            <View style={styles.citationUsersSheetHandle} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.delete' as TranslationKey)}
              activeOpacity={0.85}
              onPress={handleRemoveExpandedCitation}
              style={styles.citationUsersSheetRemoveButton}
            >
              <MaterialIcons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.citationUsersSheetTitle}>{t('reading.citedUsersTitle' as TranslationKey)}</Text>
            <Text style={styles.citationUsersSheetExcerpt}>{expandedCitation?.text || ''}</Text>

            <ScrollView
              style={styles.citationUsersList}
              contentContainerStyle={styles.citationUsersListContent}
              showsVerticalScrollIndicator={(expandedCitation?.users.length || 0) > MAX_VISIBLE_CITED_USERS}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {(expandedCitation?.users || []).map((user) => {
                const displayUsername = user.username.startsWith('@') ? user.username : `@${user.username}`;
                const normalizedUsername = normalizeMentionUsername(displayUsername);
                const avatarUri = user.profile_photo_uri ? getServerResourceUrl(String(user.profile_photo_uri)) : '';
                const renderableSocials = getRenderableCitationUserSocials(user.social_networks);
                const socialViewportCount = Math.min(renderableSocials.length, CITATION_USER_SOCIAL_VIEWPORT_COUNT);
                const socialViewportWidth = socialViewportCount > 0
                  ? (socialViewportCount * CITATION_USER_SOCIAL_ICON_SIZE) + ((socialViewportCount - 1) * CITATION_USER_SOCIAL_ICON_GAP)
                  : 0;

                return (
                  <View key={normalizedUsername} style={styles.citationUsersListItem}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.citationUsersListAvatar} resizeMode="cover" />
                    ) : (
                      <View style={styles.citationUsersListAvatarFallback}>
                        <MaterialIcons name="person" size={18} color="#FFFFFF" />
                      </View>
                    )}
                    <View style={styles.citationUsersListBody}>
                      <Text style={styles.citationUsersListText}>{displayUsername}</Text>

                      {renderableSocials.length > 0 ? (
                        <View style={[styles.citationUsersSocialViewport, { width: socialViewportWidth }]}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={renderableSocials.length > CITATION_USER_SOCIAL_VIEWPORT_COUNT}
                            contentContainerStyle={styles.citationUsersSocialRow}
                            nestedScrollEnabled
                          >
                            {renderableSocials.map((social, socialIndex) => {
                              const isLastSocial = socialIndex === renderableSocials.length - 1;

                              return (
                                <TouchableOpacity
                                  key={`${normalizedUsername}-${social.key}`}
                                  accessibilityRole="button"
                                  activeOpacity={0.85}
                                  onPress={() => handleOpenCitationSocialLink(social.link)}
                                  style={isLastSocial ? null : styles.citationUsersSocialIconSpacing}
                                >
                                  <Image
                                    source={social.iconSource}
                                    style={styles.citationUsersSocialIcon}
                                    resizeMode="contain"
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!imageViewerUri}
        transparent
        animationType="fade"
        onRequestClose={closeReadingImageViewer}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={closeReadingImageViewer}
            style={styles.imageViewerCloseButton}
          >
            <MaterialIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {imageViewerUri ? (
            <Image
              source={{ uri: imageViewerUri }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 280,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  topBar: {
    height: 38,
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  createButton: {
    minWidth: 116,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  createButtonEnabled: {
    opacity: 1,
    borderWidth: 0,
  },
  createButtonDisabled: {
    borderColor: 'rgba(255, 183, 77, 0.4)',
    borderWidth: 1.5,
    opacity: 0.4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  textBlock: {
    marginTop: 22,
  },
  fieldBlock: {
    marginBottom: 8,
  },
  titleInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    paddingVertical: 0,
  },
  subtitleInput: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 0,
  },
  leadInput: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
    lineHeight: 20,
    minHeight: 56,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    minHeight: 180,
    paddingTop: 0,
    paddingBottom: 0,
  },
  readingDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  readingDateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#393939',
    paddingRight: 12,
  },
  readingDateInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  readingDateIconButton: {
    padding: 8,
  },
  readingCategorySection: {
    marginTop: 10,
    marginBottom: 8,
    position: 'relative',
    zIndex: 1,
  },
  readingCategorySectionExpanded: {
    zIndex: 8,
    elevation: 8,
  },
  readingCategoryTrigger: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#393939',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  readingCategoryInlineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readingCategoryTriggerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  readingCategoryOptionsPanel: {
    marginTop: 8,
    backgroundColor: '#101010',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
  },
  readingCategorySearchInput: {
    height: 44,
    margin: 10,
    marginBottom: 4,
    borderRadius: 14,
    backgroundColor: '#000000',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  readingCategoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  readingCategoryOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  readingCategoryOptionTextSelected: {
    color: '#FFB74D',
    fontWeight: '700',
  },
  readingHypeCostSection: {
    marginTop: 2,
    marginBottom: 8,
    position: 'relative',
    zIndex: 0,
  },
  readingHypeCostInfoAnchor: {
    position: 'relative',
    zIndex: 6,
  },
  readingHypeCostLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    zIndex: 6,
  },
  readingHypeCostLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  readingHypeCostInfoButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingHypeCostInfoPanel: {
    position: 'absolute',
    top: 28,
    right: 0,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 6,
    elevation: 8,
  },
  readingHypeCostInfoText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'justify',
  },
  readingHypeCostField: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#393939',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readingHypeCostFieldInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
    margin: 0,
  },
  bodyPreviewContainer: {
    position: 'relative',
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 0,
  },
  bodyPreviewRichTextFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  bodyPreviewPlainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
  },
  bodyPreviewCitationTextWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
  },
  bodyPreviewCitationTextGradientPlaceholder: {
    color: 'transparent',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
  },
  bodyPreviewCitationMaskText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
  },
  bodyPreviewCitationMeasureText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
    opacity: 0,
  },
  bodyPreviewCitationTouchable: {
    position: 'relative',
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  bodyPreviewCitationInlineContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  bodyPreviewCitationGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bodyPreviewCitationAbsoluteTouchable: {
    position: 'absolute',
  },
  bodyPreviewEditorPlainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
  },
  bodyPreviewEditorCitationTextWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 255, 255, 0.4)',
    textShadowColor: 'rgba(255, 255, 255, 0.22)',
    textShadowRadius: 0.6,
    textShadowOffset: { width: 0, height: 0 },
  },
  bodyPreviewEditorCitationTextGradient: {
    color: APPLY_BUTTON_GRADIENT_COLORS[0],
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 183, 77, 0.4)',
    textShadowColor: APPLY_BUTTON_GRADIENT_COLORS[1],
    textShadowRadius: 1.2,
    textShadowOffset: { width: 0, height: 0 },
  },
  bodyCitationEditorLayer: {
    position: 'relative',
  },
  bodyCitationEditorInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 0,
    color: 'transparent',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
  },
  intertitleSection: {
    marginTop: 4,
    marginBottom: 14,
  },
  voiceNoteInlineSection: {
    marginTop: 4,
    marginBottom: 14,
  },
  intertitleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intertitleInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 0,
  },
  removeIntertitleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCounter: {
    color: '#8F8F8F',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  bodyActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bodyActionsButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNoteActionButton: {
    minWidth: 34,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceNoteActionButtonDisabled: {
    opacity: 0.38,
  },
  intertitleActionButton: {
    minWidth: 34,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  citeActionButton: {
    minWidth: 34,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  citeActionButtonActive: {
    borderColor: 'rgba(255, 183, 77, 0.82)',
    backgroundColor: 'rgba(255, 183, 77, 0.18)',
  },
  readingSocialComposerSection: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readingSocialComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  readingSocialComposerLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  readingSocialComposerCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  readingSocialTrigger: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  readingSocialInlineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  readingSocialTriggerLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readingSocialSelectedIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  readingSocialPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  readingSocialOptionsPanel: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readingSocialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  readingSocialOption: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  readingSocialOptionSelected: {
    borderColor: 'rgba(255,183,77,0.82)',
    backgroundColor: 'rgba(255,183,77,0.14)',
  },
  readingSocialOptionIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  readingSocialLinkInputShell: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
  },
  readingSocialLinkInputShellDisabled: {
    opacity: 0.56,
  },
  readingSocialLinkInputShellError: {
    borderColor: 'rgba(216,67,21,0.75)',
    backgroundColor: 'rgba(216,67,21,0.08)',
  },
  readingSocialLinkInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  readingSocialLinkApplyAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingSocialLinkErrorText: {
    marginTop: 6,
    color: '#FFB4A8',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  intertitleActionGlyph: {
    width: 18,
    height: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intertitleActionLineShort: {
    width: 9,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  intertitleActionLineLong: {
    width: 15,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  citeActionGlyph: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  citeActionMark: {
    width: 5,
    height: 9,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  bodyActionsCounter: {
    color: '#8F8F8F',
    fontSize: 11,
    textAlign: 'right',
  },
  imageSection: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceNoteSlotSection: {
    marginBottom: 14,
  },
  outroVoiceNoteSection: {
    marginTop: 20,
  },
  voiceNoteInlineComposerSection: {
    marginTop: 12,
    marginBottom: 6,
  },
  readingSocialLinkSection: {
    marginTop: 18,
  },
  readingSocialLinkCard: {
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readingSocialLinkRemoveButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  readingSocialLinkPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 28,
  },
  readingSocialLinkIconShell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  readingSocialLinkIcon: {
    width: 18,
    height: 18,
  },
  readingSocialLinkValueBox: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readingSocialLinkValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceNotePrimaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  voiceNotePrimaryButtonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  voiceNotePrimaryButtonCopy: {
    flex: 1,
    marginLeft: 12,
  },
  voiceNotePrimaryButtonTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  voiceNoteTextInput: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  voiceNotePrimaryButtonAction: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNotePrimaryButtonActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  voiceNoteSecondaryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNoteSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceNoteRecordingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.34)',
    backgroundColor: 'rgba(255, 183, 77, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceNoteRecordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6F61',
  },
  voiceNoteRecordingCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  voiceNoteRecordingTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  voiceNoteRecordingStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
  },
  voiceNoteRecordingStopButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  selectedImagesSection: {
    marginTop: 20,
  },
  selectedImageAboveBodySection: {
    marginTop: 8,
    marginBottom: 12,
  },
  selectedImageCard: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 230,
    borderRadius: 24,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  imageHint: {
    color: '#A7A7A7',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  actionToastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#232323',
    zIndex: 20,
  },
  actionToastText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  uploadBlockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    zIndex: 24,
  },
  citePanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#080808',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  citePanelLabel: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  citePanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  citePanelAppearancePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  citePanelAppearanceButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  citePanelAppearanceButtonActive: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  citePanelAppearanceButtonInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  citePanelAppearanceWhiteFill: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  citePanelPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  citePanelPreviewGradientContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 16,
    maxWidth: '100%',
  },
  citePanelPreviewGradientMeasureText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0,
  },
  citePanelPreviewGradientMaskText: {
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
  },
  citePanelPreviewGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  citePanelInputBlock: {
    marginBottom: 16,
  },
  citePanelInputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  citePanelInputLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  citePanelInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  citeSelectedUsersInlineList: {
    marginTop: 8,
    maxHeight: 112,
  },
  citeSelectedUsersInlineListContent: {
    paddingBottom: 2,
  },
  citeSelectedUserInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  citeSelectedUserInlineAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  citeSelectedUserInlineAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  citeSelectedUserInlineText: {
    flex: 1,
    color: '#AFAFAF',
    fontSize: 11,
    fontWeight: '600',
  },
  citeSuggestionsList: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  citeSuggestionsLoadingRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citeSuggestionItem: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  citeSuggestionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  citeSuggestionAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  citeSuggestionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  citePanelApplyButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  citePanelApplyButtonEnabled: {
    opacity: 1,
  },
  citePanelApplyButtonDisabled: {
    opacity: 0.55,
  },
  citePanelApplyButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  citePanelApplyButtonTextEnabled: {
    color: '#FFFFFF',
  },
  citePanelApplyButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.58)',
  },
  citationUsersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  citationUsersSheet: {
    backgroundColor: '#080808',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '60%',
  },
  citationUsersSheetRemoveButton: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  citationUsersSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: 14,
  },
  citationUsersSheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  citationUsersSheetExcerpt: {
    color: '#CFCFCF',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  citationUsersList: {
    maxHeight: 260,
  },
  citationUsersListContent: {
    paddingBottom: 4,
  },
  citationUsersListItem: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  citationUsersListAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  citationUsersListAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  citationUsersListText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  citationUsersListBody: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  citationUsersSocialViewport: {
    height: 18,
    overflow: 'hidden',
    marginTop: 3,
  },
  citationUsersSocialRow: {
    alignItems: 'center',
  },
  citationUsersSocialIcon: {
    width: CITATION_USER_SOCIAL_ICON_SIZE,
    height: CITATION_USER_SOCIAL_ICON_SIZE,
  },
  citationUsersSocialIconSpacing: {
    marginRight: CITATION_USER_SOCIAL_ICON_GAP,
  },
});

function IntertitleActionGlyph() {
  return (
    <View style={styles.intertitleActionGlyph}>
      <View style={styles.intertitleActionLineShort} />
      <View style={styles.intertitleActionLineLong} />
    </View>
  );
}

function CiteActionGlyph() {
  return (
    <View style={styles.citeActionGlyph}>
      <View style={styles.citeActionMark} />
      <View style={styles.citeActionMark} />
    </View>
  );
}

function ApplyButtonGradientBorder({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="reading_apply_button_gradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect
          x="1"
          y="1"
          width="99%"
          height="95%"
          rx="14"
          ry="14"
          fill="transparent"
          stroke="url(#reading_apply_button_gradient)"
          strokeWidth="2"
        />
      </Svg>
    </View>
  );
}

function CreateButtonGradientBorder({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="reading_create_button_gradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect
          x="1"
          y="1"
          width="98%"
          height="94%"
          rx="16"
          ry="16"
          fill="transparent"
          stroke="url(#reading_create_button_gradient)"
          strokeWidth="2"
        />
      </Svg>
    </View>
  );
}

function GradientCitationSwatch() {
  return (
    <Svg width="14" height="14" viewBox="0 0 14 14">
      <Defs>
        <LinearGradient id="reading_citation_swatch_gradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
          <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="14" height="14" rx="4" ry="4" fill="url(#reading_citation_swatch_gradient)" />
    </Svg>
  );
}

function GradientCitePanelPreviewText({
  text,
}: {
  text: string;
}) {
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  return (
    <View style={styles.citePanelPreviewGradientContainer} pointerEvents="none">
      <Text
        style={styles.citePanelPreviewGradientMeasureText}
        onLayout={(event) => {
          const nextWidth = Math.ceil(event.nativeEvent.layout.width);
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);

          if (!nextWidth || !nextHeight) {
            return;
          }

          setLayout((previous) => {
            if (previous?.width === nextWidth && previous?.height === nextHeight) {
              return previous;
            }

            return {
              width: nextWidth,
              height: nextHeight,
            };
          });
        }}
      >
        {text}
      </Text>

      {layout ? (
        <View style={styles.citePanelPreviewGradientOverlay}>
          <MaskedView
            style={{ width: layout.width, height: layout.height }}
            maskElement={
              <View style={{ width: layout.width, height: layout.height }}>
                <Text style={styles.citePanelPreviewGradientMaskText}>{text}</Text>
              </View>
            }
          >
            <Svg width={layout.width} height={layout.height}>
              <Defs>
                <LinearGradient id="reading_cite_panel_preview_gradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
                  <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#reading_cite_panel_preview_gradient)" />
            </Svg>
          </MaskedView>
        </View>
      ) : null}
    </View>
  );
}

function GradientInlineCitationText({
  text,
  onPress,
}: {
  text: string;
  onPress: () => void;
}) {
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.bodyPreviewCitationTouchable}
    >
      <Text
        style={styles.bodyPreviewCitationMeasureText}
        onLayout={(event) => {
          const nextWidth = Math.ceil(event.nativeEvent.layout.width);
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);

          if (!nextWidth || !nextHeight) {
            return;
          }

          setLayout((previous) => {
            if (previous?.width === nextWidth && previous?.height === nextHeight) {
              return previous;
            }

            return {
              width: nextWidth,
              height: nextHeight,
            };
          });
        }}
      >
        {text}
      </Text>

      {layout ? (
        <View style={styles.bodyPreviewCitationGradientOverlay} pointerEvents="none">
          <MaskedView
            style={{ width: layout.width, height: layout.height }}
            maskElement={
              <View style={{ width: layout.width, height: layout.height }}>
                <Text style={styles.bodyPreviewCitationMaskText}>{text}</Text>
              </View>
            }
          >
            <Svg width={layout.width} height={layout.height}>
              <Defs>
                <LinearGradient id="reading_inline_citation_gradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
                  <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#reading_inline_citation_gradient)" />
            </Svg>
          </MaskedView>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function GradientPreviewCitationOverlay({
  text,
  onPress,
  x,
  y,
  width,
  height,
}: {
  text: string;
  onPress: () => void;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.bodyPreviewCitationAbsoluteTouchable,
        { left: x, top: y, width, height },
      ]}
    >
      <MaskedView
        style={{ width, height }}
        maskElement={
          <View style={{ width, height }}>
            <Text style={styles.bodyPreviewCitationMaskText}>{text}</Text>
          </View>
        }
      >
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={`reading_inline_preview_overlay_gradient_${width}_${height}_${text.length}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill={`url(#reading_inline_preview_overlay_gradient_${width}_${height}_${text.length})`} />
        </Svg>
      </MaskedView>
    </TouchableOpacity>
  );
}

function GradientInlineCitationBackdropText({
  text,
}: {
  text: string;
}) {
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  return (
    <View style={styles.bodyPreviewCitationInlineContainer} pointerEvents="none">
      <Text
        style={styles.bodyPreviewCitationMeasureText}
        onLayout={(event) => {
          const nextWidth = Math.ceil(event.nativeEvent.layout.width);
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);

          if (!nextWidth || !nextHeight) {
            return;
          }

          setLayout((previous) => {
            if (previous?.width === nextWidth && previous?.height === nextHeight) {
              return previous;
            }

            return {
              width: nextWidth,
              height: nextHeight,
            };
          });
        }}
      >
        {text}
      </Text>

      {layout ? (
        <View style={styles.bodyPreviewCitationGradientOverlay}>
          <MaskedView
            style={{ width: layout.width, height: layout.height }}
            maskElement={
              <View style={{ width: layout.width, height: layout.height }}>
                <Text style={styles.bodyPreviewCitationMaskText}>{text}</Text>
              </View>
            }
          >
            <Svg width={layout.width} height={layout.height}>
              <Defs>
                <LinearGradient id="reading_inline_citation_backdrop_gradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={APPLY_BUTTON_GRADIENT_COLORS[0]} stopOpacity="1" />
                  <Stop offset="1" stopColor={APPLY_BUTTON_GRADIENT_COLORS[1]} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#reading_inline_citation_backdrop_gradient)" />
            </Svg>
          </MaskedView>
        </View>
      ) : null}
    </View>
  );
}

export default ReadingScreen;
