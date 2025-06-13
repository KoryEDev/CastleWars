# GUI Restart Troubleshooting Guide

## Overview
This guide helps diagnose and fix issues with the GUI auto-restart functionality.

## Quick Diagnostics

### 1. Test Direct Access (localhost)
First, test if restart works when accessing the GUI directly:
```bash
# Access the test page directly
http://localhost:3005/test-restart

# Or use the debug page
http://localhost:3005/debug
```

### 2. Test Through Domain (gui.koryenders.com)
Then test through the domain:
```bash
# Access through nginx proxy
http://gui.koryenders.com/test-restart
```

## Common Issues and Solutions

### Issue: "No connection to server" when clicking restart
**Cause**: IPC connection not established between GUI and game servers.

**Solution**:
1. Check if game servers are running:
   ```bash
   lsof -i :3000  # PvP server
   lsof -i :3001  # PvE server
   ```

2. Check IPC ports:
   ```bash
   lsof -i :3002  # PvP IPC
   lsof -i :3003  # PvE IPC
   ```

3. Look for IPC connection logs in GUI console:
   ```
   Connected to PvP Server IPC
   Connected to PvE Server IPC
   ```

### Issue: Restart command sent but nothing happens
**Cause**: Command format mismatch or server not processing commands.

**Diagnosis**: Check server logs for:
```
[IPC] Received data: {"type":"restartCountdown"...}
[IPC] Restart countdown requested: 0 seconds
[RESTART] Instant restart requested
```

**Solution**: Restart the game servers to re-establish IPC connections.

### Issue: GUI doesn't refresh after git pull
**Cause**: WebSocket disconnection or browser caching.

**Solution**:
1. Check browser console for errors
2. Look for "needsRestart" in the response
3. Verify the countdown appears in the GUI logs
4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Works on localhost but not through domain
**Cause**: Nginx proxy configuration issues.

**Solution**: Verify nginx config includes WebSocket headers:
```nginx
location / {
    proxy_pass http://127.0.0.1:3005;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

## Testing Workflow

### 1. Manual Restart Test
```javascript
// In browser console on GUI page
fetch('/api/server/pvp/restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countdown: 5 })
}).then(r => r.json()).then(console.log)
```

### 2. Git Pull Test
```javascript
// Test git pull with auto-restart
fetch('/api/git/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoUpdate: true })
}).then(r => r.json()).then(console.log)
```

### 3. Socket.IO Connection Test
```javascript
// Check if Socket.IO is connected
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

## Debug Mode

Enable detailed logging by adding to browser console:
```javascript
// Enable Socket.IO debugging
localStorage.debug = 'socket.io-client:*';

// Then reload the page
```

## Server-Side Debugging

### Check IPC Connection Status
In GUI server logs, look for:
```
[RESTART] Restart request received for pvp with countdown: 0
[RESTART] Server pvp status: {
  hasIpcClient: true,
  isWritable: true,
  status: 'online',
  hasProcess: true
}
[RESTART] Sending restart command to pvp
[RESTART] Command sent successfully to pvp
```

### Monitor Game Server Response
In game server logs, look for:
```
[IPC] Received data: {"type":"restartCountdown","data":{"seconds":0}}
[IPC] Restart countdown requested: 0 seconds
[RESTART] Instant restart requested
[RESTART] Server shutting down for restart...
```

## Auto-Restart Setup

### Using Shell Script
```bash
npm run gui-auto
```

### Using PM2
```bash
npm run pm2:start
npm run pm2:logs castle-wars-gui
```

### Using systemd (production)
Create `/etc/systemd/system/castle-wars-gui.service`:
```ini
[Unit]
Description=Castle Wars GUI Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/castle-wars
ExecStart=/usr/bin/npm run gui-multi
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Emergency Fixes

### Force Restart Everything
```bash
# Kill all node processes
pkill -f node

# Start with PM2
npm run pm2:start

# Or start individually
npm run gui-auto &
npm run start &
npm run pve &
```

### Clear Browser Cache
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### Reset IPC Connections
1. Stop all servers
2. Check no processes on IPC ports
3. Start servers in order: GUI, PvP, PvE

## Contact
If issues persist after following this guide:
1. Check server logs in `/logs` directory
2. Run the debug page at `/debug`
3. Report issue with logs at github.com/KoryEDev/CastleWars/issues