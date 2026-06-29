const mongoose = require('mongoose');

// Quest / challenge definition (Track 15).
const questSchema = new mongoose.Schema({
  questId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  cadence: { type: String, enum: ['daily', 'weekly', 'event'], default: 'daily' },
  // Objective: track a metric until it reaches `target`.
  metric: { type: String, required: true }, // e.g. 'kills', 'wavesSurvived', 'blocksPlaced'
  target: { type: Number, required: true },
  rewardGold: { type: Number, default: 0 },
  rewardXp: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Quest', questSchema);
