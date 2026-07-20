const cron = require('node-cron');
const prisma = require('../config/prisma');

async function reinstateEligibility() {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await prisma.donor.updateMany({
      where: {
        eligible: false,
        lastDonatedDate: { not: null, lte: ninetyDaysAgo },
      },
      data: { eligible: true },
    });

    console.log(`Eligibility cron: reinstated ${result.count} donor(s) as eligible.`);
  } catch (error) {
    console.error('Eligibility cron failed:', error);
  }
}

function startEligibilityCron() {
  cron.schedule('0 0 * * *', reinstateEligibility);
}

module.exports = { startEligibilityCron };
