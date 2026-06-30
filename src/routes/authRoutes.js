const express = require("express");
const router = express.Router();
const { initiateRegistration } = require("../controllers/authController");

router.post("/register", initiateRegistration);
module.exports = router;
