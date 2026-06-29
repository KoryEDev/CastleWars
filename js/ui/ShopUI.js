// Gold Shop UI (Track 3). Self-registering client system: press B to open/close.
// Lets players spend gold to permanently unlock weapons. The server validates all
// purchases (this list is display-only).
import { systemManager } from '../systems/SystemManager.js';

// Display catalog (server re-validates prices via shared/progression WEAPON_UNLOCKS).
const SHOP_WEAPONS = [
  { id: 'rifle', name: 'Rifle', price: 50, desc: 'Fast, accurate auto-fire' },
  { id: 'shotgun', name: 'Shotgun', price: 150, desc: 'Devastating up close' },
  { id: 'sniper', name: 'Sniper', price: 200, desc: 'High-damage long range' }
];

const ShopUI = {
  id: 'shopUI',
  scene: null,
  panel: null,
  open: false,
  unlocked: [],

  init(scene) {
    // Desktop only; mobile has its own constrained UI.
    if (scene.sys && scene.sys.game && scene.scale && scene.scale.width < 700) return;
    this.scene = scene;
    scene.shopUI = this;
    this.unlocked = [];
    this._buildPanel();
    this._keyHandler = (e) => {
      if (e.key === 'b' || e.key === 'B') {
        // Ignore while typing in an input/chat.
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.toggle();
      } else if (e.key === 'Escape' && this.open) {
        this.toggle();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'gold-shop';
    panel.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'width:420px', 'max-width:90vw', 'background:linear-gradient(180deg,#1c1c34,#2a2a52)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:18px 20px',
      'z-index:1500', 'display:none', 'color:#fff', 'font-family:Arial,sans-serif',
      'box-shadow:0 10px 40px rgba(0,0,0,0.6)'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'WEAPON SHOP';
    title.style.cssText = 'color:#ffe066;font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:4px;text-align:center';
    panel.appendChild(title);

    const hint = document.createElement('div');
    hint.textContent = 'Spend gold to permanently unlock weapons. Press B or Esc to close.';
    hint.style.cssText = 'color:#aab;font-size:12px;margin-bottom:14px;text-align:center';
    panel.appendChild(hint);

    this.list = document.createElement('div');
    panel.appendChild(this.list);

    document.body.appendChild(panel);
    this.panel = panel;
    this._renderList();
  },

  _renderList() {
    if (!this.list) return;
    this.list.innerHTML = '';
    SHOP_WEAPONS.forEach((w) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.25);border-radius:8px;padding:10px 12px;margin-bottom:8px';

      const info = document.createElement('div');
      info.innerHTML = `<div style="font-weight:bold;font-size:15px">${w.name}</div>` +
        `<div style="color:#9ab;font-size:12px">${w.desc}</div>`;
      row.appendChild(info);

      const btn = document.createElement('button');
      const owned = this.unlocked.includes(w.id);
      btn.textContent = owned ? 'Owned' : `${w.price} G`;
      btn.disabled = owned;
      btn.style.cssText = 'min-width:78px;padding:8px 10px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;' +
        (owned ? 'background:#3a5;color:#fff;cursor:default' : 'background:#ffe066;color:#222');
      btn.onclick = () => {
        if (owned) return;
        const socket = this.scene && this.scene.multiplayer && this.scene.multiplayer.socket;
        if (socket) socket.emit('purchaseItem', { itemType: 'weapon', itemId: w.id });
      };
      row.appendChild(btn);
      this.list.appendChild(row);
    });
  },

  refresh(unlockedWeapons, gold) {
    if (Array.isArray(unlockedWeapons)) this.unlocked = unlockedWeapons;
    this._renderList();
  },

  toggle() {
    if (!this.panel) return;
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
  },

  shutdown() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.open = false;
    this.scene = null;
  }
};

systemManager.register(ShopUI);

export default ShopUI;
