#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing form type issues...\n');

function fixFormTypesInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix common Yup schema type issues
    const patterns = [
      // Fix enum types in Yup schemas
      {
        pattern: /yup\.string\(\)\.required\([^)]+\)(?=.*oneOf)/g,
        replacement: 'yup.mixed().oneOf',
        description: 'enum validation'
      },
      // Fix mixed type declarations
      {
        pattern: /yup\.mixed\(\)\.oneOf\(Object\.values\((\w+)\)\)/g,
        replacement: 'yup.mixed<$1>().oneOf(Object.values($1))',
        description: 'mixed type with generics'
      }
    ];
    
    patterns.forEach(({ pattern, replacement, description }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
        console.log(`  ✅ Fixed ${description}`);
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed form types in ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function scanDirectory(dir) {
  let fixedCount = 0;
  
  function processDirectory(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        processDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check if file contains form-related code
        if (content.includes('yupResolver') || content.includes('useForm') || content.includes('yup.object')) {
          console.log(`🔍 Checking ${path.relative(process.cwd(), filePath)}...`);
          if (fixFormTypesInFile(filePath)) {
            fixedCount++;
          }
        }
      }
    }
  }
  
  processDirectory(dir);
  return fixedCount;
}

const clientSrcPath = path.join(process.cwd(), 'client', 'src');
if (fs.existsSync(clientSrcPath)) {
  console.log('📁 Scanning client/src directory for form type issues...');
  const fixedCount = scanDirectory(clientSrcPath);
  
  if (fixedCount === 0) {
    console.log('✅ No form type issues found to fix');
  } else {
    console.log(`\n🎉 Fixed form types in ${fixedCount} files`);
  }
} else {
  console.log('❌ Client src directory not found');
}

console.log('\n📋 Form type fix completed!');