# Business Automation System - Deployment Makefile

# Configuration
ENVIRONMENT ?= development
NAMESPACE = business-automation
DOCKER_REGISTRY ?= ghcr.io/your-org/business-automation
VERSION ?= latest

# Terraform configuration
TF_DIR = terraform
TF_VAR_FILE = $(TF_DIR)/environments/$(ENVIRONMENT).tfvars

# Colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

.PHONY: help build test deploy verify rollback clean

help: ## Show this help message
	@echo "Business Automation System - Deployment Commands"
	@echo ""
	@echo "Usage: make [target] [ENVIRONMENT=env]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Environments: development, staging, production"
	@echo "Default environment: $(ENVIRONMENT)"

# Build targets
build: ## Build all Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker build -f services/Dockerfile.api-gateway -t $(DOCKER_REGISTRY)/api-gateway:$(VERSION) services/
	docker build -f services/Dockerfile.task-orchestrator -t $(DOCKER_REGISTRY)/task-orchestrator:$(VERSION) services/
	docker build -f services/Dockerfile.ai-ml-engine -t $(DOCKER_REGISTRY)/ai-ml-engine:$(VERSION) services/
	docker build -f client/Dockerfile -t $(DOCKER_REGISTRY)/frontend:$(VERSION) client/

build-api-gateway: ## Build API Gateway image
	@echo "$(GREEN)Building API Gateway image...$(NC)"
	docker build -f services/Dockerfile.api-gateway -t $(DOCKER_REGISTRY)/api-gateway:$(VERSION) services/

build-task-orchestrator: ## Build Task Orchestrator image
	@echo "$(GREEN)Building Task Orchestrator image...$(NC)"
	docker build -f services/Dockerfile.task-orchestrator -t $(DOCKER_REGISTRY)/task-orchestrator:$(VERSION) services/

build-ai-ml-engine: ## Build AI/ML Engine image
	@echo "$(GREEN)Building AI/ML Engine image...$(NC)"
	docker build -f services/Dockerfile.ai-ml-engine -t $(DOCKER_REGISTRY)/ai-ml-engine:$(VERSION) services/

build-frontend: ## Build Frontend image
	@echo "$(GREEN)Building Frontend image...$(NC)"
	docker build -f client/Dockerfile -t $(DOCKER_REGISTRY)/frontend:$(VERSION) client/

push: build ## Push all Docker images to registry
	@echo "$(GREEN)Pushing Docker images to registry...$(NC)"
	docker push $(DOCKER_REGISTRY)/api-gateway:$(VERSION)
	docker push $(DOCKER_REGISTRY)/task-orchestrator:$(VERSION)
	docker push $(DOCKER_REGISTRY)/ai-ml-engine:$(VERSION)
	docker push $(DOCKER_REGISTRY)/frontend:$(VERSION)

# Test targets
test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	cd services && npm test
	cd client && npm test

test-services: ## Run service tests
	@echo "$(GREEN)Running service tests...$(NC)"
	cd services && npm test

test-client: ## Run client tests
	@echo "$(GREEN)Running client tests...$(NC)"
	cd client && npm test

test-e2e: ## Run end-to-end tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	cd client && npm run cypress:run

lint: ## Run linting
	@echo "$(GREEN)Running linting...$(NC)"
	cd services && npm run lint
	cd client && npm run lint

# Infrastructure targets
tf-init: ## Initialize Terraform
	@echo "$(GREEN)Initializing Terraform...$(NC)"
	cd $(TF_DIR) && terraform init

tf-plan: ## Plan Terraform changes
	@echo "$(GREEN)Planning Terraform changes for $(ENVIRONMENT)...$(NC)"
	cd $(TF_DIR) && terraform plan -var-file=$(ENVIRONMENT).tfvars

tf-apply: ## Apply Terraform changes
	@echo "$(GREEN)Applying Terraform changes for $(ENVIRONMENT)...$(NC)"
	cd $(TF_DIR) && terraform apply -var-file=$(ENVIRONMENT).tfvars

tf-destroy: ## Destroy Terraform infrastructure
	@echo "$(RED)Destroying Terraform infrastructure for $(ENVIRONMENT)...$(NC)"
	@read -p "Are you sure you want to destroy $(ENVIRONMENT) infrastructure? (y/N): " confirm && [ "$$confirm" = "y" ]
	cd $(TF_DIR) && terraform destroy -var-file=$(ENVIRONMENT).tfvars

# Kubernetes targets
k8s-namespace: ## Create Kubernetes namespace
	@echo "$(GREEN)Creating namespace for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/namespace.yaml

k8s-secrets: ## Apply Kubernetes secrets
	@echo "$(GREEN)Applying secrets for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/secrets.yaml
	kubectl apply -f services/k8s/environments/$(ENVIRONMENT).yaml

k8s-config: ## Apply Kubernetes configuration
	@echo "$(GREEN)Applying configuration for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/configmap.yaml
	kubectl apply -f services/k8s/rbac.yaml

k8s-storage: ## Deploy storage components
	@echo "$(GREEN)Deploying storage components for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/statefulsets.yaml

k8s-services: ## Deploy application services
	@echo "$(GREEN)Deploying services for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/deployments.yaml
	kubectl apply -f services/k8s/services.yaml

k8s-ingress: ## Deploy ingress
	@echo "$(GREEN)Deploying ingress for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/ingress.yaml

k8s-monitoring: ## Deploy monitoring stack
	@echo "$(GREEN)Deploying monitoring stack...$(NC)"
	kubectl apply -f services/k8s/monitoring/prometheus.yaml
	kubectl apply -f services/k8s/monitoring/grafana.yaml

k8s-autoscaling: ## Deploy autoscaling
	@echo "$(GREEN)Deploying autoscaling for $(ENVIRONMENT)...$(NC)"
	kubectl apply -f services/k8s/hpa.yaml
	kubectl apply -f services/k8s/vpa.yaml

# Deployment targets
deploy-infrastructure: tf-init tf-apply ## Deploy infrastructure with Terraform
	@echo "$(GREEN)Infrastructure deployment completed for $(ENVIRONMENT)$(NC)"

deploy-k8s: k8s-namespace k8s-secrets k8s-config k8s-storage k8s-services k8s-ingress k8s-autoscaling ## Deploy to Kubernetes
	@echo "$(GREEN)Kubernetes deployment completed for $(ENVIRONMENT)$(NC)"

deploy: build push deploy-k8s ## Full deployment (build, push, deploy)
	@echo "$(GREEN)Full deployment completed for $(ENVIRONMENT)$(NC)"

deploy-monitoring: k8s-monitoring ## Deploy monitoring stack
	@echo "$(GREEN)Monitoring deployment completed$(NC)"

# Verification and maintenance targets
verify: ## Verify deployment
	@echo "$(GREEN)Verifying deployment for $(ENVIRONMENT)...$(NC)"
	./scripts/deployment-verification.sh $(ENVIRONMENT)

performance-test: ## Run performance tests
	@echo "$(GREEN)Running performance tests for $(ENVIRONMENT)...$(NC)"
	./scripts/performance-tests.sh $(ENVIRONMENT)

rollback: ## Rollback deployment
	@echo "$(YELLOW)Rolling back deployment for $(ENVIRONMENT)...$(NC)"
	./scripts/rollback-deployment.sh $(ENVIRONMENT)

logs: ## Show application logs
	@echo "$(GREEN)Showing logs for $(ENVIRONMENT)...$(NC)"
	kubectl logs -f -l app=business-automation -n $(NAMESPACE)-$(ENVIRONMENT) --max-log-requests=10

status: ## Show deployment status
	@echo "$(GREEN)Deployment status for $(ENVIRONMENT):$(NC)"
	@echo ""
	@echo "Deployments:"
	kubectl get deployments -n $(NAMESPACE)-$(ENVIRONMENT) -o wide
	@echo ""
	@echo "Pods:"
	kubectl get pods -n $(NAMESPACE)-$(ENVIRONMENT) -o wide
	@echo ""
	@echo "Services:"
	kubectl get services -n $(NAMESPACE)-$(ENVIRONMENT) -o wide

# Development targets
dev-up: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker-compose up -d

dev-down: ## Stop development environment
	@echo "$(GREEN)Stopping development environment...$(NC)"
	docker-compose down

dev-logs: ## Show development logs
	@echo "$(GREEN)Showing development logs...$(NC)"
	docker-compose logs -f

dev-restart: ## Restart development environment
	@echo "$(GREEN)Restarting development environment...$(NC)"
	docker-compose restart

# Cleanup targets
clean: ## Clean up local Docker images
	@echo "$(GREEN)Cleaning up Docker images...$(NC)"
	docker image prune -f
	docker system prune -f

clean-all: ## Clean up everything (images, containers, volumes)
	@echo "$(RED)Cleaning up everything...$(NC)"
	@read -p "This will remove all Docker containers, images, and volumes. Continue? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker system prune -a -f --volumes

# Security targets
security-scan: ## Run security scans
	@echo "$(GREEN)Running security scans...$(NC)"
	docker run --rm -v $(PWD):/app aquasec/trivy fs /app

# Backup targets
backup-db: ## Backup database
	@echo "$(GREEN)Backing up database for $(ENVIRONMENT)...$(NC)"
	kubectl exec -n $(NAMESPACE)-$(ENVIRONMENT) deployment/mongodb -- mongodump --archive | gzip > backup-$(ENVIRONMENT)-$(shell date +%Y%m%d-%H%M%S).gz

restore-db: ## Restore database (requires BACKUP_FILE variable)
	@echo "$(GREEN)Restoring database for $(ENVIRONMENT)...$(NC)"
	@test -n "$(BACKUP_FILE)" || (echo "$(RED)BACKUP_FILE variable is required$(NC)" && exit 1)
	gunzip -c $(BACKUP_FILE) | kubectl exec -i -n $(NAMESPACE)-$(ENVIRONMENT) deployment/mongodb -- mongorestore --archive

# Environment-specific shortcuts
dev: ENVIRONMENT=development
dev: deploy ## Deploy to development

staging: ENVIRONMENT=staging
staging: deploy ## Deploy to staging

production: ENVIRONMENT=production
production: deploy ## Deploy to production