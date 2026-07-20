const prisma = require('../config/prisma');
const sendResponse = require('../utils/response');
const { hashPassword, comparePassword, isValidPassword } = require('../utils/password');
const { generateOtp, getOtpExpiry } = require('../utils/otp');
const { signToken } = require('../utils/jwt');
const { sendOtpEmail } = require('../services/email.service');
const { BLOOD_GROUP_MAP, WEIGHT_CATEGORY_MAP } = require('../utils/enumMaps');

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

async function checkOtpRateLimit(email, purpose) {
  const maxPerHour = parseInt(process.env.OTP_MAX_PER_HOUR, 10) || 3;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentOtpCount = await prisma.otp.count({
    where: { email, purpose, createdAt: { gte: oneHourAgo } },
  });
  return recentOtpCount >= maxPerHour;
}

async function register(req, res) {
  try {
    const {
      fullName, phone, email, password, confirmPassword,
      gender, city, age, weight, bloodGroup,
      hasDisease, diseaseDescription, previouslyDonated, lastDonatedDate,
    } = req.body;

    const requiredFields = {
      fullName, phone, email, password, confirmPassword,
      gender, city, age, weight, bloodGroup, hasDisease, previouslyDonated,
    };
    const missing = Object.entries(requiredFields)
      .filter(([, value]) => isMissing(value))
      .map(([key]) => key);

    if (missing.length > 0) {
      return sendResponse(res, 400, false, 'Missing required fields', null, missing);
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

    if (previouslyDonated && isMissing(lastDonatedDate)) {
      return sendResponse(res, 400, false, 'Last donated date is required for previous donors');
    }

    const mappedBloodGroup = BLOOD_GROUP_MAP[bloodGroup];
    if (!mappedBloodGroup) {
      return sendResponse(res, 400, false, 'Invalid blood group');
    }

    const mappedWeight = WEIGHT_CATEGORY_MAP[weight];
    if (!mappedWeight) {
      return sendResponse(res, 400, false, 'Invalid weight category');
    }

    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return sendResponse(res, 400, false, 'Invalid gender');
    }

    if (await checkOtpRateLimit(email, 'registration')) {
      return sendResponse(res, 429, false, 'Too many OTP requests. Try again later.');
    }

    const existingPhone = await prisma.donor.findUnique({ where: { phone } });
    if (existingPhone) {
      return sendResponse(res, 409, false, 'Phone number already registered');
    }

    const existingEmail = await prisma.donor.findUnique({ where: { email } });
    if (existingEmail) {
      return sendResponse(res, 409, false, 'Email already registered');
    }

    const passwordHash = await hashPassword(password);
    const otpCode = generateOtp();
    const expiresAt = getOtpExpiry();

    const pendingData = {
      fullName,
      phone,
      email,
      gender,
      city,
      age: Number(age),
      weight: mappedWeight,
      bloodGroup: mappedBloodGroup,
      hasDisease,
      diseaseDescription: diseaseDescription || null,
      previouslyDonated,
      lastDonatedDate: lastDonatedDate || null,
      passwordHash,
    };

    await prisma.otp.create({
      data: {
        email,
        otpCode,
        purpose: 'registration',
        expiresAt,
        used: false,
        pendingData,
      },
    });

    await sendOtpEmail(email, otpCode, 'registration');

    return sendResponse(
      res, 200, true,
      'OTP sent to your email. Please verify to complete registration.',
      { email }
    );
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otpCode } = req.body;

    if (isMissing(email) || isMissing(otpCode)) {
      return sendResponse(res, 400, false, 'Email and OTP code are required');
    }

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        purpose: 'registration',
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return sendResponse(res, 400, false, 'Invalid or expired OTP');
    }

    if (otpRecord.otpCode !== otpCode) {
      return sendResponse(res, 400, false, 'Invalid OTP');
    }

    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const pendingData = otpRecord.pendingData;

    const donor = await prisma.donor.create({
      data: {
        fullName: pendingData.fullName,
        phone: pendingData.phone,
        email: pendingData.email,
        passwordHash: pendingData.passwordHash,
        gender: pendingData.gender,
        city: pendingData.city,
        age: pendingData.age,
        weight: pendingData.weight,
        bloodGroup: pendingData.bloodGroup,
        hasDisease: pendingData.hasDisease,
        diseaseDescription: pendingData.diseaseDescription,
        previouslyDonated: pendingData.previouslyDonated,
        lastDonatedDate: pendingData.lastDonatedDate
          ? new Date(pendingData.lastDonatedDate)
          : null,
      },
    });

    await prisma.otp.delete({ where: { id: otpRecord.id } });

    return sendResponse(
      res, 201, true,
      'Registration successful. You can now log in.',
      { donorId: donor.id }
    );
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

    const donor = await prisma.donor.findUnique({ where: { phone } });
    if (!donor) {
      return sendResponse(res, 401, false, 'Invalid phone number or password');
    }

    const passwordMatches = await comparePassword(password, donor.passwordHash);
    if (!passwordMatches) {
      return sendResponse(res, 401, false, 'Invalid phone number or password');
    }

    const token = signToken({ userId: donor.id, role: 'donor' });

    const { passwordHash, ...donorData } = donor;

    return sendResponse(res, 200, true, 'Login successful', { token, donor: donorData });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (isMissing(email)) {
      return sendResponse(res, 400, false, 'Email is required');
    }

    const donor = await prisma.donor.findUnique({ where: { email } });
    if (!donor) {
      return sendResponse(res, 404, false, 'No account found with this email');
    }

    if (await checkOtpRateLimit(email, 'forgot_password')) {
      return sendResponse(res, 429, false, 'Too many OTP requests. Try again later.');
    }

    const otpCode = generateOtp();
    const expiresAt = getOtpExpiry();

    await prisma.otp.create({
      data: {
        email,
        otpCode,
        purpose: 'forgot_password',
        expiresAt,
        used: false,
      },
    });

    await sendOtpEmail(email, otpCode, 'forgot_password');

    return sendResponse(res, 200, true, 'OTP sent to your email.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otpCode, newPassword, confirmPassword } = req.body;

    if (isMissing(email) || isMissing(otpCode) || isMissing(newPassword) || isMissing(confirmPassword)) {
      return sendResponse(res, 400, false, 'Missing required fields');
    }

    if (newPassword !== confirmPassword) {
      return sendResponse(res, 400, false, 'Passwords do not match');
    }

    if (!isValidPassword(newPassword)) {
      return sendResponse(
        res, 400, false,
        'Password must be 6-16 characters with at least 1 letter and 1 digit'
      );
    }

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        purpose: 'forgot_password',
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.otpCode !== otpCode) {
      return sendResponse(res, 400, false, 'Invalid or expired OTP');
    }

    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const passwordHash = await hashPassword(newPassword);

    await prisma.donor.update({
      where: { email },
      data: { passwordHash },
    });

    await prisma.otp.delete({ where: { id: otpRecord.id } });

    return sendResponse(res, 200, true, 'Password reset successful. You can now log in.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

module.exports = { register, verifyOtp, login, forgotPassword, resetPassword };
