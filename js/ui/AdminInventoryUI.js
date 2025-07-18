// AdminInventoryUI.js
// Admin interface for managing other players' inventories

export class AdminInventoryUI {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.targetUsername = null;
    this.targetInventory = [];
    this.targetGold = 0;
    this.createUI();
    this.setupSocketListeners();
  }

  createUI() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'admin-inventory-ui';
    this.container.style.position = 'absolute';
    this.container.style.left = '50%';
    this.container.style.top = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.display = 'none';
    this.container.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    this.container.style.border = '3px solid #ff6b6b';
    this.container.style.borderRadius = '20px';
    this.container.style.padding = '20px';
    this.container.style.boxShadow = '0 12px 48px rgba(0,0,0,0.8)';
    this.container.style.zIndex = '3000';
    this.container.style.minWidth = '600px';
    this.container.style.maxHeight = '80vh';
    this.container.style.fontFamily = 'Arial, sans-serif';
    
    // Header
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '20px';
    header.style.position = 'relative';
    
    const title = document.createElement('h2');
    title.style.color = '#ff6b6b';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    title.innerHTML = '🛡️ ADMIN: Manage Inventory';
    
    this.usernameDisplay = document.createElement('div');
    this.usernameDisplay.style.color = '#ffffff';
    this.usernameDisplay.style.fontSize = '18px';
    this.usernameDisplay.style.marginTop = '5px';
    
    header.appendChild(title);
    header.appendChild(this.usernameDisplay);
    
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
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    
    // Gold section
    const goldSection = document.createElement('div');
    goldSection.style.marginBottom = '20px';
    goldSection.style.padding = '15px';
    goldSection.style.background = 'rgba(0,0,0,0.3)';
    goldSection.style.borderRadius = '10px';
    goldSection.style.border = '2px solid #ffd700';
    
    const goldLabel = document.createElement('label');
    goldLabel.style.color = '#ffd700';
    goldLabel.style.fontSize = '18px';
    goldLabel.style.marginRight = '10px';
    goldLabel.textContent = '💰 Gold:';
    
    this.goldInput = document.createElement('input');
    this.goldInput.type = 'number';
    this.goldInput.min = '0';
    this.goldInput.style.width = '150px';
    this.goldInput.style.padding = '8px';
    this.goldInput.style.background = 'rgba(255,255,255,0.1)';
    this.goldInput.style.border = '2px solid #ffd700';
    this.goldInput.style.borderRadius = '8px';
    this.goldInput.style.color = '#ffffff';
    this.goldInput.style.fontSize = '16px';
    this.goldInput.style.textAlign = 'center';
    
    goldSection.appendChild(goldLabel);
    goldSection.appendChild(this.goldInput);
    
    // Inventory grid
    const inventorySection = document.createElement('div');
    inventorySection.style.marginBottom = '20px';
    
    const inventoryLabel = document.createElement('div');
    inventoryLabel.style.color = '#4ecdc4';
    inventoryLabel.style.fontSize = '18px';
    inventoryLabel.style.marginBottom = '10px';
    inventoryLabel.textContent = '📦 Inventory (drag to reorder, right-click to delete):';
    
    this.inventoryGrid = document.createElement('div');
    this.inventoryGrid.style.display = 'grid';
    this.inventoryGrid.style.gridTemplateColumns = 'repeat(8, 70px)';
    this.inventoryGrid.style.gap = '10px';
    this.inventoryGrid.style.padding = '15px';
    this.inventoryGrid.style.background = 'rgba(0,0,0,0.3)';
    this.inventoryGrid.style.borderRadius = '10px';
    this.inventoryGrid.style.border = '2px solid #666';
    this.inventoryGrid.style.maxHeight = '300px';
    this.inventoryGrid.style.overflowY = 'auto';
    
    inventorySection.appendChild(inventoryLabel);
    inventorySection.appendChild(this.inventoryGrid);
    
    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.marginTop = '20px';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = '💾 Save Changes';
    saveButton.style.padding = '12px 24px';
    saveButton.style.background = 'linear-gradient(45deg, #4ecdc4, #44a3aa)';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '8px';
    saveButton.style.color = '#ffffff';
    saveButton.style.fontSize = '16px';
    saveButton.style.fontWeight = 'bold';
    saveButton.style.cursor = 'pointer';
    saveButton.style.transition = 'all 0.3s';
    saveButton.onclick = () => this.saveChanges();
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '✕ Cancel';
    cancelButton.style.padding = '12px 24px';
    cancelButton.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a6f)';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '8px';
    cancelButton.style.color = '#ffffff';
    cancelButton.style.fontSize = '16px';
    cancelButton.style.fontWeight = 'bold';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.transition = 'all 0.3s';
    cancelButton.onclick = () => this.close();
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    
    // Assemble container
    this.container.appendChild(header);
    this.container.appendChild(goldSection);
    this.container.appendChild(inventorySection);
    this.container.appendChild(buttonContainer);
    
    document.body.appendChild(this.container);
  }

  setupSocketListeners() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    const socket = this.scene.multiplayer.socket;
    
    socket.on('playerInventoryData', (data) => {
      this.openWithData(data);
    });
  }

  openWithData(data) {
    this.targetUsername = data.username;
    this.targetInventory = [...(data.inventory || [])]; // Clone the inventory
    this.targetGold = data.gold || 0;
    
    // Update displays
    this.usernameDisplay.textContent = `Managing: ${this.targetUsername}`;
    this.goldInput.value = this.targetGold;
    
    // Clear and populate inventory grid
    this.inventoryGrid.innerHTML = '';
    
    // Create 32 slots (4 rows of 8)
    for (let i = 0; i < 32; i++) {
      const slot = this.createInventorySlot(i);
      this.inventoryGrid.appendChild(slot);
    }
    
    // Populate with items
    this.updateInventoryDisplay();
    
    // Show the UI
    this.isOpen = true;
    this.container.style.display = 'block';
  }

  createInventorySlot(index) {
    const slot = document.createElement('div');
    slot.className = 'admin-inventory-slot';
    slot.dataset.index = index;
    slot.style.width = '70px';
    slot.style.height = '70px';
    slot.style.background = 'rgba(0,0,0,0.5)';
    slot.style.border = '2px solid #333';
    slot.style.borderRadius = '8px';
    slot.style.position = 'relative';
    slot.style.cursor = 'grab';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    
    // Make slots droppable
    slot.ondragover = (e) => {
      e.preventDefault();
      slot.style.border = '2px solid #4ecdc4';
    };
    
    slot.ondragleave = () => {
      slot.style.border = '2px solid #333';
    };
    
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.style.border = '2px solid #333';
      
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = index;
      
      if (fromIndex !== toIndex) {
        // Swap items
        const temp = this.targetInventory[fromIndex];
        this.targetInventory[fromIndex] = this.targetInventory[toIndex];
        this.targetInventory[toIndex] = temp;
        this.updateInventoryDisplay();
      }
    };
    
    // Right-click to delete
    slot.oncontextmenu = (e) => {
      e.preventDefault();
      if (this.targetInventory[index]) {
        if (confirm(`Delete ${this.targetInventory[index].itemId}?`)) {
          this.targetInventory[index] = null;
          this.updateInventoryDisplay();
        }
      }
    };
    
    return slot;
  }

  updateInventoryDisplay() {
    const slots = this.inventoryGrid.children;
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const item = this.targetInventory[i];
      
      // Clear slot
      slot.innerHTML = '';
      slot.draggable = false;
      
      if (item && item.itemId) {
        // Add item icon
        const icon = document.createElement('img');
        const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
        const blockTypes = ['wall', 'door', 'tunnel', 'castle_tower', 'wood', 'gold', 'brick', 'roof'];
        
        if (weaponTypes.includes(item.itemId)) {
          icon.src = `/assets/weapons/${item.itemId}.png`;
        } else if (blockTypes.includes(item.itemId)) {
          icon.src = `/assets/blocks/${item.itemId}.png`;
        } else {
          icon.src = `/assets/items/${item.itemId}.svg`;
        }
        
        icon.style.width = '50px';
        icon.style.height = '50px';
        icon.style.imageRendering = 'pixelated';
        icon.onerror = () => { icon.src = '/assets/item_placeholder.svg'; };
        
        slot.appendChild(icon);
        
        // Add quantity badge
        if (item.quantity && item.quantity > 1) {
          const quantity = document.createElement('div');
          quantity.style.position = 'absolute';
          quantity.style.bottom = '2px';
          quantity.style.right = '2px';
          quantity.style.background = 'rgba(0,0,0,0.8)';
          quantity.style.color = '#fff';
          quantity.style.fontSize = '12px';
          quantity.style.padding = '2px 5px';
          quantity.style.borderRadius = '4px';
          quantity.textContent = item.quantity;
          slot.appendChild(quantity);
        }
        
        // Make draggable
        slot.draggable = true;
        slot.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', i);
          slot.style.opacity = '0.5';
        };
        
        slot.ondragend = () => {
          slot.style.opacity = '1';
        };
      }
    }
  }

  saveChanges() {
    if (!this.scene.multiplayer || !this.scene.multiplayer.socket) return;
    
    // Filter out null items
    const cleanInventory = this.targetInventory.filter(item => item !== null);
    
    const newGold = parseInt(this.goldInput.value) || 0;
    
    // Send update to server
    this.scene.multiplayer.socket.emit('adminUpdateInventory', {
      username: this.targetUsername,
      inventory: cleanInventory,
      gold: newGold
    });
    
    this.scene.showMessage('Saving inventory changes...', '#4ecdc4', 1500);
    this.close();
  }

  close() {
    this.isOpen = false;
    this.container.style.display = 'none';
    this.targetUsername = null;
    this.targetInventory = [];
    this.targetGold = 0;
  }

  destroy() {
    if (this.container) {
      this.container.remove();
    }
  }
} 