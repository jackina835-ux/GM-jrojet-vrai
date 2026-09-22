const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const { requireStore, requireBuyer } = require('../middlewares/actorMiddleware');
const controller = require('../controllers/paymentController');

router.get('/accounts', auth, ...requireStore, controller.getAccounts);
router.put('/accounts', auth, ...requireStore, controller.saveAccount);
router.delete('/accounts/:provider', auth, ...requireStore, controller.deleteAccount);
router.get('/orders/:orderId/options', auth, ...requireBuyer, controller.getOrderOptions);
module.exports = router;
