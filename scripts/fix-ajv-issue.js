#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing AJV dependency issues...\n');

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
    // Don't exit on error, continue with other operations
  }
}

function cleanDirectory(dir) {
  const nodeModulesPath = path.join(dir, 'node_modules');
  const packageLockPath = path.join(dir, 'package-lock.json');
  
  console.log(`🗑️  Cleaning ${dir}...`);
  
  // Remove node_modules
  if (fs.existsSync(nodeModulesPath)) {
    console.log(`   Removing ${nodeModulesPath}`);
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  }
  
  // Remove package-lock.json
  if (fs.existsSync(packageLockPath)) {
    console.log(`   Removing ${packageLockPath}`);
    fs.unlinkSync(packageLockPath);
  }
}

// Step 1: Clean all directories
console.log('1️⃣ Cleaning all node_modules and package-lock.json files...');
cleanDirectory(process.cwd());

const servicesPath = path.join(process.cwd(), 'services');
if (fs.existsSync(servicesPath)) {
  cleanDirectory(servicesPath);
}

const clientPath = path.join(process.cwd(), 'client');
if (fs.existsSync(clientPath)) {
  cleanDirectory(clientPath);
}

// Step 2: Clear npm cache
console.log('2️⃣ Clearing npm cache...');
runCommand('npm cache clean --force');

// Step 3: Install with specific flags to resolve AJV issues
console.log('3️⃣ Installing root dependencies with AJV fix...');
runCommand('npm install --legacy-peer-deps --no-audit --no-fund');

// Step 4: Install services dependencies
console.log('4️⃣ Installing services dependencies...');
if (fs.existsSync(servicesPath)) {
  runCommand('npm install --legacy-peer-deps --no-audit --no-fund', servicesPath);
}

// Step 5: Install client dependencies with specific AJV version
console.log('5️⃣ Installing client dependencies with AJV fix...');
if (fs.existsSync(clientPath)) {
  // First install ajv specifically
  runCommand('npm install ajv@^8.12.0 --legacy-peer-deps --no-audit --no-fund', clientPath);
  // Then install all other dependencies
  runCommand('npm install --legacy-peer-deps --no-audit --no-fund', clientPath);
}

console.log('🎉 AJV dependency fix completed!');
console.log('\n📋 Next steps:');
console.log('   • Run "npm run verify:build" to check the setup');
console.log('   • Run "npm run dev" to start development servers');
console.log('   • If issues persist, check the troubleshooting guide');