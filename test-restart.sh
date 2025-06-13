#!/bin/bash

echo "Testing server restart functionality..."
echo ""

# Test PvP server restart
echo "Testing PvP server restart (5 second countdown)..."
curl -X POST http://localhost:3005/api/server/pvp/restart \
  -H "Content-Type: application/json" \
  -d '{"countdown": 5}' \
  -b "connect.sid=s%3AyourSessionId.signature"

echo ""
echo ""

# Test PvE server restart  
echo "Testing PvE server restart (5 second countdown)..."
curl -X POST http://localhost:3005/api/server/pve/restart \
  -H "Content-Type: application/json" \
  -d '{"countdown": 5}' \
  -b "connect.sid=s%3AyourSessionId.signature"

echo ""
echo ""
echo "Note: You need to be authenticated to the GUI first."
echo "1. Open http://localhost:3005 in your browser"
echo "2. Login with the admin password"
echo "3. Open browser dev tools and copy the connect.sid cookie value"
echo "4. Replace 'yourSessionId.signature' above with the actual cookie value"