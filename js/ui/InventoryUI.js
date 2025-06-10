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
    instructions.innerHTML = 'Right-click items to use them • Press E to close • First 5 slots appear in hotbar (1-5 keys)';
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
      setTimeout(() => this.createHotbar(), 100);
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
        const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
        if (weaponTypes.includes(item.itemId)) {
          icon.src = `/assets/weapons/${item.itemId}.png`;
        } else {
          icon.src = `/assets/items/${item.itemId}.svg`;
        }
        icon.style.width = '32px';
        icon.style.height = '32px';
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
          slot.appendChild(qty);
        }
      }
    }
  }

  setupHotkey() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E') {
        if (this.scene && this.scene.commandPromptOpen) return;
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
    });
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
    
    setTimeout(() => { 
      this.overlay.style.opacity = '1';
      if (!savedPos) {
        this.overlay.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }, 10);
    this.render();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => { this.overlay.style.display = 'none'; }, 300);
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

  render() {
    // Render full inventory
    for (let i = 0; i < this.slotCount; i++) {
      const slot = this.slots[i];
      
      // Remove all existing event listeners by cloning the node
      const newSlot = slot.cloneNode(false);
      slot.parentNode.replaceChild(newSlot, slot);
      this.slots[i] = newSlot;
      
      // Reapply slot properties
      newSlot.innerHTML = '';
      
      // Reset background based on slot type
      if (i < this.hotbarSlots) {
        newSlot.style.background = 'linear-gradient(135deg, #3a3a54 0%, #2a2a44 100%)';
        newSlot.style.border = '2px solid #666688';
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
        const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
        if (weaponTypes.includes(item.itemId)) {
          icon.src = `/assets/weapons/${item.itemId}.png`;
        } else {
          icon.src = `/assets/items/${item.itemId}.svg`;
        }
        icon.style.width = '52px';
        icon.style.height = '52px';
        icon.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
        icon.draggable = true;
        icon.ondragstart = e => this.handleDragStart(e, slotIndex);
        icon.ondragend = e => this.handleDragEnd(e);
        icon.onerror = () => { icon.src = '/assets/item_placeholder.svg'; };
        newSlot.appendChild(icon);
        
        // Delete button (X) - only for weapons
        if (weaponTypes.includes(item.itemId)) {
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '✕';
          deleteBtn.style.position = 'absolute';
          deleteBtn.style.top = '2px';
          deleteBtn.style.right = '2px';
          deleteBtn.style.background = 'rgba(255, 0, 0, 0.6)';
          deleteBtn.style.border = '1px solid #ff6666';
          deleteBtn.style.borderRadius = '50%';
          deleteBtn.style.width = '20px';
          deleteBtn.style.height = '20px';
          deleteBtn.style.color = '#ffffff';
          deleteBtn.style.fontSize = '12px';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.display = 'none';
          deleteBtn.style.alignItems = 'center';
          deleteBtn.style.justifyContent = 'center';
          deleteBtn.style.padding = '0';
          deleteBtn.style.lineHeight = '1';
          deleteBtn.style.fontWeight = 'bold';
          deleteBtn.style.transition = 'all 0.2s';
          
          deleteBtn.onmouseover = (e) => {
            e.stopPropagation();
            deleteBtn.style.background = 'rgba(255, 0, 0, 0.8)';
            deleteBtn.style.transform = 'scale(1.1)';
          };
          
          deleteBtn.onmouseout = (e) => {
            e.stopPropagation();
            deleteBtn.style.background = 'rgba(255, 0, 0, 0.6)';
            deleteBtn.style.transform = 'scale(1)';
          };
          
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.deleteItem(slotIndex);
          };
          
          // Show/hide delete button on slot hover
          let isHoveringSlot = false;
          let isHoveringBtn = false;
          
          const showDeleteBtn = () => {
            if (isHoveringSlot || isHoveringBtn) {
              deleteBtn.style.display = 'flex';
            }
          };
          
          const hideDeleteBtn = () => {
            setTimeout(() => {
              if (!isHoveringSlot && !isHoveringBtn) {
                deleteBtn.style.display = 'none';
              }
            }, 10);
          };
          
          newSlot.addEventListener('mouseenter', () => {
            isHoveringSlot = true;
            showDeleteBtn();
          });
          
          newSlot.addEventListener('mouseleave', () => {
            isHoveringSlot = false;
            hideDeleteBtn();
          });
          
          deleteBtn.addEventListener('mouseenter', () => {
            isHoveringBtn = true;
            showDeleteBtn();
          });
          
          deleteBtn.addEventListener('mouseleave', () => {
            isHoveringBtn = false;
            hideDeleteBtn();
          });
          
          newSlot.appendChild(deleteBtn);
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
    setTimeout(() => {
      this.slots[index].style.opacity = '0.3';
    }, 0);
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
    if (this.dragged && this.draggedIndex !== null) {
      // Swap items
      const newInventory = [...this.inventory];
      [newInventory[this.draggedIndex], newInventory[targetIndex]] = [newInventory[targetIndex], newInventory[this.draggedIndex]];
      this.setInventory(newInventory);
      if (this.onUpdate) this.onUpdate(newInventory);
    }
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
    const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
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
    if (!item || !item.itemId) return;
    
    // Check if item is a weapon
    const weaponTypes = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
    if (weaponTypes.includes(item.itemId)) {
      // Equip weapon
      if (this.scene && this.scene.playerSprite) {
        this.scene.playerSprite.equipWeapon(item.itemId);
        
        // Show equipped text
        const equipText = this.scene.add.text(
          this.scene.cameras.main.centerX,
          this.scene.cameras.main.centerY - 100,
          `Equipped ${item.itemId.replace('_', ' ').toUpperCase()}!`,
          {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffe066',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
          }
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(10000);
        
        this.scene.tweens.add({
          targets: equipText,
          y: equipText.y - 30,
          alpha: 0,
          duration: 1500,
          onComplete: () => {
            equipText.destroy();
          }
        });
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

  setupResize() {
    // Resize handling disabled - not needed for hotbar
  }
  
} 