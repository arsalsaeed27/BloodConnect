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
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

const verifyOTPAndRegister = async (req, res) => {
  try {
    const {
      email,
      phone,
      full_name,
      password,
      gender,
      city,
      age,
      weight,
      blood_group,
      has_disease,
      disease_description,
      previously_donated,
      last_donated_date,
      otp,
    } = req.body;

    const otpRecord = await prisma.otps.findFirst({
      where: {
        email: email,
        otp_code: String(otp),
        purpose: "registration",
      },
    });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }
    if (new Date() > otpRecord.expires_at) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newDonor = await prisma.donors.create({
      data: {
        full_name: full_name,
        email: email,
        phone: phone,
        password_hash: hashedPassword,
        gender: gender,
        city: city,
        age: Number(age),
        weight: weight,
        blood_group: blood_group,
        has_disease: Boolean(has_disease),
        disease_description: disease_description || null,
        previously_donated: Boolean(previously_donated),
        last_donated_date: last_donated_date
          ? new Date(last_donated_date)
          : null,
        email_verified: true, //setting this to true since they just verified the code!
      },
    });

    await prisma.otps.deleteMany({
      where: { email: email, purpose: "registration" },
    });

    res.status(201).json({
      success: true,
      message: "Registration successful! Welcome to BloodConnect.",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const loginDonor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const donor = await prisma.donors.findUnique({
      where: { email: email },
    });
    if (!donor) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }
    if (donor.disease_desqualified) {
      return res
        .status(403)
        .json({ success: false, message: "Your are disqualified.." });
    }

    const isPasswordValid = await bcrypt.compare(password, donor.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    await prisma.donors.update({
      where: { email: email },
      data: { last_login: new Date() },
    });

    const token = jwt.sign(
      {
        id: donor.id,
        email: donor.email,
        role: "donor",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }, // logged in for 7 days
    );

    res.status(200).json({
      success: true,
      message: "Login successful!",
      token: token,
      user: {
        id: donor.id,
        full_name: donor.full_name,
        email: donor.email,
        blood_group: donor.blood_group,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  initiateRegistration,
  verifyOTPAndRegister,
  loginDonor,
};
