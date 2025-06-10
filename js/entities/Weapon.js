export class Weapon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'pistol') {
    console.log('Creating weapon:', { type, x, y });
    super(scene, x, y, type);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    
    // Weapon properties
    this.type = type;
    this.damage = this.getWeaponDamage(type);
    this.fireRate = this.getWeaponFireRate(type);
    this.bulletSpeed = this.getWeaponBulletSpeed(type);
    this.lastFired = 0;
    this.isReloading = false;
    this.magazineSize = this.getWeaponMagazineSize(type);
    this.currentAmmo = this.magazineSize;
    this.reloadTime = this.getWeaponReloadTime(type);
    
    // Visual properties
    this.setOrigin(0.5, 0.5);
    this.setDepth(1002); // Above player
    this.setScale(0.8);
    this.setVisible(true); // Ensure weapon is visible
    
    // Muzzle flash effect
    this.muzzleFlash = scene.add.sprite(x, y, 'muzzle_flash')
      .setOrigin(0.5, 0.5)
      .setDepth(1002)
      .setVisible(false)
      .setScale(0.8);

    console.log('Weapon created with properties:', {
      type: this.type,
      damage: this.damage,
      fireRate: this.fireRate,
      bulletSpeed: this.bulletSpeed,
      magazineSize: this.magazineSize,
      reloadTime: this.reloadTime
    });
  }

  getWeaponDamage(type) {
    const damages = {
      pistol: 15,      // 7 shots to kill (was 5)
      shotgun: 8,      // 13 pellets to kill, ~3 shots at close range (was 7 pellets)
      rifle: 12,       // 9 shots to kill (was 4)
      sniper: 50,      // 2 shots to kill (was 1)
      tomatogun: 999   // Instant kill on direct hit (unchanged)
    };
    return damages[type] || 15;
  }

  getWeaponFireRate(type) {
    const fireRates = {
      pistol: 300,     // Faster fire rate (was 500ms)
      shotgun: 900,    // Slightly slower (was 800ms)
      rifle: 150,      // Slower fire rate (was 100ms)
      sniper: 2000,    // Slower fire rate (was 1500ms)
      tomatogun: 1500  // Slower fire rate for balance (was 1200ms)
    };
    return fireRates[type] || 300;
  }

  getWeaponBulletSpeed(type) {
    const speeds = {
      pistol: 800,
      shotgun: 600,
      rifle: 1000,
      sniper: 1500,
      tomatogun: 500  // Slower projectile with arc
    };
    return speeds[type] || 800;
  }

  getWeaponMagazineSize(type) {
    const sizes = {
      pistol: 12,
      shotgun: 6,
      rifle: 30,
      sniper: 5,
      tomatogun: 8
    };
    return sizes[type] || 12;
  }

  getWeaponReloadTime(type) {
    const times = {
      pistol: 1000,
      shotgun: 1500,
      rifle: 2000,
      sniper: 2500,
      tomatogun: 2000
    };
    return times[type] || 1000;
  }

  update(x, y, flipX, angle = 0) {
    // Calculate weapon position based on player position and angle
    const offset = 15; // Distance from player center
    const radians = Phaser.Math.DegToRad(angle);
    const weaponX = x + Math.cos(radians) * offset
    const weaponY = y + Math.sin(radians) * offset;
    
    this.setPosition(weaponX, weaponY);
    
    // Handle rotation differently based on direction
    if (angle > 90 || angle < -90) {
      // Pointing left - flip the sprite and adjust rotation
      this.setFlipY(true);
      this.setRotation(radians);
    } else {
      // Pointing right - normal rotation
      this.setFlipY(false);
      this.setRotation(radians);
    }
    
    // Update muzzle flash position and rotation
    this.muzzleFlash.setPosition(weaponX, weaponY);
    this.muzzleFlash.setFlipY(this.flipY);
    this.muzzleFlash.setRotation(radians);
  }

  canFire() {
    const now = Date.now();
    const canFire = !this.isReloading && 
                    this.currentAmmo > 0 && 
                    now - this.lastFired >= this.fireRate;
    if (!canFire) {
      console.log('Cannot fire:', {
        isReloading: this.isReloading,
        currentAmmo: this.currentAmmo,
        timeSinceLastFire: now - this.lastFired,
        fireRate: this.fireRate
      });
    }
    return canFire;
  }

  fire(angle) {
    // This method is now deprecated - firing is handled in Player.shoot()
    // Kept for compatibility but returns null
    return null;
  }

  reload() {
    if (this.isReloading || this.currentAmmo === this.magazineSize) {
      console.log('Cannot reload:', {
        isReloading: this.isReloading,
        currentAmmo: this.currentAmmo,
        magazineSize: this.magazineSize
      });
      return;
    }

    console.log('Starting reload');
    this.isReloading = true;
    
    // Update ammo display to show reloading
    if (this.scene.enhancedUI) {
      this.scene.enhancedUI.updateAmmo(0, this.magazineSize);
    }
    
    this.scene.time.delayedCall(this.reloadTime, () => {
      this.currentAmmo = this.magazineSize;
      this.isReloading = false;
      console.log('Reload complete');
      
      // Update ammo display after reload
      if (this.scene.enhancedUI) {
        this.scene.enhancedUI.updateAmmo(this.currentAmmo, this.magazineSize);
      }
    });
  }
} 