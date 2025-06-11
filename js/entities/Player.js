import { Weapon } from './Weapon.js';
import { WeaponStateManager } from '../managers/WeaponStateManager.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    console.log('Creating player at:', { x, y });
    super(scene, x, y, 'stickman');
    this.playerId = scene.playerId;
    this.name = scene.playerId;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.playerId = this.playerId;
    this.setCollideWorldBounds(true);
    this.setOrigin(0.5, 1);

    // Set physics properties - full hitbox including head
    this.body.setSize(32, 64);
    this.body.setOffset(0, 0);
    this.body.setBounce(0.1);
    this.body.setDrag(1000, 0);
    this.body.setMaxVelocity(300, 600);
    this.body.setCollideWorldBounds(true);
    this.body.setGravityY(800);

    // Disable local physics for the local player (server handles physics)
    // But keep collision body active for server-side hit detection
    if (scene.playerId === scene.multiplayer?.localId) {
      this.body.setAllowGravity(false);
      this.body.moves = false;
    }

    // Health properties
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isDead = false;
    this.isInvulnerable = false;
    this.invulnerabilityTime = 1000; // 1 second of invulnerability after taking damage

    // Movement properties
    this.moveSpeed = 250;
    this.jumpVelocity = -450;
    this.isMoving = false;
    this.lastMoveDirection = 1; // 1 for right, -1 for left

    // Weapon properties
    this.weaponStateManager = new WeaponStateManager();
    this.weaponInstances = new Map(); // Track weapon instances by inventory slot
    this.currentWeaponId = null; // Track current weapon ID
    console.log('Initializing weapon');
    try {
      this.weapon = new Weapon(scene, x, y);
      console.log('Weapon created successfully');
    } catch (error) {
      console.error('Error creating weapon:', error);
    }
    // All available weapon types
    this.allWeaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper'];
    this.role = scene.playerRole || 'player';
    
    // Add tomato gun for admin+ roles
    if (['admin', 'owner'].includes(this.role)) {
      this.allWeaponTypes.push('tomatogun');
    }
    
    // Equipped weapons based on role
    if (this.role === 'owner') {
      this.weaponTypes = [...this.allWeaponTypes]; // Owners can carry all weapons
    } else if (['admin', 'mod'].includes(this.role)) {
      // Staff can carry 3 weapons
      this.weaponTypes = ['pistol', 'rifle', 'shotgun']; // Default staff loadout
    } else {
      // Regular players can only carry 2 weapons
      this.weaponTypes = ['pistol', 'rifle']; // Default loadout
    }
    this.currentWeaponIndex = 0;

    // Mouse tracking for aiming
    this.aimAngle = 0;
    this.lastTomatoUpdateTime = 0;
    this.scene.input.on('pointermove', (pointer) => {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.aimAngle = Phaser.Math.RadToDeg(
        Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y)
      );
      
      // If using tomato gun, update target position for heat-seeking
      if (this.weapon && this.weapon.type === 'tomatogun') {
        const now = Date.now();
        // Only send updates every 50ms to avoid spamming
        if (now - this.lastTomatoUpdateTime > 50) {
          this.lastTomatoUpdateTime = now;
          if (this.scene.multiplayer && this.scene.multiplayer.socket) {
            this.scene.multiplayer.socket.emit('updateTomatoTarget', {
              targetX: worldPoint.x,
              targetY: worldPoint.y
            });
          }
        }
      }
    });

    // Mouse click for shooting
    this.scene.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown() && !this.scene.buildMode) {
        console.log('Shooting at angle:', this.aimAngle);
        this.shoot();
      }
    });

    // Q key weapon switching removed - using inventory hotbar instead

    // Reload
    this.scene.input.keyboard.on('keydown-R', () => {
      if (!this.scene.buildMode) {
        console.log('Reloading weapon');
        this.reload();
      }
    });

    // Add to player group
    scene.playerGroup.add(this);

    // Removed debug weapon text to prevent visual conflicts

    console.log('Player creation complete');
  }

  updateHealthBar() {
    // Health bar is now handled in GameScene for all players
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.health <= 0) return;
    
    // Don't update health locally for the local player - let server handle it
    // This is just for visual effects
    
    this.isInvulnerable = true;
    
    // Flash effect when taking damage
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 5
    });

    // Screen shake on damage
    this.scene.cameras.main.shake(200, 0.01);
    
    // Check if this is a death (based on server health)
    if (this.health <= 0) {
      this.die();
    } else {
      this.scene.time.delayedCall(this.invulnerabilityTime, () => {
        this.isInvulnerable = false;
      });
    }

    // Emit health changed event
    this.scene.events.emit('playerHealthChanged', this.health, this.maxHealth);
  }

  die() {
    console.log('[CLIENT] Player.die() called - showing death screen');
    // Set death state
    this.isDead = true;
    
    // Death animation for the player sprite
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 500
    });

    // Create death overlay that covers the entire screen including UI
    // Use a graphics object for better control
    const deathOverlay = this.scene.add.graphics();
    deathOverlay.fillStyle(0x000000, 0.7);
    deathOverlay.fillRect(-1000, -1000, 3000, 3000); // Large enough to cover everything
    deathOverlay.setScrollFactor(0);
    deathOverlay.setDepth(9999);

    // Calculate the actual center of the game viewport (excluding UI)
    // Camera viewport starts at UI width and uses remaining width
    const uiWidth = 320; // UI panel width
    const viewportWidth = this.scene.game.config.width - uiWidth;
    const viewportCenterX = uiWidth + (viewportWidth / 2);
    
    // Show death message - centered in game viewport
    const deathText = this.scene.add.text(
      viewportCenterX,
      this.scene.game.config.height / 2 - 50,
      'YOU DIED!',
      {
        fontSize: '64px',
        fontFamily: 'Arial Black',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
        shadow: {
          offsetX: 4,
          offsetY: 4,
          color: '#000000',
          blur: 10,
          stroke: true,
          fill: true
        }
      }
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(10000);

    // Add fade in effect for death text
    deathText.setAlpha(0);
    this.scene.tweens.add({
      targets: deathText,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });

    // Create countdown text - also centered in game viewport
    const countdownText = this.scene.add.text(
      viewportCenterX,
      this.scene.game.config.height / 2 + 30,
      'Respawning in 3...',
      {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(10000);

    // Countdown timer
    let countdown = 3;
    const countdownTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(`Respawning in ${countdown}...`);
        } else {
          countdownText.setText('Respawning...');
        }
      },
      repeat: 2
    });

    // Respawn after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      // Clean up death screen
      deathOverlay.destroy();
      deathText.destroy();
      countdownText.destroy();
      
      // Respawn the player
      this.respawn();
    });
  }

  respawn() {
    console.log('[CLIENT] Player.respawn() called - resetting death state');
    // Reset death state
    this.isDead = false;
    
    // Reset health
    this.health = this.maxHealth;
    this.updateHealthBar();
    
    // Update UI health bar
    if (this.scene.gameUI && this.scene.gameUI.updateHealth) {
      this.scene.gameUI.updateHealth(this.health, this.maxHealth);
    }
    
    // Reset position to spawn
    this.setPosition(100, 1800);
    
    // Reset visual properties
    this.setAlpha(1);
    this.setScale(1, 1);
    
    // Make invulnerable for a short time
    this.isInvulnerable = true;
    this.scene.time.delayedCall(2000, () => {
      this.isInvulnerable = false;
    });
  }

  shoot() {
    // Don't allow shooting when dead
    if (this.isDead) {
      return;
    }
    
    if (!this.weapon || this.scene.buildMode || !this.currentWeaponId) {
      return;
    }
    
    // Check if weapon can fire using state manager
    const weaponState = this.weaponStateManager.getWeaponState(this.currentWeaponId, this.weapon.type);
    if (!this.weaponStateManager.canFire(this.currentWeaponId, this.weapon.type, this.weapon.fireRate)) {
      return;
    }
    
    // Update weapon state through manager
    this.weaponStateManager.updateFireState(this.currentWeaponId, this.weapon.type);
    
    // Update local weapon object to match state
    this.weapon.lastFired = weaponState.lastFired;
    this.weapon.currentAmmo = weaponState.currentAmmo;
    this.weapon.isReloading = weaponState.isReloading;
    
    // Emit ammo update event for UI
    this.scene.events.emit('ammoChanged', {
      currentAmmo: weaponState.currentAmmo,
      magazineSize: weaponState.magazineSize,
      isReloading: weaponState.isReloading,
      weaponType: this.weapon.type
    });
    
    // Ammo display removed - using inventory system
    
    // Handle tomato gun bloating animation
    if (this.weapon.type === 'tomatogun') {
      // Change to bloated sprite temporarily
      this.weapon.setTexture('tomatogunfull');
      this.scene.time.delayedCall(200, () => {
        this.weapon.setTexture('tomatogun');
      });
      // Bigger screen shake for tomato gun
      this.scene.cameras.main.shake(50, 0.01);
    } else {
      // Show muzzle flash for other weapons
      this.weapon.muzzleFlash.setVisible(true);
      this.scene.time.delayedCall(60, () => {
        this.weapon.muzzleFlash.setVisible(false);
        this.weapon.muzzleFlash.alpha = 1;
      });
      // Normal camera shake
      this.scene.cameras.main.shake(20, 0.0007);
    }
    
    // Auto reload when empty is handled by weaponStateManager in updateFireState
    
    // Calculate bullet spawn position
    const radians = Phaser.Math.DegToRad(this.aimAngle);
    const spawnOffset = 30; // Increased offset to help clear corners better
    const bulletX = this.weapon.x + Math.cos(radians) * spawnOffset;
    const bulletY = this.weapon.y + Math.sin(radians) * spawnOffset;
    
    // Create bullet locally for immediate visual feedback
    if (this.weapon.type === 'shotgun') {
      // Fire 5 bullets with spread for shotgun
      const spreadAngles = [-15, -7.5, 0, 7.5, 15];
      for (const spread of spreadAngles) {
        const bulletId = `${this.scene.playerId}_${Date.now()}_${Math.random()}`;
        if (this.scene.add.bullet) {
          this.scene.add.bullet(bulletX, bulletY, this.aimAngle + spread, this.weapon.bulletSpeed, this.weapon.damage, this, bulletId);
        }
      }
    } else if (this.weapon.type === 'tomatogun') {
      // Create tomato bullet locally
      const bulletId = `${this.scene.playerId}_${Date.now()}_${Math.random()}`;
      if (this.scene.add.tomatoBullet) {
        this.scene.add.tomatoBullet(bulletX, bulletY, this.aimAngle, this.weapon.bulletSpeed, this.weapon.damage, this, bulletId);
      }
    } else {
      // Create regular bullet locally
      const bulletId = `${this.scene.playerId}_${Date.now()}_${Math.random()}`;
      if (this.scene.add.bullet) {
        this.scene.add.bullet(bulletX, bulletY, this.aimAngle, this.weapon.bulletSpeed, this.weapon.damage, this, bulletId);
      }
    }
    
    // Emit bullet created event for multiplayer (server will track it)
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      if (this.weapon.type === 'shotgun') {
        // Fire 5 bullets with spread for shotgun
        const spreadAngles = [-15, -7.5, 0, 7.5, 15];
        for (const spread of spreadAngles) {
          this.scene.multiplayer.socket.emit('bulletCreated', {
            x: bulletX,
            y: bulletY,
            angle: this.aimAngle + spread,
            speed: this.weapon.bulletSpeed,
            damage: this.weapon.damage,
            weaponType: this.weapon.type
          });
        }
      } else {
        // Single bullet for other weapons
        // For tomato gun, also send the initial target position
        const bulletData = {
          x: bulletX,
          y: bulletY,
          angle: this.aimAngle,
          speed: this.weapon.bulletSpeed,
          damage: this.weapon.damage,
          weaponType: this.weapon.type
        };
        
        // Add mouse target for heat-seeking tomatoes
        if (this.weapon.type === 'tomatogun') {
          const pointer = this.scene.input.activePointer;
          const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
          bulletData.targetX = worldPoint.x;
          bulletData.targetY = worldPoint.y;
        }
        
        this.scene.multiplayer.socket.emit('bulletCreated', bulletData);
      }
    }
  }

  // Update equipped weapons (called from UI)
  updateEquippedWeapons(weapons) {
    // Validate weapon count based on role
    let maxWeapons = 2; // Default for players
    if (this.role === 'owner') {
      maxWeapons = 5; // Owners can have all weapons
    } else if (['admin', 'mod'].includes(this.role)) {
      maxWeapons = 3; // Staff can have 3 weapons
    }
    
    if (weapons.length > maxWeapons) {
      console.warn(`${this.role} can only equip ${maxWeapons} weapons`);
      weapons = weapons.slice(0, maxWeapons);
    }
    
    this.weaponTypes = [...weapons];
    
    // If current weapon is not in new loadout, switch to first weapon
    const currentWeapon = this.weapon ? this.weapon.type : null;
    if (currentWeapon && !weapons.includes(currentWeapon)) {
      this.currentWeaponIndex = 0;
      this.switchWeapon(0);
    } else if (currentWeapon) {
      // Update index to match new position
      this.currentWeaponIndex = weapons.indexOf(currentWeapon);
    }
  }

  equipWeapon(weaponType) {
    // Validate weapon type
    const validWeapons = ['pistol', 'shotgun', 'rifle', 'sniper'];
    if (['admin', 'owner'].includes(this.role)) {
      validWeapons.push('tomatogun');
    }
    
    if (!validWeapons.includes(weaponType)) {
      console.warn('Invalid weapon type:', weaponType);
      return;
    }
    
    // Generate a unique weapon ID for this weapon instance
    const weaponId = `${weaponType}_${this.playerId}_1`; // Simple ID format
    
    // Check if we already have this weapon instance
    let weaponInstance = this.weaponInstances.get(weaponId);
    
    if (!weaponInstance) {
      // Create new weapon instance only if it doesn't exist
      weaponInstance = new Weapon(this.scene, this.x, this.y, weaponType);
      this.weaponInstances.set(weaponId, weaponInstance);
    } else {
      // Update weapon type if needed (in case the instance exists but with different type)
      if (weaponInstance.type !== weaponType) {
        weaponInstance.destroy();
        weaponInstance = new Weapon(this.scene, this.x, this.y, weaponType);
        this.weaponInstances.set(weaponId, weaponInstance);
      }
    }
    
    // Hide old weapon if switching
    if (this.weapon && this.weapon !== weaponInstance) {
      this.weapon.setVisible(false);
      if (this.weapon.muzzleFlash) {
        this.weapon.muzzleFlash.setVisible(false);
      }
    }
    
    // Set the new active weapon
    this.weapon = weaponInstance;
    this.currentWeaponId = weaponId;
    this.currentWeaponType = weaponType;
    this.weapon.setVisible(true);
    
    // Sync weapon state from the manager
    const weaponState = this.weaponStateManager.getWeaponState(weaponId, weaponType);
    this.weapon.currentAmmo = weaponState.currentAmmo;
    this.weapon.isReloading = weaponState.isReloading;
    this.weapon.lastFired = weaponState.lastFired;
    
    // Emit ammo update event for UI
    console.log('Emitting ammoChanged from equipWeapon:', {
      currentAmmo: weaponState.currentAmmo,
      magazineSize: weaponState.magazineSize,
      isReloading: weaponState.isReloading,
      weaponType: weaponType
    });
    this.scene.events.emit('ammoChanged', {
      currentAmmo: weaponState.currentAmmo,
      magazineSize: weaponState.magazineSize,
      isReloading: weaponState.isReloading,
      weaponType: weaponType
    });
    
    // Ammo display removed - using inventory system
    
    // Notify server of weapon change
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('weaponChanged', {
        weaponType: weaponType
      });
    }
  }

  switchWeapon(forceIndex = null) {
    if (this.scene.buildMode) {
      return;
    }
    
    // If forceIndex is provided, use it, otherwise cycle to next weapon
    if (forceIndex !== null) {
      this.currentWeaponIndex = forceIndex;
    } else {
      // Cycle through equipped weapons
      this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponTypes.length;
    }
    
    const newWeaponType = this.weaponTypes[this.currentWeaponIndex];
    console.log('Switching to weapon:', newWeaponType);
    
    // Use equipWeapon to properly manage weapon instances
    if (newWeaponType && newWeaponType !== 'none') {
      this.equipWeapon(newWeaponType);
    } else {
      this.hideWeapon();
    }
    
    // Emit weapon switch event for UI sync
    this.scene.events.emit('weaponSwitched', newWeaponType || 'none');
    
    // Notify server is already handled in equipWeapon
  }
  
  hideWeapon() {
    // Hide weapon when no weapon is selected
    if (this.weapon) {
      this.weapon.setVisible(false);
      if (this.weapon.muzzleFlash) {
        this.weapon.muzzleFlash.setVisible(false);
      }
      this.weapon = null;
      this.currentWeaponId = null;
    }
    
    // Emit event to hide ammo indicator
    this.scene.events.emit('weaponHidden');
    
    // Notify server
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('weaponChanged', {
        weaponType: 'none'
      });
    }
  }

  reload() {
    if (this.weapon && !this.scene.buildMode && this.currentWeaponId) {
      console.log('Reloading weapon');
      // Use weapon state manager to handle reload
      if (this.weaponStateManager.startReload(this.currentWeaponId, this.weapon.type)) {
        // Update local weapon state
        const weaponState = this.weaponStateManager.getWeaponState(this.currentWeaponId, this.weapon.type);
        this.weapon.isReloading = weaponState.isReloading;
        this.weapon.currentAmmo = weaponState.currentAmmo;
        
        // Emit ammo update event for UI
        this.scene.events.emit('ammoChanged', {
          currentAmmo: weaponState.currentAmmo,
          magazineSize: weaponState.magazineSize,
          isReloading: weaponState.isReloading,
          weaponType: this.weapon.type
        });
        
        // Set up a delayed event for when reload completes
        this.scene.time.delayedCall(this.weaponStateManager.getWeaponReloadTime(this.weapon.type), () => {
          const updatedState = this.weaponStateManager.getWeaponState(this.currentWeaponId, this.weapon.type);
          this.weapon.currentAmmo = updatedState.currentAmmo;
          this.weapon.isReloading = updatedState.isReloading;
          
          // Emit update when reload completes
          this.scene.events.emit('ammoChanged', {
            currentAmmo: updatedState.currentAmmo,
            magazineSize: updatedState.magazineSize,
            isReloading: updatedState.isReloading,
            weaponType: this.weapon.type
          });
        });
      }
    }
  }

  update(cursors) {
    if (!cursors) return;
    
    // Update movement state based on input
    this.isMoving = cursors.left.isDown || cursors.right.isDown;
    
    // Update last move direction based on current input
    if (cursors.left.isDown) {
      this.lastMoveDirection = -1;
    } else if (cursors.right.isDown) {
      this.lastMoveDirection = 1;
    }
    
    // Animation logic
    if (this.body.velocity.x < 0) {
      this.anims.play('left', true);
    } else if (this.body.velocity.x > 0) {
      this.anims.play('right', true);
    } else {
      // this.anims.play('turn');
    }

    // Update aimAngle every frame
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aimAngle = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y)
    );

    // Determine weapon offset based on movement state and direction
    let weaponOffsetX = 15;
    if (this.isMoving) {
      // When running, reduce offset to keep weapon closer
      weaponOffsetX = 10;
    }
    
    // Apply direction to offset
    weaponOffsetX = weaponOffsetX * this.lastMoveDirection;

    // Update weapon position and angle to always match player and aim
    if (this.weapon) {
      this.weapon.update(
        this.x + weaponOffsetX,
        this.y - 30, // Raised from 20 to 30 for better hand positioning
        this.lastMoveDirection === -1, // flipX based on last move direction
        this.aimAngle
      );
    }

    // Update health bar position
    // Health bar is now handled in GameScene

    // Weapon info text removed to prevent visual conflicts
  }

  destroy() {
    // Destroy all weapon instances
    for (const [weaponId, weaponInstance] of this.weaponInstances) {
      weaponInstance.destroy();
    }
    this.weaponInstances.clear();
    
    if (this.weapon) {
      this.weapon = null;
    }
    
    // Clear weapon state manager
    this.weaponStateManager.clear();
    
    // Health bars are handled in GameScene
    super.destroy();
  }
} 