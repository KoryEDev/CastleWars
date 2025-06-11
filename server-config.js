// Server with environment configuration
const config = require('./config/config');

// Update server.js imports to use config
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const net = require('net');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const Player = require('./models/Player');
const Building = require('./models/Building');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.isDevelopment ? "*" : process.env.ALLOWED_ORIGINS?.split(',') || "*",
    methods: ["GET", "POST"]
  }
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// MongoDB connection with config
mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => console.log('[MongoDB] Connected to database'))
  .catch(err => {
    console.error('[MongoDB] Connection error:', err);
    if (config.isProduction) {
      process.exit(1);
    }
  });

// Log configuration
console.log(`[CONFIG] Environment: ${config.env}`);
console.log(`[CONFIG] PvP Port: ${config.ports.pvp}`);
console.log(`[CONFIG] Features:`, config.features);

// Rest of server.js code would go here...
// This is just a template showing how to use the config

// Start server with configured port
const PORT = config.ports.pvp;
server.listen(PORT, () => {
  console.log(`[PvP Server] Running on port ${PORT} in ${config.env} mode`);
});