# Archive Folder

This folder contains obsolete and deprecated files from the Castle Wars project. Files are organized by category for reference.

## Folder Structure

### old-gui/
Previous versions of the admin GUI system:
- **server-gui.html** - Original single-server admin GUI interface
- **gui-login.html** - Login page for original single-server GUI
- **server-gui.js** - Original single-server GUI backend
- **control-panel-v2.html** - Version 2 of control panel (replaced by PM2 version)
- **gui-login-v2.html** - Version 2 login page (replaced by PM2 version)
- **server-gui-multi.js** - Multi-server GUI backend (replaced by PM2 version)

### old-html/
Unused or obsolete HTML files:
- **control-panel-pm2.html** - First PM2 control panel attempt (replaced by v2)
- **server-gui-multi.html** - Unused multi-server GUI interface
- **home-mobile.html** - Old mobile landing page (functionality merged into responsive home.html)
- **game-asset-editor.html** - Unused asset editor interface
- **connection-test.html** - Old connection testing page

### old-servers/
Obsolete server implementations:
- **server-gui-multi-restart.js** - Temporary restart test server
- **server-https.js** - Old HTTPS server (HTTPS now handled via environment variables)
- **gui-standalone.js** - Standalone GUI server (if found)

### test-files/
Old test files no longer in active use.

## Current Active System

The current production system uses:
- **Admin GUI**: `server-gui-pm2.js` with `control-panel-pm2-v2.html`
- **Game Servers**: `server.js` (PvP), `server-pve.js` (PvE)
- **Game Interface**: `index.html`, `index-mobile.html`, `home.html`
- **Tools**: `weapon-editor.html` with `weapon-editor-server.js`

## Notes

These files are kept for reference and can be safely removed if no longer needed. The project has evolved from a single-server GUI to a multi-server PM2-based system with better process management and monitoring capabilities.