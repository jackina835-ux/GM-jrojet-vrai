const { Order, OrderItem, Buyer, Store, Stock, User } = require('../models');
const { Op } = require('sequelize');

exports.createOrder = async (req, res) => {
  try {
    const { buyerId, storeId, items, deliveryAddress } = req.body;

    // Check if buyer exists
    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    // Check if store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    // Calculate total and validate items
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const stock = await Stock.findByPk(item.stockId);
      if (!stock) {
        return res.status(404).json({
          success: false,
          message: `Produit ${item.name} non trouvé`
        });
      }

      if (stock.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour ${item.name}`
        });
      }

      const itemTotal = parseFloat(stock.price) * parseInt(item.quantity);
      total += itemTotal;

      orderItems.push({
        stock_id: stock.id,
        product_name: stock.name,
        quantity: parseInt(item.quantity),
        price: parseFloat(stock.price),
        total: itemTotal
      });
    }

    // Create order
    const order = await Order.create({
      buyer_id: buyerId,
      store_id: storeId,
      total: total,
      status: 'pending',
      delivery_address: deliveryAddress || null,
      delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
    });

    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        order_id: order.id,
        ...item
      });

      // Update stock
      const stock = await Stock.findByPk(item.stock_id);
      await stock.update({
        quantity: stock.quantity - item.quantity
      });
    }

    res.status(201).json({
      success: true,
      order: {
        ...order.toJSON(),
        items: orderItems
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande'
    });
  }
};

exports.getBuyerOrders = async (req, res) => {
  try {
    const { buyerId } = req.params;

    const orders = await Order.findAll({
      where: { buyer_id: buyerId },
      include: [
        {
          model: Store,
          include: [
            { model: User, attributes: ['name', 'avatar'] }
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
    console.error('Get buyer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
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
    const { vendorId } = req.params;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
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
      message: 'Erreur lors de la récupération des commandes'
    });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, deliveryAddress } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const updates = {};
    if (status) updates.status = status;
    if (deliveryAddress) updates.delivery_address = deliveryAddress;

    await order.update(updates);

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la commande'
    });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler une commande livrée'
      });
    }

    await order.update({ status: 'cancelled' });

    // Restore stock
    const items = await OrderItem.findAll({ where: { order_id: id } });
    for (const item of items) {
      const stock = await Stock.findByPk(item.stock_id);
      if (stock) {
        await stock.update({
          quantity: stock.quantity + item.quantity
        });
      }
    }

    res.json({
      success: true,
      message: 'Commande annulée'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la commande'
    });
  }
};

exports.validateOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut pas être validée'
      });
    }

    await order.update({ status: 'validated' });

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Validate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation de la commande'
    });
  }
};

exports.markDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    if (order.status !== 'validated') {
      return res.status(400).json({
        success: false,
        message: 'La commande doit être validée avant d\'être livrée'
      });
    }

    await order.update({
      status: 'delivered',
      delivery_date: new Date()
    });

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Mark delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la livraison de la commande'
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        {
          model: Buyer,
          include: [
            { model: User, attributes: ['name', 'email', 'avatar'] }
          ]
        },
        {
          model: Store,
          include: [
            { model: User, attributes: ['name', 'avatar'] }
          ]
        },
        {
          model: OrderItem
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails de la commande'
    });
  }
};