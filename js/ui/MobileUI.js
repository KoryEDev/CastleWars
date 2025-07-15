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
        this.buildToggleCooldown = false;
        
        // iOS detection
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
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
            z-index: 100;
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
        
        // Create build mode button
        this.createBuildModeButton();
        
        // Create full screen button
        this.createFullScreenButton();
        
        // Create quick menu button
        this.createQuickMenu();
        
        // Create achievement button for mobile
        this.createAchievementButton();
        
        // Apply mobile styles
        this.applyMobileStyles();
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => this.checkOrientation());
        window.addEventListener('resize', () => this.checkOrientation());
        this.checkOrientation();
        
        // Debug: Check button clickability after a short delay
        setTimeout(() => {
            this.debugCheckButtonClickability();
        }, 1000);
        
        // Global touch event handling for iOS compatibility
        this.setupGlobalTouchHandling();
    }
    
    setupGlobalTouchHandling() {
        // Prevent default touch behaviors that might interfere with our UI
        const preventDefaultTouch = (e) => {
            // Only prevent default on UI elements, not on canvas
            const target = e.target;
            
            // Allow all button interactions
            if (target && target.tagName === 'BUTTON') {
                return; // Don't prevent default for buttons
            }
            
            // Allow build interface interactions
            if (target && target.closest('[style*="z-index: 9999"]')) {
                return; // Don't prevent default for build interface
            }
            
            // Allow weapon interface interactions
            if (target && target.closest('[style*="z-index: 1200"]')) {
                return; // Don't prevent default for weapon interface
            }
            
            if (target && target.closest('#mobile-ui')) {
                e.preventDefault();
            }
        };
        
        // Prevent iOS zoom on double-tap
        let lastTouchEnd = 0;
        const preventZoom = (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        };
        
        // Add global event listeners
        document.addEventListener('touchstart', preventDefaultTouch, { passive: false, capture: true });
        document.addEventListener('touchend', preventZoom, { passive: false, capture: true });
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('#mobile-ui')) {
                e.preventDefault();
            }
        });
        
        // iOS-specific fixes
        if (this.isIOS) {
            // Prevent iOS Safari from showing the address bar
            window.addEventListener('scroll', () => {
                window.scrollTo(0, 1);
            });
            
            // Prevent iOS Safari from zooming on input focus
            document.addEventListener('focusin', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    e.target.style.fontSize = '16px';
                }
            });
        }
    }
    
    debugCheckButtonClickability() {
        console.log('=== Checking button clickability ===');
        console.log('iOS detected:', this.isIOS);
        
        // Check weapon button
        if (this.buttons.weapon) {
            const rect = this.buttons.weapon.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            
            console.log('Weapon button rect:', rect);
            console.log('Element at weapon button center:', elementAtPoint);
            console.log('Is weapon button visible:', this.buttons.weapon.offsetParent !== null);
            console.log('Weapon button z-index:', window.getComputedStyle(this.buttons.weapon).zIndex);
            console.log('Weapon button pointer-events:', window.getComputedStyle(this.buttons.weapon).pointerEvents);
            
            // Check if button has proper event listeners
            const events = getEventListeners ? getEventListeners(this.buttons.weapon) : 'getEventListeners not available';
            console.log('Weapon button event listeners:', events);
            
            // Temporarily highlight the button
            const originalBg = this.buttons.weapon.style.background;
            this.buttons.weapon.style.background = 'red';
            setTimeout(() => {
                this.buttons.weapon.style.background = originalBg;
            }, 1000);
            
            // Test weapon button functionality
            this.testWeaponButton();
        }
        
        // Check shoot button
        if (this.buttons.shoot) {
            const rect = this.buttons.shoot.getBoundingClientRect();
            console.log('Shoot button rect:', rect);
            console.log('Is shoot button visible:', this.buttons.shoot.offsetParent !== null);
            console.log('Shoot button z-index:', window.getComputedStyle(this.buttons.shoot).zIndex);
        }
        
        // Check if weapon interface exists
        console.log('Weapon interface exists:', !!this.weaponInterface);
        console.log('Weapon backdrop exists:', !!this.weaponBackdrop);
        
        if (this.weaponInterface) {
            console.log('Weapon interface in DOM:', document.body.contains(this.weaponInterface));
            console.log('Weapon interface z-index:', window.getComputedStyle(this.weaponInterface).zIndex);
        }
        
        // Test weapon interface creation
        setTimeout(() => {
            this.testWeaponInterfaceCreation();
        }, 2000);
    }
    
    // Test weapon button functionality
    testWeaponButton() {
        console.log('Testing weapon button functionality...');
        
        // Simulate a touch event on the weapon button
        if (this.buttons.weapon) {
            const touchEvent = new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                touches: [new Touch({
                    identifier: 0,
                    target: this.buttons.weapon,
                    clientX: 100,
                    clientY: 100,
                    pageX: 100,
                    pageY: 100,
                    radiusX: 2.5,
                    radiusY: 2.5,
                    rotationAngle: 10,
                    force: 0.5
                })]
            });
            
            console.log('Dispatching test touch event to weapon button...');
            this.buttons.weapon.dispatchEvent(touchEvent);
        }
    }
    
    // Test weapon interface creation
    testWeaponInterfaceCreation() {
        console.log('Testing weapon interface creation...');
        
        // Force create weapon interface
        this.forceOpenWeaponInterface();
        
        // Check if it was created successfully
        setTimeout(() => {
            if (this.weaponInterface && document.body.contains(this.weaponInterface)) {
                console.log('✅ Weapon interface created successfully!');
                
                // Test weapon selection
                if (this.weaponButtons && this.weaponButtons.length > 0) {
                    console.log('Testing weapon selection...');
                    const firstWeapon = this.weaponButtons[0];
                    if (firstWeapon && firstWeapon.btn) {
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        firstWeapon.btn.dispatchEvent(clickEvent);
                    }
                }
            } else {
                console.log('❌ Weapon interface creation failed!');
            }
        }, 500);
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
        
        // Weapon switch button - completely rewritten for iOS compatibility
        const weaponBtn = document.createElement('div');
        weaponBtn.id = 'mobile-weapon-btn';
        weaponBtn.style.cssText = `
            position: absolute;
            bottom: 180px;
            left: 140px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.7), rgba(255, 215, 0, 0.5));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 27px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4),
                        inset 0 -2px 5px rgba(0, 0, 0, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            transition: all 0.15s ease-out;
            border: 2px solid rgba(255, 255, 255, 0.2);
            cursor: pointer;
            z-index: 1000;
        `;
        weaponBtn.innerHTML = '⚔️';

        // Enhanced touch feedback animation
        const animateTouch = () => {
            weaponBtn.style.transform = 'scale(0.85) translateY(2px)';
            weaponBtn.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5), inset 0 -1px 3px rgba(0, 0, 0, 0.3)';
            this.hapticFeedback(10);
            
            setTimeout(() => {
                weaponBtn.style.transform = 'scale(1) translateY(0)';
                weaponBtn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.3)';
            }, 100);
        };

        // Unified touch handler for all platforms
        const handleWeaponTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('Weapon button touched - event type:', e.type);
            console.log('Touch target:', e.target);
            
            animateTouch();
            
            // Add small delay to ensure animation plays before opening interface
            setTimeout(() => {
                console.log('Opening weapon interface...');
                this.toggleWeaponInterface();
            }, 150);
        };

        // Comprehensive event handling for all platforms
        weaponBtn.addEventListener('touchstart', handleWeaponTouch, { passive: false, capture: true });
        weaponBtn.addEventListener('click', handleWeaponTouch, { passive: false, capture: true });
        weaponBtn.addEventListener('pointerdown', handleWeaponTouch, { passive: false, capture: true });
        
        // Additional iOS-specific handling
        if (this.isIOS) {
            weaponBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Weapon button touchend (iOS)');
            }, { passive: false, capture: true });
            
            // Prevent any default iOS behaviors
            weaponBtn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
        }
        
        this.container.appendChild(weaponBtn);
        this.buttons.weapon = weaponBtn;
        
        // Load saved weapon preference on startup
        this.loadWeaponPreference();
    }
    
    loadWeaponPreference() {
        const savedWeapon = localStorage.getItem('selectedWeapon');
        if (savedWeapon && this.scene && this.scene.playerSprite) {
            // Wait a bit for the player to be fully initialized
            setTimeout(() => {
                if (this.scene && this.scene.playerSprite) {
                    this.scene.playerSprite.equipWeapon(savedWeapon);
                    this.updateWeaponButtonIcon(savedWeapon);
                    console.log(`Loaded saved weapon preference: ${savedWeapon}`);
                }
            }, 500);
        }
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
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            transition: all 0.15s ease-out;
            border: 2px solid rgba(255, 255, 255, 0.2);
            z-index: 1000;
            cursor: pointer;
        `;
        button.innerHTML = config.icon;
        
        // Enhanced touch feedback with haptics
        const handleTouchStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            button.style.transform = 'scale(0.85) translateY(2px)';
            button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5), inset 0 -1px 3px rgba(0, 0, 0, 0.3)';
            this.hapticFeedback(10);
            this.handleButtonPress(config.id, true);
        };
        
        const handleTouchEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            button.style.transform = 'scale(1) translateY(0)';
            button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.3)';
            this.handleButtonPress(config.id, false);
        };
        
        // Comprehensive event handling
        button.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
        button.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
        button.addEventListener('click', handleTouchStart, { passive: false, capture: true });
        button.addEventListener('pointerdown', handleTouchStart, { passive: false, capture: true });
        
        // Additional iOS-specific handling
        if (this.isIOS) {
            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTouchEnd(e);
            }, { passive: false, capture: true });
        }
        
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
    
    createAchievementButton() {
        const achievementBtn = document.createElement('div');
        achievementBtn.style.cssText = `
            position: absolute;
            top: 130px;
            right: 10px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.8), rgba(255, 215, 0, 0.6));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4),
                        inset 0 -2px 5px rgba(255, 215, 0, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            border: 1px solid rgba(255, 215, 0, 0.3);
            transition: all 0.15s ease-out;
            z-index: 1000;
        `;
        achievementBtn.innerHTML = '🏆';
        
        const handleAchievementTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            this.hapticFeedback(20);
            achievementBtn.style.transform = 'scale(0.9)';
            achievementBtn.style.boxShadow = '0 2px 10px rgba(255, 215, 0, 0.5)';
            setTimeout(() => {
                achievementBtn.style.transform = 'scale(1)';
                achievementBtn.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4), inset 0 -2px 5px rgba(255, 215, 0, 0.3)';
            }, 100);
            this.showMobileAchievements();
        };
        
        // Comprehensive event handling
        achievementBtn.addEventListener('touchstart', handleAchievementTouch, { passive: false, capture: true });
        achievementBtn.addEventListener('click', handleAchievementTouch, { passive: false, capture: true });
        achievementBtn.addEventListener('pointerdown', handleAchievementTouch, { passive: false, capture: true });
        
        // Additional iOS-specific handling
        if (this.isIOS) {
            achievementBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
        }
        
        this.container.appendChild(achievementBtn);
    }
    
    createFullScreenButton() {
        // Check if running on iOS - if so, check if in standalone mode
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        
        // On iOS in Safari, show a different button that provides instructions
        const fullScreenBtn = document.createElement('div');
        fullScreenBtn.style.cssText = `
            position: absolute;
            top: 190px;
            right: 10px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, rgba(0, 150, 255, 0.8), rgba(0, 150, 255, 0.6));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 15px rgba(0, 150, 255, 0.4),
                        inset 0 -2px 5px rgba(0, 150, 255, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            border: 1px solid rgba(0, 150, 255, 0.3);
            transition: all 0.15s ease-out;
            z-index: 1000;
        `;
        
        // Always use fullscreen icon since we handle iOS with viewport maximization
        fullScreenBtn.innerHTML = '⛶'; // Fullscreen icon
        fullScreenBtn.title = 'Toggle Fullscreen';
        
        const handleFullScreenTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            this.hapticFeedback(20);
            fullScreenBtn.style.transform = 'scale(0.9)';
            fullScreenBtn.style.boxShadow = '0 2px 10px rgba(0, 150, 255, 0.5)';
            setTimeout(() => {
                fullScreenBtn.style.transform = 'scale(1)';
                fullScreenBtn.style.boxShadow = '0 4px 15px rgba(0, 150, 255, 0.4), inset 0 -2px 5px rgba(0, 150, 255, 0.3)';
            }, 100);
            this.toggleFullScreen();
        };
        
        // Comprehensive event handling
        fullScreenBtn.addEventListener('touchstart', handleFullScreenTouch, { passive: false, capture: true });
        fullScreenBtn.addEventListener('click', handleFullScreenTouch, { passive: false, capture: true });
        fullScreenBtn.addEventListener('pointerdown', handleFullScreenTouch, { passive: false, capture: true });
        
        // Additional iOS-specific handling
        if (this.isIOS) {
            fullScreenBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
        }
        
        this.container.appendChild(fullScreenBtn);
    }
    
    toggleFullScreen() {
        // Check if running on iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // For iOS, try to maximize viewport instead of true fullscreen
        if (isIOS) {
            this.maximizeViewportForIOS();
            return;
        }
        
        // Check fullscreen support
        const fullscreenEnabled = document.fullscreenEnabled || 
                                document.webkitFullscreenEnabled || 
                                document.mozFullScreenEnabled ||
                                document.msFullscreenEnabled;
                                
        if (!fullscreenEnabled) {
            console.warn('Fullscreen API not supported on this device');
            // Try alternative viewport maximization
            this.maximizeViewport();
            return;
        }
        
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            // Enter full screen
            const elem = document.documentElement;
            
            // Try different methods with error handling
            const requestFullscreen = elem.requestFullscreen || 
                                    elem.webkitRequestFullscreen || 
                                    elem.mozRequestFullScreen || 
                                    elem.msRequestFullscreen;
            
            if (requestFullscreen) {
                requestFullscreen.call(elem).catch(err => {
                    console.error('Error attempting to enable fullscreen:', err);
                    // Fallback to viewport maximization
                    this.maximizeViewport();
                });
            }
        } else {
            // Exit full screen
            const exitFullscreen = document.exitFullscreen || 
                                 document.webkitExitFullscreen || 
                                 document.mozCancelFullScreen || 
                                 document.msExitFullscreen ||
                                 document.webkitCancelFullScreen;
            
            if (exitFullscreen) {
                exitFullscreen.call(document).catch(err => {
                    console.error('Error attempting to exit fullscreen:', err);
                });
            }
        }
    }
    
    maximizeViewportForIOS() {
        // Hide Safari UI elements by scrolling
        window.scrollTo(0, 1);
        
        // Force landscape orientation if in portrait
        if (window.innerHeight > window.innerWidth) {
            // Show landscape prompt
            this.showLandscapePrompt();
        }
        
        // Adjust viewport meta tag for maximum screen usage
        let viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui';
        }
        
        // Try to hide the address bar
        setTimeout(() => {
            window.scrollTo(0, 1);
            document.body.style.height = window.innerHeight + 'px';
            document.documentElement.style.height = window.innerHeight + 'px';
        }, 100);
    }
    
    maximizeViewport() {
        // Generic viewport maximization for non-iOS devices
        document.body.style.height = '100vh';
        document.documentElement.style.height = '100vh';
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
    }
    
    showLandscapePrompt() {
        // Check if prompt already exists
        if (document.getElementById('landscape-prompt')) return;
        
        const prompt = document.createElement('div');
        prompt.id = 'landscape-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        `;
        
        prompt.innerHTML = `
            <div style="transform: rotate(90deg); font-size: 60px; margin-bottom: 30px;">📱</div>
            <h2 style="font-size: 24px; margin-bottom: 15px;">Rotate Your Device</h2>
            <p style="font-size: 16px; text-align: center; padding: 0 20px;">
                For the best gaming experience, please rotate your device to landscape mode.
            </p>
        `;
        
        document.body.appendChild(prompt);
        
        // Remove prompt when orientation changes
        const checkOrientation = () => {
            if (window.innerWidth > window.innerHeight) {
                prompt.remove();
                window.removeEventListener('resize', checkOrientation);
                window.removeEventListener('orientationchange', checkOrientation);
            }
        };
        
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
    }
    
    
    createBuildModeButton() {
        const buildBtn = document.createElement('div');
        buildBtn.style.cssText = `
            position: absolute;
            bottom: 100px;
            left: 150px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, rgba(100, 255, 100, 0.8), rgba(100, 255, 100, 0.6));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 6px 20px rgba(100, 255, 100, 0.4),
                        inset 0 -2px 5px rgba(100, 255, 100, 0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            border: 2px solid rgba(100, 255, 100, 0.3);
            transition: all 0.15s ease-out;
            z-index: 1000;
            cursor: pointer;
        `;
        buildBtn.innerHTML = '🏗️';
        
        const handleBuildTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Prevent rapid clicking
            if (this.buildToggleCooldown) return;
            
            this.hapticFeedback(20);
            buildBtn.style.transform = 'scale(0.9)';
            buildBtn.style.boxShadow = '0 2px 10px rgba(100, 255, 100, 0.5)';
            setTimeout(() => {
                buildBtn.style.transform = 'scale(1)';
                buildBtn.style.boxShadow = '0 6px 20px rgba(100, 255, 100, 0.4), inset 0 -2px 5px rgba(100, 255, 100, 0.3)';
            }, 100);
            this.toggleBuildMode();
        };
        
        // Single event listener to prevent multiple calls
        buildBtn.addEventListener('click', handleBuildTouch, { passive: false });
        
        this.container.appendChild(buildBtn);
        this.buttons.build = buildBtn;
    }
    
    toggleBuildMode() {
        // Prevent rapid toggling
        if (this.buildToggleCooldown) return;
        
        this.buildToggleCooldown = true;
        setTimeout(() => {
            this.buildToggleCooldown = false;
        }, 500); // 500ms cooldown
        
        if (this.buildModeActive) {
            this.exitBuildMode();
        } else {
            this.enterBuildMode();
        }
    }
    
    setupJoystickControls() {
        if (!this.joystick) return;
        const { container, stick } = this.joystick;
        let active = false;
        let touchId = null; // Track specific touch ID
        let startX = 0;
        let startY = 0;
        const maxDistance = 50; // Maximum joystick movement radius
        
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
            
            // Prevent aiming while in build mode
            if (this.buildModeActive) {
                this.showActionFeedback('Exit build mode to aim');
                return;
            }
            
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
                // Prevent shooting while in build mode
                if (this.buildModeActive) {
                    this.showActionFeedback('Exit build mode to shoot');
                    return;
                }
                
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
                    this.toggleBuildMode();
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
            { text: 'Achievements', icon: '🏆', action: () => this.showMobileAchievements() },
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
                touch-action: pan-y;
                -webkit-overflow-scrolling: touch;
            `;
            grid.className = 'mobile-menu-content';
            
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
            height: 100%;
            max-height: 60vh;
            background: rgba(0, 0, 0, 0.95);
            z-index: 3000;
            display: flex;
            flex-direction: column;
            border-top: 2px solid #4CAF50;
            animation: slideUp 0.3s ease-out;
            transition: max-height 0.3s ease-out;
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
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            overlay.style.animation = 'slideDown 0.3s ease-out forwards';
            setTimeout(() => overlay.remove(), 300);
        };
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Messages area
        const messagesArea = document.createElement('div');
        messagesArea.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            color: white;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
        `;
        messagesArea.className = 'mobile-menu-content';
        
        // Populate with existing messages from GameUI if available
        const gameChatMessages = document.getElementById('ui-chat-messages');
        if (gameChatMessages) {
            messagesArea.innerHTML = gameChatMessages.innerHTML;
            // Scroll to bottom
            setTimeout(() => messagesArea.scrollTop = messagesArea.scrollHeight, 0);
        }
        
        // Input area
        const inputArea = document.createElement('div');
        inputArea.style.cssText = `
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            display: flex;
            gap: 10px;
        `;
        
        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = 'Type a message...';
        inputField.style.cssText = `
            flex: 1;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 20px;
            padding: 10px 15px;
            color: white;
            font-size: 16px;
        `;
        
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '➤';
        sendBtn.style.cssText = `
            background: #4CAF50;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            color: white;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const sendMessage = () => {
            const message = inputField.value.trim();
            if (message) {
                // Assuming a global or scene-level method to send chat
                if (this.scene.multiplayer && this.scene.multiplayer.socket) {
                    this.scene.multiplayer.socket.emit('chatMessage', { message });
                }
                inputField.value = '';
                // Optional: add message to local UI immediately
                const msgEl = document.createElement('div');
                msgEl.innerHTML = `<span style="color: #ffd700;">You:</span> ${message}`;
                messagesArea.appendChild(msgEl);
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
            inputField.blur(); // Close virtual keyboard
        };
        
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        sendBtn.onclick = sendMessage;
        
        inputArea.appendChild(inputField);
        inputArea.appendChild(sendBtn);
        
        overlay.appendChild(header);
        overlay.appendChild(messagesArea);
        overlay.appendChild(inputArea);
        
        document.body.appendChild(overlay);
    
        // Add slideDown animation style if not present
        if (!document.getElementById('mobile-chat-animations')) {
            const style = document.createElement('style');
            style.id = 'mobile-chat-animations';
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes slideDown {
                    from { transform: translateY(0); }
                    to { transform: translateY(100%); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Focus input to bring up keyboard
        setTimeout(() => inputField.focus(), 300);
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
        title.textContent = 'Player Stats';
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
        
        // Stats grid
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            overflow-y: auto;
            padding: 20px;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
        `;
        statsContainer.className = 'mobile-menu-content';
        
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
        } else {
            const noStats = document.createElement('div');
            noStats.textContent = 'No stats available';
            noStats.style.cssText = `
                color: #aaa;
                text-align: center;
                font-size: 18px;
                grid-column: 1 / -1;
                padding: 40px;
            `;
            statsContainer.appendChild(noStats);
        }
        
        overlay.appendChild(statsContainer);
        document.body.appendChild(overlay);
    }
    
    showMobileAchievements() {
        this.closeQuickMenu();
        
        // Show the achievement menu if it exists
        if (this.scene && this.scene.achievementUI) {
            this.scene.achievementUI.showAchievementMenu();
        } else {
            // Fallback: show a simple message
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
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
            `;
            overlay.textContent = 'Achievements not available';
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: #ff4444;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                color: white;
            `;
            closeBtn.onclick = () => overlay.remove();
            
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
        }
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
                z-index: 1 !important;
            }
            
            #game canvas {
                width: 100% !important;
                height: 100% !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            /* Prevent scrolling and bouncing on mobile for main game area */
            body {
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
                -webkit-user-select: none;
                user-select: none;
                margin: 0;
                padding: 0;
            }
            
            /* Ensure mobile UI is always on top */
            #mobile-ui {
                z-index: 100 !important;
            }
            
            /* Ensure mobile UI buttons are clickable */
            #mobile-ui > div[style*="pointer-events: auto"] {
                z-index: 1000 !important;
            }
            
            /* Weapon interface should be above everything */
            div[style*="z-index: 1200"] {
                z-index: 1200 !important;
            }
            
            /* Backdrop should be below interface but above other UI */
            div[style*="z-index: 1099"] {
                z-index: 1099 !important;
            }
            
            /* Allow touch events on interactive elements */
            #mobile-ui div[style*="pointer-events: auto"],
            #mobile-ui div[style*="cursor: pointer"],
            #mobile-ui button,
            #mobile-ui [role="button"] {
                touch-action: manipulation !important;
                -webkit-tap-highlight-color: transparent !important;
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
            }
            
            /* Allow scrolling in menus and overlays */
            #mobile-quick-menu, [id*="mobile-"] {
                touch-action: pan-y !important;
                -webkit-overflow-scrolling: touch !important;
                overflow-y: auto !important;
            }
            
            /* Mobile UI font */
            #mobile-ui {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            
            /* Smooth animations */
            #mobile-ui * {
                transition: transform 0.15s ease-out, opacity 0.15s ease-out, background-color 0.15s ease-out;
            }
            
            /* Button active states */
            #mobile-ui div[id*="-btn"]:active {
                filter: brightness(1.2);
            }
            
            /* Mobile menu scrolling */
            .mobile-menu-content {
                touch-action: pan-y !important;
                -webkit-overflow-scrolling: touch !important;
                overflow-y: auto !important;
            }
            
            /* iOS-specific fixes */
            @supports (-webkit-touch-callout: none) {
                #mobile-ui div[style*="pointer-events: auto"] {
                    touch-action: manipulation !important;
                }
                
                /* Ensure buttons are clickable on iOS */
                #mobile-ui div[style*="cursor: pointer"],
                #mobile-ui div[style*="pointer-events: auto"] {
                    -webkit-tap-highlight-color: transparent !important;
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    touch-action: manipulation !important;
                }
                
                /* Prevent iOS zoom on double-tap */
                #mobile-ui * {
                    touch-action: manipulation !important;
                }
                
                /* Ensure proper touch handling for all interactive elements */
                #mobile-ui div[style*="pointer-events: auto"],
                #mobile-ui div[style*="cursor: pointer"] {
                    -webkit-tap-highlight-color: transparent !important;
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    touch-action: manipulation !important;
                    cursor: pointer !important;
                }
            }
            
            /* Additional iOS fixes for weapon interface */
            @supports (-webkit-touch-callout: none) {
                div[style*="z-index: 1200"] div[style*="pointer-events: auto"] {
                    touch-action: manipulation !important;
                    -webkit-tap-highlight-color: transparent !important;
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                }
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
        // Prevent shooting while in build mode
        if (this.buildModeActive) {
            return false;
        }
        return this.touchControls.shoot || false;
    }
    
    isBuildMode() {
        return this.touchControls.build || false;
    }
    
    enterBuildMode() {
        if (this.buildModeActive) return;
        
        // Close weapon interface if open
        if (this.weaponInterface) {
            this.weaponInterface.remove();
            this.weaponInterface = null;
        }
        
        this.buildModeActive = true;
        this.hapticFeedback(20);
        this.showActionFeedback('Build Mode');
        
        // Hide all UI elements except movement controls
        this.hideUIForBuildMode();
        
        // Create build interface
        this.createBuildInterface();
        
        // Setup touch handler for building
        this.setupBuildTouchHandler();
        
        // Simple build mode indicator
        this.showActionFeedback('Build Mode Active');
        
        // Change build button appearance
        if (this.buttons.build) {
            this.buttons.build.style.background = 'rgba(255, 100, 100, 0.7)';
            this.buttons.build.innerHTML = '❌';
        }
        
        // Properly toggle build mode in game scene
        if (this.scene && !this.scene.buildMode) {
            // Call the scene's toggleBuildMode to properly update everything
            this.scene.toggleBuildMode();
        }
        
        // Prevent shooting while in build mode
        if (this.scene && this.scene.playerSprite) {
            this.scene.playerSprite.isMouseDown = false;
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
        
        // Build indicator is handled by showActionFeedback
        
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
        
        // Properly toggle build mode in game scene
        if (this.scene && this.scene.buildMode) {
            // Call the scene's toggleBuildMode to properly update everything
            this.scene.toggleBuildMode();
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
        
        // Hide full screen button
        const fullScreenBtn = this.container.querySelector('div[style*="top: 190px"]');
        if (fullScreenBtn) fullScreenBtn.style.display = 'none';
        
        // Hide achievement button
        const achievementBtn = this.container.querySelector('div[style*="top: 130px"]');
        if (achievementBtn) achievementBtn.style.display = 'none';
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
        
        // Show full screen button
        const fullScreenBtn = this.container.querySelector('div[style*="top: 190px"]');
        if (fullScreenBtn) fullScreenBtn.style.display = 'flex';
        
        // Show achievement button
        const achievementBtn = this.container.querySelector('div[style*="top: 130px"]');
        if (achievementBtn) achievementBtn.style.display = 'flex';
    }
    
    createBuildInterface() {
        if (this.buildInterface) return;
        
        // Create a simple, reliable build interface
        this.buildInterface = document.createElement('div');
        this.buildInterface.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 10px;
            display: flex;
            gap: 5px;
            z-index: 9999;
            pointer-events: auto;
        `;
        
        // Simple block buttons with text
        const blocks = ['wall', 'brick', 'wood', 'door', 'tower'];
        this.blockButtons = [];
        
        blocks.forEach(blockType => {
            const btn = document.createElement('button');
            btn.textContent = blockType.toUpperCase();
            btn.style.cssText = `
                padding: 10px;
                background: #333;
                color: white;
                border: 1px solid #666;
                border-radius: 5px;
                font-size: 12px;
                min-width: 50px;
            `;
            
            btn.onclick = () => {
                this.selectedBlock = blockType;
                this.deleteMode = false;
                // Highlight selected button
                this.blockButtons.forEach(b => b.style.background = '#333');
                btn.style.background = '#00ff00';
            };
            
            this.blockButtons.push(btn);
            this.buildInterface.appendChild(btn);
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'DELETE';
        deleteBtn.style.cssText = `
            padding: 10px;
            background: #ff3333;
            color: white;
            border: 1px solid #ff6666;
            border-radius: 5px;
            font-size: 12px;
            min-width: 50px;
        `;
        
        deleteBtn.onclick = () => {
            this.deleteMode = !this.deleteMode;
            deleteBtn.style.background = this.deleteMode ? '#ff0000' : '#ff3333';
            this.selectedBlock = null;
        };
        
        this.buildInterface.appendChild(deleteBtn);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.cssText = `
            padding: 10px;
            background: #666;
            color: white;
            border: 1px solid #999;
            border-radius: 5px;
            font-size: 12px;
            min-width: 30px;
        `;
        
        closeBtn.onclick = () => {
            this.exitBuildMode();
        };
        
        this.buildInterface.appendChild(closeBtn);
        
        // Add to DOM
        document.body.appendChild(this.buildInterface);
        
        // Select wall by default
        this.selectedBlock = 'wall';
        this.blockButtons[0].style.background = '#00ff00';
    }
    
    selectBlock(type) {
        this.selectedBlock = type;
        this.deleteMode = false;
        this.hapticFeedback(10);
        
        // Update visual selection
        if (this.blockButtons && this.blockButtons.length > 0) {
            this.blockButtons.forEach(({ btn, type: blockType }) => {
                if (blockType === type) {
                    btn.style.background = 'rgba(255, 215, 0, 0.3)';
                    btn.style.border = '3px solid #ffd700';
                    btn.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
                } else {
                    btn.style.background = 'rgba(255, 255, 255, 0.1)';
                    btn.style.border = '3px solid rgba(255, 255, 255, 0.3)';
                    btn.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
                }
            });
        }
        
        // Reset delete button appearance
        if (this.deleteBtnRef) {
            this.deleteBtnRef.style.background = 'rgba(255, 100, 100, 0.7)';
            this.deleteBtnRef.style.border = '3px solid rgba(255, 255, 255, 0.3)';
        }
        
        // Set in game scene
        if (this.scene && this.scene.setSelectedBuilding) {
            this.scene.setSelectedBuilding(type);
        }
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
            
            // Prevent shooting while in build mode
            if (this.scene.playerSprite) {
                this.scene.playerSprite.isMouseDown = false;
            }
            
            // Check if touch is on UI elements - more comprehensive check
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target) {
                // Check for any mobile UI element - but exclude canvas
                if ((target.closest('#mobile-ui') || 
                    target.closest('#joystick-area') ||
                    target.closest('#joystick-base') ||
                    target.closest('#action-buttons') ||
                    target.closest('[id*="mobile-"]') ||
                    target.closest('.build-interface') ||
                    target === this.container ||
                    target.parentElement === this.container) &&
                    target.tagName !== 'CANVAS') {
                    return; // Don't build if touching any UI element (except canvas)
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
                    this.showActionFeedback('Placed!');
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
        console.log('toggleWeaponInterface called'); // Debug log
        
        if (this.weaponInterface) {
            console.log('Closing weapon interface'); // Debug log
            if (this.weaponBackdrop) {
                this.weaponBackdrop.remove();
                this.weaponBackdrop = null;
            }
            this.weaponInterface.remove();
            this.weaponInterface = null;
            // Don't call showUIAfterBuildMode() - we're not in build mode
        } else {
            console.log('Creating weapon interface'); // Debug log
            this.createWeaponInterface();
            
            // Safety check: ensure interface was created properly
            setTimeout(() => {
                if (!this.weaponInterface || !document.body.contains(this.weaponInterface)) {
                    console.log('Weapon interface creation failed, retrying...'); // Debug log
                    this.ensureWeaponInterfaceReady();
                    if (!this.weaponInterface) {
                        this.createWeaponInterface();
                    }
                }
            }, 100);
            
            // Don't call hideUIForBuildMode() - we want to keep UI visible
        }
    }
    
    // Fallback method to force open weapon interface
    forceOpenWeaponInterface() {
        console.log('Force opening weapon interface...'); // Debug log
        
        // Remove any existing interface first
        if (this.weaponInterface) {
            this.weaponInterface.remove();
            this.weaponInterface = null;
        }
        if (this.weaponBackdrop) {
            this.weaponBackdrop.remove();
            this.weaponBackdrop = null;
        }
        
        // Create fresh interface
        this.createWeaponInterface();
        
        // Double-check it's in the DOM
        setTimeout(() => {
            if (!document.body.contains(this.weaponInterface)) {
                console.log('Force adding weapon interface to DOM...'); // Debug log
                document.body.appendChild(this.weaponInterface);
            }
            if (this.weaponBackdrop && !document.body.contains(this.weaponBackdrop)) {
                document.body.appendChild(this.weaponBackdrop);
            }
        }, 50);
    }
    
    createWeaponInterface() {
        if (this.weaponInterface) {
            console.log('Weapon interface already exists, returning'); // Debug log
            return;
        }
        
        console.log('Creating weapon interface...'); // Debug log
        
        // Create backdrop like building interface
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 1099;
            pointer-events: auto;
        `;
        
        // Improved backdrop handler with proper touch detection
        let touchStartTime = 0;
        const handleBackdropTouch = (e) => {
            touchStartTime = Date.now();
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handleBackdropEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only close if it was a quick tap (not accidental)
            if (Date.now() - touchStartTime < 500) {
                // Check if the touch was on the backdrop, not on the interface
                const touch = e.changedTouches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                
                // Only close if we tapped the backdrop itself
                if (element === backdrop) {
                    console.log('Backdrop tapped, closing weapon interface'); // Debug log
                    this.toggleWeaponInterface();
                }
            }
        };
        
        backdrop.addEventListener('touchstart', handleBackdropTouch, { passive: false, capture: true });
        backdrop.addEventListener('touchend', handleBackdropEnd, { passive: false, capture: true });
        backdrop.addEventListener('click', handleBackdropEnd, { passive: false, capture: true });
        
        document.body.appendChild(backdrop);
        this.weaponBackdrop = backdrop;
        
        this.weaponInterface = document.createElement('div');
        this.weaponInterface.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.95);
            border-radius: 20px;
            border: 3px solid #ffd700;
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.5),
                        inset 0 0 20px rgba(255, 215, 0, 0.1);
            pointer-events: auto;
            z-index: 1200;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        `;
        
        // Get available weapons - show all 5 weapon slots
        const weapons = [
            { type: 'pistol', name: 'Pistol', sprite: 'Orange_pistol' },
            { type: 'shotgun', name: 'Shotgun', sprite: 'shotgun' },
            { type: 'rifle', name: 'Rifle', sprite: 'rifle' },
            { type: 'sniper', name: 'Sniper', sprite: 'sniper' },
            { type: 'tomatogun', name: 'Tomato Gun', sprite: 'tomatogun' }
        ];
        
        // Get current weapon from multiple sources for reliability
        let currentWeapon = 'pistol';
        if (this.scene && this.scene.playerSprite && this.scene.playerSprite.weapon) {
            currentWeapon = this.scene.playerSprite.weapon.type || 'pistol';
        } else {
            // Fallback to saved preference
            currentWeapon = localStorage.getItem('selectedWeapon') || 'pistol';
        }
        console.log(`Current weapon detected: ${currentWeapon}`); // Debug log
        
        // Store weapon buttons for selection updates
        this.weaponButtons = [];
        
        weapons.forEach((weapon, index) => {
            const weaponBtn = document.createElement('div');
            weaponBtn.style.cssText = `
                width: 70px;
                height: 70px;
                background: ${weapon.type === currentWeapon ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                border: 3px solid ${weapon.type === currentWeapon ? '#ffd700' : 'rgba(255, 255, 255, 0.3)'};
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: all 0.2s;
                box-shadow: ${weapon.type === currentWeapon ? '0 0 15px rgba(255, 215, 0, 0.6)' : '0 2px 10px rgba(0, 0, 0, 0.3)'};
                cursor: pointer;
                pointer-events: auto;
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                touch-action: manipulation;
                z-index: 1201;
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
                user-select: none;
                -webkit-user-drag: none;
            `;
            weaponImg.onerror = () => {
                // Fallback to text if image fails
                weaponBtn.innerHTML = `<span style="font-size: 12px; color: white; pointer-events: none;">${weapon.name}</span>`;
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
                pointer-events: none;
            `;
            numberIndicator.textContent = (index + 1).toString();
            weaponBtn.appendChild(numberIndicator);
            
            // Store reference to button and weapon type
            this.weaponButtons.push({ btn: weaponBtn, type: weapon.type });
            
            // Add touch feedback animation
            const animateWeaponTouch = () => {
                weaponBtn.style.transform = 'scale(0.9)';
                this.hapticFeedback(10);
                setTimeout(() => {
                    weaponBtn.style.transform = 'scale(1)';
                }, 100);
            };
            
            const handleWeaponSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                console.log(`Weapon button pressed: ${weapon.type}`); // Debug log
                
                animateWeaponTouch();
                
                // Update visual selection immediately
                this.weaponButtons.forEach(({ btn: button, type: weaponType }) => {
                    if (weaponType === weapon.type) {
                        button.style.background = 'rgba(255, 215, 0, 0.3)';
                        button.style.border = '3px solid #ffd700';
                        button.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.6)';
                    } else {
                        button.style.background = 'rgba(255, 255, 255, 0.1)';
                        button.style.border = '3px solid rgba(255, 255, 255, 0.3)';
                        button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
                    }
                });
                
                this.selectWeapon(weapon.type);
            };
            
            // Comprehensive event handling for better compatibility
            weaponBtn.addEventListener('touchstart', handleWeaponSelect, { passive: false, capture: true });
            weaponBtn.addEventListener('click', handleWeaponSelect, { passive: false, capture: true });
            weaponBtn.addEventListener('pointerdown', handleWeaponSelect, { passive: false, capture: true });
            
            // Additional iOS-specific handling
            if (this.isIOS) {
                weaponBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, { passive: false, capture: true });
            }
            
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
            cursor: pointer;
            pointer-events: auto;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            z-index: 1201;
        `;
        closeBtn.innerHTML = '✕';
        
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            this.hapticFeedback(10);
            closeBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                closeBtn.style.transform = 'scale(1)';
                this.toggleWeaponInterface();
            }, 100);
        };
        
        closeBtn.addEventListener('touchstart', handleClose, { passive: false, capture: true });
        closeBtn.addEventListener('click', handleClose, { passive: false, capture: true });
        closeBtn.addEventListener('pointerdown', handleClose, { passive: false, capture: true });
        
        // Additional iOS-specific handling
        if (this.isIOS) {
            closeBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
        }
        
        this.weaponInterface.appendChild(closeBtn);
        document.body.appendChild(this.weaponInterface);
        
        console.log('Weapon interface created and added to DOM'); // Debug log
    }
    
    selectWeapon(weaponType) {
        if (this.scene && this.scene.playerSprite) {
            console.log(`Selecting weapon: ${weaponType}`); // Debug log
            
            // Directly equip the weapon
            this.scene.playerSprite.equipWeapon(weaponType);
            
            // Update the weapon types array to reflect the current selection
            const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
            const weaponIndex = weaponTypes.indexOf(weaponType);
            
            if (weaponIndex !== -1) {
                // Set the current weapon index to match the selected weapon
                this.scene.playerSprite.currentWeaponIndex = weaponIndex;
                
                // Update the weapon types array with the selected weapon in the correct position
                if (!this.scene.playerSprite.weaponTypes) {
                    this.scene.playerSprite.weaponTypes = [...weaponTypes];
                }
                this.scene.playerSprite.weaponTypes[weaponIndex] = weaponType;
                
                // Save weapon preference to localStorage
                localStorage.setItem('selectedWeapon', weaponType);
                console.log(`Saved weapon preference: ${weaponType}`); // Debug log
                
                // Notify server of weapon change
                if (this.scene.multiplayer && this.scene.multiplayer.socket) {
                    this.scene.multiplayer.socket.emit('changeWeapon', weaponType);
                    console.log(`Sent weapon change to server: ${weaponType}`); // Debug log
                }
                
                // Update player data on server to persist weapon choice
                if (this.scene.multiplayer && this.scene.multiplayer.socket && this.scene.playerId) {
                    this.scene.multiplayer.socket.emit('updatePlayerData', {
                        playerId: this.scene.playerId,
                        currentWeapon: weaponType
                    });
                }
                
                // Update UI feedback
                this.showActionFeedback(`${weaponType.charAt(0).toUpperCase() + weaponType.slice(1)} equipped!`);
                
                // Update the weapon button icon based on weapon type
                this.updateWeaponButtonIcon(weaponType);
                
                // Close weapon interface after selection
                setTimeout(() => {
                    this.toggleWeaponInterface();
                }, 300);
            }
        }
    }
    
    updateWeaponButtonIcon(weaponType) {
        if (this.buttons.weapon) {
            const weaponIcons = {
                'pistol': '🔫',
                'shotgun': '💥',
                'rifle': '🔫',
                'sniper': '🎯',
                'tomatogun': '🍅'
            };
            
            this.buttons.weapon.innerHTML = weaponIcons[weaponType] || '⚔️';
        }
    }
    
    // Add method to ensure weapon interface is properly initialized
    ensureWeaponInterfaceReady() {
        // Check if weapon interface exists and is properly attached to DOM
        if (this.weaponInterface && !document.body.contains(this.weaponInterface)) {
            console.log('Weapon interface exists but not in DOM, re-adding...'); // Debug log
            document.body.appendChild(this.weaponInterface);
        }
        
        // Check if backdrop exists and is properly attached
        if (this.weaponBackdrop && !document.body.contains(this.weaponBackdrop)) {
            console.log('Weapon backdrop exists but not in DOM, re-adding...'); // Debug log
            document.body.appendChild(this.weaponBackdrop);
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