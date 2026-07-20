const prisma = require('../config/prisma');

// Audit logging must never break the operation it's recording. If writing
// the log fails, swallow the error and just log it — the caller's main
// action has already succeeded (or is proceeding) regardless.
async function logAction({ adminId, adminName, action, entityType, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        adminName,
        action,
        entityType,
        entityId,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

module.exports = { logAction };
