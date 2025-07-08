const express = require('express');
const pm2 = require('pm2');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// MongoDB connection
const mongoose = require('mongoose');
const Player = require('./models/Player');

// Set strictQuery option to suppress deprecation warning
mongoose.set('strictQuery', false);

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/castle-wars';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB for admin panel');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// PM2 process names from ecosystem.config.js
const PM2_APPS = {
    pvp: 'castle-wars-pvp',
    pve: 'castle-wars-pve'
};

// Server configurations with IPC ports
const serverConfigs = {
    pvp: {
        name: 'PvP Server',
        pm2Name: PM2_APPS.pvp,
        port: 3000,
        ipcPort: 3002,
        ipcClient: null,
        status: 'unknown',
        players: [],
        logs: []
    },
    pve: {
        name: 'PvE Server',
        pm2Name: PM2_APPS.pve,
        port: 3001,
        ipcPort: 3003,
        ipcClient: null,
        status: 'unknown',
        players: [],
        logs: [],
        parties: [],
        waveData: {},
        npcs: []
    }
};

// Connect to PM2
pm2.connect((err) => {
    if (err) {
        console.error('Failed to connect to PM2:', err);
        process.exit(2);
    }
    console.log('Connected to PM2');
    
    // Start monitoring PM2 processes
    startPM2Monitoring();
});

// Monitor PM2 processes
function startPM2Monitoring() {
    // Initial status check
    updateAllServerStatus();
    
    // Check status every 2 seconds
    setInterval(() => {
        updateAllServerStatus();
    }, 2000);
    
    // Request player data every 5 seconds
    setInterval(() => {
        for (const [serverId, config] of Object.entries(serverConfigs)) {
            if (config.ipcClient && config.ipcClient.writable) {
                sendToServer(serverId, { type: 'getPlayers' });
                
                if (serverId === 'pve') {
                    sendToServer(serverId, { type: 'getParties' });
                    sendToServer(serverId, { type: 'getWaveInfo' });
                    sendToServer(serverId, { type: 'getNpcs' });
                }
            }
        }
    }, 5000);
}

// Update status of all servers from PM2
function updateAllServerStatus() {
    pm2.list((err, list) => {
        if (err) {
            console.error('Error getting PM2 list:', err);
            return;
        }
        
        // Update status for each server
        for (const [serverId, config] of Object.entries(serverConfigs)) {
            const pm2Process = list.find(p => p.name === config.pm2Name);
            
            if (pm2Process) {
                config.status = pm2Process.pm2_env.status;
                config.cpu = pm2Process.monit ? pm2Process.monit.cpu : 0;
                config.memory = pm2Process.monit ? Math.round(pm2Process.monit.memory / 1024 / 1024) : 0;
                config.uptime = pm2Process.pm2_env.pm_uptime;
                config.restarts = pm2Process.pm2_env.restart_time;
                config.pm_id = pm2Process.pm_id;
                
                // Try to connect IPC if server is online
                if (config.status === 'online' && !config.ipcClient) {
                    connectToServerIPC(serverId);
                }
            } else {
                config.status = 'stopped';
                config.cpu = 0;
                config.memory = 0;
                config.uptime = null;
                config.restarts = 0;
                
                // Disconnect IPC if server is offline
                if (config.ipcClient) {
                    config.ipcClient.destroy();
                    config.ipcClient = null;
                }
            }
        }
        
        // Send update to all connected clients
        updateServerStatus();
    });
}

// Connect to server via IPC
function connectToServerIPC(serverId) {
    const server = serverConfigs[serverId];
    if (!server || server.ipcClient) return;
    
    console.log(`Attempting to connect to ${serverId} IPC on port ${server.ipcPort}...`);
    
    server.ipcClient = net.createConnection(server.ipcPort, '127.0.0.1');
    
    server.ipcClient.on('connect', () => {
        console.log(`Connected to ${serverId} IPC`);
        
        // Request initial data
        sendToServer(serverId, { type: 'getPlayers' });
        
        if (serverId === 'pve') {
            sendToServer(serverId, { type: 'getParties' });
            sendToServer(serverId, { type: 'getWaveInfo' });
            sendToServer(serverId, { type: 'getNpcs' });
        }
    });
    
    let buffer = '';
    server.ipcClient.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const message = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            if (message.trim()) {
                try {
                    const response = JSON.parse(message);
                    handleServerResponse(serverId, response);
                } catch (err) {
                    console.error(`Error parsing IPC response from ${serverId}:`, err);
                }
            }
        }
    });
    
    server.ipcClient.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            console.error(`IPC connection error for ${serverId}:`, err);
        }
    });
    
    server.ipcClient.on('close', () => {
        console.log(`IPC connection closed for ${serverId}`);
        server.ipcClient = null;
    });
}

// Handle responses from game servers
function handleServerResponse(serverId, response) {
    const server = serverConfigs[serverId];
    
    switch (response.type) {
        case 'players':
            server.players = response.players || [];
            io.emit('playerList', { serverId, players: server.players });
            break;
            
        case 'parties':
            if (serverId === 'pve') {
                server.parties = response.parties || [];
                io.emit('partyList', { parties: server.parties });
            }
            break;
            
        case 'waveInfo':
            if (serverId === 'pve') {
                server.waveData = response.data || {};
                io.emit('waveInfo', server.waveData);
            }
            break;
            
        case 'npcs':
            if (serverId === 'pve') {
                server.npcs = response.npcs || [];
                io.emit('npcList', { npcs: server.npcs });
            }
            break;
            
        case 'log':
            // Add log entry
            server.logs.push({
                type: response.level || 'info',
                message: response.message,
                timestamp: response.timestamp || new Date().toISOString()
            });
            
            // Keep only last 500 logs
            if (server.logs.length > 500) {
                server.logs.shift();
            }
            
            io.emit('serverLog', {
                serverId,
                log: {
                    type: response.level || 'info',
                    message: response.message,
                    timestamp: response.timestamp || new Date().toISOString()
                }
            });
            break;
    }
}

// Send command to server via IPC
function sendToServer(serverId, command) {
    const server = serverConfigs[serverId];
    if (!server || !server.ipcClient || !server.ipcClient.writable) {
        console.log(`Cannot send to ${serverId}: no IPC connection`);
        return false;
    }
    
    try {
        const message = JSON.stringify(command) + '\n';
        server.ipcClient.write(message);
        return true;
    } catch (err) {
        console.error(`Error sending to ${serverId}:`, err);
        return false;
    }
}

// Update server status for all clients
function updateServerStatus() {
    const status = {};
    for (const [id, server] of Object.entries(serverConfigs)) {
        status[id] = {
            name: server.name,
            status: server.status,
            uptime: server.uptime,
            cpu: server.cpu,
            memory: server.memory,
            restarts: server.restarts,
            playerCount: server.players.length,
            port: server.port,
            // PvE-specific data
            parties: server.parties || [],
            waveData: server.waveData || {},
            npcCount: server.npcs ? server.npcs.length : 0
        };
    }
    io.emit('serverStatus', status);
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'castle-wars-gui-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json());

// Admin password
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 
    bcrypt.hashSync('admin', 10);

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { password } = req.body;
    
    try {
        const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (isValid) {
            req.session.authenticated = true;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Authentication error' });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/auth-status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// PM2 Control Endpoints
app.post('/server/:id/start', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.start(server.pm2Name, (err) => {
        if (err && err.message !== 'process or namespace already started') {
            console.error(`Failed to start ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} started` });
        
        // Update status after a short delay
        setTimeout(updateAllServerStatus, 1000);
    });
});

app.post('/server/:id/stop', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.stop(server.pm2Name, (err) => {
        if (err) {
            console.error(`Failed to stop ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} stopped` });
        updateAllServerStatus();
    });
});

app.post('/server/:id/restart', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.restart(server.pm2Name, (err) => {
        if (err) {
            console.error(`Failed to restart ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} restarted` });
        
        // Reconnect IPC after restart
        setTimeout(() => {
            updateAllServerStatus();
        }, 2000);
    });
});

// Get PM2 logs
app.get('/server/:id/logs', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.describe(server.pm2Name, (err, processDescription) => {
        if (err || !processDescription || !processDescription[0]) {
            return res.status(500).json({ error: 'Could not get process info' });
        }
        
        const proc = processDescription[0];
        const logFile = proc.pm2_env.pm_out_log_path;
        const errorFile = proc.pm2_env.pm_err_log_path;
        
        // Read last 100 lines of logs
        exec(`tail -n 100 "${logFile}" 2>/dev/null || echo ""`, (err, stdout) => {
            const logs = stdout.split('\n').filter(line => line.trim());
            
            exec(`tail -n 100 "${errorFile}" 2>/dev/null || echo ""`, (err2, stderr) => {
                const errors = stderr.split('\n').filter(line => line.trim());
                
                res.json({
                    logs: logs.map(line => ({ type: 'info', message: line })),
                    errors: errors.map(line => ({ type: 'error', message: line }))
                });
            });
        });
    });
});

// Server commands via IPC
app.post('/server/:id/command', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const command = req.body;
    
    if (sendToServer(serverId, command)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to send command' });
    }
});

// GUI self-restart (safe restart that doesn't lock out users)
app.post('/gui/restart', requireAuth, (req, res) => {
    res.json({ success: true, message: 'GUI will restart in 3 seconds...' });
    
    io.emit('guiRestarting', { message: 'GUI is restarting. Page will refresh automatically...' });
    
    setTimeout(() => {
        console.log('GUI restart requested - exiting cleanly...');
        process.exit(0); // PM2 will auto-restart
    }, 3000);
});

// System backup endpoint
app.post('/system/backup', requireAuth, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups');
        const backupFile = path.join(backupDir, `castle-wars-backup-${timestamp}.tar.gz`);
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Create backup command - backing up MongoDB data and important files
        const backupCmd = `
            mkdir -p /tmp/castle-wars-backup &&
            mongodump --db castle-wars --out /tmp/castle-wars-backup/mongodb &&
            cp -r models /tmp/castle-wars-backup/ 2>/dev/null || true &&
            cp .env /tmp/castle-wars-backup/ 2>/dev/null || true &&
            cp ecosystem.config.js /tmp/castle-wars-backup/ 2>/dev/null || true &&
            tar -czf "${backupFile}" -C /tmp castle-wars-backup &&
            rm -rf /tmp/castle-wars-backup
        `;
        
        const { stdout, stderr } = await execPromise(backupCmd);
        
        // Get file size
        const stats = fs.statSync(backupFile);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        res.json({ 
            success: true, 
            filename: path.basename(backupFile),
            size: `${fileSizeInMB} MB`,
            path: backupFile
        });
        
        // Log the backup
        console.log(`Backup created: ${backupFile} (${fileSizeInMB} MB)`);
        
    } catch (err) {
        console.error('Backup failed:', err);
        res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
});

// Git operations
app.post('/git/pull', requireAuth, async (req, res) => {
    try {
        const { stdout, stderr } = await execPromise('git pull origin main');
        const output = stdout + (stderr ? '\nErrors:\n' + stderr : '');
        
        res.json({ success: true, output });
        
        // Check if files were updated
        if (output.includes('Updating') || output.includes('Fast-forward')) {
            io.emit('updateAvailable', { 
                message: 'Updates pulled successfully. Restarting all servers in 10 seconds...',
                restartTime: 10000
            });
            
            // Send log entry
            io.emit('serverLog', {
                serverId: 'gui',
                log: {
                    type: 'success',
                    message: 'Updates pulled from GitHub. Preparing to restart all servers...',
                    timestamp: new Date().toISOString()
                }
            });
            
            // Restart all game servers first
            setTimeout(async () => {
                console.log('Restarting game servers...');
                try {
                    await new Promise((resolve) => {
                        pm2.restart(PM2_APPS.pvp, (err) => {
                            if (err) console.error('Failed to restart PvP:', err);
                            resolve();
                        });
                    });
                    
                    await new Promise((resolve) => {
                        pm2.restart(PM2_APPS.pve, (err) => {
                            if (err) console.error('Failed to restart PvE:', err);
                            resolve();
                        });
                    });
                    
                    io.emit('serverLog', {
                        serverId: 'gui',
                        log: {
                            type: 'info',
                            message: 'Game servers restarted. GUI will restart in 5 seconds...',
                            timestamp: new Date().toISOString()
                        }
                    });
                } catch (err) {
                    console.error('Error restarting servers:', err);
                }
                
                // Restart GUI last
                setTimeout(() => {
                    console.log('Updates detected - restarting GUI...');
                    process.exit(0); // PM2 will auto-restart
                }, 5000);
            }, 5000);
        } else {
            // No updates, just log
            io.emit('serverLog', {
                serverId: 'gui',
                log: {
                    type: 'info',
                    message: 'Git pull completed. Already up to date.',
                    timestamp: new Date().toISOString()
                }
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
        
        io.emit('serverLog', {
            serverId: 'gui',
            log: {
                type: 'error',
                message: `Git pull failed: ${err.message}`,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Get all users
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', role = '', banned = '' } = req.query;
        
        // Build query
        const query = {};
        if (search) {
            query.username = { $regex: search, $options: 'i' };
        }
        if (role) {
            query.role = role;
        }
        if (banned !== '') {
            query.banned = banned === 'true';
        }
        
        // Get total count
        const total = await Player.countDocuments(query);
        
        // Get paginated users
        const users = await Player.find(query)
            .select('-passwordHash') // Don't send password hashes to frontend
            .sort({ lastLogin: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user details
app.get('/api/users/:username', requireAuth, async (req, res) => {
    try {
        const user = await Player.findOne({ username: req.params.username })
            .select('-passwordHash')
            .lean();
            
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user (role, ban status, etc.)
app.patch('/api/users/:username', requireAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const updates = {};
        
        // Only allow specific fields to be updated
        const allowedFields = ['role', 'banned', 'gold', 'level', 'experience'];
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                updates[key] = req.body[key];
            }
        });
        
        // Add ban date if banning
        if (updates.banned === true) {
            updates.banDate = new Date();
        } else if (updates.banned === false) {
            updates.banDate = null;
        }
        
        const user = await Player.findOneAndUpdate(
            { username },
            { $set: updates },
            { new: true, select: '-passwordHash' }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Notify game servers about the update
        for (const [serverId, config] of Object.entries(serverConfigs)) {
            sendToServer(serverId, {
                type: 'userUpdated',
                username,
                updates
            });
        }
        
        res.json({ success: true, user });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Reset user password
app.post('/api/users/:username/reset-password', requireAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        const user = await Player.findOneAndUpdate(
            { username },
            { $set: { passwordHash } },
            { new: true, select: '-passwordHash' }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Delete user
app.delete('/api/users/:username', requireAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Don't allow deletion of owner accounts
        const user = await Player.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.role === 'owner') {
            return res.status(403).json({ error: 'Cannot delete owner accounts' });
        }
        
        await Player.deleteOne({ username });
        
        // Notify game servers
        for (const [serverId, config] of Object.entries(serverConfigs)) {
            sendToServer(serverId, {
                type: 'userDeleted',
                username
            });
        }
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get user statistics summary
app.get('/api/users/stats/summary', requireAuth, async (req, res) => {
    try {
        const totalUsers = await Player.countDocuments();
        const bannedUsers = await Player.countDocuments({ banned: true });
        const roleStats = await Player.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        
        const recentUsers = await Player.find()
            .select('username role lastLogin')
            .sort({ lastLogin: -1 })
            .limit(10)
            .lean();
        
        res.json({
            totalUsers,
            bannedUsers,
            roleStats: roleStats.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
            recentUsers
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ==================== END USER MANAGEMENT ====================

// Serve static files
app.use(express.static(path.join(__dirname, 'gui-assets')));

// Serve the control panel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'control-panel-pm2-v2.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('GUI client connected');
    
    // Send initial status
    updateServerStatus();
    
    // Send initial player lists
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.players.length > 0) {
            socket.emit('playerList', { serverId, players: server.players });
        }
    }
    
    // Send PvE data if available
    if (serverConfigs.pve.parties.length > 0) {
        socket.emit('partyList', { parties: serverConfigs.pve.parties });
    }
    if (serverConfigs.pve.waveData) {
        socket.emit('waveInfo', serverConfigs.pve.waveData);
    }
    if (serverConfigs.pve.npcs.length > 0) {
        socket.emit('npcList', { npcs: serverConfigs.pve.npcs });
    }
    
    // Send existing logs
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        server.logs.forEach(log => {
            socket.emit('serverLog', { serverId, log });
        });
    }
    
    socket.on('requestLogs', (data) => {
        const serverId = data.serverId;
        if (serverConfigs[serverId]) {
            serverConfigs[serverId].logs.forEach(log => {
                socket.emit('serverLog', { serverId, log });
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('GUI client disconnected');
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down GUI server...');
    
    // Disconnect from PM2
    pm2.disconnect();
    
    // Close IPC connections
    for (const server of Object.values(serverConfigs)) {
        if (server.ipcClient) {
            server.ipcClient.destroy();
        }
    }
    
    server.close(() => {
        console.log('GUI server shut down');
        process.exit(0);
    });
});

// Start the server
const PORT = process.env.GUI_PORT || 3005;
server.listen(PORT, () => {
    console.log(`Castle Wars PM2 Control Panel running on port ${PORT}`);
    console.log(`Access the control panel at http://localhost:${PORT}`);
});