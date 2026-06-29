// Social panel (Track 8): clans + friends. Press O to open/close. Self-registers.
import { systemManager } from '../systems/SystemManager.js';
import { addNetHandler } from '../net/handlers/index.js';

const SocialUI = {
  id: 'socialUI',
  open: false,

  init(scene) {
    if (scene.scale && scene.scale.width < 700) return; // desktop only
    this.scene = scene;
    scene.socialUI = this;
    this._build();
    this._keyHandler = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'o' || e.key === 'O') this.toggle();
      else if (e.key === 'Escape' && this.open) this.toggle();
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  _socket() { return this.scene && this.scene.multiplayer && this.scene.multiplayer.socket; },

  _build() {
    const panel = document.createElement('div');
    panel.id = 'social-panel';
    panel.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'width:460px', 'max-width:92vw', 'background:linear-gradient(180deg,#1c1c34,#2a2a52)',
      'border:2px solid #ffe066', 'border-radius:12px', 'padding:16px', 'z-index:1500',
      'display:none', 'color:#fff', 'font-family:Arial,sans-serif'
    ].join(';');
    panel.innerHTML =
      '<div style="color:#ffe066;font-size:20px;font-weight:bold;text-align:center;margin-bottom:10px">SOCIAL</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<button id="soc-clan-tab" style="flex:1;padding:6px;cursor:pointer;border:none;border-radius:6px;background:#ffe066;color:#222;font-weight:bold">Clan</button>' +
      '<button id="soc-friends-tab" style="flex:1;padding:6px;cursor:pointer;border:none;border-radius:6px;background:#444;color:#fff;font-weight:bold">Friends</button>' +
      '</div><div id="soc-body"></div>' +
      '<div style="color:#9ab;font-size:11px;margin-top:10px;text-align:center">Press O or Esc to close</div>';
    document.body.appendChild(panel);
    this.panel = panel;
    this.body = panel.querySelector('#soc-body');
    panel.querySelector('#soc-clan-tab').onclick = () => this.showClan();
    panel.querySelector('#soc-friends-tab').onclick = () => this.showFriends();
    this.clan = null;
    this.showClan();
  },

  showClan() {
    const s = this._socket();
    if (s) { s.emit('requestClan'); s.emit('listClans'); }
    const c = this.clan;
    if (c) {
      let members = (c.members || []).map(m => `<div>${m.username} <span style="color:#9ab">(${m.rank})</span></div>`).join('');
      this.body.innerHTML =
        `<div style="font-size:16px;font-weight:bold;color:#ffe066">[${c.tag}] ${c.name} <span style="color:#9ab;font-size:12px">Lv ${c.level}</span></div>` +
        `<div style="margin:8px 0">${members}</div>` +
        `<button id="soc-leave" style="padding:6px 10px;border:none;border-radius:6px;background:#a33;color:#fff;cursor:pointer">Leave Clan</button>`;
      const lv = this.body.querySelector('#soc-leave');
      if (lv) lv.onclick = () => { const so = this._socket(); if (so) so.emit('leaveClan'); };
    } else {
      this.body.innerHTML =
        '<div style="margin-bottom:8px">You are not in a clan.</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:8px">' +
        '<input id="soc-cname" placeholder="Clan name" style="flex:2;padding:6px;border-radius:6px;border:1px solid #555;background:#111;color:#fff">' +
        '<input id="soc-ctag" placeholder="TAG" maxlength="5" style="flex:1;padding:6px;border-radius:6px;border:1px solid #555;background:#111;color:#fff">' +
        '<button id="soc-create" style="padding:6px 10px;border:none;border-radius:6px;background:#ffe066;color:#222;cursor:pointer;font-weight:bold">Create</button>' +
        '</div><div id="soc-clanlist" style="max-height:160px;overflow-y:auto"></div>';
      const create = this.body.querySelector('#soc-create');
      if (create) create.onclick = () => {
        const so = this._socket();
        if (so) so.emit('createClan', { name: this.body.querySelector('#soc-cname').value, tag: this.body.querySelector('#soc-ctag').value });
      };
    }
  },

  renderClanList(clans) {
    const el = this.body && this.body.querySelector('#soc-clanlist');
    if (!el) return;
    el.innerHTML = clans.length ? '' : '<div style="color:#9ab">No clans yet - create one!</div>';
    clans.forEach(c => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:6px;margin-bottom:5px';
      row.innerHTML = `<span>[${c.tag}] ${c.name} <span style="color:#9ab">(${c.members})</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = 'Join';
      btn.style.cssText = 'padding:4px 10px;border:none;border-radius:5px;background:#3a6;color:#fff;cursor:pointer';
      btn.onclick = () => { const so = this._socket(); if (so) so.emit('joinClan', { name: c.name }); };
      row.appendChild(btn);
      el.appendChild(row);
    });
  },

  showFriends() {
    const s = this._socket();
    if (s) s.emit('listFriends');
    this.body.innerHTML =
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<input id="soc-fname" placeholder="Username" style="flex:2;padding:6px;border-radius:6px;border:1px solid #555;background:#111;color:#fff">' +
      '<button id="soc-fadd" style="padding:6px 10px;border:none;border-radius:6px;background:#ffe066;color:#222;cursor:pointer;font-weight:bold">Add</button>' +
      '</div><div id="soc-friendlist" style="max-height:200px;overflow-y:auto"><div style="color:#9ab">Loading...</div></div>';
    const add = this.body.querySelector('#soc-fadd');
    if (add) add.onclick = () => { const so = this._socket(); if (so) so.emit('addFriend', { username: this.body.querySelector('#soc-fname').value }); };
  },

  renderFriendList(friends) {
    const el = this.body && this.body.querySelector('#soc-friendlist');
    if (!el) return;
    el.innerHTML = friends.length ? '' : '<div style="color:#9ab">No friends yet</div>';
    friends.forEach(f => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;background:rgba(0,0,0,0.25);border-radius:6px;padding:6px;margin-bottom:5px';
      row.innerHTML = `<span>${f.username}</span><span style="color:${f.online ? '#39ff14' : '#888'}">${f.online ? 'online' : 'offline'}</span>`;
      el.appendChild(row);
    });
  },

  toggle() {
    if (!this.panel) return;
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
    if (this.open) this.showClan();
  },

  shutdown() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.scene = null;
  }
};

systemManager.register(SocialUI);

addNetHandler((scene, socket) => {
  socket.on('clanUpdate', (d) => { if (scene.socialUI) { scene.socialUI.clan = d.clan; if (scene.socialUI.open) scene.socialUI.showClan(); } });
  socket.on('clanList', (d) => { if (scene.socialUI) scene.socialUI.renderClanList(d.clans || []); });
  socket.on('friendList', (d) => { if (scene.socialUI) scene.socialUI.renderFriendList(d.friends || []); });
  socket.on('clanChat', (d) => {
    if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: `[CLAN] ${d.from}: ${d.message}` });
  });
  socket.on('clanInfo', (d) => { if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: d.message }); });
  socket.on('clanError', (d) => { if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: 'Clan: ' + d.message }); });
  socket.on('friendInfo', (d) => { if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: d.message }); });
  socket.on('friendError', (d) => { if (scene.addGameLogEntry) scene.addGameLogEntry('message', { text: 'Friend: ' + d.message }); });
});

export default SocialUI;
