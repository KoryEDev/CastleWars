const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const authRouter = require('./routes/auth');
const Building = require('./models/Building');
const Player = require('./models/Player');
const AchievementManager = require('./managers/AchievementManager');
const readline = require('readline');
const { createServer } = require('net');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Support both transports
  pingTimeout: 60000, // Increase timeout for slower connections
  pingInterval: 25000,
  perMessageDeflate: false, // Disable compression to reduce CPU load
  httpCompression: false, // Disable HTTP compression
  maxHttpBufferSize: 1e6 // 1MB max message size
});

// Create IPC server for GUI communication
const ipcServer = createServer();
let guiSocket = null;

// Initialize Achievement Manager
const achievementManager = new AchievementManager(io);

ipcServer.on('connection', (socket) => {
  console.log('GUI control panel connected');
  guiSocket = socket;
  
  let buffer = '';
  
  socket.on('data', (data) => {
    buffer += data.toString();
    
    // Process all complete messages in the buffer
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const message = buffer.substring(0, newlineIndex);
      buffer = buffer.substring(newlineIndex + 1);
      
      if (message.trim()) {
        try {
          const command = JSON.parse(message);
          // Only log non-routine commands (skip getPlayers spam)
          if (command.type !== 'getPlayers') {
            console.log('Received IPC command:', command);
          }
          
          // Special handling for command type
          if (command.type === 'command' && command.command) {
            console.log('[PVP IPC] Processing command string:', command.command);
            // Process command directly here instead of recursive calls
            processGuiCommand(command.command);
          } else {
            // Handle other GUI commands (non-command type)
            handleGuiCommand(command);
          }
        } catch (err) {
          console.error('Error parsing GUI command:', err, 'Message:', message);
        }
      }
    }
  });
  
  socket.on('end', () => {
    console.log('GUI control panel disconnected');
    guiSocket = null;
  });
});

// Listen on a local socket for IPC
const IPC_PORT = 3002;
ipcServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`IPC port ${IPC_PORT} is already in use. This might mean another instance is running.`);
    console.error('Try: lsof -i :3002 to see what\'s using the port');
  } else {
    console.error('IPC server error:', err);
  }
});

ipcServer.listen(IPC_PORT, '127.0.0.1', () => {
  console.log(`IPC server listening on port ${IPC_PORT} for GUI commands`);
});

// Function to send log to GUI
function sendLogToGui(message, level = 'info') {
  if (guiSocket && guiSocket.writable) {
    const logData = {
      type: 'log',
      level: level,
      message: message,
      timestamp: new Date().toISOString()
    };
    guiSocket.write(JSON.stringify(logData) + '\n');
  }
}

app.use(bodyParser.json());

// Rate limiting removed - restored to original state

// CORS middleware for HTTP requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Track active usernames to prevent multi-login (moved up for auth router)
const activeUsernames = new Map(); // username -> socket.id
// Set up auth router with active user checker
authRouter.setActiveUserChecker((username) => {
  // Check both activeUsernames and gameState.players
  if (activeUsernames.has(username)) {
    const socketId = activeUsernames.get(username);
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      return true; // User is actively connected
    }
  }
  
  // Also check gameState as backup
  for (const id in gameState.players) {
    if (gameState.players[id].username === username) {
      return true;
    }
  }
  
  return false;
});

// Set up player count getter
authRouter.setPlayerCountGetter(() => {
  return Object.keys(gameState.players).length;
});

app.use('/auth', authRouter);

// Hiscores endpoint for public access
app.get('/hiscores', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-hiscores.html'));
});

// API endpoint for managing user achievements
app.post('/api/users/:username/achievements', async (req, res) => {
    try {
        const { username } = req.params;
        const { achievement } = req.body;
        
        if (!achievement) {
            return res.status(400).json({ error: 'Achievement name is required' });
        }
        
        const user = await Player.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Initialize achievements array if it doesn't exist
        if (!user.achievements) {
            user.achievements = [];
        }
        
        // Check if achievement already exists
        if (user.achievements.includes(achievement)) {
            return res.status(400).json({ error: 'Achievement already exists' });
        }
        
        // Add achievement
        user.achievements.push(achievement);
        await user.save();
        
        res.json(user);
    } catch (error) {
        console.error('Error adding achievement:', error);
        res.status(500).json({ error: 'Failed to add achievement' });
    }
});

// API endpoint for updating user data
app.patch('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const updateData = req.body;
        
        const user = await Player.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update user fields
        if (updateData.role !== undefined) user.role = updateData.role;
        if (updateData.banned !== undefined) user.banned = updateData.banned;
        if (updateData.level !== undefined) user.level = updateData.level;
        if (updateData.gold !== undefined) user.gold = updateData.gold;
        if (updateData.experience !== undefined) user.experience = updateData.experience;
        if (updateData.lastLogin !== undefined) user.lastLogin = updateData.lastLogin;
        if (updateData.registeredAt !== undefined) user.registeredAt = updateData.registeredAt;
        
        // Update stats
        if (updateData.stats) {
            if (!user.stats) user.stats = {};
            if (updateData.stats.kills !== undefined) user.stats.kills = updateData.stats.kills;
            if (updateData.stats.deaths !== undefined) user.stats.deaths = updateData.stats.deaths;
            if (updateData.stats.mobKills !== undefined) user.stats.mobKills = updateData.stats.mobKills;
            if (updateData.stats.playtime !== undefined) user.stats.playtime = updateData.stats.playtime;
            if (updateData.stats.bestKillstreak !== undefined) user.stats.bestKillstreak = updateData.stats.bestKillstreak;
            if (updateData.stats.wavesSurvived !== undefined) user.stats.wavesSurvived = updateData.stats.wavesSurvived;
            if (updateData.stats.buildingsBuilt !== undefined) user.stats.buildingsBuilt = updateData.stats.buildingsBuilt;
            if (updateData.stats.itemsCrafted !== undefined) user.stats.itemsCrafted = updateData.stats.itemsCrafted;
        }
        
        await user.save();
        
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:username/achievements', async (req, res) => {
    try {
        const { username } = req.params;
        const { achievement } = req.body;
        
        if (!achievement) {
            return res.status(400).json({ error: 'Achievement name is required' });
        }
        
        const user = await Player.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Initialize achievements array if it doesn't exist
        if (!user.achievements) {
            user.achievements = [];
        }
        
        // Remove achievement
        const index = user.achievements.indexOf(achievement);
        if (index === -1) {
            return res.status(400).json({ error: 'Achievement not found' });
        }
        
        user.achievements.splice(index, 1);
        await user.save();
        
        res.json(user);
    } catch (error) {
        console.error('Error removing achievement:', error);
        res.status(500).json({ error: 'Failed to remove achievement' });
    }
});

// API endpoint for hiscores data
app.get('/api/hiscores', async (req, res) => {
    try {
        // Get all players from database sorted by different criteria
        const allPlayers = await Player.find({});
        
        // Overall ranking (by experience/level)
        const overall = allPlayers
            .filter(player => player.level > 1 || player.kills > 0 || player.deaths > 0)
            .sort((a, b) => (b.level || 1) - (a.level || 1) || (b.kills || 0) - (a.kills || 0))
            .slice(0, 50)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                level: player.level || 1,
                experience: player.experience || 0,
                kills: player.kills || 0,
                deaths: player.deaths || 0,
                kd: player.deaths > 0 ? ((player.kills || 0) / player.deaths).toFixed(2) : (player.kills || 0).toFixed(2),
                playtime: formatPlaytime(player.playtime || 0),
                role: player.role || 'player'
            }));

        // PvP Warriors (by kills and K/D)
        const pvp = allPlayers
            .filter(player => player.kills > 0)
            .sort((a, b) => (b.kills || 0) - (a.kills || 0) || 
                           (((b.kills || 0) / Math.max(b.deaths || 1, 1)) - ((a.kills || 0) / Math.max(a.deaths || 1, 1))))
            .slice(0, 50)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                kills: player.kills || 0,
                deaths: player.deaths || 0,
                kd: player.deaths > 0 ? ((player.kills || 0) / player.deaths).toFixed(2) : (player.kills || 0).toFixed(2),
                streak: player.killStreak || 0,
                role: player.role || 'player'
            }));

        // PvE Masters (by blocks destroyed/waves survived)
        const pve = allPlayers
            .filter(player => (player.blocksDestroyed || 0) > 0 || (player.wavesCompleted || 0) > 0)
            .sort((a, b) => (b.blocksDestroyed || 0) - (a.blocksDestroyed || 0) || (b.wavesCompleted || 0) - (a.wavesCompleted || 0))
            .slice(0, 50)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                blocksDestroyed: player.blocksDestroyed || 0,
                wavesCompleted: player.wavesCompleted || 0,
                buildingsPlaced: player.buildingsPlaced || 0,
                role: player.role || 'player'
            }));

        // Wealth ranking (by gold)
        const wealth = allPlayers
            .filter(player => (player.gold || 0) > 0)
            .sort((a, b) => (b.gold || 0) - (a.gold || 0))
            .slice(0, 50)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                gold: player.gold || 0,
                level: player.level || 1,
                role: player.role || 'player'
            }));

        // Achievements (by total playtime and various accomplishments)
        const achievements = allPlayers
            .filter(player => (player.playtime || 0) > 0)
            .sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
            .slice(0, 50)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                playtime: formatPlaytime(player.playtime || 0),
                level: player.level || 1,
                kills: player.kills || 0,
                buildingsPlaced: player.buildingsPlaced || 0,
                role: player.role || 'player'
            }));

        res.json({
            overall,
            pvp,
            pve,
            wealth,
            achievements,
            totalPlayers: allPlayers.length,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching hiscores:', error);
        res.status(500).json({ error: 'Failed to fetch hiscores data' });
    }
});

// Helper function to format playtime
function formatPlaytime(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

// Route based on subdomain
app.get('/', (req, res) => {
    const host = req.get('host') || '';
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // If accessing via pvp.koryenders.com, serve the game directly
    if (host.includes('pvp.')) {
        if (isMobile) {
            res.sendFile(path.join(__dirname, 'index-mobile.html'));
        } else {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    } else {
        // Otherwise serve the landing page (same responsive page for all devices)
        res.sendFile(path.join(__dirname, 'home.html'));
    }
});

// Serve the game when explicitly requested
app.get('/index.html', (req, res) => {
    // Check if request is from a mobile device
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    if (isMobile) {
        res.sendFile(path.join(__dirname, 'index-mobile.html'));
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Serve mobile version explicitly
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-mobile.html'));
});

// Serve specific mobile file route
app.get('/index-mobile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-mobile.html'));
});

// Serve static files
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
// Note: Removed public static to prevent conflicts with explicit routes

// --- Server-authoritative game state ---
const TICK_RATE = 16; // ms (about 60 times per second)
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 2000;
const MAX_TOMATOES = 20; // Maximum number of tomato bullets allowed at once

const BLOCK_TYPES = [
  'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'
];

const gameState = {
  players: {}, // { id: { id, username, x, y, vx, vy, ... } }
  buildings: [], // { type, x, y, owner }
  parties: {}, // { partyName: { name, leader, members, isOpen } }
  sun: {
    elapsed: 0,
    duration: 300, // 5 minutes for a full day/night cycle
    isDay: true
  },
  bullets: {}, // Track active bullets server-side
  weaponShopArea: null // Will be initialized on startup
};

// Server-side weapon configuration
const WEAPON_CONFIG = {
  // Regular weapons (available to all players)
  pistol: { damage: 15, fireRate: 300, magazineSize: 12, reloadTime: 1000, bulletSpeed: 800 },
  shotgun: { damage: 8, fireRate: 900, magazineSize: 6, reloadTime: 1500, bulletSpeed: 600 },
  rifle: { damage: 12, fireRate: 150, magazineSize: 30, reloadTime: 2000, bulletSpeed: 1000 },
  sniper: { damage: 50, fireRate: 2000, magazineSize: 5, reloadTime: 2500, bulletSpeed: 1500 },
  
  // Staff-only weapons
  tomatogun: { damage: 999, fireRate: 1500, magazineSize: 8, reloadTime: 2000, bulletSpeed: 500, staffOnly: true, requiredRoles: ['admin', 'ash', 'owner'] },
  minigun: { damage: 5, fireRate: 50, magazineSize: 150, reloadTime: 5000, bulletSpeed: 1000, staffOnly: true, requiredRoles: ['mod', 'admin', 'ash', 'owner'] },
  
  // Owner-only weapon
  triangun: { damage: 400, fireRate: 50, magazineSize: 4, reloadTime: 2000, bulletSpeed: 1000, staffOnly: true, requiredRoles: ['owner'] }
};

// Function to validate weapon access
function canUseWeapon(weaponType, playerRole) {
  const weaponInfo = WEAPON_CONFIG[weaponType];
  if (!weaponInfo) return false;
  
  if (!weaponInfo.staffOnly) return true;
  
  return weaponInfo.requiredRoles && weaponInfo.requiredRoles.includes(playerRole);
}

// Function to get validated weapon damage
function getValidatedWeaponDamage(weaponType, playerRole) {
  const weaponInfo = WEAPON_CONFIG[weaponType];
  if (!weaponInfo) return 15; // Default pistol damage
  
  if (!canUseWeapon(weaponType, playerRole)) return 15; // Default if not authorized
  
  return weaponInfo.damage;
}

// Spatial grid for efficient collision detection
const GRID_SIZE = 128; // Each grid cell is 128x128 pixels (2x2 blocks)
const spatialGrid = new Map(); // Key: "x,y" string, Value: Set of building indices

function updateSpatialGrid() {
  spatialGrid.clear();
  gameState.buildings.forEach((building, index) => {
    // Buildings are 64x64, so a building can occupy up to 4 grid cells
    const startGridX = Math.floor(building.x / GRID_SIZE);
    const startGridY = Math.floor(building.y / GRID_SIZE);
    const endGridX = Math.floor((building.x + 63) / GRID_SIZE);
    const endGridY = Math.floor((building.y + 63) / GRID_SIZE);
    
    for (let gx = startGridX; gx <= endGridX; gx++) {
      for (let gy = startGridY; gy <= endGridY; gy++) {
        const key = `${gx},${gy}`;
        if (!spatialGrid.has(key)) {
          spatialGrid.set(key, new Set());
        }
        spatialGrid.get(key).add(index);
      }
    }
  });
}

function getNearbyBuildings(x, y, radius = 64) {
  const nearbyIndices = new Set();
  const startGridX = Math.floor((x - radius) / GRID_SIZE);
  const startGridY = Math.floor((y - radius) / GRID_SIZE);
  const endGridX = Math.floor((x + radius) / GRID_SIZE);
  const endGridY = Math.floor((y + radius) / GRID_SIZE);
  
  for (let gx = startGridX; gx <= endGridX; gx++) {
    for (let gy = startGridY; gy <= endGridY; gy++) {
      const key = `${gx},${gy}`;
      const cellBuildings = spatialGrid.get(key);
      if (cellBuildings) {
        cellBuildings.forEach(index => nearbyIndices.add(index));
      }
    }
  }
  
  return Array.from(nearbyIndices).map(i => gameState.buildings[i]).filter(b => b);
}

// Trade system state
const activeTrades = {}; // { tradeId: { player1, player2, offer1, offer2, status, confirmed1, confirmed2 } }
const pendingTradeRequests = {}; // { fromUsername: { to, timestamp } }

// Generate unique trade ID
function generateTradeId() {
  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Load all buildings from MongoDB on server start
(async () => {
  const allBuildings = await Building.find({});
  gameState.buildings = allBuildings.map(b => ({ type: b.type, x: b.x, y: b.y, owner: b.owner }));
  updateSpatialGrid(); // Initialize spatial grid with loaded buildings
  
  // Check if weapon shop exists, if not create it
  const weaponShopX = 0; // Back at original position
  const weaponShopY = 1936 - 128; // 2 blocks high from ground
  const hasWeaponShop = gameState.buildings.some(b => 
    b.x >= weaponShopX && b.x <= weaponShopX + 448 &&
    b.y >= weaponShopY && b.y <= weaponShopY + 128 &&
    b.owner === 'SYSTEM'
  );
  
  if (!hasWeaponShop) {
    console.log('Creating weapon shop area...');
    // No building blocks needed - the gold floor is rendered client-side
    // Store weapon shop area in game state
    gameState.weaponShopArea = {
      x: weaponShopX,
      y: weaponShopY,
      width: 512, // 8 blocks * 64
      height: 192 // 3 blocks * 64
    };
  }
})();

// Add elevator state tracking
const elevatorStates = {};

// --- Game loop ---
setInterval(() => {
  // Update sun state
  gameState.sun.elapsed += TICK_RATE / 1000; // Convert ms to seconds
  if (gameState.sun.elapsed >= gameState.sun.duration) {
    gameState.sun.elapsed = 0;
    gameState.sun.isDay = !gameState.sun.isDay;
  }
  
  // Ban check moved to connection/join events for better performance
  // No need to check every tick

  // --- Update bullets ---
  for (const bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];
    
    // Store the bullet's last valid position for tomatoes
    if (bullet.weaponType === 'tomatogun') {
      bullet.lastX = bullet.x;
      bullet.lastY = bullet.y;
      
      // Check if near any block using spatial grid
      let nearBlock = false;
      let closestDist = Infinity;
      let closestBlock = null;
      
      const nearbyBuildings = getNearbyBuildings(bullet.x, bullet.y, 100);
      for (const building of nearbyBuildings) {
        const dx = Math.abs(bullet.x - (building.x + 32));
        const dy = Math.abs(bullet.y - (building.y + 32));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist < closestDist) {
          nearBlock = true;
          closestDist = dist;
          closestBlock = building;
        }
      }
      
      if (nearBlock && closestBlock) {
        bullet.nearBlockX = closestBlock.x + 32;
        bullet.nearBlockY = closestBlock.y + 32;
      }
      bullet.wasNearBlock = nearBlock || bullet.wasNearBlock;
    }
    
    // Apply heat-seeking for tomato bullets
    if (bullet.weaponType === 'tomatogun' && bullet.targetX !== undefined && bullet.targetY !== undefined) {
      // Calculate angle to target
      const angleToTarget = Math.atan2(bullet.targetY - bullet.y, bullet.targetX - bullet.x);
      const currentAngle = Math.atan2(bullet.vy, bullet.vx);
      
      // Calculate angle difference
      let angleDiff = angleToTarget - currentAngle;
      
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      // Apply turn rate limit
      const turnAmount = Math.max(-bullet.maxTurnRate, Math.min(bullet.maxTurnRate, angleDiff));
      
      // Calculate new velocity direction
      const newAngle = currentAngle + turnAmount;
      const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
      
      // Apply new direction
      bullet.vx = Math.cos(newAngle) * speed;
      bullet.vy = Math.sin(newAngle) * speed;
      
      // Add acceleration towards target
      const dx = bullet.targetX - bullet.x;
      const dy = bullet.targetY - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 50) { // Only home if not too close
        bullet.vx += (dx / distance) * bullet.homingStrength * (TICK_RATE / 1000);
        bullet.vy += (dy / distance) * bullet.homingStrength * (TICK_RATE / 1000);
      }
    }
    
    // Apply gravity to tomato bullets
    if (bullet.gravity) {
      bullet.vy += bullet.gravity * (TICK_RATE / 1000);
    }
    
    // Update bullet position
    const prevX = bullet.x;
    const prevY = bullet.y;
    bullet.x += bullet.vx * (TICK_RATE / 1000);
    bullet.y += bullet.vy * (TICK_RATE / 1000);
    
    // No longer need to track distance - using time delay instead
    
    // Check ground collision for tomatoes FIRST (before bounds check)
    const groundY = WORLD_HEIGHT - 64; // 1936
    const isArmed = Date.now() - bullet.createdAt >= bullet.armingDelay;
    if (bullet.weaponType === 'tomatogun' && bullet.y >= groundY && isArmed) {
      // Only explode if armed
      // Tomato hit ground
      
      // Calculate where the tomato actually hit the ground
      let groundImpactX = bullet.x;
      if (prevY < groundY) {
        // Calculate how far through the frame the collision occurred
        const t = (groundY - prevY) / (bullet.y - prevY);
        groundImpactX = bullet.x - bullet.vx * (TICK_RATE / 1000) * (1 - t);
      }
      
      // Handle explosion damage server-side
      handleTomatoExplosion(groundImpactX, groundY, 192, 60, bullet.ownerId); // 60 damage = 2 hits to kill
      
      // Notify clients about the visual explosion
      io.emit('tomatoExploded', {
        x: groundImpactX,
        y: groundY,
        radius: 192,
        damage: bullet.damage * 0.5,
        ownerId: bullet.ownerId
      });
      
      // Destroy the bullet
      delete gameState.bullets[bulletId];
      io.emit('bulletDestroyed', { bulletId });
      continue;
    }
    
    // Check world bounds
    if (bullet.x < -100 || bullet.x > WORLD_WIDTH + 100 || bullet.y < -100 || bullet.y > WORLD_HEIGHT + 100) {
      // Debug log when bullet goes out of bounds
      if (bullet.weaponType === 'tomatogun') {
        // Tomato out of bounds
      }
      delete gameState.bullets[bulletId];
      io.emit('bulletDestroyed', { bulletId });
      continue;
    }
    
    // Track if we need to force an explosion for this tomato
    let forceExplosion = false;
    let explosionX = bullet.x;
    let explosionY = bullet.y;
    
    // Check building collisions with better detection
    let hitBuilding = false;
    let impactX = bullet.x;
    let impactY = bullet.y;
    
    // Use the prevX and prevY we already calculated above
    const bulletPrevX = prevX;
    const bulletPrevY = prevY;
    
    // Only log every 10th frame to reduce spam
    if (bullet.weaponType === 'tomatogun' && Math.random() < 0.1) {
      // Tomato position tracking
    }
    
    // Use spatial grid to only check nearby buildings
    const nearbyBuildings = getNearbyBuildings(bullet.x, bullet.y, 100); // 100px radius for bullets
    for (const building of nearbyBuildings) {
      const blockLeft = building.x;
      const blockRight = building.x + 64;
      const blockTop = building.y;
      const blockBottom = building.y + 64;
      
      // Simple collision check with more precise bullet size
      const bulletSize = bullet.weaponType === 'tomatogun' ? 8 : 4; // Very small size for precise shooting
      const bulletLeft = bullet.x - bulletSize;
      const bulletRight = bullet.x + bulletSize;
      const bulletTop = bullet.y - bulletSize;
      const bulletBottom = bullet.y + bulletSize;
      
      // Check if bullet overlaps block
      const overlaps = !(bulletRight < blockLeft || bulletLeft > blockRight || 
                        bulletBottom < blockTop || bulletTop > blockBottom);
      
      // For heat-seeking tomatoes, also check if we're passing very close to edges
      let nearMiss = false;
      if (bullet.weaponType === 'tomatogun' && !overlaps) {
        const edgeThreshold = 8; // Much smaller threshold to allow shots through gaps
        
        // Check if bullet is passing close to any edge with more lenient overlap checks
        const distLeft = Math.abs(bulletRight - blockLeft);
        const distRight = Math.abs(bulletLeft - blockRight);
        const distTop = Math.abs(bulletBottom - blockTop);
        const distBottom = Math.abs(bulletTop - blockBottom);
        
        // Stricter overlap checks to prevent false positives in gaps
        const verticalOverlap = bulletBottom >= blockTop + 5 && bulletTop <= blockBottom - 5;
        // Stricter horizontal overlap check for vertical edges
        const horizontalOverlap = bulletRight >= blockLeft + 5 && bulletLeft <= blockRight - 5;
        
        const randomOffset = () => (Math.random() - 0.5) * 8;
        const edgeOffset = 6;
        
        if (distLeft < edgeThreshold && verticalOverlap) {
          nearMiss = true;
          impactX = blockLeft + edgeOffset + randomOffset();
          impactY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, bullet.y)) + randomOffset();
          // Near hit on left edge
        }
        else if (distRight < edgeThreshold && verticalOverlap) {
          nearMiss = true;
          impactX = blockRight - edgeOffset + randomOffset();
          impactY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, bullet.y)) + randomOffset();
          // Near hit on right edge
        }
        else if (distTop < edgeThreshold && horizontalOverlap) {
          nearMiss = true;
          impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
          impactY = blockTop + edgeOffset + randomOffset();
          // Near hit on top edge
        }
        else if (distBottom < edgeThreshold && horizontalOverlap) {
          nearMiss = true;
          impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
          impactY = blockBottom - edgeOffset + randomOffset();
          // Near hit on bottom edge
        }
      }
      
      // Check collision - tomatoes need to be armed first
      const isArmed = Date.now() - bullet.createdAt >= bullet.armingDelay;
      if ((overlaps || nearMiss) && (bullet.weaponType !== 'tomatogun' || isArmed)) {
        if (bullet.weaponType === 'tomatogun') {
          if (overlaps || nearMiss) {
            // Tomato collision detected
            
            // Calculate impact point based on velocity and previous position
            if (bullet.vx !== 0 || bullet.vy !== 0) {
              // Determine which edge was hit based on bullet position relative to block
              let hitLeft = false, hitRight = false, hitTop = false, hitBottom = false;
              
              // Calculate distances to each edge
              const distToLeft = Math.abs(bullet.x - blockLeft);
              const distToRight = Math.abs(bullet.x - blockRight);
              const distToTop = Math.abs(bullet.y - blockTop);
              const distToBottom = Math.abs(bullet.y - blockBottom);
              
              // Find the closest edge(s)
              const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
              
              // Check which edge we're closest to and if we're moving towards it
              if (distToLeft === minDist && bullet.vx > 0) {
                hitLeft = true;
              } else if (distToRight === minDist && bullet.vx < 0) {
                hitRight = true;
              } else if (distToTop === minDist && bullet.vy > 0) {
                hitTop = true;
              } else if (distToBottom === minDist && bullet.vy < 0) {
                hitBottom = true;
              }
              
              // If no clear edge hit, determine based on velocity direction
              if (!hitLeft && !hitRight && !hitTop && !hitBottom) {
                if (Math.abs(bullet.vx) > Math.abs(bullet.vy)) {
                  // Horizontal movement dominant
                  if (bullet.vx > 0) hitLeft = true;
                  else hitRight = true;
                } else {
                  // Vertical movement dominant
                  if (bullet.vy > 0) hitTop = true;
                  else hitBottom = true;
                }
              }
              
              // Calculate exact impact point with slight offset from edges for natural splats
              const edgeOffset = 6; // Offset to prevent exact edge snapping
              const randomOffset = () => (Math.random() - 0.5) * 8; // Add some randomness
              
              if (hitLeft) {
                impactX = blockLeft + edgeOffset + randomOffset();
                const t = (blockLeft - bulletPrevX) / bullet.vx;
                impactY = bulletPrevY + t * bullet.vy;
                // Clamp Y to block bounds with some variance
                impactY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, impactY)) + randomOffset();
              } else if (hitRight) {
                impactX = blockRight - edgeOffset + randomOffset();
                const t = (blockRight - bulletPrevX) / bullet.vx;
                impactY = bulletPrevY + t * bullet.vy;
                // Clamp Y to block bounds with some variance
                impactY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, impactY)) + randomOffset();
              } else if (hitTop) {
                impactY = blockTop + edgeOffset + randomOffset();
                const t = (blockTop - bulletPrevY) / bullet.vy;
                impactX = bulletPrevX + t * bullet.vx;
                // Clamp X to block bounds with some variance
                impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, impactX)) + randomOffset();
              } else if (hitBottom) {
                impactY = blockBottom - edgeOffset + randomOffset();
                const t = (blockBottom - bulletPrevY) / bullet.vy;
                impactX = bulletPrevX + t * bullet.vx;
                // Clamp X to block bounds with some variance
                impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, impactX)) + randomOffset();
              } else {
                // Fallback - use actual bullet position with slight randomness
                impactX = bullet.x + randomOffset();
                impactY = bullet.y + randomOffset();
              }
            }
          }
          
          // Store the impact point in the bullet for the destroy function
          bullet.finalImpactX = impactX;
          bullet.finalImpactY = impactY;
        }
        hitBuilding = true;
        break;
      }
      
      // Skip complex collision for now - we already detected hit with simple overlap
    }
    
    if (hitBuilding) {
      if (bullet.weaponType === 'tomatogun') {
        // Let destroyBullet handle the explosion
        destroyBullet(bulletId, true);
      } else {
        delete gameState.bullets[bulletId];
        io.emit('bulletDestroyed', { bulletId });
      }
      continue;
    }
    
    
    // Check player collisions with improved hitbox
    for (const playerId in gameState.players) {
      if (playerId === bullet.ownerId) continue; // Skip owner
      
      const player = gameState.players[playerId];
      if (player.isDead) continue;
      
      // Check if both players are in the same party (friendly fire protection)
      const shooter = gameState.players[bullet.ownerId];
      if (shooter && shooter.party && player.party && shooter.party === player.party) {
        continue; // Skip party members - no friendly fire
      }
      
      // Full player hitbox including head
      const playerWidth = 32; // Stickman width
      const playerHeight = 64; // Full stickman height including head
      const playerLeft = player.x - playerWidth / 2;
      const playerRight = player.x + playerWidth / 2;
      const playerTop = player.y - playerHeight; // Full height from feet
      const playerBottom = player.y;
      
      // Head area (top 20% of player)
      const headTop = playerTop;
      const headBottom = playerTop + (playerHeight * 0.2);
      
      // Check if bullet hits player with some tolerance
      const bulletRadius = 4; // Small radius for bullet
      if (bullet.x + bulletRadius >= playerLeft && bullet.x - bulletRadius <= playerRight &&
          bullet.y + bulletRadius >= playerTop && bullet.y - bulletRadius <= playerBottom) {
        
        // Double-check this is a valid hit
        const distance = Math.sqrt(
          Math.pow(bullet.x - player.x, 2) + 
          Math.pow(bullet.y - (player.y - playerHeight/2), 2)
        );
        
        // Only register hit if within reasonable distance
        if (distance < 50) { // Slightly increased for full hitbox
          // Check if it's a headshot
          const isHeadshot = bullet.y >= headTop && bullet.y <= headBottom;
          const damageMultiplier = isHeadshot ? 2.0 : 1.0; // 2x damage for headshots
          const actualDamage = Math.floor(bullet.damage * damageMultiplier);
          
          // Apply damage
          player.health = Math.max(0, player.health - actualDamage);
          
          // Track damage stats
          player.stats = player.stats || {};
          player.stats.damageTaken = (player.stats.damageTaken || 0) + actualDamage;
          
          const attacker = gameState.players[bullet.ownerId];
          if (attacker) {
            attacker.stats = attacker.stats || {};
            attacker.stats.damageDealt = (attacker.stats.damageDealt || 0) + actualDamage;
            attacker.stats.shotsHit = (attacker.stats.shotsHit || 0) + 1;
            
            // Update damage stats in database
            Player.updateOne(
              { username: attacker.username },
              { $inc: { 'stats.damageDealt': actualDamage, 'stats.shotsHit': 1 } }
            ).catch(err => console.error('[DB] Error updating attacker damage stats:', err));
          }
          
          Player.updateOne(
            { username: player.username },
            { $inc: { 'stats.damageTaken': actualDamage } }
          ).catch(err => console.error('[DB] Error updating victim damage stats:', err));
          
          // Bullet hit player
          
          // Check if player died
          if (player.health <= 0 && !player.isDead) {
            player.isDead = true;
            // Player died
            
            // Get killer information
            const killer = gameState.players[bullet.ownerId];
            if (killer) {
              // Update killer stats
              killer.stats = killer.stats || {};
              killer.stats.kills = (killer.stats.kills || 0) + 1;
              killer.stats.currentKillStreak = (killer.stats.currentKillStreak || 0) + 1;
              if (killer.stats.currentKillStreak > (killer.stats.longestKillStreak || 0)) {
                killer.stats.longestKillStreak = killer.stats.currentKillStreak;
              }
              if (isHeadshot) {
                killer.stats.headshots = (killer.stats.headshots || 0) + 1;
              }
              
              // Updated killer stats
              
              // Update victim stats
              player.stats = player.stats || {};
              player.stats.deaths = (player.stats.deaths || 0) + 1;
              player.stats.currentKillStreak = 0;
              
              // Updated victim stats
              
              // Save stats to database
              Player.updateOne(
                { username: killer.username },
                { $inc: { 'stats.kills': 1, 'stats.headshots': isHeadshot ? 1 : 0 },
                  $set: { 'stats.currentKillStreak': killer.stats.currentKillStreak,
                          'stats.longestKillStreak': killer.stats.longestKillStreak } }
              ).catch(err => console.error('[DB] Error updating killer stats:', err));
              
              Player.updateOne(
                { username: player.username },
                { $inc: { 'stats.deaths': 1 },
                  $set: { 'stats.currentKillStreak': 0 } }
              ).catch(err => console.error('[DB] Error updating victim stats:', err));
              
              // Send log to GUI
              const killMsg = isHeadshot ? 
                `${killer.username} headshot ${player.username}!` : 
                `${killer.username} killed ${player.username}`;
              sendLogToGui(killMsg, 'info');
              
              // Emit kill event to all clients with stats
              io.emit('playerKill', {
                killerName: killer.username,
                killerRole: killer.role || 'player',
                victimName: player.username,
                victimRole: player.role || 'player',
                isHeadshot: isHeadshot,
                killerStats: killer.stats,
                victimStats: player.stats
              });
              
              // Update achievements for killer
              achievementManager.checkAchievement(killer.username, {
                type: 'playerKill',
                playerId: killer.username
              }).then(unlocked => {
                if (unlocked.length > 0) {
                  const killerSocket = io.sockets.sockets.get(killerId);
                  if (killerSocket) {
                    killerSocket.emit('achievementsUnlocked', unlocked);
                  }
                }
              }).catch(err => {
                console.error('[ACHIEVEMENT] Error checking killer achievements:', err);
              });
              
              // Update achievements for victim (deaths)
              achievementManager.checkAchievement(player.username, {
                type: 'death',
                playerId: player.username
              }).then(unlocked => {
                if (unlocked.length > 0) {
                  io.to(playerId).emit('achievementsUnlocked', unlocked);
                }
              }).catch(err => {
                console.error('[ACHIEVEMENT] Error checking death achievements:', err);
              });
            }
            
            // Respawn after 3 seconds
            setTimeout(() => {
              if (gameState.players[playerId]) {
                player.health = player.maxHealth;
                player.isDead = false;
                player.x = 100;
                player.y = 1800;
                io.to(playerId).emit('respawn', { x: player.x, y: player.y });
                // Player respawned
              }
            }, 3000);
          }
          
          // Notify all clients about the damage
          io.emit('playerDamaged', { 
            targetId: playerId, 
            damage: actualDamage, 
            bulletX: bullet.x, 
            bulletY: bullet.y, 
            bulletId: bulletId,
            health: player.health,
            maxHealth: player.maxHealth,
            isHeadshot: isHeadshot
          });
          
          // If it's a tomato, trigger explosion at hit location
          if (bullet.weaponType === 'tomatogun') {
            // Use the actual collision point for explosion
            const explosionX = bullet.x;
            const explosionY = bullet.y;
            
            // Handle explosion damage server-side
            handleTomatoExplosion(explosionX, explosionY, 192, 60, bullet.ownerId); // 60 damage = 2 hits to kill
            
            // Notify clients about the visual explosion
            io.emit('tomatoExploded', {
              x: explosionX,
              y: explosionY,
              radius: 192,
              damage: bullet.damage * 0.5,
              ownerId: bullet.ownerId
            });
          }
          
          // Remove bullet (force explosion for tomatoes)
          destroyBullet(bulletId, bullet.weaponType === 'tomatogun');
          break;
        }
      }
    }
    
  }

  // --- Physics update for all players ---
  for (const id in gameState.players) {
    const player = gameState.players[id];
    // Gravity (skip if on elevator)
    if (!player.onElevator) {
      player.vy += 0.5;
    }
    // Store previous position for movement tracking
    const prevX = player.x;
    const prevY = player.y;
    
    // Move
    player.x += player.vx;
    player.y += player.vy;
    
    // Track movement distance for achievements
    if (!player.isDead && (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1)) {
      const distance = Math.sqrt(Math.pow(player.x - prevX, 2) + Math.pow(player.y - prevY, 2));
      
      // Only count meaningful movement (not tiny adjustments)
      if (distance > 0.5 && distance < 50) { // Sanity check for reasonable movement
        if (!player.movementCheck) {
          player.movementCheck = { lastCheck: Date.now(), totalDistance: 0 };
        }
        
        player.movementCheck.totalDistance += distance;
        
        // Check achievements every 2 seconds to avoid spam
        const now = Date.now();
        if (now - player.movementCheck.lastCheck > 2000 && player.movementCheck.totalDistance > 5) {
          // Convert totalDistance (pixels) to blocks (1 block = 64px)
          const blocksMoved = player.movementCheck.totalDistance / 64;
          achievementManager.checkAchievement(player.username, {
            type: 'movement',
            blocks: blocksMoved,
            playerId: player.username
          }).then(unlocked => {
            if (unlocked.length > 0) {
              const socket = findSocketByUsername(player.username);
              if (socket) {
                socket.emit('achievementsUnlocked', unlocked);
              }
            }
          }).catch(err => {
            console.error('[ACHIEVEMENT] Error checking movement achievements:', err);
          });
          
          // Reset for next check
          player.movementCheck.lastCheck = now;
          player.movementCheck.totalDistance = 0;
        }
      }
    }

    // Check building collisions (Phaser Arcade Physics style)
    const playerWidth = 32;
    const playerHeight = 64; // Match client hitbox size
    const playerLeft = player.x - playerWidth / 2;
    const playerRight = player.x + playerWidth / 2;
    const playerBottom = player.y;
    const playerTop = player.y - playerHeight;

    let onGround = false;

    for (const building of gameState.buildings) {
      const blockLeft = building.x;
      const blockRight = building.x + 64;
      const blockTop = building.y;
      const blockBottom = building.y + 64;

      // Only check solid blocks (door is now walkable)
      if ([
        'wall', 'castle_tower', 'tunnel', 'roof', 'wood', 'gold', 'brick'
      ].includes(building.type)) {
        // Check for overlap
        if (
          playerRight > blockLeft &&
          playerLeft < blockRight &&
          playerBottom > blockTop &&
          playerTop < blockBottom
        ) {
          // Calculate overlap on each side
          const overlapLeft = playerRight - blockLeft;
          const overlapRight = blockRight - playerLeft;
          const overlapTop = playerBottom - blockTop;
          const overlapBottom = blockBottom - playerTop;
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapTop) {
            // Land on top of block
            player.y = blockTop;
            player.vy = 0;
            onGround = true;
          } else if (minOverlap === overlapBottom) {
            // Hit head on block
            player.y = blockBottom + playerHeight;
            player.vy = 0;
          } else if (minOverlap === overlapLeft) {
            // Hit left side
            player.x = blockLeft - playerWidth / 2;
            player.vx = 0;
          } else if (minOverlap === overlapRight) {
            // Hit right side
            player.x = blockRight + playerWidth / 2;
            player.vx = 0;
          }
        }
      }
    }

    // Ground collision
    if (player.y > 1936) {
      player.y = 1936;
      player.vy = 0;
      onGround = true;
    }

    // World bounds
    if (player.x < 0) { player.x = 0; }
    if (player.x > WORLD_WIDTH) { player.x = WORLD_WIDTH; }
    
    // Check weapon shop zone
    if (gameState.weaponShopArea) {
      const wasInShop = player.wasInWeaponShop || false;
      const shopArea = gameState.weaponShopArea;
      const isInShop = player.x >= shopArea.x && 
                       player.x <= shopArea.x + shopArea.width &&
                       player.y >= shopArea.y - 64 && // Allow some height above ground
                       player.y <= shopArea.y + shopArea.height;
      
      if (isInShop && !wasInShop) {
        // Player entered shop
        player.wasInWeaponShop = true;
        io.to(id).emit('enteredWeaponShop', {
          role: player.role
        });
      } else if (!isInShop && wasInShop) {
        // Player left shop
        player.wasInWeaponShop = false;
        io.to(id).emit('leftWeaponShop');
      }
    }
  }

  // --- Broadcast world state ---
  const playersWithRole = {};
  for (const id in gameState.players) {
    const p = gameState.players[id];
    playersWithRole[id] = { 
      ...p, 
      role: p.role || 'player',
      weaponType: p.currentWeapon || 'pistol', // Include weapon type in world state
      stats: p.stats || {}, // Explicitly include stats to ensure they're sent
      isDead: p.isDead || false // Include death state for visual feedback
    };
  }
  io.emit('worldState', { 
    players: playersWithRole, 
    buildings: gameState.buildings,
    sun: gameState.sun,
    bullets: gameState.bullets,
    weaponShopArea: gameState.weaponShopArea 
  });
}, TICK_RATE);

// Maintain a ban list in memory for faster checking
const bannedUsers = new Set();

// Load banned users on startup
(async () => {
  const banned = await Player.find({ banned: true }, 'username');
  banned.forEach(p => bannedUsers.add(p.username));
  console.log(`Loaded ${bannedUsers.size} banned users`);
})();

// --- Socket.io handlers ---
// Helper function to safely destroy a bullet
function destroyBullet(bulletId, forceExplode = false) {
  const bullet = gameState.bullets[bulletId];
  if (!bullet) return;
  
  // For tomato bullets, ALWAYS explode and leave a splat
  if (bullet.weaponType === 'tomatogun' && bullet.createdAt) {
    // Check if the bullet is armed
    const timeSinceCreation = Date.now() - bullet.createdAt;
    const isArmed = timeSinceCreation >= bullet.armingDelay;
    
    if (!isArmed) {
      console.log(`[TOMATO DISARMED] Tomato destroyed before arming (${timeSinceCreation}ms < ${bullet.armingDelay}ms)`);
      delete gameState.bullets[bulletId];
      io.emit('bulletDestroyed', { bulletId });
      return;
    }
    
    // Calculate the best explosion point
    let explodeX = bullet.x;
    let explodeY = bullet.y;
    
    // If we have a nearby block, use that for positioning
    if (bullet.nearBlockX !== undefined && bullet.nearBlockY !== undefined) {
      // Find the closest edge of the block
      const blockCenterX = bullet.nearBlockX;
      const blockCenterY = bullet.nearBlockY;
      const blockLeft = blockCenterX - 32;
      const blockRight = blockCenterX + 32;
      const blockTop = blockCenterY - 32;
      const blockBottom = blockCenterY + 32;
      
      // Calculate distances to each edge
      const distToLeft = Math.abs(bullet.x - blockLeft);
      const distToRight = Math.abs(bullet.x - blockRight);
      const distToTop = Math.abs(bullet.y - blockTop);
      const distToBottom = Math.abs(bullet.y - blockBottom);
      
      // Add some randomness to make splats look more natural
      const edgeOffset = 6;
      const randomOffset = () => (Math.random() - 0.5) * 8;
      
      // Find the closest edge and position the splat there
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      if (minDist === distToLeft) {
        explodeX = blockLeft + edgeOffset + randomOffset();
        explodeY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, bullet.y)) + randomOffset();
      } else if (minDist === distToRight) {
        explodeX = blockRight - edgeOffset + randomOffset();
        explodeY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, bullet.y)) + randomOffset();
      } else if (minDist === distToTop) {
        explodeX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
        explodeY = blockTop + edgeOffset + randomOffset();
      } else {
        explodeX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
        explodeY = blockBottom - edgeOffset + randomOffset();
      }
    } else if (bullet.finalImpactX !== undefined && bullet.finalImpactY !== undefined) {
      // Use the stored impact point if we have it
      explodeX = bullet.finalImpactX;
      explodeY = bullet.finalImpactY;
    } else if (bullet.lastX !== undefined && bullet.lastY !== undefined) {
      // Use the last known position if we have it
      explodeX = bullet.lastX;
      explodeY = bullet.lastY;
    }
    
    // Tomato explosion at location
    
    handleTomatoExplosion(explodeX, explodeY, 192, 60, bullet.ownerId); // 60 damage = 2 hits to kill
    io.emit('tomatoExploded', {
      x: explodeX,
      y: explodeY,
      radius: 192,
      damage: bullet.damage * 0.5,
      ownerId: bullet.ownerId
    });
  }
  
  delete gameState.bullets[bulletId];
  io.emit('bulletDestroyed', { bulletId });
}

// Socket.IO middleware for rate limiting
io.use((socket, next) => {
  const clientIP = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
  
  // Create a simple rate limiter for socket connections
  if (!global.socketRateLimiter) {
    global.socketRateLimiter = new Map();
  }
  
  const now = Date.now();
  const connectionKey = `${clientIP}_connections`;
  const connections = global.socketRateLimiter.get(connectionKey) || [];
  
  // Clean old connections (older than 1 minute)
  const recentConnections = connections.filter(time => now - time < 60000);
  
  // Check if too many connections
  if (recentConnections.length >= 10) { // Max 10 connections per minute per IP
    return next(new Error('Too many connection attempts. Please wait before reconnecting.'));
  }
  
  // Add this connection
  recentConnections.push(now);
  global.socketRateLimiter.set(connectionKey, recentConnections);
  
  next();
});

// Party system functions
function createParty(socket, player, partyName) {
  if (!partyName) {
    socket.emit('commandResult', { message: 'Usage: /party create [name]' });
    socket.emit('partyError', { message: 'Please provide a party name.' });
    return;
  }
  
  if (player.party) {
    socket.emit('commandResult', { message: 'You are already in a party. Leave it first.' });
    socket.emit('partyError', { message: 'You are already in a party. Leave it first.' });
    return;
  }
  
  if (gameState.parties[partyName]) {
    socket.emit('commandResult', { message: 'A party with that name already exists.' });
    socket.emit('partyError', { message: 'A party with that name already exists.' });
    return;
  }
  
  gameState.parties[partyName] = {
    name: partyName,
    leader: player.username,
    members: [player.username],
    isOpen: true
  };
  
  player.party = partyName;
  socket.emit('commandResult', { message: `Party '${partyName}' created!` });
  socket.emit('partyUpdate', { party: gameState.parties[partyName] });
  socket.emit('partyCreated', { partyName });
  
  // Notify all players to update party list
  io.emit('partyListUpdate');
}

function joinParty(socket, player, partyName) {
  if (!partyName) {
    socket.emit('commandResult', { message: 'Usage: /party join [name]' });
    return;
  }
  
  if (player.party) {
    socket.emit('commandResult', { message: 'You are already in a party. Leave it first.' });
    return;
  }
  
  const party = gameState.parties[partyName];
  if (!party) {
    socket.emit('commandResult', { message: `Party '${partyName}' not found.` });
    return;
  }
  
  if (!party.isOpen) {
    socket.emit('commandResult', { message: 'This party is closed to new members.' });
    return;
  }
  
  party.members.push(player.username);
  player.party = partyName;
  
  socket.emit('commandResult', { message: `Joined party '${partyName}'!` });
  socket.emit('partyJoined', { partyName });
  
  // Notify all party members
  party.members.forEach(memberName => {
    const memberSocket = findSocketByUsername(memberName);
    if (memberSocket) {
      memberSocket.emit('partyUpdate', { party });
      if (memberName !== player.username) {
        memberSocket.emit('serverAnnouncement', { 
          message: `${player.username} joined the party.`,
          type: 'info'
        });
      }
    }
  });
}

function leaveParty(socket, player) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) return;
  
  party.members = party.members.filter(u => u !== player.username);
  const wasLeader = party.leader === player.username;
  
  // Notify remaining members
  party.members.forEach(memberName => {
    const memberSocket = findSocketByUsername(memberName);
    if (memberSocket) {
      memberSocket.emit('serverAnnouncement', { 
        message: `${player.username} left the party.`,
        type: 'info'
      });
    }
  });
  
  // If leader left or party empty, disband
  if (party.members.length === 0 || wasLeader) {
    party.members.forEach(memberName => {
      const member = findPlayerByUsername(memberName);
      if (member) member.party = null;
      const memberSocket = findSocketByUsername(memberName);
      if (memberSocket) {
        memberSocket.emit('partyUpdate', { party: null });
        memberSocket.emit('serverAnnouncement', { 
          message: 'Party disbanded.',
          type: 'warning'
        });
      }
    });
    delete gameState.parties[player.party];
  } else {
    // Assign new leader
    party.leader = party.members[0];
    party.members.forEach(memberName => {
      const memberSocket = findSocketByUsername(memberName);
      if (memberSocket) {
        memberSocket.emit('partyUpdate', { party });
        memberSocket.emit('serverAnnouncement', { 
          message: `${party.leader} is now the party leader.`,
          type: 'info'
        });
      }
    });
  }
  
  player.party = null;
  socket.emit('partyUpdate', { party: null });
  socket.emit('commandResult', { message: 'You left the party.' });
  socket.emit('partyLeft');
  
  // Notify all players to update party list
  io.emit('partyListUpdate');
}

function listParty(socket, player) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) return;
  
  const memberList = party.members.join(', ');
  socket.emit('commandResult', { 
    message: `Party '${party.name}': ${memberList} (Leader: ${party.leader})`
  });
}

function findSocketByUsername(username) {
  for (const [socketId, socket] of io.sockets.sockets) {
    const player = gameState.players[socketId];
    if (player && player.username === username) {
      return socket;
    }
  }
  return null;
}

function findPlayerByUsername(username) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player && player.username === username) {
      return player;
    }
  }
  return null;
}

io.on('connection', async (socket) => {
  // Store username on socket for ban checking
  socket.username = null;
  
  // Middleware to check ban status
  socket.use(async ([event, ...args], next) => {
    // Skip ban check for initial connection events
    if (event === 'verifyLogin' || event === 'disconnect') {
      return next();
    }
    
    // Check if user is banned
    if (socket.username && bannedUsers.has(socket.username)) {
      console.log(`[BAN MIDDLEWARE] Blocked banned user '${socket.username}' from event: ${event}`);
      socket.emit('loginError', { message: 'You are banned from this server!' });
      socket.disconnect(true);
      return;
    }
    
    next();
  });
  
  // Handle login verification (doesn't broadcast join)
  // Handle ping/pong for latency monitoring
  socket.on('ping', () => {
    socket.emit('pong', Date.now());
  });

  socket.on('verifyLogin', async ({ username }) => {
    const usernameLower = username.toLowerCase();
    console.log(`[VERIFY LOGIN] Checking login for '${usernameLower}'`);
    
    // Store username on socket
    socket.username = usernameLower;
    
    // Check if already logged in using activeUsernames map
    if (activeUsernames.has(usernameLower)) {
      const existingSocketId = activeUsernames.get(usernameLower);
      console.log(`[MULTI-LOGIN BLOCKED] User '${usernameLower}' tried to login but already active with socket ${existingSocketId}`);
      
      // Check if the existing socket is still connected
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket && existingSocket.connected) {
        // Block this login attempt
        socket.emit('loginError', { message: 'This account is already logged in!' });
        socket.disconnect(true);
        return;
      } else {
        // The old socket is gone, clean it up
        console.log(`[MULTI-LOGIN] Cleaning up stale socket ${existingSocketId} for user '${usernameLower}'`);
        activeUsernames.delete(usernameLower);
      }
    }
    
    // Don't reserve username here - wait for actual join
    console.log(`[LOGIN VERIFIED] Username '${usernameLower}' verified for socket ${socket.id}`);
    
    // Check if banned
    const playerDoc = await Player.findOne({ username: usernameLower });
    if (playerDoc && playerDoc.banned) {
      console.log(`[BAN CHECK] Blocked banned user '${usernameLower}' from logging in`);
      
      // Add to in-memory ban list if not already there
      bannedUsers.add(usernameLower);
      
      // Remove from activeUsernames since they can't login
      activeUsernames.delete(usernameLower);
      
      socket.emit('loginError', { message: 'You are banned from this server!' });
      
      // Force disconnect multiple times to ensure it takes effect
      socket.disconnect(true);
      setTimeout(() => {
        if (socket.connected) {
          socket.disconnect(true);
        }
      }, 100);
      
      // Remove from any game state
      delete gameState.players[socket.id];
      
      return;
    }
    
    // Send back world state to confirm login is valid
    socket.emit('worldState', {
      players: gameState.players,
      buildings: gameState.buildings,
      sun: gameState.sun,
      weaponShopArea: gameState.weaponShopArea
    });
  });

  // Add player to game state
  socket.on('join', async ({ username, preferredWeapon }) => {
    const usernameLower = username.toLowerCase();
    
    // Check ban list first (fastest check)
    if (bannedUsers.has(usernameLower)) {
      console.log(`[BAN CHECK JOIN] Blocked banned user '${usernameLower}' from joining`);
      socket.emit('loginError', { message: 'You are banned from this server!' });
      socket.disconnect(true);
      return;
    }
    
    // Check activeUsernames to prevent multiple logins
    if (activeUsernames.has(usernameLower)) {
      const existingSocketId = activeUsernames.get(usernameLower);
      console.log(`[MULTI-LOGIN JOIN CHECK] User '${usernameLower}' trying to join, existing socket: ${existingSocketId}, new socket: ${socket.id}`);
      
      // Check if it's a different socket trying to join
      if (existingSocketId !== socket.id) {
        // Check if the existing socket is still connected
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket && existingSocket.connected) {
          console.log(`[MULTI-LOGIN BLOCKED] User '${usernameLower}' blocked from joining - already active`);
          socket.emit('loginError', { message: 'This account is already logged in!' });
          socket.disconnect(true);
          return;
        } else {
          // Clean up stale connection
          console.log(`[MULTI-LOGIN] Cleaning up stale connection for '${usernameLower}'`);
          activeUsernames.delete(usernameLower);
          delete gameState.players[existingSocketId];
        }
      }
    }
    
    // Also check if player is already in gameState (extra safety)
    for (const playerId in gameState.players) {
      if (gameState.players[playerId].username === usernameLower && playerId !== socket.id) {
        console.log(`[MULTI-LOGIN GAMESTATE] User '${usernameLower}' already in game with socket ${playerId}`);
        socket.emit('loginError', { message: 'This account is already logged in!' });
        socket.disconnect(true);
        return;
      }
    }
    
    // Reserve username for this socket
    activeUsernames.set(usernameLower, socket.id);
    console.log(`[JOIN] Username '${usernameLower}' reserved for socket ${socket.id}`);
    // Load player from DB if exists
    let playerDoc = await Player.findOne({ username: usernameLower });
    if (!playerDoc) {
      // Should not happen, but fallback
      playerDoc = new Player({ username: usernameLower, passwordHash: '' });
      await playerDoc.save();
    }
    
    // Check if banned
    if (playerDoc.banned) {
      console.log(`[BAN CHECK] Blocked banned user '${usernameLower}' from joining`);
      // Clean up activeUsernames
      if (activeUsernames.get(usernameLower) === socket.id) {
        activeUsernames.delete(usernameLower);
      }
      socket.emit('loginError', { message: 'You are banned from this server!' });
      socket.disconnect();
      return;
    }
    // Initialize player with complete state
    const playerState = {
      id: socket.id,
      username: usernameLower,
      x: playerDoc.x || 100, // Default spawn position if not set
      y: playerDoc.y || 1800, // Default spawn position if not set
      vx: 0,
      vy: 0,
      inventory: playerDoc.inventory || [],
      stats: {
        health: 100,
        maxHealth: 100,
        attack: 10,
        defense: 5,
        kills: 0,
        deaths: 0,
        headshots: 0,
        damageDealt: 0,
        damageTaken: 0,
        shotsHit: 0,
        shotsFired: 0,
        blocksPlaced: 0,
        blocksDestroyed: 0,
        playTime: 0,
        longestKillStreak: 0,
        currentKillStreak: 0,
        ...(playerDoc.stats || {}) // Merge with existing stats from database
      },
      role: playerDoc.role || 'player',
      buildingOrder: playerDoc.buildingOrder || ['wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'],
      onElevator: false,
      input: null,
      moveSpeed: null,
      jumpHeight: null,
      flyMode: false,
      flySpeed: null,
      health: 100,
      maxHealth: 100,
      currentWeapon: preferredWeapon || playerDoc.currentWeapon || 'pistol',
      weaponLoadout: playerDoc.weaponLoadout || ['pistol', 'rifle'],
      isDead: false,
      sessionStartTime: Date.now(), // Track when this session started
      tutorialCompleted: playerDoc.tutorialCompleted || false,
      aimAngle: 0, // Default aim angle (horizontal)
      gold: playerDoc.gold || 0 // Player's gold currency
    };
    // Add to game state
    gameState.players[socket.id] = playerState;
    
    // Log initial stats
    console.log(`[INITIAL STATE] Sending stats for ${usernameLower}:`, playerState.stats);
    
    // Send initial state to the new player
    socket.emit('initialState', {
      player: playerState,
      world: {
        players: gameState.players,
        buildings: gameState.buildings,
        sun: gameState.sun
      }
    });
    console.log(`[LOGIN] Player '${usernameLower}' connected (socket id: ${socket.id})`);
    
    // Send log to GUI
    sendLogToGui(`Player '${usernameLower}' joined the server (${playerState.role})`, 'info');
    
    // Notify all players including the one who just joined
    // Use a small delay to ensure the client is ready to receive events
    setTimeout(() => {
      io.emit('playerJoined', {
        username: usernameLower,
        role: playerState.role
      });
      
      // Notify GUI of player list update
      sendPlayerListToGui();
    }, 500);
    
    // Initialize achievements for the player
    achievementManager.loadPlayerAchievements(usernameLower).then(() => {
      console.log(`[ACHIEVEMENT] Loaded achievements for ${usernameLower}`);
      
      // Check current gold for economy achievements
      achievementManager.checkAchievement(usernameLower, {
        type: 'playerJoin',
        currentGold: playerState.gold || 0,
        playerId: usernameLower
      }).then(unlocked => {
        if (unlocked.length > 0) {
          socket.emit('achievementsUnlocked', unlocked);
        }
      }).catch(err => {
        console.error('[ACHIEVEMENT] Error checking initial achievements:', err);
      });
    }).catch(err => {
      console.error('[ACHIEVEMENT] Error loading achievements:', err);
    });
  });

  // Handle player input
  socket.on('playerInput', (input) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Update last input time without logging
    player.lastInputTime = Date.now();
    
    // Store input for elevator control
    player.input = input;
    
    // Store aim angle for weapon display
    if (input.aimAngle !== undefined) {
      player.aimAngle = input.aimAngle;
    }
    
    // Don't process movement if player is dead
    if (player.isDead) {
      player.vx = 0;
      player.vy = 0;
      return;
    }
    
    // Use custom speed if set, otherwise default to 4
    const speed = player.moveSpeed ? player.moveSpeed * 0.8 : 4;
    if (input.left) player.vx = -speed;
    else if (input.right) player.vx = speed;
    else player.vx = 0;

    // Handle jumping
    if (input.up) {
      if (player.flyMode) {
        player.vy = -player.flySpeed * 2;
      } else if (!player.onElevator && (player.y >= 1936 || isStandingOnBlock(player, gameState.buildings))) {
        // Check for overhead clearance before jumping
        const playerWidth = 32;
        const playerHeight = 64;
        const playerLeft = player.x - playerWidth / 2;
        const playerRight = player.x + playerWidth / 2;
        const playerTop = player.y - playerHeight;
        
        // Check if there's a block above
        let canJump = true;
        const jumpCheckHeight = 10; // Check 10 pixels above player
        
        for (const building of gameState.buildings) {
          if (['wall', 'castle_tower', 'tunnel', 'roof', 'wood', 'gold', 'brick'].includes(building.type)) {
            const blockLeft = building.x;
            const blockRight = building.x + 64;
            const blockTop = building.y;
            const blockBottom = building.y + 64;
            
            // Check if block is directly above player
            if (playerRight > blockLeft && playerLeft < blockRight) {
              // Check if block is close enough to prevent jumping
              if (blockBottom > playerTop - jumpCheckHeight && blockTop < playerTop) {
                canJump = false;
                break;
              }
            }
          }
        }
        
        // Apply jump force only if there's clearance
        if (canJump) {
          // Add jump cooldown to prevent rapid jumping exploitation
          const now = Date.now();
          if (!player.lastJumpTime || now - player.lastJumpTime > 100) { // 100ms cooldown
            const jumpForce = player.jumpHeight ? -18 * (player.jumpHeight / 5) : -18;
            player.vy = jumpForce;
            player.lastJumpTime = now;
          }
        } else {
          // Try mantling: Check if we can climb over a 1-block obstacle
          const mantleCheckDistance = 48; // Check ahead for mantling
          const mantleHeight = 64; // One block height
          
          // Determine which direction player is trying to move
          const moveDir = input.left ? -1 : (input.right ? 1 : 0);
          
          if (moveDir !== 0) {
            // Check if there's a wall in front and space above it
            let canMantle = false;
            let mantleTargetY = null;
            
            const checkX = player.x + (moveDir * mantleCheckDistance);
            
            // Find blocks we might be able to mantle over
            for (const building of gameState.buildings) {
              if (['wall', 'castle_tower', 'tunnel', 'roof', 'wood', 'gold', 'brick'].includes(building.type)) {
                const blockLeft = building.x;
                const blockRight = building.x + 64;
                const blockTop = building.y;
                
                // Check if this block is in our path
                if ((moveDir > 0 && checkX > blockLeft && checkX < blockRight) ||
                    (moveDir < 0 && checkX < blockRight && checkX > blockLeft)) {
                  
                  // Check if block is at mantleable height (within 1.5 blocks)
                  const heightDiff = player.y - blockTop;
                  if (heightDiff > 0 && heightDiff <= mantleHeight * 1.5) {
                    // Check if there's space above this block
                    let spaceAbove = true;
                    const mantleCheckY = blockTop - playerHeight - 5;
                    
                    for (const checkBlock of gameState.buildings) {
                      if (['wall', 'castle_tower', 'tunnel', 'roof', 'wood', 'gold', 'brick'].includes(checkBlock.type)) {
                        const cBlockLeft = checkBlock.x;
                        const cBlockRight = checkBlock.x + 64;
                        const cBlockBottom = checkBlock.y + 64;
                        
                        // Check if there's a block in the mantle destination
                        if (checkX > cBlockLeft && checkX < cBlockRight &&
                            mantleCheckY < cBlockBottom && mantleCheckY > checkBlock.y - playerHeight) {
                          spaceAbove = false;
                          break;
                        }
                      }
                    }
                    
                    if (spaceAbove) {
                      canMantle = true;
                      mantleTargetY = blockTop - 2; // Place player on top of block
                      break;
                    }
                  }
                }
              }
            }
            
            // Perform mantle
            if (canMantle && mantleTargetY !== null) {
              const now = Date.now();
              if (!player.lastMantleTime || now - player.lastMantleTime > 300) { // 300ms cooldown
                // Apply upward velocity and slight forward momentum
                player.vy = -12; // Smaller upward boost
                player.vx = moveDir * player.moveSpeed * 1.2; // Slight forward boost
                player.lastMantleTime = now;
              }
            }
          }
        }
      }
    }
  });

  // On disconnect, save player state
  socket.on('disconnect', async () => {
    const player = gameState.players[socket.id];
    if (player) {
      // Calculate session playtime
      const sessionTime = Math.floor((Date.now() - player.sessionStartTime) / 1000); // in seconds
      
      // Build update object with only the fields we need to update
      const updateObj = { 
        $set: { 
          x: player.x, 
          y: player.y, 
          inventory: player.inventory, 
          currentWeapon: player.currentWeapon, 
          lastLogin: new Date(),
          gold: player.gold || 0
        },
        $inc: { 'stats.playTime': sessionTime }
      };
      
      // Add individual stat updates if they exist
      if (player.stats) {
        // Update each stat field individually to avoid conflicts
        if (player.stats.kills !== undefined) updateObj.$set['stats.kills'] = player.stats.kills;
        if (player.stats.deaths !== undefined) updateObj.$set['stats.deaths'] = player.stats.deaths;
        if (player.stats.headshots !== undefined) updateObj.$set['stats.headshots'] = player.stats.headshots;
        if (player.stats.damageDealt !== undefined) updateObj.$set['stats.damageDealt'] = player.stats.damageDealt;
        if (player.stats.damageTaken !== undefined) updateObj.$set['stats.damageTaken'] = player.stats.damageTaken;
        if (player.stats.shotsHit !== undefined) updateObj.$set['stats.shotsHit'] = player.stats.shotsHit;
        if (player.stats.shotsFired !== undefined) updateObj.$set['stats.shotsFired'] = player.stats.shotsFired;
        if (player.stats.blocksPlaced !== undefined) updateObj.$set['stats.blocksPlaced'] = player.stats.blocksPlaced;
        if (player.stats.blocksDestroyed !== undefined) updateObj.$set['stats.blocksDestroyed'] = player.stats.blocksDestroyed;
        if (player.stats.currentKillStreak !== undefined) updateObj.$set['stats.currentKillStreak'] = player.stats.currentKillStreak;
        if (player.stats.longestKillStreak !== undefined) updateObj.$set['stats.longestKillStreak'] = player.stats.longestKillStreak;
        if (player.stats.health !== undefined) updateObj.$set['stats.health'] = player.stats.health;
        if (player.stats.maxHealth !== undefined) updateObj.$set['stats.maxHealth'] = player.stats.maxHealth;
        if (player.stats.attack !== undefined) updateObj.$set['stats.attack'] = player.stats.attack;
        if (player.stats.defense !== undefined) updateObj.$set['stats.defense'] = player.stats.defense;
      }
      
      await Player.updateOne(
        { username: player.username },
        updateObj
      );
      console.log(`[LOGOUT] Player '${player.username}' disconnected (socket id: ${socket.id})`);
      
      // No need to check achievements on disconnect anymore as we track them in real-time
      
      // Remove from activeUsernames
      if (activeUsernames.get(player.username) === socket.id) {
        activeUsernames.delete(player.username);
        console.log(`[LOGOUT] Released username '${player.username}' from active list`);
      }
      
      // Send log to GUI
      sendLogToGui(`Player '${player.username}' left the server`, 'info');
      
      // Notify all other players that someone left
      socket.broadcast.emit('playerLeft', {
        username: player.username,
        role: player.role
      });
      
      // Clean up bullets owned by this player
      for (const bulletId in gameState.bullets) {
        if (gameState.bullets[bulletId].ownerId === socket.id) {
          delete gameState.bullets[bulletId];
          io.emit('bulletDestroyed', { bulletId });
        }
      }
      
      delete gameState.players[socket.id];
      
      // Notify GUI of player list update
      sendPlayerListToGui();
    } else if (socket.username) {
      // Clean up activeUsernames even if player wasn't in gameState
      if (activeUsernames.get(socket.username) === socket.id) {
        activeUsernames.delete(socket.username);
        console.log(`[LOGOUT] Released reserved username '${socket.username}'`);
      }
    }
  });

  // Handle block deletion
  socket.on('deleteBlock', async (data) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const idx = gameState.buildings.findIndex(b => b.x === data.x && b.y === data.y);
    if (idx !== -1) {
      const b = gameState.buildings[idx];
      
      // Log building removal
      sendLogToGui(`[BUILD] ${player.username} removed ${b.type} at (${data.x}, ${data.y})`, 'info');
      
      // Don't allow deleting SYSTEM blocks
      if (b.owner === 'SYSTEM') {
        socket.emit('buildingError', 'Cannot delete system structures!');
        return;
      }
      await Building.deleteOne({ x: b.x, y: b.y, type: b.type, owner: b.owner });
      gameState.buildings.splice(idx, 1);
      updateSpatialGrid();
      
      // Track blocks destroyed
      player.stats = player.stats || {};
      player.stats.blocksDestroyed = (player.stats.blocksDestroyed || 0) + 1;
      
      Player.updateOne(
        { username: player.username },
        { $inc: { 'stats.blocksDestroyed': 1 } }
      ).catch(err => console.error('[DB] Error updating blocks destroyed:', err));
    }
  });

  // Handle building placement
  socket.on('placeBuilding', async (data) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Log building placement
    sendLogToGui(`[BUILD] ${player.username} placed ${data.type} at (${data.x}, ${data.y})`, 'info');
    
    // Validate block type
    if (!BLOCK_TYPES.includes(data.type)) return;
    // Validate distance
    const dx = (data.x + 32) - player.x;
    const dy = (data.y + 32) - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 384) return; // 6 blocks radius
    
    // Check if building is too close to weapon shop (3 block buffer = 192 pixels)
    if (gameState.weaponShopArea) {
      const shopBuffer = 192;
      const shopArea = gameState.weaponShopArea;
      const shopLeft = shopArea.x - shopBuffer;
      const shopRight = shopArea.x + shopArea.width + shopBuffer;
      const shopTop = shopArea.y - shopBuffer;
      const shopBottom = shopArea.y + shopArea.height + shopBuffer;
      
      if (data.x >= shopLeft && data.x < shopRight && 
          data.y >= shopTop && data.y < shopBottom) {
        socket.emit('buildingError', 'Cannot build near the weapon shop!');
        return;
      }
    }
    
    // Remove any existing block at this position
    const idx = gameState.buildings.findIndex(b => b.x === data.x && b.y === data.y);
    if (idx !== -1) {
      const b = gameState.buildings[idx];
      // Don't allow deleting SYSTEM blocks
      if (b.owner === 'SYSTEM') {
        socket.emit('buildingError', 'Cannot modify system structures!');
        return;
      }
      await Building.deleteOne({ x: b.x, y: b.y, type: b.type, owner: b.owner });
      gameState.buildings.splice(idx, 1);
      updateSpatialGrid();
      
      // Track blocks destroyed
      player.stats = player.stats || {};
      player.stats.blocksDestroyed = (player.stats.blocksDestroyed || 0) + 1;
      
      Player.updateOne(
        { username: player.username },
        { $inc: { 'stats.blocksDestroyed': 1 } }
      ).catch(err => console.error('[DB] Error updating blocks destroyed:', err));
    }
    // Add building
    gameState.buildings.push({
      type: data.type,
      x: data.x,
      y: data.y,
      owner: socket.id
    });
    
    // Update spatial grid
    updateSpatialGrid();
    
    // Track blocks placed
    player.stats = player.stats || {};
    player.stats.blocksPlaced = (player.stats.blocksPlaced || 0) + 1;
    
    Player.updateOne(
      { username: player.username },
      { $inc: { 'stats.blocksPlaced': 1 } }
    ).catch(err => console.error('[DB] Error updating blocks placed:', err));
    
    console.log(`[BUILDING PLACED] Type: ${data.type} at (${data.x}, ${data.y}) by ${player.username}`);
    
    // Update achievements for building
    achievementManager.checkAchievement(player.username, {
      type: 'blockPlace',
      playerId: player.username
    }).then(unlocked => {
      if (unlocked.length > 0) {
        socket.emit('achievementsUnlocked', unlocked);
      }
    }).catch(err => {
      console.error('[ACHIEVEMENT] Error checking building achievements:', err);
    });
    // Save to DB
    await Building.create({ type: data.type, x: data.x, y: data.y, owner: socket.id });
  });

  // Handle building order update from client
  socket.on('updateBuildingOrder', async (newOrder) => {
    const player = gameState.players[socket.id];
    if (player) {
      player.buildingOrder = newOrder;
      await Player.updateOne(
        { username: player.username },
        { $set: { buildingOrder: newOrder } }
      );
    }
  });

  // Handle inventory update from client
  socket.on('updateInventory', async (newInventory) => {
    const player = gameState.players[socket.id];
    if (player) {
      player.inventory = newInventory;
      await Player.updateOne(
        { username: player.username },
        { $set: { inventory: newInventory } }
      );
    }
  });
  
  // Handle tutorial completion
  socket.on('tutorialCompleted', async () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Update player's tutorial status
    player.tutorialCompleted = true;
    
    // Save to database
    try {
      await Player.updateOne(
        { username: player.username },
        { $set: { tutorialCompleted: true } }
      );
      console.log(`[TUTORIAL] Player '${player.username}' completed tutorial`);
    } catch (error) {
      console.error('[TUTORIAL] Error saving tutorial completion:', error);
    }
  });
  
  // Achievement system handlers
  socket.on('getAchievements', async () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    try {
      const progress = await achievementManager.getAchievementProgress(player.username);
      const stats = await achievementManager.getPlayerStats(player.username);
      
      socket.emit('achievementData', {
        progress,
        stats
      });
    } catch (error) {
      console.error('[ACHIEVEMENT] Error fetching achievements:', error);
    }
  });
  
  socket.on('getAchievementProgress', async () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    try {
      const progress = await achievementManager.getAchievementProgress(player.username);
      console.log('[ACHIEVEMENT] Sending progress for', player.username, ':', Object.keys(progress).length, 'achievements');
      
      socket.emit('achievementData', {
        progress
      });
    } catch (error) {
      console.error('[ACHIEVEMENT] Error fetching achievement progress:', error);
    }
  });

  // In-game reset world command (owners only)
  socket.on('resetWorld', async () => {
    const player = gameState.players[socket.id];
    if (player && player.role === 'owner') {
      // Store current player positions
      const playerPositions = {};
      for (const id in gameState.players) {
        playerPositions[id] = {
          x: gameState.players[id].x,
          y: gameState.players[id].y
        };
      }
      
      // Delete all buildings
      await Building.deleteMany({});
      gameState.buildings = [];
      
      // Emit world state with empty buildings but preserved player positions
      io.emit('worldState', { 
        players: gameState.players, 
        buildings: [] 
      });
      
      socket.emit('commandResult', { message: 'World reset: all buildings deleted. Players will fall if not on ground.' });
    } else {
      socket.emit('commandResult', { message: 'You do not have permission to reset the world.' });
    }
  });

  // Handle party UI requests
  socket.on('requestPartyList', () => {
    const player = gameState.players[socket.id];
    const parties = [];
    for (const partyName in gameState.parties) {
      const party = gameState.parties[partyName];
      parties.push({
        name: party.name,
        leader: party.leader,
        members: party.members,
        memberCount: party.members.length,
        isOpen: party.isOpen
      });
    }
    socket.emit('partyList', { 
      parties,
      currentParty: player ? player.party : null
    });
  });
  
  socket.on('createQuickParty', () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Automatically use player's username for party name
    const partyName = player.username + "'s Party";
    createParty(socket, player, partyName);
  });
  
  socket.on('joinPartyQuick', ({ partyName }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    joinParty(socket, player, partyName);
  });
  
  socket.on('leavePartyQuick', () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    leaveParty(socket, player);
  });
  
  socket.on('startPartyGame', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) return;
    
    const party = gameState.parties[player.party];
    if (!party || party.leader !== player.username) {
      socket.emit('partyError', { message: 'Only the party leader can start the game.' });
      return;
    }
    
    // In PvP, starting a game just means the party is ready to play together
    // Notify all party members
    party.members.forEach(memberName => {
      const memberSocket = findSocketByUsername(memberName);
      if (memberSocket) {
        memberSocket.emit('serverAnnouncement', { 
          message: 'Party is ready! Team up and dominate!',
          type: 'success'
        });
      }
    });
  });
  
  socket.on('togglePartyOpen', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) return;
    
    const party = gameState.parties[player.party];
    if (!party || party.leader !== player.username) {
      socket.emit('partyError', { message: 'Only the party leader can toggle party status.' });
      return;
    }
    
    party.isOpen = !party.isOpen;
    
    // Notify all party members
    party.members.forEach(memberName => {
      const memberSocket = findSocketByUsername(memberName);
      if (memberSocket) {
        memberSocket.emit('partyUpdate', { party });
      }
    });
  });
  
  // Handle chat messages
  socket.on('chatMessage', ({ message }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Validate input type
    if (typeof message !== 'string') return;
    
    // Sanitize message - remove HTML tags and limit length
    const cleanMessage = message
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove < and > characters
      .substring(0, 200)
      .trim();
      
    if (!cleanMessage) return;
    
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{5,}/g, // Same character repeated 6+ times
      /(https?:\/\/[^\s]+)/gi, // URLs (you might want to allow these)
    ];
    
    for (const pattern of spamPatterns) {
      if (pattern.test(cleanMessage)) {
        socket.emit('commandResult', { message: 'Message blocked: spam detected' });
        return;
      }
    }
    
    // Broadcast to all players
    io.emit('chatMessage', {
      username: player.username,
      role: player.role || 'player',
      message: cleanMessage
    });
    
    console.log(`[CHAT] ${player.username}: ${cleanMessage}`);
    
    // Log chat message to GUI
    sendLogToGui(`[CHAT] ${player.username}: ${cleanMessage}`, 'info');
  });

  // Handle other commands
  socket.on('command', async ({ command, target, value }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Handle party commands
    if (command.startsWith('party ')) {
      const subCommand = command.substring(6);
      switch (subCommand) {
        case 'create':
          createParty(socket, player, target);
          break;
        case 'join':
          joinParty(socket, player, target);
          break;
        case 'leave':
          leaveParty(socket, player);
          break;
        case 'list':
          listParty(socket, player);
          break;
        case 'open':
          if (player.party && gameState.parties[player.party]) {
            const party = gameState.parties[player.party];
            if (party.leader === player.username) {
              party.isOpen = true;
              socket.emit('commandResult', { message: 'Party is now open to new members.' });
              // Notify members
              party.members.forEach(memberName => {
                const memberSocket = findSocketByUsername(memberName);
                if (memberSocket) {
                  memberSocket.emit('serverAnnouncement', { 
                    message: 'Party is now open to new members.',
                    type: 'info'
                  });
                }
              });
            } else {
              socket.emit('commandResult', { message: 'Only the party leader can change this setting.' });
            }
          } else {
            socket.emit('commandResult', { message: 'You are not in a party.' });
          }
          break;
        case 'close':
          if (player.party && gameState.parties[player.party]) {
            const party = gameState.parties[player.party];
            if (party.leader === player.username) {
              party.isOpen = false;
              socket.emit('commandResult', { message: 'Party is now closed to new members.' });
              // Notify members
              party.members.forEach(memberName => {
                const memberSocket = findSocketByUsername(memberName);
                if (memberSocket) {
                  memberSocket.emit('serverAnnouncement', { 
                    message: 'Party is now closed to new members.',
                    type: 'info'
                  });
                }
              });
            } else {
              socket.emit('commandResult', { message: 'Only the party leader can change this setting.' });
            }
          } else {
            socket.emit('commandResult', { message: 'You are not in a party.' });
          }
          break;
        default:
          socket.emit('commandResult', { 
            message: 'Party commands: /party create [name], /party join [name], /party leave, /party list, /party open, /party close' 
          });
      }
      return;
    }
    
    // Handle help command
    if (command === 'help') {
      socket.emit('commandResult', { 
        message: `Available commands:
- /party create [name] - Create a new party
- /party join [name] - Join a party
- /party leave - Leave your current party
- /party list - Show party members
- /party open/close - Open/close party to new members (leader only)
- /help - Show this help message`
      });
      return;
    }
    
    // Check permissions based on command
    const staffCommands = ['kick', 'ban', 'unban', 'tp', 'tpto', 'fly', 'speed', 'jump', 'teleport'];
    const adminCommands = ['promote', 'demote', 'resetpassword', 'clearinv'];
    const ownerCommands = ['resetworld'];
    
    const isStaff = ['owner', 'admin', 'ash', 'mod'].includes(player.role);
    const isAdmin = ['owner', 'admin', 'ash'].includes(player.role);
    const isOwner = player.role === 'owner';
    
    // Check permission for the command
    if (ownerCommands.includes(command) && !isOwner) {
      socket.emit('commandResult', { message: 'Only owners can use this command.' });
      return;
    }
    if (adminCommands.includes(command) && !isAdmin) {
      socket.emit('commandResult', { message: 'Only owners and admins can use this command.' });
      return;
    }
    if (staffCommands.includes(command) && !isStaff) {
      socket.emit('commandResult', { message: 'Only staff members can use this command.' });
      return;
    }

    // Find target player by username
    let targetPlayer = null;
    let targetId = null;
    for (const id in gameState.players) {
      if (gameState.players[id].username === target) {
        targetPlayer = gameState.players[id];
        targetId = id;
        break;
      }
    }

    if (!targetPlayer) {
      socket.emit('commandResult', { message: `Player ${target} not found.` });
      return;
    }

    switch (command) {
      case 'teleport':
        // Teleport target to command user
        targetPlayer.x = player.x;
        targetPlayer.y = player.y;
        socket.emit('commandResult', { message: `Teleported ${target} to your position.` });
        break;

      case 'tpto':
        // Teleport current player to desired player
        if (!value) {
          socket.emit('commandResult', { message: 'Usage: tpto <yourUsername> <targetUsername>' });
          break;
        }
        // Find desired player by username
        let desiredPlayer = null;
        for (const id in gameState.players) {
          if (gameState.players[id].username === value) {
            desiredPlayer = gameState.players[id];
            break;
          }
        }
        if (!desiredPlayer) {
          socket.emit('commandResult', { message: `Player ${value} not found.` });
          break;
        }
        player.x = desiredPlayer.x;
        player.y = desiredPlayer.y;
        socket.emit('commandResult', { message: `Teleported you to ${value}.` });
        break;

      case 'tp':
        // Teleport desired player to current player
        if (!value) {
          socket.emit('commandResult', { message: 'Usage: tp <yourUsername> <targetUsername>' });
          break;
        }
        // Find desired player by username
        let tpTarget = null;
        for (const id in gameState.players) {
          if (gameState.players[id].username === value) {
            tpTarget = gameState.players[id];
            break;
          }
        }
        if (!tpTarget) {
          socket.emit('commandResult', { message: `Player ${value} not found.` });
          break;
        }
        tpTarget.x = player.x;
        tpTarget.y = player.y;
        socket.emit('commandResult', { message: `Teleported ${value} to your position.` });
        break;

      case 'god':
        // Enable fly and noclip for current player
        player.flyMode = true;
        player.flySpeed = 10;
        player.noclip = true;
        socket.emit('commandResult', { message: 'God mode enabled: fly and noclip active.' });
        break;

      case 'fly':
        // Toggle fly mode (value 1-10 determines speed)
        const flySpeed = Math.min(Math.max(parseInt(value) || 1, 1), 10);
        targetPlayer.flyMode = !targetPlayer.flyMode;
        targetPlayer.flySpeed = flySpeed;
        socket.emit('commandResult', { 
          message: `${target} ${targetPlayer.flyMode ? 'can now fly' : 'can no longer fly'} (speed: ${flySpeed}).` 
        });
        break;

      case 'speed':
        // Set movement speed (1-10)
        const moveSpeed = Math.min(Math.max(parseInt(value) || 1, 1), 10);
        targetPlayer.moveSpeed = moveSpeed;
        socket.emit('commandResult', { message: `Set ${target}'s movement speed to ${moveSpeed}.` });
        break;

      case 'jump':
        // Set jump height (1-10)
        const jumpHeight = Math.min(Math.max(parseInt(value) || 1, 1), 10);
        targetPlayer.jumpHeight = jumpHeight;
        socket.emit('commandResult', { message: `Set ${target}'s jump height to ${jumpHeight}.` });
        break;

      case 'kick':
        // Kick player from server
        targetPlayer.x = 100;
        targetPlayer.y = 1800;
        
        // Remove from activeUsernames
        if (activeUsernames.get(targetPlayer.username) === targetId) {
          activeUsernames.delete(targetPlayer.username);
        }
        
        io.to(targetId).emit('commandResult', { message: 'You have been kicked from the server.' });
        io.sockets.sockets.get(targetId)?.disconnect();
        delete gameState.players[targetId];
        socket.emit('commandResult', { message: `Kicked ${target} from the server.` });
        
        // Notify GUI
        sendPlayerListToGui();
        break;
        
      case 'ban':
        // Ban player from server
        await Player.updateOne(
          { username: targetPlayer.username },
          { $set: { banned: true, banDate: new Date() } }
        );
        
        // Add to in-memory ban list
        bannedUsers.add(targetPlayer.username);
        
        io.to(targetId).emit('loginError', { message: 'You have been banned from this server!' });
        io.sockets.sockets.get(targetId)?.disconnect(true);
        delete gameState.players[targetId];
        
        socket.emit('commandResult', { message: `Banned ${target} from the server.` });
        io.emit('serverAnnouncement', { message: `${target} has been banned from the server.`, type: 'warning' });
        
        // Notify GUI
        sendPlayerListToGui();
        break;
        
      case 'unban':
        // Unban player - they must be offline
        const unbanResult = await Player.updateOne(
          { username: target },
          { $unset: { banned: 1, banDate: 1 } }
        );
        
        if (unbanResult.modifiedCount > 0) {
          // Remove from in-memory ban list
          bannedUsers.delete(target);
          
          socket.emit('commandResult', { message: `Unbanned ${target}.` });
          io.emit('serverAnnouncement', { message: `${target} has been unbanned.`, type: 'info' });
        } else {
          socket.emit('commandResult', { message: `User ${target} not found or not banned.` });
        }
        break;

      case 'promote':
        // Promote player to role (owner and admin only)
        
        // Check if role is valid
        const validRoles = ['player', 'mod', 'admin', 'ash', 'owner'];
        if (!value || !validRoles.includes(value)) {
          socket.emit('commandResult', { message: `Usage: /promote ${target} <role>. Valid roles: ${validRoles.join(', ')}` });
          break;
        }
        
        // Prevent non-owners from promoting to owner
        if (value === 'owner' && player.role !== 'owner') {
          socket.emit('commandResult', { message: 'Only owners can promote to owner.' });
          break;
        }
        
        // Update role
        targetPlayer.role = value;
        await Player.updateOne({ username: targetPlayer.username }, { $set: { role: value } });
        
        // Notify the promoted player
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.emit('roleUpdated', { role: value });
        }
        
        socket.emit('commandResult', { message: `Promoted ${target} to ${value}.` });
        break;

      case 'resetpassword':
        // Reset password for a user (admin and owner only)
        if (!value) {
          socket.emit('commandResult', { message: 'Usage: /resetpassword <username> <newpassword>' });
          break;
        }
        
        // Hash the new password
        const newPasswordHash = await bcrypt.hash(value, 10);
        
        // Update the password in the database
        const resetResult = await Player.updateOne(
          { username: target },
          { $set: { passwordHash: newPasswordHash } }
        );
        
        if (resetResult.modifiedCount > 0) {
          socket.emit('commandResult', { message: `Password reset successfully for ${target}.` });
          
          // If the player is online, notify them
          for (const id in gameState.players) {
            if (gameState.players[id].username === target) {
              io.to(id).emit('commandResult', { 
                message: 'Your password has been reset by an administrator. Please reconnect with your new password.' 
              });
              break;
            }
          }
        } else {
          socket.emit('commandResult', { message: `User ${target} not found.` });
        }
        break;

      case 'clearinv':
        // Clear inventory for a player (admin and owner only)
        
        // Reset all inventory-related data
        targetPlayer.inventory = [];
        targetPlayer.weaponTypes = []; // No weapons
        targetPlayer.equippedWeaponIndex = -1;
        targetPlayer.currentWeapon = null;
        
        const clearInvSocket = io.sockets.sockets.get(targetId);
        if (clearInvSocket) {
          // Send inventory update - send empty array as expected by client
          clearInvSocket.emit('inventoryUpdate', []);
          
          // Send weapon update with empty weapons array
          clearInvSocket.emit('weaponLoadoutUpdated', {
            weapons: []
          });
          
          // Force unequip weapon
          clearInvSocket.emit('weaponEquipped', { 
            weaponType: null,
            weaponIndex: -1
          });
        }
        
        // Also update database
        try {
          const dbPlayer = await Player.findOne({ username: target });
          if (dbPlayer) {
            dbPlayer.inventory = [];
            await dbPlayer.save();
            socket.emit('commandResult', { message: `Cleared inventory for ${target}.` });
          } else {
            socket.emit('commandResult', { message: `Player ${target} found in game but not in database.` });
          }
        } catch (error) {
          console.error('Error updating database:', error);
          socket.emit('commandResult', { message: `Cleared inventory for ${target} (game state only, database error).` });
        }
        break;

      default:
        socket.emit('commandResult', { message: 'Unknown command.' });
    }
  });

  // Handle weapon change
  socket.on('weaponChanged', async (data) => {
    const player = gameState.players[socket.id];
    if (player && data.weaponType) {
      player.currentWeapon = data.weaponType;
      console.log(`[WEAPON] Player ${player.username} switched to ${data.weaponType}`);
      // Save to database
      await Player.updateOne(
        { username: player.username },
        { $set: { currentWeapon: data.weaponType } }
      );
    }
  });
  
  // Handle weapon change from mobile UI
  socket.on('changeWeapon', async (weaponType) => {
    const player = gameState.players[socket.id];
    if (player && weaponType) {
      player.currentWeapon = weaponType;
      console.log(`[WEAPON] Player ${player.username} changed weapon to ${weaponType}`);
      // Save to database
      await Player.updateOne(
        { username: player.username },
        { $set: { currentWeapon: weaponType } }
      );
    }
  });

  // Handle weapon loadout updates
  socket.on('updateWeaponLoadout', async (data) => {
    const player = gameState.players[socket.id];
    if (player && data.weapons && Array.isArray(data.weapons)) {
      player.weaponLoadout = data.weapons;
      console.log(`[WEAPON] Player ${player.username} updated weapon loadout:`, data.weapons);
      // Save to database
      await Player.updateOne(
        { username: player.username },
        { $set: { weaponLoadout: data.weapons } }
      );
    }
  });
  
  // Handle player data updates (for weapon persistence)
  socket.on('updatePlayerData', async (data) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    if (data.currentWeapon) {
      player.currentWeapon = data.currentWeapon;
      console.log(`[WEAPON] Player ${player.username} changed weapon to: ${data.currentWeapon}`);
      
      // Save to database
      await Player.updateOne(
        { username: player.username },
        { $set: { currentWeapon: data.currentWeapon } }
      );
    }
  });
  
  // Handle weapon shop request
  socket.on('requestWeaponFromShop', (weaponType) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Check if player is in weapon shop area
    if (!gameState.weaponShopArea) {
      socket.emit('weaponShopError', 'Weapon shop not available!');
      return;
    }
    
    const shopArea = gameState.weaponShopArea;
    const isInShop = player.x >= shopArea.x && 
                     player.x <= shopArea.x + shopArea.width &&
                     player.y >= shopArea.y - 64 && // Allow some height above ground
                     player.y <= shopArea.y + shopArea.height;
                     
    if (!isInShop) {
      socket.emit('weaponShopError', 'You must be inside the weapon shop area!');
      return;
    }
    
    // Validate weapon type
    const validWeapons = ['pistol', 'shotgun', 'rifle', 'sniper'];
    if (['mod', 'admin', 'ash', 'owner'].includes(player.role)) {
      validWeapons.push('minigun');
    }
    if (['admin', 'ash', 'owner'].includes(player.role)) {
      validWeapons.push('tomatogun');
    }
    if (player.role === 'owner') {
      validWeapons.push('triangun');
    }
    
    if (!validWeapons.includes(weaponType)) {
      socket.emit('weaponShopError', 'Invalid weapon type!');
      return;
    }
    
    // Add weapon to player's inventory
    socket.emit('addWeaponToInventory', {
      weaponType: weaponType
    });
    
    console.log(`[WEAPON SHOP] Player ${player.username} took ${weaponType}`);
  });

  // Handle bullet creation
  socket.on('bulletCreated', (data) => {
    const player = gameState.players[socket.id];
    if (player) {
      // Track shots fired
      player.stats = player.stats || {};
      player.stats.shotsFired = (player.stats.shotsFired || 0) + 1;
      
      console.log(`[STATS] Player ${player.username} fired shot. Total: ${player.stats.shotsFired}`);
      
      // Update database
      Player.updateOne(
        { username: player.username },
        { $inc: { 'stats.shotsFired': 1 } }
      ).catch(err => console.error('[DB] Error updating shots fired:', err));
      
      // Send immediate stats update to the shooter
      socket.emit('statsUpdate', { stats: player.stats });
      
      // Track weapon shots for achievements
      achievementManager.checkAchievement(player.username, {
        type: 'shoot',
        weapon: data.weaponType || 'pistol',
        playerId: player.username
      }).then(unlocked => {
        if (unlocked.length > 0) {
          socket.emit('achievementsUnlocked', unlocked);
        }
      }).catch(err => {
        console.error('[ACHIEVEMENT] Error checking weapon achievements:', err);
      });
    }
    
    // Check tomato limit before creating new tomato bullet
    if (data.weaponType === 'tomatogun') {
      // Count current tomatoes
      const currentTomatoes = Object.values(gameState.bullets).filter(b => b.weaponType === 'tomatogun');
      
      if (currentTomatoes.length >= MAX_TOMATOES) {
        // Find the oldest tomato and destroy it
        const oldestTomato = currentTomatoes.reduce((oldest, current) => 
          current.createdAt < oldest.createdAt ? current : oldest
        );
        
        // Destroying oldest tomato to make room
        destroyBullet(oldestTomato.bulletId, true);
      }
    }
    
    // Add a unique ID to each bullet for tracking
    const bulletId = `${socket.id}_${Date.now()}_${Math.random()}`;
    
    if (data.weaponType === 'tomatogun') {
      const currentCount = Object.values(gameState.bullets).filter(b => b.weaponType === 'tomatogun').length;
      // Created new tomato bullet
    }
    
    // Calculate velocity components
    const radians = data.angle * Math.PI / 180;
    const vx = Math.cos(radians) * data.speed;
    const vy = Math.sin(radians) * data.speed;
    
    // Validate weapon damage server-side
    const validatedDamage = getValidatedWeaponDamage(data.weaponType || 'pistol', player.role);
    
    // Store bullet in game state
    gameState.bullets[bulletId] = {
      x: data.x,
      y: data.y,
      vx: vx,
      vy: vy,
      damage: validatedDamage, // Use server-validated damage
      ownerId: socket.id,
      bulletId: bulletId,
      weaponType: data.weaponType || 'pistol',
      // Add gravity for tomato bullets
      gravity: data.weaponType === 'tomatogun' ? 400 : 0,
      // Heat-seeking properties for tomatoes
      targetX: data.targetX,
      targetY: data.targetY,
      homingStrength: data.weaponType === 'tomatogun' ? 150 : 0,
      maxTurnRate: 3 * Math.PI / 180, // 3 degrees in radians
      // Simple time-based arming for tomatoes
      createdAt: Date.now(),
      armingDelay: data.weaponType === 'tomatogun' ? 500 : 0 // 0.5 second delay to prevent accidental explosions
    };
    
    // Broadcast bullet to all players including the shooter
    io.emit('bulletCreated', {
      ...data,
      playerId: socket.id,
      bulletId: bulletId
    });
  });
  
  // Handle tomato explosion (area damage)
  socket.on('tomatoExploded', ({ x, y, radius, damage, ownerId }) => {
    const player = gameState.players[socket.id];
    if (!player || player.username !== gameState.players[ownerId]?.username) return;
    
    // Check all players within radius
    for (const playerId in gameState.players) {
      if (playerId === ownerId) continue; // Don't damage shooter
      
      const target = gameState.players[playerId];
      if (target.isDead) continue;
      
      // Calculate distance from explosion center
      const distance = Math.sqrt(
        Math.pow(target.x - x, 2) + 
        Math.pow(target.y - y, 2)
      );
      
      // Apply damage if within radius
      if (distance <= radius) {
        // Damage falloff based on distance (full damage at center, 50% at edge)
        const falloff = 1 - (distance / radius) * 0.5;
        const actualDamage = Math.floor(damage * falloff);
        
        target.health = Math.max(0, target.health - actualDamage);
        
        // Track damage stats for tomato explosions
        target.stats = target.stats || {};
        target.stats.damageTaken = (target.stats.damageTaken || 0) + actualDamage;
        
        const attacker = gameState.players[ownerId];
        if (attacker) {
          attacker.stats = attacker.stats || {};
          attacker.stats.damageDealt = (attacker.stats.damageDealt || 0) + actualDamage;
          
          // Update damage stats in database
          Player.updateOne(
            { username: attacker.username },
            { $inc: { 'stats.damageDealt': actualDamage } }
          ).catch(err => console.error('[DB] Error updating tomato damage dealt:', err));
        }
        
        Player.updateOne(
          { username: target.username },
          { $inc: { 'stats.damageTaken': actualDamage } }
        ).catch(err => console.error('[DB] Error updating tomato damage taken:', err));
        
        // Check if player died
        if (target.health <= 0 && !target.isDead) {
          target.isDead = true;
          
          // Get killer information
          const killer = gameState.players[ownerId];
          if (killer) {
            // Update killer stats
            killer.stats = killer.stats || {};
            killer.stats.kills = (killer.stats.kills || 0) + 1;
            killer.stats.currentKillStreak = (killer.stats.currentKillStreak || 0) + 1;
            if (killer.stats.currentKillStreak > (killer.stats.longestKillStreak || 0)) {
              killer.stats.longestKillStreak = killer.stats.currentKillStreak;
            }
            
            // Update victim stats
            target.stats = target.stats || {};
            target.stats.deaths = (target.stats.deaths || 0) + 1;
            target.stats.currentKillStreak = 0;
            
            // Save stats to database
            Player.updateOne(
              { username: killer.username },
              { $inc: { 'stats.kills': 1 },
                $set: { 'stats.currentKillStreak': killer.stats.currentKillStreak,
                        'stats.longestKillStreak': killer.stats.longestKillStreak } }
            ).catch(err => console.error('[DB] Error updating killer stats:', err));
            
            Player.updateOne(
              { username: target.username },
              { $inc: { 'stats.deaths': 1 },
                $set: { 'stats.currentKillStreak': 0 } }
            ).catch(err => console.error('[DB] Error updating victim stats:', err));
            
            io.emit('playerKill', {
              killerName: killer.username,
              killerRole: killer.role || 'player',
              victimName: target.username,
              victimRole: target.role || 'player',
              isHeadshot: false,
              killerStats: killer.stats,
              victimStats: target.stats
            });
          }
          
          // Respawn after 3 seconds
          setTimeout(() => {
            if (gameState.players[playerId]) {
              target.health = target.maxHealth;
              target.isDead = false;
              target.x = 600;
              target.y = 1800;
              io.to(playerId).emit('respawn', { x: target.x, y: target.y });
              console.log(`[RESPAWN] Player ${target.username} respawned`);
            }
          }, 3000);
        }
        
        // Notify all clients about the damage
        io.emit('playerDamaged', { 
          targetId: playerId, 
          damage: actualDamage, 
          bulletX: x, 
          bulletY: y, 
          bulletId: null,
          health: target.health,
          maxHealth: target.maxHealth,
          isHeadshot: false
        });
      }
    }
  });

  // Handle player damage (now mostly handled server-side, but keep for backwards compatibility)
  socket.on('playerDamaged', ({ targetId, damage, bulletX, bulletY, bulletId }) => {
    // This is now handled in the game loop, but we keep this for any edge cases
  });

  // Handle bullet destruction
  socket.on('bulletDestroyed', ({ bulletId }) => {
    // Remove from server state
    delete gameState.bullets[bulletId];
    // Broadcast to all other clients to destroy this bullet
    socket.broadcast.emit('bulletDestroyed', { bulletId });
  });
  
  // Handle tomato target updates
  socket.on('updateTomatoTarget', ({ targetX, targetY }) => {
    // Update all active tomato bullets from this player
    for (const bulletId in gameState.bullets) {
      const bullet = gameState.bullets[bulletId];
      if (bullet.ownerId === socket.id && bullet.weaponType === 'tomatogun') {
        bullet.targetX = targetX;
        bullet.targetY = targetY;
      }
    }
  });

  // Trade system handlers
  socket.on('tradeRequest', ({ to }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const targetPlayer = Object.values(gameState.players).find(p => p.username === to.toLowerCase());
    if (!targetPlayer) {
      socket.emit('serverAnnouncement', { 
        message: `Player ${to} not found.`, 
        type: 'error' 
      });
      return;
    }
    
    // Check if already has pending request
    if (pendingTradeRequests[player.username]) {
      socket.emit('serverAnnouncement', { 
        message: 'You already have a pending trade request.', 
        type: 'error' 
      });
      return;
    }
    
    // Check if target is already in a trade
    const targetInTrade = Object.values(activeTrades).some(trade => 
      trade.player1 === targetPlayer.username || trade.player2 === targetPlayer.username
    );
    
    if (targetInTrade) {
      socket.emit('serverAnnouncement', { 
        message: `${to} is already in a trade.`, 
        type: 'error' 
      });
      return;
    }
    
    // Store pending request
    pendingTradeRequests[player.username] = {
      to: targetPlayer.username,
      timestamp: Date.now()
    };
    
    // Send request to target
    const targetSocket = io.sockets.sockets.get(targetPlayer.id);
    if (targetSocket) {
      targetSocket.emit('tradeRequest', { from: player.username });
    }
    
    // Clean up request after 30 seconds
    setTimeout(() => {
      if (pendingTradeRequests[player.username]) {
        delete pendingTradeRequests[player.username];
      }
    }, 30000);
  });

  socket.on('tradeResponse', ({ to, accepted }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const request = pendingTradeRequests[to];
    if (!request || request.to !== player.username) {
      return; // No valid request
    }
    
    const requestingPlayer = Object.values(gameState.players).find(p => p.username === to);
    if (!requestingPlayer) return;
    
    const requestingSocket = io.sockets.sockets.get(requestingPlayer.id);
    if (!requestingSocket) return;
    
    if (accepted) {
      // Create new trade
      const tradeId = generateTradeId();
      activeTrades[tradeId] = {
        player1: to,
        player2: player.username,
        offer1: { items: [], gold: 0, locked: false },
        offer2: { items: [], gold: 0, locked: false },
        status: 'active',
        confirmed1: false,
        confirmed2: false
      };
      
      // Notify both players
      requestingSocket.emit('tradeAccepted', { 
        tradeId, 
        partner: player.username 
      });
      socket.emit('tradeAccepted', { 
        tradeId, 
        partner: to 
      });
    } else {
      requestingSocket.emit('tradeDeclined', { from: player.username });
    }
    
    // Clean up request
    delete pendingTradeRequests[to];
  });

  socket.on('tradeUpdate', ({ tradeId, offer }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const trade = activeTrades[tradeId];
    if (!trade || trade.status !== 'active') return;
    
    // Determine which player is updating
    const isPlayer1 = trade.player1 === player.username;
    const isPlayer2 = trade.player2 === player.username;
    
    if (!isPlayer1 && !isPlayer2) return;
    
    // Update the appropriate offer
    if (isPlayer1) {
      trade.offer1 = offer;
      // If player unlocks, reset other player's lock
      if (!offer.locked && trade.offer2.locked) {
        trade.offer2.locked = false;
      }
    } else {
      trade.offer2 = offer;
      // If player unlocks, reset other player's lock
      if (!offer.locked && trade.offer1.locked) {
        trade.offer1.locked = false;
      }
    }
    
    // Send update to other player
    const otherUsername = isPlayer1 ? trade.player2 : trade.player1;
    const otherPlayer = Object.values(gameState.players).find(p => p.username === otherUsername);
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.id);
      if (otherSocket) {
        otherSocket.emit('tradeUpdate', { offer });
      }
    }
  });

  socket.on('confirmTrade', ({ tradeId }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const trade = activeTrades[tradeId];
    if (!trade || trade.status !== 'active') return;
    
    // Check if both offers are locked
    if (!trade.offer1.locked || !trade.offer2.locked) {
      socket.emit('serverAnnouncement', { 
        message: 'Both players must lock in their offers first.', 
        type: 'error' 
      });
      return;
    }
    
    // Mark this player as confirmed
    const isPlayer1 = player.username === trade.player1;
    if (isPlayer1) {
      trade.confirmed1 = true;
    } else {
      trade.confirmed2 = true;
    }
    
    // Notify other player about confirmation
    const otherUsername = isPlayer1 ? trade.player2 : trade.player1;
    const otherPlayer = Object.values(gameState.players).find(p => p.username === otherUsername);
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.id);
      if (otherSocket) {
        otherSocket.emit('tradePartnerConfirmed', { partner: player.username });
      }
    }
    
    // Check if both players have confirmed
    if (!trade.confirmed1 || !trade.confirmed2) {
      socket.emit('tradeWaitingConfirmation');
      return;
    }
    
    // Both confirmed - execute the trade
    const player1 = Object.values(gameState.players).find(p => p.username === trade.player1);
    const player2 = Object.values(gameState.players).find(p => p.username === trade.player2);
    
    if (!player1 || !player2) {
      socket.emit('serverAnnouncement', { 
        message: 'Trade partner disconnected.', 
        type: 'error' 
      });
      delete activeTrades[tradeId];
      return;
    }
    
    // Validate both players have enough gold
    if ((player1.gold || 0) < trade.offer1.gold) {
      const socket1 = io.sockets.sockets.get(player1.id);
      if (socket1) {
        socket1.emit('serverAnnouncement', { 
          message: 'You do not have enough gold for this trade.', 
          type: 'error' 
        });
      }
      delete activeTrades[tradeId];
      return;
    }
    
    if ((player2.gold || 0) < trade.offer2.gold) {
      const socket2 = io.sockets.sockets.get(player2.id);
      if (socket2) {
        socket2.emit('serverAnnouncement', { 
          message: 'You do not have enough gold for this trade.', 
          type: 'error' 
        });
      }
      delete activeTrades[tradeId];
      return;
    }
    
    // TODO: Validate items exist in inventory
    // For now, we'll skip item validation since inventory system isn't fully implemented
    
    // Execute the trade
    trade.status = 'completed';
    
    // Exchange gold
    player1.gold = (player1.gold || 0) - trade.offer1.gold + trade.offer2.gold;
    player2.gold = (player2.gold || 0) - trade.offer2.gold + trade.offer1.gold;
    
    // Exchange items
    // Remove items from player1's inventory and add to player2
    trade.offer1.items.forEach(item => {
      // Remove from player1
      const index1 = player1.inventory.findIndex(invItem => 
        invItem.itemId === item.itemId && invItem.quantity >= item.quantity
      );
      if (index1 !== -1) {
        player1.inventory[index1].quantity -= item.quantity;
        if (player1.inventory[index1].quantity <= 0) {
          player1.inventory.splice(index1, 1);
        }
      }
      
      // Add to player2
      const existingItem2 = player2.inventory.find(invItem => 
        invItem.itemId === item.itemId
      );
      if (existingItem2) {
        existingItem2.quantity += item.quantity;
      } else {
        player2.inventory.push({
          itemId: item.itemId,
          quantity: item.quantity
        });
      }
    });
    
    // Remove items from player2's inventory and add to player1
    trade.offer2.items.forEach(item => {
      // Remove from player2
      const index2 = player2.inventory.findIndex(invItem => 
        invItem.itemId === item.itemId && invItem.quantity >= item.quantity
      );
      if (index2 !== -1) {
        player2.inventory[index2].quantity -= item.quantity;
        if (player2.inventory[index2].quantity <= 0) {
          player2.inventory.splice(index2, 1);
        }
      }
      
      // Add to player1
      const existingItem1 = player1.inventory.find(invItem => 
        invItem.itemId === item.itemId
      );
      if (existingItem1) {
        existingItem1.quantity += item.quantity;
      } else {
        player1.inventory.push({
          itemId: item.itemId,
          quantity: item.quantity
        });
      }
    });
    
    // Save to database
    Player.updateOne(
      { username: player1.username },
      { $set: { gold: player1.gold, inventory: player1.inventory } }
    ).exec();
    
    Player.updateOne(
      { username: player2.username },
      { $set: { gold: player2.gold, inventory: player2.inventory } }
    ).exec();
    
    // Notify both players
    const socket1 = io.sockets.sockets.get(player1.id);
    const socket2 = io.sockets.sockets.get(player2.id);
    
    if (socket1) {
      socket1.emit('tradeCompleted', { newGold: player1.gold });
      socket1.emit('inventoryUpdate', player1.inventory);
    }
    if (socket2) {
      socket2.emit('tradeCompleted', { newGold: player2.gold });
      socket2.emit('inventoryUpdate', player2.inventory);
    }
    
    // Clean up trade
    delete activeTrades[tradeId];
  });

  socket.on('cancelTrade', ({ tradeId }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    const trade = activeTrades[tradeId];
    if (!trade) return;
    
    // Check if player is in this trade
    if (trade.player1 !== player.username && trade.player2 !== player.username) return;
    
    // Notify other player
    const otherUsername = trade.player1 === player.username ? trade.player2 : trade.player1;
    const otherPlayer = Object.values(gameState.players).find(p => p.username === otherUsername);
    
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.id);
      if (otherSocket) {
        otherSocket.emit('tradeCancelled');
      }
    }
    
    // Clean up trade
    delete activeTrades[tradeId];
  });

  // Player stats request handler
  socket.on('requestPlayerStats', ({ username }) => {
    const targetPlayer = Object.values(gameState.players).find(p => p.username === username.toLowerCase());
    
    if (!targetPlayer) {
      socket.emit('serverAnnouncement', { 
        message: `Player ${username} not found.`, 
        type: 'error' 
      });
      return;
    }
    
    // Send player stats
    socket.emit('playerStats', {
      username: targetPlayer.username,
      role: targetPlayer.role,
      stats: targetPlayer.stats,
      health: targetPlayer.health,
      maxHealth: targetPlayer.maxHealth,
      gold: targetPlayer.gold || 0
    });
  });
});

// Helper function to handle tomato explosion damage
function handleTomatoExplosion(x, y, radius, damage, ownerId) {
  // Check all players within radius
  for (const playerId in gameState.players) {
    if (playerId === ownerId) continue; // Don't damage shooter
    
    const target = gameState.players[playerId];
    if (target.isDead) continue;
    
    // Check if both players are in the same party (friendly fire protection)
    const shooter = gameState.players[ownerId];
    if (shooter && shooter.party && target.party && shooter.party === target.party) {
      continue; // Skip party members - no friendly fire
    }
    
    // Calculate distance from explosion center
    const distance = Math.sqrt(
      Math.pow(target.x - x, 2) + 
      Math.pow(target.y - y, 2)
    );
    
    // Apply damage if within radius
    if (distance <= radius) {
      // Damage falloff based on distance (full damage at center, 25% at edge)
      const falloff = 1 - (distance / radius) * 0.75;
      const actualDamage = Math.floor(damage * falloff);
      
      target.health = Math.max(0, target.health - actualDamage);
      
      // Track damage stats for tomato explosions
      target.stats = target.stats || {};
      target.stats.damageTaken = (target.stats.damageTaken || 0) + actualDamage;
      
      const attacker = gameState.players[ownerId];
      if (attacker) {
        attacker.stats = attacker.stats || {};
        attacker.stats.damageDealt = (attacker.stats.damageDealt || 0) + actualDamage;
        
        // Update damage stats in database
        Player.updateOne(
          { username: attacker.username },
          { $inc: { 'stats.damageDealt': actualDamage } }
        ).catch(err => console.error('[DB] Error updating tomato damage dealt:', err));
      }
      
      Player.updateOne(
        { username: target.username },
        { $inc: { 'stats.damageTaken': actualDamage } }
      ).catch(err => console.error('[DB] Error updating tomato damage taken:', err));
      
      // Check if player died
      if (target.health <= 0 && !target.isDead) {
        target.isDead = true;
        // Player died from tomato splash
        
        // Get killer information
        const killer = gameState.players[ownerId];
        if (killer) {
          // Update killer stats
          killer.stats = killer.stats || {};
          killer.stats.kills = (killer.stats.kills || 0) + 1;
          killer.stats.currentKillStreak = (killer.stats.currentKillStreak || 0) + 1;
          if (killer.stats.currentKillStreak > (killer.stats.longestKillStreak || 0)) {
            killer.stats.longestKillStreak = killer.stats.currentKillStreak;
          }
          
          // Update victim stats
          target.stats = target.stats || {};
          target.stats.deaths = (target.stats.deaths || 0) + 1;
          target.stats.currentKillStreak = 0;
          
          // Save stats to database
          Player.updateOne(
            { username: killer.username },
            { $inc: { 'stats.kills': 1 },
              $set: { 'stats.currentKillStreak': killer.stats.currentKillStreak,
                      'stats.longestKillStreak': killer.stats.longestKillStreak } }
          ).catch(err => console.error('[DB] Error updating killer stats:', err));
          
          Player.updateOne(
            { username: target.username },
            { $inc: { 'stats.deaths': 1 },
              $set: { 'stats.currentKillStreak': 0 } }
          ).catch(err => console.error('[DB] Error updating victim stats:', err));
          
          io.emit('playerKill', {
            killerName: killer.username,
            killerRole: killer.role || 'player',
            victimName: target.username,
            victimRole: target.role || 'player',
            isHeadshot: false,
            killerStats: killer.stats,
            victimStats: target.stats
          });
        }
        
        // Respawn after 3 seconds
        setTimeout(() => {
          if (gameState.players[playerId]) {
            target.health = target.maxHealth;
            target.isDead = false;
            target.x = 100;
            target.y = 1800;
            io.to(playerId).emit('respawn', { x: target.x, y: target.y });
            console.log(`[RESPAWN] Player ${target.username} respawned`);
          }
        }, 3000);
      }
      
      // Notify all clients about the damage
      io.emit('playerDamaged', { 
        targetId: playerId, 
        damage: actualDamage, 
        bulletX: x, 
        bulletY: y, 
        bulletId: null,
        health: target.health,
        maxHealth: target.maxHealth,
        isHeadshot: false
      });
    }
  }
}

// Helper function to check if player is standing on a block
function isStandingOnBlock(player, buildings) {
  const playerWidth = 32;
  const playerHeight = 64; // Match client hitbox size
  const playerLeft = player.x - playerWidth/2;
  const playerRight = player.x + playerWidth/2;
  const playerBottom = player.y;
  // Allow a small threshold for floating point errors
  const threshold = 2;
  for (const b of buildings) {
    if (b.type === 'tunnel') continue;
    const blockLeft = b.x;
    const blockRight = b.x + 64;
    const blockTop = b.y;
    // Require at least 8px of overlap to stand on a block
    const overlap = Math.min(playerRight, blockRight) - Math.max(playerLeft, blockLeft);
    if (
      overlap > 8 &&
      Math.abs(playerBottom - blockTop) < threshold
    ) {
      return true;
    }
  }
  return false;
}

// Configure mongoose
mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/castlewars', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Function to send player list to GUI
function sendPlayerListToGui() {
  if (guiSocket && guiSocket.writable) {
    const players = [];
    for (const id in gameState.players) {
      const p = gameState.players[id];
      players.push({
        username: p.username,
        role: p.role || 'player',
        health: p.health,
        x: p.x,
        y: p.y,
        socketId: id
      });
    }
    guiSocket.write(JSON.stringify({ type: 'playerList', data: players }) + '\n');
  }
}

// Send player list updates every 2 seconds
setInterval(() => {
  sendPlayerListToGui();
}, 2000);

// Variable to track restart countdown
let restartCountdown = null;

// Function to start server restart countdown
function startRestartCountdown(seconds) {
  // Clear any existing countdown
  if (restartCountdown) {
    clearInterval(restartCountdown.interval);
    restartCountdown = null;
  }
  
  // Save all player data before restart
  saveAllPlayers();
  
  // Handle instant restart
  if (seconds === 0) {
    console.log('[RESTART] Instant restart requested');
    io.emit('serverAnnouncement', { 
      message: '🔄 SERVER IS RESTARTING NOW! 🔄', 
      type: 'error' 
    });
    
    // Disconnect all players gracefully
    disconnectAllPlayers();
    
    // Give more time for IPC response and client disconnections
    setTimeout(() => {
      console.log('[RESTART] Server shutting down for restart...');
      process.exit(0); // Exit cleanly so GUI can restart
    }, 3000); // Increased from 2000ms to 3000ms
    return;
  }
  
  let remaining = seconds;
  
  // Initial announcement
  io.emit('serverAnnouncement', { 
    message: `⚠️ SERVER RESTART IN ${remaining} SECONDS! ⚠️`, 
    type: 'warning' 
  });
  
  restartCountdown = {
    interval: setInterval(() => {
      remaining--;
      
      // Announce at specific intervals
      if (remaining === 60 || remaining === 30 || remaining === 10 || remaining <= 5) {
        io.emit('serverAnnouncement', { 
          message: `⚠️ SERVER RESTART IN ${remaining} SECOND${remaining === 1 ? '' : 'S'}! ⚠️`, 
          type: 'warning' 
        });
      }
      
      // When countdown reaches 0
      if (remaining <= 0) {
        clearInterval(restartCountdown.interval);
        restartCountdown = null;
        
        // Final announcement
        io.emit('serverAnnouncement', { 
          message: '🔄 SERVER IS RESTARTING NOW! 🔄', 
          type: 'error' 
        });
        
        // Disconnect all players gracefully
        disconnectAllPlayers();
        
        // Give clients MORE time to disconnect and return to login before shutdown
        setTimeout(() => {
          console.log('[RESTART] Server shutting down for restart...');
          process.exit(0); // Exit cleanly so GUI can restart
        }, 2000); // 2 seconds total (500ms for disconnect + 1500ms extra)
      }
    }, 1000)
  };
}

// Function to save all player data
async function saveAllPlayers() {
  const savePromises = [];
  
  for (const id in gameState.players) {
    const player = gameState.players[id];
    // Build update object with individual stat fields
    const updateObj = { 
      $set: { 
        x: player.x, 
        y: player.y, 
        inventory: player.inventory, 
        currentWeapon: player.currentWeapon, 
        lastLogin: new Date()
      }
    };
    
    // Add individual stat updates if they exist
    if (player.stats) {
      // Update each stat field individually
      if (player.stats.kills !== undefined) updateObj.$set['stats.kills'] = player.stats.kills;
      if (player.stats.deaths !== undefined) updateObj.$set['stats.deaths'] = player.stats.deaths;
      if (player.stats.headshots !== undefined) updateObj.$set['stats.headshots'] = player.stats.headshots;
      if (player.stats.damageDealt !== undefined) updateObj.$set['stats.damageDealt'] = player.stats.damageDealt;
      if (player.stats.damageTaken !== undefined) updateObj.$set['stats.damageTaken'] = player.stats.damageTaken;
      if (player.stats.shotsHit !== undefined) updateObj.$set['stats.shotsHit'] = player.stats.shotsHit;
      if (player.stats.shotsFired !== undefined) updateObj.$set['stats.shotsFired'] = player.stats.shotsFired;
      if (player.stats.blocksPlaced !== undefined) updateObj.$set['stats.blocksPlaced'] = player.stats.blocksPlaced;
      if (player.stats.blocksDestroyed !== undefined) updateObj.$set['stats.blocksDestroyed'] = player.stats.blocksDestroyed;
      if (player.stats.playTime !== undefined) updateObj.$set['stats.playTime'] = player.stats.playTime;
      if (player.stats.currentKillStreak !== undefined) updateObj.$set['stats.currentKillStreak'] = player.stats.currentKillStreak;
      if (player.stats.longestKillStreak !== undefined) updateObj.$set['stats.longestKillStreak'] = player.stats.longestKillStreak;
      if (player.stats.health !== undefined) updateObj.$set['stats.health'] = player.stats.health;
      if (player.stats.maxHealth !== undefined) updateObj.$set['stats.maxHealth'] = player.stats.maxHealth;
      if (player.stats.attack !== undefined) updateObj.$set['stats.attack'] = player.stats.attack;
      if (player.stats.defense !== undefined) updateObj.$set['stats.defense'] = player.stats.defense;
    }
    
    savePromises.push(
      Player.updateOne(
        { username: player.username },
        updateObj
      )
    );
  }
  
  await Promise.all(savePromises);
  console.log(`[RESTART] Saved data for ${savePromises.length} players`);
}

// Function to disconnect all players
function disconnectAllPlayers() {
  // Send disconnect message to all players FIRST
  io.emit('serverRestart', { message: 'Server is restarting. Please reconnect in a moment.' });
  
  // Give clients time to process the restart message and disconnect themselves
  setTimeout(() => {
    // Force disconnect any remaining sockets
    const sockets = io.sockets.sockets;
    sockets.forEach((socket) => {
      socket.disconnect(true);
    });
    
    // Clear game state
    gameState.players = {};
    
    console.log('[RESTART] All players disconnected');
  }, 500); // 500ms delay for clients to disconnect gracefully
}

// New function to process text commands from GUI directly
async function processGuiCommand(commandStr) {
  console.log('[GUI Command Direct] Processing:', commandStr);
  
  if (!commandStr || typeof commandStr !== 'string') {
    sendLogToGui('Invalid command format', 'error');
    return;
  }
  
  // Parse the command
  const parts = commandStr.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0].startsWith('/')) {
    sendLogToGui('Commands must start with /', 'error');
    return;
  }
  
  const cmd = parts[0].substring(1).toLowerCase(); // Remove / and lowercase
  const args = parts.slice(1);
  
  console.log(`[GUI Command Direct] Command: ${cmd}, Args:`, args);
  
  try {
    switch (cmd) {
      case 'promote':
      case 'role':
        if (args.length < 2) {
          sendLogToGui('Usage: /promote <username> <role>', 'error');
          return;
        }
        const targetUser = args[0].toLowerCase();
        const newRole = args[1].toLowerCase();
        
        // Validate role
        const validRoles = ['player', 'vip', 'mod', 'admin', 'ash', 'owner'];
        if (!validRoles.includes(newRole)) {
          sendLogToGui(`Invalid role. Valid roles: ${validRoles.join(', ')}`, 'error');
          return;
        }
        
        // Update database
        const updateResult = await Player.updateOne(
          { username: targetUser },
          { $set: { role: newRole } }
        );
        
        // Update online player if present
        let onlineUpdated = false;
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === targetUser) {
            player.role = newRole;
            onlineUpdated = true;
            
            // Notify the player
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('roleUpdated', { role: newRole });
              socket.emit('serverAnnouncement', { 
                message: `Your role has been updated to ${newRole}`,
                type: 'info'
              });
            }
            break;
          }
        }
        
        const success = updateResult.modifiedCount > 0 || onlineUpdated;
        const message = success 
          ? `Successfully promoted ${targetUser} to ${newRole}`
          : `Failed to promote ${targetUser} (user not found)`;
        
        sendLogToGui(message, success ? 'success' : 'error');
        if (success) sendPlayerListToGui();
        break;
        
      case 'kick':
        if (args.length < 1) {
          sendLogToGui('Usage: /kick <username>', 'error');
          return;
        }
        const kickTarget = args[0].toLowerCase();
        let kickSuccess = false;
        
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === kickTarget) {
            // Remove from activeUsernames
            if (activeUsernames.get(kickTarget) === socketId) {
              activeUsernames.delete(kickTarget);
            }
            
            // Notify and disconnect
            io.to(socketId).emit('commandResult', { message: 'You have been kicked from the server!' });
            io.sockets.sockets.get(socketId)?.disconnect();
            delete gameState.players[socketId];
            
            kickSuccess = true;
            sendLogToGui(`Kicked ${kickTarget} from the server`, 'success');
            sendPlayerListToGui();
            break;
          }
        }
        
        if (!kickSuccess) {
          sendLogToGui(`Player ${kickTarget} not found online`, 'error');
        }
        break;
        
      case 'ban':
        if (args.length < 1) {
          sendLogToGui('Usage: /ban <username>', 'error');
          return;
        }
        const banTarget = args[0].toLowerCase();
        
        // Update database
        await Player.updateOne(
          { username: banTarget },
          { $set: { banned: true, banDate: new Date() } }
        );
        
        // Add to memory
        bannedUsers.add(banTarget);
        
        // Kick if online
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === banTarget) {
            io.to(socketId).emit('loginError', { message: 'You have been banned from this server!' });
            io.sockets.sockets.get(socketId)?.disconnect(true);
            delete gameState.players[socketId];
            break;
          }
        }
        
        sendLogToGui(`Banned ${banTarget} from the server`, 'success');
        sendPlayerListToGui();
        break;
        
      case 'unban':
        if (args.length < 1) {
          sendLogToGui('Usage: /unban <username>', 'error');
          return;
        }
        const unbanTarget = args[0].toLowerCase();
        
        await Player.updateOne(
          { username: unbanTarget },
          { $unset: { banned: 1, banDate: 1 } }
        );
        
        bannedUsers.delete(unbanTarget);
        sendLogToGui(`Unbanned ${unbanTarget}`, 'success');
        break;
        
      case 'tp':
        if (args.length < 2) {
          sendLogToGui('Usage: /tp <player1> <player2> - Teleports player1 to player2', 'error');
          return;
        }
        const tpFrom = args[0].toLowerCase();
        const tpTo = args[1].toLowerCase();
        
        let fromPlayer = null, toPlayer = null;
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === tpFrom) fromPlayer = player;
          if (player.username === tpTo) toPlayer = player;
        }
        
        if (!fromPlayer || !toPlayer) {
          sendLogToGui(`Player(s) not found online`, 'error');
          return;
        }
        
        fromPlayer.x = toPlayer.x;
        fromPlayer.y = toPlayer.y;
        sendLogToGui(`Teleported ${tpFrom} to ${tpTo}`, 'success');
        break;
        
      case 'announce':
        if (args.length < 1) {
          sendLogToGui('Usage: /announce <message>', 'error');
          return;
        }
        const announcement = args.join(' ');
        io.emit('serverAnnouncement', { message: announcement, type: 'info' });
        sendLogToGui(`Announced: ${announcement}`, 'success');
        break;
        
      case 'resetworld':
        await Building.deleteMany({});
        gameState.buildings = [];
        io.emit('worldState', { 
          players: gameState.players, 
          buildings: [] 
        });
        sendLogToGui('World reset: all buildings deleted', 'success');
        break;
        
      case 'give':
        if (args.length < 3) {
          sendLogToGui('Usage: /give <username> <item> <amount>', 'error');
          return;
        }
        const giveTarget = args[0].toLowerCase();
        const item = args[1];
        const amount = parseInt(args[2]) || 1;
        
        let givePlayer = null;
        let giveSocketId = null;
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === giveTarget) {
            givePlayer = player;
            giveSocketId = socketId;
            break;
          }
        }
        
        if (!givePlayer) {
          sendLogToGui(`Player ${giveTarget} not found`, 'error');
          return;
        }
        
        // Add items to inventory
        for (let i = 0; i < amount; i++) {
          if (givePlayer.inventory.items.length < 30) {
            givePlayer.inventory.items.push(item);
          }
        }
        
        // Notify player
        const socket = io.sockets.sockets.get(giveSocketId);
        if (socket) {
          socket.emit('inventoryUpdate', givePlayer.inventory);
          socket.emit('serverAnnouncement', { 
            message: `You received ${amount} ${item}(s)`,
            type: 'info'
          });
        }
        
        sendLogToGui(`Gave ${amount} ${item}(s) to ${giveTarget}`, 'success');
        break;
        
      case 'clearinv':
        if (args.length < 1) {
          sendLogToGui('Usage: /clearinv <username>', 'error');
          return;
        }
        const clearTarget = args[0].toLowerCase();
        
        // Find player in game state
        let playerFound = false;
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === clearTarget) {
            playerFound = true;
            
            // Reset all inventory-related data
            player.inventory = [];
            player.weaponTypes = []; // No weapons
            player.equippedWeaponIndex = -1;
            player.currentWeapon = null;
            
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              // Send inventory update - send empty array as expected by client
              socket.emit('inventoryUpdate', []);
              
              // Send weapon update with empty weapons array
              socket.emit('weaponLoadoutUpdated', {
                weapons: []
              });
              
              // Force unequip weapon
              socket.emit('weaponEquipped', { 
                weaponType: null,
                weaponIndex: -1
              });
            }
            
            break;
          }
        }
        
        // Also update database
        try {
          const dbPlayer = await Player.findOne({ username: clearTarget });
          if (dbPlayer) {
            dbPlayer.inventory = [];
            await dbPlayer.save();
            sendLogToGui(`Cleared inventory for ${clearTarget} (game state${playerFound ? ' and database' : ' not found, database only'})`, 'success');
          } else if (!playerFound) {
            sendLogToGui(`Player ${clearTarget} not found in game or database`, 'error');
          } else {
            sendLogToGui(`Cleared inventory for ${clearTarget} (game state only, not in database)`, 'warning');
          }
        } catch (error) {
          console.error('Error updating database:', error);
          if (playerFound) {
            sendLogToGui(`Cleared inventory for ${clearTarget} (game state only, database error)`, 'warning');
          } else {
            sendLogToGui(`Failed to clear inventory for ${clearTarget}`, 'error');
          }
        }
        break;
        
      case 'gold':
        if (args.length < 2) {
          sendLogToGui('Usage: /gold <username> <amount>', 'error');
          return;
        }
        const goldTarget = args[0].toLowerCase();
        const goldAmount = parseInt(args[1]) || 0;
        
        // Update database
        await Player.updateOne(
          { username: goldTarget },
          { $inc: { gold: goldAmount } }
        );
        
        // Update online player
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === goldTarget) {
            player.gold = (player.gold || 0) + goldAmount;
            
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('goldUpdate', { gold: player.gold });
              socket.emit('serverAnnouncement', { 
                message: `You received ${goldAmount} gold`,
                type: 'info'
              });
            }
            
            sendLogToGui(`Gave ${goldAmount} gold to ${goldTarget}`, 'success');
            return;
          }
        }
        
        sendLogToGui(`Gave ${goldAmount} gold to ${goldTarget} (offline player)`, 'success');
        break;
        
      case 'fly':
        if (args.length < 1) {
          sendLogToGui('Usage: /fly <username>', 'error');
          return;
        }
        const flyTarget = args[0].toLowerCase();
        
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === flyTarget) {
            player.flyMode = !player.flyMode;
            
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('flyModeUpdate', { flyMode: player.flyMode });
              socket.emit('serverAnnouncement', { 
                message: `Fly mode ${player.flyMode ? 'enabled' : 'disabled'}`,
                type: 'info'
              });
            }
            
            sendLogToGui(`${flyTarget} fly mode: ${player.flyMode ? 'ON' : 'OFF'}`, 'success');
            return;
          }
        }
        
        sendLogToGui(`Player ${flyTarget} not found`, 'error');
        break;
        
      case 'kill':
        if (args.length < 1) {
          sendLogToGui('Usage: /kill <username>', 'error');
          return;
        }
        const killTarget = args[0].toLowerCase();
        
        for (const [socketId, player] of Object.entries(gameState.players)) {
          if (player.username === killTarget) {
            player.health = 0;
            player.isDead = true;
            
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('playerDamaged', { health: 0, isDead: true });
            }
            
            sendLogToGui(`Killed ${killTarget}`, 'success');
            return;
          }
        }
        
        sendLogToGui(`Player ${killTarget} not found`, 'error');
        break;
        
      case 'broadcast':
        if (args.length < 1) {
          sendLogToGui('Usage: /broadcast <message>', 'error');
          return;
        }
        const broadcastMsg = args.join(' ');
        io.emit('serverAnnouncement', { message: broadcastMsg, type: 'info' });
        sendLogToGui(`Broadcast: ${broadcastMsg}`, 'success');
        break;
        
      default:
        sendLogToGui(`Unknown command: ${cmd}`, 'error');
        break;
    }
  } catch (error) {
    console.error('[GUI Command Direct] Error:', error);
    sendLogToGui(`Error executing command: ${error.message}`, 'error');
  }
}

// Function to handle GUI commands (same logic as console commands)
async function handleGuiCommand({ type, data }) {
  switch (type) {
    case 'getPlayers':
      sendPlayerListToGui();
      break;
      
    case 'restartCountdown':
      const seconds = data.seconds || 0;
      console.log(`[IPC] Restart countdown requested: ${seconds} seconds`);
      
      // Send acknowledgment back to GUI first
      if (guiSocket && guiSocket.writable) {
        const response = {
          type: 'restartAck',
          success: true,
          message: `Restart countdown initiated: ${seconds} seconds`
        };
        guiSocket.write(JSON.stringify(response) + '\n');
      }
      
      // Start the countdown after a small delay to ensure response is sent
      setTimeout(() => {
        startRestartCountdown(seconds);
      }, 100);
      break;
      
    case 'shutdownGracefully':
      console.log('[SHUTDOWN] Graceful shutdown requested');
      // Save all players
      saveAllPlayers();
      // Announce shutdown
      io.emit('serverAnnouncement', { 
        message: '⚠️ SERVER SHUTTING DOWN ⚠️', 
        type: 'error' 
      });
      // Disconnect all players
      disconnectAllPlayers();
      // Exit after giving time for disconnections
      setTimeout(() => {
        console.log('[SHUTDOWN] Server shutting down gracefully...');
        process.exit(0);
      }, 2000);
      break;
      
    case 'promote':
      const { username: promoteUser, role } = data;
      const res = await Player.updateOne({ username: promoteUser }, { $set: { role } });
      let found = false;
      for (const id in gameState.players) {
        if (gameState.players[id].username === promoteUser) {
          gameState.players[id].role = role;
          found = true;
          // Notify the player if online
          const socketObj = io.sockets.sockets.get(id);
          if (socketObj) {
            socketObj.emit('roleUpdated', { role });
          }
        }
      }
      if (res.modifiedCount > 0 || found) {
        console.log(`[GUI] Set role of ${promoteUser} to ${role}`);
        if (guiSocket) {
          guiSocket.write(JSON.stringify({ success: true, message: `Promoted ${promoteUser} to ${role}` }));
        }
        sendPlayerListToGui(); // Update GUI with new player list
      }
      break;
      
    case 'demote':
      const demoteUser = data.username;
      const demoteRes = await Player.updateOne({ username: demoteUser }, { $set: { role: 'player' } });
      let demoteFound = false;
      for (const id in gameState.players) {
        if (gameState.players[id].username === demoteUser) {
          gameState.players[id].role = 'player';
          demoteFound = true;
          const socketObj = io.sockets.sockets.get(id);
          if (socketObj) {
            socketObj.emit('roleUpdated', { role: 'player' });
          }
        }
      }
      if (demoteRes.modifiedCount > 0 || demoteFound) {
        console.log(`[GUI] Demoted ${demoteUser} to player`);
        sendPlayerListToGui(); // Update GUI with new player list
      }
      break;
      
    case 'ban':
      const banUser = data.username;
      await Player.updateOne({ username: banUser }, { $set: { banned: true, banDate: new Date() } });
      
      // Add to in-memory ban list
      bannedUsers.add(banUser);
      
      // Kick the player if online
      for (const id in gameState.players) {
        if (gameState.players[id].username === banUser) {
          io.to(id).emit('loginError', { message: 'You have been banned from this server!' });
          io.sockets.sockets.get(id)?.disconnect(true);
          delete gameState.players[id];
          break;
        }
      }
      console.log(`[GUI] Banned ${banUser}`);
      sendPlayerListToGui(); // Update GUI with new player list
      break;
      
    case 'resetworld':
      await Building.deleteMany({});
      gameState.buildings = [];
      io.emit('worldState', { 
        players: gameState.players, 
        buildings: [] 
      });
      console.log('[GUI] World reset: all buildings deleted.');
      break;
      
    case 'announce':
      const message = data.message;
      io.emit('serverAnnouncement', { message, type: 'info' });
      console.log(`[GUI] Announcement: ${message}`);
      break;
      
    case 'kick':
      const kickUser = data.username;
      // Find and kick the player if online
      for (const id in gameState.players) {
        if (gameState.players[id].username === kickUser) {
          // Remove from activeUsernames
          if (activeUsernames.get(kickUser) === id) {
            activeUsernames.delete(kickUser);
          }
          
          io.to(id).emit('commandResult', { message: 'You have been kicked from this server!' });
          io.sockets.sockets.get(id)?.disconnect();
          delete gameState.players[id];
          console.log(`[GUI] Kicked ${kickUser}`);
          sendPlayerListToGui();
          break;
        }
      }
      break;
      
    case 'unban':
      const unbanUser = data.username;
      await Player.updateOne({ username: unbanUser }, { $unset: { banned: 1, banDate: 1 } });
      
      // Remove from in-memory ban list
      bannedUsers.delete(unbanUser);
      
      console.log(`[GUI] Unbanned ${unbanUser}`);
      break;
      
    case 'clearPlayers':
      // Clear all player data
      Object.keys(gameState.players).forEach(id => {
        io.to(id).emit('commandResult', { message: 'Server data cleared. Please reconnect.' });
        io.sockets.sockets.get(id)?.disconnect();
      });
      gameState.players = {};
      activeUsernames.clear();
      console.log('[GUI] Cleared all player data');
      break;
      
    // Command case removed - now handled by processGuiCommand
  }
}

// --- Admin Console Commands ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('Admin console ready. Type: promote <username> <role> OR demote <username>');
rl.on('line', async (input) => {
  const [cmd, username, role] = input.trim().split(/\s+/);
  const usernameLower = username ? username.toLowerCase() : undefined;
  if (cmd === 'promote' && usernameLower && role && ['player','mod','admin','ash','owner'].includes(role)) {
    await handleGuiCommand({ type: 'promote', data: { username: usernameLower, role } });
  } else if (cmd === 'demote' && usernameLower) {
    await handleGuiCommand({ type: 'demote', data: { username: usernameLower } });
  } else if (cmd === 'resetworld') {
    await handleGuiCommand({ type: 'resetworld', data: {} });
  } else {
    console.log('Usage: promote <username> <role> OR demote <username>');
  }
});

// Add status endpoint for home screen
app.get('/auth/status', (req, res) => {
  // Add CORS headers for cross-origin requests
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  const playerCount = Object.keys(gameState.players).length;
  res.json({ 
    status: 'online',
    playerCount: playerCount,
    mode: 'pvp'
  });
});

// Add refresh endpoint
app.post('/refresh', (req, res) => {
  try {
    // Reset game state
    gameState.players = {};
    gameState.buildings = [];
    gameState.sun.elapsed = 0;
    gameState.sun.isDay = true;
    
    // Notify all connected clients to refresh
    io.emit('serverRefresh');
    
    res.json({ message: 'Server refreshed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh server' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 