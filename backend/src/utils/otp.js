const crypto = require('crypto');

function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function getOtpExpiry() {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateOtp, getOtpExpiry };
