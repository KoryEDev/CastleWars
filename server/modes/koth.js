// King of the Hill objective (Track 6). Self-contained overlay that runs on the PvP
// server: players standing in the hill zone accrue points; first to the target wins,
// then it resets. Broadcasts `kothState` once per second for client rendering.
//
// Designed to be additive and non-invasive: it only reads player positions and emits
// an event; it never modifies core combat/movement.

const { GAME_MODES } = require('../../shared/gameModes');

// Hill zone in world coordinates (near ground, clear of the weapon shop at x:300-700).
// Wide ground band right of spawn so players can comfortably stand inside it.
const ZONE = { x: 850, y: 1300, w: 850, h: 720 };
const TARGET = (GAME_MODES.koth.objective && GAME_MODES.koth.objective.targetScore) || 60;

function start(io, gameState) {
  let scores = {}; // username -> points
  let lastWinner = null;

  setInterval(() => {
    const inside = [];
    for (const id in gameState.players) {
      const p = gameState.players[id];
      if (!p || p.isDead) continue;
      const px = p.x || 0;
      const py = p.y || 0;
      if (px >= ZONE.x && px <= ZONE.x + ZONE.w && py >= ZONE.y && py <= ZONE.y + ZONE.h) {
        inside.push(p.username);
      }
    }

    // Award a point per second to each player currently holding the hill.
    inside.forEach((name) => { scores[name] = (scores[name] || 0) + 1; });

    // Check for a winner.
    let winner = null;
    for (const name in scores) {
      if (scores[name] >= TARGET) { winner = name; break; }
    }
    if (winner) {
      lastWinner = winner;
      io.emit('kothWin', { winner, score: scores[winner] });
      scores = {}; // reset round
    }

    // Build a small sorted leaderboard for the HUD.
    const leaderboard = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, score]) => ({ name, score }));

    io.emit('kothState', {
      zone: ZONE,
      target: TARGET,
      holders: inside,
      leaderboard,
      lastWinner
    });
  }, 1000);

  console.log('[MODE] King of the Hill objective active (hill at', ZONE.x + ',' + ZONE.y + ')');
}

module.exports = { start, ZONE };
