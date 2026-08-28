const { Sale, Store, Stock } = require('../models');
const { Op } = require('sequelize');

exports.recordSale = async (req, res) => {
  try {
    const { storeId, stockId, productName, quantity, price } = req.body;

    const total = parseFloat(price) * parseInt(quantity);

    const sale = await Sale.create({
      store_id: storeId,
      stock_id: stockId,
      product_name: productName,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      total: total
    });

    // Update stock
    const stock = await Stock.findByPk(stockId);
    if (stock) {
      await stock.update({
        quantity: stock.quantity - parseInt(quantity)
      });
    }

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

exports.getVendorSales = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { period = 'month' } = req.query;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    // Get date filter
    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (period === 'year') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
    }

    const sales = await Sale.findAll({
      where: {
        store_id: store.id,
        ...dateFilter
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      sales
    });
  } catch (error) {
    console.error('Get vendor sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ventes'
    });
  }
};

exports.getStoreSales = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = 'month' } = req.query;

    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (period === 'year') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
    }

    const sales = await Sale.findAll({
      where: {
        store_id: storeId,
        ...dateFilter
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      sales
    });
  } catch (error) {
    console.error('Get store sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ventes'
    });
  }
};

exports.getProductSales = async (req, res) => {
  try {
    const { productId } = req.params;
    const { period = 'month' } = req.query;

    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (period === 'year') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
    }

    const sales = await Sale.findAll({
      where: {
        stock_id: productId,
        ...dateFilter
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

    const sale = await Sale.findByPk(id);
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
    
    const sale = await Sale.findByPk(id);
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
    const { vendorId } = req.params;
    const { period = 'month' } = req.query;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (period === 'year') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
    }

    const sales = await Sale.findAll({
      where: {
        store_id: store.id,
        ...dateFilter
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
    const { vendorId } = req.params;
    const { period = 'month' } = req.query;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (period === 'year') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
    }

    const sales = await Sale.findAll({
      where: {
        store_id: store.id,
        ...dateFilter
      },
      order: [['created_at', 'DESC']]
    });

    // Create CSV
    let csv = 'Date,Produit,Quantité,Prix,Total\n';
    sales.forEach(s => {
      csv += `${s.created_at.toISOString().split('T')[0]},${s.product_name},${s.quantity},${s.price},${s.total}\n`;
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