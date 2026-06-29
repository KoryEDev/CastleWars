// Shared weapon configuration - single source of truth for server.js and server-pve.js.
// Track 0 (Foundation): centralizing this means content tracks edit ONE file and both
// game servers stay in sync. CommonJS so both Node servers can `require` it.

const WEAPON_CONFIG = {
  // Regular weapons (available to all players)
  pistol: { damage: 15, fireRate: 300, magazineSize: 12, reloadTime: 1000, bulletSpeed: 800 },
  shotgun: { damage: 8, fireRate: 900, magazineSize: 6, reloadTime: 1500, bulletSpeed: 600 },
  rifle: { damage: 12, fireRate: 150, magazineSize: 30, reloadTime: 2000, bulletSpeed: 1000 },
  sniper: { damage: 50, fireRate: 2000, magazineSize: 5, reloadTime: 2500, bulletSpeed: 1500 },

  // Staff-only weapons
  tomatogun: { damage: 999, fireRate: 1500, magazineSize: 8, reloadTime: 2000, bulletSpeed: 500, staffOnly: true, requiredRoles: ['admin', 'ash', 'owner'] },
  minigun: { damage: 5, fireRate: 50, magazineSize: 150, reloadTime: 5000, bulletSpeed: 1000, staffOnly: true, requiredRoles: ['mod', 'admin', 'ash', 'owner'] },

  // Owner-only weapon
  triangun: { damage: 400, fireRate: 50, magazineSize: 4, reloadTime: 2000, bulletSpeed: 1000, staffOnly: true, requiredRoles: ['owner'] }
};

// Validate weapon access by role.
function canUseWeapon(weaponType, playerRole) {
  const weaponInfo = WEAPON_CONFIG[weaponType];
  if (!weaponInfo) return false;
  if (!weaponInfo.staffOnly) return true;
  return weaponInfo.requiredRoles && weaponInfo.requiredRoles.includes(playerRole);
}

// Get role-validated weapon damage (defaults to pistol damage when unauthorized/unknown).
function getValidatedWeaponDamage(weaponType, playerRole) {
  const weaponInfo = WEAPON_CONFIG[weaponType];
  if (!weaponInfo) return 15;
  if (!canUseWeapon(weaponType, playerRole)) return 15;
  return weaponInfo.damage;
}

module.exports = { WEAPON_CONFIG, canUseWeapon, getValidatedWeaponDamage };
