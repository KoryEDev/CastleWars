// Server-side bots (Track 14). Fills the PvP world with simple AI opponents that
// double as a practice target. Bots are normal entries in gameState.players that
// the authoritative movement loop moves via their `input` (same as real players),
// so they collide and move naturally. They have no socket.

const BOT_NAMES = ['Bot_Ace', 'Bot_Blitz', 'Bot_Cobra', 'Bot_Drift', 'Bot_Echo'];
const DEFAULT_BUILD_ORDER = ['wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'];

function makeBot(i) {
  const id = 'bot_' + i + '_' + Math.floor(Math.random() * 100000);
  return {
    id,
    username: BOT_NAMES[i % BOT_NAMES.length],
    isBot: true,
    x: 700 + Math.random() * 1400,
    y: 1800,
    vx: 0, vy: 0,
    inventory: [],
    stats: { health: 100, maxHealth: 100, kills: 0, deaths: 0, currentKillStreak: 0, longestKillStreak: 0 },
    role: 'player',
    buildingOrder: DEFAULT_BUILD_ORDER.slice(),
    onElevator: false,
    input: { up: false, left: false, right: false, aimAngle: 0 },
    moveSpeed: null, jumpHeight: null, flyMode: false, flySpeed: null,
    health: 100, maxHealth: 100,
    currentWeapon: 'pistol', weaponLoadout: ['pistol'],
    isDead: false,
    sessionStartTime: Date.now(),
    tutorialCompleted: true,
    aimAngle: 0,
    gold: 0, classId: 'soldier', unlockedWeapons: [], clanId: null, equippedCosmetics: {}
  };
}

function start(io, gameState, count) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const b = makeBot(i);
    gameState.players[b.id] = b;
    bots.push(b);
  }
  console.log('[BOTS] Spawned ' + count + ' practice bots');

  setInterval(() => {
    for (const b of bots) {
      if (!gameState.players[b.id]) { gameState.players[b.id] = b; } // re-add if cleared
      if (b.isDead) { b.input = { up: false, left: false, right: false, aimAngle: b.aimAngle || 0 }; continue; }
      // Find nearest real (non-bot) player.
      let nearest = null, nd = Infinity;
      for (const id in gameState.players) {
        const p = gameState.players[id];
        if (!p || p.isBot || p.isDead) continue;
        const d = Math.abs((p.x || 0) - b.x);
        if (d < nd) { nd = d; nearest = p; }
      }
      const inp = b.input;
      if (nearest) {
        const dir = nearest.x > b.x ? 1 : -1;
        if (nd > 140) { inp.left = dir < 0; inp.right = dir > 0; }
        else { const r = Math.random(); inp.left = r < 0.35; inp.right = r > 0.65; } // strafe when close
        inp.up = Math.random() < 0.08;
        b.aimAngle = Math.atan2((nearest.y || 0) - b.y, (nearest.x || 0) - b.x);
        inp.aimAngle = b.aimAngle;
      } else {
        const r = Math.random();
        inp.left = r < 0.3; inp.right = r > 0.7; inp.up = Math.random() < 0.04;
      }
    }
  }, 400);
}

module.exports = { start };
