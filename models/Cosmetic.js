const mongoose = require('mongoose');

// Cosmetic catalog entry (Track 13).
const cosmeticSchema = new mongoose.Schema({
  cosmeticId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['skin', 'weaponSkin', 'trail', 'emote', 'nameplate'], required: true },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  price: { type: Number, default: 0 }, // gold price (0 = not directly purchasable)
  asset: { type: String, default: '' }, // asset path/key
  battlePassTier: { type: Number, default: 0 }, // 0 = not a battle-pass reward
  premium: { type: Boolean, default: false }
});

module.exports = mongoose.model('Cosmetic', cosmeticSchema);
