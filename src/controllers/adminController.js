const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({adapter});

const getBloodInventory = async (req, res) => {
    try {
        // 1. Extract using 'eligible' (matching the DB schema)
        const { blood_group, city, eligible } = req.query;

        const filterConditions = {};
        
        if (blood_group) {
            filterConditions.blood_group = blood_group;
        }
        if (city) {
            filterConditions.city = {
                contains: city,
                mode: 'insensitive'
            };
        }
        if(eligible !== undefined) {
            // 2. Map directly to the 'eligible' column in Prisma
            filterConditions.eligible = eligible === 'true';
        }

        const inventory = await prisma.donors.findMany({
            where: filterConditions,
            select: {
                id: true,
                full_name: true,
                blood_group: true,
                city: true,
                eligible: true, // 3. Use 'eligible' here too
                phone: true,
                last_donated_date: true,
                disqualified: true  
            },
            orderBy: {
                last_donated_date: 'asc'
            }
        });
        
        return res.status(200).json({
            success: true,
            data: inventory,
            count: inventory.length
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch blood inventory.',
            errors: [error.message]
        });
    }
};

module.exports = {
    getBloodInventory
};