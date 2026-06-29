// Shared block/building configuration - single source of truth for both servers.
// Track 0 (Foundation).

const BLOCK_TYPES = [
  'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick',
  // Track 5: new content blocks
  'glass', 'reinforced'
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
  brick: 120,
  // Track 5
  glass: 40,        // fragile - shatters fast
  reinforced: 250   // heavy armor plating
};

module.exports = { BLOCK_TYPES, BUILDING_HEALTH };
