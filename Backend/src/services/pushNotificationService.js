const admin = require('firebase-admin');
const pool = require('../config/database');

const DEVICE_PUSH_PLATFORM_ANDROID = 'android';
const FCM_PROVIDER = 'fcm';
const DEFAULT_ANDROID_CHANNEL_ID = String(process.env.FCM_ANDROID_CHANNEL_ID || 'keinti.realtime').trim() || 'keinti.realtime';
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

let initializedFirebaseApp = null;
let attemptedFirebaseInit = false;
let loggedMissingFirebaseConfig = false;

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

function resolveFirebaseServiceAccount() {
  const rawJson = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVICE_ACCOUNT_JSON || ''
  ).trim();
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON value:', error);
      return null;
    }
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getFirebaseMessagingApp() {
  if (initializedFirebaseApp) {
    return initializedFirebaseApp;
  }

  if (admin.apps.length > 0) {
    initializedFirebaseApp = admin.app();
    return initializedFirebaseApp;
  }

  if (attemptedFirebaseInit) {
    return null;
  }

  attemptedFirebaseInit = true;

  try {
    const serviceAccount = resolveFirebaseServiceAccount();
    if (serviceAccount) {
      initializedFirebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });
      return initializedFirebaseApp;
    }

    if (String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) {
      initializedFirebaseApp = admin.initializeApp();
      return initializedFirebaseApp;
    }

    if (!loggedMissingFirebaseConfig) {
      loggedMissingFirebaseConfig = true;
      console.warn('FCM disabled: configure FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in Backend/.env');
    }
  } catch (error) {
    console.error('Unable to initialize Firebase Admin SDK:', error);
  }

  return null;
}

function normalizeUsername(username, fallbackEmail) {
  const rawUsername = String(username || '').trim();
  if (rawUsername) {
    return rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;
  }

  const rawEmail = String(fallbackEmail || '').trim();
  return rawEmail ? `@${rawEmail}` : '@canal';
}

function buildJoinedChannelInteractionCopy({ publisherUsername, publisherEmail, interactionKind }) {
  const handle = normalizeUsername(publisherUsername, publisherEmail);

  switch (String(interactionKind || '').trim()) {
  case 'reply':
    return {
      title: `${handle} te respondió`,
      body: 'Abre el canal para ver la respuesta.',
    };
  case 'image':
    return {
      title: `${handle} compartió una imagen`,
      body: 'Hay contenido nuevo en el canal al que te uniste.',
    };
  case 'event':
    return {
      title: `${handle} publicó un evento`,
      body: 'Hay un evento nuevo en el canal al que te uniste.',
    };
  case 'reading':
    return {
      title: `${handle} publicó una lectura`,
      body: 'Hay una lectura nueva en el canal al que te uniste.',
    };
  case 'recommendation':
    return {
      title: `${handle} recomendó un aro`,
      body: 'Hay una recomendación nueva en el canal al que te uniste.',
    };
  default:
    return {
      title: `${handle} tiene actividad nueva`,
      body: 'Abre el canal para ver el contenido nuevo.',
    };
  }
}

async function listUserDevicePushTokens(userEmail) {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return [];
  }

  const result = await pool.query(
    `SELECT token
     FROM device_push_tokens
     WHERE lower(user_email) = $1
       AND platform = $2`,
    [normalizedEmail, DEVICE_PUSH_PLATFORM_ANDROID]
  );

  return (result.rows || [])
    .map((row) => String(row?.token || '').trim())
    .filter(Boolean);
}

async function deleteDevicePushTokens(tokens) {
  const normalizedTokens = Array.from(new Set(
    (Array.isArray(tokens) ? tokens : [])
      .map((token) => String(token || '').trim())
      .filter(Boolean)
  ));

  if (normalizedTokens.length === 0) {
    return;
  }

  await pool.query(
    'DELETE FROM device_push_tokens WHERE token = ANY($1::text[])',
    [normalizedTokens]
  ).catch(() => {});
}

async function sendJoinedChannelInteractionPush({
  recipientEmail,
  publisherEmail,
  publisherUsername,
  postId,
  interactionKind,
}) {
  const firebaseApp = getFirebaseMessagingApp();
  if (!firebaseApp) {
    return { ok: false, reason: 'fcm_not_configured' };
  }

  const normalizedRecipientEmail = String(recipientEmail || '').trim().toLowerCase();
  const numericPostId = Number(postId);
  const normalizedInteractionKind = String(interactionKind || '').trim();

  if (!normalizedRecipientEmail || !Number.isFinite(numericPostId) || !normalizedInteractionKind) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const tokens = await listUserDevicePushTokens(normalizedRecipientEmail);
  if (tokens.length === 0) {
    return { ok: false, reason: 'no_tokens' };
  }

  const copy = buildJoinedChannelInteractionCopy({
    publisherUsername,
    publisherEmail,
    interactionKind: normalizedInteractionKind,
  });

  const response = await admin.messaging(firebaseApp).sendEachForMulticast({
    tokens,
    notification: {
      title: copy.title,
      body: copy.body,
    },
    data: {
      type: 'joined_channel_interaction',
      postId: String(Math.trunc(numericPostId)),
      publisherUsername: String(publisherUsername || ''),
      interactionKind: normalizedInteractionKind,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: DEFAULT_ANDROID_CHANNEL_ID,
        sound: 'default',
        priority: 'max',
      },
    },
  });

  const invalidTokens = [];
  response.responses.forEach((entry, index) => {
    if (!entry.success && INVALID_TOKEN_ERROR_CODES.has(String(entry.error?.code || '').trim())) {
      invalidTokens.push(tokens[index]);
    }
  });

  if (invalidTokens.length > 0) {
    await deleteDevicePushTokens(invalidTokens);
  }

  return {
    ok: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

module.exports = {
  DEFAULT_ANDROID_CHANNEL_ID,
  DEVICE_PUSH_PLATFORM_ANDROID,
  FCM_PROVIDER,
  sendJoinedChannelInteractionPush,
};