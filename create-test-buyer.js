// create-test-buyer.js
//
// Cree un compte acheteur de test DIRECTEMENT en base de donnees, pour
// etre certain qu'il existe bien sur la base utilisee par l'app en
// production (Aiven), sans dependre de l'ecran d'inscription.
//
// Usage : node create-test-buyer.js
// (avec les variables DB_* d'Aiven dans le .env, et la base Aiven REVEILLEE)
require('dotenv').config();
const { User, Buyer } = require('./models');

const TEST_EMAIL = 'acheteur.test@grandmarche.mg';
const TEST_PASSWORD = 'test1234';

async function main() {
  const existing = await User.findOne({ where: { email: TEST_EMAIL } });
  if (existing) {
    console.log('Ce compte existe deja :', TEST_EMAIL);
    console.log('Mot de passe attendu :', TEST_PASSWORD);
    process.exit(0);
  }

  const user = await User.create({
    email: TEST_EMAIL,
    password: TEST_PASSWORD, // hashe automatiquement par le modele User
    name: 'Acheteur Test',
    role: 'buyer',
  });

  await Buyer.create({
    user_id: user.id,
    is_verified: true,
  });

  console.log('Compte acheteur de test cree avec succes.');
  console.log('Email        :', TEST_EMAIL);
  console.log('Mot de passe :', TEST_PASSWORD);

  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
