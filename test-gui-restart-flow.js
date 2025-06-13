const http = require('http');
const io = require('socket.io-client');

// Configuration
const GUI_URL = process.env.GUI_URL || 'http://localhost:3005';
const USE_DOMAIN = process.env.USE_DOMAIN === 'true'; // Set to true if using gui.koryenders.com

console.log(`Testing GUI at: ${GUI_URL}`);
console.log(`Using domain: ${USE_DOMAIN}`);

// Test steps
async function runTests() {
    console.log('\n=== GUI Restart Flow Test ===\n');
    
    // 1. Test basic connectivity
    console.log('1. Testing HTTP connectivity...');
    try {
        const response = await fetch(`${GUI_URL}/api/gui/session`);
        console.log(`   Session endpoint: ${response.status} ${response.statusText}`);
        const data = await response.json();
        console.log(`   Session data:`, data);
    } catch (error) {
        console.error(`   ❌ HTTP test failed:`, error.message);
    }
    
    // 2. Test Socket.IO connectivity
    console.log('\n2. Testing Socket.IO connectivity...');
    const socket = io(GUI_URL, {
        transports: ['websocket', 'polling'],
        reconnection: false
    });
    
    await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.error('   ❌ Socket.IO connection timeout');
            socket.disconnect();
            resolve();
        }, 5000);
        
        socket.on('connect', () => {
            clearTimeout(timeout);
            console.log(`   ✅ Socket.IO connected! ID: ${socket.id}`);
            
            socket.on('serverStatus', (data) => {
                console.log('   Received server status:', data);
            });
            
            setTimeout(() => {
                socket.disconnect();
                resolve();
            }, 2000);
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            console.error(`   ❌ Socket.IO error:`, error.message);
            resolve();
        });
    });
    
    // 3. Test IPC connectivity
    console.log('\n3. Testing IPC connections...');
    try {
        // We can't directly test IPC from here, but we can check server status
        const pvpResponse = await fetch(`${GUI_URL}/api/server/pvp/status`);
        const pveResponse = await fetch(`${GUI_URL}/api/server/pve/status`);
        
        if (pvpResponse.ok) {
            const pvpData = await pvpResponse.json();
            console.log(`   PvP server:`, pvpData);
        }
        
        if (pveResponse.ok) {
            const pveData = await pveResponse.json();
            console.log(`   PvE server:`, pveData);
        }
    } catch (error) {
        console.error(`   ❌ Status check failed:`, error.message);
    }
    
    // 4. Test restart command flow
    console.log('\n4. Testing restart command flow...');
    console.log('   (This would require authentication - check GUI logs)');
    
    // 5. Check for common issues
    console.log('\n5. Common issues check:');
    
    // Check if using HTTPS when it should be HTTP
    if (GUI_URL.startsWith('https://')) {
        console.log('   ⚠️  Using HTTPS - make sure SSL is configured');
    }
    
    // Check if using domain
    if (USE_DOMAIN || GUI_URL.includes('koryenders.com')) {
        console.log('   ⚠️  Using domain - check nginx proxy configuration');
        console.log('   - Ensure WebSocket upgrade headers are set');
        console.log('   - Check proxy_pass is correct');
        console.log('   - Verify CORS headers if needed');
    }
    
    console.log('\n=== Test Complete ===\n');
    process.exit(0);
}

// Run tests
runTests().catch(console.error);