// import-db.js
//
// Script d'import ponctuel : envoie le contenu de database.sql vers la
// base MySQL distante (Aiven), en utilisant le driver mysql2 du projet
// au lieu du client mysql.exe fourni par XAMPP -- celui-ci est en realite
// une version MariaDB qui ne supporte pas le plugin d'authentification
// caching_sha2_password utilise par MySQL 8.4 (l'erreur "Plugin
// caching_sha2_password could not be loaded").
//
// Usage :
//   node import-db.js
//
// A lancer une seule fois depuis le dossier grand-marche-backend, avec
// les variables DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
// deja renseignees dans le fichier .env (celles d'Aiven).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const sqlPath = path.join(__dirname, 'database.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Fichier database.sql introuvable dans ce dossier.');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`📡 Connexion a ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} ...`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  console.log('✅ Connecte. Import de database.sql en cours...');

  try {
    await connection.query(sql);
    console.log('🎉 Import termine avec succes !');
  } catch (error) {
    console.error('❌ Erreur pendant l\'import :', error.message);
  } finally {
    await connection.end();
  }
}

main();
