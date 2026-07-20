const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,16}$/;

function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

function hashPassword(plainText) {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

function comparePassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = { isValidPassword, hashPassword, comparePassword };
