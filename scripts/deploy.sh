#!/bin/bash

# Comprehensive Deployment Script for Business Automation Platform
# This script orchestrates the entire deployment process with environment-specific configurations

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-development}
IMAGE_TAG=${2:-latest}
DEPLOYMENT_TYPE=${3:-rolling}  # rolling, blue-green, canary
SKIP_TESTS=${4:-false}
DRY_RUN=${5:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration based on environment
case $ENVIRONMENT in
    development)
        NAMESPACE="business-automation-dev"
        REPLICAS_API_GATEWAY=1
        REPLICAS_TASK_ORCHESTRATOR=1
        REPLICAS_AI_ML_ENGINE=1
        REPLICAS_FRONTEND=1
        ;;
    staging)
        NAMESPACE="business-automation-staging"
        REPLICAS_API_GATEWAY=2
        REPLICAS_TASK_ORCHESTRATOR=2
        REPLICAS_AI_ML_ENGINE=1
        REPLICAS_FRONTEND=2
        ;;
    production)
        NAMESPACE="business-automation"
        REPLICAS_API_GATEWAY=3
        REPLICAS_TASK_ORCHESTRATOR=2
        REPLICAS_AI_ML_ENGINE=2
        REPLICAS_FRONTEND=2
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    # Check if required files exist
    local required_files=(
        "services/k8s/namespace.yaml"
        "services/k8s/deployments.yaml"
        "services/k8s/services.yaml"
        "services/k8s/environments/${ENVIRONMENT}.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Function to create namespace if it doesn't exist
ensure_namespace() {
    log_info "Ensuring namespace $NAMESPACE exists..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace $NAMESPACE..."
        
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would create namespace $NAMESPACE"
        else
            kubectl create namespace "$NAMESPACE"
            kubectl label namespace "$NAMESPACE" name="$NAMESPACE" environment="$ENVIRONMENT"
        fi
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}

# Function to apply environment-specific configurations
apply_environment_config() {
    log_info "Applying environment-specific configuration for $ENVIRONMENT..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would apply environment configuration"
        kubectl apply -f "services/k8s/environments/${ENVIRONMENT}.yaml" --dry-run=client
    else
        kubectl apply -f "services/k8s/environments/${ENVIRONMENT}.yaml"
    fi
    
    log_success "Environment configuration applied"
}

# Function to update deployment manifests with image tags and replicas
update_deployment_manifests() {
    log_info "Updating deployment manifests with image tag: $IMAGE_TAG"
    
    # Create temporary deployment file
    local temp_deployment="services/k8s/deployments-${ENVIRONMENT}.yaml"
    cp services/k8s/deployments.yaml "$temp_deployment"
    
    # Update image tags
    sed -i "s|business-automation/api-gateway:latest|ghcr.io/business-automation/api-gateway:$IMAGE_TAG|g" "$temp_deployment"
    sed -i "s|business-automation/task-orchestrator:latest|ghcr.io/business-automation/task-orchestrator:$IMAGE_TAG|g" "$temp_deployment"
    sed -i "s|business-automation/ai-ml-engine:latest|ghcr.io/business-automation/ai-ml-engine:$IMAGE_TAG|g" "$temp_deployment"
    sed -i "s|business-automation/frontend:latest|ghcr.io/business-automation/frontend:$IMAGE_TAG|g" "$temp_deployment"
    
    # Update replica counts based on environment
    sed -i "s/replicas: 3  # api-gateway/replicas: $REPLICAS_API_GATEWAY/g" "$temp_deployment"
    sed -i "s/replicas: 2  # task-orchestrator/replicas: $REPLICAS_TASK_ORCHESTRATOR/g" "$temp_deployment"
    sed -i "s/replicas: 2  # ai-ml-engine/replicas: $REPLICAS_AI_ML_ENGINE/g" "$temp_deployment"
    sed -i "s/replicas: 2  # frontend/replicas: $REPLICAS_FRONTEND/g" "$temp_deployment"
    
    # Update namespace
    sed -i "s/namespace: business-automation/namespace: $NAMESPACE/g" "$temp_deployment"
    
    log_success "Deployment manifests updated"
    echo "$temp_deployment"
}

# Function to deploy infrastructure components
deploy_infrastructure() {
    log_info "Deploying infrastructure components..."
    
    local components=(
        "services/k8s/rbac.yaml"
        "services/k8s/configmap.yaml"
        "services/k8s/secrets.yaml"
    )
    
    for component in "${components[@]}"; do
        if [ -f "$component" ]; then
            log_info "Applying $component..."
            
            if [ "$DRY_RUN" = "true" ]; then
                log_info "[DRY RUN] Would apply $component"
                kubectl apply -f "$component" --dry-run=client
            else
                kubectl apply -f "$component"
            fi
        else
            log_warning "Component file not found: $component"
        fi
    done
    
    log_success "Infrastructure components deployed"
}

# Function to deploy stateful services (databases)
deploy_stateful_services() {
    log_info "Deploying stateful services..."
    
    if [ -f "services/k8s/statefulsets.yaml" ]; then
        log_info "Applying statefulsets..."
        
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would apply statefulsets"
            kubectl apply -f "services/k8s/statefulsets.yaml" --dry-run=client
        else
            kubectl apply -f "services/k8s/statefulsets.yaml"
            
            # Wait for stateful services to be ready
            log_info "Waiting for stateful services to be ready..."
            kubectl wait --for=condition=ready pod -l app=mongodb -n "$NAMESPACE" --timeout=300s || log_warning "MongoDB pods not ready within timeout"
            kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=300s || log_warning "Redis pods not ready within timeout"
        fi
    else
        log_info "No statefulsets configuration found, skipping"
    fi
}

# Function to perform rolling deployment
rolling_deployment() {
    local deployment_file=$1
    
    log_info "Performing rolling deployment..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would apply deployments"
        kubectl apply -f "$deployment_file" --dry-run=client
    else
        kubectl apply -f "$deployment_file"
        
        # Wait for rollout to complete
        local deployments=("api-gateway" "task-orchestrator" "ai-ml-engine" "frontend")
        for deployment in "${deployments[@]}"; do
            log_info "Waiting for $deployment rollout to complete..."
            kubectl rollout status deployment/business-automation-$deployment -n "$NAMESPACE" --timeout=600s
        done
    fi
    
    log_success "Rolling deployment completed"
}

# Function to perform blue-green deployment
blue_green_deployment() {
    local deployment_file=$1
    
    log_info "Performing blue-green deployment..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would perform blue-green deployment"
        return 0
    fi
    
    if [ -f "scripts/blue-green-deploy.sh" ]; then
        bash scripts/blue-green-deploy.sh "$IMAGE_TAG" "$SKIP_TESTS"
    else
        log_error "Blue-green deployment script not found"
        return 1
    fi
}

# Function to deploy services and networking
deploy_services() {
    log_info "Deploying services and networking..."
    
    local networking_components=(
        "services/k8s/services.yaml"
        "services/k8s/ingress.yaml"
    )
    
    for component in "${networking_components[@]}"; do
        if [ -f "$component" ]; then
            log_info "Applying $component..."
            
            if [ "$DRY_RUN" = "true" ]; then
                log_info "[DRY RUN] Would apply $component"
                kubectl apply -f "$component" --dry-run=client
            else
                kubectl apply -f "$component"
            fi
        fi
    done
    
    log_success "Services and networking deployed"
}

# Function to deploy autoscaling
deploy_autoscaling() {
    log_info "Deploying autoscaling configurations..."
    
    local autoscaling_components=(
        "services/k8s/hpa.yaml"
        "services/k8s/vpa.yaml"
    )
    
    for component in "${autoscaling_components[@]}"; do
        if [ -f "$component" ]; then
            log_info "Applying $component..."
            
            if [ "$DRY_RUN" = "true" ]; then
                log_info "[DRY RUN] Would apply $component"
                kubectl apply -f "$component" --dry-run=client
            else
                kubectl apply -f "$component"
            fi
        fi
    done
    
    log_success "Autoscaling configurations deployed"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Create monitoring namespace if it doesn't exist
    if ! kubectl get namespace monitoring &> /dev/null; then
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would create monitoring namespace"
        else
            kubectl create namespace monitoring
        fi
    fi
    
    local monitoring_components=(
        "services/k8s/monitoring/prometheus.yaml"
        "services/k8s/monitoring/grafana.yaml"
        "services/k8s/monitoring/alertmanager.yaml"
    )
    
    for component in "${monitoring_components[@]}"; do
        if [ -f "$component" ]; then
            log_info "Applying $component..."
            
            if [ "$DRY_RUN" = "true" ]; then
                log_info "[DRY RUN] Would apply $component"
                kubectl apply -f "$component" --dry-run=client
            else
                kubectl apply -f "$component"
            fi
        fi
    done
    
    log_success "Monitoring stack deployed"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_info "Skipping post-deployment tests"
        return 0
    fi
    
    log_info "Running post-deployment tests..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would run post-deployment tests"
        return 0
    fi
    
    # Run deployment verification
    if [ -f "scripts/deployment-verification.sh" ]; then
        if bash scripts/deployment-verification.sh "$ENVIRONMENT"; then
            log_success "Post-deployment tests passed"
        else
            log_error "Post-deployment tests failed"
            return 1
        fi
    else
        log_warning "Deployment verification script not found"
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local report_file="deployment-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    log_info "Generating deployment report: $report_file"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would generate deployment report"
        return 0
    fi
    
    {
        echo "Deployment Report"
        echo "================="
        echo "Environment: $ENVIRONMENT"
        echo "Namespace: $NAMESPACE"
        echo "Image Tag: $IMAGE_TAG"
        echo "Deployment Type: $DEPLOYMENT_TYPE"
        echo "Duration: ${duration}s"
        echo "Timestamp: $(date)"
        echo ""
        
        echo "Deployment Status:"
        kubectl get deployments -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Pod Status:"
        kubectl get pods -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Service Status:"
        kubectl get services -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Ingress Status:"
        kubectl get ingress -n "$NAMESPACE" -o wide
        echo ""
        
        echo "HPA Status:"
        kubectl get hpa -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Recent Events:"
        kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20
        
    } > "$report_file"
    
    log_success "Deployment report saved to: $report_file"
}

# Function to cleanup temporary files
cleanup() {
    log_info "Cleaning up temporary files..."
    
    local temp_files=(
        "services/k8s/deployments-${ENVIRONMENT}.yaml"
    )
    
    for file in "${temp_files[@]}"; do
        if [ -f "$file" ]; then
            rm -f "$file"
            log_info "Removed temporary file: $file"
        fi
    done
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Namespace: $NAMESPACE"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Running in DRY RUN mode - no changes will be applied"
    fi
    
    # Set up cleanup on exit
    trap cleanup EXIT
    
    # Check prerequisites
    check_prerequisites
    
    # Ensure namespace exists
    ensure_namespace
    
    # Apply environment-specific configuration
    apply_environment_config
    
    # Deploy infrastructure components
    deploy_infrastructure
    
    # Deploy stateful services first
    deploy_stateful_services
    
    # Update deployment manifests
    local deployment_file
    deployment_file=$(update_deployment_manifests)
    
    # Perform deployment based on type
    case $DEPLOYMENT_TYPE in
        rolling)
            rolling_deployment "$deployment_file"
            ;;
        blue-green)
            blue_green_deployment "$deployment_file"
            ;;
        canary)
            log_warning "Canary deployment not implemented yet, falling back to rolling"
            rolling_deployment "$deployment_file"
            ;;
        *)
            log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    # Deploy services and networking
    deploy_services
    
    # Deploy autoscaling
    deploy_autoscaling
    
    # Deploy monitoring (only for staging and production)
    if [[ "$ENVIRONMENT" == "staging" || "$ENVIRONMENT" == "production" ]]; then
        deploy_monitoring
    fi
    
    # Run post-deployment tests
    run_post_deployment_tests
    
    # Generate deployment report
    generate_deployment_report "$start_time"
    
    log_success "Deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Namespace: $NAMESPACE"
}

# Script usage
usage() {
    echo "Usage: $0 [ENVIRONMENT] [IMAGE_TAG] [DEPLOYMENT_TYPE] [SKIP_TESTS] [DRY_RUN]"
    echo ""
    echo "Parameters:"
    echo "  ENVIRONMENT      Target environment (development|staging|production, default: development)"
    echo "  IMAGE_TAG        Docker image tag to deploy (default: latest)"
    echo "  DEPLOYMENT_TYPE  Deployment strategy (rolling|blue-green|canary, default: rolling)"
    echo "  SKIP_TESTS       Skip post-deployment tests (true|false, default: false)"
    echo "  DRY_RUN          Perform dry run without applying changes (true|false, default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy development with latest images"
    echo "  $0 staging v1.2.3                    # Deploy staging with specific version"
    echo "  $0 production v1.2.3 blue-green      # Blue-green deployment to production"
    echo "  $0 staging v1.2.3 rolling true       # Deploy staging, skip tests"
    echo "  $0 production v1.2.3 rolling false true  # Dry run production deployment"
}

# Handle command line arguments
if [ "$#" -gt 5 ]; then
    usage
    exit 1
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

# Validate environment parameter
if [ -n "${1:-}" ] && [[ ! "$1" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $1"
    usage
    exit 1
fi

# Validate deployment type parameter
if [ -n "${3:-}" ] && [[ ! "$3" =~ ^(rolling|blue-green|canary)$ ]]; then
    log_error "Invalid deployment type: $3"
    usage
    exit 1
fi

# Validate boolean parameters
if [ -n "${4:-}" ] && [[ ! "$4" =~ ^(true|false)$ ]]; then
    log_error "Invalid SKIP_TESTS value: $4 (must be true or false)"
    usage
    exit 1
fi

if [ -n "${5:-}" ] && [[ ! "$5" =~ ^(true|false)$ ]]; then
    log_error "Invalid DRY_RUN value: $5 (must be true or false)"
    usage
    exit 1
fi

# Run main function
main