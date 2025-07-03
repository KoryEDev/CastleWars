const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const socketIO = require('socket.io');
const path = require('path');

// ... (rest of your requires)

const app = express();

// Determine if we should use HTTPS
const useHTTPS = process.env.USE_HTTPS === 'true' || process.env.NODE_ENV === 'production';

let server;
let io;

if (useHTTPS) {
  // HTTPS Configuration
  const httpsOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/game.koryenders.com/privkey.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/game.koryenders.com/fullchain.pem')
  };
  
  server = https.createServer(httpsOptions, app);
  
  // Create HTTP server that redirects to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`);
  });
  
  const httpServer = http.createServer(httpApp);
  httpServer.listen(80, () => {
    console.log('HTTP Server running on port 80, redirecting to HTTPS');
  });
} else {
  // HTTP Configuration (for development)
  server = http.createServer(app);
}

// Socket.IO configuration with HTTPS support
io = socketIO(server, {
  cors: {
    origin: function (origin, callback) {
      // Your existing CORS logic
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ... (rest of your server code)

const PORT = process.env.PORT || (useHTTPS ? 443 : 3000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`${useHTTPS ? 'HTTPS' : 'HTTP'} Server running on port ${PORT}`);
});