const { Vendor, User, Store, Department, Order, OrderItem, Sale, Stock } = require('../models');
const { Op } = require('sequelize');

exports.getProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
      include: [
        { 
          model: User, 
          attributes: ['id', 'email', 'name', 'avatar', 'role'] 
        },
        {
          model: Store,
          include: [
            { model: Department, as: 'department', attributes: ['id', 'name'] }
          ]
        }
      ]
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Profil vendeur non trouvé'
      });
    }

    res.json({
      success: true,
      profile: vendor
    });
  } catch (error) {
    console.error('Get vendor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, contact } = req.body;

    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Profil vendeur non trouvé'
      });
    }

    await vendor.update({
      first_name: firstName || vendor.first_name,
      last_name: lastName || vendor.last_name,
      contact: contact || vendor.contact
    });

    res.json({
      success: true,
      profile: vendor
    });
  } catch (error) {
    console.error('Update vendor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
};

exports.getStore = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id },
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] }
      ]
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get vendor store error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du magasin'
    });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { name, description, contact } = req.body;
    const logo = req.file ? req.file.path : null;

    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (contact) updates.contact = contact;
    if (logo) updates.logo = logo;

    await store.update(updates);

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Update vendor store error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du magasin'
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const orders = await Order.findAll({
      where: { store_id: store.id },
      include: [
        {
          model: Buyer,
          include: [
            { model: User, attributes: ['name', 'email', 'avatar'] }
          ]
        },
        {
          model: OrderItem
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get vendor orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
};

exports.getPendingOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const orders = await Order.findAll({
      where: {
        store_id: store.id,
        status: 'pending'
      },
      include: [
        {
          model: Buyer,
          include: [
            { model: User, attributes: ['name', 'email', 'avatar'] }
          ]
        },
        {
          model: OrderItem
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes en attente'
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const order = await Order.findOne({
      where: {
        id: id,
        store_id: store.id
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    await order.update({ status });

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut de la commande'
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalSales = await Sale.sum('total', {
      where: { store_id: store.id }
    });

    const monthlySales = await Sale.sum('total', {
      where: {
        store_id: store.id,
        created_at: { [Op.gte]: firstDayOfMonth }
      }
    });

    const totalOrders = await Order.count({
      where: { store_id: store.id }
    });

    const pendingOrders = await Order.count({
      where: {
        store_id: store.id,
        status: 'pending'
      }
    });

    const totalProducts = await Stock.count({
      where: { store_id: store.id }
    });

    const lowStock = await Stock.count({
      where: {
        store_id: store.id,
        quantity: { [Op.lt]: 10 }
      }
    });

    res.json({
      success: true,
      stats: {
        totalSales: parseFloat(totalSales || 0),
        monthlySales: parseFloat(monthlySales || 0),
        totalOrders,
        pendingOrders,
        totalProducts,
        lowStock
      }
    });
  } catch (error) {
    console.error('Get vendor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

exports.getSalesStats = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    const store = await Store.findOne({
      where: { vendor_id: vendor.id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    // Derniers 7 jours
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklySales = await Sale.findAll({
      where: {
        store_id: store.id,
        created_at: { [Op.gte]: weekAgo }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
    });

    const topProducts = await Sale.findAll({
      where: { store_id: store.id },
      attributes: [
        'product_name',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_revenue']
      ],
      group: ['product_name'],
      order: [[sequelize.literal('total_revenue'), 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      stats: {
        weeklySales,
        topProducts
      }
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de ventes'
    });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    // Simuler un paiement
    await vendor.update({
      is_paid: true,
      payment_date: new Date()
    });

    res.json({
      success: true,
      message: 'Paiement effectué avec succès',
      paymentDate: vendor.payment_date
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du paiement'
    });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    res.json({
      success: true,
      isPaid: vendor.is_paid,
      paymentDate: vendor.payment_date
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut de paiement'
    });
  }
};

exports.requestValidation = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    await vendor.update({
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'Demande de validation envoyée'
    });
  } catch (error) {
    console.error('Request validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande de validation'
    });
  }
};

exports.getValidationStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    res.json({
      success: true,
      status: vendor.status,
      isVerified: vendor.is_verified
    });
  } catch (error) {
    console.error('Get validation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut de validation'
    });
  }
};