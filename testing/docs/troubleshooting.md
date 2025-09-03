# Testing Troubleshooting Guide

## Common Issues and Solutions

### Environment Setup Issues

#### Docker Services Won't Start

**Problem**: Docker containers fail to start during test environment setup.

**Symptoms**:
- `docker-compose up` fails
- Port conflicts
- Container exits immediately

**Solutions**:
```bash
# Check if ports are already in use
netstat -tulpn | grep :3000
netstat -tulpn | grep :27017
netstat -tulpn | grep :6379

# Stop conflicting services
sudo systemctl stop mongodb
sudo systemctl stop redis

# Clean up existing containers
docker-compose -f docker-compose.test.yml down -v
docker system prune -f

# Restart Docker daemon (if needed)
sudo systemctl restart docker

# Try setup again
npm run test:setup
```

#### Database Connection Failures

**Problem**: Tests fail to connect to MongoDB or Redis.

**Symptoms**:
- Connection timeout errors
- Authentication failures
- Database not found errors

**Solutions**:
```bash
# Check database status
docker ps | grep mongo
docker ps | grep redis

# Check database logs
docker logs test-mongodb
docker logs test-redis

# Test direct connection
mongo mongodb://localhost:27017/business-automation-test
redis-cli -h localhost -p 6379

# Reset database containers
docker stop test-mongodb test-redis
docker rm test-mongodb test-redis
npm run test:setup
```

#### Permission Issues

**Problem**: Permission denied errors during test execution.

**Symptoms**:
- Cannot write to test directories
- Cannot execute test scripts
- Docker permission errors

**Solutions**:
```bash
# Fix file permissions
chmod +x testing/scripts/*.js
chmod -R 755 testing/

# Fix Docker permissions (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Create missing directories
mkdir -p testing/reports
mkdir -p testing/logs
```

### Test Execution Issues

#### Cypress Tests Fail to Start

**Problem**: Cypress cannot open or tests fail to run.

**Symptoms**:
- Cypress window doesn't open
- Browser launch failures
- Display issues in headless mode

**Solutions**:
```bash
# Install Cypress dependencies (Linux)
sudo apt-get install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb

# Clear Cypress cache
npx cypress cache clear
npx cypress install

# Run with different browser
npx cypress run --browser chrome
npx cypress run --browser firefox

# Check display (headless)
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
```

#### Performance Tests Show Inconsistent Results

**Problem**: k6 or Artillery tests show varying results between runs.

**Symptoms**:
- Response times vary significantly
- Throughput inconsistencies
- Random test failures

**Solutions**:
```bash
# Check system resources
top
htop
iostat -x 1

# Monitor network
netstat -i
ss -tuln

# Run with consistent load
k6 run --vus 10 --duration 5m testing/performance/load-test.js

# Increase test duration for stability
k6 run --vus 10 --duration 10m testing/performance/load-test.js

# Check for background processes
ps aux | grep -E "(node|docker|mongo|redis)"
```

#### Security Tests Report False Positives

**Problem**: OWASP ZAP reports vulnerabilities that aren't real issues.

**Symptoms**:
- High number of low-severity findings
- Repeated false positive alerts
- Test environment specific issues

**Solutions**:
```bash
# Update ZAP rules
docker pull owasp/zap2docker-stable

# Configure exclusions in zap-config.yaml
excludePaths:
  - "http://localhost:3000/api/v1/health"
  - "http://localhost:3000/api/v1/metrics"

# Review and whitelist known safe endpoints
# Update security test baselines
# Document false positives for future reference
```

### Data Quality Test Issues

#### Python Dependencies Missing

**Problem**: Data quality tests fail due to missing Python packages.

**Symptoms**:
- ImportError for pandas, numpy, sklearn
- Module not found errors
- Version compatibility issues

**Solutions**:
```bash
# Install Python dependencies
pip install -r testing/data-quality/requirements.txt

# Use virtual environment
python -m venv test-env
source test-env/bin/activate  # Linux/Mac
test-env\Scripts\activate     # Windows
pip install -r testing/data-quality/requirements.txt

# Check Python version
python --version  # Should be 3.8+

# Update pip
pip install --upgrade pip
```

#### AI Model Testing Failures

**Problem**: AI model accuracy tests fail or show poor performance.

**Symptoms**:
- Low accuracy scores
- Model inference errors
- Training data issues

**Solutions**:
```bash
# Check model availability
curl -X GET http://localhost:3000/api/v1/ai/models

# Verify training data
ls -la testing/data-quality/datasets/
head testing/data-quality/datasets/validation_classification.json

# Test model inference manually
curl -X POST http://localhost:3000/api/v1/ai/inference \
  -H "Content-Type: application/json" \
  -d '{"model": "document-classifier", "input": {"text": "test"}}'

# Regenerate validation datasets
python testing/data-quality/generate-validation-data.py
```

### Integration Test Issues

#### Service Communication Failures

**Problem**: Services cannot communicate with each other during integration tests.

**Symptoms**:
- Connection refused errors
- Timeout errors
- Service discovery failures

**Solutions**:
```bash
# Check service status
docker-compose -f docker-compose.test.yml ps

# Check service logs
docker-compose -f docker-compose.test.yml logs api-gateway
docker-compose -f docker-compose.test.yml logs task-orchestrator

# Test service endpoints manually
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Check network connectivity
docker network ls
docker network inspect business-automation-test_default
```

#### Authentication Issues in Tests

**Problem**: Tests fail due to authentication or authorization errors.

**Symptoms**:
- 401 Unauthorized errors
- Token expiration issues
- Role-based access failures

**Solutions**:
```bash
# Verify test users exist
mongo mongodb://localhost:27017/business-automation-test
> db.users.find({email: "admin@test.com"})

# Test authentication manually
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "TestAdmin123!"}'

# Check JWT token validity
# Verify user roles and permissions
# Update test user credentials if needed
```

### Contract Test Issues

#### Pact Generation Failures

**Problem**: Contract tests fail to generate or verify Pact files.

**Symptoms**:
- Pact files not created
- Contract verification failures
- Provider state issues

**Solutions**:
```bash
# Check Pact broker connectivity
curl http://localhost:9292  # If using local Pact broker

# Verify Pact file generation
ls -la testing/contract/pacts/

# Check provider states
# Ensure mock services are running
# Verify contract expectations match actual API

# Clear Pact cache
rm -rf testing/contract/pacts/*
npm run test:contract
```

### Chaos Engineering Test Issues

#### Infrastructure Simulation Failures

**Problem**: Chaos tests cannot properly simulate failure conditions.

**Symptoms**:
- Services don't fail as expected
- Recovery mechanisms don't trigger
- Test environment limitations

**Solutions**:
```bash
# Check if running in appropriate environment
echo $NODE_ENV

# Verify chaos testing tools
which docker
docker --version

# Test failure simulation manually
docker stop test-mongodb
# Verify application behavior
docker start test-mongodb

# Check monitoring and alerting
# Verify circuit breaker configuration
# Test auto-scaling policies
```

### Performance Optimization

#### Slow Test Execution

**Problem**: Tests take too long to execute.

**Symptoms**:
- Test timeouts
- CI/CD pipeline delays
- Resource exhaustion

**Solutions**:
```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Optimize test data
# Reduce test dataset sizes
# Use test doubles for external services

# Profile test execution
npm test -- --verbose --detectOpenHandles

# Check system resources
free -h
df -h
```

#### Memory Leaks in Tests

**Problem**: Tests consume increasing amounts of memory.

**Symptoms**:
- Out of memory errors
- Slow test execution over time
- System becomes unresponsive

**Solutions**:
```bash
# Monitor memory usage
node --inspect testing/integration/run-integration-tests.js

# Check for unclosed connections
# Verify database connections are closed
# Clean up test data properly

# Use memory profiling
node --inspect-brk testing/integration/run-integration-tests.js
# Open chrome://inspect in Chrome
```

### Debugging Strategies

#### Enable Debug Logging

```bash
# Enable debug mode for all tests
DEBUG=* npm test

# Enable specific debug namespaces
DEBUG=test:* npm test
DEBUG=cypress:* npm run test:e2e

# Set log levels
LOG_LEVEL=debug npm test
```

#### Isolate Failing Tests

```bash
# Run single test file
npm test -- testing/integration/service-integration-tests.js

# Run specific test case
npm test -- --testNamePattern="should create workflow"

# Skip other tests temporarily
describe.skip('Other tests', () => {
  // skipped tests
});
```

#### Capture Additional Information

```bash
# Take screenshots on failure (Cypress)
cy.screenshot('failure-state');

# Capture network traffic
# Enable request/response logging
# Save test artifacts

# Generate detailed reports
npm run test:e2e -- --reporter mochawesome
```

### Getting Help

#### Internal Resources

1. **Team Documentation**: Check team wiki and documentation
2. **Code Comments**: Review inline code comments
3. **Git History**: Check commit messages and PR descriptions
4. **Team Chat**: Ask in #testing or #development channels

#### External Resources

1. **Tool Documentation**:
   - [Cypress Documentation](https://docs.cypress.io/)
   - [Jest Documentation](https://jestjs.io/docs/)
   - [k6 Documentation](https://k6.io/docs/)
   - [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)

2. **Community Support**:
   - Stack Overflow
   - GitHub Issues for specific tools
   - Community forums and Discord servers

#### Creating Support Tickets

When creating support tickets, include:

1. **Environment Information**:
   ```bash
   node --version
   npm --version
   docker --version
   uname -a
   ```

2. **Error Messages**: Full error messages and stack traces

3. **Steps to Reproduce**: Detailed steps to reproduce the issue

4. **Expected vs Actual Behavior**: What should happen vs what actually happens

5. **Logs and Screenshots**: Relevant logs and screenshots

6. **Configuration**: Relevant configuration files and settings

### Prevention Strategies

#### Regular Maintenance

```bash
# Update dependencies regularly
npm audit
npm update

# Clean up test artifacts
npm run test:cleanup

# Monitor test performance
# Track test execution times
# Identify and fix flaky tests
```

#### Best Practices

1. **Test Isolation**: Ensure tests don't depend on each other
2. **Data Management**: Use fresh test data for each test run
3. **Resource Cleanup**: Always clean up resources after tests
4. **Error Handling**: Implement proper error handling in tests
5. **Documentation**: Keep test documentation up to date

#### Monitoring and Alerting

1. **Test Metrics**: Monitor test success rates and execution times
2. **Performance Trends**: Track performance test results over time
3. **Security Alerts**: Set up alerts for security test failures
4. **Resource Usage**: Monitor test environment resource usage

This troubleshooting guide should help resolve most common testing issues. For persistent problems or new issues not covered here, please update this guide with the solution once resolved.