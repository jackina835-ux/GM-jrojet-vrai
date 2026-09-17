const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Stockage sur Cloudinary plutot que sur le disque local (voir
// config/cloudinary.js : le disque de Render est efface a chaque
// redeploiement/redemarrage, ce qui faisait disparaitre les photos deja
// enregistrees en base). req.file.path / req.files[].path contiennent
// directement l'URL https Cloudinary complete une fois uploade.
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = 'grand-marche/misc';
    if (file.fieldname === 'logo' || file.fieldname === 'icon') {
      folder = 'grand-marche/logos';
    } else if (file.fieldname === 'droitBail') {
      folder = 'grand-marche/droit_bail';
    } else if (file.fieldname === 'photos' || file.fieldname === 'photo') {
      folder = 'grand-marche/publications';
    }

    return {
      folder,
      resource_type: 'auto', // images ET pdf (droit de bail)
      public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    };
  },
});

// Filtre des fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Seuls les fichiers images (JPEG, PNG, GIF) et PDF sont autorisés'));
};

// ✅ CRÉER L'INSTANCE UPLOAD CORRECTEMENT
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// ✅ EXPORTER CORRECTEMENT
module.exports = {
  upload,  // <-- C'EST ICI LE POINT IMPORTANT
  handleUploadError: (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'FILE_TOO_LARGE') {
        return res.status(400).json({
          success: false,
          message: 'Le fichier est trop volumineux (max 10MB)'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  }
};
