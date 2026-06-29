// Audio engine (Track 10). Greenfield: synthesizes all SFX with the WebAudio API
// (no audio assets needed) and plays them on game events. Includes an ambient pad
// that shifts with day/night, plus a master volume + mute (press M) persisted to
// localStorage. Self-registers with systemManager + the net-handler registry.
import { systemManager } from './SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const AudioSystem = {
  id: 'audioSystem',
  ctx: null,
  master: null,
  muted: false,
  volume: 0.5,
  _ambient: null,

  init(scene) {
    this.scene = scene;
    this.muted = localStorage.getItem('cw_muted') === '1';
    const v = parseFloat(localStorage.getItem('cw_volume'));
    this.volume = isNaN(v) ? 0.5 : v;
    scene.audioSystem = this;

    // AudioContext can only start after a user gesture; resume on first interaction.
    this._resume = () => this._ensureCtx();
    document.addEventListener('pointerdown', this._resume);
    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'm' || e.key === 'M') {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.toggleMute();
      }
      this._ensureCtx();
    });
    this._buildIndicator();
  },

  _ensureCtx() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this._startAmbient();
    } catch (e) { /* audio unsupported */ }
  },

  // Generic tone helper.
  tone(freq, dur, type, gain, slideTo) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    const t0 = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, gain) {
    if (!this.ctx || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain || 0.2;
    src.connect(g); g.connect(this.master);
    src.start();
  },

  sfx(name) {
    this._ensureCtx();
    if (!this.ctx) return;
    switch (name) {
      case 'shoot': this.tone(620, 0.08, 'square', 0.12, 180); break;
      case 'hit': this.noise(0.06, 0.18); break;
      case 'kill': this.tone(440, 0.18, 'sawtooth', 0.22, 160); break;
      case 'heal': this.tone(330, 0.25, 'sine', 0.2, 660); break;
      case 'levelup': this.tone(523, 0.12, 'triangle', 0.22); setTimeout(() => this.tone(659, 0.12, 'triangle', 0.22), 110); setTimeout(() => this.tone(784, 0.2, 'triangle', 0.22), 230); break;
      case 'ui': this.tone(880, 0.05, 'square', 0.12); break;
      case 'win': this.tone(523, 0.15, 'triangle', 0.25); setTimeout(() => this.tone(784, 0.3, 'triangle', 0.25), 150); break;
      case 'boss': this.tone(110, 0.5, 'sawtooth', 0.3, 60); this.noise(0.3, 0.2); break;
      default: break;
    }
  },

  _startAmbient() {
    if (!this.ctx || this._ambient) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 70;
    g.gain.value = 0.03;
    o.connect(g); g.connect(this.master);
    o.start();
    this._ambient = { o, g };
  },

  update(scene) {
    // Day/night ambient shift.
    if (this._ambient && scene) {
      const isDay = scene.isDay !== false;
      this._ambient.o.frequency.value = isDay ? 80 : 55;
    }
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('cw_volume', String(this.volume));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
    this._updateIndicator();
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('cw_muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this._updateIndicator();
    if (!this.muted) this.sfx('ui');
  },

  _buildIndicator() {
    const el = document.createElement('div');
    el.id = 'audio-indicator';
    el.style.cssText = 'position:fixed;top:12px;left:12px;z-index:1001;background:rgba(0,0,0,0.5);border:1px solid #ffe066;border-radius:6px;padding:4px 8px;font-family:Arial;font-size:11px;color:#ffe066;pointer-events:none';
    document.body.appendChild(el);
    this.indicator = el;
    this._updateIndicator();
  },

  _updateIndicator() {
    if (this.indicator) this.indicator.textContent = this.muted ? 'SOUND OFF (M)' : 'SOUND ON (M)';
  },

  shutdown() {
    document.removeEventListener('pointerdown', this._resume);
    document.removeEventListener('keydown', this._keyHandler);
    if (this.indicator) { this.indicator.remove(); this.indicator = null; }
    try { if (this.ctx) this.ctx.close(); } catch (e) { /* ignore */ }
    this.ctx = null; this._ambient = null; this.scene = null;
  }
};

systemManager.register(AudioSystem);

// Hook SFX to game events.
addNetHandler((scene, socket) => {
  const a = () => scene.audioSystem;
  socket.on('npcKilled', (d) => { if (a()) a().sfx(d && d.isBoss ? 'boss' : 'kill'); });
  socket.on('playerKill', () => { if (a()) a().sfx('kill'); });
  socket.on('npcDamaged', () => { if (a()) a().sfx('hit'); });
  socket.on('abilityHeal', (d) => { if (a() && d.targetId === scene.playerId) a().sfx('heal'); });
  socket.on('levelUp', () => { if (a()) a().sfx('levelup'); });
  socket.on('purchaseResult', (d) => { if (a() && d.success) a().sfx('ui'); });
  socket.on('kothWin', () => { if (a()) a().sfx('win'); });
});

export default AudioSystem;
