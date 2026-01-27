const jwt = require('jsonwebtoken');
const { verifySupabaseJwt } = require('../services/supabaseJwtService');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  // 1) Legacy app JWT (current behavior)
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (jwtSecret) {
    try {
      const user = jwt.verify(token, jwtSecret);
      req.user = user;
      // Ensure normalized email field when present.
      if (req.user && req.user.email) {
        req.user.email = String(req.user.email).trim().toLowerCase();
      }
      return next();
    } catch {
      // Fall through to Supabase JWT verification.
    }
  }

  // 2) Supabase Auth JWT (used for OAuth exchange and future migration)
  try {
    const payload = await verifySupabaseJwt(token);
    const email = payload?.email ? String(payload.email).trim().toLowerCase() : '';
    req.user = {
      email,
      sub: payload?.sub ? String(payload.sub) : undefined,
      // keep full payload for advanced flows if needed
      supabase: payload,
    };
    if (!email) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    return next();
  } catch {
    return res.status(403).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticateToken };
