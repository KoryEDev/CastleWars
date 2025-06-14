// WeaponStateManager.js - Manages individual weapon states to prevent exploit
export class WeaponStateManager {
  constructor() {
    // Store state for each weapon instance
    // Key: weaponId (e.g., "pistol_1", "pistol_2", etc.)
    this.weaponStates = new Map();
  }

  // Get or create weapon state
  getWeaponState(weaponId, weaponType) {
    if (!this.weaponStates.has(weaponId)) {
      // Create new state with weapon defaults
      const magazineSize = this.getWeaponMagazineSize(weaponType);
      this.weaponStates.set(weaponId, {
        type: weaponType,
        currentAmmo: magazineSize,
        magazineSize: magazineSize,
        lastFired: 0,
        isReloading: false,
        reloadEndTime: 0
      });
    }
    
    const state = this.weaponStates.get(weaponId);
    
    // Check if reload has finished
    if (state.isReloading && Date.now() >= state.reloadEndTime) {
      state.isReloading = false;
      state.currentAmmo = state.magazineSize;
    }
    
    return state;
  }

  // Update weapon state after firing
  updateFireState(weaponId, weaponType) {
    const state = this.getWeaponState(weaponId, weaponType);
    state.lastFired = Date.now();
    state.currentAmmo = Math.max(0, state.currentAmmo - 1);
    
    // Auto-reload if out of ammo
    if (state.currentAmmo === 0 && !state.isReloading) {
      this.startReload(weaponId, weaponType);
    }
    
    return state;
  }

  // Start reload for a weapon
  startReload(weaponId, weaponType) {
    const state = this.getWeaponState(weaponId, weaponType);
    if (state.isReloading || state.currentAmmo === state.magazineSize) {
      return false;
    }
    
    state.isReloading = true;
    state.reloadEndTime = Date.now() + this.getWeaponReloadTime(weaponType);
    return true;
  }

  // Check if weapon can fire
  canFire(weaponId, weaponType, fireRate) {
    const state = this.getWeaponState(weaponId, weaponType);
    const now = Date.now();
    
    // Check reload status
    if (state.isReloading && now >= state.reloadEndTime) {
      state.isReloading = false;
      state.currentAmmo = state.magazineSize;
    }
    
    return !state.isReloading && 
           state.currentAmmo > 0 && 
           now - state.lastFired >= fireRate;
  }

  // Get magazine sizes (matching Weapon.js)
  getWeaponMagazineSize(type) {
    const sizes = {
      pistol: 12,
      shotgun: 6,
      rifle: 30,
      sniper: 5,
      tomatogun: 8,
      minigun: 150
    };
    return sizes[type] || 12;
  }

  // Get reload times (matching Weapon.js)
  getWeaponReloadTime(type) {
    const times = {
      pistol: 1000,
      shotgun: 1500,
      rifle: 2000,
      sniper: 2500,
      tomatogun: 2000,
      minigun: 5000
    };
    return times[type] || 1000;
  }

  // Clear all weapon states (for cleanup)
  clear() {
    this.weaponStates.clear();
  }
}