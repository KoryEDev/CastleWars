import { Enemy } from './Enemy.js';
import { Bullet } from './Bullet.js';

export class RangedEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'ranged');
    this.projectileGroup = scene.physics.add.group();
    this.setTint(0x0000ff); // Blue tint for ranged enemies
  }

  attack(player) {
    const currentTime = this.scene.time.now;
    if (currentTime - this.lastAttackTime >= this.attackCooldown) {
      this.lastAttackTime = currentTime;
      
      // Create projectile
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const projectile = new Bullet(this.scene, this.x, this.y);
      this.projectileGroup.add(projectile);
      
      // Set projectile velocity
      const speed = 300;
      projectile.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
      
      // Add collision with player
      this.scene.physics.add.overlap(projectile, player, (proj, p) => {
        p.takeDamage(this.damage);
        proj.destroy();
      });
      
      // Add collision with buildings
      this.scene.physics.add.collider(projectile, this.scene.buildGroup, (proj, building) => {
        if (building.texture.key !== 'tunnel') {
          proj.destroy();
        }
      });
    }
  }
} 