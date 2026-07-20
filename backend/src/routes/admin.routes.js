const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin, requireSuperAdmin } = require('../middleware/role.middleware');
const { upload } = require('../middleware/upload.middleware');
const adminAuthController = require('../controllers/adminAuth.controller');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.post('/register', adminAuthController.register);
router.post('/login', adminAuthController.login);

// Must be declared before GET/PUT/DELETE /donors/:id so "import" isn't
// matched as the :id param.
router.post('/donors/import', authenticate, requireAdmin, upload.single('file'), adminController.importDonors);

router.get('/donors', authenticate, requireAdmin, adminController.listDonors);
router.get('/donors/:id', authenticate, requireAdmin, adminController.getDonor);
router.post('/donors', authenticate, requireAdmin, adminController.addDonor);
router.put('/donors/:id', authenticate, requireAdmin, adminController.editDonor);
router.delete('/donors/:id', authenticate, requireAdmin, adminController.deleteDonor);

router.put('/donors/:id/eligible', authenticate, requireAdmin, adminController.setEligibility);
router.put('/donors/:id/unresponsive', authenticate, requireAdmin, adminController.updateUnresponsive);
router.put('/donors/:id/disqualify', authenticate, requireAdmin, adminController.toggleDisqualify);

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);
router.get('/audit-logs', authenticate, requireAdmin, adminController.getAuditLogs);

router.get('/admins', authenticate, requireSuperAdmin, adminController.listAdmins);
router.post('/admins', authenticate, requireSuperAdmin, adminController.addAdmin);
router.put('/admins/:id/role', authenticate, requireSuperAdmin, adminController.changeAdminRole);
router.delete('/admins/:id', authenticate, requireSuperAdmin, adminController.removeAdmin);

module.exports = router;
