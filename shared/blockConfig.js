// Shared block/building configuration - single source of truth for both servers.
// Track 0 (Foundation).

const BLOCK_TYPES = [
  'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'
];

// Building health values (used by PvE for destructible defenses).
const BUILDING_HEALTH = {
  wall: 100,
  door: 50,
  tunnel: 150,
  castle_tower: 200,
  wood: 80,
  gold: 300,
  roof: 60,
  brick: 120
};

module.exports = { BLOCK_TYPES, BUILDING_HEALTH };
