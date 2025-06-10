export class UI {
  constructor(scene) {
    this.scene = scene;
    this.createHealthBar();
    this.setupEventListeners();
    
    // Create wave text with Roman numerals
    this.waveText = scene.add.text(scene.scale.width / 2, 20, 'Wave: I', {
      fontSize: scene.scale.width < 768 ? '24px' : '32px',
      fill: '#000',
      fontStyle: 'bold'
    })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);
    
    this.startText = scene.add.text(
      scene.scale.width / 2,
      scene.scale.height / 2,
      '',
      {
        fontSize: scene.scale.width < 768 ? '36px' : '48px',
        fill: '#f00'
      }
    )
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Handle resize
    scene.scale.on('resize', this.handleResize, this);
  }

  handleResize(gameSize) {
    // Update health bar position and size
    const barWidth = gameSize.width < 768 ? 200 : 300;
    const barHeight = gameSize.width < 768 ? 20 : 30;
    const yPos = gameSize.width < 768 ? 50 : 70;

    this.healthBarBg.setSize(barWidth, barHeight);
    this.healthBar.setSize(barWidth, barHeight);
    this.healthBarBorder.setSize(barWidth + 4, barHeight + 4);

    this.healthBarBg.setPosition(gameSize.width / 2, yPos);
    this.healthBar.setPosition(gameSize.width / 2, yPos);
    this.healthBarBorder.setPosition(gameSize.width / 2, yPos);
    this.healthText.setPosition(gameSize.width / 2, yPos);

    // Update wave text
    this.waveText.setPosition(gameSize.width / 2, 20);
    this.waveText.setStyle({ fontSize: gameSize.width < 768 ? '24px' : '32px' });

    // Update start text
    this.startText.setPosition(gameSize.width / 2, gameSize.height / 2);
    this.startText.setStyle({ fontSize: gameSize.width < 768 ? '36px' : '48px' });
  }

  createHealthBar() {
    const barWidth = this.scene.scale.width < 768 ? 200 : 300;
    const barHeight = this.scene.scale.width < 768 ? 20 : 30;
    const yPos = this.scene.scale.width < 768 ? 50 : 70;

    // Create health bar background
    this.healthBarBg = this.scene.add.rectangle(this.scene.scale.width / 2, yPos, barWidth, barHeight, 0x000000)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setAlpha(0.8);

    // Create health bar fill
    this.healthBar = this.scene.add.rectangle(this.scene.scale.width / 2, yPos, barWidth, barHeight, 0x00ff00)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5);

    // Create health text
    this.healthText = this.scene.add.text(this.scene.scale.width / 2, yPos, '100/100', {
      fontSize: this.scene.scale.width < 768 ? '18px' : '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    })
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setPadding(10);

    // Add a border to make it stand out
    this.healthBarBorder = this.scene.add.rectangle(this.scene.scale.width / 2, yPos, barWidth + 4, barHeight + 4, 0xffffff)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setDepth(-1);
  }

  setupEventListeners() {
    this.scene.events.on('playerHealthChanged', this.updateHealthBar, this);
  }

  updateHealthBar(currentHealth, maxHealth) {
    const healthPercent = currentHealth / maxHealth;
    const barWidth = this.scene.scale.width < 768 ? 200 : 300;
    this.healthBar.width = barWidth * healthPercent;
    this.healthText.setText(`${currentHealth}/${maxHealth}`);
    
    // Update color based on health percentage
    if (healthPercent > 0.6) {
      this.healthBar.fillColor = 0x00ff00; // Green
    } else if (healthPercent > 0.3) {
      this.healthBar.fillColor = 0xffff00; // Yellow
    } else {
      this.healthBar.fillColor = 0xff0000; // Red
    }
  }

  showWaveStart(wave) {
    const romanWave = this.toRoman(wave);
    this.waveText.setText('Wave: ' + romanWave);
    this.startText.setText('Wave ' + romanWave + ' Starting!').setAlpha(1);
    this.scene.time.delayedCall(1000, () => {
      this.startText.setAlpha(0);
    });
  }

  toRoman(num) {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanNumerals[num - 1] || num.toString();
  }
} 