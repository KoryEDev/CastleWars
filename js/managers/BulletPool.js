import { Bullet } from '../entities/Bullet.js';
import { TomatoBullet } from '../entities/TomatoBullet.js';

export class BulletPool {
  constructor(scene) {
    this.scene = scene;
    this.regularBullets = [];
    this.tomatoBullets = [];
    
    // Pre-allocate bullets
    this.minPoolSize = 50;
    this.maxPoolSize = 200;
    
    // Initialize pools
    this.initializePool();
  }
  
  initializePool() {
    // Pre-create regular bullets
    for (let i = 0; i < this.minPoolSize; i++) {
      const bullet = new Bullet(this.scene, -1000, -1000, 0, 0, 0, null);
      bullet.setActive(false);
      bullet.setVisible(false);
      this.regularBullets.push(bullet);
    }
    
    // Pre-create some tomato bullets
    for (let i = 0; i < 10; i++) {
      const bullet = new TomatoBullet(this.scene, -1000, -1000, 0, 0, 0, null);
      bullet.setActive(false);
      bullet.setVisible(false);
      this.tomatoBullets.push(bullet);
    }
  }
  
  getBullet(x, y, angle, speed, damage, owner, bulletId = null, type = 'regular') {
    let pool = type === 'tomato' ? this.tomatoBullets : this.regularBullets;
    let bullet = null;
    
    // Find inactive bullet in pool
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) {
        bullet = pool[i];
        break;
      }
    }
    
    // If no inactive bullets and we haven't hit max, create new one
    if (!bullet && pool.length < this.maxPoolSize) {
      if (type === 'tomato') {
        bullet = new TomatoBullet(this.scene, x, y, angle, speed, damage, owner, bulletId);
        this.tomatoBullets.push(bullet);
      } else {
        bullet = new Bullet(this.scene, x, y, angle, speed, damage, owner, bulletId);
        this.regularBullets.push(bullet);
      }
    }
    
    // If we found or created a bullet, reset it
    if (bullet) {
      // Reset bullet properties
      bullet.setPosition(x, y);
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setAlpha(1);
      bullet.setScale(0.5);
      
      // Reset physics
      bullet.body.enable = true;
      bullet.body.reset(x, y);
      
      // Update properties
      bullet.owner = owner;
      bullet.bulletId = bulletId;
      bullet.damage = damage;
      
      // Set velocity
      const radians = Phaser.Math.DegToRad(angle);
      bullet.velocityX = Math.cos(radians) * speed;
      bullet.velocityY = Math.sin(radians) * speed;
      bullet.setVelocity(bullet.velocityX, bullet.velocityY);
      bullet.setRotation(radians);
      
      // Apply tint for owner bullets
      if (owner && owner.role === 'owner') {
        bullet.setTint(0xff0000);
      } else {
        bullet.clearTint();
      }
      
      // For tomato bullets, reset specific properties
      if (type === 'tomato' && bullet.resetTomato) {
        bullet.resetTomato(x, y, angle, speed, damage, owner, bulletId);
      }
      
      return bullet;
    }
    
    // If we couldn't get a bullet (pool is full and all active), return null
    return null;
  }
  
  returnBullet(bullet) {
    // Instead of destroying, just deactivate
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.setPosition(-1000, -1000);
    bullet.setVelocity(0, 0);
    bullet.body.enable = false;
  }
  
  clearAll() {
    // Return all bullets to pool
    this.regularBullets.forEach(bullet => {
      if (bullet.active) {
        this.returnBullet(bullet);
      }
    });
    
    this.tomatoBullets.forEach(bullet => {
      if (bullet.active) {
        this.returnBullet(bullet);
      }
    });
  }
  
  destroy() {
    // Properly destroy all bullets
    this.regularBullets.forEach(bullet => bullet.destroy());
    this.tomatoBullets.forEach(bullet => bullet.destroy());
    this.regularBullets = [];
    this.tomatoBullets = [];
  }
}