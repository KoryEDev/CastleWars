# Castle Wars Developer Guide

## Overview
Castle Wars is a multiplayer online game built with Node.js, Express, Socket.IO, and MongoDB. The game features real-time player interactions, building mechanics, and combat systems.

## Project Structure
```
├── server.js           # Main game server
├── server-gui.js       # GUI server for admin controls
├── server-gui.html     # Admin control panel interface
├── control-panel.html  # Additional control interface
├── assets/            # Game assets (images, sounds, etc.)
├── js/                # Client-side JavaScript
├── models/            # MongoDB models
├── routes/            # API routes
└── public/            # Static files
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Start the GUI server (optional):
   ```bash
   npm run gui
   ```

## Key Components

### Server Architecture
- The game uses a server-authoritative architecture
- Game state is managed in `server.js`
- Real-time updates are handled through Socket.IO
- MongoDB is used for persistent storage

### Game State
The main game state includes:
- Players: Position, health, inventory, etc.
- Buildings: Types, positions, ownership
- World: Day/night cycle, weather
- Combat: Bullets, damage calculations

### Key Constants
```javascript
TICK_RATE = 16; // ms (60 FPS)
WORLD_WIDTH = 4000;
WORLD_HEIGHT = 2000;
```

## Making Changes

### Adding New Features

1. **New Building Types**
   - Add the building type to `BLOCK_TYPES` in `server.js`
   - Create corresponding assets in the `assets` directory
   - Update building collision logic if needed

2. **New Player Abilities**
   - Modify the player update logic in `server.js`
   - Add new socket event handlers for the ability
   - Update client-side code in the `js` directory

3. **UI Changes**
   - Modify `server-gui.html` for admin panel changes
   - Update client-side UI in `public` directory

### Best Practices

1. **Server-Side Validation**
   - Always validate player actions server-side
   - Never trust client-side data
   - Use the server-authoritative model

2. **Performance**
   - Keep the game loop efficient
   - Use appropriate data structures
   - Implement proper cleanup for disconnected players

3. **Security**
   - Validate all user inputs
   - Implement proper authentication
   - Use secure session management

## Common Tasks

### Adding a New Building Type
1. Add the building type to `BLOCK_TYPES`
2. Create building assets
3. Update building placement logic
4. Add building-specific behavior

### Modifying Player Movement
1. Locate the player update logic in `server.js`
2. Modify velocity calculations
3. Update collision detection if needed
4. Test with different movement scenarios

### Adding New Weapons
1. Add weapon properties to the game state
2. Implement weapon-specific logic
3. Add client-side animations
4. Update damage calculations

## Debugging

### Server Logs
- Check the console for server-side logs
- Use the GUI server for real-time monitoring
- Monitor player connections and disconnections

### Client-Side Debugging
- Use browser developer tools
- Monitor Socket.IO events
- Check for client-side errors

## Testing

### Local Testing
1. Start the server in development mode
2. Connect multiple browser windows
3. Test multiplayer interactions
4. Verify server-side validation

### Performance Testing
1. Monitor server CPU usage
2. Check memory consumption
3. Test with multiple concurrent players
4. Verify network bandwidth usage

## Contributing

1. Create a new branch for your changes
2. Follow the existing code style
3. Add comments for complex logic
4. Test thoroughly before submitting
5. Update documentation as needed

## Need Help?
- Check the codebase for similar implementations
- Review the Socket.IO documentation
- Consult the MongoDB documentation
- Reach out to the development team

Remember: Always test your changes thoroughly in a development environment before deploying to production. 