const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

module.exports = sequelize.define('StoreServices', {
  store_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
  is_online: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
  delivery_enabled: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
  headquarters_address: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
}, { tableName: 'store_services' });
