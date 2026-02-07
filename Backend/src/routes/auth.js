const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { deleteObject } = require('../services/supabaseStorageService');
const {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  isSupabaseConfigured,
  isSupabaseAuthConfigured,
} = require('../config/supabase');
const { verifySupabaseJwt } = require('../services/supabaseJwtService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const EMAIL_VERIFICATION_CODE_LENGTH = 8;
const EMAIL_VERIFICATION_TTL_SECONDS = Math.max(60, Number(process.env.EMAIL_VERIFICATION_TTL_SECONDS || 300));
const EMAIL_VERIFICATION_MAX_SENDS = Math.max(1, Number(process.env.EMAIL_VERIFICATION_MAX_SENDS || 2));
const EMAIL_VERIFICATION_MAX_ATTEMPTS = Math.max(1, Number(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || 6));
const EMAIL_VERIFICATION_LOCK_MINUTES = Math.max(1, Number(process.env.EMAIL_VERIFICATION_LOCK_MINUTES || 30));
const EMAIL_VERIFICATION_VERIFIED_TTL_MINUTES = Math.max(
  1,
  Number(process.env.EMAIL_VERIFICATION_VERIFIED_TTL_MINUTES || 10)
);

const PASSWORD_RESET_CODE_LENGTH = 8;
const PASSWORD_RESET_TTL_SECONDS = Math.max(60, Number(process.env.PASSWORD_RESET_TTL_SECONDS || 600));
const PASSWORD_RESET_MAX_SENDS = Math.max(1, Number(process.env.PASSWORD_RESET_MAX_SENDS || 3));
const PASSWORD_RESET_MAX_ATTEMPTS = Math.max(1, Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 6));
const PASSWORD_RESET_LOCK_MINUTES = Math.max(1, Number(process.env.PASSWORD_RESET_LOCK_MINUTES || 30));
const PASSWORD_RESET_TOKEN_TTL_SECONDS = Math.max(60, Number(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS || 900));

function isValidEmailFormat(email) {
  const value = String(email || '').trim();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isAppProfileComplete(userRow) {
  if (!userRow) return false;
  const nationality = String(userRow.nationality || '').trim();
  const birthDate = userRow.birth_date;
  return Boolean(birthDate) && nationality.length > 0;
}

async function ensureSupabaseUserIdMapped(email, supabaseUserId) {
  const e = normalizeEmail(email);
  if (!e || !supabaseUserId) return;
  await pool
    .query(
      `UPDATE users
       SET supabase_user_id = COALESCE(supabase_user_id, $2), updated_at = CURRENT_TIMESTAMP
       WHERE lower(email) = lower($1)`,
      [e, supabaseUserId]
    )
    .catch(() => {});
}

async function findSupabaseUserIdByEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  if (!isSupabaseConfigured()) return null;

  const admin = getSupabaseAdminClient();
  const perPage = 200;
  const maxPages = Math.max(1, Number(process.env.SUPABASE_ADMIN_MAX_USER_PAGES || 20));

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = Array.isArray(data?.users) ? data.users : [];
    for (const u of users) {
      if (normalizeEmail(u?.email) === e) {
        return u?.id ? String(u.id) : null;
      }
    }
    if (users.length < perPage) break;
  }

  return null;
}

function generateEmailVerificationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < EMAIL_VERIFICATION_CODE_LENGTH; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

function generatePasswordResetCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < PASSWORD_RESET_CODE_LENGTH; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

function generatePasswordResetToken() {
  // Token de un solo uso (no es el código que recibe el usuario).
  // Se almacena hashed en BD.
  return crypto.randomBytes(32).toString('base64url');
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code || ''), 'utf8').digest('hex');
}

function getEmailTransporter() {
  const user = String(process.env.EMAIL_VERIFICATION_SMTP_USER || '').trim();
  const pass = String(process.env.EMAIL_VERIFICATION_SMTP_PASS || '').trim();

  if (!user || !pass) {
    const err = new Error('Email verification SMTP not configured');
    err.code = 'EMAIL_SMTP_NOT_CONFIGURED';
    throw err;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendVerificationEmail(toEmail, code) {
  const from = String(process.env.EMAIL_VERIFICATION_SMTP_USER || '').trim();
  const appName = String(process.env.APP_NAME || 'Keinti').trim();
  const ttlMinutes = Math.ceil(EMAIL_VERIFICATION_TTL_SECONDS / 60);

  const transporter = getEmailTransporter();
  const info = await transporter.sendMail({
    from: `${appName} <${from}>`,
    to: toEmail,
    subject: `${appName} - Código de verificación`,
    text: `Tu código de verificación es: ${code}\n\nCaduca en ${ttlMinutes} minutos.`,
  });

  // Nodemailer may resolve even when the SMTP server rejects the recipient.
  // In that case, report a failure so the client can show a friendly message.
  const rejected = Array.isArray(info?.rejected) ? info.rejected.filter(Boolean) : [];
  const accepted = Array.isArray(info?.accepted) ? info.accepted.filter(Boolean) : [];
  if (rejected.length > 0 || accepted.length === 0) {
    const err = new Error('Email recipient rejected');
    err.code = 'EMAIL_RECIPIENT_REJECTED';
    // Keep details for server logs only.
    err.rejected = rejected;
    err.response = info?.response;
    throw err;
  }
}

async function sendPasswordResetEmail(toEmail, code) {
  const from = String(process.env.EMAIL_VERIFICATION_SMTP_USER || '').trim();
  const appName = String(process.env.APP_NAME || 'Keinti').trim();
  const ttlMinutes = Math.ceil(PASSWORD_RESET_TTL_SECONDS / 60);

  const transporter = getEmailTransporter();
  const info = await transporter.sendMail({
    from: `${appName} <${from}>`,
    to: toEmail,
    subject: `${appName} - Código para recuperar tu contraseña`,
    text: `Tu código para recuperar la contraseña es: ${code}\n\nCaduca en ${ttlMinutes} minutos.`,
  });

  const rejected = Array.isArray(info?.rejected) ? info.rejected.filter(Boolean) : [];
  const accepted = Array.isArray(info?.accepted) ? info.accepted.filter(Boolean) : [];
  if (rejected.length > 0 || accepted.length === 0) {
    const err = new Error('Email recipient rejected');
    err.code = 'EMAIL_RECIPIENT_REJECTED';
    err.rejected = rejected;
    err.response = info?.response;
    throw err;
  }
}

function isStrongPassword(pass) {
  const value = String(pass || '');
  if (value.length < 10) return false;
  const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
  return specialCharRegex.test(value);
}

function normalizeBirthDateToIsoDateString(input) {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) {
    const ts = input.getTime();
    if (!Number.isFinite(ts)) return null;
    const yyyy = String(input.getFullYear()).padStart(4, '0');
    const mm = String(input.getMonth() + 1).padStart(2, '0');
    const dd = String(input.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const raw = String(input || '').trim();
  if (!raw) return null;

  // Accept ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Accept DD/MM/YYYY (used by the mobile app UI)
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;

    // Basic calendar validation
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      d.getUTCFullYear() !== yyyy ||
      d.getUTCMonth() !== mm - 1 ||
      d.getUTCDate() !== dd
    ) {
      return null;
    }

    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return null;
}

const ALLOWED_GENDERS = new Set(['Hombre', 'Mujer', 'No especificar']);

function normalizeGender(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Acepta variantes comunes y normaliza a los valores oficiales.
  const lowered = raw.toLowerCase();
  if (lowered === 'hombre' || lowered === 'male') return 'Hombre';
  if (lowered === 'mujer' || lowered === 'female') return 'Mujer';
  if (
    lowered === 'no especificar' ||
    lowered === 'no' ||
    lowered === 'unspecified' ||
    lowered === 'prefer not to say'
  ) {
    return 'No especificar';
  }

  // Si viene exactamente uno de los permitidos (con mayúsculas), lo admitimos.
  if (ALLOWED_GENDERS.has(raw)) return raw;
  return null;
}

// Por defecto: 365 días.
// Se puede sobrescribir con env var (milisegundos) sin tocar código.
const ACCOUNT_VERIFICATION_TTL_MS = Math.max(
  0,
  Number(process.env.ACCOUNT_VERIFICATION_TTL_MS || 365 * 24 * 60 * 60 * 1000)
);

function computeVerificationExpiresAtMs(verifiedAt) {
  if (!verifiedAt) return null;
  const ts = new Date(verifiedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  if (ACCOUNT_VERIFICATION_TTL_MS <= 0) return null;
  return ts + ACCOUNT_VERIFICATION_TTL_MS;
}

async function deleteUploadedImageById(id) {
  const imgId = Number(id);
  if (!Number.isFinite(imgId) || imgId <= 0) return;

  try {
    const row = await pool.query(
      'SELECT storage_bucket, storage_path FROM uploaded_images WHERE id = $1 LIMIT 1',
      [imgId]
    );
    const bucket = row.rows?.[0]?.storage_bucket || null;
    const path = row.rows?.[0]?.storage_path || null;

    await pool.query('DELETE FROM uploaded_images WHERE id = $1', [imgId]).catch(() => {});
    if (bucket && path) {
      await deleteObject({ bucket, path });
    }
  } catch {
    await pool.query('DELETE FROM uploaded_images WHERE id = $1', [imgId]).catch(() => {});
  }
}

async function resetAccountAuthToInitialState(email, selfieImageId) {
  if (!email) return;

  if (selfieImageId) {
    await deleteUploadedImageById(selfieImageId);
  }

  await pool.query(
    `UPDATE account_auth
     SET
       verified = FALSE,
       verified_at = NULL,
       totp_enabled = FALSE,
       totp_enabled_at = NULL,
       totp_secret = NULL,
       selfie_status = 'not_submitted',
       selfie_submitted_at = NULL,
       selfie_reviewed_at = NULL,
       selfie_fail_reason = NULL,
       selfie_image_id = NULL
     WHERE user_email = $1`,
    [email]
  );
}

// Registro de usuario
router.post('/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const birthDate = normalizeBirthDateToIsoDateString(req.body?.birthDate);
  const nationality = String(req.body?.nationality || '').trim();
  const gender = req.body?.gender;

  try {
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
    }
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Nombre de usuario inválido', code: 'INVALID_USERNAME' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Contraseña inválida', code: 'INVALID_PASSWORD' });
    }

    // Requerir verificación de email previa
    const verification = await pool.query(
      `SELECT verified, verified_at
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    const verRow = verification.rows[0] || null;
    const verifiedAt = verRow?.verified_at ? new Date(verRow.verified_at) : null;
    const verifiedRecently =
      verRow?.verified === true &&
      verifiedAt &&
      Number.isFinite(verifiedAt.getTime()) &&
      (Date.now() - verifiedAt.getTime()) <= EMAIL_VERIFICATION_VERIFIED_TTL_MINUTES * 60 * 1000;

    if (!verifiedRecently) {
      return res.status(400).json({
        error: 'Debes verificar tu email antes de registrarte',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Verificar si el email ya existe.
    // Si existe pero está incompleto (placeholder por trigger de Supabase Auth), permitimos completar registro.
    const existingEmail = await pool.query(
      'SELECT email, birth_date, nationality FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );
    const existingUser = existingEmail.rows[0] || null;
    if (existingUser && isAppProfileComplete(existingUser)) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Verificar si el username ya existe
    const existingUsername = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const normalizedGender = normalizeGender(gender) || 'No especificar';

    if (!isSupabaseConfigured() || !isSupabaseAuthConfigured()) {
      return res.status(500).json({
        error: 'Supabase Auth no está configurado',
        code: 'SUPABASE_AUTH_NOT_CONFIGURED',
      });
    }

    // Crear usuario en Supabase Auth. Ya hemos verificado el email por código, así que lo marcamos como confirmado.
    const admin = getSupabaseAdminClient();
    let supabaseUserId = null;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const msg = String(createError.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        // If the user was created previously (e.g. via OAuth), allow completing registration by setting a password.
        const existingSupabaseUserId = await findSupabaseUserIdByEmail(email);
        if (!existingSupabaseUserId) {
          return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const { error: updateError } = await admin.auth.admin.updateUserById(existingSupabaseUserId, {
          password,
          email_confirm: true,
        });

        if (updateError) {
          console.error('Supabase updateUserById error:', updateError);
          return res.status(500).json({ error: 'Error al registrar usuario' });
        }

        supabaseUserId = existingSupabaseUserId;
      } else {
        console.error('Supabase createUser error:', createError);
        return res.status(500).json({ error: 'Error al registrar usuario' });
      }
    } else {
      supabaseUserId = created?.user?.id ? String(created.user.id) : null;
    }

    // Insertar o completar usuario (permite sobrescribir placeholders por trigger de Supabase Auth)
    await pool.query(
      `INSERT INTO users (email, username, password, birth_date, nationality, gender, supabase_user_id)
       VALUES ($1, $2, NULL, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
       SET username = EXCLUDED.username,
           birth_date = EXCLUDED.birth_date,
           nationality = EXCLUDED.nationality,
           gender = EXCLUDED.gender,
           supabase_user_id = COALESCE(EXCLUDED.supabase_user_id, users.supabase_user_id),
           updated_at = CURRENT_TIMESTAMP`,
      [email, username, birthDate, nationality, normalizedGender, supabaseUserId]
    );

    // Limpiar verificación usada
    await pool.query('DELETE FROM email_verification_codes WHERE email = $1', [email]).catch(() => {});

    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Solicitar envío de código de verificación por email
router.post('/email/request-code', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    // Evitar registro si ya existe
    const existingEmail = await pool.query(
      'SELECT email, birth_date, nationality FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );
    const existingUser = existingEmail.rows[0] || null;
    if (existingUser && isAppProfileComplete(existingUser)) {
      return res.status(400).json({ error: 'El email ya está registrado', code: 'EMAIL_ALREADY_REGISTERED' });
    }

    const now = new Date();
    const current = await pool.query(
      `SELECT email, send_count, locked_until, expires_at
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    const row = current.rows[0] || null;
    const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Email bloqueado temporalmente',
        code: 'EMAIL_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
      });
    }

    const sendCount = Number(row?.send_count || 0);
    const expiresAt = row?.expires_at ? new Date(row.expires_at) : null;
    const notExpired = expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
    if (row && notExpired) {
      return res.status(400).json({
        error: 'El código actual aún no ha caducado',
        code: 'CODE_NOT_EXPIRED',
      });
    }

    if (sendCount >= EMAIL_VERIFICATION_MAX_SENDS) {
      return res.status(429).json({
        error: 'Inténtalo más tarde o verifica que el email introducido existe',
        code: 'TOO_MANY_CODE_REQUESTS',
      });
    }

    const code = generateEmailVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAtNew = new Date(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
    const nextSendCount = Math.max(1, sendCount + 1);

    await pool.query(
      `INSERT INTO email_verification_codes (
         email, code_hash, expires_at, send_count, verify_failed_attempts, locked_until, verified, verified_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 0, NULL, FALSE, NULL, $5, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         send_count = EXCLUDED.send_count,
         verify_failed_attempts = 0,
         locked_until = NULL,
         verified = FALSE,
         verified_at = NULL,
         updated_at = EXCLUDED.updated_at`,
      [email, codeHash, expiresAtNew, nextSendCount, now]
    );

    await sendVerificationEmail(email, code);

    return res.json({
      ok: true,
      expiresInSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
      sendCount: nextSendCount,
    });
  } catch (error) {
    console.error('Error requesting email verification code:', error);
    return res.status(500).json({
      error: 'No se pudo enviar el código de verificación. Inténtalo más tarde.',
      code: 'EMAIL_SEND_FAILED',
    });
  }
});

// Comprobar si un email ya está registrado (sin enviar código)
router.get('/email/is-registered', async (req, res) => {
  const email = String(req.query?.email || '').trim();

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    return res.json({ registered: existing.rows.length > 0 });
  } catch (error) {
    console.error('Error checking email registration:', error);
    return res.status(500).json({ error: 'No se pudo comprobar el email', code: 'CHECK_EMAIL_FAILED' });
  }
});

// Comprobar si un username ya está registrado
router.get('/username/is-registered', async (req, res) => {
  const username = String(req.query?.username || '').trim();

  if (!username || username.length < 2) {
    return res.status(400).json({ error: 'Nombre de usuario inválido', code: 'INVALID_USERNAME' });
  }

  try {
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
    return res.json({ registered: existing.rows.length > 0 });
  } catch (error) {
    console.error('Error checking username registration:', error);
    return res.status(500).json({ error: 'No se pudo comprobar el nombre de usuario', code: 'CHECK_USERNAME_FAILED' });
  }
});

// Verificar código recibido por email
router.post('/email/verify-code', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim().toUpperCase();

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }
  if (!code || code.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  try {
    const current = await pool.query(
      `SELECT email, code_hash, expires_at, send_count, verify_failed_attempts, locked_until
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    const row = current.rows[0] || null;
    if (!row) {
      return res.status(400).json({ error: 'No hay un código activo para este email', code: 'NO_ACTIVE_CODE' });
    }

    const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Email bloqueado temporalmente',
        code: 'EMAIL_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
      });
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'El código ha caducado', code: 'CODE_EXPIRED' });
    }

    const expected = String(row.code_hash || '').trim();
    const actual = hashVerificationCode(code);
    const failedAttempts = Number(row.verify_failed_attempts || 0);

    if (!expected || actual !== expected) {
      const nextFailed = failedAttempts + 1;
      const shouldLock = nextFailed >= EMAIL_VERIFICATION_MAX_ATTEMPTS;
      const lockUntil = shouldLock
        ? new Date(Date.now() + EMAIL_VERIFICATION_LOCK_MINUTES * 60 * 1000)
        : null;

      await pool.query(
        `UPDATE email_verification_codes
         SET verify_failed_attempts = $2,
             locked_until = $3,
             updated_at = $4
         WHERE email = $1`,
        [email, nextFailed, lockUntil, new Date()]
      );

      if (shouldLock) {
        return res.status(423).json({
          error: 'Email bloqueado temporalmente',
          code: 'EMAIL_LOCKED',
          lockedUntil: lockUntil.toISOString(),
        });
      }

      return res.status(400).json({
        error: 'Código incorrecto',
        code: 'CODE_INCORRECT',
        remainingAttempts: Math.max(0, EMAIL_VERIFICATION_MAX_ATTEMPTS - nextFailed),
      });
    }

    await pool.query(
      `UPDATE email_verification_codes
       SET verified = TRUE,
           verified_at = $2,
           updated_at = $2
       WHERE email = $1`,
      [email, new Date()]
    );

    return res.json({ ok: true, verified: true });
  } catch (error) {
    console.error('Error verifying email code:', error);
    return res.status(500).json({ error: 'No se pudo verificar el código', code: 'VERIFY_FAILED' });
  }
});

// Cancelar verificación (invalidar código) - usado si el usuario anula el registro.
router.post('/email/cancel', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    await pool.query('DELETE FROM email_verification_codes WHERE email = $1', [email]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error cancelling email verification:', error);
    return res.status(500).json({ error: 'No se pudo cancelar la verificación', code: 'CANCEL_FAILED' });
  }
});

// ---------------------------------------------------------------------------
// Signup-attempt tracking (Supabase Auth flow).
// When the 5-minute confirmation timer expires without the user clicking the
// link, the mobile app calls this endpoint to:
//   1. Record a failed signup attempt for the email.
//   2. Delete the unconfirmed Supabase Auth user so the next signUp() call
//      creates a fresh one.
//   3. Return how many attempts have been used and whether the email is now
//      locked (>= SIGNUP_MAX_ATTEMPTS → 48 h temp lock, 2nd cycle → permanent).
// ---------------------------------------------------------------------------
const SIGNUP_MAX_ATTEMPTS = Math.max(1, Number(process.env.SIGNUP_MAX_ATTEMPTS || 5));
const SIGNUP_LOCK_HOURS = Math.max(1, Number(process.env.SIGNUP_LOCK_HOURS || 48));
const SIGNUP_TIMER_SECONDS = Math.max(60, Number(process.env.SIGNUP_TIMER_SECONDS || 300));

// Lazy-add lock_count column to email_verification_codes (idempotent).
let _lockCountColumnReady = false;
async function ensureLockCountColumn() {
  if (_lockCountColumnReady) return;
  await pool
    .query('ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS lock_count INTEGER DEFAULT 0')
    .catch(() => {});
  _lockCountColumnReady = true;
}

// ---------------------------------------------------------------------------
// Check comprehensive signup status for an email.
// Returns one of: available, registered, pending_confirmation,
//                 expired_unconfirmed, locked_temp, locked_permanent.
// ---------------------------------------------------------------------------
router.get('/signup/check-email-status', async (req, res) => {
  const email = normalizeEmail(req.query?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    await ensureLockCountColumn();

    // 1. Check if user has a fully completed profile → already registered.
    const userResult = await pool.query(
      'SELECT email, birth_date, nationality FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );
    const userRow = userResult.rows[0] || null;
    if (userRow && isAppProfileComplete(userRow)) {
      return res.json({ status: 'registered' });
    }

    // 2. Check lock/attempt state in email_verification_codes.
    const codeResult = await pool.query(
      `SELECT send_count, locked_until, lock_count, expires_at
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );
    const codeRow = codeResult.rows[0] || null;

    if (codeRow) {
      const lockCount = Number(codeRow.lock_count || 0);
      const lockedUntil = codeRow.locked_until ? new Date(codeRow.locked_until) : null;

      // Permanent lock (lock_count >= 2).
      if (lockCount >= 2) {
        return res.json({
          status: 'locked_permanent',
          attemptsUsed: Number(codeRow.send_count || 0),
          maxAttempts: SIGNUP_MAX_ATTEMPTS,
        });
      }

      // Temporary lock still active.
      if (lockedUntil && lockedUntil.getTime() > Date.now()) {
        return res.json({
          status: 'locked_temp',
          attemptsUsed: Number(codeRow.send_count || 0),
          maxAttempts: SIGNUP_MAX_ATTEMPTS,
          lockedUntil: lockedUntil.toISOString(),
        });
      }

      // Active confirmation timer.
      const expiresAt = codeRow.expires_at ? new Date(codeRow.expires_at) : null;
      if (expiresAt && expiresAt.getTime() > Date.now()) {
        const secondsLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
        return res.json({
          status: 'pending_confirmation',
          timerSecondsLeft: secondsLeft,
        });
      }
    }

    // 3. Check Supabase Auth for an unconfirmed user that was never cleaned up.
    if (isSupabaseConfigured() && isSupabaseAuthConfigured()) {
      const supabaseUserId = await findSupabaseUserIdByEmail(email);
      if (supabaseUserId) {
        const admin = getSupabaseAdminClient();
        const { data: userData } = await admin.auth.admin.getUserById(supabaseUserId);

        if (userData?.user && !userData.user.email_confirmed_at) {
          // Unconfirmed user with expired/no timer → clean up.
          try { await admin.auth.admin.deleteUser(supabaseUserId); } catch (e) {
            console.error('Error deleting unconfirmed Supabase user (check-status):', e);
          }
          // Delete the incomplete public.users row created by the trigger.
          if (userRow && !isAppProfileComplete(userRow)) {
            await pool.query('DELETE FROM users WHERE lower(email) = lower($1)', [email]).catch(() => {});
          }
          const attemptsUsed = codeRow ? Number(codeRow.send_count || 0) : 0;
          return res.json({
            status: 'expired_unconfirmed',
            attemptsUsed,
            maxAttempts: SIGNUP_MAX_ATTEMPTS,
          });
        }

        // User confirmed email but profile not complete → treat as registered
        // (they should complete profile via login flow).
        if (userData?.user?.email_confirmed_at) {
          return res.json({ status: 'registered' });
        }
      }
    }

    // 4. Orphan public.users row with no Supabase Auth user → clean up.
    if (userRow && !isAppProfileComplete(userRow)) {
      await pool.query('DELETE FROM users WHERE lower(email) = lower($1)', [email]).catch(() => {});
    }

    return res.json({ status: 'available' });
  } catch (error) {
    console.error('Error checking signup email status:', error);
    return res.status(500).json({
      error: 'No se pudo comprobar el estado del email',
      code: 'CHECK_STATUS_FAILED',
    });
  }
});

// ---------------------------------------------------------------------------
// Record that a signup attempt has started (called right after signUp()).
// Stores expires_at so check-email-status knows the timer is active.
// ---------------------------------------------------------------------------
router.post('/signup/record-attempt', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    await ensureLockCountColumn();
    const now = new Date();
    const expiresAt = new Date(Date.now() + SIGNUP_TIMER_SECONDS * 1000);

    await pool.query(
      `INSERT INTO email_verification_codes
         (email, code_hash, expires_at, send_count, verify_failed_attempts,
          locked_until, lock_count, verified, verified_at, created_at, updated_at)
       VALUES ($1, '', $2, 0, 0, NULL, 0, FALSE, NULL, $3, $3)
       ON CONFLICT (email)
       DO UPDATE SET
         expires_at  = $2,
         verified    = FALSE,
         verified_at = NULL,
         updated_at  = $3`,
      [email, expiresAt, now]
    );

    return res.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Error recording signup attempt:', error);
    return res.status(500).json({
      error: 'Error al registrar el intento',
      code: 'RECORD_ATTEMPT_FAILED',
    });
  }
});

router.post('/signup/cancel-expired', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    await ensureLockCountColumn();
    const now = new Date();

    // Read current attempt state.
    const current = await pool.query(
      `SELECT send_count, locked_until, lock_count
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    const row = current.rows[0] || null;
    const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null;
    const prevLockCount = Number(row?.lock_count || 0);

    // Already permanently locked.
    if (prevLockCount >= 2) {
      return res.status(423).json({
        error: 'Email bloqueado permanentemente',
        code: 'EMAIL_LOCKED_PERMANENT',
        attemptsUsed: Number(row?.send_count || 0),
        maxAttempts: SIGNUP_MAX_ATTEMPTS,
        locked: true,
        lockedPermanent: true,
      });
    }

    // If temporarily locked and lock hasn't expired, reject.
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Email bloqueado temporalmente',
        code: 'EMAIL_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
        attemptsUsed: Number(row?.send_count || 0),
        maxAttempts: SIGNUP_MAX_ATTEMPTS,
        locked: true,
        lockedPermanent: false,
      });
    }

    // If a previous lock has expired, reset the counter (but keep lock_count).
    const prevCount =
      lockedUntil && lockedUntil.getTime() <= Date.now()
        ? 0
        : Number(row?.send_count || 0);

    const nextCount = prevCount + 1;
    const shouldLock = nextCount >= SIGNUP_MAX_ATTEMPTS;

    let newLockedUntil = null;
    let newLockCount = prevLockCount;
    let isPermanent = false;

    if (shouldLock) {
      if (prevLockCount >= 1) {
        // Second lock cycle → permanent.
        newLockedUntil = new Date('9999-12-31T23:59:59.000Z');
        newLockCount = 2;
        isPermanent = true;
      } else {
        // First lock cycle → 48 h temporary.
        newLockedUntil = new Date(Date.now() + SIGNUP_LOCK_HOURS * 60 * 60 * 1000);
        newLockCount = 1;
      }
    }

    // Upsert attempt counter.
    await pool.query(
      `INSERT INTO email_verification_codes
         (email, code_hash, expires_at, send_count, verify_failed_attempts,
          locked_until, lock_count, verified, verified_at, created_at, updated_at)
       VALUES ($1, '', $2, $3, 0, $4, $5, FALSE, NULL, $2, $2)
       ON CONFLICT (email)
       DO UPDATE SET
         send_count   = $3,
         locked_until = $4,
         lock_count   = $5,
         verified     = FALSE,
         verified_at  = NULL,
         updated_at   = $2`,
      [email, now, nextCount, newLockedUntil, newLockCount]
    );

    // Delete the unconfirmed Supabase Auth user so a future signUp() is clean.
    if (isSupabaseConfigured() && isSupabaseAuthConfigured()) {
      try {
        const supabaseUserId = await findSupabaseUserIdByEmail(email);
        if (supabaseUserId) {
          const admin = getSupabaseAdminClient();
          const { data: userData } = await admin.auth.admin.getUserById(supabaseUserId);
          // Only delete if the user never confirmed their email.
          if (userData?.user && !userData.user.email_confirmed_at) {
            await admin.auth.admin.deleteUser(supabaseUserId);
          }
        }
      } catch (err) {
        console.error('Error deleting unconfirmed Supabase user:', err);
      }
    }

    // Also remove the incomplete public.users row created by the Supabase trigger.
    const checkUser = await pool.query(
      'SELECT email, birth_date, nationality FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );
    const existingUser = checkUser.rows[0] || null;
    if (existingUser && !isAppProfileComplete(existingUser)) {
      await pool.query('DELETE FROM users WHERE lower(email) = lower($1)', [email]).catch(() => {});
    }

    return res.json({
      ok: true,
      attemptsUsed: nextCount,
      maxAttempts: SIGNUP_MAX_ATTEMPTS,
      locked: shouldLock,
      lockedPermanent: isPermanent,
      lockedUntil: newLockedUntil ? newLockedUntil.toISOString() : null,
    });
  } catch (error) {
    console.error('Error cancelling expired signup:', error);
    return res.status(500).json({
      error: 'Error al cancelar el registro expirado',
      code: 'CANCEL_EXPIRED_FAILED',
    });
  }
});

// Check signup-attempt status for an email (used before signUp to verify the
// email isn't locked after too many failed attempts).
router.get('/signup/attempts-status', async (req, res) => {
  const email = normalizeEmail(req.query?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    await ensureLockCountColumn();

    const current = await pool.query(
      `SELECT send_count, locked_until, lock_count
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    const row = current.rows[0] || null;
    const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null;
    const lockCount = Number(row?.lock_count || 0);
    const isLocked = Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
    const isPermanent = lockCount >= 2;

    // If a previous lock expired, the counter is effectively reset.
    const count = isLocked
      ? Number(row?.send_count || 0)
      : lockedUntil && lockedUntil.getTime() <= Date.now()
        ? 0
        : Number(row?.send_count || 0);

    return res.json({
      attemptsUsed: count,
      maxAttempts: SIGNUP_MAX_ATTEMPTS,
      locked: isLocked || isPermanent,
      lockedPermanent: isPermanent,
      lockedUntil: isLocked ? lockedUntil.toISOString() : null,
    });
  } catch (error) {
    console.error('Error checking signup attempts status:', error);
    return res.status(500).json({
      error: 'Error al verificar el estado de intentos',
      code: 'CHECK_ATTEMPTS_FAILED',
    });
  }
});

// Enviar rectificación/reclamación si el email está bloqueado temporalmente en el registro.
router.post('/email/rectification', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const message = String(req.body?.message || '').trim();

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }
  if (!message) {
    return res.status(400).json({ error: 'Mensaje inválido', code: 'INVALID_MESSAGE' });
  }
  if (message.length > 220) {
    return res.status(400).json({ error: 'Mensaje demasiado largo', code: 'MESSAGE_TOO_LONG' });
  }

  try {
    // Aceptamos la rectificación siempre que exista contexto de verificación para el email.
    // (El bloqueo puede venir por límite de envíos/expiraciones y no necesariamente por locked_until.)
    const current = await pool.query(
      `SELECT email
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    if (current.rows.length === 0) {
      return res.status(400).json({
        error: 'No hay un proceso de verificación activo para este email',
        code: 'NO_ACTIVE_VERIFICATION',
      });
    }

    await pool.query(
      `INSERT INTO email_verification_rectifications (email, message)
       VALUES ($1, $2)`,
      [email, message]
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Error creating email rectification:', error);
    return res.status(500).json({ error: 'No se pudo enviar la rectificación', code: 'RECTIFICATION_FAILED' });
  }
});

// Recuperación de contraseña
router.post('/password-reset/request-code', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }

  try {
    // Debe existir
    const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'El email no está registrado', code: 'EMAIL_NOT_REGISTERED' });
    }

    const now = new Date();
    const current = await pool.query(
      `SELECT email, send_count, locked_until, expires_at
       FROM password_reset_codes
       WHERE lower(email) = lower($1)` ,
      [email]
    );

    const row = current.rows[0] || null;
    const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Email bloqueado temporalmente',
        code: 'EMAIL_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
      });
    }

    const sendCount = Number(row?.send_count || 0);
    const expiresAt = row?.expires_at ? new Date(row.expires_at) : null;
    const notExpired = expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
    if (row && notExpired) {
      return res.status(400).json({
        error: 'El código actual aún no ha caducado',
        code: 'CODE_NOT_EXPIRED',
      });
    }

    if (sendCount >= PASSWORD_RESET_MAX_SENDS) {
      return res.status(429).json({
        error: 'Inténtalo más tarde',
        code: 'TOO_MANY_CODE_REQUESTS',
      });
    }

    const code = generatePasswordResetCode();
    const codeHash = hashVerificationCode(code);
    const expiresAtNew = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);
    const nextSendCount = Math.max(1, sendCount + 1);

    await pool.query(
      `INSERT INTO password_reset_codes (
         email, code_hash, expires_at, send_count, verify_failed_attempts, locked_until,
         verified, verified_at, reset_token_hash, reset_token_expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 0, NULL, FALSE, NULL, NULL, NULL, $5, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         send_count = EXCLUDED.send_count,
         verify_failed_attempts = 0,
         locked_until = NULL,
         verified = FALSE,
         verified_at = NULL,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = EXCLUDED.updated_at`,
      [email, codeHash, expiresAtNew, nextSendCount, now]
    );

    await sendPasswordResetEmail(email, code);

    return res.json({
      ok: true,
      expiresInSeconds: PASSWORD_RESET_TTL_SECONDS,
      sendCount: nextSendCount,
    });
  } catch (error) {
    console.error('Error requesting password reset code:', error);
    return res.status(500).json({
      error: 'No se pudo enviar el código. Inténtalo más tarde.',
      code: 'EMAIL_SEND_FAILED',
    });
  }
});

router.post('/password-reset/verify-code', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim().toUpperCase();

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }
  if (!code || code.length !== PASSWORD_RESET_CODE_LENGTH) {
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  try {
    const current = await pool.query(
      `SELECT email, code_hash, expires_at, send_count, verify_failed_attempts, locked_until
       FROM password_reset_codes
       WHERE lower(email) = lower($1)` ,
      [email]
    );

    const row = current.rows[0] || null;
    if (!row) {
      return res.status(400).json({ error: 'No hay un código activo para este email', code: 'NO_ACTIVE_CODE' });
    }

    const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Email bloqueado temporalmente',
        code: 'EMAIL_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
      });
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'El código ha caducado', code: 'CODE_EXPIRED' });
    }

    const expected = String(row.code_hash || '').trim();
    const actual = hashVerificationCode(code);
    const failedAttempts = Number(row.verify_failed_attempts || 0);

    if (!expected || actual !== expected) {
      const nextFailed = failedAttempts + 1;
      const shouldLock = nextFailed >= PASSWORD_RESET_MAX_ATTEMPTS;
      const lockUntil = shouldLock
        ? new Date(Date.now() + PASSWORD_RESET_LOCK_MINUTES * 60 * 1000)
        : null;

      await pool.query(
        `UPDATE password_reset_codes
         SET verify_failed_attempts = $2,
             locked_until = $3,
             updated_at = $4
         WHERE lower(email) = lower($1)`,
        [email, nextFailed, lockUntil, new Date()]
      );

      if (shouldLock) {
        return res.status(423).json({
          error: 'Email bloqueado temporalmente',
          code: 'EMAIL_LOCKED',
          lockedUntil: lockUntil.toISOString(),
        });
      }

      return res.status(400).json({
        error: 'Código incorrecto',
        code: 'CODE_INCORRECT',
        remainingAttempts: Math.max(0, PASSWORD_RESET_MAX_ATTEMPTS - nextFailed),
      });
    }

    const resetToken = generatePasswordResetToken();
    const resetTokenHash = hashVerificationCode(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);
    const now = new Date();

    await pool.query(
      `UPDATE password_reset_codes
       SET verified = TRUE,
           verified_at = $2,
           reset_token_hash = $3,
           reset_token_expires_at = $4,
           updated_at = $2
       WHERE lower(email) = lower($1)`,
      [email, now, resetTokenHash, resetTokenExpiresAt]
    );

    return res.json({
      ok: true,
      verified: true,
      resetToken,
      resetTokenExpiresInSeconds: PASSWORD_RESET_TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Error verifying password reset code:', error);
    return res.status(500).json({ error: 'No se pudo verificar el código', code: 'VERIFY_FAILED' });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
  }
  if (!resetToken) {
    return res.status(400).json({ error: 'Token inválido', code: 'INVALID_RESET_TOKEN' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'Contraseña inválida', code: 'INVALID_PASSWORD' });
  }

  try {
    const tokenHash = hashVerificationCode(resetToken);
    const rowRes = await pool.query(
      `SELECT reset_token_hash, reset_token_expires_at
       FROM password_reset_codes
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const row = rowRes.rows[0] || null;
    const expected = String(row?.reset_token_hash || '').trim();
    const expiresAt = row?.reset_token_expires_at ? new Date(row.reset_token_expires_at) : null;

    if (!expected || expected !== tokenHash) {
      return res.status(400).json({ error: 'Token inválido', code: 'INVALID_RESET_TOKEN' });
    }
    if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Token caducado', code: 'RESET_TOKEN_EXPIRED' });
    }

    const now = new Date();

    // Prefer updating Supabase Auth password when possible.
    let supabaseUserId = null;
    const mapping = await pool
      .query('SELECT supabase_user_id FROM users WHERE lower(email) = lower($1) LIMIT 1', [email])
      .catch(() => null);
    supabaseUserId = mapping?.rows?.[0]?.supabase_user_id ? String(mapping.rows[0].supabase_user_id) : null;

    if (!supabaseUserId) {
      supabaseUserId = await findSupabaseUserIdByEmail(email);
      if (supabaseUserId) {
        await ensureSupabaseUserIdMapped(email, supabaseUserId);
      }
    }

    if (supabaseUserId && isSupabaseConfigured()) {
      const admin = getSupabaseAdminClient();
      const { error: updateError } = await admin.auth.admin.updateUserById(supabaseUserId, { password: newPassword });
      if (!updateError) {
        await pool
          .query(
            `UPDATE users
             SET password = NULL,
                 account_locked = FALSE,
                 password_check_failed_attempts = 0,
                 password_check_lock_until = NULL,
                 updated_at = $2
             WHERE lower(email) = lower($1)`,
            [email, now]
          )
          .catch(() => {});

        await pool.query('DELETE FROM password_reset_codes WHERE lower(email) = lower($1)', [email]).catch(() => {});
        return res.json({ ok: true });
      }

      console.error('Supabase updateUserById error:', updateError);
      // Fall back to legacy local update.
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password = $2,
           account_locked = FALSE,
           password_check_failed_attempts = 0,
           password_check_lock_until = NULL,
           updated_at = $3
       WHERE lower(email) = lower($1)`,
      [email, hashedPassword, now]
    );

    await pool.query('DELETE FROM password_reset_codes WHERE lower(email) = lower($1)', [email]).catch(() => {});

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error confirming password reset:', error);
    return res.status(500).json({ error: 'No se pudo cambiar la contraseña', code: 'RESET_FAILED' });
  }
});

// Exchange a Supabase access token (e.g. after OAuth) for the app's JWT.
router.post('/session/exchange', async (req, res) => {
  const accessToken = String(req.body?.access_token || '').trim();
  if (!accessToken) {
    return res.status(400).json({ error: 'access_token requerido', code: 'MISSING_TOKEN' });
  }

  try {
    const payload = await verifySupabaseJwt(accessToken);
    const email = payload?.email ? normalizeEmail(payload.email) : '';
    const sub = payload?.sub ? String(payload.sub) : null;
    const provider = String(payload?.app_metadata?.provider || '').trim().toLowerCase();
    const shouldCleanupOauthUser = provider && provider !== 'email';

    if (!email) {
      return res.status(403).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
    }

    const result = await pool.query(
      `SELECT
         u.*,
         COALESCE(aa.verified, FALSE) AS account_verified,
         aa.verified_at AS account_verified_at,
         aa.selfie_image_id AS account_selfie_image_id
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE lower(u.email) = lower($1)
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      // IMPORTANT:
      // Supabase OAuth will create an Auth user on first sign-in.
      // Keinti requires users to complete the in-app registration/profile first.
      // If the profile doesn't exist in our DB, delete the Supabase Auth user to
      // avoid "auto-registration" via OAuth.
      if (shouldCleanupOauthUser && sub && isSupabaseConfigured()) {
        try {
          const admin = getSupabaseAdminClient();
          await admin.auth.admin.deleteUser(String(sub));
        } catch (e) {
          console.warn('[auth/session-exchange] Failed to delete Supabase user for PROFILE_NOT_FOUND:', e);
        }
      }
      return res.status(404).json({ error: 'Perfil no encontrado. Completa el registro.', code: 'PROFILE_NOT_FOUND' });
    }

    if (sub) {
      await ensureSupabaseUserIdMapped(email, sub);
    }

    const user = result.rows[0];

    // If the row exists but the profile is incomplete (common when a Supabase Auth trigger
    // inserted a placeholder public.users row on first OAuth sign-in), do NOT allow login.
    if (!isAppProfileComplete(user)) {
      if (shouldCleanupOauthUser) {
        await pool.query('DELETE FROM account_auth WHERE lower(user_email) = lower($1)', [email]).catch(() => {});
        await pool.query('DELETE FROM users WHERE lower(email) = lower($1)', [email]).catch(() => {});

        if (sub && isSupabaseConfigured()) {
          try {
            const admin = getSupabaseAdminClient();
            await admin.auth.admin.deleteUser(String(sub));
          } catch (e) {
            console.warn('[auth/session-exchange] Failed to delete Supabase user for incomplete profile:', e);
          }
        }
      }

      return res.status(404).json({ error: 'Perfil no encontrado. Completa el registro.', code: 'PROFILE_NOT_FOUND' });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        email: user.email,
        username: user.username,
        profile_photo_uri: user.profile_photo_uri,
        social_networks: user.social_networks || [],
        balance: user.balance || 0,
        nationality: user.nationality,
        preferred_language: (user.preferred_language || 'es').toString().trim() || 'es',
        account_verified: user.account_verified === true,
      },
    });
  } catch (error) {
    console.error('Error exchanging Supabase session:', error);
    return res.status(403).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
  }
});

// Complete or update the public profile after authenticating with Supabase Auth.
// This is used by the mobile app after email OTP signup or password signup.
router.post('/profile/complete', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user?.email);
  const supabaseUserId = req.user?.sub ? String(req.user.sub) : null;

  const username = String(req.body?.username || '').trim();
  const birthDate = normalizeBirthDateToIsoDateString(req.body?.birthDate);
  const nationality = String(req.body?.nationality || '').trim();
  const gender = req.body?.gender;
  const preferredLanguage = String(req.body?.preferred_language || req.body?.preferredLanguage || '').trim();

  try {
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ error: 'Email inválido', code: 'INVALID_EMAIL' });
    }
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Nombre de usuario inválido', code: 'INVALID_USERNAME' });
    }

    // Ensure username unique (case-sensitive like previous behavior)
    const existingUsername = await pool.query(
      'SELECT email FROM users WHERE username = $1 AND lower(email) <> lower($2) LIMIT 1',
      [username, email]
    );
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso', code: 'USERNAME_TAKEN' });
    }

    const normalizedGender = normalizeGender(gender) || 'No especificar';
    const normalizedPreferredLanguage = ['es', 'en'].includes(preferredLanguage.toLowerCase())
      ? preferredLanguage.toLowerCase()
      : null;

    // Upsert profile.
    await pool.query('BEGIN');

    const existingUser = await pool.query('SELECT email FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    if (existingUser.rows.length > 0) {
      await pool.query(
        `UPDATE users
         SET
           username = $2,
           birth_date = $3,
           nationality = $4,
           gender = $5,
           preferred_language = COALESCE($6, preferred_language),
           supabase_user_id = COALESCE($7, supabase_user_id),
           updated_at = CURRENT_TIMESTAMP
         WHERE lower(email) = lower($1)`,
        [email, username, birthDate, nationality, normalizedGender, normalizedPreferredLanguage, supabaseUserId]
      );
    } else {
      await pool.query(
        `INSERT INTO users (email, username, password, birth_date, nationality, gender, preferred_language, supabase_user_id)
         VALUES ($1, $2, NULL, $3, $4, $5, COALESCE($6, 'es'), $7)`,
        [email, username, birthDate, nationality, normalizedGender, normalizedPreferredLanguage, supabaseUserId]
      );
    }

    // Ensure account_auth row exists.
    await pool.query('INSERT INTO account_auth (user_email) VALUES ($1) ON CONFLICT (user_email) DO NOTHING', [email]);

    await pool.query('COMMIT');

    const result = await pool.query(
      `SELECT
         u.*,
         COALESCE(aa.verified, FALSE) AS account_verified,
         aa.verified_at AS account_verified_at,
         aa.selfie_image_id AS account_selfie_image_id
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE lower(u.email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        email: user.email,
        username: user.username,
        profile_photo_uri: user.profile_photo_uri,
        social_networks: user.social_networks || [],
        balance: user.balance || 0,
        nationality: user.nationality,
        preferred_language: (user.preferred_language || 'es').toString().trim() || 'es',
        account_verified: user.account_verified === true,
      },
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Error completing profile:', error);
    return res.status(500).json({ error: 'No se pudo completar el perfil', code: 'PROFILE_COMPLETE_FAILED' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  try {
    if (!isValidEmailFormat(email) || !password) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Buscar usuario (perfil local)
    const result = await pool.query(
      `SELECT
         u.*,
         COALESCE(aa.verified, FALSE) AS account_verified,
         aa.verified_at AS account_verified_at,
         aa.selfie_image_id AS account_selfie_image_id
       FROM users u
       LEFT JOIN account_auth aa ON aa.user_email = u.email
       WHERE lower(u.email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0] || null;

    // Si la insignia está caducada, revierte el estado de autenticación.
    // (Así no se muestra la insignia al iniciar sesión.)
    const verifiedAt = user?.verified_at || user?.account_verified_at || null;
    const selfieImageId = user?.selfie_image_id || user?.account_selfie_image_id || null;
    const expiresAtMs = user.account_verified === true ? computeVerificationExpiresAtMs(verifiedAt) : null;
    if (user.account_verified === true && expiresAtMs && Date.now() >= expiresAtMs) {
      await resetAccountAuthToInitialState(user.email, selfieImageId);
      user.account_verified = false;
    }

    if (user.account_locked === true) {
      return res.status(403).json({ error: 'Cuenta bloqueada. Debes cambiar la contraseña para volver a iniciar sesión.' });
    }

    // Bloqueo por moderación (denuncias)
    if (user.moderation_blocked === true) {
      const until = user.moderation_block_until ? new Date(user.moderation_block_until) : null;
      const isExpired = until ? until.getTime() <= Date.now() : false;

      if (!isExpired) {
        if (String(user.moderation_block_type || '').toLowerCase() === 'permanent') {
          return res.status(403).json({
            error: 'Cuenta bloqueada permanentemente por moderación. Esta medida no admite apelación.',
          });
        }

        return res.status(403).json({
          error: 'Cuenta bloqueada temporalmente por moderación. Si crees que es un error, puedes apelar en supportkeinti@gmail.com.',
        });
      }
    }

    // 1) Prefer Supabase Auth password verification
    let supabasePasswordOk = false;
    let supabaseUserId = null;

    if (isSupabaseAuthConfigured()) {
      const supabaseAnon = getSupabaseAnonClient();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (!error && data?.user?.id) {
        supabasePasswordOk = true;
        supabaseUserId = String(data.user.id);
      } else if (error) {
        // Keep details server-side for diagnostics.
        console.warn('Supabase signInWithPassword failed:', {
          email,
          message: error?.message,
          status: error?.status,
          name: error?.name,
        });
      }
    } else {
      // If the user has no local password (Supabase-managed) but server isn't configured
      // to verify passwords with Supabase, return a clearer configuration error.
      if (user && !user.password) {
        return res.status(500).json({
          error: 'El servidor no está configurado para autenticar con Supabase (falta SUPABASE_ANON_KEY).',
          code: 'SUPABASE_AUTH_NOT_CONFIGURED',
        });
      }
    }

    // If Supabase verified the password, the profile must exist.
    if (supabasePasswordOk && !user) {
      return res.status(404).json({
        error: 'Perfil no encontrado. Completa el registro.',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // If we don't even have a profile, we can safely stop here.
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 2) Legacy fallback and best-effort migration
    if (!supabasePasswordOk) {
      const localHash = user.password ? String(user.password) : '';
      if (!localHash) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const validPassword = await bcrypt.compare(password, localHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      // If Supabase Auth is configured, migrate this user on first successful legacy login.
      if (isSupabaseConfigured() && isSupabaseAuthConfigured()) {
        const admin = getSupabaseAdminClient();

        await admin.auth.admin
          .createUser({ email, password, email_confirm: true })
          .catch(() => {});

        const supabaseAnon = getSupabaseAnonClient();
        const { data: migrated, error: migratedError } = await supabaseAnon.auth.signInWithPassword({ email, password });
        if (!migratedError && migrated?.user?.id) {
          supabasePasswordOk = true;
          supabaseUserId = String(migrated.user.id);

          await pool.query('UPDATE users SET password = NULL WHERE lower(email) = lower($1)', [email]).catch(() => {});
        }
      }
    }

    if (supabaseUserId) {
      await ensureSupabaseUserIdMapped(email, supabaseUserId);
    }

    // Generar token JWT
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Devolver datos del usuario (sin la contraseña)
    res.json({
      token,
      user: {
        email: user.email,
        username: user.username,
        profile_photo_uri: user.profile_photo_uri,
        social_networks: user.social_networks || [],
        balance: user.balance || 0,
        nationality: user.nationality,
        preferred_language: (user.preferred_language || 'es').toString().trim() || 'es',
        account_verified: user.account_verified === true,
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
