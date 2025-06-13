export class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, speed, damage, owner, bulletId = null) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(1003);
    this.setVisible(true);
    
    // Make bullets red for owners
    if (owner && owner.role === 'owner') {
      this.setTint(0xff0000); // Red tint for owner bullets
    }
    
    // Store the player object who fired this bullet
    this.owner = owner;
    // Store unique bullet ID for synchronization
    this.bulletId = bulletId;
    
    // Physics properties
    this.body.setAllowGravity(false);
    this.body.setGravity(0, 0);
    this.body.setImmovable(false);
    this.body.setBounce(0);
    this.body.setCollideWorldBounds(true);
    this.body.setSize(4, 4); // Very small collision size for precise shooting
    this.setScale(0.5); // Smaller visual size to match collision
    this.damage = damage;
    
    // Store initial velocity components
    if (!speed || isNaN(speed)) speed = 800;
    const radians = Phaser.Math.DegToRad(angle);
    this.velocityX = Math.cos(radians) * speed;
    this.velocityY = Math.sin(radians) * speed;
    
    // Set initial velocity
    this.setVelocity(this.velocityX, this.velocityY);
    
    // Set rotation to match trajectory
    this.setRotation(radians);
    
    // Set up collision with world bounds
    this.body.onWorldBounds = true;
    this.body.world.on('worldbounds', this.handleWorldBounds, this);
  }

  update() {
    // Ensure velocity is maintained
    if (this.active) {
      this.body.velocity.set(this.velocityX, this.velocityY);
    }
  }

  handleWorldBounds(body) {
    if (body.gameObject === this) {
      this.destroy();
    }
  }

  handleBuildingCollision(bullet, building) {
    if (!this.scene || !this.active) return;
    
    try {
      // Screen shake on impact
      this.scene.cameras.main.shake(100, 0.005);
    } catch (error) {
      console.warn('Failed to shake camera:', error);
    }
    
    // Destroy bullet
    this.destroy();
  }

  handlePlayerCollision(bullet, player) {
    if (this.owner === player || !this.active) return;
    
    // Don't process collision on client side - let server handle it
    // This prevents double damage and ensures server authority
    
    // Just destroy the bullet visually on client
    this.destroy();
  }

  destroy(fromSync = false) {
    if (this.active) {
      // Only emit bullet destroyed event if not already being destroyed from sync
      if (!fromSync && this.bulletId && this.scene.multiplayer && this.scene.multiplayer.socket) {
        this.scene.multiplayer.socket.emit('bulletDestroyed', {
          bulletId: this.bulletId
        });
      }
      
      // If scene has bullet pool, return to pool instead of destroying
      if (this.scene.bulletPool && this.scene.bulletPool.returnBullet) {
        this.scene.bulletPool.returnBullet(this);
      } else {
        super.destroy();
      }
    }
  }
} 