const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');

// IMPORTANT : les routes avec un chemin fixe (/followed, /search, ...)
// doivent être déclarées AVANT /:storeId, sinon Express interprète
// "followed" ou "search" comme une valeur de :storeId et ces routes
// ne sont jamais atteintes.
//
// Ici, :storeId / :departmentId designent le magasin ou le departement
// CONSULTE (donnees publiques), jamais l'identite de l'utilisateur.
// Modifier son propre magasin (nom, description, contact, logo) passe par
// PUT /api/vendor/store, qui retrouve le magasin depuis le jeton : les
// anciennes routes PUT /stores/:storeId et GET /stores/vendor/:vendorId
// (qui prenaient un identifiant dans l'URL) ont ete supprimees.
router.get('/followed', authMiddleware, storeController.getFollowedStores);
router.get('/search', storeController.searchStores);
router.get('/department/:departmentId', storeController.getStoresByDepartment);

router.get('/', storeController.getAllStores);
router.get('/:storeId', storeController.getStoreById);

// Suivre / ne plus suivre : l'acheteur est retrouve depuis le jeton.
router.post('/:storeId/follow', authMiddleware, storeController.followStore);
router.delete('/:storeId/follow', authMiddleware, storeController.unfollowStore);
router.get('/:storeId/is-following', authMiddleware, storeController.isFollowing);

module.exports = router;
