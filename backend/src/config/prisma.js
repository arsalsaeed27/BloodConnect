const { PrismaClient } = require('@prisma/client');

// This must be the only PrismaClient instance in the app. Each instance opens
// its own connection pool, so creating more than one here (or anywhere else
// in the codebase) will exhaust the Postgres connection limit. Always import
// the shared instance from this file instead of instantiating PrismaClient
// directly.
const prisma = new PrismaClient();

module.exports = prisma;
