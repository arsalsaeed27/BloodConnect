const { verifyToken } = require('../utils/jwt');
const sendResponse = require('../utils/response');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendResponse(res, 401, false, 'Missing or malformed Authorization header');
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return sendResponse(res, 401, false, 'Invalid or expired token', null, [error.message]);
  }
}

module.exports = authenticate;
