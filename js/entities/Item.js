export class Item extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, itemType) {
    super(scene, x, y, itemType);
    
    this.itemType = itemType;
    this.itemData = this.getItemData(itemType);
    this.baseY = y;
    this.collected = false;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set physics properties
    this.body.setSize(24, 24);
    this.body.setBounce(0.3);
    this.body.setCollideWorldBounds(true);
    this.body.setAllowGravity(false); // Disable gravity for items
    this.body.setImmovable(true); // Make items immovable
    
    // Visual properties
    this.setScale(0.8);
    this.setDepth(500);
    
    // Floating animation - using position instead of physics
    this.floatTween = scene.tweens.add({
      targets: this,
      y: this.baseY - 15,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Glow effect
    this.glowGraphics = scene.add.graphics();
    this.updateGlow();
  }
  
  getItemData(type) {
    const items = {
      health_potion: {
        name: 'Health Potion',
        description: 'Restores 50 HP',
        rarity: 'common',
        stackable: true,
        effect: (player) => {
          player.health = Math.min(player.health + 50, player.maxHealth);
          player.updateHealthBar();
        }
      },
      speed_boost: {
        name: 'Speed Boost',
        description: 'Increases movement speed for 30 seconds',
        rarity: 'uncommon',
        stackable: true,
        effect: (player) => {
          player.moveSpeed = 400;
          player.scene.time.delayedCall(30000, () => {
            player.moveSpeed = 250;
          });
        }
      },
      shield: {
        name: 'Shield',
        description: 'Grants temporary invulnerability for 5 seconds',
        rarity: 'rare',
        stackable: true,
        effect: (player) => {
          player.isInvulnerable = true;
          player.setTint(0x0000ff);
          player.scene.time.delayedCall(5000, () => {
            player.isInvulnerable = false;
            player.clearTint();
          });
        }
      },
      ammo_box: {
        name: 'Ammo Box',
        description: 'Refills all weapon ammo',
        rarity: 'common',
        stackable: true,
        effect: (player) => {
          if (player.weapon) {
            player.weapon.currentAmmo = player.weapon.magazineSize;
          }
        }
      },
      damage_boost: {
        name: 'Damage Boost',
        description: 'Doubles weapon damage for 20 seconds',
        rarity: 'rare',
        stackable: true,
        effect: (player) => {
          if (player.weapon) {
            const originalDamage = player.weapon.damage;
            player.weapon.damage *= 2;
            player.scene.time.delayedCall(20000, () => {
              player.weapon.damage = originalDamage;
            });
          }
        }
      }
    };
    
    return items[type] || items.health_potion;
  }
  
  updateGlow() {
    const colors = {
      common: 0xffffff,
      uncommon: 0x00ff00,
      rare: 0x0080ff,
      legendary: 0xff00ff
    };
    
    const color = colors[this.itemData.rarity] || 0xffffff;
    
    this.glowGraphics.clear();
    this.glowGraphics.lineStyle(2, color, 0.8);
    this.glowGraphics.strokeCircle(this.x, this.y, 20);
    this.glowGraphics.setDepth(499);
  }
  
  collect(player) {
    if (this.collected) return; // Prevent multiple collections
    this.collected = true;
    
    // Add to inventory instead of applying effect immediately
    const itemAdded = this.scene.inventoryUI.addItem({
      itemId: this.itemType,
      quantity: 1,
      stackable: this.itemData.stackable
    });
    
    if (!itemAdded) {
      // Inventory full
      this.collected = false; // Allow collection later
      
      const fullText = this.scene.add.text(this.x, this.y - 20, 'Inventory Full!', {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5, 0.5)
      .setDepth(1000);
      
      this.scene.tweens.add({
        targets: fullText,
        y: fullText.y - 20,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          fullText.destroy();
        }
      });
      
      return;
    }
    
    // Show collection text
    const collectText = this.scene.add.text(this.x, this.y - 20, `+ ${this.itemData.name}`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    })
    .setOrigin(0.5, 0.5)
    .setDepth(1000);
    
    // Animate collection
    this.scene.tweens.add({
      targets: collectText,
      y: collectText.y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        collectText.destroy();
      }
    });
    
    // Stop floating animation
    if (this.floatTween) {
      this.floatTween.stop();
    }
    
    // Destroy item
    this.glowGraphics.destroy();
    this.destroy();
  }
  
  update() {
    // Update glow position
    if (this.glowGraphics) {
      this.glowGraphics.clear();
      this.glowGraphics.lineStyle(2, this.getGlowColor(), 0.8);
      this.glowGraphics.strokeCircle(this.x, this.y, 20);
    }
  }
  
  getGlowColor() {
    const colors = {
      common: 0xffffff,
      uncommon: 0x00ff00,
      rare: 0x0080ff,
      legendary: 0xff00ff
    };
    return colors[this.itemData.rarity] || 0xffffff;
  }
} 