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
    // Misc stats
    playTime: { type: Number, default: 0 }, // in seconds
    lastSessionStart: { type: Date },
    longestKillStreak: { type: Number, default: 0 },
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
  }
});

module.exports = mongoose.model('Player', playerSchema); 