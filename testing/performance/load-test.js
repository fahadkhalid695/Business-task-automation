import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { authenticate, getAuthHeaders, BASE_URL, API_URL } from './k6-config.js';

// Custom metrics
export const errorRate = new Rate('errors');
export const apiResponseTime = new Trend('api_response_time');
export const workflowExecutions = new Counter('workflow_executions');
export const aiInferences = new Counter('ai_inferences');

export const options = {
  stages: [
    { duration: '5m', target: 20 },   // Ramp up to 20 users
    { duration: '10m', target: 20 },  // Stay at 20 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 50 },  // Stay at 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    api_response_time: ['p(95)<2000'],
  },
};

export default function () {
  const token = authenticate(__VU % 3); // Rotate between test users
  const headers = getAuthHeaders(token);

  // Test workflow creation and execution
  testWorkflowOperations(headers);
  
  // Test AI/ML operations
  testAIOperations(headers);
  
  // Test data processing
  testDataProcessing(headers);
  
  // Test real-time features
  testRealtimeFeatures(headers);

  sleep(1);
}

function testWorkflowOperations(headers) {
  const workflowData = {
    name: `Load Test Workflow ${__VU}-${__ITER}`,
    type: 'email-processing',
    steps: [
      { type: 'email-trigger', config: { filter: 'subject:test' } },
      { type: 'ai-processing', config: { model: 'document-classifier' } },
      { type: 'data-extraction', config: { fields: ['sender', 'subject'] } }
    ]
  };

  // Create workflow
  const createResponse = http.post(`${API_URL}/workflows`, JSON.stringify(workflowData), { headers });
  
  check(createResponse, {
    'workflow created': (r) => r.status === 201,
    'workflow has id': (r) => r.json('id') !== undefined,
  }) || errorRate.add(1);

  if (createResponse.status === 201) {
    const workflowId = createResponse.json('id');
    
    // Execute workflow
    const executeResponse = http.post(`${API_URL}/workflows/${workflowId}/execute`, 
      JSON.stringify({ input: { subject: 'Test Email', sender: 'test@example.com' } }), 
      { headers }
    );
    
    check(executeResponse, {
      'workflow executed': (r) => r.status === 200,
      'execution has result': (r) => r.json('result') !== undefined,
    }) || errorRate.add(1);
    
    workflowExecutions.add(1);
    apiResponseTime.add(executeResponse.timings.duration);
  }
}

function testAIOperations(headers) {
  // Test AI model inference
  const inferenceData = {
    model: 'document-classifier',
    input: {
      text: 'This is a test document for classification',
      metadata: { source: 'load-test' }
    }
  };

  const inferenceResponse = http.post(`${API_URL}/ai/inference`, JSON.stringify(inferenceData), { headers });
  
  check(inferenceResponse, {
    'inference successful': (r) => r.status === 200,
    'inference has prediction': (r) => r.json('prediction') !== undefined,
    'inference has confidence': (r) => r.json('confidence') !== undefined,
  }) || errorRate.add(1);
  
  aiInferences.add(1);
  apiResponseTime.add(inferenceResponse.timings.duration);

  // Test model training status
  const modelsResponse = http.get(`${API_URL}/ai/models`, { headers });
  
  check(modelsResponse, {
    'models retrieved': (r) => r.status === 200,
    'models list not empty': (r) => r.json().length > 0,
  }) || errorRate.add(1);
}

function testDataProcessing(headers) {
  // Test data upload and processing
  const testData = {
    type: 'csv',
    data: 'name,email,department\nJohn Doe,john@test.com,IT\nJane Smith,jane@test.com,HR',
    processing: {
      validate: true,
      transform: ['normalize_emails', 'validate_departments']
    }
  };

  const uploadResponse = http.post(`${API_URL}/data/upload`, JSON.stringify(testData), { headers });
  
  check(uploadResponse, {
    'data uploaded': (r) => r.status === 200,
    'processing started': (r) => r.json('processingId') !== undefined,
  }) || errorRate.add(1);

  if (uploadResponse.status === 200) {
    const processingId = uploadResponse.json('processingId');
    
    // Check processing status
    const statusResponse = http.get(`${API_URL}/data/processing/${processingId}`, { headers });
    
    check(statusResponse, {
      'status retrieved': (r) => r.status === 200,
      'has status': (r) => r.json('status') !== undefined,
    }) || errorRate.add(1);
  }
}

function testRealtimeFeatures(headers) {
  // Test WebSocket connection simulation via HTTP
  const notificationsResponse = http.get(`${API_URL}/notifications`, { headers });
  
  check(notificationsResponse, {
    'notifications retrieved': (r) => r.status === 200,
  }) || errorRate.add(1);

  // Test real-time dashboard data
  const dashboardResponse = http.get(`${API_URL}/dashboard/realtime`, { headers });
  
  check(dashboardResponse, {
    'dashboard data retrieved': (r) => r.status === 200,
    'has metrics': (r) => r.json('metrics') !== undefined,
  }) || errorRate.add(1);
}