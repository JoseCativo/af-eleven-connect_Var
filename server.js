// CommonJS entry point for Vercel compatibility
// server.js
const { spawn } = require('child_process');

// Start the application by spawning a child process that runs the ES module
const child = spawn('node', ['index.js'], { 
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT || 8000
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  child.kill('SIGTERM');
});

// Log child process exit
child.on('exit', (code, signal) => {
  console.log(`Child process exited with code ${code} and signal ${signal}`);
  process.exit(code);
});

// Export a handler for serverless environments
module.exports = (req, res) => {
  res.end('Server is running in background process');
};