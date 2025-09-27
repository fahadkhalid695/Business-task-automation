#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing TypeScript import extensions...\n');

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix .tsx extensions
    const tsxPattern = /import\s+([^'"]*)\s+from\s+['"]([^'"]+)\.tsx['"]/g;
    if (tsxPattern.test(content)) {
      content = content.replace(tsxPattern, "import $1 from '$2'");
      modified = true;
    }
    
    // Fix .ts extensions
    const tsPattern = /import\s+([^'"]*)\s+from\s+['"]([^'"]+)\.ts['"]/g;
    if (tsPattern.test(content)) {
      content = content.replace(tsPattern, "import $1 from '$2'");
      modified = true;
    }
    
    // Fix .jsx extensions
    const jsxPattern = /import\s+([^'"]*)\s+from\s+['"]([^'"]+)\.jsx['"]/g;
    if (jsxPattern.test(content)) {
      content = content.replace(jsxPattern, "import $1 from '$2'");
      modified = true;
    }
    
    // Fix .js extensions (in TypeScript files)
    const jsPattern = /import\s+([^'"]*)\s+from\s+['"]([^'"]+)\.js['"]/g;
    if (jsPattern.test(content)) {
      content = content.replace(jsPattern, "import $1 from '$2'");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed imports in ${path.relative(process.cwd(), filePath)}`);
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
        if (fixImportsInFile(filePath)) {
          fixedCount++;
        }
      }
    }
  }
  
  processDirectory(dir);
  return fixedCount;
}

const clientSrcPath = path.join(process.cwd(), 'client', 'src');
if (fs.existsSync(clientSrcPath)) {
  console.log('📁 Scanning client/src directory...');
  const fixedCount = scanDirectory(clientSrcPath);
  
  if (fixedCount === 0) {
    console.log('✅ No import extensions found to fix');
  } else {
    console.log(`\n🎉 Fixed imports in ${fixedCount} files`);
  }
} else {
  console.log('❌ Client src directory not found');
}

console.log('\n📋 Import extension fix completed!');