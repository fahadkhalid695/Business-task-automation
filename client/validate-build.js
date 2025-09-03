const fs = require('fs');
const path = require('path');

// Simple build validation script
function validateProject() {
  console.log('🔍 Validating React TypeScript project...');
  
  // Check package.json
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('✅ package.json found');
  console.log(`   Project: ${packageJson.name}`);
  console.log(`   Version: ${packageJson.version}`);
  
  // Check TypeScript config
  const tsconfigPath = path.join(__dirname, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    console.log('⚠️  tsconfig.json not found - using default CRA TypeScript config');
  } else {
    console.log('✅ tsconfig.json found');
  }
  
  // Check source directory structure
  const srcPath = path.join(__dirname, 'src');
  if (!fs.existsSync(srcPath)) {
    console.error('❌ src directory not found');
    return false;
  }
  console.log('✅ src directory found');
  
  // Check key files
  const keyFiles = [
    'src/App.tsx',
    'src/index.tsx',
    'src/types/index.ts',
    'src/contexts/AuthContext.tsx',
    'src/contexts/ThemeContext.tsx',
    'src/pages/dashboard/DashboardPage.tsx',
    'src/pages/tasks/TasksPage.tsx',
    'src/pages/analytics/AnalyticsPage.tsx',
    'src/components/tasks/TaskCard.tsx',
    'src/services/apiClient.ts'
  ];
  
  let missingFiles = [];
  keyFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - MISSING`);
      missingFiles.push(file);
    }
  });
  
  // Check dependencies
  const requiredDeps = [
    '@mui/material',
    '@mui/icons-material',
    'react',
    'react-dom',
    'react-router-dom',
    'axios',
    'socket.io-client',
    'recharts',
    'react-beautiful-dnd',
    'react-dropzone'
  ];
  
  console.log('\n📦 Checking dependencies...');
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
      missingFiles.push(`dependency: ${dep}`);
    }
  });
  
  // Check Cypress E2E tests
  console.log('\n🧪 Checking E2E test structure...');
  const cypressFiles = [
    'cypress.config.ts',
    'cypress/support/commands.ts',
    'cypress/e2e/dashboard.cy.ts',
    'cypress/e2e/tasks.cy.ts',
    'cypress/e2e/analytics.cy.ts'
  ];
  
  cypressFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - MISSING`);
    }
  });
  
  console.log('\n📊 Project Summary:');
  console.log(`   Total components: ${countFiles(path.join(__dirname, 'src/components'), '.tsx')}`);
  console.log(`   Total pages: ${countFiles(path.join(__dirname, 'src/pages'), '.tsx')}`);
  console.log(`   Total services: ${countFiles(path.join(__dirname, 'src/services'), '.ts')}`);
  console.log(`   Total contexts: ${countFiles(path.join(__dirname, 'src/contexts'), '.tsx')}`);
  
  if (missingFiles.length === 0) {
    console.log('\n🎉 Project validation successful! Ready for development.');
    return true;
  } else {
    console.log(`\n⚠️  Project validation completed with ${missingFiles.length} issues.`);
    return false;
  }
}

function countFiles(dir, extension) {
  if (!fs.existsSync(dir)) return 0;
  
  let count = 0;
  function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    files.forEach(file => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith(extension)) {
        count++;
      }
    });
  }
  
  walkDir(dir);
  return count;
}

// Run validation
validateProject();