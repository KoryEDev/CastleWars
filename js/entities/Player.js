import { Weapon } from './Weapon.js';

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
    this.isInvulnerable = false;
    this.invulnerabilityTime = 1000; // 1 second of invulnerability after taking damage

    // Movement properties
    this.moveSpeed = 250;
    this.jumpVelocity = -450;
    this.isMoving = false;
    this.lastMoveDirection = 1; // 1 for right, -1 for left

    // Weapon properties
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
    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 500,
      onComplete: () => {
        // Respawn after 3 seconds
        this.scene.time.delayedCall(3000, () => {
          this.respawn();
        });
      }
    });

    // Show death message
    const deathText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      'YOU DIED!',
      {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(10000);

    this.scene.time.delayedCall(3000, () => {
      deathText.destroy();
    });
  }

  respawn() {
    // Reset health
    this.health = this.maxHealth;
    this.updateHealthBar();
    
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
    if (!this.weapon || this.scene.buildMode) {
      return;
    }
    // Check if weapon can fire
    if (!this.weapon.canFire()) {
      return;
    }
    
    // Update weapon state locally (for visual feedback)
    this.weapon.lastFired = Date.now();
    this.weapon.currentAmmo--;
    
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
    
    // Auto reload when empty
    if (this.weapon.currentAmmo <= 0) {
      this.weapon.reload();
    }
    
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
    
    // Destroy old weapon
    if (this.weapon) {
      this.weapon.destroy();
    }
    
    // Create new weapon
    this.weapon = new Weapon(this.scene, this.x, this.y, weaponType);
    this.currentWeaponType = weaponType;
    
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
    
    // Destroy old weapon
    if (this.weapon) {
      this.weapon.destroy();
    }
    
    // Create new weapon
    this.weapon = new Weapon(this.scene, this.x, this.y, newWeaponType);
    
    // Ammo display removed - using inventory system
    
    // Emit weapon switch event for UI sync
    this.scene.events.emit('weaponSwitched', newWeaponType);
    
    // Notify server of weapon change (only if not forced from initialState)
    if (forceIndex === null && this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('weaponChanged', {
        weaponType: newWeaponType
      });
    }
  }

  reload() {
    if (this.weapon && !this.scene.buildMode) {
      console.log('Reloading weapon');
      this.weapon.reload();
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
    if (this.weapon) {
      this.weapon.destroy();
    }
    // Health bars are handled in GameScene
    super.destroy();
  }
} 