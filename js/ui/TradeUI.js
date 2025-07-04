// TradeUI.js
// Trading interface for Castle Wars

export class TradeUI {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.tradePartner = null;
    this.tradeId = null;
    
    // Trade state
    this.myOffer = {
      items: [],
      gold: 0,
      locked: false
    };
    
    this.theirOffer = {
      items: [],
      gold: 0,
      locked: false
    };
    
    this.createUI();
    this.setupSocketListeners();
  }

  createUI() {
    // Main trade window
    this.tradeWindow = document.createElement('div');
    this.tradeWindow.id = 'trade-window';
    this.tradeWindow.style.position = 'absolute';
    this.tradeWindow.style.left = '50%';
    this.tradeWindow.style.top = '50%';
    this.tradeWindow.style.transform = 'translate(-50%, -50%)';
    this.tradeWindow.style.display = 'none';
    this.tradeWindow.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    this.tradeWindow.style.border = '3px solid #ffe066';
    this.tradeWindow.style.borderRadius = '20px';
    this.tradeWindow.style.padding = '20px';
    this.tradeWindow.style.boxShadow = '0 12px 48px rgba(0,0,0,0.8)';
    this.tradeWindow.style.zIndex = '2500';
    this.tradeWindow.style.minWidth = '600px';
    this.tradeWindow.style.fontFamily = 'Arial, sans-serif';
    
    // Header
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '20px';
    header.style.position = 'relative';
    
    const title = document.createElement('h2');
    title.style.color = '#ffe066';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    title.textContent = 'TRADE';
    
    this.partnerName = document.createElement('div');
    this.partnerName.style.color = '#ffffff';
    this.partnerName.style.fontSize = '16px';
    this.partnerName.style.marginTop = '5px';
    
    header.appendChild(title);
    header.appendChild(this.partnerName);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '-10px';
    closeBtn.style.right = '-10px';
    closeBtn.style.background = 'rgba(255,0,0,0.2)';
    closeBtn.style.border = '2px solid #ff4444';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '30px';
    closeBtn.style.height = '30px';
    closeBtn.style.color = '#ff4444';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.cancelTrade();
    header.appendChild(closeBtn);
    
    // Trade content
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.gap = '20px';
    
    // Your offer section
    const yourSection = document.createElement('div');
    yourSection.style.flex = '1';
    
    const yourTitle = document.createElement('h3');
    yourTitle.style.color = '#4ecdc4';
    yourTitle.style.fontSize = '18px';
    yourTitle.style.marginBottom = '10px';
    yourTitle.style.textAlign = 'center';
    yourTitle.textContent = 'YOUR OFFER';
    
    this.yourSlots = document.createElement('div');
    this.yourSlots.style.display = 'grid';
    this.yourSlots.style.gridTemplateColumns = 'repeat(3, 80px)';
    this.yourSlots.style.gap = '10px';
    this.yourSlots.style.marginBottom = '15px';
    this.yourSlots.style.minHeight = '180px';
    
    // Create 6 trade slots for your side
    for (let i = 0; i < 6; i++) {
      const slot = this.createTradeSlot('yours', i);
      this.yourSlots.appendChild(slot);
    }
    
    // Your gold input
    const yourGoldDiv = document.createElement('div');
    yourGoldDiv.style.display = 'flex';
    yourGoldDiv.style.alignItems = 'center';
    yourGoldDiv.style.justifyContent = 'center';
    yourGoldDiv.style.gap = '10px';
    yourGoldDiv.style.marginBottom = '15px';
    
    const yourGoldLabel = document.createElement('span');
    yourGoldLabel.style.color = '#ffd700';
    yourGoldLabel.style.fontSize = '16px';
    yourGoldLabel.textContent = '💰 Gold:';
    
    this.yourGoldInput = document.createElement('input');
    this.yourGoldInput.type = 'number';
    this.yourGoldInput.min = '0';
    this.yourGoldInput.value = '0';
    this.yourGoldInput.style.width = '100px';
    this.yourGoldInput.style.padding = '8px';
    this.yourGoldInput.style.background = 'rgba(255,255,255,0.1)';
    this.yourGoldInput.style.border = '2px solid #ffd700';
    this.yourGoldInput.style.borderRadius = '8px';
    this.yourGoldInput.style.color = '#ffffff';
    this.yourGoldInput.style.fontSize = '16px';
    this.yourGoldInput.style.textAlign = 'center';
    this.yourGoldInput.onchange = () => this.updateMyGold();
    
    yourGoldDiv.appendChild(yourGoldLabel);
    yourGoldDiv.appendChild(this.yourGoldInput);
    
    yourSection.appendChild(yourTitle);
    yourSection.appendChild(this.yourSlots);
    yourSection.appendChild(yourGoldDiv);
    
    // Their offer section
    const theirSection = document.createElement('div');
    theirSection.style.flex = '1';
    
    const theirTitle = document.createElement('h3');
    theirTitle.style.color = '#ff6b6b';
    theirTitle.style.fontSize = '18px';
    theirTitle.style.marginBottom = '10px';
    theirTitle.style.textAlign = 'center';
    theirTitle.textContent = 'THEIR OFFER';
    
    this.theirSlots = document.createElement('div');
    this.theirSlots.style.display = 'grid';
    this.theirSlots.style.gridTemplateColumns = 'repeat(3, 80px)';
    this.theirSlots.style.gap = '10px';
    this.theirSlots.style.marginBottom = '15px';
    this.theirSlots.style.minHeight = '180px';
    
    // Create 6 trade slots for their side
    for (let i = 0; i < 6; i++) {
      const slot = this.createTradeSlot('theirs', i);
      this.theirSlots.appendChild(slot);
    }
    
    // Their gold display
    const theirGoldDiv = document.createElement('div');
    theirGoldDiv.style.display = 'flex';
    theirGoldDiv.style.alignItems = 'center';
    theirGoldDiv.style.justifyContent = 'center';
    theirGoldDiv.style.gap = '10px';
    theirGoldDiv.style.marginBottom = '15px';
    
    const theirGoldLabel = document.createElement('span');
    theirGoldLabel.style.color = '#ffd700';
    theirGoldLabel.style.fontSize = '16px';
    theirGoldLabel.textContent = '💰 Gold:';
    
    this.theirGoldDisplay = document.createElement('span');
    this.theirGoldDisplay.style.color = '#ffffff';
    this.theirGoldDisplay.style.fontSize = '16px';
    this.theirGoldDisplay.style.fontWeight = 'bold';
    this.theirGoldDisplay.textContent = '0';
    
    theirGoldDiv.appendChild(theirGoldLabel);
    theirGoldDiv.appendChild(this.theirGoldDisplay);
    
    theirSection.appendChild(theirTitle);
    theirSection.appendChild(this.theirSlots);
    theirSection.appendChild(theirGoldDiv);
    
    content.appendChild(yourSection);
    content.appendChild(theirSection);
    
    // Status and buttons
    const footer = document.createElement('div');
    footer.style.marginTop = '20px';
    footer.style.borderTop = '2px solid rgba(255,224,102,0.3)';
    footer.style.paddingTop = '15px';
    
    this.statusText = document.createElement('div');
    this.statusText.style.textAlign = 'center';
    this.statusText.style.color = '#ffffff';
    this.statusText.style.fontSize = '14px';
    this.statusText.style.marginBottom = '10px';
    this.statusText.textContent = 'Waiting for both players to lock in...';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'center';
    
    this.lockButton = document.createElement('button');
    this.lockButton.textContent = '🔒 Lock In';
    this.lockButton.style.padding = '10px 20px';
    this.lockButton.style.background = 'linear-gradient(45deg, #4ecdc4, #44a3aa)';
    this.lockButton.style.border = 'none';
    this.lockButton.style.borderRadius = '8px';
    this.lockButton.style.color = '#ffffff';
    this.lockButton.style.fontSize = '16px';
    this.lockButton.style.fontWeight = 'bold';
    this.lockButton.style.cursor = 'pointer';
    this.lockButton.style.transition = 'all 0.3s';
    this.lockButton.onclick = () => this.toggleLock();
    
    this.confirmButton = document.createElement('button');
    this.confirmButton.textContent = '✓ Confirm Trade';
    this.confirmButton.style.padding = '10px 20px';
    this.confirmButton.style.background = 'linear-gradient(45deg, #95e1d3, #75c9bb)';
    this.confirmButton.style.border = 'none';
    this.confirmButton.style.borderRadius = '8px';
    this.confirmButton.style.color = '#ffffff';
    this.confirmButton.style.fontSize = '16px';
    this.confirmButton.style.fontWeight = 'bold';
    this.confirmButton.style.cursor = 'pointer';
    this.confirmButton.style.transition = 'all 0.3s';
    this.confirmButton.style.display = 'none';
    this.confirmButton.onclick = () => this.confirmTrade();
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '✕ Cancel';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a6f)';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '8px';
    cancelButton.style.color = '#ffffff';
    cancelButton.style.fontSize = '16px';
    cancelButton.style.fontWeight = 'bold';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.transition = 'all 0.3s';
    cancelButton.onclick = () => this.cancelTrade();
    
    buttonContainer.appendChild(this.lockButton);
    buttonContainer.appendChild(this.confirmButton);
    buttonContainer.appendChild(cancelButton);
    
    footer.appendChild(this.statusText);
    footer.appendChild(buttonContainer);
    
    // Assemble window
    this.tradeWindow.appendChild(header);
    this.tradeWindow.appendChild(content);
    this.tradeWindow.appendChild(footer);
    
    document.body.appendChild(this.tradeWindow);
    
    // Trade request popup
    this.createTradeRequestPopup();
  }

  createTradeSlot(side, index) {
    const slot = document.createElement('div');
    slot.className = 'trade-slot';
    slot.dataset.side = side;
    slot.dataset.index = index;
    slot.style.width = '80px';
    slot.style.height = '80px';
    slot.style.background = 'rgba(0,0,0,0.4)';
    slot.style.border = '2px solid rgba(255,224,102,0.3)';
    slot.style.borderRadius = '12px';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.position = 'relative';
    slot.style.cursor = side === 'yours' ? 'pointer' : 'default';
    slot.style.transition = 'all 0.2s';
    
    if (side === 'yours') {
      // Make your slots droppable
      slot.ondragover = (e) => {
        e.preventDefault();
        slot.style.border = '2px solid #ffe066';
        slot.style.background = 'rgba(255,224,102,0.1)';
      };
      
      slot.ondragleave = () => {
        slot.style.border = '2px solid rgba(255,224,102,0.3)';
        slot.style.background = 'rgba(0,0,0,0.4)';
      };
      
      slot.ondrop = (e) => {
        e.preventDefault();
        slot.style.border = '2px solid rgba(255,224,102,0.3)';
        slot.style.background = 'rgba(0,0,0,0.4)';
        
        const itemData = e.dataTransfer.getData('text/plain');
        if (itemData) {
          const item = JSON.parse(itemData);
          this.addItemToTrade(index, item);
        }
      };
      
      // Right-click to remove
      slot.oncontextmenu = (e) => {
        e.preventDefault();
        this.removeItemFromTrade(index);
      };
    }
    
    return slot;
  }

  createTradeRequestPopup() {
    this.requestPopup = document.createElement('div');
    this.requestPopup.style.position = 'absolute';
    this.requestPopup.style.top = '100px';
    this.requestPopup.style.right = '370px';
    this.requestPopup.style.display = 'none';
    this.requestPopup.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    this.requestPopup.style.border = '2px solid #ffe066';
    this.requestPopup.style.borderRadius = '12px';
    this.requestPopup.style.padding = '20px';
    this.requestPopup.style.boxShadow = '0 8px 32px rgba(0,0,0,0.8)';
    this.requestPopup.style.zIndex = '2600';
    this.requestPopup.style.minWidth = '300px';
    this.requestPopup.style.fontFamily = 'Arial, sans-serif';
    
    const title = document.createElement('div');
    title.style.color = '#ffe066';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.textContent = 'Trade Request';
    
    this.requestMessage = document.createElement('div');
    this.requestMessage.style.color = '#ffffff';
    this.requestMessage.style.fontSize = '14px';
    this.requestMessage.style.marginBottom = '15px';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    const acceptButton = document.createElement('button');
    acceptButton.textContent = '✓ Accept';
    acceptButton.style.flex = '1';
    acceptButton.style.padding = '8px 16px';
    acceptButton.style.background = '#4ecdc4';
    acceptButton.style.border = 'none';
    acceptButton.style.borderRadius = '8px';
    acceptButton.style.color = '#ffffff';
    acceptButton.style.cursor = 'pointer';
    acceptButton.onclick = () => this.acceptTradeRequest();
    
    const declineButton = document.createElement('button');
    declineButton.textContent = '✕ Decline';
    declineButton.style.flex = '1';
    declineButton.style.padding = '8px 16px';
    declineButton.style.background = '#ff6b6b';
    declineButton.style.border = 'none';
    declineButton.style.borderRadius = '8px';
    declineButton.style.color = '#ffffff';
    declineButton.style.cursor = 'pointer';
    declineButton.onclick = () => this.declineTradeRequest();
    
    buttonContainer.appendChild(acceptButton);
    buttonContainer.appendChild(declineButton);
    
    this.requestPopup.appendChild(title);
    this.requestPopup.appendChild(this.requestMessage);
    this.requestPopup.appendChild(buttonContainer);
    
    document.body.appendChild(this.requestPopup);
  }

  setupSocketListeners() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    const socket = this.scene.multiplayer.socket;
    
    socket.on('tradeRequest', (data) => {
      this.showTradeRequest(data.from);
    });
    
    socket.on('tradeAccepted', (data) => {
      this.startTrade(data);
    });
    
    socket.on('tradeDeclined', (data) => {
      this.scene.showMessage(`${data.from} declined your trade request`, '#ff6b6b', 2000);
      this.requestPopup.style.display = 'none';
    });
    
    socket.on('tradeUpdate', (data) => {
      this.updateTheirOffer(data);
    });
    
    socket.on('tradeCancelled', () => {
      this.close();
      this.scene.showMessage('Trade cancelled', '#ff6b6b', 1500);
    });
    
    socket.on('tradeCompleted', (data) => {
      this.close();
      this.scene.showMessage('Trade completed successfully!', '#4ecdc4', 2000);
      // Update inventory and gold
      if (this.scene.inventoryUI) {
        this.scene.inventoryUI.updateGold(data.newGold);
      }
      if (this.scene.gameUI) {
        this.scene.gameUI.updateGold(data.newGold);
      }
    });
    
    socket.on('tradePartnerConfirmed', (data) => {
      this.statusText.textContent = `${data.partner} has confirmed the trade! Waiting for both confirmations...`;
      this.statusText.style.color = '#ffd700';
    });
    
    socket.on('tradeWaitingConfirmation', () => {
      this.statusText.textContent = 'Waiting for your partner to confirm...';
      this.statusText.style.color = '#ffd700';
    });
  }

  sendTradeRequest(username) {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    this.scene.multiplayer.socket.emit('tradeRequest', { to: username });
    this.scene.showMessage(`Trade request sent to ${username}`, '#4ecdc4', 1500);
  }

  showTradeRequest(from) {
    this.pendingTradeFrom = from;
    this.requestMessage.textContent = `${from} wants to trade with you`;
    this.requestPopup.style.display = 'block';
    
    // Auto-decline after 30 seconds
    setTimeout(() => {
      if (this.requestPopup.style.display !== 'none') {
        this.declineTradeRequest();
      }
    }, 30000);
  }

  acceptTradeRequest() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    this.scene.multiplayer.socket.emit('tradeResponse', { 
      to: this.pendingTradeFrom, 
      accepted: true 
    });
    this.requestPopup.style.display = 'none';
  }

  declineTradeRequest() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    this.scene.multiplayer.socket.emit('tradeResponse', { 
      to: this.pendingTradeFrom, 
      accepted: false 
    });
    this.requestPopup.style.display = 'none';
    this.pendingTradeFrom = null;
  }

  startTrade(data) {
    this.tradeId = data.tradeId;
    this.tradePartner = data.partner;
    this.partnerName.textContent = `Trading with: ${this.tradePartner}`;
    this.open();
  }

  open() {
    this.isOpen = true;
    this.tradeWindow.style.display = 'block';
    this.resetTrade();
    
    // Force inventory to open and disable E key closing
    if (this.scene.inventoryUI) {
      this.scene.inventoryUI.show();
      this.scene.inventoryUI.setTradeMode(true);
    }
    
    // Track both players' confirmation states
    this.myConfirmed = false;
    this.theirConfirmed = false;
  }

  close() {
    this.isOpen = false;
    this.tradeWindow.style.display = 'none';
    this.resetTrade();
    
    // Re-enable normal inventory behavior
    if (this.scene.inventoryUI) {
      this.scene.inventoryUI.setTradeMode(false);
      this.scene.inventoryUI.hide();
    }
  }

  resetTrade() {
    this.myOffer = { items: [], gold: 0, locked: false };
    this.theirOffer = { items: [], gold: 0, locked: false };
    this.yourGoldInput.value = '0';
    this.theirGoldDisplay.textContent = '0';
    this.updateUI();
  }

  addItemToTrade(slotIndex, item) {
    if (this.myOffer.locked) {
      this.scene.showMessage('Cannot modify locked trade', '#ff6b6b', 1000);
      return;
    }
    
    // Check if slot is already occupied
    if (this.myOffer.items[slotIndex]) {
      return;
    }
    
    this.myOffer.items[slotIndex] = item;
    this.updateUI();
    this.sendTradeUpdate();
  }

  removeItemFromTrade(slotIndex) {
    if (this.myOffer.locked) {
      this.scene.showMessage('Cannot modify locked trade', '#ff6b6b', 1000);
      return;
    }
    
    this.myOffer.items[slotIndex] = null;
    this.updateUI();
    this.sendTradeUpdate();
  }

  updateMyGold() {
    if (this.myOffer.locked) {
      this.yourGoldInput.value = this.myOffer.gold;
      this.scene.showMessage('Cannot modify locked trade', '#ff6b6b', 1000);
      return;
    }
    
    const gold = parseInt(this.yourGoldInput.value) || 0;
    const maxGold = this.scene.playerGold || 0;
    
    if (gold > maxGold) {
      this.yourGoldInput.value = maxGold;
      this.myOffer.gold = maxGold;
    } else {
      this.myOffer.gold = gold;
    }
    
    this.sendTradeUpdate();
  }

  sendTradeUpdate() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    this.scene.multiplayer.socket.emit('tradeUpdate', {
      tradeId: this.tradeId,
      offer: this.myOffer
    });
  }

  updateTheirOffer(data) {
    this.theirOffer = data.offer;
    
    // Update their gold display
    this.theirGoldDisplay.textContent = this.theirOffer.gold || 0;
    
    // Update UI
    this.updateUI();
  }

  updateUI() {
    // Update your slots
    const yourSlots = this.yourSlots.children;
    for (let i = 0; i < yourSlots.length; i++) {
      const slot = yourSlots[i];
      const item = this.myOffer.items[i];
      
      slot.innerHTML = '';
      if (item) {
        const img = document.createElement('img');
        img.src = `/assets/items/${item.itemId}.png`;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'contain';
        slot.appendChild(img);
      }
      
      // Update slot style based on lock status
      if (this.myOffer.locked) {
        slot.style.background = 'rgba(76,237,108,0.1)';
        slot.style.border = '2px solid #4ced6c';
      } else {
        slot.style.background = 'rgba(0,0,0,0.4)';
        slot.style.border = '2px solid rgba(255,224,102,0.3)';
      }
    }
    
    // Update their slots
    const theirSlots = this.theirSlots.children;
    for (let i = 0; i < theirSlots.length; i++) {
      const slot = theirSlots[i];
      const item = this.theirOffer.items[i];
      
      slot.innerHTML = '';
      if (item) {
        const img = document.createElement('img');
        img.src = `/assets/items/${item.itemId}.png`;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'contain';
        slot.appendChild(img);
      }
      
      // Update slot style based on lock status
      if (this.theirOffer.locked) {
        slot.style.background = 'rgba(76,237,108,0.1)';
        slot.style.border = '2px solid #4ced6c';
      } else {
        slot.style.background = 'rgba(0,0,0,0.4)';
        slot.style.border = '2px solid rgba(255,224,102,0.3)';
      }
    }
    
    // Update lock button
    if (this.myOffer.locked) {
      this.lockButton.textContent = '🔓 Unlock';
      this.lockButton.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a6f)';
    } else {
      this.lockButton.textContent = '🔒 Lock In';
      this.lockButton.style.background = 'linear-gradient(45deg, #4ecdc4, #44a3aa)';
    }
    
    // Update status and confirm button
    if (this.myOffer.locked && this.theirOffer.locked) {
      this.statusText.textContent = 'Both players locked! Ready to confirm trade.';
      this.statusText.style.color = '#4ced6c';
      this.confirmButton.style.display = 'block';
    } else if (this.myOffer.locked) {
      this.statusText.textContent = 'Waiting for partner to lock in...';
      this.statusText.style.color = '#ffd700';
      this.confirmButton.style.display = 'none';
    } else if (this.theirOffer.locked) {
      this.statusText.textContent = 'Partner is ready! Lock in your offer.';
      this.statusText.style.color = '#ffd700';
      this.confirmButton.style.display = 'none';
    } else {
      this.statusText.textContent = 'Waiting for both players to lock in...';
      this.statusText.style.color = '#ffffff';
      this.confirmButton.style.display = 'none';
    }
  }

  toggleLock() {
    this.myOffer.locked = !this.myOffer.locked;
    
    if (this.myOffer.locked) {
      this.yourGoldInput.disabled = true;
    } else {
      this.yourGoldInput.disabled = false;
      // Reset their lock if we unlock
      if (this.theirOffer.locked) {
        this.scene.showMessage('Partner needs to re-lock their offer', '#ffd700', 2000);
      }
    }
    
    this.updateUI();
    this.sendTradeUpdate();
  }

  confirmTrade() {
    if (!this.myOffer.locked || !this.theirOffer.locked) {
      this.scene.showMessage('Both players must lock in first', '#ff6b6b', 1500);
      return;
    }
    
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    // Mark as confirmed locally
    this.myConfirmed = true;
    
    this.scene.multiplayer.socket.emit('confirmTrade', {
      tradeId: this.tradeId
    });
    
    this.confirmButton.disabled = true;
    this.confirmButton.textContent = '✓ Waiting for partner...';
    this.confirmButton.style.background = 'linear-gradient(45deg, #27ae60, #2ecc71)';
  }

  cancelTrade() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    this.scene.multiplayer.socket.emit('cancelTrade', {
      tradeId: this.tradeId
    });
    
    this.close();
  }

  destroy() {
    if (this.tradeWindow) {
      this.tradeWindow.remove();
    }
    if (this.requestPopup) {
      this.requestPopup.remove();
    }
  }
}