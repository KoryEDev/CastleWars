// InventoryUI.js
// Drag-and-drop inventory overlay for Castle Wars

export class InventoryUI {
  constructor(scene, onUpdate) {
    this.scene = scene;
    this.onUpdate = onUpdate; // Callback when inventory changes
    this.isOpen = false;
    this.inventory = [];
    this.slotCount = 20;
    this.columns = 5;
    this.rows = 4;
    this.slotSize = 72;
    this.overlay = null;
    this.slots = [];
    this.dragged = null;
    this.draggedIndex = null;
    this.hotbarSlots = 5;
    this.selectedHotbarSlot = 0;
    this.hoveredSlotIndex = null; // Track which slot is currently hovered
    this._timeouts = []; // Track timeouts for cleanup
    this.createOverlay();
    this.createHotbar();
    this.setupHotkey();
  }

  createOverlay() {
    // Create overlay div
    this.overlay = document.createElement('div');
    this.overlay.style.position = 'absolute';
    this.overlay.style.left = '50%';
    this.overlay.style.top = '50%';
    this.overlay.style.transform = 'translate(-50%, -50%)';
    this.overlay.style.display = 'none';
    this.overlay.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    this.overlay.style.border = '3px solid #ffe066';
    this.overlay.style.borderRadius = '20px';
    this.overlay.style.padding = '40px';
    this.overlay.style.boxShadow = '0 12px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)';
    this.overlay.style.zIndex = '2000';
    this.overlay.style.userSelect = 'none';
    this.overlay.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'translate(-50%, -50%) scale(0.9)';
    this.overlay.style.pointerEvents = 'auto';

    // Title (draggable)
    const title = document.createElement('div');
    title.textContent = 'INVENTORY';
    title.style.color = '#ffe066';
    title.style.fontSize = '36px';
    title.style.fontFamily = 'Arial Black, sans-serif';
    title.style.textAlign = 'center';
    title.style.marginBottom = '24px';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    title.style.letterSpacing = '2px';
    title.style.cursor = 'move';
    title.style.userSelect = 'none';
    this.overlay.appendChild(title);
    
    // Gold display
    this.goldDisplay = document.createElement('div');
    this.goldDisplay.style.color = '#ffd700';
    this.goldDisplay.style.fontSize = '24px';
    this.goldDisplay.style.fontFamily = 'Arial Black, sans-serif';
    this.goldDisplay.style.textAlign = 'center';
    this.goldDisplay.style.marginBottom = '16px';
    this.goldDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    this.goldDisplay.style.display = 'flex';
    this.goldDisplay.style.alignItems = 'center';
    this.goldDisplay.style.justifyContent = 'center';
    this.goldDisplay.style.gap = '8px';
    this.goldDisplay.innerHTML = '<span style="color: #ffd700;">💰</span> <span id="goldAmount">0</span> Gold';
    this.overlay.appendChild(this.goldDisplay);
    
    // Make inventory draggable
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    title.onmousedown = (e) => {
      isDragging = true;
      const rect = this.overlay.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    };
    
    document.onmousemove = (e) => {
      if (!isDragging) return;
      const x = e.clientX - dragOffsetX;
      const y = e.clientY - dragOffsetY;
      this.overlay.style.left = x + 'px';
      this.overlay.style.top = y + 'px';
      this.overlay.style.transform = 'none';
    };
    
    document.onmouseup = () => {
      if (isDragging) {
        isDragging = false;
        // Save position
        const rect = this.overlay.getBoundingClientRect();
        localStorage.setItem('inventoryPosition', JSON.stringify({
          x: rect.left,
          y: rect.top
        }));
      }
    };
    
    // Instructions
    const instructions = document.createElement('div');
    instructions.innerHTML = 'Right-click items to use • Press X to delete weapons • Press E to close • First 5 slots are hotbar (1-5 keys)';
    instructions.style.color = '#aaaaaa';
    instructions.style.fontSize = '14px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.textAlign = 'center';
    instructions.style.marginBottom = '16px';
    instructions.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    this.overlay.appendChild(instructions);

    // Grid container
    const gridContainer = document.createElement('div');
    gridContainer.style.background = 'rgba(0,0,0,0.3)';
    gridContainer.style.borderRadius = '12px';
    gridContainer.style.padding = '16px';
    gridContainer.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.5)';
    this.overlay.appendChild(gridContainer);

    // Grid
    this.grid = document.createElement('div');
    this.grid.style.display = 'grid';
    this.grid.style.gridTemplateColumns = `repeat(${this.columns}, ${this.slotSize}px)`;
    this.grid.style.gridTemplateRows = `repeat(${this.rows}, ${this.slotSize}px)`;
    this.grid.style.gap = '8px';
    gridContainer.appendChild(this.grid);

    // Create slots
    this.slots = [];
    for (let i = 0; i < this.slotCount; i++) {
      const slot = this.createSlot(i);
      this.grid.appendChild(slot);
      this.slots.push(slot);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.style.background = 'rgba(255,0,0,0.2)';
    closeBtn.style.border = '2px solid #ff4444';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '36px';
    closeBtn.style.height = '36px';
    closeBtn.style.color = '#ff4444';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.onmouseover = () => {
      closeBtn.style.background = 'rgba(255,0,0,0.4)';
      closeBtn.style.transform = 'scale(1.1)';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.background = 'rgba(255,0,0,0.2)';
      closeBtn.style.transform = 'scale(1)';
    };
    closeBtn.onclick = () => this.close();
    this.overlay.appendChild(closeBtn);

    document.body.appendChild(this.overlay);
  }

  createPermanentInventory() {
    // Permanent inventory disabled - using hotbar instead
    return;
  }

  createPermanentSlot(index) {
    // Permanent inventory slot creation disabled - using hotbar instead
    return document.createElement('div');
  }

  createSlot(index) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.style.width = `${this.slotSize}px`;
    slot.style.height = `${this.slotSize}px`;
    
    // Highlight hotbar slots (first row)
    if (index < this.hotbarSlots) {
      slot.style.background = 'linear-gradient(135deg, #3a3a54 0%, #2a2a44 100%)';
      slot.style.border = '2px solid #666688';
      slot.style.boxShadow = 'inset 0 0 10px rgba(255,224,102,0.1)';
    } else {
      slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
      slot.style.border = '2px solid #444466';
    }
    slot.style.borderRadius = '12px';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    slot.style.transition = 'all 0.2s';
    slot.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
    
    // Store original hover handlers
    const originalMouseOver = () => {
      if (!this.dragged) {
        slot.style.border = '2px solid #ffe066';
        slot.style.transform = 'scale(1.05)';
        slot.style.boxShadow = '0 4px 12px rgba(255,224,102,0.3), inset 0 2px 4px rgba(0,0,0,0.3)';
      }
    };
    
    const originalMouseOut = () => {
      if (index < this.hotbarSlots) {
        slot.style.border = '2px solid #666688';
      } else {
        slot.style.border = '2px solid #444466';
      }
      slot.style.transform = 'scale(1)';
      slot.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
    };
    
    slot.onmouseover = originalMouseOver;
    slot.onmouseout = originalMouseOut;
    
    slot.ondragover = e => e.preventDefault();
    slot.ondrop = e => this.handleDrop(e, index);
    slot.ondragenter = () => {
      slot.style.background = 'linear-gradient(135deg, #3a3a55 0%, #2a2a44 100%)';
      slot.style.border = '2px solid #ffe066';
    };
    slot.ondragleave = () => {
      if (index < this.hotbarSlots) {
        slot.style.background = 'linear-gradient(135deg, #3a3a54 0%, #2a2a44 100%)';
        slot.style.border = '2px solid #666688';
      } else {
        slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
        slot.style.border = '2px solid #444466';
      }
    };
    
    // Right-click to use item
    slot.oncontextmenu = (e) => {
      e.preventDefault();
      this.useItem(index);
    };
    
    return slot;
  }

  createHotbar() {
    // Find the hotbar container in the UI panel
    const hotbarContainer = document.getElementById('ui-hotbar-container');
    if (!hotbarContainer) {
      console.error('Hotbar container not found in UI panel - retrying...');
      // Retry after a short delay
      this._timeouts.push(setTimeout(() => this.createHotbar(), 100));
      return;
    }
    
    this.hotbar = hotbarContainer;
    this.hotbarSlotElements = [];
    
    // Clear any existing slots
    hotbarContainer.innerHTML = '';
    
    for (let i = 0; i < this.hotbarSlots; i++) {
      const slot = this.createHotbarSlot(i);
      this.hotbar.appendChild(slot);
      this.hotbarSlotElements.push(slot);
    }
  }

  createHotbarSlot(index) {
    const slot = document.createElement('div');
    slot.style.width = '48px';
    slot.style.height = '48px';
    slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
    slot.style.border = '2px solid #444466';
    slot.style.borderRadius = '8px';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    slot.style.transition = 'all 0.2s';
    
    // Make slot droppable
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
      this.handleHotbarDrop(e, index);
      slot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
      slot.style.border = '2px solid #444466';
    };
    
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
    
    slot.onclick = () => this.selectHotbarSlot(index);
    
    return slot;
  }

  selectHotbarSlot(index) {
    this.selectedHotbarSlot = index;
    this.updateHotbar();
  }

  updateHotbar() {
    for (let i = 0; i < this.hotbarSlots; i++) {
      const slot = this.hotbarSlotElements[i];
      if (i === this.selectedHotbarSlot) {
        slot.style.border = '2px solid #ffe066';
        slot.style.boxShadow = '0 0 12px rgba(255,224,102,0.5)';
      } else {
        slot.style.border = '2px solid #444466';
        slot.style.boxShadow = 'none';
      }
      
      // Update slot content
      slot.innerHTML = '';
      
      // Re-add key indicator
      const keyIndicator = document.createElement('div');
      keyIndicator.textContent = (i + 1).toString();
      keyIndicator.style.position = 'absolute';
      keyIndicator.style.top = '2px';
      keyIndicator.style.left = '4px';
      keyIndicator.style.color = '#ffe066';
      keyIndicator.style.fontSize = '12px';
      keyIndicator.style.fontWeight = 'bold';
      keyIndicator.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
      slot.appendChild(keyIndicator);
      
      // Add item if exists
      const item = this.inventory[i];
      if (item && item.itemId) {
        const icon = document.createElement('img');
        // Check if it's a weapon or an item
        const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
        if (weaponTypes.includes(item.itemId)) {
          icon.src = `/assets/weapons/${item.itemId}.png`;
        } else {
          icon.src = `/assets/items/${item.itemId}.svg`;
        }
        icon.style.width = '32px';
        icon.style.height = '32px';
        icon.style.cursor = 'grab';
        icon.draggable = true;
        
        // Store the hotbar index for drag operations
        const hotbarIndex = i;
        icon.ondragstart = (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('hotbarIndex', hotbarIndex.toString());
          this.dragged = this.inventory[hotbarIndex];
          this.draggedIndex = hotbarIndex;
          icon.style.cursor = 'grabbing';
          this._timeouts.push(setTimeout(() => {
            icon.style.opacity = '0.5';
          }, 0));
        };
        
        icon.ondragend = () => {
          icon.style.cursor = 'grab';
          icon.style.opacity = '1';
        };
        
        icon.onerror = () => { icon.src = '/assets/item_placeholder.svg'; };
        slot.appendChild(icon);
        
        if (item.quantity > 1) {
          const qty = document.createElement('div');
          qty.textContent = item.quantity;
          qty.style.position = 'absolute';
          qty.style.bottom = '2px';
          qty.style.right = '4px';
          qty.style.color = '#ffe066';
          qty.style.fontWeight = 'bold';
          qty.style.fontSize = '12px';
          qty.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
          qty.style.pointerEvents = 'none'; // Don't interfere with drag
          slot.appendChild(qty);
        }
      }
    }
  }

  setupHotkey() {
    this._keydownHandler = (e) => {
      if (e.key === 'e' || e.key === 'E') {
        // Don't open inventory if chat is open or if typing in any input field
        if (this.scene && this.scene.commandPromptOpen) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
      
      // Number key selection (1-5) - only when not in build mode
      if (e.key >= '1' && e.key <= '5') {
        if (this.scene && this.scene.buildMode) return; // Don't switch weapons in build mode
        const slotIndex = parseInt(e.key) - 1;
        if (slotIndex < this.hotbarSlots) {
          this.selectHotbarSlot(slotIndex);
          this.useItem(slotIndex);
        }
      }
      
      // X key to delete hovered weapon
      if ((e.key === 'x' || e.key === 'X') && this.isOpen && this.hoveredSlotIndex !== null) {
        console.log(`X key pressed, deleting item at index ${this.hoveredSlotIndex}`);
        const item = this.inventory[this.hoveredSlotIndex];
        if (item && item.itemId) {
          const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
          if (weaponTypes.includes(item.itemId)) {
            this.deleteItem(this.hoveredSlotIndex);
          }
        }
      }
    };
    window.addEventListener('keydown', this._keydownHandler);
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'block';
    
    // Load saved position if exists
    const savedPos = localStorage.getItem('inventoryPosition');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        this.overlay.style.left = pos.x + 'px';
        this.overlay.style.top = pos.y + 'px';
        this.overlay.style.transform = 'none';
      } catch (e) {
        // Default centered position
        this.overlay.style.left = '50%';
        this.overlay.style.top = '50%';
        this.overlay.style.transform = 'translate(-50%, -50%)';
      }
    }
    
    this._timeouts.push(setTimeout(() => { 
      this.overlay.style.opacity = '1';
      if (!savedPos) {
        this.overlay.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }, 10));
    this.render();
  }

  close() {
    this.isOpen = false;
    this.hoveredSlotIndex = null; // Clear hovered slot when closing
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'translate(-50%, -50%) scale(0.9)';
    this._timeouts.push(setTimeout(() => { this.overlay.style.display = 'none'; }, 300));
  }

  addItem(itemData) {
    // Check if item already exists in inventory
    const existingIndex = this.inventory.findIndex(item => item && item.itemId === itemData.itemId);
    
    if (existingIndex !== -1 && itemData.stackable) {
      // Stack the item
      this.inventory[existingIndex].quantity += itemData.quantity || 1;
    } else {
      // Find empty slot
      let emptyIndex = -1;
      for (let i = 0; i < this.slotCount; i++) {
        if (!this.inventory[i]) {
          emptyIndex = i;
          break;
        }
      }
      
      if (emptyIndex !== -1) {
        this.inventory[emptyIndex] = {
          itemId: itemData.itemId,
          quantity: itemData.quantity || 1,
          stackable: itemData.stackable || false
        };
      } else {
        // Inventory full
        console.log('Inventory full!');
        return false;
      }
    }
    
    this.render();
    this.updateHotbar();
    if (this.onUpdate) this.onUpdate(this.inventory);
    return true;
  }

  setInventory(inventory) {
    this.inventory = Array.isArray(inventory) ? [...inventory] : [];
    // Ensure inventory array has correct length
    while (this.inventory.length < this.slotCount) {
      this.inventory.push(null);
    }
    this.render();
    this.updateHotbar();
  }

  setItemAtIndex(index, item) {
    if (index >= 0 && index < this.slotCount) {
      this.inventory[index] = item;
      this.render();
      this.updateHotbar();
    }
  }

  render() {
    // Render full inventory
    for (let i = 0; i < this.slotCount; i++) {
      const slot = this.slots[i];
      
      // Remove all existing event listeners by cloning the node
      const newSlot = slot.cloneNode(false);
      slot.parentNode.replaceChild(newSlot, slot);
      this.slots[i] = newSlot;
      
      // Reapply all slot properties
      newSlot.innerHTML = '';
      newSlot.className = 'inventory-slot';
      newSlot.style.width = `${this.slotSize}px`;
      newSlot.style.height = `${this.slotSize}px`;
      newSlot.style.borderRadius = '12px';
      newSlot.style.display = 'flex';
      newSlot.style.alignItems = 'center';
      newSlot.style.justifyContent = 'center';
      newSlot.style.position = 'relative';
      newSlot.style.cursor = 'pointer';
      newSlot.style.transition = 'all 0.2s';
      newSlot.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
      
      // Reset background based on slot type
      if (i < this.hotbarSlots) {
        newSlot.style.background = 'linear-gradient(135deg, #3a3a54 0%, #2a2a44 100%)';
        newSlot.style.border = '2px solid #666688';
        newSlot.style.boxShadow = 'inset 0 0 10px rgba(255,224,102,0.1)';
      } else {
        newSlot.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
        newSlot.style.border = '2px solid #444466';
      }
      
      // Re-add the basic slot event handlers with proper closure
      const slotIndex = i;
      newSlot.oncontextmenu = (e) => {
        e.preventDefault();
        this.useItem(slotIndex);
      };
      
      newSlot.ondragover = e => e.preventDefault();
      newSlot.ondrop = e => this.handleDrop(e, slotIndex);
      
      const item = this.inventory[i];
      if (item && item.itemId) {
        // Icon
        const icon = document.createElement('img');
        // Check if it's a weapon or an item
        const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
        if (weaponTypes.includes(item.itemId)) {
          icon.src = `/assets/weapons/${item.itemId}.png`;
        } else {
          icon.src = `/assets/items/${item.itemId}.svg`;
        }
        icon.style.width = '52px';
        icon.style.height = '52px';
        icon.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
        icon.draggable = true;
        icon.ondragstart = e => {
          e.dataTransfer.setData('hotbarIndex', ''); // Clear hotbar index
          this.handleDragStart(e, slotIndex);
        };
        icon.ondragend = e => this.handleDragEnd(e);
        icon.onerror = () => { icon.src = '/assets/item_placeholder.svg'; };
        newSlot.appendChild(icon);
        
        // Track hover for keyboard deletion
        if (weaponTypes.includes(item.itemId)) {
          newSlot.onmouseenter = () => {
            this.hoveredSlotIndex = slotIndex;
          };
          
          newSlot.onmouseleave = () => {
            this.hoveredSlotIndex = null;
          };
        }
        
        // Quantity
        if (item.quantity > 1) {
          const qty = document.createElement('div');
          qty.textContent = item.quantity;
          qty.style.position = 'absolute';
          qty.style.bottom = '4px';
          qty.style.right = '6px';
          qty.style.color = '#ffe066';
          qty.style.fontWeight = 'bold';
          qty.style.fontSize = '16px';
          qty.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
          qty.style.background = 'rgba(0,0,0,0.5)';
          qty.style.padding = '2px 6px';
          qty.style.borderRadius = '4px';
          newSlot.appendChild(qty);
        }
        
        // Tooltip on hover
        newSlot.title = item.itemId.replace(/_/g, ' ').toUpperCase();
      }
    }
    // Permanent inventory rendering disabled - using hotbar instead
    
    this.updateHotbar();
  }

  handleDragStart(e, index) {
    this.dragged = this.inventory[index];
    this.draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    this._timeouts.push(setTimeout(() => {
      this.slots[index].style.opacity = '0.3';
    }, 0));
  }

  handleDragEnd(e) {
    if (this.draggedIndex !== null) {
      this.slots[this.draggedIndex].style.opacity = '1';
    }
    this.dragged = null;
    this.draggedIndex = null;
  }

  handleDrop(e, targetIndex) {
    e.preventDefault();
    
    // Check if we're dragging from hotbar
    const sourceHotbarIndex = e.dataTransfer.getData('hotbarIndex');
    if (sourceHotbarIndex !== '') {
      const sourceIndex = parseInt(sourceHotbarIndex);
      // Dragging from hotbar to main inventory
      const newInventory = [...this.inventory];
      [newInventory[sourceIndex], newInventory[targetIndex]] = [newInventory[targetIndex], newInventory[sourceIndex]];
      
      // Check if we need to update the equipped weapon
      if (this.selectedHotbarSlot === sourceIndex) {
        this.checkAndUpdateEquippedWeapon(newInventory);
      }
      
      this.setInventory(newInventory);
      if (this.onUpdate) this.onUpdate(newInventory);
    } else if (this.dragged && this.draggedIndex !== null) {
      // Normal inventory to inventory drag
      const newInventory = [...this.inventory];
      [newInventory[this.draggedIndex], newInventory[targetIndex]] = [newInventory[targetIndex], newInventory[this.draggedIndex]];
      
      // Check if either slot is in the hotbar and selected
      if ((this.draggedIndex < this.hotbarSlots && this.selectedHotbarSlot === this.draggedIndex) ||
          (targetIndex < this.hotbarSlots && this.selectedHotbarSlot === targetIndex)) {
        this.checkAndUpdateEquippedWeapon(newInventory);
      }
      
      this.setInventory(newInventory);
      if (this.onUpdate) this.onUpdate(newInventory);
    }
  }
  
  handleHotbarDrop(e, targetIndex) {
    e.preventDefault();
    
    // Check if we're dragging from hotbar
    const sourceHotbarIndex = e.dataTransfer.getData('hotbarIndex');
    if (sourceHotbarIndex !== '') {
      const sourceIndex = parseInt(sourceHotbarIndex);
      if (sourceIndex !== targetIndex && sourceIndex < this.hotbarSlots && targetIndex < this.hotbarSlots) {
        // Swap items in the first 5 slots (hotbar area)
        const newInventory = [...this.inventory];
        [newInventory[sourceIndex], newInventory[targetIndex]] = [newInventory[targetIndex], newInventory[sourceIndex]];
        
        // Check if we need to update the equipped weapon
        if (this.selectedHotbarSlot === sourceIndex || this.selectedHotbarSlot === targetIndex) {
          this.checkAndUpdateEquippedWeapon(newInventory);
        }
        
        this.setInventory(newInventory);
        if (this.onUpdate) this.onUpdate(newInventory);
      }
    } else if (this.dragged && this.draggedIndex !== null && this.draggedIndex >= this.hotbarSlots) {
      // Dragging from main inventory to hotbar
      if (targetIndex < this.hotbarSlots) {
        const newInventory = [...this.inventory];
        [newInventory[this.draggedIndex], newInventory[targetIndex]] = [newInventory[targetIndex], newInventory[this.draggedIndex]];
        
        // Check if we need to update the equipped weapon
        if (this.selectedHotbarSlot === targetIndex) {
          this.checkAndUpdateEquippedWeapon(newInventory);
        }
        
        this.setInventory(newInventory);
        if (this.onUpdate) this.onUpdate(newInventory);
      }
    }
    
    // Reset drag state
    this.dragged = null;
    this.draggedIndex = null;
  }

  deleteItem(index) {
    console.log('deleteItem called for index:', index);
    const item = this.inventory[index];
    console.log('Item to delete:', item);
    
    if (!item || !item.itemId) {
      console.log('No item at this index');
      return;
    }
    
    // Check if it's a weapon
    const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
    if (!weaponTypes.includes(item.itemId)) {
      console.log('Not a weapon, cannot delete');
      return;
    }
    
    // Create custom confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.left = '50%';
    confirmDialog.style.top = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.background = 'linear-gradient(135deg, #2a2a44 0%, #1a1a33 100%)';
    confirmDialog.style.border = '3px solid #ffe066';
    confirmDialog.style.borderRadius = '15px';
    confirmDialog.style.padding = '30px';
    confirmDialog.style.zIndex = '3000';
    confirmDialog.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
    confirmDialog.style.textAlign = 'center';
    confirmDialog.style.minWidth = '300px';
    
    const message = document.createElement('p');
    message.textContent = `Delete ${item.itemId.replace('_', ' ').toUpperCase()}?`;
    message.style.color = '#ffffff';
    message.style.fontSize = '20px';
    message.style.marginBottom = '20px';
    message.style.fontFamily = 'Arial, sans-serif';
    confirmDialog.appendChild(message);
    
    const warningText = document.createElement('p');
    warningText.textContent = 'This action cannot be undone!';
    warningText.style.color = '#ff6666';
    warningText.style.fontSize = '14px';
    warningText.style.marginBottom = '20px';
    warningText.style.fontFamily = 'Arial, sans-serif';
    confirmDialog.appendChild(warningText);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '20px';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Delete';
    confirmBtn.style.background = '#ff4444';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '5px';
    confirmBtn.style.padding = '10px 20px';
    confirmBtn.style.color = '#ffffff';
    confirmBtn.style.fontSize = '16px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.transition = 'all 0.2s';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.background = '#666666';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '5px';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.color = '#ffffff';
    cancelBtn.style.fontSize = '16px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.transition = 'all 0.2s';
    
    confirmBtn.onmouseover = () => confirmBtn.style.background = '#ff6666';
    confirmBtn.onmouseout = () => confirmBtn.style.background = '#ff4444';
    cancelBtn.onmouseover = () => cancelBtn.style.background = '#888888';
    cancelBtn.onmouseout = () => cancelBtn.style.background = '#666666';
    
    confirmBtn.onclick = () => {
      console.log('Deleting weapon at index:', index);
      
      // Create a new array without the deleted item
      const newInventory = [...this.inventory];
      newInventory[index] = null;
      
      // Update the inventory
      this.inventory = newInventory;
      
      console.log('New inventory:', this.inventory);
      
      // Update UI
      this.render();
      this.updateHotbar();
      
      // Notify server of inventory change
      if (this.onUpdate) {
        console.log('Calling onUpdate callback');
        this.onUpdate(this.inventory);
      }
      
      // Remove dialog
      document.body.removeChild(confirmDialog);
      
      // Show deletion text
      if (this.scene) {
        const deleteText = this.scene.add.text(
          this.scene.cameras.main.centerX,
          this.scene.cameras.main.centerY - 100,
          `Deleted ${item.itemId.replace('_', ' ').toUpperCase()}!`,
          {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(10000);
        
        this.scene.tweens.add({
          targets: deleteText,
          y: deleteText.y - 30,
          alpha: 0,
          duration: 1500,
          onComplete: () => {
            deleteText.destroy();
          }
        });
      }
    };
    
    cancelBtn.onclick = () => {
      document.body.removeChild(confirmDialog);
    };
    
    buttonContainer.appendChild(confirmBtn);
    buttonContainer.appendChild(cancelBtn);
    confirmDialog.appendChild(buttonContainer);
    
    document.body.appendChild(confirmDialog);
    
    // Focus on cancel button by default for safety
    cancelBtn.focus();
  }

  useItem(index) {
    const item = this.inventory[index];
    
    // If the slot is empty and we're in the hotbar, hide the weapon
    if (!item || !item.itemId) {
      if (index < this.hotbarSlots && this.scene && this.scene.playerSprite) {
        this.scene.playerSprite.hideWeapon();
        
        // Show unequipped message using the scene's message queue
        if (this.scene.showMessage) {
          this.scene.showMessage(`Weapon Unequipped`, '#aaaaaa', 1500);
        }
      }
      return;
    }
    
    // Check if item is a weapon
    const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
    if (weaponTypes.includes(item.itemId)) {
      // Equip weapon
      if (this.scene && this.scene.playerSprite) {
        this.scene.playerSprite.equipWeapon(item.itemId);
        
        // Show equipped message using the scene's message queue
        if (this.scene.showMessage) {
          this.scene.showMessage(`Equipped ${item.itemId.replace('_', ' ').toUpperCase()}!`, '#ffe066', 1500);
        }
      }
      return;
    }
    
    // Get item data for consumables
    const itemTypes = {
      health_potion: {
        name: 'Health Potion',
        effect: (player) => {
          player.health = Math.min(player.health + 50, player.maxHealth);
          player.updateHealthBar();
        }
      },
      speed_boost: {
        name: 'Speed Boost',
        effect: (player) => {
          player.moveSpeed = 400;
          player.scene.time.delayedCall(30000, () => {
            player.moveSpeed = 250;
          });
        }
      },
      shield: {
        name: 'Shield',
        effect: (player) => {
          player.isInvulnerable = true;
          player.setTint(0x0000ff);
          player.scene.time.delayedCall(5000, () => {
            player.isInvulnerable = false;
            player.clearTint();
          });
        }
      },
      ammo_box: {
        name: 'Ammo Box',
        effect: (player) => {
          if (player.weapon) {
            player.weapon.currentAmmo = player.weapon.magazineSize;
          }
        }
      },
      damage_boost: {
        name: 'Damage Boost',
        effect: (player) => {
          if (player.weapon) {
            const originalDamage = player.weapon.damage;
            player.weapon.damage *= 2;
            player.scene.time.delayedCall(20000, () => {
              player.weapon.damage = originalDamage;
            });
          }
        }
      }
    };
    
    const itemData = itemTypes[item.itemId];
    if (!itemData) return;
    
    // Apply effect to player
    if (this.scene && this.scene.playerSprite) {
      itemData.effect(this.scene.playerSprite);
      
      // Show usage text
      const useText = this.scene.add.text(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY - 100,
        `Used ${itemData.name}!`,
        {
          fontSize: '24px',
          fontFamily: 'Arial',
          color: '#00ff00',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        }
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(10000);
      
      this.scene.tweens.add({
        targets: useText,
        y: useText.y - 30,
        alpha: 0,
        duration: 1500,
        onComplete: () => {
          useText.destroy();
        }
      });
      
      // Reduce quantity or remove item
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        this.inventory[index] = null;
      }
      
      this.render();
      this.updateHotbar();
      if (this.onUpdate) this.onUpdate(this.inventory);
    }
  }

  checkAndUpdateEquippedWeapon(newInventory) {
    // First, update the weapon loadout based on all weapons in hotbar
    const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun', 'minigun', 'triangun'];
    const hotbarWeapons = [];
    
    // Collect all weapons in the hotbar (first 5 slots)
    for (let i = 0; i < this.hotbarSlots; i++) {
      const item = newInventory[i];
      if (item && item.itemId && weaponTypes.includes(item.itemId)) {
        hotbarWeapons.push(item.itemId);
      }
    }
    
    // Update player's weapon loadout if it changed
    if (this.scene && this.scene.playerSprite && hotbarWeapons.length > 0) {
      this.scene.playerSprite.updateEquippedWeapons(hotbarWeapons);
    }
    
    // Check if the currently selected hotbar slot has a weapon
    const currentItem = newInventory[this.selectedHotbarSlot];
    if (currentItem && currentItem.itemId) {
      if (weaponTypes.includes(currentItem.itemId)) {
        // Equip the weapon that's now in the selected slot
        if (this.scene && this.scene.playerSprite) {
          this.scene.playerSprite.equipWeapon(currentItem.itemId);
        }
      } else {
        // Non-weapon item in selected slot, hide weapon
        if (this.scene && this.scene.playerSprite) {
          this.scene.playerSprite.hideWeapon();
        }
      }
    } else {
      // No item in the selected slot, hide weapon
      if (this.scene && this.scene.playerSprite) {
        this.scene.playerSprite.hideWeapon();
      }
    }
  }

  setupResize() {
    // Resize handling disabled - not needed for hotbar
  }
  
  updateGold(amount) {
    if (this.goldDisplay) {
      const goldAmountSpan = this.goldDisplay.querySelector('#goldAmount');
      if (goldAmountSpan) {
        goldAmountSpan.textContent = amount || 0;
      }
    }
  }

  destroy() {
    // Remove event listener
    if (this._keydownHandler) {
      window.removeEventListener('keydown', this._keydownHandler);
    }
    
    // Clear all timeouts
    if (this._timeouts) {
      this._timeouts.forEach(timeout => clearTimeout(timeout));
      this._timeouts = [];
    }
    
    // Remove the inventory panel
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    // Clear inventory data
    this.inventory = [];
    this.selectedSlot = -1;
    
    // Remove any event listeners
    if (this.scene) {
      this.scene.events.off('inventoryUpdate');
    }
  }
  
} 