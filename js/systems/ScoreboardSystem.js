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
    // Use Phaser's keyboard (same path as the working build-hotkeys) and capture TAB
    // so the browser doesn't steal it for focus traversal.
    const kb = scene.input && scene.input.keyboard;
    if (kb) {
      try { kb.addCapture('TAB'); } catch (e) { /* ignore */ }
      this._down = () => {
        if (window.__cwModalTyping) return;
        this.visible = true;
        this.render();
        if (this.panel) this.panel.style.display = 'block';
      };
      this._up = () => {
        this.visible = false;
        if (this.panel) this.panel.style.display = 'none';
      };
      kb.on('keydown-TAB', this._down);
      kb.on('keyup-TAB', this._up);
    }
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
    const kb = this.scene && this.scene.input && this.scene.input.keyboard;
    if (kb) { kb.off('keydown-TAB', this._down); kb.off('keyup-TAB', this._up); }
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.scene = null;
  }
};

systemManager.register(ScoreboardSystem);

export default ScoreboardSystem;
