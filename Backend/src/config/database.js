const { Pool } = require('pg');
require('./env');

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const sslFromEnv = parseBool(process.env.DB_SSL);
// Supabase Postgres requires SSL. If DATABASE_URL is used and DB_SSL is not set,
// default to SSL enabled.
const useSsl = sslFromEnv !== null ? sslFromEnv : Boolean(databaseUrl);

console.log(
  `🗄️  DB config: ${databaseUrl ? 'using DATABASE_URL' : 'using DB_HOST/DB_PORT/DB_NAME'}; SSL=${useSsl}`
);

const pool = new Pool({
  ...(databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'Keinti',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }),
  ...(useSsl
    ? {
        // Supabase uses SSL; disable CA validation for simplicity in local dev.
        // If you want stricter validation, provide NODE_EXTRA_CA_CERTS.
        ssl: { rejectUnauthorized: false },
      }
    : {}),
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en PostgreSQL:', err);
  process.exit(-1);
});

module.exports = pool;
