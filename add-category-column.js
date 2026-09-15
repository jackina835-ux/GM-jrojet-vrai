// add-category-column.js
//
// Ajoute la colonne "category" (manquante) a la table publications deja
// existante sur Aiven. Les modeles Sequelize ne modifient pas
// automatiquement une table deja creee : il faut executer ce script une
// seule fois.
//
// Usage : node add-category-column.js
// (avec les variables DB_* d'Aiven dans le .env)
require('dotenv').config();
const sequelize = require('./config/db');

async function main() {
  const [existing] = await sequelize.query(
    "SHOW COLUMNS FROM publications LIKE 'category';"
  );

  if (existing.length > 0) {
    console.log('La colonne "category" existe deja, rien a faire.');
    process.exit(0);
  }

  await sequelize.query(
    'ALTER TABLE publications ADD COLUMN category VARCHAR(255) NULL AFTER price;'
  );

  console.log('Colonne "category" ajoutee avec succes a la table publications.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
