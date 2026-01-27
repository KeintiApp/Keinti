const { Client } = require('pg');
require('dotenv').config();

async function createPostsTable() {
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
      CREATE TABLE IF NOT EXISTS Post_users (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
        presentation JSONB NOT NULL,
        intimidades JSONB DEFAULT '[]',
        reactions JSONB DEFAULT '{"selected": [], "counts": {}, "userReaction": null}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL
      );
    `;

        await client.query(createTableQuery);
        console.log('✅ Tabla "Post_users" creada o verificada exitosamente');

                // Compatibilidad: si ya existe sin la columna, la añadimos.
                await client.query(
                    `ALTER TABLE Post_users
                     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;`
                );

    } catch (error) {
        console.error('❌ Error al crear la tabla:', error);
    } finally {
        await client.end();
    }
}

createPostsTable();
