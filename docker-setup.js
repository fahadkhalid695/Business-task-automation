#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🐳 Setting up Docker Environment...\n');

// Check if Docker is installed
try {
  const dockerVersion = execSync('docker --version', { encoding: 'utf8' });
  console.log(`✅ Docker: ${dockerVersion.trim()}`);
} catch (error) {
  console.error('❌ Docker not found. Please install Docker:');
  console.error('   https://docs.docker.com/get-docker/');
  process.exit(1);
}

// Check if Docker Compose is installed
try {
  const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' });
  console.log(`✅ Docker Compose: ${composeVersion.trim()}`);
} catch (error) {
  console.error('❌ Docker Compose not found. Please install Docker Compose:');
  console.error('   https://docs.docker.com/compose/install/');
  process.exit(1);
}

// Create .dockerignore files if they don't exist
const dockerignoreContent = `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.coverage.*
.cache
.DS_Store
*.log
logs
*.tgz
.npm
.eslintcache
.node_repl_history
.yarn-integrity
.env.local
.env.development.local
.env.test.local
.env.production.local
dist
build
`;

const dockerignoreFiles = [
  'services/.dockerignore',
  'client/.dockerignore',
  '.dockerignore'
];

dockerignoreFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, dockerignoreContent);
    console.log(`✅ Created ${file}`);
  }
});

// Create docker-compose.override.yml for development
const dockerComposeOverride = `version: '3.8'

services:
  api:
    volumes:
      - ./services:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
    command: npm run dev
    ports:
      - "9229:9229"  # Node.js debugging port

  client:
    volumes:
      - ./client:/app
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
      - FAST_REFRESH=true
    stdin_open: true
    tty: true

  mongodb:
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data_dev:/data/db

  redis:
    ports:
      - "6379:6379"

volumes:
  mongodb_data_dev:
`;

const overridePath = 'docker-compose.override.yml';
if (!fs.existsSync(overridePath)) {
  fs.writeFileSync(overridePath, dockerComposeOverride);
  console.log('✅ Created docker-compose.override.yml for development');
}

// Create production docker-compose file
const dockerComposeProd = `version: '3.8'

services:
  api:
    build:
      context: ./services
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - mongodb
      - redis
    networks:
      - app-network

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      - api
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - client
    restart: unless-stopped
    networks:
      - app-network

  mongodb:
    image: mongo:6
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_ROOT_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_ROOT_PASSWORD:-password}
      MONGO_INITDB_DATABASE: \${MONGO_DATABASE:-business_automation}
    volumes:
      - mongodb_data:/data/db
      - ./mongodb/init:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass \${REDIS_PASSWORD:-password}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - app-network

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped
    networks:
      - app-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    restart: unless-stopped
    networks:
      - app-network

volumes:
  mongodb_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  app-network:
    driver: bridge
`;

const prodPath = 'docker-compose.prod.yml';
if (!fs.existsSync(prodPath)) {
  fs.writeFileSync(prodPath, dockerComposeProd);
  console.log('✅ Created docker-compose.prod.yml for production');
}

// Create Docker environment file
const dockerEnvPath = '.env.docker';
if (!fs.existsSync(dockerEnvPath)) {
  const dockerEnv = `# Docker Environment Configuration
COMPOSE_PROJECT_NAME=business-automation

# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=secure_password_change_me
MONGO_DATABASE=business_automation
REDIS_PASSWORD=secure_redis_password_change_me

# Application Configuration
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# AI Configuration
AI_PROVIDER=grok
GROK_API_KEY=your-grok-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# Monitoring Configuration
GRAFANA_PASSWORD=secure_grafana_password

# SSL Configuration (for production)
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
`;
  fs.writeFileSync(dockerEnvPath, dockerEnv);
  console.log('✅ Created .env.docker');
}

// Create nginx configuration directory
const nginxDir = 'nginx';
if (!fs.existsSync(nginxDir)) {
  fs.mkdirSync(nginxDir, { recursive: true });
  
  const nginxConf = `events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3001;
    }
    
    upstream client {
        server client:3000;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # API routes
        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Frontend routes
        location / {
            proxy_pass http://client;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support for hot reload
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}`;
  
  fs.writeFileSync(path.join(nginxDir, 'nginx.conf'), nginxConf);
  console.log('✅ Created nginx configuration');
}

// Create monitoring configuration
const monitoringDir = 'monitoring';
if (!fs.existsSync(monitoringDir)) {
  fs.mkdirSync(monitoringDir, { recursive: true });
  
  const prometheusConfig = `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/metrics'
    
  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb:27017']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
`;
  
  fs.writeFileSync(path.join(monitoringDir, 'prometheus.yml'), prometheusConfig);
  console.log('✅ Created Prometheus configuration');
}

// Create Docker helper scripts
const dockerScripts = {
  'docker-dev.sh': `#!/bin/bash
echo "🐳 Starting development environment..."
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
echo "✅ Development environment started"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "📊 MongoDB: localhost:27017"
echo "🔴 Redis: localhost:6379"
`,

  'docker-prod.sh': `#!/bin/bash
echo "🐳 Starting production environment..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.docker up -d
echo "✅ Production environment started"
echo "🌐 Application: http://localhost"
echo "📊 Grafana: http://localhost:3001"
echo "📈 Prometheus: http://localhost:9090"
`,

  'docker-stop.sh': `#!/bin/bash
echo "🛑 Stopping Docker environment..."
docker-compose down
echo "✅ Docker environment stopped"
`,

  'docker-clean.sh': `#!/bin/bash
echo "🧹 Cleaning Docker environment..."
docker-compose down -v --remove-orphans
docker system prune -f
echo "✅ Docker environment cleaned"
`,

  'docker-logs.sh': `#!/bin/bash
echo "📋 Showing Docker logs..."
docker-compose logs -f \${1:-}
`
};

Object.entries(dockerScripts).forEach(([filename, content]) => {
  const scriptPath = path.join(__dirname, filename);
  if (!fs.existsSync(scriptPath)) {
    fs.writeFileSync(scriptPath, content);
    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x "${scriptPath}"`);
        console.log(`✅ Created executable ${filename}`);
      } catch (error) {
        console.log(`✅ Created ${filename} (could not make executable)`);
      }
    } else {
      console.log(`✅ Created ${filename}`);
    }
  }
});

console.log('\n🎉 Docker setup complete!');
console.log('\nAvailable Docker commands:');
console.log('• Development:     ./docker-dev.sh');
console.log('• Production:      ./docker-prod.sh');
console.log('• Stop:            ./docker-stop.sh');
console.log('• Clean:           ./docker-clean.sh');
console.log('• Logs:            ./docker-logs.sh [service]');
console.log('\nDirect Docker Compose:');
console.log('• Development:     docker-compose up -d');
console.log('• Production:      docker-compose -f docker-compose.prod.yml up -d');
console.log('• Stop:            docker-compose down');
console.log('\nNext steps:');
console.log('1. Edit .env.docker with your configuration');
console.log('2. Run: ./docker-dev.sh (for development)');
console.log('3. Visit: http://localhost:3000');