const { Buyer, User, Order, OrderItem, Store, Follow } = require('../models');

exports.getProfile = async (req, res) => {
  try {
    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id },
      include: [
        { 
          model: User, 
          attributes: ['id', 'email', 'name', 'avatar', 'role'] 
        }
      ]
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Profil acheteur non trouvé'
      });
    }

    res.json({
      success: true,
      profile: buyer
    });
  } catch (error) {
    console.error('Get buyer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { address, phone } = req.body;

    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Profil acheteur non trouvé'
      });
    }

    await buyer.update({ address, phone });

    res.json({
      success: true,
      profile: buyer
    });
  } catch (error) {
    console.error('Update buyer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const orders = await Order.findAll({
      where: { buyer_id: buyer.id },
      include: [
        {
          model: Store,
          attributes: ['id', 'name', 'logo']
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

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const order = await Order.findOne({
      where: {
        id: id,
        buyer_id: buyer.id
      },
      include: [
        {
          model: Store,
          attributes: ['id', 'name', 'logo', 'contact']
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

// Panier (simplifié - en production, utiliser Redis ou base de données)
exports.getCart = async (req, res) => {
  try {
    // Si le panier est stocké en base de données
    // Sinon, le frontend gère le panier localement
    res.json({
      success: true,
      cart: []
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du panier'
    });
  }
};

exports.addToCart = async (req, res) => {
  try {
    // Logique d'ajout au panier
    res.json({
      success: true,
      message: 'Produit ajouté au panier'
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout au panier'
    });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Logique de mise à jour du panier
    res.json({
      success: true,
      message: 'Panier mis à jour'
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du panier'
    });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;

    // Logique de suppression du panier
    res.json({
      success: true,
      message: 'Produit retiré du panier'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du retrait du panier'
    });
  }
};

exports.clearCart = async (req, res) => {
  try {
    // Logique de vidage du panier
    res.json({
      success: true,
      message: 'Panier vidé'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du vidage du panier'
    });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const favorites = await Follow.findAll({
      where: { buyer_id: buyer.id },
      include: [
        {
          model: Store,
          include: [
            { model: Department, attributes: ['id', 'name'] }
          ]
        }
      ]
    });

    res.json({
      success: true,
      favorites: favorites.map(f => f.Store)
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des favoris'
    });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const { storeId } = req.params;

    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const existing = await Follow.findOne({
      where: {
        buyer_id: buyer.id,
        store_id: storeId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ce magasin est déjà dans vos favoris'
      });
    }

    await Follow.create({
      buyer_id: buyer.id,
      store_id: storeId
    });

    await store.increment('followers_count');

    res.status(201).json({
      success: true,
      message: 'Magasin ajouté aux favoris'
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout aux favoris'
    });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { storeId } = req.params;

    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id }
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const follow = await Follow.findOne({
      where: {
        buyer_id: buyer.id,
        store_id: storeId
      }
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: 'Ce magasin n\'est pas dans vos favoris'
      });
    }

    await follow.destroy();

    await Store.decrement('followers_count', {
      where: { id: storeId }
    });

    res.json({
      success: true,
      message: 'Magasin retiré des favoris'
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du retrait des favoris'
    });
  }
};