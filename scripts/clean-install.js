#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning and reinstalling dependencies...\n');

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

function installDependencies(dir) {
  console.log(`📦 Installing dependencies in ${dir}...`);
  try {
    execSync('npm install', { 
      cwd: dir, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    console.log('✅ Success!\n');
  } catch (error) {
    console.error(`❌ Failed to install dependencies in ${dir}`);
    console.error(error.message);
  }
}

// Clean and install root
cleanDirectory(process.cwd());
installDependencies(process.cwd());

// Clean and install services
const servicesPath = path.join(process.cwd(), 'services');
if (fs.existsSync(servicesPath)) {
  cleanDirectory(servicesPath);
  installDependencies(servicesPath);
}

// Clean and install client
const clientPath = path.join(process.cwd(), 'client');
if (fs.existsSync(clientPath)) {
  cleanDirectory(clientPath);
  installDependencies(clientPath);
}

console.log('🎉 Clean installation completed!');