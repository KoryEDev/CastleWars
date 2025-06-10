#!/bin/bash

# Script to add mongoose.set('strictQuery', true) to server files

echo "Adding mongoose.set('strictQuery', true) to server files..."

# For server.js - add before line 1629
sed -i '' '1628a\
// Set mongoose options\
mongoose.set('"'"'strictQuery'"'"', true);\
' server.js

echo "✓ Updated server.js"

# For server-gui.js - find the mongoose connection line and add before it
# First, let's find the line number
LINE_NUM=$(grep -n "mongoose.connect" server-gui.js | cut -d: -f1)

if [ ! -z "$LINE_NUM" ]; then
    # Subtract 1 to insert before the connection line
    INSERT_LINE=$((LINE_NUM - 1))
    
    # Add the mongoose strict query setting
    sed -i '' "${INSERT_LINE}a\\
// Set mongoose options\\
mongoose.set('strictQuery', true);\\
" server-gui.js
    
    echo "✓ Updated server-gui.js"
else
    echo "Could not find mongoose.connect in server-gui.js"
fi

echo "Done! Remember to restart your servers for changes to take effect."