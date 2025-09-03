# Comprehensive Testing Suite

This directory contains all testing configurations, frameworks, and test suites for the Business Task Automation System.

## Testing Structure

```
testing/
├── e2e/                    # End-to-end tests with Cypress
├── performance/            # Performance and load tests with k6/Artillery
├── security/               # Security tests with OWASP ZAP
├── data-quality/           # Data quality and AI model tests
├── integration/            # Service integration tests
├── contract/               # API contract tests with Pact
├── chaos/                  # Chaos engineering tests
├── configs/                # Test configurations
├── docs/                   # Test documentation
└── scripts/                # Test automation scripts
```

## Test Types

1. **End-to-End Tests**: Complete business workflow testing with Cypress
2. **Performance Tests**: Load and stress testing with k6 and Artillery
3. **Security Tests**: Automated security scanning with OWASP ZAP
4. **Data Quality Tests**: AI model accuracy and data validation
5. **Integration Tests**: Service interaction testing
6. **Contract Tests**: API compatibility testing with Pact
7. **Chaos Tests**: System resilience testing with Chaos Monkey

## Quick Start

### Prerequisites
```bash
# Install dependencies
npm install
cd client && npm install
cd ../services && npm install

# Install testing tools
npm install -g k6
npm install -g artillery
pip install pytest pandas scikit-learn
```

### Running All Tests
```bash
# Run complete test suite
npm run test:all

# Run specific test types
npm run test:e2e
npm run test:performance
npm run test:security
npm run test:integration
npm run test:contract
npm run test:chaos
npm run test:data-quality
```

### Test Environment Setup
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Seed test data
npm run test:seed

# Run tests
npm run test:all

# Cleanup
npm run test:cleanup
```

## Test Coverage Requirements

- **Unit Tests**: 90% code coverage minimum
- **Integration Tests**: All service interactions covered
- **E2E Tests**: All critical business workflows covered
- **Performance Tests**: All API endpoints under load
- **Security Tests**: OWASP Top 10 vulnerabilities checked
- **Data Quality**: AI model accuracy > 85%

## Continuous Integration

Tests are automatically run on:
- Pull requests (smoke tests + unit tests)
- Merge to main (full test suite)
- Nightly builds (performance + security tests)
- Release candidates (complete validation)

## Test Data Management

- **Synthetic Data**: Generated test data for consistent testing
- **Data Anonymization**: Production data anonymized for testing
- **Test Isolation**: Each test uses isolated data sets
- **Cleanup**: Automatic cleanup after test completion

## Reporting

Test results are available in:
- **HTML Reports**: `testing/reports/html/`
- **JSON Reports**: `testing/reports/json/`
- **Coverage Reports**: `testing/reports/coverage/`
- **Performance Reports**: `testing/reports/performance/`
- **Security Reports**: `testing/reports/security/`

## Troubleshooting

See `testing/docs/troubleshooting.md` for common issues and solutions.