const { Order, OrderItem, Buyer, Store, Stock, User, Vendor } = require('../models');

// L'acteur (acheteur ou vendeur) vient TOUJOURS du jeton, via
// middlewares/actorMiddleware.js : req.buyer (acheteur connecte) et
// req.store (magasin du vendeur connecte). Aucun buyerId/vendorId n'est lu
// dans le corps ou l'URL. Une commande n'est accessible qu'a l'acheteur qui
// l'a passee et au magasin qui la recoit ; sinon reponse 404 (on ne revele
// pas l'existence d'une commande d'autrui).

// Condition SQL "cette commande m'appartient" selon le role connecte.
const ownershipWhere = (req, id) => {
  if (req.buyer) return { id, buyer_id: req.buyer.id };
  if (req.store) return { id, store_id: req.store.id };
  return null;
};

exports.createOrder = async (req, res) => {
  try {
    // buyerId = acheteur du jeton (jamais le corps). storeId est le magasin
    // auquel l'acheteur commande : entree legitime, mais on verifie que chaque
    // article commande appartient bien a CE magasin.
    const { storeId, items, deliveryAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La commande ne contient aucun article'
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
      const quantity = parseInt(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Quantité invalide pour ${item.name}`
        });
      }

      const stock = await Stock.findOne({ where: { id: item.stockId, store_id: store.id } });
      if (!stock) {
        return res.status(404).json({
          success: false,
          message: `Produit ${item.name} non trouvé`
        });
      }

      if (stock.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour ${item.name}`
        });
      }

      const itemTotal = parseFloat(stock.price) * quantity;
      total += itemTotal;

      orderItems.push({
        stock_id: stock.id,
        product_name: stock.name,
        quantity,
        price: parseFloat(stock.price),
        total: itemTotal
      });
    }

    // Create order
    const order = await Order.create({
      buyer_id: req.buyer.id,
      store_id: store.id,
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

// Commandes de l'acheteur connecte
exports.getBuyerOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { buyer_id: req.buyer.id },
      include: [
        {
          model: Store,
          include: [
            {
              model: Vendor,
              include: [{ model: User, attributes: ['name', 'avatar'] }],
            },
          ],
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

// Commandes recues par le magasin du vendeur connecte
exports.getVendorOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { store_id: req.store.id },
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
    const orders = await Order.findAll({
      where: {
        store_id: req.store.id,
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

// Modification par l'ACHETEUR proprietaire : uniquement l'adresse de
// livraison, et tant que la commande est "pending". Les changements de
// statut passent exclusivement par cancel / validate / deliver.
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryAddress } = req.body;

    const order = await Order.findOne({ where: { id, buyer_id: req.buyer.id } });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Seule une commande en attente peut être modifiée'
      });
    }

    const updates = {};
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

// Annulation par l'acheteur proprietaire OU par le magasin destinataire.
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const where = ownershipWhere(req, id);
    const order = where ? await Order.findOne({ where }) : null;
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

    // Sans ce test, annuler deux fois la meme commande restituait deux fois
    // le stock.
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande est déjà annulée'
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

// Validation : uniquement par le MAGASIN destinataire (requireStore).
exports.validateOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ where: { id, store_id: req.store.id } });
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

// Livraison : uniquement par le MAGASIN destinataire (requireStore).
exports.markDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ where: { id, store_id: req.store.id } });
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

// Detail : acheteur proprietaire OU magasin destinataire.
exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const where = ownershipWhere(req, id);
    const order = where
      ? await Order.findOne({
          where,
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
                {
                  model: Vendor,
                  include: [{ model: User, attributes: ['name', 'avatar'] }],
                },
              ],
            },
            {
              model: OrderItem
            }
          ]
        })
      : null;

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
