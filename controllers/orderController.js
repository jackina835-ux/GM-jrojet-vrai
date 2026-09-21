const { Order, OrderItem, Buyer, Store, Stock, User, Vendor, Publication, Sale, sequelize } = require('../models');

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

// Erreur metier renvoyee telle quelle au client (statut HTTP + message).
class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Resout UNE ligne de commande vers une ligne de stock du magasin commande.
// Deux formes acceptees :
//   { stockId, quantity, name }        route d'origine (article de stock connu)
//   { publicationId, quantity, name }  achat depuis le panier : l'acheteur ne
//     connait que la publication ; on retrouve l'article de stock du meme nom
//     (et de la meme categorie) dans CE magasin -- s'il y en a plusieurs, celui
//     qui a le plus de quantite. Le prix retenu est celui de la publication (le
//     prix vu par l'acheteur), sinon celui du stock.
const resolveOrderLine = async (item, store, transaction) => {
  const label = item.name || 'Produit';
  const quantity = parseInt(item.quantity, 10);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new OrderError(400, `Quantité invalide pour ${label}`);
  }

  let stock = null;
  let unitPrice = null;

  if (item.publicationId) {
    const publication = await Publication.findOne({
      where: { id: item.publicationId, store_id: store.id, is_active: true, is_draft: false },
      transaction,
    });
    const expired =
      publication &&
      !publication.is_permanent &&
      publication.expires_at &&
      new Date(publication.expires_at) <= new Date();
    if (!publication || expired) {
      throw new OrderError(404, `« ${label} » n'est plus disponible`);
    }

    if (publication.product_name) {
      const where = { store_id: store.id, name: publication.product_name };
      if (publication.category) where.category = publication.category;
      const candidates = await Stock.findAll({
        where,
        order: [['quantity', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      stock = candidates[0] || null;
    }
    if (!stock) {
      throw new OrderError(404, `« ${label} » n'est pas disponible en stock`);
    }
    unitPrice =
      publication.price !== null && publication.price !== undefined
        ? parseFloat(publication.price)
        : parseFloat(stock.price);
  } else {
    stock = await Stock.findOne({
      where: { id: item.stockId, store_id: store.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!stock) {
      throw new OrderError(404, `Produit ${label} non trouvé`);
    }
    unitPrice = parseFloat(stock.price);
  }

  if (stock.quantity < quantity) {
    throw new OrderError(400, `Stock insuffisant pour ${label}`);
  }

  return { stock, quantity, unitPrice };
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

    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    // Tout se fait dans UNE transaction : si un article echoue (stock
    // insuffisant, publication expiree...), rien n'est enregistre ni decremente
    // (avant, le stock etait modifie ligne par ligne, B11).
    const { order, orderItems } = await sequelize.transaction(async (transaction) => {
      let total = 0;
      const lines = [];

      for (const item of items) {
        const { stock, quantity, unitPrice } = await resolveOrderLine(item, store, transaction);
        const itemTotal = unitPrice * quantity;
        total += itemTotal;
        lines.push({
          stock,
          data: {
            stock_id: stock.id,
            product_name: stock.name,
            quantity,
            price: unitPrice,
            total: itemTotal,
          },
        });
      }

      const createdOrder = await Order.create(
        {
          buyer_id: req.buyer.id,
          store_id: store.id,
          total,
          status: 'pending',
          delivery_address: deliveryAddress || null,
          delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        },
        { transaction }
      );

      for (const line of lines) {
        await OrderItem.create({ order_id: createdOrder.id, ...line.data }, { transaction });
        // Recharge : deux lignes de la meme commande peuvent viser le meme article.
        await line.stock.reload({ transaction });
        if (line.stock.quantity < line.data.quantity) {
          throw new OrderError(400, `Stock insuffisant pour ${line.data.product_name}`);
        }
        await line.stock.update(
          { quantity: line.stock.quantity - line.data.quantity },
          { transaction }
        );
      }

      return { order: createdOrder, orderItems: lines.map((l) => l.data) };
    });

    res.status(201).json({
      success: true,
      order: {
        ...order.toJSON(),
        items: orderItems
      }
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Create order error:', error.name);
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

    // Livrer = vendre : on enregistre une vente par ligne de commande, ce qui
    // alimente l'onglet "Ventes", les statistiques et les revenus du vendeur
    // (avant, aucune vente n'etait jamais creee, F1). Le statut "validated"
    // exige plus haut empeche de livrer (donc de compter) deux fois.
    await sequelize.transaction(async (transaction) => {
      await order.update(
        { status: 'delivered', delivery_date: new Date() },
        { transaction }
      );

      const lines = await OrderItem.findAll({ where: { order_id: order.id }, transaction });
      for (const line of lines) {
        await Sale.create(
          {
            store_id: order.store_id,
            stock_id: line.stock_id,
            product_name: line.product_name,
            quantity: line.quantity,
            price: line.price,
            total: line.total,
          },
          { transaction }
        );
      }
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
