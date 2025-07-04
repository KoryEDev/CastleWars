export class MobileUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.elements = {};
        this.touchControls = {
            moveX: 0,
            moveY: 0,
            shoot: false,
            build: false,
            aimAngle: 0,
            lastAimAngle: 0,
            targetX: 0,
            targetY: 0
        };
        this.joystick = null;
        this.buttons = {};
        this.quickMenuOpen = false;
        this.quickMenuOverlay = null;
        this.buildMode = false;
        this.selectedBlock = 'wall';
        this.buildUI = null;
        this.combatUI = null;
        this.aimLine = null;
        
        this.create();
    }
    
    create() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'mobile-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            position: fixed;
            top: 0;
            left: 0;
        `;
        document.body.appendChild(this.container);
        
        // Create top HUD (health, ammo, weapon)
        this.createTopHUD();
        
        // Create virtual joystick
        this.createJoystick();
        
        // Create action buttons
        this.createActionButtons();
        
        // Create quick menu button
        this.createQuickMenu();
        
        // Apply mobile styles
        this.applyMobileStyles();
    }
    
    createTopHUD() {
        const hud = document.createElement('div');
        hud.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            height: 50px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
        `;
        
        // Health bar
        const healthContainer = document.createElement('div');
        healthContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            border-radius: 25px;
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const healthIcon = document.createElement('span');
        healthIcon.innerHTML = '❤️';
        healthIcon.style.fontSize = '20px';
        
        const healthBar = document.createElement('div');
        healthBar.style.cssText = `
            width: 80px;
            height: 10px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        `;
        
        const healthFill = document.createElement('div');
        healthFill.id = 'mobile-health-fill';
        healthFill.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: #ff6b6b;
            transition: width 0.3s;
        `;
        healthBar.appendChild(healthFill);
        
        const healthText = document.createElement('span');
        healthText.id = 'mobile-health-text';
        healthText.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: bold;
            min-width: 30px;
        `;
        healthText.textContent = '100';
        
        healthContainer.appendChild(healthIcon);
        healthContainer.appendChild(healthBar);
        healthContainer.appendChild(healthText);
        
        // Weapon/ammo display
        const weaponContainer = document.createElement('div');
        weaponContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            border-radius: 25px;
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const weaponName = document.createElement('span');
        weaponName.id = 'mobile-weapon-name';
        weaponName.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: bold;
        `;
        weaponName.textContent = 'FIST';
        
        const ammoText = document.createElement('span');
        ammoText.id = 'mobile-ammo-text';
        ammoText.style.cssText = `
            color: #ffd700;
            font-size: 14px;
        `;
        ammoText.textContent = '∞';
        
        weaponContainer.appendChild(weaponName);
        weaponContainer.appendChild(ammoText);
        
        hud.appendChild(healthContainer);
        hud.appendChild(weaponContainer);
        this.container.appendChild(hud);
        
        this.elements.healthFill = healthFill;
        this.elements.healthText = healthText;
        this.elements.weaponName = weaponName;
        this.elements.ammoText = ammoText;
    }
    
    createJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 30px;
            width: 140px;
            height: 140px;
            pointer-events: auto;
        `;
        
        const joystickBase = document.createElement('div');
        joystickBase.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        `;
        
        const joystickStick = document.createElement('div');
        joystickStick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: radial-gradient(circle, rgba(255,255,255,0.8), rgba(255,255,255,0.4));
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.5);
        `;
        
        joystickContainer.appendChild(joystickBase);
        joystickContainer.appendChild(joystickStick);
        this.container.appendChild(joystickContainer);
        
        // Store references
        this.joystick = {
            container: joystickContainer,
            base: joystickBase,
            stick: joystickStick,
            active: false,
            startX: 0,
            startY: 0
        };
        
        // Setup joystick controls
        this.setupJoystickControls();
    }
    
    createActionButtons() {
        // Create combat UI container
        this.combatUI = document.createElement('div');
        this.combatUI.id = 'mobile-combat-ui';
        this.combatUI.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            align-items: flex-end;
            pointer-events: none;
            z-index: 100;
        `;
        
        // Shoot button (larger and more prominent)
        const shootBtn = this.createButton({
            id: 'shoot',
            icon: '🔫',
            bottom: '80px',
            right: '80px',
            color: 'rgba(255, 100, 100, 0.8)',
            size: 90
        });
        
        // Build mode toggle
        const buildToggle = this.createButton({
            id: 'build-toggle',
            icon: '🏗️',
            bottom: '20px',
            right: '20px',
            color: 'rgba(100, 255, 100, 0.7)',
            size: 60
        });
        
        // Weapon switch button
        const weaponBtn = this.createButton({
            id: 'weapon',
            icon: '🔄',
            bottom: '20px',
            right: '90px',
            color: 'rgba(150, 150, 255, 0.7)',
            size: 50
        });
        
        // Don't append combatUI as a container, buttons are added directly
        
        // Create building UI (hidden by default)
        this.createBuildingUI();
        
        // Add aim visualization
        this.createAimVisualization();
        
        // Add touch area for aiming
        this.createAimArea();
    }
    
    createAimArea() {
        const aimArea = document.createElement('div');
        aimArea.id = 'mobile-aim-area';
        aimArea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: auto;
            z-index: 1;
        `;
        
        let aimTouchId = null;
        let playerCenterX = 0;
        let playerCenterY = 0;
        
        const handleTouchStart = (e) => {
            const touch = e.touches[0];
            
            if (this.buildMode) {
                // In build mode, handle tap to place
                this.handleBuildTap(touch.clientX, touch.clientY);
            } else if (aimTouchId === null) {
                // In combat mode, start aiming
                aimTouchId = touch.identifier;
                
                // Get player position on screen
                if (this.scene && this.scene.playerSprite) {
                    const camera = this.scene.cameras.main;
                    const worldView = camera.worldView;
                    playerCenterX = (this.scene.playerSprite.x - worldView.x) * camera.zoom;
                    playerCenterY = (this.scene.playerSprite.y - worldView.y) * camera.zoom;
                }
                
                this.updateAim(touch.clientX, touch.clientY, playerCenterX, playerCenterY);
            }
        };
        
        const handleTouchMove = (e) => {
            if (!this.buildMode) {
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    if (touch.identifier === aimTouchId) {
                        // Update player center in case camera moved
                        if (this.scene && this.scene.playerSprite) {
                            const camera = this.scene.cameras.main;
                            const worldView = camera.worldView;
                            playerCenterX = (this.scene.playerSprite.x - worldView.x) * camera.zoom;
                            playerCenterY = (this.scene.playerSprite.y - worldView.y) * camera.zoom;
                        }
                        
                        this.updateAim(touch.clientX, touch.clientY, playerCenterX, playerCenterY);
                        break;
                    }
                }
            }
        };
        
        const handleTouchEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === aimTouchId) {
                    aimTouchId = null;
                    // Keep last aim angle
                    this.touchControls.lastAimAngle = this.touchControls.aimAngle;
                    break;
                }
            }
        };
        
        aimArea.addEventListener('touchstart', handleTouchStart, { passive: false });
        aimArea.addEventListener('touchmove', handleTouchMove, { passive: false });
        aimArea.addEventListener('touchend', handleTouchEnd, { passive: false });
        aimArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        
        this.container.appendChild(aimArea);
    }
    
    updateAim(touchX, touchY, playerX, playerY) {
        const deltaX = touchX - playerX;
        const deltaY = touchY - playerY;
        this.touchControls.aimAngle = Math.atan2(deltaY, deltaX);
        this.touchControls.targetX = touchX;
        this.touchControls.targetY = touchY;
    }
    
    handleBuildTap(screenX, screenY) {
        if (!this.scene || !this.scene.playerSprite) return;
        
        // Convert screen coordinates to world coordinates
        const camera = this.scene.cameras.main;
        const worldPoint = camera.getWorldPoint(screenX, screenY);
        
        // Send build request to server
        if (this.scene.multiplayer && this.scene.multiplayer.socket) {
            this.scene.multiplayer.socket.emit('placeBuilding', {
                x: worldPoint.x,
                y: worldPoint.y,
                type: this.selectedBlock
            });
        }
    }
    
    createButton(config) {
        const size = config.size || 60;
        const button = document.createElement('div');
        button.id = `mobile-${config.id}-btn`;
        button.style.cssText = `
            position: absolute;
            bottom: ${config.bottom};
            right: ${config.right};
            width: ${size}px;
            height: ${size}px;
            background: ${config.color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.4}px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.1s;
            border: 2px solid rgba(255,255,255,0.3);
        `;
        button.innerHTML = config.icon;
        
        // Touch feedback
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            button.style.transform = 'scale(0.9)';
            this.handleButtonPress(config.id, true);
        }, { passive: false });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            button.style.transform = 'scale(1)';
            this.handleButtonPress(config.id, false);
        }, { passive: false });
        
        this.container.appendChild(button);
        this.buttons[config.id] = button;
        return button;
    }
    
    createQuickMenu() {
        const menuBtn = document.createElement('div');
        menuBtn.style.cssText = `
            position: absolute;
            top: 70px;
            right: 10px;
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
        menuBtn.innerHTML = '☰';
        
        menuBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleQuickMenu();
        }, { passive: false });
        
        this.container.appendChild(menuBtn);
    }
    
    setupJoystickControls() {
        const { container, stick } = this.joystick;
        let active = false;
        let startX = 0;
        let startY = 0;
        const maxDistance = 50; // Maximum joystick movement radius
        
        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            active = true;
            startX = 0; // Always start from center
            startY = 0;
            this.joystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            const currentX = touch.clientX - rect.left - 70; // Center of 140px container
            const currentY = touch.clientY - rect.top - 70;
            
            let deltaX = currentX - startX;
            let deltaY = currentY - startY;
            
            // Limit to max distance
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance > maxDistance) {
                const angle = Math.atan2(deltaY, deltaX);
                deltaX = Math.cos(angle) * maxDistance;
                deltaY = Math.sin(angle) * maxDistance;
            }
            
            // Move the stick
            stick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
            
            // Update movement values
            this.touchControls.moveX = deltaX / maxDistance;
            this.touchControls.moveY = deltaY / maxDistance;
        };
        
        const handleEnd = () => {
            active = false;
            this.joystick.active = false;
            stick.style.transform = 'translate(-50%, -50%)';
            this.touchControls.moveX = 0;
            this.touchControls.moveY = 0;
        };
        
        container.addEventListener('touchstart', handleStart);
        container.addEventListener('touchmove', handleMove);
        container.addEventListener('touchend', handleEnd);
        container.addEventListener('touchcancel', handleEnd);
    }
    
    handleButtonPress(buttonId, pressed) {
        console.log('Button pressed:', buttonId, pressed);
        switch (buttonId) {
            case 'shoot':
                this.touchControls.shoot = pressed;
                console.log('Shoot state:', this.touchControls.shoot);
                break;
            case 'build-toggle':
                if (pressed) {
                    this.toggleBuildMode();
                }
                break;
            case 'weapon':
                if (pressed && this.scene.multiplayer) {
                    // Cycle through weapons
                    this.scene.multiplayer.socket.emit('cycleWeapon');
                }
                break;
        }
    }
    
    toggleBuildMode() {
        this.buildMode = !this.buildMode;
        this.touchControls.build = this.buildMode;
        
        if (this.buildMode) {
            // Hide combat buttons, show building UI
            if (this.buttons['shoot']) this.buttons['shoot'].style.display = 'none';
            if (this.buttons['weapon']) this.buttons['weapon'].style.display = 'none';
            this.buildUI.style.display = 'flex';
            this.buttons['build-toggle'].style.background = 'rgba(100, 255, 100, 0.9)';
            this.buttons['build-toggle'].style.boxShadow = '0 0 20px rgba(100, 255, 100, 0.5)';
        } else {
            // Show combat buttons, hide building UI
            if (this.buttons['shoot']) this.buttons['shoot'].style.display = 'flex';
            if (this.buttons['weapon']) this.buttons['weapon'].style.display = 'flex';
            this.buildUI.style.display = 'none';
            this.buttons['build-toggle'].style.background = 'rgba(100, 255, 100, 0.7)';
            this.buttons['build-toggle'].style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        }
    }
    
    toggleQuickMenu() {
        if (this.quickMenuOpen) {
            this.closeQuickMenu();
        } else {
            this.openQuickMenu();
        }
    }
    
    openQuickMenu() {
        this.quickMenuOpen = true;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'mobile-quick-menu';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            padding: 20px;
            pointer-events: auto;
        `;
        
        // Create menu container
        const menuContainer = document.createElement('div');
        menuContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 600px;
            margin: 0 auto;
            width: 100%;
        `;
        
        // Title
        const title = document.createElement('h2');
        title.textContent = 'Quick Menu';
        title.style.cssText = `
            color: #ffd700;
            text-align: center;
            font-size: 28px;
            margin: 0 0 20px 0;
        `;
        menuContainer.appendChild(title);
        
        // Menu buttons
        const menuButtons = [
            { text: 'Inventory', icon: '🎒', action: () => this.showMobileInventory() },
            { text: 'Chat', icon: '💬', action: () => this.showMobileChat() },
            { text: 'Stats', icon: '📊', action: () => this.showMobileStats() },
            { text: 'Settings', icon: '⚙️', action: () => console.log('Settings') },
            { text: 'Close', icon: '❌', action: () => this.closeQuickMenu() }
        ];
        
        menuButtons.forEach(btn => {
            const button = document.createElement('div');
            button.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 20px;
                color: white;
                border: 2px solid rgba(255, 255, 255, 0.2);
                transition: all 0.2s;
                pointer-events: auto;
            `;
            
            button.innerHTML = `<span style="font-size: 30px;">${btn.icon}</span><span>${btn.text}</span>`;
            
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.background = 'rgba(255, 255, 255, 0.2)';
                button.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.transform = 'scale(1)';
                btn.action();
            });
            
            menuContainer.appendChild(button);
        });
        
        overlay.appendChild(menuContainer);
        document.body.appendChild(overlay);
        this.quickMenuOverlay = overlay;
    }
    
    closeQuickMenu() {
        this.quickMenuOpen = false;
        if (this.quickMenuOverlay) {
            this.quickMenuOverlay.remove();
            this.quickMenuOverlay = null;
        }
    }
    
    showMobileInventory() {
        this.closeQuickMenu();
        console.log('Show mobile inventory');
        // TODO: Implement mobile inventory UI
    }
    
    showMobileChat() {
        this.closeQuickMenu();
        console.log('Show mobile chat');
        // TODO: Implement mobile chat UI
    }
    
    showMobileStats() {
        this.closeQuickMenu();
        console.log('Show mobile stats');
        // TODO: Implement mobile stats UI
    }
    
    applyMobileStyles() {
        // Inject mobile-specific CSS
        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide desktop UI elements on mobile */
            #game-ui-panel, #gameUI, .game-ui-panel, #inventory-panel, #chat-container, #help-button {
                display: none !important;
            }
            
            /* Ensure game canvas uses full screen */
            #game {
                width: 100vw !important;
                height: 100vh !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            #game canvas {
                width: 100% !important;
                height: 100% !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            /* Prevent scrolling and bouncing on mobile */
            body {
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
                -webkit-user-select: none;
                user-select: none;
                touch-action: none;
                margin: 0;
                padding: 0;
            }
            
            /* Mobile UI font */
            #mobile-ui {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            
            /* Ensure mobile UI is on top */
            #mobile-ui {
                z-index: 10000 !important;
            }
            
            /* Ensure all mobile UI elements can be interacted with */
            #mobile-ui * {
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
            }
            
            /* Debug - make buttons more visible */
            #mobile-ui > div[id*='mobile-'][id*='-btn'] {
                z-index: 10001 !important;
                opacity: 0.9 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    update() {
        // Update HUD elements
        if (this.scene.playerSprite) {
            const player = this.scene.playerSprite;
            
            // Update health
            const healthPercent = (player.health / player.maxHealth) * 100;
            this.elements.healthFill.style.width = healthPercent + '%';
            this.elements.healthText.textContent = Math.round(player.health);
            
            // Update weapon and ammo
            const weapon = player.currentWeapon || 'fist';
            this.elements.weaponName.textContent = weapon.toUpperCase();
            
            if (player.ammo !== undefined && player.ammo !== -1) {
                this.elements.ammoText.textContent = player.ammo;
            } else {
                this.elements.ammoText.textContent = '∞';
            }
            
            // Aim visualization removed
        }
    }
    
    getMovement() {
        return {
            x: this.touchControls.moveX || 0,
            y: this.touchControls.moveY || 0
        };
    }
    
    getAimAngle() {
        return this.touchControls.aimAngle || this.touchControls.lastAimAngle || 0;
    }
    
    createBuildingUI() {
        // Building UI container
        this.buildUI = document.createElement('div');
        this.buildUI.id = 'mobile-build-ui';
        this.buildUI.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: row;
            gap: 10px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 15px;
            border: 2px solid #ffd700;
            pointer-events: auto;
        `;
        
        // Building types from the game
        const buildingTypes = [
            { type: 'wall', icon: '🧱', color: '#8B4513' },
            { type: 'door', icon: '🚪', color: '#654321' },
            { type: 'castle_tower', icon: '🏰', color: '#696969' },
            { type: 'wood', icon: '🥢', color: '#8B4513' },
            { type: 'gold', icon: '✨', color: '#FFD700' },
            { type: 'brick', icon: '🧱', color: '#B22222' }
        ];
        
        buildingTypes.forEach(building => {
            const blockBtn = document.createElement('div');
            blockBtn.style.cssText = `
                width: 50px;
                height: 50px;
                background: ${building.color};
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                border: 2px solid transparent;
                transition: all 0.2s;
            `;
            blockBtn.innerHTML = building.icon;
            
            blockBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.selectBlock(building.type);
                // Visual feedback
                this.buildUI.querySelectorAll('div').forEach(btn => {
                    btn.style.border = '2px solid transparent';
                    btn.style.transform = 'scale(1)';
                });
                blockBtn.style.border = '2px solid #ffd700';
                blockBtn.style.transform = 'scale(1.1)';
            });
            
            this.buildUI.appendChild(blockBtn);
            
            // Select first block by default
            if (building.type === 'wall') {
                blockBtn.style.border = '2px solid #ffd700';
                blockBtn.style.transform = 'scale(1.1)';
            }
        });
        
        // Exit build mode button
        const exitBtn = document.createElement('div');
        exitBtn.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(255, 100, 100, 0.8);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-left: 20px;
        `;
        exitBtn.innerHTML = '❌';
        exitBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.toggleBuildMode();
        });
        this.buildUI.appendChild(exitBtn);
        
        this.container.appendChild(this.buildUI);
    }
    
    selectBlock(blockType) {
        this.selectedBlock = blockType;
        if (this.scene) {
            this.scene.selectedBuilding = blockType;
        }
    }
    
    createAimVisualization() {
        // Aim visualization removed for cleaner mobile interface
        this.aimLine = null;
    }
    
    isJumping() {
        // Jump when joystick is pushed up
        return this.touchControls.moveY < -0.5;
    }
    
    isShooting() {
        return this.touchControls.shoot || false;
    }
    
    isBuildMode() {
        return this.touchControls.build || false;
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}