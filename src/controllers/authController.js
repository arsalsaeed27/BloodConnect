const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const generateOTP = require("../utils/generateOTP");
const { sendOTPEmail } = require("../config/emailConfig");

const initiateRegistration = async (req, res) => {
  try {
    // extracting data which the frontend will send
    const { email, phone } = req.body;
    // checking if user already exists
    const existingDonor = await prisma.donors.findFirst({
      where: {
        OR: [{ email: email }, { phone: phone }],
      },
    });
    if (existingDonor) {
      return res.status(400).json({
        success: false,
        message: "A donor with this email or phone number already exists.",
      });
    }
    // generate the 6 digit OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    // saving otp in the db
    await prisma.otps.create({
      data: {
        email: email,
        otp_code: otp,
        purpose: "registration",
        expires_at: expiresAt,
      },
    });

    // send email
    await sendOTPEmail(email, otp);
    res.status(200).json({
      success: true,
      message: "Registration Initiated. OTP sent to email...",
    });
  } catch (error) {
    console.error("Initiate Registration Error: ", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  initiateRegistration,
};
