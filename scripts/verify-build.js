#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build setup...\n');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} (missing)`);
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`✅ ${description}: ${dirPath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${dirPath} (missing)`);
    return false;
  }
}

console.log('📋 Checking project structure...');
checkFile('package.json', 'Root package.json');
checkFile('client/package.json', 'Client package.json');
checkFile('client/tsconfig.json', 'Client TypeScript config');
checkFile('services/package.json', 'Services package.json');
checkDirectory('client/src', 'Client source directory');
checkDirectory('client/src/contexts', 'Client contexts directory');

console.log('\n📋 Checking key files...');
checkFile('client/src/contexts/AuthContext.tsx', 'AuthContext');
checkFile('client/src/contexts/ThemeContext.tsx', 'ThemeContext');
checkFile('client/src/contexts/SocketContext.tsx', 'SocketContext');
checkFile('client/src/types/index.ts', 'Type definitions');

console.log('\n📋 Checking dependencies...');
try {
  const clientPackage = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
  const requiredDeps = ['react', 'react-dom', 'typescript', '@mui/material'];
  
  requiredDeps.forEach(dep => {
    if (clientPackage.dependencies[dep] || clientPackage.devDependencies[dep]) {
      console.log(`✅ ${dep}: installed`);
    } else {
      console.log(`❌ ${dep}: missing`);
    }
  });
} catch (error) {
  console.log('❌ Error reading client package.json');
}

console.log('\n🔧 Attempting to identify build issues...');

// Check TypeScript compilation
try {
  console.log('Testing TypeScript compilation...');
  execSync('cd client && npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout?.toString() || error.message);
}

// Check for import extension issues
console.log('\n📝 Checking for import extension issues...');
let importIssues = false;

try {
  const clientSrcPath = path.join(process.cwd(), 'client', 'src');
  if (fs.existsSync(clientSrcPath)) {
    function checkImportsInDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          checkImportsInDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(filePath, 'utf8');
          const extensionPattern = /import.*from\s+['"][^'"]*\.(tsx?|jsx?)['"]/g;
          let match;
          while ((match = extensionPattern.exec(content)) !== null) {
            console.log(`❌ Found import with extension in ${path.relative(process.cwd(), filePath)}: ${match[0]}`);
            importIssues = true;
          }
        }
      }
    }
    checkImportsInDir(clientSrcPath);
  }
  
  if (!importIssues) {
    console.log('✅ No import extension issues found');
  }
} catch (error) {
  console.log('⚠️  Could not check imports:', error.message);
}

// Check for common problematic icons
console.log('\n🎨 Checking for problematic Material-UI icons...');
const problematicIcons = ['Integration', 'CloudSync', 'AutoAwesome'];
let iconIssues = false;

try {
  const clientSrcPath = path.join(process.cwd(), 'client', 'src');
  if (fs.existsSync(clientSrcPath)) {
    function checkIconsInDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          checkIconsInDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const icon of problematicIcons) {
            if (content.includes(`${icon} as `) || content.includes(`import { ${icon}`)) {
              console.log(`❌ Found problematic icon "${icon}" in ${path.relative(process.cwd(), filePath)}`);
              iconIssues = true;
            }
          }
        }
      }
    }
    checkIconsInDir(clientSrcPath);
  }
  
  if (!iconIssues) {
    console.log('✅ No problematic icons found');
  }
} catch (error) {
  console.log('⚠️  Could not check icons:', error.message);
}

// Check for form type issues
console.log('\n📝 Checking for form validation type issues...');
try {
  const clientSrcPath = path.join(process.cwd(), 'client', 'src');
  if (fs.existsSync(clientSrcPath)) {
    let formIssues = false;
    
    function checkFormTypesInDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          checkFormTypesInDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Check for potential form type issues
          if (content.includes('yupResolver') && content.includes('yup.string()') && 
              (content.includes('TaskType') || content.includes('Priority') || content.includes('enum'))) {
            console.log(`⚠️  Potential form type issue in ${path.relative(process.cwd(), filePath)}`);
            formIssues = true;
          }
        }
      }
    }
    
    checkFormTypesInDir(clientSrcPath);
    
    if (!formIssues) {
      console.log('✅ No form validation type issues found');
    } else {
      console.log('   Run: npm run fix:forms');
    }
  }
} catch (error) {
  console.log('⚠️  Could not check form types:', error.message);
}

// Check for AJV issues
console.log('\n🔍 Checking for AJV dependency issues...');
try {
  const clientPath = path.join(process.cwd(), 'client');
  if (fs.existsSync(clientPath)) {
    // Try to require ajv to see if it's properly installed
    execSync('cd client && node -e "require(\'ajv\')"', { stdio: 'pipe' });
    console.log('✅ AJV module resolves correctly');
  }
} catch (error) {
  console.log('❌ AJV module resolution issue detected');
  console.log('   Run: npm run fix:ajv');
}

// Check package.json versions
console.log('\n📦 Checking package versions...');
try {
  const clientPkg = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
  const servicesPkg = JSON.parse(fs.readFileSync('services/package.json', 'utf8'));
  
  // Check TypeScript versions
  const clientTS = clientPkg.dependencies?.typescript || clientPkg.devDependencies?.typescript;
  const servicesTS = servicesPkg.dependencies?.typescript || servicesPkg.devDependencies?.typescript;
  
  if (clientTS && servicesTS && clientTS !== servicesTS) {
    console.log(`⚠️  TypeScript version mismatch: client(${clientTS}) vs services(${servicesTS})`);
  } else {
    console.log('✅ TypeScript versions consistent');
  }
  
  // Check ESLint versions
  const clientESLint = clientPkg.devDependencies?.eslint;
  const servicesESLint = servicesPkg.devDependencies?.eslint;
  
  if (clientESLint && servicesESLint && clientESLint !== servicesESLint) {
    console.log(`⚠️  ESLint version mismatch: client(${clientESLint}) vs services(${servicesESLint})`);
  } else {
    console.log('✅ ESLint versions consistent');
  }
} catch (error) {
  console.log('⚠️  Could not check package versions:', error.message);
}

console.log('\n✨ Build verification completed!');