#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing TypeScript literal type issues...\n');

function fixLiteralTypesInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix common literal type issues
    const patterns = [
      // Fix trend property for StatsCard
      {
        pattern: /trend:\s*['"]up['"],/g,
        replacement: "trend: 'up' as const,",
        description: 'trend: up literal type'
      },
      {
        pattern: /trend:\s*['"]down['"],/g,
        replacement: "trend: 'down' as const,",
        description: 'trend: down literal type'
      },
      // Fix color property for StatsCard
      {
        pattern: /color:\s*['"]primary['"],/g,
        replacement: "color: 'primary' as const,",
        description: 'color: primary literal type'
      },
      {
        pattern: /color:\s*['"]secondary['"],/g,
        replacement: "color: 'secondary' as const,",
        description: 'color: secondary literal type'
      },
      {
        pattern: /color:\s*['"]success['"],/g,
        replacement: "color: 'success' as const,",
        description: 'color: success literal type'
      },
      {
        pattern: /color:\s*['"]error['"],/g,
        replacement: "color: 'error' as const,",
        description: 'color: error literal type'
      },
      {
        pattern: /color:\s*['"]warning['"],/g,
        replacement: "color: 'warning' as const,",
        description: 'color: warning literal type'
      },
      {
        pattern: /color:\s*['"]info['"],/g,
        replacement: "color: 'info' as const,",
        description: 'color: info literal type'
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
      console.log(`✅ Fixed literal types in ${path.relative(process.cwd(), filePath)}`);
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
        
        // Check if file contains potential literal type issues
        if (content.includes('StatsCard') || content.includes('trend:') || 
            (content.includes('color:') && content.includes('primary'))) {
          console.log(`🔍 Checking ${path.relative(process.cwd(), filePath)}...`);
          if (fixLiteralTypesInFile(filePath)) {
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
  console.log('📁 Scanning client/src directory for literal type issues...');
  const fixedCount = scanDirectory(clientSrcPath);
  
  if (fixedCount === 0) {
    console.log('✅ No literal type issues found to fix');
  } else {
    console.log(`\n🎉 Fixed literal types in ${fixedCount} files`);
  }
} else {
  console.log('❌ Client src directory not found');
}

console.log('\n📋 Literal type fix completed!');