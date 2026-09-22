const { Store, Department, User, Follow, Vendor, Buyer, StoreServices } = require('../models');
const ensureStoreServicesTable = require('../utils/storeServicesTable');
const { Op } = require('sequelize');

exports.getAllStores = async (req, res) => {
  try {
    await ensureStoreServicesTable();
    const stores = await Store.findAll({
      where: { is_active: true },
      include: [
        { model: StoreServices, as: 'services', required: false },
        { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] },
        { 
          model: Vendor,
          include: [
            { model: User, attributes: ['id', 'name', 'avatar'] }
          ]
        }
      ],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      stores
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des magasins'
    });
  }
};

exports.getStoreById = async (req, res) => {
  try {
    await ensureStoreServicesTable();
    const { storeId } = req.params;
    
    const store = await Store.findByPk(storeId, {
      include: [
        { model: StoreServices, as: 'services', required: false },
        { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] },
        { 
          model: Vendor,
          include: [
            { model: User, attributes: ['id', 'name', 'avatar'] }
          ]
        }
      ]
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    // Get followers count
    const followersCount = await Follow.count({
      where: { store_id: storeId }
    });

    res.json({
      success: true,
      store: {
        ...store.toJSON(),
        followers: followersCount
      }
    });
  } catch (error) {
    console.error('Get store by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du magasin'
    });
  }
};

exports.followStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const buyerId = req.user.id;

    const buyer = await Buyer.findOne({ where: { user_id: buyerId } });
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

    // Check if already following
    const existingFollow = await Follow.findOne({
      where: { buyer_id: buyer.id, store_id: storeId }
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Vous suivez déjà ce magasin'
      });
    }

    // Create follow
    await Follow.create({
      buyer_id: buyer.id,
      store_id: storeId
    });

    // Update followers count
    await store.increment('followers_count');

    res.status(201).json({
      success: true,
      message: 'Magasin suivi avec succès'
    });
  } catch (error) {
    console.error('Follow store error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du suivi du magasin'
    });
  }
};

exports.unfollowStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const buyerId = req.user.id;

    const buyer = await Buyer.findOne({ where: { user_id: buyerId } });
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const follow = await Follow.findOne({
      where: { buyer_id: buyer.id, store_id: storeId }
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: 'Vous ne suivez pas ce magasin'
      });
    }

    await follow.destroy();

    // Update followers count
    await Store.decrement('followers_count', { where: { id: storeId } });

    res.json({
      success: true,
      message: 'Magasin désabonné avec succès'
    });
  } catch (error) {
    console.error('Unfollow store error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du désabonnement'
    });
  }
};

exports.isFollowing = async (req, res) => {
  try {
    const { storeId } = req.params;
    const buyerId = req.user.id;

    const buyer = await Buyer.findOne({ where: { user_id: buyerId } });
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const follow = await Follow.findOne({
      where: { buyer_id: buyer.id, store_id: storeId }
    });

    res.json({
      success: true,
      isFollowing: !!follow
    });
  } catch (error) {
    console.error('Is following error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

exports.getFollowedStores = async (req, res) => {
  try {
    const buyerId = req.user.id;

    const buyer = await Buyer.findOne({ where: { user_id: buyerId } });
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Acheteur non trouvé'
      });
    }

    const follows = await Follow.findAll({
      where: { buyer_id: buyer.id },
      include: [
        {
          model: Store,
          include: [
            { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] }
          ]
        }
      ]
    });

    const stores = follows.map(f => f.Store);

    res.json({
      success: true,
      stores
    });
  } catch (error) {
    console.error('Get followed stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des magasins suivis'
    });
  }
};

exports.searchStores = async (req, res) => {
  try {
    const { q } = req.query;
    
    const stores = await Store.findAll({
      where: {
        is_active: true,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { '$Department.name$': { [Op.like]: `%${q}%` } }
        ]
      },
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] }
      ],
      limit: 20
    });

    res.json({
      success: true,
      stores
    });
  } catch (error) {
    console.error('Search stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};

exports.getStoresByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    const stores = await Store.findAll({
      where: {
        department_id: departmentId,
        is_active: true
      },
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name', 'icon'] }
      ]
    });

    res.json({
      success: true,
      stores
    });
  } catch (error) {
    console.error('Get stores by department error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des magasins'
    });
  }
};
