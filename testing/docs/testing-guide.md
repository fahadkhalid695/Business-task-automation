# Comprehensive Testing Guide

## Overview

This document provides a complete guide to the testing suite for the Business Task Automation System. Our testing framework covers all aspects of the system including unit tests, integration tests, end-to-end tests, performance tests, security tests, contract tests, chaos engineering tests, and data quality tests.

## Table of Contents

1. [Test Types](#test-types)
2. [Getting Started](#getting-started)
3. [Test Environment Setup](#test-environment-setup)
4. [Running Tests](#running-tests)
5. [Test Data Management](#test-data-management)
6. [Continuous Integration](#continuous-integration)
7. [Test Reporting](#test-reporting)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Test Types

### 1. Unit Tests
- **Location**: `services/src/**/*.test.js`, `client/src/**/*.test.tsx`
- **Purpose**: Test individual components and functions in isolation
- **Coverage Target**: 90% minimum
- **Tools**: Jest, React Testing Library

### 2. Integration Tests
- **Location**: `testing/integration/`
- **Purpose**: Test service-to-service communication and database interactions
- **Coverage**: All API endpoints and service interactions
- **Tools**: Jest, Supertest, MongoDB, Redis

### 3. End-to-End Tests
- **Location**: `testing/e2e/`
- **Purpose**: Test complete user workflows and business processes
- **Coverage**: All critical user journeys
- **Tools**: Cypress

### 4. Performance Tests
- **Location**: `testing/performance/`
- **Purpose**: Test system performance under various load conditions
- **Coverage**: All API endpoints and critical workflows
- **Tools**: k6, Artillery

### 5. Security Tests
- **Location**: `testing/security/`
- **Purpose**: Identify security vulnerabilities and compliance issues
- **Coverage**: OWASP Top 10, authentication, authorization
- **Tools**: OWASP ZAP, Custom security tests

### 6. Contract Tests
- **Location**: `testing/contract/`
- **Purpose**: Ensure API compatibility between services
- **Coverage**: All inter-service communications
- **Tools**: Pact

### 7. Chaos Engineering Tests
- **Location**: `testing/chaos/`
- **Purpose**: Test system resilience under failure conditions
- **Coverage**: Network failures, service failures, resource exhaustion
- **Tools**: Custom chaos testing framework

### 8. Data Quality Tests
- **Location**: `testing/data-quality/`
- **Purpose**: Validate data integrity and AI model accuracy
- **Coverage**: Data pipelines, AI models, data validation rules
- **Tools**: Python, pandas, scikit-learn

## Getting Started

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Python** (v3.8 or higher)
3. **Docker** and **Docker Compose**
4. **k6** (for performance testing)
5. **OWASP ZAP** (for security testing)

### Installation

```bash
# Install Node.js dependencies
npm install

# Install client dependencies
cd client && npm install

# Install services dependencies
cd ../services && npm install

# Install Python dependencies for data quality tests
pip install -r testing/data-quality/requirements.txt

# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Environment Setup

### Automated Setup

```bash
# Setup complete test environment
npm run test:setup

# Seed test data
npm run test:seed
```

### Manual Setup

1. **Start Infrastructure Services**
   ```bash
   docker run -d --name test-mongodb -p 27017:27017 mongo:latest
   docker run -d --name test-redis -p 6379:6379 redis:latest
   ```

2. **Start Application Services**
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

3. **Create Test Users**
   ```bash
   node testing/scripts/create-test-users.js
   ```

### Environment Configuration

Test configuration is managed in `testing/configs/test-config.json`:

```json
{
  "environments": {
    "development": {
      "apiUrl": "http://localhost:3000/api/v1",
      "webUrl": "http://localhost:3000",
      "database": "mongodb://localhost:27017/business-automation-test",
      "redis": "redis://localhost:6379/1"
    }
  },
  "testData": {
    "users": {
      "admin": {
        "email": "admin@test.com",
        "password": "TestAdmin123!",
        "role": "admin"
      }
    }
  }
}
```

## Running Tests

### All Tests

```bash
# Run complete test suite
npm run test:all

# Run tests in CI mode
npm run test:ci

# Run nightly test suite
npm run test:nightly
```

### Individual Test Types

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# Contract tests
npm run test:contract

# Chaos tests
npm run test:chaos

# Data quality tests
npm run test:data-quality
```

### Test Options

```bash
# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern=workflow

# Run tests with specific tag
npm run test:e2e -- --grep "@smoke"
```

## Test Data Management

### Test Data Strategy

1. **Synthetic Data**: Generated test data for consistent testing
2. **Data Isolation**: Each test uses isolated data sets
3. **Data Cleanup**: Automatic cleanup after test completion
4. **Data Anonymization**: Production data anonymized for testing

### Seeding Test Data

```bash
# Seed all test data
npm run test:seed

# Seed specific data type
node testing/scripts/seed-test-data.js --type=users
```

### Test Data Structure

```
testing/data-quality/datasets/
├── customers.csv
├── transactions.csv
├── products.csv
├── validation_classification.json
└── validation_regression.json
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Test Environment
        run: npm run test:setup
      - name: Run Unit Tests
        run: npm run test:unit
      - name: Run Integration Tests
        run: npm run test:integration
      - name: Run E2E Tests
        run: npm run test:e2e
```

### Test Stages

1. **Pull Request**: Smoke tests + Unit tests
2. **Merge to Main**: Full test suite
3. **Nightly Builds**: Performance + Security tests
4. **Release Candidates**: Complete validation

## Test Reporting

### Report Locations

```
testing/reports/
├── html/           # HTML test reports
├── json/           # JSON test results
├── coverage/       # Code coverage reports
├── performance/    # Performance test results
└── security/       # Security scan reports
```

### Viewing Reports

```bash
# Open coverage report
open testing/reports/coverage/index.html

# View performance results
open testing/reports/performance/load-test-report.html

# Check security report
open testing/reports/security/security-report.html
```

### Report Integration

- **Slack Notifications**: Test results posted to #testing channel
- **Email Reports**: Daily summary reports
- **Dashboard**: Real-time test metrics in monitoring dashboard

## Best Practices

### Writing Tests

1. **Test Naming**: Use descriptive test names
   ```javascript
   describe('User Authentication', () => {
     it('should successfully login with valid credentials', () => {
       // test implementation
     });
   });
   ```

2. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
   ```javascript
   it('should create workflow', async () => {
     // Arrange
     const workflowData = { name: 'Test Workflow' };
     
     // Act
     const response = await createWorkflow(workflowData);
     
     // Assert
     expect(response.status).toBe(201);
   });
   ```

3. **Test Independence**: Each test should be independent
4. **Data Cleanup**: Clean up test data after each test
5. **Mocking**: Mock external dependencies appropriately

### Performance Testing

1. **Baseline Metrics**: Establish performance baselines
2. **Realistic Load**: Use realistic user scenarios
3. **Gradual Ramp-up**: Gradually increase load
4. **Monitor Resources**: Track CPU, memory, and database performance

### Security Testing

1. **Regular Scans**: Run security scans regularly
2. **Update Dependencies**: Keep security tools updated
3. **False Positive Management**: Review and manage false positives
4. **Compliance Checks**: Ensure compliance with security standards

## Troubleshooting

### Common Issues

#### Test Environment Setup Fails

```bash
# Check Docker status
docker ps

# Check service logs
docker-compose -f docker-compose.test.yml logs

# Reset environment
npm run test:cleanup
npm run test:setup
```

#### Tests Fail Intermittently

1. **Check Test Data**: Ensure test data is properly seeded
2. **Timing Issues**: Add appropriate waits for async operations
3. **Resource Constraints**: Check system resources
4. **Network Issues**: Verify network connectivity

#### Performance Tests Show Degradation

1. **Check System Resources**: Monitor CPU, memory, disk usage
2. **Database Performance**: Check database query performance
3. **Network Latency**: Verify network conditions
4. **Code Changes**: Review recent code changes for performance impact

#### Security Tests Report False Positives

1. **Review Findings**: Manually verify security findings
2. **Update Baselines**: Update security test baselines
3. **Configure Exclusions**: Add exclusions for known false positives
4. **Tool Updates**: Update security testing tools

### Getting Help

1. **Documentation**: Check this guide and tool documentation
2. **Team Chat**: Ask questions in #testing Slack channel
3. **Issue Tracking**: Create issues for persistent problems
4. **Code Reviews**: Request code review for test changes

### Debugging Tests

```bash
# Run tests in debug mode
npm run test:debug

# Run specific test with verbose output
npm test -- --verbose --testNamePattern="specific test"

# Check test logs
tail -f testing/logs/test.log
```

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep testing tools updated
2. **Review Test Coverage**: Ensure adequate test coverage
3. **Performance Baselines**: Update performance baselines
4. **Security Scans**: Review security scan results
5. **Test Data**: Refresh test data periodically

### Monitoring

1. **Test Execution Time**: Monitor test execution duration
2. **Flaky Tests**: Identify and fix flaky tests
3. **Coverage Trends**: Track code coverage trends
4. **Performance Trends**: Monitor performance test trends

## Conclusion

This comprehensive testing suite ensures the reliability, performance, and security of the Business Task Automation System. Regular execution of all test types helps maintain high quality and catch issues early in the development cycle.

For questions or improvements to this testing guide, please contact the QA team or create an issue in the project repository.