const sequelize = require('../config/db');

const User = require('./User');
const Buyer = require('./Buyer');
const Vendor = require('./Vendor');
const Department = require('./Department');
const Store = require('./Store');
const Stock = require('./Stock');
const Publication = require('./Publication');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Sale = require('./Sale');
const Follow = require('./Follow');

// ============================================
// ASSOCIATIONS
// ============================================

User.hasOne(Buyer, { foreignKey: 'user_id' });
Buyer.belongsTo(User, { foreignKey: 'user_id' });

User.hasOne(Vendor, { foreignKey: 'user_id' });
Vendor.belongsTo(User, { foreignKey: 'user_id' });

Department.hasMany(Store, { foreignKey: 'department_id', as: 'stores' });
Store.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

Vendor.hasOne(Store, { foreignKey: 'vendor_id' });
Store.belongsTo(Vendor, { foreignKey: 'vendor_id' });

Store.hasMany(Stock, { foreignKey: 'store_id' });
Stock.belongsTo(Store, { foreignKey: 'store_id' });

Store.hasMany(Publication, { foreignKey: 'store_id' });
Publication.belongsTo(Store, { foreignKey: 'store_id' });

Store.hasMany(Sale, { foreignKey: 'store_id' });
Sale.belongsTo(Store, { foreignKey: 'store_id' });

Stock.hasMany(Sale, { foreignKey: 'stock_id' });
Sale.belongsTo(Stock, { foreignKey: 'stock_id' });

Store.hasMany(Order, { foreignKey: 'store_id' });
Order.belongsTo(Store, { foreignKey: 'store_id' });

Buyer.hasMany(Order, { foreignKey: 'buyer_id' });
Order.belongsTo(Buyer, { foreignKey: 'buyer_id' });

Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

Stock.hasMany(OrderItem, { foreignKey: 'stock_id' });
OrderItem.belongsTo(Stock, { foreignKey: 'stock_id' });

Buyer.hasMany(Follow, { foreignKey: 'buyer_id' });
Follow.belongsTo(Buyer, { foreignKey: 'buyer_id' });

Store.hasMany(Follow, { foreignKey: 'store_id' });
Follow.belongsTo(Store, { foreignKey: 'store_id' });

module.exports = {
    sequelize,
    User,
    Buyer,
    Vendor,
    Department,
    Store,
    Stock,
    Publication,
    Order,
    OrderItem,
    Sale,
    Follow
};