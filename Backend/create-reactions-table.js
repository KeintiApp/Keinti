const pool = require('./src/config/database');

async function createReactionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_reactions (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_email)
      );
    `);
    console.log('✅ Tabla post_reactions creada');
  } catch (error) {
    console.error('❌ Error al crear tabla post_reactions:', error);
  } finally {
    process.exit(0);
  }
}

createReactionsTable();
