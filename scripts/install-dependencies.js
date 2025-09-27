#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Installing dependencies for Business Task Automation Platform...\n');

// Function to run command and handle errors
function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`📦 Running: ${command} in ${cwd}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    console.log('✅ Success!\n');
  } catch (error) {
    console.error(`❌ Error running command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Install root dependencies
console.log('1️⃣ Installing root dependencies...');
runCommand('npm install');

// Install services dependencies
console.log('2️⃣ Installing services dependencies...');
const servicesPath = path.join(process.cwd(), 'services');
if (fs.existsSync(servicesPath)) {
  runCommand('npm install', servicesPath);
} else {
  console.log('⚠️  Services directory not found, skipping...');
}

// Install client dependencies
console.log('3️⃣ Installing client dependencies...');
const clientPath = path.join(process.cwd(), 'client');
if (fs.existsSync(clientPath)) {
  runCommand('npm install', clientPath);
} else {
  console.log('⚠️  Client directory not found, skipping...');
}

console.log('🎉 All dependencies installed successfully!');
console.log('\n📋 Next steps:');
console.log('   • Run "npm run dev" to start development servers');
console.log('   • Run "npm run build" to build for production');
console.log('   • Run "npm test" to run tests');