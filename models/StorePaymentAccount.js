const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

module.exports = sequelize.define('StorePaymentAccount', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'stores', key: 'id' } },
  provider: { type: DataTypes.ENUM('mvola', 'orange_money', 'airtel_money'), allowNull: false },
  phone: { type: DataTypes.STRING(16), allowNull: false },
}, {
  tableName: 'store_payment_accounts',
  indexes: [{ unique: true, fields: ['store_id', 'provider'] }],
});
