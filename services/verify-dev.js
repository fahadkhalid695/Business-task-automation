#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 Verifying development setup...\n');

// Function to check if server is responding
function checkServer(retries = 10) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

async function verifyDev() {
  console.log('🚀 Starting development server...');
  
  // Start the dev server
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let serverStarted = false;
  let startupOutput = '';

  // Capture output
  devProcess.stdout.on('data', (data) => {
    const output = data.toString();
    startupOutput += output;
    
    if (output.includes('running on port') || output.includes('Server running')) {
      serverStarted = true;
    }
  });

  devProcess.stderr.on('data', (data) => {
    const output = data.toString();
    startupOutput += output;
    console.log('stderr:', output);
  });

  // Wait for server to start
  console.log('⏳ Waiting for server to start...');
  
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    const isRunning = await checkServer();
    if (isRunning) {
      console.log('✅ Server is running and responding!');
      console.log('✅ Health check passed');
      console.log('🌐 Server available at: http://localhost:3001');
      console.log('🔍 Health endpoint: http://localhost:3001/health');
      
      // Kill the dev server
      devProcess.kill('SIGTERM');
      
      setTimeout(() => {
        console.log('✅ Development setup verification complete!');
        console.log('\n🎉 Your development environment is ready!');
        console.log('\nTo start development:');
        console.log('  npm run dev');
        process.exit(0);
      }, 1000);
      
      return;
    }
    
    process.stdout.write('.');
  }
  
  console.log('\n❌ Server failed to start within 30 seconds');
  console.log('\nStartup output:');
  console.log(startupOutput);
  
  devProcess.kill('SIGTERM');
  process.exit(1);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Verification interrupted');
  process.exit(1);
});

verifyDev().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});