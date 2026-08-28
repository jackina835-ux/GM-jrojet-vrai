const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/store/:storeId', authMiddleware, stockController.getStoreStock);
router.get('/vendor/:vendorId', authMiddleware, stockController.getVendorStock);
router.post('/', authMiddleware, stockController.addStockItem);
router.put('/:id', authMiddleware, stockController.updateStockItem);
router.delete('/:id', authMiddleware, stockController.deleteStockItem);
router.get('/categories/:storeId', authMiddleware, stockController.getStockCategories);
router.get('/search', authMiddleware, stockController.searchStock);
router.post('/check', authMiddleware, stockController.checkAvailability);

module.exports = router;