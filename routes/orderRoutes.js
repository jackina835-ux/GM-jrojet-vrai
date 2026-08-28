const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, orderController.createOrder);
router.get('/buyer/:buyerId', authMiddleware, orderController.getBuyerOrders);
router.get('/vendor/:vendorId', authMiddleware, orderController.getVendorOrders);
router.get('/vendor/:vendorId/pending', authMiddleware, orderController.getPendingOrders);
router.put('/:id', authMiddleware, orderController.updateOrder);
router.post('/:id/cancel', authMiddleware, orderController.cancelOrder);
router.post('/:id/validate', authMiddleware, orderController.validateOrder);
router.post('/:id/deliver', authMiddleware, orderController.markDelivered);
router.get('/:id', authMiddleware, orderController.getOrderDetails);

module.exports = router;