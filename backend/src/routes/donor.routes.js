const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const { requireDonor } = require('../middleware/role.middleware');
const donorAuthController = require('../controllers/donorAuth.controller');
const donorController = require('../controllers/donor.controller');

const router = express.Router();

router.post('/register', donorAuthController.register);
router.post('/verify-otp', donorAuthController.verifyOtp);
router.post('/login', donorAuthController.login);
router.post('/forgot-password', donorAuthController.forgotPassword);
router.post('/reset-password', donorAuthController.resetPassword);

router.get('/profile', authenticate, requireDonor, donorController.getProfile);
router.put('/profile', authenticate, requireDonor, donorController.updateProfile);
router.post('/donate', authenticate, requireDonor, donorController.recordDonation);
router.put('/change-password', authenticate, requireDonor, donorController.changePassword);

module.exports = router;
