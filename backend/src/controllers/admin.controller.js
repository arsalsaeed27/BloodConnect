const { Readable } = require('stream');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');

const prisma = require('../config/prisma');
const sendResponse = require('../utils/response');
const { hashPassword, isValidPassword } = require('../utils/password');
const { logAction } = require('../services/audit.service');
const {
  BLOOD_GROUP_MAP,
  WEIGHT_CATEGORY_MAP,
  BLOOD_GROUP_REVERSE_MAP,
} = require('../utils/enumMaps');
const { formatDonor, formatAdmin } = require('../utils/serializers');

const CSV_MIME_TYPES = ['text/csv'];
const EXCEL_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ADMIN_EDITABLE_DONOR_FIELDS = [
  'fullName', 'phone', 'email', 'gender', 'city', 'age', 'weight',
  'bloodGroup', 'hasDisease', 'diseaseDescription', 'previouslyDonated',
  'lastDonatedDate', 'eligible', 'unresponsiveCount', 'disqualified',
];

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
}

// JWT payloads only carry { userId, role, adminType } (see utils/jwt.js), so
// adminName — required by audit_logs — has to be looked up separately.
async function getAdminName(adminId) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { name: true } });
  return admin ? admin.name : 'Unknown Admin';
}

// ---------- Donors ----------

async function listDonors(req, res) {
  try {
    const { search, city, gender, bloodGroup, eligible, disqualified } = req.query;

    const where = {};

    if (search) {
      where.fullName = { contains: search, mode: 'insensitive' };
    }
    if (city) {
      where.city = city;
    }
    if (gender) {
      if (!['Male', 'Female', 'Other'].includes(gender)) {
        return sendResponse(res, 400, false, 'Invalid gender');
      }
      where.gender = gender;
    }
    if (bloodGroup) {
      const mapped = BLOOD_GROUP_MAP[bloodGroup];
      if (!mapped) {
        return sendResponse(res, 400, false, 'Invalid blood group');
      }
      where.bloodGroup = mapped;
    }
    if (eligible !== undefined) {
      where.eligible = eligible === 'true';
    }
    if (disqualified !== undefined) {
      where.disqualified = disqualified === 'true';
    }

    const donors = await prisma.donor.findMany({ where });

    return sendResponse(res, 200, true, 'Donors fetched successfully', donors.map(formatDonor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function getDonor(req, res) {
  try {
    const { id } = req.params;

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: { donations: { orderBy: { donationDate: 'desc' } } },
    });

    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    const { donations, ...donorFields } = donor;

    return sendResponse(res, 200, true, 'Donor fetched successfully', {
      ...formatDonor(donorFields),
      donations,
    });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function addDonor(req, res) {
  try {
    const {
      fullName, phone, email, password,
      gender, city, age, weight, bloodGroup,
      hasDisease, diseaseDescription, previouslyDonated, lastDonatedDate,
    } = req.body;

    const requiredFields = {
      fullName, phone, email, password,
      gender, city, age, weight, bloodGroup, hasDisease, previouslyDonated,
    };
    const missing = Object.entries(requiredFields)
      .filter(([, value]) => isMissing(value))
      .map(([key]) => key);

    if (missing.length > 0) {
      return sendResponse(res, 400, false, 'Missing required fields', null, missing);
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

    const existingPhone = await prisma.donor.findUnique({ where: { phone } });
    if (existingPhone) {
      return sendResponse(res, 409, false, 'Phone number already registered');
    }

    const existingEmail = await prisma.donor.findUnique({ where: { email } });
    if (existingEmail) {
      return sendResponse(res, 409, false, 'Email already registered');
    }

    const passwordHash = await hashPassword(password);

    const donor = await prisma.donor.create({
      data: {
        fullName,
        phone,
        email,
        passwordHash,
        gender,
        city,
        age: Number(age),
        weight: mappedWeight,
        bloodGroup: mappedBloodGroup,
        hasDisease,
        diseaseDescription: diseaseDescription || null,
        previouslyDonated,
        lastDonatedDate: lastDonatedDate ? new Date(lastDonatedDate) : null,
        eligible: true,
      },
    });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'CREATE_DONOR',
      entityType: 'donor',
      entityId: donor.id,
      details: { fullName: donor.fullName, phone: donor.phone },
    });

    return sendResponse(res, 201, true, 'Donor created successfully', formatDonor(donor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function editDonor(req, res) {
  try {
    const { id } = req.params;

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    const updateData = {};

    for (const field of ADMIN_EDITABLE_DONOR_FIELDS) {
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
      } else if (field === 'age' || field === 'unresponsiveCount') {
        updateData[field] = Number(req.body[field]);
      } else {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.phone && updateData.phone !== donor.phone) {
      const existingPhone = await prisma.donor.findUnique({ where: { phone: updateData.phone } });
      if (existingPhone && existingPhone.id !== id) {
        return sendResponse(res, 409, false, 'Phone number already registered');
      }
    }

    if (updateData.email && updateData.email !== donor.email) {
      const existingEmail = await prisma.donor.findUnique({ where: { email: updateData.email } });
      if (existingEmail && existingEmail.id !== id) {
        return sendResponse(res, 409, false, 'Email already registered');
      }
    }

    const updatedDonor = await prisma.donor.update({ where: { id }, data: updateData });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'UPDATE_DONOR',
      entityType: 'donor',
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
    });

    return sendResponse(res, 200, true, 'Donor updated successfully', formatDonor(updatedDonor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function deleteDonor(req, res) {
  try {
    const { id } = req.params;

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    await prisma.donation.deleteMany({ where: { donorId: id } });
    await prisma.donor.delete({ where: { id } });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'DELETE_DONOR',
      entityType: 'donor',
      entityId: id,
      details: { fullName: donor.fullName, phone: donor.phone },
    });

    return sendResponse(res, 200, true, 'Donor deleted successfully.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

// ---------- Bulk import ----------

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseExcelBuffer(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
}

// Expects columns matching the donor table's snake_case names: full_name,
// phone, email, password, gender, city, age, weight, blood_group,
// has_disease, disease_description, previously_donated, last_donated_date.
function validateImportRow(row, seenPhones, seenEmails, existingPhones, existingEmails) {
  const fullName = row.full_name?.toString().trim();
  const phone = row.phone?.toString().trim();
  const email = row.email?.toString().trim();
  const password = row.password?.toString().trim();
  const gender = row.gender?.toString().trim();
  const city = row.city?.toString().trim();
  const age = row.age;
  const weight = row.weight?.toString().trim();
  const bloodGroup = row.blood_group?.toString().trim();
  const hasDisease = parseBoolean(row.has_disease);
  const diseaseDescription = row.disease_description
    ? row.disease_description.toString().trim()
    : null;
  const previouslyDonated = parseBoolean(row.previously_donated);
  const lastDonatedDate = row.last_donated_date
    ? row.last_donated_date.toString().trim()
    : null;

  if (
    !fullName || !phone || !email || !password || !gender || !city ||
    isMissing(age) || !weight || !bloodGroup ||
    hasDisease === undefined || previouslyDonated === undefined
  ) {
    return { error: 'Missing or invalid required field(s)' };
  }

  if (!isValidPassword(password)) {
    return { error: 'Invalid password (must be 6-16 chars with a letter and a digit)' };
  }

  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return { error: `Invalid gender: ${gender}` };
  }

  const mappedBloodGroup = BLOOD_GROUP_MAP[bloodGroup];
  if (!mappedBloodGroup) {
    return { error: `Invalid blood group: ${bloodGroup}` };
  }

  const mappedWeight = WEIGHT_CATEGORY_MAP[weight];
  if (!mappedWeight) {
    return { error: `Invalid weight category: ${weight}` };
  }

  if (previouslyDonated && !lastDonatedDate) {
    return { error: 'Last donated date is required for previous donors' };
  }

  if (existingPhones.has(phone) || seenPhones.has(phone)) {
    return { error: 'Phone number already registered' };
  }

  if (existingEmails.has(email) || seenEmails.has(email)) {
    return { error: 'Email already registered' };
  }

  return {
    data: {
      fullName,
      phone,
      email,
      password,
      gender,
      city,
      age: Number(age),
      weight: mappedWeight,
      bloodGroup: mappedBloodGroup,
      hasDisease,
      diseaseDescription,
      previouslyDonated,
      lastDonatedDate: lastDonatedDate ? new Date(lastDonatedDate) : null,
    },
  };
}

async function importDonors(req, res) {
  try {
    if (!req.file) {
      return sendResponse(res, 400, false, 'No file uploaded');
    }

    let rawRows;
    if (CSV_MIME_TYPES.includes(req.file.mimetype)) {
      rawRows = await parseCsvBuffer(req.file.buffer);
    } else if (EXCEL_MIME_TYPES.includes(req.file.mimetype)) {
      rawRows = parseExcelBuffer(req.file.buffer);
    } else {
      return sendResponse(res, 400, false, 'Only CSV or Excel (.xlsx) files are allowed');
    }

    const [existingPhoneRows, existingEmailRows] = await Promise.all([
      prisma.donor.findMany({ select: { phone: true } }),
      prisma.donor.findMany({ select: { email: true } }),
    ]);
    const existingPhones = new Set(existingPhoneRows.map((d) => d.phone));
    const existingEmails = new Set(existingEmailRows.map((d) => d.email));

    const seenPhones = new Set();
    const seenEmails = new Set();
    const errors = [];
    const validRows = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 to account for the header row
      const result = validateImportRow(row, seenPhones, seenEmails, existingPhones, existingEmails);

      if (result.error) {
        errors.push({ row: rowNumber, reason: result.error });
        return;
      }

      seenPhones.add(result.data.phone);
      seenEmails.add(result.data.email);
      validRows.push(result.data);
    });

    const donorsToCreate = [];
    for (const row of validRows) {
      const passwordHash = await hashPassword(row.password);
      const { password, ...rest } = row;
      donorsToCreate.push({ ...rest, passwordHash, eligible: true });
    }

    let successful = 0;
    if (donorsToCreate.length > 0) {
      const result = await prisma.donor.createMany({
        data: donorsToCreate,
        skipDuplicates: true,
      });
      successful = result.count;
    }

    const totalProcessed = rawRows.length;
    const failed = totalProcessed - successful;

    // No single donor this action applies to, so the acting admin's own id
    // is used as entityId (audit_logs.entity_id is a required, non-null UUID).
    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'IMPORT_DONORS',
      entityType: 'donor',
      entityId: req.user.userId,
      details: { totalProcessed, successful, failed },
    });

    return sendResponse(res, 200, true, 'Import completed.', {
      totalProcessed,
      successful,
      failed,
      errors,
    });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

// ---------- Donor status actions ----------

async function setEligibility(req, res) {
  try {
    const { id } = req.params;
    const { eligible } = req.body;

    if (typeof eligible !== 'boolean') {
      return sendResponse(res, 400, false, 'eligible must be a boolean');
    }

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    await prisma.donor.update({ where: { id }, data: { eligible } });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'SET_ELIGIBILITY',
      entityType: 'donor',
      entityId: id,
      details: { eligible },
    });

    return sendResponse(res, 200, true, 'Eligibility updated.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function updateUnresponsive(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['increment', 'decrement'].includes(action)) {
      return sendResponse(res, 400, false, "action must be 'increment' or 'decrement'");
    }

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    const newCount = action === 'increment'
      ? donor.unresponsiveCount + 1
      : Math.max(0, donor.unresponsiveCount - 1);

    const updatedDonor = await prisma.donor.update({
      where: { id },
      data: { unresponsiveCount: newCount },
    });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'UPDATE_UNRESPONSIVE',
      entityType: 'donor',
      entityId: id,
      details: { action, unresponsiveCount: newCount },
    });

    return sendResponse(res, 200, true, 'Unresponsive count updated', formatDonor(updatedDonor));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function toggleDisqualify(req, res) {
  try {
    const { id } = req.params;
    const { disqualified } = req.body;

    if (typeof disqualified !== 'boolean') {
      return sendResponse(res, 400, false, 'disqualified must be a boolean');
    }

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) {
      return sendResponse(res, 404, false, 'Donor not found');
    }

    await prisma.donor.update({ where: { id }, data: { disqualified } });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'DISQUALIFY_DONOR',
      entityType: 'donor',
      entityId: id,
      details: { disqualified },
    });

    return sendResponse(res, 200, true, 'Donor disqualification status updated.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

// ---------- Dashboard & audit ----------

async function getDashboardStats(req, res) {
  try {
    const [totalDonors, eligibleDonors, byBloodGroupRaw, byCityRaw] = await Promise.all([
      prisma.donor.count(),
      prisma.donor.count({ where: { eligible: true } }),
      prisma.donor.groupBy({ by: ['bloodGroup'], _count: { _all: true } }),
      prisma.donor.groupBy({ by: ['city'], _count: { _all: true } }),
    ]);

    const byBloodGroup = byBloodGroupRaw.map((entry) => ({
      bloodGroup: BLOOD_GROUP_REVERSE_MAP[entry.bloodGroup] || entry.bloodGroup,
      count: entry._count._all,
    }));

    const byCity = byCityRaw.map((entry) => ({
      city: entry.city,
      count: entry._count._all,
    }));

    return sendResponse(res, 200, true, 'Dashboard stats fetched successfully', {
      totalDonors,
      eligibleDonors,
      byBloodGroup,
      byCity,
    });
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function getAuditLogs(req, res) {
  try {
    const { adminId, entityType, from, to } = req.query;

    const where = {};
    if (adminId) where.adminId = adminId;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return sendResponse(res, 200, true, 'Audit logs fetched successfully', logs);
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

// ---------- Admin management (Super Admin only) ----------

async function listAdmins(req, res) {
  try {
    const admins = await prisma.admin.findMany();
    return sendResponse(res, 200, true, 'Admins fetched successfully', admins.map(formatAdmin));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function addAdmin(req, res) {
  try {
    const { name, phone, email, password, confirmPassword, adminType } = req.body;

    const missing = Object.entries({ name, phone, email, password, confirmPassword, adminType })
      .filter(([, value]) => isMissing(value))
      .map(([key]) => key);

    if (missing.length > 0) {
      return sendResponse(res, 400, false, 'Missing required fields', null, missing);
    }

    if (!['super', 'regular'].includes(adminType)) {
      return sendResponse(res, 400, false, "adminType must be 'super' or 'regular'");
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

    const newAdmin = await prisma.admin.create({
      data: { name, phone, email, passwordHash, adminType },
    });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'CREATE_ADMIN',
      entityType: 'admin',
      entityId: newAdmin.id,
      details: { name: newAdmin.name, adminType: newAdmin.adminType },
    });

    return sendResponse(res, 201, true, 'Admin created successfully', formatAdmin(newAdmin));
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function changeAdminRole(req, res) {
  try {
    const { id } = req.params;
    const { adminType } = req.body;

    if (!['super', 'regular'].includes(adminType)) {
      return sendResponse(res, 400, false, "adminType must be 'super' or 'regular'");
    }

    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      return sendResponse(res, 404, false, 'Admin not found');
    }

    await prisma.admin.update({ where: { id }, data: { adminType } });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'CHANGE_ADMIN_ROLE',
      entityType: 'admin',
      entityId: id,
      details: { newAdminType: adminType },
    });

    return sendResponse(res, 200, true, 'Admin role updated.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

async function removeAdmin(req, res) {
  try {
    const { id } = req.params;

    if (req.user.userId === id) {
      return sendResponse(res, 400, false, 'You cannot remove your own admin account');
    }

    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      return sendResponse(res, 404, false, 'Admin not found');
    }

    await prisma.admin.delete({ where: { id } });

    await logAction({
      adminId: req.user.userId,
      adminName: await getAdminName(req.user.userId),
      action: 'DELETE_ADMIN',
      entityType: 'admin',
      entityId: id,
      details: { name: admin.name, phone: admin.phone },
    });

    return sendResponse(res, 200, true, 'Admin removed.');
  } catch (error) {
    return sendResponse(res, 500, false, 'Something went wrong', null, [error.message]);
  }
}

module.exports = {
  listDonors,
  getDonor,
  addDonor,
  editDonor,
  deleteDonor,
  importDonors,
  setEligibility,
  updateUnresponsive,
  toggleDisqualify,
  getDashboardStats,
  getAuditLogs,
  listAdmins,
  addAdmin,
  changeAdminRole,
  removeAdmin,
};
