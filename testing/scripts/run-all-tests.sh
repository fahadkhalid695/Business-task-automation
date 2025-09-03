#!/bin/bash

# Comprehensive Test Suite Runner
# Executes all test types for the Business Task Automation Platform

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
NAMESPACE="${NAMESPACE:-business-automation}"
REPORTS_DIR="testing/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create reports directory structure
setup_reports_dir() {
    log "Setting up reports directory structure..."
    mkdir -p "${REPORTS_DIR}/e2e"
    mkdir -p "${REPORTS_DIR}/performance"
    mkdir -p "${REPORTS_DIR}/security"
    mkdir -p "${REPORTS_DIR}/ai-models"
    mkdir -p "${REPORTS_DIR}/integration"
    mkdir -p "${REPORTS_DIR}/contract"
    mkdir -p "${REPORTS_DIR}/chaos"
    mkdir -p "${REPORTS_DIR}/coverage"
    mkdir -p "${REPORTS_DIR}/html"
    mkdir -p "${REPORTS_DIR}/json"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if system is running
    if ! curl -s "${BASE_URL}/api/health" > /dev/null; then
        error "System is not accessible at ${BASE_URL}"
        exit 1
    fi
    
    # Check required tools
    local tools=("node" "npm" "python3" "k6" "kubectl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check Docker
    if ! docker info &> /dev/null; then
        warning "Docker is not running - some tests may fail"
    fi
    
    success "Prerequisites check completed"
}

# Run unit tests
run_unit_tests() {
    log "Running unit tests..."
    
    cd services
    npm test -- --coverage --coverageReporters=json --coverageReporters=html
    
    # Move coverage reports
    mv coverage/coverage-final.json "../${REPORTS_DIR}/coverage/unit-coverage-${TIMESTAMP}.json"
    mv coverage/lcov-report "../${REPORTS_DIR}/html/unit-coverage-${TIMESTAMP}"
    
    cd ..
    success "Unit tests completed"
}

# Run integration tests
run_integration_tests() {
    log "Running integration tests..."
    
    cd testing/integration
    npm test -- --reporter json --outputFile "../reports/json/integration-${TIMESTAMP}.json"
    
    cd ../..
    success "Integration tests completed"
}

# Run end-to-end tests
run_e2e_tests() {
    log "Running end-to-end tests..."
    
    cd client
    npx cypress run --reporter json --reporter-options "outputFile=../testing/reports/json/e2e-${TIMESTAMP}.json"
    
    cd ..
    success "End-to-end tests completed"
}

# Run performance tests
run_performance_tests() {
    log "Running performance tests..."
    
    # K6 load tests
    k6 run testing/performance/k6-load-tests.js \
        --env BASE_URL="${BASE_URL}" \
        --out json="testing/reports/json/k6-${TIMESTAMP}.json"
    
    # Artillery tests if available
    if command -v artillery &> /dev/null; then
        artillery run testing/performance/artillery-config.yml \
            --output "testing/reports/json/artillery-${TIMESTAMP}.json"
    fi
    
    success "Performance tests completed"
}

# Run security tests
run_security_tests() {
    log "Running security tests..."
    
    # OWASP ZAP tests
    python3 testing/security/owasp-zap-tests.py "${BASE_URL}"
    
    # Additional security scans
    if command -v bandit &> /dev/null; then
        bandit -r services/src -f json -o "testing/reports/json/bandit-${TIMESTAMP}.json"
    fi
    
    success "Security tests completed"
}

# Run AI model tests
run_ai_model_tests() {
    log "Running AI model accuracy tests..."
    
    python3 testing/data-quality/ai-model-tests.py "${BASE_URL}/api"
    
    success "AI model tests completed"
}

# Run contract tests
run_contract_tests() {
    log "Running contract tests..."
    
    cd testing/contract
    npm test -- --reporter json --outputFile "../reports/json/contract-${TIMESTAMP}.json"
    
    cd ../..
    success "Contract tests completed"
}

# Run chaos engineering tests
run_chaos_tests() {
    log "Running chaos engineering tests..."
    
    # Only run if in Kubernetes environment
    if kubectl cluster-info &> /dev/null; then
        node testing/chaos/chaos-engineering-tests.js "${BASE_URL}" "${NAMESPACE}"
    else
        warning "Skipping chaos tests - Kubernetes not available"
    fi
    
    success "Chaos tests completed"
}

# Run data quality tests
run_data_quality_tests() {
    log "Running data quality tests..."
    
    cd testing/data-quality
    python3 -m pytest test_data_quality.py --json-report --json-report-file="../reports/json/data-quality-${TIMESTAMP}.json"
    
    cd ../..
    success "Data quality tests completed"
}

# Generate comprehensive report
generate_report() {
    log "Generating comprehensive test report..."
    
    cat > "${REPORTS_DIR}/test-summary-${TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "test_run_id": "${TIMESTAMP}",
    "base_url": "${BASE_URL}",
    "environment": "${NODE_ENV:-development}",
    "test_results": {
        "unit_tests": "unit-coverage-${TIMESTAMP}.json",
        "integration_tests": "integration-${TIMESTAMP}.json",
        "e2e_tests": "e2e-${TIMESTAMP}.json",
        "performance_tests": "k6-${TIMESTAMP}.json",
        "security_tests": "security_report_*.json",
        "ai_model_tests": "ai_model_test_report_*.json",
        "contract_tests": "contract-${TIMESTAMP}.json",
        "chaos_tests": "chaos_report_*.json",
        "data_quality_tests": "data-quality-${TIMESTAMP}.json"
    }
}
EOF
    
    # Generate HTML report
    node testing/scripts/generate-html-report.js "${REPORTS_DIR}/test-summary-${TIMESTAMP}.json"
    
    success "Test report generated: ${REPORTS_DIR}/test-summary-${TIMESTAMP}.json"
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    
    # Stop any test containers
    docker-compose -f docker-compose.test.yml down 2>/dev/null || true
    
    # Clean up temporary files
    find testing/reports -name "*.tmp" -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Main execution function
main() {
    log "Starting comprehensive test suite..."
    log "Target URL: ${BASE_URL}"
    log "Timestamp: ${TIMESTAMP}"
    
    # Setup
    setup_reports_dir
    check_prerequisites
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    # Run tests based on arguments or run all
    if [ $# -eq 0 ]; then
        # Run all tests
        run_unit_tests
        run_integration_tests
        run_e2e_tests
        run_performance_tests
        run_security_tests
        run_ai_model_tests
        run_contract_tests
        run_chaos_tests
        run_data_quality_tests
    else
        # Run specific test types
        for test_type in "$@"; do
            case $test_type in
                "unit")
                    run_unit_tests
                    ;;
                "integration")
                    run_integration_tests
                    ;;
                "e2e")
                    run_e2e_tests
                    ;;
                "performance")
                    run_performance_tests
                    ;;
                "security")
                    run_security_tests
                    ;;
                "ai-models")
                    run_ai_model_tests
                    ;;
                "contract")
                    run_contract_tests
                    ;;
                "chaos")
                    run_chaos_tests
                    ;;
                "data-quality")
                    run_data_quality_tests
                    ;;
                *)
                    error "Unknown test type: $test_type"
                    echo "Available test types: unit, integration, e2e, performance, security, ai-models, contract, chaos, data-quality"
                    exit 1
                    ;;
            esac
        done
    fi
    
    # Generate final report
    generate_report
    
    success "All tests completed successfully!"
    log "Reports available in: ${REPORTS_DIR}/"
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [test_types...]

Run comprehensive test suite for Business Task Automation Platform.

Test Types:
    unit            Run unit tests with coverage
    integration     Run service integration tests
    e2e             Run end-to-end tests with Cypress
    performance     Run performance and load tests
    security        Run security tests with OWASP ZAP
    ai-models       Run AI model accuracy tests
    contract        Run API contract tests
    chaos           Run chaos engineering tests
    data-quality    Run data quality validation tests

Environment Variables:
    BASE_URL        Target system URL (default: http://localhost:3000)
    NAMESPACE       Kubernetes namespace (default: business-automation)
    NODE_ENV        Environment name (default: development)

Examples:
    $0                          # Run all tests
    $0 unit integration         # Run only unit and integration tests
    $0 performance security     # Run only performance and security tests

EOF
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Execute main function
main "$@"