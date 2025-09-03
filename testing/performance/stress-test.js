import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { authenticate, getAuthHeaders, BASE_URL, API_URL } from './k6-config.js';

// Stress test metrics
export const errorRate = new Rate('stress_errors');
export const responseTime = new Trend('stress_response_time');
export const throughput = new Counter('stress_throughput');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 300 },  // Ramp up to 300 users (stress point)
    { duration: '10m', target: 300 }, // Stay at 300 users
    { duration: '5m', target: 500 },  // Push to 500 users (breaking point)
    { duration: '5m', target: 500 },  // Stay at breaking point
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.05'], // Allow higher error rate for stress test
    stress_errors: ['rate<0.05'],
    stress_response_time: ['p(95)<5000'],
  },
};

export default function () {
  const token = authenticate(__VU % 5); // More user rotation for stress
  const headers = getAuthHeaders(token);

  // Intensive workflow operations
  stressWorkflowSystem(headers);
  
  // Heavy AI processing
  stressAISystem(headers);
  
  // Large data operations
  stressDataSystem(headers);
  
  // Concurrent operations
  stressConcurrentOperations(headers);

  sleep(0.5); // Shorter sleep for more aggressive testing
}

function stressWorkflowSystem(headers) {
  // Create multiple workflows rapidly
  for (let i = 0; i < 3; i++) {
    const workflowData = {
      name: `Stress Test Workflow ${__VU}-${__ITER}-${i}`,
      type: 'complex-processing',
      steps: [
        { type: 'data-ingestion', config: { source: 'multiple' } },
        { type: 'ai-processing', config: { model: 'heavy-model' } },
        { type: 'data-transformation', config: { operations: ['normalize', 'validate', 'enrich'] } },
        { type: 'output-generation', config: { formats: ['pdf', 'excel', 'json'] } }
      ]
    };

    const response = http.post(`${API_URL}/workflows`, JSON.stringify(workflowData), { headers });
    
    check(response, {
      'workflow created under stress': (r) => r.status === 201 || r.status === 429,
    }) || errorRate.add(1);
    
    responseTime.add(response.timings.duration);
    throughput.add(1);
  }
}

function stressAISystem(headers) {
  // Concurrent AI inference requests
  const requests = [];
  
  for (let i = 0; i < 5; i++) {
    const inferenceData = {
      model: 'heavy-processing-model',
      input: {
        text: `Large text document for processing ${i}`.repeat(100),
        options: {
          detailed_analysis: true,
          multiple_outputs: true
        }
      }
    };
    
    requests.push(['POST', `${API_URL}/ai/inference`, JSON.stringify(inferenceData), { headers }]);
  }
  
  const responses = http.batch(requests);
  
  responses.forEach((response, index) => {
    check(response, {
      [`AI inference ${index} handled`]: (r) => r.status === 200 || r.status === 503,
    }) || errorRate.add(1);
    
    responseTime.add(response.timings.duration);
    throughput.add(1);
  });
}

function stressDataSystem(headers) {
  // Large data upload
  const largeDataset = {
    type: 'json',
    data: JSON.stringify(generateLargeDataset(1000)), // 1000 records
    processing: {
      validate: true,
      transform: ['all_transformations'],
      analyze: true,
      generate_reports: true
    }
  };

  const uploadResponse = http.post(`${API_URL}/data/upload`, JSON.stringify(largeDataset), { 
    headers,
    timeout: '60s' // Longer timeout for large data
  });
  
  check(uploadResponse, {
    'large data upload handled': (r) => r.status === 200 || r.status === 413 || r.status === 503,
  }) || errorRate.add(1);
  
  responseTime.add(uploadResponse.timings.duration);
  throughput.add(1);
}

function stressConcurrentOperations(headers) {
  // Simulate concurrent user operations
  const operations = [
    ['GET', `${API_URL}/workflows`, null, { headers }],
    ['GET', `${API_URL}/ai/models`, null, { headers }],
    ['GET', `${API_URL}/data/processing`, null, { headers }],
    ['GET', `${API_URL}/dashboard/metrics`, null, { headers }],
    ['GET', `${API_URL}/notifications`, null, { headers }],
  ];
  
  const responses = http.batch(operations);
  
  responses.forEach((response, index) => {
    check(response, {
      [`Concurrent operation ${index} handled`]: (r) => r.status < 500,
    }) || errorRate.add(1);
    
    responseTime.add(response.timings.duration);
    throughput.add(1);
  });
}

function generateLargeDataset(size) {
  const dataset = [];
  for (let i = 0; i < size; i++) {
    dataset.push({
      id: i,
      name: `Record ${i}`,
      email: `user${i}@test.com`,
      department: ['IT', 'HR', 'Finance', 'Marketing'][i % 4],
      data: `Large text field with lots of content ${i}`.repeat(10),
      metadata: {
        created: new Date().toISOString(),
        tags: [`tag${i % 10}`, `category${i % 5}`],
        nested: {
          field1: `value${i}`,
          field2: i * 2,
          field3: i % 2 === 0
        }
      }
    });
  }
  return dataset;
}