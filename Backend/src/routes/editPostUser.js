const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Obtener el perfil editado del usuario
router.get('/', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const result = await pool.query(
      'SELECT * FROM Edit_post_user WHERE user_email = $1',
      [userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ presentation: null, intimidades: [] });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener perfil editado:', error);
    res.status(500).json({ error: 'Error al obtener perfil editado' });
  }
});

// Guardar o actualizar el perfil editado
router.post('/', authenticateToken, async (req, res) => {
  const { presentation, intimidades, reactions } = req.body;
  const userEmail = req.user.email;

  try {
    // Verificar si ya existe un registro para este usuario
    const checkResult = await pool.query(
      'SELECT id FROM Edit_post_user WHERE user_email = $1',
      [userEmail]
    );

    if (checkResult.rows.length > 0) {
      // Actualizar
      const updateResult = await pool.query(
        `UPDATE Edit_post_user 
         SET presentation = $1, intimidades = $2, reactions = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_email = $4
         RETURNING *`,
        [JSON.stringify(presentation || {}), JSON.stringify(intimidades || []), JSON.stringify(reactions || { selected: [], counts: {}, userReaction: null }), userEmail]
      );
      res.json(updateResult.rows[0]);
    } else {
      // Insertar
      const insertResult = await pool.query(
        `INSERT INTO Edit_post_user (user_email, presentation, intimidades, reactions)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userEmail, JSON.stringify(presentation || {}), JSON.stringify(intimidades || []), JSON.stringify(reactions || { selected: [], counts: {}, userReaction: null })]
      );
      res.status(201).json(insertResult.rows[0]);
    }
  } catch (error) {
    console.error('Error al guardar perfil editado:', error);
    res.status(500).json({ error: 'Error al guardar perfil editado' });
  }
});

module.exports = router;
