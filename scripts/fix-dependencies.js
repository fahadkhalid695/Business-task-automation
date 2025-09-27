#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing dependency conflicts...\n');

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

// Step 2: Install with specific npm version and flags
console.log('2️⃣ Installing root dependencies...');
runCommand('npm install --legacy-peer-deps');

// Step 3: Install services dependencies
console.log('3️⃣ Installing services dependencies...');
if (fs.existsSync(servicesPath)) {
  runCommand('npm install --legacy-peer-deps', servicesPath);
}

// Step 4: Install client dependencies
console.log('4️⃣ Installing client dependencies...');
if (fs.existsSync(clientPath)) {
  runCommand('npm install --legacy-peer-deps', clientPath);
}

console.log('🎉 Dependency fix completed!');
console.log('\n📋 Next steps:');
console.log('   • Run "npm run verify:build" to check the setup');
console.log('   • Run "npm run dev" to start development servers');
console.log('   • If issues persist, try "npm run clean:install"');