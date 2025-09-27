# Troubleshooting Guide

## Build Issues

### Common Problems and Solutions

#### 1. npm install fails with "No matching version found"

**Problem**: Dependencies with incorrect versions or non-existent packages.

**Solution**:
```bash
# Clean install all dependencies
npm run clean:install

# Or manually clean and install
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
rm -rf services/node_modules services/package-lock.json
npm install
```

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

#### 3. TypeScript compilation errors

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

#### 4. React build fails

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