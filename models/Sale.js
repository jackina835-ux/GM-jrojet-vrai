const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Sale = sequelize.define('Sale', {
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
  stock_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'stock',
      key: 'id',
    },
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'sales',
  // La table n'a QUE created_at (pas de updated_at) : sans cette option Sequelize
  // ajoute updated_at a chaque INSERT et la requete echoue (ER_BAD_FIELD_ERROR).
  // C'est ce qui empechait de creer la moindre ligne de commande ou de vente.
  updatedAt: false,
});

module.exports = Sale;