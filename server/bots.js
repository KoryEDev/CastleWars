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

  // Bot AI. IMPORTANT: bots have no socket, so the normal playerInput->velocity path
  // never runs for them. We therefore set vx/vy DIRECTLY here; the authoritative game
  // loop then moves them by vx/vy and applies gravity + building collisions, exactly
  // like real players.
  const SPEED = 4;
  setInterval(() => {
    for (const b of bots) {
      if (!gameState.players[b.id]) { gameState.players[b.id] = b; } // re-add if cleared
      if (b.isDead) { b.vx = 0; continue; }

      // Find nearest real (non-bot) player.
      let nearest = null, nd = Infinity;
      for (const id in gameState.players) {
        const p = gameState.players[id];
        if (!p || p.isBot || p.isDead) continue;
        const d = Math.abs((p.x || 0) - b.x);
        if (d < nd) { nd = d; nearest = p; }
      }

      let dir = b._dir || 1;
      if (nearest) {
        if (nd > 160) {
          // Chase the player.
          dir = nearest.x > b.x ? 1 : -1;
        } else {
          // Strafe / back off when close.
          if (Math.random() < 0.4) dir = -dir;
        }
        b.aimAngle = Math.atan2((nearest.y || 0) - b.y, (nearest.x || 0) - b.x);
      } else {
        // Wander: occasionally flip direction.
        if (Math.random() < 0.3) dir = -dir;
      }
      b._dir = dir;
      b.vx = dir * SPEED;

      // Jump when grounded-ish (vy ~0 means standing on ground/block).
      const grounded = Math.abs(b.vy || 0) < 0.6;
      if (grounded && (Math.random() < 0.12 || b._stuck > 3)) {
        b.vy = -11;
        b._stuck = 0;
      }

      // Stuck detection: if barely moved horizontally, count it (to trigger a jump).
      if (b._lastX != null && Math.abs(b.x - b._lastX) < 1) b._stuck = (b._stuck || 0) + 1;
      else b._stuck = 0;
      b._lastX = b.x;

      // Turn around at world edges.
      if (b.x < 80) { dir = 1; b.vx = SPEED; b._dir = 1; }
      else if (b.x > 3920) { dir = -1; b.vx = -SPEED; b._dir = -1; }
    }
  }, 350);
}

module.exports = { start };
