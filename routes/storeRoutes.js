const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');
// ✅ IMPORT CORRECT
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// IMPORTANT : les routes avec un chemin fixe (/followed, /search, ...)
// doivent être déclarées AVANT /:storeId, sinon Express interprète
// "followed" ou "search" comme une valeur de :storeId et ces routes
// ne sont jamais atteintes.
router.get('/followed', authMiddleware, storeController.getFollowedStores);
router.get('/search', storeController.searchStores);
router.get('/department/:departmentId', storeController.getStoresByDepartment);
router.get('/vendor/:vendorId', storeController.getVendorStore);

router.get('/', storeController.getAllStores);
router.get('/:storeId', storeController.getStoreById);

// ✅ CORRIGÉ
router.put(
  '/:storeId', 
  authMiddleware, 
  upload.single('logo'), 
  handleUploadError,
  storeController.updateStore
);

router.post('/:storeId/follow', authMiddleware, storeController.followStore);
router.delete('/:storeId/follow', authMiddleware, storeController.unfollowStore);
router.get('/:storeId/is-following', authMiddleware, storeController.isFollowing);

module.exports = router;