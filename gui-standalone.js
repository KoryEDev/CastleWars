const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3001;

// Serve the GUI HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'server-gui.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n===============================================`);
    console.log(`Castle Wars Server GUI (Standalone)`);
    console.log(`\nOpen your browser to: http://localhost:${PORT}`);
    console.log(`\nThis is a demo version of the GUI.`);
    console.log(`For full functionality, run: npm run gui`);
    console.log(`===============================================\n`);
});