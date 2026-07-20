const {
  BLOOD_GROUP_REVERSE_MAP,
  WEIGHT_CATEGORY_REVERSE_MAP,
} = require('./enumMaps');

// Strips passwordHash and translates the internal enum keys (see enumMaps.js)
// back to the human-readable form the API speaks, e.g. A_POSITIVE -> "A+".
function formatDonor(donor) {
  const { passwordHash, ...rest } = donor;
  return {
    ...rest,
    bloodGroup: BLOOD_GROUP_REVERSE_MAP[donor.bloodGroup] || donor.bloodGroup,
    weight: WEIGHT_CATEGORY_REVERSE_MAP[donor.weight] || donor.weight,
  };
}

function formatAdmin(admin) {
  const { passwordHash, ...rest } = admin;
  return rest;
}

module.exports = { formatDonor, formatAdmin };
