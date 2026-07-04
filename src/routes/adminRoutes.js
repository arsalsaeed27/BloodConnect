const express = require('express');
const { getBloodInventory } = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware'); // Your working middleware

const router = express.Router();

// Apply the protect middleware to ensure only logged-in admins can search
router.get('/inventory', protect, getBloodInventory);

module.exports = router;