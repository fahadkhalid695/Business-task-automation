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

#### 4. TypeScript form validation errors

**Problem**: Yup resolver type mismatches with TypeScript interfaces.

**Error**: `Type 'Resolver<...>' is not assignable to type 'Resolver<TaskFormData, any, TaskFormData>'`

**Solution**:
```bash
# Automatically fix form type issues
npm run fix:forms

# Or manually fix by updating Yup schema:
# ❌ Wrong
type: yup.string().required('Task type is required'),

# ✅ Correct
type: yup.mixed<TaskType>().oneOf(Object.values(TaskType)).required('Task type is required'),
```

**Root Cause**: Yup schemas using `string()` validation for enum types instead of `mixed<EnumType>()`.

#### 5. TypeScript literal type errors

**Problem**: String literals not matching union types (e.g., `trend: 'up'` vs `trend: "up" | "down"`).

**Error**: `Type 'string' is not assignable to type '"up" | "down"'`

**Solution**:
```bash
# Automatically fix literal type issues
npm run fix:types

# Or manually fix by adding 'as const':
# ❌ Wrong
trend: 'up',
color: 'primary',

# ✅ Correct
trend: 'up' as const,
color: 'primary' as const,
```

**Root Cause**: TypeScript infers string literals as `string` type instead of specific literal types.

#### 6. TypeScript compilation errors

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

#### 7. Material-UI icon import errors

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

#### 8. AJV module resolution errors

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

#### 9. React build fails

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

# Fix form validation type issues
npm run fix:forms

# Fix TypeScript literal type issues
npm run fix:types

# Fix CI/CD pipeline issues
npm run fix:ci

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

## CI/CD Pipeline Issues

### Common CI/CD Problems and Solutions

#### 1. Pipeline fails with dependency errors

**Problem**: CI/CD pipeline fails during `npm ci` or dependency installation.

**Solution**:
```bash
# Fix CI/CD pipeline configuration
npm run fix:ci

# The fix will:
# - Update workflow to use npm install --legacy-peer-deps
# - Create missing Dockerfiles and scripts
# - Add missing package.json scripts
# - Create basic Kubernetes manifests
```

#### 2. Missing package-lock.json files

**Problem**: Pipeline expects package-lock.json but files don't exist.

**Solution**: The CI/CD workflow has been updated to use `package.json` for caching instead of lock files.

#### 3. Missing Docker build files

**Problem**: Pipeline references Dockerfiles that don't exist.

**Solution**: Run `npm run fix:ci` to create basic Dockerfile templates for all services.

#### 4. Missing Kubernetes manifests

**Problem**: Deployment steps reference missing k8s configuration files.

**Solution**: The fix script creates basic Kubernetes manifests in `services/k8s/`.

#### 5. Missing scripts in package.json

**Problem**: Pipeline calls scripts that don't exist (like `type-check`, `cypress:run`).

**Solution**: The fix script automatically adds missing scripts to package.json files.

### Performance Tips

- Use `npm ci` instead of `npm install` in CI/CD environments (when lock files exist)
- Clear npm cache if experiencing persistent issues: `npm cache clean --force`
- Use Node.js version manager (nvm) to ensure consistent Node.js version across environments
- Use the fixed CI/CD workflow (`.github/workflows/ci-cd-fixed.yml`) for better reliability