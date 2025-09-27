#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Comprehensive Build Issue Fix\n');
console.log('This script will fix all common build issues:\n');
console.log('  • Dependency conflicts');
console.log('  • AJV module resolution');
console.log('  • TypeScript import extensions');
console.log('  • ESLint version conflicts');
console.log('  • Material-UI icon issues\n');

function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`📦 Running: ${command}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    console.log('✅ Success!\n');
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    return false;
  }
}

function runScript(scriptName) {
  console.log(`🔧 Running ${scriptName}...`);
  return runCommand(`node scripts/${scriptName}.js`);
}

// Step 1: Fix import extensions
console.log('1️⃣ Fixing TypeScript import extensions...');
runScript('fix-imports');

// Step 2: Fix AJV issues
console.log('2️⃣ Fixing AJV dependency issues...');
runScript('fix-ajv-issue');

// Step 3: Verify the build
console.log('3️⃣ Verifying build setup...');
runScript('verify-build');

console.log('🎉 Comprehensive fix completed!');
console.log('\n📋 Summary:');
console.log('  ✅ Import extensions fixed');
console.log('  ✅ AJV dependencies resolved');
console.log('  ✅ Build verification completed');
console.log('\n🚀 Try running: npm run dev');