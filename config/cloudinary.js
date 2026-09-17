// config/cloudinary.js
//
// Stockage des fichiers uploades (photos, logos, droit de bail) sur
// Cloudinary plutot que sur le disque local du serveur. Necessaire car
// Render efface le disque a chaque redeploiement/redemarrage -- les
// fichiers geres jusque-la par uploadMiddleware.js (multer.diskStorage)
// disparaissaient donc regulierement, meme si leur chemin restait
// enregistre en base (voir CLAUDE.md).
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
