const mongoose = require('mongoose');

const achievementProgressSchema = new mongoose.Schema({
  playerId: {
    type: String,
    required: true
  },
  achievementId: {
    type: String,
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  tier: {
    type: Number,
    default: 0 // For tiered achievements
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // Store any additional tracking data
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
achievementProgressSchema.index({ playerId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('AchievementProgress', achievementProgressSchema); 