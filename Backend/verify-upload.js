const axios = require('axios');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET;

async function verifyUpload() {
    try {
        // 1. Generate Token
        const user = { email: 'a1@gmail.com', id: 1 }; // Mock user data
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
        console.log('✅ Token generated');

        // 2. Create dummy image
        const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); // 1x1 GIF

        const form = new FormData();
        form.append('photo', buffer, { filename: 'test-avatar.jpg', contentType: 'image/jpeg' });

        // 3. Upload Image
        console.log('📤 Uploading image...');
        const uploadRes = await axios.post(`${API_URL}/api/users/profile-photo`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        if (uploadRes.status === 200 && uploadRes.data.profile_photo_uri) {
            console.log('✅ Upload successful. URI:', uploadRes.data.profile_photo_uri);

            // 4. Fetch Image
            const imageUri = uploadRes.data.profile_photo_uri;
            console.log(`📥 Fetching image from ${imageUri}...`);

            const imageRes = await axios.get(`${API_URL}${imageUri}`, {
                responseType: 'arraybuffer'
            });

            if (imageRes.status === 200 && imageRes.data.length > 0) {
                console.log('✅ Image fetched successfully. Size:', imageRes.data.length, 'bytes');
                console.log('🎉 VERIFICATION PASSED!');
            } else {
                console.error('❌ Failed to fetch image.');
            }

        } else {
            console.error('❌ Upload failed:', uploadRes.data);
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused. Is the server running?');
        } else {
            console.error('❌ Error:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
        }
    }
}

verifyUpload();
