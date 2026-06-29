const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  type: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  owner: { type: String, required: true },
  // Track 2: stable owner identity (username) that survives reconnects/restarts.
  ownerName: { type: String, default: null }
});

module.exports = mongoose.model('Building', buildingSchema); 