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

// Listen on a local socket for IPC
const IPC_PORT = 3002;
ipcServer.listen(IPC_PORT, '127.0.0.1', () => {
  console.log(`IPC server listening on port ${IPC_PORT} for GUI commands`);
});

app.use(bodyParser.json());

// Rate limiting removed - restored to original state

// CORS is handled by Socket.IO configuration above

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

app.use('/auth', authRouter);

// Serve home.html as the landing page for game.koryenders.com
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
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

const BLOCK_TYPES = [
  'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'
];

const gameState = {
  players: {}, // { id: { id, username, x, y, vx, vy, ... } }
  buildings: [], // { type, x, y, owner }
  // npcs: {}   // Remove or comment out npcs for now
  sun: {
    elapsed: 0,
    duration: 300, // 5 minutes for a full day/night cycle
    isDay: true
  },
  bullets: {}, // Track active bullets server-side
  weaponShopArea: null // Will be initialized on startup
};

// Load all buildings from MongoDB on server start
(async () => {
  const allBuildings = await Building.find({});
  gameState.buildings = allBuildings.map(b => ({ type: b.type, x: b.x, y: b.y, owner: b.owner }));
  
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
          
          // Check if player died
          if (player.health <= 0 && !player.isDead) {
            player.isDead = true;
            console.log(`[DEATH] Player ${player.username} died`);
            
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
              
              console.log(`[STATS] Updated killer ${killer.username} stats:`, killer.stats);
              
              // Update victim stats
              player.stats = player.stats || {};
              player.stats.deaths = (player.stats.deaths || 0) + 1;
              player.stats.currentKillStreak = 0;
              
              console.log(`[STATS] Updated victim ${player.username} stats:`, player.stats);
              
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
            }
            
            // Respawn after 3 seconds
            setTimeout(() => {
              if (gameState.players[playerId]) {
                player.health = player.maxHealth;
                player.isDead = false;
                player.x = 100;
                player.y = 1800;
                io.to(playerId).emit('respawn');
                console.log(`[RESPAWN] Player ${player.username} respawned`);
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
        const jumpForce = player.jumpHeight ? -18 * (player.jumpHeight / 5) : -18;
        player.vy = jumpForce;
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
    // Add building
    gameState.buildings.push({
      type: data.type,
      x: data.x,
      y: data.y,
      owner: socket.id
    });
    
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

  // Handle other commands
  socket.on('command', async ({ command, target, value }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    
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
    if (['admin', 'ash', 'owner'].includes(player.role)) {
      validWeapons.push('tomatogun');
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
    
    // Store bullet in game state
    gameState.bullets[bulletId] = {
      x: data.x,
      y: data.y,
      vx: vx,
      vy: vy,
      damage: data.damage,
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
});

// Helper function to handle tomato explosion damage
function handleTomatoExplosion(x, y, radius, damage, ownerId) {
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