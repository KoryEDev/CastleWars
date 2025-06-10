const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  type: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  owner: { type: String, required: true }
});

module.exports = mongoose.model('Building', buildingSchema); 