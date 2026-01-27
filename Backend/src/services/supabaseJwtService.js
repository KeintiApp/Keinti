const { createRemoteJWKSet, jwtVerify } = require('jose');

let jwks = null;

function getSupabaseIssuer() {
  const raw = String(process.env.SUPABASE_URL || '').trim();
  if (!raw) return null;
  return `${raw.replace(/\/+$/, '')}/auth/v1`;
}

function getSupabaseAudience() {
  return String(process.env.SUPABASE_JWT_AUDIENCE || 'authenticated').trim() || 'authenticated';
}

function getRemoteJwks() {
  if (jwks) return jwks;

  const issuer = getSupabaseIssuer();
  if (!issuer) return null;

  const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);
  jwks = createRemoteJWKSet(jwksUrl);
  return jwks;
}

async function verifySupabaseJwt(token) {
  const t = String(token || '').trim();
  if (!t) {
    const e = new Error('Missing token');
    e.code = 'MISSING_TOKEN';
    throw e;
  }

  const issuer = getSupabaseIssuer();
  const audience = getSupabaseAudience();
  const remoteJwks = getRemoteJwks();

  if (!issuer || !remoteJwks) {
    const e = new Error('Supabase JWT verification not configured');
    e.code = 'SUPABASE_JWT_NOT_CONFIGURED';
    throw e;
  }

  const { payload } = await jwtVerify(t, remoteJwks, {
    issuer,
    audience,
  });

  return payload;
}

module.exports = {
  getSupabaseIssuer,
  getSupabaseAudience,
  verifySupabaseJwt,
};
