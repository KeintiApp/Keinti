const { Client } = require('pg');
require('dotenv').config();

async function createEditPostUserTable() {
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
      CREATE TABLE IF NOT EXISTS Edit_post_user (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) UNIQUE REFERENCES users(email) ON DELETE CASCADE,
        presentation JSONB DEFAULT '{}',
        intimidades JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await client.query(createTableQuery);
        console.log('✅ Tabla "Edit_post_user" creada o verificada exitosamente');

    } catch (error) {
        console.error('❌ Error al crear la tabla:', error);
    } finally {
        await client.end();
    }
}

createEditPostUserTable();
