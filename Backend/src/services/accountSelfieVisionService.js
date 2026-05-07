const sharp = require('sharp');

const {
  buildGoogleVisionClientOptions,
  getGoogleVisionRequestTimeoutMs,
  getGoogleVisionThresholds,
  isGoogleVisionEnabled,
} = require('../config/googleVision');

const RULESET_VERSION = 'gcv-selfie-v1';

const LIKELIHOOD_SCORES = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

let cachedVisionClient = null;

function normalizeLikelihood(raw) {
  const value = String(raw || '').trim().toUpperCase();
  return LIKELIHOOD_SCORES[value] != null ? value : 'UNKNOWN';
}

function getLikelihoodScore(raw) {
  return LIKELIHOOD_SCORES[normalizeLikelihood(raw)] || 0;
}

function roundMetric(value, digits = 4) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function safeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error || 'unknown_error');
}

function buildDecision(status, userMessage, reviewFlags, summary, errorCode) {
  return {
    status,
    userMessage,
    reviewFlags,
    summary,
    errorCode: errorCode || null,
  };
}

async function getImageMetadata(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: Number(metadata?.width) || null,
      height: Number(metadata?.height) || null,
    };
  } catch {
    return { width: null, height: null };
  }
}

function getBoundingVertices(faceAnnotation) {
  const vertices = faceAnnotation?.fdBoundingPoly?.vertices || faceAnnotation?.boundingPoly?.vertices || [];
  return Array.isArray(vertices) ? vertices : [];
}

function computeFaceAreaRatio(faceAnnotation, imageMeta) {
  const width = Number(imageMeta?.width) || 0;
  const height = Number(imageMeta?.height) || 0;
  if (width <= 0 || height <= 0) return null;

  const vertices = getBoundingVertices(faceAnnotation)
    .map((vertex) => ({ x: Number(vertex?.x) || 0, y: Number(vertex?.y) || 0 }))
    .filter((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y));

  if (vertices.length === 0) return null;

  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const boxWidth = Math.max(0, Math.max(...xs) - Math.min(...xs));
  const boxHeight = Math.max(0, Math.max(...ys) - Math.min(...ys));
  if (boxWidth <= 0 || boxHeight <= 0) return null;

  return roundMetric((boxWidth * boxHeight) / (width * height));
}

function getGoogleVisionClient() {
  if (cachedVisionClient) {
    return cachedVisionClient;
  }

  const vision = require('@google-cloud/vision');
  cachedVisionClient = new vision.ImageAnnotatorClient(buildGoogleVisionClientOptions());
  return cachedVisionClient;
}

function buildSummary({ mimeType, buffer, imageMeta, faceAnnotations, safeSearchAnnotation, reviewFlags, runtime }) {
  const primaryFace = faceAnnotations[0] || null;
  return {
    provider: 'google-cloud-vision',
    ruleset: RULESET_VERSION,
    runtime: runtime || 'google_vision',
    image: {
      mimeType: mimeType || 'application/octet-stream',
      bytes: Buffer.isBuffer(buffer) ? buffer.length : 0,
      width: imageMeta?.width || null,
      height: imageMeta?.height || null,
    },
    faceCount: faceAnnotations.length,
    primaryFace: primaryFace
      ? {
          detectionConfidence: roundMetric(primaryFace.detectionConfidence),
          landmarkingConfidence: roundMetric(primaryFace.landmarkingConfidence),
          faceAreaRatio: computeFaceAreaRatio(primaryFace, imageMeta),
          blurredLikelihood: normalizeLikelihood(primaryFace.blurredLikelihood),
          underExposedLikelihood: normalizeLikelihood(primaryFace.underExposedLikelihood),
          headwearLikelihood: normalizeLikelihood(primaryFace.headwearLikelihood),
        }
      : null,
    safeSearch: safeSearchAnnotation
      ? {
          adult: normalizeLikelihood(safeSearchAnnotation.adult),
          spoof: normalizeLikelihood(safeSearchAnnotation.spoof),
          medical: normalizeLikelihood(safeSearchAnnotation.medical),
          violence: normalizeLikelihood(safeSearchAnnotation.violence),
          racy: normalizeLikelihood(safeSearchAnnotation.racy),
        }
      : null,
    reviewFlags: Array.isArray(reviewFlags) ? reviewFlags : [],
    processedAt: new Date().toISOString(),
  };
}

async function analyzeAccountSelfie({ buffer, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return buildDecision(
      'failed',
      'No se recibió una imagen válida. Reintenta con la cámara frontal.',
      ['empty_buffer'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta: { width: null, height: null },
        faceAnnotations: [],
        safeSearchAnnotation: null,
        reviewFlags: ['empty_buffer'],
        runtime: 'input_validation',
      }),
      'EMPTY_BUFFER'
    );
  }

  const imageMeta = await getImageMetadata(buffer);

  if (!isGoogleVisionEnabled()) {
    return buildDecision(
      'pending',
      'Tu selfie necesita una revisión adicional antes de activar el paso 2.',
      ['vision_disabled'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations: [],
        safeSearchAnnotation: null,
        reviewFlags: ['vision_disabled'],
        runtime: 'manual_review_fallback',
      }),
      'VISION_DISABLED'
    );
  }

  const thresholds = getGoogleVisionThresholds();

  let annotation;
  try {
    const client = getGoogleVisionClient();
    const [result] = await client.annotateImage(
      {
        image: {
          content: buffer.toString('base64'),
        },
        features: [
          { type: 'FACE_DETECTION', maxResults: 5 },
          { type: 'SAFE_SEARCH_DETECTION', maxResults: 1 },
        ],
      },
      {
        timeout: getGoogleVisionRequestTimeoutMs(),
      }
    );
    annotation = result || {};
  } catch (error) {
    return buildDecision(
      'pending',
      'Tu selfie necesita una revisión adicional antes de activar el paso 2.',
      ['vision_request_failed'],
      {
        ...buildSummary({
          mimeType,
          buffer,
          imageMeta,
          faceAnnotations: [],
          safeSearchAnnotation: null,
          reviewFlags: ['vision_request_failed'],
          runtime: 'manual_review_fallback',
        }),
        error: safeErrorMessage(error),
      },
      'VISION_REQUEST_FAILED'
    );
  }

  if (annotation?.error?.message) {
    return buildDecision(
      'pending',
      'Tu selfie necesita una revisión adicional antes de activar el paso 2.',
      ['vision_annotation_error'],
      {
        ...buildSummary({
          mimeType,
          buffer,
          imageMeta,
          faceAnnotations: [],
          safeSearchAnnotation: null,
          reviewFlags: ['vision_annotation_error'],
          runtime: 'manual_review_fallback',
        }),
        error: String(annotation.error.message),
      },
      'VISION_ANNOTATION_ERROR'
    );
  }

  const faceAnnotations = Array.isArray(annotation?.faceAnnotations) ? annotation.faceAnnotations : [];
  const safeSearchAnnotation = annotation?.safeSearchAnnotation || null;

  if (faceAnnotations.length === 0) {
    return buildDecision(
      'failed',
      'No detectamos un rostro claro. Reintenta con buena luz y tu cara centrada.',
      ['no_face_detected'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags: ['no_face_detected'],
        runtime: 'google_vision',
      }),
      'NO_FACE_DETECTED'
    );
  }

  if (faceAnnotations.length > 1) {
    return buildDecision(
      'failed',
      'Solo debe aparecer una persona en la imagen. Reintenta tu selfie a solas.',
      ['multiple_faces_detected'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags: ['multiple_faces_detected'],
        runtime: 'google_vision',
      }),
      'MULTIPLE_FACES_DETECTED'
    );
  }

  const primaryFace = faceAnnotations[0];
  const faceAreaRatio = computeFaceAreaRatio(primaryFace, imageMeta);
  const faceConfidence = Number(primaryFace?.detectionConfidence) || 0;
  const landmarkConfidence = Number(primaryFace?.landmarkingConfidence) || 0;
  const blurredScore = getLikelihoodScore(primaryFace?.blurredLikelihood);
  const underExposedScore = getLikelihoodScore(primaryFace?.underExposedLikelihood);
  const violenceScore = getLikelihoodScore(safeSearchAnnotation?.violence);
  const spoofScore = getLikelihoodScore(safeSearchAnnotation?.spoof);

  if (faceAreaRatio != null && faceAreaRatio < thresholds.minFailedFaceAreaRatio) {
    return buildDecision(
      'failed',
      'Tu rostro aparece demasiado lejos. Reintenta acercando más la cara a la cámara.',
      ['face_too_small'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags: ['face_too_small'],
        runtime: 'google_vision',
      }),
      'FACE_TOO_SMALL'
    );
  }

  if (blurredScore >= LIKELIHOOD_SCORES.LIKELY || underExposedScore >= LIKELIHOOD_SCORES.LIKELY) {
    return buildDecision(
      'failed',
      'La imagen no tiene suficiente calidad para validar tu selfie. Reintenta con mejor iluminación y encuadre.',
      ['insufficient_image_quality'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags: ['insufficient_image_quality'],
        runtime: 'google_vision',
      }),
      'INSUFFICIENT_IMAGE_QUALITY'
    );
  }

  if (violenceScore >= LIKELIHOOD_SCORES.LIKELY) {
    return buildDecision(
      'failed',
      'La imagen enviada no es apta para esta verificación. Reintenta con una selfie normal y sin filtros.',
      ['violence_risk'],
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags: ['violence_risk'],
        runtime: 'google_vision',
      }),
      'UNSUPPORTED_CONTENT'
    );
  }

  const reviewFlags = [];

  if (faceConfidence < thresholds.minFaceConfidence) {
    reviewFlags.push('low_face_confidence');
  }
  if (landmarkConfidence < thresholds.minLandmarkConfidence) {
    reviewFlags.push('low_landmark_confidence');
  }
  if (faceAreaRatio == null || faceAreaRatio < thresholds.minAcceptedFaceAreaRatio) {
    reviewFlags.push('face_area_needs_review');
  }
  if (blurredScore >= LIKELIHOOD_SCORES.POSSIBLE) {
    reviewFlags.push('possible_blur');
  }
  if (underExposedScore >= LIKELIHOOD_SCORES.POSSIBLE) {
    reviewFlags.push('possible_low_light');
  }
  if (spoofScore >= LIKELIHOOD_SCORES.POSSIBLE) {
    reviewFlags.push('spoof_risk');
  }

  if (reviewFlags.length > 0) {
    return buildDecision(
      'pending',
      'Tu selfie necesita una revisión adicional antes de activar el paso 2.',
      reviewFlags,
      buildSummary({
        mimeType,
        buffer,
        imageMeta,
        faceAnnotations,
        safeSearchAnnotation,
        reviewFlags,
        runtime: 'manual_review_fallback',
      }),
      'MANUAL_REVIEW_REQUIRED'
    );
  }

  return buildDecision(
    'accepted',
    'Selfie validado automáticamente. Ya puedes continuar con el paso 2.',
    [],
    buildSummary({
      mimeType,
      buffer,
      imageMeta,
      faceAnnotations,
      safeSearchAnnotation,
      reviewFlags: [],
      runtime: 'google_vision',
    }),
    null
  );
}

module.exports = {
  RULESET_VERSION,
  analyzeAccountSelfie,
};