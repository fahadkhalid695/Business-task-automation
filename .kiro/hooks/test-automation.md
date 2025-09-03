---
name: "Automated Testing on Save"
description: "Automatically run relevant tests when code files are saved"
trigger: "file_save"
filePattern: "**/*.{ts,tsx,js,jsx,py}"
enabled: true
---

# Automated Testing Hook

## Overview
This hook automatically triggers relevant tests when code files are saved, ensuring continuous quality assurance during development.

## Trigger Configuration

**Event**: File Save
**File Patterns**: 
- `**/*.ts` - TypeScript files
- `**/*.tsx` - React TypeScript files  
- `**/*.js` - JavaScript files
- `**/*.jsx` - React JavaScript files
- `**/*.py` - Python files

## Actions

### 1. Determine Test Scope
Based on the saved file location, determine which tests to run:

- **Services (`services/src/**`)**: Run backend unit tests
- **Client (`client/src/**`)**: Run frontend unit tests
- **AI/ML (`services/src/ai-ml-engine/**`)**: Run AI model tests
- **Testing (`testing/**`)**: Run test validation
- **Shared (`services/src/shared/**`)**: Run comprehensive test suite

### 2. Execute Tests
```bash
# For service files
cd services && npm test -- --testPathPattern=${changedFile}

# For client files  
cd client && npm test -- --testPathPattern=${changedFile}

# For AI/ML files
python testing/data-quality/ai-model-tests.py

# For comprehensive changes
npm run test:smoke
```

### 3. Report Results
- Display test results in IDE notification
- Show coverage changes if applicable
- Highlight any failing tests
- Provide quick links to fix issues

## Configuration

```yaml
hook:
  name: "test-automation"
  trigger: "file_save"
  conditions:
    - filePattern: "**/*.{ts,tsx,js,jsx,py}"
    - excludePattern: "**/*.test.{ts,js}"
    - excludePattern: "**/*.spec.{ts,js}"
    - excludePattern: "**/node_modules/**"
  
  actions:
    - name: "run-relevant-tests"
      command: "npm run test:changed"
      timeout: 300
      
    - name: "update-coverage"
      command: "npm run test:coverage"
      condition: "tests_passed"
      
    - name: "notify-results"
      type: "notification"
      message: "Tests completed: ${test_results}"
```

## Benefits

1. **Immediate Feedback**: Get test results as soon as you save files
2. **Prevent Regressions**: Catch breaking changes before they're committed
3. **Maintain Quality**: Ensure code changes don't break existing functionality
4. **Save Time**: Automated testing reduces manual test execution
5. **Continuous Integration**: Local CI/CD-like experience during development

## Usage Examples

### Backend Service Development
When editing `services/src/api-gateway/auth.ts`:
- Automatically runs auth-related unit tests
- Executes integration tests for authentication flows
- Validates API endpoint functionality
- Reports any security test failures

### Frontend Component Development  
When editing `client/src/components/WorkflowDesigner.tsx`:
- Runs component unit tests
- Executes related integration tests
- Validates accessibility compliance
- Checks for TypeScript errors

### AI/ML Model Updates
When editing `services/src/ai-ml-engine/model-manager.ts`:
- Runs AI model accuracy tests
- Validates model loading and inference
- Checks performance benchmarks
- Ensures data quality standards

## Customization

### File-Specific Test Patterns
```yaml
patterns:
  - match: "**/auth/**"
    tests: ["auth.test.ts", "security.test.ts"]
    
  - match: "**/workflow/**" 
    tests: ["workflow.test.ts", "orchestration.test.ts"]
    
  - match: "**/ai-ml-engine/**"
    tests: ["ai-model-tests.py", "inference.test.ts"]
```

### Performance Optimization
```yaml
optimization:
  parallel: true
  cache: true
  incremental: true
  timeout: 300
  maxConcurrency: 4
```

## Troubleshooting

### Common Issues

**Tests Taking Too Long**
- Reduce test scope with more specific patterns
- Enable parallel test execution
- Use test caching for faster runs

**False Positives**
- Exclude generated files from trigger patterns
- Add proper test isolation
- Update test dependencies

**Resource Usage**
- Limit concurrent test processes
- Set appropriate timeouts
- Monitor system resource usage

### Debugging

Enable debug mode to see detailed hook execution:
```bash
export KIRO_HOOK_DEBUG=true
```

View hook execution logs:
```bash
tail -f .kiro/logs/hooks/test-automation.log
```