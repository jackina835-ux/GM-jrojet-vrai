// find-weak-accounts.js
//
// LECTURE SEULE : ne modifie rien. Repere les comptes touches par l'ancienne
// porte derobee "google_oauth" (anomalie S1, corrigee le 20/09/2026) :
//
// 1) comptes dont le mot de passe REEL est litteralement "google_oauth"
//    (crees par l'ancienne inscription sans mot de passe) : n'importe qui
//    pouvait les deviner. Le login les refuse desormais, mais le compte
//    reste inutilisable tant que son proprietaire n'a pas de nouveau mot
//    de passe (il n'existe pas encore de "mot de passe oublie", voir
//    CLAUDE.md 6.4 point 21) -> a supprimer ou a reinitialiser a la main.
// 2) comptes marques "Google" (google_id renseigne) : ils ne peuvent plus
//    se connecter tant que la connexion Google n'est pas reactivee, et
//    leur google_id, qui venait du client, n'est PAS fiable.
//
// Usage : node find-weak-accounts.js
// (avec les variables DB_* d'Aiven dans le .env et la base REVEILLEE)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function main() {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  console.log(`\n${users.length} compte(s) examine(s).\n`);

  const weak = [];
  const google = [];

  for (const user of users) {
    if (user.google_id) {
      google.push(user);
      continue; // leur mot de passe stocke n'est pas un hash bcrypt
    }
    if (await bcrypt.compare('google_oauth', user.password)) {
      weak.push(user);
    }
  }

  console.log(`🔴 Mot de passe = "google_oauth" (${weak.length}) :`);
  weak.forEach((u) => console.log(`   - id ${u.id}  ${u.email}  (${u.role})`));

  console.log(`\n🟠 Comptes avec google_id renseigne (${google.length}) :`);
  google.forEach((u) => console.log(`   - id ${u.id}  ${u.email}  (${u.role})`));

  if (weak.length === 0 && google.length === 0) {
    console.log('\n✅ Aucun compte concerne.');
  } else {
    console.log(
      '\nAction : supprimer ces comptes s\'ils sont des tests, sinon leur donner\n' +
        'un nouveau mot de passe via l\'INSTANCE (utilisateur.update({ password })) :\n' +
        'le hook beforeUpdate du modele le hashe, ce que User.update() statique ne fait pas.'
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
