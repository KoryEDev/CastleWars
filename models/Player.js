const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['player', 'mod', 'admin', 'ash', 'owner'],
    default: 'player'
  },
  banned: {
    type: Boolean,
    default: false
  },
  banDate: {
    type: Date
  },
  x: {
    type: Number,
    default: 200
  },
  y: {
    type: Number,
    default: 1936
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  gold: {
    type: Number,
    default: 0
  },
  inventory: [{
    itemId: String,
    quantity: Number
  }],
  stats: {
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    attack: { type: Number, default: 10 },
    defense: { type: Number, default: 5 },
    // Combat stats for leaderboards
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    headshots: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    damageTaken: { type: Number, default: 0 },
    shotsHit: { type: Number, default: 0 },
    shotsFired: { type: Number, default: 0 },
    // Building stats
    blocksPlaced: { type: Number, default: 0 },
    blocksDestroyed: { type: Number, default: 0 },
    buildingsBuilt: { type: Number, default: 0 },
    itemsCrafted: { type: Number, default: 0 },
    // PvE stats
    mobKills: { type: Number, default: 0 },
    pveKills: { type: Number, default: 0 }, // alias for mobKills
    wavesSurvived: { type: Number, default: 0 },
    bestWave: { type: Number, default: 0 }, // alias for wavesSurvived
    // Misc stats
    playTime: { type: Number, default: 0 }, // in seconds
    playtime: { type: Number, default: 0 }, // in minutes (for control panel compatibility)
    lastSessionStart: { type: Date },
    longestKillStreak: { type: Number, default: 0 },
    bestKillstreak: { type: Number, default: 0 }, // alias for longestKillStreak
    currentKillStreak: { type: Number, default: 0 }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  buildingOrder: {
    type: [String],
    default: ['wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick']
  },
  currentWeapon: {
    type: String,
    default: 'pistol'
  },
  weaponLoadout: {
    type: [String],
    default: ['pistol', 'rifle']
  },
  tutorialCompleted: {
    type: Boolean,
    default: false
  },
  achievements: {
    type: [String],
    default: []
  },
  achievementPoints: {
    type: Number,
    default: 0
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Player', playerSchema); 