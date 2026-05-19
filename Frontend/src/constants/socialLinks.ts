export const CHANNEL_EVENT_SOCIAL_OPTIONS = [
  'youtube',
  'twitter',
  'tiktok',
  'spotify',
  'threads',
  'telegram',
  'pinterest',
  'onlyfans',
  'linkedin',
  'kick',
  'instagram',
  'facebook',
  'discord',
] as const;

export type ChannelEventSocialOption = (typeof CHANNEL_EVENT_SOCIAL_OPTIONS)[number];

export const SOCIAL_ICONS = {
  facebook: require('../../assets/images/facebook.png'),
  instagram: require('../../assets/images/instagram.png'),
  onlyfans: require('../../assets/images/onlyfans.png'),
  pinterest: require('../../assets/images/pinterest.png'),
  spotify: require('../../assets/images/spotify.png'),
  telegram: require('../../assets/images/telegram.png'),
  tiktok: require('../../assets/images/tiktok.png'),
  twitter: require('../../assets/images/x_twitter.png'),
  youtube: require('../../assets/images/youtube.png'),
  discord: require('../../assets/images/discord.png'),
  threads: require('../../assets/images/threads.png'),
  linkedin: require('../../assets/images/linkedin.png'),
  kick: require('../../assets/images/kick.png'),
  twitch: require('../../assets/images/twitch.png'),
} as const;

export const SOCIAL_PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  onlyfans: 'OnlyFans',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
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

export const normalizeSocialNetworkKey = (raw: unknown) => {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) {
    return '';
  }

  if (key === 'x' || key === 'x_twitter' || key === 'xtwitter') {
    return 'twitter';
  }

  if (key === 'only_fans') {
    return 'onlyfans';
  }

  return key;
};

export const normalizeExternalUrl = (rawUrl: string): string | null => {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
};

export const validateSocialLink = (platform: string, link: string): boolean => {
  if (!link.trim()) {
    return true;
  }

  const validators: Record<string, RegExp> = {
    facebook: /^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/.+/i,
    onlyfans: /^https?:\/\/(www\.)?onlyfans\.com\/.+/i,
    pinterest: /^https?:\/\/(www\.)?(pinterest\.(com|es)|pin\.it)\/.+/i,
    spotify: /^https?:\/\/(open\.)?spotify\.com\/.+/i,
    telegram: /^(https?:\/\/)?(t\.me|telegram\.me)\/.+/i,
    tiktok: /^(https?:\/\/)?((www|m|vm|vt)\.)?tiktok\.com\/.+/i,
    twitter: /^https?:\/\/(www\.)?(twitter|x)\.com\/.+/i,
    youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
    discord: /^https?:\/\/(www\.)?(discord\.(com|gg)|discordapp\.com)\/.+/i,
    threads: /^https?:\/\/(www\.)?threads\.(net|com)\/@.+/i,
    linkedin: /^https?:\/\/(?:[\w-]+\.)*linkedin\.com\/.+/i,
    kick: /^https?:\/\/(www\.)?kick\.com\/.+/i,
    twitch: /^https?:\/\/((www|m)\.)?twitch\.tv\/.+/i,
  };

  return validators[normalizeSocialNetworkKey(platform)]?.test(link.trim()) ?? false;
};
