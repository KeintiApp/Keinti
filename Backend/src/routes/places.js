const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getPlacesApiKey() {
  // Prefer a dedicated server-side key; allow legacy env name too.
  return String(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

function getLanguage(req) {
  const raw = String(req.query.language || 'es').trim();
  // Keep it simple: allow short BCP-47 like "es", "es-ES", "en".
  if (!raw) return 'es';
  if (raw.length > 10) return 'es';
  if (!/^[a-z]{2}(-[A-Za-z]{2})?$/.test(raw)) return 'es';
  return raw;
}

router.get('/status', authenticateToken, (req, res) => {
  const configured = !!getPlacesApiKey();
  res.json({ configured });
});

router.get('/autocomplete', authenticateToken, async (req, res) => {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Google Places no está configurado en el backend (GOOGLE_PLACES_API_KEY).' });
  }

  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json({ predictions: [] });

  try {
    const language = getLanguage(req);
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

    const response = await axios.get(url, {
      timeout: 8000,
      params: {
        input: q,
        language,
        key: apiKey,
      },
    });

    const data = response?.data || {};
    const status = String(data.status || '');

    if (status === 'OK') {
      const preds = Array.isArray(data.predictions) ? data.predictions : [];
      const items = preds
        .map((p) => ({
          placeId: String(p?.place_id || ''),
          description: String(p?.description || ''),
        }))
        .filter((p) => p.placeId && p.description)
        .slice(0, 8);

      return res.json({ predictions: items });
    }

    if (status === 'ZERO_RESULTS') {
      return res.json({ predictions: [] });
    }

    return res.status(400).json({
      error: 'Google Places devolvió un error.',
      status,
      errorMessage: data.error_message ? String(data.error_message) : undefined,
    });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar con Google Places.' });
  }
});

router.get('/details', authenticateToken, async (req, res) => {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Google Places no está configurado en el backend (GOOGLE_PLACES_API_KEY).' });
  }

  const placeId = String(req.query.placeId || '').trim();
  if (!placeId) return res.status(400).json({ error: 'placeId requerido' });

  try {
    const language = getLanguage(req);
    const url = 'https://maps.googleapis.com/maps/api/place/details/json';

    const response = await axios.get(url, {
      timeout: 8000,
      params: {
        place_id: placeId,
        fields: 'geometry,name,formatted_address',
        language,
        key: apiKey,
      },
    });

    const data = response?.data || {};
    const status = String(data.status || '');

    if (status !== 'OK') {
      return res.status(400).json({
        error: 'Google Places devolvió un error.',
        status,
        errorMessage: data.error_message ? String(data.error_message) : undefined,
      });
    }

    const loc = data?.result?.geometry?.location;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Ubicación inválida.' });
    }

    const label = String(data?.result?.formatted_address || data?.result?.name || '').trim();

    return res.json({
      placeId,
      label,
      lat,
      lng,
    });
  } catch {
    return res.status(502).json({ error: 'No se pudo contactar con Google Places.' });
  }
});

module.exports = router;
