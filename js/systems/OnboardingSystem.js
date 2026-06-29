// Onboarding (Track 17): a first-login welcome overlay summarizing the new features
// and controls. Shown once (localStorage flag) and re-openable via the help button.
// Works on desktop and mobile. Self-registers.
import { systemManager } from './SystemManager.js';

const OnboardingSystem = {
  id: 'onboarding',

  init(scene) {
    this.scene = scene;
    this._buildButton();
    if (!localStorage.getItem('cw_onboarded_v2')) {
      // Slight delay so it appears after the world loads.
      setTimeout(() => this.show(), 1200);
    }
  },

  _buildButton() {
    const btn = document.createElement('div');
    btn.id = 'help-button';
    btn.textContent = '?';
    btn.title = 'Help / Controls';
    btn.style.cssText = 'position:fixed;bottom:14px;left:14px;width:34px;height:34px;border-radius:50%;background:#ffe066;color:#222;font-weight:bold;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:1001;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
    btn.onclick = () => this.show();
    document.body.appendChild(btn);
    this.button = btn;
  },

  show() {
    if (this.overlay) { this.overlay.style.display = 'flex'; return; }
    const ov = document.createElement('div');
    ov.id = 'onboarding-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:3000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;padding:16px';
    ov.innerHTML =
      '<div style="background:linear-gradient(180deg,#1c1c34,#2a2a52);border:2px solid #ffe066;border-radius:14px;max-width:520px;width:100%;padding:22px;color:#fff;max-height:90vh;overflow-y:auto">' +
      '<div style="color:#ffe066;font-size:26px;font-weight:bold;text-align:center;margin-bottom:6px">Welcome to Castle Wars!</div>' +
      '<div style="color:#9ab;text-align:center;margin-bottom:16px">Build, battle, and level up. Here is what is new:</div>' +
      '<ul style="line-height:1.7;margin:0 0 14px 18px">' +
      '<li><b>Move</b>: A/D or arrows · <b>Jump</b>: W/Space · <b>Shoot</b>: click · <b>Build</b>: Shift</li>' +
      '<li><b>B</b> - Weapon Shop (spend gold to unlock weapons)</li>' +
      '<li><b>C</b> - Choose a Class · <b>Q</b> - Use class ability</li>' +
      '<li><b>J</b> - Daily Quests · <b>O</b> - Clans &amp; Friends · <b>L</b> - Locker (trails)</li>' +
      '<li><b>Tab</b> - Scoreboard · <b>K</b> - Settings · <b>M</b> - Mute sound</li>' +
      '<li>Earn <b>XP &amp; gold</b> from kills, complete <b>quests</b>, climb the <b>leaderboard</b></li>' +
      '<li>Watch for <b>world events</b> (Double XP!) and the <b>King of the Hill</b> zone</li>' +
      '</ul>' +
      '<div style="text-align:center"><button id="onb-close" style="padding:10px 24px;border:none;border-radius:8px;background:#ffe066;color:#222;font-weight:bold;font-size:16px;cursor:pointer">Let\'s Play!</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    this.overlay = ov;
    ov.querySelector('#onb-close').onclick = () => {
      localStorage.setItem('cw_onboarded_v2', '1');
      ov.style.display = 'none';
    };
  },

  shutdown() {
    if (this.button) { this.button.remove(); this.button = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this.scene = null;
  }
};

systemManager.register(OnboardingSystem);

export default OnboardingSystem;
