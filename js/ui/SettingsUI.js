// Settings menu (Track 11): press K to open. Audio volume/mute + accessibility
// (colorblind-friendly toggle, persisted). Self-registers.
import { systemManager } from '../systems/SystemManager.js';

const SettingsUI = {
  id: 'settingsUI',
  open: false,

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return;
    this.scene = scene;
    this._build();
    this._key = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'k' || e.key === 'K') this.toggle();
      else if (e.key === 'Escape' && this.open) this.toggle();
    };
    document.addEventListener('keydown', this._key);
  },

  _build() {
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'width:380px', 'max-width:92vw', 'background:linear-gradient(180deg,#1c1c34,#2a2a52)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:18px', 'z-index:1600',
      'display:none', 'color:#fff', 'font-family:Arial,sans-serif'
    ].join(';');

    const muted = localStorage.getItem('cw_muted') === '1';
    const vol = parseFloat(localStorage.getItem('cw_volume'));
    const colorblind = localStorage.getItem('cw_colorblind') === '1';

    panel.innerHTML =
      '<div style="color:#ffe066;font-size:20px;font-weight:bold;text-align:center;margin-bottom:14px">SETTINGS</div>' +
      '<label style="display:block;margin-bottom:6px">Master Volume</label>' +
      '<input id="set-vol" type="range" min="0" max="100" value="' + (isNaN(vol) ? 50 : Math.round(vol * 100)) + '" style="width:100%">' +
      '<label style="display:flex;align-items:center;gap:8px;margin:14px 0"><input id="set-mute" type="checkbox" ' + (muted ? 'checked' : '') + '> Mute all sound</label>' +
      '<label style="display:flex;align-items:center;gap:8px;margin:14px 0"><input id="set-cb" type="checkbox" ' + (colorblind ? 'checked' : '') + '> Colorblind-friendly markers</label>' +
      '<div style="color:#9ab;font-size:12px;margin-top:10px">Keys: B shop · C class · Q ability · O social · Tab scoreboard · M mute · K settings</div>' +
      '<div style="color:#9ab;font-size:11px;margin-top:6px;text-align:center">Press K or Esc to close</div>';

    document.body.appendChild(panel);
    this.panel = panel;

    const audio = () => this.scene && this.scene.audioSystem;
    panel.querySelector('#set-vol').oninput = (e) => {
      const v = parseInt(e.target.value, 10) / 100;
      if (audio()) audio().setVolume(v); else localStorage.setItem('cw_volume', String(v));
    };
    panel.querySelector('#set-mute').onchange = (e) => {
      if (audio()) { if (audio().muted !== e.target.checked) audio().toggleMute(); }
      else localStorage.setItem('cw_muted', e.target.checked ? '1' : '0');
    };
    panel.querySelector('#set-cb').onchange = (e) => {
      localStorage.setItem('cw_colorblind', e.target.checked ? '1' : '0');
      document.body.classList.toggle('cw-colorblind', e.target.checked);
    };
  },

  toggle() {
    if (!this.panel) return;
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
  },

  shutdown() {
    document.removeEventListener('keydown', this._key);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.scene = null;
  }
};

systemManager.register(SettingsUI);

export default SettingsUI;
