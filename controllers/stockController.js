const { Stock } = require('../models');
const { Op } = require('sequelize');

// Toutes les routes de ce controleur passent par requireStore
// (middlewares/actorMiddleware.js) : req.store est le magasin du vendeur
// CONNECTE, tire du jeton. Aucun storeId/vendorId n'est lu dans le corps ou
// l'URL, et chaque article est recherche AVEC store_id = req.store.id, donc
// un vendeur ne peut ni lire, ni modifier, ni supprimer le stock d'un autre.
// (Exception volontaire : checkAvailability, lecture seule de la quantite
// d'un article, ouverte a tout utilisateur connecte.)

// Le champ "Date d'arrivage" du formulaire vendeur est un texte libre au
// format francais JJ/MM/AAAA (voir le placeholder dans ManagementScreen.js)
// -- MySQL attend AAAA-MM-JJ. Sans conversion, une date saisie fait
// echouer l'INSERT/UPDATE ("Erreur lors de l'ajout de l'article"), meme
// quand tous les autres champs sont valides. Format inattendu ou invalide
// -> null plutot qu'une erreur serveur.
function parseFrenchDate(value) {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value).trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Stock du vendeur connecte
exports.getMyStock = async (req, res) => {
  try {
    const stock = await Stock.findAll({
      where: { store_id: req.store.id },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      stock
    });
  } catch (error) {
    console.error('Get my stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du stock'
    });
  }
};

exports.addStockItem = async (req, res) => {
  try {
    const { name, category, quantity, price, unit, arrivalDate } = req.body;

    const stock = await Stock.create({
      store_id: req.store.id,
      name,
      category: category || null,
      quantity: parseInt(quantity) || 0,
      price: parseFloat(price) || 0,
      unit: unit || null,
      arrival_date: parseFrenchDate(arrivalDate)
    });

    res.status(201).json({
      success: true,
      stock
    });
  } catch (error) {
    console.error('Add stock item error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'article'
    });
  }
};

exports.updateStockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, quantity, price, unit, arrivalDate } = req.body;

    const stock = await Stock.findOne({ where: { id, store_id: req.store.id } });
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (quantity !== undefined) updates.quantity = parseInt(quantity);
    if (price !== undefined) updates.price = parseFloat(price);
    if (unit !== undefined) updates.unit = unit;
    if (arrivalDate !== undefined) updates.arrival_date = parseFrenchDate(arrivalDate);

    await stock.update(updates);

    res.json({
      success: true,
      stock
    });
  } catch (error) {
    console.error('Update stock item error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'article'
    });
  }
};

exports.deleteStockItem = async (req, res) => {
  try {
    const { id } = req.params;

    const stock = await Stock.findOne({ where: { id, store_id: req.store.id } });
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    await stock.destroy();

    res.json({
      success: true,
      message: 'Article supprimé'
    });
  } catch (error) {
    console.error('Delete stock item error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'article'
    });
  }
};

exports.getStockCategories = async (req, res) => {
  try {
    const categories = await Stock.findAll({
      where: { store_id: req.store.id },
      attributes: ['category'],
      group: ['category']
    });

    res.json({
      success: true,
      categories: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Get stock categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories'
    });
  }
};

exports.searchStock = async (req, res) => {
  try {
    const q = req.query.q || '';

    const stock = await Stock.findAll({
      where: {
        store_id: req.store.id,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { category: { [Op.like]: `%${q}%` } }
        ]
      },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      items: stock
    });
  } catch (error) {
    console.error('Search stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};

exports.checkAvailability = async (req, res) => {
  try {
    const { itemId, quantity } = req.body;

    const stock = await Stock.findByPk(itemId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    const available = stock.quantity >= quantity;

    res.json({
      success: true,
      available,
      currentQuantity: stock.quantity
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};
