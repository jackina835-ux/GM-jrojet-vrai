const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Photos supplementaires d'une publication (en plus de la photo de
// couverture stockee sur Publication.photo, conservee pour ne pas casser
// l'affichage existant qui n'attend qu'une seule image).
const PublicationPhoto = sequelize.define('PublicationPhoto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  publication_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'publications',
      key: 'id',
    },
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'publication_photos',
  timestamps: true,
  underscored: true,
});

module.exports = PublicationPhoto;
