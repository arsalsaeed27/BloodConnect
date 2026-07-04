const express = require('express');
const router = express.Router();
const { createEmergencyRequest } = require('../controllers/requestController');

router.post('/create', createEmergencyRequest);

module.exports = router;