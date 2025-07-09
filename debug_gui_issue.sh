#!/bin/bash

echo "🔍 Debugging GUI Issue - Finding the correct control panel file"
echo "=============================================================="

echo "1. First, let's find your project directory:"
echo "Looking for ecosystem.config.js files..."
find /var/www /opt /root -name "ecosystem.config.js" 2>/dev/null

echo ""
echo "2. Looking for PM2 working directories:"
pm2 jlist 2>/dev/null | grep -o '"cwd":"[^"]*"' | sort -u

echo ""
echo "3. Checking what GUI files exist in common locations:"
find /var/www /opt /root -name "*control-panel*" -o -name "*gui*" 2>/dev/null | grep -v node_modules

echo ""
echo "4. Looking for HTML files that might be the GUI:"
find /var/www /opt /root -name "*.html" 2>/dev/null | grep -E "(control|panel|gui|admin)" | head -10

echo ""
echo "If you found your project directory above, run these commands there:"
echo "ls -la | grep -E '(control|panel|gui|html)'"
echo "grep -l 'Castle Wars.*Admin' *.html 2>/dev/null"

