const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middlewares/authMiddleware');
// ✅ IMPORT CORRECT
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// ✅ CORRIGÉ
router.post(
  '/', 
  authMiddleware, 
  upload.single('photo'), 
  handleUploadError,
  publicationController.createPublication
);

// ✅ CORRIGÉ
router.put(
  '/:id', 
  authMiddleware, 
  upload.single('photo'), 
  handleUploadError,
  publicationController.updatePublication
);

router.delete('/:id', authMiddleware, publicationController.deletePublication);
router.post('/:id/republish', authMiddleware, publicationController.republishFromDraft);
router.get('/drafts/:vendorId', authMiddleware, publicationController.getDrafts);

// Routes publiques
router.get('/global', publicationController.getGlobalPublications);
router.get('/store/:storeId', publicationController.getStorePublications);
router.get('/search', publicationController.searchPublications);

module.exports = router;