const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'Keinti',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function deleteUsers() {
  try {
    console.log('Iniciando eliminación de usuarios...');

    // Emails to delete based on the screenshot
    const emails = ['a1@gmail.com', 'a2@gmail.com'];

    for (const email of emails) {
        console.log(`Procesando usuario: ${email}`);
        
        // 1. Delete from user_avatars first (Foreign Key constraint)
        // Note: The column name in user_avatars referencing users(email) is likely user_email based on the constraint name user_avatars_user_email_fkey
        // But let's verify if I can. The error says "user_avatars_user_email_fkey", usually implies column "user_email".
        
        const resAvatars = await pool.query('DELETE FROM user_avatars WHERE user_email = $1', [email]);
        console.log(`- Eliminados ${resAvatars.rowCount} registros de user_avatars.`);

        // 2. Delete from users
        const resUsers = await pool.query('DELETE FROM users WHERE email = $1', [email]);
        console.log(`- Eliminado usuario de users: ${resUsers.rowCount} registros.`);
    }

    console.log('✅ Usuarios eliminados correctamente.');
  } catch (err) {
    console.error('❌ Error eliminando usuarios:', err);
  } finally {
    await pool.end();
  }
}

deleteUsers();
