const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/vendor/:vendorId', authMiddleware, statsController.getVendorStats);
router.get('/chart/:vendorId', authMiddleware, statsController.getSalesChart);
router.get('/departments', authMiddleware, statsController.getDepartmentStats);
router.get('/store/:storeId', authMiddleware, statsController.getStoreStats);
router.get('/publications/:vendorId', authMiddleware, statsController.getPublicationStats);
router.get('/top-products/:vendorId', authMiddleware, statsController.getTopProducts);
router.get('/revenue/:vendorId', authMiddleware, statsController.getRevenueStats);
router.get('/visitors/:storeId', authMiddleware, statsController.getVisitorStats);
router.get('/conversion/:storeId', authMiddleware, statsController.getConversionStats);

module.exports = router;