// Weather system (Track 12). Client-side atmospheric effects: rain, snow, fog,
// cycling over time. Uses pooled rectangles fixed to the camera (no texture assets).
// Self-registers with systemManager.
import { systemManager } from './SystemManager.js';

const TYPES = ['clear', 'rain', 'snow', 'fog'];
const CYCLE_MS = 50000; // change weather every ~50s

const WeatherSystem = {
  id: 'weatherSystem',
  weather: 'clear',
  drops: [],
  fog: null,
  _nextChange: 0,

  init(scene) {
    this.scene = scene;
    this.drops = [];
    const w = scene.scale.width;
    const h = scene.scale.height;
    // Pool of drops fixed to camera.
    for (let i = 0; i < 140; i++) {
      const r = scene.add.rectangle(Math.random() * w, Math.random() * h, 2, 10, 0xffffff, 0)
        .setScrollFactor(0).setDepth(800);
      this.drops.push({ r, speed: 0, drift: 0 });
    }
    this.fog = scene.add.rectangle(w / 2, h / 2, w, h, 0xbfc7d6, 0).setScrollFactor(0).setDepth(799);
    this._nextChange = Date.now() + 8000; // first change after 8s
    this.setWeather('clear');
    // Indicator
    const el = document.createElement('div');
    el.id = 'weather-indicator';
    el.style.cssText = 'position:fixed;top:40px;left:12px;z-index:1000;background:rgba(0,0,0,0.4);border-radius:5px;padding:2px 8px;font-family:Arial;font-size:11px;color:#cde;pointer-events:none';
    document.body.appendChild(el);
    this.indicator = el;
    this._updateIndicator();
  },

  setWeather(type) {
    this.weather = type;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    if (type === 'rain') {
      this.drops.forEach((d) => { d.speed = 14 + Math.random() * 8; d.drift = -1.5; d.r.setSize(2, 12).setFillStyle(0x99bbff, 0.6); });
      this.fog.setFillStyle(0x223344, 0.12);
    } else if (type === 'snow') {
      this.drops.forEach((d) => { d.speed = 2 + Math.random() * 2; d.drift = (Math.random() - 0.5) * 1.5; d.r.setSize(4, 4).setFillStyle(0xffffff, 0.85); });
      this.fog.setFillStyle(0xdde6f0, 0.06);
    } else if (type === 'fog') {
      this.drops.forEach((d) => { d.speed = 0; d.r.setFillStyle(0xffffff, 0); });
      this.fog.setFillStyle(0xbfc7d6, 0.28);
    } else { // clear
      this.drops.forEach((d) => { d.speed = 0; d.r.setFillStyle(0xffffff, 0); });
      this.fog.setFillStyle(0xffffff, 0);
    }
    this._updateIndicator();
  },

  _updateIndicator() {
    if (this.indicator) this.indicator.textContent = 'Weather: ' + this.weather;
  },

  update(scene) {
    const now = Date.now();
    if (now >= this._nextChange) {
      this._nextChange = now + CYCLE_MS;
      // Bias toward clear, then a random effect.
      const next = Math.random() < 0.4 ? 'clear' : TYPES[1 + Math.floor(Math.random() * 3)];
      this.setWeather(next);
    }
    if (this.weather === 'rain' || this.weather === 'snow') {
      const w = scene.scale.width;
      const h = scene.scale.height;
      for (const d of this.drops) {
        if (d.speed <= 0) continue;
        d.r.y += d.speed;
        d.r.x += d.drift;
        if (d.r.y > h) { d.r.y = -10; d.r.x = Math.random() * w; }
        if (d.r.x < 0) d.r.x = w;
        else if (d.r.x > w) d.r.x = 0;
      }
    }
  },

  shutdown() {
    this.drops.forEach((d) => d.r && d.r.destroy());
    this.drops = [];
    if (this.fog) { this.fog.destroy(); this.fog = null; }
    if (this.indicator) { this.indicator.remove(); this.indicator = null; }
    this.scene = null;
  }
};

systemManager.register(WeatherSystem);

export default WeatherSystem;
