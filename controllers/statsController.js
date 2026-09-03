const { Sale, Order, Store, Publication, Follow, Stock, User, Department } = require('../models');
const { Op } = require('sequelize');

exports.getVendorStats = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Current month sales
    const currentMonthSales = await Sale.sum('total', {
      where: {
        store_id: store.id,
        created_at: { [Op.gte]: firstDayOfMonth }
      }
    });

    // Last month sales
    const lastMonthSales = await Sale.sum('total', {
      where: {
        store_id: store.id,
        created_at: {
          [Op.between]: [firstDayOfLastMonth, firstDayOfMonth]
        }
      }
    });

    // Total orders
    const totalOrders = await Order.count({
      where: { store_id: store.id }
    });

    // Total followers
    const followersCount = await Follow.count({
      where: { store_id: store.id }
    });

    // Average sale
    const totalSales = await Sale.sum('total', {
      where: { store_id: store.id }
    });
    const totalSalesCount = await Sale.count({
      where: { store_id: store.id }
    });
    const averageSale = totalSalesCount > 0 ? totalSales / totalSalesCount : 0;

    // Growth
    const growth = lastMonthSales > 0 
      ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100 
      : 0;

    res.json({
      success: true,
      stats: {
        totalSales: parseFloat(totalSales || 0),
        totalOrders,
        followersCount,
        averageSale: parseFloat(averageSale || 0),
        growth: parseFloat(growth || 0),
        currentMonthSales: parseFloat(currentMonthSales || 0),
        lastMonthSales: parseFloat(lastMonthSales || 0)
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

exports.getSalesChart = async (req, res) => {
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

    let labels = [];
    let data = [];
    let dateFilter = {};
    const now = new Date();

    if (period === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        const total = await Sale.sum('total', {
          where: {
            store_id: store.id,
            created_at: { [Op.between]: [dayStart, dayEnd] }
          }
        });
        
        labels.push(date.toLocaleDateString('fr-FR', { weekday: 'short' }));
        data.push(parseFloat(total || 0));
      }
    } else if (period === 'month') {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        const total = await Sale.sum('total', {
          where: {
            store_id: store.id,
            created_at: { [Op.between]: [dayStart, dayEnd] }
          }
        });
        
        labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
        data.push(parseFloat(total || 0));
      }
    } else {
      // Year - last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const total = await Sale.sum('total', {
          where: {
            store_id: store.id,
            created_at: { [Op.between]: [monthStart, monthEnd] }
          }
        });
        
        labels.push(monthStart.toLocaleDateString('fr-FR', { month: 'short' }));
        data.push(parseFloat(total || 0));
      }
    }

    res.json({
      success: true,
      chartData: {
        labels,
        datasets: [{ data }]
      }
    });
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du graphique'
    });
  }
};

exports.getDepartmentStats = async (req, res) => {
  try {
    const departments = await Department.findAll({
      include: [{
        model: Store,
        attributes: ['id']
      }]
    });

    const stats = await Promise.all(departments.map(async (dept) => {
      const storeIds = dept.Stores.map(s => s.id);
      
      let totalSales = 0;
      let storeCount = 0;
      
      if (storeIds.length > 0) {
        totalSales = await Sale.sum('total', {
          where: { store_id: { [Op.in]: storeIds } }
        });
        storeCount = storeIds.length;
      }

      return {
        id: dept.id,
        name: dept.name,
        storeCount,
        totalSales: parseFloat(totalSales || 0)
      };
    }));

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

exports.getStoreStats = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findByPk(storeId, {
      include: [
        { model: Department, as: 'department', attributes: ['name'] },
        { model: Vendor, include: [{ model: User, attributes: ['name'] }] }
      ]
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalSales = await Sale.sum('total', {
      where: { store_id: storeId }
    });

    const monthlySales = await Sale.sum('total', {
      where: {
        store_id: storeId,
        created_at: { [Op.gte]: monthStart }
      }
    });

    const totalOrders = await Order.count({
      where: { store_id: storeId }
    });

    const totalPublications = await Publication.count({
      where: { store_id: storeId }
    });

    const followersCount = await Follow.count({
      where: { store_id: storeId }
    });

    const topProducts = await Sale.findAll({
      where: { store_id: storeId },
      attributes: [
        'product_name',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
      ],
      group: ['product_name'],
      order: [[sequelize.literal('total_quantity'), 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      stats: {
        store: {
          id: store.id,
          name: store.name,
          department: store.Department?.name,
          vendor: store.Vendor?.User?.name,
          followers: followersCount
        },
        sales: {
          total: parseFloat(totalSales || 0),
          monthly: parseFloat(monthlySales || 0)
        },
        orders: totalOrders,
        publications: totalPublications,
        topProducts
      }
    });
  } catch (error) {
    console.error('Get store stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

exports.getPublicationStats = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const total = await Publication.count({
      where: { store_id: store.id }
    });

    const active = await Publication.count({
      where: {
        store_id: store.id,
        is_active: true,
        is_draft: false
      }
    });

    const drafts = await Publication.count({
      where: {
        store_id: store.id,
        is_draft: true,
        is_active: false
      }
    });

    res.json({
      success: true,
      stats: {
        total,
        active,
        drafts
      }
    });
  } catch (error) {
    console.error('Get publication stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const store = await Store.findOne({ where: { vendor_id: vendorId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Magasin non trouvé'
      });
    }

    const topProducts = await Sale.findAll({
      where: { store_id: store.id },
      attributes: [
        'product_name',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'quantity'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: ['product_name'],
      order: [[sequelize.literal('total'), 'DESC']],
      limit
    });

    res.json({
      success: true,
      products: topProducts
    });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des meilleures ventes'
    });
  }
};

exports.getRevenueStats = async (req, res) => {
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

    const now = new Date();
    let dateFilter = {};
    let compareFilter = {};

    if (period === 'week') {
      dateFilter = { created_at: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
      compareFilter = { created_at: { [Op.between]: [new Date(now - 14 * 24 * 60 * 60 * 1000), new Date(now - 7 * 24 * 60 * 60 * 1000)] } };
    } else if (period === 'month') {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) } };
      compareFilter = { created_at: { [Op.between]: [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)] } };
    } else {
      dateFilter = { created_at: { [Op.gte]: new Date(now.getFullYear(), 0, 1) } };
      compareFilter = { created_at: { [Op.between]: [new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1)] } };
    }

    const total = await Sale.sum('total', {
      where: { store_id: store.id, ...dateFilter }
    });

    const previousTotal = await Sale.sum('total', {
      where: { store_id: store.id, ...compareFilter }
    });

    const count = await Sale.count({
      where: { store_id: store.id, ...dateFilter }
    });

    const average = count > 0 ? total / count : 0;
    const growth = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

    res.json({
      success: true,
      revenue: {
        total: parseFloat(total || 0),
        average: parseFloat(average || 0),
        growth: parseFloat(growth || 0),
        previousTotal: parseFloat(previousTotal || 0),
        period
      }
    });
  } catch (error) {
    console.error('Get revenue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de revenus'
    });
  }
};

exports.getVisitorStats = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = 'month' } = req.query;

    // Note: This is a mock implementation since we don't have visitor tracking
    // In a real app, you would use a service like Google Analytics or a custom tracking

    const now = new Date();
    let days = 30;
    if (period === 'week') days = 7;
    else if (period === 'year') days = 365;

    // Simulated data
    const baseVisitors = 100 + Math.random() * 200;
    const baseUnique = 50 + Math.random() * 100;

    res.json({
      success: true,
      visitors: {
        total: Math.round(baseVisitors * (days / 30)),
        unique: Math.round(baseUnique * (days / 30)),
        period
      }
    });
  } catch (error) {
    console.error('Get visitor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de visiteurs'
    });
  }
};

exports.getConversionStats = async (req, res) => {
  try {
    const { storeId } = req.params;

    const totalVisitors = 1000 + Math.random() * 2000; // Mock data
    const totalSales = await Order.count({
      where: { store_id: storeId }
    });

    const conversionRate = totalVisitors > 0 ? (totalSales / totalVisitors) * 100 : 0;

    res.json({
      success: true,
      stats: {
        totalVisitors: Math.round(totalVisitors),
        totalSales,
        rate: parseFloat(conversionRate || 0)
      }
    });
  } catch (error) {
    console.error('Get conversion stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de conversion'
    });
  }
};