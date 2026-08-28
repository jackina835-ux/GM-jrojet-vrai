const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer les dossiers d'upload
const createUploadDirs = () => {
  const dirs = ['uploads', 'uploads/publications', 'uploads/logos', 'uploads/droit_bail'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Dossier créé: ${dir}`);
    }
  });
};
createUploadDirs();

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    if (file.fieldname === 'logo') {
      folder = 'uploads/logos/';
    } else if (file.fieldname === 'droitBail') {
      folder = 'uploads/droit_bail/';
    } else if (file.fieldname === 'photo') {
      folder = 'uploads/publications/';
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + unique + ext;
    console.log(`📸 Fichier sauvegardé: ${filename}`);
    cb(null, filename);
  }
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