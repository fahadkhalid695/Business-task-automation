# EC2 Deployment Guide - Business Task Automation Platform

Complete guide to deploy the Business Task Automation Platform on an AWS EC2 instance.

---

## Prerequisites

- AWS Account with EC2 access
- SSH key pair created in AWS Console
- Domain name (optional, for production)
- API keys for AI services (Grok/xAI or OpenAI)

---

## Step 1: Launch EC2 Instance

### Recommended Instance Specs

| Environment | Instance Type | vCPUs | RAM | Storage |
|-------------|--------------|-------|-----|---------|
| Development | t3.medium | 2 | 4 GB | 30 GB EBS |
| Staging | t3.large | 2 | 8 GB | 50 GB EBS |
| Production | t3.xlarge | 4 | 16 GB | 100 GB EBS (gp3) |

### Launch Configuration

1. **AMI**: Ubuntu 22.04 LTS (HVM, SSD Volume Type)
2. **Instance Type**: t3.large (minimum for running all services)
3. **Key Pair**: Select or create an SSH key pair
4. **Network Settings**:
   - VPC: Default or custom
   - Auto-assign Public IP: Enable
   - Security Group: Create new with rules below

### Security Group Rules

| Type | Protocol | Port Range | Source | Description |
|------|----------|-----------|--------|-------------|
| SSH | TCP | 22 | Your IP/32 | SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | Frontend (dev only) |
| Custom TCP | TCP | 3001 | 0.0.0.0/0 | Backend API (dev only) |

> **Production**: Only expose ports 80 and 443. Use a reverse proxy (Nginx) to route traffic.

---

## Step 2: Connect to Instance

```bash
# Set permissions on key file
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

---

## Step 3: System Setup

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential software-properties-common
```

### Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version   # Should be v18.x+
npm --version    # Should be 9.x+
```

### Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version

# Apply group changes (or logout/login)
newgrp docker
```

### Install MongoDB (if not using Docker)

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Install Redis

```bash
sudo apt install -y redis-server

# Configure Redis to start on boot
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping   # Should return PONG
```

---

## Step 4: Clone and Configure the Project

### Clone Repository

```bash
cd /home/ubuntu
git clone <YOUR-REPOSITORY-URL> business-automation
cd business-automation
```

### Install Dependencies

```bash
# Install root dependencies
npm install

# Install all sub-project dependencies
npm run install:all
```

### Configure Environment Variables

```bash
# Copy the example env file
cp services/.env.example services/.env

# Edit with your actual values
nano services/.env
```

**Critical values to set in `services/.env`:**

```bash
# Server
NODE_ENV=production
PORT=3001

# Security - CHANGE THESE!
JWT_SECRET=<generate-a-64-char-random-string>
ENCRYPTION_KEY=<generate-a-64-hex-char-string>
SESSION_SECRET=<generate-a-32-char-random-string>

# Database
MONGODB_URI=mongodb://localhost:27017/business-automation
REDIS_URL=redis://localhost:6379

# CORS - set to your domain or EC2 public IP
CORS_ORIGIN=http://<EC2-PUBLIC-IP>:3000
ALLOWED_ORIGINS=http://<EC2-PUBLIC-IP>:3000,http://<EC2-PUBLIC-IP>:3001

# AI Provider (choose one)
AI_PROVIDER=gemini
GEMINI_API_KEY=<your-actual-gemini-api-key>
GOOGLE_AI_API_KEY=<your-actual-google-ai-api-key>
GEMINI_MODEL=gemini-1.5-flash

# OR for Grok:
# AI_PROVIDER=grok
# GROK_API_KEY=<your-actual-grok-api-key>
# XAI_API_KEY=<your-actual-xai-api-key>

# OR for OpenAI:
# AI_PROVIDER=openai
# OPENAI_API_KEY=<your-actual-openai-api-key>
```

**Generate secure secrets:**

```bash
# Generate JWT_SECRET (64 chars)
openssl rand -base64 48 | tr -d '\n' | head -c 64

# Generate ENCRYPTION_KEY (64 hex chars = 32 bytes)
openssl rand -hex 32

# Generate SESSION_SECRET
openssl rand -base64 32 | tr -d '\n' | head -c 32
```

---

## Step 5: Build the Application

### Build Backend Services

```bash
cd services
npm run build
cd ..
```

### Build Frontend

```bash
cd client

# Set the API URL for the build
echo "REACT_APP_API_URL=http://<EC2-PUBLIC-IP>:3001/api" > .env.production

npm run build
cd ..
```

---

## Step 6: Deployment Options

### Option A: Docker Compose (Recommended)

This is the simplest approach - runs everything in containers.

```bash
# Create a .env file for docker-compose
cat > .env << 'EOF'
JWT_SECRET=<your-generated-jwt-secret>
ENCRYPTION_KEY=<your-generated-encryption-key>
AI_PROVIDER=grok
GROK_API_KEY=<your-grok-api-key>
OPENAI_API_KEY=<your-openai-api-key>
EOF

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**Access Points:**
- Frontend: `http://<EC2-PUBLIC-IP>:3000`
- Backend API: `http://<EC2-PUBLIC-IP>:3001`
- Health Check: `http://<EC2-PUBLIC-IP>:3001/health`

### Option B: Direct Node.js (Without Docker)

```bash
# Start MongoDB and Redis (if installed locally)
sudo systemctl start mongod
sudo systemctl start redis-server

# Start the backend
cd services
NODE_ENV=production node dist/server.js &

# Serve the frontend with a static server
sudo npm install -g serve
cd ../client
serve -s build -l 3000 &
```

### Option C: PM2 Process Manager (Production Recommended)

```bash
# Install PM2
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: './services/dist/server.js',
      cwd: '/home/ubuntu/business-automation',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true
    },
    {
      name: 'frontend',
      script: 'serve',
      args: '-s client/build -l 3000',
      cwd: '/home/ubuntu/business-automation',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log'
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# Start all apps
pm2 start ecosystem.config.js

# Save PM2 process list (survives reboot)
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (sudo env PATH=...)
```

---

## Step 7: Nginx Reverse Proxy (Production)

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/business-automation
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name <EC2-PUBLIC-IP>;  # Replace with your domain if available

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # File upload size
    client_max_body_size 10M;
}
```

### Enable and Start Nginx

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/business-automation /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 8: SSL/TLS with Let's Encrypt (Production with Domain)

If you have a domain name pointing to your EC2 instance:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

After SSL is configured, update your `.env`:
```bash
CORS_ORIGIN=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## Step 9: Database Security (Production)

### Secure MongoDB

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "<STRONG-PASSWORD>",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Create application user
use business-automation
db.createUser({
  user: "app_user",
  pwd: "<STRONG-APP-PASSWORD>",
  roles: [ { role: "readWrite", db: "business-automation" } ]
})

exit
```

Enable authentication in MongoDB:

```bash
sudo nano /etc/mongod.conf
```

Add/modify:
```yaml
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

Update your `.env`:
```bash
MONGODB_URI=mongodb://app_user:<STRONG-APP-PASSWORD>@localhost:27017/business-automation?authSource=business-automation
```

### Secure Redis

```bash
sudo nano /etc/redis/redis.conf
```

Set a password:
```
requirepass <STRONG-REDIS-PASSWORD>
```

```bash
sudo systemctl restart redis-server
```

Update your `.env`:
```bash
REDIS_URL=redis://:<STRONG-REDIS-PASSWORD>@localhost:6379
```

---

## Step 10: Monitoring & Maintenance

### System Monitoring

```bash
# Install htop for system monitoring
sudo apt install -y htop

# Check disk usage
df -h

# Check memory
free -m

# Check running processes
pm2 status
```

### Application Health Check

```bash
# Check API health
curl http://localhost:3001/health

# Check PM2 processes
pm2 status

# View logs
pm2 logs api-server --lines 50
pm2 logs frontend --lines 50
```

### Log Rotation

```bash
# PM2 handles log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Automated Backups

```bash
# Create backup script
cat > /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --uri="mongodb://app_user:<password>@localhost:27017/business-automation?authSource=business-automation" \
  --out="$BACKUP_DIR/mongo_$DATE"

# Compress
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" "$BACKUP_DIR/mongo_$DATE"
rm -rf "$BACKUP_DIR/mongo_$DATE"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
EOF

chmod +x /home/ubuntu/backup.sh

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup.sh >> /home/ubuntu/logs/backup.log 2>&1") | crontab -
```

---

## Step 11: Firewall Configuration

```bash
# Install UFW (if not already installed)
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

---

## Quick Start Summary

For the fastest setup (development/testing):

```bash
# 1. SSH into EC2
ssh -i key.pem ubuntu@<IP>

# 2. Install prerequisites
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# 3. Clone and configure
git clone <REPO-URL> business-automation && cd business-automation
cp services/.env.example services/.env
# Edit services/.env with your API keys and secrets

# 4. Start with Docker
docker compose up -d

# 5. Access
# Frontend: http://<EC2-IP>:3000
# Backend:  http://<EC2-IP>:3001
# Login:    admin@example.com / password
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | `sudo lsof -i :<port>` then `kill -9 <PID>` |
| MongoDB won't start | Check logs: `sudo journalctl -u mongod` |
| Docker permission denied | Run `newgrp docker` or logout/login |
| npm install fails | Try `npm cache clean --force` then retry |
| CORS errors | Verify `CORS_ORIGIN` matches your frontend URL exactly |
| Connection refused | Check security group allows the port |
| Out of memory | Upgrade instance type or add swap space |

### Add Swap Space (if low on RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### View Docker Logs

```bash
docker compose logs -f api-gateway
docker compose logs -f frontend
docker compose logs -f mongodb
```

### Restart Services

```bash
# Docker
docker compose restart

# PM2
pm2 restart all

# Individual service
pm2 restart api-server
```

---

## Security Checklist

Before going to production, ensure:

- [ ] Changed all default passwords and secrets
- [ ] JWT_SECRET is at least 64 characters
- [ ] ENCRYPTION_KEY is a proper 64-hex-char string
- [ ] MongoDB authentication is enabled
- [ ] Redis password is set
- [ ] Firewall (UFW) is enabled with minimal ports
- [ ] SSL/TLS certificate is installed
- [ ] Security group only exposes ports 22, 80, 443
- [ ] Regular backups are scheduled
- [ ] Log rotation is configured
- [ ] NODE_ENV is set to "production"
- [ ] Debug/development ports (3000, 3001) are NOT exposed in security group


---

## How Features Work After Deployment

### Understanding What Works Out of the Box

After deployment, here's the reality of what each README feature requires:

---

### ✅ Features That Work Immediately (with API key only)

These features work as soon as you have a valid AI API key (Gemini, Grok, or OpenAI):

#### 1. AI Text Generation & Analysis
```bash
# Test text generation
curl -X POST http://<IP>:3001/api/ai-provider/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Summarize the benefits of automation"}'

# Classify text
curl -X POST http://<IP>:3001/api/ai/classify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this product!", "categories": ["positive", "negative", "neutral"]}'
```

**What it does**: Sends your text to the configured AI provider (Gemini/Grok/OpenAI) and returns classification, sentiment, summaries, translations, etc.

#### 2. Authentication & User Management
```bash
# Login (works immediately with mock users)
curl -X POST http://<IP>:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# Register new user
curl -X POST http://<IP>:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "SecurePass123!"}'
```

**Default credentials**: `admin@example.com` / `password`

#### 3. AI Provider Switching
```bash
# Check provider status
curl http://<IP>:3001/api/ai-provider/status \
  -H "Authorization: Bearer <token>"

# Switch to Gemini
curl -X POST http://<IP>:3001/api/ai-provider/switch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini"}'

# Switch to OpenAI
curl -X POST http://<IP>:3001/api/ai-provider/switch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai"}'
```

#### 4. Code Generation
```bash
curl -X POST http://<IP>:3001/api/ai-provider/generate-code \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description": "A function that validates email addresses", "language": "typescript"}'
```

#### 5. Translation
```bash
curl -X POST http://<IP>:3001/api/ai/translate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?", "targetLanguage": "Spanish"}'
```

#### 6. Dashboard & Analytics (Frontend)
The React frontend at `http://<IP>:3000` provides:
- Dashboard with task/workflow metrics
- Task management interface
- Workflow builder
- Analytics charts
- Settings page

---

### ⚠️ Features That Need MongoDB Running

These features require MongoDB to be running (it is if you used Docker Compose):

#### 7. Task Management (CRUD)
```bash
# Create a task
curl -X POST http://<IP>:3001/api/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review quarterly report",
    "description": "Review and approve Q4 financial report",
    "priority": "high",
    "assignee": "user@example.com"
  }'

# List tasks
curl http://<IP>:3001/api/tasks \
  -H "Authorization: Bearer <token>"
```

#### 8. Workflow Engine
```bash
# Create a workflow
curl -X POST http://<IP>:3001/api/workflows \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Processing Workflow",
    "steps": [
      {"type": "ai_processing", "name": "Classify Email", "order": 0, "configuration": {"model": "classification"}},
      {"type": "conditional", "name": "Route by Priority", "order": 1, "configuration": {"condition": "context.priority == high"}},
      {"type": "notification", "name": "Alert Team", "order": 2, "configuration": {"type": "slack"}}
    ]
  }'

# Execute a workflow
curl -X POST http://<IP>:3001/api/workflows/<workflow-id>/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"context": {"email": "test@example.com", "subject": "Urgent: Server Down"}}'
```

**How it works**: The WorkflowEngine processes steps sequentially. Each step type (AI processing, data transformation, external API call, conditional branching, notification) has its own processor. Steps can have retry logic and timeouts.

---

### 🔧 Features That Need External Service Credentials

These features are fully coded but need you to configure OAuth credentials for each service:

#### 9. Gmail Integration
**Setup required**:
1. Go to Google Cloud Console → APIs & Credentials
2. Create OAuth 2.0 credentials
3. Enable Gmail API
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env`

#### 10. Slack Integration
**Setup required**:
1. Go to api.slack.com → Create App
2. Add Bot Token Scopes (chat:write, channels:read, etc.)
3. Install to workspace
4. Set `SLACK_BOT_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` in `.env`

#### 11. Salesforce Integration
**Setup required**:
1. Create a Connected App in Salesforce
2. Get Consumer Key and Secret
3. Configure OAuth callback URL

#### 12. Microsoft Teams / Outlook
**Setup required**:
1. Register app in Azure AD
2. Configure Microsoft Graph API permissions
3. Set client ID and secret

**How integrations work once configured**:
```bash
# List available integrations
curl http://<IP>:3001/api/integrations \
  -H "Authorization: Bearer <token>"

# Enable an integration
curl -X POST http://<IP>:3001/api/integrations/gmail/enable \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"credentials": {"clientId": "...", "clientSecret": "...", "refreshToken": "..."}}'

# Test connection
curl -X POST http://<IP>:3001/api/integrations/gmail/test \
  -H "Authorization: Bearer <token>"
```

---

### 📊 Feature Architecture Explained

#### How the AI Pipeline Works

```
User Request → API Gateway → Unified AI Service → Provider (Gemini/Grok/OpenAI)
                                    ↓ (if primary fails)
                              Fallback Provider
```

1. User sends request (e.g., "classify this email")
2. `UnifiedAIService` routes to configured provider (default: Gemini)
3. If Gemini fails, automatically falls back to next available provider
4. Response returned to user

#### How Workflows Execute

```
Create Workflow → Define Steps → Execute → Step Processors → Results
                                    ↓
                    [AI Step] → Calls AI service
                    [Data Transform] → Processes data
                    [External API] → Calls third-party APIs
                    [Conditional] → Evaluates conditions, branches
                    [Notification] → Sends alerts
                    [User Approval] → Waits for human input
```

#### How Integrations Work

```
Register Integration → Store Encrypted Credentials → Health Monitor
         ↓                                                ↓
    Webhook Handler ← External Service Events    Periodic Health Checks
         ↓
    Create Tasks / Trigger Workflows
```

---

### 🎯 Getting Gemini Working (Recommended - Free Tier Available)

Gemini is the recommended provider because Google offers a generous free tier:

1. **Get API Key**:
   - Go to https://aistudio.google.com/apikey
   - Click "Create API Key"
   - Copy the key

2. **Configure**:
   ```bash
   # In services/.env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSy...your-key-here
   ```

3. **Available Models**:
   - `gemini-1.5-flash` (default, fast, free tier)
   - `gemini-1.5-pro` (more capable, higher limits)
   - `gemini-2.0-flash` (latest, if available)

4. **Free Tier Limits** (as of 2024):
   - 15 requests per minute
   - 1 million tokens per minute
   - 1,500 requests per day

5. **Test it**:
   ```bash
   # After starting the server
   curl -X POST http://localhost:3001/api/ai-provider/test \
     -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "What is workflow automation?"}'
   ```

---

### 📋 Feature Readiness Matrix

| Feature | Works After Deploy? | Requires |
|---------|-------------------|----------|
| Login/Register | ✅ Yes | Nothing extra |
| Dashboard UI | ✅ Yes | Frontend running |
| AI Text Generation | ✅ Yes | Any AI API key |
| AI Classification | ✅ Yes | Any AI API key |
| AI Translation | ✅ Yes | Any AI API key |
| AI Summarization | ✅ Yes | Any AI API key |
| Code Generation | ✅ Yes | Any AI API key |
| Provider Switching | ✅ Yes | Multiple API keys |
| Task CRUD | ✅ Yes | MongoDB running |
| Workflow Creation | ✅ Yes | MongoDB running |
| Workflow Execution | ✅ Yes | MongoDB + AI key |
| Analytics Dashboard | ✅ Yes | MongoDB (for real data) |
| WebSocket Real-time | ✅ Yes | Nothing extra |
| Gmail Integration | ⚠️ Config needed | Google OAuth credentials |
| Slack Integration | ⚠️ Config needed | Slack App credentials |
| Salesforce Integration | ⚠️ Config needed | Salesforce Connected App |
| Teams Integration | ⚠️ Config needed | Azure AD App registration |
| Calendar Integration | ⚠️ Config needed | Google/Microsoft OAuth |
| File Storage (Drive) | ⚠️ Config needed | Cloud storage OAuth |
| Email Notifications | ⚠️ Config needed | SMTP credentials |
| SMS Notifications | ⚠️ Config needed | Twilio credentials |
| Kubernetes Deploy | 🔧 Advanced | AWS EKS cluster |
| Terraform Infra | 🔧 Advanced | AWS account + Terraform |
| Performance Tests | 🔧 Advanced | k6 installed |
| Security Scans | 🔧 Advanced | OWASP ZAP installed |

---

### 🚀 Quick Verification After Deployment

Run these commands to verify everything is working:

```bash
# 1. Health check
curl http://localhost:3001/health

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

echo "Token: $TOKEN"

# 3. Test AI provider
curl -X POST http://localhost:3001/api/ai-provider/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, are you working?"}'

# 4. Check AI provider status
curl http://localhost:3001/api/ai-provider/status \
  -H "Authorization: Bearer $TOKEN"

# 5. Test classification
curl -X POST http://localhost:3001/api/ai-provider/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Classify this as urgent or not: Server is down and customers cannot access the platform", "options": {"maxTokens": 50}}'
```

If all 5 commands return successful responses, your platform is fully operational.
