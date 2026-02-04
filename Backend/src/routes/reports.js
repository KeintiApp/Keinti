const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const REPORT_REASONS = [
  'Contenido sexual o desnudos',
  'Acoso o bullying',
  'Lenguaje ofensivo',
  'Estafa o engaño',
  'Violencia o amenazas',
  'Spam',
  'Suplantación de identidad',
  'Contenido ilegal',
  'Abuso/sexualización infantil',
  'Incitación al uso de armas/drogas',
  'Conducta inapropiada',
  'Otros',
];

const normalizeUsernameWithAt = (raw) => {
  const u = String(raw || '').trim();
  if (!u) return '@usuario';
  return u.startsWith('@') ? u : `@${u}`;
};

router.post('/', authenticateToken, async (req, res) => {
  const reporterEmail = req.user?.email;
  const { targetEmail, email, reportedEmail, reason, postId } = req.body || {};

  const normalizedTargetEmail = String(targetEmail || email || reportedEmail || '').trim();
  const normalizedReason = String(reason || '').trim();
  const normalizedPostId = postId === undefined || postId === null || postId === '' ? null : Number(postId);

  if (!reporterEmail) {
    return res.status(401).json({ error: 'Sesión requerida' });
  }

  if (!normalizedTargetEmail) {
    return res.status(400).json({ error: 'Usuario denunciado inválido' });
  }

  if (!REPORT_REASONS.includes(normalizedReason)) {
    return res.status(400).json({ error: 'Motivo de denuncia inválido' });
  }

  if (normalizedPostId !== null && Number.isNaN(normalizedPostId)) {
    return res.status(400).json({ error: 'postId inválido' });
  }

  try {
    const reporterResult = await pool.query('SELECT username FROM users WHERE email = $1', [reporterEmail]);
    if (reporterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario denunciante no encontrado' });
    }

    const reportedResult = await pool.query('SELECT username FROM users WHERE email = $1', [normalizedTargetEmail]);
    if (reportedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario denunciado no encontrado' });
    }

    const reporterUsername = normalizeUsernameWithAt(reporterResult.rows[0].username);
    const reportedUsername = normalizeUsernameWithAt(reportedResult.rows[0].username);

    await pool.query(
      `INSERT INTO user_reports (reporter_email, reporter_username, reported_email, reported_username, post_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reporterEmail, reporterUsername, normalizedTargetEmail, reportedUsername, normalizedPostId, normalizedReason]
    );

    const agg = await pool.query(
      `SELECT
         COUNT(*)::int AS total_reports,
         COUNT(DISTINCT reporter_email)::int AS distinct_reporters
       FROM user_reports
       WHERE reported_email = $1 AND reason = $2`,
      [normalizedTargetEmail, normalizedReason]
    );

    const totalReports = agg.rows[0]?.total_reports ?? 0;
    const distinctReporters = agg.rows[0]?.distinct_reporters ?? 0;
    const classification = distinctReporters >= 2 ? 'reiterant' : 'spontaneous';

    // Escalado (conservador): 3 denunciantes distintos => bloqueo temporal; 5 => permanente
    let moderationAction = null;
    if (distinctReporters >= 5) {
      await pool.query(
        `UPDATE users
         SET moderation_blocked = TRUE,
             moderation_block_type = 'permanent',
             moderation_block_until = NULL,
             moderation_block_reason = $2,
             moderation_blocked_at = CURRENT_TIMESTAMP
         WHERE email = $1`,
        [normalizedTargetEmail, `Denuncias reiteradas (${normalizedReason})`]
      );
      moderationAction = { type: 'permanent' };
    } else if (distinctReporters >= 3) {
      await pool.query(
        `UPDATE users
         SET moderation_blocked = TRUE,
             moderation_block_type = 'temporary',
             moderation_block_until = (CURRENT_TIMESTAMP + INTERVAL '7 days'),
             moderation_block_reason = $2,
             moderation_blocked_at = CURRENT_TIMESTAMP
         WHERE email = $1`,
        [normalizedTargetEmail, `Denuncias reiteradas (${normalizedReason})`]
      );
      moderationAction = { type: 'temporary', untilDays: 7 };
    }

    res.status(201).json({
      ok: true,
      classification,
      totalReports,
      distinctReporters,
      moderationAction,
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Error al crear denuncia' });
  }
});

module.exports = router;
