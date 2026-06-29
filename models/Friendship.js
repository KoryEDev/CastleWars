const mongoose = require('mongoose');

// Friendship / friend request (Track 8).
const friendshipSchema = new mongoose.Schema({
  requester: { type: String, required: true }, // username
  recipient: { type: String, required: true }, // username
  status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('Friendship', friendshipSchema);
