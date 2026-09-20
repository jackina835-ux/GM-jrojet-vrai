// config/jwt.js
//
// Point UNIQUE de lecture du secret de signature des jetons JWT. Avant, le
// secret etait lu a deux endroits qui n'etaient pas d'accord : la signature
// (authController) retombait sur une valeur ecrite en clair dans le code
// quand JWT_SECRET etait absent, alors que la verification (authMiddleware)
// lisait JWT_SECRET seul. Un secret de repli public permet a n'importe qui
// de fabriquer un jeton valide. Il n'y en a donc plus : sans JWT_SECRET, le
// serveur REFUSE de demarrer (voir assertJwtSecret, appele par server.js).
//
// Generer un bon secret (a coller dans la variable JWT_SECRET de Render et
// du .env local) :
//   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
// Attention : changer le secret invalide tous les jetons deja emis -- les
// utilisateurs doivent se reconnecter.

// Ancien secret de repli, public depuis le depot : refuse s'il est encore
// utilise comme valeur reelle de JWT_SECRET.
const LEGACY_PUBLIC_SECRET = 'grand_marche_secret_key_2024';
const MIN_RECOMMENDED_LENGTH = 32;

// Algorithme impose a la signature ET a la verification (empeche d'accepter
// un jeton declarant un autre algorithme, y compris "none").
const JWT_ALGORITHM = 'HS256';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || !secret.trim()) {
    throw new Error(
      'JWT_SECRET est absent : definissez cette variable d\'environnement (Render / .env) avant de demarrer le serveur.'
    );
  }

  if (secret === LEGACY_PUBLIC_SECRET) {
    throw new Error(
      'JWT_SECRET vaut l\'ancien secret public du code source : choisissez une nouvelle valeur aleatoire.'
    );
  }

  return secret;
}

// Appele une fois au demarrage : echoue tout de suite et clairement plutot
// que de laisser tourner un serveur qui signe ou refuse des jetons a tort.
function assertJwtSecret() {
  const secret = getJwtSecret();
  if (secret.length < MIN_RECOMMENDED_LENGTH) {
    console.warn(
      `⚠️  JWT_SECRET est court (${secret.length} caracteres, ${MIN_RECOMMENDED_LENGTH} recommandes) : preferez une valeur aleatoire plus longue.`
    );
  }
}

module.exports = { getJwtSecret, assertJwtSecret, JWT_ALGORITHM };
