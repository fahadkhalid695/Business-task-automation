#!/bin/bash

# Rollback Deployment Script for Business Automation System
# Usage: ./rollback-deployment.sh [environment] [revision]

set -euo pipefail

ENVIRONMENT=${1:-production}
REVISION=${2:-}
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
DEPLOYMENTS=(
    "business-automation-api-gateway"
    "business-automation-task-orchestrator"
    "business-automation-ai-ml-engine"
    "business-automation-frontend"
)

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}# Functi
on to show rollout history
show_rollout_history() {
    log_info "Showing rollout history for all deployments..."
    
    for deployment in "${DEPLOYMENTS[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            log_info "Rollout history for $deployment:"
            kubectl rollout history deployment/"$deployment" -n "$NAMESPACE"
            echo ""
        else
            log_warn "Deployment $deployment not found"
        fi
    done
}

# Function to rollback deployments
rollback_deployments() {
    local target_revision="$1"
    log_info "Rolling back deployments to revision: ${target_revision:-previous}"
    
    local failed_rollbacks=()
    
    for deployment in "${DEPLOYMENTS[@]}"; do
        log_info "Rolling back deployment: $deployment"
        
        if ! kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            log_warn "Deployment $deployment not found, skipping"
            continue
        fi
        
        # Perform rollback
        local rollback_cmd="kubectl rollout undo deployment/$deployment -n $NAMESPACE"
        if [ -n "$target_revision" ]; then
            rollback_cmd="$rollback_cmd --to-revision=$target_revision"
        fi
        
        if ! eval "$rollback_cmd"; then
            log_error "Failed to initiate rollback for $deployment"
            failed_rollbacks+=("$deployment")
            continue
        fi
        
        log_info "Rollback initiated for $deployment"
    done
    
    if [ ${#failed_rollbacks[@]} -gt 0 ]; then
        log_error "Failed to initiate rollback for: ${failed_rollbacks[*]}"
        return 1
    fi
    
    log_info "Rollback initiated for all deployments"
}

# Function to wait for rollback completion
wait_for_rollback() {
    log_info "Waiting for rollback to complete..."
    
    local failed_deployments=()
    
    for deployment in "${DEPLOYMENTS[@]}"; do
        if ! kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            continue
        fi
        
        log_info "Waiting for rollback of $deployment to complete..."
        
        if ! kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
            log_error "Rollback timeout or failure for $deployment"
            failed_deployments+=("$deployment")
        else
            log_info "Rollback completed successfully for $deployment"
        fi
    done
    
    if [ ${#failed_deployments[@]} -gt 0 ]; then
        log_error "Rollback failed for: ${failed_deployments[*]}"
        return 1
    fi
    
    log_info "Rollback completed successfully for all deployments"
}

# Function to verify rollback
verify_rollback() {
    log_info "Verifying rollback..."
    
    # Run deployment verification script
    if [ -f "./deployment-verification.sh" ]; then
        log_info "Running deployment verification..."
        if ./deployment-verification.sh "$ENVIRONMENT"; then
            log_info "Rollback verification PASSED"
        else
            log_error "Rollback verification FAILED"
            return 1
        fi
    else
        log_warn "Deployment verification script not found, performing basic checks..."
        
        # Basic pod health check
        local unhealthy_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running -o name 2>/dev/null | wc -l)
        if [ "$unhealthy_pods" -gt 0 ]; then
            log_error "Found $unhealthy_pods unhealthy pods after rollback"
            kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running
            return 1
        fi
        
        log_info "Basic rollback verification passed"
    fi
}

# Function to create rollback report
create_rollback_report() {
    local report_file="rollback-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    log_info "Creating rollback report: $report_file"
    
    {
        echo "Rollback Report"
        echo "==============="
        echo "Environment: $ENVIRONMENT"
        echo "Namespace: $NAMESPACE"
        echo "Timestamp: $(date)"
        echo "Target Revision: ${REVISION:-previous}"
        echo ""
        
        echo "Current Deployment Status:"
        kubectl get deployments -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Current Pod Status:"
        kubectl get pods -n "$NAMESPACE" -o wide
        echo ""
        
        echo "Recent Events:"
        kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20
        
    } > "$report_file"
    
    log_info "Rollback report saved to: $report_file"
}

# Main function
main() {
    log_info "Starting rollback process for environment: $ENVIRONMENT"
    
    # Check prerequisites
    check_prerequisites
    
    # Show current rollout history
    show_rollout_history
    
    # Confirm rollback if no revision specified
    if [ -z "$REVISION" ]; then
        echo ""
        read -p "Do you want to rollback to the previous revision? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    # Perform rollback
    if ! rollback_deployments "$REVISION"; then
        log_error "Rollback initiation failed"
        exit 1
    fi
    
    # Wait for rollback to complete
    if ! wait_for_rollback; then
        log_error "Rollback completion failed"
        create_rollback_report
        exit 1
    fi
    
    # Verify rollback
    if ! verify_rollback; then
        log_error "Rollback verification failed"
        create_rollback_report
        exit 1
    fi
    
    # Create success report
    create_rollback_report
    
    log_info "Rollback completed successfully!"
}

# Show usage if help requested
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    echo "Usage: $0 [environment] [revision]"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (default: production)"
    echo "  revision     Target revision number (default: previous)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Rollback production to previous revision"
    echo "  $0 staging            # Rollback staging to previous revision"
    echo "  $0 production 5       # Rollback production to revision 5"
    exit 0
fi

# Run main function
main "$@"