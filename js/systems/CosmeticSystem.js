// Cosmetics + Battle Pass (Track 13). Locker UI (press L) to equip a movement
// trail / nameplate color, plus a battle-pass track. Trails render behind the local
// player. Choices persist to the server (equippedCosmetics). Self-registers.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const TRAILS = {
  none: { name: 'None', color: null },
  gold: { name: 'Gold', color: 0xffcf33 },
  blue: { name: 'Frost', color: 0x4fa3ff },
  red: { name: 'Ember', color: 0xff4d4d },
  green: { name: 'Toxic', color: 0x39ff14 },
  rainbow: { name: 'Rainbow', color: 'rainbow' }
};

const BATTLEPASS = [
  { tier: 1, reward: 'Frost Trail' }, { tier: 2, reward: '50 Gold' }, { tier: 3, reward: 'Ember Trail' },
  { tier: 4, reward: '100 Gold' }, { tier: 5, reward: 'Toxic Trail' }, { tier: 6, reward: 'Nameplate: Gold' },
  { tier: 7, reward: '200 Gold' }, { tier: 8, reward: 'Rainbow Trail' }, { tier: 9, reward: '500 Gold' },
  { tier: 10, reward: 'Champion Nameplate' }
];

const CosmeticSystem = {
  id: 'cosmeticSystem',
  trail: 'none',
  open: false,
  _hue: 0,
  _frame: 0,

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return;
    this.scene = scene;
    this.trail = localStorage.getItem('cw_trail') || 'none';
    this._build();
    this._key = (e) => {
      if (window.__cwModalTyping) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'l' || e.key === 'L') this.toggle();
      else if (e.key === 'Escape' && this.open) this.toggle();
    };
    document.addEventListener('keydown', this._key);
  },

  _socket() { return this.scene && this.scene.multiplayer && this.scene.multiplayer.socket; },

  _build() {
    const panel = document.createElement('div');
    panel.id = 'locker-panel';
    panel.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'width:460px', 'max-width:92vw', 'background:linear-gradient(180deg,#1c1c34,#2a2a52)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:16px', 'z-index:1500',
      'display:none', 'color:#fff', 'font-family:Arial,sans-serif'
    ].join(';');
    document.body.appendChild(panel);
    this.panel = panel;
    this._render();
  },

  _render() {
    const level = (this.scene && this.scene.playerSprite && this.scene.playerSprite.level) || 1;
    let trailBtns = Object.keys(TRAILS).map((k) =>
      `<button data-trail="${k}" style="padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;background:${this.trail === k ? '#ffe066' : '#444'};color:${this.trail === k ? '#222' : '#fff'}">${TRAILS[k].name}</button>`
    ).join(' ');

    const tier = Math.min(BATTLEPASS.length, Math.max(1, level));
    let bpRows = BATTLEPASS.map((b) =>
      `<div style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px;background:${b.tier <= tier ? 'rgba(57,255,20,0.15)' : 'rgba(0,0,0,0.2)'}">` +
      `<span>Tier ${b.tier} ${b.tier <= tier ? '✓' : ''}</span><span style="color:#9ab">${b.reward}</span></div>`
    ).join('');

    this.panel.innerHTML =
      '<div style="color:#ffe066;font-size:20px;font-weight:bold;text-align:center;margin-bottom:10px">LOCKER</div>' +
      '<div style="margin-bottom:6px;font-weight:bold">Movement Trail</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">' + trailBtns + '</div>' +
      '<div style="margin-bottom:6px;font-weight:bold">Battle Pass <span style="color:#9ab;font-size:12px">(Tier ' + tier + '/10)</span></div>' +
      '<div style="max-height:180px;overflow-y:auto">' + bpRows + '</div>' +
      '<div style="color:#9ab;font-size:11px;margin-top:10px;text-align:center">Press L or Esc to close</div>';

    this.panel.querySelectorAll('[data-trail]').forEach((btn) => {
      btn.onclick = () => this.setTrail(btn.dataset.trail);
    });
  },

  setTrail(t) {
    this.trail = t;
    localStorage.setItem('cw_trail', t);
    const s = this._socket();
    if (s) s.emit('equipCosmetic', { slot: 'trail', value: t });
    this._render();
  },

  toggle() {
    if (!this.panel) return;
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
    if (this.open) this._render();
  },

  update(scene) {
    if (this.trail === 'none') return;
    const p = scene.playerSprite;
    if (!p || p.x == null || p.isDead) return;
    this._frame++;
    if (this._frame % 3 !== 0) return; // throttle spawn rate
    let color = TRAILS[this.trail] ? TRAILS[this.trail].color : null;
    if (color === 'rainbow') {
      this._hue = (this._hue + 20) % 360;
      color = hslToHex(this._hue, 100, 60);
    }
    if (color == null) return;
    const dot = scene.add.circle(p.x, p.y - 20, 6, color, 0.6).setDepth(p.depth ? p.depth - 1 : 90);
    scene.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 450, onComplete: () => dot.destroy() });
  },

  shutdown() {
    if (this._key) document.removeEventListener('keydown', this._key);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.scene = null;
  }
};

function hslToHex(h, s, l) {
  l /= 100; s /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return Math.round(255 * c); };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

systemManager.register(CosmeticSystem);

addNetHandler((scene, socket) => {
  socket.on('cosmeticEquipped', (d) => {
    if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: `Equipped ${d.slot}: ${d.value}` });
  });
});

export default CosmeticSystem;
