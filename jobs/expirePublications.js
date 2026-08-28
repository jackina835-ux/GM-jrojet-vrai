const cron = require('node-cron');
const { Publication } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');

const expirePublications = async () => {
  try {
    console.log('🔄 Running expiry job...');
    
    const now = moment().toDate();
    
    // Find expired publications
    const expired = await Publication.findAll({
      where: {
        is_active: true,
        is_permanent: false,
        expires_at: { [Op.lt]: now }
      }
    });

    console.log(`📊 Found ${expired.length} expired publications`);

    // Mark as draft
    for (const pub of expired) {
      await pub.update({
        is_active: false,
        is_draft: true
      });
      console.log(`📝 Expired publication ${pub.id} moved to drafts`);
    }

    console.log('✅ Expiry job completed');
  } catch (error) {
    console.error('❌ Error in expiry job:', error);
  }
};

const startExpiryJob = () => {
  // Run every hour
  cron.schedule('0 * * * *', () => {
    expirePublications();
  });
  
  // Run immediately on start
  setTimeout(expirePublications, 5000);
  
  console.log('⏰ Expiry job scheduled (every hour)');
};

module.exports = {
  expirePublications,
  startExpiryJob
};