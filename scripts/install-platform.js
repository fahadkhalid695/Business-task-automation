#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 INSTALLING BUSINESS AUTOMATION PLATFORM\n');

function runCommand(command, cwd = process.cwd()) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    return false;
  }
}

function installDependencies() {
  console.log('📦 Installing dependencies...');
  
  // Install root dependencies
  if (!runCommand('npm install --legacy-peer-deps')) {
    process.exit(1);
  }

  // Install client dependencies
  if (!runCommand('npm install --legacy-peer-deps', 'client')) {
    process.exit(1);
  }

  // Install services dependencies
  if (!runCommand('npm install --legacy-peer-deps', 'services')) {
    process.exit(1);
  }

  console.log('✅ Dependencies installed');
}

function setupEnvironment() {
  console.log('🌍 Setting up environment...');
  
  // Copy environment files if they don't exist
  if (!fs.existsSync('services/.env')) {
    if (fs.existsSync('services/.env.example')) {
      fs.copyFileSync('services/.env.example', 'services/.env');
      console.log('✅ Created services/.env from example');
    }
  }

  if (!fs.existsSync('client/.env')) {
    if (fs.existsSync('client/.env.example')) {
      fs.copyFileSync('client/.env.example', 'client/.env');
      console.log('✅ Created client/.env from example');
    }
  }
}

function buildProject() {
  console.log('🔨 Building project...');
  
  // Build services
  if (!runCommand('npm run build', 'services')) {
    console.log('⚠️ Services build failed, but continuing...');
  }

  console.log('✅ Build completed');
}

async function main() {
  installDependencies();
  setupEnvironment();
  buildProject();
  
  console.log('\n🎉 INSTALLATION COMPLETED!');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Update environment variables in services/.env and client/.env');
  console.log('2. Set up MongoDB: npm run setup:db');
  console.log('3. Start development: npm run dev');
  console.log('\n🔑 REQUIRED API KEYS:');
  console.log('- OpenAI API Key (for AI features)');
  console.log('- Google OAuth2 credentials (for Gmail/Calendar)');
  console.log('- MongoDB connection (database)');
  console.log('- Slack Bot Token (optional)');
  console.log('- Twilio credentials (optional)');
}

main().catch(console.error);