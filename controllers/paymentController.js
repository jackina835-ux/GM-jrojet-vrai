const { Order, Store } = require('../models');
const Account = require('../models/StorePaymentAccount');
const { PROVIDERS, normalizePhone } = require('../utils/mobileMoney');

// Aucun secret operateur, code PIN ou transfert simule.
// Enregistrer un numero ne verifie pas la propriete du portefeuille.
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await Account.findAll({ where: { store_id: req.store.id }, attributes: ['provider', 'phone'] });
    return res.json({ success: true, accounts, automaticPaymentAvailable: false });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Les coordonnées de paiement sont temporairement indisponibles.' });
  }
};

exports.saveAccount = async (req, res) => {
  const { provider, phone } = req.body || {};
  const normalized = normalizePhone(phone);
  if (!PROVIDERS.includes(provider) || !normalized) {
    return res.status(400).json({ success: false, message: 'Choisissez un opérateur et un numéro malgache valide (03… ou +261…).' });
  }
  try {
    await Account.upsert({ store_id: req.store.id, provider, phone: normalized });
    return res.json({ success: true, account: { provider, phone: normalized }, automaticPaymentAvailable: false });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Enregistrement impossible. Réessayez plus tard.' });
  }
};

exports.deleteAccount = async (req, res) => {
  if (!PROVIDERS.includes(req.params.provider)) return res.status(400).json({ success: false, message: 'Opérateur inconnu.' });
  try {
    await Account.destroy({ where: { store_id: req.store.id, provider: req.params.provider } });
    return res.json({ success: true });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Suppression impossible. Réessayez plus tard.' });
  }
};

exports.getOrderOptions = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.orderId, buyer_id: req.buyer.id },
      include: [{ model: Store, attributes: ['id', 'name'] }],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    if (order.status === 'cancelled') return res.status(409).json({ success: false, message: 'Cette commande est annulée.' });
    const accounts = await Account.findAll({ where: { store_id: order.store_id }, attributes: ['provider', 'phone'] });
    return res.json({
      success: true,
      order: { id: order.id, total: order.total, currency: 'MGA', storeName: order.Store?.name || 'Magasin' },
      providers: PROVIDERS.map(provider => {
        const account = accounts.find(item => item.provider === provider);
        return { provider, registered: !!account, maskedPhone: account ? `•••• ${account.phone.slice(-4)}` : null };
      }),
      automaticPaymentAvailable: false,
      message: 'Le paiement Mobile Money sera disponible après activation auprès des opérateurs. Aucun montant ne sera débité ici.',
    });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Les informations de paiement sont temporairement indisponibles.' });
  }
};
