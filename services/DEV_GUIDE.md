# Services Development Guide

## Quick Start

```bash
# 1. Setup environment
npm run setup

# 2. Check development environment
npm run dev:check

# 3. Start development server
npm run dev

# 4. Check if server is running
npm run health
```

## Development Scripts

### Core Development
- `npm run dev` - Start development server with hot reload
- `npm run dev:debug` - Start with debugging enabled (port 9229)
- `npm run dev:ts` - Direct TypeScript execution
- `npm run dev:check` - Check development environment

### Building & Testing
- `npm run build` - Build for production
- `npm run build:watch` - Build with file watching
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Code Quality
- `npm run lint` - Check code style
- `npm run lint:fix` - Fix code style issues
- `npm run type-check` - Check TypeScript types

### Utilities
- `npm run health` - Check server health
- `npm run logs` - View application logs
- `npm run clean` - Clean build directory

## Environment Setup

### Required Environment Variables
```env
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### AI Provider Configuration
```env
AI_PROVIDER=grok
GROK_API_KEY=your-grok-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
```

## Development Workflow

1. **Start Development**:
   ```bash
   npm run dev
   ```

2. **Check Environment**:
   ```bash
   npm run dev:check
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```

4. **Check Code Quality**:
   ```bash
   npm run lint
   npm run type-check
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## Debugging

### VS Code Debug Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Services",
  "program": "${workspaceFolder}/services/src/server.ts",
  "outFiles": ["${workspaceFolder}/services/dist/**/*.js"],
  "runtimeArgs": ["-r", "ts-node/register"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Debug with Chrome DevTools
```bash
npm run dev:debug
# Open chrome://inspect in Chrome
```

## File Structure

```
services/
├── src/
│   ├── middleware/     # Authentication, validation
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── utils/          # Utilities
│   └── server.ts       # Main server file
├── logs/               # Application logs
├── dist/               # Built files
├── nodemon.json        # Nodemon configuration
└── tsconfig.json       # TypeScript configuration
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### AI Provider
- `GET /api/ai-provider/status` - Get provider status
- `POST /api/ai-provider/switch` - Switch provider (admin)
- `POST /api/ai-provider/test` - Test provider

### AI Services
- `POST /api/ai/generate-text` - Generate text
- `POST /api/ai/analyze-text` - Analyze text
- `POST /api/ai/summarize` - Summarize text

## Default Test Users

- **Admin**: `admin@example.com` / `password`
- **User**: `user@example.com` / `password`

## Troubleshooting

### Server Won't Start
1. Check environment variables: `npm run dev:check`
2. Check port availability: `lsof -i :3001`
3. Check logs: `npm run logs`

### TypeScript Errors
1. Check types: `npm run type-check`
2. Rebuild: `npm run clean && npm run build`

### Dependencies Issues
1. Clean install: `rm -rf node_modules && npm install`
2. Check for conflicts: `npm ls`

### AI Provider Issues
1. Check API keys in `.env`
2. Test provider: `POST /api/ai-provider/test`
3. Check provider status: `GET /api/ai-provider/status`

## Performance Tips

- Use `npm run dev:debug` for debugging
- Use `npm run build:watch` for faster rebuilds
- Monitor logs with `npm run logs`
- Check health regularly with `npm run health`