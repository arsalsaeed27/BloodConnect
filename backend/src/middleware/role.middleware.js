const sendResponse = require('../utils/response');

// These middleware always run after `authenticate`, so an unauthorized role
// is a 403 (we know who you are, you're just not allowed) — not a 401.
function requireDonor(req, res, next) {
  if (req.user.role !== 'donor') {
    return sendResponse(res, 403, false, 'Donors only');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return sendResponse(res, 403, false, 'Admins only');
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'admin' || req.user.adminType !== 'super') {
    return sendResponse(res, 403, false, 'Super admins only');
  }
  next();
}

module.exports = { requireDonor, requireAdmin, requireSuperAdmin };
