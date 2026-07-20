const express = require('express');
const cors = require('cors');

const donorRoutes = require('./routes/donor.routes');
const adminRoutes = require('./routes/admin.routes');
const sendResponse = require('./utils/response');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/donor', donorRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  sendResponse(res, 404, false, 'Route not found');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendResponse(res, 400, false, 'File too large. Max 5MB.');
  }

  if (err.message && err.message.includes('Only CSV')) {
    return sendResponse(res, 400, false, err.message);
  }

  return sendResponse(res, 500, false, 'Internal server error');
});

module.exports = app;
