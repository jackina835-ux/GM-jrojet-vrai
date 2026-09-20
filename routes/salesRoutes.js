const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireStore } = require('../middlewares/actorMiddleware');

// Les ventes sont PRIVEES au vendeur : toutes ces routes travaillent sur le
// magasin du vendeur connecte (req.store, tire du jeton). Plus aucun
// vendorId / storeId dans l'URL ou le corps.
router.post('/', authMiddleware, ...requireStore, salesController.recordSale);
router.get('/', authMiddleware, ...requireStore, salesController.getMySales);
router.get('/stats', authMiddleware, ...requireStore, salesController.getSaleStats);
router.get('/export', authMiddleware, ...requireStore, salesController.exportSales);
router.get('/product/:productId', authMiddleware, ...requireStore, salesController.getProductSales);
router.put('/:id', authMiddleware, ...requireStore, salesController.updateSale);
router.delete('/:id', authMiddleware, ...requireStore, salesController.deleteSale);

module.exports = router;
