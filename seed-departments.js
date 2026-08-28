// seed-departments.js
//
// Script a executer pour remplir/mettre a jour la table departments
// avec la liste complete des 31 departements.
// Usage : node seed-departments.js

require('dotenv').config();
const sequelize = require('./config/db');
const { Department } = require('./models');

const departmentNames = [
  'Boulangerie',
  'Pharmacie',
  'Pâtisserie',
  'Tenue de Sport',
  'Épicerie',
  'Boucherie',
  'Poissonnerie',
  'Fruits & Légumes',
  'Crémerie',
  'Boissons',
  'Cosmétique',
  'Électroménager',
  'Animalerie',
  'Artisanat',
  'Beauté',
  'Bebe & Puericulture',
  'Bijoux',
  'Bricolage & Construction',
  'Chaussures',
  'Électronique',
  'Informatique',
  'Jardinage',
  'Jouets',
  'Librairie et Papeterie',
  'Maison de deco',
  'Quincaillerie',
  'Restauration',
  'Sacs et Accessoires',
  'Sport et Loisirs',
  'Telephonie et Accessoires',
  'Vêtements',
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL établie');

    for (const name of departmentNames) {
      const [department, created] = await Department.findOrCreate({
        where: { name },
        defaults: { name, icon: null, is_active: false },
      });
      console.log(created ? `✅ Créé : ${name}` : `➡️  Déjà présent : ${name}`);
    }

    console.log(`🎉 Tous les départements sont prêts (${departmentNames.length} au total).`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
    process.exit(1);
  }
}

seed();