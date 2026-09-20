const { Sale, Stock } = require('../models');
const { Op } = require('sequelize');

// Toutes les routes de ce controleur passent par requireStore
// (middlewares/actorMiddleware.js) : req.store est le magasin du vendeur
// CONNECTE, tire du jeton. Aucun storeId/vendorId n'est lu dans le corps ou
// l'URL, et chaque vente est recherchee AVEC store_id = req.store.id.

// Filtre de date commun aux listes, statistiques et exports.
function dateFilterFor(period) {
  const now = new Date();
  if (period === 'week') {
    return { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
  }
  if (period === 'month') {
    return { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
  }
  if (period === 'year') {
    return { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
  }
  return {};
}

exports.recordSale = async (req, res) => {
  try {
    const { stockId, productName, quantity, price } = req.body;

    // L'article vendu doit appartenir au magasin du vendeur connecte.
    const stock = await Stock.findOne({ where: { id: stockId, store_id: req.store.id } });
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    const total = parseFloat(price) * parseInt(quantity);

    const sale = await Sale.create({
      store_id: req.store.id,
      stock_id: stock.id,
      product_name: productName,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      total: total
    });

    // Update stock
    await stock.update({
      quantity: stock.quantity - parseInt(quantity)
    });

    res.status(201).json({
      success: true,
      sale
    });
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la vente'
    });
  }
};

// Ventes du vendeur connecte
exports.getMySales = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const sales = await Sale.findAll({
      where: {
        store_id: req.store.id,
        ...dateFilterFor(period)
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      sales
    });
  } catch (error) {
    console.error('Get my sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ventes'
    });
  }
};

// Ventes d'un article DU MAGASIN du vendeur connecte
exports.getProductSales = async (req, res) => {
  try {
    const { productId } = req.params;
    const { period = 'month' } = req.query;

    const sales = await Sale.findAll({
      where: {
        store_id: req.store.id,
        stock_id: productId,
        ...dateFilterFor(period)
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      sales
    });
  } catch (error) {
    console.error('Get product sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ventes'
    });
  }
};

exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, price } = req.body;

    const sale = await Sale.findOne({ where: { id, store_id: req.store.id } });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Vente non trouvée'
      });
    }

    const updates = {};
    if (quantity) {
      updates.quantity = parseInt(quantity);
      updates.total = parseFloat(price || sale.price) * parseInt(quantity);
    }
    if (price) {
      updates.price = parseFloat(price);
      updates.total = parseFloat(price) * parseInt(quantity || sale.quantity);
    }

    await sale.update(updates);

    res.json({
      success: true,
      sale
    });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la vente'
    });
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findOne({ where: { id, store_id: req.store.id } });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Vente non trouvée'
      });
    }

    await sale.destroy();

    res.json({
      success: true,
      message: 'Vente supprimée'
    });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la vente'
    });
  }
};

exports.getSaleStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const sales = await Sale.findAll({
      where: {
        store_id: req.store.id,
        ...dateFilterFor(period)
      }
    });

    const total = sales.reduce((sum, s) => sum + parseFloat(s.total), 0);
    const count = sales.length;
    const average = count > 0 ? total / count : 0;

    res.json({
      success: true,
      stats: {
        total,
        average,
        count,
        period
      }
    });
  } catch (error) {
    console.error('Get sale stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

exports.exportSales = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const sales = await Sale.findAll({
      where: {
        store_id: req.store.id,
        ...dateFilterFor(period)
      },
      order: [['created_at', 'DESC']]
    });

    // Create CSV. NB : avec `underscored: true`, l'attribut Sequelize
    // s'appelle createdAt (la colonne SQL seule s'appelle created_at) ;
    // l'ancien `s.created_at.toISOString()` levait donc une erreur.
    let csv = 'Date,Produit,Quantité,Prix,Total\n';
    sales.forEach(s => {
      csv += `${s.createdAt.toISOString().split('T')[0]},${s.product_name},${s.quantity},${s.price},${s.total}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales_${period}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'exportation'
    });
  }
};
