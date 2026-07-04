const { PrismaClient } = require('../../generated/prisma');
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

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const donor = await prisma.donors.findUnique({
      where: { email: email },
    });
    if (!donor) {
      return res
        .status(404)
        .json({ success: false, message: "No donor found with this email." });
    }
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.otps.create({
      data: {
        email: email,
        otp_code: otp,
        purpose: "forgot_password",
        expires_at: expiresAt,
      },
    });
    await sendOTPEmail(
      email,
      otp,
      `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`,
    );
    res.status(200).json({
      success: true,
      message: "OTP sent to email for password reset.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    const otpRecord = await prisma.otps.findFirst({
      where: {
        email: email,
        otp_code: String(otp),
        purpose: "forgot_password",
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
    const hashedPassword = await bcrypt.hash(new_password, salt);

    await prisma.donors.update({
      where: { email: email },
      data: { password_hash: hashedPassword },
    });
    await prisma.otps.deleteMany({
      where: { email: email, purpose: "forgot_password" },
    });
    res.status(200).json({
      success: true,
      message:
        "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const validatePassword = (password) => {
  // regex -> regular function
  const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,16}$/;
  return regex.test(password);
};

// receives a request and sends back a response
const registerAdmin = async (req, res) => {
  try {
    // 1. The Lockout Check
    const adminCount = await prisma.admins.count();
    // if there are more than one admins, it throws an error
    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        message:
          "Admin registration is permanently locked. Contact a Super Admin.",
        data: null,
        errors: ["Forbidden: Endpoint Locked"],
      });
    }

    // data extraction
    const { full_name, phone, email, password } = req.body;

    // 2. Validate Password
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 6-16 characters with at least one letter and one number.",
        data: null,
        errors: ["Weak Password"],
      });
    }

    // 3. Hash Password (Cost factor 12 per SRS)
    const password_hash = await bcrypt.hash(password, 12);

    // 4. Create the Super Admin
    const newAdmin = await prisma.admins.create({
      data: {
        full_name,
        phone,
        email,
        password_hash,
        admin_type: "super",
      },
    });

    // success response
    return res.status(201).json({
      success: true,
      message: "Super Admin successfully registered.",
      data: {
        id: newAdmin.id,
        full_name: newAdmin.full_name,
        email: newAdmin.email,
        admin_type: newAdmin.admin_type,
      },
      errors: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during registration.",
      data: null,
      errors: [error.message],
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    // extract credentials
    const { phone, password } = req.body;

    // 1. Ensure both fields are provided
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required.",
        data: null,
        errors: ["Missing Credentials"],
      });
    }

    // 2. Find the admin by their unique phone number
    const admin = await prisma.admins.findUnique({
      where: { phone },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password.",
        data: null,
        errors: ["Authentication Failed"],
      });
    }

    // 3. Verify the password against the stored hash
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password.",
        data: null,
        errors: ["Authentication Failed"],
      });
    }

    // 4. Generate the JWT (The VIP Wristband)
    const token = jwt.sign(
      {
        userId: admin.id,
        role: "admin",
        adminType: admin.admin_type,
      },
      process.env.JWT_SECRET, // secret key - locks the token
      { expiresIn: "24h" }, // From SRS 5.1: Access tokens expire after 24 hours
    );

    // 5. Send back the token and safe user data
    return res.status(200).json({
      success: true,
      message: "Admin logged in successfully.",
      data: {
        token,
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          admin_type: admin.admin_type,
        },
      },
      errors: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during login.",
      data: null,
      errors: [error.message],
    });
  }
};

// ONE EXPORT TO RULE THEM ALL
module.exports = {
  initiateRegistration,
  verifyOTPAndRegister,
  loginDonor,
  forgotPassword,
  resetPassword,
  registerAdmin,
  loginAdmin,
};
