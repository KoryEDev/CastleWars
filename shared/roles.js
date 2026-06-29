// Shared role definitions - single source of truth for role hierarchy, colors and symbols.
// Used server-side; the client keeps a mirror in js/config for browser ESM compatibility.
// Track 0 (Foundation).

const ROLES = ['player', 'mod', 'admin', 'ash', 'owner'];

// Roles considered "staff" (moderation powers).
const STAFF_ROLES = ['mod', 'admin', 'ash', 'owner'];

// Roles considered "admin" (full control).
const ADMIN_ROLES = ['admin', 'ash', 'owner'];

// Display colors for nameplates/chat per role.
const ROLE_COLORS = {
  player: '#ffffff',
  mod: '#33cc33',
  admin: '#ffa500',
  ash: '#ff66cc',
  owner: '#ff3b3b'
};

// Short symbol/badge per role.
const ROLE_SYMBOLS = {
  player: '',
  mod: '*',
  admin: '+',
  ash: '~',
  owner: '#'
};

function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

module.exports = { ROLES, STAFF_ROLES, ADMIN_ROLES, ROLE_COLORS, ROLE_SYMBOLS, isStaff, isAdmin };
