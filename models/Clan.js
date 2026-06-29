const mongoose = require('mongoose');

// Clan / Guild (Track 8).
const clanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  tag: { type: String, required: true, maxlength: 5 },
  description: { type: String, default: '' },
  owner: { type: String, required: true }, // username
  members: [{ username: String, rank: { type: String, enum: ['member', 'officer', 'leader'], default: 'member' } }],
  invites: [{ type: String }], // usernames invited
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Clan', clanSchema);
