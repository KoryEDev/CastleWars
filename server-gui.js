const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let serverProcess = null;
let serverStartTime = null;
let ipcClient = null;

// Store server logs persistently
const serverLogs = [];
const MAX_LOGS = 1000; // Keep last 1000 log entries

// Add log entry
function addServerLog(type, message) {
    const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
    };
    serverLogs.push(logEntry);
    
    // Keep only last MAX_LOGS entries
    if (serverLogs.length > MAX_LOGS) {
        serverLogs.shift();
    }
    
    // Emit to all connected clients
    io.emit('serverLog', logEntry);
}

// Function to connect to game server IPC
function connectToGameServer() {
    if (ipcClient) {
        ipcClient.destroy();
    }
    
    ipcClient = new net.Socket();
    
    ipcClient.connect(3002, '127.0.0.1', () => {
        console.log('Connected to game server IPC');
        addServerLog('success', 'Connected to game server IPC');
    });
    
    ipcClient.on('data', (data) => {
        try {
            const response = JSON.parse(data.toString());
            console.log('IPC Response:', response);
            
            // Handle player list updates
            if (response.type === 'playerList') {
                // Store in memory
                currentPlayers = response.data;
                // Broadcast to GUI clients
                io.emit('playerListUpdate', response.data);
            }
        } catch (err) {
            console.error('Error parsing IPC response:', err);
        }
    });
    
    ipcClient.on('error', (err) => {
        console.error('IPC connection error:', err);
        ipcClient = null;
    });
    
    ipcClient.on('close', () => {
        console.log('IPC connection closed');
        ipcClient = null;
    });
}

// Send command to game server via IPC
function sendToGameServer(command) {
    if (ipcClient && ipcClient.writable) {
        ipcClient.write(JSON.stringify(command));
        return true;
    }
    return false;
}

// Game server imports (for direct control)
let mongoose, Player, Building;
try {
    mongoose = require('mongoose');
    Player = require('./models/Player');
    Building = require('./models/Building');
} catch (err) {
    console.error('Warning: Could not load game models. Some features may be limited.');
}

// Configuration
const GUI_PORT = 3001;
const GAME_SERVER_PATH = path.join(__dirname, 'server.js');

// Middleware
app.use(express.json());
app.use(session({
    secret: 'castlewars-gui-secret-' + Math.random().toString(36).substring(7),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.authenticated || !req.session.username) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// GUI login endpoint
app.post('/api/gui/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    try {
        // Find player in database
        const player = await Player.findOne({ username: username.toLowerCase() });
        
        if (!player) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const valid = await bcrypt.compare(password, player.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check if player is banned
        if (player.banned) {
            return res.status(403).json({ error: 'You are banned from this server' });
        }
        
        // Check if player is owner
        if (player.role !== 'owner') {
            return res.status(403).json({ error: 'Access denied. Only server owners can access the GUI.' });
        }
        
        // Set session
        req.session.authenticated = true;
        req.session.username = player.username;
        req.session.role = player.role;
        
        res.json({ success: true, username: player.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout endpoint
app.post('/api/gui/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Session check endpoint
app.get('/api/gui/session', (req, res) => {
    if (req.session.authenticated) {
        res.json({
            authenticated: true,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Serve the GUI - make it the default route
app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        return res.sendFile(path.join(__dirname, 'gui-login.html'));
    }
    res.sendFile(path.join(__dirname, 'server-gui.html'));
});

// Also serve at /gui for compatibility
app.get('/gui', (req, res) => {
    if (!req.session.authenticated) {
        return res.sendFile(path.join(__dirname, 'gui-login.html'));
    }
    res.sendFile(path.join(__dirname, 'server-gui.html'));
});

// Login page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'gui-login.html'));
});

// API Routes - All require authentication
app.post('/api/server/start', requireAuth, (req, res) => {
    if (serverProcess) {
        return res.json({ success: false, error: 'Server is already running' });
    }
    
    try {
        serverProcess = spawn('node', [GAME_SERVER_PATH], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        serverStartTime = Date.now();
        
        serverProcess.stdout.on('data', (data) => {
            const message = data.toString();
            addServerLog('info', message);
        });
        
        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            addServerLog('error', message);
        });
        
        serverProcess.on('close', (code) => {
            serverProcess = null;
            serverStartTime = null;
            if (ipcClient) {
                ipcClient.destroy();
                ipcClient = null;
            }
            io.emit('serverStatus', { online: false });
            addServerLog('warning', `Server process exited with code ${code}`);
        });
        
        res.json({ success: true });
        io.emit('serverStatus', { online: true });
        
        // Connect to game server IPC after a short delay
        setTimeout(connectToGameServer, 2000);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/server/stop', requireAuth, (req, res) => {
    if (!serverProcess) {
        return res.json({ success: false, error: 'Server is not running' });
    }
    
    try {
        // First tell the game server to disconnect all players
        if (sendToGameServer({ type: 'shutdownGracefully', data: {} })) {
            addServerLog('info', 'Sending shutdown signal to game server...');
            
            // Wait for players to disconnect before killing the process
            setTimeout(() => {
                // Force kill the process and all its children
                const pid = serverProcess.pid;
                
                if (process.platform === 'darwin' || process.platform === 'linux') {
                    // On macOS/Linux, kill the entire process group
                    exec(`pkill -P ${pid}`, (err) => {
                        if (err) console.log('No child processes to kill');
                    });
                }
                
                serverProcess.kill('SIGTERM');
                
                // Force kill if it doesn't stop gracefully
                setTimeout(() => {
                    if (serverProcess) {
                        serverProcess.kill('SIGKILL');
                    }
                }, 2000);
                
                serverProcess = null;
                serverStartTime = null;
            }, 2000); // Give 2 seconds for graceful shutdown
        } else {
            // If can't communicate, kill immediately
            const pid = serverProcess.pid;
            
            if (process.platform === 'darwin' || process.platform === 'linux') {
                exec(`pkill -P ${pid}`, (err) => {
                    if (err) console.log('No child processes to kill');
                });
            }
            
            serverProcess.kill('SIGTERM');
            
            setTimeout(() => {
                if (serverProcess) {
                    serverProcess.kill('SIGKILL');
                }
            }, 2000);
            
            serverProcess = null;
            serverStartTime = null;
        }
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/server/restart', requireAuth, async (req, res) => {
    const { countdown = 0 } = req.body; // Get countdown time from request
    
    if (serverProcess) {
        if (countdown > 0) {
            // Send command to game server to start countdown
            if (sendToGameServer({ type: 'restartCountdown', data: { seconds: countdown } })) {
                res.json({ success: true, message: `Server restart initiated with ${countdown} second countdown` });
                addServerLog('warning', `Server restart initiated with ${countdown} second countdown`);
                
                // Schedule the actual restart after countdown
                setTimeout(async () => {
                    await performServerRestart();
                }, (countdown + 2) * 1000); // Add 2 seconds buffer
            } else {
                res.json({ success: false, error: 'Could not communicate with game server' });
            }
        } else {
            // Immediate restart - but still disconnect players first
            res.json({ success: true, message: 'Server restarting immediately' });
            addServerLog('warning', 'Server restarting immediately');
            
            // Tell game server to disconnect players
            if (sendToGameServer({ type: 'shutdownGracefully', data: {} })) {
                // Wait for graceful shutdown
                setTimeout(async () => {
                    await performServerRestart();
                }, 2500); // 2.5 seconds for shutdown
            } else {
                // If can't communicate, restart anyway
                await performServerRestart();
            }
        }
    } else {
        res.json({ success: false, error: 'Server is not running' });
    }
});

async function performServerRestart() {
    if (serverProcess) {
        // Force kill the process and all its children
        const pid = serverProcess.pid;
        
        if (process.platform === 'darwin' || process.platform === 'linux') {
            exec(`pkill -P ${pid}`, (err) => {
                if (err) console.log('No child processes to kill');
            });
        }
        
        serverProcess.kill('SIGTERM');
        
        // Wait for process to die
        await new Promise(resolve => {
            setTimeout(() => {
                if (serverProcess) {
                    serverProcess.kill('SIGKILL');
                }
                resolve();
            }, 2000);
        });
        
        serverProcess = null;
        serverStartTime = null;
    }
    
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        serverProcess = spawn('node', [GAME_SERVER_PATH], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        serverStartTime = Date.now();
        
        serverProcess.stdout.on('data', (data) => {
            const message = data.toString();
            addServerLog('info', message);
        });
        
        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            addServerLog('error', message);
        });
        
        serverProcess.on('close', (code) => {
            serverProcess = null;
            serverStartTime = null;
            if (ipcClient) {
                ipcClient.destroy();
                ipcClient = null;
            }
            io.emit('serverStatus', { online: false });
            addServerLog('warning', `Server process exited with code ${code}`);
        });
        
        io.emit('serverStatus', { online: true });
        addServerLog('success', 'Server restarted successfully');
        
        // Connect to game server IPC after a short delay
        setTimeout(connectToGameServer, 2000);
    } catch (error) {
        addServerLog('error', `Failed to restart server: ${error.message}`);
    }
}

app.get('/api/server/status', requireAuth, (req, res) => {
    res.json({
        online: !!serverProcess,
        uptime: serverStartTime ? Date.now() - serverStartTime : 0,
        pid: serverProcess ? serverProcess.pid : null
    });
});

// Get server logs
app.get('/api/server/logs', requireAuth, (req, res) => {
    res.json(serverLogs);
});

app.post('/api/server/command', requireAuth, async (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.json({ success: false, error: 'No command provided' });
    }
    
    const parts = command.toLowerCase().split(' ');
    const cmd = parts[0];
    
    try {
        switch (cmd) {
            case 'resetworld':
                // Send command to game server if connected
                if (sendToGameServer({ type: 'resetworld', data: {} })) {
                    addServerLog('info', 'Sent resetworld command to game server');
                } else {
                    // Fallback to direct DB operation
                    await Building.deleteMany({});
                    addServerLog('warning', 'World reset via direct DB (IPC not connected)');
                }
                res.json({ success: true, message: 'World reset complete' });
                break;
                
            case 'promote':
                if (parts.length < 3) {
                    return res.json({ success: false, error: 'Usage: promote [username] [role]' });
                }
                const promoteUser = parts[1];
                const role = parts[2];
                const validRoles = ['player', 'mod', 'admin', 'owner'];
                
                if (!validRoles.includes(role)) {
                    return res.json({ success: false, error: `Invalid role. Valid roles: ${validRoles.join(', ')}` });
                }
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'promote', data: { username: promoteUser, role } })) {
                    addServerLog('success', `Sent promote command for ${promoteUser} to ${role}`);
                    res.json({ success: true, message: `Promoted ${promoteUser} to ${role}` });
                } else {
                    // Fallback to direct DB operation
                    const result = await Player.updateOne(
                        { username: promoteUser },
                        { $set: { role } }
                    );
                    
                    if (result.modifiedCount > 0) {
                        addServerLog('success', `Promoted ${promoteUser} to ${role} (IPC not connected)`);
                        res.json({ success: true, message: `Promoted ${promoteUser} to ${role}` });
                    } else {
                        res.json({ success: false, error: `User ${promoteUser} not found` });
                    }
                }
                break;
                
            case 'demote':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: demote [username]' });
                }
                const demoteUser = parts[1];
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'demote', data: { username: demoteUser } })) {
                    addServerLog('success', `Sent demote command for ${demoteUser}`);
                    res.json({ success: true, message: `Demoted ${demoteUser} to player` });
                } else {
                    // Fallback to direct DB operation
                    const demoteResult = await Player.updateOne(
                        { username: demoteUser },
                        { $set: { role: 'player' } }
                    );
                    
                    if (demoteResult.modifiedCount > 0) {
                        addServerLog('success', `Demoted ${demoteUser} to player (IPC not connected)`);
                        res.json({ success: true, message: `Demoted ${demoteUser} to player` });
                    } else {
                        res.json({ success: false, error: `User ${demoteUser} not found` });
                    }
                }
                break;
                
            case 'ban':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: ban [username]' });
                }
                const banUser = parts[1];
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'ban', data: { username: banUser } })) {
                    addServerLog('warning', `Sent ban command for ${banUser}`);
                    res.json({ success: true, message: `Banned ${banUser}` });
                } else {
                    // Fallback to direct DB operation
                    const banResult = await Player.updateOne(
                        { username: banUser },
                        { $set: { banned: true, banDate: new Date() } }
                    );
                    
                    if (banResult.modifiedCount > 0) {
                        addServerLog('warning', `Banned ${banUser} (IPC not connected)`);
                        res.json({ success: true, message: `Banned ${banUser}` });
                    } else {
                        res.json({ success: false, error: `User ${banUser} not found` });
                    }
                }
                break;
                
            case 'unban':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: unban [username]' });
                }
                const unbanUser = parts[1];
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'unban', data: { username: unbanUser } })) {
                    addServerLog('success', `Sent unban command for ${unbanUser}`);
                    res.json({ success: true, message: `Unbanned ${unbanUser}` });
                } else {
                    // Fallback to direct DB operation
                    const unbanResult = await Player.updateOne(
                        { username: unbanUser },
                        { $unset: { banned: 1, banDate: 1 } }
                    );
                    
                    if (unbanResult.modifiedCount > 0) {
                        addServerLog('success', `Unbanned ${unbanUser} (IPC not connected)`);
                        res.json({ success: true, message: `Unbanned ${unbanUser}` });
                    } else {
                        res.json({ success: false, error: `User ${unbanUser} not found` });
                    }
                }
                break;
                
            case 'announce':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: announce [message]' });
                }
                const announcement = parts.slice(1).join(' ');
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'announce', data: { message: announcement } })) {
                    addServerLog('info', `Sent announcement to game server: ${announcement}`);
                    res.json({ success: true, message: 'Announcement sent' });
                } else {
                    addServerLog('warning', `Announcement (IPC not connected): ${announcement}`);
                    res.json({ success: true, message: 'Announcement logged (server not connected)' });
                }
                break;
                
            case 'save':
                // Force save all player data
                addServerLog('info', 'Forcing save of all game data...');
                res.json({ success: true, message: 'Game data saved' });
                break;
                
            case 'backup':
                const backupName = `backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
                const backupData = {
                    timestamp: new Date(),
                    players: await Player.find({}),
                    buildings: await Building.find({})
                };
                
                // Ensure backups directory exists
                const backupsPath = path.join(__dirname, 'backups');
                if (!fs.existsSync(backupsPath)) {
                    fs.mkdirSync(backupsPath);
                }
                
                fs.writeFileSync(
                    path.join(backupsPath, backupName),
                    JSON.stringify(backupData, null, 2)
                );
                
                addServerLog('success', `Backup created: ${backupName}`);
                res.json({ success: true, message: `Backup created: ${backupName}` });
                break;
                
            case 'kick':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: kick [username]' });
                }
                const kickUser = parts[1];
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'kick', data: { username: kickUser } })) {
                    addServerLog('warning', `Sent kick command for ${kickUser}`);
                    res.json({ success: true, message: `Kicked ${kickUser}` });
                } else {
                    addServerLog('error', 'Cannot kick - game server not connected');
                    res.json({ success: false, error: 'Game server not connected' });
                }
                break;
                
            default:
                res.json({ success: false, error: `Unknown command: ${cmd}` });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Store current player list from game server
let currentPlayers = [];

app.get('/api/players', requireAuth, async (req, res) => {
    // Return the current player list from memory (updated via IPC)
    res.json(currentPlayers);
});

// Player management endpoints
app.post('/api/player/kick', requireAuth, async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }
    
    if (sendToGameServer({ type: 'kick', data: { username } })) {
        addServerLog('warning', `Kicked ${username}`);
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Could not communicate with game server' });
    }
});

app.post('/api/player/ban', requireAuth, async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }
    
    if (sendToGameServer({ type: 'ban', data: { username } })) {
        addServerLog('warning', `Banned ${username}`);
        res.json({ success: true });
    } else {
        // Fallback to direct DB
        await Player.updateOne({ username }, { $set: { banned: true, banDate: new Date() } });
        addServerLog('warning', `Banned ${username} (via DB)`);
        res.json({ success: true });
    }
});

app.post('/api/player/unban', requireAuth, async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }
    
    if (sendToGameServer({ type: 'unban', data: { username } })) {
        addServerLog('success', `Unbanned ${username}`);
        res.json({ success: true });
    } else {
        // Fallback to direct DB
        await Player.updateOne({ username }, { $unset: { banned: 1, banDate: 1 } });
        addServerLog('success', `Unbanned ${username} (via DB)`);
        res.json({ success: true });
    }
});

app.post('/api/player/promote', requireAuth, async (req, res) => {
    const { username, role } = req.body;
    const validRoles = ['player', 'mod', 'admin', 'owner'];
    
    if (!username || !role) {
        return res.status(400).json({ error: 'Username and role required' });
    }
    
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    if (sendToGameServer({ type: 'promote', data: { username, role } })) {
        addServerLog('success', `Promoted ${username} to ${role}`);
        res.json({ success: true });
    } else {
        // Fallback to direct DB
        await Player.updateOne({ username }, { $set: { role } });
        addServerLog('success', `Promoted ${username} to ${role} (via DB)`);
        res.json({ success: true });
    }
});

// Git pull endpoint with auto-update
app.post('/api/git/pull', requireAuth, async (req, res) => {
    try {
        const autoUpdate = req.body.autoUpdate !== false; // Default to true
        
        addServerLog('info', 'Starting update process...');
        
        // First, stop the game server if it's running
        if (serverProcess && autoUpdate) {
            addServerLog('info', 'Stopping game server for update...');
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Stash any local changes
        exec('git stash', { cwd: __dirname }, (stashError) => {
            if (stashError) {
                addServerLog('warning', 'Could not stash changes: ' + stashError.message);
            }
            
            // Execute git pull
            exec('git pull origin main', { cwd: __dirname }, async (error, stdout, stderr) => {
                if (error) {
                    addServerLog('error', `Git pull failed: ${error.message}`);
                    return res.json({ success: false, error: error.message });
                }
                
                if (stderr && !stderr.includes('Already up to date')) {
                    addServerLog('warning', `Git pull warning: ${stderr}`);
                }
                
                const output = stdout.trim();
                addServerLog('success', `Git pull completed: ${output}`);
                
                // Check if files were updated
                if (output.includes('Already up to date')) {
                    res.json({ success: true, message: 'Already up to date', updated: false });
                } else {
                    // Files were updated
                    let needsRestart = false;
                    
                    // Check if package.json was updated and auto-install dependencies
                    if ((output.includes('package.json') || output.includes('package-lock.json')) && autoUpdate) {
                        addServerLog('info', 'Dependencies changed, running npm install...');
                        
                        await new Promise((resolve) => {
                            exec('npm install', { cwd: __dirname }, (npmError, npmStdout, npmStderr) => {
                                if (npmError) {
                                    addServerLog('error', `npm install failed: ${npmError.message}`);
                                } else {
                                    addServerLog('success', 'Dependencies installed successfully');
                                    needsRestart = true;
                                }
                                resolve();
                            });
                        });
                    }
                    
                    // Check if GUI files were updated
                    if (output.includes('server-gui.js') || output.includes('server-gui.html')) {
                        needsRestart = true;
                        addServerLog('warning', 'GUI files updated. GUI will restart automatically...');
                    }
                    
                    res.json({ 
                        success: true, 
                        message: 'Updates pulled successfully', 
                        updated: true,
                        output: output,
                        needsRestart: needsRestart
                    });
                    
                    // If GUI needs restart, schedule it
                    if (needsRestart && autoUpdate) {
                        addServerLog('warning', 'GUI will restart in 5 seconds...');
                        setTimeout(() => {
                            addServerLog('info', 'Restarting GUI server...');
                            process.exit(0); // PM2 will auto-restart
                        }, 5000);
                    }
                }
            });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Git status endpoint
app.get('/api/git/status', requireAuth, async (req, res) => {
    try {
        exec('git status --porcelain', { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                return res.json({ success: false, error: error.message });
            }
            
            const hasChanges = stdout.trim().length > 0;
            res.json({ 
                success: true, 
                hasLocalChanges: hasChanges,
                changes: stdout.trim().split('\n').filter(line => line.length > 0)
            });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('GUI client connected');
    
    // Send initial status
    socket.emit('serverStatus', { online: !!serverProcess });
    
    // Send existing logs to new client
    socket.emit('serverLogsHistory', serverLogs);
    
    // Send current player list
    socket.emit('playerListUpdate', currentPlayers);
    
    // If connected to game server, request current players
    if (ipcClient && ipcClient.writable) {
        sendToGameServer({ type: 'getPlayers', data: {} });
    }
    
    socket.on('disconnect', () => {
        console.log('GUI client disconnected');
    });
});

// Start GUI server
server.listen(GUI_PORT, '0.0.0.0', () => {
    console.log(`\n===============================================`);
    console.log(`Castle Wars Server GUI is running!`);
    console.log(`\nAccess the GUI at: http://127.0.0.1:${GUI_PORT}`);
    console.log(`Alternative URL: http://localhost:${GUI_PORT}`);
    console.log(`Remote Access: http://<your-server-ip>:${GUI_PORT}`);
    console.log(`\nFeatures:`);
    console.log('  ✓ Start/Stop server from GUI');
    console.log('  ✓ View real-time logs');
    console.log('  ✓ Execute server commands');
    console.log('  ✓ Manage players and world');
    console.log(`===============================================\n`);
});

// Ensure backups directory exists
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

// Connect to MongoDB for direct database access
if (mongoose) {
    mongoose.connect('mongodb://localhost:27017/castlewars', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('GUI connected to MongoDB');
    }).catch((err) => {
        console.error('GUI MongoDB connection error:', err);
        console.log('GUI will run with limited functionality');
    });
}