export class Building extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type) {
    super(scene, x, y, type);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setOrigin(0, 0);
    this.setDisplaySize(64, 64);
    this.refreshBody();
    this.health = 3;
    
    if (type === 'door' || type === 'tunnel') {
      this.setAlpha(0.6);
    }
  }
} 