// Client progression feedback (Track 3): XP gains, level-ups, purchase results.
import { addNetHandler } from './index.js';

function toast(scene, text, color) {
  if (!scene || !scene.add) return;
  const cam = scene.cameras && scene.cameras.main;
  const x = cam ? cam.width / 2 : 400;
  const t = scene.add.text(x, 120, text, {
    fontSize: '26px',
    fontFamily: 'Arial',
    fontStyle: 'bold',
    color: color || '#ffe066',
    stroke: '#000000',
    strokeThickness: 5
  }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10001);
  scene.tweens.add({
    targets: t,
    y: t.y - 40,
    alpha: 0,
    duration: 1300,
    ease: 'Power2',
    onComplete: () => t.destroy()
  });
}

addNetHandler((scene, socket) => {
  socket.on('xpGained', (d) => {
    if (!d) return;
    // Refresh gold display if the UI exposes it.
    if (scene.gameUI && typeof scene.gameUI.updateGold === 'function') {
      scene.gameUI.updateGold(d.gold);
    }
    toast(scene, `+${d.amount} XP`, '#9ad1ff');
  });

  socket.on('levelUp', (d) => {
    toast(scene, `LEVEL UP!  Level ${d.level}`, '#ffe066');
    if (scene.cameras && scene.cameras.main) scene.cameras.main.flash(250, 255, 224, 102);
  });

  socket.on('purchaseResult', (d) => {
    if (!d) return;
    toast(scene, d.success ? 'Purchased!' : (d.message || 'Purchase failed'), d.success ? '#39ff14' : '#ff6666');
    if (d.success && scene.shopUI && typeof scene.shopUI.refresh === 'function') {
      scene.shopUI.refresh(d.unlockedWeapons, d.gold);
    }
  });
});
