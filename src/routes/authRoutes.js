const express = require("express");
const router = express.Router();

// 1. Import all controllers (Yours + Mashal's)
const {
  initiateRegistration,
  verifyOTPAndRegister,
  loginDonor,
  forgotPassword,
  resetPassword,
  registerAdmin, // Mashal's Admin Controller
  loginAdmin, // Mashal's Admin Controller
} = require("../controllers/authController");

const { protect } = require("../middlewares/authMiddleware");

// ==========================================
//           DONOR AUTH ROUTES
// ==========================================
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

// ==========================================
//           ADMIN AUTH ROUTES
// ==========================================
router.post("/admin/register", registerAdmin);
router.post("/admin/login", loginAdmin);

// Export the unified router once at the very bottom
module.exports = router;
