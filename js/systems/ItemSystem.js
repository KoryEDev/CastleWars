// PvE loot rendering + pickups (Track 7). Syncs loot drops from worldState.items and
// draws them as colored pickups (no texture dependency). Server auto-collects on
// proximity and removes them from worldState, so this just mirrors server state.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const COLORS = { health: 0x39ff14, gold: 0xffcf33, ammo: 0x4fa3ff };
const GLYPH = { health: '+', gold: '$', ammo: 'A' };

const ItemSystem = {
  id: 'itemSystem',
  _sprites: {},

  init(scene) {
    this.scene = scene;
    this._sprites = {};
  },

  update(scene) {
    const mp = scene && scene.multiplayer;
    const items = (mp && mp.worldState && mp.worldState.items) || {};

    // Create sprites for new loot.
    for (const id in items) {
      const it = items[id];
      if (!it || this._sprites[id]) continue;
      const color = COLORS[it.type] || 0xffffff;
      const c = scene.add.circle(it.x, it.y - 12, 9, color, 0.95).setStrokeStyle(2, 0x000000).setDepth(120);
      const label = scene.add.text(it.x, it.y - 12, GLYPH[it.type] || '?', {
        fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold', color: '#000000'
      }).setOrigin(0.5).setDepth(121);
      const tween = scene.tweens.add({ targets: [c, label], y: '-=6', duration: 600, yoyo: true, repeat: -1 });
      this._sprites[id] = { c, label, tween };
    }

    // Remove sprites for collected/expired loot.
    for (const id in this._sprites) {
      if (!items[id]) {
        const s = this._sprites[id];
        if (s.tween) s.tween.remove();
        if (s.c) s.c.destroy();
        if (s.label) s.label.destroy();
        delete this._sprites[id];
      }
    }
  },

  shutdown() {
    for (const id in this._sprites) {
      const s = this._sprites[id];
      if (s.tween) s.tween.remove();
      if (s.c) s.c.destroy();
      if (s.label) s.label.destroy();
    }
    this._sprites = {};
    this.scene = null;
  }
};

systemManager.register(ItemSystem);

// Boss-kill banner + ammo refill feedback.
addNetHandler((scene, socket) => {
  socket.on('npcKilled', (d) => {
    if (d && d.isBoss && scene.add) {
      const cam = scene.cameras && scene.cameras.main;
      const t = scene.add.text(cam ? cam.width / 2 : 400, 180, 'BOSS DEFEATED!', {
        fontSize: '40px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#ff3b3b', stroke: '#000000', strokeThickness: 7
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
      scene.tweens.add({ targets: t, scale: 1.3, alpha: 0, duration: 2200, onComplete: () => t.destroy() });
      if (cam) cam.shake(300, 0.008);
    }
  });
});

export default ItemSystem;
