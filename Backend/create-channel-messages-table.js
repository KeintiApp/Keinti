const { Client } = require('pg');
require('dotenv').config();

async function createChannelMessagesTable() {
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

        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS channel_messages (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES Post_users(id) ON DELETE CASCADE,
        sender_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await client.query(createTableQuery);
        console.log('✅ Tabla "channel_messages" creada o verificada exitosamente');

    } catch (error) {
        console.error('❌ Error al crear la tabla:', error);
    } finally {
        await client.end();
    }
}

createChannelMessagesTable();
