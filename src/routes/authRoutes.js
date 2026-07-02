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
