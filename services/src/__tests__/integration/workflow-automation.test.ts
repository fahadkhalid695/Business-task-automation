import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WorkflowTemplateService } from '../../task-orchestrator/WorkflowTemplateService';
import { WorkflowEngine } from '../../task-orchestrator/WorkflowEngine';
import { WorkflowTriggerService } from '../../task-orchestrator/WorkflowTriggerService';
import { WorkflowAnalyticsService } from '../../task-orchestrator/WorkflowAnalyticsService';
import { WorkflowTestingService } from '../../task-orchestrator/WorkflowTestingService';
import { StepType, TriggerType, TaskStatus } from '../../shared/types';
import { TaskModel } from '../../shared/models/Task';
import { connectDatabase, disconnectDatabase } from '../setup';

describe('Workflow Automation Integration Tests', () => {
  let templateService: WorkflowTemplateService;
  let workflowEngine: WorkflowEngine;
  let triggerService: WorkflowTriggerService;
  let analyticsService: WorkflowAnalyticsService;
  let testingService: WorkflowTestingService;

  beforeEach(async () => {
    await connectDatabase();
    
    templateService = new WorkflowTemplateService();
    workflowEngine = new WorkflowEngine();
    triggerService = new WorkflowTriggerService(workflowEngine);
    analyticsService = new WorkflowAnalyticsService();
    testingService = new WorkflowTestingService(workflowEngine, templateService);
  });

  afterEach(async () => {
    await disconnectDatabase();
  });

  describe('Workflow Template Management', () => {
    it('should create a complete workflow template with validation', async () => {
      const templateRequest = {
        name: 'Email Processing Workflow',
        description: 'Automated email processing and response generation',
        category: 'communication',
        steps: [
          {
            id: 'step_1',
            name: 'Extract Email Content',
            type: StepType.DATA_TRANSFORMATION,
            configuration: {
              operation: 'extract_email_data',
              input: 'email_raw',
              parameters: { includeAttachments: true }
            },
            dependencies: [],
            order: 1
          },
          {
            id: 'step_2',
            name: 'Analyze Sentiment',
            type: StepType.AI_PROCESSING,
            configuration: {
              model: 'sentiment-analyzer',
              prompt: 'Analyze the sentiment of this email: {{email_content}}',
              parameters: { confidence_threshold: 0.8 }
            },
            dependencies: ['step_1'],
            order: 2
          },
          {
            id: 'step_3',
            name: 'Route Based on Priority',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.step_2_result.sentiment === "urgent"',
              trueAction: 'escalate_to_human',
              falseAction: 'generate_auto_response'
            },
            dependencies: ['step_2'],
            order: 3
          },
          {
            id: 'step_4',
            name: 'Send Response',
            type: StepType.NOTIFICATION,
            configuration: {
              type: 'email',
              recipients: ['{{email_sender}}'],
              message: '{{generated_response}}',
              template: 'email_response'
            },
            dependencies: ['step_3'],
            order: 4
          }
        ],
        triggers: [
          {
            type: TriggerType.EMAIL_RECEIVED,
            configuration: {
              fromPattern: '.*@company\\.com',
              subjectPattern: 'Support Request:.*'
            }
          }
        ],
        createdBy: 'test_user'
      };

      const template = await templateService.createTemplate(templateRequest);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe(templateRequest.name);
      expect(template.steps).toHaveLength(4);
      expect(template.triggers).toHaveLength(1);
      expect(template.isActive).toBe(true);
      expect(template.version).toBe(1);

      // Validate the template
      const validation = await templateService.validateWorkflowTemplate(template);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.complexity).toBe('moderate');
    });

    it('should handle workflow template versioning', async () => {
      // Create initial template
      const initialTemplate = await templateService.createTemplate({
        name: 'Data Processing Workflow',
        description: 'Process and analyze data',
        category: 'data_analytics',
        steps: [
          {
            id: 'step_1',
            name: 'Load Data',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'load_csv', input: 'file_path' },
            dependencies: [],
            order: 1
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      // Create new version with additional step
      const updatedTemplate = await templateService.updateTemplate(
        initialTemplate.id,
        {
          steps: [
            ...initialTemplate.steps,
            {
              id: 'step_2',
              name: 'Clean Data',
              type: StepType.DATA_TRANSFORMATION,
              configuration: { operation: 'clean_data', input: 'raw_data' },
              dependencies: ['step_1'],
              order: 2
            }
          ]
        },
        true // Create new version
      );

      expect(updatedTemplate.id).not.toBe(initialTemplate.id);
      expect(updatedTemplate.version).toBe(2);
      expect(updatedTemplate.steps).toHaveLength(2);

      // Original template should still exist
      const originalTemplate = await templateService.getTemplate(initialTemplate.id);
      expect(originalTemplate.version).toBe(1);
      expect(originalTemplate.steps).toHaveLength(1);
    });

    it('should detect circular dependencies in workflow steps', async () => {
      const templateWithCircularDeps = {
        name: 'Circular Dependency Test',
        description: 'Test circular dependency detection',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Step 1',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform' },
            dependencies: ['step_3'], // Circular dependency
            order: 1
          },
          {
            id: 'step_2',
            name: 'Step 2',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform' },
            dependencies: ['step_1'],
            order: 2
          },
          {
            id: 'step_3',
            name: 'Step 3',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform' },
            dependencies: ['step_2'],
            order: 3
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      };

      await expect(templateService.createTemplate(templateWithCircularDeps))
        .rejects
        .toThrow('Circular dependencies detected');
    });
  });

  describe('Workflow Execution Engine', () => {
    it('should execute a complete workflow with conditional branching', async () => {
      // Create a workflow template
      const template = await templateService.createTemplate({
        name: 'Conditional Workflow Test',
        description: 'Test conditional workflow execution',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Check Input Value',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.task.data.input.value > 50',
              trueAction: 'high_value_processing',
              falseAction: 'low_value_processing'
            },
            dependencies: [],
            order: 1
          },
          {
            id: 'step_2',
            name: 'Process Result',
            type: StepType.DATA_TRANSFORMATION,
            configuration: {
              operation: 'format_output',
              input: 'step_1_result'
            },
            dependencies: ['step_1'],
            order: 2
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      // Create a test task
      const task = await TaskModel.create({
        type: 'test_workflow',
        status: TaskStatus.PENDING,
        priority: 'medium',
        assignedTo: 'test_user',
        createdBy: 'test_user',
        title: 'Test Conditional Workflow',
        description: 'Testing conditional workflow execution',
        data: {
          input: { value: 75 }, // Should trigger true branch
          context: {
            userId: 'test_user',
            workflowTemplateId: template.id
          }
        },
        workflow: template.steps
      });

      // Execute the workflow
      const executionId = await workflowEngine.executeWorkflow(
        template.id,
        task.id,
        { testMode: true }
      );

      expect(executionId).toBeDefined();

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const execution = workflowEngine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe('completed');
      expect(execution!.context.step_step_1_result).toBeDefined();
      expect(execution!.context.step_step_1_result.branch).toBe('true');
    });

    it('should handle workflow execution failures and retries', async () => {
      const template = await templateService.createTemplate({
        name: 'Failure Test Workflow',
        description: 'Test workflow failure handling',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Failing Step',
            type: StepType.EXTERNAL_API_CALL,
            configuration: {
              url: 'http://nonexistent-api.com/endpoint',
              method: 'GET'
            },
            dependencies: [],
            timeout: 5000,
            retryCount: 2,
            order: 1
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      const task = await TaskModel.create({
        type: 'test_workflow',
        status: TaskStatus.PENDING,
        priority: 'medium',
        assignedTo: 'test_user',
        createdBy: 'test_user',
        title: 'Test Failure Handling',
        description: 'Testing workflow failure handling',
        data: {
          input: {},
          context: {
            userId: 'test_user',
            workflowTemplateId: template.id
          }
        },
        workflow: template.steps
      });

      const executionId = await workflowEngine.executeWorkflow(
        template.id,
        task.id,
        { testMode: true }
      );

      // Wait for execution to fail
      await new Promise(resolve => setTimeout(resolve, 2000));

      const execution = workflowEngine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe('failed');
      expect(execution!.error).toBeDefined();
    });

    it('should support workflow pause and resume functionality', async () => {
      const template = await templateService.createTemplate({
        name: 'Pausable Workflow',
        description: 'Test workflow pause/resume',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'First Step',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform', input: 'data' },
            dependencies: [],
            order: 1
          },
          {
            id: 'step_2',
            name: 'Second Step',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform', input: 'data' },
            dependencies: ['step_1'],
            order: 2
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      const task = await TaskModel.create({
        type: 'test_workflow',
        status: TaskStatus.PENDING,
        priority: 'medium',
        assignedTo: 'test_user',
        createdBy: 'test_user',
        title: 'Test Pause/Resume',
        description: 'Testing workflow pause and resume',
        data: {
          input: {},
          context: {
            userId: 'test_user',
            workflowTemplateId: template.id
          }
        },
        workflow: template.steps
      });

      const executionId = await workflowEngine.executeWorkflow(
        template.id,
        task.id,
        { testMode: true }
      );

      // Pause the workflow
      await workflowEngine.pauseWorkflow(executionId);
      
      let execution = workflowEngine.getExecution(executionId);
      expect(execution!.status).toBe('paused');

      // Resume the workflow
      await workflowEngine.resumeWorkflow(executionId);
      
      execution = workflowEngine.getExecution(executionId);
      expect(execution!.status).toBe('running');
    });
  });

  describe('Workflow Trigger System', () => {
    it('should process email trigger events', async () => {
      const template = await templateService.createTemplate({
        name: 'Email Triggered Workflow',
        description: 'Workflow triggered by email events',
        category: 'communication',
        steps: [
          {
            id: 'step_1',
            name: 'Process Email',
            type: StepType.AI_PROCESSING,
            configuration: {
              model: 'email-processor',
              prompt: 'Process this email: {{email_content}}'
            },
            dependencies: [],
            order: 1
          }
        ],
        triggers: [
          {
            type: TriggerType.EMAIL_RECEIVED,
            configuration: {
              fromPattern: '.*@test\\.com',
              subjectPattern: 'Urgent:.*'
            }
          }
        ],
        createdBy: 'test_user'
      });

      // Simulate email trigger event
      const emailEvent = {
        type: TriggerType.EMAIL_RECEIVED,
        data: {
          from: 'user@test.com',
          subject: 'Urgent: System Alert',
          body: 'There is an urgent system issue that needs attention.',
          recipientUserId: 'test_user'
        },
        timestamp: new Date(),
        source: 'email_service',
        userId: 'test_user'
      };

      const executionIds = await triggerService.processTriggerEvent(emailEvent);

      expect(executionIds).toHaveLength(1);
      expect(executionIds[0]).toBeDefined();

      // Wait for execution to start
      await new Promise(resolve => setTimeout(resolve, 500));

      const execution = workflowEngine.getExecution(executionIds[0]);
      expect(execution).toBeDefined();
      expect(execution!.context.triggerEvent).toEqual(emailEvent);
    });

    it('should handle webhook trigger registration and execution', async () => {
      const template = await templateService.createTemplate({
        name: 'Webhook Triggered Workflow',
        description: 'Workflow triggered by webhook',
        category: 'integration',
        steps: [
          {
            id: 'step_1',
            name: 'Process Webhook Data',
            type: StepType.DATA_TRANSFORMATION,
            configuration: {
              operation: 'process_webhook',
              input: 'webhook_data'
            },
            dependencies: [],
            order: 1
          }
        ],
        triggers: [
          {
            type: TriggerType.WEBHOOK,
            configuration: {
              endpoint: '/webhook/test-endpoint',
              method: 'POST'
            }
          }
        ],
        createdBy: 'test_user'
      });

      // Register the webhook trigger
      await triggerService.registerTrigger(template.id, template.triggers[0]);

      // Simulate webhook request
      const webhookData = {
        event: 'user_created',
        data: { userId: '12345', email: 'newuser@test.com' }
      };

      const executionIds = await triggerService.handleWebhookRequest(
        '/webhook/test-endpoint',
        webhookData,
        { 'content-type': 'application/json' }
      );

      expect(executionIds).toHaveLength(1);

      const execution = workflowEngine.getExecution(executionIds[0]);
      expect(execution).toBeDefined();
      expect(execution!.context.triggerEvent.data.body).toEqual(webhookData);
    });
  });

  describe('Workflow Analytics and Performance', () => {
    it('should track workflow performance metrics', async () => {
      const template = await templateService.createTemplate({
        name: 'Analytics Test Workflow',
        description: 'Workflow for testing analytics',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Simple Step',
            type: StepType.DATA_TRANSFORMATION,
            configuration: { operation: 'transform' },
            dependencies: [],
            order: 1
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      // Execute workflow multiple times to generate metrics
      const executions = [];
      for (let i = 0; i < 3; i++) {
        const task = await TaskModel.create({
          type: 'test_workflow',
          status: TaskStatus.PENDING,
          priority: 'medium',
          assignedTo: 'test_user',
          createdBy: 'test_user',
          title: `Test Execution ${i + 1}`,
          description: 'Testing analytics',
          data: {
            input: { iteration: i },
            context: {
              userId: 'test_user',
              workflowTemplateId: template.id
            }
          },
          workflow: template.steps
        });

        const executionId = await workflowEngine.executeWorkflow(
          template.id,
          task.id,
          { testMode: true }
        );
        executions.push(executionId);
      }

      // Wait for executions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Record executions in analytics service
      for (const executionId of executions) {
        const execution = workflowEngine.getExecution(executionId);
        if (execution) {
          await analyticsService.recordExecution(execution);
        }
      }

      // Get performance metrics
      const metrics = await analyticsService.getPerformanceMetrics(template.id);

      expect(metrics.templateId).toBe(template.id);
      expect(metrics.templateName).toBe(template.name);
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should generate optimization recommendations', async () => {
      const template = await templateService.createTemplate({
        name: 'Complex Workflow',
        description: 'Complex workflow for optimization testing',
        category: 'test',
        steps: Array.from({ length: 20 }, (_, i) => ({
          id: `step_${i + 1}`,
          name: `Step ${i + 1}`,
          type: StepType.DATA_TRANSFORMATION,
          configuration: { operation: 'transform' },
          dependencies: i > 0 ? [`step_${i}`] : [],
          order: i + 1
        })),
        triggers: [],
        createdBy: 'test_user'
      });

      const recommendations = await analyticsService.generateOptimizationRecommendations(template.id);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Should recommend complexity reduction for 20+ steps
      const complexityRecommendation = recommendations.find(r => r.type === 'usability' && r.title.includes('Complexity'));
      expect(complexityRecommendation).toBeDefined();
    });
  });

  describe('Workflow Testing Framework', () => {
    it('should create and execute test suites', async () => {
      const template = await templateService.createTemplate({
        name: 'Testable Workflow',
        description: 'Workflow designed for testing',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Input Validation',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.task.data.input.value !== undefined',
              trueAction: 'continue',
              falseAction: 'error'
            },
            dependencies: [],
            order: 1
          },
          {
            id: 'step_2',
            name: 'Process Data',
            type: StepType.DATA_TRANSFORMATION,
            configuration: {
              operation: 'multiply',
              input: 'value',
              parameters: { factor: 2 }
            },
            dependencies: ['step_1'],
            order: 2
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      // Create test suite
      const testSuite = await testingService.createTestSuite({
        name: 'Basic Functionality Tests',
        description: 'Test basic workflow functionality',
        templateId: template.id,
        testCases: [
          {
            id: 'test_1',
            name: 'Valid Input Test',
            description: 'Test with valid input data',
            templateId: template.id,
            inputData: { value: 10 },
            expectedOutput: { result: 20 },
            tags: ['happy-path'],
            createdBy: 'test_user',
            createdAt: new Date()
          },
          {
            id: 'test_2',
            name: 'Invalid Input Test',
            description: 'Test with invalid input data',
            templateId: template.id,
            inputData: {},
            shouldFail: true,
            tags: ['error-handling'],
            createdBy: 'test_user',
            createdAt: new Date()
          }
        ],
        configuration: {
          timeout: 30000,
          retryCount: 1,
          parallelExecution: false,
          cleanupAfterTest: true
        },
        createdBy: 'test_user'
      });

      expect(testSuite).toBeDefined();
      expect(testSuite.id).toBeDefined();
      expect(testSuite.testCases).toHaveLength(2);

      // Run test suite
      const testResult = await testingService.runTestSuite(testSuite.id);

      expect(testResult).toBeDefined();
      expect(testResult.totalTests).toBe(2);
      expect(testResult.testResults).toHaveLength(2);
      expect(testResult.coverage.totalSteps).toBe(2);
    });

    it('should validate workflow testability', async () => {
      const template = await templateService.createTemplate({
        name: 'Workflow with External Dependencies',
        description: 'Workflow with external API calls',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'External API Call',
            type: StepType.EXTERNAL_API_CALL,
            configuration: {
              url: 'https://api.external.com/data',
              method: 'GET'
            },
            dependencies: [],
            timeout: 120000, // Long timeout
            order: 1
          },
          {
            id: 'step_2',
            name: 'User Approval',
            type: StepType.USER_APPROVAL,
            configuration: {
              approvers: ['manager@company.com'],
              message: 'Please approve this action'
            },
            dependencies: ['step_1'],
            order: 2
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      const validation = await testingService.validateWorkflowForTesting(template.id);

      expect(validation.isTestable).toBe(true);
      expect(validation.recommendations).toContain(
        expect.stringContaining('external API calls')
      );
      expect(validation.recommendations).toContain(
        expect.stringContaining('user approval steps')
      );
      expect(validation.recommendations).toContain(
        expect.stringContaining('long timeouts')
      );
    });

    it('should auto-generate test cases', async () => {
      const template = await templateService.createTemplate({
        name: 'Auto-Test Workflow',
        description: 'Workflow for auto-generated tests',
        category: 'test',
        steps: [
          {
            id: 'step_1',
            name: 'Conditional Processing',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.task.data.input.priority === "high"',
              trueAction: 'escalate',
              falseAction: 'normal_processing'
            },
            dependencies: [],
            order: 1
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      const generatedTests = await testingService.generateTestCases(template.id);

      expect(generatedTests).toBeDefined();
      expect(generatedTests.length).toBeGreaterThan(0);
      
      // Should include happy path test
      const happyPathTest = generatedTests.find(t => t.tags.includes('happy-path'));
      expect(happyPathTest).toBeDefined();
      
      // Should include error handling test
      const errorTest = generatedTests.find(t => t.tags.includes('error-handling'));
      expect(errorTest).toBeDefined();
      
      // Should include conditional test
      const conditionalTest = generatedTests.find(t => t.tags.includes('conditional'));
      expect(conditionalTest).toBeDefined();
    });
  });

  describe('End-to-End Workflow Scenarios', () => {
    it('should execute a complete business workflow scenario', async () => {
      // Create a realistic business workflow: Invoice Processing
      const invoiceProcessingWorkflow = await templateService.createTemplate({
        name: 'Invoice Processing Workflow',
        description: 'Automated invoice processing and approval',
        category: 'finance',
        steps: [
          {
            id: 'extract_data',
            name: 'Extract Invoice Data',
            type: StepType.AI_PROCESSING,
            configuration: {
              model: 'invoice-extractor',
              prompt: 'Extract key data from this invoice: {{invoice_content}}'
            },
            dependencies: [],
            order: 1
          },
          {
            id: 'validate_data',
            name: 'Validate Invoice Data',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.extract_data_result.amount > 0 && context.extract_data_result.vendor',
              trueAction: 'proceed_to_approval',
              falseAction: 'flag_for_manual_review'
            },
            dependencies: ['extract_data'],
            order: 2
          },
          {
            id: 'check_approval_threshold',
            name: 'Check Approval Threshold',
            type: StepType.CONDITIONAL,
            configuration: {
              condition: 'context.extract_data_result.amount > 1000',
              trueAction: 'require_manager_approval',
              falseAction: 'auto_approve'
            },
            dependencies: ['validate_data'],
            order: 3
          },
          {
            id: 'send_notification',
            name: 'Send Approval Notification',
            type: StepType.NOTIFICATION,
            configuration: {
              type: 'email',
              recipients: ['finance@company.com'],
              message: 'Invoice {{invoice_number}} has been processed and {{approval_status}}'
            },
            dependencies: ['check_approval_threshold'],
            order: 4
          }
        ],
        triggers: [
          {
            type: TriggerType.EMAIL_RECEIVED,
            configuration: {
              fromPattern: '.*@vendor\\.com',
              subjectPattern: 'Invoice.*',
              attachmentRequired: true
            }
          }
        ],
        createdBy: 'finance_user'
      });

      // Simulate invoice email trigger
      const invoiceEmailEvent = {
        type: TriggerType.EMAIL_RECEIVED,
        data: {
          from: 'billing@vendor.com',
          subject: 'Invoice #12345 - Monthly Services',
          body: 'Please find attached invoice for monthly services.',
          attachments: [
            { filename: 'invoice_12345.pdf', size: 150000 }
          ],
          recipientUserId: 'finance_user'
        },
        timestamp: new Date(),
        source: 'email_service',
        userId: 'finance_user'
      };

      // Process the trigger
      const executionIds = await triggerService.processTriggerEvent(invoiceEmailEvent);
      expect(executionIds).toHaveLength(1);

      // Wait for workflow execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      const execution = workflowEngine.getExecution(executionIds[0]);
      expect(execution).toBeDefined();
      expect(execution!.templateId).toBe(invoiceProcessingWorkflow.id);
      expect(execution!.context.triggerEvent).toEqual(invoiceEmailEvent);

      // Record execution for analytics
      await analyticsService.recordExecution(execution!);

      // Get performance metrics
      const metrics = await analyticsService.getPerformanceMetrics(invoiceProcessingWorkflow.id);
      expect(metrics.totalExecutions).toBeGreaterThan(0);
    });

    it('should handle complex multi-branch workflow with error recovery', async () => {
      const complexWorkflow = await templateService.createTemplate({
        name: 'Complex Multi-Branch Workflow',
        description: 'Complex workflow with multiple branches and error handling',
        category: 'test',
        steps: [
          {
            id: 'input_validation',
            name: 'Validate Input',
            type: StepType.CONDITIONAL,
            configuration: {
              branches: [
                {
                  name: 'high_priority',
                  condition: 'context.task.data.input.priority === "high"',
                  action: 'fast_track'
                },
                {
                  name: 'medium_priority',
                  condition: 'context.task.data.input.priority === "medium"',
                  action: 'standard_process'
                },
                {
                  name: 'low_priority',
                  condition: 'context.task.data.input.priority === "low"',
                  action: 'batch_process'
                },
                {
                  name: 'default',
                  isDefault: true,
                  action: 'error_invalid_priority'
                }
              ]
            },
            dependencies: [],
            order: 1
          },
          {
            id: 'process_high_priority',
            name: 'Process High Priority',
            type: StepType.AI_PROCESSING,
            configuration: {
              model: 'fast-processor',
              prompt: 'Process high priority request: {{request_data}}'
            },
            dependencies: ['input_validation'],
            order: 2
          },
          {
            id: 'process_standard',
            name: 'Process Standard',
            type: StepType.DATA_TRANSFORMATION,
            configuration: {
              operation: 'standard_transform',
              input: 'request_data'
            },
            dependencies: ['input_validation'],
            order: 3
          },
          {
            id: 'final_notification',
            name: 'Send Final Notification',
            type: StepType.NOTIFICATION,
            configuration: {
              type: 'email',
              recipients: ['{{requester_email}}'],
              message: 'Your request has been processed via {{processing_path}}'
            },
            dependencies: ['process_high_priority', 'process_standard'],
            order: 4
          }
        ],
        triggers: [],
        createdBy: 'test_user'
      });

      // Test high priority path
      const highPriorityTask = await TaskModel.create({
        type: 'complex_workflow',
        status: TaskStatus.PENDING,
        priority: 'high',
        assignedTo: 'test_user',
        createdBy: 'test_user',
        title: 'High Priority Test',
        description: 'Testing high priority workflow path',
        data: {
          input: { 
            priority: 'high',
            request_data: 'urgent_request',
            requester_email: 'user@test.com'
          },
          context: {
            userId: 'test_user',
            workflowTemplateId: complexWorkflow.id
          }
        },
        workflow: complexWorkflow.steps
      });

      const executionId = await workflowEngine.executeWorkflow(
        complexWorkflow.id,
        highPriorityTask.id,
        { testMode: true }
      );

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 1500));

      const execution = workflowEngine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution!.context.step_input_validation_result.branch).toBe('high_priority');

      // Create and run comprehensive test suite
      const testSuite = await testingService.createTestSuite({
        name: 'Complex Workflow Test Suite',
        description: 'Comprehensive testing of complex workflow',
        templateId: complexWorkflow.id,
        testCases: [
          {
            id: 'test_high_priority',
            name: 'High Priority Path Test',
            description: 'Test high priority processing path',
            templateId: complexWorkflow.id,
            inputData: { priority: 'high', request_data: 'test_data' },
            expectedSteps: ['input_validation', 'process_high_priority', 'final_notification'],
            tags: ['priority-testing', 'high-priority'],
            createdBy: 'test_user',
            createdAt: new Date()
          },
          {
            id: 'test_medium_priority',
            name: 'Medium Priority Path Test',
            description: 'Test medium priority processing path',
            templateId: complexWorkflow.id,
            inputData: { priority: 'medium', request_data: 'test_data' },
            expectedSteps: ['input_validation', 'process_standard', 'final_notification'],
            tags: ['priority-testing', 'medium-priority'],
            createdBy: 'test_user',
            createdAt: new Date()
          },
          {
            id: 'test_invalid_priority',
            name: 'Invalid Priority Test',
            description: 'Test invalid priority handling',
            templateId: complexWorkflow.id,
            inputData: { priority: 'invalid', request_data: 'test_data' },
            shouldFail: false, // Should handle gracefully
            tags: ['error-handling', 'edge-cases'],
            createdBy: 'test_user',
            createdAt: new Date()
          }
        ],
        configuration: {
          timeout: 60000,
          retryCount: 2,
          parallelExecution: true,
          cleanupAfterTest: true
        },
        createdBy: 'test_user'
      });

      const testResults = await testingService.runTestSuite(testSuite.id);
      
      expect(testResults.totalTests).toBe(3);
      expect(testResults.passedTests).toBeGreaterThan(0);
      expect(testResults.coverage.coveragePercentage).toBeGreaterThan(50);
    });
  });
});