const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireStore, loadActor } = require('../middlewares/actorMiddleware');

// Le stock est PRIVE au vendeur : toutes ces routes travaillent sur le
// magasin du vendeur connecte (req.store, tire du jeton). Plus aucun
// storeId / vendorId dans l'URL ou le corps.
router.get('/', authMiddleware, ...requireStore, stockController.getMyStock);
router.get('/categories', authMiddleware, ...requireStore, stockController.getStockCategories);
router.get('/search', authMiddleware, ...requireStore, stockController.searchStock);
router.post('/', authMiddleware, ...requireStore, stockController.addStockItem);
router.put('/:id', authMiddleware, ...requireStore, stockController.updateStockItem);
router.delete('/:id', authMiddleware, ...requireStore, stockController.deleteStockItem);

// Lecture seule de la quantite disponible d'un article (ouverte a tout
// utilisateur connecte : un acheteur en a besoin avant de commander).
router.post('/check', authMiddleware, loadActor, stockController.checkAvailability);

module.exports = router;
