const prisma = require('../config/prisma');
const sendResponse = require('../utils/response');
const { hashPassword, comparePassword, isValidPassword } = require('../utils/password');
const { sendDonationNotificationEmail } = require('../services/email.service');
const { logAction } = require('../services/audit.service');
const {
  BLOOD_GROUP_MAP,
  WEIGHT_CATEGORY_MAP,
  BLOOD_GROUP_REVERSE_MAP,
  WEIGHT_CATEGORY_REVERSE_MAP,
} = require('../utils/enumMaps');

const EDITABLE_FIELDS = [
  'fullName', 'phone', 'email', 'gender', 'city', 'age', 'weight',
  'bloodGroup', 'hasDisease', 'diseaseDescription', 'previouslyDonated', 'lastDonatedDate',
];

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

// Strips passwordHash and translates the internal enum keys back to the
// human-readable form the API speaks (see utils/enumMaps.js).
function formatDonor(donor) {
  const { passwordHash, ...rest } = donor;
  return {
    ...rest,
    bloodGroup: BLOOD_GROUP_REVERSE_MAP[donor.bloodGroup] || donor.bloodGroup,
    weight: WEIGHT_CATEGORY_REVERSE_MAP[donor.weight] || donor.weight,
  };
}

async function getProfile(req, res) {
  try {
    const donor = await prisma.donor.findUnique({ where: { id: req.user.userId } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    return sendResponse(res, 200, true, 'Profile fetched successfully', formatDonor(donor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function updateProfile(req, res) {
  try {
    const donorId = req.user.userId;
    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    // eligible, unresponsiveCount, disqualified are never touched here —
    // only fields in EDITABLE_FIELDS are ever read off req.body.
    const updateData = {};

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] === undefined) continue;

      if (field === 'bloodGroup') {
        const mapped = BLOOD_GROUP_MAP[req.body.bloodGroup];
        if (!mapped) {
          return sendResponse(res, 400, false, 'Invalid blood group');
        }
        updateData.bloodGroup = mapped;
      } else if (field === 'weight') {
        const mapped = WEIGHT_CATEGORY_MAP[req.body.weight];
        if (!mapped) {
          return sendResponse(res, 400, false, 'Invalid weight category');
        }
        updateData.weight = mapped;
      } else if (field === 'gender') {
        if (!['Male', 'Female', 'Other'].includes(req.body.gender)) {
          return sendResponse(res, 400, false, 'Invalid gender');
        }
        updateData.gender = req.body.gender;
      } else if (field === 'lastDonatedDate') {
        updateData.lastDonatedDate = req.body.lastDonatedDate
          ? new Date(req.body.lastDonatedDate)
          : null;
      } else if (field === 'age') {
        updateData.age = Number(req.body.age);
      } else {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.phone && updateData.phone !== donor.phone) {
      const existingPhone = await prisma.donor.findUnique({ where: { phone: updateData.phone } });
      if (existingPhone && existingPhone.id !== donorId) {
        return sendResponse(res, 409, false, 'Phone number already registered');
      }
    }

    if (updateData.email && updateData.email !== donor.email) {
      const existingEmail = await prisma.donor.findUnique({ where: { email: updateData.email } });
      if (existingEmail && existingEmail.id !== donorId) {
        return sendResponse(res, 409, false, 'Email already registered');
      }
    }

    const updatedDonor = await prisma.donor.update({
      where: { id: donorId },
      data: updateData,
    });

    await logAction({
      adminId: null,
      adminName: donor.fullName,
      action: 'UPDATE_DONOR',
      entityType: 'donor',
      entityId: donor.id,
      details: { updatedFields: Object.keys(updateData) },
    });

    return sendResponse(res, 200, true, 'Profile updated successfully', formatDonor(updatedDonor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function recordDonation(req, res) {
  try {
    const donor = await prisma.donor.findUnique({ where: { id: req.user.userId } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    const today = new Date();

    await prisma.donation.create({
      data: { donorId: donor.id, donationDate: today },
    });

    await prisma.donor.update({
      where: { id: donor.id },
      data: { lastDonatedDate: today, eligible: false },
    });

    const admins = await prisma.admin.findMany({ select: { email: true } });
    const adminEmails = admins.map((admin) => admin.email);

    if (adminEmails.length > 0) {
      await sendDonationNotificationEmail(
        adminEmails,
        donor.fullName,
        BLOOD_GROUP_REVERSE_MAP[donor.bloodGroup] || donor.bloodGroup
      );
    }

    return sendResponse(res, 200, true, 'Donation recorded. Your eligibility will reset after 90 days.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (isMissing(currentPassword) || isMissing(newPassword) || isMissing(confirmPassword)) {
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

    const donor = await prisma.donor.findUnique({ where: { id: req.user.userId } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    const passwordMatches = await comparePassword(currentPassword, donor.passwordHash);
    if (!passwordMatches) {
      return sendResponse(res, 401, false, 'Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.donor.update({
      where: { id: donor.id },
      data: { passwordHash },
    });

    return sendResponse(res, 200, true, 'Password changed successfully.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

module.exports = { getProfile, updateProfile, recordDonation, changePassword };
