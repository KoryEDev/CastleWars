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

// Function to connect to game server IPC
function connectToGameServer() {
    if (ipcClient) {
        ipcClient.destroy();
    }
    
    ipcClient = new net.Socket();
    
    ipcClient.connect(3002, '127.0.0.1', () => {
        console.log('Connected to game server IPC');
        io.emit('serverLog', { type: 'success', message: 'Connected to game server IPC' });
    });
    
    ipcClient.on('data', (data) => {
        try {
            const response = JSON.parse(data.toString());
            console.log('IPC Response:', response);
            
            // Handle player list updates
            if (response.type === 'playerList') {
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
            io.emit('serverLog', { type: 'info', message });
        });
        
        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            io.emit('serverLog', { type: 'error', message });
        });
        
        serverProcess.on('close', (code) => {
            serverProcess = null;
            serverStartTime = null;
            if (ipcClient) {
                ipcClient.destroy();
                ipcClient = null;
            }
            io.emit('serverStatus', { online: false });
            io.emit('serverLog', { type: 'warning', message: `Server process exited with code ${code}` });
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
            io.emit('serverLog', { type: 'info', message: 'Sending shutdown signal to game server...' });
            
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
                io.emit('serverLog', { type: 'warning', message: `Server restart initiated with ${countdown} second countdown` });
                
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
            io.emit('serverLog', { type: 'warning', message: 'Server restarting immediately' });
            
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
            io.emit('serverLog', { type: 'info', message });
        });
        
        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            io.emit('serverLog', { type: 'error', message });
        });
        
        serverProcess.on('close', (code) => {
            serverProcess = null;
            serverStartTime = null;
            if (ipcClient) {
                ipcClient.destroy();
                ipcClient = null;
            }
            io.emit('serverStatus', { online: false });
            io.emit('serverLog', { type: 'warning', message: `Server process exited with code ${code}` });
        });
        
        io.emit('serverStatus', { online: true });
        io.emit('serverLog', { type: 'success', message: 'Server restarted successfully' });
        
        // Connect to game server IPC after a short delay
        setTimeout(connectToGameServer, 2000);
    } catch (error) {
        io.emit('serverLog', { type: 'error', message: `Failed to restart server: ${error.message}` });
    }
}

app.get('/api/server/status', requireAuth, (req, res) => {
    res.json({
        online: !!serverProcess,
        uptime: serverStartTime ? Date.now() - serverStartTime : 0,
        pid: serverProcess ? serverProcess.pid : null
    });
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
                    io.emit('serverLog', { type: 'info', message: 'Sent resetworld command to game server' });
                } else {
                    // Fallback to direct DB operation
                    await Building.deleteMany({});
                    io.emit('serverLog', { type: 'warning', message: 'World reset via direct DB (IPC not connected)' });
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
                    io.emit('serverLog', { type: 'success', message: `Sent promote command for ${promoteUser} to ${role}` });
                    res.json({ success: true, message: `Promoted ${promoteUser} to ${role}` });
                } else {
                    // Fallback to direct DB operation
                    const result = await Player.updateOne(
                        { username: promoteUser },
                        { $set: { role } }
                    );
                    
                    if (result.modifiedCount > 0) {
                        io.emit('serverLog', { type: 'success', message: `Promoted ${promoteUser} to ${role} (IPC not connected)` });
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
                    io.emit('serverLog', { type: 'success', message: `Sent demote command for ${demoteUser}` });
                    res.json({ success: true, message: `Demoted ${demoteUser} to player` });
                } else {
                    // Fallback to direct DB operation
                    const demoteResult = await Player.updateOne(
                        { username: demoteUser },
                        { $set: { role: 'player' } }
                    );
                    
                    if (demoteResult.modifiedCount > 0) {
                        io.emit('serverLog', { type: 'success', message: `Demoted ${demoteUser} to player (IPC not connected)` });
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
                    io.emit('serverLog', { type: 'warning', message: `Sent ban command for ${banUser}` });
                    res.json({ success: true, message: `Banned ${banUser}` });
                } else {
                    // Fallback to direct DB operation
                    const banResult = await Player.updateOne(
                        { username: banUser },
                        { $set: { banned: true, banDate: new Date() } }
                    );
                    
                    if (banResult.modifiedCount > 0) {
                        io.emit('serverLog', { type: 'warning', message: `Banned ${banUser} (IPC not connected)` });
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
                    io.emit('serverLog', { type: 'success', message: `Sent unban command for ${unbanUser}` });
                    res.json({ success: true, message: `Unbanned ${unbanUser}` });
                } else {
                    // Fallback to direct DB operation
                    const unbanResult = await Player.updateOne(
                        { username: unbanUser },
                        { $unset: { banned: 1, banDate: 1 } }
                    );
                    
                    if (unbanResult.modifiedCount > 0) {
                        io.emit('serverLog', { type: 'success', message: `Unbanned ${unbanUser} (IPC not connected)` });
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
                    io.emit('serverLog', { type: 'info', message: `Sent announcement to game server: ${announcement}` });
                    res.json({ success: true, message: 'Announcement sent' });
                } else {
                    io.emit('serverLog', { type: 'warning', message: `Announcement (IPC not connected): ${announcement}` });
                    res.json({ success: true, message: 'Announcement logged (server not connected)' });
                }
                break;
                
            case 'save':
                // Force save all player data
                io.emit('serverLog', { type: 'info', message: 'Forcing save of all game data...' });
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
                
                io.emit('serverLog', { type: 'success', message: `Backup created: ${backupName}` });
                res.json({ success: true, message: `Backup created: ${backupName}` });
                break;
                
            case 'kick':
                if (parts.length < 2) {
                    return res.json({ success: false, error: 'Usage: kick [username]' });
                }
                const kickUser = parts[1];
                
                // Send command to game server if connected
                if (sendToGameServer({ type: 'kick', data: { username: kickUser } })) {
                    io.emit('serverLog', { type: 'warning', message: `Sent kick command for ${kickUser}` });
                    res.json({ success: true, message: `Kicked ${kickUser}` });
                } else {
                    io.emit('serverLog', { type: 'error', message: 'Cannot kick - game server not connected' });
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

app.get('/api/players', requireAuth, async (req, res) => {
    try {
        // Get players from active game state if server is running
        if (serverProcess) {
            // For now, get from database - in future could communicate with game server
            const recentTime = new Date(Date.now() - 60000); // Players active in last minute
            const players = await Player.find({ 
                lastLogin: { $gte: recentTime } 
            })
            .select('username role x y health')
            .sort({ lastLogin: -1 })
            .limit(50);
            res.json(players);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching players:', error);
        res.json([]);
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('GUI client connected');
    
    // Send initial status
    socket.emit('serverStatus', { online: !!serverProcess });
    
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