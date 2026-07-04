require("dotenv").config();
const express = require("express");
const requestRoutes = require('./src/routes/requestRoutes');
const cors = require("cors");
const adminRoutes = require('./src/routes/adminRoutes');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();

app.use(cors());
app.use(express.json());

// Mount the admin routes to a dedicated /api/admin prefix
app.use('/api/admin', adminRoutes);
app.use('/api/requests', requestRoutes);

const { sendOTPEmail } = require("./src/config/emailConfig");
const generateOTP = require("./src/utils/generateOTP");

app.get("/", (req, res) => {
  res.json({ success: true, message: "BloodConnect API is running!" });
});

// --- TEMPORARY EMAIL TEST ROUTE ---
app.get("/test-email", async (req, res) => {
  try {
    const testOTP = generateOTP();
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
const donorRoutes = require("./src/routes/donorRoutes");
app.use("/api/donor", donorRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
});
