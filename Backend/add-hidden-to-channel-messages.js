const { Client } = require('pg');
require('dotenv').config();

async function addHiddenToChannelMessages() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'Keinti',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Añadir columna "hidden" a la tabla channel_messages.
    // Por defecto FALSE: todos los mensajes son visibles.
    const alterQuery = `
      ALTER TABLE channel_messages
      ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
    `;

    await client.query(alterQuery);
    console.log('✅ Columna "hidden" añadida a "channel_messages" (o ya existía)');

  } catch (error) {
    console.error('❌ Error al añadir columna hidden:', error);
  } finally {
    await client.end();
  }
}

addHiddenToChannelMessages();
