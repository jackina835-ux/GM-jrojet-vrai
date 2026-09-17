const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Toutes les routes exigent d'etre connecte ; le role (acheteur/vendeur)
// determine cote controleur de quel cote de la conversation on se trouve.

// Cote vendeur : liste des conversations (une par acheteur)
router.get('/conversations', authMiddleware, roleMiddleware(['vendor']), messageController.getConversations);

// Cote acheteur : nombre de messages non lus (chemin fixe, doit precéder
// /store/:storeId sinon Express le prendrait pour un storeId)
router.get('/unread-count', authMiddleware, roleMiddleware(['buyer']), messageController.getBuyerUnreadCount);

// Cote acheteur : conversation avec un magasin precis
router.get('/store/:storeId', authMiddleware, roleMiddleware(['buyer']), messageController.getStoreConversation);
router.post('/store/:storeId', authMiddleware, roleMiddleware(['buyer']), messageController.sendToStore);

// Cote vendeur : conversation avec un acheteur precis
router.get('/buyer/:buyerId', authMiddleware, roleMiddleware(['vendor']), messageController.getBuyerConversation);
router.post('/buyer/:buyerId', authMiddleware, roleMiddleware(['vendor']), messageController.sendToBuyer);

module.exports = router;
