// list-tables.js
//
// Verifie quelles tables existent reellement sur la base Aiven, pour
// diagnostiquer un import incomplet.
//
// Usage : node list-tables.js
// (avec les variables DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL
// d'Aiven dans le fichier .env)
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const [rows] = await connection.query('SHOW TABLES;');
  console.log(`\n📋 ${rows.length} table(s) trouvee(s) dans ${process.env.DB_NAME} :`);
  rows.forEach((row) => {
    console.log(' -', Object.values(row)[0]);
  });

  await connection.end();
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
});
