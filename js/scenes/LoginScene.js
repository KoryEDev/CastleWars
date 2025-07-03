export class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoginScene' });
  }

  create() {
    // Create animated gradient background
    this.createAnimatedBackground();
    
    // Add floating particles
    this.createParticles();

    // Add title with animation
    this.title = this.add.text(this.cameras.main.width / 2, this.cameras.main.height * 0.15, 'CASTLE WARS', {
      fontSize: '72px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 8, color: '#000', blur: 16, fill: true }
    }).setOrigin(0.5);
    
    // Add subtitle
    this.subtitle = this.add.text(this.cameras.main.width / 2, this.cameras.main.height * 0.23, 'Stickman Siege', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    // Animate title
    this.titleTween = this.tweens.add({
      targets: this.title,
      y: this.cameras.main.height * 0.15 - 10,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Store references for resize
    this.backgroundGraphics = null;
    this.particleEmitter = null;
    
    // Handle resize
    this.scale.on('resize', this.resize, this);

    // Create login/register form
    const form = document.createElement('form');
    form.style.position = 'absolute';
    form.style.left = '50%';
    form.style.top = '50%';
    form.style.transform = 'translate(-50%, -50%)';
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '20px';
    form.style.alignItems = 'center';
    form.style.zIndex = '1000';
    form.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    form.style.border = '3px solid #ffe066';
    form.style.borderRadius = '24px';
    form.style.padding = '48px 48px 40px 48px';
    form.style.boxShadow = '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)';
    form.style.opacity = '0';
    form.style.transform = 'translate(-50%, -50%) scale(0.9)';
    form.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    form.style.backdropFilter = 'blur(10px)';

    setTimeout(() => { 
      form.style.opacity = '1';
      form.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);

    // Form title
    const formTitle = document.createElement('h2');
    formTitle.textContent = 'Welcome, Warrior!';
    formTitle.style.margin = '0 0 4px 0';
    formTitle.style.color = '#ffe066';
    formTitle.style.fontSize = '28px';
    formTitle.style.fontFamily = 'Arial Black, sans-serif';
    formTitle.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    form.appendChild(formTitle);
    
    // Subtitle/tip
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sign in to continue your conquest';
    subtitle.style.margin = '0 0 16px 0';
    subtitle.style.color = '#aaaaaa';
    subtitle.style.fontSize = '14px';
    subtitle.style.textAlign = 'center';
    form.appendChild(subtitle);

    // Username input with icon
    const usernameWrapper = document.createElement('div');
    usernameWrapper.style.position = 'relative';
    usernameWrapper.style.width = '300px';
    
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter your username';
    usernameInput.style.padding = '16px 16px 16px 48px';
    usernameInput.style.width = '100%';
    usernameInput.style.fontSize = '18px';
    usernameInput.style.borderRadius = '12px';
    usernameInput.style.border = '2px solid #444466';
    usernameInput.style.background = 'rgba(42,42,68,0.8)';
    usernameInput.style.color = '#ffffff';
    usernameInput.style.outline = 'none';
    usernameInput.style.transition = 'all 0.3s';
    usernameInput.style.boxSizing = 'border-box';
    
    usernameInput.onfocus = () => {
      usernameInput.style.border = '2px solid #ffe066';
      usernameInput.style.boxShadow = '0 0 20px rgba(255,224,102,0.3)';
    };
    usernameInput.onblur = () => {
      usernameInput.style.border = '2px solid #444466';
      usernameInput.style.boxShadow = 'none';
    };
    
    // Load saved username if exists
    const savedUsername = localStorage.getItem('castleWarsUsername');
    if (savedUsername) {
      usernameInput.value = savedUsername;
    }
    
    const userIcon = document.createElement('div');
    userIcon.innerHTML = '👤';
    userIcon.style.position = 'absolute';
    userIcon.style.left = '16px';
    userIcon.style.top = '50%';
    userIcon.style.transform = 'translateY(-50%)';
    userIcon.style.fontSize = '20px';
    userIcon.style.opacity = '0.7';
    
    usernameWrapper.appendChild(userIcon);
    usernameWrapper.appendChild(usernameInput);
    form.appendChild(usernameWrapper);

    // Password input with icon
    const passwordWrapper = document.createElement('div');
    passwordWrapper.style.position = 'relative';
    passwordWrapper.style.width = '300px';
    
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Enter your password';
    passwordInput.style.padding = '16px 48px 16px 48px';
    passwordInput.style.width = '100%';
    passwordInput.style.fontSize = '18px';
    passwordInput.style.borderRadius = '12px';
    passwordInput.style.border = '2px solid #444466';
    passwordInput.style.background = 'rgba(42,42,68,0.8)';
    passwordInput.style.color = '#ffffff';
    passwordInput.style.outline = 'none';
    passwordInput.style.transition = 'all 0.3s';
    passwordInput.style.boxSizing = 'border-box';
    
    passwordInput.onfocus = () => {
      passwordInput.style.border = '2px solid #ffe066';
      passwordInput.style.boxShadow = '0 0 20px rgba(255,224,102,0.3)';
    };
    passwordInput.onblur = () => {
      passwordInput.style.border = '2px solid #444466';
      passwordInput.style.boxShadow = 'none';
    };
    
    const lockIcon = document.createElement('div');
    lockIcon.innerHTML = '🔒';
    lockIcon.style.position = 'absolute';
    lockIcon.style.left = '16px';
    lockIcon.style.top = '50%';
    lockIcon.style.transform = 'translateY(-50%)';
    lockIcon.style.fontSize = '20px';
    lockIcon.style.opacity = '0.7';
    
    const eyeIcon = document.createElement('div');
    eyeIcon.innerHTML = '👁️';
    eyeIcon.style.position = 'absolute';
    eyeIcon.style.right = '16px';
    eyeIcon.style.top = '50%';
    eyeIcon.style.transform = 'translateY(-50%)';
    eyeIcon.style.fontSize = '20px';
    eyeIcon.style.cursor = 'pointer';
    eyeIcon.style.opacity = '0.5';
    eyeIcon.style.transition = 'opacity 0.2s';
    
    eyeIcon.onmouseover = () => eyeIcon.style.opacity = '0.8';
    eyeIcon.onmouseout = () => eyeIcon.style.opacity = '0.5';
    
    let showPassword = false;
    eyeIcon.onclick = () => {
      showPassword = !showPassword;
      passwordInput.type = showPassword ? 'text' : 'password';
      eyeIcon.innerHTML = showPassword ? '🙈' : '👁️';
    };
    
    passwordWrapper.appendChild(lockIcon);
    passwordWrapper.appendChild(passwordInput);
    passwordWrapper.appendChild(eyeIcon);
    form.appendChild(passwordWrapper);

    // Remember me checkbox
    const rememberWrapper = document.createElement('div');
    rememberWrapper.style.display = 'flex';
    rememberWrapper.style.alignItems = 'center';
    rememberWrapper.style.gap = '8px';
    rememberWrapper.style.marginTop = '-10px';
    
    const rememberCheckbox = document.createElement('input');
    rememberCheckbox.type = 'checkbox';
    rememberCheckbox.id = 'rememberMe';
    rememberCheckbox.style.width = '18px';
    rememberCheckbox.style.height = '18px';
    rememberCheckbox.style.cursor = 'pointer';
    rememberCheckbox.style.accentColor = '#ffe066';
    
    const rememberLabel = document.createElement('label');
    rememberLabel.htmlFor = 'rememberMe';
    rememberLabel.textContent = 'Remember me';
    rememberLabel.style.color = '#ffffff';
    rememberLabel.style.fontSize = '14px';
    rememberLabel.style.cursor = 'pointer';
    rememberLabel.style.userSelect = 'none';
    
    // Check if we have saved credentials
    const savedCredentials = localStorage.getItem('castleWarsCredentials');
    if (savedCredentials) {
      try {
        const creds = JSON.parse(savedCredentials);
        if (creds.username && creds.password) {
          usernameInput.value = creds.username;
          passwordInput.value = atob(creds.password); // Basic decode
          rememberCheckbox.checked = true;
        }
      } catch (e) {
        // Invalid saved data
      }
    }
    
    rememberWrapper.appendChild(rememberCheckbox);
    rememberWrapper.appendChild(rememberLabel);
    form.appendChild(rememberWrapper);

    // Saved accounts section
    const savedAccountsData = localStorage.getItem('castleWarsSavedAccounts');
    const savedAccounts = savedAccountsData ? JSON.parse(savedAccountsData) : [];
    
    if (savedAccounts.length > 0) {
      const savedAccountsTitle = document.createElement('div');
      savedAccountsTitle.textContent = 'Quick Login:';
      savedAccountsTitle.style.color = '#ffe066';
      savedAccountsTitle.style.fontSize = '14px';
      savedAccountsTitle.style.marginTop = '10px';
      savedAccountsTitle.style.marginBottom = '8px';
      form.appendChild(savedAccountsTitle);
      
      const accountsGrid = document.createElement('div');
      accountsGrid.style.display = 'grid';
      accountsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      accountsGrid.style.gap = '8px';
      accountsGrid.style.maxHeight = '120px';
      accountsGrid.style.overflowY = 'auto';
      accountsGrid.style.padding = '4px';
      
      savedAccounts.forEach((account, index) => {
        const accountTile = document.createElement('div');
        accountTile.style.background = 'rgba(60,60,100,0.6)';
        accountTile.style.border = '2px solid #444466';
        accountTile.style.borderRadius = '8px';
        accountTile.style.padding = '12px 8px';
        accountTile.style.cursor = 'pointer';
        accountTile.style.transition = 'all 0.2s';
        accountTile.style.textAlign = 'center';
        accountTile.style.position = 'relative';
        accountTile.style.overflow = 'hidden';
        
        const accountName = document.createElement('div');
        accountName.textContent = account.username;
        accountName.style.color = '#ffffff';
        accountName.style.fontSize = '14px';
        accountName.style.fontWeight = 'bold';
        accountName.style.whiteSpace = 'nowrap';
        accountName.style.overflow = 'hidden';
        accountName.style.textOverflow = 'ellipsis';
        
        const accountIcon = document.createElement('div');
        accountIcon.innerHTML = '⚔️';
        accountIcon.style.fontSize = '20px';
        accountIcon.style.marginBottom = '4px';
        
        // Delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '✖';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '2px';
        deleteBtn.style.right = '4px';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.style.color = '#ff6666';
        deleteBtn.style.opacity = '0';
        deleteBtn.style.transition = 'opacity 0.2s';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          savedAccounts.splice(index, 1);
          localStorage.setItem('castleWarsSavedAccounts', JSON.stringify(savedAccounts));
          accountTile.style.transform = 'scale(0)';
          setTimeout(() => accountTile.remove(), 200);
        };
        
        accountTile.appendChild(deleteBtn);
        accountTile.appendChild(accountIcon);
        accountTile.appendChild(accountName);
        
        accountTile.onmouseover = () => {
          accountTile.style.border = '2px solid #ffe066';
          accountTile.style.background = 'rgba(80,80,120,0.8)';
          accountTile.style.transform = 'scale(1.05)';
          deleteBtn.style.opacity = '1';
        };
        accountTile.onmouseout = () => {
          accountTile.style.border = '2px solid #444466';
          accountTile.style.background = 'rgba(60,60,100,0.6)';
          accountTile.style.transform = 'scale(1)';
          deleteBtn.style.opacity = '0';
        };
        
        accountTile.onclick = () => {
          usernameInput.value = account.username;
          passwordInput.value = atob(account.password);
          rememberCheckbox.checked = true;
          // Highlight selected
          accountTile.style.border = '2px solid #00ff00';
          setTimeout(() => {
            accountTile.style.border = '2px solid #444466';
          }, 500);
        };
        
        accountsGrid.appendChild(accountTile);
      });
      
      form.appendChild(accountsGrid);
    }

    // Error message
    const errorMsg = document.createElement('div');
    errorMsg.style.color = '#ff6666';
    errorMsg.style.fontSize = '16px';
    errorMsg.style.minHeight = '20px';
    errorMsg.style.textAlign = 'center';
    errorMsg.style.fontWeight = 'bold';
    errorMsg.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
    errorMsg.style.marginTop = '10px';
    form.appendChild(errorMsg);

    // Login/Register button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'ENTER THE BATTLEFIELD';
    submitButton.style.padding = '18px 40px';
    submitButton.style.fontSize = '20px';
    submitButton.style.fontWeight = 'bold';
    submitButton.style.background = 'linear-gradient(135deg, #ffe066 0%, #ffcc00 100%)';
    submitButton.style.color = '#222244';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '12px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.transition = 'all 0.3s';
    submitButton.style.boxShadow = '0 4px 16px rgba(255,224,102,0.4)';
    submitButton.style.textTransform = 'uppercase';
    submitButton.style.letterSpacing = '1px';
    submitButton.style.marginTop = '8px';
    
    submitButton.onmouseover = () => {
      submitButton.style.transform = 'translateY(-2px)';
      submitButton.style.boxShadow = '0 6px 20px rgba(255,224,102,0.6)';
    };
    submitButton.onmouseout = () => {
      submitButton.style.transform = 'translateY(0)';
      submitButton.style.boxShadow = '0 4px 16px rgba(255,224,102,0.4)';
    };
    form.appendChild(submitButton);

    // Divider
    const divider = document.createElement('div');
    divider.style.display = 'flex';
    divider.style.alignItems = 'center';
    divider.style.width = '100%';
    divider.style.margin = '12px 0';
    divider.style.opacity = '0.6';
    
    const dividerLine1 = document.createElement('div');
    dividerLine1.style.flex = '1';
    dividerLine1.style.height = '1px';
    dividerLine1.style.background = '#666688';
    
    const dividerText = document.createElement('span');
    dividerText.textContent = 'OR';
    dividerText.style.padding = '0 12px';
    dividerText.style.color = '#aaaaaa';
    dividerText.style.fontSize = '12px';
    
    const dividerLine2 = document.createElement('div');
    dividerLine2.style.flex = '1';
    dividerLine2.style.height = '1px';
    dividerLine2.style.background = '#666688';
    
    divider.appendChild(dividerLine1);
    divider.appendChild(dividerText);
    divider.appendChild(dividerLine2);
    form.appendChild(divider);
    
    // Login/Register toggle
    let isRegister = false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.innerHTML = '🆕 <strong>New Player?</strong> Create Your Account';
    toggleBtn.style.background = 'linear-gradient(135deg, rgba(255,224,102,0.1) 0%, rgba(255,204,0,0.1) 100%)';
    toggleBtn.style.border = '2px solid #ffe066';
    toggleBtn.style.color = '#ffe066';
    toggleBtn.style.fontSize = '16px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.transition = 'all 0.3s';
    toggleBtn.style.padding = '14px 24px';
    toggleBtn.style.borderRadius = '12px';
    toggleBtn.style.width = '100%';
    toggleBtn.style.fontFamily = 'Arial, sans-serif';
    toggleBtn.style.textShadow = '1px 1px 2px rgba(0,0,0,0.3)';
    
    toggleBtn.onmouseover = () => {
      toggleBtn.style.background = 'linear-gradient(135deg, rgba(255,224,102,0.2) 0%, rgba(255,204,0,0.2) 100%)';
      toggleBtn.style.transform = 'translateY(-1px)';
      toggleBtn.style.boxShadow = '0 4px 12px rgba(255,224,102,0.3)';
    };
    toggleBtn.onmouseout = () => {
      toggleBtn.style.background = 'linear-gradient(135deg, rgba(255,224,102,0.1) 0%, rgba(255,204,0,0.1) 100%)';
      toggleBtn.style.transform = 'translateY(0)';
      toggleBtn.style.boxShadow = 'none';
    };
    form.appendChild(toggleBtn);

    // Add form to game
    this.game.canvas.parentElement.appendChild(form);

    // Toggle login/register
    toggleBtn.onclick = () => {
      isRegister = !isRegister;
      formTitle.textContent = isRegister ? 'Join the Battle!' : 'Welcome, Warrior!';
      subtitle.textContent = isRegister ? 'Create your account and start building!' : 'Sign in to continue your conquest';
      submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
      toggleBtn.innerHTML = isRegister ? '🔑 <strong>Already have an account?</strong> Sign In' : '🆕 <strong>New Player?</strong> Create Your Account';
      usernameInput.placeholder = isRegister ? 'Choose a username' : 'Enter your username';
      passwordInput.placeholder = isRegister ? 'Create a password' : 'Enter your password';
      errorMsg.textContent = '';
      
      // Update button style based on mode
      if (isRegister) {
        toggleBtn.style.background = 'linear-gradient(135deg, rgba(100,200,255,0.1) 0%, rgba(50,150,255,0.1) 100%)';
        toggleBtn.style.border = '2px solid #66bbff';
        toggleBtn.style.color = '#66bbff';
      } else {
        toggleBtn.style.background = 'linear-gradient(135deg, rgba(255,224,102,0.1) 0%, rgba(255,204,0,0.1) 100%)';
        toggleBtn.style.border = '2px solid #ffe066';
        toggleBtn.style.color = '#ffe066';
      }
    };

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorMsg.textContent = 'Please enter both username and password.';
        return;
      }
      errorMsg.textContent = '';
      submitButton.disabled = true;
      submitButton.textContent = isRegister ? 'Creating...' : 'Entering...';
      try {
        const endpoint = isRegister ? '/auth/register' : '/auth/login';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          errorMsg.textContent = data.error || 'Something went wrong.';
          submitButton.disabled = false;
          submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
          return;
        }
        // After successful login, connect to server and emit join
        if (!window.io) {
          errorMsg.textContent = 'Socket.io not loaded.';
          submitButton.disabled = false;
          submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
          return;
        }
        const socket = window.io();
        let joinHandled = false;
        socket.on('loginError', (msg) => {
          joinHandled = true;
          errorMsg.textContent = msg.message || 'Account is already logged in.';
          submitButton.disabled = false;
          submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
          socket.disconnect();
        });
        // Use a verification event instead of join to avoid duplicate join messages
        socket.emit('verifyLogin', { username });
        // Wait for confirmation
        socket.on('worldState', (state) => {
          if (joinHandled) return;
          joinHandled = true;
          // Save username to localStorage on successful login
          localStorage.setItem('castleWarsUsername', data.username);
          
          // Save credentials if remember me is checked
          if (rememberCheckbox.checked) {
            const credentials = {
              username: data.username,
              password: btoa(password) // Basic encoding
            };
            localStorage.setItem('castleWarsCredentials', JSON.stringify(credentials));
            
            // Also add to saved accounts if not already there
            let savedAccounts = [];
            const savedAccountsData = localStorage.getItem('castleWarsSavedAccounts');
            if (savedAccountsData) {
              savedAccounts = JSON.parse(savedAccountsData);
            }
            
            // Check if account already exists
            const existingIndex = savedAccounts.findIndex(acc => acc.username === data.username);
            if (existingIndex !== -1) {
              // Update existing account
              savedAccounts[existingIndex].password = btoa(password);
            } else {
              // Add new account (max 9 accounts)
              savedAccounts.unshift({
                username: data.username,
                password: btoa(password)
              });
              if (savedAccounts.length > 9) {
                savedAccounts = savedAccounts.slice(0, 9);
              }
            }
            localStorage.setItem('castleWarsSavedAccounts', JSON.stringify(savedAccounts));
          } else {
            // Clear saved credentials if unchecked
            localStorage.removeItem('castleWarsCredentials');
          }
          
          form.remove();
          socket.disconnect(); // Let GameScene handle its own socket
          this.scene.start('GameScene', { username: data.username });
        });
        // Timeout if no response
        setTimeout(() => {
          if (!joinHandled) {
            errorMsg.textContent = 'Server did not respond. Try again.';
            submitButton.disabled = false;
            submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
            socket.disconnect();
          }
        }, 4000);
      } catch (err) {
        errorMsg.textContent = 'Network error.';
        submitButton.disabled = false;
        submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
      }
    });
  }
  
  resize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Update camera
    this.cameras.resize(width, height);
    
    // Recreate background
    this.createAnimatedBackground();
    
    // Update title positions
    if (this.title) {
      this.title.setPosition(width / 2, height * 0.15);
    }
    if (this.subtitle) {
      this.subtitle.setPosition(width / 2, height * 0.23);
    }
    
    // Update title animation
    if (this.titleTween) {
      this.titleTween.stop();
      this.titleTween = this.tweens.add({
        targets: this.title,
        y: height * 0.15 - 10,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Update particles
    if (this.particleEmitter) {
      this.particleEmitter.setEmitZone({
        source: new Phaser.Geom.Rectangle(0, 0, width, height),
        type: 'random'
      });
    }
  }
  
  createAnimatedBackground() {
    // Clear existing background
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
    }
    
    // Create gradient sky
    this.backgroundGraphics = this.add.graphics();
    
    // Sky gradient colors for sunset
    const color1 = 0x1a1a2e; // Dark blue
    const color2 = 0x16213e; // Darker blue
    const color3 = 0x0f3460; // Deep blue
    const color4 = 0xe94560; // Pink/red sunset
    
    // Draw gradient
    const height = this.cameras.main ? this.cameras.main.height : this.scale.height;
    const width = this.cameras.main ? this.cameras.main.width : this.scale.width;
    
    for (let i = 0; i < height; i++) {
      let color;
      const ratio = i / height;
      
      if (ratio < 0.3) {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(color1),
          Phaser.Display.Color.IntegerToColor(color2),
          1, ratio / 0.3
        );
      } else if (ratio < 0.7) {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(color2),
          Phaser.Display.Color.IntegerToColor(color3),
          1, (ratio - 0.3) / 0.4
        );
      } else {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(color3),
          Phaser.Display.Color.IntegerToColor(color4),
          1, (ratio - 0.7) / 0.3
        );
      }
      
      this.backgroundGraphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      this.backgroundGraphics.fillRect(0, i, width, 1);
    }
  }
  
  createParticles() {
    // Create floating particles for atmosphere
    this.particleEmitter = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: this.cameras.main.width },
      y: { min: 0, max: this.cameras.main.height },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      speed: { min: 20, max: 60 },
      lifespan: 4000,
      frequency: 100,
      tint: 0xffe066
    });
    
    // Create simple spark texture if it doesn't exist
    if (!this.textures.exists('spark')) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('spark', 8, 8);
      graphics.destroy();
    }
  }
} 