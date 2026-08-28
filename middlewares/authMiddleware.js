const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('DEBUG auth: pas de header Authorization ou mauvais format ->', authHeader);
      return res.status(401).json({
        success: false,
        message: 'Token non fourni'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('DEBUG auth: token décodé ->', decoded);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      console.log('DEBUG auth: aucun utilisateur trouvé pour id ->', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('DEBUG auth: erreur de vérification du token ->', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

module.exports = authMiddleware;