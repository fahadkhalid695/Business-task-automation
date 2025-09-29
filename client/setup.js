#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎨 Setting up Business Automation Frontend...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Node.js 16 or higher is required');
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Create necessary directories
const directories = ['src/components/settings', 'public/assets', 'cypress/fixtures'];
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Check if .env exists, create from .env.example if not
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from .env.example');
  } else {
    // Create basic .env file
    const defaultEnv = `# React App Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ENVIRONMENT=development
REACT_APP_VERSION=1.0.0

# Feature Flags
REACT_APP_ENABLE_AI_FEATURES=true
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true

# Development
GENERATE_SOURCEMAP=true
FAST_REFRESH=true
`;
    fs.writeFileSync(envPath, defaultEnv);
    console.log('✅ Created default .env file');
  }
} else {
  console.log('ℹ️  .env file already exists');
}

// Install dependencies if node_modules doesn't exist
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error('Please run: npm install');
  }
} else {
  console.log('ℹ️  Dependencies already installed');
}

// Check if backend is running
console.log('🔍 Checking backend connection...');
const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Backend is running and accessible');
  } else {
    console.log('⚠️  Backend responded but may have issues');
  }
});

req.on('error', () => {
  console.log('⚠️  Backend not running. Start it with:');
  console.log('   cd ../services && npm run dev');
});

req.on('timeout', () => {
  console.log('⚠️  Backend connection timeout');
});

req.end();

console.log('\n🎉 Frontend setup complete!');
console.log('\nNext steps:');
console.log('1. Ensure backend is running: cd ../services && npm run dev');
console.log('2. Start frontend: npm start');
console.log('3. Visit: http://localhost:3000');
console.log('\nAvailable scripts:');
console.log('- npm start          # Start development server');
console.log('- npm run build      # Build for production');
console.log('- npm test           # Run tests');
console.log('- npm run cypress    # Run E2E tests');