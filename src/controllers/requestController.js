const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({adapter});

const createEmergencyRequest = async (req, res) => {
    try {
        const { 
            patient_name, 
            blood_group, 
            city, 
            hospital_name, 
            contact_phone, 
            urgency_level 
        } = req.body;

        // 1. Save the new request to the database
        const newRequest = await prisma.bloodRequests.create({
            data: {
                patient_name,
                blood_group,
                city,
                hospital_name,
                contact_phone,
                urgency_level: urgency_level || "normal"
            }
        });

        // 2. Instantly search for eligible matches in the same city
        const matchingDonors = await prisma.donors.findMany({
            where: {
                blood_group: blood_group,
                city: {
                    equals: city,
                    mode: 'insensitive' // Matches "Rawalpindi" with "rawalpindi"
                },
                eligible: true, // Crucial: only fetch donors who can actually donate
                disqualified: false
            },
            select: {
                id: true,
                full_name: true,
                phone: true,
                last_donated_date: true
            }
        });

        return res.status(201).json({
            success: true,
            message: "Emergency request created.",
            request_details: newRequest,
            matches_found: matchingDonors.length,
            potential_donors: matchingDonors
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to create emergency request.",
            error: error.message
        });
    }
};

module.exports = {
    createEmergencyRequest
};