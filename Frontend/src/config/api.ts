// Configuración de API
//
// - En desarrollo (Android físico por USB): usa `adb reverse` y apunta siempre a 127.0.0.1.
//   Así evitamos depender de una IP de WiFi (que cambia) y evitamos que se cuele en builds.
// - En release: apunta a tu backend público por HTTPS.

const DEV_API_URL = 'http://127.0.0.1:3000';

// TODO: cambia esto cuando tengas tu backend desplegado (HTTPS) antes de generar el release.
// Ej: https://api.tudominio.com
const PROD_API_URL = 'https://keinti.onrender.com';

export const API_URL = (() => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return DEV_API_URL;
  }
  return PROD_API_URL;
})();

export const getServerResourceUrl = (path: string) => {
  if (!path) return '';

  const raw = String(path);

  // Normalize legacy image-by-id URLs to the stable token endpoint.
  // This makes stored URLs resilient if the backend disables the legacy id route.
  const normalizeLegacyImageUrl = (value: string) => {
    const v = String(value || '').trim();
    if (!v) return v;

    // Absolute URL case
    if (v.startsWith('http://') || v.startsWith('https://')) {
      try {
        const u = new URL(v);
        const m = u.pathname.match(/^\/api\/upload\/image\/(\d+)$/);
        const token = u.searchParams.get('token');
        if (m && token && token.length >= 40) {
          return `${u.origin}/api/upload/image-token/${token}`;
        }
      } catch {
        // ignore and keep original
      }
      return v;
    }

    // Path-only case
    const m = v.match(/^(\/?)api\/upload\/image\/(\d+)\?token=([^&#\s]+)$/i) || v.match(/^\/api\/upload\/image\/(\d+)\?token=([^&#\s]+)$/i);
    if (m) {
      // token is always the last capture group
      const token = m[m.length - 1];
      if (token && String(token).length >= 40) {
        return `/api/upload/image-token/${token}`;
      }
    }

    return v;
  };

  const normalized = normalizeLegacyImageUrl(raw);

  if (normalized.startsWith('http') || normalized.startsWith('file://')) return normalized;
  return `${API_URL}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
};

