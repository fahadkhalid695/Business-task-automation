# Business Automation Platform - Deployment Guide

This document provides comprehensive instructions for deploying the Business Automation Platform across different environments using modern DevOps practices.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Strategies](#deployment-strategies)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance and Operations](#maintenance-and-operations)

## Overview

The Business Automation Platform uses a microservices architecture deployed on Kubernetes with the following components:

- **API Gateway**: Entry point for all client requests
- **Task Orchestrator**: Manages workflow execution and task distribution
- **AI/ML Engine**: Handles AI model inference and machine learning operations
- **Frontend**: React-based user interface
- **MongoDB**: Primary database (AWS DocumentDB in production)
- **Redis**: Caching and message queue (AWS ElastiCache in production)

### Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │     Ingress     │    │   Monitoring    │
│      (ALB)      │────│   Controller    │    │  (Prometheus)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  API Gateway    │
                       │   (Node.js)     │
                       └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────────────┐ ┌─────────────┐ ┌─────────────┐
        │Task Orchestr. │ │ AI/ML Engine│ │  Frontend   │
        │  (Node.js)    │ │  (Python)   │ │  (React)    │
        └───────────────┘ └─────────────┘ └─────────────┘
                │               │
        ┌───────────────┐ ┌─────────────┐
        │   MongoDB     │ │    Redis    │
        │ (DocumentDB)  │ │(ElastiCache)│
        └───────────────┘ └─────────────┘
```

## Prerequisites

### Required Tools

1. **kubectl** (v1.28+)
   ```bash
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   chmod +x kubectl && sudo mv kubectl /usr/local/bin/
   ```

2. **Terraform** (v1.5+)
   ```bash
   wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
   unzip terraform_1.5.0_linux_amd64.zip && sudo mv terraform /usr/local/bin/
   ```

3. **Docker** (v20.10+)
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
   ```

4. **AWS CLI** (v2.0+)
   ```bash
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip && sudo ./aws/install
   ```

### Access Requirements

- AWS Account with appropriate IAM permissions
- Kubernetes cluster access (EKS recommended)
- Docker registry access (GitHub Container Registry)
- Domain name for ingress (optional but recommended)

### Environment Variables

Create a `.env` file with the following variables:

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=123456789012

# Docker Registry
DOCKER_REGISTRY=ghcr.io/your-org/business-automation

# Kubernetes
KUBECONFIG=~/.kube/config

# Monitoring
GRAFANA_ADMIN_PASSWORD=secure-password
PROMETHEUS_RETENTION=30d

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=32-character-encryption-key
```

## Infrastructure Setup

### 1. Terraform Infrastructure

The platform uses Terraform to provision AWS infrastructure including EKS, DocumentDB, ElastiCache, and networking components.

#### Initialize Terraform

```bash
cd terraform
terraform init
```

#### Plan Infrastructure Changes

```bash
# Development
terraform plan -var-file=environments/development.tfvars

# Staging
terraform plan -var-file=environments/staging.tfvars

# Production
terraform plan -var-file=environments/production.tfvars
```

#### Apply Infrastructure

```bash
# Development
terraform apply -var-file=environments/development.tfvars

# Staging
terraform apply -var-file=environments/staging.tfvars

# Production (requires approval)
terraform apply -var-file=environments/production.tfvars
```

#### Using Makefile

```bash
# Initialize and apply for development
make tf-init ENVIRONMENT=development
make tf-apply ENVIRONMENT=development

# For production
make tf-init ENVIRONMENT=production
make tf-apply ENVIRONMENT=production
```

### 2. Kubernetes Cluster Setup

After Terraform creates the EKS cluster, configure kubectl:

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name business-automation-production

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 3. Install Required Kubernetes Components

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# Install cert-manager for TLS certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install metrics server for HPA
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## Environment Configuration

### Development Environment

Development environment is designed for local development and testing:

- **Resources**: Minimal resource allocation
- **Replicas**: Single replica for each service
- **Database**: Local MongoDB and Redis containers
- **Monitoring**: Basic monitoring setup
- **Security**: Relaxed security for development ease

```bash
# Deploy to development
make deploy ENVIRONMENT=development

# Or use the deployment script directly
./scripts/deploy.sh development latest rolling false false
```

### Staging Environment

Staging environment mirrors production but with reduced resources:

- **Resources**: Medium resource allocation
- **Replicas**: 2 replicas for critical services
- **Database**: AWS DocumentDB and ElastiCache (smaller instances)
- **Monitoring**: Full monitoring stack
- **Security**: Production-like security settings

```bash
# Deploy to staging
make deploy ENVIRONMENT=staging

# With specific image tag
./scripts/deploy.sh staging v1.2.3 rolling false false
```

### Production Environment

Production environment with full high-availability setup:

- **Resources**: High resource allocation with auto-scaling
- **Replicas**: Multiple replicas with anti-affinity rules
- **Database**: AWS DocumentDB and ElastiCache (production instances)
- **Monitoring**: Complete observability stack
- **Security**: Full security hardening

```bash
# Deploy to production (blue-green deployment)
make deploy ENVIRONMENT=production

# Blue-green deployment with specific version
./scripts/deploy.sh production v1.2.3 blue-green false false
```

## Deployment Strategies

### 1. Rolling Deployment (Default)

Rolling deployment gradually replaces old pods with new ones:

```bash
# Rolling deployment
./scripts/deploy.sh production v1.2.3 rolling

# Using Makefile
make deploy ENVIRONMENT=production DEPLOYMENT_TYPE=rolling
```

**Advantages:**
- Zero downtime
- Gradual rollout
- Easy rollback

**Disadvantages:**
- Mixed versions during deployment
- Slower deployment process

### 2. Blue-Green Deployment

Blue-green deployment creates a complete new environment before switching traffic:

```bash
# Blue-green deployment
./scripts/blue-green-deploy.sh v1.2.3

# Using deployment script
./scripts/deploy.sh production v1.2.3 blue-green
```

**Advantages:**
- Instant traffic switch
- Full environment testing
- Quick rollback

**Disadvantages:**
- Requires double resources
- More complex setup

### 3. Canary Deployment (Future)

Canary deployment gradually shifts traffic to new version:

```bash
# Canary deployment (planned feature)
./scripts/deploy.sh production v1.2.3 canary
```

## Monitoring and Observability

### Prometheus Metrics

The platform exposes comprehensive metrics:

- **Application Metrics**: Request rates, error rates, response times
- **Business Metrics**: Task completion rates, workflow efficiency
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Database Metrics**: Connection pools, query performance

### Grafana Dashboards

Pre-configured dashboards for monitoring:

1. **Business Automation Overview**: High-level system health
2. **Service Performance**: Individual service metrics
3. **Infrastructure**: Kubernetes cluster metrics
4. **Business KPIs**: Task automation effectiveness

### AlertManager Rules

Configured alerts for:

- Service downtime
- High error rates
- Resource exhaustion
- Performance degradation
- Security incidents

### Accessing Monitoring

```bash
# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin123 (change in production)

# Port forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Access Prometheus at http://localhost:9090
```

## Security Considerations

### 1. Network Security

- **Network Policies**: Restrict pod-to-pod communication
- **Ingress Security**: TLS termination and security headers
- **Service Mesh**: Consider Istio for advanced security (future)

### 2. Authentication and Authorization

- **RBAC**: Kubernetes role-based access control
- **Service Accounts**: Dedicated service accounts for each component
- **JWT Tokens**: Secure API authentication

### 3. Secrets Management

```bash
# Create secrets using kubectl
kubectl create secret generic business-automation-secrets \
  --from-literal=mongodb-uri="mongodb://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="..." \
  -n business-automation

# Or use external secret management
# AWS Secrets Manager, HashiCorp Vault, etc.
```

### 4. Image Security

- **Image Scanning**: Trivy security scans in CI/CD
- **Distroless Images**: Minimal attack surface
- **Non-root Users**: All containers run as non-root

### 5. Data Encryption

- **At Rest**: AWS KMS encryption for databases
- **In Transit**: TLS for all communications
- **Application Level**: Sensitive data encryption

## Troubleshooting

### Common Issues

#### 1. Pod Startup Issues

```bash
# Check pod status
kubectl get pods -n business-automation

# Describe problematic pod
kubectl describe pod <pod-name> -n business-automation

# Check pod logs
kubectl logs <pod-name> -n business-automation

# Check events
kubectl get events -n business-automation --sort-by='.lastTimestamp'
```

#### 2. Service Connectivity Issues

```bash
# Test service connectivity
kubectl exec -it <pod-name> -n business-automation -- curl http://service-name:port/health

# Check service endpoints
kubectl get endpoints -n business-automation

# Check network policies
kubectl get networkpolicies -n business-automation
```

#### 3. Database Connection Issues

```bash
# Test MongoDB connection
kubectl exec -it deployment/business-automation-api-gateway -n business-automation -- \
  node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(console.error)"

# Test Redis connection
kubectl exec -it deployment/business-automation-api-gateway -n business-automation -- \
  node -e "const redis = require('redis'); const client = redis.createClient(process.env.REDIS_URL); client.ping().then(console.log).catch(console.error)"
```

#### 4. Performance Issues

```bash
# Check resource usage
kubectl top pods -n business-automation
kubectl top nodes

# Check HPA status
kubectl get hpa -n business-automation

# Check metrics
kubectl exec -it deployment/business-automation-api-gateway -n business-automation -- \
  curl http://localhost:3000/metrics
```

### Debugging Tools

```bash
# Interactive shell in pod
kubectl exec -it deployment/business-automation-api-gateway -n business-automation -- /bin/sh

# Port forward for local debugging
kubectl port-forward deployment/business-automation-api-gateway 3000:3000 -n business-automation

# Copy files from pod
kubectl cp business-automation/pod-name:/app/logs/app.log ./local-app.log
```

### Log Analysis

```bash
# Stream logs from all pods
kubectl logs -f -l app=business-automation -n business-automation

# Get logs from specific time range
kubectl logs deployment/business-automation-api-gateway -n business-automation --since=1h

# Export logs for analysis
kubectl logs deployment/business-automation-api-gateway -n business-automation > api-gateway.log
```

## Maintenance and Operations

### Regular Maintenance Tasks

#### 1. Security Updates

```bash
# Update base images monthly
docker pull node:18-alpine
docker pull python:3.11-slim
docker pull nginx:alpine

# Rebuild and deploy with updated images
make build push deploy ENVIRONMENT=production
```

#### 2. Database Maintenance

```bash
# Backup database
make backup-db ENVIRONMENT=production

# Check database performance
kubectl exec -it deployment/mongodb -n business-automation -- \
  mongo --eval "db.stats()"

# Optimize indexes
kubectl exec -it deployment/mongodb -n business-automation -- \
  mongo --eval "db.runCommand({reIndex: 'collection-name'})"
```

#### 3. Certificate Renewal

```bash
# Check certificate expiration
kubectl get certificates -n business-automation

# Force certificate renewal if needed
kubectl delete certificate business-automation-tls -n business-automation
kubectl apply -f services/k8s/ingress.yaml
```

#### 4. Scaling Operations

```bash
# Manual scaling
kubectl scale deployment business-automation-api-gateway --replicas=5 -n business-automation

# Update HPA settings
kubectl patch hpa business-automation-hpa -n business-automation -p '{"spec":{"maxReplicas":10}}'

# Check cluster autoscaler
kubectl get nodes
kubectl describe nodes
```

### Backup and Recovery

#### Database Backup

```bash
# Automated backup (scheduled via CronJob)
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: business-automation
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:5.0
            command:
            - /bin/bash
            - -c
            - |
              mongodump --uri="\$MONGODB_URI" --archive | \
              aws s3 cp - s3://backup-bucket/mongodb/backup-\$(date +%Y%m%d-%H%M%S).archive
            env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: business-automation-secrets
                  key: MONGODB_URI
          restartPolicy: OnFailure
EOF
```

#### Application State Backup

```bash
# Backup Kubernetes resources
kubectl get all -n business-automation -o yaml > business-automation-backup.yaml

# Backup secrets (encrypted)
kubectl get secrets -n business-automation -o yaml > secrets-backup.yaml
```

### Disaster Recovery

#### Recovery Procedures

1. **Infrastructure Recovery**
   ```bash
   # Restore infrastructure with Terraform
   cd terraform
   terraform apply -var-file=environments/production.tfvars
   ```

2. **Database Recovery**
   ```bash
   # Restore from backup
   aws s3 cp s3://backup-bucket/mongodb/backup-20231201-020000.archive - | \
   kubectl exec -i deployment/mongodb -n business-automation -- mongorestore --archive
   ```

3. **Application Recovery**
   ```bash
   # Redeploy applications
   make deploy ENVIRONMENT=production
   
   # Verify deployment
   make verify ENVIRONMENT=production
   ```

### Performance Optimization

#### Resource Optimization

```bash
# Analyze resource usage
kubectl top pods -n business-automation --sort-by=cpu
kubectl top pods -n business-automation --sort-by=memory

# Update resource requests/limits based on usage
kubectl patch deployment business-automation-api-gateway -n business-automation -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","resources":{"requests":{"cpu":"500m","memory":"1Gi"},"limits":{"cpu":"2","memory":"4Gi"}}}]}}}}'
```

#### Database Optimization

```bash
# Monitor slow queries
kubectl exec -it deployment/mongodb -n business-automation -- \
  mongo --eval "db.setProfilingLevel(2, {slowms: 100})"

# Analyze query performance
kubectl exec -it deployment/mongodb -n business-automation -- \
  mongo --eval "db.system.profile.find().sort({ts: -1}).limit(5).pretty()"
```

### Monitoring and Alerting Maintenance

```bash
# Update Prometheus rules
kubectl apply -f services/k8s/monitoring/prometheus.yaml

# Restart Prometheus to reload config
kubectl rollout restart deployment/prometheus -n monitoring

# Test alert rules
kubectl exec -it deployment/prometheus -n monitoring -- \
  promtool query instant 'up{job="business-automation"} == 0'
```

## Best Practices

### 1. Deployment Best Practices

- Always use specific image tags, never `latest` in production
- Implement proper health checks for all services
- Use resource limits to prevent resource starvation
- Implement graceful shutdown handling
- Use multi-stage Docker builds for smaller images

### 2. Security Best Practices

- Regularly update base images and dependencies
- Use least privilege principle for service accounts
- Implement network policies to restrict traffic
- Encrypt sensitive data at rest and in transit
- Regular security audits and penetration testing

### 3. Monitoring Best Practices

- Monitor both technical and business metrics
- Set up meaningful alerts with proper thresholds
- Implement distributed tracing for complex workflows
- Regular review and update of monitoring rules
- Document runbooks for common issues

### 4. Operational Best Practices

- Automate repetitive tasks
- Implement proper backup and recovery procedures
- Regular disaster recovery testing
- Maintain up-to-date documentation
- Implement proper change management processes

## Support and Troubleshooting

For additional support:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review application logs and metrics
3. Consult the monitoring dashboards
4. Check the GitHub issues for known problems
5. Contact the development team for complex issues

## Appendix

### Useful Commands Reference

```bash
# Quick deployment status check
kubectl get all -n business-automation

# Resource usage summary
kubectl top pods -n business-automation --sort-by=memory

# Recent events
kubectl get events -n business-automation --sort-by='.lastTimestamp' | tail -10

# Service health check
for service in api-gateway task-orchestrator ai-ml-engine frontend; do
  echo "Checking $service..."
  kubectl exec deployment/business-automation-$service -n business-automation -- curl -f http://localhost:$(kubectl get svc business-automation-$service -n business-automation -o jsonpath='{.spec.ports[0].port}')/health
done

# Database connection test
kubectl exec deployment/business-automation-api-gateway -n business-automation -- \
  node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('DB OK')).catch(e => console.error('DB Error:', e.message))"
```

### Environment-Specific Configurations

| Configuration | Development | Staging | Production |
|---------------|-------------|---------|------------|
| Replicas (API Gateway) | 1 | 2 | 3 |
| Replicas (Task Orchestrator) | 1 | 2 | 2 |
| Replicas (AI/ML Engine) | 1 | 1 | 2 |
| CPU Requests | 100m | 200m | 500m |
| Memory Requests | 128Mi | 256Mi | 512Mi |
| Database Instance | t3.micro | t3.small | r5.large |
| Cache Instance | t3.micro | t3.small | r5.large |
| Monitoring | Basic | Full | Full + Alerting |
| Backup Retention | 1 day | 7 days | 30 days |

This deployment guide provides comprehensive instructions for deploying and maintaining the Business Automation Platform across different environments with proper DevOps practices, monitoring, and security considerations.