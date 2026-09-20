const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { upload, handleUploadError } = require('../middlewares/uploadMiddleware');
const {
  loginAccountLimiter,
  loginIpLimiter,
  registerLimiter,
  googleLimiter,
} = require('../middlewares/rateLimiter');

// Les routes publiques passent par une limitation des essais (S4) : elle
// est placee AVANT multer, pour qu'un flot de requetes ne puisse pas non
// plus envoyer de fichiers vers Cloudinary.

// ============================================
// ROUTES D'AUTHENTIFICATION
// ============================================

/**
 * @route POST /api/auth/register/buyer
 * @desc Inscription d'un acheteur
 * @access Public
 */
router.post('/register/buyer', registerLimiter, authController.registerBuyer);

/**
 * @route POST /api/auth/register/vendor
 * @desc Inscription d'un vendeur (avec upload du droit de bail)
 * @access Public
 */
router.post(
  '/register/vendor',
  registerLimiter,
  upload.single('droitBail'),
  handleUploadError,
  authController.registerVendor
);

/**
 * @route POST /api/auth/login
 * @desc Connexion utilisateur (5 echecs / 15 min par IP+email, 100 par IP)
 * @access Public
 */
router.post('/login', loginIpLimiter, loginAccountLimiter, authController.login);

/**
 * @route POST /api/auth/google/verify
 * @desc Connexion Google : verification du jeton d'identite Google
 * @access Public
 */
router.post('/google/verify', googleLimiter, authController.verifyGoogle);

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
