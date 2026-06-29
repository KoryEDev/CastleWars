// Feature contract (Track 0 Foundation).
//
// A "feature" is a self-contained server-side module that can be added without
// editing the giant socket/tick blocks in server.js / server-pve.js. Each feature
// is a plain object implementing any subset of the hooks below. Register features
// in server/features/index.js.
//
// Shape:
//   {
//     id: string,                         // unique id
//     servers?: ['pvp','pve'],            // which servers it applies to (default: both)
//     init?(ctx),                         // called once at startup
//     registerSocket?(io, socket, ctx),   // called for every new socket connection
//     onJoin?(ctx, player, socket),       // called when a player joins the game
//     onTick?(ctx, dt),                   // called every game tick (dt in ms)
//   }
//
// `ctx` (built by each server) exposes at least:
//   { server: 'pvp'|'pve', io, gameState, Player, broadcast(event, payload), now() }

/** @typedef {Object} FeatureContext */

module.exports = {};
