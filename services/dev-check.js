#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Development Environment Check\n');

// Check if required files exist
const requiredFiles = [
  '.env',
  'src/server.ts',
  'tsconfig.json',
  'nodemon.json'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing!`);
    if (file === '.env') {
      console.log('   Run: cp .env.example .env');
    }
  }
});

// Check environment variables
console.log('\n🔧 Checking environment variables...');
const requiredEnvVars = [
  'JWT_SECRET',
  'ENCRYPTION_KEY'
];

const optionalEnvVars = [
  'GROK_API_KEY',
  'XAI_API_KEY', 
  'OPENAI_API_KEY',
  'AI_PROVIDER'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - Required!`);
  }
});

optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`⚠️  ${envVar} - Optional (for AI features)`);
  }
});

// Check if server is running
console.log('\n🌐 Checking server status...');
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running at http://localhost:3001');
    console.log('✅ Health check passed');
  } else {
    console.log(`⚠️  Server responded with status ${res.statusCode}`);
  }
});

req.on('error', () => {
  console.log('❌ Server is not running');
  console.log('   Start with: npm run dev');
});

req.on('timeout', () => {
  console.log('⚠️  Server connection timeout');
});

req.end();

// Check Node.js version
console.log('\n📋 Environment Info:');
console.log(`Node.js: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);

// Check if dependencies are installed
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ Dependencies installed');
} else {
  console.log('❌ Dependencies not installed');
  console.log('   Run: npm install');
}

console.log('\n🚀 Development Commands:');
console.log('• Start dev server:    npm run dev');
console.log('• Start with debug:    npm run dev:debug');
console.log('• Run tests:           npm test');
console.log('• Check types:         npm run type-check');
console.log('• Build project:       npm run build');
console.log('• Check health:        npm run health');