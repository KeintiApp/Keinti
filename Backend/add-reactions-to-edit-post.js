const pool = require('./src/config/database');

async function addReactionsColumn() {
  try {
    await pool.query(`
      ALTER TABLE Edit_post_user 
      ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"selected": [], "counts": {}, "userReaction": null}';
    `);
    console.log('✅ Columna reactions agregada a Edit_post_user');
  } catch (error) {
    console.error('❌ Error al agregar columna reactions:', error);
  } finally {
    // No cerramos el pool aquí si se usa en otro lado, pero como es un script suelto, deberíamos.
    // Sin embargo, pool.end() puede colgar si hay conexiones activas.
    // Dejaremos que el proceso termine.
    process.exit(0);
  }
}

addReactionsColumn();
