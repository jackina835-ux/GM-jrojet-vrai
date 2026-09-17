const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Une conversation = toutes les lignes partageant le meme (store_id,
// buyer_id), triees par date. Pas de table "Conversation" separee : ce
// couple suffit a l'identifier, comme pour Follow (store_id, buyer_id).
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id',
    },
  },
  buyer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'buyers',
      key: 'id',
    },
  },
  sender_role: {
    type: DataTypes.ENUM('buyer', 'vendor'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'messages',
  indexes: [
    { fields: ['store_id', 'buyer_id'] },
  ],
});

module.exports = Message;
