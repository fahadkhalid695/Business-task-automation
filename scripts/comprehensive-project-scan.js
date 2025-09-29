#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 COMPREHENSIVE PROJECT SCAN\n');
console.log('Analyzing entire project for ALL issues...\n');

const issues = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: []
};

function addIssue(severity, type, file, description, fix = null) {
  issues[severity].push({
    type,
    file: file ? path.relative(process.cwd(), file) : 'Project Root',
    description,
    fix
  });
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    const ext = path.extname(filePath);
    
    // TypeScript/JavaScript file checks
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      
      // 1. Import extension issues
      const importExtensions = content.match(/import.*from\s+['"][^'"]*\.(tsx?|jsx?)['"]/g);
      if (importExtensions) {
        addIssue('high', 'Import Extensions', filePath, 
          `Found ${importExtensions.length} imports with file extensions`, 
          'npm run fix:imports');
      }
      
      // 2. Material-UI icon issues
      const problematicIcons = ['Integration', 'CloudSync', 'AutoAwesome'];
      problematicIcons.forEach(icon => {
        if (content.includes(`${icon} as `) || content.includes(`import { ${icon}`)) {
          addIssue('high', 'Invalid Icons', filePath, 
            `Uses non-existent Material-UI icon: ${icon}`, 
            'Replace with valid icon (Extension, Sync, Star)');
        }
      });
      
      // 3. Form validation type issues
      if (content.includes('yupResolver') && content.includes('yup.string()') && 
          (content.includes('TaskType') || content.includes('Priority'))) {
        addIssue('high', 'Form Types', filePath, 
          'Yup schema type mismatch with TypeScript enums', 
          'npm run fix:forms');
      }
      
      // 4. Literal type issues
      const literalTypePatterns = [
        /trend:\s*['"]up['"],/g,
        /trend:\s*['"]down['"],/g,
        /color:\s*['"]primary['"],/g,
        /color:\s*['"]success['"],/g,
        /color:\s*['"]warning['"],/g,
        /color:\s*['"]error['"],/g,
        /color:\s*['"]info['"],/g
      ];
      
      literalTypePatterns.forEach(pattern => {
        if (pattern.test(content)) {
          addIssue('medium', 'Literal Types', filePath, 
            'String literals need "as const" for union types', 
            'npm run fix:types');
        }
      });
      
      // 5. Console.log statements (should be removed in production)
      const consoleLogs = content.match(/console\.(log|warn|error|debug)/g);
      if (consoleLogs && consoleLogs.length > 5) {
        addIssue('low', 'Console Logs', filePath, 
          `Found ${consoleLogs.length} console statements`, 
          'Remove or replace with proper logging');
      }
      
      // 6. TODO/FIXME comments
      const todos = content.match(/(TODO|FIXME|HACK|XXX):/gi);
      if (todos) {
        addIssue('info', 'TODO Comments', filePath, 
          `Found ${todos.length} TODO/FIXME comments`, 
          'Address pending tasks');
      }
      
      // 7. Unused imports (basic check)
      const imports = content.match(/import\s+{([^}]+)}\s+from/g);
      if (imports) {
        imports.forEach(importStatement => {
          const importedItems = importStatement.match(/{([^}]+)}/)[1]
            .split(',').map(item => item.trim().split(' as ')[0]);
          
          importedItems.forEach(item => {
            if (item && !content.includes(item.replace(/[{}]/g, ''))) {
              addIssue('low', 'Unused Imports', filePath, 
                `Potentially unused import: ${item}`, 
                'Remove unused imports');
            }
          });
        });
      }
      
      // 8. Missing error handling
      if (content.includes('async ') && !content.includes('try') && !content.includes('catch')) {
        addIssue('medium', 'Error Handling', filePath, 
          'Async functions without error handling', 
          'Add try-catch blocks');
      }
      
      // 9. Hardcoded URLs/secrets
      const hardcodedUrls = content.match(/https?:\/\/[^\s'"]+/g);
      if (hardcodedUrls) {
        addIssue('medium', 'Hardcoded URLs', filePath, 
          `Found ${hardcodedUrls.length} hardcoded URLs`, 
          'Move to environment variables');
      }
      
      // 10. Missing TypeScript types
      if (ext === '.ts' || ext === '.tsx') {
        if (content.includes(': any') || content.includes('as any')) {
          const anyCount = (content.match(/:\s*any|as\s+any/g) || []).length;
          addIssue('medium', 'TypeScript Types', filePath, 
            `Found ${anyCount} "any" types`, 
            'Replace with proper types');
        }
      }
    }
    
    // JSON file checks
    if (ext === '.json') {
      try {
        JSON.parse(content);
      } catch (error) {
        addIssue('critical', 'JSON Syntax', filePath, 
          'Invalid JSON syntax', 
          'Fix JSON syntax errors');
      }
      
      // Package.json specific checks
      if (path.basename(filePath) === 'package.json') {
        const pkg = JSON.parse(content);
        
        // Check for missing scripts
        const expectedScripts = ['build', 'test', 'start'];
        expectedScripts.forEach(script => {
          if (!pkg.scripts || !pkg.scripts[script]) {
            addIssue('medium', 'Missing Scripts', filePath, 
              `Missing ${script} script`, 
              `Add ${script} script to package.json`);
          }
        });
        
        // Check for security vulnerabilities in dependencies
        if (pkg.dependencies) {
          Object.entries(pkg.dependencies).forEach(([name, version]) => {
            if (version.includes('*') || version.includes('x')) {
              addIssue('high', 'Dependency Security', filePath, 
                `Unsafe version pattern for ${name}: ${version}`, 
                'Use specific version numbers');
            }
          });
        }
      }
    }
    
    // Dockerfile checks
    if (path.basename(filePath) === 'Dockerfile' || filePath.includes('Dockerfile')) {
      if (!content.includes('HEALTHCHECK')) {
        addIssue('medium', 'Docker Health', filePath, 
          'Missing HEALTHCHECK instruction', 
          'Add HEALTHCHECK to Dockerfile');
      }
      
      if (content.includes('ADD ') && !content.includes('COPY ')) {
        addIssue('low', 'Docker Best Practices', filePath, 
          'Use COPY instead of ADD when possible', 
          'Replace ADD with COPY');
      }
    }
    
    // YAML file checks
    if (['.yml', '.yaml'].includes(ext)) {
      // Basic YAML syntax check
      try {
        // Simple check for common YAML issues
        if (content.includes('\t')) {
          addIssue('medium', 'YAML Syntax', filePath, 
            'YAML files should use spaces, not tabs', 
            'Replace tabs with spaces');
        }
      } catch (error) {
        addIssue('high', 'YAML Syntax', filePath, 
          'YAML syntax error', 
          'Fix YAML syntax');
      }
    }
    
  } catch (error) {
    addIssue('low', 'File Access', filePath, 
      `Cannot read file: ${error.message}`, 
      'Check file permissions');
  }
}

function scanDirectory(dir, depth = 0) {
  if (depth > 10) return; // Prevent infinite recursion
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      // Skip certain directories
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(file)) {
          continue;
        }
        scanDirectory(filePath, depth + 1);
      } else {
        scanFile(filePath);
      }
    }
  } catch (error) {
    addIssue('low', 'Directory Access', dir, 
      `Cannot read directory: ${error.message}`, 
      'Check directory permissions');
  }
}

function checkProjectStructure() {
  console.log('📁 Checking project structure...');
  
  // Check for essential files
  const essentialFiles = [
    'package.json',
    'README.md',
    '.gitignore',
    'client/package.json',
    'services/package.json',
    'client/tsconfig.json'
  ];
  
  essentialFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      addIssue('high', 'Missing Files', null, 
        `Missing essential file: ${file}`, 
        `Create ${file}`);
    }
  });
  
  // Check for package-lock.json files
  const lockFiles = ['package-lock.json', 'client/package-lock.json', 'services/package-lock.json'];
  lockFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      addIssue('medium', 'Missing Lock Files', null, 
        `Missing lock file: ${file}`, 
        'Run npm install to generate lock files');
    }
  });
  
  // Check for environment files
  if (!fs.existsSync('services/.env.example')) {
    addIssue('medium', 'Environment Config', null, 
      'Missing .env.example file', 
      'Create .env.example with required variables');
  }
}

function checkDependencies() {
  console.log('📦 Checking dependencies...');
  
  try {
    // Check for dependency conflicts
    const clientPkg = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
    const servicesPkg = JSON.parse(fs.readFileSync('services/package.json', 'utf8'));
    
    // Check TypeScript versions
    const clientTS = clientPkg.dependencies?.typescript || clientPkg.devDependencies?.typescript;
    const servicesTS = servicesPkg.dependencies?.typescript || servicesPkg.devDependencies?.typescript;
    
    if (clientTS && servicesTS && clientTS !== servicesTS) {
      addIssue('high', 'Version Conflicts', null, 
        `TypeScript version mismatch: client(${clientTS}) vs services(${servicesTS})`, 
        'Standardize TypeScript versions');
    }
    
    // Check for known vulnerable packages
    const vulnerablePackages = ['lodash@4.17.20', 'axios@0.21.0', 'node-fetch@2.6.0'];
    [clientPkg, servicesPkg].forEach((pkg, index) => {
      const pkgName = index === 0 ? 'client' : 'services';
      if (pkg.dependencies) {
        Object.entries(pkg.dependencies).forEach(([name, version]) => {
          vulnerablePackages.forEach(vuln => {
            if (vuln.startsWith(name + '@') && version.includes(vuln.split('@')[1])) {
              addIssue('critical', 'Security Vulnerability', null, 
                `Vulnerable package in ${pkgName}: ${name}@${version}`, 
                'Update to latest secure version');
            }
          });
        });
      }
    });
    
  } catch (error) {
    addIssue('medium', 'Dependency Check', null, 
      'Cannot analyze dependencies', 
      'Check package.json files');
  }
}

function checkGitConfiguration() {
  console.log('🔧 Checking Git configuration...');
  
  if (!fs.existsSync('.gitignore')) {
    addIssue('medium', 'Git Config', null, 
      'Missing .gitignore file', 
      'Create .gitignore file');
  } else {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const requiredIgnores = ['node_modules', '.env', 'dist', 'build', 'coverage'];
    
    requiredIgnores.forEach(ignore => {
      if (!gitignore.includes(ignore)) {
        addIssue('low', 'Git Ignore', '.gitignore', 
          `Missing ${ignore} in .gitignore`, 
          `Add ${ignore} to .gitignore`);
      }
    });
  }
}

function checkSecurity() {
  console.log('🔒 Checking security issues...');
  
  // Check for exposed secrets
  const secretPatterns = [
    /api[_-]?key[s]?\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret[s]?\s*[:=]\s*['"][^'"]+['"]/gi,
    /password[s]?\s*[:=]\s*['"][^'"]+['"]/gi,
    /token[s]?\s*[:=]\s*['"][^'"]+['"]/gi
  ];
  
  function checkFileForSecrets(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      secretPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          addIssue('critical', 'Exposed Secrets', filePath, 
            `Potential exposed secret: ${matches[0].substring(0, 50)}...`, 
            'Move secrets to environment variables');
        }
      });
    } catch (error) {
      // Ignore file read errors
    }
  }
  
  // Scan common files for secrets
  const filesToCheck = [
    'client/src/config.js',
    'client/src/config.ts',
    'services/src/config.js',
    'services/src/config.ts',
    '.env',
    'services/.env'
  ];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      checkFileForSecrets(file);
    }
  });
}

// Run comprehensive scan
console.log('🚀 Starting comprehensive project scan...\n');

checkProjectStructure();
checkDependencies();
checkGitConfiguration();
checkSecurity();

console.log('📂 Scanning all project files...');
scanDirectory(process.cwd());

// Generate report
console.log('\n' + '='.repeat(80));
console.log('📊 COMPREHENSIVE PROJECT ANALYSIS REPORT');
console.log('='.repeat(80));

const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

console.log(`\n📈 SUMMARY: Found ${totalIssues} total issues`);
console.log(`🔴 Critical: ${issues.critical.length}`);
console.log(`🟠 High: ${issues.high.length}`);
console.log(`🟡 Medium: ${issues.medium.length}`);
console.log(`🔵 Low: ${issues.low.length}`);
console.log(`ℹ️  Info: ${issues.info.length}`);

// Display issues by severity
['critical', 'high', 'medium', 'low', 'info'].forEach(severity => {
  if (issues[severity].length > 0) {
    console.log(`\n${'🔴🟠🟡🔵ℹ️'[['critical', 'high', 'medium', 'low', 'info'].indexOf(severity)]} ${severity.toUpperCase()} ISSUES (${issues[severity].length}):`);
    console.log('-'.repeat(50));
    
    issues[severity].forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.type}] ${issue.file}`);
      console.log(`   ${issue.description}`);
      if (issue.fix) {
        console.log(`   💡 Fix: ${issue.fix}`);
      }
      console.log('');
    });
  }
});

// Generate fix recommendations
console.log('\n🛠️  RECOMMENDED FIXES:');
console.log('-'.repeat(50));

if (issues.critical.length > 0 || issues.high.length > 0) {
  console.log('1. Run comprehensive fix: npm run fix:all');
  console.log('2. Fix critical security issues first');
  console.log('3. Address high-priority type and import issues');
}

if (issues.medium.length > 0) {
  console.log('4. Review and fix medium-priority issues');
  console.log('5. Update dependencies and configurations');
}

if (issues.low.length > 0 || issues.info.length > 0) {
  console.log('6. Clean up code quality issues');
  console.log('7. Address TODO comments and unused code');
}

console.log('\n🎯 PRIORITY ORDER:');
console.log('1. Security vulnerabilities and exposed secrets');
console.log('2. Build-breaking TypeScript and import errors');
console.log('3. Dependency conflicts and missing files');
console.log('4. Code quality and best practices');
console.log('5. Documentation and cleanup tasks');

console.log('\n✨ Run "npm run fix:all" to automatically fix many of these issues!');

// Exit with error code if critical issues found
if (issues.critical.length > 0) {
  console.log('\n❌ Critical issues found! Please address them immediately.');
  process.exit(1);
} else if (issues.high.length > 0) {
  console.log('\n⚠️  High-priority issues found. Recommend fixing before deployment.');
  process.exit(1);
} else {
  console.log('\n✅ No critical or high-priority issues found!');
  process.exit(0);
}