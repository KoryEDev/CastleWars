#!/bin/bash

# GUI Server Auto-Restart Script
# This script will automatically restart the GUI server if it exits with code 0

echo "Starting Castle Wars GUI Server with auto-restart..."

while true; do
    echo "[$(date)] Starting GUI server..."
    
    # Run the GUI server
    npm run gui-multi
    
    # Check exit code
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] GUI server exited with code 0 (restart requested). Restarting in 2 seconds..."
        sleep 2
    else
        echo "[$(date)] GUI server exited with code $EXIT_CODE. Stopping auto-restart."
        break
    fi
done

echo "GUI server auto-restart stopped."