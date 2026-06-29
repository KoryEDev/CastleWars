// Server feature loader (Track 0 Foundation).
//
// Lets feature tracks plug logic into both game servers via one-line hooks instead
// of editing the monolithic socket/tick blocks. Usage in server.js / server-pve.js:
//
//   const features = require('./server/features');
//   const ctx = { server: 'pvp', io, gameState, Player, broadcast, now: () => Date.now() };
//   features.init(ctx);                                   // once at startup
//   io.on('connection', (socket) => features.registerSocket(io, socket, ctx));
//   // in join handler:  features.onJoin(ctx, player, socket);
//   // in game loop:     features.onTick(ctx, dt);
//
// To add a feature, require it below and push into FEATURES.

const FEATURES = [
  // Populated by feature tracks, e.g.:
  // require('./list/quests'),
];

function applicable(feature, ctx) {
  if (!feature.servers) return true;
  return feature.servers.includes(ctx.server);
}

function safe(fnName, feature, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[features] ${feature.id || 'unknown'}.${fnName} error:`, err && err.message);
  }
}

module.exports = {
  FEATURES,
  register(feature) {
    if (feature && feature.id) FEATURES.push(feature);
  },
  init(ctx) {
    FEATURES.forEach((f) => {
      if (applicable(f, ctx) && typeof f.init === 'function') safe('init', f, () => f.init(ctx));
    });
  },
  registerSocket(io, socket, ctx) {
    FEATURES.forEach((f) => {
      if (applicable(f, ctx) && typeof f.registerSocket === 'function') {
        safe('registerSocket', f, () => f.registerSocket(io, socket, ctx));
      }
    });
  },
  onJoin(ctx, player, socket) {
    FEATURES.forEach((f) => {
      if (applicable(f, ctx) && typeof f.onJoin === 'function') {
        safe('onJoin', f, () => f.onJoin(ctx, player, socket));
      }
    });
  },
  onTick(ctx, dt) {
    FEATURES.forEach((f) => {
      if (applicable(f, ctx) && typeof f.onTick === 'function') {
        safe('onTick', f, () => f.onTick(ctx, dt));
      }
    });
  }
};
