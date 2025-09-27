#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build setup...\n');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} (missing)`);
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`✅ ${description}: ${dirPath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${dirPath} (missing)`);
    return false;
  }
}

console.log('📋 Checking project structure...');
checkFile('package.json', 'Root package.json');
checkFile('client/package.json', 'Client package.json');
checkFile('client/tsconfig.json', 'Client TypeScript config');
checkFile('services/package.json', 'Services package.json');
checkDirectory('client/src', 'Client source directory');
checkDirectory('client/src/contexts', 'Client contexts directory');

console.log('\n📋 Checking key files...');
checkFile('client/src/contexts/AuthContext.tsx', 'AuthContext');
checkFile('client/src/contexts/ThemeContext.tsx', 'ThemeContext');
checkFile('client/src/contexts/SocketContext.tsx', 'SocketContext');
checkFile('client/src/types/index.ts', 'Type definitions');

console.log('\n📋 Checking dependencies...');
try {
  const clientPackage = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
  const requiredDeps = ['react', 'react-dom', 'typescript', '@mui/material'];
  
  requiredDeps.forEach(dep => {
    if (clientPackage.dependencies[dep] || clientPackage.devDependencies[dep]) {
      console.log(`✅ ${dep}: installed`);
    } else {
      console.log(`❌ ${dep}: missing`);
    }
  });
} catch (error) {
  console.log('❌ Error reading client package.json');
}

console.log('\n🔧 Attempting to identify build issues...');
try {
  console.log('Testing TypeScript compilation...');
  execSync('cd client && npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout?.toString() || error.message);
}

console.log('\n✨ Build verification completed!');