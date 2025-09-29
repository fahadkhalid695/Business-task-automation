# Business Task Automation Platform - Backend Services

A comprehensive backend API for business task automation with AI integration, supporting both Grok (xAI) and OpenAI providers.

## Features

- 🤖 **AI Integration**: Support for Grok (xAI) and OpenAI with automatic fallback
- 🔐 **Security**: JWT authentication, role-based access control, input validation
- 📊 **Analytics**: Task and workflow performance monitoring
- 🔄 **Workflows**: Create, execute, and optimize business workflows
- 📝 **Tasks**: Task management with priority and status tracking
- 🔗 **Integrations**: External service integrations (Slack, Google Sheets, etc.)
- 📧 **Notifications**: Real-time notifications system
- 🛡️ **Security**: Rate limiting, audit logging, encryption

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (optional, uses in-memory storage by default)
- Redis (optional, for rate limiting)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd services

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys and configuration
nano .env
```

### Configuration

Edit `.env` file with your settings:

```env
# Required: Security keys
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# AI Provider (choose one or both)
AI_PROVIDER=grok
GROK_API_KEY=your-grok-api-key-here
OPENAI_API_KEY=your-openai-api-key
```

### Running the Server

```bash
# Development mode with hot reload
npm run dev

# Development with debugging
npm run dev:debug

# Check development environment
npm run dev:check

# Production mode
npm run build
npm start

# Direct TypeScript execution
npm run start:dev
```

The server will start on `http://localhost:3001`

### Development Scripts

- `npm run dev` - Start with hot reload
- `npm run dev:debug` - Start with debugging (port 9229)
- `npm run dev:check` - Check environment setup
- `npm run build:watch` - Build with file watching
- `npm run test:watch` - Run tests in watch mode
- `npm run health` - Check server health
- `npm run logs` - View application logs

See [DEV_GUIDE.md](./DEV_GUIDE.md) for detailed development instructions.

## API Documentation

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Default Users

For testing, use these default credentials:

- **Admin**: `admin@example.com` / `password`
- **User**: `user@example.com` / `password`

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

#### AI Provider Management
- `GET /api/ai-provider/status` - Get current AI provider status
- `POST /api/ai-provider/switch` - Switch AI provider (admin only)
- `POST /api/ai-provider/test` - Test AI provider
- `POST /api/ai-provider/generate-code` - Generate code with AI

#### AI Services
- `POST /api/ai/generate-text` - Generate text
- `POST /api/ai/analyze-text` - Analyze text sentiment/topics
- `POST /api/ai/summarize` - Summarize text
- `POST /api/ai/translate` - Translate text

#### Tasks & Workflows
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `POST /api/workflows/:id/execute` - Execute workflow

## Security Features

- **JWT Authentication** with secure token generation
- **Role-based Access Control** (Admin, Manager, User, Viewer)
- **Input Validation** and sanitization
- **Rate Limiting** to prevent abuse
- **Audit Logging** for security events
- **CORS Protection** with configurable origins
- **Security Headers** via Helmet.js
- **Password Security** with bcrypt hashing

## AI Provider Support

### Grok (xAI)
- Latest AI model with real-time knowledge
- Code generation capabilities
- Competitive pricing

### OpenAI
- GPT-3.5 and GPT-4 models
- Mature API with extensive features
- Automatic fallback support

## Development

### Project Structure

```
services/
├── src/
│   ├── middleware/     # Authentication, validation
│   ├── routes/         # API endpoints
│   ├── services/       # AI services
│   ├── utils/          # Utilities, encryption, logging
│   └── server.ts       # Main server file
├── logs/               # Application logs
└── package.json
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Deployment

### Environment Variables

Ensure all required environment variables are set in production:

- `JWT_SECRET` - At least 32 characters
- `ENCRYPTION_KEY` - 64 hex characters
- `AI_PROVIDER` - 'grok' or 'openai'
- `GROK_API_KEY` or `OPENAI_API_KEY`

### Docker Support

```bash
docker build -t business-automation-api .
docker run -p 3001:3001 --env-file .env business-automation-api
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details