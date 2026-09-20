const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { getJwtSecret, JWT_ALGORITHM } = require('../config/jwt');

// Journaux : jamais l'en-tete Authorization, le jeton ni son contenu decode
// (ils y restaient auparavant, "DEBUG auth: ...", et les journaux Render
// les conservent -- anomalie S4). On ne note que la CATEGORIE du rejet
// (nom de l'erreur), assez pour diagnostiquer sans rien exposer.
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token non fourni'
      });
    }

    const token = authHeader.split(' ')[1];
    // Meme secret que la signature (config/jwt.js, sans valeur de repli) et
    // algorithme impose : un jeton declarant un autre algorithme est refuse.
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });

    const user = await User.findByPk(decoded.id);
    if (!user) {
      console.warn('auth: jeton valide mais utilisateur introuvable');
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // error.name : JsonWebTokenError, TokenExpiredError, SequelizeConnectionError...
    console.warn(`auth: rejet (${error.name})`);
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

module.exports = authMiddleware;
