#!/bin/bash

# Blue-Green Deployment Script for Business Automation Platform
# This script implements zero-downtime deployments using blue-green strategy

set -euo pipefail

# Configuration
NAMESPACE="business-automation"
SERVICES=("api-gateway" "task-orchestrator" "ai-ml-engine" "frontend")
TIMEOUT="600s"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=30

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

# Function to check if kubectl is available and configured
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to get current deployment color (blue or green)
get_current_color() {
    local service=$1
    local deployment_name="business-automation-$service"
    
    if kubectl get deployment "$deployment_name" -n "$NAMESPACE" &> /dev/null; then
        echo "blue"
    elif kubectl get deployment "business-automation-green-$service" -n "$NAMESPACE" &> /dev/null; then
        echo "green"
    else
        echo "none"
    fi
}

# Function to get target color (opposite of current)
get_target_color() {
    local current_color=$1
    if [ "$current_color" = "blue" ]; then
        echo "green"
    elif [ "$current_color" = "green" ]; then
        echo "blue"
    else
        echo "blue"  # Default to blue if no current deployment
    fi
}

# Function to create green deployment manifests
create_green_manifests() {
    local image_tag=$1
    log_info "Creating green deployment manifests with image tag: $image_tag"
    
    # Copy original deployment file and modify for green deployment
    cp services/k8s/deployments.yaml services/k8s/deployments-green.yaml
    
    # Replace deployment names and labels for green deployment
    sed -i "s/name: business-automation-/name: business-automation-green-/g" services/k8s/deployments-green.yaml
    sed -i "s/component: /component: green-/g" services/k8s/deployments-green.yaml
    sed -i "s/business-automation\/\([^:]*\):latest/business-automation\/\1:$image_tag/g" services/k8s/deployments-green.yaml
    
    log_success "Green deployment manifests created"
}

# Function to deploy green environment
deploy_green() {
    local image_tag=$1
    log_info "Deploying green environment..."
    
    create_green_manifests "$image_tag"
    
    # Apply green deployment
    kubectl apply -f services/k8s/deployments-green.yaml
    
    # Wait for green deployments to be ready
    for service in "${SERVICES[@]}"; do
        log_info "Waiting for green deployment of $service to be ready..."
        kubectl rollout status deployment/business-automation-green-$service -n "$NAMESPACE" --timeout="$TIMEOUT"
    done
    
    log_success "Green environment deployed successfully"
}

# Function to run health checks on green environment
health_check_green() {
    log_info "Running health checks on green environment..."
    
    local all_healthy=true
    
    for service in "${SERVICES[@]}"; do
        log_info "Health checking green $service..."
        
        local retries=0
        local healthy=false
        
        while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
            if kubectl exec -n "$NAMESPACE" deployment/business-automation-green-$service -- curl -f http://localhost:$(get_service_port $service)/health &> /dev/null; then
                healthy=true
                break
            fi
            
            retries=$((retries + 1))
            log_warning "Health check failed for $service (attempt $retries/$HEALTH_CHECK_RETRIES)"
            sleep $HEALTH_CHECK_INTERVAL
        done
        
        if [ "$healthy" = false ]; then
            log_error "Health check failed for green $service after $HEALTH_CHECK_RETRIES attempts"
            all_healthy=false
        else
            log_success "Green $service is healthy"
        fi
    done
    
    if [ "$all_healthy" = false ]; then
        log_error "Green environment health checks failed"
        return 1
    fi
    
    log_success "All green services are healthy"
    return 0
}

# Function to get service port
get_service_port() {
    local service=$1
    case $service in
        "api-gateway") echo "3000" ;;
        "task-orchestrator") echo "3001" ;;
        "ai-ml-engine") echo "3002" ;;
        "frontend") echo "8080" ;;
        *) echo "8080" ;;
    esac
}

# Function to switch traffic to green
switch_traffic_to_green() {
    log_info "Switching traffic to green environment..."
    
    for service in "${SERVICES[@]}"; do
        log_info "Switching traffic for $service to green..."
        
        kubectl patch service business-automation-$service -n "$NAMESPACE" -p \
            "{\"spec\":{\"selector\":{\"app\":\"business-automation\",\"component\":\"green-$service\"}}}"
    done
    
    # Wait a bit for traffic to switch
    sleep 30
    
    log_success "Traffic switched to green environment"
}

# Function to verify traffic switch
verify_traffic_switch() {
    log_info "Verifying traffic switch..."
    
    # Run some basic connectivity tests
    for service in "${SERVICES[@]}"; do
        if [ "$service" != "frontend" ]; then  # Skip frontend for internal health checks
            log_info "Verifying $service connectivity..."
            
            if kubectl exec -n "$NAMESPACE" deployment/business-automation-green-$service -- curl -f http://localhost:$(get_service_port $service)/health &> /dev/null; then
                log_success "$service is responding correctly"
            else
                log_error "$service is not responding correctly"
                return 1
            fi
        fi
    done
    
    log_success "Traffic switch verification completed"
    return 0
}

# Function to cleanup old blue deployment
cleanup_blue() {
    log_info "Cleaning up old blue deployment..."
    
    for service in "${SERVICES[@]}"; do
        if kubectl get deployment business-automation-$service -n "$NAMESPACE" &> /dev/null; then
            log_info "Deleting old blue deployment for $service..."
            kubectl delete deployment business-automation-$service -n "$NAMESPACE" --ignore-not-found=true
        fi
    done
    
    log_success "Old blue deployment cleaned up"
}

# Function to promote green to blue
promote_green_to_blue() {
    log_info "Promoting green deployment to blue..."
    
    for service in "${SERVICES[@]}"; do
        log_info "Promoting green $service to blue..."
        
        # Update service selector back to blue
        kubectl patch service business-automation-$service -n "$NAMESPACE" -p \
            "{\"spec\":{\"selector\":{\"app\":\"business-automation\",\"component\":\"$service\"}}}"
        
        # Rename green deployment to blue
        kubectl get deployment business-automation-green-$service -n "$NAMESPACE" -o yaml | \
            sed "s/name: business-automation-green-$service/name: business-automation-$service/g" | \
            sed "s/component: green-$service/component: $service/g" | \
            kubectl apply -f -
        
        # Delete the old green deployment
        kubectl delete deployment business-automation-green-$service -n "$NAMESPACE" --ignore-not-found=true
    done
    
    log_success "Green deployment promoted to blue"
}

# Function to rollback to blue (in case of failure)
rollback_to_blue() {
    log_error "Rolling back to blue environment..."
    
    for service in "${SERVICES[@]}"; do
        log_info "Rolling back $service to blue..."
        
        # Switch service selector back to blue
        kubectl patch service business-automation-$service -n "$NAMESPACE" -p \
            "{\"spec\":{\"selector\":{\"app\":\"business-automation\",\"component\":\"$service\"}}}"
    done
    
    # Clean up failed green deployment
    for service in "${SERVICES[@]}"; do
        kubectl delete deployment business-automation-green-$service -n "$NAMESPACE" --ignore-not-found=true
    done
    
    # Clean up temporary files
    rm -f services/k8s/deployments-green.yaml
    
    log_error "Rollback completed. System is running on blue environment."
}

# Function to run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Basic API connectivity test
    if kubectl exec -n "$NAMESPACE" deployment/business-automation-api-gateway -- curl -f http://localhost:3000/api/health &> /dev/null; then
        log_success "API Gateway smoke test passed"
    else
        log_error "API Gateway smoke test failed"
        return 1
    fi
    
    # Task orchestrator connectivity test
    if kubectl exec -n "$NAMESPACE" deployment/business-automation-task-orchestrator -- curl -f http://localhost:3001/health &> /dev/null; then
        log_success "Task Orchestrator smoke test passed"
    else
        log_error "Task Orchestrator smoke test failed"
        return 1
    fi
    
    log_success "All smoke tests passed"
    return 0
}

# Main deployment function
main() {
    local image_tag=${1:-"latest"}
    local skip_tests=${2:-"false"}
    
    log_info "Starting blue-green deployment with image tag: $image_tag"
    
    # Check prerequisites
    check_prerequisites
    
    # Determine current and target colors
    local current_color=$(get_current_color "api-gateway")
    local target_color=$(get_target_color "$current_color")
    
    log_info "Current color: $current_color, Target color: $target_color"
    
    # Set up error handling
    trap 'rollback_to_blue' ERR
    
    # Deploy green environment
    deploy_green "$image_tag"
    
    # Run health checks on green
    if ! health_check_green; then
        log_error "Green environment health checks failed, aborting deployment"
        rollback_to_blue
        exit 1
    fi
    
    # Switch traffic to green
    switch_traffic_to_green
    
    # Verify traffic switch
    if ! verify_traffic_switch; then
        log_error "Traffic switch verification failed, rolling back"
        rollback_to_blue
        exit 1
    fi
    
    # Run smoke tests (unless skipped)
    if [ "$skip_tests" != "true" ]; then
        if ! run_smoke_tests; then
            log_error "Smoke tests failed, rolling back"
            rollback_to_blue
            exit 1
        fi
    fi
    
    # Clean up old blue deployment
    cleanup_blue
    
    # Promote green to blue
    promote_green_to_blue
    
    # Clean up temporary files
    rm -f services/k8s/deployments-green.yaml
    
    log_success "Blue-green deployment completed successfully!"
    log_info "New deployment is now live and serving traffic"
}

# Script usage
usage() {
    echo "Usage: $0 [IMAGE_TAG] [SKIP_TESTS]"
    echo "  IMAGE_TAG: Docker image tag to deploy (default: latest)"
    echo "  SKIP_TESTS: Skip smoke tests (true/false, default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy latest with tests"
    echo "  $0 v1.2.3            # Deploy specific version with tests"
    echo "  $0 v1.2.3 true       # Deploy specific version without tests"
}

# Handle command line arguments
if [ "$#" -gt 2 ]; then
    usage
    exit 1
fi

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"