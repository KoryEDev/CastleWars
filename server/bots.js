// Server-side bots (Track 14). AI opponents that populate the PvP world. Bots have
// no socket, so the normal playerInput->velocity path never runs for them; instead we
// set vx/vy DIRECTLY and the authoritative game loop moves + collides them like real
// players. Bots shoot (real bullets via helpers.fireBullet), climb (jump over 1-2
// block walls), build (place a step block when blocked by a tall wall), keep combat
// distance, and spread out from each other so they don't all dog-pile the player.

const BOT_NAMES = ['Bot_Ace', 'Bot_Blitz', 'Bot_Cobra', 'Bot_Drift', 'Bot_Echo'];
const DEFAULT_BUILD_ORDER = ['wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'];

const SPEED = 4;
const PREFERRED_MIN = 220; // stay at least this far from the target (anti-crowd)
const PREFERRED_MAX = 400; // close in if farther than this
const FIRE_RANGE = 560;
const SEPARATION = 100;    // push away from other bots within this distance

// Safe zone (weapon shop) + spawn buffer: bots won't target players here, won't enter,
// and stay to the right of it so they can't spawn-camp.
function shopRight(gameState) {
  const a = gameState.weaponShopArea;
  return a ? a.x + a.width : 700;
}
function inSafeZone(gameState, x) {
  const a = gameState.weaponShopArea;
  if (!a) return x < 760;
  return x <= a.x + a.width + 60; // whole left side incl. spawn buffer
}

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
    gold: 0, classId: 'soldier', unlockedWeapons: [], clanId: null, equippedCosmetics: {},
    _dir: Math.random() < 0.5 ? 1 : -1,
    _nextFire: 0,
    _stuck: 0,
    _lastX: null,
    _nextBuild: 0
  };
}

// Is there a solid block directly ahead of the bot at body height? Returns the block.
function blockAhead(gameState, b, dir) {
  const ax = b.x + dir * 36;
  for (const bld of gameState.buildings) {
    if (!bld || bld.type === 'door') continue;
    if (ax >= bld.x && ax <= bld.x + 64 && (b.y - 8) >= bld.y && (b.y - 56) <= bld.y + 64) {
      return bld;
    }
  }
  return null;
}

// Rough line-of-sight: no solid block between bot and target (sampled).
function hasLineOfSight(gameState, b, tx, ty) {
  const steps = 8;
  for (let s = 1; s < steps; s++) {
    const px = b.x + (tx - b.x) * (s / steps);
    const py = (b.y - 30) + (ty - (b.y - 30)) * (s / steps);
    for (const bld of gameState.buildings) {
      if (!bld || bld.type === 'door') continue;
      if (px >= bld.x && px <= bld.x + 64 && py >= bld.y && py <= bld.y + 64) return false;
    }
  }
  return true;
}

function start(io, gameState, count, helpers) {
  helpers = helpers || {};
  const bots = [];
  for (let i = 0; i < count; i++) {
    const b = makeBot(i);
    gameState.players[b.id] = b;
    bots.push(b);
  }
  console.log('[BOTS] Spawned ' + count + ' practice bots');

  setInterval(() => {
    const now = Date.now();
    for (const b of bots) {
      if (!gameState.players[b.id]) gameState.players[b.id] = b; // re-add if cleared
      if (b.isDead) { b.vx = 0; continue; }

      // Nearest living real player (ignore anyone safe in the shop / spawn zone).
      let target = null, td = Infinity;
      for (const id in gameState.players) {
        const p = gameState.players[id];
        if (!p || p.isBot || p.isDead) continue;
        if (inSafeZone(gameState, p.x || 0)) continue; // don't camp spawn / shop
        const d = Math.hypot((p.x || 0) - b.x, (p.y || 0) - b.y);
        if (d < td) { td = d; target = p; }
      }

      let dir = b._dir || 1;
      const grounded = Math.abs(b.vy || 0) < 0.8;

      if (target) {
        const horiz = Math.abs(target.x - b.x);
        const toward = target.x > b.x ? 1 : -1;
        // Maintain a combat distance: back off if too close, approach if too far, else strafe.
        if (horiz < PREFERRED_MIN) dir = -toward;
        else if (horiz > PREFERRED_MAX) dir = toward;
        else if (Math.random() < 0.25) dir = -dir; // strafe in the pocket
        b.aimAngle = Math.atan2(target.y - (b.y - 30), target.x - b.x);

        // Shoot when in range + line of sight (slow + inaccurate so it's fair/fun).
        if (now >= b._nextFire && td <= FIRE_RANGE && typeof helpers.fireBullet === 'function' && hasLineOfSight(gameState, b, target.x, target.y - 20)) {
          const jitter = (Math.random() - 0.5) * 160; // imperfect aim
          helpers.fireBullet(b, target.x + jitter, (target.y - 20) + jitter);
          b._nextFire = now + 1300 + Math.random() * 900;
        }
      } else {
        if (Math.random() < 0.25) dir = -dir; // wander
      }

      // Separation: avoid clumping with other bots.
      for (const o of bots) {
        if (o === b || o.isDead) continue;
        if (Math.abs(o.x - b.x) < SEPARATION) { dir = o.x > b.x ? -1 : 1; break; }
      }

      b._dir = dir;
      b.vx = dir * SPEED;

      // Climb: if a block is directly ahead, jump it.
      const ahead = blockAhead(gameState, b, dir);
      if (ahead && grounded) {
        b.vy = -11;
      } else if (grounded && (Math.random() < 0.04 || b._stuck > 4)) {
        b.vy = -11; // occasional / unstick jump
      }

      // Build: if still stuck after trying to jump (tall wall), place a step block to climb.
      if (b._stuck > 6 && now >= b._nextBuild && typeof helpers.placeBlock === 'function') {
        const gx = Math.round((b.x + dir * 40) / 64) * 64;
        const gy = Math.round((b.y - 8) / 64) * 64; // a step at foot level ahead
        if (helpers.placeBlock(b, 'wall', gx, gy)) {
          b._nextBuild = now + 4000;
          b._stuck = 0;
          b.vy = -11;
        }
      }

      // Stuck detection (barely moving horizontally).
      if (b._lastX != null && Math.abs(b.x - b._lastX) < 1.2) b._stuck = (b._stuck || 0) + 1;
      else b._stuck = 0;
      b._lastX = b.x;

      // Stay out of the shop / spawn safe zone (no spawn-camping).
      const leftBound = shopRight(gameState) + 100;
      if (b.x < leftBound) { b._dir = 1; b.vx = SPEED; b._stuck = 0; }
      else if (b.x > 3910) { b._dir = -1; b.vx = -SPEED; }
    }
  }, 180);
}

module.exports = { start };
