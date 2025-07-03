#!/bin/bash

echo "Fixing Castle Wars GUI..."
echo ""

# Check PM2 logs to see what went wrong
echo "Recent error logs:"
pm2 logs castle-wars-gui --err --lines 20 --nostream

echo ""
echo "Attempting to fix..."

# Stop the broken GUI process
pm2 stop castle-wars-gui

# Delete it from PM2
pm2 delete castle-wars-gui

# Make sure we have pm2 package installed
if ! npm list pm2 > /dev/null 2>&1; then
    echo "Installing pm2 package..."
    npm install
fi

# Start the GUI again
echo "Starting GUI with PM2..."
pm2 start ecosystem.config.js --only castle-wars-gui

# Wait a moment
sleep 3

# Check if it's running properly now
echo ""
echo "New status:"
pm2 status castle-wars-gui

# Test if it responds
echo ""
echo "Testing GUI response..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3005 | grep -q "200\|302"; then
    echo "✅ GUI is now responding!"
    echo "You should be able to access it at: https://gui.koryenders.com"
else
    echo "❌ GUI still not responding. Check logs:"
    echo "pm2 logs castle-wars-gui"
fi