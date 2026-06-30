// this code just ensures when the first time someone enters the system and tries to log in as admin
// he gets registered as a super admin, it checks if there are no already existing admins
// if admin_count == 0, the first registered admin is a super admin and he can then register more admins 
// via his dashboard


// // imports database orm tool to easily read and write data to your database
const { PrismaClient } = require('@prisma/client');

// imports the library to hash passwords
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

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
    const { name, phone, email, password } = req.body;

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
        name,
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
        name: newAdmin.name,
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

module.exports = { registerAdmin };