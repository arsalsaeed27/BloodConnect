const express = require("express");
const router = express.Router();
const { initiateRegistration } = require("../controllers/authController");
const { verifyOTPAndRegister } = require("../controllers/authController");
const { loginDonor } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

router.post("/register", initiateRegistration);
router.post("/verify-otp", verifyOTPAndRegister);
router.post("/login", loginDonor);
router.get("/me", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "User authenticated successfully",
    user_data_from_token: req.user,
  });
});
module.exports = router;
