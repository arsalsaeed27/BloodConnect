// STEP 1
// this code just ensures when the first time someone enters the system and tries to log in as admin
// he gets registered as a super admin, it checks if there are no already existing admins
// if admin_count == 0, the first registered admin is a super admin and he can then register more admins 
// via his dashboard

// STEP 2
// we need to give the super admins a way to prove who they are by handing then the gigital VIP wristband
// security checkpoint - verifies admin's identity and issues them a digital pass (JWT)

// imports database orm tool to easily read and write data to your database
const { PrismaClient } = require('../../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
// imports the library to hash passwords
const bcrypt = require('bcrypt');

// Prisma 7 requires an explicit driver adapter (no more bundled query engine)
// rejectUnauthorized: false because Aiven's Postgres cert chain isn't in Node's default trust store
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const prisma = new PrismaClient({ adapter });

// imports the library responsible for making JSON web tokens
const jwt = require('jsonwebtoken');

// Helper to enforce SRS password rules: 6-16 chars, 1 letter, 1 number
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
        message: 'Admin registration is permanently locked. Contact a Super Admin.',
        data: null,
        errors: ['Forbidden: Endpoint Locked']
      });
    }

    // data extraction
    const { full_name, phone, email, password } = req.body;

    // 2. Validate Password
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 6-16 characters with at least one letter and one number.',
        data: null,
        errors: ['Weak Password']
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
        admin_type: 'super'
      }
    });

    // success response
    return res.status(201).json({
      success: true,
      message: 'Super Admin successfully registered.',
      data: {
        id: newAdmin.id,
        full_name: newAdmin.full_name,
        email: newAdmin.email,
        admin_type: newAdmin.admin_type
      },
      errors: null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      data: null,
      errors: [error.message]
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
        message: 'Phone number and password are required.',
        data: null,
        errors: ['Missing Credentials']
      });
    }

    // 2. Find the admin by their unique phone number
    const admin = await prisma.admins.findUnique({
      where: { phone }
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password.',
        data: null,
        errors: ['Authentication Failed']
      });
    }

    // 3. Verify the password against the stored hash
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password.',
        data: null,
        errors: ['Authentication Failed']
      });
    }

    // 4. Generate the JWT (The VIP Wristband)
    const token = jwt.sign(
      { 
        userId: admin.id, 
        role: 'admin', 
        adminType: admin.admin_type 
      },
      process.env.JWT_SECRET,  // secret key - locks the token
      { expiresIn: '24h' } // From SRS 5.1: Access tokens expire after 24 hours
    );

    // 5. Send back the token and safe user data
    return res.status(200).json({
      success: true,
      message: 'Admin logged in successfully.',
      data: {
        token,
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          admin_type: admin.admin_type
        }
      },
      errors: null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
      data: null,
      errors: [error.message]
    });
  }
};

// UPDATE YOUR EXPORT AT THE VERY BOTTOM TO INCLUDE BOTH FUNCTIONS
module.exports = { registerAdmin, loginAdmin };
