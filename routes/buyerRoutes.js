const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');
const authMiddleware = require('../middlewares/authMiddleware');

// ============================================
// PROFIL
// ============================================
router.get('/profile', authMiddleware, buyerController.getProfile);
router.put('/profile', authMiddleware, buyerController.updateProfile);

// ============================================
// COMMANDES
// ============================================
router.get('/orders', authMiddleware, buyerController.getOrders);
router.get('/orders/:id', authMiddleware, buyerController.getOrderDetails);

// ============================================
// PANIER
// ============================================
router.get('/cart', authMiddleware, buyerController.getCart);
router.post('/cart', authMiddleware, buyerController.addToCart);
router.put('/cart/:id', authMiddleware, buyerController.updateCartItem);
router.delete('/cart/:id', authMiddleware, buyerController.removeFromCart);
router.delete('/cart', authMiddleware, buyerController.clearCart);

// ============================================
// FAVORIS
// ============================================
router.get('/favorites', authMiddleware, buyerController.getFavorites);
router.post('/favorites/:storeId', authMiddleware, buyerController.addFavorite);
router.delete('/favorites/:storeId', authMiddleware, buyerController.removeFavorite);

module.exports = router;
