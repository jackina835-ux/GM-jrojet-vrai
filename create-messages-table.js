// create-messages-table.js
//
// Cree la table messages (messagerie directe acheteur <-> vendeur).
// Une conversation = toutes les lignes partageant le meme (store_id,
// buyer_id), triees par date de creation.
//
// Usage : node create-messages-table.js
// (avec les variables DB_* d'Aiven dans le .env)
require('dotenv').config();
const sequelize = require('./config/db');

async function main() {
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

  console.log('Table "messages" creee (ou deja existante) avec succes.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
