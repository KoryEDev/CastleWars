// Scoreboard (Track 11): hold TAB to see all players ranked by kills. Reads the
// latest worldState; self-registers with systemManager.
import { systemManager } from './SystemManager.js';

const ROLE_COLORS = { owner: '#ff3b3b', admin: '#ffa500', ash: '#ff66cc', mod: '#33cc33', player: '#ffffff' };

const ScoreboardSystem = {
  id: 'scoreboard',
  visible: false,

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return; // desktop only
    this.scene = scene;
    this._build();
    // TAB toggles the scoreboard (press to show, press again to hide). Window
    // capture-phase + preventDefault so the browser doesn't use it for focus
    // traversal and Phaser doesn't consume it first.
    this._onKey = (e) => {
      if (e.code !== 'Tab' && e.key !== 'Tab') return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (window.__cwModalTyping) return;
      e.preventDefault();
      e.stopPropagation();
      this.visible = !this.visible;
      if (this.visible) this.render();
      if (this.panel) this.panel.style.display = this.visible ? 'block' : 'none';
    };
    window.addEventListener('keydown', this._onKey, true);
  },

  _build() {
    const panel = document.createElement('div');
    panel.id = 'scoreboard';
    panel.style.cssText = [
      'position:fixed', 'top:80px', 'left:50%', 'transform:translateX(-50%)',
      'width:520px', 'max-width:92vw', 'background:rgba(10,10,22,0.92)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:14px 18px',
      'z-index:1400', 'display:none', 'color:#fff', 'font-family:Arial,sans-serif'
    ].join(';');
    document.body.appendChild(panel);
    this.panel = panel;
  },

  render() {
    const mp = this.scene && this.scene.multiplayer;
    const players = (mp && mp.worldState && mp.worldState.players) || {};
    const rows = Object.values(players).map((p) => ({
      name: p.username || '?',
      role: p.role || 'player',
      level: p.level || (p.stats && p.stats.level) || 1,
      kills: (p.stats && p.stats.kills) || 0,
      deaths: (p.stats && p.stats.deaths) || 0
    })).sort((a, b) => b.kills - a.kills);

    let body = rows.map((r, i) =>
      `<tr><td style="color:#ffe066">${i + 1}</td>` +
      `<td style="color:${ROLE_COLORS[r.role] || '#fff'}">${r.name}</td>` +
      `<td>${r.level}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`
    ).join('');
    if (!body) body = '<tr><td colspan="5" style="color:#9ab;padding:10px">No players</td></tr>';

    this.panel.innerHTML =
      '<div style="color:#ffe066;font-size:18px;font-weight:bold;text-align:center;margin-bottom:8px">SCOREBOARD</div>' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="color:#9ab;font-size:12px;text-align:left"><th>#</th><th>Player</th><th>Lvl</th><th>Kills</th><th>Deaths</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>';
  },

  update() {
    if (this.visible) this.render();
  },

  shutdown() {
    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.scene = null;
  }
};

systemManager.register(ScoreboardSystem);

export default ScoreboardSystem;
