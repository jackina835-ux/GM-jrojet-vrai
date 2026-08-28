const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');

// ============================================
// ROUTES D'AUTHENTIFICATION
// ============================================

/**
 * @route POST /api/auth/register/buyer
 * @desc Inscription d'un acheteur
 * @access Public
 */
router.post('/register/buyer', authController.registerBuyer);

/**
 * @route POST /api/auth/register/vendor
 * @desc Inscription d'un vendeur (avec upload du droit de bail)
 * @access Public
 */
router.post(
  '/register/vendor',
  upload.single('droitBail'),
  handleUploadError,
  authController.registerVendor
);

/**
 * @route POST /api/auth/login
 * @desc Connexion utilisateur
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/google/verify
 * @desc Vérification du token Google
 * @access Public
 */
router.post('/google/verify', authController.verifyGoogle);

/**
 * @route GET /api/auth/me
 * @desc Récupérer le profil de l'utilisateur connecté
 * @access Private
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @route GET /api/auth/vendor/status
 * @desc Récupérer le statut du vendeur
 * @access Private (vendeur uniquement)
 */
router.get('/vendor/status', authMiddleware, authController.vendorStatus);

module.exports = router;