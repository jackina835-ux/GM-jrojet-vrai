const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireBuyer, requireStore, loadActor } = require('../middlewares/actorMiddleware');

// L'acheteur / le vendeur / le magasin viennent du jeton (req.buyer,
// req.store) : plus aucun buyerId / vendorId dans l'URL ou le corps.
// Les chemins fixes (/buyer, /vendor, /vendor/pending) restent AVANT /:id.
router.post('/', authMiddleware, ...requireBuyer, orderController.createOrder);
router.get('/buyer', authMiddleware, ...requireBuyer, orderController.getBuyerOrders);
router.get('/vendor', authMiddleware, ...requireStore, orderController.getVendorOrders);
router.get('/vendor/pending', authMiddleware, ...requireStore, orderController.getPendingOrders);

router.put('/:id', authMiddleware, ...requireBuyer, orderController.updateOrder);
router.post('/:id/validate', authMiddleware, ...requireStore, orderController.validateOrder);
router.post('/:id/deliver', authMiddleware, ...requireStore, orderController.markDelivered);

// Acheteur proprietaire OU magasin destinataire : le controleur verifie.
router.post('/:id/cancel', authMiddleware, loadActor, orderController.cancelOrder);
router.get('/:id', authMiddleware, loadActor, orderController.getOrderDetails);

module.exports = router;
