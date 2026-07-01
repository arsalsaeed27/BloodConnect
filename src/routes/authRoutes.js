const express = require("express");
const router = express.Router();
const { initiateRegistration } = require("../controllers/authController");
const { verifyOTPAndRegister } = require("../controllers/authController");

router.post("/register", initiateRegistration);
router.post("/verify-otp", verifyOTPAndRegister);
module.exports = router;
