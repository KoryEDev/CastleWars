export class MobileUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.elements = {};
        this.touchControls = {};
        this.joystick = null;
        this.buttons = {};
        this.quickMenuOpen = false;
        this.quickMenuOverlay = null;
        this.hapticEnabled = 'vibrate' in navigator;
        this.buildModeActive = false;
        this.buildInterface = null;
        this.selectedBlock = 'wall';
        this.deleteMode = false;
        
        this.create();
    }
    
    create() {
        // Check for landscape orientation first
        this.createOrientationOverlay();
        
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
        `;
        document.body.appendChild(this.container);
        
        // Create top HUD (health only, no weapon display)
        this.createTopHUD();
        
        // Create virtual joystick for movement
        this.createJoystick();
        
        // Create aim joystick on the right
        this.createAimJoystick();
        
        // Create action buttons
        this.createActionButtons();
        
        // Create quick menu button
        this.createQuickMenu();
        
        // Apply mobile styles
        this.applyMobileStyles();
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => this.checkOrientation());
        window.addEventListener('resize', () => this.checkOrientation());
        this.checkOrientation();
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
        
        hud.appendChild(healthContainer);
        this.container.appendChild(hud);
        
        this.elements.healthFill = healthFill;
        this.elements.healthText = healthText;
    }
    
    createJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.style.cssText = `
            position: absolute;
            bottom: 30px;
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
        // Shoot button - positioned near left joystick
        const shootBtn = this.createButton({
            id: 'shoot',
            icon: '🔫',
            bottom: '180px',
            left: '50px',
            color: 'rgba(255, 100, 100, 0.7)',
            size: 80
        });
        
        // Jump button
        const jumpBtn = this.createButton({
            id: 'jump',
            icon: '⬆️',
            bottom: '140px',
            left: '150px',
            color: 'rgba(100, 150, 255, 0.7)',
            size: 70
        });
        
        // Build button - positioned higher to avoid overlap
        const buildBtn = this.createButton({
            id: 'build',
            icon: '🏗️',
            bottom: '100px',
            left: '180px',
            color: 'rgba(100, 255, 100, 0.7)',
            size: 60
        });
    }
    
    createAimJoystick() {
        const aimContainer = document.createElement('div');
        aimContainer.style.cssText = `
            position: absolute;
            bottom: 30px;
            right: 30px;
            width: 140px;
            height: 140px;
            pointer-events: auto;
        `;
        
        const aimBase = document.createElement('div');
        aimBase.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,215,0,0.1), rgba(255,215,0,0.05));
            border: 2px solid rgba(255,215,0,0.3);
            border-radius: 50%;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        `;
        
        const aimStick = document.createElement('div');
        aimStick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: radial-gradient(circle, rgba(255,215,0,0.8), rgba(255,215,0,0.4));
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,215,0,0.5);
        `;
        
        aimContainer.appendChild(aimBase);
        aimContainer.appendChild(aimStick);
        this.container.appendChild(aimContainer);
        
        // Store references
        this.aimJoystick = {
            container: aimContainer,
            base: aimBase,
            stick: aimStick,
            active: false
        };
        
        // Setup aim joystick controls
        this.setupAimJoystickControls();
    }
    
    createButton(config) {
        const size = config.size || 60;
        const button = document.createElement('div');
        button.id = `mobile-${config.id}-btn`;
        button.style.cssText = `
            position: absolute;
            bottom: ${config.bottom};
            ${config.right ? `right: ${config.right};` : ''}
            ${config.left ? `left: ${config.left};` : ''}
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
        
        // Touch feedback with haptics
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.9)';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
            this.hapticFeedback(10);
            this.handleButtonPress(config.id, true);
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
            this.handleButtonPress(config.id, false);
        });
        
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
            this.hapticFeedback(20);
            menuBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                menuBtn.style.transform = 'scale(1)';
            }, 100);
            this.toggleQuickMenu();
        });
        
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
            startX = touch.clientX - rect.left - 60; // Center of joystick
            startY = touch.clientY - rect.top - 60;
            this.joystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            const currentX = touch.clientX - rect.left - 60;
            const currentY = touch.clientY - rect.top - 60;
            
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
    
    setupAimJoystickControls() {
        const { container, stick } = this.aimJoystick;
        let active = false;
        let touchId = null;
        const maxDistance = 50;
        
        const handleStart = (e) => {
            e.preventDefault();
            if (touchId !== null) return;
            
            const touch = e.touches[0];
            touchId = touch.identifier;
            active = true;
            this.aimJoystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active) return;
            e.preventDefault();
            
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.identifier === touchId) {
                    const rect = container.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const deltaX = touch.clientX - centerX;
                    const deltaY = touch.clientY - centerY;
                    
                    // Calculate angle from center (in radians)
                    const angle = Math.atan2(deltaY, deltaX);
                    // Convert to degrees for compatibility with game
                    const angleDegrees = angle * (180 / Math.PI);
                    
                    // Apply angle immediately for smooth visual updates
                    this.touchControls.aimAngle = angleDegrees;
                    if (this.scene && this.scene.playerSprite) {
                        this.scene.playerSprite.aimAngle = angleDegrees;
                    }
                    
                    // Calculate distance for joystick visual
                    const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
                    const normalizedX = (deltaX / Math.sqrt(deltaX * deltaX + deltaY * deltaY)) * distance;
                    const normalizedY = (deltaY / Math.sqrt(deltaX * deltaX + deltaY * deltaY)) * distance;
                    
                    // Move stick
                    stick.style.transform = `translate(calc(-50% + ${normalizedX}px), calc(-50% + ${normalizedY}px))`;
                    break;
                }
            }
        };
        
        const handleEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    active = false;
                    touchId = null;
                    this.aimJoystick.active = false;
                    stick.style.transform = 'translate(-50%, -50%)';
                    break;
                }
            }
        };
        
        container.addEventListener('touchstart', handleStart);
        container.addEventListener('touchmove', handleMove);
        container.addEventListener('touchend', handleEnd);
        container.addEventListener('touchcancel', handleEnd);
    }
    
    handleButtonPress(buttonId, pressed) {
        switch (buttonId) {
            case 'jump':
                this.touchControls.jump = pressed;
                if (this.scene && this.scene.cursors && this.scene.cursors.space) {
                    this.scene.cursors.space.isDown = pressed;
                }
                break;
            case 'shoot':
                this.touchControls.shoot = pressed;
                if (this.scene && this.scene.playerSprite) {
                    if (pressed) {
                        // Trigger shoot immediately when pressed
                        this.scene.playerSprite.shoot();
                        // Set mouse down state for automatic weapons
                        this.scene.playerSprite.isMouseDown = true;
                    } else {
                        // Clear mouse down state
                        this.scene.playerSprite.isMouseDown = false;
                    }
                }
                break;
            case 'build':
                if (pressed) {
                    this.buildModeActive = !this.buildModeActive;
                    this.touchControls.build = this.buildModeActive;
                    
                    if (this.buildModeActive) {
                        this.enterBuildMode();
                    } else {
                        this.exitBuildMode();
                    }
                    
                    if (this.scene && this.scene.toggleBuildMode) {
                        this.scene.toggleBuildMode();
                    }
                }
                break;
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
    
    createOrientationOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'orientation-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        `;
        
        const icon = document.createElement('div');
        icon.innerHTML = `📱`;
        icon.style.cssText = `
            font-size: 80px;
            animation: rotate 2s infinite linear;
            margin-bottom: 20px;
        `;
        
        const message = document.createElement('div');
        message.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            padding: 0 20px;
        `;
        message.textContent = 'Please rotate your device to landscape mode';
        
        const subMessage = document.createElement('div');
        subMessage.style.cssText = `
            font-size: 16px;
            color: #aaa;
            margin-top: 10px;
        `;
        subMessage.textContent = 'Castle Wars is best enjoyed in landscape orientation';
        
        overlay.appendChild(icon);
        overlay.appendChild(message);
        overlay.appendChild(subMessage);
        
        document.body.appendChild(overlay);
        this.orientationOverlay = overlay;
        
        // Add rotation animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(90deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        
        if (this.orientationOverlay) {
            if (isPortrait) {
                this.orientationOverlay.style.display = 'flex';
                if (this.container) {
                    this.container.style.display = 'none';
                }
            } else {
                this.orientationOverlay.style.display = 'none';
                if (this.container) {
                    this.container.style.display = 'block';
                }
            }
        }
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
        
        if (this.scene && this.scene.inventoryUI) {
            // Create mobile-friendly inventory overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 3000;
                display: flex;
                flex-direction: column;
                padding: 20px;
                padding-top: env(safe-area-inset-top, 20px);
            `;
            
            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            `;
            
            const title = document.createElement('h2');
            title.textContent = 'Inventory';
            title.style.cssText = `
                color: #ffd700;
                font-size: 24px;
                margin: 0;
            `;
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                background: #ff4444;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            closeBtn.onclick = () => overlay.remove();
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            overlay.appendChild(header);
            
            // Inventory grid
            const grid = document.createElement('div');
            grid.style.cssText = `
                flex: 1;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 10px;
                overflow-y: auto;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
            `;
            
            // Copy inventory items from game
            if (this.scene.inventoryUI && this.scene.inventoryUI.inventory) {
                this.scene.inventoryUI.inventory.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.style.cssText = `
                        aspect-ratio: 1;
                        background: rgba(255, 255, 255, 0.1);
                        border: 2px solid #666;
                        border-radius: 5px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 32px;
                        position: relative;
                    `;
                    
                    // Get item emoji
                    const itemEmoji = this.getItemEmoji(item);
                    itemDiv.textContent = itemEmoji;
                    
                    // Add count if multiple
                    if (item.count > 1) {
                        const count = document.createElement('span');
                        count.textContent = item.count;
                        count.style.cssText = `
                            position: absolute;
                            bottom: 2px;
                            right: 2px;
                            background: #000;
                            color: #ffd700;
                            font-size: 12px;
                            padding: 2px 4px;
                            border-radius: 3px;
                        `;
                        itemDiv.appendChild(count);
                    }
                    
                    grid.appendChild(itemDiv);
                });
            }
            
            overlay.appendChild(grid);
            document.body.appendChild(overlay);
        }
    }
    
    getItemEmoji(item) {
        const emojiMap = {
            'pistol': '🔫',
            'shotgun': '🔫',
            'minigun': '🔫',
            'sniper': '🔫',
            'crossbow': '🏹',
            'sword': '⚔️',
            'spear': '🥢',
            'wood': '🪵',
            'stone': '🪨',
            'metal': '🔩',
            'gold': '🪙',
            'health_potion': '🧪',
            'shield': '🛡️',
            'armor': '🦺'
        };
        
        return emojiMap[item.type] || '📦';
    }
    
    showMobileChat() {
        this.closeQuickMenu();
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60vh;
            background: rgba(0, 0, 0, 0.95);
            z-index: 3000;
            display: flex;
            flex-direction: column;
            border-top: 2px solid #4CAF50;
            animation: slideUp 0.3s ease-out;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const title = document.createElement('span');
        title.textContent = 'Chat';
        title.style.cssText = `
            color: white;
            font-size: 18px;
            font-weight: bold;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            padding: 5px;
        `;
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Messages area
        const messagesArea = document.createElement('div');
        messagesArea.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            color: white;
        `;
        
        // Copy chat history
        if (this.scene && this.scene.chatMessages) {
            this.scene.chatMessages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.style.cssText = `
                    margin-bottom: 8px;
                    word-wrap: break-word;
                `;
                msgDiv.innerHTML = msg;
                messagesArea.appendChild(msgDiv);
            });
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        
        // Input area
        const inputArea = document.createElement('div');
        inputArea.style.cssText = `
            display: flex;
            padding: 15px;
            gap: 10px;
            background: rgba(255, 255, 255, 0.05);
            padding-bottom: calc(15px + env(safe-area-inset-bottom, 0px));
        `;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type a message...';
        input.style.cssText = `
            flex: 1;
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 25px;
            font-size: 16px;
        `;
        
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '➤';
        sendBtn.style.cssText = `
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 20px;
            font-weight: bold;
        `;
        
        const sendMessage = () => {
            const text = input.value.trim();
            if (text && this.scene && this.scene.sendChatMessage) {
                this.scene.sendChatMessage(text);
                input.value = '';
            }
        };
        
        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
        
        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);
        
        overlay.appendChild(header);
        overlay.appendChild(messagesArea);
        overlay.appendChild(inputArea);
        
        document.body.appendChild(overlay);
        
        // Focus input after animation
        setTimeout(() => input.focus(), 300);
        
        // Add animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        `;
        if (!document.querySelector('style[data-mobile-animations]')) {
            style.setAttribute('data-mobile-animations', 'true');
            document.head.appendChild(style);
        }
    }
    
    showMobileStats() {
        this.closeQuickMenu();
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 3000;
            display: flex;
            flex-direction: column;
            padding: 20px;
            padding-top: env(safe-area-inset-top, 20px);
            overflow-y: auto;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        `;
        
        const title = document.createElement('h2');
        title.textContent = 'Player Stats';
        title.style.cssText = `
            color: #ffd700;
            font-size: 28px;
            margin: 0;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: #ff4444;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            color: white;
            font-size: 24px;
        `;
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Stats container
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        `;
        
        // Get player stats
        if (this.scene && this.scene.playerSprite) {
            const stats = [
                { label: 'Kills', value: this.scene.playerSprite.kills || 0, icon: '⚔️' },
                { label: 'Deaths', value: this.scene.playerSprite.deaths || 0, icon: '💀' },
                { label: 'K/D Ratio', value: this.calculateKD(), icon: '📊' },
                { label: 'Headshots', value: this.scene.playerSprite.headshots || 0, icon: '🎯' },
                { label: 'Buildings', value: this.scene.playerSprite.buildingsPlaced || 0, icon: '🏗️' },
                { label: 'Gold', value: this.scene.playerSprite.gold || 0, icon: '🪙' }
            ];
            
            stats.forEach(stat => {
                const statCard = document.createElement('div');
                statCard.style.cssText = `
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                `;
                
                const icon = document.createElement('div');
                icon.textContent = stat.icon;
                icon.style.cssText = `
                    font-size: 40px;
                    margin-bottom: 10px;
                `;
                
                const value = document.createElement('div');
                value.textContent = stat.value;
                value.style.cssText = `
                    color: #ffd700;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 5px;
                `;
                
                const label = document.createElement('div');
                label.textContent = stat.label;
                label.style.cssText = `
                    color: #aaa;
                    font-size: 14px;
                `;
                
                statCard.appendChild(icon);
                statCard.appendChild(value);
                statCard.appendChild(label);
                statsContainer.appendChild(statCard);
            });
        }
        
        overlay.appendChild(header);
        overlay.appendChild(statsContainer);
        document.body.appendChild(overlay);
    }
    
    calculateKD() {
        if (this.scene && this.scene.playerSprite) {
            const kills = this.scene.playerSprite.kills || 0;
            const deaths = this.scene.playerSprite.deaths || 0;
            if (deaths === 0) return kills.toFixed(2);
            return (kills / deaths).toFixed(2);
        }
        return '0.00';
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
            
            /* Smooth animations */
            #mobile-ui * {
                transition: transform 0.15s ease-out, opacity 0.15s ease-out, background-color 0.15s ease-out;
            }
            
            /* Button active states */
            #mobile-ui div[id*="-btn"]:active {
                filter: brightness(1.2);
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
        }
    }
    
    getMovement() {
        return {
            x: this.touchControls.moveX || 0,
            y: this.touchControls.moveY || 0
        };
    }
    
    getAimAngle() {
        // Return aim angle in degrees (game expects degrees)
        return this.touchControls.aimAngle || 0;
    }
    
    isJumping() {
        return this.touchControls.jump || false;
    }
    
    isShooting() {
        return this.touchControls.shoot || false;
    }
    
    isBuildMode() {
        return this.touchControls.build || false;
    }
    
    enterBuildMode() {
        this.hapticFeedback(20);
        
        // Hide combat-related UI
        if (this.buttons.shoot) {
            this.buttons.shoot.style.display = 'none';
        }
        if (this.aimJoystick && this.aimJoystick.container) {
            this.aimJoystick.container.style.display = 'none';
        }
        
        // Change build button to exit icon
        if (this.buttons.build) {
            this.buttons.build.innerHTML = '✖'; // ✖ icon (smaller X)
            this.buttons.build.style.background = 'rgba(255, 100, 100, 0.8)';
            this.buttons.build.style.transform = 'scale(1.1)';
        }
        
        // Create build interface
        this.createBuildInterface();
    }
    
    exitBuildMode() {
        this.hapticFeedback(20);
        
        // Show combat UI
        if (this.buttons.shoot) {
            this.buttons.shoot.style.display = 'flex';
        }
        if (this.aimJoystick && this.aimJoystick.container) {
            this.aimJoystick.container.style.display = 'block';
        }
        
        // Change build button back to build icon
        if (this.buttons.build) {
            this.buttons.build.innerHTML = '🏗️';
            this.buttons.build.style.background = 'rgba(100, 255, 100, 0.7)';
            this.buttons.build.style.transform = 'scale(1)';
        }
        
        // Remove build interface
        if (this.buildInterface) {
            this.buildInterface.remove();
            this.buildInterface = null;
        }
        
        // Remove touch handlers
        if (this.buildTouchHandler) {
            document.removeEventListener('touchstart', this.buildTouchHandler.start);
            document.removeEventListener('touchmove', this.buildTouchHandler.move);
            document.removeEventListener('touchend', this.buildTouchHandler.end);
            this.buildTouchHandler = null;
        }
        
        // Clean up delete mode
        this.deleteMode = false;
        this.hideDeleteModeIndicator();
        this.blockButtons = [];
        this.deleteBtnRef = null;
    }
    
    createBuildInterface() {
        // Create build interface container
        this.buildInterface = document.createElement('div');
        this.buildInterface.style.cssText = `
            position: absolute;
            bottom: 180px;
            bottom: calc(180px + env(safe-area-inset-bottom, 0px));
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            z-index: 100;
        `;
        
        // Create mode indicator
        this.modeIndicator = document.createElement('div');
        this.modeIndicator.style.cssText = `
            position: absolute;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 18px;
            font-weight: bold;
            display: none;
            z-index: 200;
            box-shadow: 0 4px 20px rgba(255, 0, 0, 0.5);
            border: 2px solid white;
        `;
        this.modeIndicator.textContent = 'DELETE MODE';
        this.container.appendChild(this.modeIndicator);
        
        // Create block selection bar
        const blockBar = document.createElement('div');
        blockBar.style.cssText = `
            background: rgba(0, 0, 0, 0.8);
            border-radius: 10px;
            padding: 15px 10px 25px 10px;
            display: flex;
            gap: 8px;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 215, 0, 0.3);
            justify-content: center;
            align-items: center;
            pointer-events: auto;
        `;
        
        // Building types - only show 3 main blocks
        const buildingTypes = [
            { type: 'wall', emoji: '🧱', name: 'Wall' },
            { type: 'door', emoji: '🚪', name: 'Door' },
            { type: 'castle_tower', emoji: '🏰', name: 'Tower' }
        ];
        
        this.blockButtons = []; // Store references
        
        // Create block buttons
        buildingTypes.forEach(building => {
            const blockBtn = document.createElement('div');
            blockBtn.style.cssText = `
                width: 45px;
                height: 45px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid ${this.selectedBlock === building.type ? '#ffd700' : 'rgba(255, 255, 255, 0.3)'};
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                transition: all 0.2s;
                cursor: pointer;
                position: relative;
            `;
            blockBtn.innerHTML = building.emoji;
            
            blockBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.hapticFeedback(10);
                blockBtn.style.transform = 'scale(0.9)';
                this.selectBlock(building.type);
                
                // Update UI
                this.updateBlockSelection();
                
                setTimeout(() => {
                    blockBtn.style.transform = 'scale(1)';
                }, 100);
            });
            
            // Add label
            const label = document.createElement('span');
            label.style.cssText = `
                position: absolute;
                bottom: -18px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.7);
                white-space: nowrap;
            `;
            label.textContent = building.name;
            blockBtn.appendChild(label);
            
            blockBtn.dataset.blockType = building.type;
            blockBtn.title = building.name;
            this.blockButtons.push(blockBtn);
            blockBar.appendChild(blockBtn);
        });
        
        // Create delete mode button
        const deleteBtn = document.createElement('div');
        deleteBtn.id = 'mobile-delete-btn';
        deleteBtn.style.cssText = `
            width: 45px;
            height: 45px;
            background: ${this.deleteMode ? 'rgba(255, 0, 0, 0.9)' : 'rgba(255, 50, 50, 0.7)'};
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            margin-left: 15px;
            pointer-events: auto;
            transition: all 0.2s;
            cursor: pointer;
        `;
        deleteBtn.innerHTML = '🗑️'; // Trash icon
        
        // Add delete label
        const deleteLabel = document.createElement('span');
        deleteLabel.style.cssText = `
            position: absolute;
            bottom: -18px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.7);
            white-space: nowrap;
        `;
        deleteLabel.textContent = 'Delete';
        deleteBtn.appendChild(deleteLabel);
        
        this.deleteBtnRef = deleteBtn; // Store reference
        
        let deletePressed = false;
        deleteBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (deletePressed) return; // Prevent double tap
            deletePressed = true;
            
            this.hapticFeedback(15);
            this.deleteMode = !this.deleteMode;
            deleteBtn.style.transform = 'scale(0.9)';
            
            if (this.deleteMode) {
                // Enter delete mode
                deleteBtn.style.background = 'rgba(255, 0, 0, 0.9)';
                deleteBtn.style.border = '3px solid #ff0000';
                deleteBtn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
                deleteBtn.innerHTML = '✓'; // Checkmark to show it's active
                
                this.showActionFeedback('DELETE MODE ACTIVE');
                this.showDeleteModeIndicator();
                
                // Disable all block buttons visually
                this.disableBlockButtons();
            } else {
                // Exit delete mode
                deleteBtn.style.background = 'rgba(255, 50, 50, 0.7)';
                deleteBtn.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                deleteBtn.style.boxShadow = 'none';
                deleteBtn.innerHTML = '🗑️';
                
                this.showActionFeedback('Build Mode');
                this.hideDeleteModeIndicator();
                
                // Re-enable block buttons
                this.enableBlockButtons();
                this.updateBlockSelection();
            }
            
            setTimeout(() => { deletePressed = false; }, 300);
        });
        
        deleteBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            deleteBtn.style.transform = 'scale(1)';
        });
        
        blockBar.appendChild(deleteBtn);
        this.buildInterface.appendChild(blockBar);
        this.container.appendChild(this.buildInterface);
        
        // Add touch handler for building/deleting
        this.setupBuildTouchHandler();
    }
    
    selectBlock(type) {
        // Can't select blocks while in delete mode
        if (this.deleteMode) {
            this.showActionFeedback('Exit delete mode first!');
            return;
        }
        
        this.selectedBlock = type;
        
        if (this.scene) {
            this.scene.selectedBuilding = type;
        }
        
        // Find block name for feedback
        const blockName = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
        this.showActionFeedback(`Selected: ${blockName}`);
    }
    
    showDeleteModeIndicator() {
        if (this.modeIndicator) {
            this.modeIndicator.style.display = 'block';
            this.modeIndicator.style.animation = 'pulse 1s infinite';
        }
        
        // Add red overlay border to screen
        if (!this.deleteModeBorder) {
            this.deleteModeBorder = document.createElement('div');
            this.deleteModeBorder.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border: 5px solid rgba(255, 0, 0, 0.5);
                pointer-events: none;
                z-index: 99;
                animation: pulseBorder 1s infinite;
            `;
            this.container.appendChild(this.deleteModeBorder);
        }
        
        // Add CSS animations if not already present
        if (!document.querySelector('style[data-delete-mode-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-delete-mode-styles', 'true');
            style.innerHTML = `
                @keyframes pulse {
                    0%, 100% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                }
                @keyframes pulseBorder {
                    0%, 100% { border-color: rgba(255, 0, 0, 0.3); }
                    50% { border-color: rgba(255, 0, 0, 0.7); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    hideDeleteModeIndicator() {
        if (this.modeIndicator) {
            this.modeIndicator.style.display = 'none';
        }
        if (this.deleteModeBorder) {
            this.deleteModeBorder.remove();
            this.deleteModeBorder = null;
        }
    }
    
    disableBlockButtons() {
        if (this.blockButtons) {
            this.blockButtons.forEach(btn => {
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
            });
        }
    }
    
    enableBlockButtons() {
        if (this.blockButtons) {
            this.blockButtons.forEach(btn => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
        }
    }
    
    updateBlockSelection() {
        if (!this.buildInterface || this.deleteMode) return;
        
        const blockButtons = this.buildInterface.querySelectorAll('[data-block-type]');
        blockButtons.forEach(btn => {
            if (btn.dataset.blockType === this.selectedBlock) {
                btn.style.border = '2px solid #ffd700';
                btn.style.background = 'rgba(255, 215, 0, 0.2)';
                btn.style.transform = 'scale(1.1)';
            } else {
                btn.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.transform = 'scale(1)';
            }
        });
    }
    
    setupBuildTouchHandler() {
        // Remove any existing handler
        if (this.buildTouchHandler) {
            document.removeEventListener('touchstart', this.buildTouchHandler.start);
            document.removeEventListener('touchmove', this.buildTouchHandler.move);
            document.removeEventListener('touchend', this.buildTouchHandler.end);
        }
        
        let activeTouchId = null;
        let lastPlacedTile = null;
        
        const handleBuildTouch = (touch) => {
            if (!this.scene || !this.scene.playerSprite || this.scene.playerSprite.isDead) return;
            
            // Check if touch is on UI elements
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.closest('#mobile-ui')) {
                return; // Don't build if touching UI
            }
            
            const canvas = document.querySelector('canvas');
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / rect.width * canvas.width;
            const y = (touch.clientY - rect.top) / rect.height * canvas.height;
            
            const camera = this.scene.cameras.main;
            const worldPoint = camera.getWorldPoint(x, y);
            
            // Calculate tile position - match desktop calculation
            const tileX = Math.floor(worldPoint.x / 64) * 64;
            let tileY = Math.floor((worldPoint.y - (this.scene.groundY - 64)) / 64) * 64 + (this.scene.groundY - 64);
            if (tileY > this.scene.groundY - 64) tileY = this.scene.groundY - 64;
            if (tileY < 0) tileY = 0;
            
            // Don't allow same tile repeatedly
            if (lastPlacedTile && lastPlacedTile.x === tileX && lastPlacedTile.y === tileY) {
                return;
            }
            
            // Check distance from player
            const dx = tileX + 32 - this.scene.playerSprite.x;
            const dy = tileY + 32 - this.scene.playerSprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 384) {
                this.showActionFeedback('Too far!');
                return;
            }
            
            lastPlacedTile = { x: tileX, y: tileY };
            
            // Send build/delete command - only one mode at a time
            if (this.scene.multiplayer && this.scene.multiplayer.socket) {
                if (this.deleteMode) {
                    // Only delete when in delete mode
                    this.scene.multiplayer.socket.emit('deleteBlock', { x: tileX, y: tileY });
                    this.hapticFeedback(8);
                    this.showActionFeedback('Deleted!');
                } else if (!this.deleteMode && this.selectedBlock) {
                    // Only build when NOT in delete mode and have a block selected
                    this.scene.multiplayer.socket.emit('placeBuilding', {
                        type: this.selectedBlock,
                        x: tileX,
                        y: tileY,
                        owner: this.scene.playerId
                    });
                    this.hapticFeedback(10);
                }
            }
        };
        
        this.buildTouchHandler = {
            start: (e) => {
                if (!this.buildModeActive) return;
                
                // Prevent default to stop any double-tap zoom
                e.preventDefault();
                
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    if (activeTouchId === null) {
                        activeTouchId = touch.identifier;
                        lastPlacedTile = null; // Reset on new touch
                        handleBuildTouch(touch);
                        break;
                    }
                }
            },
            move: (e) => {
                if (!this.buildModeActive || activeTouchId === null) return;
                
                e.preventDefault();
                
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    if (touch.identifier === activeTouchId) {
                        handleBuildTouch(touch);
                        break;
                    }
                }
            },
            end: (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        activeTouchId = null;
                        lastPlacedTile = null;
                        break;
                    }
                }
            }
        };
        
        // Add listeners to document for global touch handling
        document.addEventListener('touchstart', this.buildTouchHandler.start, { passive: false });
        document.addEventListener('touchmove', this.buildTouchHandler.move, { passive: false });
        document.addEventListener('touchend', this.buildTouchHandler.end, { passive: false });
    }
    
    hapticFeedback(duration = 10) {
        if (this.hapticEnabled) {
            navigator.vibrate(duration);
        }
    }
    
    showActionFeedback(action) {
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #ffd700;
            padding: 15px 30px;
            border-radius: 30px;
            font-size: 18px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
            animation: fadeInOut 1s ease-out;
        `;
        feedback.textContent = action;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 1000);
        
        // Add animation if not already present
        if (!document.querySelector('style[data-action-feedback]')) {
            const style = document.createElement('style');
            style.setAttribute('data-action-feedback', 'true');
            style.innerHTML = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    destroy() {
        // Clean up touch handlers
        if (this.buildTouchHandler) {
            document.removeEventListener('touchstart', this.buildTouchHandler.start);
            document.removeEventListener('touchmove', this.buildTouchHandler.move);
            document.removeEventListener('touchend', this.buildTouchHandler.end);
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        if (this.orientationOverlay && this.orientationOverlay.parentNode) {
            this.orientationOverlay.parentNode.removeChild(this.orientationOverlay);
        }
    }
}