const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { requireStore } = require('../middlewares/actorMiddleware');

// Les statistiques d'un magasin sont PRIVEES a son vendeur : toutes ces
// routes travaillent sur le magasin du jeton (req.store). Plus aucun
// vendorId / storeId dans l'URL.
router.get('/vendor', authMiddleware, ...requireStore, statsController.getVendorStats);
router.get('/chart', authMiddleware, ...requireStore, statsController.getSalesChart);
router.get('/store', authMiddleware, ...requireStore, statsController.getStoreStats);
router.get('/publications', authMiddleware, ...requireStore, statsController.getPublicationStats);
router.get('/top-products', authMiddleware, ...requireStore, statsController.getTopProducts);
router.get('/revenue', authMiddleware, ...requireStore, statsController.getRevenueStats);
router.get('/visitors', authMiddleware, ...requireStore, statsController.getVisitorStats);
router.get('/conversion', authMiddleware, ...requireStore, statsController.getConversionStats);

// Chiffre d'affaires de TOUS les departements : donnee de plateforme, qui
// exposerait les ventes d'autres magasins (un departement = un magasin).
// Reservee au role "admin", qui n'existe pas encore (voir CLAUDE.md B9) :
// route donc inaccessible pour l'instant, volontairement.
router.get('/departments', authMiddleware, roleMiddleware(['admin']), statsController.getDepartmentStats);

module.exports = router;
