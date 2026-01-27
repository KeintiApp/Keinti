const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixUsersTable() {
  try {
    console.log('🔧 Verificando estructura de la tabla users...');

    // Verificar si la columna password existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password';
    `);

    if (checkColumn.rows.length === 0) {
      console.log('⚠️  Columna password no existe. Agregando...');
      await pool.query(`
        ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT '';
      `);
      console.log('✅ Columna password agregada');
    } else {
      console.log('✅ Columna password ya existe');
    }

    // Verificar otras columnas necesarias
    const columnsToCheck = [
      { name: 'birth_date', type: 'DATE', default: null },
      { name: 'nationality', type: 'VARCHAR(100)', default: null },
      { name: 'profile_photo_uri', type: 'TEXT', default: null },
      { name: 'social_networks', type: 'JSONB', default: "'[]'" },
      { name: 'balance', type: 'INTEGER', default: '0' },
      { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
    ];

    for (const col of columnsToCheck) {
      const checkCol = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1;
      `, [col.name]);

      if (checkCol.rows.length === 0) {
        console.log(`⚠️  Columna ${col.name} no existe. Agregando...`);
        const defaultClause = col.default ? `DEFAULT ${col.default}` : '';
        await pool.query(`
          ALTER TABLE users ADD COLUMN ${col.name} ${col.type} ${defaultClause};
        `);
        console.log(`✅ Columna ${col.name} agregada`);
      }
    }

    console.log('✅ Tabla users corregida exitosamente');
    await pool.end();
  } catch (error) {
    console.error('❌ Error al corregir tabla:', error);
    process.exit(1);
  }
}

fixUsersTable();
