// entry point for the entire backend

// brings the localized auth map into main server
const authRoutes = require('./src/routes/authRoutes');

// Take any incoming web request that starts with /api and hand it over to the authRoutes map to figure out the rest.
app.use('/api', authRoutes);