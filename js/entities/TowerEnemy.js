import { Enemy } from './Enemy.js';

export class TowerEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'tower');
    this.setTint(0xff0000); // Red tint for tower enemies
    this.setScale(1.5); // Larger size
    this.shieldActive = true;
    this.shieldCooldown = 5000; // 5 seconds
    this.lastShieldToggle = 0;
  }

  update(time, player) {
    // Toggle shield periodically
    if (time - this.lastShieldToggle >= this.shieldCooldown) {
      this.shieldActive = !this.shieldActive;
      this.lastShieldToggle = time;
      
      // Visual feedback for shield state
      if (this.shieldActive) {
        this.setTint(0xff0000);
      } else {
        this.setTint(0x990000);
      }
    }

    // Move slowly towards player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.attackRange) {
      this.setVelocity(
        (dx / distance) * this.speed * 0.5, // Half speed for towers
        (dy / distance) * this.speed * 0.5
      );
    } else {
      this.setVelocity(0, 0);
      this.attack(player);
    }
  }

  takeDamage(amount) {
    // Reduce damage when shield is active
    if (this.shieldActive) {
      amount *= 0.5;
    }
    super.takeDamage(amount);
  }

  // Override base enemy stats
  getMaxHealth() {
    return 300; // Much higher health
  }

  getSpeed() {
    return 50; // Slower movement
  }

  getDamage() {
    return 20; // Higher damage
  }

  getAttackRange() {
    return 100; // Shorter range
  }

  getAttackCooldown() {
    return 2000; // Longer cooldown
  }
} 