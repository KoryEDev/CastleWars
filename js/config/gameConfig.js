import { LoginScene } from '../scenes/LoginScene.js';
import { GameScene } from '../scenes/GameScene.js';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false,
      tileBias: 32,
      fps: 60,
      timeScale: 1,
      overlapBias: 8,
      forceX: false,
      isPaused: false,
      useTree: true
    }
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    willReadFrequently: true
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game',
    width: 1280,
    height: 720,
    min: {
      width: 320,
      height: 180
    }
  },
  scene: [LoginScene, GameScene],
  fps: {
    target: 60,
    forceSetTimeOut: true,
    min: 30
  }
}; 