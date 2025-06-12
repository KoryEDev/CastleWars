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
  pingInterval: 25000
});

// Create IPC server for GUI communication
const ipcServer = createServer();
let guiSocket = null;

ipcServer.on('connection', (socket) => {
  console.log('GUI control panel connected');
  guiSocket = socket;
  
  socket.on('data', (data) => {
    try {
      const command = JSON.parse(data.toString());
      handleGuiCommand(command);
    } catch (err) {
      console.error('Error parsing GUI command:', err);
    }
  });
  
  socket.on('end', () => {
    console.log('GUI control panel disconnected');
    guiSocket = null;
  });
});

// Listen on a local socket for IPC (different port for PvE)
const IPC_PORT = 3003;
ipcServer.listen(IPC_PORT, '127.0.0.1', () => {
  console.log(`[PVE] IPC server listening on port ${IPC_PORT} for GUI commands`);
});

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

// Serve the root index.html (not the one in public)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// --- Server-authoritative game state ---
const TICK_RATE = 16; // ms (about 60 times per second)
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 2000;
const MAX_TOMATOES = 20; // Maximum number of tomato bullets allowed at once

// PvE Mode Constants
const GAME_MODE = 'PVE';
const MAX_PLAYERS_PER_GAME = 8;
const INITIAL_TEAM_LIVES = 20;
const LIVES_PER_WAVE = 5;
const MAX_ACTIVE_NPCS = 100;

const BLOCK_TYPES = [
  'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'
];

// Building health values
const BUILDING_HEALTH = {
  wall: 100,
  door: 50,
  tunnel: 150,
  castle_tower: 200,
  wood: 80,
  gold: 300,
  roof: 60,
  brick: 120
};

const gameState = {
  players: {}, // { id: { id, username, x, y, vx, vy, ... } }
  buildings: [], // { type, x, y, owner, health, maxHealth }
  npcs: {}, // { id: { id, type, x, y, vx, vy, health, ... } }
  // No fortresses in survival mode - just defend yourselves!
  parties: {}, // { partyName: { leader, members: [], teamLives, wave, score } }
  wave: {
    current: 0,
    enemiesRemaining: 0,
    enemiesSpawned: 0,
    totalEnemies: 0,
    spawnTimer: 0,
    betweenWaves: true,
    waveStartTime: 0
  },
  sun: {
    elapsed: 0,
    duration: 300, // 5 minutes for a full day/night cycle
    isDay: true
  },
  bullets: {}, // Track active bullets server-side
  weaponShopArea: null // Will be initialized on startup
};

// Revival tracking
const revivalProgress = {}; // { targetId: { reviverId, progress, startTime } }

// No pre-built structures - let players build their own defenses
function generateSafeZones() {
  console.log(`[PVE] No pre-built structures - players must build their own defenses!`);
}

// Load all buildings from MongoDB on server start
(async () => {
  // Don't load player buildings for PvE mode
  // const allBuildings = await Building.find({});
  // gameState.buildings = allBuildings.map(b => ({ type: b.type, x: b.x, y: b.y, owner: b.owner }));
  
  // Generate safe zones instead of fortresses
  generateSafeZones();
  console.log(`[PVE] Generated safe zones for survival mode`);
  
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

// NPC Configuration
const NPC_TYPES = {
  grunt: {
    health: 50,
    speed: 150,
    damage: 15,
    blockDamage: 25,  // Destroys wall in 4 hits (~4 seconds)
    attackRange: 40,
    attackCooldown: 1000,
    points: 10
  },
  archer: {
    health: 30,
    speed: 100,
    damage: 10,
    blockDamage: 10,  // Weak against blocks
    attackRange: 300,
    attackCooldown: 1500,
    points: 15
  },
  mage: {
    health: 40,
    speed: 80,
    damage: 25,
    blockDamage: 50,  // Strong magic damage
    attackRange: 200,
    attackCooldown: 2500,
    specialCooldown: 10000,
    points: 25
  },
  brute: {
    health: 200,
    speed: 60,
    damage: 40,
    blockDamage: 100,  // Brutes smash walls in 1 hit
    attackRange: 50,
    attackCooldown: 2000,
    points: 50
  },
  siegeTower: {
    health: 500,
    speed: 40,
    damage: 0,
    blockDamage: 200,  // Siege towers demolish walls instantly
    attackRange: 0,
    attackCooldown: 0,
    specialCooldown: 5000,
    points: 100
  },
  assassin: {
    health: 20,
    speed: 250,
    damage: 30,
    blockDamage: 0,
    attackRange: 30,
    attackCooldown: 800,
    specialCooldown: 5000,
    points: 20
  },
  bomber: {
    health: 60,
    speed: 180,
    damage: 100,
    blockDamage: 300,  // Bombers blow through walls
    attackRange: 50,
    attackCooldown: 0,
    points: 30
  },
  necromancer: {
    health: 150,
    speed: 70,
    damage: 20,
    blockDamage: 3,  // Weak against blocks
    attackRange: 250,
    attackCooldown: 2000,
    specialCooldown: 8000,
    points: 75
  },
  skeleton: { // Summoned by necromancer
    health: 30,
    speed: 120,
    damage: 10,
    blockDamage: 1,  // Very weak
    attackRange: 40,
    attackCooldown: 1200,
    points: 5
  }
};

// Wave configuration
const WAVE_CONFIG = {
  // Dynamic time between waves - starts at 10 seconds, scales up
  getTimeBetweenWaves: (waveNumber) => {
    if (waveNumber === 0) return 10000; // First wave: 10 seconds
    if (waveNumber < 5) return 15000; // Waves 1-4: 15 seconds
    if (waveNumber < 10) return 20000; // Waves 5-9: 20 seconds
    if (waveNumber < 20) return 25000; // Waves 10-19: 25 seconds
    return 30000; // Waves 20+: 30 seconds
  },
  spawnInterval: 2000, // 2 seconds between spawns
  
  getWaveComposition: (waveNumber) => {
    const compositions = [];
    
    if (waveNumber <= 5) {
      // Tutorial waves - grunts only
      compositions.push({ type: 'grunt', count: 3 + waveNumber });
    } else if (waveNumber <= 10) {
      // Basic enemies
      compositions.push({ type: 'grunt', count: 5 + Math.floor(waveNumber * 1.5) });
      compositions.push({ type: 'archer', count: 2 + Math.floor(waveNumber * 0.5) });
    } else if (waveNumber <= 15) {
      // Advanced enemies
      compositions.push({ type: 'grunt', count: 8 + Math.floor(waveNumber * 1.5) });
      compositions.push({ type: 'archer', count: 4 + Math.floor(waveNumber * 0.5) });
      compositions.push({ type: 'mage', count: 1 + Math.floor(waveNumber * 0.3) });
      compositions.push({ type: 'assassin', count: 2 + Math.floor(waveNumber * 0.3) });
    } else if (waveNumber <= 20) {
      // Heavy units
      compositions.push({ type: 'grunt', count: 10 + Math.floor(waveNumber * 1.5) });
      compositions.push({ type: 'archer', count: 6 + Math.floor(waveNumber * 0.5) });
      compositions.push({ type: 'mage', count: 2 + Math.floor(waveNumber * 0.3) });
      compositions.push({ type: 'brute', count: 1 + Math.floor(waveNumber * 0.2) });
      compositions.push({ type: 'bomber', count: 2 + Math.floor(waveNumber * 0.2) });
    } else if (waveNumber <= 25) {
      // Siege warfare
      compositions.push({ type: 'grunt', count: 12 + Math.floor(waveNumber * 1.5) });
      compositions.push({ type: 'archer', count: 8 + Math.floor(waveNumber * 0.5) });
      compositions.push({ type: 'mage', count: 3 + Math.floor(waveNumber * 0.3) });
      compositions.push({ type: 'brute', count: 2 + Math.floor(waveNumber * 0.2) });
      compositions.push({ type: 'siegeTower', count: 1 });
    } else {
      // Chaos mode
      compositions.push({ type: 'grunt', count: 15 + Math.floor(waveNumber * 2) });
      compositions.push({ type: 'archer', count: 10 + Math.floor(waveNumber * 0.7) });
      compositions.push({ type: 'mage', count: 5 + Math.floor(waveNumber * 0.4) });
      compositions.push({ type: 'brute', count: 3 + Math.floor(waveNumber * 0.3) });
      compositions.push({ type: 'assassin', count: 5 + Math.floor(waveNumber * 0.4) });
      compositions.push({ type: 'bomber', count: 4 + Math.floor(waveNumber * 0.3) });
      compositions.push({ type: 'siegeTower', count: 1 + Math.floor(waveNumber * 0.05) });
      
      // Add necromancer every 5 waves after 25
      if (waveNumber % 5 === 0) {
        compositions.push({ type: 'necromancer', count: 1 + Math.floor((waveNumber - 25) / 10) });
      }
    }
    
    return compositions;
  },
  
  getHealthMultiplier: (waveNumber) => 1 + (waveNumber * 0.1),
  getDamageMultiplier: (waveNumber) => 1 + (waveNumber * 0.05)
};

// Party system functions
function handlePartyCommand(socket, player, command, target, value) {
  console.log('[PARTY DEBUG] Raw command:', command, 'target:', target, 'value:', value);
  
  // Command already comes as "party create", "party join", etc.
  // So we need to extract just the second word
  const parts = command.split(' ');
  const subCommand = parts[1] || '';
  
  console.log('[PARTY DEBUG] SubCommand:', subCommand);
  
  switch (subCommand) {
    case 'create':
      createParty(socket, player, target);
      break;
    case 'invite':
      inviteToParty(socket, player, target);
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
    case 'start':
      startPartyGame(socket, player);
      break;
    case 'open':
      setPartyOpen(socket, player, true);
      break;
    case 'close':
      setPartyOpen(socket, player, false);
      break;
    case 'listall':
      listAllParties(socket);
      break;
    default:
      console.log('[PARTY DEBUG] Unknown subcommand:', subCommand, 'from command:', command);
      socket.emit('commandResult', { 
        message: 'Party commands: /party create [name], /party invite [player], /party join [name], /party leave, /party list, /party start' 
      });
      socket.emit('serverAnnouncement', { 
        message: 'Party commands: /party create [name], /party invite [player], /party join [name], /party leave, /party list, /party start',
        type: 'info'
      });
  }
}

function createParty(socket, player, partyName) {
  if (!partyName) {
    socket.emit('commandResult', { message: 'Usage: /party create [name]' });
    return;
  }
  
  // Check if player is already in a party
  if (player.party) {
    socket.emit('commandResult', { message: 'You are already in a party. Leave it first.' });
    return;
  }
  
  // Check if party name already exists
  if (gameState.parties[partyName]) {
    socket.emit('commandResult', { message: 'A party with that name already exists.' });
    return;
  }
  
  // Create the party
  gameState.parties[partyName] = {
    name: partyName,
    leader: player.username,
    members: [player.username],
    teamLives: INITIAL_TEAM_LIVES,
    wave: 0,
    score: 0,
    invites: [], // Pending invites
    isOpen: true, // Parties are open by default now
    gameStarted: false // Has the leader started the game?
  };
  
  player.party = partyName;
  console.log('[PARTY] Created party:', partyName, 'by', player.username);
  console.log('[PARTY] Current parties:', Object.keys(gameState.parties));
  console.log('[PARTY] Party details:', gameState.parties[partyName]);
  console.log('[PARTY] Player party assignment:', player.party);
  
  // Send success message to chat using serverAnnouncement
  socket.emit('serverAnnouncement', { 
    message: `Party '${partyName}' created successfully!`,
    type: 'info'
  });
  
  // Also send commandResult for the overlay
  socket.emit('commandResult', { message: `Party '${partyName}' created!` });
  
  // Notify all party members and send party update
  notifyParty(partyName, `${player.username} created the party.`);
  
  // Send initial party update to creator
  socket.emit('partyUpdate', {
    partyName: partyName,
    leader: player.username,
    members: [player.username],
    teamLives: INITIAL_TEAM_LIVES
  });
}

function inviteToParty(socket, player, targetUsername) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) {
    socket.emit('commandResult', { message: 'Party not found.' });
    return;
  }
  
  if (party.leader !== player.username) {
    socket.emit('commandResult', { message: 'Only the party leader can invite players.' });
    return;
  }
  
  // Find target player
  let targetPlayer = null;
  for (const id in gameState.players) {
    if (gameState.players[id].username === targetUsername) {
      targetPlayer = gameState.players[id];
      break;
    }
  }
  
  if (!targetPlayer) {
    socket.emit('commandResult', { message: `Player ${targetUsername} not found.` });
    return;
  }
  
  if (targetPlayer.party) {
    socket.emit('commandResult', { message: `${targetUsername} is already in a party.` });
    return;
  }
  
  if (party.members.length >= MAX_PLAYERS_PER_GAME) {
    socket.emit('commandResult', { message: 'Party is full.' });
    return;
  }
  
  // Add invite
  party.invites.push(targetUsername);
  socket.emit('commandResult', { message: `Invited ${targetUsername} to the party.` });
  
  // Notify target player
  const targetSocket = io.sockets.sockets.get(Object.keys(gameState.players).find(id => gameState.players[id].username === targetUsername));
  if (targetSocket) {
    targetSocket.emit('serverAnnouncement', { 
      message: `You have been invited to party '${player.party}' by ${player.username}. Type /party join ${player.party} to accept.`,
      type: 'info'
    });
  }
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
  
  // Check if invited or party is open
  if (!party.invites.includes(player.username) && !party.isOpen) {
    socket.emit('commandResult', { message: 'You have not been invited to this party. The party is closed.' });
    return;
  }
  
  if (party.members.length >= MAX_PLAYERS_PER_GAME) {
    socket.emit('commandResult', { message: 'Party is full.' });
    return;
  }
  
  // Join the party
  party.members.push(player.username);
  party.invites = party.invites.filter(u => u !== player.username);
  player.party = partyName;
  
  socket.emit('commandResult', { message: `Joined party '${partyName}'!` });
  notifyParty(partyName, `${player.username} joined the party.`);
}

function leaveParty(socket, player) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) {
    socket.emit('commandResult', { message: 'Party not found.' });
    return;
  }
  
  // Remove from party
  party.members = party.members.filter(u => u !== player.username);
  const wasLeader = party.leader === player.username;
  
  // If party is empty OR leader left, delete the party
  if (party.members.length === 0 || wasLeader) {
    // If game is in progress, stop it
    if (party.gameStarted && !gameState.wave.betweenWaves) {
      // Clear all NPCs
      for (const npcId in gameState.npcs) {
        delete gameState.npcs[npcId];
      }
      
      // Reset wave state
      gameState.wave = {
        current: 0,
        betweenWaves: true,
        waveStartTime: 0,
        enemiesSpawned: 0,
        enemiesRemaining: 0,
        totalEnemies: 0
      };
      
      // Notify all members
      notifyParty(player.party, `Party disbanded - ${wasLeader ? 'leader' : 'last member'} left. Game reset.`);
      
      // Emit game over event to all party members
      party.members.forEach(memberName => {
        const memberSocket = findSocketByUsername(memberName);
        if (memberSocket) {
          memberSocket.emit('gameOver', { 
            wave: party.wave || 0, 
            score: party.score || 0,
            reason: 'Party disbanded'
          });
        }
      });
    }
    
    // Remove party reference from all members
    party.members.forEach(memberName => {
      const member = findPlayerByUsername(memberName);
      if (member) {
        member.party = null;
      }
      const memberSocket = findSocketByUsername(memberName);
      if (memberSocket) {
        // Clear party UI for all members
        memberSocket.emit('partyUpdate', {
          partyName: null,
          leader: null,
          members: [],
          teamLives: 0
        });
        memberSocket.emit('partyDisbanded');
      }
    });
    
    // Delete the party before clearing player reference
    const partyName = player.party;
    delete gameState.parties[partyName];
    
    // Clear party for the leaving player too
    player.party = null;
    socket.emit('partyUpdate', {
      partyName: null,
      leader: null,
      members: [],
      teamLives: 0
    });
    
    socket.emit('commandResult', { message: `Left party. Party disbanded${wasLeader ? ' (you were the leader)' : ''}.` });
    
    // Update party list for all players
    io.emit('partyListUpdate');
  } else {
    // Regular member left
    notifyParty(player.party, `${player.username} left the party.`);
    socket.emit('commandResult', { message: 'Left party.' });
    player.party = null;
    socket.emit('partyUpdate', {
      partyName: null,
      leader: null,
      members: [],
      teamLives: 0
    });
    
    // Update party list for all players
    io.emit('partyListUpdate');
  }
}

function listParty(socket, player) {
  console.log('[PARTY LIST DEBUG] Player:', player.username, 'Party:', player.party);
  console.log('[PARTY LIST DEBUG] All parties:', gameState.parties);
  
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    socket.emit('serverAnnouncement', { 
      message: 'You are not in a party.',
      type: 'info'
    });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) {
    socket.emit('commandResult', { message: 'Party not found.' });
    return;
  }
  
  const memberList = party.members.map(m => m === party.leader ? `${m} (Leader)` : m).join(', ');
  socket.emit('commandResult', { 
    message: `Party '${party.name}': ${memberList} | Lives: ${party.teamLives} | Wave: ${party.wave}`
  });
}

function notifyParty(partyName, message) {
  const party = gameState.parties[partyName];
  if (!party) return;
  
  // Send message to all party members
  for (const memberName of party.members) {
    const memberId = Object.keys(gameState.players).find(id => gameState.players[id].username === memberName);
    if (memberId) {
      const memberSocket = io.sockets.sockets.get(memberId);
      if (memberSocket) {
        memberSocket.emit('serverAnnouncement', { 
          message: `[Party] ${message}`,
          type: 'party'
        });
        // Also send party update to refresh UI
        memberSocket.emit('partyUpdate', {
          partyName: partyName,
          leader: party.leader,
          members: party.members,
          teamLives: party.teamLives
        });
      }
    }
  }
}

function listAllParties(socket) {
  const parties = Object.values(gameState.parties);
  if (parties.length === 0) {
    socket.emit('commandResult', { message: 'No parties exist.' });
    socket.emit('serverAnnouncement', { 
      message: 'No parties exist. Create one with /party create [name]',
      type: 'info'
    });
    return;
  }
  
  let message = 'Active parties:\n';
  parties.forEach(party => {
    const status = party.isOpen ? 'OPEN' : 'CLOSED';
    const gameStatus = party.gameStarted ? 'IN GAME' : 'IN LOBBY';
    message += `- ${party.name} (${status}, ${gameStatus}) - Leader: ${party.leader}, Members: ${party.members.length}/${MAX_PLAYERS_PER_GAME}\n`;
  });
  
  socket.emit('commandResult', { message });
  socket.emit('serverAnnouncement', { 
    message: message,
    type: 'info'
  });
}

function setPartyOpen(socket, player, isOpen) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) {
    socket.emit('commandResult', { message: 'Party not found.' });
    return;
  }
  
  if (party.leader !== player.username) {
    socket.emit('commandResult', { message: 'Only the party leader can change party settings.' });
    return;
  }
  
  party.isOpen = isOpen;
  const status = isOpen ? 'open' : 'closed';
  socket.emit('commandResult', { message: `Party is now ${status} to new members.` });
  notifyParty(party.name, `Party is now ${status} to new members.`);
}

function startPartyGame(socket, player) {
  if (!player.party) {
    socket.emit('commandResult', { message: 'You are not in a party.' });
    return;
  }
  
  const party = gameState.parties[player.party];
  if (!party) {
    socket.emit('commandResult', { message: 'Party not found.' });
    return;
  }
  
  if (party.leader !== player.username) {
    socket.emit('commandResult', { message: 'Only the party leader can start the game.' });
    return;
  }
  
  // Check if already in progress
  if (party.wave > 0) {
    socket.emit('commandResult', { message: 'Game already in progress!' });
    return;
  }
  
  // Start the game with countdown
  party.gameStarted = true;
  party.wave = 0;
  gameState.npcs = {}; // Clear any existing NPCs from previous games
  gameState.wave.betweenWaves = true; // Start with countdown
  gameState.wave.waveStartTime = Date.now(); // Start countdown from now
  gameState.wave.current = 0;
  
  console.log('[WAVE] Game started for party:', party.name);
  console.log('[WAVE] Wave state:', { betweenWaves: gameState.wave.betweenWaves, current: gameState.wave.current });
  
  // Show countdown message with dynamic timing
  const countdownMs = WAVE_CONFIG.getTimeBetweenWaves(0);
  const countdownSeconds = Math.floor(countdownMs / 1000);
  socket.emit('commandResult', { message: `Game started! First wave in ${countdownSeconds} seconds!` });
  notifyParty(party.name, `Game started! First wave begins in ${countdownSeconds} seconds!`);
  
  // Emit initial countdown
  io.emit('waveCountdown', { 
    secondsRemaining: countdownSeconds,
    nextWave: 1
  });
}

// Wave system functions
function updateWaveSystem() {
  // Check if any parties are active AND have started the game
  const activeParties = Object.values(gameState.parties).filter(p => p.members.length > 0 && p.gameStarted);
  if (activeParties.length === 0) return;
  
  // For now, handle single party (later we can instance multiple games)
  const party = activeParties[0];
  if (!party || !party.gameStarted) return;
  
  // Check if between waves
  if (gameState.wave.betweenWaves) {
    const timeSinceWaveEnd = Date.now() - gameState.wave.waveStartTime;
    const waveDelay = WAVE_CONFIG.getTimeBetweenWaves(party.wave);
    const timeRemaining = waveDelay - timeSinceWaveEnd;
    
    if (timeRemaining <= 0) {
      startNextWave(party);
    } else {
      // Emit countdown every second
      const secondsRemaining = Math.ceil(timeRemaining / 1000);
      if (!gameState.wave.lastCountdown || gameState.wave.lastCountdown !== secondsRemaining) {
        gameState.wave.lastCountdown = secondsRemaining;
        io.emit('waveCountdown', { 
          secondsRemaining: secondsRemaining,
          nextWave: party.wave + 1
        });
      }
    }
    return;
  }
  
  // Check if all enemies are defeated
  if (gameState.wave.enemiesRemaining === 0 && gameState.wave.enemiesSpawned >= gameState.wave.totalEnemies) {
    endWave(party);
    return;
  }
  
  // Spawn enemies
  gameState.wave.spawnTimer += TICK_RATE;
  if (gameState.wave.spawnTimer >= WAVE_CONFIG.spawnInterval && gameState.wave.enemiesSpawned < gameState.wave.totalEnemies) {
    spawnWaveEnemies();
    gameState.wave.spawnTimer = 0;
  }
}

function startNextWave(party) {
  party.wave++;
  gameState.wave.current = party.wave;
  gameState.wave.betweenWaves = false;
  gameState.wave.enemiesRemaining = 0;
  gameState.wave.enemiesSpawned = 0;
  gameState.wave.waveStartTime = Date.now();
  
  // Reset revive status for all party members
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player.party === party.name) {
      player.hasBeenRevived = false; // Reset for new round
      player.needsRevive = false;
      
      // Revive any dead players for the new round
      if (player.isDead || player.isStunned) {
        player.health = player.maxHealth;
        player.isDead = false;
        player.isStunned = false;
        player.x = 100 + Math.random() * 200;
        player.y = 1800;
        player.vx = 0;
        player.vy = 0;
        
        io.to(playerId).emit('respawn', {
          x: player.x,
          y: player.y,
          newRound: true
        });
        
        console.log(`[NEW ROUND] Player ${player.username} respawned for wave ${party.wave}`);
      }
    }
  }
  
  // Calculate wave composition
  const composition = WAVE_CONFIG.getWaveComposition(party.wave);
  gameState.wave.totalEnemies = composition.reduce((sum, c) => sum + c.count, 0);
  gameState.wave.composition = composition;
  gameState.wave.compositionIndex = 0;
  
  // Award lives for completing previous wave
  if (party.wave > 1) {
    party.teamLives += LIVES_PER_WAVE;
  }
  
  // Check for new NPC abilities
  let abilityMessage = '';
  if (party.wave === 3) {
    abilityMessage = ' WARNING: Enemies can now climb walls!';
  } else if (party.wave === 5) {
    abilityMessage = ' DANGER: Enemies gained multi-jump ability!';
  } else if (party.wave === 8) {
    abilityMessage = ' EXTREME DANGER: Enemies can now stick to walls!';
  }
  
  // Notify players
  io.emit('waveStarted', {
    wave: party.wave,
    enemyCount: gameState.wave.totalEnemies,
    teamLives: party.teamLives
  });
  
  console.log('[WAVE] Started wave', party.wave, 'with', gameState.wave.totalEnemies, 'enemies');
  
  notifyParty(party.name, `Wave ${party.wave} starting! ${gameState.wave.totalEnemies} enemies incoming!${abilityMessage}`);
}

function endWave(party) {
  gameState.wave.betweenWaves = true;
  gameState.wave.waveStartTime = Date.now();
  
  // Calculate score
  const waveScore = party.wave * 100;
  party.score += waveScore;
  
  // Spawn reward items
  spawnWaveRewards();
  
  // Notify players
  io.emit('waveCompleted', {
    wave: party.wave,
    score: party.score,
    teamLives: party.teamLives,
    nextWaveIn: WAVE_CONFIG.timeBetweenWaves / 1000
  });
  
  notifyParty(party.name, `Wave ${party.wave} complete! +${waveScore} score. Next wave in ${WAVE_CONFIG.timeBetweenWaves / 1000} seconds.`);
}

function spawnWaveEnemies() {
  if (!gameState.wave.composition || gameState.wave.compositionIndex >= gameState.wave.composition.length) return;
  
  const currentType = gameState.wave.composition[gameState.wave.compositionIndex];
  if (!currentType || gameState.wave.enemiesSpawned >= currentType.count) {
    gameState.wave.compositionIndex++;
    return;
  }
  
  // Spawn enemy at random edge of map
  const spawnPositions = [
    { x: 100, y: 1800 },  // Left side
    { x: 3900, y: 1800 }, // Right side
    { x: 2000, y: 100 },  // Top middle
  ];
  
  const spawnPos = spawnPositions[Math.floor(Math.random() * spawnPositions.length)];
  const offsetX = (Math.random() - 0.5) * 200;
  const offsetY = (Math.random() - 0.5) * 100;
  
  createNPC(currentType.type, spawnPos.x + offsetX, spawnPos.y + offsetY);
  gameState.wave.enemiesSpawned++;
}

function spawnWaveRewards() {
  // Spawn rewards at random locations near center
  gameState.items = gameState.items || {};
  
  // Spawn 2-3 reward items
  const numRewards = 2 + Math.floor(Math.random() * 2);
  
  for (let i = 0; i < numRewards; i++) {
    const itemType = Math.random() < 0.5 ? 'ammo' : 'health';
    const itemId = `item_${Date.now()}_${itemType}_${i}`;
    
    // Spawn near center of map with some randomness
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT - 200; // Near ground level
    
    gameState.items[itemId] = {
      id: itemId,
      type: itemType,
      x: centerX + (Math.random() - 0.5) * 800,
      y: centerY - Math.random() * 200,
      amount: itemType === 'ammo' ? 100 : 50
    };
  }
  
  io.emit('itemsSpawned', gameState.items);
}

// NPC management functions
function createNPC(type, x, y) {
  const npcId = `npc_${Date.now()}_${Math.random()}`;
  const stats = NPC_TYPES[type];
  if (!stats) return;
  
  // Apply wave scaling
  const healthMultiplier = WAVE_CONFIG.getHealthMultiplier(gameState.wave.current);
  const damageMultiplier = WAVE_CONFIG.getDamageMultiplier(gameState.wave.current);
  
  const npc = {
    id: npcId,
    type: type,
    x: x,
    y: y,
    vx: 0,
    vy: 0,
    health: stats.health * healthMultiplier,
    maxHealth: stats.health * healthMultiplier,
    damage: stats.damage * damageMultiplier,
    blockDamage: stats.blockDamage,
    speed: stats.speed,
    attackRange: stats.attackRange,
    attackCooldown: stats.attackCooldown,
    lastAttackTime: 0,
    state: 'idle',
    target: null,
    targetBlock: null,
    path: [],
    pathIndex: 0,
    lastPathUpdate: 0,
    specialTimer: 0,
    specialCooldown: stats.specialCooldown || 0,
    points: stats.points,
    // Wall-climbing properties
    wallStickTime: 0,
    jumpsRemaining: 1,
    maxJumps: type === 'assassin' ? 3 : 2,
    lastFrameTouchingWall: false,
    isClimbing: false,
    // Movement tracking
    lastPosition: { x: x, y: y },
    lastMoveTime: Date.now(),
    stuckCounter: 0
  };
  
  gameState.npcs[npcId] = npc;
  gameState.wave.enemiesRemaining++;
  
  // Notify clients
  io.emit('npcSpawned', npc);
}

function updateNPCs() {
  for (const npcId in gameState.npcs) {
    const npc = gameState.npcs[npcId];
    if (!npc) continue;
    
    // Define NPC dimensions
    const npcWidth = 32;
    const npcHeight = 64;
    
    // Update AI (this will continuously find nearest player)
    updateNPCAI(npc);
    
    // Apply physics
    npc.x += npc.vx * (TICK_RATE / 1000);
    npc.y += npc.vy * (TICK_RATE / 1000);
    
    // Apply gravity (reduced when wall-sticking)
    if (npc.wallStickTime > 0) {
      npc.vy += 200 * (TICK_RATE / 1000); // Reduced gravity when sticking
      npc.wallStickTime -= TICK_RATE;
    } else {
      npc.vy += 800 * (TICK_RATE / 1000); // Normal gravity
    }
    
    // Check NPC-to-NPC collisions to prevent stacking
    for (const otherNpcId in gameState.npcs) {
      if (otherNpcId === npcId) continue;
      const otherNpc = gameState.npcs[otherNpcId];
      if (!otherNpc) continue;
      
      // Calculate distance between NPCs
      const dx = npc.x - otherNpc.x;
      const dy = npc.y - otherNpc.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If NPCs are too close, push them apart
      const minDistance = npcWidth * 0.8; // Allow slight overlap but prevent stacking
      if (distance < minDistance && distance > 0) {
        // Calculate push direction
        const pushX = (dx / distance) * (minDistance - distance) * 0.5;
        const pushY = (dy / distance) * (minDistance - distance) * 0.5;
        
        // Apply push to both NPCs
        npc.x += pushX;
        npc.y += pushY;
        otherNpc.x -= pushX;
        otherNpc.y -= pushY;
        
        // Add slight random horizontal movement to prevent perfect stacking
        npc.vx += (Math.random() - 0.5) * 50;
        otherNpc.vx += (Math.random() - 0.5) * 50;
      }
    }
    
    // Check building collisions with enhanced wall climbing
    const npcLeft = npc.x - npcWidth / 2;
    const npcRight = npc.x + npcWidth / 2;
    const npcBottom = npc.y;
    const npcTop = npc.y - npcHeight;
    
    let onGround = false;
    let touchingWall = false;
    let wallSide = null; // 'left' or 'right'
    let nearbyBlock = null;
    
    for (const building of gameState.buildings) {
      const blockLeft = building.x;
      const blockRight = building.x + 64;
      const blockTop = building.y;
      const blockBottom = building.y + 64;
      
      // Check collision with solid blocks
      if (['wall', 'castle_tower', 'tunnel', 'roof', 'wood', 'gold', 'brick'].includes(building.type)) {
        // Check for overlap
        if (npcRight > blockLeft && npcLeft < blockRight && 
            npcBottom > blockTop && npcTop < blockBottom) {
          
          const overlapLeft = npcRight - blockLeft;
          const overlapRight = blockRight - npcLeft;
          const overlapTop = npcBottom - blockTop;
          const overlapBottom = blockBottom - npcTop;
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          
          if (minOverlap === overlapTop) {
            // Land on top of block
            npc.y = blockTop;
            npc.vy = 0;
            onGround = true;
            npc.jumpsRemaining = npc.maxJumps || 1; // Reset jumps when landing
          } else if (minOverlap === overlapBottom) {
            // Hit head on block
            npc.y = blockBottom + npcHeight;
            npc.vy = 0;
          } else if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            // Hit side of block - enable wall mechanics
            touchingWall = true;
            wallSide = minOverlap === overlapLeft ? 'right' : 'left';
            nearbyBlock = building;
            
            // Push NPC slightly away from wall to prevent getting stuck
            if (minOverlap === overlapLeft) {
              npc.x = blockLeft - npcWidth / 2 - 1;
            } else {
              npc.x = blockRight + npcWidth / 2 + 1;
            }
            
            // Enhanced wall climbing with progressive abilities
            const waveNumber = Object.values(gameState.parties)[0]?.wave || 0;
            const canWallClimb = waveNumber >= 3; // Wall climbing unlocked at wave 3
            const canMultiJump = waveNumber >= 5; // Multi-jump unlocked at wave 5
            const canWallStick = waveNumber >= 8; // Wall sticking unlocked at wave 8
            
            if (npc.state === 'moving' && npc.target && canWallClimb) {
              // Check if target is significantly above
              if (npc.target.y < npc.y - 100) {
                // Wall stick mechanic
                if (canWallStick && npc.vy > -100) {
                  npc.wallStickTime = 500; // Stick to wall for 500ms
                  npc.vy = Math.max(npc.vy, -50); // Slow fall
                }
                
                // Multi-jump mechanic
                if (canMultiJump && npc.jumpsRemaining > 0) {
                  npc.vy = -500; // Strong jump
                  npc.jumpsRemaining--;
                  npc.isClimbing = true;
                  
                  // Push slightly away from wall when jumping
                  if (wallSide === 'left') {
                    npc.vx = 50; // Push right
                  } else {
                    npc.vx = -50; // Push left
                  }
                } else if (!canMultiJump) {
                  // Basic wall climb (pre-wave 5)
                  npc.vy = -300;
                  npc.isClimbing = true;
                }
              }
            }
          }
        }
        
        // Check if block is obstructing path (for destruction)
        if (npc.state === 'moving' && npc.target && !npc.hasCheckedPath) {
          const distToBlock = Math.sqrt(Math.pow(building.x + 32 - npc.x, 2) + 
                                       Math.pow(building.y + 32 - npc.y, 2));
          
          // Only consider blocks that are actually between us and the target
          if (distToBlock < 100) {
            const angleToTarget = Math.atan2(npc.target.y - npc.y, npc.target.x - npc.x);
            const angleToBlock = Math.atan2(building.y + 32 - npc.y, building.x + 32 - npc.x);
            const angleDiff = Math.abs(angleToTarget - angleToBlock);
            
            // Check if block is directly in path AND player is enclosed
            if (angleDiff < Math.PI / 6) { // Narrower angle (30 degrees)
              // Check if we're stuck and can't reach player
              const timeSinceLastMove = Date.now() - (npc.lastMoveTime || 0);
              if (timeSinceLastMove > 2000 && Math.abs(npc.vx) < 10) {
                // We've been stuck for 2 seconds, player might be enclosed
                npc.targetBlock = building;
              }
            }
          }
        }
      }
    }
    
    // Ground collision
    if (npc.y > 1936) {
      npc.y = 1936;
      npc.vy = 0;
      onGround = true;
      npc.jumpsRemaining = npc.maxJumps || 1; // Reset jumps when landing
    }
    
    // Reset climbing state and jumps based on conditions
    if (onGround) {
      npc.isClimbing = false;
      npc.wallStickTime = 0;
    }
    
    // Reset jumps when touching wall (allows wall jump chains)
    if (touchingWall && !npc.lastFrameTouchingWall) {
      const waveNumber = Object.values(gameState.parties)[0]?.wave || 0;
      if (waveNumber >= 5) { // Multi-jump ability
        npc.jumpsRemaining = Math.min(2, npc.maxJumps || 1); // Allow up to 2 wall jumps
      }
    }
    npc.lastFrameTouchingWall = touchingWall;
    
    // World bounds
    npc.x = Math.max(0, Math.min(WORLD_WIDTH, npc.x));
    
    // Track movement for stuck detection
    const moveDistance = Math.sqrt(
      Math.pow(npc.x - npc.lastPosition.x, 2) + 
      Math.pow(npc.y - npc.lastPosition.y, 2)
    );
    
    if (moveDistance > 5) { // Moved significantly
      npc.lastPosition = { x: npc.x, y: npc.y };
      npc.lastMoveTime = Date.now();
      npc.stuckCounter = 0;
    } else if (npc.state === 'moving' && npc.target) {
      // Not moving much while trying to move
      npc.stuckCounter++;
    }
    
    // Update timers
    npc.specialTimer += TICK_RATE;
  }
}

function updateNPCAI(npc) {
  // ALWAYS update target to nearest player for continuous tracking
  const nearestPlayer = findNearestPlayer(npc);
  if (nearestPlayer && nearestPlayer !== npc.target) {
    npc.target = nearestPlayer;
    // Clear block target when switching to new player target
    if (npc.targetBlock) {
      npc.targetBlock = null;
    }
  }
  
  // If current target is dead or disconnected, immediately find new target
  if (npc.target && (npc.target.isDead || !gameState.players[npc.target.id])) {
    npc.target = findNearestPlayer(npc);
    npc.targetBlock = null;
  }
  
  // State machine
  switch (npc.state) {
    case 'idle':
      if (npc.target) {
        npc.state = 'moving';
      } else {
        // Wander randomly if no target
        if (Math.random() < 0.02) {
          npc.vx = (Math.random() - 0.5) * npc.speed;
        }
      }
      break;
      
    case 'moving':
      if (npc.target) {
        // Re-evaluate if we should switch targets (in case a closer player appeared)
        const currentDist = npc.target ? Math.sqrt(Math.pow(npc.target.x - npc.x, 2) + Math.pow(npc.target.y - npc.y, 2)) : Infinity;
        const nearestDist = nearestPlayer ? Math.sqrt(Math.pow(nearestPlayer.x - npc.x, 2) + Math.pow(nearestPlayer.y - npc.y, 2)) : Infinity;
        
        // Switch to closer target if significantly closer (20% threshold to prevent constant switching)
        if (nearestPlayer && nearestPlayer !== npc.target && nearestDist < currentDist * 0.8) {
          npc.target = nearestPlayer;
          npc.targetBlock = null; // Clear block target when switching
        }
        
        // Check if there's a block in the way that needs destroying
        if (npc.targetBlock) {
          npc.state = 'destroying';
          npc.vx = 0;
        } else {
          moveNPCTowardsTarget(npc);
          
          // Check attack range for player
          if (checkNPCAttackRange(npc)) {
            npc.state = 'attacking';
            npc.vx = 0;
          }
        }
      } else {
        npc.state = 'idle';
      }
      break;
      
    case 'attacking':
      // Continue checking for closer targets even while attacking
      if (nearestPlayer && nearestPlayer !== npc.target) {
        const currentDist = Math.sqrt(Math.pow(npc.target.x - npc.x, 2) + Math.pow(npc.target.y - npc.y, 2));
        const nearestDist = Math.sqrt(Math.pow(nearestPlayer.x - npc.x, 2) + Math.pow(nearestPlayer.y - npc.y, 2));
        
        // Switch if new target is much closer
        if (nearestDist < currentDist * 0.5) {
          npc.target = nearestPlayer;
          npc.state = 'moving';
        }
      }
      
      if (Date.now() - npc.lastAttackTime > npc.attackCooldown) {
        performNPCAttack(npc);
        npc.lastAttackTime = Date.now();
      }
      
      // Check if target moved away or died
      if (!npc.target || npc.target.isDead || !checkNPCAttackRange(npc)) {
        npc.state = 'moving';
      }
      break;
      
    case 'destroying':
      // Attack blocks that are in the way
      if (npc.targetBlock) {
        if (Date.now() - npc.lastAttackTime > npc.attackCooldown) {
          performNPCBlockAttack(npc);
          npc.lastAttackTime = Date.now();
        }
      } else {
        // No more blocks to destroy, go back to moving
        npc.state = 'moving';
      }
      break;
  }
  
  // Type-specific behaviors
  updateNPCSpecialBehavior(npc);
}

function findNearestPlayer(npc) {
  let nearest = null;
  let minDist = Infinity;
  
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player.isDead) continue;
    
    const dist = Math.sqrt(Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2));
    if (dist < minDist) {
      minDist = dist;
      nearest = player;
    }
  }
  
  return nearest;
}

// No longer needed in survival mode - NPCs only target players
function findNearestBuilding(npc) {
  return null;
}

function moveNPCTowardsTarget(npc) {
  if (!npc.target) return;
  
  const targetX = npc.target.x;
  const targetY = npc.target.y;
  
  const angle = Math.atan2(targetY - npc.y, targetX - npc.x);
  
  // Make NPCs more aggressive with speed boost when far from target
  const distToTarget = Math.sqrt(Math.pow(targetX - npc.x, 2) + Math.pow(targetY - npc.y, 2));
  let speedMultiplier = 1.0;
  
  // Speed boost when far from target
  if (distToTarget > 300) {
    speedMultiplier = 1.5; // 50% speed boost when far
  }
  
  // Extra boost for certain aggressive types
  if (npc.type === 'assassin' || npc.type === 'brute') {
    speedMultiplier *= 1.2;
  }
  
  npc.vx = Math.cos(angle) * npc.speed * speedMultiplier;
  
  // Enhanced jumping logic
  // (distToTarget already calculated above)
  
  // Jump if target is above and we're not already jumping
  if (targetY < npc.y - 100 && npc.vy === 0 && distToTarget < 500) {
    npc.vy = -600; // Higher jump
  }
  
  // If we've been stuck for a while, try different strategies
  if (npc.stuckCounter > 15) { // Stuck for ~0.25 seconds - more aggressive
    // Try a high jump
    if (npc.vy === 0) {
      npc.vy = -700; // Extra high jump
    }
    
    // If really stuck (1+ seconds), then consider destroying blocks
    if (npc.stuckCounter > 60) { // More aggressive block destruction
      // Clear existing target block if it's been destroyed
      if (npc.targetBlock && !gameState.buildings.includes(npc.targetBlock)) {
        npc.targetBlock = null;
      }
      
      // Only look for new block if we don't have one
      if (!npc.targetBlock) {
        let bestBlock = null;
        let bestScore = Infinity;
        
        // Look for blocks between NPC and target
        for (const building of gameState.buildings) {
          // Skip if another NPC is already targeting this block
          let blockTaken = false;
          for (const otherId in gameState.npcs) {
            if (otherId !== npc.id && gameState.npcs[otherId].targetBlock === building) {
              blockTaken = true;
              break;
            }
          }
          if (blockTaken) continue;
          
          const blockCenterX = building.x + 32;
          const blockCenterY = building.y + 32;
          
          // Check if block is roughly between NPC and target
          const npcToBlock = Math.sqrt(Math.pow(blockCenterX - npc.x, 2) + Math.pow(blockCenterY - npc.y, 2));
          const blockToTarget = Math.sqrt(Math.pow(targetX - blockCenterX, 2) + Math.pow(targetY - blockCenterY, 2));
          const npcToTarget = distToTarget;
          
          // Block is "between" if going through it is roughly the same distance
          if (npcToBlock + blockToTarget < npcToTarget * 1.3 && npcToBlock < 150) {
            // Score based on how directly in the path it is
            const score = npcToBlock + blockToTarget - npcToTarget;
            
            if (score < bestScore) {
              bestScore = score;
              bestBlock = building;
            }
          }
        }
        
        // Also check for blocks directly below if player is below
        if (!bestBlock && targetY > npc.y + 100) {
          for (const building of gameState.buildings) {
            // Skip if another NPC is targeting
            let blockTaken = false;
            for (const otherId in gameState.npcs) {
              if (otherId !== npc.id && gameState.npcs[otherId].targetBlock === building) {
                blockTaken = true;
                break;
              }
            }
            if (blockTaken) continue;
            
            const blockCenterX = building.x + 32;
            const blockCenterY = building.y + 32;
            
            // Check if block is below NPC and above target
            if (blockCenterY > npc.y && blockCenterY < targetY &&
                Math.abs(blockCenterX - npc.x) < 64) {
              const distToBlock = Math.sqrt(Math.pow(blockCenterX - npc.x, 2) + Math.pow(blockCenterY - npc.y, 2));
              if (distToBlock < 150) {
                bestBlock = building;
                break;
              }
            }
          }
        }
        
        if (bestBlock) {
          npc.targetBlock = bestBlock;
        }
      }
    }
  } else if (Math.abs(npc.vx) < npc.speed * 0.3 && Math.abs(angle) < Math.PI * 0.75 && npc.vy === 0) {
    // Normal stuck jump
    npc.vy = -500;
  }
}

function checkNPCAttackRange(npc) {
  if (!npc.target) return false;
  
  const targetX = npc.target ? npc.target.x : npc.targetBlock.x + 32;
  const targetY = npc.target ? npc.target.y : npc.targetBlock.y + 32;
  const dist = Math.sqrt(Math.pow(targetX - npc.x, 2) + Math.pow(targetY - npc.y, 2));
  
  return dist <= npc.attackRange;
}

function performNPCAttack(npc) {
  if (npc.target) {
    // Attack player
    npc.target.health -= npc.damage;
    
    // Find the socket ID for this player
    let targetSocketId = null;
    for (const id in gameState.players) {
      if (gameState.players[id] === npc.target) {
        targetSocketId = id;
        break;
      }
    }
    
    if (targetSocketId) {
      io.emit('playerDamaged', {
        targetId: targetSocketId,
        damage: npc.damage,
        health: npc.target.health,
        maxHealth: npc.target.maxHealth,
        npcId: npc.id,
        bulletX: npc.x,
        bulletY: npc.y - 32 // NPC center position
      });
      
      if (npc.target.health <= 0 && !npc.target.isDead) {
        killPlayer(targetSocketId, npc);
      }
    }
  }
}

function performNPCBlockAttack(npc) {
  if (!npc.targetBlock) return;
  
  const building = npc.targetBlock;
  
  // Initialize health if not set
  if (building.health === undefined) {
    building.health = BUILDING_HEALTH[building.type] || 100;
    building.maxHealth = building.health;
  }
  
  // Deal damage to the block
  building.health -= npc.blockDamage;
  
  // Emit block damage event
  io.emit('blockDamaged', {
    x: building.x,
    y: building.y,
    health: building.health,
    maxHealth: building.maxHealth,
    damage: npc.blockDamage
  });
  
  // Destroy block if health depleted
  if (building.health <= 0) {
    const index = gameState.buildings.indexOf(building);
    if (index > -1) {
      gameState.buildings.splice(index, 1);
      
      // Emit block destroyed event
      io.emit('blockDestroyed', {
        x: building.x,
        y: building.y,
        destroyedBy: 'npc',
        npcType: npc.type
      });
      
      // Clear target block
      npc.targetBlock = null;
      
      // Give points to party if applicable
      if (Object.keys(gameState.parties).length > 0) {
        const party = Object.values(gameState.parties)[0];
        if (party) {
          party.score = (party.score || 0) + 5; // 5 points per block saved
        }
      }
    }
  }
}

function updateNPCSpecialBehavior(npc) {
  // Type-specific behaviors will be implemented here
  switch (npc.type) {
    case 'mage':
      // Teleport when threatened
      break;
    case 'siegeTower':
      // Deploy enemies when near walls
      break;
    case 'assassin':
      // Stealth behavior
      break;
    case 'bomber':
      // Explode on contact
      break;
    case 'necromancer':
      // Summon skeletons
      break;
  }
}

function killPlayer(playerId, killer) {
  const player = gameState.players[playerId];
  if (!player || player.isDead || player.isStunned) return;
  
  player.isStunned = true;
  player.isDead = true;
  player.stunnedAt = Date.now();
  console.log(`[DOWNED] Player ${player.username} is down (killed by ${killer.type})!`);
  
  const party = gameState.parties[player.party];
  if (!party) return;
  
  // Check if player has already been revived this round
  if (player.hasBeenRevived) {
    // Player is permanently dead for this round
    console.log(`[ELIMINATED] Player ${player.username} eliminated (already used revive)!`);
    notifyParty(party.name, `${player.username} has been eliminated! No more revives this round.`);
    
    // Emit elimination event
    io.emit('playerEliminated', {
      playerId: playerId,
      playerName: player.username,
      killerType: killer.type
    });
    
    // Emit death event to the killed player
    io.to(playerId).emit('playerDied', {
      eliminated: true,
      respawnTime: -1  // No respawn
    });
    
    // Check if all players are eliminated
    let allEliminated = true;
    for (const memberId in gameState.players) {
      const member = gameState.players[memberId];
      if (member.party === player.party && !member.isDead) {
        allEliminated = false;
        break;
      }
    }
    
    if (allEliminated) {
      // Game over
      console.log(`[GAME OVER] All players eliminated!`);
      notifyParty(party.name, `GAME OVER! All players eliminated!`);
      party.gameStarted = false;
      gameState.npcs = {};
      endGame(party);
    }
  } else {
    // Player can be revived
    player.needsRevive = true;
    player.reviveTimeRemaining = 30000; // 30 seconds to revive
    
    notifyParty(party.name, `${player.username} is down! They can be revived by a teammate!`);
    
    // Emit downed event to all players
    io.emit('playerDowned', {
      playerId: playerId,
      playerName: player.username,
      reviveTime: 30000,
      killerType: killer.type
    });
    
    // Emit death event to the killed player with revive info
    io.to(playerId).emit('playerDied', {
      eliminated: false,
      respawnTime: 30000,
      canBeRevived: true
    });
    
    // Start revive countdown
    const reviveInterval = setInterval(() => {
      if (!gameState.players[playerId] || !player.needsRevive) {
        clearInterval(reviveInterval);
        return;
      }
      
      player.reviveTimeRemaining -= 1000;
      
      if (player.reviveTimeRemaining <= 0) {
        // Time's up - player is eliminated
        clearInterval(reviveInterval);
        player.needsRevive = false;
        player.hasBeenRevived = true; // Mark as used their revive chance
        
        console.log(`[ELIMINATED] Player ${player.username} eliminated (revive timer expired)!`);
        notifyParty(party.name, `${player.username} was not revived in time and is eliminated!`);
        
        io.emit('playerEliminated', {
          playerId: playerId,
          playerName: player.username,
          reason: 'timeout'
        });
        
        // Check if all players are eliminated
        let allEliminated = true;
        for (const memberId in gameState.players) {
          const member = gameState.players[memberId];
          if (member.party === player.party && !member.isDead) {
            allEliminated = false;
            break;
          }
        }
        
        if (allEliminated) {
          console.log(`[GAME OVER] All players eliminated!`);
          notifyParty(party.name, `GAME OVER! All players eliminated!`);
          party.gameStarted = false;
          gameState.npcs = {};
          endGame(party);
        }
      }
    }, 1000);
  }
}

function damageBuilding(building, damage) {
  // For now, just remove the building if it takes damage
  // Later we can add health to buildings
  const index = gameState.buildings.findIndex(b => 
    b.x === building.x && b.y === building.y && b.type === building.type
  );
  
  if (index !== -1 && !building.indestructible) {
    gameState.buildings.splice(index, 1);
    
    // Check if it was a fortress core
    for (const fortress of gameState.fortresses) {
      const coreBlock = fortress.buildings.find(b => b.type === 'gold' && b.x === building.x && b.y === building.y);
      if (coreBlock) {
        fortress.coreHealth -= damage;
        if (fortress.coreHealth <= 0) {
          // Fortress destroyed - game over
          const party = Object.values(gameState.parties)[0]; // Get first party
          if (party) {
            endGame(party);
          }
        }
      }
    }
  }
}

function endGame(party) {
  io.emit('gameOver', {
    finalWave: party.wave,
    finalScore: party.score,
    partyName: party.name
  });
  
  notifyParty(party.name, `GAME OVER! Final Wave: ${party.wave}, Score: ${party.score}`);
  
  // Reset game state
  gameState.wave = {
    current: 0,
    enemiesRemaining: 0,
    enemiesSpawned: 0,
    totalEnemies: 0,
    spawnTimer: 0,
    betweenWaves: true,
    waveStartTime: 0
  };
  
  // Clear NPCs
  gameState.npcs = {};
}

// --- Game loop ---
setInterval(() => {
  // Update sun state
  gameState.sun.elapsed += TICK_RATE / 1000; // Convert ms to seconds
  if (gameState.sun.elapsed >= gameState.sun.duration) {
    gameState.sun.elapsed = 0;
    gameState.sun.isDay = !gameState.sun.isDay;
  }
  
  // Periodic ban check - remove any banned players that somehow got through
  for (const id in gameState.players) {
    const player = gameState.players[id];
    if (bannedUsers.has(player.username)) {
      console.log(`[BAN SWEEP] Removing banned player ${player.username} who slipped through`);
      io.to(id).emit('loginError', { message: 'You are banned from this server!' });
      io.sockets.sockets.get(id)?.disconnect(true);
      delete gameState.players[id];
    }
  }
  
  // --- Update PvE Wave System ---
  updateWaveSystem();
  
  // --- Update NPCs ---
  updateNPCs();
  
  // --- Update revive progress ---
  for (const targetId in revivalProgress) {
    const revival = revivalProgress[targetId];
    const reviver = gameState.players[revival.reviverId];
    const target = gameState.players[targetId];
    
    // Check if revival should continue
    if (!reviver || !target || reviver.isDead || !target.isDead || !target.canBeRevived) {
      delete revivalProgress[targetId];
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('revivalCancelled');
      }
      continue;
    }
    
    // Check distance
    const dx = reviver.x - target.x;
    const dy = reviver.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 100) {
      delete revivalProgress[targetId];
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('revivalCancelled');
      }
      continue;
    }
    
    // Update progress
    revival.progress += TICK_RATE;
    
    // Send progress update to reviver
    const reviverSocket = io.sockets.sockets.get(revival.reviverId);
    if (reviverSocket) {
      reviverSocket.emit('reviveProgress', { 
        progress: revival.progress / 3000 
      });
    }
    
    // Check if revival is complete (3 seconds)
    if (revival.progress >= 3000) {
      // Revive the target
      target.health = target.maxHealth;
      target.isDead = false;
      target.isStunned = false;
      target.canBeRevived = false;
      target.hasBeenRevived = true;
      target.vx = 0;
      target.vy = 0;
      
      // Remove revival progress
      delete revivalProgress[targetId];
      
      // Notify target they've been revived
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('respawn', {
          x: target.x,
          y: target.y,
          revivedBy: reviver.username
        });
      }
      
      // Notify everyone of the revival
      io.emit('playerRevived', {
        playerId: targetId,
        reviverName: reviver.username
      });
      
      const party = gameState.parties[reviver.party];
      if (party) {
        notifyParty(party.name, `${reviver.username} revived ${target.username}!`);
      }
      
      // Award points for reviving
      reviver.stats.points = (reviver.stats.points || 0) + 50;
      
      console.log(`[REVIVED] ${target.username} was revived by ${reviver.username}`);
    }
  }

  // --- Update bullets ---
  for (const bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];
    
    // Store the bullet's last valid position for tomatoes
    if (bullet.weaponType === 'tomatogun') {
      bullet.lastX = bullet.x;
      bullet.lastY = bullet.y;
      
      // Check if near any block
      let nearBlock = false;
      let closestDist = Infinity;
      let closestBlock = null;
      
      for (const building of gameState.buildings) {
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
      console.log(`[TOMATO HIT GROUND] at y=${bullet.y}, armed=${isArmed}`);
      
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
        console.log(`[TOMATO OUT OF BOUNDS] at (${bullet.x.toFixed(0)}, ${bullet.y.toFixed(0)})`);
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
      console.log(`[T] Pos:(${bullet.x.toFixed(0)},${bullet.y.toFixed(0)}) Buildings:${gameState.buildings.length}`);
    }
    
    for (const building of gameState.buildings) {
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
          console.log(`[NEAR HIT] Left edge at distance ${distLeft}`);
        }
        else if (distRight < edgeThreshold && verticalOverlap) {
          nearMiss = true;
          impactX = blockRight - edgeOffset + randomOffset();
          impactY = Math.max(blockTop + edgeOffset, Math.min(blockBottom - edgeOffset, bullet.y)) + randomOffset();
          console.log(`[NEAR HIT] Right edge at distance ${distRight}`);
        }
        else if (distTop < edgeThreshold && horizontalOverlap) {
          nearMiss = true;
          impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
          impactY = blockTop + edgeOffset + randomOffset();
          console.log(`[NEAR HIT] Top edge at distance ${distTop}`);
        }
        else if (distBottom < edgeThreshold && horizontalOverlap) {
          nearMiss = true;
          impactX = Math.max(blockLeft + edgeOffset, Math.min(blockRight - edgeOffset, bullet.x)) + randomOffset();
          impactY = blockBottom - edgeOffset + randomOffset();
          console.log(`[NEAR HIT] Bottom edge at distance ${distBottom}`);
        }
      }
      
      // Check collision - tomatoes need to be armed first
      const isArmed = Date.now() - bullet.createdAt >= bullet.armingDelay;
      if ((overlaps || nearMiss) && (bullet.weaponType !== 'tomatogun' || isArmed)) {
        if (bullet.weaponType === 'tomatogun') {
          if (overlaps || nearMiss) {
            console.log(`[TOMATO HIT] Collision detected (overlap:${overlaps}, nearMiss:${nearMiss}) at (${bullet.x.toFixed(0)},${bullet.y.toFixed(0)}) with block at (${building.x},${building.y}), armed=${isArmed}`);
            
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
    
    // Check NPC collisions
    let hitNPC = false;
    for (const npcId in gameState.npcs) {
      const npc = gameState.npcs[npcId];
      if (!npc || npc.health <= 0) continue;
      
      // NPC hitbox
      const npcWidth = 32;
      const npcHeight = 64;
      const npcLeft = npc.x - npcWidth / 2;
      const npcRight = npc.x + npcWidth / 2;
      const npcTop = npc.y - npcHeight;
      const npcBottom = npc.y;
      
      // Check if bullet hits NPC
      const bulletRadius = 4;
      if (bullet.x + bulletRadius >= npcLeft && bullet.x - bulletRadius <= npcRight &&
          bullet.y + bulletRadius >= npcTop && bullet.y - bulletRadius <= npcBottom) {
        
        // Check for headshot (top 20% of NPC height)
        const headThreshold = npcTop + npcHeight * 0.2;
        const isHeadshot = bullet.y <= headThreshold;
        
        // Apply damage to NPC (double damage for headshots)
        const finalDamage = isHeadshot ? bullet.damage * 2 : bullet.damage;
        npc.health -= finalDamage;
        console.log(`[NPC HIT] ${npc.type} ${isHeadshot ? 'HEADSHOT' : 'hit'} for ${finalDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
        
        // Emit NPC damage event for visual feedback
        io.emit('npcDamaged', {
          npcId: npcId,
          damage: finalDamage,
          health: npc.health,
          maxHealth: npc.maxHealth,
          x: npc.x,
          y: npc.y,
          isHeadshot: isHeadshot
        });
        
        // Check if NPC died
        if (npc.health <= 0) {
          // Award points to the shooter's party (bonus for headshots)
          const shooter = gameState.players[bullet.ownerId];
          if (shooter && shooter.party) {
            const party = gameState.parties[shooter.party];
            if (party) {
              const pointsAwarded = isHeadshot ? Math.floor(npc.points * 1.5) : npc.points;
              party.score = (party.score || 0) + pointsAwarded;
              
              // Add points to the individual player as well
              shooter.stats.points = (shooter.stats.points || 0) + pointsAwarded;
              
              const killMessage = isHeadshot ? 
                `${shooter.username} got a HEADSHOT on ${npc.type} (+${pointsAwarded} points!)` :
                `${shooter.username} killed ${npc.type} (+${pointsAwarded} points)`;
              notifyParty(party.name, killMessage);
            }
          }
          
          // Emit NPC death
          io.emit('npcKilled', {
            npcId: npcId,
            npcType: npc.type,
            killerName: shooter ? shooter.username : 'Unknown'
          });
          
          // Remove the NPC
          delete gameState.npcs[npcId];
          gameState.wave.enemiesRemaining--;
        }
        
        hitNPC = true;
        destroyBullet(bulletId, bullet.weaponType === 'tomatogun');
        break;
      }
    }
    
    if (hitNPC) continue;
    
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
      
      // Check if both players are in the same party (friendly fire disabled within parties)
      const attacker = gameState.players[bullet.ownerId];
      if (attacker && attacker.party && player.party && attacker.party === player.party) {
        continue; // Skip damage to party members
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
          
          console.log(`[${isHeadshot ? 'HEADSHOT' : 'HIT'}] Bullet ${bulletId} hit player ${player.username} for ${actualDamage} damage. Health: ${player.health}/${player.maxHealth}`);
          
          // Check if player is downed (PvE mode)
          if (player.health <= 0 && !player.isStunned) {
            player.isStunned = true;
            player.isDead = true; // Keep for compatibility
            player.stunnedAt = Date.now();
            console.log(`[STUNNED] Player ${player.username} is down!`);
            
            // Deduct a team life
            if (player.party) {
              const party = gameState.parties[player.party];
              if (party && party.teamLives > 0) {
                party.teamLives--;
                notifyParty(party.name, `${player.username} is down! Team lives: ${party.teamLives}`);
                
                // Update all party members with new team lives
                for (const member of party.members) {
                  const memberSocket = Object.keys(gameState.players).find(id => 
                    gameState.players[id].username === member
                  );
                  if (memberSocket) {
                    io.to(memberSocket).emit('partyUpdate', {
                      teamLives: party.teamLives,
                      wave: party.wave || 0
                    });
                  }
                }
                
                // Check for game over
                if (party.teamLives <= 0) {
                  console.log(`[GAME OVER] Party ${party.name} has no lives left!`);
                  notifyParty(party.name, `GAME OVER! No team lives remaining!`);
                  party.gameStarted = false;
                  // Clear all NPCs
                  gameState.npcs = {};
                }
              }
            }
            
            // Update stats for PvP if killer is a player
            const killer = gameState.players[bullet.ownerId];
            if (killer) {
              // Only track PvP stats
              killer.stats = killer.stats || {};
              killer.stats.knockdowns = (killer.stats.knockdowns || 0) + 1;
              
              player.stats = player.stats || {};
              player.stats.timesStunned = (player.stats.timesStunned || 0) + 1;
            }
            
            // Emit stunned event to all players
            io.emit('playerStunned', {
              playerId: playerId,
              playerName: player.username,
              teamLives: player.party ? gameState.parties[player.party].teamLives : 0
            });
            
            // Also emit specific death event to the downed player
            io.to(playerId).emit('playerDied', {
              respawnTime: 10000,
              teamLives: player.party ? gameState.parties[player.party].teamLives : 0
            });
            
            // Recovery after 10 seconds (costs 1 team life)
            const STUN_DURATION = 10000; // 10 seconds
            setTimeout(() => {
              if (gameState.players[playerId] && player.isStunned) {
                player.health = player.maxHealth;
                player.isStunned = false;
                player.isDead = false;
                player.x = 100 + Math.random() * 200; // Spawn with some randomness
                player.y = 1800;
                player.vx = 0;
                player.vy = 0;
                
                io.to(playerId).emit('respawn', {
                  x: player.x,
                  y: player.y
                });
                console.log(`[RECOVERED] Player ${player.username} is back up at (${player.x}, ${player.y})!`);
                notifyParty(player.party, `${player.username} recovered!`);
              }
            }, STUN_DURATION);
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
    // Move
    player.x += player.vx;
    player.y += player.vy;

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
      isDead: p.isDead || false, // Include death state for visual feedback
      party: p.party || null // Include party information
    };
  }
  io.emit('worldState', { 
    players: playersWithRole, 
    buildings: gameState.buildings,
    sun: gameState.sun,
    bullets: gameState.bullets,
    weaponShopArea: gameState.weaponShopArea,
    npcs: gameState.npcs,
    wave: gameState.wave,
    parties: gameState.parties,
    gameMode: GAME_MODE
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
    
    console.log(`[TOMATO EXPLODE] Destroying tomato at (${explodeX}, ${explodeY})`);
    
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

// Helper functions
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
  socket.on('join', async ({ username }) => {
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
        points: 0, // Initialize points for PvE mode
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
      currentWeapon: playerDoc.currentWeapon || 'pistol',
      isDead: false,
      sessionStartTime: Date.now(), // Track when this session started
      tutorialCompleted: playerDoc.tutorialCompleted || false,
      aimAngle: 0 // Default aim angle (horizontal)
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
  });

  // Handle player input
  socket.on('playerInput', (input) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
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
        }
      }
    }
  });

  // Handle revive attempt
  socket.on('attemptRevive', (targetPlayerId) => {
    const player = gameState.players[socket.id];
    if (!player || player.isDead) return;
    
    const targetPlayer = gameState.players[targetPlayerId];
    if (!targetPlayer || !targetPlayer.needsRevive) return;
    
    // Check if players are in the same party
    if (player.party !== targetPlayer.party) return;
    
    // Check distance
    const distance = Math.sqrt(
      Math.pow(player.x - targetPlayer.x, 2) + 
      Math.pow(player.y - targetPlayer.y, 2)
    );
    
    if (distance > 100) { // Must be close to revive
      socket.emit('reviveFailed', { reason: 'Too far away!' });
      return;
    }
    
    // Start reviving
    player.isReviving = true;
    player.reviveTarget = targetPlayerId;
    player.reviveProgress = 0;
    
    socket.emit('reviveStarted', { 
      targetId: targetPlayerId,
      targetName: targetPlayer.username,
      reviveTime: 3000 // 3 seconds to revive
    });
    
    // Notify target they're being revived
    io.to(targetPlayerId).emit('beingRevived', {
      reviverId: socket.id,
      reviverName: player.username
    });
  });

  // Handle revive cancel
  socket.on('cancelRevive', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isReviving) return;
    
    player.isReviving = false;
    player.reviveTarget = null;
    player.reviveProgress = 0;
    
    socket.emit('reviveCancelled');
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
          lastLogin: new Date()
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
      
      // Remove from activeUsernames
      if (activeUsernames.get(player.username) === socket.id) {
        activeUsernames.delete(player.username);
        console.log(`[LOGOUT] Released username '${player.username}' from active list`);
      }
      
      // Handle party leaving on disconnect
      if (player.party) {
        leaveParty(socket, player);
      }
      
      // Notify all other players that someone left
      socket.broadcast.emit('playerLeft', {
        username: player.username,
        role: player.role
      });
      
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
      // Don't allow deleting SYSTEM blocks
      if (b.owner === 'SYSTEM') {
        socket.emit('buildingError', 'Cannot delete system structures!');
        return;
      }
      await Building.deleteOne({ x: b.x, y: b.y, type: b.type, owner: b.owner });
      gameState.buildings.splice(idx, 1);
      
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
      
      // Track blocks destroyed
      player.stats = player.stats || {};
      player.stats.blocksDestroyed = (player.stats.blocksDestroyed || 0) + 1;
      
      Player.updateOne(
        { username: player.username },
        { $inc: { 'stats.blocksDestroyed': 1 } }
      ).catch(err => console.error('[DB] Error updating blocks destroyed:', err));
    }
    // Add building with health
    const newBuilding = {
      type: data.type,
      x: data.x,
      y: data.y,
      owner: socket.id,
      health: BUILDING_HEALTH[data.type] || 100,
      maxHealth: BUILDING_HEALTH[data.type] || 100
    };
    gameState.buildings.push(newBuilding);
    
    // Track blocks placed
    player.stats = player.stats || {};
    player.stats.blocksPlaced = (player.stats.blocksPlaced || 0) + 1;
    
    Player.updateOne(
      { username: player.username },
      { $inc: { 'stats.blocksPlaced': 1 } }
    ).catch(err => console.error('[DB] Error updating blocks placed:', err));
    
    console.log(`[BUILDING PLACED] Type: ${data.type} at (${data.x}, ${data.y}) by ${player.username}`);
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
  });

  // Handle party UI requests
  socket.on('requestPartyList', () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Get all parties with their info
    const partyList = [];
    for (const partyName in gameState.parties) {
      const party = gameState.parties[partyName];
      partyList.push({
        name: partyName,
        leader: party.leader,
        members: party.members,
        memberCount: party.members.length,
        isOpen: party.isOpen,
        gameStarted: party.gameStarted,
        wave: party.wave || 0,
        teamLives: party.teamLives
      });
    }
    
    socket.emit('partyList', {
      parties: partyList,
      currentParty: player.party
    });
  });
  
  // Handle quick party creation (using username as party name)
  socket.on('createQuickParty', () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Check if player is already in a party
    if (player.party) {
      socket.emit('partyError', { message: 'You are already in a party. Leave it first.' });
      return;
    }
    
    // Use player's username as party name
    const partyName = `${player.username}'s Party`;
    
    // Check if party name already exists
    if (gameState.parties[partyName]) {
      socket.emit('partyError', { message: 'You already have a party.' });
      return;
    }
    
    // Create the party
    gameState.parties[partyName] = {
      name: partyName,
      leader: player.username,
      members: [player.username],
      teamLives: INITIAL_TEAM_LIVES,
      wave: 0,
      score: 0,
      invites: [],
      isOpen: true, // Open by default
      gameStarted: false
    };
    
    player.party = partyName;
    console.log('[PARTY] Quick party created:', partyName);
    
    // Send success response
    socket.emit('partyCreated', { 
      partyName: partyName,
      message: `Party created successfully!` 
    });
    
    // Send party update
    socket.emit('partyUpdate', {
      partyName: partyName,
      leader: player.username,
      members: [player.username],
      teamLives: INITIAL_TEAM_LIVES
    });
    
    // Notify others
    socket.broadcast.emit('partyListUpdate');
  });
  
  // Handle quick party join
  socket.on('joinPartyQuick', ({ partyName }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Check if player is already in a party
    if (player.party) {
      socket.emit('partyError', { message: 'Leave your current party first.' });
      return;
    }
    
    const party = gameState.parties[partyName];
    if (!party) {
      socket.emit('partyError', { message: 'Party not found.' });
      return;
    }
    
    // Check if party is open or player is invited
    if (!party.isOpen && !party.invites.includes(player.username)) {
      socket.emit('partyError', { message: 'This party is closed. You need an invite.' });
      return;
    }
    
    if (party.members.length >= MAX_PLAYERS_PER_GAME) {
      socket.emit('partyError', { message: 'Party is full.' });
      return;
    }
    
    // Join the party
    party.members.push(player.username);
    player.party = partyName;
    
    // Remove from invites if was invited
    const inviteIndex = party.invites.indexOf(player.username);
    if (inviteIndex > -1) {
      party.invites.splice(inviteIndex, 1);
    }
    
    console.log('[PARTY] Player', player.username, 'joined party:', partyName);
    
    // Send success
    socket.emit('partyJoined', { 
      partyName: partyName,
      message: `Joined ${partyName}!` 
    });
    
    // Update all party members
    for (const member of party.members) {
      const memberSocket = Object.keys(gameState.players).find(id => 
        gameState.players[id].username === member
      );
      if (memberSocket) {
        io.to(memberSocket).emit('partyUpdate', {
          partyName: partyName,
          leader: party.leader,
          members: party.members,
          teamLives: party.teamLives
        });
      }
    }
    
    // Notify party
    notifyParty(partyName, `${player.username} joined the party!`);
    
    // Update party list for all
    io.emit('partyListUpdate');
  });
  
  // Handle quick party leave
  socket.on('leavePartyQuick', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) return;
    
    const party = gameState.parties[player.party];
    if (!party) return;
    
    const wasLeader = party.leader === player.username;
    const partyName = player.party;
    
    // Remove player from party
    const memberIndex = party.members.indexOf(player.username);
    if (memberIndex > -1) {
      party.members.splice(memberIndex, 1);
    }
    
    player.party = null;
    
    socket.emit('partyLeft', { message: 'You left the party.' });
    
    // Send party update to the leaving player to clear their UI
    socket.emit('partyUpdate', {
      partyName: null,
      leader: null,
      members: [],
      teamLives: 0
    });
    
    // Handle empty party or leader leaving
    if (party.members.length === 0) {
      delete gameState.parties[partyName];
      console.log('[PARTY] Deleted empty party:', partyName);
    } else if (wasLeader) {
      // Delete the party and notify all members
      console.log('[PARTY] Leader left, deleting party:', partyName);
      
      // Clear party info for all remaining members
      for (const member of party.members) {
        const memberSocket = Object.keys(gameState.players).find(id => 
          gameState.players[id].username === member
        );
        if (memberSocket && gameState.players[memberSocket]) {
          gameState.players[memberSocket].party = null;
          io.to(memberSocket).emit('partyUpdate', {
            partyName: null,
            leader: null,
            members: [],
            teamLives: 0
          });
          io.to(memberSocket).emit('partyLeft', { 
            message: 'Party was disbanded because the leader left.' 
          });
        }
      }
      
      // Delete the party
      delete gameState.parties[partyName];
      
      // Reset wave if game was in progress
      if (party.gameInProgress) {
        resetWaveSystem();
      }
    } else {
      notifyParty(partyName, `${player.username} left the party.`);
    }
    
    // Update party list for all
    io.emit('partyListUpdate');
  });
  
  // Handle party toggle open/close
  socket.on('togglePartyOpen', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) return;
    
    const party = gameState.parties[player.party];
    if (!party) return;
    
    if (party.leader !== player.username) {
      socket.emit('partyError', { message: 'Only the party leader can change this setting.' });
      return;
    }
    
    party.isOpen = !party.isOpen;
    const status = party.isOpen ? 'open' : 'closed';
    
    socket.emit('partyStatusChanged', { 
      isOpen: party.isOpen,
      message: `Party is now ${status}.`
    });
    
    notifyParty(player.party, `Party is now ${status} to new members.`);
    
    // Update party list for all
    io.emit('partyListUpdate');
  });
  
  // Handle party start game
  socket.on('startPartyGame', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.party) return;
    
    startPartyGame(socket, player);
  });

  // Handle other commands
  socket.on('command', async ({ command, target, value }) => {
    console.log('[COMMAND DEBUG] Received command:', { command, target, value, socketId: socket.id });
    
    const player = gameState.players[socket.id];
    if (!player) {
      console.log('[COMMAND DEBUG] No player found for socket:', socket.id);
      return;
    }
    
    console.log('[COMMAND DEBUG] Command from player:', player.username);
    
    // Handle help command
    if (command === 'help') {
      socket.emit('commandResult', { 
        message: `Available commands:
- /party create [name] - Create a new party
- /party invite [player] - Invite a player to your party  
- /party join [name] - Join a party
- /party leave - Leave your current party
- /party list - Show party members
- /party listall - Show all active parties
- /party open - Allow anyone to join (leader only)
- /party close - Require invites to join (leader only)
- /party start - Start the game (party leader only)
- /help - Show this help message`
      });
      return;
    }
    
    // Test command to verify system is working
    if (command === 'test') {
      console.log('[TEST] Command received from', player.username);
      socket.emit('serverAnnouncement', { 
        message: 'Test command received! System is working.',
        type: 'info'
      });
      socket.emit('commandResult', { message: 'Test successful!' });
      return;
    }
    
    // Debug command to spawn NPC
    if (command === 'spawnnpc' && (player.role === 'owner' || player.role === 'admin')) {
      const npcType = target || 'grunt';
      const validTypes = Object.keys(NPC_TYPES);
      
      if (!validTypes.includes(npcType)) {
        socket.emit('commandResult', { 
          message: `Invalid NPC type. Valid types: ${validTypes.join(', ')}` 
        });
        return;
      }
      
      // Spawn NPC near player
      createNPC(npcType, player.x + 100, player.y - 50);
      
      console.log('[DEBUG] Spawned NPC:', npcType, 'at', player.x + 100, player.y - 50);
      console.log('[DEBUG] Current NPCs:', Object.keys(gameState.npcs).length);
      
      socket.emit('commandResult', { 
        message: `Spawned ${npcType} NPC. Total NPCs: ${Object.keys(gameState.npcs).length}` 
      });
      return;
    }
    
    // Debug command to check player state
    if (command === 'debug') {
      console.log('[DEBUG] Player state:', {
        username: player.username,
        party: player.party,
        socketId: socket.id
      });
      console.log('[DEBUG] All parties:', gameState.parties);
      console.log('[DEBUG] All players:', Object.keys(gameState.players).map(id => ({
        id,
        username: gameState.players[id].username,
        party: gameState.players[id].party
      })));
      
      socket.emit('serverAnnouncement', { 
        message: `Debug: You are ${player.username}, party: ${player.party || 'none'}`,
        type: 'info'
      });
      return;
    }
    
    // Handle party commands first (available to all players)
    if (command === 'party' || command.startsWith('party ')) {
      console.log('[PARTY CMD]', { command, target, value, player: player.username });
      
      // Handle both formats: 
      // Old format: command='party', target='create', value='partyname'
      // New format: command='party create', target='partyname'
      if (command === 'party' && target) {
        // Old format - convert it
        const subCommand = target;
        const partyName = value;
        handlePartyCommand(socket, player, `party ${subCommand}`, partyName, '');
      } else {
        // New format - use as is
        handlePartyCommand(socket, player, command, target, value);
      }
      return;
    }
    
    // Check permissions based on command
    const staffCommands = ['kick', 'ban', 'unban', 'tp', 'tpto', 'fly', 'speed', 'jump', 'teleport'];
    const adminCommands = ['promote', 'demote', 'resetpassword'];
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
  
  // Handle weapon shop request
  socket.on('requestWeaponFromShop', async (weaponType) => {
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
    if (['admin', 'ash', 'owner'].includes(player.role)) {
      validWeapons.push('tomatogun');
    }
    
    if (!validWeapons.includes(weaponType)) {
      socket.emit('weaponShopError', 'Invalid weapon type!');
      return;
    }
    
    // Initialize inventory if needed
    if (!player.inventory) {
      player.inventory = {};
    }
    
    // Add weapon to inventory with level 1 if not already owned
    if (!player.inventory[weaponType]) {
      player.inventory[weaponType] = { level: 1 };
      
      // Save to database
      try {
        await Player.findOneAndUpdate(
          { username: player.username },
          { $set: { [`inventory.${weaponType}`]: { level: 1 } } }
        );
      } catch (error) {
        console.error('[WEAPON SHOP ERROR] Failed to save weapon:', error);
      }
    }
    
    // Add weapon to player's inventory
    socket.emit('addWeaponToInventory', {
      weaponType: weaponType
    });
    
    console.log(`[WEAPON SHOP] Player ${player.username} took ${weaponType} (level ${player.inventory[weaponType].level})`);
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
        
        console.log(`[TOMATO LIMIT] Destroying oldest tomato to make room for new one`);
        destroyBullet(oldestTomato.bulletId, true);
      }
    }
    
    // Add a unique ID to each bullet for tracking
    const bulletId = `${socket.id}_${Date.now()}_${Math.random()}`;
    
    if (data.weaponType === 'tomatogun') {
      const currentCount = Object.values(gameState.bullets).filter(b => b.weaponType === 'tomatogun').length;
      console.log(`[TOMATO CREATED] New tomato bullet ${bulletId} at (${data.x.toFixed(0)}, ${data.y.toFixed(0)}) - will arm in 0.5s (${currentCount + 1}/${MAX_TOMATOES})`);
    }
    
    // Calculate velocity components
    const radians = data.angle * Math.PI / 180;
    const vx = Math.cos(radians) * data.speed;
    const vy = Math.sin(radians) * data.speed;
    
    // Calculate damage with weapon upgrade bonus
    let calculatedDamage = data.damage;
    const weaponType = data.weaponType || 'pistol';
    
    // Apply weapon upgrade bonus if player has upgraded weapon
    if (player.inventory && player.inventory[weaponType] && player.inventory[weaponType].level) {
      const weaponLevel = player.inventory[weaponType].level;
      // 10% damage increase per level
      calculatedDamage = Math.floor(data.damage * (1 + weaponLevel * 0.1));
      console.log(`[WEAPON UPGRADE] ${player.username}'s ${weaponType} level ${weaponLevel} damage: ${data.damage} -> ${calculatedDamage}`);
    }
    
    // Store bullet in game state
    gameState.bullets[bulletId] = {
      x: data.x,
      y: data.y,
      vx: vx,
      vy: vy,
      damage: calculatedDamage,
      ownerId: socket.id,
      bulletId: bulletId,
      weaponType: weaponType,
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
              io.to(playerId).emit('respawn');
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
  
  // Handle revival requests
  socket.on('revivePlayer', ({ targetId }) => {
    const reviver = gameState.players[socket.id];
    const target = gameState.players[targetId];
    
    if (!reviver || !target || reviver.isDead || !target.isDead) {
      return;
    }
    
    // Check if target can be revived and players are in same party
    if (!target.canBeRevived || reviver.party !== target.party) {
      return;
    }
    
    // Check distance
    const dx = reviver.x - target.x;
    const dy = reviver.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 100) {
      return;
    }
    
    // Start revival process
    if (!revivalProgress[targetId]) {
      revivalProgress[targetId] = {
        reviverId: socket.id,
        progress: 0,
        startTime: Date.now()
      };
      
      // Notify target they're being revived
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('beingRevived', { reviverName: reviver.username });
      }
    }
  });
  
  socket.on('cancelRevive', () => {
    // Cancel any revival this player was performing
    for (const targetId in revivalProgress) {
      if (revivalProgress[targetId].reviverId === socket.id) {
        delete revivalProgress[targetId];
        
        // Notify target revival was cancelled
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.emit('revivalCancelled');
        }
      }
    }
  });
  
  // Handle weapon upgrades
  socket.on('upgradeWeapon', async ({ weapon, cost }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
    // Check if player has enough points
    if (!player.stats.points || player.stats.points < cost) {
      socket.emit('weaponShopError', 'Not enough points!');
      return;
    }
    
    // Initialize inventory structure if needed
    if (!player.inventory) {
      player.inventory = {};
    }
    
    // Initialize weapon data if needed
    if (!player.inventory[weapon]) {
      player.inventory[weapon] = { level: 0 };
    }
    
    const currentLevel = player.inventory[weapon].level || 0;
    if (currentLevel >= 5) {
      socket.emit('weaponShopError', 'Weapon already at max level!');
      return;
    }
    
    // Deduct points and upgrade weapon
    player.stats.points -= cost;
    player.inventory[weapon].level = currentLevel + 1;
    
    // Save to database
    try {
      await Player.findOneAndUpdate(
        { username: player.username },
        { 
          $set: { 
            'stats.points': player.stats.points,
            [`inventory.${weapon}`]: player.inventory[weapon]
          }
        }
      );
      
      socket.emit('weaponUpgraded', {
        weapon,
        newLevel: player.inventory[weapon].level,
        remainingPoints: player.stats.points
      });
      
      console.log(`[UPGRADE] ${player.username} upgraded ${weapon} to level ${player.inventory[weapon].level}`);
    } catch (error) {
      console.error('[UPGRADE ERROR]', error);
      // Rollback on error
      player.stats.points += cost;
      player.inventory[weapon].level = currentLevel;
      socket.emit('weaponShopError', 'Upgrade failed! Please try again.');
    }
  });
});

// Helper function to handle tomato explosion damage
function handleTomatoExplosion(x, y, radius, damage, ownerId) {
  // Check all players within radius
  for (const playerId in gameState.players) {
    if (playerId === ownerId) continue; // Don't damage shooter
    
    const target = gameState.players[playerId];
    if (target.isDead) continue;
    
    // Check if both players are in the same party (friendly fire disabled within parties)
    const attacker = gameState.players[ownerId];
    if (attacker && attacker.party && target.party && attacker.party === target.party) {
      continue; // Skip damage to party members
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
        console.log(`[DEATH] Player ${target.username} died from tomato splash`);
        
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
            io.to(playerId).emit('respawn');
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
  
  // Check all NPCs within radius
  for (const npcId in gameState.npcs) {
    const npc = gameState.npcs[npcId];
    if (!npc || npc.health <= 0) continue;
    
    // Calculate distance from explosion center
    const distance = Math.sqrt(
      Math.pow(npc.x - x, 2) + 
      Math.pow(npc.y - y, 2)
    );
    
    // Apply damage if within radius
    if (distance <= radius) {
      // Damage falloff based on distance (full damage at center, 25% at edge)
      const falloff = 1 - (distance / radius) * 0.75;
      const actualDamage = Math.floor(damage * falloff);
      
      npc.health = Math.max(0, npc.health - actualDamage);
      
      console.log(`[TOMATO SPLASH] NPC ${npc.type} hit for ${actualDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
      
      // Emit NPC damage event
      io.emit('npcDamaged', {
        npcId: npcId,
        damage: actualDamage,
        health: npc.health,
        maxHealth: npc.maxHealth,
        x: npc.x,
        y: npc.y,
        isHeadshot: false
      });
      
      // Check if NPC died
      if (npc.health <= 0) {
        // Award points to the shooter
        const shooter = gameState.players[ownerId];
        if (shooter && shooter.party) {
          const party = gameState.parties[shooter.party];
          if (party) {
            const pointsAwarded = npc.points || 10;
            party.score = (party.score || 0) + pointsAwarded;
            shooter.stats.points = (shooter.stats.points || 0) + pointsAwarded;
            notifyParty(party.name, `${shooter.username} killed ${npc.type} with tomato splash (+${pointsAwarded} points)`);
          }
        }
        
        // Emit NPC death
        io.emit('npcKilled', {
          npcId: npcId,
          npcType: npc.type,
          killerName: shooter ? shooter.username : 'Unknown'
        });
        
        // Remove the NPC
        delete gameState.npcs[npcId];
        gameState.wave.enemiesRemaining--;
      }
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
    guiSocket.write(JSON.stringify({ type: 'playerList', data: players }));
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
  
  let remaining = seconds;
  
  // Initial announcement
  io.emit('serverAnnouncement', { 
    message: `⚠️ SERVER RESTART IN ${remaining} SECONDS! ⚠️`, 
    type: 'warning' 
  });
  
  // Save all player data before restart
  saveAllPlayers();
  
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

// Function to handle GUI commands (same logic as console commands)
async function handleGuiCommand({ type, data }) {
  switch (type) {
    case 'getPlayers':
      sendPlayerListToGui();
      break;
      
    case 'restartCountdown':
      const seconds = data.seconds || 0;
      startRestartCountdown(seconds);
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
      
    // PvE specific commands
    case 'spawnNPC':
      const npcType = data.type || 'zombie';
      const npcX = 800 + (Math.random() - 0.5) * 400;
      const npcY = 800 + (Math.random() - 0.5) * 400;
      createNPC(npcType, npcX, npcY);
      console.log(`[GUI] Spawned ${npcType} at ${Math.round(npcX)}, ${Math.round(npcY)}`);
      break;
      
    case 'clearNPCs':
      gameState.npcs = {};
      io.emit('clearNPCs');
      console.log('[GUI] Cleared all NPCs');
      break;
      
    case 'startWave':
      // Start wave for all active parties
      Object.values(gameState.parties).forEach(party => {
        if (party.members.length > 0 && !party.inWave) {
          startNextWave(party);
        }
      });
      console.log('[GUI] Started wave for all active parties');
      break;
      
    case 'endWave':
      // End wave for all parties
      Object.values(gameState.parties).forEach(party => {
        if (party.inWave) {
          endWave(party);
        }
      });
      console.log('[GUI] Ended wave for all parties');
      break;
      
    case 'spawnEnemy':
      // Spawn a random enemy
      const enemyTypes = ['zombie', 'skeleton'];
      const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      const enemyX = 800 + (Math.random() - 0.5) * 600;
      const enemyY = 800 + (Math.random() - 0.5) * 600;
      createNPC(randomType, enemyX, enemyY);
      console.log(`[GUI] Spawned ${randomType} enemy`);
      break;
      
    case 'clearPlayers':
      // Clear all player data
      Object.keys(gameState.players).forEach(id => {
        io.to(id).emit('commandResult', { message: 'Server data cleared. Please reconnect.' });
        io.sockets.sockets.get(id)?.disconnect();
      });
      gameState.players = {};
      gameState.parties = {};
      activeUsernames.clear();
      console.log('[GUI] Cleared all player data');
      break;
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
  const activeParties = Object.values(gameState.parties).filter(p => p.members.length > 0);
  res.json({ 
    status: 'online',
    playerCount: playerCount,
    mode: 'pve',
    parties: activeParties.length,
    currentWave: gameState.wave.current
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

const PORT = process.env.PORT || 3001; // PvE server on different port
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PvE Server running on port ${PORT}`);
}); 