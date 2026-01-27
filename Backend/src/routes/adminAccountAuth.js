const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/selfies', (req, res) => {
  res
    .status(410)
    .type('html')
    .send(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Keinti · Admin</title></head><body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 20px;">
      <h2>Panel admin (obsoleto)</h2>
      <p>Este endpoint ya no usa <code>ADMIN_TOKEN</code> y no debe usarse en producción.</p>
      <p>Usa los endpoints autenticados:</p>
      <ul>
        <li><code>GET /api/account-auth/admin/pending-selfies</code></li>
        <li><code>POST /api/account-auth/admin/selfie-review</code></li>
        <li><code>GET /api/account-auth/admin/blocked-selfies</code></li>
      </ul>
    </body></html>`);
});

router.get('/api/pending-selfies', async (req, res) => {
  // Deprecated alias. Use /api/account-auth/admin/pending-selfies instead.
  authenticateToken(req, res, () => {
    res.status(410).json({
      error: 'Endpoint obsoleto. Usa /api/account-auth/admin/pending-selfies',
      moved_to: '/api/account-auth/admin/pending-selfies',
    });
  });
});

module.exports = router;
