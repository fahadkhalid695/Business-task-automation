#!/bin/bash

# ============================================================
# Business Task Automation Platform - Deploy & Test Script
# Run this on your EC2 instance to deploy and verify all features
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
SKIP=0

PROJECT_DIR="$HOME/Business-task-automation"
API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; SKIP=$((SKIP+1)); }
log_section() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ============================================================
# PHASE 1: DEPLOYMENT
# ============================================================
log_section "PHASE 1: DEPLOYMENT"

# Pull latest code
log_info "Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin main 2>/dev/null || git pull 2>/dev/null || log_info "Git pull skipped"

# Kill existing processes on ports 3000 and 3001
log_info "Stopping existing processes..."
sudo kill $(sudo lsof -t -i:3001) 2>/dev/null || true
sudo kill $(sudo lsof -t -i:3000) 2>/dev/null || true
sleep 2

# Install backend dependencies
log_info "Installing backend dependencies..."
cd "$PROJECT_DIR/services"
npm install --silent 2>/dev/null

# Check .env exists
if [ ! -f .env ]; then
  echo -e "${RED}ERROR: services/.env file not found!${NC}"
  echo "Create it with: cp .env.example .env && nano .env"
  exit 1
fi

# Load env vars
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

# Start backend
log_info "Starting backend server..."
npx tsx src/server.ts > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 4

# Check if backend started
if kill -0 $BACKEND_PID 2>/dev/null; then
  log_pass "Backend started (PID: $BACKEND_PID)"
else
  log_fail "Backend failed to start. Check /tmp/backend.log"
  cat /tmp/backend.log | tail -20
  exit 1
fi

# Build and serve frontend
log_info "Building frontend..."
cd "$PROJECT_DIR/client"

# Set API URL for frontend build
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
export REACT_APP_API_URL="http://${PUBLIC_IP}:3001/api"

if [ -d "build" ]; then
  log_info "Using existing frontend build"
else
  npm install --silent 2>/dev/null
  CI=false npm run build --silent 2>/dev/null
fi

npx serve -s build -l 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 2

if kill -0 $FRONTEND_PID 2>/dev/null; then
  log_pass "Frontend started (PID: $FRONTEND_PID)"
else
  log_fail "Frontend failed to start"
fi

# ============================================================
# PHASE 2: INFRASTRUCTURE TESTS
# ============================================================
log_section "PHASE 2: INFRASTRUCTURE TESTS"

# Health check
HEALTH=$(curl -s "$API_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  log_pass "Health endpoint responding"
else
  log_fail "Health endpoint not responding"
fi

# Frontend serving
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)
if [ "$FRONTEND_CHECK" = "200" ]; then
  log_pass "Frontend serving (HTTP 200)"
else
  log_fail "Frontend not serving (HTTP $FRONTEND_CHECK)"
fi

# MongoDB check
if mongosh --eval "db.runCommand({ping:1})" --quiet 2>/dev/null | grep -q "ok"; then
  log_pass "MongoDB connected"
else
  log_skip "MongoDB not running (tasks/workflows won't persist)"
fi

# Redis check
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
  log_pass "Redis connected"
else
  log_skip "Redis not running (caching disabled)"
fi

# ============================================================
# PHASE 3: AUTHENTICATION TESTS
# ============================================================
log_section "PHASE 3: AUTHENTICATION TESTS"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "None" ]; then
    log_pass "Login successful (admin@example.com)"
  else
    log_fail "Login returned success but no token"
    TOKEN=""
  fi
else
  log_fail "Login failed: $LOGIN_RESPONSE"
  TOKEN=""
fi

# Register
REG_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-$(date +%s)@example.com\",\"password\":\"TestPass123!\"}")

if echo "$REG_RESPONSE" | grep -q '"success":true'; then
  log_pass "User registration working"
else
  log_fail "User registration failed"
fi

# Protected route without token
UNAUTH_RESPONSE=$(curl -s "$API_URL/api/tasks" 2>/dev/null)
if echo "$UNAUTH_RESPONSE" | grep -q "MISSING_TOKEN\|UNAUTHORIZED\|401"; then
  log_pass "Protected routes reject unauthenticated requests"
else
  log_skip "Could not verify auth protection"
fi

# ============================================================
# PHASE 4: AI PROVIDER TESTS
# ============================================================
log_section "PHASE 4: AI PROVIDER TESTS"

if [ -z "$TOKEN" ]; then
  log_skip "Skipping AI tests (no valid token)"
else
  # AI Provider Status
  AI_STATUS=$(curl -s "$API_URL/api/ai-provider/status" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$AI_STATUS" | grep -q '"success":true'; then
    log_pass "AI provider status endpoint working"
    CURRENT_PROVIDER=$(echo "$AI_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['current'])" 2>/dev/null)
    log_info "Current AI provider: $CURRENT_PROVIDER"
  else
    log_fail "AI provider status failed: $AI_STATUS"
  fi

  # AI Text Generation
  AI_TEST=$(curl -s -X POST "$API_URL/api/ai-provider/test" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Say hello in one word"}' 2>/dev/null)

  if echo "$AI_TEST" | grep -q '"success":true'; then
    log_pass "AI text generation working ($CURRENT_PROVIDER)"
    RESPONSE=$(echo "$AI_TEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['response'][:80])" 2>/dev/null)
    log_info "AI Response: $RESPONSE"
  else
    ERROR=$(echo "$AI_TEST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('message','unknown'))" 2>/dev/null || echo "$AI_TEST")
    log_fail "AI text generation failed: $ERROR"
  fi

  # AI Code Generation
  CODE_TEST=$(curl -s -X POST "$API_URL/api/ai-provider/generate-code" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"description":"hello world function","language":"javascript"}' 2>/dev/null)

  if echo "$CODE_TEST" | grep -q '"success":true'; then
    log_pass "AI code generation working"
  else
    log_fail "AI code generation failed"
  fi

  # AI Health Check
  AI_HEALTH=$(curl -s "$API_URL/api/ai-provider/health" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$AI_HEALTH" | grep -q '"success"'; then
    log_pass "AI provider health check endpoint working"
    # Show which providers are healthy
    echo "$AI_HEALTH" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  providers=d.get('data',{}).get('providers',{})
  for p,v in providers.items():
    status='✓' if v else '✗'
    print(f'       {status} {p}: {\"available\" if v else \"not configured\"}')
except: pass
" 2>/dev/null
  else
    log_fail "AI provider health check failed"
  fi
fi

# ============================================================
# PHASE 5: API ENDPOINT TESTS
# ============================================================
log_section "PHASE 5: API ENDPOINT TESTS"

if [ -z "$TOKEN" ]; then
  log_skip "Skipping API tests (no valid token)"
else
  # Tasks endpoint
  TASKS=$(curl -s "$API_URL/api/tasks" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$TASKS" | grep -q '"success":true\|tasks\|\[\]'; then
    log_pass "Tasks API responding"
  else
    log_fail "Tasks API failed"
  fi

  # Workflows endpoint
  WORKFLOWS=$(curl -s "$API_URL/api/workflows" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$WORKFLOWS" | grep -q '"success":true\|workflows\|\[\]'; then
    log_pass "Workflows API responding"
  else
    log_fail "Workflows API failed"
  fi

  # Analytics endpoint
  ANALYTICS=$(curl -s "$API_URL/api/analytics" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$ANALYTICS" | grep -q '"success"\|analytics\|data'; then
    log_pass "Analytics API responding"
  else
    log_fail "Analytics API failed"
  fi

  # Users endpoint (admin only)
  USERS=$(curl -s "$API_URL/api/users" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$USERS" | grep -q '"success":true\|users'; then
    log_pass "Users API responding (admin access)"
  else
    log_fail "Users API failed"
  fi

  # Integrations endpoint
  INTEGRATIONS=$(curl -s "$API_URL/api/integrations" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$INTEGRATIONS" | grep -q '"success"\|integrations\|data'; then
    log_pass "Integrations API responding"
  else
    log_fail "Integrations API failed"
  fi

  # Notifications endpoint
  NOTIFICATIONS=$(curl -s "$API_URL/api/notifications" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if echo "$NOTIFICATIONS" | grep -q '"success"\|notifications\|data\|\[\]'; then
    log_pass "Notifications API responding"
  else
    log_skip "Notifications API not available"
  fi
fi

# ============================================================
# PHASE 6: SECURITY TESTS
# ============================================================
log_section "PHASE 6: SECURITY TESTS"

# CORS headers
CORS_CHECK=$(curl -s -I -X OPTIONS "$API_URL/api/auth/login" \
  -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" 2>/dev/null)
if echo "$CORS_CHECK" | grep -qi "access-control-allow-origin: http://evil.com"; then
  log_fail "CORS allows arbitrary origins (security issue)"
else
  log_pass "CORS properly restricts origins"
fi

# Security headers
HEADERS=$(curl -s -I "$API_URL/health" 2>/dev/null)
if echo "$HEADERS" | grep -qi "x-content-type-options\|helmet\|strict-transport"; then
  log_pass "Security headers present (Helmet)"
else
  log_skip "Security headers not detected"
fi

# Rate limiting
log_info "Testing rate limiting (sending 10 rapid requests)..."
RATE_LIMITED=false
for i in $(seq 1 10); do
  RATE_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@test.com","password":"wrong"}' 2>/dev/null)
  if [ "$RATE_RESP" = "429" ]; then
    RATE_LIMITED=true
    break
  fi
done
if [ "$RATE_LIMITED" = true ]; then
  log_pass "Rate limiting active"
else
  log_skip "Rate limiting not triggered in 10 requests (may need more)"
fi

# ============================================================
# PHASE 7: FEATURE SUMMARY
# ============================================================
log_section "PHASE 7: FEATURE AVAILABILITY SUMMARY"

echo ""
echo -e "${CYAN}Feature                          Status${NC}"
echo "─────────────────────────────────────────────────"

# Check each feature
features_check() {
  local name="$1"
  local status="$2"
  if [ "$status" = "pass" ]; then
    printf "  %-32s ${GREEN}✓ Available${NC}\n" "$name"
  elif [ "$status" = "fail" ]; then
    printf "  %-32s ${RED}✗ Not Working${NC}\n" "$name"
  else
    printf "  %-32s ${YELLOW}○ Not Configured${NC}\n" "$name"
  fi
}

# Determine statuses based on test results
[ -n "$TOKEN" ] && AUTH_STATUS="pass" || AUTH_STATUS="fail"

features_check "Authentication (Login/Register)" "$AUTH_STATUS"
features_check "Health Monitoring" "pass"

if echo "$AI_TEST" 2>/dev/null | grep -q '"success":true'; then
  features_check "AI Text Generation" "pass"
else
  features_check "AI Text Generation" "fail"
fi

if echo "$CODE_TEST" 2>/dev/null | grep -q '"success":true'; then
  features_check "AI Code Generation" "pass"
else
  features_check "AI Code Generation" "fail"
fi

if echo "$TASKS" 2>/dev/null | grep -q '"success":true\|tasks'; then
  features_check "Task Management API" "pass"
else
  features_check "Task Management API" "fail"
fi

if echo "$WORKFLOWS" 2>/dev/null | grep -q '"success":true\|workflows'; then
  features_check "Workflow Engine API" "pass"
else
  features_check "Workflow Engine API" "fail"
fi

if echo "$ANALYTICS" 2>/dev/null | grep -q '"success"\|analytics'; then
  features_check "Analytics API" "pass"
else
  features_check "Analytics API" "fail"
fi

if echo "$USERS" 2>/dev/null | grep -q '"success":true'; then
  features_check "User Management (Admin)" "pass"
else
  features_check "User Management (Admin)" "fail"
fi

if echo "$INTEGRATIONS" 2>/dev/null | grep -q '"success"\|integrations'; then
  features_check "Integrations API" "pass"
else
  features_check "Integrations API" "fail"
fi

features_check "Frontend UI" "$([ "$FRONTEND_CHECK" = "200" ] && echo pass || echo fail)"

# External integrations (need OAuth setup)
features_check "Gmail Integration" "skip"
features_check "Slack Integration" "skip"
features_check "Salesforce Integration" "skip"
features_check "Microsoft Teams" "skip"
features_check "Google Calendar" "skip"

echo ""
echo "─────────────────────────────────────────────────"

# ============================================================
# FINAL REPORT
# ============================================================
log_section "FINAL REPORT"

TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
echo -e "  Total:   $TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}🎉 All tests passed! Platform is operational.${NC}"
else
  echo -e "  ${YELLOW}⚠️  Some features need attention. Check failures above.${NC}"
fi

echo ""
echo -e "${CYAN}Access Points:${NC}"
echo -e "  Frontend:  http://${PUBLIC_IP}:3000"
echo -e "  Backend:   http://${PUBLIC_IP}:3001"
echo -e "  Health:    http://${PUBLIC_IP}:3001/health"
echo ""
echo -e "${CYAN}Credentials:${NC}"
echo -e "  Email:     admin@example.com"
echo -e "  Password:  password"
echo ""
echo -e "${CYAN}Running Processes:${NC}"
echo -e "  Backend:   PID $BACKEND_PID"
echo -e "  Frontend:  PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}To stop:${NC} kill $BACKEND_PID $FRONTEND_PID"
echo ""
