import { NPC } from './NPC.js';

// Grunt - Basic melee enemy
export class GruntNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'grunt');
    
    // Can climb 1-block walls
    this.canClimb = true;
    this.jumpPower = -400;
  }
  
  performAttack() {
    // Melee attack
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcMeleeAttack', {
        npcId: this.npcId,
        targetId: this.target ? this.target.playerId : null,
        targetBlock: this.targetBlock,
        damage: this.damage,
        blockDamage: this.blockDamage
      });
    }
    
    // Attack animation
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      duration: 100,
      yoyo: true
    });
  }
}

// Archer - Ranged attacker
export class ArcherNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'archer');
    
    // Prefer high ground
    this.preferHighGround = true;
    this.projectileSpeed = 400;
  }
  
  performAttack() {
    if (!this.target && !this.targetBlock) return;
    
    // Calculate angle to target
    const targetX = this.target ? this.target.x : this.targetBlock.x + 32;
    const targetY = this.target ? this.target.y : this.targetBlock.y + 32;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    
    // Fire arrow
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcProjectile', {
        npcId: this.npcId,
        type: 'arrow',
        x: this.x,
        y: this.y - 20,
        angle: angle,
        speed: this.projectileSpeed,
        damage: this.damage,
        blockDamage: this.blockDamage
      });
    }
    
    // Bow animation
    this.setScale(0.7, 0.8);
    this.scene.time.delayedCall(200, () => {
      this.setScale(0.8, 0.8);
    });
  }
}

// Mage - Magic user with teleport
export class MageNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'mage');
    
    this.teleportRange = 150;
    this.aoeRadius = 80;
  }
  
  performAttack() {
    if (!this.target && !this.targetBlock) return;
    
    // Cast fireball (AoE)
    const targetX = this.target ? this.target.x : this.targetBlock.x + 32;
    const targetY = this.target ? this.target.y : this.targetBlock.y + 32;
    
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcProjectile', {
        npcId: this.npcId,
        type: 'fireball',
        x: this.x,
        y: this.y - 30,
        targetX: targetX,
        targetY: targetY,
        speed: 300,
        damage: this.damage,
        blockDamage: this.blockDamage,
        aoeRadius: this.aoeRadius
      });
    }
    
    // Cast animation
    this.setTint(0xff00ff);
    this.scene.time.delayedCall(300, () => {
      this.clearTint();
    });
  }
  
  updateSpecialBehavior(time, delta) {
    // Teleport when threatened
    if (this.specialTimer > this.specialCooldown && this.state === 'attacking') {
      // Check if any player is too close
      const players = this.scene.playerGroup.getChildren();
      for (const player of players) {
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (distance < 100) {
          this.teleport();
          break;
        }
      }
    }
  }
  
  teleport() {
    // Teleport effect
    const oldX = this.x;
    const oldY = this.y;
    
    // Create disappear effect
    const disappearEffect = this.scene.add.sprite(oldX, oldY, this.texture.key);
    disappearEffect.setAlpha(0.5);
    disappearEffect.setTint(0x9900ff);
    
    this.scene.tweens.add({
      targets: disappearEffect,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 200,
      onComplete: () => disappearEffect.destroy()
    });
    
    // Calculate new position
    const angle = Math.random() * Math.PI * 2;
    const distance = this.teleportRange;
    const newX = this.x + Math.cos(angle) * distance;
    const newY = this.y + Math.sin(angle) * distance;
    
    // Teleport
    this.setPosition(newX, newY);
    this.specialTimer = 0;
    
    // Appear effect
    this.setScale(0, 0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 200
    });
  }
}

// Brute - Tank enemy
export class BruteNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'brute');
    
    // Immune to knockback
    this.setImmovable(true);
    this.damageReduction = 0.5; // Takes 50% less damage from explosions
  }
  
  performAttack() {
    // Heavy slam attack
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcMeleeAttack', {
        npcId: this.npcId,
        targetId: this.target ? this.target.playerId : null,
        targetBlock: this.targetBlock,
        damage: this.damage,
        blockDamage: this.blockDamage,
        knockback: true
      });
    }
    
    // Slam animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 20,
      duration: 200,
      yoyo: true,
      onComplete: () => {
        // Ground shake effect
        if (this.scene.cameras && this.scene.cameras.main) {
          this.scene.cameras.main.shake(100, 0.01);
        }
      }
    });
  }
  
  takeDamage(amount) {
    // Apply damage reduction for explosions
    if (amount > 50) { // Assume high damage is from explosions
      amount *= this.damageReduction;
    }
    super.takeDamage(amount);
  }
}

// Siege Tower - Spawns enemies
export class SiegeTowerNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'siegeTower');
    
    this.spawnTypes = ['grunt', 'archer', 'assassin'];
    this.spawnCount = 0;
    this.maxSpawns = 5;
    this.hasDeployed = false;
  }
  
  performAttack() {
    // Siege towers don't attack directly
  }
  
  updateSpecialBehavior(time, delta) {
    // Deploy enemies when reaching a wall
    if (!this.hasDeployed && this.specialTimer > this.specialCooldown) {
      // Check if near a building
      const buildings = this.scene.buildingGroup ? this.scene.buildingGroup.getChildren() : [];
      for (const building of buildings) {
        const distance = Phaser.Math.Distance.Between(this.x, this.y, building.x + 32, building.y + 32);
        if (distance < 100) {
          this.deployEnemies();
          this.hasDeployed = true;
          break;
        }
      }
    }
  }
  
  deployEnemies() {
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      // Request server to spawn enemies
      const spawnCount = 3 + Math.floor(Math.random() * 3); // 3-5 enemies
      const enemies = [];
      
      for (let i = 0; i < spawnCount; i++) {
        const type = this.spawnTypes[Math.floor(Math.random() * this.spawnTypes.length)];
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 100;
        
        enemies.push({
          type: type,
          x: this.x + offsetX,
          y: this.y + offsetY
        });
      }
      
      this.scene.multiplayer.socket.emit('siegeTowerDeploy', {
        npcId: this.npcId,
        enemies: enemies
      });
    }
    
    // Open door animation
    this.setFrame(1); // Assuming frame 1 is open door
    
    // Self-destruct after deploying
    this.scene.time.delayedCall(2000, () => {
      this.die();
    });
  }
}

// Assassin - Fast and stealthy
export class AssassinNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'assassin');
    
    this.isStealthed = false;
    this.backstabMultiplier = 2;
  }
  
  performAttack() {
    // Check if attacking from behind
    let damage = this.damage;
    if (this.target) {
      const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      const targetFacing = this.target.rotation || 0;
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - targetFacing));
      
      if (angleDiff > Math.PI * 0.75) { // Behind target
        damage *= this.backstabMultiplier;
      }
    }
    
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcMeleeAttack', {
        npcId: this.npcId,
        targetId: this.target ? this.target.playerId : null,
        damage: damage,
        isBackstab: damage > this.damage
      });
    }
    
    // Quick strike animation
    this.setScale(1, 0.6);
    this.scene.time.delayedCall(100, () => {
      this.setScale(0.8, 0.8);
    });
    
    // Break stealth
    if (this.isStealthed) {
      this.unstealth();
    }
  }
  
  updateSpecialBehavior(time, delta) {
    // Enter stealth when not in combat
    if (this.specialTimer > this.specialCooldown && this.state === 'moving' && !this.isStealthed) {
      this.stealth();
    }
  }
  
  stealth() {
    this.isStealthed = true;
    this.setAlpha(0.3);
    this.speed *= 1.5; // Move faster in stealth
    this.specialTimer = 0;
    
    // Stealth particles
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      lifespan: 500,
      quantity: 5,
      tint: 0x000000
    });
    
    this.scene.time.delayedCall(500, () => particles.destroy());
  }
  
  unstealth() {
    this.isStealthed = false;
    this.setAlpha(1);
    this.speed = NPC.getStats('assassin').speed;
  }
}

// Bomber - Explodes on contact
export class BomberNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'bomber');
    
    this.fuseLit = false;
    this.fuseTime = 1500; // 1.5 seconds to explode
  }
  
  performAttack() {
    // Light fuse and explode
    if (!this.fuseLit) {
      this.fuseLit = true;
      
      // Start flashing
      this.flashTimer = this.scene.time.addEvent({
        delay: 100,
        callback: () => {
          this.setTint(this.tint === 0xffffff ? 0xff0000 : 0xffffff);
        },
        repeat: 14
      });
      
      // Explode after fuse time
      this.scene.time.delayedCall(this.fuseTime, () => {
        this.explode();
        this.die();
      });
    }
  }
  
  updateSpecialBehavior(time, delta) {
    // Explode if very close to target
    if (this.target || this.targetBlock) {
      const targetX = this.target ? this.target.x : this.targetBlock.x + 32;
      const targetY = this.target ? this.target.y : this.targetBlock.y + 32;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
      
      if (distance < 30 && !this.fuseLit) {
        this.performAttack();
      }
    }
  }
}

// Necromancer - Summons skeletons
export class NecromancerNPC extends NPC {
  constructor(scene, x, y) {
    super(scene, x, y, 'necromancer');
    
    this.maxSummons = 3;
    this.currentSummons = 0;
    this.summonHealth = 30;
  }
  
  performAttack() {
    if (!this.target) return;
    
    // Fire dark bolt
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('npcProjectile', {
        npcId: this.npcId,
        type: 'darkBolt',
        x: this.x,
        y: this.y - 30,
        angle: angle,
        speed: 350,
        damage: this.damage,
        tint: 0x9900ff
      });
    }
    
    // Cast animation
    this.setTint(0x9900ff);
    this.scene.time.delayedCall(200, () => {
      this.clearTint();
    });
  }
  
  updateSpecialBehavior(time, delta) {
    // Summon skeletons from fallen enemies
    if (this.specialTimer > this.specialCooldown && this.currentSummons < this.maxSummons) {
      this.summonSkeleton();
    }
  }
  
  summonSkeleton() {
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      // Find a corpse location or use current position
      const summonX = this.x + (Math.random() - 0.5) * 100;
      const summonY = this.y + (Math.random() - 0.5) * 100;
      
      this.scene.multiplayer.socket.emit('necromancerSummon', {
        npcId: this.npcId,
        x: summonX,
        y: summonY,
        health: this.summonHealth
      });
      
      this.currentSummons++;
      this.specialTimer = 0;
    }
    
    // Summon effect
    const summonEffect = this.scene.add.circle(this.x, this.y - 30, 20, 0x9900ff, 0.8);
    this.scene.tweens.add({
      targets: summonEffect,
      radius: 40,
      alpha: 0,
      duration: 500,
      onComplete: () => summonEffect.destroy()
    });
  }
}