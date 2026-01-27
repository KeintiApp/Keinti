const pool = require('./src/config/database');

async function createPollVotesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_poll_votes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        intimidad_index INTEGER NOT NULL,
        option_key VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_email, intimidad_index)
      );
    `);
    console.log('✅ Tabla post_poll_votes creada');
  } catch (error) {
    console.error('❌ Error al crear tabla post_poll_votes:', error);
  } finally {
    process.exit(0);
  }
}

createPollVotesTable();
