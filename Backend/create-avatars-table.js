const { Client } = require('pg');
require('dotenv').config();

async function createAvatarsTable() {
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
      CREATE TABLE IF NOT EXISTS user_avatars (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) REFERENCES users(email),
        image_data BYTEA NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await client.query(createTableQuery);
        console.log('✅ Tabla "user_avatars" creada o verificada exitosamente');

    } catch (error) {
        console.error('❌ Error al crear la tabla:', error);
    } finally {
        await client.end();
    }
}

createAvatarsTable();
