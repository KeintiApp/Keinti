const { Client } = require('pg');
require('dotenv').config();

async function createDatabase() {
  // Conectar a la base de datos postgres (existe por defecto)
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Base de datos por defecto
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Verificar si la base de datos ya existe
    const checkDb = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME || 'Keinti']
    );

    if (checkDb.rows.length > 0) {
      console.log(`✅ La base de datos "${process.env.DB_NAME || 'Keinti'}" ya existe`);
    } else {
      // Crear la base de datos
      await client.query(`CREATE DATABASE "${process.env.DB_NAME || 'Keinti'}"`);
      console.log(`✅ Base de datos "${process.env.DB_NAME || 'Keinti'}" creada exitosamente`);
    }
  } catch (error) {
    console.error('❌ Error al crear la base de datos:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createDatabase()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
