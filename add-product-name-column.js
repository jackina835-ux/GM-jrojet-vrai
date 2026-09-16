// add-product-name-column.js
//
// Ajoute la colonne "product_name" (manquante) a la table publications
// deja existante sur Aiven : nom court du produit, distinct de "legend"
// (description longue). Les modeles Sequelize ne modifient pas
// automatiquement une table deja creee : il faut executer ce script une
// seule fois.
//
// Usage : node add-product-name-column.js
// (avec les variables DB_* d'Aiven dans le .env)
require('dotenv').config();
const sequelize = require('./config/db');

async function main() {
  const [existing] = await sequelize.query(
    "SHOW COLUMNS FROM publications LIKE 'product_name';"
  );

  if (existing.length > 0) {
    console.log('La colonne "product_name" existe deja, rien a faire.');
    process.exit(0);
  }

  await sequelize.query(
    'ALTER TABLE publications ADD COLUMN product_name VARCHAR(255) NULL AFTER store_id;'
  );

  console.log('Colonne "product_name" ajoutee avec succes a la table publications.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
