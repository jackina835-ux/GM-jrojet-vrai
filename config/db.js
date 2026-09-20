const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// DB_SSL=true active la connexion chiffree (necessaire pour Aiven et la
// plupart des bases MySQL hebergees en ligne, qui l'exigent). En local
// (MySQL sur ton PC), on ne met pas cette variable et la connexion reste
// simple, comme avant.
const useSSL = process.env.DB_SSL === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    // Les requetes SQL (avec leurs valeurs : hash de mots de passe, emails,
    // messages...) ne sont PLUS journalisees par defaut : les journaux
    // Render les conservent (anomalie S4). Pour deboguer ponctuellement,
    // definir DB_LOGGING=true (a retirer ensuite).
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  }
);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
  }
};

testConnection();

module.exports = sequelize;