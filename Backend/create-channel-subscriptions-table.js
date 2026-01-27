const pool = require('./src/config/database');

async function createChannelSubscriptionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_subscriptions (
        id SERIAL PRIMARY KEY,
        viewer_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        publisher_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(viewer_email, post_id)
      );
    `);
    console.log('✅ Tabla channel_subscriptions creada exitosamente');
  } catch (error) {
    console.error('❌ Error al crear la tabla channel_subscriptions:', error);
  } finally {
    await pool.end();
  }
}

createChannelSubscriptionsTable();
