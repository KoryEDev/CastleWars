// Shared world/game constants - single source of truth for both servers.
// Track 0 (Foundation).

module.exports = {
  TICK_RATE: 16, // ms (~60 Hz)
  WORLD_WIDTH: 4000,
  WORLD_HEIGHT: 2000,
  GROUND_Y: 1936,
  MAX_TOMATOES: 20,
  GRID_SIZE: 128, // spatial-grid cell size for collision
  BUILDING_SIZE: 64
};
