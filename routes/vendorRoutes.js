const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireStore } = require('../middlewares/actorMiddleware');
const storeServicesController = require('../controllers/storeServicesController');
router.get('/store/services', authMiddleware, ...requireStore, storeServicesController.get);
router.put('/store/services', authMiddleware, ...requireStore, storeServicesController.update);
// ✅ IMPORT CORRECT AVEC LES CROCHETS
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// Profil vendeur
router.get('/profile', authMiddleware, vendorController.getProfile);
router.put('/profile', authMiddleware, vendorController.updateProfile);

// Gestion du magasin - ✅ CORRIGÉ
// requireStore AVANT multer : un compte qui n'est pas vendeur (ou sans
// magasin) ne peut rien envoyer vers Cloudinary. Le magasin modifie est
// toujours celui du jeton.
router.put('/store', authMiddleware, ...requireStore, upload.single('logo'), handleUploadError, vendorController.updateStore);
router.get('/store', authMiddleware, vendorController.getStore);

// Commandes vendeur
router.get('/orders', authMiddleware, vendorController.getOrders);
router.get('/orders/pending', authMiddleware, vendorController.getPendingOrders);
router.put('/orders/:id/status', authMiddleware, vendorController.updateOrderStatus);

// Statistiques vendeur
router.get('/stats', authMiddleware, vendorController.getStats);
router.get('/stats/sales', authMiddleware, vendorController.getSalesStats);

// Paiement
router.post('/payment', authMiddleware, vendorController.processPayment);
router.get('/payment/status', authMiddleware, vendorController.getPaymentStatus);

// Validation admin
router.post('/validate', authMiddleware, vendorController.requestValidation);
router.get('/validation/status', authMiddleware, vendorController.getValidationStatus);

module.exports = router;
