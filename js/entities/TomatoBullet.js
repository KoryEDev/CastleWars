import { Bullet } from './Bullet.js';

export class TomatoBullet extends Bullet {
  constructor(scene, x, y, angle, speed, damage, owner, bulletId = null) {
    super(scene, x, y, angle, speed, damage, owner, bulletId);
    
    // Change texture to tomato
    this.setTexture('tomato');
    this.setScale(1.2); // Smaller size for fitting through gaps
    this.setVisible(true);
    
    // Override collision size for tomatoes
    this.body.setSize(8, 8); // Small collision size to fit through 1x1 gaps
    
    // Make tomatoes red-tinted for owners (darker red since tomatoes are already reddish)
    if (owner && owner.role === 'owner') {
      this.setTint(0xcc0000); // Darker red tint for owner tomatoes
    }
    this.setActive(true);
    this.setDepth(1003); // Same depth as bullets
    
    // Tomato specific properties
    this.splashRadius = 192; // 6x6 tiles (32px each)
    this.areaDamageMultiplier = 0.5; // Area damage is 50% of direct hit (which is instant kill, so 50% = 499 damage)
    
    // Add gravity for arc effect
    this.body.setAllowGravity(true);
    this.body.setGravity(0, 400); // Half of world gravity for nice arc
    
    // Add rotation during flight
    this.rotationSpeed = 0.1;
    
    // Heat-seeking properties
    this.isOwnerBullet = owner && owner.playerId === scene.playerId;
    this.homingStrength = 150; // How strongly it tracks the cursor
    this.maxTurnRate = 3; // Maximum degrees per frame it can turn
  }
  
  update() {
    if (this.active) {
      // Heat-seeking behavior for owner's bullets only
      if (this.isOwnerBullet && this.scene.input.activePointer) {
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // Calculate angle to cursor
        const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        const currentAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        
        // Calculate angle difference
        let angleDiff = angleToTarget - currentAngle;
        
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply turn rate limit
        const turnAmount = Phaser.Math.Clamp(angleDiff, -this.maxTurnRate * Math.PI / 180, this.maxTurnRate * Math.PI / 180);
        
        // Calculate new velocity direction
        const newAngle = currentAngle + turnAmount;
        const speed = Math.sqrt(this.body.velocity.x * this.body.velocity.x + this.body.velocity.y * this.body.velocity.y);
        
        // Apply homing force
        this.body.velocity.x = Math.cos(newAngle) * speed;
        this.body.velocity.y = Math.sin(newAngle) * speed;
        
        // Add slight acceleration towards target
        const dx = worldPoint.x - this.x;
        const dy = worldPoint.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 50) { // Only home if not too close
          this.body.velocity.x += (dx / distance) * this.homingStrength * (16 / 1000); // Frame time adjustment
          this.body.velocity.y += (dy / distance) * this.homingStrength * (16 / 1000);
        }
      }
      
      // Rotate the tomato as it flies
      this.rotation += this.rotationSpeed;
    }
  }
  
  handleBuildingCollision(bullet, building) {
    if (!this.scene || !this.active) return;
    
    // The server will handle the explosion and splatter
    // Just do the camera shake locally
    try {
      this.scene.cameras.main.shake(150, 0.01);
    } catch (error) {
      console.warn('Failed to shake camera:', error);
    }
    
    // Destroy bullet
    this.destroy();
  }
  
  handlePlayerCollision(bullet, player) {
    if (this.owner === player || !this.active) return;
    
    // The server will handle the explosion and splatter
    // Just destroy the bullet visually
    this.destroy();
  }
  
  handleWorldBounds(body) {
    if (body.gameObject === this) {
      // The server will handle the explosion when it detects ground collision
      this.destroy();
    }
  }
}