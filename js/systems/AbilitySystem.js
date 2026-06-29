// Client classes & abilities (Track 4): ability HUD, cooldown, class selector.
// Q = use ability, C = open/close class selector. Self-registers with systemManager
// and the net-handler registry.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

// Client-side mirror of class display info (server is authoritative for effects).
const CLASS_INFO = {
  soldier: { name: 'Soldier', ability: 'Adrenaline', desc: 'Durable; +25 max HP, damage boost.' },
  medic: { name: 'Medic', ability: 'Heal Pulse', desc: 'Heals self + nearby allies.' },
  scout: { name: 'Scout', ability: 'Second Wind', desc: 'Fragile; quick self-heal.' },
  builder: { name: 'Builder', ability: 'Patch Up', desc: 'Tough; +15 max HP, self-heal.' },
  engineer: { name: 'Engineer', ability: 'Overcharge', desc: 'Weapon damage boost.' }
};

const AbilitySystem = {
  id: 'abilitySystem',
  scene: null,
  classId: 'soldier',
  cooldownUntil: 0,
  cooldownTotal: 0,

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return; // desktop only
    this.scene = scene;
    scene.abilitySystem = this;
    this.classId = 'soldier';
    this._buildHud();
    this._buildSelector();
    this._keyHandler = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') this._useAbility();
      else if (e.key === 'c' || e.key === 'C') this._toggleSelector();
      else if (e.key === 'Escape' && this._selectorOpen) this._toggleSelector();
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  _socket() {
    return this.scene && this.scene.multiplayer && this.scene.multiplayer.socket;
  },

  _useAbility() {
    const s = this._socket();
    if (s) s.emit('useAbility');
  },

  _buildHud() {
    const hud = document.createElement('div');
    hud.id = 'ability-hud';
    hud.style.cssText = [
      'position:fixed', 'bottom:104px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.6)', 'border:2px solid #ffe066', 'border-radius:10px',
      'padding:6px 14px', 'z-index:1001', 'font-family:Arial,sans-serif', 'color:#fff',
      'text-align:center', 'pointer-events:none', 'min-width:150px'
    ].join(';');
    hud.innerHTML =
      '<div id="ability-class" style="color:#ffe066;font-size:11px;font-weight:bold">SOLDIER</div>' +
      '<div id="ability-name" style="font-size:14px;font-weight:bold">Adrenaline <span style="color:#9ab">[Q]</span></div>' +
      '<div style="height:6px;background:#333;border-radius:3px;margin-top:4px;overflow:hidden">' +
      '<div id="ability-cd" style="height:100%;width:100%;background:#39ff14"></div></div>' +
      '<div style="color:#9ab;font-size:10px;margin-top:2px">Press C to change class</div>';
    document.body.appendChild(hud);
    this.hud = hud;
    this.cdBar = hud.querySelector('#ability-cd');
  },

  _setClass(classId) {
    this.classId = classId;
    const info = CLASS_INFO[classId] || CLASS_INFO.soldier;
    if (this.hud) {
      // Ensure the HUD is present + visible (defensive against DOM churn).
      if (!this.hud.isConnected) document.body.appendChild(this.hud);
      this.hud.style.display = 'block';
      this.hud.querySelector('#ability-class').textContent = info.name.toUpperCase();
      this.hud.querySelector('#ability-name').innerHTML = `${info.ability} <span style="color:#9ab">[Q]</span>`;
    }
  },

  _buildSelector() {
    const ov = document.createElement('div');
    ov.id = 'class-selector';
    ov.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'background:linear-gradient(180deg,#1c1c34,#2a2a52)', 'border:2px solid #ffe066',
      'border-radius:12px', 'padding:18px', 'z-index:1500', 'display:none',
      'font-family:Arial,sans-serif', 'color:#fff', 'width:440px', 'max-width:92vw'
    ].join(';');
    let html = '<div style="color:#ffe066;font-size:20px;font-weight:bold;text-align:center;margin-bottom:12px">CHOOSE CLASS</div>';
    ov.innerHTML = html;
    Object.keys(CLASS_INFO).forEach((id) => {
      const c = CLASS_INFO[id];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.25);border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer';
      row.innerHTML = `<div><div style="font-weight:bold">${c.name}</div><div style="color:#9ab;font-size:12px">${c.desc}</div></div><div style="color:#ffe066">Select</div>`;
      row.onclick = () => {
        const s = this._socket();
        if (s) s.emit('selectClass', { classId: id });
        this._toggleSelector();
      };
      ov.appendChild(row);
    });
    document.body.appendChild(ov);
    this.selector = ov;
  },

  _toggleSelector() {
    if (!this.selector) return;
    this._selectorOpen = !this._selectorOpen;
    this.selector.style.display = this._selectorOpen ? 'block' : 'none';
  },

  startCooldown(ms) {
    this.cooldownUntil = Date.now() + ms;
    this.cooldownTotal = ms;
  },

  update() {
    if (!this.cdBar) return;
    if (this.cooldownTotal > 0) {
      const remaining = this.cooldownUntil - Date.now();
      if (remaining <= 0) {
        this.cdBar.style.width = '100%';
        this.cdBar.style.background = '#39ff14';
        this.cooldownTotal = 0;
      } else {
        this.cdBar.style.width = (100 * (1 - remaining / this.cooldownTotal)) + '%';
        this.cdBar.style.background = '#ffaa00';
      }
    }
  },

  shutdown() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this.hud) { this.hud.remove(); this.hud = null; }
    if (this.selector) { this.selector.remove(); this.selector = null; }
    this.scene = null;
  }
};

systemManager.register(AbilitySystem);

// Network feedback for abilities.
addNetHandler((scene, socket) => {
  socket.on('classSelected', (d) => {
    if (scene.abilitySystem) scene.abilitySystem._setClass(d.classId);
    if (d.health != null && scene.gameUI && scene.gameUI.updateHealth) {
      scene.gameUI.updateHealth(d.health, d.maxHealth);
    }
    if (scene.playerSprite) { scene.playerSprite.health = d.health; scene.playerSprite.maxHealth = d.maxHealth; }
  });

  socket.on('abilityCooldown', (d) => {
    if (scene.abilitySystem && d.remaining) scene.abilitySystem.startCooldown(d.remaining);
  });

  socket.on('abilityHeal', (d) => {
    if (d.targetId === scene.playerId) {
      if (scene.gameUI && scene.gameUI.updateHealth) scene.gameUI.updateHealth(d.health, d.maxHealth);
      if (scene.playerSprite) scene.playerSprite.health = d.health;
      if (scene.cameras && scene.cameras.main) scene.cameras.main.flash(150, 80, 255, 120);
    }
  });

  socket.on('abilityUsed', (d) => {
    // Small heal/buff pulse at the caster's position.
    if (!scene.add || d.x == null) return;
    const color = d.type === 'heal' ? 0x39ff14 : 0xffaa00;
    const ring = scene.add.circle(d.x, d.y - 20, 10, color, 0.5).setDepth(900);
    scene.tweens.add({ targets: ring, radius: 60, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
  });
});

export default AbilitySystem;
