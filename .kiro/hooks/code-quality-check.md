---
name: "Code Quality Check"
description: "Automated code quality validation on file save"
trigger: "file_save"
filePattern: "**/*.{ts,tsx,js,jsx,py}"
enabled: true
manual: true
---

# Code Quality Check Hook

## Overview
This hook performs comprehensive code quality checks when files are saved, including linting, formatting, security scanning, and best practice validation.

## Trigger Configuration

**Event**: File Save (Manual trigger available)
**File Patterns**:
- `**/*.ts` - TypeScript files
- `**/*.tsx` - React TypeScript files
- `**/*.js` - JavaScript files
- `**/*.jsx` - React JavaScript files
- `**/*.py` - Python files

**Manual Trigger**: Available via command palette "Run Code Quality Check"

## Quality Checks

### 1. Linting and Formatting
- **ESLint**: JavaScript/TypeScript code quality rules
- **Prettier**: Code formatting consistency
- **Pylint**: Python code quality analysis
- **TypeScript**: Type checking and compilation errors

### 2. Security Scanning
- **ESLint Security**: JavaScript security vulnerabilities
- **Bandit**: Python security issues
- **Dependency Check**: Known vulnerability scanning
- **Secrets Detection**: Prevent credential commits

### 3. Best Practices
- **Code Complexity**: Cyclomatic complexity analysis
- **Code Duplication**: Duplicate code detection
- **Performance**: Performance anti-patterns
- **Accessibility**: A11y compliance for React components

### 4. Documentation Quality
- **JSDoc**: Function and class documentation
- **Type Annotations**: Python type hints
- **README Updates**: Documentation completeness
- **Comment Quality**: Meaningful code comments

## Implementation

### TypeScript/JavaScript Quality Check
```typescript
async function checkJavaScriptQuality(filePath: string) {
  const results = {
    linting: await runESLint(filePath),
    formatting: await checkPrettier(filePath),
    security: await runSecurityLint(filePath),
    complexity: await analyzeComplexity(filePath),
    types: await checkTypeScript(filePath)
  };
  
  return generateQualityReport(results);
}
```

### Python Quality Check
```python
def check_python_quality(file_path: str):
    results = {
        'linting': run_pylint(file_path),
        'formatting': check_black(file_path),
        'security': run_bandit(file_path),
        'type_hints': check_mypy(file_path),
        'complexity': analyze_complexity(file_path)
    }
    
    return generate_quality_report(results)
```

### React Component Quality Check
```typescript
async function checkReactQuality(componentPath: string) {
  const results = {
    accessibility: await runAxeLinter(componentPath),
    performance: await checkReactPerformance(componentPath),
    hooks: await validateHooksUsage(componentPath),
    props: await validatePropTypes(componentPath),
    testing: await checkTestCoverage(componentPath)
  };
  
  return generateComponentReport(results);
}
```

## Configuration

```yaml
hook:
  name: "code-quality-check"
  trigger: "file_save"
  manual: true
  
  conditions:
    - filePattern: "**/*.{ts,tsx}"
      checks: ["eslint", "prettier", "typescript", "security"]
      
    - filePattern: "**/*.{js,jsx}"
      checks: ["eslint", "prettier", "security"]
      
    - filePattern: "**/*.py"
      checks: ["pylint", "black", "bandit", "mypy"]

  quality_gates:
    eslint_max_errors: 0
    eslint_max_warnings: 5
    complexity_threshold: 10
    coverage_threshold: 80
    security_issues: 0

  auto_fix:
    prettier: true
    eslint_fixable: true
    black: true
    import_sorting: true
```

## Quality Rules

### JavaScript/TypeScript Rules
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:security/recommended"
  ],
  "rules": {
    "complexity": ["error", 10],
    "max-lines": ["error", 300],
    "max-params": ["error", 4],
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Python Rules
```ini
[pylint]
max-line-length = 88
max-complexity = 10
disable = missing-docstring

[bandit]
exclude_dirs = tests/
skips = B101,B601
```

### Security Rules
- No hardcoded secrets or API keys
- Secure random number generation
- SQL injection prevention
- XSS protection in React components
- CSRF token validation

## Quality Reports

### Individual File Report
```typescript
interface QualityReport {
  file: string;
  score: number; // 0-100
  issues: QualityIssue[];
  metrics: {
    complexity: number;
    lines: number;
    coverage: number;
  };
  suggestions: string[];
}
```

### Project Quality Dashboard
- Overall quality score
- Quality trends over time
- Top quality issues
- Team quality metrics
- Quality gate compliance

## Benefits

1. **Consistent Quality**: Enforces coding standards across the team
2. **Early Detection**: Catches issues before code review
3. **Security**: Prevents security vulnerabilities
4. **Maintainability**: Ensures code is readable and maintainable
5. **Performance**: Identifies performance issues early
6. **Documentation**: Encourages proper documentation

## Usage Examples

### Automatic Quality Check
When saving `services/src/api-gateway/auth.ts`:
- Runs ESLint with security rules
- Checks TypeScript compilation
- Validates code complexity
- Scans for security vulnerabilities
- Suggests improvements

### Manual Quality Review
Using command palette "Run Code Quality Check":
- Analyzes entire codebase or selected files
- Generates comprehensive quality report
- Provides actionable improvement suggestions
- Tracks quality metrics over time

### Pre-commit Quality Gate
Before committing code:
- Validates all changed files pass quality checks
- Blocks commits with critical issues
- Provides fix suggestions
- Updates quality metrics

## Auto-Fix Capabilities

### Automatic Fixes
- **Prettier**: Code formatting
- **ESLint**: Fixable linting issues
- **Import Sorting**: Organize imports
- **Black**: Python code formatting

### Suggested Fixes
- Code complexity reduction
- Performance optimizations
- Security vulnerability fixes
- Documentation improvements

## Integration

### IDE Integration
- Real-time quality feedback
- Inline error highlighting
- Quick fix suggestions
- Quality metrics display

### CI/CD Integration
```yaml
# GitHub Actions integration
- name: Code Quality Check
  run: |
    npm run quality:check
    python -m pytest testing/quality/
```

### Git Hooks Integration
```bash
# Pre-commit hook
#!/bin/sh
npm run quality:check --staged
```

## Customization

### Team-Specific Rules
```yaml
team_rules:
  backend:
    complexity_threshold: 8
    coverage_threshold: 90
    
  frontend:
    accessibility_level: "AA"
    performance_budget: "2MB"
    
  ai_ml:
    docstring_coverage: 95
    type_hint_coverage: 100
```

### Project-Specific Configuration
```yaml
project_config:
  exclude_patterns:
    - "**/*.generated.ts"
    - "**/migrations/**"
    - "**/vendor/**"
    
  custom_rules:
    - "no-todo-comments"
    - "require-jsdoc"
    - "prefer-arrow-functions"
```

## Troubleshooting

### Common Issues

**Quality Check Fails**
- Update linting rules configuration
- Check tool installations (ESLint, Pylint, etc.)
- Verify file permissions and access

**False Positives**
- Adjust quality thresholds
- Add specific rule exceptions
- Update ignore patterns

**Performance Issues**
- Enable incremental checking
- Use quality check caching
- Limit scope to changed files only

### Debugging

Enable detailed quality logging:
```bash
export QUALITY_CHECK_DEBUG=true
export ESLINT_DEBUG=true
```

View quality check logs:
```bash
tail -f .kiro/logs/hooks/code-quality-check.log
```

Run manual quality analysis:
```bash
npm run quality:analyze
npm run quality:report
```