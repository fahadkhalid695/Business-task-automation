#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Setting up Business Task Automation Platform...\n');

// Create necessary directories
const directories = ['logs', 'uploads', 'temp'];
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Generate secure keys if .env doesn't exist
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Generate secure JWT secret
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(
      'your-super-secure-jwt-secret-key-at-least-32-characters-long',
      jwtSecret
    );
    
    // Generate secure encryption key
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      encryptionKey
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file with secure keys');
  } else {
    console.log('❌ .env.example file not found');
  }
} else {
  console.log('ℹ️  .env file already exists');
}

// Create logs directory structure
const logDirs = ['logs'];
logDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created log directory: ${dir}`);
  }
});

console.log('\n🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your API keys:');
console.log('   - GROK_API_KEY or XAI_API_KEY for Grok AI');
console.log('   - OPENAI_API_KEY for OpenAI (optional fallback)');
console.log('2. Run: npm run dev');
console.log('3. Visit: http://localhost:3001/health');
console.log('\nFor more information, see README.md');