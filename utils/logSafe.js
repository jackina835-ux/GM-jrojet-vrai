// utils/logSafe.js
//
// Aides pour ecrire dans les journaux (Render les conserve) SANS y laisser
// de donnees personnelles ou de secrets (anomalie S4, corrigee le
// 20/09/2026). Regle : ne jamais journaliser un corps de requete
// (req.body), un en-tete Authorization, un jeton, un mot de passe ni une
// adresse email complete. Pour identifier un evenement, utiliser l'id
// utilisateur ou maskEmail().

// "marie.dupont@gmail.com" -> "m***@gmail.com"
function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '(email invalide)';
  const [local, domain] = email.split('@');
  return `${local.charAt(0)}***@${domain}`;
}

module.exports = { maskEmail };
