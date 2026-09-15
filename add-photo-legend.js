// add-photo-legend.js
//
// Ajoute la colonne "legend" (manquante) a la table publication_photos
// deja existante sur Aiven. Les modeles Sequelize ne modifient pas
// automatiquement une table deja creee : il faut executer ce script une
// seule fois.
//
// Usage : node add-photo-legend.js
// (avec les variables DB_* d'Aiven dans le .env)
require('dotenv').config();
const sequelize = require('./config/db');

async function main() {
  const [existing] = await sequelize.query(
    "SHOW COLUMNS FROM publication_photos LIKE 'legend';"
  );

  if (existing.length > 0) {
    console.log('La colonne "legend" existe deja, rien a faire.');
    process.exit(0);
  }

  await sequelize.query(
    'ALTER TABLE publication_photos ADD COLUMN legend VARCHAR(255) NULL AFTER photo;'
  );

  console.log('Colonne "legend" ajoutee avec succes a la table publication_photos.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
