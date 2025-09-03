import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken;

export function setup() {
  // Login to get auth token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'testpassword',
  });
  
  return {
    authToken: loginResponse.json('token'),
  };
}

export default function (data) {
  authToken = data.authToken;
  
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // Test scenarios
  testDashboardLoad(params);
  testWorkflowOperations(params);
  testDataProcessing(params);
  testRealtimeUpdates(params);
  
  sleep(1);
}

function testDashboardLoad(params) {
  const response = http.get(`${BASE_URL}/api/dashboard`, params);
  
  check(response, {
    'dashboard loads successfully': (r) => r.status === 200,
    'dashboard response time OK': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);
}

function testWorkflowOperations(params) {
  // Create workflow
  const createPayload = JSON.stringify({
    name: `Load Test Workflow ${Math.random()}`,
    type: 'data-processing',
    steps: [
      { type: 'data-validation', config: {} },
      { type: 'data-transformation', config: {} },
    ],
  });
  
  const createResponse = http.post(`${BASE_URL}/api/workflows`, createPayload, params);
  
  check(createResponse, {
    'workflow created successfully': (r) => r.status === 201,
    'create workflow response time OK': (r) => r.timings.duration < 2000,
  });
  
  if (createResponse.status === 201) {
    const workflowId = createResponse.json('id');
    
    // Execute workflow
    const executeResponse = http.post(`${BASE_URL}/api/workflows/${workflowId}/execute`, '{}', params);
    
    check(executeResponse, {
      'workflow executed successfully': (r) => r.status === 200,
      'execute workflow response time OK': (r) => r.timings.duration < 3000,
    });
    
    // Get workflow status
    const statusResponse = http.get(`${BASE_URL}/api/workflows/${workflowId}/status`, params);
    
    check(statusResponse, {
      'workflow status retrieved': (r) => r.status === 200,
      'status response time OK': (r) => r.timings.duration < 500,
    });
  }
}

function testDataProcessing(params) {
  // Upload test data
  const uploadPayload = JSON.stringify({
    data: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Test Record ${i}`,
      value: Math.random() * 1000,
    })),
  });
  
  const uploadResponse = http.post(`${BASE_URL}/api/data/upload`, uploadPayload, params);
  
  check(uploadResponse, {
    'data uploaded successfully': (r) => r.status === 200,
    'upload response time OK': (r) => r.timings.duration < 5000,
  });
  
  if (uploadResponse.status === 200) {
    const datasetId = uploadResponse.json('datasetId');
    
    // Process data
    const processResponse = http.post(`${BASE_URL}/api/data/${datasetId}/process`, '{}', params);
    
    check(processResponse, {
      'data processing started': (r) => r.status === 202,
      'process response time OK': (r) => r.timings.duration < 1000,
    });
  }
}

function testRealtimeUpdates(params) {
  // Test WebSocket connection simulation via HTTP polling
  const updatesResponse = http.get(`${BASE_URL}/api/updates/poll`, params);
  
  check(updatesResponse, {
    'updates retrieved successfully': (r) => r.status === 200,
    'updates response time OK': (r) => r.timings.duration < 300,
  });
}

export function teardown(data) {
  // Cleanup test data if needed
  console.log('Load test completed');
}