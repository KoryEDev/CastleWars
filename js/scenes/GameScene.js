import MultiplayerManager from '../multiplayer.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { GameUI } from '../ui/GameUI.js';
import { Bullet } from '../entities/Bullet.js';
import { TomatoBullet } from '../entities/TomatoBullet.js';
import { Player } from '../entities/Player.js';
import { Item } from '../entities/Item.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.playerSprite = null;
    this.playerId = null;
    this.username = null;
    this.cursors = null;
    this.multiplayer = null;
    this.groundY = 1936; // Restore original ground Y
    this.worldWidth = 4000;
    this.worldHeight = 2000;
    this.groundImages = [];
    this._worldStateHandler = null;
    this.selectedBuilding = 'wall'; // Default selection
    this.buildingTypes = [
      'wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'roof', 'brick'
    ];
    this.buildingSprites = {
      wall: 'wall',
      door: 'door',
      tunnel: 'tunnel',
      castle_tower: 'castle_tower',
      wood: 'wood',
      gold: 'gold',
      roof: 'roof',
      brick: 'brick'
    };
    this.buildingUI = null;
    this.buildMode = false;
    this.buildGroup = null;
    this.lastRenderedBuildings = [];
    this.previewBlock = null;
    this.commandPromptOpen = false;
    this.commandInput = null;
    this.usernameText = null;
    this.isDragging = false;
    this.lastPlacedTile = null;
    // Store handler references for cleanup
    this._pointerDownHandler = null;
    this._pointerMoveHandler = null;
    this._pointerUpHandler = null;
    this._keydownXHandler = null;
    this._keydownOneHandler = null;
    this._keydownTwoHandler = null;
    this._keydownThreeHandler = null;
    this._keydownFourHandler = null;
    this._keydownFiveHandler = null;
    this._keydownSixHandler = null;
    this._keydownSevenHandler = null;
    this._keydownEightHandler = null;
    this._keydownNineHandler = null;
    this._keydownShiftHandler = null;
    // Sun and lighting
    this.sun = null;
    this.sunStartX = 200;
    this.sunEndX = 1080;
    this.sunStartY = 200;
    this.sunEndY = 600;
    this.sunDuration = 300; // Match server duration
    this.sunElapsed = 0;
    this.lightingOverlay = null;
    this.skyBackground = null;
    this.skyTexture = null; // Cache sky gradient as texture
    this.isDay = true;
    this._lastRenderedBuildingsStr = null;
    this._iconPool = [];
    this._labelPool = [];
    this._keyLabelPool = [];
    this._lastSkyT = -1; // Track last rendered sky time
    this._cloudOffset = 0; // Smooth cloud movement offset
    this._lastCloudUpdate = 0; // Track last cloud update time
  }

  init(data) {
    this.username = data.username;
  }

  preload() {
    this.load.image('ground', 'assets/blocks/ground.png');
    this.load.image('stickman', 'assets/characters/stickman.png');
    this.load.image('stickman_running', 'assets/characters/stickman_running.png');
    this.load.image('wall', 'assets/blocks/wall.png');
    this.load.image('door', 'assets/blocks/door.png');
    this.load.image('tunnel', 'assets/blocks/tunnel.png');
    this.load.image('castle_tower', 'assets/blocks/castle_tower.png');
    this.load.image('wood', 'assets/blocks/wood.png');
    this.load.image('gold', 'assets/blocks/gold.png');
    this.load.image('roof', 'assets/blocks/roof.png');
    this.load.image('brick', 'assets/blocks/brick.png');
    // Preload owner sprites with fallback
    try { this.load.image('stickman_owner', 'assets/characters/stickman_owner.png'); } catch (e) {}
    try { this.load.image('stickman_owner_running', 'assets/characters/stickman_owner_running.png'); } catch (e) {}
    // Preload admin sprites with fallback (using owner sprites for now)
    try { this.load.image('stickman_admin', 'assets/characters/stickman_admin.png'); } catch (e) {}
    try { this.load.image('stickman_admin_running', 'assets/characters/stickman_admin_running.png'); } catch (e) {}
    // Preload mod sprites with fallback
    try { this.load.image('stickman_mod', 'assets/characters/stickman_mod.png'); } catch (e) {}
    try { this.load.image('stickman_running_mod', 'assets/characters/stickman_running_mod.png'); } catch (e) {}
    // Preload placeholder for items
    this.load.image('item_placeholder', 'assets/item_placeholder.png');
    
    // Load weapon assets
    this.load.image('pistol', 'assets/weapons/pistol.png');
    this.load.image('shotgun', 'assets/weapons/shotgun.png');
    this.load.image('rifle', 'assets/weapons/rifle.png');
    this.load.image('sniper', 'assets/weapons/sniper.png');
    this.load.image('bullet', 'assets/weapons/bullet.png');
    this.load.image('muzzle_flash', 'assets/weapons/bullet.png'); // Using bullet sprite for muzzle flash temporarily
    
    // Load tomato gun assets (admin+ only)
    this.load.image('tomatogun', 'assets/Staff Items/TomatoGun.png');
    this.load.image('tomatogunfull', 'assets/Staff Items/TomatoGunFull.png');
    this.load.image('tomato', 'assets/Staff Items/Tomato.png');
    this.load.image('tomato_splatter', 'assets/Staff Items/splat.png');
    
    // Add error handler for splat image
    this.load.on('filecomplete-image-tomato_splatter', () => {
      console.log('Splat image loaded successfully');
    });
    this.load.on('loaderror', (file) => {
      if (file.key === 'tomato_splatter') {
        console.error('Failed to load splat image:', file);
      }
    });
    
    // Load item assets
    this.load.svg('health_potion', 'assets/items/health_potion.svg', { width: 32, height: 32 });
    this.load.svg('speed_boost', 'assets/items/speed_boost.svg', { width: 32, height: 32 });
    this.load.svg('shield', 'assets/items/shield.svg', { width: 32, height: 32 });
    this.load.svg('ammo_box', 'assets/items/ammo_box.svg', { width: 32, height: 32 });
    this.load.svg('damage_boost', 'assets/items/damage_boost.svg', { width: 32, height: 32 });
  }

  create() {
    console.log('GameScene create started');
    
    // Prevent context menu on the entire document
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    
    this.drawGround();

    // UI panel width
    const uiWidth = 350;
    
    // Set camera and world bounds normally
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.physics && this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    // Camera smoothing
    this.cameras.main.setLerp(0.15, 0.15);
    
    // Create the enhanced UI system AFTER setting up camera
    this.gameUI = new GameUI(this);
    
    // Set viewport to only use the area not covered by UI
    const gameSize = this.scale.gameSize;
    this.cameras.main.setViewport(uiWidth, 0, gameSize.width - uiWidth, gameSize.height);
    
    // Tutorial check moved to after multiplayer connection
    
    // Handle window resize
    this.scale.on('resize', (gameSize) => {
      // Re-adjust viewport on resize
      this.cameras.main.setViewport(uiWidth, 0, gameSize.width - uiWidth, gameSize.height);
    });

    // Input
    this.cursors = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Multiplayer
    this.multiplayer = new MultiplayerManager(this);
    this.multiplayer.connect(this.username);


    // Create inventory UI
    this.inventoryUI = new InventoryUI(this, (newInventory) => {
      // Send updated inventory to server
      if (this.multiplayer && this.multiplayer.socket) {
        this.multiplayer.socket.emit('updateInventory', newInventory);
      }
    });
    
    // Build UI is now in the left panel - no need for separate hotbar
    

    // Remove any previous worldState handler before adding a new one
    if (this._worldStateHandler && this.multiplayer.socket) {
      this.multiplayer.socket.off('worldState', this._worldStateHandler);
    }
    this._worldStateHandler = (state) => {
      if (!this.playerId) {
        this.playerId = this.multiplayer.localId;
        console.log('Local player ID set:', this.playerId);
        // Set building order from player state
        const playerState = state.players[this.playerId];
        if (playerState && playerState.buildingOrder) {
          this.buildingTypes = playerState.buildingOrder;
        }
      }
      // Handle all players
      for (const id in state.players) {
        const playerData = state.players[id];
        let playerSprite = null;
        let usernameText = null;
        // Find existing sprite or create new one
        if (id === this.playerId) {
          playerSprite = this.playerSprite;
          usernameText = this.usernameText;
          // Update local player's health from server state
          if (this.playerSprite && playerData) {
            this.playerSprite.health = playerData.health !== undefined ? playerData.health : 100;
            this.playerSprite.maxHealth = playerData.maxHealth !== undefined ? playerData.maxHealth : 100;
          }
          // Check if username text already exists on the sprite
          if (playerSprite && playerSprite.usernameText) {
            usernameText = playerSprite.usernameText;
            if (id === this.playerId) {
              this.usernameText = usernameText;
            }
          }
        } else {
          // Find existing sprite for other players
          const existingSprite = this.children.list.find(child =>
            child instanceof Phaser.GameObjects.Sprite &&
            child.playerId === id &&
            child.texture && // Ensure it's a valid sprite
            (child.texture.key === 'stickman' || child.texture.key === 'stickman_owner' || 
             child.texture.key === 'stickman_admin' || child.texture.key === 'stickman_mod' || 
             child.texture.key === 'stickman_running' || child.texture.key === 'stickman_owner_running' ||
             child.texture.key === 'stickman_admin_running' || child.texture.key === 'stickman_running_mod')
          );
          if (existingSprite) {
            playerSprite = existingSprite;
            // Use the username text attached to the sprite if it exists
            usernameText = playerSprite.usernameText;
            // Clean up any orphaned username texts for this player
            this.children.list.forEach(child => {
              if (child instanceof Phaser.GameObjects.Text &&
                  child.playerId === id &&
                  child !== usernameText) {
                console.log('Destroying orphaned username text for player:', id);
                child.destroy();
              }
            });
          }
        }
        if (playerData) {
          if (!playerSprite) {
            console.log('Creating player sprite for ID:', id);
            // Use appropriate sprite based on role
            let spriteKey;
            if (playerData.role === 'owner') {
              spriteKey = this.textures.exists('stickman_owner') ? 'stickman_owner' : 'stickman';
            } else if (playerData.role === 'admin') {
              spriteKey = this.textures.exists('stickman_admin') ? 'stickman_admin' : 'stickman';
            } else if (playerData.role === 'mod') {
              spriteKey = this.textures.exists('stickman_mod') ? 'stickman_mod' : 'stickman';
            } else {
              spriteKey = 'stickman';
            }

            playerSprite = this.physics.add.sprite(playerData.x, playerData.y, spriteKey)
              .setOrigin(0.5, 1)
              .setDepth(1000);
            playerSprite.playerId = id;
            
            // Add physics properties for collision detection
            // Full hitbox including head
            playerSprite.body.setSize(32, 64);
            playerSprite.body.setOffset(16, 0);
            
            // Add to playerGroup for collision detection
            this.playerGroup.add(playerSprite);
            
            // Add necessary methods for remote players
            playerSprite.takeDamage = function(damage) {
              // Just show visual effect for remote players
              // Server handles actual damage
              this.setTint(0xff0000);
              this.scene.time.delayedCall(200, () => {
                this.setTint(0xffffff);
              });
            };
            
            // Store health properties
            playerSprite.health = playerData.health || 100;
            playerSprite.maxHealth = playerData.maxHealth || 100;

            // Create ammo indicator background
            const ammoBg = this.add.rectangle(playerData.x, playerData.y + 60, 80, 24, 0x000000, 0.7)
              .setOrigin(0.5, 0.5)
              .setDepth(1999)
              .setVisible(false);
            playerSprite.ammoBg = ammoBg;
            
            // Create ammo indicator for the player
            const ammoText = this.add.text(playerData.x, playerData.y + 60, '', {
              fontSize: '16px',
              fontFamily: 'Arial',
              color: '#ffff00',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 4
            })
            .setOrigin(0.5, 0.5)
            .setDepth(2000) // Very high depth to ensure visibility
            .setVisible(false); // Hidden by default
            playerSprite.ammoText = ammoText;

            // Create health bar background
            const healthBarBg = this.add.graphics();
            healthBarBg.playerId = id;
            healthBarBg.type = 'healthBarBg';
            playerSprite.healthBarBg = healthBarBg;

            // Create health bar
            const healthBar = this.add.graphics();
            healthBar.playerId = id;
            healthBar.type = 'healthBar';
            playerSprite.healthBar = healthBar;

            // Create username text (will be inside health bar)
            const roleSymbols = {
              'owner': '',  // Using image instead
              'admin': '★',
              'mod': '◆',
              'player': ''
            };
            const symbol = roleSymbols[playerData.role] || '';
            let displayName = playerData.username.charAt(0).toUpperCase() + playerData.username.slice(1);
            
            // Truncate long usernames
            const maxLength = 12;
            if (displayName.length > maxLength) {
              displayName = displayName.substring(0, maxLength - 2) + '..';
            }
            
            usernameText = this.add.text(playerData.x, playerData.y - 70, 
              symbol + displayName, {
              fontSize: '14px',
              fontFamily: 'Arial',
              color: '#ffffff',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 2
            })
            .setOrigin(0.5, 0.5)
            .setDepth(1003);
            usernameText.playerId = id;
            playerSprite.usernameText = usernameText;
            
            // Apply role-specific styling
            const roleColors = {
              'owner': '#ffe066',
              'admin': '#9b59b6',
              'mod': '#95a5a6',
              'player': '#ffffff'
            };
            usernameText.setColor(roleColors[playerData.role] || roleColors.player);
            
            // Add contrasting stroke for staff roles
            if (playerData.role === 'owner') {
              usernameText.setStroke('#000000', 4);
              usernameText.setShadow(2, 2, '#000000', 2, false, true);
            } else if (playerData.role === 'admin') {
              usernameText.setStroke('#ffffff', 3);
              usernameText.setShadow(1, 1, '#000000', 2, false, true);
            } else if (playerData.role === 'mod') {
              usernameText.setStroke('#000000', 4);
              usernameText.setShadow(1, 1, '#000000', 2, false, true);
            }

            if (id === this.playerId) {
              this.playerSprite = playerSprite;
              this.usernameText = usernameText;
              this.cameras.main.startFollow(this.playerSprite);
              // Ensure camera is centered on player in the viewport
              const viewportCenterX = this.cameras.main.centerX;
              const viewportCenterY = this.cameras.main.centerY;
              this.cameras.main.scrollX = this.playerSprite.x - viewportCenterX;
              this.cameras.main.scrollY = this.playerSprite.y - viewportCenterY;
              
              // Force local player name to be visible
              if (this.usernameText) {
                this.usernameText.setVisible(true);
                this.usernameText.setAlpha(1);
                console.log('Local player name set:', this.usernameText.text);
              }
            }
          }
          // Update position
          playerSprite.setPosition(playerData.x, playerData.y);
          if (playerSprite.body) {
            playerSprite.body.x = playerData.x - playerSprite.body.width / 2;
            playerSprite.body.y = playerData.y - playerSprite.body.height;
            playerSprite.body.velocity.x = 0;
            playerSprite.body.velocity.y = 0;
          }
          
          // Update health bar for all players (except local player who has it in UI)
          if (playerSprite.healthBarBg && playerSprite.healthBar && id !== this.playerId) {
            const barWidth = 60;
            const barHeight = 20;
            const barX = playerData.x - barWidth / 2;
            const barY = playerData.y - 85; // Raised from -80 to -85

            // Clear previous graphics
            playerSprite.healthBarBg.clear();
            playerSprite.healthBar.clear();

            // Draw background with rounded corners
            playerSprite.healthBarBg.fillStyle(0x000000, 0.7);
            playerSprite.healthBarBg.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
            playerSprite.healthBarBg.setDepth(1001);

            // Draw health - ensure we're using the latest health from server
            const health = playerData.health !== undefined ? playerData.health : 100;
            const maxHealth = playerData.maxHealth !== undefined ? playerData.maxHealth : 100;
            const healthPercent = Math.max(0, Math.min(1, health / maxHealth));
            const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
            
            if (healthPercent > 0) {
              playerSprite.healthBar.fillStyle(healthColor, 1);
              playerSprite.healthBar.fillRoundedRect(barX, barY, barWidth * healthPercent, barHeight, 3);
            }
            playerSprite.healthBar.setDepth(1002);
            
            // Store health on sprite for debugging
            playerSprite.currentHealth = health;
            playerSprite.currentMaxHealth = maxHealth;
            
            // Update game UI for local player
            if (id === this.playerId) {
              if (this.gameUI) {
                this.gameUI.updateHealth(health, maxHealth);
                
                // Update stats display
                if (playerData.stats && this.gameUI.updateStats) {
                  console.log('[STATS UPDATE] Received stats from server:', playerData.stats);
                  this.gameUI.updateStats(playerData.stats);
                } else {
                  console.log('[STATS UPDATE] No stats available:', {
                    hasStats: !!playerData.stats,
                    hasUpdateStats: !!(this.gameUI && this.gameUI.updateStats),
                    gameUI: !!this.gameUI
                  });
                }
              }
              
              // Check if player should be dead but isn't marked as such
              if (health <= 0 && this.playerSprite && !this.playerSprite.isDead) {
                this.playerSprite.die();
              }
            }
          }
          
          if (usernameText || playerSprite.usernameText) {
            const nameText = usernameText || playerSprite.usernameText;
            nameText.setPosition(playerData.x, playerData.y - 75); // Centered in health bar
            // Hide local player's name (shown in UI panel)
            nameText.setVisible(id !== this.playerId);
            
            // Update ammo text position if it exists
            if (playerSprite.ammoText) {
              playerSprite.ammoText.setPosition(playerData.x, playerData.y + 60);
              if (playerSprite.ammoBg) {
                playerSprite.ammoBg.setPosition(playerData.x, playerData.y + 60);
              }
              // Only show ammo text for the local player
              if (id === this.playerId && this.playerSprite && this.playerSprite.weapon && this.playerSprite.currentWeaponId) {
                const weaponState = this.playerSprite.weaponStateManager.getWeaponState(
                  this.playerSprite.currentWeaponId, 
                  this.playerSprite.weapon.type
                );
                const ammoString = `${weaponState.currentAmmo}/${weaponState.magazineSize}`;
                playerSprite.ammoText.setText(ammoString);
                playerSprite.ammoText.setVisible(true);
                
                // Change color based on ammo level
                if (weaponState.currentAmmo === 0) {
                  playerSprite.ammoText.setColor('#ff0000'); // Red when empty
                } else if (weaponState.currentAmmo <= weaponState.magazineSize * 0.3) {
                  playerSprite.ammoText.setColor('#ffa500'); // Orange when low
                } else {
                  playerSprite.ammoText.setColor('#ffff00'); // Yellow normally
                }
                
                // Show "RELOADING" if reloading
                if (weaponState.isReloading) {
                  playerSprite.ammoText.setText('RELOADING');
                  playerSprite.ammoText.setColor('#00ff00'); // Green when reloading
                }
              } else {
                playerSprite.ammoText.setVisible(false);
              }
            }
            
            // Debug local player name
            if (id === this.playerId) {
              console.log('Updating local player name:', {
                text: nameText.text,
                visible: nameText.visible,
                alpha: nameText.alpha,
                position: { x: nameText.x, y: nameText.y }
              });
            }
            
            // Apply role-based colors
            const roleColors = {
              'owner': '#ffe066',      // Gold
              'admin': '#9b59b6',      // Purple  
              'mod': '#95a5a6',        // Silver
              'player': '#ffffff'      // White (default)
            };
            
            // Add symbols for special roles
            const roleSymbols = {
              'owner': '',            // Using crown image instead
              'admin': '★',           // Star for admin
              'mod': '◆',             // Diamond for mod
              'player': ''            // No symbol for regular players
            };
            
            const color = roleColors[playerData.role] || roleColors.player;
            const symbol = roleSymbols[playerData.role] || '';
            let displayName = playerData.username.charAt(0).toUpperCase() + playerData.username.slice(1);
            
            // Truncate long usernames
            const maxLength = 12;
            if (displayName.length > maxLength) {
              displayName = displayName.substring(0, maxLength - 2) + '..';
            }
            
            nameText.setColor(color);
            nameText.setText(symbol + displayName);
            
            // Add contrasting stroke for better readability on health bars
            if (playerData.role === 'owner') {
              nameText.setStroke('#000000', 4); // Thicker black stroke for gold text
              nameText.setShadow(2, 2, '#000000', 2, false, true);
            } else if (playerData.role === 'admin') {
              nameText.setStroke('#ffffff', 3); // White stroke for purple text
              nameText.setShadow(1, 1, '#000000', 2, false, true);
            } else if (playerData.role === 'mod') {
              nameText.setStroke('#000000', 4); // Thicker black stroke for silver text
              nameText.setShadow(1, 1, '#000000', 2, false, true);
            }
          }
          
          // Handle sprite textures and flipping based on role
          if (playerData.role === 'owner') {
            const runningKey = this.textures.exists('stickman_owner_running') ? 'stickman_owner_running' : 'stickman_running';
            const idleKey = this.textures.exists('stickman_owner') ? 'stickman_owner' : 'stickman';
            
            if (playerData.vx < 0) {
                playerSprite.setTexture(runningKey);
                playerSprite.setFlipX(true);
            } else if (playerData.vx > 0) {
                playerSprite.setTexture(runningKey);
                playerSprite.setFlipX(false);
            } else {
                playerSprite.setTexture(idleKey);
                playerSprite.setFlipX(false);
            }
              playerSprite.setTint(0xffffff);
          } else if (playerData.role === 'admin') {
              const runningKey = this.textures.exists('stickman_admin_running') ? 'stickman_admin_running' : 'stickman_running';
              const idleKey = this.textures.exists('stickman_admin') ? 'stickman_admin' : 'stickman';
              
              if (playerData.vx < 0) {
                  playerSprite.setTexture(runningKey);
                  playerSprite.setFlipX(true);
              } else if (playerData.vx > 0) {
                  playerSprite.setTexture(runningKey);
                  playerSprite.setFlipX(false);
              } else {
                  playerSprite.setTexture(idleKey);
                  playerSprite.setFlipX(false);
              }
              playerSprite.setTint(0x9b59b6); // Purple tint for admins
          } else if (playerData.role === 'mod') {
              const runningKey = this.textures.exists('stickman_running_mod') ? 'stickman_running_mod' : 'stickman_running';
              const idleKey = this.textures.exists('stickman_mod') ? 'stickman_mod' : 'stickman';
              
            if (playerData.vx < 0) {
                playerSprite.setTexture(runningKey);
                playerSprite.setFlipX(true);
            } else if (playerData.vx > 0) {
                playerSprite.setTexture(runningKey);
                playerSprite.setFlipX(false);
            } else {
                playerSprite.setTexture(idleKey);
                playerSprite.setFlipX(false);
            }
              playerSprite.setTint(0xffffff);
          } else {
            if (playerData.vx < 0) {
                playerSprite.setTexture('stickman_running');
                playerSprite.setFlipX(true);
            } else if (playerData.vx > 0) {
                playerSprite.setTexture('stickman_running');
                playerSprite.setFlipX(false);
            } else {
                playerSprite.setTexture('stickman');
                playerSprite.setFlipX(false);
            }
              playerSprite.setTint(0xffffff);
          }

            // Set inventory in UI for local player
            if (id === this.playerId) {
              let inv = playerData.inventory || [];
              if (!inv.length) {
                inv = [
                  { itemId: 'sword', quantity: 1 },
                  { itemId: 'apple', quantity: 3 }
                ];
                if (this.multiplayer && this.multiplayer.socket) {
                  this.multiplayer.socket.emit('updateInventory', inv);
                }
              }
              if (this.inventoryUI) {
                this.inventoryUI.setInventory(inv);
              }
            }

          // For remote players, attach/update weapon sprite
          if (id !== this.playerId) {
            // Check if player has a weapon equipped
            const hasWeapon = playerData.weaponType && playerData.weaponType !== 'none';
            
            if (hasWeapon) {
              if (!playerSprite.weaponSprite) {
                playerSprite.weaponSprite = this.add.sprite(playerData.x, playerData.y - 30, playerData.weaponType)
                  .setDepth(1002)
                  .setScale(0.8)
                  .setVisible(true);
                playerSprite.currentWeaponType = playerData.weaponType;
              } else {
                // Update weapon texture if it changed
                const newWeaponType = playerData.weaponType;
                if (playerSprite.currentWeaponType !== newWeaponType) {
                  // Check if texture exists, especially for tomatogun
                  if (this.textures.exists(newWeaponType)) {
                    playerSprite.weaponSprite.setTexture(newWeaponType);
                    playerSprite.currentWeaponType = newWeaponType;
                    console.log(`Updated weapon for player ${playerData.username} to ${newWeaponType}`);
                  } else {
                    console.warn(`Weapon texture '${newWeaponType}' not found`);
                  }
                }
                playerSprite.weaponSprite.setVisible(true);
              }
              // Adjust weapon offset based on whether player is moving (match local player logic)
              const isMoving = playerData.vx !== 0;
              const weaponOffset = isMoving ? 10 : 15; // Reduced when moving, same as local player
              playerSprite.weaponSprite.setPosition(
                playerData.x + (playerSprite.flipX ? -weaponOffset : weaponOffset),
                playerData.y - 30 // Raised from -20 to -30 to match local player
              );
              playerSprite.weaponSprite.setFlipX(playerSprite.flipX);
            } else {
              // Hide weapon sprite if no weapon equipped
              if (playerSprite.weaponSprite) {
                playerSprite.weaponSprite.setVisible(false);
              }
            }
          }

          if (id === this.playerId && playerSprite) {
            playerSprite.setPosition(playerData.x, playerData.y);
            if (playerSprite.body) {
              playerSprite.body.x = playerData.x - playerSprite.body.width / 2;
              playerSprite.body.y = playerData.y - playerSprite.body.height;
              playerSprite.body.velocity.x = 0;
              playerSprite.body.velocity.y = 0;
            }
            // Update local player's movement state based on server velocity
            if (playerSprite.lastMoveDirection !== undefined) {
              if (playerData.vx < 0) {
                playerSprite.lastMoveDirection = -1;
                playerSprite.isMoving = true;
              } else if (playerData.vx > 0) {
                playerSprite.lastMoveDirection = 1;
                playerSprite.isMoving = true;
              } else {
                playerSprite.isMoving = false;
              }
            }
          }
        }
      }
      // Remove sprites for players that are no longer in the game
      const toDestroy = [];
      this.children.list.forEach(child => {
        if ((child instanceof Phaser.GameObjects.Sprite || child instanceof Phaser.GameObjects.Text || 
             child instanceof Phaser.GameObjects.Graphics) &&
          child.playerId && !state.players[child.playerId]) {
          toDestroy.push(child);
        }
      });
      
      toDestroy.forEach(child => {
        // If it's a player sprite, also destroy their weapon sprite and username text
        if (child instanceof Phaser.GameObjects.Sprite) {
          if (child.weaponSprite) {
            child.weaponSprite.destroy();
          }
          if (child.usernameText) {
            child.usernameText.destroy();
          }
          if (child.ammoText) {
            child.ammoText.destroy();
          }
          if (child.ammoBg) {
            child.ammoBg.destroy();
          }
          if (child.healthBar) {
            child.healthBar.destroy();
          }
          if (child.healthBarBg) {
            child.healthBarBg.destroy();
          }
        }
        child.destroy();
      });
      // Render buildings
      this.renderBuildings(state.buildings || []);
      
      // Render weapon shop area if it exists
      if (state.weaponShopArea) {
        this.renderWeaponShop(state.weaponShopArea);
      }
      
      // Synchronize bullets
      if (state.bullets) {
        // Track existing bullets
        const existingBullets = new Map();
        this.bulletGroup.getChildren().forEach(bullet => {
          if (bullet.bulletId) {
            existingBullets.set(bullet.bulletId, bullet);
          }
        });
        
        // Update or create bullets from server state
        for (const bulletId in state.bullets) {
          const bulletData = state.bullets[bulletId];
          let bullet = existingBullets.get(bulletId);
          
          if (bullet) {
            // Update existing bullet position
            bullet.setPosition(bulletData.x, bulletData.y);
            bullet.body.setVelocity(bulletData.vx, bulletData.vy);
            existingBullets.delete(bulletId); // Mark as still active
          } else {
            // Create new bullet if it doesn't exist locally
            // Find owner player
            let ownerPlayer = null;
            if (bulletData.ownerId === this.playerId) {
              ownerPlayer = this.playerSprite;
            } else {
              const allPlayers = this.playerGroup.getChildren();
              ownerPlayer = allPlayers.find(p => p.playerId === bulletData.ownerId);
            }
            
            // Create appropriate bullet type
            if (bulletData.weaponType === 'tomatogun') {
              bullet = new TomatoBullet(this, bulletData.x, bulletData.y, 
                Math.atan2(bulletData.vy, bulletData.vx) * 180 / Math.PI, 
                Math.sqrt(bulletData.vx * bulletData.vx + bulletData.vy * bulletData.vy),
                bulletData.damage, ownerPlayer, bulletId);
            } else {
              bullet = new Bullet(this, bulletData.x, bulletData.y,
                Math.atan2(bulletData.vy, bulletData.vx) * 180 / Math.PI,
                Math.sqrt(bulletData.vx * bulletData.vx + bulletData.vy * bulletData.vy),
                bulletData.damage, ownerPlayer, bulletId);
            }
            this.bulletGroup.add(bullet);
          }
        }
        
        // Remove bullets that no longer exist on server
        existingBullets.forEach(bullet => {
          if (bullet.active) {
            bullet.destroy(true);
          }
        });
      }
    };
    this.multiplayer.socket.on('worldState', this._worldStateHandler);

    // Add number key handlers for build mode (1-8)
    this._keydownOneHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[0]); };
    this._keydownTwoHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[1]); };
    this._keydownThreeHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[2]); };
    this._keydownFourHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[3]); };
    this._keydownFiveHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[4]); };
    this._keydownSixHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[5]); };
    this._keydownSevenHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[6]); };
    this._keydownEightHandler = () => { if (this.buildMode && !this.commandPromptOpen) this.setSelectedBuilding(this.buildingTypes[7]); };
    this._keydownShiftHandler = () => { 
      if (!this.commandPromptOpen && this.playerSprite && !this.playerSprite.isDead) {
        this.toggleBuildMode(); 
      }
    };
    this._pointerDownHandler = (pointer) => {
      if (this.commandPromptOpen) return;
      // Only allow building when in build mode and not dead
      if (!this.buildMode || !this.playerSprite || this.playerSprite.isDead) return;
      const tileX = Math.floor(pointer.worldX / 64) * 64;
      let tileY = Math.floor((pointer.worldY - (this.groundY - 64)) / 64) * 64 + (this.groundY - 64);
      if (tileY > this.groundY - 64) tileY = this.groundY - 64;
      if (tileY < 0) tileY = 0;
      if (pointer.leftButtonDown()) {
        const dx = tileX + 32 - this.playerSprite.x;
        const dy = tileY + 32 - this.playerSprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 384) return;
        this.isDragging = true;
        this.lastPlacedTile = { x: tileX, y: tileY };
        if (this.multiplayer && this.multiplayer.socket) {
          this.multiplayer.socket.emit('placeBuilding', {
            type: this.selectedBuilding,
            x: tileX,
            y: tileY,
            owner: this.playerId
          });
        }
      }
    };
    this._keydownXHandler = () => {
      if (this.commandPromptOpen) return;
      // Only allow deleting blocks in build mode and not dead
      if (!this.buildMode || !this.playerSprite || this.playerSprite.isDead) return;
      const pointer = this.input.activePointer;
      const tileX = Math.floor(pointer.worldX / 64) * 64;
      let tileY = Math.floor((pointer.worldY - (this.groundY - 64)) / 64) * 64 + (this.groundY - 64);
      if (tileY > this.groundY - 64) tileY = this.groundY - 64;
      if (tileY < 0) tileY = 0;
      // Only allow delete if within 6x6 (radius 384px) of player
      const dx = tileX + 32 - this.playerSprite.x;
      const dy = tileY + 32 - this.playerSprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 384) return;
      if (this.multiplayer && this.multiplayer.socket) {
        this.multiplayer.socket.emit('deleteBlock', { x: tileX, y: tileY });
      }
    };
    this._pointerMoveHandler = (pointer) => {
      if (this.commandPromptOpen) return;
      // Only show preview when in build mode
      if (!this.buildMode || !this.playerSprite) {
        if (this.previewBlock) this.previewBlock.setVisible(false);
        return;
      }
      const tileX = Math.floor(pointer.worldX / 64) * 64;
      let tileY = Math.floor((pointer.worldY - (this.groundY - 64)) / 64) * 64 + (this.groundY - 64);
      if (tileY > this.groundY - 64) tileY = this.groundY - 64;
      if (tileY < 0) tileY = 0;
      const dx = tileX + 32 - this.playerSprite.x;
      const dy = tileY + 32 - this.playerSprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 384) {
        if (this.previewBlock) this.previewBlock.setVisible(false);
        return;
      }
      if (!this.previewBlock) {
        this.previewBlock = this.add.sprite(tileX + 32, tileY + 32, this.buildingSprites[this.selectedBuilding])
          .setOrigin(0.5, 0.5)
          .setAlpha(0.4)
          .setDisplaySize(64, 64)
          .setDepth(9999);
      } else {
        this.previewBlock.setTexture(this.buildingSprites[this.selectedBuilding]);
        this.previewBlock.setPosition(tileX + 32, tileY + 32);
        this.previewBlock.setVisible(true);
      }
      if (this.buildMode && this.isDragging && pointer.leftButtonDown()) {
        if (!this.lastPlacedTile || (this.lastPlacedTile.x !== tileX || this.lastPlacedTile.y !== tileY)) {
          this.lastPlacedTile = { x: tileX, y: tileY };
          if (this.multiplayer && this.multiplayer.socket) {
            this.multiplayer.socket.emit('placeBuilding', {
              type: this.selectedBuilding,
              x: tileX,
              y: tileY,
              owner: this.playerId
            });
          }
        }
      }
    };
    this._pointerUpHandler = () => {
      this.isDragging = false;
      this.lastPlacedTile = null;
    };
    // Register build mode toggle and build keys
    this.input.keyboard.on('keydown-ONE', this._keydownOneHandler);
    this.input.keyboard.on('keydown-TWO', this._keydownTwoHandler);
    this.input.keyboard.on('keydown-THREE', this._keydownThreeHandler);
    this.input.keyboard.on('keydown-FOUR', this._keydownFourHandler);
    this.input.keyboard.on('keydown-FIVE', this._keydownFiveHandler);
    this.input.keyboard.on('keydown-SIX', this._keydownSixHandler);
    this.input.keyboard.on('keydown-SEVEN', this._keydownSevenHandler);
    this.input.keyboard.on('keydown-EIGHT', this._keydownEightHandler);
    this.input.keyboard.on('keydown-SHIFT', this._keydownShiftHandler); // Shift for build mode toggle
    this.input.on('pointerdown', this._pointerDownHandler);
    this.input.keyboard.on('keydown-X', this._keydownXHandler);
    this.input.on('pointermove', this._pointerMoveHandler);
    this.input.on('pointerup', this._pointerUpHandler);

    this.buildGroup = this.physics.add.staticGroup();

    // Listen for roleUpdated event from server
    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.on('roleUpdated', ({ role }) => {
        // Update player role
        this.playerRole = role;
        if (this.playerSprite) {
          this.playerSprite.role = role;
        }
        
        // Show notification
        const msg = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 100,
          `You have been granted ${role.charAt(0).toUpperCase() + role.slice(1)} status!`,
          { fontSize: '32px', color: '#ffe066', fontFamily: 'Arial', backgroundColor: '#222244', padding: { x: 20, y: 10 } })
          .setOrigin(0.5)
          .setDepth(1000000)
          .setScrollFactor(0);
        this.time.delayedCall(2000, () => { msg.destroy(); });
        
        // Update player sprite tint immediately
        if (this.playerSprite) {
          if (role === 'mod' || role === 'owner') {
            this.playerSprite.setTint(0xffe066);
          } else {
            this.playerSprite.setTint(0xffffff);
          }
        }
        
        // Update weapon types based on new role
        if (['admin', 'owner'].includes(role)) {
          if (this.playerSprite && !this.playerSprite.weaponTypes.includes('tomatogun')) {
            this.playerSprite.weaponTypes.push('tomatogun');
            // Add tomatogun to inventory if promoted to admin/owner
            this.inventoryUI.addItem({ itemId: 'tomatogun', quantity: 1, stackable: false });
          }
        }
        
        // Add other role-specific items if needed
        if (role === 'owner' && this.playerSprite) {
          // Make sure owner has sniper too
          this.inventoryUI.addItem({ itemId: 'sniper', quantity: 1, stackable: false });
        }
        
        if (['admin', 'mod'].includes(role) && this.playerSprite) {
          // Make sure staff has shotgun
          this.inventoryUI.addItem({ itemId: 'shotgun', quantity: 1, stackable: false });
        }
      });
    }

    // Use document-level keydown for T to prevent T from appearing in the input
    this._tKeyHandler = (e) => {
      if ((e.key === 't' || e.key === 'T') && !this.commandPromptOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.openCommandPrompt();
      }
    };
    document.addEventListener('keydown', this._tKeyHandler);

    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.on('commandResult', ({ message }) => {
        const msg = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 140,
          message,
          { fontSize: '28px', color: '#ffe066', fontFamily: 'Arial', backgroundColor: '#222244', padding: { x: 16, y: 8 } })
          .setOrigin(0.5)
          .setDepth(1000000)
          .setScrollFactor(0);
        this.time.delayedCall(2500, () => { msg.destroy(); });
      });
    }

    // Create sky background
    this.skyBackground = this.add.graphics();
    this.skyBackground.setDepth(-2000); // Behind everything
    this.skyBackground.setScrollFactor(0);
    
    // Initialize with a proper gradient right away
    this.renderSkyGradient();

    // Sun graphics
    this.sun = this.add.graphics();
    this.sun.setDepth(-1000); // behind everything
    
    // Draw initial sun
    const initialSunX = this.sunStartX;
    const initialSunY = this.sunStartY;
    this.sun.fillStyle(0xFFE066);
    this.sun.fillCircle(initialSunX, initialSunY, 80);
    
    // Lighting overlay
    this.lightingOverlay = this.add.graphics();
    this.lightingOverlay.setDepth(10000000); // above everything
    this.lightingOverlay.setScrollFactor(0);
    
    // Initialize lighting overlay for day
    this.lightingOverlay.clear();
    this.lightingOverlay.fillStyle(0x222244, 0); // No overlay for day
    this.lightingOverlay.fillRect(0, 0, this.scale.width, this.cameras.main.height);

    // Create groups for physics
    console.log('Creating physics groups');
    this.playerGroup = this.physics.add.group();
    this.buildGroup = this.physics.add.staticGroup();
    this.bulletGroup = this.physics.add.group({
      allowGravity: false,
      immovable: false,
      collideWorldBounds: true
    });
    this.itemGroup = this.physics.add.group();

    // Set up bullet factory
    this.add.bullet = (x, y, angle, speed, damage, owner, bulletId = null) => {
      const bullet = new Bullet(this, x, y, angle, speed, damage, owner, bulletId);
      this.bulletGroup.add(bullet);
      return bullet;
    };
    
    // Set up tomato bullet factory
    this.add.tomatoBullet = (x, y, angle, speed, damage, owner, bulletId = null) => {
      const bullet = new TomatoBullet(this, x, y, angle, speed, damage, owner, bulletId);
      this.bulletGroup.add(bullet);
      return bullet;
    };

    // Remove old bullet creation event handler - bullets are now sent directly from Player.shoot()

    // Handle incoming bullets from other players
    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.on('bulletCreated', (data) => {
        console.log('Received bullet from other player:', data);
        // Find the owner player object
        let ownerPlayer = null;
        if (data.playerId === this.playerId) {
          ownerPlayer = this.playerSprite;
        } else {
          const allPlayers = this.playerGroup.getChildren();
          ownerPlayer = allPlayers.find(p => p.playerId === data.playerId);
          if (!ownerPlayer) {
            console.warn('Could not find owner player for bullet:', data.playerId);
            console.log('Available players:', allPlayers.map(p => p.playerId));
          }
        }
        
        // Only create bullets from other players (local player creates their own immediately)
        if (data.playerId !== this.playerId) {
          // Create appropriate bullet type
          if (data.weaponType === 'tomatogun') {
            this.add.tomatoBullet(data.x, data.y, data.angle, data.speed, data.damage, ownerPlayer, data.bulletId);
          } else {
            this.add.bullet(data.x, data.y, data.angle, data.speed, data.damage, ownerPlayer, data.bulletId);
          }
        }
      });

      // Handle bullet destruction from server
      this.multiplayer.socket.on('bulletDestroyed', ({ bulletId }) => {
        const allBullets = this.bulletGroup.getChildren();
        const bulletToDestroy = allBullets.find(b => b.bulletId === bulletId);
        if (bulletToDestroy && bulletToDestroy.active) {
          bulletToDestroy.destroy(true); // Pass true to indicate this is from sync
        }
      });
      
      // Handle player kill events
      this.multiplayer.socket.on('playerKill', ({ killerName, killerRole, victimName, victimRole, isHeadshot, killerStats, victimStats }) => {
        console.log('Player kill event:', { killerName, victimName, isHeadshot });
        this.addGameLogEntry('kill', { 
          killer: killerName, 
          victim: victimName, 
          killerRole: killerRole, 
          victimRole: victimRole 
        });
        
        // Update stats immediately for local player if they're involved
        if (this.playerSprite && this.gameUI && this.gameUI.updateStats) {
          const localUsername = this.username.toLowerCase();
          const killerNameLower = killerName.toLowerCase();
          const victimNameLower = victimName.toLowerCase();
          
          if (killerNameLower === localUsername && killerStats) {
            console.log('[STATS] Updating killer stats immediately:', killerStats);
            this.gameUI.updateStats(killerStats);
          } else if (victimNameLower === localUsername && victimStats) {
            console.log('[STATS] Updating victim stats immediately:', victimStats);
            this.gameUI.updateStats(victimStats);
          }
        }
        
        // Show special message for headshots
        if (isHeadshot === true) {
          console.log('Showing headshot indicator');
          const headshotText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 150,
            'HEADSHOT!',
            {
              fontSize: '32px',
              fontFamily: 'Arial',
              color: '#ff0000',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 4
            }
          )
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(10000);
          
          this.tweens.add({
            targets: headshotText,
            y: headshotText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              headshotText.destroy();
            }
          });
        }
      });
      
      // Remove any existing listeners first to prevent duplicates
      this.multiplayer.socket.off('playerJoined');
      this.multiplayer.socket.off('playerLeft');
      
      // Handle player join events
      this.multiplayer.socket.on('playerJoined', ({ username, role }) => {
        console.log('playerJoined event received:', { username, role });
        this.addGameLogEntry('join', { username, role });
      });
      
      // Handle player leave events
      this.multiplayer.socket.on('playerLeft', ({ username, role }) => {
        this.addGameLogEntry('leave', { username, role });
      });
      
      // Handle server announcements
      this.multiplayer.socket.on('serverAnnouncement', ({ message, type }) => {
        this.addGameLogEntry('announcement', { message, type });
      });
      
      // Handle chat messages
      this.multiplayer.socket.on('chatMessage', ({ username, role, message }) => {
        this.addGameLogEntry('chat', { username, role, message });
      });
      
      // Handle command results
      this.multiplayer.socket.on('commandResult', ({ message }) => {
        this.addGameLogEntry('message', { text: message });
      });
      
      // Handle tomato explosions
      this.multiplayer.socket.on('tomatoExploded', ({ x, y, radius, damage, ownerId }) => {
        console.log('Tomato exploded at:', { x, y, radius });
        
        
        // Create explosion visual effect
        const explosionGraphics = this.add.graphics();
        explosionGraphics.setDepth(2000);
        
        // Draw expanding circle
        let currentRadius = 0;
        const maxRadius = radius;
        
        const expandTween = this.tweens.add({
          targets: { radius: currentRadius },
          radius: maxRadius,
          duration: 300,
          ease: 'Power2',
          onUpdate: (tween) => {
            const value = tween.getValue();
            explosionGraphics.clear();
            explosionGraphics.lineStyle(3, 0xff6666, 0.8 - (value / maxRadius) * 0.7);
            explosionGraphics.strokeCircle(x, y, value);
            explosionGraphics.fillStyle(0xff0000, 0.3 - (value / maxRadius) * 0.25);
            explosionGraphics.fillCircle(x, y, value);
          },
          onComplete: () => {
            explosionGraphics.destroy();
          }
        });
        
        // Create splatter at explosion center
        console.log('Creating splatter at:', x, y);
        
        
        // Now try the splatter image
        try {
          const splatter = this.add.image(x, y, 'tomato_splatter');
          if (splatter && splatter.texture && splatter.texture.key !== '__MISSING') {
            splatter.setDepth(10);  // Higher depth
            splatter.setScale(2);
            splatter.setAlpha(0.8);
            splatter.setTint(0xff6666);
            splatter.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            splatter.setVisible(true);
            console.log('Splatter created successfully at:', x, y, 'texture:', splatter.texture.key);
            
            // Fade out splatter slowly
            this.tweens.add({
              targets: splatter,
              alpha: 0.3,
              duration: 30000,
              onComplete: () => {
                splatter.destroy();
              }
            });
          } else {
            console.error('Failed to create splatter - texture issue');
          }
        } catch (error) {
          console.error('Error creating splatter:', error);
        }
        
        // Camera shake on explosion
        const distance = Phaser.Math.Distance.Between(this.playerSprite.x, this.playerSprite.y, x, y);
        if (distance < radius * 2) {
          const intensity = Math.max(0.005, 0.02 * (1 - distance / (radius * 2)));
          this.cameras.main.shake(200, intensity);
        }
      });
      
      // Handle server restart
      this.multiplayer.socket.on('serverRestart', ({ message }) => {
        this.showServerDisconnectScreen('restart', message);
      });
      
      // Handle socket disconnect
      this.multiplayer.socket.on('disconnect', () => {
        console.log('[CLIENT] Socket disconnected');
        this.showServerDisconnectScreen('disconnect', 'Connection to server lost');
      });
    }

    // Set up bullet collisions
    this.physics.add.collider(this.bulletGroup, this.buildGroup, (bullet, building) => {
      bullet.handleBuildingCollision(bullet, building);
    });

    // Remove client-side player collision detection - server handles all damage

    // Create local player
    console.log('Creating local player');
    // Spawn at x=600 to be outside weapon shop (which is 0-512)
    this.playerSprite = new Player(this, 600, 1800);
    this.playerGroup.add(this.playerSprite);
    this.cameras.main.startFollow(this.playerSprite);
    
    // Create ammo indicator for local player
    const ammoBg = this.add.rectangle(100, 1860, 80, 24, 0x000000, 0.7)
      .setOrigin(0.5, 0.5)
      .setDepth(1999)
      .setVisible(false);
    this.playerSprite.ammoBg = ammoBg;
    
    const ammoText = this.add.text(100, 1860, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    })
    .setOrigin(0.5, 0.5)
    .setDepth(2000)
    .setVisible(false);
    this.playerSprite.ammoText = ammoText;
    
    console.log('Local player ammo text created:', !!this.playerSprite.ammoText);
    
    // Weapons will be added when we receive initial state from server
    
    // Health bar for local player is now in the UI panel
    // Don't create username text here - it will be created when world state updates

    // After creating playerGroup, buildGroup, and playerSprite:
    this.physics.add.collider(this.playerGroup, this.buildGroup);

    // Handle initial state from server
    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.on('initialState', (data) => {
        if (data.player) {
          // Store player role
          this.playerRole = data.player.role || 'player';
          this.playerSprite.role = this.playerRole;
          
          // Update weapon types based on role
          if (['admin', 'owner'].includes(this.playerRole)) {
            if (!this.playerSprite.weaponTypes.includes('tomatogun')) {
              this.playerSprite.weaponTypes.push('tomatogun');
            }
          }
          
          
          // Set the player's weapon to match their saved weapon
          if (data.player.currentWeapon && this.playerSprite) {
            const weaponIndex = this.playerSprite.weaponTypes.indexOf(data.player.currentWeapon);
            if (weaponIndex !== -1) {
              this.playerSprite.switchWeapon(weaponIndex);
            }
          }
          
          // Give player default weapons in inventory
          this.inventoryUI.addItem({ itemId: 'pistol', quantity: 1, stackable: false });
          this.inventoryUI.addItem({ itemId: 'rifle', quantity: 1, stackable: false });
          
          // Give staff extra weapon
          if (['admin', 'mod'].includes(this.playerRole)) {
            this.inventoryUI.addItem({ itemId: 'shotgun', quantity: 1, stackable: false });
          }
          
          // Give owner all weapons
          if (this.playerRole === 'owner') {
            this.inventoryUI.addItem({ itemId: 'sniper', quantity: 1, stackable: false });
            this.inventoryUI.addItem({ itemId: 'tomatogun', quantity: 1, stackable: false });
          }
          
          // Update health bar with initial health
          if (data.player.health !== undefined && data.player.maxHealth) {
            if (this.gameUI && this.gameUI.updateHealth) {
              this.gameUI.updateHealth(data.player.health, data.player.maxHealth);
            }
          }
          
          // Update stats display with initial stats
          if (data.player.stats && this.gameUI && this.gameUI.updateStats) {
            this.gameUI.updateStats(data.player.stats);
          }
          
          // Check if tutorial should be shown
          if (!data.tutorialCompleted) {
            // Show tutorial after a short delay to let the game load
            this.time.delayedCall(1500, () => {
              this.showTutorial();
            });
          }
        }
      });
      
      // Handle immediate stats updates
      this.multiplayer.socket.on('statsUpdate', (data) => {
        if (data.stats && this.gameUI && this.gameUI.updateStats) {
          console.log('[STATS] Received immediate stats update:', data.stats);
          this.gameUI.updateStats(data.stats);
        }
      });
    }

    // Handle playerDamaged event from server
    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.on('playerDamaged', ({ targetId, damage, bulletX, bulletY, bulletId, health, maxHealth, isHeadshot }) => {
        console.log('Player damaged event:', { targetId, playerId: this.playerId, health, maxHealth });
        
        // Update the player's health in our local state
        if (targetId === this.playerId && this.playerSprite) {
          console.log('Updating local player health bar');
          // Update local player health
          this.playerSprite.health = health;
          this.playerSprite.maxHealth = maxHealth;
          
          // Update the UI health bar
          if (this.gameUI && this.gameUI.updateHealth) {
            this.gameUI.updateHealth(health, maxHealth);
          }
          
          // Check if player died
          if (health <= 0 && !this.playerSprite.isDead) {
            console.log('[CLIENT] Player health is 0, triggering death');
            this.playerSprite.die();
          }
        }

        // Find the player by ID
        const allPlayers = this.playerGroup.getChildren();
        const hitPlayer = allPlayers.find(p => p.playerId === targetId);
        if (hitPlayer) {
          // Update their health
          hitPlayer.health = health;
          hitPlayer.maxHealth = maxHealth;
          // Show damage effect
          hitPlayer.takeDamage(damage);
          
          // Show hit marker for the shooter (if we shot this bullet)
          const allBullets = this.bulletGroup.getChildren();
          const hitBullet = allBullets.find(b => b.bulletId === bulletId);
          if (hitBullet && hitBullet.owner === this.playerSprite) {
            // Create hit marker at impact position
            const hitText = isHeadshot ? 'HEADSHOT!' : 'HIT!';
            const fontSize = isHeadshot ? '32px' : '24px';
            const color = isHeadshot ? '#ffff00' : '#ff0000'; // Yellow for headshot, red for normal
            
            const hitMarker = this.add.text(bulletX, bulletY - 20, hitText, {
              fontSize: fontSize,
              fontFamily: 'Arial',
              color: color,
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 4
            })
            .setOrigin(0.5, 0.5)
            .setDepth(10000);
            
            // More dramatic animation for headshots
            const animDuration = isHeadshot ? 1200 : 800;
            const yOffset = isHeadshot ? 50 : 30;
            
            this.tweens.add({
              targets: hitMarker,
              y: hitMarker.y - yOffset,
              alpha: 0,
              scale: isHeadshot ? 1.5 : 1,
              duration: animDuration,
              ease: 'Power2',
              onComplete: () => {
                hitMarker.destroy();
              }
            });
            
            // Add screen flash effect for shooter
            const flashColor = isHeadshot ? 0xffff00 : 0xff0000;
            const flashAlpha = isHeadshot ? 0.2 : 0.1;
            
            const flash = this.add.rectangle(
              this.cameras.main.centerX,
              this.cameras.main.centerY,
              this.cameras.main.width,
              this.cameras.main.height,
              flashColor,
              flashAlpha
            )
            .setScrollFactor(0)
            .setDepth(9999);
            
            this.tweens.add({
              targets: flash,
              alpha: 0,
              duration: isHeadshot ? 200 : 100,
              onComplete: () => {
                flash.destroy();
              }
            });
            
            // Add camera shake for headshots
            if (isHeadshot) {
              this.cameras.main.shake(200, 0.01);
            }
          }
        }

        // Destroy the specific bullet by ID if provided
        if (bulletId) {
          const allBullets = this.bulletGroup.getChildren();
          const hitBullet = allBullets.find(b => b.bulletId === bulletId);
          if (hitBullet && hitBullet.active) {
            console.log('[DEBUG] Hit bullet found and destroyed by ID:', bulletId);
            hitBullet.destroy(true); // Pass true to indicate this is from sync
          }
        }
      });
      
      // Handle respawn event from server
      this.multiplayer.socket.on('respawn', () => {
        console.log('[CLIENT] Received respawn event from server');
        if (this.playerSprite) {
          this.playerSprite.respawn();
        }
      });
      
      // Handle health changed event
      this.multiplayer.socket.on('playerHealthChanged', (health, maxHealth) => {
        if (this.playerSprite) {
          this.playerSprite.health = health;
          this.playerSprite.maxHealth = maxHealth;
        }
        // Update UI health bar
        if (this.gameUI && this.gameUI.updateHealth) {
          this.gameUI.updateHealth(health, maxHealth);
        }
      });
      
      // Handle weapon shop events
      this.multiplayer.socket.on('enteredWeaponShop', (data) => {
        this.showWeaponShopMenu(data.role);
      });
      
      this.multiplayer.socket.on('leftWeaponShop', () => {
        this.hideWeaponShopMenu();
      });
      
      this.multiplayer.socket.on('addWeaponToInventory', (data) => {
        // Add weapon to inventory
        this.inventoryUI.addItem({
          itemId: data.weaponType,
          quantity: 1,
          stackable: false
        });
        
        // Show confirmation message
        const confirmText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY - 150,
          `Added ${data.weaponType.toUpperCase()} to inventory!`,
          {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#00ff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(10000);
        
        this.tweens.add({
          targets: confirmText,
          y: confirmText.y - 40,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            confirmText.destroy();
          }
        });
      });
      
      this.multiplayer.socket.on('weaponShopError', (message) => {
        const errorText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          message,
          {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(10000);
        
        this.tweens.add({
          targets: errorText,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            errorText.destroy();
          }
        });
      });
      
      // Handle building errors
      this.multiplayer.socket.on('buildingError', (message) => {
        const errorText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY - 200,
          message,
          {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(10000);
        
        this.tweens.add({
          targets: errorText,
          y: errorText.y - 30,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            errorText.destroy();
          }
        });
      });
    }

    // Add item collisions
    this.physics.add.collider(this.itemGroup, this.buildGroup);
    this.physics.add.overlap(this.playerGroup, this.itemGroup, (player, item) => {
      if (player === this.playerSprite) {
        item.collect(player);
      }
    });
    
    // Listen for ammo change events to update the ammo indicator
    this.events.on('ammoChanged', (data) => {
      console.log('Ammo changed event received:', data);
      if (this.playerSprite) {
        console.log('Player sprite exists:', this.playerSprite);
        console.log('Ammo text exists:', !!this.playerSprite.ammoText);
        
        if (this.playerSprite.ammoText) {
          const ammoString = data.isReloading ? 'RELOADING' : `${data.currentAmmo}/${data.magazineSize}`;
          this.playerSprite.ammoText.setText(ammoString);
          this.playerSprite.ammoText.setVisible(true);
          
          // Log the ammo text properties
          console.log('Ammo text properties:', {
            text: this.playerSprite.ammoText.text,
            visible: this.playerSprite.ammoText.visible,
            x: this.playerSprite.ammoText.x,
            y: this.playerSprite.ammoText.y,
            depth: this.playerSprite.ammoText.depth,
            alpha: this.playerSprite.ammoText.alpha,
            scale: { x: this.playerSprite.ammoText.scaleX, y: this.playerSprite.ammoText.scaleY }
          });
          
          if (this.playerSprite.ammoBg) {
            this.playerSprite.ammoBg.setVisible(true);
          }
          
          // Change color based on ammo level
          if (data.isReloading) {
            this.playerSprite.ammoText.setColor('#00ff00'); // Green when reloading
          } else if (data.currentAmmo === 0) {
            this.playerSprite.ammoText.setColor('#ff0000'); // Red when empty
          } else if (data.currentAmmo <= data.magazineSize * 0.3) {
            this.playerSprite.ammoText.setColor('#ffa500'); // Orange when low
          } else {
            this.playerSprite.ammoText.setColor('#ffff00'); // Yellow normally
          }
        } else {
          console.log('ERROR: Ammo text not found on player sprite!');
        }
      } else {
        console.log('ERROR: Player sprite not found!');
      }
    });
    
    // Listen for weapon hidden event to hide ammo indicator
    this.events.on('weaponHidden', () => {
      if (this.playerSprite && this.playerSprite.ammoText) {
        this.playerSprite.ammoText.setVisible(false);
        if (this.playerSprite.ammoBg) {
          this.playerSprite.ammoBg.setVisible(false);
        }
      }
    });
  }

  drawGround() {
    // Destroy old ground images
    if (this.groundImages && this.groundImages.length) {
      this.groundImages.forEach(img => img.destroy());
      this.groundImages = [];
    }
    // Draw ground to cover the visible area (at least the width of the world or the screen)
    const width = Math.max(this.worldWidth, this.scale.width);
    for (let x = 0; x < width; x += 64) {
      // Check if this is under the weapon shop (x: 0-512, y: ground level)
      if (x >= 0 && x < 512) {
        // Use gold texture for weapon shop floor
        const img = this.add.image(x, this.groundY, 'gold').setOrigin(0, 0);
        this.groundImages.push(img);
      } else {
        // Use regular ground texture
        const img = this.add.image(x, this.groundY, 'ground').setOrigin(0, 0);
        this.groundImages.push(img);
      }
    }
  }

  update() {
    if (this.commandPromptOpen) return;
    
    // Check if player is dead - don't send input or update if dead
    if (this.playerSprite && this.playerSprite.isDead) {
      // Still send empty input to server to maintain connection
      if (this.multiplayer && this.multiplayer.socket && this.playerId) {
        this.multiplayer.sendInput({
          up: false,
          left: false,
          right: false
        });
      }
      return; // Skip the rest of the update
    }
    
    // Send input to server
    if (this.multiplayer && this.multiplayer.socket && this.playerId) {
      this.multiplayer.sendInput({
        up: this.cursors.up.isDown,
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown
      });
    }
    // Call local player update every frame
    if (this.playerSprite && this.playerSprite.update) {
      this.playerSprite.update(this.cursors);
      
      // Update ammo text position to follow weapon
      if (this.playerSprite.ammoText && this.playerSprite.weapon) {
        // Get weapon offset similar to Player.js
        const weaponOffsetX = this.playerSprite.anims.currentAnim?.key.includes('running') ? 10 : 15;
        const weaponX = this.playerSprite.x + (weaponOffsetX * this.playerSprite.lastMoveDirection);
        const weaponY = this.playerSprite.y - 30; // Same as weapon position
        
        // Position ammo to the side of the weapon, not above player
        const ammoX = weaponX + (35 * this.playerSprite.lastMoveDirection);
        const ammoY = weaponY + 10; // Below weapon level to avoid head
        
        this.playerSprite.ammoText.setPosition(ammoX, ammoY);
        if (this.playerSprite.ammoBg) {
          this.playerSprite.ammoBg.setPosition(ammoX, ammoY);
        }
      }
    }

    // --- Sun and lighting update ---
    // Get sun state from server
    if (this.multiplayer && this.multiplayer.worldState && this.multiplayer.worldState.sun) {
      const sunState = this.multiplayer.worldState.sun;
      this.sunElapsed = sunState.elapsed;
      this.isDay = sunState.isDay;
    }

    // Calculate day/night cycle progress (0 to 1)
    let t = this.sunElapsed / this.sunDuration;
    if (!this.isDay) {
      t = 1 - t; // Reverse for night
    }

    // Update sky color based on time of day
    const skyColors = {
      day: 0x87CEEB,    // Sky blue
      sunset: 0xFFA07A, // Light salmon
      night: 0x191970   // Midnight blue
    };

    // Update cloud movement smoothly using delta time
    const currentTime = this.time.now;
    if (this._lastCloudUpdate > 0) {
      const deltaTime = currentTime - this._lastCloudUpdate;
      this._cloudOffset += deltaTime * 0.01; // Smooth movement speed
    }
    this._lastCloudUpdate = currentTime;
    
    // Always ensure sky is properly rendered
    const width = this.scale.width;
    const height = this.cameras.main.height;
    
    // Store last sky time for smooth transitions
    this._lastSkyT = t;
    
    // Clear and redraw sky every frame to prevent artifacts
    this.skyBackground.clear();
    
    if (t > 0.7 && t <= 1.0) {
      // Sunset - use a single continuous gradient function
      const sunsetProgress = (t - 0.7) / 0.3;
      
      // Define gradient stops
      const gradientStops = [
        { pos: 0.0, color: 0x4169E1 }, // Royal blue at top
        { pos: 0.4, color: 0xFF6B9D }, // Pink in upper middle
        { pos: 0.7, color: 0xFFA500 }, // Orange at horizon
        { pos: 1.0, color: 0xDC143C }  // Crimson at bottom
      ];
      
      // Draw gradient with very small bands for smoothness
      const bandHeight = 1; // 1 pixel bands for maximum smoothness
      for (let i = 0; i <= height; i += bandHeight) {
        const ratio = i / height;
        
        // Find which gradient stops we're between
        let color;
        for (let j = 0; j < gradientStops.length - 1; j++) {
          const stop1 = gradientStops[j];
          const stop2 = gradientStops[j + 1];
          
          if (ratio >= stop1.pos && ratio <= stop2.pos) {
            // Interpolate between these two stops
            const localRatio = (ratio - stop1.pos) / (stop2.pos - stop1.pos);
            const color1 = Phaser.Display.Color.IntegerToColor(stop1.color);
            const color2 = Phaser.Display.Color.IntegerToColor(stop2.color);
            
            // Blend with day colors based on sunset progress
            const dayColor = Phaser.Display.Color.IntegerToColor(0x87CEEB);
            const sunsetColor = Phaser.Display.Color.Interpolate.ColorWithColor(
              color1, color2, 1, localRatio
            );
            
            color = Phaser.Display.Color.Interpolate.ColorWithColor(
              dayColor, sunsetColor, 1, sunsetProgress
            );
            break;
          }
        }
        
        if (!color) {
          // Fallback for edge cases
          color = Phaser.Display.Color.IntegerToColor(0x87CEEB);
        }
        
        this.skyBackground.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
        this.skyBackground.fillRect(0, i, width, Math.min(bandHeight, height - i));
      }
      
      // Add some clouds with smooth movement
      this.skyBackground.fillStyle(0xFFFFFF, 0.3);
      for (let i = 0; i < 5; i++) {
        const cloudX = (i * 200 + this._cloudOffset) % (width + 400) - 200;
        const cloudY = 100 + i * 50;
        this.skyBackground.fillEllipse(cloudX, cloudY, 120, 40);
        this.skyBackground.fillEllipse(cloudX - 30, cloudY, 80, 35);
        this.skyBackground.fillEllipse(cloudX + 30, cloudY, 80, 35);
      }
      
    } else if (t >= 0 && t < 0.3) {
      // Sunrise - use gradient stops for smooth transitions
      const sunriseProgress = t / 0.3;
      
      // Define gradient stops for sunrise
      const nightStops = [
        { pos: 0.0, color: 0x191970 }, // Midnight blue at top
        { pos: 0.5, color: 0x483D8B }, // Dark slate blue in middle
        { pos: 1.0, color: 0x8B4513 }  // Saddle brown at horizon
      ];
      
      const dayStops = [
        { pos: 0.0, color: 0x4682B4 }, // Steel blue at top
        { pos: 0.5, color: 0x87CEEB }, // Sky blue in middle
        { pos: 1.0, color: 0xFFE4B5 }  // Moccasin at horizon
      ];
      
      // Draw gradient
      const bandHeight = 1;
      for (let i = 0; i <= height; i += bandHeight) {
        const ratio = i / height;
        
        // Find gradient color for night
        let nightColor, dayColor;
        
        // Get night gradient color
        for (let j = 0; j < nightStops.length - 1; j++) {
          if (ratio >= nightStops[j].pos && ratio <= nightStops[j + 1].pos) {
            const localRatio = (ratio - nightStops[j].pos) / (nightStops[j + 1].pos - nightStops[j].pos);
            const c1 = Phaser.Display.Color.IntegerToColor(nightStops[j].color);
            const c2 = Phaser.Display.Color.IntegerToColor(nightStops[j + 1].color);
            nightColor = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 1, localRatio);
            break;
          }
        }
        
        // Get day gradient color
        for (let j = 0; j < dayStops.length - 1; j++) {
          if (ratio >= dayStops[j].pos && ratio <= dayStops[j + 1].pos) {
            const localRatio = (ratio - dayStops[j].pos) / (dayStops[j + 1].pos - dayStops[j].pos);
            const c1 = Phaser.Display.Color.IntegerToColor(dayStops[j].color);
            const c2 = Phaser.Display.Color.IntegerToColor(dayStops[j + 1].color);
            dayColor = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 1, localRatio);
            break;
          }
        }
        
        // Blend between night and day based on sunrise progress
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          nightColor || Phaser.Display.Color.IntegerToColor(0x191970),
          dayColor || Phaser.Display.Color.IntegerToColor(0x87CEEB),
          1,
          sunriseProgress
        );
        
        this.skyBackground.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
        this.skyBackground.fillRect(0, i, width, Math.min(bandHeight, height - i));
      }
      
    } else {
      // Day time - use gradient stops for consistent rendering
      const dayGradientStops = [
        { pos: 0.0, color: 0x4682B4 },  // Steel blue at top
        { pos: 0.3, color: 0x87CEEB },  // Sky blue
        { pos: 0.7, color: 0xB0E0E6 },  // Powder blue
        { pos: 1.0, color: 0xE0F6FF }   // Very light blue at horizon
      ];
      
      const bandHeight = 1;
      for (let i = 0; i <= height; i += bandHeight) {
        const ratio = i / height;
        
        // Find which gradient stops we're between
        let color;
        for (let j = 0; j < dayGradientStops.length - 1; j++) {
          const stop1 = dayGradientStops[j];
          const stop2 = dayGradientStops[j + 1];
          
          if (ratio >= stop1.pos && ratio <= stop2.pos) {
            const localRatio = (ratio - stop1.pos) / (stop2.pos - stop1.pos);
            const color1 = Phaser.Display.Color.IntegerToColor(stop1.color);
            const color2 = Phaser.Display.Color.IntegerToColor(stop2.color);
            color = Phaser.Display.Color.Interpolate.ColorWithColor(color1, color2, 1, localRatio);
            break;
          }
        }
        
        if (!color) {
          color = Phaser.Display.Color.IntegerToColor(0x87CEEB);
        }
        
        this.skyBackground.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
        this.skyBackground.fillRect(0, i, width, Math.min(bandHeight, height - i));
      }
      
      // Add some nice white clouds during day with smooth movement
      this.skyBackground.fillStyle(0xFFFFFF, 0.6);
      for (let i = 0; i < 3; i++) {
        const cloudX = (i * 300 + this._cloudOffset * 2) % (width + 400) - 200;
        const cloudY = 80 + i * 60;
        this.skyBackground.fillEllipse(cloudX, cloudY, 150, 50);
        this.skyBackground.fillEllipse(cloudX - 40, cloudY, 100, 40);
        this.skyBackground.fillEllipse(cloudX + 40, cloudY, 100, 40);
      }
    }

    // Add stars during night
    if (t < 0.2 || t > 0.8) {
      const starAlpha = t < 0.2 ? (0.2 - t) / 0.2 : (t - 0.8) / 0.2;
      this.skyBackground.fillStyle(0xFFFFFF, starAlpha * 0.8);
      
      // Draw stars
      for (let i = 0; i < 50; i++) {
        const starX = (i * 73) % width;
        const starY = (i * 37) % (height * 0.6);
        const starSize = 1 + (i % 3);
        this.skyBackground.fillCircle(starX, starY, starSize);
      }
    }

    // Sun position lerp
    let sunX = Phaser.Math.Linear(this.sunStartX, this.sunEndX, t);
    let sunY = Phaser.Math.Linear(this.sunStartY, this.sunEndY, t);

    // Sun color based on time of day
    let sunColor;
    if (t > 0.8) {
      // Sunset transition
      const sunsetT = (t - 0.8) / 0.2;
      sunColor = Phaser.Display.Color.GetColor(
        Phaser.Math.Linear(255, 255, sunsetT),  // R: FF -> FF
        Phaser.Math.Linear(224, 160, sunsetT),  // G: E0 -> A0
        Phaser.Math.Linear(102, 122, sunsetT)   // B: 66 -> 7A
      );
    } else if (t < 0.2) {
      // Sunrise transition
      const sunriseT = t / 0.2;
      sunColor = Phaser.Display.Color.GetColor(
        Phaser.Math.Linear(255, 255, sunriseT),  // R: FF -> FF
        Phaser.Math.Linear(160, 224, sunriseT),  // G: A0 -> E0
        Phaser.Math.Linear(122, 102, sunriseT)   // B: 7A -> 66
      );
    } else {
      sunColor = 0xFFE066; // Normal sun color
    }

    // Redraw sun
    this.sun.clear();
    this.sun.fillStyle(sunColor);
    this.sun.fillCircle(sunX, sunY, 80);

    // Lighting overlay: alpha increases as sun sets
    let overlayAlpha = Phaser.Math.Linear(0, 0.55, t); // 0 (day) to 0.55 (night)
    this.lightingOverlay.clear();
    this.lightingOverlay.fillStyle(0x222244, overlayAlpha);
    this.lightingOverlay.fillRect(0, 0, this.scale.width, this.cameras.main.height);

    // Update all bullets
    this.bulletGroup.getChildren().forEach(bullet => {
      if (bullet.active) {
        bullet.update();
      }
    });
  }

  toggleBuildMode() {
    this.buildMode = !this.buildMode;
    
    // Update UI to reflect mode change
    if (this.gameUI) {
      this.gameUI.setBuildMode(this.buildMode);
    }
    
    if (this.buildMode) {
      // Initialize build UI if needed
      if (!this.buildUIInitialized) {
        this.initializeBuildUI();
        this.buildUIInitialized = true;
      }
      // Show build mode indicator
      this.showBuildModeIndicator();
    } else {
      if (this.previewBlock) this.previewBlock.setVisible(false);
      // Hide build mode indicator
      this.hideBuildModeIndicator();
    }
  }
  
  showBuildModeIndicator() {
    // Create build mode text if it doesn't exist - smaller and less obtrusive
    if (!this.buildModeText) {
      this.buildModeText = this.add.text(
        20,
        20,
        'BUILD MODE',
        {
          fontSize: '24px',
          fontFamily: 'Arial Black',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 4,
          shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 3, stroke: true, fill: true }
        }
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(10000);
    }
    
    // Simple fade in
    this.buildModeText.setVisible(true);
    this.buildModeText.setAlpha(0);
    
    this.tweens.add({
      targets: this.buildModeText,
      alpha: 1,
      duration: 200,
      ease: 'Linear'
    });
    
    // Add subtle instruction text
    if (!this.buildInstructionText) {
      this.buildInstructionText = this.add.text(
        20,
        48,
        'Click: Place | X: Delete | Shift: Exit',
        {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
        }
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(10000);
    }
    this.buildInstructionText.setVisible(true);
    this.buildInstructionText.setAlpha(0);
    
    this.tweens.add({
      targets: this.buildInstructionText,
      alpha: 0.9,
      duration: 200
    });
  }
  
  hideBuildModeIndicator() {
    if (this.buildModeText) {
      this.tweens.add({
        targets: this.buildModeText,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.buildModeText.setVisible(false);
        }
      });
    }
    
    if (this.buildInstructionText) {
      this.tweens.add({
        targets: this.buildInstructionText,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.buildInstructionText.setVisible(false);
        }
      });
    }
  }

  setSelectedBuilding(type) {
    console.log('Setting selected building to:', type);
    this.selectedBuilding = type;
    // Update the build hotbar selection
    this.updateBuildHotbarSelection();
    // Update preview block texture if it exists
    if (this.previewBlock) {
      this.previewBlock.setTexture(this.buildingSprites[this.selectedBuilding]);
    }
  }
  
  createBottomUIPanel() {
    // Create a DOM element for the UI panel
    const uiPanel = document.createElement('div');
    uiPanel.id = 'bottom-ui-panel';
    uiPanel.style.position = 'absolute';
    uiPanel.style.bottom = '0';
    uiPanel.style.left = '0';
    uiPanel.style.width = '100%';
    uiPanel.style.height = '100px';
    uiPanel.style.background = 'linear-gradient(to top, rgba(34,34,68,0.95) 0%, rgba(44,44,88,0.9) 50%, rgba(34,34,68,0.85) 100%)';
    uiPanel.style.borderTop = '3px solid #ffe066';
    uiPanel.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,224,102,0.3)';
    uiPanel.style.zIndex = '998'; // Below hotbars but above game
    uiPanel.style.overflow = 'hidden';
    
    // Add decorative elements
    const leftDecor = document.createElement('div');
    leftDecor.style.position = 'absolute';
    leftDecor.style.left = '0';
    leftDecor.style.top = '0';
    leftDecor.style.width = '200px';
    leftDecor.style.height = '100%';
    leftDecor.style.background = 'linear-gradient(to right, rgba(255,224,102,0.1) 0%, transparent 100%)';
    leftDecor.style.clipPath = 'polygon(0 0, 100% 0, 80% 100%, 0 100%)';
    uiPanel.appendChild(leftDecor);
    
    const rightDecor = document.createElement('div');
    rightDecor.style.position = 'absolute';
    rightDecor.style.right = '0';
    rightDecor.style.top = '0';
    rightDecor.style.width = '200px';
    rightDecor.style.height = '100%';
    rightDecor.style.background = 'linear-gradient(to left, rgba(255,224,102,0.1) 0%, transparent 100%)';
    rightDecor.style.clipPath = 'polygon(20% 0, 100% 0, 100% 100%, 0 100%)';
    uiPanel.appendChild(rightDecor);
    
    // Add subtle pattern overlay
    const pattern = document.createElement('div');
    pattern.style.position = 'absolute';
    pattern.style.top = '0';
    pattern.style.left = '0';
    pattern.style.width = '100%';
    pattern.style.height = '100%';
    pattern.style.opacity = '0.05';
    pattern.style.backgroundImage = `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255,224,102,0.1) 10px,
      rgba(255,224,102,0.1) 20px
    )`;
    uiPanel.appendChild(pattern);
    
    // Add glow line at top
    const glowLine = document.createElement('div');
    glowLine.style.position = 'absolute';
    glowLine.style.top = '0';
    glowLine.style.left = '0';
    glowLine.style.width = '100%';
    glowLine.style.height = '2px';
    glowLine.style.background = 'linear-gradient(to right, transparent 0%, #ffe066 50%, transparent 100%)';
    glowLine.style.boxShadow = '0 0 10px #ffe066';
    glowLine.style.animation = 'glowPulse 3s ease-in-out infinite';
    uiPanel.appendChild(glowLine);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes glowPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    // Add game log area (left side)
    const gameLogArea = document.createElement('div');
    gameLogArea.id = 'game-log-container';
    gameLogArea.style.position = 'absolute';
    gameLogArea.style.left = '370px'; // Position after UI panel (350px + 20px margin)
    gameLogArea.style.top = '5px';
    gameLogArea.style.width = '450px';
    gameLogArea.style.height = '90px';
    gameLogArea.style.color = '#ffffff';
    gameLogArea.style.fontFamily = 'Arial, sans-serif';
    gameLogArea.style.fontSize = '15px';
    gameLogArea.style.overflow = 'hidden';
    gameLogArea.style.display = 'flex';
    gameLogArea.style.flexDirection = 'column-reverse';
    gameLogArea.style.background = 'rgba(0,0,0,0.3)';
    gameLogArea.style.borderRadius = '8px';
    gameLogArea.style.padding = '5px 10px';
    gameLogArea.style.border = '1px solid rgba(255,224,102,0.3)';
    
    const gameLogTitle = document.createElement('div');
    gameLogTitle.style.color = '#ffe066';
    gameLogTitle.style.fontSize = '14px';
    gameLogTitle.style.marginBottom = '5px';
    gameLogTitle.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    gameLogTitle.style.fontWeight = 'bold';
    gameLogTitle.style.letterSpacing = '1px';
    gameLogTitle.textContent = 'GAME LOG';
    
    const gameLog = document.createElement('div');
    gameLog.id = 'game-log';
    gameLog.style.flex = '1';
    gameLog.style.overflowY = 'auto';
    gameLog.style.scrollbarWidth = 'thin';
    gameLog.style.scrollbarColor = '#ffe066 rgba(0,0,0,0.3)';
    gameLog.style.paddingRight = '5px';
    
    // Custom scrollbar for webkit browsers
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      #game-log::-webkit-scrollbar {
        width: 6px;
      }
      #game-log::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.3);
        border-radius: 3px;
      }
      #game-log::-webkit-scrollbar-thumb {
        background: #ffe066;
        border-radius: 3px;
      }
      #game-log::-webkit-scrollbar-thumb:hover {
        background: #ffcc00;
      }
    `;
    document.head.appendChild(scrollbarStyle);
    
    gameLogArea.appendChild(gameLog);
    gameLogArea.appendChild(gameLogTitle);
    uiPanel.appendChild(gameLogArea);
    
    // Add mini-map area (right side)
    const minimapArea = document.createElement('div');
    minimapArea.style.position = 'absolute';
    minimapArea.style.right = '20px';
    minimapArea.style.top = '10px';
    minimapArea.style.width = '80px';
    minimapArea.style.height = '80px';
    minimapArea.style.background = 'rgba(0,0,0,0.5)';
    minimapArea.style.border = '2px solid #ffe066';
    minimapArea.style.borderRadius = '8px';
    minimapArea.style.overflow = 'hidden';
    uiPanel.appendChild(minimapArea);
    
    const minimapLabel = document.createElement('div');
    minimapLabel.style.position = 'absolute';
    minimapLabel.style.bottom = '2px';
    minimapLabel.style.left = '50%';
    minimapLabel.style.transform = 'translateX(-50%)';
    minimapLabel.style.fontSize = '10px';
    minimapLabel.style.color = '#ffe066';
    minimapLabel.style.fontFamily = 'Arial, sans-serif';
    minimapLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    minimapLabel.textContent = 'MAP';
    minimapArea.appendChild(minimapLabel);
    
    document.body.appendChild(uiPanel);
    this.uiPanel = uiPanel;
    
    // Initialize game log
    this.gameLog = [];
    this.maxGameLogEntries = 8;  // More entries for the bigger log
    
    // Update hotbar positions to sit properly on the panel after a short delay
    this.time.delayedCall(100, () => {
      this.updateHotbarPositions();
    });
  }
  
  updateHotbarPositions() {
    // Update inventory hotbar position - find by ID instead of class
    if (this.inventoryUI && this.inventoryUI.hotbar) {
      this.inventoryUI.hotbar.style.bottom = '20px'; // Sits nicely on the panel
    }
    
    // Update build hotbar position
    if (this.buildHotbar) {
      this.buildHotbar.style.bottom = '20px'; // Sits nicely on the panel
    }
  }

  addGameLogEntry(type, data) {
    // Use the game UI system if available
    if (this.gameUI) {
      this.gameUI.addChatMessage({ type, ...data });
      return;
    }
    
    // Fallback to old system if enhanced UI not available
    const gameLogDiv = document.getElementById('game-log');
    if (!gameLogDiv) return;
    
    // Create log entry
    const entry = document.createElement('div');
    entry.style.marginBottom = '4px';
    entry.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    entry.style.opacity = '0';
    entry.style.transition = 'opacity 0.3s';
    entry.style.lineHeight = '1.4';
    
    // Get role colors
    const roleColors = {
      'owner': '#ffe066',      // Gold
      'admin': '#9b59b6',      // Purple
      'mod': '#95a5a6',        // Silver
      'player': '#ffffff'      // White
    };
    
    // Add symbols for special roles
    const roleSymbols = {
      'owner': '',            // Using crown image in chat instead
      'admin': '★',           // Star for admin
      'mod': '◆',             // Diamond for mod
      'player': ''            // No symbol for regular players
    };
    
    // Add timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const timestamp = `<span style="color: #888888; font-size: 12px">[${timeStr}]</span> `;
    
    let content = timestamp;
    
    switch(type) {
      case 'kill':
        const killerColor = roleColors[data.killerRole] || roleColors.player;
        const victimColor = roleColors[data.victimRole] || roleColors.player;
        const killerSymbol = roleSymbols[data.killerRole] || '';
        const victimSymbol = roleSymbols[data.victimRole] || '';
        const killerName = data.killer.charAt(0).toUpperCase() + data.killer.slice(1);
        const victimName = data.victim.charAt(0).toUpperCase() + data.victim.slice(1);
        content += `<span style="color: ${killerColor}">${killerSymbol}${killerName}</span> eliminated <span style="color: ${victimColor}">${victimSymbol}${victimName}</span>`;
        break;
        
      case 'join':
        const joinColor = roleColors[data.role] || roleColors.player;
        const joinSymbol = roleSymbols[data.role] || '';
        const joinName = data.username.charAt(0).toUpperCase() + data.username.slice(1);
        if (data.role === 'owner') {
          content += `<span style="color: #00ff00">➤</span> The owner <span style="color: ${joinColor}">${joinSymbol}${joinName}</span> has joined the game!`;
        } else if (data.role === 'admin') {
          content += `<span style="color: #00ff00">➤</span> Administrator <span style="color: ${joinColor}">${joinSymbol}${joinName}</span> has joined the game`;
        } else if (data.role === 'mod') {
          content += `<span style="color: #00ff00">➤</span> Moderator <span style="color: ${joinColor}">${joinSymbol}${joinName}</span> has joined the game`;
        } else {
          content += `<span style="color: #00ff00">➤</span> <span style="color: ${joinColor}">${joinSymbol}${joinName}</span> joined the game`;
        }
        break;
        
      case 'leave':
        const leaveColor = roleColors[data.role] || roleColors.player;
        const leaveSymbol = roleSymbols[data.role] || '';
        const leaveName = data.username.charAt(0).toUpperCase() + data.username.slice(1);
        content += `<span style="color: #ff0000">➤</span> <span style="color: ${leaveColor}">${leaveSymbol}${leaveName}</span> left the game`;
        break;
        
      case 'message':
        content += `<span style="color: #ffcc00">⚠</span> ${data.text}`;
        break;
        
      case 'announcement':
        content += `<span style="color: #ff6b6b; font-size: 14px">📢 SERVER:</span> <span style="color: #ffe066; font-weight: bold">${data.message}</span>`;
        break;
        
      case 'chat':
        const chatColor = roleColors[data.role] || roleColors.player;
        const chatSymbol = roleSymbols[data.role] || '';
        const chatName = data.username.charAt(0).toUpperCase() + data.username.slice(1);
        content += `<span style="color: ${chatColor}">${chatSymbol}${chatName}:</span> <span style="color: #ffffff">${data.message}</span>`;
        break;
    }
    
    entry.innerHTML = content;
    
    // Add to log
    gameLogDiv.insertBefore(entry, gameLogDiv.firstChild);
    
    // Fade in
    setTimeout(() => {
      entry.style.opacity = '1';
    }, 10);
    
    // Keep only last N entries
    while (gameLogDiv.children.length > this.maxGameLogEntries) {
      gameLogDiv.removeChild(gameLogDiv.lastChild);
    }
    
    // Auto fade old entries
    this.time.delayedCall(15000, () => {
      if (entry.parentNode) {
        entry.style.opacity = '0.6';
      }
    });
  }

  createBuildingUI() {
    // Floating build menu is deprecated - using build hotbar instead
    return;
    const blockHeight = 50;
    const blockCount = this.buildingTypes.length;
    const paddingY = 30;
    const paddingX = 24;
    let maxLabelWidth = 0;
    this.buildingTypes.forEach((type) => {
      maxLabelWidth = Math.max(maxLabelWidth, type.length * 14 + 20);
    });
    const menuWidth = 40 + 40 + maxLabelWidth + paddingX * 2;
    const menuHeight = blockCount * blockHeight + paddingY * 2 + 40;
    // --- Load menu position from localStorage ---
    let menuPos = { x: 40, y: 40 }; // Default position (top-left corner)
    try {
      const saved = localStorage.getItem('buildMenuPos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          menuPos = parsed;
        }
      }
    } catch (e) {}
    let bgX = menuPos.x;
    let bgY = menuPos.y;
    // --- Draw background with border, rounded corners, and shadow ---
    this._buildMenuBg = this.add.graphics();
    this._buildMenuBg.setDepth(1000000);
    this._buildMenuBg.setScrollFactor(0);
    this._buildMenuBg.fillStyle(0x000000, 0.35);
    this._buildMenuBg.fillRoundedRect(bgX + 4, bgY + 6, menuWidth, menuHeight, 22);
    this._buildMenuBg.fillStyle(0x222a44, 0.92);
    this._buildMenuBg.fillRoundedRect(bgX, bgY, menuWidth, menuHeight, 22);
    this._buildMenuBg.lineStyle(4, 0xffe066, 1);
    this._buildMenuBg.strokeRoundedRect(bgX, bgY, menuWidth, menuHeight, 22);
    this._buildMenuObjects.push(this._buildMenuBg);
    // --- Add highlight for selected block (always push to _buildMenuObjects) ---
    const selectedIdx = this.buildingTypes.indexOf(this.selectedBuilding);
    let highlight = null;
    if (selectedIdx !== -1) {
      const highlightY = bgY + paddingY + 40 + selectedIdx * blockHeight;
      highlight = this.add.graphics();
      highlight.setDepth(1000001);
      highlight.setScrollFactor(0);
      highlight.fillStyle(0xffe066, 0.22);
      highlight.fillRoundedRect(bgX + 8, highlightY - 25, menuWidth - 16, blockHeight - 0, 14);
      highlight.lineStyle(3, 0xffe066, 0.7);
      highlight.strokeRoundedRect(bgX + 8, highlightY - 25, menuWidth - 16, blockHeight - 0, 14);
      this._buildMenuObjects.push(highlight);
      this._selectedHighlight = highlight;
    } else {
      this._selectedHighlight = null;
    }
    // --- Title (draggable) ---
    const title = this.add.text(bgX + menuWidth / 2, bgY + 18, 'Build Menu', {
      fontSize: '24px', fontFamily: 'MedievalSharp, Arial', color: '#ffe066', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0.5).setDepth(1000001).setScrollFactor(0);
    title.setInteractive({ draggable: true, useHandCursor: true });
    title.setVisible(true).setAlpha(1);
    this._buildMenuObjects.push(title);
    // --- Store menu item references for drag ---
    this._menuItemPositions = [];
    this._menuBgX = bgX;
    this._menuBgY = bgY;
    this._menuWidth = menuWidth;
    this._menuHeight = menuHeight;
    this._menuPaddingY = paddingY;
    this._menuBlockHeight = blockHeight;
    // --- Add icons/labels with drag-and-drop reordering ---
    this.buildingTypes.forEach((type, i) => {
      const y = bgY + paddingY + 40 + i * blockHeight;
      const textureKey = this.buildingSprites[type];
      // KEY LABEL
      let keyLabel = this.add.text(bgX + 18, y, (i < 9 ? (i+1).toString() : ''), { fontSize: '18px', color: '#ffe066', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 });
      keyLabel.setOrigin(0.5, 0.5);
      keyLabel.setDepth(1000001);
      keyLabel.setScrollFactor(0);
      keyLabel.type = 'keyLabel';
      keyLabel.setVisible(true).setAlpha(1);
      keyLabel.setInteractive({ useHandCursor: true });
      keyLabel.on('pointerdown', () => {
        console.log('Key label clicked:', type);
        this.setSelectedBuilding(type);
      });
      // ICON
      let icon = this.add.image(bgX + 48, y, textureKey).setDisplaySize(40, 40);
      icon.setOrigin(0.5, 0.5);
      icon.setInteractive({ draggable: true, useHandCursor: true, pixelPerfect: false });
      icon.setDepth(1000001);
      icon.setScrollFactor(0);
      icon.type = 'icon';
      icon.setVisible(true).setAlpha(1);
      icon.blockType = type;
      icon.buildIndex = i;  // Store index for debugging
      // LABEL
      let label = this.add.text(bgX + 90, y, type.toUpperCase(), { fontSize: '20px', color: '#fff', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 });
      label.setOrigin(0, 0.5);
      label.setDepth(1000001);
      label.setScrollFactor(0);
      label.type = 'label';
      label.setVisible(true).setAlpha(1);
      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => {
        console.log('Label clicked:', type);
        this.setSelectedBuilding(type);
      });
      // Track if the icon is being dragged
      let iconDragStarted = false;
      
      icon.on('pointerdown', (pointer) => {
        console.log('Icon clicked:', type);
        iconDragStarted = false;
        // Set selected building immediately on click
        this.setSelectedBuilding(type);
      });
      
      icon.on('dragstart', () => {
        iconDragStarted = true;
      });
      
      this.input.setDraggable(icon, true);
      this._buildMenuObjects.push(keyLabel, icon, label);
      this._menuItemPositions.push({
        keyLabel, icon, label,
        relY: paddingY + 40 + i * blockHeight
      });
    });

    // --- Menu dragging logic ---
    let isDraggingMenu = false;
    let menuDragStartX = 0;
    let menuDragStartY = 0;
    
    // Add drag handlers for title
    title.on('dragstart', (pointer) => {
      isDraggingMenu = true;
      menuDragStartX = pointer.x;
      menuDragStartY = pointer.y;
    });
    
    title.on('drag', (pointer, dragX, dragY) => {
      if (!isDraggingMenu) return;
      
      const deltaX = dragX - title.x;
      const deltaY = dragY - title.y;
      
      // Update all menu elements positions
      this._buildMenuBg.clear();
      bgX += deltaX;
      bgY += deltaY;
      
      // Redraw background at new position
      this._buildMenuBg.fillStyle(0x000000, 0.35);
      this._buildMenuBg.fillRoundedRect(bgX + 4, bgY + 6, menuWidth, menuHeight, 22);
      this._buildMenuBg.fillStyle(0x222a44, 0.92);
      this._buildMenuBg.fillRoundedRect(bgX, bgY, menuWidth, menuHeight, 22);
      this._buildMenuBg.lineStyle(4, 0xffe066, 1);
      this._buildMenuBg.strokeRoundedRect(bgX, bgY, menuWidth, menuHeight, 22);
      
      // Update title position
      title.setPosition(bgX + menuWidth / 2, bgY + 18);
      
      // Update highlight if it exists
      if (this._selectedHighlight) {
        const selectedIdx = this.buildingTypes.indexOf(this.selectedBuilding);
        if (selectedIdx !== -1) {
          const highlightY = bgY + paddingY + 40 + selectedIdx * blockHeight;
          this._selectedHighlight.clear();
          this._selectedHighlight.fillStyle(0xffe066, 0.22);
          this._selectedHighlight.fillRoundedRect(bgX + 8, highlightY - 25, menuWidth - 16, blockHeight - 0, 14);
          this._selectedHighlight.lineStyle(3, 0xffe066, 0.7);
          this._selectedHighlight.strokeRoundedRect(bgX + 8, highlightY - 25, menuWidth - 16, blockHeight - 0, 14);
        }
      }
      
      // Update all menu items
      this._menuItemPositions.forEach((item, i) => {
        const y = bgY + paddingY + 40 + i * blockHeight;
        item.keyLabel.setPosition(bgX + 18, y);
        item.icon.setPosition(bgX + 48, y);
        item.label.setPosition(bgX + 90, y);
      });
    });
    
    title.on('dragend', () => {
      isDraggingMenu = false;
      // Save final position to localStorage
      try {
        localStorage.setItem('buildMenuPos', JSON.stringify({ x: bgX, y: bgY }));
      } catch (e) {}
    });

    // --- Drag-and-drop reordering logic ---
    // Clean up any existing drag event listeners for build menu
    if (this._buildMenuDragHandlers) {
      this.input.off('dragstart', this._buildMenuDragHandlers.dragstart);
      this.input.off('drag', this._buildMenuDragHandlers.drag);
      this.input.off('dragend', this._buildMenuDragHandlers.dragend);
    }
    
    let dragIcon = null;
    let dragStartIndex = null;
    let dragStartY = null;
    let dragGhost = null;
    let dragOverIndex = null;
    
    // Store handlers so we can remove them later
    this._buildMenuDragHandlers = {
      dragstart: (pointer, gameObject) => {
        if (!gameObject || !gameObject.type || gameObject.type !== 'icon') return;
        console.log('Drag start on icon:', gameObject.blockType);
        dragIcon = gameObject;
        dragStartIndex = this._menuItemPositions.findIndex(item => item.icon === dragIcon);
        dragStartY = dragIcon.y;
        dragGhost = this.add.image(dragIcon.x, dragIcon.y, dragIcon.texture.key)
          .setDisplaySize(40, 40)
          .setAlpha(0.5)
          .setDepth(1000002)
          .setScrollFactor(0);
        dragIcon.setAlpha(0.3);
      },
      drag: (pointer, gameObject, dragX, dragY) => {
        if (!dragIcon || gameObject !== dragIcon) return;
        // Keep ghost at same X position, only move Y
        if (dragGhost) {
          dragGhost.setPosition(dragIcon.x, pointer.y);
        }
        // Find which slot we're over based on pointer position
        const menuY = this._menuBgY || bgY;
        const relY = pointer.y - (menuY + paddingY + 40);
        let overIdx = Math.round(relY / blockHeight);
        overIdx = Math.max(0, Math.min(this.buildingTypes.length - 1, overIdx));
        dragOverIndex = overIdx;
        
        // Visual feedback - highlight the target position
        if (this.dragTargetHighlight) {
          this.dragTargetHighlight.destroy();
        }
        const targetY = menuY + paddingY + 40 + overIdx * blockHeight;
        this.dragTargetHighlight = this.add.graphics()
          .fillStyle(0xffe066, 0.3)
          .fillRect(this._menuBgX || bgX, targetY - 20, menuWidth - 20, 40)
          .setDepth(1000000)
          .setScrollFactor(0);
      },
      dragend: (pointer, gameObject) => {
        if (!dragIcon || gameObject !== dragIcon) return;
        if (dragGhost) dragGhost.destroy();
        dragIcon.setAlpha(1);
        
        // Clean up drag target highlight
        if (this.dragTargetHighlight) {
          this.dragTargetHighlight.destroy();
          this.dragTargetHighlight = null;
        }
        
        if (dragOverIndex !== null && dragOverIndex !== dragStartIndex) {
          // Reorder buildingTypes
          const moved = this.buildingTypes.splice(dragStartIndex, 1)[0];
          this.buildingTypes.splice(dragOverIndex, 0, moved);
          // Persist to localStorage
          try {
            localStorage.setItem('buildMenuOrder', JSON.stringify(this.buildingTypes));
          } catch (e) {}
          // Persist to server
          if (this.multiplayer && this.multiplayer.socket) {
            this.multiplayer.socket.emit('updateBuildingOrder', this.buildingTypes);
          }
          // Re-render menu
          this.createBuildingUI();
        }
        dragIcon = null;
        dragStartIndex = null;
        dragStartY = null;
        dragGhost = null;
        dragOverIndex = null;
      }
    };
    
    this.input.on('dragstart', this._buildMenuDragHandlers.dragstart);
    this.input.on('drag', this._buildMenuDragHandlers.drag);
    this.input.on('dragend', this._buildMenuDragHandlers.dragend);

    // --- On menu open, load order from localStorage if available ---
    try {
      const savedOrder = localStorage.getItem('buildMenuOrder');
      if (savedOrder) {
        const arr = JSON.parse(savedOrder);
        if (Array.isArray(arr) && arr.length === this.buildingTypes.length && arr.every(t => this.buildingTypes.includes(t))) {
          this.buildingTypes = arr;
        }
      }
    } catch (e) {}
  }

  updateBuildingUI() {
    // Floating build menu is no longer used - using build hotbar instead
  }
  
  renderWeaponShop(shopArea) {
    // Remove old weapon shop text if it exists
    if (this.weaponShopText) {
      this.weaponShopText.destroy();
    }
    
    // Create "Weapon Store" text floating above the gold floor
    const centerX = shopArea.x + (shopArea.width / 2);
    const textY = shopArea.y - 100; // Float above the shop area
    
    this.weaponShopText = this.add.text(centerX, textY, 'WEAPON STORE', {
      fontSize: '48px',
      fontFamily: 'Arial Black',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 10, stroke: true, fill: true }
    })
    .setOrigin(0.5, 0.5)
    .setDepth(900);
    
    // Add pulsing animation to the text
    this.tweens.add({
      targets: this.weaponShopText,
      scale: 1.1,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    
    // Add a subtle glow effect
    this.tweens.add({
      targets: this.weaponShopText,
      alpha: 0.8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  renderBuildings(buildings) {
    // Convert buildings to a JSON string for shallow comparison
    const buildingsStr = JSON.stringify(buildings);
    if (this._lastRenderedBuildingsStr === buildingsStr) {
      // No change, skip re-render
      return;
    }
    this._lastRenderedBuildingsStr = buildingsStr;
    // Remove old buildings
    if (this.buildGroup) {
      this.buildGroup.clear(true, true);
    }
    // Add new buildings
    for (const b of buildings) {
      const sprite = this.buildGroup.create(b.x, b.y, b.type)
        .setOrigin(0, 0)
        .setDisplaySize(64, 64);
      
      // Manually set the body size to match the visual sprite exactly
      sprite.body.setSize(64, 64, false);
      sprite.body.setOffset(0, 0);
      sprite.refreshBody();
      
      // Debug: Log the body position and size for the first few blocks
      if (this.buildGroup.children.entries.length <= 3) {
        console.log(`Block at (${b.x}, ${b.y}): body at (${sprite.body.x}, ${sprite.body.y}) size (${sprite.body.width}x${sprite.body.height})`);
        
      }
      
      // Optionally, tint doors for owner
      if (b.type === 'door' && b.owner === this.playerId) {
        sprite.setAlpha(1);
      } else if (b.type === 'door') {
        sprite.setAlpha(0.6); // Slightly transparent for non-owners
      }
    }
  }

  showCommandHelp() {
    this.addGameLogEntry('message', { text: '=== Available Commands ===' });
    
    const allCommands = [
      { cmd: '/help', desc: 'Show this help message', minRole: 'player' },
      { cmd: '/resetworld', desc: 'Reset all buildings', minRole: 'owner' },
      { cmd: '/promote [username] [role]', desc: 'Promote player to role', minRole: 'admin' },
      { cmd: '/resetpassword [username] [newpass]', desc: 'Reset player password', minRole: 'admin' },
      { cmd: '/kick [username]', desc: 'Kick player from server', minRole: 'mod' },
      { cmd: '/ban [username]', desc: 'Ban player permanently', minRole: 'mod' },
      { cmd: '/unban [username]', desc: 'Remove player ban', minRole: 'mod' },
      { cmd: '/tp [yourname] [targetname]', desc: 'Teleport target to you', minRole: 'mod' },
      { cmd: '/tpto [yourname] [targetname]', desc: 'Teleport to target', minRole: 'mod' },
      { cmd: '/fly [username] [1-10]', desc: 'Toggle fly mode with speed', minRole: 'mod' },
      { cmd: '/speed [username] [1-10]', desc: 'Set movement speed', minRole: 'mod' },
      { cmd: '/jump [username] [1-10]', desc: 'Set jump height', minRole: 'mod' }
    ];
    
    const playerRole = this.playerRole || 'player';
    const roleHierarchy = { 'player': 0, 'mod': 1, 'admin': 2, 'owner': 3 };
    const playerLevel = roleHierarchy[playerRole] || 0;
    
    // Filter commands based on player's role
    const availableCommands = allCommands.filter(cmd => {
      const cmdLevel = roleHierarchy[cmd.minRole] || 0;
      return playerLevel >= cmdLevel;
    });
    
    availableCommands.forEach(({ cmd, desc }) => {
      this.addGameLogEntry('message', { text: `${cmd} - ${desc}` });
    });
    
    this.addGameLogEntry('message', { text: 'Press T to chat with other players' });
  }

  openCommandPrompt() {
    if (this.commandInput) this.commandInput.remove();
    this.commandPromptOpen = true;
    this.input.keyboard.enabled = false;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Chat or use / for commands (e.g., /help)';
    input.style.position = 'absolute';
    
    // Calculate position relative to game viewport (accounting for UI panel)
    const uiPanelWidth = 350; // Width of the UI panel
    const windowWidth = window.innerWidth;
    const gameViewportWidth = windowWidth - uiPanelWidth;
    const centerOfGameViewport = uiPanelWidth + (gameViewportWidth / 2);
    
    input.style.left = centerOfGameViewport + 'px';
    input.style.top = '10%';
    input.style.transform = 'translateX(-50%)';
    input.style.width = '400px';
    input.style.fontSize = '22px';
    input.style.padding = '12px';
    input.style.borderRadius = '8px';
    input.style.border = '2px solid #ffe066';
    input.style.background = '#222244';
    input.style.color = '#ffe066';
    input.style.zIndex = '10000';  // Higher than UI panel
    input.style.outline = 'none';
    input.style.boxShadow = '0 4px 12px rgba(0,0,0,0.8)';
    document.body.appendChild(input);
    input.focus();
    input.value = '';
    this.commandInput = input;
    input.addEventListener('keydown', (e) => {
      // Only prevent game controls from reaching Phaser
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        e.stopPropagation();
      }
      if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text && this.playerSprite && this.multiplayer && this.multiplayer.socket) {
          if (text.startsWith('/')) {
            // It's a command
            const cmd = text.slice(1).trim();
            if (cmd === 'resetworld') {
              this.multiplayer.socket.emit('resetWorld');
            } else if (cmd === 'help') {
              this.showCommandHelp();
            } else {
              // Parse command format: /command [player] [value]
              const parts = cmd.split(' ');
              if (parts.length >= 1) {
                const [command, target, ...valueParts] = parts;
                const value = valueParts.join(' '); // Join remaining parts for multi-word values
                this.multiplayer.socket.emit('command', { command, target, value });
              }
            }
          } else {
            // It's a chat message
            this.multiplayer.socket.emit('chatMessage', { message: text });
          }
        }
        input.remove();
        this.commandPromptOpen = false;
        this.input.keyboard.enabled = true;
        // Reset all movement keys when closing
        if (this.cursors) {
          this.cursors.up.reset();
          this.cursors.left.reset();
          this.cursors.right.reset();
        }
      } else if (e.key === 'Escape') {
        input.remove();
        this.commandPromptOpen = false;
        this.input.keyboard.enabled = true;
        // Reset all movement keys when closing
        if (this.cursors) {
          this.cursors.up.reset();
          this.cursors.left.reset();
          this.cursors.right.reset();
        }
      }
    });
  }

  sendCommand(text) {
    if (!text) return;
    
    if (text.startsWith('/')) {
      // Parse command
      const parts = text.substring(1).split(' ');
      const command = parts[0];
      const target = parts[1] || '';
      const value = parts[2] || '';
      
      // Send command to server
      if (this.multiplayer && this.multiplayer.socket) {
        this.multiplayer.socket.emit('command', { command, target, value });
      }
    } else {
      // Send as chat message
      if (this.multiplayer && this.multiplayer.socket) {
        this.multiplayer.socket.emit('chatMessage', { message: text });
      }
    }
  }

  createBuildHotbar() {
    // Old build hotbar no longer used - build UI is now in the left panel
  }
  
  initializeBuildUI() {
    // Find the build container in the UI panel
    const buildContainer = document.getElementById('ui-build-container');
    if (!buildContainer) {
      console.error('Build container not found in UI panel');
      return;
    }
    
    // Clear any existing slots
    buildContainer.innerHTML = '';
    this.buildHotbarSlots = [];
    
    // Create slots for each building type (8 blocks in 4x2 grid)
    for (let i = 0; i < this.buildingTypes.length && i < 8; i++) {
      const slot = this.createBuildSlot(this.buildingTypes[i], i);
      buildContainer.appendChild(slot);
      this.buildHotbarSlots.push(slot);
    }
    
    // Select first building by default
    this.selectedBuilding = this.buildingTypes[0];
    this.updateBuildSelection();
  }
  
  createBuildSlot(type, index) {
    const slot = document.createElement('div');
    slot.style.width = '50px';
    slot.style.height = '50px';
    slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
    slot.style.border = '2px solid #444466';
    slot.style.borderRadius = '8px';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    slot.style.transition = 'all 0.2s';
    slot.style.userSelect = 'none';
    slot.setAttribute('data-building-type', type);
    slot.setAttribute('data-index', index);
    
    // Key indicator
    const keyIndicator = document.createElement('div');
    keyIndicator.className = 'key-indicator';
    keyIndicator.textContent = (index + 1).toString();
    keyIndicator.style.position = 'absolute';
    keyIndicator.style.top = '2px';
    keyIndicator.style.left = '4px';
    keyIndicator.style.color = '#ffe066';
    keyIndicator.style.fontSize = '10px';
    keyIndicator.style.fontWeight = 'bold';
    keyIndicator.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    keyIndicator.style.pointerEvents = 'none'; // Don't interfere with drag
    slot.appendChild(keyIndicator);
    
    // Building icon - make it draggable
    const icon = document.createElement('img');
    icon.src = `assets/blocks/${type}.png`;
    icon.style.width = '32px';
    icon.style.height = '32px';
    icon.style.imageRendering = 'pixelated';
    icon.style.cursor = 'grab';
    icon.draggable = true;
    icon.style.pointerEvents = 'none'; // Will be enabled during drag setup
    slot.appendChild(icon);
    
    // Building name tooltip
    slot.title = type.toUpperCase();
    
    // Make the entire slot draggable
    slot.draggable = true;
    
    // Drag event handlers
    slot.ondragstart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('buildIndex', index.toString());
      e.dataTransfer.setData('buildType', type);
      this.draggedBuildIndex = index;
      this.draggedBuildType = type;
      slot.style.opacity = '0.5';
      icon.style.cursor = 'grabbing';
    };
    
    slot.ondragend = () => {
      slot.style.opacity = '1';
      icon.style.cursor = 'grab';
      this.draggedBuildIndex = null;
      this.draggedBuildType = null;
    };
    
    slot.ondragover = (e) => {
      e.preventDefault();
      slot.style.background = 'linear-gradient(135deg, #3a3a55 0%, #2a2a44 100%)';
      slot.style.border = '2px solid #ffe066';
    };
    
    slot.ondragleave = () => {
      slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
      slot.style.border = '2px solid #444466';
    };
    
    slot.ondrop = (e) => {
      e.preventDefault();
      const sourceIndex = parseInt(e.dataTransfer.getData('buildIndex'));
      const targetIndex = index;
      
      if (sourceIndex !== targetIndex && sourceIndex >= 0 && sourceIndex < this.buildingTypes.length) {
        // Swap building types
        const temp = this.buildingTypes[sourceIndex];
        this.buildingTypes[sourceIndex] = this.buildingTypes[targetIndex];
        this.buildingTypes[targetIndex] = temp;
        
        // Check if the selected building was affected
        const wasSelectedSource = this.selectedBuilding === this.buildingTypes[targetIndex];
        const wasSelectedTarget = this.selectedBuilding === this.buildingTypes[sourceIndex];
        
        // Re-render the build UI
        this.initializeBuildUI();
        
        // Update preview block if selected building changed position
        if ((wasSelectedSource || wasSelectedTarget) && this.previewBlock) {
          this.previewBlock.setTexture(this.buildingSprites[this.selectedBuilding]);
        }
        
        // Save the new order
        try {
          localStorage.setItem('buildMenuOrder', JSON.stringify(this.buildingTypes));
        } catch (e) {
          console.error('Failed to save building order:', e);
        }
        
        // Update server if connected
        if (this.multiplayer && this.multiplayer.socket) {
          this.multiplayer.socket.emit('updateBuildingOrder', this.buildingTypes);
        }
      }
      
      // Reset styling
      slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
      slot.style.border = '2px solid #444466';
    };
    
    // Click handler
    slot.onclick = () => {
      this.setSelectedBuilding(type);
    };
    
    // Hover effects
    slot.onmouseover = () => {
      if (this.selectedBuilding !== type) {
        slot.style.border = '2px solid #888899';
        slot.style.transform = 'scale(1.05)';
      }
    };
    
    slot.onmouseout = () => {
      if (this.selectedBuilding !== type) {
        slot.style.border = '2px solid #444466';
        slot.style.transform = 'scale(1)';
      }
    };
    
    return slot;
  }

  createBuildHotbarSlot(type, index) {
    const slot = document.createElement('div');
    slot.style.width = '60px';
    slot.style.height = '60px';
    slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
    slot.style.border = '2px solid #444466';
    slot.style.borderRadius = '10px';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    slot.style.transition = 'all 0.2s';
    
    // Key indicator
    const keyIndicator = document.createElement('div');
    keyIndicator.textContent = (index + 1).toString();
    keyIndicator.style.position = 'absolute';
    keyIndicator.style.top = '2px';
    keyIndicator.style.left = '4px';
    keyIndicator.style.color = '#ffe066';
    keyIndicator.style.fontSize = '12px';
    keyIndicator.style.fontWeight = 'bold';
    keyIndicator.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    slot.appendChild(keyIndicator);
    
    // Building icon
    const icon = document.createElement('img');
    icon.src = `assets/blocks/${type}.png`;
    icon.style.width = '40px';
    icon.style.height = '40px';
    icon.style.imageRendering = 'pixelated';
    slot.appendChild(icon);
    
    // Building name tooltip
    slot.title = type.toUpperCase();
    
    // Click handler
    slot.onclick = () => {
      this.setSelectedBuilding(type);
    };
    
    // Hover effects
    slot.onmouseover = () => {
      if (this.selectedBuilding !== type) {
        slot.style.border = '2px solid #888899';
        slot.style.transform = 'scale(1.05)';
      }
    };
    
    slot.onmouseout = () => {
      if (this.selectedBuilding !== type) {
        slot.style.border = '2px solid #444466';
        slot.style.transform = 'scale(1)';
      }
    };
    
    // Right-click for rebinding
    slot.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.keyBindingManager) {
        this.keyBindingManager.startRebinding(index, 'build');
      }
      return false;
    };
    
    slot.dataset.buildingType = type;
    return slot;
  }

  updateBuildSelection() {
    if (!this.buildHotbarSlots) return;
    this.buildHotbarSlots.forEach((slot, index) => {
      const type = this.buildingTypes[index];
      if (type === this.selectedBuilding) {
        slot.style.border = '2px solid #ffe066';
        slot.style.boxShadow = '0 0 12px rgba(255,224,102,0.5)';
        slot.style.transform = 'scale(1.1)';
      } else {
        slot.style.border = '2px solid #444466';
        slot.style.boxShadow = 'none';
        slot.style.transform = 'scale(1)';
      }
    });
  }
  
  updateBuildHotbarSelection() {
    // Redirect to new method
    this.updateBuildSelection();
  }
  

  shutdown() {
    // Clean up ALL UI elements
    this.cleanupAllUI();
    
    // Clean up build hotbar
    if (this.buildHotbar) {
      this.buildHotbar.remove();
    }
    // Clean up document-level event listener
    document.removeEventListener('keydown', this._tKeyHandler);
    // Remove Phaser input event listeners
    if (this.input && this.input.keyboard) {
      this.input.keyboard.off('keydown-ONE', this._keydownOneHandler);
      this.input.keyboard.off('keydown-TWO', this._keydownTwoHandler);
      this.input.keyboard.off('keydown-THREE', this._keydownThreeHandler);
      this.input.keyboard.off('keydown-FOUR', this._keydownFourHandler);
      this.input.keyboard.off('keydown-FIVE', this._keydownFiveHandler);
      this.input.keyboard.off('keydown-SIX', this._keydownSixHandler);
      this.input.keyboard.off('keydown-SEVEN', this._keydownSevenHandler);
      this.input.keyboard.off('keydown-EIGHT', this._keydownEightHandler);
      this.input.keyboard.off('keydown-SHIFT', this._keydownShiftHandler);
      this.input.keyboard.off('keydown-X', this._keydownXHandler);
    }
    if (this.input) {
      this.input.off('pointerdown', this._pointerDownHandler);
      this.input.off('pointermove', this._pointerMoveHandler);
      this.input.off('pointerup', this._pointerUpHandler);
    }
    // Clean up bullet groups and events
    if (this.bulletGroup) {
      this.bulletGroup.clear(true, true);
    }
    this.events.off('bulletCreated');
    if (this.multiplayer && this.multiplayer.socket) {
      this.multiplayer.socket.off('bulletCreated');
      this.multiplayer.socket.off('worldState');
      this.multiplayer.socket.off('serverRestart');
      this.multiplayer.socket.off('disconnect');
    }
  }

  renderSkyGradient() {
    if (!this.skyBackground) return;
    
    // Clear previous content
    this.skyBackground.clear();
    
    const width = this.scale.width;
    // Use camera viewport height instead of full scale height to match the visible area
    const height = this.cameras.main.height;
    
    // First fill entire background with base sky color to prevent any gaps
    this.skyBackground.fillStyle(0x87CEEB, 1);
    this.skyBackground.fillRect(0, 0, width, height);
    
    // Day time gradient - smooth blue
    const bandHeight = 16; // Use larger bands for initial render to avoid artifacts
    for (let i = 0; i <= height; i += bandHeight) {
      const ratio = i / height;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x87CEEB), // Sky blue
        Phaser.Display.Color.IntegerToColor(0xB0E0E6), // Powder blue
        1, ratio
      );
      
      this.skyBackground.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      this.skyBackground.fillRect(0, i, width, Math.min(bandHeight, height - i));
    }
    
    // Add some nice white clouds during day
    this.skyBackground.fillStyle(0xFFFFFF, 0.6);
    for (let i = 0; i < 3; i++) {
      const cloudX = (i * 300 + 100) % (width + 400) - 200;
      const cloudY = 80 + i * 60;
      this.skyBackground.fillEllipse(cloudX, cloudY, 150, 50);
      this.skyBackground.fillEllipse(cloudX - 40, cloudY, 100, 40);
      this.skyBackground.fillEllipse(cloudX + 40, cloudY, 100, 40);
    }
  }
  
  showWeaponShopMenu(playerRole) {
    if (this.weaponShopMenu) return; // Already showing
    
    // Create weapon shop menu
    this.weaponShopMenu = document.createElement('div');
    this.weaponShopMenu.style.position = 'fixed';
    this.weaponShopMenu.style.top = '50%';
    this.weaponShopMenu.style.left = '50%';
    this.weaponShopMenu.style.transform = 'translate(-50%, -50%)';
    this.weaponShopMenu.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.95) 0%, rgba(44,44,88,0.95) 100%)';
    this.weaponShopMenu.style.border = '3px solid #ffe066';
    this.weaponShopMenu.style.borderRadius = '20px';
    this.weaponShopMenu.style.padding = '30px';
    this.weaponShopMenu.style.boxShadow = '0 12px 48px rgba(0,0,0,0.8)';
    this.weaponShopMenu.style.zIndex = '2001';
    this.weaponShopMenu.style.minWidth = '500px';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = 'WEAPON SHOP';
    title.style.color = '#ffe066';
    title.style.fontSize = '32px';
    title.style.fontFamily = 'Arial Black, sans-serif';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    title.style.letterSpacing = '2px';
    this.weaponShopMenu.appendChild(title);
    
    // Instructions
    const instructions = document.createElement('p');
    instructions.textContent = 'Click on a weapon to add it to your inventory';
    instructions.style.color = '#ffffff';
    instructions.style.fontSize = '16px';
    instructions.style.textAlign = 'center';
    instructions.style.marginBottom = '20px';
    this.weaponShopMenu.appendChild(instructions);
    
    // Weapons grid
    const weaponsGrid = document.createElement('div');
    weaponsGrid.style.display = 'grid';
    weaponsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    weaponsGrid.style.gap = '20px';
    weaponsGrid.style.marginBottom = '20px';
    
    // Available weapons based on role
    const weapons = ['pistol', 'shotgun', 'rifle', 'sniper'];
    if (['admin', 'owner'].includes(playerRole)) {
      weapons.push('tomatogun');
    }
    
    weapons.forEach(weapon => {
      const weaponCard = document.createElement('div');
      weaponCard.style.background = 'rgba(0,0,0,0.5)';
      weaponCard.style.border = '2px solid #666';
      weaponCard.style.borderRadius = '10px';
      weaponCard.style.padding = '20px';
      weaponCard.style.textAlign = 'center';
      weaponCard.style.cursor = 'pointer';
      weaponCard.style.transition = 'all 0.2s';
      
      const weaponImg = document.createElement('img');
      weaponImg.src = `/assets/weapons/${weapon}.png`;
      weaponImg.style.width = '80px';
      weaponImg.style.height = '80px';
      weaponImg.style.objectFit = 'contain';
      weaponImg.style.marginBottom = '10px';
      weaponImg.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
      
      const weaponName = document.createElement('div');
      weaponName.textContent = weapon.toUpperCase();
      weaponName.style.color = '#ffffff';
      weaponName.style.fontSize = '16px';
      weaponName.style.fontWeight = 'bold';
      
      weaponCard.appendChild(weaponImg);
      weaponCard.appendChild(weaponName);
      
      weaponCard.onmouseover = () => {
        weaponCard.style.background = 'rgba(255,224,102,0.2)';
        weaponCard.style.border = '2px solid #ffe066';
        weaponCard.style.transform = 'scale(1.05)';
      };
      
      weaponCard.onmouseout = () => {
        weaponCard.style.background = 'rgba(0,0,0,0.5)';
        weaponCard.style.border = '2px solid #666';
        weaponCard.style.transform = 'scale(1)';
      };
      
      weaponCard.onclick = () => {
        if (this.multiplayer && this.multiplayer.socket) {
          this.multiplayer.socket.emit('requestWeaponFromShop', weapon);
        }
      };
      
      weaponsGrid.appendChild(weaponCard);
    });
    
    this.weaponShopMenu.appendChild(weaponsGrid);
    
    // Info text
    const info = document.createElement('p');
    info.textContent = 'Exit the shop building to close this menu';
    info.style.color = '#999';
    info.style.fontSize = '14px';
    info.style.textAlign = 'center';
    info.style.marginTop = '10px';
    this.weaponShopMenu.appendChild(info);
    
    document.body.appendChild(this.weaponShopMenu);
  }
  
  hideWeaponShopMenu() {
    if (this.weaponShopMenu) {
      this.weaponShopMenu.remove();
      this.weaponShopMenu = null;
    }
  }
  
  showServerDisconnectScreen(type, message) {
    console.log('[CLIENT] Showing server disconnect screen:', type, message);
    
    // Prevent multiple disconnect screens
    if (this.disconnectScreenShown) {
      console.log('[CLIENT] Disconnect screen already shown, skipping');
      return;
    }
    this.disconnectScreenShown = true;
    
    // Clean up ALL UI elements first
    this.cleanupAllUI();
    
    // Clear any existing high-depth overlays or text
    this.children.list.forEach(obj => {
      if (obj && obj.depth >= 100000) {
        obj.destroy();
      }
    });
    
    // Stop all game activity
    this.physics.pause();
    this.input.enabled = false;
    
    // Disconnect socket to prevent reconnection attempts and remove all listeners
    if (this.multiplayer && this.multiplayer.socket) {
      // Remove all event listeners to prevent duplicate events
      this.multiplayer.socket.off('serverRestart');
      this.multiplayer.socket.off('disconnect');
      this.multiplayer.socket.off('worldState');
      this.multiplayer.socket.off('playerDamaged');
      this.multiplayer.socket.off('bulletDestroyed');
      this.multiplayer.socket.off('bulletCreated');
      this.multiplayer.socket.removeAllListeners();
      
      if (this.multiplayer.socket.connected) {
        this.multiplayer.socket.disconnect();
      }
    }
    
    // Create full screen overlay using graphics for complete coverage
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(-2000, -2000, 5000, 5000); // Extra large to cover everything
    overlay.setScrollFactor(0);
    overlay.setDepth(200000);
    
    // Calculate center of screen (including UI area)
    const screenCenterX = this.game.config.width / 2;
    const screenCenterY = this.game.config.height / 2;
    
    // Determine title and color based on type
    let titleText = 'Server Connection Lost';
    let titleColor = '#ff4444';
    if (type === 'restart') {
      titleText = 'Server Restarting';
      titleColor = '#ffe066';
    } else if (type === 'shutdown') {
      titleText = 'Server Shutting Down';
      titleColor = '#ff4444';
    }
    
    // Main title
    const title = this.add.text(screenCenterX, screenCenterY - 100, titleText, {
      fontSize: '64px',
      fontFamily: 'Arial Black',
      color: titleColor,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#000000',
        blur: 10,
        stroke: true,
        fill: true
      }
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(200001);
    
    // Add pulse animation to title
    this.tweens.add({
      targets: title,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Message text
    const messageText = this.add.text(screenCenterX, screenCenterY - 10, message, {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(200001);
    
    // Instructions
    const instructions = this.add.text(screenCenterX, screenCenterY + 50, 
      'Please refresh your browser to reconnect', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#cccccc',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(200001);
    
    // Refresh button
    const buttonBg = this.add.rectangle(screenCenterX, screenCenterY + 120, 250, 70, 0x2a2a4a, 1)
      .setStrokeStyle(3, titleColor)
      .setScrollFactor(0)
      .setDepth(200001)
      .setInteractive({ useHandCursor: true });
    
    const buttonText = this.add.text(screenCenterX, screenCenterY + 120, 'REFRESH PAGE', {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: titleColor,
      fontStyle: 'bold'
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(200002);
    
    // Button animations
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x3a3a5a);
      buttonText.setScale(1.1);
      this.tweens.add({
        targets: buttonBg,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x2a2a4a);
      buttonText.setScale(1);
      this.tweens.add({
        targets: buttonBg,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    buttonBg.on('pointerdown', () => {
      window.location.reload();
    });
    
    // Add keyboard shortcuts
    const keyHandler = (event) => {
      if (event.key === 'F5' || event.key === 'r' || event.key === 'R' || event.key === ' ') {
        window.location.reload();
      }
    };
    this.input.keyboard.on('keydown', keyHandler);
    
    // Add info text
    const infoText = this.add.text(screenCenterX, screenCenterY + 200, 
      'Press F5, R, or SPACE to refresh', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#888888',
      align: 'center'
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(200001);
  }
  
  cleanupAllUI() {
    // Clean up GameUI
    if (this.gameUI) {
      this.gameUI.destroy();
      this.gameUI = null;
    }
    
    // Clean up InventoryUI
    if (this.inventoryUI) {
      this.inventoryUI.destroy();
      this.inventoryUI = null;
    }
    
    // Clean up any death overlays or UI elements
    const allGameObjects = this.children.list;
    allGameObjects.forEach(obj => {
      if (obj.depth >= 9999) { // High depth objects are usually UI overlays
        obj.destroy();
      }
    });
    
    // Hide/remove DOM elements
    if (this.buildHotbar) {
      this.buildHotbar.remove();
      this.buildHotbar = null;
    }
    
    if (this.inventoryHotbar) {
      this.inventoryHotbar.remove();
      this.inventoryHotbar = null;
    }
    
    if (this.gameLogElement) {
      this.gameLogElement.remove();
      this.gameLogElement = null;
    }
    
    if (this.commandInput) {
      this.commandInput.remove();
      this.commandInput = null;
    }
    
    if (this.weaponShopMenu) {
      this.weaponShopMenu.remove();
      this.weaponShopMenu = null;
    }
    
    // Hide UI panel
    const uiPanel = document.getElementById('ui-panel');
    if (uiPanel) {
      uiPanel.style.display = 'none';
    }
    
    // Remove any custom style elements
    const customStyles = document.querySelectorAll('style[id*="ui-"], style[id*="chat-"]');
    customStyles.forEach(style => style.remove());
  }
  
  
  showTutorial() {
    // Create tutorial overlay
    const tutorialOverlay = document.createElement('div');
    tutorialOverlay.id = 'tutorial-overlay';
    tutorialOverlay.style.position = 'fixed';
    tutorialOverlay.style.top = '0';
    tutorialOverlay.style.left = '0';
    tutorialOverlay.style.width = '100%';
    tutorialOverlay.style.height = '100%';
    tutorialOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tutorialOverlay.style.zIndex = '9999';
    tutorialOverlay.style.display = 'flex';
    tutorialOverlay.style.alignItems = 'center';
    tutorialOverlay.style.justifyContent = 'center';
    
    // Create tutorial content
    const tutorialContent = document.createElement('div');
    tutorialContent.style.backgroundColor = '#2a2a44';
    tutorialContent.style.border = '3px solid #ffe066';
    tutorialContent.style.borderRadius = '20px';
    tutorialContent.style.padding = '40px';
    tutorialContent.style.maxWidth = '600px';
    tutorialContent.style.maxHeight = '80vh';
    tutorialContent.style.overflowY = 'auto';
    tutorialContent.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
    
    // Tutorial HTML content
    tutorialContent.innerHTML = `
      <h1 style="color: #ffe066; text-align: center; margin-bottom: 30px; font-size: 36px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
        Welcome to Castle Wars!
      </h1>
      
      <div style="color: #ffffff; font-size: 18px; line-height: 1.8;">
        <h2 style="color: #ffe066; margin-top: 20px; margin-bottom: 15px;">🎮 Controls</h2>
        <ul style="list-style: none; padding-left: 0;">
          <li><strong style="color: #ffe066;">WASD/Arrow Keys</strong> - Move your character</li>
          <li><strong style="color: #ffe066;">Space/W/Up</strong> - Jump</li>
          <li><strong style="color: #ffe066;">Mouse</strong> - Aim your weapon</li>
          <li><strong style="color: #ffe066;">Left Click</strong> - Shoot</li>
          <li><strong style="color: #ffe066;">R</strong> - Reload weapon</li>
          <li><strong style="color: #ffe066;">1-5</strong> - Switch weapons/items</li>
          <li><strong style="color: #ffe066;">E</strong> - Open/close inventory</li>
          <li><strong style="color: #ffe066;">Shift</strong> - Toggle build mode</li>
          <li><strong style="color: #ffe066;">T</strong> - Open chat</li>
        </ul>
        
        <h2 style="color: #ffe066; margin-top: 25px; margin-bottom: 15px;">🏰 Building</h2>
        <p>Press <strong style="color: #ffe066;">Shift</strong> to enter build mode. In build mode:</p>
        <ul style="list-style: none; padding-left: 0;">
          <li>• Click to place blocks</li>
          <li>• Hold and drag to place multiple blocks</li>
          <li>• Press X to delete blocks</li>
          <li>• Use number keys to select different block types</li>
        </ul>
        
        <h2 style="color: #ffe066; margin-top: 25px; margin-bottom: 15px;">⚔️ Combat</h2>
        <p>Defeat enemies and other players to earn rewards!</p>
        <ul style="list-style: none; padding-left: 0;">
          <li>• Visit the weapon shop (bottom-left of map) for weapons</li>
          <li>• Collect items dropped by enemies</li>
          <li>• Watch your ammo - reload with <strong style="color: #ffe066;">R</strong></li>
          <li>• Headshots deal double damage!</li>
        </ul>
        
        <h2 style="color: #ffe066; margin-top: 25px; margin-bottom: 15px;">💡 Tips</h2>
        <ul style="list-style: none; padding-left: 0;">
          <li>• Build defenses to protect yourself</li>
          <li>• Explore the map to find items</li>
          <li>• Work together or compete with other players</li>
          <li>• Type <strong style="color: #ffe066;">/help</strong> in chat for commands</li>
        </ul>
      </div>
      
      <button id="tutorial-close" style="
        display: block;
        margin: 30px auto 0;
        padding: 15px 40px;
        background: linear-gradient(135deg, #ffe066 0%, #ffcc00 100%);
        border: none;
        border-radius: 10px;
        color: #2a2a44;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(255, 224, 102, 0.4);
        transition: all 0.3s;
      ">
        Start Playing!
      </button>
    `;
    
    tutorialOverlay.appendChild(tutorialContent);
    document.body.appendChild(tutorialOverlay);
    
    // Close button handler
    const closeButton = document.getElementById('tutorial-close');
    closeButton.onclick = () => {
      tutorialOverlay.remove();
      // Mark tutorial as completed on server
      if (this.multiplayer && this.multiplayer.socket) {
        this.multiplayer.socket.emit('tutorialCompleted');
      }
    };
    
    // Also close on overlay click
    tutorialOverlay.onclick = (e) => {
      if (e.target === tutorialOverlay) {
        tutorialOverlay.remove();
        // Mark tutorial as completed on server
        if (this.multiplayer && this.multiplayer.socket) {
          this.multiplayer.socket.emit('tutorialCompleted');
        }
      }
    };
    
    // Add hover effect to button
    closeButton.onmouseover = () => {
      closeButton.style.transform = 'scale(1.05)';
      closeButton.style.boxShadow = '0 6px 20px rgba(255, 224, 102, 0.6)';
    };
    closeButton.onmouseout = () => {
      closeButton.style.transform = 'scale(1)';
      closeButton.style.boxShadow = '0 4px 12px rgba(255, 224, 102, 0.4)';
    };
  }
} 