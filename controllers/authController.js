const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Buyer, Vendor, Store } = require('../models');
const { verifyGoogleToken } = require('../config/googleAuth');
const { getJwtSecret, JWT_ALGORITHM } = require('../config/jwt');
const { maskEmail } = require('../utils/logSafe');

// Journaux : jamais de corps de requete, de mot de passe, de jeton ni
// d'email complet (les journaux Render les conservent -- anomalie S4,
// corrigee le 20/09/2026). On note l'id utilisateur ou un email masque.
// Les reponses d'erreur ne renvoient plus le message interne (erreur SQL,
// validation...) hors mode developpement.
const internalError = (error) =>
  process.env.NODE_ENV === 'development' ? error.message : undefined;

// Ancienne convention du projet : "google_oauth" servait de mot de passe
// pour les comptes Google, et login() delivrait un jeton a quiconque
// l'envoyait -- une porte derobee (anomalie S1, corrigee le 20/09/2026).
// Cette valeur n'est plus jamais acceptee comme mot de passe.
const RETIRED_GOOGLE_PASSWORD = 'google_oauth';
const MIN_PASSWORD_LENGTH = 6;

// ✅ GÉNÉRER LE TOKEN JWT
// Secret lu par config/jwt.js : plus de valeur de repli ecrite dans le code.
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d', algorithm: JWT_ALGORITHM }
  );
};

// ✅ IDENTITE D'UNE INSCRIPTION (acheteur ou vendeur)
//
// Une identite ne peut venir que de deux sources :
// - un email + mot de passe saisis (le mot de passe est alors obligatoire) ;
// - un jeton Google (googleToken) VERIFIE par le serveur aupres de Google :
//   email, nom, photo et identifiant Google viennent alors du jeton verifie.
// Un googleId, un avatar ou un email "Google" envoyes dans le corps sont
// IGNORES : le client n'est jamais cru sur parole. Avant ce correctif, il
// suffisait d'envoyer googleId pour creer un compte sans mot de passe.
//
// Renvoie { identity } ou { error: { status, message } }.
const resolveRegistrationIdentity = async (body) => {
  const { googleToken, email, password, name } = body;

  if (googleToken) {
    const verified = await verifyGoogleToken(googleToken);
    if (!verified.success || !verified.user.emailVerified) {
      return {
        error: { status: 401, message: 'Jeton Google invalide ou adresse email non vérifiée' }
      };
    }
    return {
      identity: {
        email: verified.user.email,
        name: verified.user.name || name,
        avatar: verified.user.picture || null,
        googleId: verified.user.id,
        // Mot de passe aleatoire jamais communique : un compte Google ne se
        // connecte que par Google (comparePassword renvoie false pour lui).
        password: crypto.randomBytes(32).toString('hex')
      }
    };
  }

  if (!email || !password) {
    return { error: { status: 400, message: 'Email et mot de passe requis' } };
  }
  if (password === RETIRED_GOOGLE_PASSWORD) {
    return { error: { status: 400, message: 'Ce mot de passe n\'est pas autorisé' } };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: {
        status: 400,
        message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`
      }
    };
  }

  return { identity: { email, name, avatar: null, googleId: null, password } };
};

// ✅ CONSTRUIRE L'OBJET UTILISATEUR RENVOYÉ AU FRONT (avec profil acheteur/vendeur)
//
// Avant ce correctif, /login et /me ne renvoyaient que les champs de base de
// User, sans le profil Buyer/Vendor associé. Résultat : le front (RootNavigator)
// ne pouvait jamais savoir si un vendeur avait déjà configuré son magasin, et
// "Mes commandes" côté acheteur n'avait pas d'ID Buyer à interroger.
const buildUserPayload = async (user) => {
  const base = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
  };

  if (user.role === 'buyer') {
    const buyer = await Buyer.findOne({ where: { user_id: user.id } });
    if (buyer) {
      base.buyer = {
        id: buyer.id,
        address: buyer.address,
        phone: buyer.phone,
        isVerified: buyer.is_verified,
      };
    }
  }

  if (user.role === 'vendor') {
    const vendor = await Vendor.findOne({ where: { user_id: user.id } });
    if (vendor) {
      const store = await Store.findOne({ where: { vendor_id: vendor.id } });
      base.vendor = {
        id: vendor.id,
        firstName: vendor.first_name,
        lastName: vendor.last_name,
        contact: vendor.contact,
        isPaid: vendor.is_paid,
        isVerified: vendor.is_verified,
        status: vendor.status,
        store: store
          ? {
              id: store.id,
              name: store.name,
              logo: store.logo,
              departmentId: store.department_id,
            }
          : null,
      };
    }
  }

  return base;
};

// ✅ INSCRIPTION ACHETEUR
exports.registerBuyer = async (req, res) => {
  try {
    console.log('📝 Inscription acheteur...');

    const resolved = await resolveRegistrationIdentity(req.body);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message
      });
    }
    const { identity } = resolved;

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ where: { email: identity.email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      email: identity.email,
      password: identity.password,
      name: identity.name || identity.email.split('@')[0],
      avatar: identity.avatar,
      role: 'buyer',
      google_id: identity.googleId,
      is_active: true
    });

    // Créer le profil acheteur
    await Buyer.create({
      user_id: user.id,
      is_verified: true
    });

    const token = generateToken(user);

    console.log('✅ Acheteur créé: id', user.id);

    res.status(201).json({
      success: true,
      token,
      user: await buildUserPayload(user)
    });
  } catch (error) {
    console.error('❌ Register buyer error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: internalError(error)
    });
  }
};

// ✅ INSCRIPTION VENDEUR
//
// Inscription GRATUITE (plus de paiement, plus de numéro de CIN demandé).
// Le document "droit de bail" reste, lui, une condition OBLIGATOIRE — mais
// aucun écran ne permet encore de le fournir, donc l'inscription vendeur
// échoue volontairement à cette étape pour l'instant. C'est un choix
// assumé (fonctionnalité à activer plus tard), pas un bug à corriger.
exports.registerVendor = async (req, res) => {
  try {
    // (Le corps de la requete etait journalise ici, MOT DE PASSE EN CLAIR
    // compris : supprime, voir S4.)
    console.log('📝 Inscription vendeur...');

    const { firstName, lastName, contact } = req.body;

    const resolved = await resolveRegistrationIdentity(req.body);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message
      });
    }
    const { identity } = resolved;

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ where: { email: identity.email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Le droit de bail reste obligatoire et volontairement bloqué : aucun
    // écran ne permet encore de le fournir, donc cette vérification arrête
    // systématiquement l'inscription à ce stade, par choix assumé.
    // req.file.path est deja l'URL Cloudinary complete (voir uploadMiddleware.js).
    const droitBail = req.file ? req.file.path : null;
    if (!droitBail) {
      return res.status(400).json({
        success: false,
        message: 'Le droit de bail est requis'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      email: identity.email,
      password: identity.password,
      name: identity.name || `${firstName || ''} ${lastName || ''}`.trim() || identity.email.split('@')[0],
      avatar: identity.avatar,
      role: 'vendor',
      google_id: identity.googleId,
      is_active: true
    });

    // Créer le profil vendeur — gratuit dès le départ : pas de paiement,
    // pas de vérification manuelle requise pour démarrer.
    await Vendor.create({
      user_id: user.id,
      first_name: firstName || '',
      last_name: lastName || '',
      contact: contact || '',
      droit_bail: droitBail,
      is_paid: true,
      is_verified: true,
      status: 'approved'
    });

    const token = generateToken(user);

    console.log('✅ Vendeur créé (inscription gratuite): id', user.id);

    res.status(201).json({
      success: true,
      token,
      user: await buildUserPayload(user)
    });
  } catch (error) {
    console.error('❌ Register vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription du vendeur',
      error: internalError(error)
    });
  }
};

// ✅ CONNEXION (email + mot de passe UNIQUEMENT)
//
// La connexion Google passe par POST /auth/google/verify (jeton verifie).
// Plus aucune valeur de mot de passe ne donne un acces sans verification.
exports.login = async (req, res) => {
  try {
    console.log('🔐 Tentative de connexion:', maskEmail(req.body.email));
    const { email, password } = req.body;

    if (!email || !password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Anciens comptes dont le mot de passe reel serait litteralement
    // "google_oauth" (creation via l'ancienne inscription) : n'importe qui
    // pourrait le deviner, on refuse cette valeur meme si le hash concorde.
    // Meme message que pour un mauvais mot de passe.
    if (password === RETIRED_GOOGLE_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // comparePassword renvoie toujours false pour un compte Google.
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const token = generateToken(user);
    console.log('✅ Connexion réussie: id', user.id);

    res.json({
      success: true,
      token,
      user: await buildUserPayload(user)
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};

// ✅ CONNEXION GOOGLE (POST /auth/google/verify)
//
// Le client envoie le jeton d'identite Google ({ token }) ; le serveur le
// verifie aupres de Google, puis :
// - compte Google deja lie a CETTE identite Google -> jeton de session ;
// - aucun compte avec cet email -> exists:false + profil verifie, pour que
//   l'app propose l'inscription (POST /auth/register/buyer avec googleToken) ;
// - compte existant par mot de passe -> 409 (pas de liaison automatique :
//   sinon quiconque controle l'adresse chez Google reprendrait le compte).
// Un jeton de session n'est JAMAIS delivre sans jeton Google verifie.
exports.verifyGoogle = async (req, res) => {
  try {
    const { token } = req.body;

    console.log('🔑 Vérification token Google reçu');

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token Google manquant'
      });
    }

    // Vérifier le token avec Google
    const result = await verifyGoogleToken(token);

    if (!result.success || !result.user.emailVerified) {
      console.error('❌ Vérification Google échouée:', result.error || 'email non vérifié');
      return res.status(401).json({
        success: false,
        message: 'Jeton Google invalide ou adresse email non vérifiée'
      });
    }

    console.log('✅ Utilisateur Google vérifié:', maskEmail(result.user.email));

    const user = await User.findOne({ where: { email: result.user.email } });

    if (!user) {
      console.log('📝 Nouvel utilisateur Google:', maskEmail(result.user.email));
      return res.json({
        success: true,
        exists: false,
        user: {
          email: result.user.email,
          name: result.user.name,
          picture: result.user.picture
        }
      });
    }

    if (!user.google_id) {
      return res.status(409).json({
        success: false,
        message: 'Un compte existe déjà avec cet email : connectez-vous avec votre mot de passe.'
      });
    }

    if (user.google_id !== result.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Ce compte est lié à une autre identité Google'
      });
    }

    console.log('👤 Connexion Google: id', user.id);
    res.json({
      success: true,
      exists: true,
      token: generateToken(user),
      user: await buildUserPayload(user)
    });

  } catch (error) {
    console.error('❌ Erreur verifyGoogle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification Google'
    });
  }
};

// ✅ RÉCUPÉRER LE PROFIL
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'name', 'avatar', 'role', 'is_active']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      user: await buildUserPayload(user)
    });
  } catch (error) {
    console.error('❌ Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

// ✅ STATUT DU VENDEUR
exports.vendorStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendeur non trouvé'
      });
    }

    res.json({
      success: true,
      isVerified: vendor.is_verified,
      hasPaid: vendor.is_paid,
      status: vendor.status
    });
  } catch (error) {
    console.error('❌ Vendor status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut'
    });
  }
};
