const express = require('express');
const bcrypt = require('bcrypt');
const Player = require('../models/Player');

const router = express.Router();

// Function to check if user is already logged in
let checkActiveUser = null;

// This will be set by the main server
router.setActiveUserChecker = (checker) => {
  checkActiveUser = checker;
};

// Register endpoint
router.post('/register', async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  try {
    const usernameLower = username.toLowerCase();
    const existing = await Player.findOne({ username: usernameLower });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const player = new Player({ username: usernameLower, passwordHash });
    await player.save();
    res.json({ username: player.username, stats: player.stats, inventory: player.inventory, x: player.x, y: player.y });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  try {
    const usernameLower = username.toLowerCase();
    const player = await Player.findOne({ username: usernameLower });
    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const valid = await bcrypt.compare(password, player.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    // Check if player is banned
    if (player.banned) {
      return res.status(403).json({ error: 'You are banned from this server!' });
    }
    
    // Check if player is already logged in
    if (checkActiveUser && checkActiveUser(usernameLower)) {
      return res.status(403).json({ error: 'This account is already logged in!' });
    }
    
    res.json({ username: player.username, stats: player.stats, inventory: player.inventory, x: player.x, y: player.y });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

module.exports = router; 