const { Message, Buyer, Vendor, Store, User } = require('../models');

// === ACHETEUR : conversation avec un magasin ===
exports.getStoreConversation = async (req, res) => {
  try {
    const { storeId } = req.params;

    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Acheteur non trouvé' });
    }

    const messages = await Message.findAll({
      where: { store_id: storeId, buyer_id: buyer.id },
      order: [['created_at', 'ASC']],
    });

    // Marquer comme lus les messages envoyes par le vendeur.
    await Message.update(
      { is_read: true },
      { where: { store_id: storeId, buyer_id: buyer.id, sender_role: 'vendor', is_read: false } }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get store conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la conversation' });
  }
};

// === ACHETEUR : envoyer un message a un magasin ===
exports.sendToStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Le message ne peut pas être vide' });
    }

    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Acheteur non trouvé' });
    }

    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Magasin non trouvé' });
    }

    const message = await Message.create({
      store_id: storeId,
      buyer_id: buyer.id,
      sender_role: 'buyer',
      content: content.trim(),
    });

    res.status(201).json({ success: true, message: message });
  } catch (error) {
    console.error('Send to store error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'envoi du message" });
  }
};

// === VENDEUR : liste des conversations (une par acheteur) ===
exports.getConversations = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendeur non trouvé' });
    }

    const store = await Store.findOne({ where: { vendor_id: vendor.id } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Magasin non trouvé' });
    }

    const messages = await Message.findAll({
      where: { store_id: store.id },
      include: [
        { model: Buyer, include: [{ model: User, attributes: ['id', 'name', 'avatar'] }] },
      ],
      order: [['created_at', 'DESC']],
    });

    // Regroupe par acheteur : garde le dernier message + compte des non lus
    // (envoyes par l'acheteur, pas encore lus par le vendeur).
    const conversationsByBuyer = new Map();
    for (const msg of messages) {
      const buyerId = msg.buyer_id;
      if (!conversationsByBuyer.has(buyerId)) {
        conversationsByBuyer.set(buyerId, {
          buyerId,
          buyerName: msg.Buyer?.User?.name || 'Acheteur',
          buyerAvatar: msg.Buyer?.User?.avatar || null,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        });
      }
      const conv = conversationsByBuyer.get(buyerId);
      if (msg.sender_role === 'buyer' && !msg.is_read) {
        conv.unreadCount += 1;
      }
    }

    res.json({ success: true, conversations: [...conversationsByBuyer.values()] });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des conversations' });
  }
};

// === VENDEUR : conversation avec un acheteur precis ===
exports.getBuyerConversation = async (req, res) => {
  try {
    const { buyerId } = req.params;

    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendeur non trouvé' });
    }

    const store = await Store.findOne({ where: { vendor_id: vendor.id } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Magasin non trouvé' });
    }

    const messages = await Message.findAll({
      where: { store_id: store.id, buyer_id: buyerId },
      order: [['created_at', 'ASC']],
    });

    await Message.update(
      { is_read: true },
      { where: { store_id: store.id, buyer_id: buyerId, sender_role: 'buyer', is_read: false } }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get buyer conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la conversation' });
  }
};

// === VENDEUR : envoyer un message a un acheteur ===
exports.sendToBuyer = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Le message ne peut pas être vide' });
    }

    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendeur non trouvé' });
    }

    const store = await Store.findOne({ where: { vendor_id: vendor.id } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Magasin non trouvé' });
    }

    const buyer = await Buyer.findByPk(buyerId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Acheteur non trouvé' });
    }

    const message = await Message.create({
      store_id: store.id,
      buyer_id: buyerId,
      sender_role: 'vendor',
      content: content.trim(),
    });

    res.status(201).json({ success: true, message: message });
  } catch (error) {
    console.error('Send to buyer error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'envoi du message" });
  }
};
