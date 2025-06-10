export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'basic') {
    super(scene, x, y, 'stickman');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Base properties
    this.type = type;
    this.maxHealth = this.getMaxHealth();
    this.health = this.maxHealth;
    this.speed = this.getSpeed();
    this.damage = this.getDamage();
    this.attackRange = this.getAttackRange();
    this.attackCooldown = this.getAttackCooldown();
    this.lastAttackTime = 0;
    
    // Visual setup
    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    
    // Health bar
    this.createHealthBar();
  }

  getMaxHealth() {
    switch(this.type) {
      case 'basic': return 30;
      case 'ranged': return 20;
      case 'mage': return 25;
      case 'flying': return 15;
      case 'tower': return 100;
      default: return 30;
    }
  }

  getSpeed() {
    switch(this.type) {
      case 'basic': return 100;
      case 'ranged': return 80;
      case 'mage': return 60;
      case 'flying': return 120;
      case 'tower': return 40;
      default: return 100;
    }
  }

  getDamage() {
    switch(this.type) {
      case 'basic': return 10;
      case 'ranged': return 8;
      case 'mage': return 15;
      case 'flying': return 5;
      case 'tower': return 20;
      default: return 10;
    }
  }

  getAttackRange() {
    switch(this.type) {
      case 'basic': return 32;
      case 'ranged': return 300;
      case 'mage': return 200;
      case 'flying': return 32;
      case 'tower': return 32;
      default: return 32;
    }
  }

  getAttackCooldown() {
    switch(this.type) {
      case 'basic': return 1000;
      case 'ranged': return 2000;
      case 'mage': return 3000;
      case 'flying': return 1500;
      case 'tower': return 2000;
      default: return 1000;
    }
  }

  createHealthBar() {
    this.healthBar = this.scene.add.rectangle(this.x, this.y - 40, 40, 4, 0x00ff00)
      .setOrigin(0.5, 0.5);
    this.healthBarBg = this.scene.add.rectangle(this.x, this.y - 40, 40, 4, 0x000000)
      .setOrigin(0.5, 0.5)
      .setAlpha(0.5);
  }

  updateHealthBar() {
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = 40 * healthPercent;
    
    if (healthPercent > 0.6) {
      this.healthBar.fillColor = 0x00ff00;
    } else if (healthPercent > 0.3) {
      this.healthBar.fillColor = 0xffff00;
    } else {
      this.healthBar.fillColor = 0xff0000;
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
    
    // Flash effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 1
    });

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    // Death effect
    const particles = this.scene.add.particles(this.x, this.y, 'stickman', {
      speed: { min: 50, max: 100 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: 10
    });

    // Clean up
    this.healthBar.destroy();
    this.healthBarBg.destroy();
    particles.destroy();
    this.destroy();
  }

  update(player) {
    // Update health bar position
    this.healthBar.setPosition(this.x, this.y - 40);
    this.healthBarBg.setPosition(this.x, this.y - 40);

    // Basic movement towards player
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    
    if (distance > this.attackRange) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      this.setVelocityX(Math.cos(angle) * this.speed);
      this.setVelocityY(Math.sin(angle) * this.speed);
    } else {
      this.setVelocity(0);
      this.attack(player);
    }
  }

  attack(player) {
    const currentTime = this.scene.time.now;
    if (currentTime - this.lastAttackTime >= this.attackCooldown) {
      this.lastAttackTime = currentTime;
      // Basic attack - override in specific enemy types
      player.takeDamage(this.damage);
    }
  }
} 