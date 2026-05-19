import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { API_URL } from '../config/api';

export const KEINTI_PUSH_ANDROID_CHANNEL_ID = 'keinti.realtime';

export type JoinedChannelPushRedirect = {
  postId: number;
  publisherUsername: string;
  interactionKind: string | null;
};

const buildAuthHeaders = (authToken: string) => ({
  Authorization: `Bearer ${String(authToken || '').trim()}`,
  'Content-Type': 'application/json',
});

const normalizePushToken = (rawValue: unknown) => String(rawValue || '').trim();
const getFirebaseMessagingInstance = () => getMessaging(getApp());

export const ensurePushNotificationChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: KEINTI_PUSH_ANDROID_CHANNEL_ID,
    name: 'Notificaciones de canal',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
};

export const requestPushNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (Number(Platform.Version) < 33) {
    return true;
  }

  const permissionResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  ).catch(() => PermissionsAndroid.RESULTS.DENIED);

  return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
};

export const registerDevicePushToken = async (authToken: string, pushToken: string) => {
  const normalizedAuthToken = String(authToken || '').trim();
  const normalizedPushToken = normalizePushToken(pushToken);

  if (!normalizedAuthToken) {
    throw new Error('Missing auth token');
  }

  if (!normalizedPushToken) {
    throw new Error('Missing push token');
  }

  const response = await fetch(`${API_URL}/api/users/me/device-push-tokens`, {
    method: 'POST',
    headers: buildAuthHeaders(normalizedAuthToken),
    body: JSON.stringify({
      token: normalizedPushToken,
      platform: 'android',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || 'Unable to register push token'));
  }
};

export const unregisterDevicePushToken = async (authToken: string, pushToken: string) => {
  const normalizedAuthToken = String(authToken || '').trim();
  const normalizedPushToken = normalizePushToken(pushToken);

  if (!normalizedAuthToken || !normalizedPushToken) {
    return;
  }

  await fetch(`${API_URL}/api/users/me/device-push-tokens`, {
    method: 'DELETE',
    headers: buildAuthHeaders(normalizedAuthToken),
    body: JSON.stringify({ token: normalizedPushToken }),
  }).catch(() => undefined);
};

export const ensureDevicePushTokenRegistered = async (authToken: string): Promise<string | null> => {
  const normalizedAuthToken = String(authToken || '').trim();
  if (!normalizedAuthToken) {
    return null;
  }

  await ensurePushNotificationChannel();

  const permissionGranted = await requestPushNotificationPermission();
  if (!permissionGranted) {
    return null;
  }

  const pushToken = normalizePushToken(
    await getToken(getFirebaseMessagingInstance()).catch(() => '')
  );
  if (!pushToken) {
    return null;
  }

  await registerDevicePushToken(normalizedAuthToken, pushToken);
  return pushToken;
};

export const extractJoinedChannelPushRedirect = (rawData: unknown): JoinedChannelPushRedirect | null => {
  const data = rawData && typeof rawData === 'object'
    ? rawData as Record<string, unknown>
    : {};

  if (String(data.type || '').trim() !== 'joined_channel_interaction') {
    return null;
  }

  const parsedPostId = Number(data.postId);
  if (!Number.isFinite(parsedPostId) || parsedPostId <= 0) {
    return null;
  }

  return {
    postId: Math.trunc(parsedPostId),
    publisherUsername: String(data.publisherUsername || '').trim(),
    interactionKind: String(data.interactionKind || '').trim() || null,
  };
};

export const displayForegroundPushNotification = async (remoteMessage: any) => {
  const redirect = extractJoinedChannelPushRedirect(remoteMessage?.data);
  if (!redirect) {
    return;
  }

  await ensurePushNotificationChannel();

  await notifee.displayNotification({
    title: String(remoteMessage?.notification?.title || '').trim() || 'Nueva actividad en tu canal unido',
    body: String(remoteMessage?.notification?.body || '').trim() || 'Abre el canal para ver el contenido nuevo.',
    data: {
      type: 'joined_channel_interaction',
      postId: String(redirect.postId),
      publisherUsername: redirect.publisherUsername,
      interactionKind: redirect.interactionKind || '',
    },
    android: {
      channelId: KEINTI_PUSH_ANDROID_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
    },
  });
};