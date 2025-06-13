# Restart Functionality Debug Guide

## Issues Found and Fixed

### 1. IPC Connection Not Established on GUI Startup
**Problem**: When the GUI server starts while game servers are already running, it doesn't automatically connect to their IPC ports.

**Fix Applied**: 
- Added automatic IPC connection attempts when GUI server starts
- Modified the periodic check to always attempt reconnection if no IPC client exists

### 2. Connection Retry Spam
**Problem**: The GUI was attempting to reconnect every 5 seconds, causing log spam.

**Fix Applied**:
- Added connection attempt tracking to only retry every 15 seconds
- Suppressed ECONNREFUSED errors to reduce log noise when servers are offline

### 3. Enhanced Logging
**Added comprehensive logging** to help debug issues:
- IPC connection status logging
- Command send/receive logging  
- Restart request detailed logging
- Data parsing logging in game servers

## Testing the Restart Functionality

### Method 1: Use the Test Script
```bash
# Run the IPC connection test
node test-ipc-connection.js

# This will:
# - Check if servers are running
# - Test IPC connections
# - Send test commands including restart
```

### Method 2: Manual Testing via GUI
1. Start the game servers:
   ```bash
   npm run start     # PvP server
   npm run pve       # PvE server  
   ```

2. Start the GUI server:
   ```bash
   npm run gui-multi
   ```

3. Open http://localhost:3005 and login

4. Check the server status indicators - they should show "Online" if IPC is connected

5. Use the restart button or command

### Method 3: Direct API Testing
```bash
# Get session cookie from browser after logging in
# Then test restart:
curl -X POST http://localhost:3005/api/server/pvp/restart \
  -H "Content-Type: application/json" \
  -d '{"countdown": 10}' \
  -b "connect.sid=YOUR_SESSION_COOKIE"
```

## Debugging Steps

### 1. Check IPC Connection Status
Look for these log messages in the GUI server console:
- `[IPC] Attempting to connect to running game servers...`
- `Connected to PvP Server IPC`
- `Connected to PvE Server IPC`

### 2. Monitor Restart Command Flow
When initiating a restart, you should see:
```
GUI Server:
[RESTART] Restart request received for pvp with countdown: 30
[IPC] Writing to pvp: {"type":"restartCountdown","data":{"seconds":30}}
[IPC] Successfully sent to pvp

Game Server:
[IPC] Received data: {"type":"restartCountdown","data":{"seconds":30}}
[IPC] Parsed command: {"type":"restartCountdown","data":{"seconds":30}}
[IPC] Command type: restartCountdown Data: {"seconds":30}
[IPC] Restart countdown requested: 30 seconds
```

### 3. Common Issues and Solutions

**Issue**: "No connection to server" error
- **Check**: Is the game server running?
- **Check**: Look for IPC connection messages in GUI console
- **Fix**: The GUI will now attempt to reconnect automatically

**Issue**: Restart command sent but nothing happens
- **Check**: Game server console for IPC receive messages
- **Check**: Look for errors in handleGuiCommand function
- **Fix**: Enhanced logging will show exactly where the command fails

**Issue**: Servers don't auto-restart after git pull
- **Check**: Look for exit code 0 in server close handler
- **Check**: Auto-restart logic in closeHandler function
- **Fix**: The servers should restart automatically when exiting with code 0

## Architecture Notes

### IPC Ports
- PvP Server: Port 3002
- PvE Server: Port 3003
- GUI Server: Port 3005

### Command Structure
```json
{
  "type": "restartCountdown",
  "data": {
    "seconds": 30,
    "message": "Optional custom message"
  }
}
```

### Restart Flow
1. GUI sends restart command via IPC
2. Game server receives and starts countdown
3. Server announces to players at intervals
4. Server saves all player data
5. Server disconnects players gracefully
6. Server exits with code 0
7. GUI detects exit code 0 and auto-restarts the server