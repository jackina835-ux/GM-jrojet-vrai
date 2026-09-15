const jwt = require('jsonwebtoken');
const { User, Buyer, Vendor, Store } = require('../models');
const { verifyGoogleToken } = require('../config/googleAuth');
const bcrypt = require('bcryptjs');

// ✅ GÉNÉRER LE TOKEN JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'grand_marche_secret_key_2024',
    { expiresIn: '7d' }
  );
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
    const { email, password, name, googleId, avatar } = req.body;

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      email,
      password: password || 'google_oauth',
      name: name || email.split('@')[0],
      avatar: avatar || null,
      role: 'buyer',
      google_id: googleId || null,
      is_active: true
    });

    // Créer le profil acheteur
    await Buyer.create({
      user_id: user.id,
      is_verified: true
    });

    const token = generateToken(user);
    
    console.log('✅ Acheteur créé:', user.email);
    
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
      error: error.message
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
    console.log('📝 Inscription vendeur...');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const {
      email,
      password,
      name,
      firstName,
      lastName,
      contact,
      googleId,
      avatar
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Le droit de bail reste obligatoire et volontairement bloqué : aucun
    // écran ne permet encore de le fournir, donc cette vérification arrête
    // systématiquement l'inscription à ce stade, par choix assumé.
    const droitBail = req.file ? '/' + req.file.path.replace(/\\/g, '/') : null;
    if (!droitBail) {
      return res.status(400).json({
        success: false,
        message: 'Le droit de bail est requis'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      email,
      password: password || 'google_oauth',
      name: name || `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
      avatar: avatar || null,
      role: 'vendor',
      google_id: googleId || null,
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
    
    console.log('✅ Vendeur créé (inscription gratuite):', user.email);

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
      error: error.message
    });
  }
};

// ✅ CONNEXION
exports.login = async (req, res) => {
  try {
    console.log('🔐 Connexion:', req.body.email);
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Si c'est un compte Google (password = 'google_oauth')
    if (password === 'google_oauth') {
      // Connexion automatique pour Google
      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: await buildUserPayload(user)
      });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const token = generateToken(user);
    console.log('✅ Connexion réussie:', user.email);

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

// ✅ VÉRIFICATION GOOGLE
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
    
    if (!result.success) {
      console.error('❌ Vérification Google échouée:', result.error);
      return res.status(401).json({
        success: false,
        message: result.error || 'Token Google invalide'
      });
    }

    console.log('✅ Utilisateur vérifié:', result.user.email);

    // Vérifier si l'utilisateur existe déjà
    let user = await User.findOne({ 
      where: { email: result.user.email } 
    });

    if (user) {
      console.log('👤 Utilisateur trouvé:', user.email);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role
        },
        exists: true
      });
    }

    console.log('📝 Nouvel utilisateur:', result.user.email);
    res.json({
      success: true,
      user: result.user,
      exists: false
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
