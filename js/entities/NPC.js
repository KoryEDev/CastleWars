// Base NPC class for PvE enemies
export class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'grunt') {
    // Choose sprite based on NPC type
    const spriteKey = NPC.getSpriteKey(type);
    super(scene, x, y, spriteKey);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Basic properties
    this.npcId = `npc_${Date.now()}_${Math.random()}`;
    this.type = type;
    this.isNPC = true;
    
    // Get stats based on type
    const stats = NPC.getStats(type);
    this.maxHealth = stats.health;
    this.health = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.blockDamage = stats.blockDamage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.lastAttackTime = 0;
    
    // Physics setup
    this.setCollideWorldBounds(true);
    this.setBounce(0.1);
    this.setDrag(100, 0);
    
    // AI properties
    this.target = null;
    this.targetBlock = null;
    this.path = [];
    this.pathIndex = 0;
    this.lastPathUpdate = 0;
    this.pathUpdateInterval = 1000; // Recalculate path every second
    
    // State machine
    this.state = 'idle'; // idle, moving, attacking, dead
    this.stateTimer = 0;
    
    // Visual properties
    this.setOrigin(0.5, 1);
    this.setScale(0.8);
    
    // Health bar
    this.createHealthBar();
    
    // Special ability timers
    this.specialTimer = 0;
    this.specialCooldown = stats.specialCooldown || 10000;
  }
  
  static getSpriteKey(type) {
    const spriteMap = {
      grunt: 'enemy',
      archer: 'enemy_archer',
      mage: 'enemy_mage',
      brute: 'enemy_brute',
      siegeTower: 'enemy_siege',
      assassin: 'enemy_assassin',
      bomber: 'enemy_bomber',
      necromancer: 'enemy_necromancer'
    };
    return spriteMap[type] || 'enemy';
  }
  
  static getStats(type) {
    const stats = {
      grunt: {
        health: 50,
        speed: 150,
        damage: 15,
        blockDamage: 5,
        attackRange: 40,
        attackCooldown: 1000
      },
      archer: {
        health: 30,
        speed: 100,
        damage: 10,
        blockDamage: 3,
        attackRange: 300,
        attackCooldown: 1500
      },
      mage: {
        health: 40,
        speed: 80,
        damage: 25,
        blockDamage: 15,
        attackRange: 200,
        attackCooldown: 2500,
        specialCooldown: 10000 // Teleport cooldown
      },
      brute: {
        health: 200,
        speed: 60,
        damage: 40,
        blockDamage: 20,
        attackRange: 50,
        attackCooldown: 2000
      },
      siegeTower: {
        health: 500,
        speed: 40,
        damage: 0,
        blockDamage: 50,
        attackRange: 0,
        attackCooldown: 0,
        specialCooldown: 5000 // Spawn enemies cooldown
      },
      assassin: {
        health: 20,
        speed: 250,
        damage: 30,
        blockDamage: 0,
        attackRange: 30,
        attackCooldown: 800,
        specialCooldown: 5000 // Stealth cooldown
      },
      bomber: {
        health: 60,
        speed: 180,
        damage: 100,
        blockDamage: 50,
        attackRange: 50,
        attackCooldown: 0 // Explodes on contact
      },
      necromancer: {
        health: 150,
        speed: 70,
        damage: 20,
        blockDamage: 5,
        attackRange: 250,
        attackCooldown: 2000,
        specialCooldown: 8000 // Summon cooldown
      }
    };
    return stats[type] || stats.grunt;
  }
  
  createHealthBar() {
    // Create health bar background
    this.healthBarBg = this.scene.add.rectangle(
      this.x, 
      this.y - 70, 
      40, 
      6, 
      0x000000
    );
    this.healthBarBg.setDepth(1000);
    
    // Create health bar fill
    this.healthBar = this.scene.add.rectangle(
      this.x, 
      this.y - 70, 
      40, 
      6, 
      0xff0000
    );
    this.healthBar.setDepth(1001);
    
    // Create name/type text
    this.nameText = this.scene.add.text(
      this.x, 
      this.y - 80, 
      this.type.toUpperCase(), 
      {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#ff6666',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    this.nameText.setOrigin(0.5, 0.5);
    this.nameText.setDepth(1000);
  }
  
  updateHealthBar() {
    if (!this.healthBar || !this.healthBarBg || !this.nameText) return;
    
    // Update positions
    this.healthBarBg.setPosition(this.x, this.y - 70);
    this.healthBar.setPosition(this.x, this.y - 70);
    this.nameText.setPosition(this.x, this.y - 80);
    
    // Update health bar width
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = 40 * healthPercent;
    
    // Hide if dead
    if (this.health <= 0) {
      this.healthBar.setVisible(false);
      this.healthBarBg.setVisible(false);
      this.nameText.setVisible(false);
    }
  }
  
  takeDamage(amount) {
    if (this.state === 'dead') return;
    
    this.health -= amount;
    
    // Flash effect
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });
    
    if (this.health <= 0) {
      this.die();
    }
    
    this.updateHealthBar();
  }
  
  die() {
    this.state = 'dead';
    
    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 500,
      onComplete: () => {
        this.destroy();
      }
    });
    
    // Clean up health bar
    if (this.healthBar) this.healthBar.destroy();
    if (this.healthBarBg) this.healthBarBg.destroy();
    if (this.nameText) this.nameText.destroy();
    
    // Special death effects
    if (this.type === 'bomber') {
      this.explode();
    }
  }
  
  explode() {
    // Create explosion effect
    const explosion = this.scene.add.circle(this.x, this.y, 100, 0xff6600, 0.8);
    explosion.setDepth(500);
    
    // Explosion animation
    this.scene.tweens.add({
      targets: explosion,
      radius: 150,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        explosion.destroy();
      }
    });
    
    // Damage nearby entities (handled server-side)
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcExploded', {
        npcId: this.npcId,
        x: this.x,
        y: this.y,
        radius: 150,
        damage: this.damage
      });
    }
  }
  
  update(time, delta) {
    if (this.state === 'dead') return;
    
    // Update timers
    this.stateTimer += delta;
    this.specialTimer += delta;
    
    // Update health bar position
    this.updateHealthBar();
    
    // State-specific updates
    switch (this.state) {
      case 'idle':
        this.updateIdle(time, delta);
        break;
      case 'moving':
        this.updateMoving(time, delta);
        break;
      case 'attacking':
        this.updateAttacking(time, delta);
        break;
    }
    
    // Type-specific behaviors
    this.updateSpecialBehavior(time, delta);
  }
  
  updateIdle(time, delta) {
    // Look for targets
    if (this.findTarget()) {
      this.state = 'moving';
      this.stateTimer = 0;
    }
  }
  
  updateMoving(time, delta) {
    // Move towards target
    if (!this.target && !this.targetBlock) {
      this.state = 'idle';
      return;
    }
    
    // Check if we need to update path
    if (time - this.lastPathUpdate > this.pathUpdateInterval) {
      this.calculatePath();
      this.lastPathUpdate = time;
    }
    
    // Follow path
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const targetNode = this.path[this.pathIndex];
      const distance = Phaser.Math.Distance.Between(this.x, this.y, targetNode.x, targetNode.y);
      
      if (distance < 20) {
        this.pathIndex++;
      } else {
        // Move towards next node
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetNode.x, targetNode.y);
        this.setVelocityX(Math.cos(angle) * this.speed);
        this.setVelocityY(Math.sin(angle) * this.speed);
      }
    }
    
    // Check if in attack range
    if (this.checkAttackRange()) {
      this.state = 'attacking';
      this.stateTimer = 0;
      this.setVelocity(0, 0);
    }
  }
  
  updateAttacking(time, delta) {
    // Perform attack if cooldown is ready
    if (time - this.lastAttackTime > this.attackCooldown) {
      this.performAttack();
      this.lastAttackTime = time;
    }
    
    // Check if target is still in range
    if (!this.checkAttackRange()) {
      this.state = 'moving';
      this.stateTimer = 0;
    }
  }
  
  updateSpecialBehavior(time, delta) {
    // Override in subclasses for special behaviors
  }
  
  findTarget() {
    // Find nearest player or important structure
    // This will be implemented based on server-side logic
    return false;
  }
  
  calculatePath() {
    // Simple pathfinding - will be enhanced with A* later
    this.path = [];
    this.pathIndex = 0;
  }
  
  checkAttackRange() {
    if (!this.target && !this.targetBlock) return false;
    
    const targetX = this.target ? this.target.x : this.targetBlock.x + 32;
    const targetY = this.target ? this.target.y : this.targetBlock.y + 32;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    
    return distance <= this.attackRange;
  }
  
  performAttack() {
    // Override in subclasses
  }
  
  destroy() {
    // Clean up health bar
    if (this.healthBar) this.healthBar.destroy();
    if (this.healthBarBg) this.healthBarBg.destroy();
    if (this.nameText) this.nameText.destroy();
    
    super.destroy();
  }
}