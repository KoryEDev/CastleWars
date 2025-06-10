const { spawn } = require('child_process');

// Performance optimization settings
const memoryLimit = 8192; // 8GB
const gcInterval = 30000; // 30 seconds

// Additional Node.js flags for better performance
const nodeFlags = [
  `--max-old-space-size=${memoryLimit}`,
  '--optimize-for-size',
  '--max-semi-space-size=64',
  '--expose-gc'
];

// Start the server with optimized settings
const server = spawn('node', [...nodeFlags, 'server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    UV_THREADPOOL_SIZE: '64', // Increase thread pool size
    NODE_OPTIONS: '--max-http-header-size=16384' // Increase max header size
  }
});

// Handle server process events
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server process exited with code ${code}`);
    process.exit(code);
  }
});

// Periodic garbage collection
setInterval(() => {
  if (global.gc) {
    global.gc();
    console.log('Manual garbage collection performed');
  }
}, gcInterval);

console.log(`Server started with ${memoryLimit}MB memory limit and optimized settings.`);
console.log('Performance optimizations enabled:');
console.log('- Increased memory limit');
console.log('- Optimized garbage collection');
console.log('- Increased thread pool size');
console.log('- Production environment'); 