const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const getDonorProfile = async (req, res) => {
  try {
    const donorId = req.user.id;

    const donor = await prisma.donors.findUnique({
      where: { id: donorId },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        blood_group: true,
        city: true,
        age: true,
        weight: true,
        gender: true,
        has_disease: true,
        disease_description: true,
        previously_donated: true,
        last_donated_date: true,
        disqualified: true,
      },
    });

    if (!donor) {
      return res
        .status(404)
        .json({ success: false, message: "Donor not found." });
    }

    res.status(200).json({
      success: true,
      data: donor,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const updateDonorProfile = async (req, res) => {
  try {
    const donorId = req.user.id;
    const {
      city,
      weight,
      has_disease,
      disease_description,
      previously_donated,
      last_donated_date,
    } = req.body;

    const updatedDonor = await prisma.donors.update({
      where: { id: donorId },
      data: {
        city: city !== undefined ? city : undefined,
        weight: weight !== undefined ? weight : undefined,
        has_disease:
          has_disease !== undefined ? Boolean(has_disease) : undefined,
        disease_description:
          disease_description !== undefined ? disease_description : undefined,
        previously_donated:
          previously_donated !== undefined
            ? Boolean(previously_donated)
            : undefined,
        last_donated_date: last_donated_date
          ? new Date(last_donated_date)
          : undefined,
      },
      select: {
        id: true,
        full_name: true,
        city: true,
        weight: true,
        previously_donated: true,
        last_donated_date: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedDonor,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getDonorProfile,
  updateDonorProfile,
};
