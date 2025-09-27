# Troubleshooting Guide

## Build Issues

### Common Problems and Solutions

#### 1. npm install fails with "No matching version found" or ESLint conflicts

**Problem**: Dependencies with incorrect versions, peer dependency conflicts, or ESLint version mismatches.

**Solution**:
```bash
# Fix dependency conflicts automatically
npm run fix:deps

# Or manually clean and install with legacy peer deps
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
rm -rf services/node_modules services/package-lock.json
npm install --legacy-peer-deps
cd client && npm install --legacy-peer-deps
cd ../services && npm install --legacy-peer-deps
```

**Common ESLint Conflicts**:
- Different ESLint versions across packages
- TypeScript ESLint plugin version mismatches
- Peer dependency conflicts with React Scripts

**Fixed Versions**:
- ESLint: `^8.57.1`
- @typescript-eslint/eslint-plugin: `^6.21.0`
- @typescript-eslint/parser: `^6.21.0`
- TypeScript: `^5.3.2`

#### 2. "Can't resolve './AuthContext'" error

**Problem**: Module resolution issues with TypeScript/React.

**Solution**:
1. Verify all context files exist:
   ```bash
   npm run verify:build
   ```

2. Check import paths are correct:
   ```typescript
   // Correct import
   import { useAuth } from './contexts/AuthContext';
   
   // Not this
   import { useAuth } from './contexts/AuthContext.tsx';
   ```

3. Ensure tsconfig.json exists in client directory

#### 3. TypeScript import path errors

**Problem**: Import paths ending with `.tsx` or `.ts` extensions cause compilation errors.

**Error**: `TS2691: An import path cannot end with a '.tsx' extension`

**Solution**:
```bash
# Automatically fix all import extensions
npm run fix:imports

# Or manually fix imports by removing extensions:
# ❌ Wrong
import { Component } from './Component.tsx';

# ✅ Correct  
import { Component } from './Component';
```

#### 4. TypeScript compilation errors

**Problem**: Type mismatches or missing type definitions.

**Solution**:
1. Check TypeScript configuration:
   ```bash
   cd client && npx tsc --noEmit
   ```

2. Install missing type definitions:
   ```bash
   cd client && npm install @types/react @types/react-dom
   ```

#### 5. Material-UI icon import errors

**Problem**: Icons like `Integration`, `CloudSync`, `AutoAwesome` don't exist in @mui/icons-material.

**Solution**:
Replace with valid Material-UI icons:
```typescript
// ❌ These don't exist
import { Integration, CloudSync, AutoAwesome } from '@mui/icons-material';

// ✅ Use these instead
import { Extension, Sync, Star } from '@mui/icons-material';
```

**Common Replacements**:
- `Integration` → `Extension` or `Link`
- `CloudSync` → `Sync` or `CloudDownload`
- `AutoAwesome` → `Star` or `Lightbulb`

#### 6. AJV module resolution errors

**Problem**: `Cannot find module 'ajv/dist/compile/codegen'` or similar AJV-related errors.

**Error**: `Error: Cannot find module 'ajv/dist/compile/codegen'`

**Solution**:
```bash
# Automated AJV fix (recommended)
npm run fix:ajv

# Or manual fix:
npm cache clean --force
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
npm install --legacy-peer-deps
cd client && npm install ajv@^8.12.0 --legacy-peer-deps
cd client && npm install --legacy-peer-deps
```

**Root Cause**: AJV version conflicts in the dependency tree, often caused by:
- Multiple versions of AJV being installed
- Peer dependency conflicts with build tools
- Cached dependency resolution issues

#### 7. React build fails

**Problem**: Various React/build tool issues.

**Solution**:
1. Clear React cache:
   ```bash
   cd client && rm -rf node_modules/.cache
   ```

2. Update React scripts:
   ```bash
   cd client && npm update react-scripts
   ```

3. Fix TypeScript compilation:
   ```bash
   cd client && npx tsc --noEmit
   ```

### Environment Setup

#### Prerequisites
- Node.js 18+ 
- npm 8+
- TypeScript 5+

#### Installation Steps
1. Clone the repository
2. Run setup script:
   ```bash
   npm run install:all
   ```
3. Verify installation:
   ```bash
   npm run verify:build
   ```

### Development Commands

```bash
# Fix dependency conflicts (recommended first step)
npm run fix:deps

# Fix AJV module resolution issues
npm run fix:ajv

# Fix TypeScript import extensions
npm run fix:imports

# Install all dependencies
npm run install:all

# Clean install (removes node_modules and package-lock.json)
npm run clean:install

# Verify build setup
npm run verify:build

# Start development servers
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Common Error Messages

#### "Module not found: Error: Can't resolve"
- Check file exists at the specified path
- Verify import statement syntax
- Ensure file extension is correct (.tsx for React components)

#### "Type 'X' is not assignable to type 'Y'"
- Check type definitions in `client/src/types/index.ts`
- Verify interface implementations match expected types
- Update type annotations as needed

#### "Cannot find module or its corresponding type declarations"
- Install missing package: `npm install <package-name>`
- Install type definitions: `npm install @types/<package-name>`
- Check package.json for correct dependency versions

### Getting Help

1. Run the verification script: `npm run verify:build`
2. Check the console output for specific error messages
3. Review this troubleshooting guide
4. Check the project documentation in `/docs`

### Performance Tips

- Use `npm ci` instead of `npm install` in CI/CD environments
- Clear npm cache if experiencing persistent issues: `npm cache clean --force`
- Use Node.js version manager (nvm) to ensure consistent Node.js version across environments