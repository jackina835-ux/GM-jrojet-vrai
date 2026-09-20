const { OAuth2Client } = require('google-auth-library');
const dotenv = require('dotenv');
const { maskEmail } = require('../utils/logSafe');

dotenv.config();

// Vérifier que GOOGLE_CLIENT_ID est défini
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!CLIENT_ID) {
  console.warn('⚠️  GOOGLE_CLIENT_ID non défini dans .env');
  console.warn('⚠️  La connexion Google ne fonctionnera pas');
}

const client = new OAuth2Client(CLIENT_ID);

const verifyGoogleToken = async (token) => {
  try {
    console.log('🔑 Vérification du token avec Google...');
    
    if (!CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID non configuré');
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    console.log('✅ Token Google vérifié pour:', maskEmail(payload.email));
    
    return {
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        // Google garantit que l'adresse appartient bien a cette personne
        // seulement si email_verified est vrai : c'est ce booleen que
        // authController exige avant de connecter ou d'inscrire quelqu'un.
        emailVerified: payload.email_verified === true,
      }
    };
  } catch (error) {
    // Le message d'erreur de google-auth-library peut CONTENIR le jeton
    // recu ("Wrong number of segments in token: ...") : on ne journalise
    // que le type d'erreur, et on ne renvoie qu'un message generique.
    console.error(`❌ Erreur verifyGoogleToken (${error.name})`);
    return {
      success: false,
      error: 'Jeton Google invalide'
    };
  }
};

module.exports = { verifyGoogleToken };