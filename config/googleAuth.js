const { OAuth2Client } = require('google-auth-library');
const dotenv = require('dotenv');

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
    console.log('✅ Token vérifié pour:', payload.email);
    
    return {
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      }
    };
  } catch (error) {
    console.error('❌ Erreur verifyGoogleToken:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { verifyGoogleToken };