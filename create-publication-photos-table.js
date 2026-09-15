// create-publication-photos-table.js
//
// Cree la nouvelle table publication_photos sur Aiven (photos
// supplementaires d'une publication, en plus de la photo de couverture
// deja existante sur publications.photo).
//
// Usage : node create-publication-photos-table.js
// (avec les variables DB_* d'Aiven dans le .env)
require('dotenv').config();
const sequelize = require('./config/db');

async function main() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS publication_photos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      publication_id INT NOT NULL,
      photo VARCHAR(255) NOT NULL,
      position INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );
  `);

  console.log('Table "publication_photos" creee (ou deja existante) avec succes.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
