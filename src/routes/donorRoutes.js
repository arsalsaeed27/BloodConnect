const express = require("express");
const router = express.Router();

const { getDonorProfile } = require("../controllers/donorController");
const { protect } = require("../middlewares/authMiddleware");
const { updateDonorProfile } = require("../controllers/donorController");

router.put("/profile", protect, updateDonorProfile);

router.get("/profile", protect, getDonorProfile);

module.exports = router;
