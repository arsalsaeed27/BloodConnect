// entry point for the entire backend

// loads variables from .env (DATABASE_URL, JWT_SECRET, PORT) into process.env
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// brings the localized auth map into main server
const authRoutes = require('./src/routes/authRoutes');

// creates the actual express application
const app = express();

app.use(cors());
// lets the server understand JSON bodies sent by Postman/the frontend
app.use(express.json());

// Take any incoming web request that starts with /api and hand it over to the authRoutes map to figure out the rest.
app.use('/api', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
