// King of the Hill client (Track 6): renders the hill zone in the world and a
// leaderboard HUD, and shows a winner banner. Self-registers with systemManager and
// the net-handler registry.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const KothSystem = {
  id: 'kothSystem',
  scene: null,
  zoneGfx: null,
  zoneLabel: null,
  hud: null,
  active: false,
  _pulse: 0,

  init(scene) {
    this.scene = scene;
    scene.kothSystem = this;
  },

  ensureZone(zone) {
    if (!this.scene || this.zoneGfx) return;
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + zone.h / 2;
    this.zoneGfx = this.scene.add.rectangle(cx, cy, zone.w, zone.h, 0xffe066, 0.12)
      .setStrokeStyle(3, 0xffe066, 0.8)
      .setDepth(50);
    this.zoneLabel = this.scene.add.text(cx, zone.y - 16, 'KING OF THE HILL', {
      fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#ffe066', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 1).setDepth(51);
  },

  ensureHud() {
    if (this.hud) return;
    const hud = document.createElement('div');
    hud.id = 'koth-hud';
    hud.style.cssText = [
      'position:fixed', 'top:110px', 'right:16px', 'min-width:160px',
      'background:rgba(0,0,0,0.55)', 'border:1px solid #ffe066', 'border-radius:8px',
      'padding:8px 10px', 'z-index:996', 'font-family:Arial,sans-serif', 'color:#fff',
      'font-size:12px', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(hud);
    this.hud = hud;
  },

  renderHud(state) {
    this.ensureHud();
    const holding = (state.holders && state.holders.length)
      ? `<span style="color:#39ff14">Contested by ${state.holders.length}</span>`
      : '<span style="color:#9ab">Hill empty</span>';
    let rows = (state.leaderboard || []).map((e, i) =>
      `<div style="display:flex;justify-content:space-between"><span>${i + 1}. ${e.name}</span><span>${e.score}/${state.target}</span></div>`
    ).join('');
    if (!rows) rows = '<div style="color:#9ab">No scores yet</div>';
    this.hud.innerHTML = `<div style="color:#ffe066;font-weight:bold;margin-bottom:4px">KING OF THE HILL</div>${holding}<div style="margin-top:4px">${rows}</div>`;
  },

  update() {
    // Subtle pulse of the zone outline.
    if (this.zoneGfx) {
      this._pulse += 0.05;
      this.zoneGfx.setFillStyle(0xffe066, 0.10 + Math.sin(this._pulse) * 0.04);
    }
  },

  shutdown() {
    if (this.hud) { this.hud.remove(); this.hud = null; }
    if (this.zoneGfx) { this.zoneGfx.destroy(); this.zoneGfx = null; }
    if (this.zoneLabel) { this.zoneLabel.destroy(); this.zoneLabel = null; }
    this.scene = null;
  }
};

systemManager.register(KothSystem);

addNetHandler((scene, socket) => {
  socket.on('kothState', (state) => {
    const k = scene.kothSystem;
    if (!k) return;
    k.ensureZone(state.zone);
    k.renderHud(state);
  });
  socket.on('kothWin', (d) => {
    if (!scene.add) return;
    const cam = scene.cameras && scene.cameras.main;
    const t = scene.add.text(cam ? cam.width / 2 : 400, 200, `${d.winner} is King of the Hill!`, {
      fontSize: '30px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#ffe066', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
    scene.tweens.add({ targets: t, alpha: 0, y: t.y - 40, duration: 2500, onComplete: () => t.destroy() });
  });
});

export default KothSystem;
