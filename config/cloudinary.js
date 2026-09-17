// config/cloudinary.js
//
// Stockage des fichiers uploades (photos, logos, droit de bail) sur
// Cloudinary plutot que sur le disque local du serveur. Necessaire car
// Render efface le disque a chaque redeploiement/redemarrage -- les
// fichiers geres jusque-la par uploadMiddleware.js (multer.diskStorage)
// disparaissaient donc regulierement, meme si leur chemin restait
// enregistre en base (voir CLAUDE.md).
const cloudinary = require('cloudinary').v2;

// Deux facons de configurer, au choix (une seule suffit) :
// 1) UNE seule variable CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>)
//    -- c'est la ligne "API Environment variable" affichee directement sur
//    le Dashboard Cloudinary, la plus simple a copier-coller telle quelle.
//    Le SDK la lit tout seul, sans rien configurer explicitement.
// 2) Les 3 variables separees (CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET).
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(true); // relit CLOUDINARY_URL depuis process.env
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

module.exports = cloudinary;
