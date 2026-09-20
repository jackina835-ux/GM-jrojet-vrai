// middlewares/actorMiddleware.js
//
// Retrouve l'acheteur / le vendeur / le magasin de l'utilisateur connecte
// A PARTIR DU JETON (req.user, pose par authMiddleware) et les attache a la
// requete : req.buyer, req.vendor, req.store.
//
// REGLE : un controleur ne lit JAMAIS l'identite de l'acteur (buyerId,
// vendorId, storeId du vendeur connecte) dans le corps ou l'URL de la
// requete -- un client pourrait y mettre l'identifiant de quelqu'un
// d'autre. Il utilise req.buyer / req.vendor / req.store. Les identifiants
// de la CONTREPARTIE (le magasin qu'un acheteur consulte, l'acheteur avec
// qui un vendeur discute) restent en revanche des entrees legitimes, mais
// leur acces doit etre verifie. Voir CLAUDE.md section 5.12.
const { Buyer, Vendor, Store, Publication } = require('../models');
const roleMiddleware = require('./roleMiddleware');

// Attache l'acteur correspondant au role du jeton (sans rien exiger).
const loadActor = async (req, res, next) => {
  try {
    if (req.user.role === 'buyer') {
      req.buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    } else if (req.user.role === 'vendor') {
      req.vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
      req.store = req.vendor
        ? await Store.findOne({ where: { vendor_id: req.vendor.id } })
        : null;
    }
    next();
  } catch (error) {
    console.error('Load actor error:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'identification de l'utilisateur"
    });
  }
};

const needBuyer = (req, res, next) => {
  if (!req.buyer) {
    return res.status(404).json({ success: false, message: 'Acheteur non trouvé' });
  }
  next();
};

const needVendor = (req, res, next) => {
  if (!req.vendor) {
    return res.status(404).json({ success: false, message: 'Vendeur non trouvé' });
  }
  next();
};

const needStore = (req, res, next) => {
  if (!req.store) {
    return res.status(404).json({ success: false, message: 'Magasin non trouvé' });
  }
  next();
};

// A utiliser APRES authMiddleware, en "spread" :
//   router.post('/', authMiddleware, ...requireStore, controller.action);
const requireBuyer = [roleMiddleware(['buyer']), loadActor, needBuyer];
const requireVendor = [roleMiddleware(['vendor']), loadActor, needVendor];
const requireStore = [roleMiddleware(['vendor']), loadActor, needVendor, needStore];

// A placer APRES requireStore, sur les routes /publications/:id. Verifie
// que la publication visee appartient au magasin du vendeur connecte, et
// s'execute AVANT l'upload multer : une publication d'autrui est refusee
// (404) sans qu'aucune photo ne parte vers Cloudinary.
const requireOwnPublication = async (req, res, next) => {
  try {
    const publication = await Publication.findOne({
      where: { id: req.params.id, store_id: req.store.id }
    });
    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publication non trouvée' });
    }
    req.publication = publication;
    next();
  } catch (error) {
    console.error('Own publication check error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la publication'
    });
  }
};

module.exports = { loadActor, requireBuyer, requireVendor, requireStore, requireOwnPublication };
