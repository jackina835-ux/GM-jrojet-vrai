const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireStore, requireOwnPublication } = require('../middlewares/actorMiddleware');
// ✅ IMPORT CORRECT
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// Ecriture : reservee au vendeur connecte, sur SON magasin (req.store, tire
// du jeton -- plus de storeId dans le corps). requireStore et
// requireOwnPublication passent AVANT multer : un utilisateur non autorise
// ne peut donc rien envoyer vers Cloudinary.

// ✅ CORRIGÉ (plusieurs photos possibles : jusqu'à 5, champ "photos")
router.post(
  '/',
  authMiddleware,
  ...requireStore,
  upload.array('photos', 5),
  handleUploadError,
  publicationController.createPublication
);

// ✅ CORRIGÉ
router.put(
  '/:id',
  authMiddleware,
  ...requireStore,
  requireOwnPublication,
  upload.array('photos', 5),
  handleUploadError,
  publicationController.updatePublication
);

router.delete('/:id', authMiddleware, ...requireStore, requireOwnPublication, publicationController.deletePublication);
router.post('/:id/republish', authMiddleware, ...requireStore, requireOwnPublication, publicationController.republishFromDraft);

// Brouillons du vendeur connecte (plus de :vendorId dans l'URL)
router.get('/drafts', authMiddleware, ...requireStore, publicationController.getDrafts);

// Routes publiques (parcourir les publications d'un magasin est public :
// le storeId designe ici le magasin CONSULTE, pas l'utilisateur)
router.get('/global', publicationController.getGlobalPublications);
router.get('/store/:storeId', publicationController.getStorePublications);
router.get('/search', publicationController.searchPublications);

// Route protégée : publications des magasins suivis par l'acheteur connecté
router.get('/followed', authMiddleware, publicationController.getFollowedPublications);

module.exports = router;
