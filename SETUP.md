# 🚀 Business Task Automation Platform - Setup Guide

This guide will help you set up and run the Business Task Automation Platform on your local machine or deploy it to production.

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **Node.js** | 18+ | JavaScript runtime | [Download](https://nodejs.org/) |
| **npm** | 8+ | Package manager | Comes with Node.js |
| **Docker** | 20+ | Containerization | [Download](https://docker.com/) |
| **Docker Compose** | 2.0+ | Multi-container orchestration | Comes with Docker Desktop |
| **Git** | 2.30+ | Version control | [Download](https://git-scm.com/) |

### Optional (for production)
- **Kubernetes** (kubectl) - Container orchestration
- **Terraform** - Infrastructure as code
- **Python 3.9+** - For AI/ML services and testing

### System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux

---

## 🏃‍♂️ Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/business-automation-platform.git
cd business-automation-platform
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install service dependencies
cd services && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 3. Environment Configuration

```bash
# Copy environment template
cp services/.env.example services/.env

# Edit the environment file with your settings
# You can use the default values for local development
```

**Important Environment Variables:**
```bash
# services/.env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/business-automation
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-here
CORS_ORIGIN=http://localhost:3001
```

### 4. Start the Development Environment

**Option A: Using Docker Compose (Recommended)**
```bash
# Start databases and services
docker-compose up -d

# Check if services are running
docker-compose ps
```

**Option B: Manual Setup**
```bash
# Start databases manually
docker run -d --name mongodb -p 27017:27017 mongo:5.0
docker run -d --name redis -p 6379:6379 redis:6.2-alpine

# Start the application
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health

### 6. Default Login Credentials

For development, you can create an admin user by running:

```bash
# Create admin user (run this after the services are up)
cd services
npm run create-admin-user
```

Or use these default credentials if seeded:
- **Email**: admin@business-automation.com
- **Password**: Admin123!

---

## 🔧 Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend in dev mode
npm run dev:api          # Start only backend services
npm run dev:client       # Start only frontend

# Building
npm run build            # Build both frontend and backend
npm run build:services   # Build only backend
npm run build:client     # Build only frontend

# Testing
npm run test             # Run all tests
npm run test:services    # Run backend tests
npm run test:client      # Run frontend tests
npm run test:e2e         # Run end-to-end tests
```

### Using the Makefile

```bash
# Development environment
make dev-up              # Start development with Docker Compose
make dev-down            # Stop development environment
make dev-logs            # View logs
make dev-restart         # Restart services

# Testing
make test                # Run all tests
make test-services       # Run backend tests only
make test-client         # Run frontend tests only
make test-e2e           # Run end-to-end tests

# Building
make build               # Build all Docker images
make push                # Push images to registry
```

---

## 🐳 Docker Setup

### Using Docker Compose (Recommended for Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Manual Docker Commands

```bash
# Build images
docker build -f services/Dockerfile -t business-automation-api services/
docker build -f client/Dockerfile -t business-automation-frontend client/

# Run containers
docker run -d --name mongodb -p 27017:27017 mongo:5.0
docker run -d --name redis -p 6379:6379 redis:6.2-alpine
docker run -d --name api -p 3000:3000 --link mongodb --link redis business-automation-api
docker run -d --name frontend -p 3001:80 --link api business-automation-frontend
```

---

## 🌐 Production Deployment

### Prerequisites for Production

1. **Kubernetes Cluster** (EKS, GKE, AKS, or self-managed)
2. **Container Registry** (Docker Hub, ECR, GCR, etc.)
3. **Domain Name** and SSL certificates
4. **External Database** (MongoDB Atlas, AWS DocumentDB, etc.)
5. **Redis Instance** (AWS ElastiCache, Redis Cloud, etc.)

### Deployment Steps

#### 1. Configure Environment

```bash
# Set environment variables
export ENVIRONMENT=production
export DOCKER_REGISTRY=your-registry.com/business-automation
export VERSION=1.0.0
```

#### 2. Build and Push Images

```bash
# Build all images
make build

# Push to registry
make push
```

#### 3. Deploy Infrastructure (if using Terraform)

```bash
# Initialize Terraform
make tf-init

# Plan deployment
make tf-plan ENVIRONMENT=production

# Apply infrastructure
make tf-apply ENVIRONMENT=production
```

#### 4. Deploy to Kubernetes

```bash
# Deploy everything
make deploy ENVIRONMENT=production

# Or deploy step by step
make k8s-namespace ENVIRONMENT=production
make k8s-secrets ENVIRONMENT=production
make k8s-config ENVIRONMENT=production
make k8s-storage ENVIRONMENT=production
make k8s-services ENVIRONMENT=production
make k8s-ingress ENVIRONMENT=production
```

#### 5. Verify Deployment

```bash
# Check deployment status
make status ENVIRONMENT=production

# Run verification tests
make verify ENVIRONMENT=production

# Run performance tests
make performance-test ENVIRONMENT=production
```

---

## 🧪 Testing

### Running Tests

```bash
# All tests
npm run test:all

# Specific test types
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:performance   # Performance tests
npm run test:security      # Security tests
npm run test:contract      # Contract tests
npm run test:data-quality  # Data quality tests
npm run test:chaos         # Chaos engineering tests
```

### Test Environment Setup

```bash
# Setup test environment
npm run test:setup

# Seed test data
npm run test:seed

# Run tests
npm run test:ci

# Cleanup
npm run test:cleanup
```

---

## 🔍 Monitoring and Debugging

### Health Checks

```bash
# Check service health
curl http://localhost:3000/api/health

# Check individual services
curl http://localhost:3000/api/health/database
curl http://localhost:3000/api/health/redis
curl http://localhost:3000/api/health/ai-services
```

### Logs

```bash
# Development logs
npm run dev                 # Shows logs in console
docker-compose logs -f      # Docker Compose logs

# Production logs
make logs ENVIRONMENT=production
kubectl logs -f deployment/api-gateway -n business-automation-production
```

### Debugging

```bash
# Debug mode for services
cd services
npm run dev:debug

# Debug frontend
cd client
npm start

# Database debugging
docker exec -it business-automation-mongodb mongosh
docker exec -it business-automation-redis redis-cli
```

---

## 🔧 Configuration

### Environment Variables

#### Backend Services (`services/.env`)

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/business-automation
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# AI Services (Optional for basic functionality)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
CORS_ORIGIN=http://localhost:3001
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Frontend (`client/.env`)

```bash
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WEBSOCKET_URL=ws://localhost:3000
REACT_APP_VERSION=1.0.0
```

### Database Configuration

The application uses MongoDB as the primary database and Redis for caching and message queues.

**MongoDB Collections:**
- `users` - User accounts and profiles
- `workflows` - Workflow definitions
- `tasks` - Task instances
- `executions` - Workflow execution history
- `integrations` - External service configurations

---

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000
netstat -tulpn | grep :3000

# Kill process
kill -9 <PID>
```

#### Docker Issues
```bash
# Clean up Docker
docker system prune -f
docker-compose down -v

# Rebuild containers
docker-compose up -d --build
```

#### Database Connection Issues
```bash
# Check MongoDB connection
docker exec -it business-automation-mongodb mongosh
# Should connect without errors

# Check Redis connection
docker exec -it business-automation-redis redis-cli ping
# Should return PONG
```

#### Permission Issues (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) node_modules/

# Fix Docker permissions
sudo usermod -aG docker $USER
# Logout and login again
```

### Getting Help

1. **Check Logs**: Always check application and container logs first
2. **Health Endpoints**: Use `/api/health` to check service status
3. **Documentation**: Refer to the [troubleshooting guide](docs/support/troubleshooting.md)
4. **Issues**: Create an issue on GitHub with logs and error details

---

## 📚 Next Steps

After successfully running the platform:

1. **Explore the Interface**: Login and explore the dashboard
2. **Create Your First Workflow**: Follow the [user manual](docs/user-guides/user-manual.md)
3. **Set Up Integrations**: Configure external services you want to connect
4. **Read Documentation**: Check out the comprehensive [documentation](docs/)
5. **Join Community**: Connect with other users and contributors

---

## 🤝 Contributing

If you want to contribute to the project:

1. **Fork the Repository**: Create your own fork
2. **Set Up Development Environment**: Follow this guide
3. **Read Contributing Guidelines**: Check [CONTRIBUTING.md](CONTRIBUTING.md)
4. **Make Changes**: Create features or fix bugs
5. **Submit Pull Request**: Follow the PR template

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/business-automation-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/business-automation-platform/discussions)
- **Email**: support@business-automation.com

---

*Happy automating! 🚀*