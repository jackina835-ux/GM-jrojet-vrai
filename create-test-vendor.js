// create-test-vendor.js
//
// Cree un compte vendeur de test DIRECTEMENT en base de donnees, en
// contournant l'etape du "droit de bail" (qui reste volontairement non
// implementee dans l'app elle-meme). Utilise les modeles Sequelize du
// projet, donc le mot de passe est hashe automatiquement comme un vrai
// compte cree via l'app.
//
// Usage : node create-test-vendor.js
// (avec les variables DB_* d'Aiven dans le .env, comme pour import-db.js)
require('dotenv').config();
const { User, Vendor } = require('./models');

const TEST_EMAIL = 'vendeur.test@grandmarche.mg';
const TEST_PASSWORD = 'test1234';

async function main() {
  const existing = await User.findOne({ where: { email: TEST_EMAIL } });
  if (existing) {
    console.log('⚠️  Ce compte existe deja :', TEST_EMAIL);
    console.log('   Mot de passe attendu :', TEST_PASSWORD);
    process.exit(0);
  }

  const user = await User.create({
    email: TEST_EMAIL,
    password: TEST_PASSWORD, // hashe automatiquement par le modele User
    name: 'Vendeur Test',
    role: 'vendor',
  });

  await Vendor.create({
    user_id: user.id,
    cin: '000000000000',
    first_name: 'Vendeur',
    last_name: 'Test',
    contact: '0340000000',
    droit_bail: null, // volontairement absent, comme prevu
    is_paid: true,
    is_verified: true,
    status: 'approved',
  });

  console.log('🎉 Compte vendeur de test cree avec succes !');
  console.log('   Email    :', TEST_EMAIL);
  console.log('   Mot de passe :', TEST_PASSWORD);
  console.log('   -> Connecte-toi avec ces identifiants dans l\'app.');
  console.log('   -> Comme aucun magasin n\'est encore configure, l\'app');
  console.log('      devrait t\'envoyer vers l\'ecran de configuration du');
  console.log('      magasin a la premiere connexion : c\'est normal.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
