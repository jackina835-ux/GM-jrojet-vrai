const StoreServices = require('../models/StoreServices');
const ensureTable = require('../utils/storeServicesTable');

exports.get = async (req, res) => {
  try {
    await ensureTable();
    const services = await StoreServices.findByPk(req.store.id);
    return res.json({ success: true, services });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Informations du magasin indisponibles. Réessayez.' });
  }
};

exports.update = async (req, res) => {
  const body = req.body || {};
  const updates = {};
  for (const key of ['is_online', 'delivery_enabled']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (typeof body[key] !== 'boolean') return res.status(400).json({ success: false, message: 'Le statut doit être activé ou désactivé.' });
      updates[key] = body[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'headquarters_address')) {
    if (typeof body.headquarters_address !== 'string' || body.headquarters_address.trim().length > 300) {
      return res.status(400).json({ success: false, message: 'L’adresse du siège doit contenir au maximum 300 caractères.' });
    }
    updates.headquarters_address = body.headquarters_address.trim();
  }
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'Aucune information à modifier.' });
  try {
    await ensureTable();
    // Identite du magasin issue du jeton uniquement. Les changements partiels
    // preservent les autres champs (adresse, livraison, presence).
    await StoreServices.findOrCreate({ where: { store_id: req.store.id }, defaults: { store_id: req.store.id } });
    await StoreServices.update(updates, { where: { store_id: req.store.id } });
    const services = await StoreServices.findByPk(req.store.id);
    return res.json({ success: true, services });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Enregistrement impossible. Réessayez.' });
  }
};
