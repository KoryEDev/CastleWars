import { Enemy } from './Enemy.js';

export class FlyingEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'flying');
    this.setTint(0x00ff00); // Green tint for flying enemies
    this.hoverHeight = 100; // Height to hover at
    this.hoverSpeed = 2; // Speed of hover movement
    this.hoverTime = 0;
  }

  update(time, player) {
    // Override gravity
    this.body.setAllowGravity(false);
    
    // Calculate hover offset
    this.hoverTime += this.hoverSpeed;
    const hoverOffset = Math.sin(this.hoverTime * 0.01) * 20;
    
    // Move towards player while maintaining hover height
    const targetY = player.y - this.hoverHeight + hoverOffset;
    const targetX = player.x;
    
    // Smooth movement
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    
    this.setVelocity(
      dx * 0.05,
      dy * 0.05
    );
    
    // Attack if in range
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distance <= this.attackRange) {
      this.attack(player);
    }
  }
} 