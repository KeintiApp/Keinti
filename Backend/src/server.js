const express = require('express');
const cors = require('cors');
require('./config/env');

const initDatabase = require('./config/initDatabase');
const { startCleanupJob } = require('./services/cleanupService');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const editPostUserRoutes = require('./routes/editPostUser');
const uploadRoutes = require('./routes/upload');
const channelRoutes = require('./routes/channels');
const groupRoutes = require('./routes/groups');
const notificationsRoutes = require('./routes/notifications');
const groupRequestRoutes = require('./routes/groupRequests');
const reportsRoutes = require('./routes/reports');
const accountAuthRoutes = require('./routes/accountAuth');
const adminAccountAuthRoutes = require('./routes/adminAccountAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.get('/', (req, res) => {
  res.json({ 
    message: 'Keinti Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/edit-profile', editPostUserRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/group-requests', groupRequestRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/account-auth', accountAuthRoutes);

// Admin UI (selfie review)
app.use('/admin/account-auth', adminAccountAuthRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// Inicializar base de datos y servidor
async function startServer() {
  try {
    await initDatabase();
    startCleanupJob(); // Iniciar servicio de limpieza
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=================================');
      console.log('🚀 Keinti Backend Started');
      console.log(`📡 Servidor en http://localhost:${PORT}`);
      console.log(`📡 Red local en http://0.0.0.0:${PORT}`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
