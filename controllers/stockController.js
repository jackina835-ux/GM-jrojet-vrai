const { Stock, Store } = require('../models');
const { Op } = require('sequelize');

exports.getStoreStock = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const stock = await Stock.findAll({
      where: { store_id: storeId },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      stock
    });
  } catch (error) {
    console.error('Get store stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du stock'
    });
  }
};

exports.getVendorStock = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const stock = await Stock.findAll({
      where: { store_id: store.id },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      stock
    });
  } catch (error) {
    console.error('Get vendor stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du stock'
    });
  }
};

exports.addStockItem = async (req, res) => {
  try {
    const { storeId, name, category, quantity, price, unit, arrivalDate } = req.body;

    const stock = await Stock.create({
      store_id: storeId,
      name,
      category: category || null,
      quantity: parseInt(quantity) || 0,
      price: parseFloat(price) || 0,
      unit: unit || null,
      arrival_date: arrivalDate || null
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

    const stock = await Stock.findByPk(id);
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
    if (arrivalDate !== undefined) updates.arrival_date = arrivalDate;

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
    
    const stock = await Stock.findByPk(id);
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
    const { storeId } = req.params;
    
    const categories = await Stock.findAll({
      where: { store_id: storeId },
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
    const { storeId, q } = req.query;
    
    const stock = await Stock.findAll({
      where: {
        store_id: storeId,
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