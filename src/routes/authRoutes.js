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