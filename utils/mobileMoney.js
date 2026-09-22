const PROVIDERS = ['mvola', 'orange_money', 'airtel_money'];

function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 30) return null;
  const compact = value.replace(/[\s().-]/g, '');
  const local = compact.replace(/^(?:\+261|00261|261)/, '0');
  return /^03\d{8}$/.test(local) ? `+261${local.slice(1)}` : null;
}

module.exports = { PROVIDERS, normalizePhone };
