const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const { startEligibilityCron } = require('./src/services/eligibility.cron');
const prisma = require('./src/config/prisma');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Blood Connect backend running on port ${PORT}`);
  startEligibilityCron();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
