module.exports = {
  apps: [
    {
      name: 'castle-wars-pvp',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pvp-error.log',
      out_file: './logs/pvp-out.log',
      log_file: './logs/pvp-combined.log',
      time: true
    },
    {
      name: 'castle-wars-pve',
      script: './server-pve.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pve-error.log',
      out_file: './logs/pve-out.log',
      log_file: './logs/pve-combined.log',
      time: true
    },
    {
      name: 'castle-wars-gui',
      script: './server-gui-pm2.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        GUI_PORT: 3005
      },
      error_file: './logs/gui-error.log',
      out_file: './logs/gui-out.log',
      log_file: './logs/gui-combined.log',
      time: true,
      // Restart on exit code 0 (clean exit for updates)
      stop_exit_codes: [1, 2],
      restart_delay: 2000
    }
  ]
};