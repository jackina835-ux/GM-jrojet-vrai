const StoreServices = require('../models/StoreServices');
let ready;
// Creation additive, partagee entre les requetes concurrentes. Aucune alteration.
module.exports = function ensureStoreServicesTable() {
  if (!ready) ready = StoreServices.sync().catch(error => { ready = null; throw error; });
  return ready;
};
