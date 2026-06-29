const mongoose = require('mongoose');

// Season definition for seasonal leaderboards / battle pass (Track 9 + 13).
const seasonSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  name: { type: String, default: '' },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Season', seasonSchema);
