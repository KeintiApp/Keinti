const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/aacp': 'audio/aac',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-pn-wav': 'audio/wav',
};

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
]);

const HEIF_FAMILY_MIME_TYPES = new Set(['image/heic', 'image/heif']);

function normalizeMimeType(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  return MIME_ALIASES[normalized] || normalized;
}

function readAscii(buffer, start, end) {
  return buffer.subarray(start, end).toString('ascii');
}

function detectRasterImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (readAscii(buffer, 0, 4) === 'RIFF' && readAscii(buffer, 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  if (readAscii(buffer, 4, 8) === 'ftyp') {
    const brand = readAscii(buffer, 8, 12).toLowerCase();
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
      return 'image/heic';
    }

    if (brand === 'mif1' || brand === 'msf1') {
      return 'image/heif';
    }
  }

  return null;
}

function isEquivalentImageMimeType(clientMimeType, detectedMimeType) {
  if (!clientMimeType || !detectedMimeType) {
    return false;
  }

  if (clientMimeType === detectedMimeType) {
    return true;
  }

  return HEIF_FAMILY_MIME_TYPES.has(clientMimeType) && HEIF_FAMILY_MIME_TYPES.has(detectedMimeType);
}

function validateUploadedFile(file, options = {}) {
  const allowAudio = options.allowAudio === true;
  const clientMimeType = normalizeMimeType(file?.mimetype);
  const buffer = file?.buffer;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, status: 400, error: allowAudio ? 'Archivo inválido' : 'Imagen inválida' };
  }

  const detectedImageMimeType = detectRasterImageMimeType(buffer);
  if (detectedImageMimeType) {
    if (clientMimeType && !isEquivalentImageMimeType(clientMimeType, detectedImageMimeType)) {
      return { ok: false, status: 400, error: 'Formato de imagen no permitido' };
    }

    return {
      ok: true,
      kind: 'image',
      mimeType: HEIF_FAMILY_MIME_TYPES.has(clientMimeType) ? clientMimeType : detectedImageMimeType,
    };
  }

  if (allowAudio && ALLOWED_AUDIO_MIME_TYPES.has(clientMimeType)) {
    return { ok: true, kind: 'audio', mimeType: clientMimeType };
  }

  return { ok: false, status: 400, error: allowAudio ? 'Formato de archivo no permitido' : 'Formato de imagen no permitido' };
}

module.exports = {
  validateUploadedFile,
};