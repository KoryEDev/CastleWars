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

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768 || 
                     'ontouchstart' in window;

    // Function to detect landscape mode and small screens
    const isLandscapeMode = () => {
      return window.innerHeight < window.innerWidth;
    };
    
    const isSmallScreen = () => {
      return window.innerHeight < 600 || window.innerWidth < 800;
    };

    // Create login/register form
    const form = document.createElement('form');
    form.style.position = 'absolute';
    form.style.left = '50%';
    form.style.top = '50%';
    form.style.transform = 'translate(-50%, -50%)';
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = isMobile ? '15px' : '20px';
    form.style.alignItems = 'center';
    form.style.zIndex = '1000';
    form.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    form.style.border = '3px solid #ffe066';
    form.style.borderRadius = isMobile ? '20px' : '24px';
    form.style.padding = isMobile ? '30px 25px 25px 25px' : '48px 48px 40px 48px';
    form.style.boxShadow = '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)';
    form.style.opacity = '0';
    form.style.transform = 'translate(-50%, -50%) scale(0.9)';
    form.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    form.style.backdropFilter = 'blur(10px)';
    form.style.maxWidth = isMobile ? '95vw' : '450px';
    form.style.maxHeight = isMobile ? '95vh' : 'auto';
    form.style.overflowY = 'auto';
    form.style.width = isMobile ? '100%' : 'auto';
    form.style.minWidth = isMobile ? '280px' : '400px';

    // Function to adjust form layout for different screen sizes
    const adjustFormForScreen = () => {
      const landscape = isLandscapeMode();
      const smallScreen = isSmallScreen();
      
      if (landscape && smallScreen) {
        // Landscape on small screens (mobile landscape, tablets)
        form.style.maxWidth = '90vw';
        form.style.maxHeight = '80vh';  // Further reduced to ensure login button is visible
        form.style.padding = '8px 12px 8px 12px';  // Further reduced padding
        form.style.gap = '6px';  // Further reduced gap
        form.style.overflowY = 'auto';
        form.style.position = 'fixed';
        form.style.top = '48%';  // Move form slightly up in landscape to ensure login button is visible
        form.style.left = '50%';
        form.style.transform = 'translate(-50%, -50%)';
        
        // Adjust input sizes
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
          if (input.type === 'text' || input.type === 'password') {
            input.style.padding = '8px 35px 8px 35px';  // Reduced padding
            input.style.fontSize = '14px';
            input.style.minHeight = '36px';  // Reduced height
          }
        });
        
        // Adjust button sizes
        const buttons = form.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.padding = '10px 20px';  // Reduced padding
          button.style.fontSize = '14px';
          button.style.minHeight = '36px';  // Reduced height
        });
        
        // Adjust saved accounts grid for landscape
        const accountsGrid = form.querySelector('.accounts-grid');
        if (accountsGrid) {
          accountsGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
          accountsGrid.style.maxHeight = '80px';  // Reduced from 100px
          accountsGrid.style.minHeight = '40px';  // Reduced from 60px
          accountsGrid.style.gap = '4px';
          // Check if there are saved accounts by looking for child elements
          accountsGrid.style.display = accountsGrid.children.length > 0 ? 'grid' : 'none';  // Hide if no saved accounts
        }
        
        // Hide or minimize less important elements in landscape
        const subtitleEl = form.querySelector('p');
        if (subtitleEl) {
          subtitleEl.style.display = 'none';  // Hide subtitle to save space
        }
        
        // Adjust form title for landscape
        const formTitleEl = form.querySelector('h2');
        if (formTitleEl) {
          formTitleEl.style.fontSize = '20px';  // Smaller title
          formTitleEl.style.marginBottom = '2px';  // Less margin
        }
        
        // Adjust divider for landscape
        const dividerEl = form.querySelector('div[style*="flex"][style*="align-items"]');
        if (dividerEl) {
          dividerEl.style.margin = '8px 0';  // Less margin
        }
        
        // Adjust remember me checkbox in landscape
        const rememberWrapperEl = form.querySelector('div > input[type="checkbox"]')?.parentElement;
        if (rememberWrapperEl) {
          rememberWrapperEl.style.marginTop = '-8px';  // Reduce negative margin
          rememberWrapperEl.style.gap = '6px';  // Smaller gap
        }
        
        // Ensure the form scrolls to show the login button if needed
        setTimeout(() => {
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn && form.scrollHeight > form.clientHeight) {
            // If content is scrollable, ensure submit button is visible
            submitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      } else if (smallScreen || isMobile) {
        // Portrait mobile or small desktop
        form.style.maxWidth = isMobile ? '95vw' : '450px';
        form.style.maxHeight = '95vh';
        form.style.padding = isMobile ? '20px 15px 15px 15px' : '30px 25px 25px 25px';
        form.style.gap = isMobile ? '12px' : '15px';
        form.style.overflowY = 'auto';
        form.style.position = 'fixed';
        form.style.top = '50%';
        form.style.left = '50%';
        form.style.transform = 'translate(-50%, -50%)';
        
        // Restore hidden elements from landscape mode
        const subtitleEl = form.querySelector('p');
        if (subtitleEl) {
          subtitleEl.style.display = 'block';
        }
        
        const formTitleEl = form.querySelector('h2');
        if (formTitleEl) {
          formTitleEl.style.fontSize = isMobile ? '24px' : '28px';
          formTitleEl.style.marginBottom = '4px';
        }
        
        // Adjust input sizes
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
          if (input.type === 'text' || input.type === 'password') {
            input.style.padding = isMobile ? '12px 12px 12px 40px' : '14px 14px 14px 45px';
            input.style.fontSize = isMobile ? '16px' : '16px';
            input.style.minHeight = isMobile ? '44px' : '48px';
          }
        });
        
        // Adjust button sizes
        const buttons = form.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.padding = isMobile ? '14px 25px' : '16px 30px';
          button.style.fontSize = isMobile ? '15px' : '18px';
          button.style.minHeight = isMobile ? '48px' : '50px';
        });
        
        // Adjust saved accounts grid
        const accountsGrid = form.querySelector('.accounts-grid');
        if (accountsGrid) {
          accountsGrid.style.gridTemplateColumns = isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
          accountsGrid.style.maxHeight = isMobile ? '120px' : '140px';
          accountsGrid.style.minHeight = isMobile ? '60px' : '80px';
          accountsGrid.style.gap = isMobile ? '6px' : '8px';
        }
      } else {
        // Desktop/large screens
        form.style.maxWidth = '450px';
        form.style.maxHeight = 'auto';
        form.style.padding = '48px 48px 40px 48px';
        form.style.gap = '20px';
        form.style.overflowY = 'visible';
        form.style.position = 'absolute';
        
        // Restore any hidden elements
        const subtitleEl = form.querySelector('p');
        if (subtitleEl) {
          subtitleEl.style.display = 'block';
        }
        
        const formTitleEl = form.querySelector('h2');
        if (formTitleEl) {
          formTitleEl.style.fontSize = '28px';
          formTitleEl.style.marginBottom = '4px';
        }
        
        // Reset input sizes
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
          if (input.type === 'text' || input.type === 'password') {
            input.style.padding = '16px 16px 16px 48px';
            input.style.fontSize = '18px';
            input.style.minHeight = 'auto';
          }
        });
        
        // Reset button sizes
        const buttons = form.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.padding = '18px 40px';
          button.style.fontSize = '20px';
          button.style.minHeight = 'auto';
        });
        
        // Reset saved accounts grid
        const accountsGrid = form.querySelector('.accounts-grid');
        if (accountsGrid) {
          accountsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
          accountsGrid.style.maxHeight = '140px';
          accountsGrid.style.minHeight = '80px';
          accountsGrid.style.gap = '8px';
        }
      }
    };

    // Listen for orientation and screen size changes
    window.addEventListener('orientationchange', () => {
      setTimeout(adjustFormForScreen, 100);
    });
    window.addEventListener('resize', adjustFormForScreen);
    document.addEventListener('fullscreenchange', adjustFormForScreen);
    document.addEventListener('webkitfullscreenchange', adjustFormForScreen);
    document.addEventListener('mozfullscreenchange', adjustFormForScreen);
    
    // Initial adjustment
    setTimeout(adjustFormForScreen, 100);

    setTimeout(() => { 
      form.style.opacity = '1';
      form.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);

    // Form title
    const formTitle = document.createElement('h2');
    formTitle.textContent = 'Welcome, Warrior!';
    formTitle.style.margin = '0 0 4px 0';
    formTitle.style.color = '#ffe066';
    formTitle.style.fontSize = isMobile ? '24px' : '28px';
    formTitle.style.fontFamily = 'Arial Black, sans-serif';
    formTitle.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    formTitle.style.textAlign = 'center';
    form.appendChild(formTitle);
    
    // Subtitle/tip
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sign in to continue your conquest';
    subtitle.style.margin = '0 0 16px 0';
    subtitle.style.color = '#aaaaaa';
    subtitle.style.fontSize = isMobile ? '13px' : '14px';
    subtitle.style.textAlign = 'center';
    subtitle.style.lineHeight = '1.4';
    form.appendChild(subtitle);

    // Username input with icon
    const usernameWrapper = document.createElement('div');
    usernameWrapper.style.position = 'relative';
    usernameWrapper.style.width = isMobile ? '100%' : '300px';
    usernameWrapper.style.maxWidth = isMobile ? '280px' : '300px';
    
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter your username';
    usernameInput.style.padding = isMobile ? '14px 14px 14px 42px' : '16px 16px 16px 48px';
    usernameInput.style.width = '100%';
    usernameInput.style.fontSize = isMobile ? '16px' : '18px'; // 16px prevents zoom on iOS
    usernameInput.style.borderRadius = isMobile ? '10px' : '12px';
    usernameInput.style.border = '2px solid #444466';
    usernameInput.style.background = 'rgba(42,42,68,0.8)';
    usernameInput.style.color = '#ffffff';
    usernameInput.style.outline = 'none';
    usernameInput.style.transition = 'all 0.3s';
    usernameInput.style.boxSizing = 'border-box';
    usernameInput.style.minHeight = isMobile ? '48px' : 'auto'; // Better touch target
    
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
    userIcon.style.left = isMobile ? '12px' : '16px';
    userIcon.style.top = '50%';
    userIcon.style.transform = 'translateY(-50%)';
    userIcon.style.fontSize = isMobile ? '18px' : '20px';
    userIcon.style.opacity = '0.7';
    
    usernameWrapper.appendChild(userIcon);
    usernameWrapper.appendChild(usernameInput);
    form.appendChild(usernameWrapper);

    // Password input with icon
    const passwordWrapper = document.createElement('div');
    passwordWrapper.style.position = 'relative';
    passwordWrapper.style.width = isMobile ? '100%' : '300px';
    passwordWrapper.style.maxWidth = isMobile ? '280px' : '300px';
    
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Enter your password';
    passwordInput.style.padding = isMobile ? '14px 42px 14px 42px' : '16px 48px 16px 48px';
    passwordInput.style.width = '100%';
    passwordInput.style.fontSize = isMobile ? '16px' : '18px'; // 16px prevents zoom on iOS
    passwordInput.style.borderRadius = isMobile ? '10px' : '12px';
    passwordInput.style.border = '2px solid #444466';
    passwordInput.style.background = 'rgba(42,42,68,0.8)';
    passwordInput.style.color = '#ffffff';
    passwordInput.style.outline = 'none';
    passwordInput.style.transition = 'all 0.3s';
    passwordInput.style.boxSizing = 'border-box';
    passwordInput.style.minHeight = isMobile ? '48px' : 'auto'; // Better touch target
    
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
    lockIcon.style.left = isMobile ? '12px' : '16px';
    lockIcon.style.top = '50%';
    lockIcon.style.transform = 'translateY(-50%)';
    lockIcon.style.fontSize = isMobile ? '18px' : '20px';
    lockIcon.style.opacity = '0.7';
    
    const eyeIcon = document.createElement('div');
    eyeIcon.innerHTML = '👁️';
    eyeIcon.style.position = 'absolute';
    eyeIcon.style.right = isMobile ? '12px' : '16px';
    eyeIcon.style.top = '50%';
    eyeIcon.style.transform = 'translateY(-50%)';
    eyeIcon.style.fontSize = isMobile ? '18px' : '20px';
    eyeIcon.style.cursor = 'pointer';
    eyeIcon.style.opacity = '0.5';
    eyeIcon.style.transition = 'opacity 0.2s';
    eyeIcon.style.minWidth = isMobile ? '30px' : 'auto'; // Better touch target
    eyeIcon.style.minHeight = isMobile ? '30px' : 'auto';
    eyeIcon.style.display = 'flex';
    eyeIcon.style.alignItems = 'center';
    eyeIcon.style.justifyContent = 'center';
    
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
      accountsGrid.className = 'accounts-grid';
      accountsGrid.style.display = 'grid';
      accountsGrid.style.gridTemplateColumns = isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
      accountsGrid.style.gap = isMobile ? '6px' : '8px';
      accountsGrid.style.maxHeight = isMobile ? '120px' : '140px';
      accountsGrid.style.overflowY = 'auto';
      accountsGrid.style.padding = '4px';
      accountsGrid.style.minHeight = isMobile ? '60px' : '80px';
      accountsGrid.style.borderRadius = '8px';
      accountsGrid.style.background = 'rgba(40,40,60,0.3)';
      accountsGrid.style.border = '1px solid rgba(255,224,102,0.2)';
      
      // Add scroll indicator
      if (savedAccounts.length > (isMobile ? 4 : 6)) {
        accountsGrid.style.position = 'relative';
        const scrollIndicator = document.createElement('div');
        scrollIndicator.innerHTML = '📜';
        scrollIndicator.style.position = 'absolute';
        scrollIndicator.style.right = '8px';
        scrollIndicator.style.top = '8px';
        scrollIndicator.style.fontSize = '12px';
        scrollIndicator.style.opacity = '0.6';
        scrollIndicator.style.pointerEvents = 'none';
        accountsGrid.appendChild(scrollIndicator);
      }
      
      savedAccounts.forEach((account, index) => {
        const accountTile = document.createElement('div');
        accountTile.style.background = 'linear-gradient(135deg, rgba(60,60,100,0.8) 0%, rgba(80,80,120,0.6) 100%)';
        accountTile.style.border = '2px solid #444466';
        accountTile.style.borderRadius = isMobile ? '6px' : '8px';
        accountTile.style.padding = isMobile ? '10px 6px' : '12px 8px';
        accountTile.style.cursor = 'pointer';
        accountTile.style.transition = 'all 0.2s';
        accountTile.style.textAlign = 'center';
        accountTile.style.position = 'relative';
        accountTile.style.overflow = 'hidden';
        accountTile.style.minHeight = isMobile ? '45px' : 'auto';
        accountTile.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        
        const accountName = document.createElement('div');
        accountName.textContent = account.username;
        accountName.style.color = '#ffffff';
        accountName.style.fontSize = isMobile ? '12px' : '14px';
        accountName.style.fontWeight = 'bold';
        accountName.style.whiteSpace = 'nowrap';
        accountName.style.overflow = 'hidden';
        accountName.style.textOverflow = 'ellipsis';
        
        const accountIcon = document.createElement('div');
        accountIcon.innerHTML = '⚔️';
        accountIcon.style.fontSize = isMobile ? '16px' : '20px';
        accountIcon.style.marginBottom = isMobile ? '2px' : '4px';
        
        // Delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '✖';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = isMobile ? '1px' : '2px';
        deleteBtn.style.right = isMobile ? '3px' : '4px';
        deleteBtn.style.fontSize = isMobile ? '10px' : '12px';
        deleteBtn.style.color = '#ff6666';
        deleteBtn.style.opacity = '0';
        deleteBtn.style.transition = 'opacity 0.2s';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.minWidth = isMobile ? '20px' : 'auto'; // Better touch target
        deleteBtn.style.minHeight = isMobile ? '20px' : 'auto';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
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
          accountTile.style.background = 'linear-gradient(135deg, rgba(80,80,120,0.9) 0%, rgba(100,100,140,0.7) 100%)';
          accountTile.style.transform = 'scale(1.05)';
          accountTile.style.boxShadow = '0 4px 12px rgba(255,224,102,0.3)';
          deleteBtn.style.opacity = '1';
        };
        accountTile.onmouseout = () => {
          accountTile.style.border = '2px solid #444466';
          accountTile.style.background = 'linear-gradient(135deg, rgba(60,60,100,0.8) 0%, rgba(80,80,120,0.6) 100%)';
          accountTile.style.transform = 'scale(1)';
          accountTile.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
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
    submitButton.type = 'submit';
    submitButton.textContent = 'ENTER THE BATTLEFIELD';
    submitButton.style.padding = isMobile ? '16px 30px' : '18px 40px';
    submitButton.style.fontSize = isMobile ? '16px' : '20px';
    submitButton.style.fontWeight = 'bold';
    submitButton.style.background = 'linear-gradient(135deg, #ffe066 0%, #ffcc00 100%)';
    submitButton.style.color = '#222244';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = isMobile ? '10px' : '12px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.transition = 'all 0.3s';
    submitButton.style.boxShadow = '0 4px 16px rgba(255,224,102,0.4)';
    submitButton.style.textTransform = 'uppercase';
    submitButton.style.letterSpacing = '1px';
    submitButton.style.marginTop = '8px';
    submitButton.style.width = isMobile ? '100%' : 'auto';
    submitButton.style.minHeight = isMobile ? '50px' : 'auto'; // Better touch target
    submitButton.style.maxWidth = isMobile ? '280px' : 'auto';
    
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
    toggleBtn.innerHTML = isMobile ? '🆕 <strong>New Player?</strong><br>Create Account' : '🆕 <strong>New Player?</strong> Create Your Account';
    toggleBtn.style.background = 'linear-gradient(135deg, rgba(255,224,102,0.1) 0%, rgba(255,204,0,0.1) 100%)';
    toggleBtn.style.border = '2px solid #ffe066';
    toggleBtn.style.color = '#ffe066';
    toggleBtn.style.fontSize = isMobile ? '14px' : '16px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.transition = 'all 0.3s';
    toggleBtn.style.padding = isMobile ? '12px 20px' : '14px 24px';
    toggleBtn.style.borderRadius = isMobile ? '10px' : '12px';
    toggleBtn.style.width = '100%';
    toggleBtn.style.fontFamily = 'Arial, sans-serif';
    toggleBtn.style.textShadow = '1px 1px 2px rgba(0,0,0,0.3)';
    toggleBtn.style.minHeight = isMobile ? '48px' : 'auto'; // Better touch target
    toggleBtn.style.maxWidth = isMobile ? '280px' : 'auto';
    toggleBtn.style.lineHeight = isMobile ? '1.3' : '1.5';
    
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

    // Apply initial screen adjustment
    setTimeout(() => {
      adjustFormForScreen();
    }, 50);

    // Toggle login/register
    toggleBtn.onclick = () => {
      isRegister = !isRegister;
      formTitle.textContent = isRegister ? 'Join the Battle!' : 'Welcome, Warrior!';
      subtitle.textContent = isRegister ? 'Create your account and start building!' : 'Sign in to continue your conquest';
      submitButton.textContent = isRegister ? 'CREATE ACCOUNT' : 'ENTER THE BATTLEFIELD';
      toggleBtn.innerHTML = isRegister ? 
        (isMobile ? '🔑 <strong>Have an account?</strong><br>Sign In' : '🔑 <strong>Already have an account?</strong> Sign In') : 
        (isMobile ? '🆕 <strong>New Player?</strong><br>Create Account' : '🆕 <strong>New Player?</strong> Create Your Account');
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