const net = require('net');

// Test IPC connections to both servers
const servers = {
    pvp: { name: 'PvP Server', port: 3002 },
    pve: { name: 'PvE Server', port: 3003 }
};

console.log('Testing IPC connections to game servers...\n');

for (const [id, server] of Object.entries(servers)) {
    const client = new net.Socket();
    
    console.log(`Attempting to connect to ${server.name} on port ${server.port}...`);
    
    client.connect(server.port, '127.0.0.1', () => {
        console.log(`✅ Successfully connected to ${server.name} IPC!`);
        
        // Test sending a command
        const testCommand = { type: 'getPlayers', data: {} };
        client.write(JSON.stringify(testCommand) + '\n');
        console.log(`   Sent test command: ${JSON.stringify(testCommand)}`);
        
        // Send a restart countdown test
        setTimeout(() => {
            const restartCommand = { 
                type: 'restartCountdown', 
                data: { 
                    seconds: 5,
                    message: 'Test restart in 5 seconds'
                } 
            };
            client.write(JSON.stringify(restartCommand) + '\n');
            console.log(`   Sent restart command: ${JSON.stringify(restartCommand)}`);
        }, 1000);
        
        // Close connection after 3 seconds
        setTimeout(() => {
            client.destroy();
            console.log(`   Closed connection to ${server.name}\n`);
        }, 3000);
    });
    
    client.on('data', (data) => {
        console.log(`   Response from ${server.name}: ${data.toString().trim()}`);
    });
    
    client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.log(`❌ ${server.name} is not running (connection refused on port ${server.port})\n`);
        } else {
            console.log(`❌ Error connecting to ${server.name}: ${err.message}\n`);
        }
    });
    
    client.on('close', () => {
        // Connection closed
    });
}

console.log('\nNote: Make sure the game servers are running before testing IPC connections.');
console.log('Start servers with: npm run start (PvP) or npm run pve (PvE)\n');