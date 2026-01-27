const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function removeObsoleteUsersColumns() {
  try {
    console.log('🧹 Eliminando columnas obsoletas de users (si existen)...');

    await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS language;');
    console.log('✅ language eliminada (si existía)');

    await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS phone_number;');
    console.log('✅ phone_number eliminada (si existía)');

    console.log('✅ Migración completada');
  } catch (error) {
    console.error('❌ Error eliminando columnas obsoletas:', error);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

removeObsoleteUsersColumns();
