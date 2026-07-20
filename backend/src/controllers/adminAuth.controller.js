const prisma = require('../config/prisma');
const sendResponse = require('../utils/response');
const { hashPassword, comparePassword, isValidPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

// Creates the FIRST ever admin (Super Admin). Permanently closed after that —
// per SRS 2.2.1, all subsequent admins must be added by a Super Admin.
async function register(req, res) {
  try {
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
      return sendResponse(
        res, 403, false,
        'Admin registration is closed. Contact your Super Admin to add new admins.'
      );
    }

    const { name, phone, email, password, confirmPassword } = req.body;

    if (isMissing(name) || isMissing(phone) || isMissing(email) || isMissing(password) || isMissing(confirmPassword)) {
      return sendResponse(res, 400, false, 'Missing required fields');
    }

    if (password !== confirmPassword) {
      return sendResponse(res, 400, false, 'Passwords do not match');
    }

    if (!isValidPassword(password)) {
      return sendResponse(
        res, 400, false,
        'Password must be 6-16 characters with at least 1 letter and 1 digit'
      );
    }

    const existingPhone = await prisma.admin.findUnique({ where: { phone } });
    if (existingPhone) {
      return sendResponse(res, 409, false, 'Phone number already registered');
    }

    const existingEmail = await prisma.admin.findUnique({ where: { email } });
    if (existingEmail) {
      return sendResponse(res, 409, false, 'Email already registered');
    }

    const passwordHash = await hashPassword(password);

    const admin = await prisma.admin.create({
      data: {
        name,
        phone,
        email,
        passwordHash,
        adminType: 'super',
      },
    });

    const token = signToken({ userId: admin.id, role: 'admin', adminType: admin.adminType });

    const { passwordHash: _, ...adminData } = admin;

    return sendResponse(res, 201, true, 'Super Admin account created.', { token, admin: adminData });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function login(req, res) {
  try {
    const { phone, password } = req.body;

    if (isMissing(phone) || isMissing(password)) {
      return sendResponse(res, 400, false, 'Phone and password are required');
    }

    const admin = await prisma.admin.findUnique({ where: { phone } });
    if (!admin) {
      return sendResponse(res, 401, false, 'Invalid phone number or password');
    }

    const passwordMatches = await comparePassword(password, admin.passwordHash);
    if (!passwordMatches) {
      return sendResponse(res, 401, false, 'Invalid phone number or password');
    }

    const token = signToken({ userId: admin.id, role: 'admin', adminType: admin.adminType });

    const { passwordHash, ...adminData } = admin;

    return sendResponse(res, 200, true, 'Login successful', { token, admin: adminData });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

module.exports = { register, login };
