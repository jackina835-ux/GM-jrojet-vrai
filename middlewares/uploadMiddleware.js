const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');

// ---------------------------------------------------------------------
// Envoi de fichiers : verification du CONTENU REEL, puis Cloudinary.
//
// Avant (anomalie S4, corrigee le 20/09/2026) : multer-storage-cloudinary
// envoyait le fichier a Cloudinary au fil de l'eau, et le seul controle
// portait sur l'extension du nom et le type MIME DECLARES par le client --
// deux champs que le client ecrit librement. Un fichier quelconque
// renomme "photo.jpg" passait.
//
// Maintenant :
// 1. multer garde le fichier EN MEMOIRE (limites de taille et de nombre) ;
// 2. on lit ses premiers octets ("signature") pour verifier que c'est
//    vraiment un JPEG, PNG, GIF ou PDF, et que ce type est permis pour le
//    champ (photos, logos, icones : images seulement ; droit de bail :
//    images ou PDF) ;
// 3. seulement ensuite, on l'envoie a Cloudinary.
// Contrat inchange pour les controleurs : req.file.path / req.files[].path
// contiennent l'URL https Cloudinary complete (voir CLAUDE.md 5.8).
// ---------------------------------------------------------------------

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 5;

const IMAGE_TYPES = ['jpeg', 'png', 'gif'];
const ALLOWED_TYPES_BY_FIELD = {
  droitBail: [...IMAGE_TYPES, 'pdf'],
};
const allowedTypesFor = (fieldname) => ALLOWED_TYPES_BY_FIELD[fieldname] || IMAGE_TYPES;

const TYPE_LABELS = { jpeg: 'JPEG', png: 'PNG', gif: 'GIF', pdf: 'PDF' };
const describeAllowed = (types) => types.map((t) => TYPE_LABELS[t]).join(', ');

// Erreur de validation dont le message peut etre montre a l'utilisateur.
class UploadRejected extends Error {
  constructor(message) {
    super(message);
    this.name = 'UploadRejected';
    this.userFacing = true;
  }
}

// Type reel d'un fichier d'apres ses premiers octets (null = non reconnu).
function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  const head6 = buffer.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return null;
}

// Premier filtre, avant meme de lire le fichier : extension du nom
// (refus rapide des cas evidents). Le type MIME declare n'est PAS pris
// comme preuve : le client l'ecrit librement. Le VRAI controle est
// detectFileType(), qui lit le contenu (voir processUploadedFiles).
const fileFilter = (req, file, cb) => {
  const allowed = allowedTypesFor(file.fieldname);
  const extension = path.extname(file.originalname || '').toLowerCase().replace('.', '');
  const extensionOk = allowed.some((t) => (t === 'jpeg' ? /^jpe?g$/.test(extension) : extension === t));

  if (extensionOk) {
    return cb(null, true);
  }
  cb(new UploadRejected(`Seuls les fichiers ${describeAllowed(allowed)} sont autorisés`));
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter,
});

const folderFor = (fieldname) => {
  if (fieldname === 'logo' || fieldname === 'icon') return 'grand-marche/logos';
  if (fieldname === 'droitBail') return 'grand-marche/droit_bail';
  if (fieldname === 'photos' || fieldname === 'photo') return 'grand-marche/publications';
  return 'grand-marche/misc';
};

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });

// Verifie puis envoie tous les fichiers de la requete. Tout est verifie
// AVANT le moindre envoi ; si un envoi echoue, ceux deja partis sont supprimes.
async function processUploadedFiles(req) {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return;

  for (const file of files) {
    const allowed = allowedTypesFor(file.fieldname);
    const realType = detectFileType(file.buffer);
    if (!realType || !allowed.includes(realType)) {
      throw new UploadRejected(
        `Le fichier « ${file.originalname} » n'est pas un fichier valide (${describeAllowed(allowed)} attendu)`
      );
    }
    file.detectedType = realType;
  }

  const settled = await Promise.allSettled(
    files.map((file) =>
      uploadBuffer(file.buffer, {
        folder: folderFor(file.fieldname),
        resource_type: 'auto', // images ET pdf (droit de bail)
        public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      })
    )
  );

  const failed = settled.find((s) => s.status === 'rejected');
  if (failed) {
    await Promise.allSettled(
      settled
        .filter((s) => s.status === 'fulfilled')
        .map((s) => cloudinary.uploader.destroy(s.value.public_id, { resource_type: s.value.resource_type }))
    );
    console.error(`❌ Envoi Cloudinary echoue (${failed.reason && failed.reason.message})`);
    const error = new Error('Échec de l\'enregistrement du fichier, réessayez');
    error.uploadFailure = true;
    throw error;
  }

  files.forEach((file, index) => {
    const result = settled[index].value;
    file.path = result.secure_url; // URL https complete (contrat des controleurs)
    file.filename = result.public_id;
    delete file.buffer; // libere la memoire
  });
}

// multer (fichiers en memoire) puis controle + envoi. Se branche exactement
// comme avant : upload.single('logo'), upload.array('photos', 5).
const withProcessing = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) return next(err);
    processUploadedFiles(req).then(() => next(), next);
  });
};

const upload = {
  single: (fieldname) => withProcessing(memoryUpload.single(fieldname)),
  array: (fieldname, maxCount) => withProcessing(memoryUpload.array(fieldname, maxCount)),
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: `Le fichier est trop volumineux (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} Mo)`,
  LIMIT_FILE_COUNT: `Trop de fichiers (max ${MAX_FILES_PER_REQUEST})`,
  LIMIT_UNEXPECTED_FILE: 'Fichier ou nombre de fichiers inattendu',
};

module.exports = {
  upload,
  detectFileType, // exporte pour les tests
  handleUploadError: (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // NB : le code de taille est LIMIT_FILE_SIZE (l'ancien test sur
      // FILE_TOO_LARGE ne se declenchait jamais).
      return res.status(400).json({
        success: false,
        message: MULTER_MESSAGES[err.code] || 'Envoi de fichier invalide'
      });
    }
    if (err && err.userFacing) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err && err.uploadFailure) {
      return res.status(502).json({ success: false, message: err.message });
    }
    if (err) {
      // Erreur inattendue : jamais son texte interne au client.
      console.error('❌ Erreur inattendue pendant l\'envoi de fichier:', err.name);
      return res.status(400).json({ success: false, message: 'Envoi de fichier invalide' });
    }
    next();
  }
};
