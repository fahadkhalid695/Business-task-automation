# Making the Business Automation Platform Functional

## 🚨 Current Issue
The platform currently appears as a "static website" because it lacks:
- Database connections
- External API integrations (Gmail, Slack, etc.)
- Functional backend services
- Proper environment configuration

## 🎯 Solution: Complete Functional Setup

### Step 1: Run the Functional Setup Script
```bash
npm run make:functional
```

This creates all the missing functional components:
- ✅ Database connection service
- ✅ External API integration service  
- ✅ Gmail integration for email automation
- ✅ Functional workflow engine
- ✅ Working API Gateway with real endpoints
- ✅ Environment configuration files

### Step 2: Install Platform Dependencies
```bash
npm run install:platform
```

This installs all required dependencies and sets up the project structure.

### Step 3: Get Required API Keys

#### Essential (Platform won't work without these):
1. **MongoDB Database**
   - Option A: Install locally: `brew install mongodb` (Mac) or download from mongodb.com
   - Option B: Use MongoDB Atlas (free): https://www.mongodb.com/atlas
   - Set: `MONGODB_URI=mongodb://localhost:27017/business-automation`

2. **OpenAI API Key** (for AI features)
   - Go to: https://platform.openai.com/
   - Create account → API Keys → Create new key
   - Set: `OPENAI_API_KEY=your-openai-api-key`

#### Important (Major features):
3. **Google OAuth2** (for Gmail/Calendar automation)
   - Go to: https://console.cloud.google.com/
   - Create project → Enable Gmail API & Calendar API
   - Create OAuth2 credentials
   - Set: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

#### Optional (Enhanced features):
4. **Slack Bot Token** (for Slack integration)
   - Go to: https://api.slack.com/apps
   - Create app → Bot Token Scopes → Install to workspace
   - Set: `SLACK_BOT_TOKEN=xoxb-your-token`

5. **Twilio** (for SMS notifications)
   - Go to: https://www.twilio.com/
   - Create account → Get Account SID, Auth Token, Phone Number
   - Set: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### Step 4: Configure Environment Variables
```bash
# Copy example files
cp services/.env.example services/.env
cp client/.env.example client/.env

# Edit with your API keys
nano services/.env  # or use your preferred editor
```

**Minimum required in services/.env:**
```env
MONGODB_URI=mongodb://localhost:27017/business-automation
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-super-secret-jwt-key
```

### Step 5: Set Up Database
```bash
npm run setup:db
```

This creates the MongoDB collections and indexes needed for the platform.

### Step 6: Start the Platform
```bash
npm run dev
```

This starts both:
- Backend API (http://localhost:3000)
- Frontend Client (http://localhost:3001)

## 🎉 What You'll Have After Setup

### Functional Features:
- ✅ **Real Database Storage** - MongoDB with proper collections
- ✅ **Email Automation** - Send emails via Gmail API
- ✅ **Workflow Execution** - Actually execute multi-step workflows
- ✅ **AI Integration** - OpenAI-powered content generation
- ✅ **Task Management** - Create, assign, and track tasks
- ✅ **Analytics Dashboard** - Real data from database
- ✅ **External Integrations** - Connect to Gmail, Slack, etc.

### API Endpoints That Work:
- `POST /api/workflows/execute` - Execute workflows
- `GET /api/workflows/executions` - Get execution history
- `POST /api/integrations/gmail/send` - Send emails
- `GET /api/tasks` - Get tasks from database
- `POST /api/tasks` - Create new tasks
- `GET /api/analytics/dashboard` - Real analytics data

### Workflow Types You Can Create:
1. **Email Automation** - Send personalized emails
2. **Data Processing** - Process and transform data
3. **API Integration** - Call external APIs
4. **Conditional Logic** - If/then workflow branches
5. **Notifications** - Send alerts via multiple channels

## 🔧 Testing the Functionality

### 1. Test Database Connection
```bash
curl http://localhost:3000/health
```
Should return: `{"status":"healthy","database":true}`

### 2. Test Workflow Execution
```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "id": "test-workflow",
      "name": "Test Email Workflow",
      "steps": [{
        "id": "send-email",
        "type": "email",
        "config": {
          "to": ["test@example.com"],
          "subject": "Test Email",
          "body": "This is a test email from your automation platform!"
        }
      }]
    },
    "context": {"userId": "test-user"}
  }'
```

### 3. Test Gmail Integration (after OAuth setup)
```bash
curl -X POST http://localhost:3000/api/integrations/gmail/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["recipient@example.com"],
    "subject": "Hello from Automation Platform",
    "body": "This email was sent via the automation platform!"
  }'
```

## 🚨 Troubleshooting

### "Database connection failed"
- Ensure MongoDB is running: `brew services start mongodb` (Mac)
- Check connection string in `.env`
- For Atlas: Whitelist your IP address

### "OpenAI API error"
- Verify API key is correct
- Check you have credits in your OpenAI account
- Ensure no extra spaces in the API key

### "Gmail API unauthorized"
- Complete OAuth2 setup in Google Console
- Add redirect URI: `http://localhost:3000/auth/google/callback`
- Enable Gmail API in Google Console

### "Port already in use"
- Kill existing processes: `lsof -ti:3000 | xargs kill -9`
- Or change ports in environment variables

## 📚 Additional Resources

- **API Requirements**: See `API_REQUIREMENTS.md` for detailed setup instructions
- **Development Guide**: See `docs/DEVELOPMENT.md` for development workflow
- **Deployment Guide**: See `docs/DEPLOYMENT.md` for production deployment

## 🎯 Quick Start (Minimum Setup)

If you want to test with minimal setup:

1. Install MongoDB locally
2. Get OpenAI API key
3. Run:
```bash
npm run make:functional
npm run install:platform
# Edit services/.env with MongoDB URI and OpenAI key
npm run setup:db
npm run dev
```

The platform will be functional with email automation, AI features, and workflow execution!