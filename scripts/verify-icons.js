#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common Material-UI icons that are known to exist
const knownIcons = [
  'Add', 'PlayArrow', 'Upload', 'Settings', 'Analytics', 'Extension',
  'Edit', 'Delete', 'Notifications', 'Security', 'Palette', 'Language',
  'Storage', 'Sync', 'Star', 'Home', 'CheckCircle', 'MoreVert',
  'TrendingUp', 'TrendingDown', 'Assignment', 'Speed', 'Error',
  'Schedule', 'Person', 'AccessTime', 'Close', 'CloudUpload',
  'AttachFile', 'DragIndicator', 'Visibility', 'Save', 'Menu',
  'DarkMode', 'LightMode', 'AccountCircle', 'Logout', 'Dashboard',
  'Task', 'AccountTree', 'Pause', 'Cancel', 'Clear', 'Refresh',
  'FilterList', 'Download', 'Stop', 'Email'
];

// Icons that are known to NOT exist or be problematic
const problematicIcons = [
  'Integration', 'CloudSync', 'AutoAwesome'
];

console.log('🔍 Verifying Material-UI icon imports...\n');

function findIconImports(dir) {
  const results = [];
  
  function scanDirectory(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const iconImportRegex = /(\w+)\s+as\s+\w+Icon.*from\s+['"]@mui\/icons-material['"]/g;
        let match;
        
        while ((match = iconImportRegex.exec(content)) !== null) {
          const iconName = match[1];
          results.push({
            file: filePath,
            icon: iconName,
            line: content.substring(0, match.index).split('\n').length
          });
        }
      }
    }
  }
  
  scanDirectory(dir);
  return results;
}

const clientSrcPath = path.join(process.cwd(), 'client', 'src');
if (!fs.existsSync(clientSrcPath)) {
  console.log('❌ Client src directory not found');
  process.exit(1);
}

const iconImports = findIconImports(clientSrcPath);

console.log(`📊 Found ${iconImports.length} icon imports\n`);

let hasProblems = false;

iconImports.forEach(({ file, icon, line }) => {
  const relativePath = path.relative(process.cwd(), file);
  
  if (problematicIcons.includes(icon)) {
    console.log(`❌ PROBLEMATIC: ${icon} in ${relativePath}:${line}`);
    hasProblems = true;
  } else if (knownIcons.includes(icon)) {
    console.log(`✅ OK: ${icon} in ${relativePath}:${line}`);
  } else {
    console.log(`⚠️  UNKNOWN: ${icon} in ${relativePath}:${line} (verify this exists)`);
  }
});

if (hasProblems) {
  console.log('\n❌ Found problematic icon imports that need to be fixed');
  process.exit(1);
} else {
  console.log('\n✅ All icon imports look good!');
}