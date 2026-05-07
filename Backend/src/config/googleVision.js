function parseBooleanEnv(name, defaultValue) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseNumberEnv(name, defaultValue, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(min, value));
}

function normalizePrivateKey(raw) {
  return String(raw || '').replace(/\\n/g, '\n').trim();
}

function getInlineCredentials() {
  const rawJson = String(
    process.env.GOOGLE_CLOUD_VISION_CREDENTIALS_JSON ||
      process.env.GOOGLE_CLOUD_CREDENTIALS_JSON ||
      ''
  ).trim();

  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GOOGLE_CLOUD_VISION_CREDENTIALS_JSON no contiene un JSON válido');
    }
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    return parsed;
  }

  const clientEmail = String(process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '').trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY || '');
  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: String(process.env.GOOGLE_CLOUD_PROJECT_ID || '').trim() || undefined,
  };
}

function isGoogleVisionEnabled() {
  return parseBooleanEnv('GOOGLE_CLOUD_VISION_ENABLED', true);
}

function buildGoogleVisionClientOptions() {
  const credentials = getInlineCredentials();
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT_ID || credentials?.project_id || '').trim();

  if (credentials) {
    return {
      projectId: projectId || undefined,
      credentials,
    };
  }

  if (projectId) {
    return { projectId };
  }

  return {};
}

function getGoogleVisionRequestTimeoutMs() {
  return parseNumberEnv('ACCOUNT_SELFIE_GCV_TIMEOUT_MS', 8000, 1000, 20000);
}

function getGoogleVisionThresholds() {
  return {
    minFaceConfidence: parseNumberEnv('ACCOUNT_SELFIE_GCV_MIN_FACE_CONFIDENCE', 0.82, 0.4, 0.99),
    minLandmarkConfidence: parseNumberEnv('ACCOUNT_SELFIE_GCV_MIN_LANDMARK_CONFIDENCE', 0.7, 0.2, 0.99),
    minAcceptedFaceAreaRatio: parseNumberEnv('ACCOUNT_SELFIE_GCV_MIN_FACE_AREA_RATIO', 0.12, 0.03, 0.95),
    minFailedFaceAreaRatio: parseNumberEnv('ACCOUNT_SELFIE_GCV_AUTO_FAIL_FACE_AREA_RATIO', 0.05, 0.01, 0.5),
  };
}

module.exports = {
  buildGoogleVisionClientOptions,
  getGoogleVisionRequestTimeoutMs,
  getGoogleVisionThresholds,
  isGoogleVisionEnabled,
};