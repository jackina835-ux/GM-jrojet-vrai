const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const publicationRoutes = require('./routes/publicationRoutes');
const storeRoutes = require('./routes/storeRoutes');
const stockRoutes = require('./routes/stockRoutes');
const salesRoutes = require('./routes/salesRoutes');
const orderRoutes = require('./routes/orderRoutes');
const statsRoutes = require('./routes/statsRoutes');
const messageRoutes = require('./routes/messageRoutes');

// Import jobs
const { startExpiryJob } = require('./jobs/expirePublications');
const sequelize = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`📁 Dossier uploads: ${path.join(__dirname, 'uploads')}`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Grand Marché API is running' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Cree la table "messages" si elle n'existe pas encore (CREATE TABLE IF
// NOT EXISTS = sans danger a chaque redemarrage). Evite de dependre d'un
// acces direct a Aiven depuis un poste local pour lancer la migration --
// le script create-messages-table.js reste utilisable a la main aussi.
async function ensureMessagesTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        store_id INT NOT NULL,
        buyer_id INT NOT NULL,
        sender_role ENUM('buyer', 'vendor') NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_conversation (store_id, buyer_id),
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Table "messages" prête');
  } catch (err) {
    console.error('❌ Erreur creation table messages:', err.message);
  }
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📁 Upload path: ${path.join(__dirname, 'uploads')}`);

  // Démarrer le job d'expiration
  startExpiryJob();
  ensureMessagesTable();
});

module.exports = app;