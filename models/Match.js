const mongoose = require('mongoose');

// Match history / run summary (Track 9 + PvE meta-progression).
const matchSchema = new mongoose.Schema({
  mode: { type: String, required: true }, // 'pvp' | 'pve' | 'tdm' | 'ctf' | ...
  serverType: { type: String, default: 'pvp' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: Date.now },
  durationSec: { type: Number, default: 0 },
  // PvE specifics
  wavesSurvived: { type: Number, default: 0 },
  bossKills: { type: Number, default: 0 },
  // Participants and their per-match stats
  participants: [{
    username: String,
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 }
  }],
  winner: { type: String, default: null }, // username or team
  season: { type: Number, default: 0 }
}, { timestamps: true });

matchSchema.index({ mode: 1, endedAt: -1 });
matchSchema.index({ 'participants.username': 1 });

module.exports = mongoose.model('Match', matchSchema);
