const moment = require('moment');

const getExpiryDate = (duration, isPermanent = false) => {
  if (isPermanent) {
    return null;
  }
  return moment().add(duration, 'hours').toDate();
};

const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  return moment(expiresAt).isBefore(moment());
};

const getRemainingTime = (expiresAt) => {
  if (!expiresAt) return 'Permanent';
  const duration = moment.duration(moment(expiresAt).diff(moment()));
  if (duration.asMilliseconds() <= 0) return 'Expiré';
  
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  
  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }
  return `${minutes}m`;
};

module.exports = {
  getExpiryDate,
  isExpired,
  getRemainingTime
};