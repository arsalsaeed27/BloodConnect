const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const app = express();

app.use(cors());
app.use(express.json());

const { sendOTPEmail } = require("./src/config/emailConfig");
const generateOTP = require("./src/utils/generateOTP");

app.get("/", (req, res) => {
  res.json({ success: true, message: "BloodConnect API is running!" });
});

// --- TEMPORARY EMAIL TEST ROUTE ---
app.get("/test-email", async (req, res) => {
  try {
    const testOTP = generateOTP();
    // sending the test email to myself
    await sendOTPEmail("arsalsaeed24@gmail.com", testOTP);
    res.json({
      success: true,
      message: `Test email sent with OTP: ${testOTP}`,
    });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const authRoutes = require("./src/routes/authRoutes");
app.use("/api/donor", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
// entry point for the entire backend

// loads variables from .env (DATABASE_URL, JWT_SECRET, PORT) into process.env
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// brings the localized auth map into main server
const authRoutes = require('./src/routes/authRoutes');

// creates the actual express application
const app = express();

app.use(cors());
// lets the server understand JSON bodies sent by Postman/the frontend
app.use(express.json());

// Take any incoming web request that starts with /api and hand it over to the authRoutes map to figure out the rest.
app.use('/api', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
