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
        
        // Health bar container with modern design
        const healthContainer = document.createElement('div');
        healthContainer.style.cssText = `
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 25px;
            padding: 8px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        const healthIcon = document.createElement('span');
        healthIcon.innerHTML = '❤️';
        healthIcon.style.fontSize = '24px';
        
        const healthBar = document.createElement('div');
        healthBar.style.cssText = `
            width: 100px;
            height: 12px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
        `;
        
        const healthFill = document.createElement('div');
        healthFill.id = 'mobile-health-fill';
        healthFill.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #ff4444, #ff6b6b);
            transition: width 0.3s ease-out;
            box-shadow: 0 0 10px rgba(255, 100, 100, 0.5);
        `;
        healthBar.appendChild(healthFill);
        
        const healthText = document.createElement('span');
        healthText.id = 'mobile-health-text';
        healthText.style.cssText = `
            color: white;
            font-size: 16px;
            font-weight: bold;
            min-width: 35px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
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
            background: radial-gradient(circle at 30% 30%, rgba(100, 150, 255, 0.2), transparent 50%),
                        radial-gradient(circle at 70% 70%, rgba(100, 150, 255, 0.1), transparent 50%),
                        radial-gradient(circle, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.3));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid rgba(100, 150, 255, 0.4);
            border-radius: 50%;
            box-shadow: 0 0 30px rgba(100, 150, 255, 0.3),
                        inset 0 0 20px rgba(0, 0, 0, 0.5);
        `;
        
        const joystickStick = document.createElement('div');
        joystickStick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(200, 220, 255, 0.8));
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4),
                        0 0 20px rgba(100, 150, 255, 0.4),
                        inset 0 -2px 5px rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: box-shadow 0.2s;
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
        
        // Build button - positioned closer now that jump is removed
        const buildBtn = this.createButton({
            id: 'build',
            icon: '🏗️',
            bottom: '100px',
            left: '150px',
            color: 'rgba(100, 255, 100, 0.7)',
            size: 60
        });
        
        // Weapon switch button
        const weaponBtn = this.createButton({
            id: 'weapon',
            icon: '⚔️',
            bottom: '100px',
            left: '220px',
            color: 'rgba(255, 215, 0, 0.7)',
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
            background: radial-gradient(circle at 30% 30%, rgba(255, 215, 0, 0.2), transparent 50%),
                        radial-gradient(circle at 70% 70%, rgba(255, 215, 0, 0.1), transparent 50%),
                        radial-gradient(circle, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.3));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 215, 0, 0.4);
            border-radius: 50%;
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.3),
                        inset 0 0 20px rgba(0, 0, 0, 0.5);
        `;
        
        const aimStick = document.createElement('div');
        aimStick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 230, 150, 0.8));
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4),
                        0 0 20px rgba(255, 215, 0, 0.4),
                        inset 0 -2px 5px rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: box-shadow 0.2s;
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
            background: linear-gradient(135deg, ${config.color}, ${config.color.replace('0.7', '0.5')});
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.45}px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4),
                        inset 0 -2px 5px rgba(0, 0, 0, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.15s ease-out;
            border: 2px solid rgba(255, 255, 255, 0.2);
        `;
        button.innerHTML = config.icon;
        
        // Touch feedback with haptics
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.85) translateY(2px)';
            button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5), inset 0 -1px 3px rgba(0, 0, 0, 0.3)';
            this.hapticFeedback(10);
            this.handleButtonPress(config.id, true);
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(1) translateY(0)';
            button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.3)';
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
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4),
                        inset 0 -2px 5px rgba(0, 0, 0, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.15s ease-out;
        `;
        menuBtn.innerHTML = '☰';
        
        menuBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.hapticFeedback(20);
            menuBtn.style.transform = 'scale(0.9)';
            menuBtn.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
            setTimeout(() => {
                menuBtn.style.transform = 'scale(1)';
                menuBtn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.3)';
            }, 100);
            this.toggleQuickMenu();
        });
        
        this.container.appendChild(menuBtn);
    }
    
    setupJoystickControls() {
        const { container, stick } = this.joystick;
        let active = false;
        let touchId = null; // Track specific touch ID
        let startX = 0;
        let startY = 0;
        const maxDistance = 50; // Maximum joystick movement radius
        
        // Double-tap detection variables
        let lastTapTime = 0;
        const doubleTapDelay = 300; // milliseconds
        
        const handleStart = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            
            // Only handle if we don't already have an active touch
            if (touchId !== null) return;
            
            // Find the touch that's actually on this joystick
            const rect = container.getBoundingClientRect();
            let foundTouch = null;
            
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    foundTouch = touch;
                    break;
                }
            }
            
            if (!foundTouch) return;
            
            // Check for double-tap
            const currentTime = Date.now();
            if (currentTime - lastTapTime < doubleTapDelay) {
                // Double-tap detected - toggle build mode
                this.hapticFeedback(20);
                if (this.buildModeActive) {
                    this.exitBuildMode();
                } else {
                    this.enterBuildMode();
                }
                // Reset tap time to prevent triple tap
                lastTapTime = 0;
                return;
            }
            lastTapTime = currentTime;
            
            touchId = foundTouch.identifier; // Store touch ID
            active = true;
            startX = foundTouch.clientX - rect.left - 70; // Center of joystick
            startY = foundTouch.clientY - rect.top - 70;
            this.joystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active || touchId === null) return;
            e.preventDefault();
            e.stopPropagation();
            
            // Find our specific touch
            let ourTouch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === touchId) {
                    ourTouch = e.touches[i];
                    break;
                }
            }
            
            if (!ourTouch) return;
            
            const rect = container.getBoundingClientRect();
            const currentX = ourTouch.clientX - rect.left - 70;
            const currentY = ourTouch.clientY - rect.top - 70;
            
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
        
        const handleEnd = (e) => {
            // Check if our touch ended
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    active = false;
                    touchId = null;
                    this.joystick.active = false;
                    stick.style.transform = 'translate(-50%, -50%)';
                    this.touchControls.moveX = 0;
                    this.touchControls.moveY = 0;
                    break;
                }
            }
        };
        
        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', handleMove, { passive: false });
        container.addEventListener('touchend', handleEnd, { passive: false });
        container.addEventListener('touchcancel', handleEnd, { passive: false });
    }
    
    setupAimJoystickControls() {
        const { container, stick } = this.aimJoystick;
        let active = false;
        let touchId = null;
        const maxDistance = 50;
        
        const handleStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Only handle if we don't already have an active touch
            if (touchId !== null) return;
            
            // Find the touch that's actually on this joystick
            const rect = container.getBoundingClientRect();
            let foundTouch = null;
            
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    foundTouch = touch;
                    break;
                }
            }
            
            if (!foundTouch) return;
            
            touchId = foundTouch.identifier;
            active = true;
            this.aimJoystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active || touchId === null) return;
            e.preventDefault();
            e.stopPropagation();
            
            // Find our specific touch
            let ourTouch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === touchId) {
                    ourTouch = e.touches[i];
                    break;
                }
            }
            
            if (!ourTouch) return;
            
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const deltaX = ourTouch.clientX - centerX;
            const deltaY = ourTouch.clientY - centerY;
            
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
            const normalizedX = distance > 0 ? (deltaX / Math.sqrt(deltaX * deltaX + deltaY * deltaY)) * distance : 0;
            const normalizedY = distance > 0 ? (deltaY / Math.sqrt(deltaX * deltaX + deltaY * deltaY)) * distance : 0;
            
            // Move stick
            stick.style.transform = `translate(calc(-50% + ${normalizedX}px), calc(-50% + ${normalizedY}px))`;
        };
        
        const handleEnd = (e) => {
            // Check if our touch ended
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    active = false;
                    touchId = null;
                    this.aimJoystick.active = false;
                    stick.style.transform = 'translate(-50%, -50%)';
                    // Don't reset aim angle - keep last aimed direction
                    break;
                }
            }
        };
        
        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', handleMove, { passive: false });
        container.addEventListener('touchend', handleEnd, { passive: false });
        container.addEventListener('touchcancel', handleEnd, { passive: false });
    }
    
    handleButtonPress(buttonId, pressed) {
        switch (buttonId) {
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
                    // Toggle build mode state
                    const wasActive = this.buildModeActive;
                    
                    if (!wasActive) {
                        this.enterBuildMode();
                        // Notify the game scene
                        if (this.scene) {
                            this.scene.buildMode = true;
                            if (this.scene.toggleBuildMode) {
                                this.scene.toggleBuildMode();
                            }
                        }
                    } else {
                        this.exitBuildMode();
                        // Notify the game scene
                        if (this.scene) {
                            this.scene.buildMode = false;
                            if (this.scene.toggleBuildMode) {
                                this.scene.toggleBuildMode();
                            }
                        }
                    }
                }
                break;
            case 'weapon':
                if (pressed) {
                    this.toggleWeaponInterface();
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
        
        // Get player stats from stored data
        if (this.scene && this.scene.playerStats) {
            const playerStats = this.scene.playerStats;
            const stats = [
                { label: 'Kills', value: playerStats.kills || 0, icon: '⚔️' },
                { label: 'Deaths', value: playerStats.deaths || 0, icon: '💀' },
                { label: 'K/D Ratio', value: this.calculateKD(playerStats), icon: '📊' },
                { label: 'Headshots', value: playerStats.headshots || 0, icon: '🎯' },
                { label: 'Buildings', value: playerStats.blocksPlaced || 0, icon: '🏗️' },
                { label: 'Gold', value: playerStats.gold || 0, icon: '🪙' }
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
    
    calculateKD(stats) {
        if (stats) {
            const kills = stats.kills || 0;
            const deaths = stats.deaths || 0;
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
        if (this.buildModeActive) return;
        
        this.buildModeActive = true;
        this.hapticFeedback(20);
        this.showActionFeedback('Build Mode');
        
        // Hide all UI elements except movement controls
        this.hideUIForBuildMode();
        
        // Create build interface
        this.createBuildInterface();
        
        // Change build button appearance
        if (this.buttons.build) {
            this.buttons.build.style.background = 'rgba(255, 100, 100, 0.7)';
            this.buttons.build.innerHTML = '❌';
        }
    }
    
    exitBuildMode() {
        if (!this.buildModeActive) return;
        
        this.buildModeActive = false;
        this.deleteMode = false;
        this.hapticFeedback(20);
        this.showActionFeedback('Exit Build');
        
        // Show all UI elements again
        this.showUIAfterBuildMode();
        
        // Remove build interface
        if (this.buildInterface) {
            this.buildInterface.remove();
            this.buildInterface = null;
        }
        
        // Remove build indicator
        if (this.buildIndicator) {
            this.buildIndicator.remove();
            this.buildIndicator = null;
        }
        
        // Remove touch handlers
        if (this.buildTouchHandler) {
            document.removeEventListener('touchstart', this.buildTouchHandler.start);
            document.removeEventListener('touchmove', this.buildTouchHandler.move);
            document.removeEventListener('touchend', this.buildTouchHandler.end);
            this.buildTouchHandler = null;
        }
        
        // Hide delete mode indicator
        this.hideDeleteModeIndicator();
        
        // Restore build button
        if (this.buttons.build) {
            this.buttons.build.style.background = 'rgba(100, 255, 100, 0.7)';
            this.buttons.build.innerHTML = '🏗️';
        }
        
        // Clean up references
        this.blockButtons = [];
        this.deleteBtnRef = null;
    }
    
    hideUIForBuildMode() {
        // Hide top HUD
        const hud = this.container.querySelector('div[style*="top: 10px"]');
        if (hud) hud.style.display = 'none';
        
        // Hide all buttons except build button
        Object.keys(this.buttons).forEach(key => {
            if (key !== 'build' && this.buttons[key]) {
                this.buttons[key].style.display = 'none';
            }
        });
        
        // Hide quick menu button
        const menuBtn = this.container.querySelector('div[style*="top: 70px"]');
        if (menuBtn) menuBtn.style.display = 'none';
        
        // Hide aim joystick for simpler building
        if (this.aimJoystick && this.aimJoystick.container) {
            this.aimJoystick.container.style.display = 'none';
        }
    }
    
    showUIAfterBuildMode() {
        // Show top HUD
        const hud = this.container.querySelector('div[style*="top: 10px"]');
        if (hud) hud.style.display = 'flex';
        
        // Show all buttons
        Object.keys(this.buttons).forEach(key => {
            if (this.buttons[key]) {
                this.buttons[key].style.display = 'flex';
            }
        });
        
        // Show quick menu button
        const menuBtn = this.container.querySelector('div[style*="top: 70px"]');
        if (menuBtn) menuBtn.style.display = 'flex';
        
        // Show aim joystick
        if (this.aimJoystick && this.aimJoystick.container) {
            this.aimJoystick.container.style.display = 'block';
        }
    }
    
    createBuildInterface() {
        if (this.buildInterface) return;
        
        this.buildInterface = document.createElement('div');
        this.buildInterface.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 15px;
            border: 2px solid #ffd700;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
            pointer-events: auto;
            z-index: 1100;
        `;
        
        // Block types
        const blocks = [
            { type: 'wall', icon: '🧱' },
            { type: 'door', icon: '🚪' },
            { type: 'gold', icon: '💰' },
            { type: 'delete', icon: '🗑️', special: true }
        ];
        
        this.blockButtons = [];
        this.deleteBtnRef = null;
        
        blocks.forEach(block => {
            const btn = document.createElement('div');
            btn.style.cssText = `
                width: 60px;
                height: 60px;
                background: ${block.special ? 'rgba(255, 100, 100, 0.7)' : 'rgba(255, 255, 255, 0.1)'};
                border: 3px solid ${block.type === this.selectedBlock ? '#ffd700' : 'rgba(255, 255, 255, 0.3)'};
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 30px;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
                transition: all 0.2s;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            `;
            btn.innerHTML = block.icon;
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hapticFeedback(10);
                
                btn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                }, 100);
                
                if (block.type === 'delete') {
                    this.deleteMode = !this.deleteMode;
                    btn.style.background = this.deleteMode ? 
                        'rgba(255, 50, 50, 0.9)' : 'rgba(255, 100, 100, 0.7)';
                    btn.style.border = this.deleteMode ? 
                        '3px solid #ff0000' : '3px solid rgba(255, 255, 255, 0.3)';
                    
                    if (this.deleteMode) {
                        this.showDeleteModeIndicator();
                        this.disableBlockButtons();
                    } else {
                        this.hideDeleteModeIndicator();
                        this.enableBlockButtons();
                    }
                } else {
                    this.selectBlock(block.type);
                }
            });
            
            this.buildInterface.appendChild(btn);
            
            if (block.type === 'delete') {
                this.deleteBtnRef = btn;
            } else {
                this.blockButtons.push({ btn, type: block.type });
            }
        });
        
        this.container.appendChild(this.buildInterface);
        
        // Add build mode indicator at top
        const buildIndicator = document.createElement('div');
        buildIndicator.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 10px 20px;
            border-radius: 20px;
            color: #ffd700;
            font-size: 18px;
            font-weight: bold;
            border: 2px solid #ffd700;
            pointer-events: none;
        `;
        buildIndicator.innerHTML = '🏗️ BUILD MODE';
        this.container.appendChild(buildIndicator);
        this.buildIndicator = buildIndicator;
        
        // Setup touch handler for building
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
            this.modeIndicator.style.animation = 'fadeInOut 2s infinite';
        }
        
        // Add subtle red tint to build area only
        if (!this.deleteModeTint) {
            this.deleteModeTint = document.createElement('div');
            this.deleteModeTint.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle at center, transparent 40%, rgba(255, 0, 0, 0.1) 100%);
                pointer-events: none;
                z-index: 99;
            `;
            this.container.appendChild(this.deleteModeTint);
        }
        
        // Add CSS animations if not already present
        if (!document.querySelector('style[data-delete-mode-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-delete-mode-styles', 'true');
            style.innerHTML = `
                @keyframes fadeInOut {
                    0%, 100% { opacity: 0.8; }
                    50% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    hideDeleteModeIndicator() {
        if (this.modeIndicator) {
            this.modeIndicator.style.display = 'none';
        }
        if (this.deleteModeTint) {
            this.deleteModeTint.remove();
            this.deleteModeTint = null;
        }
    }
    
    disableBlockButtons() {
        if (this.blockButtons) {
            this.blockButtons.forEach(btn => {
                btn.btn.style.opacity = '0.3';
                btn.btn.style.pointerEvents = 'none';
            });
        }
    }
    
    enableBlockButtons() {
        if (this.blockButtons) {
            this.blockButtons.forEach(btn => {
                btn.btn.style.opacity = '1';
                btn.btn.style.pointerEvents = 'auto';
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
            
            // Check if touch is on UI elements - more comprehensive check
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target) {
                // Check for any mobile UI element
                if (target.closest('#mobile-ui') || 
                    target.closest('#joystick-area') ||
                    target.closest('#joystick-base') ||
                    target.closest('#action-buttons') ||
                    target.closest('[id*="mobile-"]') ||
                    target.closest('.build-interface') ||
                    target === this.container ||
                    target.parentElement === this.container) {
                    return; // Don't build if touching any UI element
                }
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
    
    toggleWeaponInterface() {
        if (this.weaponInterface) {
            this.weaponInterface.remove();
            this.weaponInterface = null;
            this.hapticFeedback(8);
        } else {
            this.createWeaponInterface();
            this.hapticFeedback(15);
        }
    }
    
    createWeaponInterface() {
        if (this.weaponInterface) return;
        
        this.weaponInterface = document.createElement('div');
        this.weaponInterface.style.cssText = `
            position: absolute;
            bottom: 200px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 15px;
            border: 2px solid #ffd700;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
            pointer-events: auto;
            z-index: 1100;
        `;
        
        // Get available weapons - show all 5 weapon slots
        const weapons = [
            { type: 'pistol', name: 'Pistol', sprite: 'Orange_pistol' },
            { type: 'shotgun', name: 'Shotgun', sprite: 'shotgun' },
            { type: 'rifle', name: 'Rifle', sprite: 'rifle' },
            { type: 'sniper', name: 'Sniper', sprite: 'sniper' },
            { type: 'tomatogun', name: 'Tomato Gun', sprite: 'tomatogun' }
        ];
        
        // Get current weapon from player
        const currentWeapon = this.scene?.playerSprite?.weapon?.type || 'pistol';
        
        weapons.forEach((weapon, index) => {
            const weaponBtn = document.createElement('div');
            weaponBtn.style.cssText = `
                width: 60px;
                height: 60px;
                background: ${weapon.type === currentWeapon ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                border: 3px solid ${weapon.type === currentWeapon ? '#ffd700' : 'rgba(255, 255, 255, 0.3)'};
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: all 0.2s;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            `;
            
            // Add weapon sprite
            const weaponImg = document.createElement('img');
            weaponImg.src = `/assets/weapons/${weapon.sprite}.png`;
            weaponImg.style.cssText = `
                width: 45px;
                height: 45px;
                object-fit: contain;
                image-rendering: pixelated;
                pointer-events: none;
            `;
            weaponImg.onerror = () => {
                // Fallback to text if image fails
                weaponBtn.innerHTML = `<span style="font-size: 12px; color: white;">${weapon.name}</span>`;
            };
            weaponBtn.appendChild(weaponImg);
            
            // Add number indicator
            const numberIndicator = document.createElement('div');
            numberIndicator.style.cssText = `
                position: absolute;
                top: -5px;
                left: -5px;
                width: 20px;
                height: 20px;
                background: #333;
                border: 2px solid #ffd700;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #ffd700;
                font-weight: bold;
            `;
            numberIndicator.textContent = (index + 1).toString();
            weaponBtn.appendChild(numberIndicator);
            
            weaponBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hapticFeedback(10);
                
                weaponBtn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    weaponBtn.style.transform = 'scale(1)';
                }, 100);
                
                this.selectWeapon(weapon.type);
                
                // Update visual selection
                this.weaponInterface.querySelectorAll('div').forEach((btn, i) => {
                    if (i < weapons.length) { // Only update weapon buttons, not the close button
                        btn.style.background = 'rgba(255, 255, 255, 0.1)';
                        btn.style.border = '3px solid rgba(255, 255, 255, 0.3)';
                    }
                });
                weaponBtn.style.background = 'rgba(255, 215, 0, 0.3)';
                weaponBtn.style.border = '3px solid #ffd700';
            });
            
            this.weaponInterface.appendChild(weaponBtn);
        });
        
        // Add close button
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            width: 40px;
            height: 40px;
            background: rgba(255, 50, 50, 0.7);
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            margin-left: 10px;
            transition: all 0.2s;
        `;
        closeBtn.innerHTML = '✕';
        
        closeBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hapticFeedback(10);
            closeBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                closeBtn.style.transform = 'scale(1)';
                this.toggleWeaponInterface();
            }, 100);
        });
        
        this.weaponInterface.appendChild(closeBtn);
        this.container.appendChild(this.weaponInterface);
    }
    
    selectWeapon(weaponType) {
        if (this.scene && this.scene.playerSprite) {
            // Change weapon on player
            this.scene.playerSprite.changeWeapon(weaponType);
            
            // Save weapon preference
            localStorage.setItem('selectedWeapon', weaponType);
            
            // Notify server of weapon change
            if (this.scene.multiplayer && this.scene.multiplayer.socket) {
                this.scene.multiplayer.socket.emit('changeWeapon', weaponType);
            }
            
            // Update UI feedback
            this.showActionFeedback(`Weapon: ${weaponType.toUpperCase()}`);
            
            // Close weapon interface after selection
            setTimeout(() => {
                this.toggleWeaponInterface();
            }, 300);
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