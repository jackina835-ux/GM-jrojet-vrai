const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, salesController.recordSale);
router.get('/vendor/:vendorId', authMiddleware, salesController.getVendorSales);
router.get('/store/:storeId', authMiddleware, salesController.getStoreSales);
router.get('/product/:productId', authMiddleware, salesController.getProductSales);
router.put('/:id', authMiddleware, salesController.updateSale);
router.delete('/:id', authMiddleware, salesController.deleteSale);
router.get('/stats/:vendorId', authMiddleware, salesController.getSaleStats);
router.get('/export/:vendorId', authMiddleware, salesController.exportSales);

module.exports = router;