const express = require("express");
const router = express.Router();
const { initiateRegistration } = require("../controllers/authController");
const { verifyOTPAndRegister } = require("../controllers/authController");
const { loginDonor } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const {
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

router.post("/register", initiateRegistration);
router.post("/verify-otp", verifyOTPAndRegister);
router.post("/login", loginDonor);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});
module.exports = router;
// this file creates a localized map for authentication related traffic


// import express and create a router (a mini app specifically for handling routing)
const express = require('express');
const router = express.Router();
// imports the register admin function
const { registerAdmin, loginAdmin } = require('../controllers/authController');

// Route: POST /api/admin/register
// If a request comes in using the POST method looking for the exact path /admin/register, send it to the registerAdmin function.
router.post('/admin/register', registerAdmin);

// Route: POST /api/admin/login
router.post('/admin/login', loginAdmin);

module.exports = router;
