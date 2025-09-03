const { Pact } = require('@pact-foundation/pact');
const { like, eachLike, term } = require('@pact-foundation/pact').Matchers;
const axios = require('axios');
const path = require('path');

class ContractTester {
  constructor() {
    this.provider = new Pact({
      consumer: 'business-automation-client',
      provider: 'business-automation-api',
      port: 1234,
      log: path.resolve(process.cwd(), 'testing/contract/logs', 'pact.log'),
      dir: path.resolve(process.cwd(), 'testing/contract/pacts'),
      logLevel: 'INFO',
      spec: 2
    });
  }

  async setup() {
    await this.provider.setup();
  }

  async teardown() {
    await this.provider.finalize();
  }

  async testAuthenticationContract() {
    console.log('Testing authentication contract...');

    // Login contract
    await this.provider.addInteraction({
      state: 'user exists',
      uponReceiving: 'a login request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          email: 'user@test.com',
          password: 'TestUser123!'
        }
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          token: like('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
          user: {
            id: like('user-123'),
            email: 'user@test.com',
            name: like('Test User'),
            role: like('user')
          },
          expiresIn: like(3600)
        }
      }
    });

    // Test the interaction
    const response = await axios.post('http://localhost:1234/api/v1/auth/login', {
      email: 'user@test.com',
      password: 'TestUser123!'
    });

    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
    expect(response.data.user.email).toBe('user@test.com');
  }

  async testTaskManagementContract() {
    console.log('Testing task management contract...');

    // Create task contract
    await this.provider.addInteraction({
      state: 'user is authenticated',
      uponReceiving: 'a create task request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/tasks',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        },
        body: {
          title: like('Test Task'),
          description: like('Task description'),
          type: term({
            matcher: 'administrative|data-analysis|communication|project-management|finance|creative',
            generate: 'administrative'
          }),
          priority: term({
            matcher: 'low|medium|high|urgent',
            generate: 'medium'
          })
        }
      },
      willRespondWith: {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          id: like('task-123'),
          title: like('Test Task'),
          description: like('Task description'),
          type: 'administrative',
          priority: 'medium',
          status: 'pending',
          createdAt: term({
            matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z',
            generate: '2024-01-15T10:30:00.000Z'
          }),
          createdBy: like('user-123')
        }
      }
    });

    // Get tasks contract
    await this.provider.addInteraction({
      state: 'tasks exist',
      uponReceiving: 'a get tasks request',
      withRequest: {
        method: 'GET',
        path: '/api/v1/tasks',
        headers: {
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        },
        query: {
          page: like('1'),
          limit: like('10'),
          status: term({
            matcher: 'pending|processing|completed|failed',
            generate: 'pending'
          })
        }
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          tasks: eachLike({
            id: like('task-123'),
            title: like('Test Task'),
            description: like('Task description'),
            type: 'administrative',
            priority: 'medium',
            status: 'pending',
            createdAt: like('2024-01-15T10:30:00.000Z'),
            createdBy: like('user-123')
          }),
          pagination: {
            page: like(1),
            limit: like(10),
            total: like(25),
            totalPages: like(3)
          }
        }
      }
    });

    // Test create task
    const createResponse = await axios.post('http://localhost:1234/api/v1/tasks', {
      title: 'Test Task',
      description: 'Task description',
      type: 'administrative',
      priority: 'medium'
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.data.id).toBeDefined();

    // Test get tasks
    const getResponse = await axios.get('http://localhost:1234/api/v1/tasks?page=1&limit=10&status=pending', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(getResponse.status).toBe(200);
    expect(Array.isArray(getResponse.data.tasks)).toBe(true);
  }

  async testWorkflowContract() {
    console.log('Testing workflow contract...');

    // Execute workflow contract
    await this.provider.addInteraction({
      state: 'workflow template exists',
      uponReceiving: 'a workflow execution request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/workflows/execute',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        },
        body: {
          templateId: like('email-processing-workflow'),
          parameters: like({
            emailBatch: [
              { content: 'Test email', priority: 'normal' }
            ]
          })
        }
      },
      willRespondWith: {
        status: 202,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          workflowId: like('workflow-123'),
          status: 'started',
          estimatedDuration: like(300),
          steps: eachLike({
            id: like('step-1'),
            name: like('Email Classification'),
            status: 'pending',
            order: like(1)
          })
        }
      }
    });

    // Workflow status contract
    await this.provider.addInteraction({
      state: 'workflow is running',
      uponReceiving: 'a workflow status request',
      withRequest: {
        method: 'GET',
        path: term({
          matcher: '/api/v1/workflows/[^/]+/status',
          generate: '/api/v1/workflows/workflow-123/status'
        }),
        headers: {
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        }
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          workflowId: like('workflow-123'),
          status: term({
            matcher: 'started|processing|completed|failed|paused',
            generate: 'processing'
          }),
          progress: like(0.6),
          currentStep: like('Email Classification'),
          completedSteps: like(2),
          totalSteps: like(4),
          startedAt: like('2024-01-15T10:30:00.000Z'),
          estimatedCompletion: like('2024-01-15T10:35:00.000Z')
        }
      }
    });

    // Test workflow execution
    const executeResponse = await axios.post('http://localhost:1234/api/v1/workflows/execute', {
      templateId: 'email-processing-workflow',
      parameters: {
        emailBatch: [
          { content: 'Test email', priority: 'normal' }
        ]
      }
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(executeResponse.status).toBe(202);
    expect(executeResponse.data.workflowId).toBeDefined();

    // Test workflow status
    const statusResponse = await axios.get('http://localhost:1234/api/v1/workflows/workflow-123/status', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.data.status).toBeDefined();
  }

  async testDataAnalyticsContract() {
    console.log('Testing data analytics contract...');

    // Data processing contract
    await this.provider.addInteraction({
      state: 'dataset exists',
      uponReceiving: 'a data processing request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/data/process',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        },
        body: {
          datasetId: like('dataset-123'),
          operations: eachLike('clean', { min: 1 })
        }
      },
      willRespondWith: {
        status: 202,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          jobId: like('job-123'),
          status: 'started',
          operations: eachLike('clean'),
          estimatedDuration: like(180)
        }
      }
    });

    // Report generation contract
    await this.provider.addInteraction({
      state: 'data is available',
      uponReceiving: 'a report generation request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/reports/generate',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': term({
            matcher: 'Bearer .*',
            generate: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          })
        },
        body: {
          type: term({
            matcher: 'sales|performance|analytics|custom',
            generate: 'sales'
          }),
          dateRange: {
            start: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}',
              generate: '2024-01-01'
            }),
            end: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}',
              generate: '2024-01-31'
            })
          },
          format: term({
            matcher: 'pdf|excel|json|csv',
            generate: 'pdf'
          })
        }
      },
      willRespondWith: {
        status: 202,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          reportId: like('report-123'),
          status: 'generating',
          type: 'sales',
          estimatedCompletion: like('2024-01-15T10:35:00.000Z')
        }
      }
    });

    // Test data processing
    const processResponse = await axios.post('http://localhost:1234/api/v1/data/process', {
      datasetId: 'dataset-123',
      operations: ['clean']
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(processResponse.status).toBe(202);
    expect(processResponse.data.jobId).toBeDefined();

    // Test report generation
    const reportResponse = await axios.post('http://localhost:1234/api/v1/reports/generate', {
      type: 'sales',
      dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
      },
      format: 'pdf'
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    });

    expect(reportResponse.status).toBe(202);
    expect(reportResponse.data.reportId).toBeDefined();
  }

  async runAllContractTests() {
    console.log('Starting contract tests...');

    try {
      await this.setup();

      await this.testAuthenticationContract();
      await this.testTaskManagementContract();
      await this.testWorkflowContract();
      await this.testDataAnalyticsContract();

      console.log('✅ All contract tests passed');
    } catch (error) {
      console.error('❌ Contract tests failed:', error);
      throw error;
    } finally {
      await this.teardown();
    }
  }
}

module.exports = ContractTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new ContractTester();
  tester.runAllContractTests().catch(console.error);
}