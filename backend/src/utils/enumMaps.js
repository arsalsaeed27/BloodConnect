// Prisma enum values can't contain characters like "+"/"-" or start with a
// digit, so the schema stores them under safe identifiers (see
// prisma/schema.prisma) and @maps them to these human-readable DB values.
// Incoming request payloads use the human-readable form, so it must be
// translated to the Prisma Client enum key before hitting the database.

const BLOOD_GROUP_MAP = {
  'A+': 'A_POSITIVE',
  'A-': 'A_NEGATIVE',
  'B+': 'B_POSITIVE',
  'B-': 'B_NEGATIVE',
  'AB+': 'AB_POSITIVE',
  'AB-': 'AB_NEGATIVE',
  'O+': 'O_POSITIVE',
  'O-': 'O_NEGATIVE',
};

const WEIGHT_CATEGORY_MAP = {
  'Below 50kg': 'BELOW_50KG',
  '50kg': 'FIFTY_KG',
  'Above 50kg': 'ABOVE_50KG',
};

function reverseOf(map) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key]));
}

// For the reverse direction: translating a Prisma Client enum key back to
// its human-readable display value for API responses.
const BLOOD_GROUP_REVERSE_MAP = reverseOf(BLOOD_GROUP_MAP);
const WEIGHT_CATEGORY_REVERSE_MAP = reverseOf(WEIGHT_CATEGORY_MAP);

module.exports = {
  BLOOD_GROUP_MAP,
  WEIGHT_CATEGORY_MAP,
  BLOOD_GROUP_REVERSE_MAP,
  WEIGHT_CATEGORY_REVERSE_MAP,
};
