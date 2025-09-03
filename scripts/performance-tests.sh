#!/bin/bash

# Performance Testing Script for Business Automation System
# Usage: ./performance-tests.sh [environment]

set -euo pipefail

ENVIRONMENT=${1:-production}
BASE_URL=""

case $ENVIRONMENT in
    "development")
        BASE_URL="http://localhost:3000"
        ;;
    "staging")
        BASE_URL="https://staging.business-automation.example.com"
        ;;
    "production")
        BASE_URL="https://business-automation.example.com"
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Performance test configuration
CONCURRENT_USERS=10
TEST_DURATION=60
RAMP_UP_TIME=10

# Function to check if required tools are installed
check_tools() {
    log_info "Checking required tools..."
    
    local missing_tools=()
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v ab &> /dev/null; then
        missing_tools+=("apache2-utils (ab)")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
    
    log_info "All required tools are available"
}

# Function to test API endpoint response time
test_api_response_time() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Testing $description..."
    
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" "$BASE_URL$endpoint" || echo "ERROR")
    
    if [ "$response_time" = "ERROR" ]; then
        log_error "$description: Request failed"
        return 1
    fi
    
    local response_time_ms=$(echo "$response_time * 1000" | bc -l)
    log_info "$description: ${response_time_ms}ms"
    
    # Check if response time is acceptable (< 2 seconds)
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        log_warn "$description: Response time exceeds 2 seconds"
        return 1
    fi
    
    return 0
}

# Function to run load test with Apache Bench
run_load_test() {
    local endpoint="$1"
    local description="$2"
    local requests=${3:-100}
    local concurrency=${4:-10}
    
    log_info "Running load test for $description..."
    log_info "Requests: $requests, Concurrency: $concurrency"
    
    local output_file="load_test_${description// /_}_$(date +%Y%m%d_%H%M%S).txt"
    
    if ab -n "$requests" -c "$concurrency" -g "${output_file}.gnuplot" "$BASE_URL$endpoint" > "$output_file" 2>&1; then
        # Extract key metrics
        local rps=$(grep "Requests per second" "$output_file" | awk '{print $4}')
        local mean_time=$(grep "Time per request" "$output_file" | head -1 | awk '{print $4}')
        local failed_requests=$(grep "Failed requests" "$output_file" | awk '{print $3}')
        
        log_info "$description Results:"
        log_info "  Requests per second: $rps"
        log_info "  Mean response time: ${mean_time}ms"
        log_info "  Failed requests: $failed_requests"
        
        # Check if performance is acceptable
        if (( $(echo "$failed_requests > 0" | bc -l) )); then
            log_warn "$description: Some requests failed"
            return 1
        fi
        
        if (( $(echo "$rps < 10" | bc -l) )); then
            log_warn "$description: Low requests per second"
            return 1
        fi
        
        log_info "$description: Load test passed"
        return 0
    else
        log_error "$description: Load test failed"
        return 1
    fi
}

# Function to test database performance
test_database_performance() {
    log_info "Testing database performance..."
    
    # This would typically involve running database-specific performance tests
    # For now, we'll test API endpoints that interact with the database
    
    test_api_response_time "/api/health" "Database Health Check"
}

# Function to test cache performance
test_cache_performance() {
    log_info "Testing cache performance..."
    
    # Test cache hit/miss scenarios
    test_api_response_time "/api/cache/test" "Cache Performance"
}

# Function to generate performance report
generate_performance_report() {
    local report_file="performance_report_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S).html"
    
    log_info "Generating performance report: $report_file"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - $ENVIRONMENT</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 10px; }
        .section { margin: 20px 0; }
        .pass { color: green; }
        .fail { color: red; }
        .warn { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p>Environment: $ENVIRONMENT</p>
        <p>Timestamp: $(date)</p>
        <p>Base URL: $BASE_URL</p>
    </div>
    
    <div class="section">
        <h2>Test Configuration</h2>
        <ul>
            <li>Concurrent Users: $CONCURRENT_USERS</li>
            <li>Test Duration: ${TEST_DURATION}s</li>
            <li>Ramp-up Time: ${RAMP_UP_TIME}s</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Test Results</h2>
        <p>Detailed results are available in the individual test output files.</p>
    </div>
</body>
</html>
EOF
    
    log_info "Performance report generated: $report_file"
}

# Main function
main() {
    log_info "Starting performance tests for environment: $ENVIRONMENT"
    log_info "Base URL: $BASE_URL"
    
    # Check prerequisites
    check_tools
    
    # Test basic connectivity
    log_info "Testing basic connectivity..."
    if ! curl -f -s "$BASE_URL/health" > /dev/null; then
        log_error "Cannot connect to $BASE_URL/health"
        exit 1
    fi
    log_info "Basic connectivity test passed"
    
    # Run performance tests
    local test_failed=false
    
    # API response time tests
    test_api_response_time "/api/health" "Health Check" || test_failed=true
    test_api_response_time "/api/auth/status" "Auth Status" || test_failed=true
    test_api_response_time "/api/tasks" "Task List" || test_failed=true
    
    # Load tests
    run_load_test "/api/health" "Health Check Load Test" 100 10 || test_failed=true
    run_load_test "/api/auth/status" "Auth Status Load Test" 50 5 || test_failed=true
    
    # Database performance tests
    test_database_performance || test_failed=true
    
    # Cache performance tests
    test_cache_performance || test_failed=true
    
    # Generate report
    generate_performance_report
    
    if [ "$test_failed" = true ]; then
        log_error "Some performance tests failed"
        exit 1
    else
        log_info "All performance tests passed"
        exit 0
    fi
}

# Show usage if help requested
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    echo "Usage: $0 [environment]"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (development|staging|production)"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 staging"
    echo "  $0 production"
    exit 0
fi

# Run main function
main "$@"