# Existing Item System Reference

## Current Item Types (from Item.js)
```javascript
// Current item types and their effects:
health_potion: "Restores 50 HP"
speed_boost: "Increases movement speed"
shield: "Provides temporary protection"
ammo_box: "Refills ammunition"
damage_boost: "Increases weapon damage"
```

## Rarity System (already implemented)
```javascript
common: { color: 0xffffff, glow: 0.5 }
uncommon: { color: 0x00ff00, glow: 0.7 }
rare: { color: 0x0099ff, glow: 0.9 }
legendary: { color: 0xff00ff, glow: 1.0 }
```

## Item Entity Features
- Floating animation
- Glowing effect based on rarity
- Click-to-collect OR walk-over collection
- Stack support for inventory
- Despawn timer (if needed)

## Server Item Structure
```javascript
{
  id: unique_id,
  type: 'health',
  x: position_x,
  y: position_y,
  amount: 50
}
```

## Missing Connections
1. **Client itemsSpawned handler**:
```javascript
// Needs to be added to GameScene.js
this.multiplayer.socket.on('itemsSpawned', (items) => {
  items.forEach(itemData => {
    const item = new Item(this, itemData.x, itemData.y, itemData.type, itemData.rarity);
    this.itemGroup.add(item);
  });
});
```

2. **Server itemCollected handler**:
```javascript
// Needs to be added to server-pve.js
socket.on('itemCollected', ({ itemId }) => {
  if (gameState.items[itemId]) {
    delete gameState.items[itemId];
    io.emit('itemRemoved', { itemId });
  }
});
```

3. **Client itemRemoved handler**:
```javascript
// Needs to be added to GameScene.js
this.multiplayer.socket.on('itemRemoved', ({ itemId }) => {
  const item = this.itemGroup.getChildren().find(i => i.id === itemId);
  if (item) item.destroy();
});
```

## Inventory Integration
- Items are added to inventory, not immediately consumed
- First 5 inventory slots are hotbar (1-5 keys)
- Right-click in inventory to use items
- Drag-and-drop supported

## Next Steps
1. Connect these systems
2. Expand item types
3. Add drop tables
4. Implement buff system
5. Create point shop