const { Client } = require('pg');
require('dotenv').config();

async function checkUserProfile() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'Keinti',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        await client.connect();
        const res = await client.query("SELECT email, profile_photo_uri FROM users WHERE email = 'a1@gmail.com'");
        console.log('User Profile:', res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUserProfile();
