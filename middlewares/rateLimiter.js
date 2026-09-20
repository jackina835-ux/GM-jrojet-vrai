// middlewares/rateLimiter.js
//
// Limitation du nombre d'essais (anomalie S4, corrigee le 20/09/2026) :
// empeche de deviner un mot de passe par essais massifs, et de saturer
// l'inscription. Fait maison, en memoire, sans dependance.
//
// LIMITES A CONNAITRE :
// - Les compteurs vivent dans la memoire du processus : ils repartent a
//   zero a chaque redemarrage / mise en veille de Render. Cela suffit
//   contre un essai massif, pas contre un attaquant patient.
// - Prevu pour UNE seule instance (offre gratuite). Avec plusieurs
//   instances, chacune compterait de son cote (il faudrait Redis).
// - Verrouillage par compte : quelqu'un qui rate volontairement 5 fois
//   le mot de passe d'un email depuis SA connexion bloque cet email
//   15 minutes POUR CETTE ADRESSE IP seulement (la cle est IP + email).
//
// ADRESSE IP EN PRODUCTION (corrige le 20/09/2026, verifie en direct) :
// Render place TOUS les services derriere Cloudflare, en plus de son
// propre proxy interne — deux relais, pas un seul. Avec `trust proxy = 1`
// (server.js), Express ne fait confiance qu'a un relais et retrouve donc
// l'adresse du noeud Cloudflare (qui change a chaque requete, reseau
// anycast) au lieu de l'adresse reelle du client : verifie en production
// en envoyant 20 echecs de connexion de suite sur le meme email depuis la
// meme adresse — le blocage n'est apparu qu'au 12e essai (au lieu du 6e)
// et une requete est passee au travers meme apres le blocage (la cle
// IP+email retombait par hasard sur un compteur neuf). Cloudflare ajoute
// toujours l'en-tete `CF-Connecting-IP` avec la vraie adresse du client
// (ecrasee cote Cloudflare, un client ne peut pas la falsifier) : on la
// prend en priorite, `req.ip` ne sert plus que de repli (environnement
// local, sans Cloudflare).
function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  return req.ip;
}

function createRateLimiter({
  windowMs,
  max,
  keyFn,
  message,
  // true : une reponse reussie (statut < 400) ne compte pas. Ideal pour la
  // connexion : seuls les ECHECS consomment le quota.
  skipSuccessful = false,
  maxKeys = 20000,
}) {
  const hits = new Map(); // cle -> { count, resetAt }

  // Menage periodique des compteurs expires (unref : ne retient pas le processus).
  const sweep = () => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  };
  setInterval(sweep, Math.min(windowMs, 60 * 1000)).unref();

  const middleware = (req, res, next) => {
    const rawKey = keyFn(req);
    if (!rawKey) return next();
    const key = String(rawKey).slice(0, 300);

    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      // Borne la memoire : trop de cles -> menage, puis oubli des plus anciennes.
      if (hits.size >= maxKeys) {
        sweep();
        if (hits.size >= maxKeys) {
          let toDrop = Math.ceil(maxKeys / 10);
          for (const oldKey of hits.keys()) {
            hits.delete(oldKey);
            if (--toDrop <= 0) break;
          }
        }
      }
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    if (entry.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      const minutes = Math.ceil(retryAfter / 60);
      return res.status(429).json({
        success: false,
        message: `${message} Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      });
    }

    entry.count += 1;
    if (skipSuccessful) {
      res.on('finish', () => {
        if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
      });
    }
    next();
  };

  // Pour les tests uniquement.
  middleware.resetAll = () => hits.clear();
  return middleware;
}

const MINUTE = 60 * 1000;

// Connexion : 5 echecs par 15 min pour un meme (IP + email) ...
const loginAccountLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  max: 5,
  skipSuccessful: true,
  message: 'Trop de tentatives de connexion pour ce compte.',
  keyFn: (req) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    return `login:${getClientIp(req)}|${email}`;
  },
});

// ... et 100 echecs par 15 min pour une meme IP (large : plusieurs
// personnes partagent souvent la meme adresse mobile ou Wi-Fi).
const loginIpLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  max: 100,
  skipSuccessful: true,
  message: 'Trop de tentatives de connexion depuis cette connexion.',
  keyFn: (req) => `login-ip:${getClientIp(req)}`,
});

// Inscriptions : 30 par heure et par IP (large pour une salle de demonstration).
const registerLimiter = createRateLimiter({
  windowMs: 60 * MINUTE,
  max: 30,
  message: 'Trop d\'inscriptions depuis cette connexion.',
  keyFn: (req) => `register:${getClientIp(req)}`,
});

// Connexion Google : 60 par 15 min et par IP (chaque essai appelle Google).
const googleLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  max: 60,
  message: 'Trop de tentatives de connexion Google.',
  keyFn: (req) => `google:${getClientIp(req)}`,
});

module.exports = {
  createRateLimiter,
  loginAccountLimiter,
  loginIpLimiter,
  registerLimiter,
  googleLimiter,
};
