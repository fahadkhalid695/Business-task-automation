#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Business Task Automation Platform - Master Setup\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Node.js 16 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('   Please upgrade Node.js: https://nodejs.org/');
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Check if Docker is available
try {
  const dockerVersion = execSync('docker --version', { encoding: 'utf8' });
  console.log(`✅ Docker: ${dockerVersion.trim()}`);
} catch (error) {
  console.log('⚠️  Docker not found (optional for development)');
}

// Check if Git is available
try {
  const gitVersion = execSync('git --version', { encoding: 'utf8' });
  console.log(`✅ Git: ${gitVersion.trim()}`);
} catch (error) {
  console.log('⚠️  Git not found');
}

console.log('\n📁 Setting up project directories...\n');

// Setup each directory
const setupDirectories = [
  { name: 'services', description: 'Backend API Services' },
  { name: 'client', description: 'Frontend React Application' },
  { name: 'testing', description: 'Testing Suite' },
  { name: 'scripts', description: 'Deployment Scripts' },
  { name: 'terraform', description: 'Infrastructure as Code' }
];

const setupResults = [];

for (const dir of setupDirectories) {
  console.log(`🔧 Setting up ${dir.name} (${dir.description})...`);
  
  const setupPath = path.join(__dirname, dir.name, 'setup.js');
  
  if (fs.existsSync(setupPath)) {
    try {
      execSync(`node setup.js`, { 
        cwd: path.join(__dirname, dir.name),
        stdio: 'inherit'
      });
      setupResults.push({ name: dir.name, status: 'success' });
      console.log(`✅ ${dir.name} setup completed\n`);
    } catch (error) {
      setupResults.push({ name: dir.name, status: 'error', error: error.message });
      console.log(`❌ ${dir.name} setup failed\n`);
    }
  } else {
    setupResults.push({ name: dir.name, status: 'skipped' });
    console.log(`⚠️  ${dir.name} setup script not found, skipping\n`);
  }
}

// Create root package.json if it doesn't exist
const rootPackageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(rootPackageJsonPath)) {
  console.log('📦 Creating root package.json...');
  
  const rootPackageJson = {
    "name": "business-task-automation-platform",
    "version": "1.0.0",
    "description": "Complete business task automation platform with AI integration",
    "private": true,
    "workspaces": [
      "services",
      "client",
      "testing",
      "scripts"
    ],
    "scripts": {
      "setup": "node setup.js",
      "install:all": "npm install && npm run install:services && npm run install:client && npm run install:testing && npm run install:scripts",
      "install:services": "cd services && npm install",
      "install:client": "cd client && npm install", 
      "install:testing": "cd testing && npm install",
      "install:scripts": "cd scripts && npm install",
      "dev": "concurrently \"npm run dev:services\" \"npm run dev:client\"",
      "dev:services": "cd services && npm run dev",
      "dev:client": "cd client && npm start",
      "build": "npm run build:services && npm run build:client",
      "build:services": "cd services && npm run build",
      "build:client": "cd client && npm run build",
      "test": "npm run test:services && npm run test:client && npm run test:integration",
      "test:services": "cd services && npm test",
      "test:client": "cd client && npm test",
      "test:integration": "cd testing && npm test",
      "test:e2e": "cd testing && npm run test:e2e",
      "test:all": "cd testing && npm run test:all",
      "deploy": "cd scripts && npm run deploy",
      "deploy:docker": "docker-compose up -d",
      "deploy:k8s": "cd terraform && terraform apply",
      "clean": "npm run clean:services && npm run clean:client && npm run clean:testing",
      "clean:services": "cd services && rm -rf node_modules dist",
      "clean:client": "cd client && rm -rf node_modules build",
      "clean:testing": "cd testing && rm -rf node_modules coverage",
      "lint": "npm run lint:services && npm run lint:client",
      "lint:services": "cd services && npm run lint",
      "lint:client": "cd client && npm run lint",
      "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
      "health": "curl -f http://localhost:3001/health && curl -f http://localhost:3000",
      "logs": "docker-compose logs -f",
      "status": "node scripts/status-check.js"
    },
    "devDependencies": {
      "concurrently": "^8.2.2",
      "prettier": "^3.1.0",
      "husky": "^8.0.3",
      "lint-staged": "^15.2.0"
    },
    "husky": {
      "hooks": {
        "pre-commit": "lint-staged"
      }
    },
    "lint-staged": {
      "*.{js,jsx,ts,tsx,json,md}": [
        "prettier --write",
        "git add"
      ]
    },
    "engines": {
      "node": ">=16.0.0",
      "npm": ">=8.0.0"
    },
    "repository": {
      "type": "git",
      "url": "https://github.com/your-org/business-task-automation-platform"
    },
    "keywords": [
      "business-automation",
      "task-management", 
      "workflow-automation",
      "ai-integration",
      "grok-api",
      "openai",
      "react",
      "nodejs",
      "typescript"
    ],
    "author": "Your Organization",
    "license": "MIT"
  };
  
  fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2));
  console.log('✅ Created root package.json');
}

// Create status check script
const statusCheckScript = `#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 Business Task Automation Platform - Status Check\\n');

const services = [
  { name: 'Backend API', url: 'http://localhost:3001/health', port: 3001 },
  { name: 'Frontend App', url: 'http://localhost:3000', port: 3000 }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const url = new URL(service.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      resolve({
        name: service.name,
        status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
        statusCode: res.statusCode
      });
    });

    req.on('error', () => {
      resolve({
        name: service.name,
        status: 'offline',
        statusCode: null
      });
    });

    req.on('timeout', () => {
      resolve({
        name: service.name,
        status: 'timeout',
        statusCode: null
      });
    });

    req.end();
  });
}

async function checkAllServices() {
  console.log('Checking services...\\n');
  
  const results = await Promise.all(services.map(checkService));
  
  results.forEach(result => {
    const icon = result.status === 'healthy' ? '✅' : 
                 result.status === 'offline' ? '❌' : '⚠️';
    console.log(\`\${icon} \${result.name}: \${result.status}\`);
  });
  
  const healthyCount = results.filter(r => r.status === 'healthy').length;
  
  console.log(\`\\n📊 Status: \${healthyCount}/\${results.length} services healthy\`);
  
  if (healthyCount === results.length) {
    console.log('🎉 All services are running!');
  } else {
    console.log('\\n🚀 To start services:');
    console.log('   Backend:  cd services && npm run dev');
    console.log('   Frontend: cd client && npm start');
  }
}

checkAllServices();
`;

const statusScriptPath = path.join(__dirname, 'scripts', 'status-check.js');
if (!fs.existsSync(statusScriptPath)) {
  fs.writeFileSync(statusScriptPath, statusCheckScript);
  console.log('✅ Created status check script');
}

// Create development environment file
const devEnvPath = path.join(__dirname, '.env.development');
if (!fs.existsSync(devEnvPath)) {
  const devEnv = `# Development Environment Configuration
NODE_ENV=development

# Service URLs
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Development Features
ENABLE_HOT_RELOAD=true
ENABLE_DEBUG_LOGS=true
ENABLE_MOCK_DATA=false

# Development Database (optional)
DEV_DATABASE_URL=mongodb://localhost:27017/business-automation-dev
DEV_REDIS_URL=redis://localhost:6379

# Development AI Keys (use test keys)
DEV_GROK_API_KEY=
DEV_OPENAI_API_KEY=
`;
  fs.writeFileSync(devEnvPath, devEnv);
  console.log('✅ Created development environment file');
}

// Install root dependencies if needed
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Installing root dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Root dependencies installed');
  } catch (error) {
    console.log('⚠️  Failed to install root dependencies');
  }
}

// Display setup summary
console.log('\n' + '='.repeat(60));
console.log('🎉 SETUP COMPLETE - Business Task Automation Platform');
console.log('='.repeat(60));

console.log('\n📋 Setup Summary:');
setupResults.forEach(result => {
  const icon = result.status === 'success' ? '✅' : 
               result.status === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${result.name}: ${result.status}`);
});

const successCount = setupResults.filter(r => r.status === 'success').length;
console.log(`\n📊 ${successCount}/${setupResults.length} components set up successfully`);

console.log('\n🚀 Quick Start Commands:');
console.log('1. Install all dependencies:  npm run install:all');
console.log('2. Start development:         npm run dev');
console.log('3. Check status:              npm run status');
console.log('4. Run tests:                 npm run test:all');
console.log('5. Build for production:      npm run build');

console.log('\n🔧 Individual Component Commands:');
console.log('• Backend API:     cd services && npm run dev');
console.log('• Frontend App:    cd client && npm start');
console.log('• Run Tests:       cd testing && npm test');
console.log('• Deploy:          cd scripts && npm run deploy');
console.log('• Infrastructure:  cd terraform && ./setup.sh');

console.log('\n📚 Documentation:');
console.log('• Main README:     ./README.md');
console.log('• API Docs:        ./services/README.md');
console.log('• Setup Guide:     ./SETUP.md');
console.log('• Troubleshooting: ./TROUBLESHOOTING.md');

console.log('\n🌐 Default URLs (after starting):');
console.log('• Frontend:        http://localhost:3000');
console.log('• Backend API:     http://localhost:3001');
console.log('• API Health:      http://localhost:3001/health');

console.log('\n🔑 Default Test Credentials:');
console.log('• Admin:           admin@example.com / password');
console.log('• User:            user@example.com / password');

if (successCount === setupResults.length) {
  console.log('\n🎯 Platform is ready for development!');
  console.log('Run "npm run dev" to start both frontend and backend');
} else {
  console.log('\n⚠️  Some components had setup issues.');
  console.log('Check the logs above and run setup again if needed.');
}

console.log('\n' + '='.repeat(60));