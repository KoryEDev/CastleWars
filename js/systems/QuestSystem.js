// Quests + live events client (Track 15). Press J for the quest log. Shows quest
// progress, completion toasts, and a banner when world events fire. Self-registers.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const QuestSystem = {
  id: 'questSystem',
  open: false,
  quests: [],

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return;
    this.scene = scene;
    scene.questSystem = this;
    this._build();
    this._key = (e) => {
      if (window.__cwModalTyping) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'J') this.toggle();
      else if (e.key === 'Escape' && this.open) this.toggle();
    };
    document.addEventListener('keydown', this._key);
  },

  _socket() { return this.scene && this.scene.multiplayer && this.scene.multiplayer.socket; },

  _build() {
    const panel = document.createElement('div');
    panel.id = 'quest-panel';
    panel.style.cssText = [
      'position:fixed', 'top:50%', 'right:16px', 'transform:translateY(-50%)',
      'width:300px', 'background:linear-gradient(180deg,#1c1c34,#2a2a52)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:14px', 'z-index:1500',
      'display:none', 'color:#fff', 'font-family:Arial,sans-serif'
    ].join(';');
    document.body.appendChild(panel);
    this.panel = panel;
    this._render();
  },

  _render() {
    let rows = this.quests.length ? this.quests.map((q) => {
      const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
      const done = q.completed;
      return `<div style="margin-bottom:10px">` +
        `<div style="display:flex;justify-content:space-between"><b style="color:${done ? '#39ff14' : '#fff'}">${q.name} ${done ? '✓' : ''}</b><span style="color:#9ab">${q.progress}/${q.target}</span></div>` +
        `<div style="color:#9ab;font-size:11px">${q.desc} · ${q.rewardGold}g ${q.rewardXp}xp</div>` +
        `<div style="height:6px;background:#333;border-radius:3px;margin-top:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${done ? '#39ff14' : '#ffe066'}"></div></div>` +
        `</div>`;
    }).join('') : '<div style="color:#9ab">Loading quests...</div>';
    this.panel.innerHTML =
      '<div style="color:#ffe066;font-size:18px;font-weight:bold;text-align:center;margin-bottom:10px">DAILY QUESTS</div>' +
      rows +
      '<div style="color:#9ab;font-size:11px;margin-top:6px;text-align:center">Press J or Esc to close</div>';
  },

  setQuests(quests) {
    this.quests = quests || [];
    if (this.open) this._render();
  },

  toggle() {
    if (!this.panel) return;
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
    if (this.open) { const s = this._socket(); if (s) s.emit('requestQuests'); this._render(); }
  },

  shutdown() {
    if (this._key) document.removeEventListener('keydown', this._key);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    if (this._banner) { this._banner.remove(); this._banner = null; }
    this.scene = null;
  }
};

systemManager.register(QuestSystem);

addNetHandler((scene, socket) => {
  socket.on('questUpdate', (d) => { if (scene.questSystem) scene.questSystem.setQuests(d.quests); });

  socket.on('questCompleted', (d) => {
    if (!scene.add) return;
    const cam = scene.cameras && scene.cameras.main;
    const t = scene.add.text(cam ? cam.width / 2 : 400, 150, `QUEST COMPLETE: ${d.name}\n+${d.rewardGold}g +${d.rewardXp}xp`, {
      fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', align: 'center',
      color: '#39ff14', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
    scene.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 2600, onComplete: () => t.destroy() });
  });

  socket.on('worldEvent', (d) => {
    const qs = scene.questSystem;
    if (!qs) return;
    if (d.ended || !d.name) { if (qs._banner) { qs._banner.style.display = 'none'; } return; }
    if (!qs._banner) {
      const b = document.createElement('div');
      b.id = 'event-banner';
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:1002;background:rgba(255,224,102,0.92);color:#222;font-weight:bold;font-family:Arial;padding:6px 16px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.4)';
      document.body.appendChild(b);
      qs._banner = b;
    }
    qs._banner.textContent = '⚡ WORLD EVENT: ' + d.name + '!';
    qs._banner.style.display = 'block';
  });
});

export default QuestSystem;
