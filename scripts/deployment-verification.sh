#!/bin/bash

# Deployment Verification Script for Business Automation System
# Usage: ./deployment-verification.sh [environment]

set -euo pipefail

ENVIRONMENT=${1:-production}
NAMESPACE="business-automation"
if [ "$ENVIRONMENT" != "production" ]; then
    NAMESPACE="business-automation-$ENVIRONMENT"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
TIMEOUT=300
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=10

# Services to verify
SERVICES=(
    "business-automation-api-gateway:3000"
    "business-automation-task-orchestrator:3001"
    "business-automation-ai-ml-engine:3002"
    "business-automation-frontend:80"
)

DEPLOYMENTS=(
    "business-automation-api-gateway"
    "business-automation-task-orchestrator"
    "business-automation-ai-ml-engine"
    "business-automation-frontend"
)

STATEFULSETS=(
    "mongodb"
    "redis"
)

# Function to check if kubectl is available and configured
check_kubectl() {
    log_info "Checking kubectl configuration..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    log_info "kubectl is configured and cluster is accessible"
}

# Function to check namespace exists
check_namespace() {
    log_info "Checking namespace: $NAMESPACE"
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log_info "Namespace $NAMESPACE exists"
}

# Function to check deployment status
check_deployments() {
    log_info "Checking deployment status..."
    
    local failed_deployments=()
    
    for deployment in "${DEPLOYMENTS[@]}"; do
        log_info "Checking deployment: $deployment"
        
        # Check if deployment exists
        if ! kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            log_error "Deployment $deployment does not exist"
            failed_deployments+=("$deployment")
            continue
        fi
        
        # Check deployment rollout status
        if ! kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
            log_error "Deployment $deployment rollout failed or timed out"
            failed_deployments+=("$deployment")
            continue
        fi
        
        # Check replica count
        local desired=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        local ready=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        
        if [ "$desired" != "$ready" ]; then
            log_error "Deployment $deployment: desired replicas ($desired) != ready replicas ($ready)"
            failed_deployments+=("$deployment")
            continue
        fi
        
        log_info "Deployment $deployment is healthy (${ready}/${desired} replicas ready)"
    done
    
    if [ ${#failed_deployments[@]} -gt 0 ]; then
        log_error "Failed deployments: ${failed_deployments[*]}"
        return 1
    fi
    
    log_info "All deployments are healthy"
}

# Function to check statefulset status
check_statefulsets() {
    log_info "Checking statefulset status..."
    
    local failed_statefulsets=()
    
    for statefulset in "${STATEFULSETS[@]}"; do
        log_info "Checking statefulset: $statefulset"
        
        # Check if statefulset exists
        if ! kubectl get statefulset "$statefulset" -n "$NAMESPACE" &> /dev/null; then
            log_warn "StatefulSet $statefulset does not exist (may be external)"
            continue
        fi
        
        # Check statefulset rollout status
        if ! kubectl rollout status statefulset/"$statefulset" -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
            log_error "StatefulSet $statefulset rollout failed or timed out"
            failed_statefulsets+=("$statefulset")
            continue
        fi
        
        # Check replica count
        local desired=$(kubectl get statefulset "$statefulset" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        local ready=$(kubectl get statefulset "$statefulset" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        
        if [ "$desired" != "$ready" ]; then
            log_error "StatefulSet $statefulset: desired replicas ($desired) != ready replicas ($ready)"
            failed_statefulsets+=("$statefulset")
            continue
        fi
        
        log_info "StatefulSet $statefulset is healthy (${ready}/${desired} replicas ready)"
    done
    
    if [ ${#failed_statefulsets[@]} -gt 0 ]; then
        log_error "Failed statefulsets: ${failed_statefulsets[*]}"
        return 1
    fi
    
    log_info "All statefulsets are healthy"
}

# Function to check pod status
check_pods() {
    log_info "Checking pod status..."
    
    # Get all pods in the namespace
    local pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$pods" ]; then
        log_error "No pods found in namespace $NAMESPACE"
        return 1
    fi
    
    local failed_pods=()
    
    for pod in $pods; do
        local status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local ready=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [ "$status" != "Running" ] || [ "$ready" != "True" ]; then
            log_error "Pod $pod is not ready (Status: $status, Ready: $ready)"
            failed_pods+=("$pod")
            
            # Show pod events for debugging
            log_info "Events for pod $pod:"
            kubectl describe pod "$pod" -n "$NAMESPACE" | tail -10
        else
            log_info "Pod $pod is running and ready"
        fi
    done
    
    if [ ${#failed_pods[@]} -gt 0 ]; then
        log_error "Failed pods: ${failed_pods[*]}"
        return 1
    fi
    
    log_info "All pods are running and ready"
}

# Function to check service endpoints
check_services() {
    log_info "Checking service endpoints..."
    
    local failed_services=()
    
    for service_port in "${SERVICES[@]}"; do
        local service=$(echo "$service_port" | cut -d: -f1)
        local port=$(echo "$service_port" | cut -d: -f2)
        
        log_info "Checking service: $service"
        
        # Check if service exists
        if ! kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
            log_error "Service $service does not exist"
            failed_services+=("$service")
            continue
        fi
        
        # Check if service has endpoints
        local endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}')
        
        if [ -z "$endpoints" ]; then
            log_error "Service $service has no endpoints"
            failed_services+=("$service")
            continue
        fi
        
        log_info "Service $service has endpoints: $endpoints"
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        log_error "Failed services: ${failed_services[*]}"
        return 1
    fi
    
    log_info "All services have healthy endpoints"
}

# Function to perform health checks
perform_health_checks() {
    log_info "Performing application health checks..."
    
    local failed_health_checks=()
    
    for service_port in "${SERVICES[@]}"; do
        local service=$(echo "$service_port" | cut -d: -f1)
        local port=$(echo "$service_port" | cut -d: -f2)
        
        log_info "Health checking service: $service"
        
        # Get a pod for the service
        local pod=$(kubectl get pods -n "$NAMESPACE" -l "app=business-automation,component=${service#business-automation-}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [ -z "$pod" ]; then
            log_warn "No pods found for service $service, skipping health check"
            continue
        fi
        
        # Perform health check with retries
        local success=false
        for ((i=1; i<=HEALTH_CHECK_RETRIES; i++)); do
            log_info "Health check attempt $i/$HEALTH_CHECK_RETRIES for $service"
            
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s "http://localhost:$port/health" &> /dev/null; then
                log_info "Health check passed for $service"
                success=true
                break
            else
                log_warn "Health check failed for $service (attempt $i/$HEALTH_CHECK_RETRIES)"
                if [ $i -lt $HEALTH_CHECK_RETRIES ]; then
                    sleep $HEALTH_CHECK_DELAY
                fi
            fi
        done
        
        if [ "$success" = false ]; then
            log_error "Health check failed for $service after $HEALTH_CHECK_RETRIES attempts"
            failed_health_checks+=("$service")
        fi
    done
    
    if [ ${#failed_health_checks[@]} -gt 0 ]; then
        log_error "Failed health checks: ${failed_health_checks[*]}"
        return 1
    fi
    
    log_info "All health checks passed"
}

# Function to check ingress status
check_ingress() {
    log_info "Checking ingress status..."
    
    local ingress_name="business-automation-ingress"
    
    if ! kubectl get ingress "$ingress_name" -n "$NAMESPACE" &> /dev/null; then
        log_warn "Ingress $ingress_name does not exist"
        return 0
    fi
    
    local ingress_ip=$(kubectl get ingress "$ingress_name" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    local ingress_hostname=$(kubectl get ingress "$ingress_name" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -n "$ingress_ip" ]; then
        log_info "Ingress $ingress_name has IP: $ingress_ip"
    elif [ -n "$ingress_hostname" ]; then
        log_info "Ingress $ingress_name has hostname: $ingress_hostname"
    else
        log_warn "Ingress $ingress_name has no external IP or hostname yet"
    fi
}

# Function to check HPA status
check_hpa() {
    log_info "Checking HPA status..."
    
    local hpa_name="business-automation-hpa"
    
    if ! kubectl get hpa "$hpa_name" -n "$NAMESPACE" &> /dev/null; then
        log_warn "HPA $hpa_name does not exist"
        return 0
    fi
    
    local current_replicas=$(kubectl get hpa "$hpa_name" -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}')
    local desired_replicas=$(kubectl get hpa "$hpa_name" -n "$NAMESPACE" -o jsonpath='{.status.desiredReplicas}')
    
    log_info "HPA $hpa_name: current replicas=$current_replicas, desired replicas=$desired_replicas"
}

# Function to generate verification report
generate_report() {
    log_info "Generating deployment verification report..."
    
    local report_file="deployment-verification-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Deployment Verification Report"
        echo "============================="
        echo "Environment: $ENVIRONMENT"
        echo "Namespace: $NAMESPACE"
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
    
    log_info "Verification report saved to: $report_file"
}

# Main verification function
main() {
    log_info "Starting deployment verification for environment: $ENVIRONMENT"
    
    local verification_failed=false
    
    # Run all checks
    check_kubectl || verification_failed=true
    check_namespace || verification_failed=true
    check_deployments || verification_failed=true
    check_statefulsets || verification_failed=true
    check_pods || verification_failed=true
    check_services || verification_failed=true
    perform_health_checks || verification_failed=true
    check_ingress
    check_hpa
    
    # Generate report
    generate_report
    
    if [ "$verification_failed" = true ]; then
        log_error "Deployment verification FAILED"
        exit 1
    else
        log_info "Deployment verification PASSED"
        exit 0
    fi
}

# Run main function
main "$@"