import { Logger } from '../shared/utils/logger';
import { WorkflowTemplate, WorkflowStep, StepType } from '../shared/types';
import { WorkflowEngine, WorkflowExecution } from './WorkflowEngine';
import { WorkflowTemplateService } from './WorkflowTemplateService';
import { AppError } from '../shared/utils/errors';

const logger = new Logger('WorkflowTestingService');

export interface WorkflowTestCase {
  id: string;
  name: string;
  description: string;
  templateId: string;
  inputData: any;
  expectedOutput?: any;
  expectedSteps?: string[];
  expectedDuration?: number;
  shouldFail?: boolean;
  failureStep?: string;
  tags: string[];
  createdBy: string;
  createdAt: Date;
}

export interface WorkflowTestResult {
  testCaseId: string;
  testCaseName: string;
  templateId: string;
  executionId: string;
  status: 'passed' | 'failed' | 'error';
  startTime: Date;
  endTime: Date;
  duration: number;
  stepsExecuted: number;
  expectedSteps: number;
  actualOutput?: any;
  expectedOutput?: any;
  errors: string[];
  warnings: string[];
  stepResults: StepTestResult[];
  performanceMetrics: {
    memoryUsage: number;
    cpuTime: number;
    networkCalls: number;
  };
}

export interface StepTestResult {
  stepId: string;
  stepName: string;
  stepType: StepType;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  input: any;
  output: any;
  error?: string;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  type: 'equals' | 'contains' | 'matches' | 'exists' | 'type' | 'range';
  description: string;
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface WorkflowTestSuite {
  id: string;
  name: string;
  description: string;
  templateId: string;
  testCases: WorkflowTestCase[];
  configuration: {
    timeout: number;
    retryCount: number;
    parallelExecution: boolean;
    cleanupAfterTest: boolean;
  };
  createdBy: string;
  createdAt: Date;
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  templateId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  totalDuration: number;
  startTime: Date;
  endTime: Date;
  testResults: WorkflowTestResult[];
  coverage: {
    stepsCovered: number;
    totalSteps: number;
    coveragePercentage: number;
    uncoveredSteps: string[];
  };
}

export class WorkflowTestingService {
  private workflowEngine: WorkflowEngine;
  private templateService: WorkflowTemplateService;
  private testSuites = new Map<string, WorkflowTestSuite>();
  private testResults = new Map<string, TestSuiteResult[]>();

  constructor(workflowEngine: WorkflowEngine, templateService: WorkflowTemplateService) {
    this.workflowEngine = workflowEngine;
    this.templateService = templateService;
  }

  async createTestSuite(suite: Omit<WorkflowTestSuite, 'id' | 'createdAt'>): Promise<WorkflowTestSuite> {
    try {
      const testSuite: WorkflowTestSuite = {
        ...suite,
        id: this.generateId(),
        createdAt: new Date()
      };

      // Validate test suite
      await this.validateTestSuite(testSuite);

      this.testSuites.set(testSuite.id, testSuite);

      logger.info('Test suite created', {
        suiteId: testSuite.id,
        templateId: testSuite.templateId,
        testCount: testSuite.testCases.length
      });

      return testSuite;
    } catch (error) {
      logger.error('Failed to create test suite', error, { suite });
      throw error;
    }
  }

  async runTestSuite(suiteId: string): Promise<TestSuiteResult> {
    try {
      const suite = this.testSuites.get(suiteId);
      if (!suite) {
        throw new AppError(`Test suite ${suiteId} not found`, 404, 'TEST_SUITE_NOT_FOUND');
      }

      const template = await this.templateService.getTemplate(suite.templateId);
      const startTime = new Date();

      logger.info('Starting test suite execution', {
        suiteId,
        templateId: suite.templateId,
        testCount: suite.testCases.length
      });

      const testResults: WorkflowTestResult[] = [];

      if (suite.configuration.parallelExecution) {
        // Run tests in parallel
        const promises = suite.testCases.map(testCase => 
          this.runTestCase(testCase, template, suite.configuration)
        );
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            testResults.push(result.value);
          } else {
            testResults.push(this.createErrorTestResult(suite.testCases[index], result.reason));
          }
        });
      } else {
        // Run tests sequentially
        for (const testCase of suite.testCases) {
          try {
            const result = await this.runTestCase(testCase, template, suite.configuration);
            testResults.push(result);
          } catch (error) {
            testResults.push(this.createErrorTestResult(testCase, error));
          }
        }
      }

      const endTime = new Date();
      const coverage = this.calculateCoverage(testResults, template.steps);

      const suiteResult: TestSuiteResult = {
        suiteId,
        suiteName: suite.name,
        templateId: suite.templateId,
        totalTests: suite.testCases.length,
        passedTests: testResults.filter(r => r.status === 'passed').length,
        failedTests: testResults.filter(r => r.status === 'failed').length,
        errorTests: testResults.filter(r => r.status === 'error').length,
        totalDuration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        testResults,
        coverage
      };

      // Store results
      const existingResults = this.testResults.get(suiteId) || [];
      existingResults.push(suiteResult);
      this.testResults.set(suiteId, existingResults);

      logger.info('Test suite execution completed', {
        suiteId,
        totalTests: suiteResult.totalTests,
        passedTests: suiteResult.passedTests,
        failedTests: suiteResult.failedTests,
        duration: suiteResult.totalDuration
      });

      return suiteResult;
    } catch (error) {
      logger.error('Failed to run test suite', error, { suiteId });
      throw error;
    }
  }

  async runTestCase(
    testCase: WorkflowTestCase,
    template: WorkflowTemplate,
    config: WorkflowTestSuite['configuration']
  ): Promise<WorkflowTestResult> {
    const startTime = new Date();
    const stepResults: StepTestResult[] = [];
    let executionId = '';

    try {
      logger.info('Running test case', {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        templateId: testCase.templateId
      });

      // Create a mock task for testing
      const mockTask = {
        id: `test_task_${testCase.id}`,
        type: 'test_execution',
        status: 'pending',
        priority: 'medium',
        assignedTo: 'test_system',
        createdBy: testCase.createdBy,
        title: `Test: ${testCase.name}`,
        description: testCase.description,
        data: {
          input: testCase.inputData,
          context: {
            userId: testCase.createdBy,
            workflowTemplateId: testCase.templateId,
            isTest: true,
            testCaseId: testCase.id
          }
        },
        workflow: template.steps,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Execute workflow with timeout
      const executionPromise = this.workflowEngine.executeWorkflow(
        template.id,
        mockTask.id,
        { isTest: true, testCase: testCase }
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test execution timeout')), config.timeout);
      });

      executionId = await Promise.race([executionPromise, timeoutPromise]) as string;

      // Wait for execution to complete
      await this.waitForExecution(executionId, config.timeout);

      const execution = this.workflowEngine.getExecution(executionId);
      if (!execution) {
        throw new Error('Execution not found after completion');
      }

      // Analyze results
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Create step results
      for (let i = 0; i <= execution.currentStep && i < template.steps.length; i++) {
        const step = template.steps[i];
        const stepResult = this.analyzeStepResult(step, execution, testCase);
        stepResults.push(stepResult);
      }

      // Validate overall result
      const testResult: WorkflowTestResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        templateId: testCase.templateId,
        executionId,
        status: this.determineTestStatus(execution, testCase, stepResults),
        startTime,
        endTime,
        duration,
        stepsExecuted: execution.currentStep + 1,
        expectedSteps: testCase.expectedSteps?.length || template.steps.length,
        actualOutput: execution.context.lastStepResult,
        expectedOutput: testCase.expectedOutput,
        errors: [],
        warnings: [],
        stepResults,
        performanceMetrics: {
          memoryUsage: 0, // Would need actual monitoring
          cpuTime: duration,
          networkCalls: this.countNetworkCalls(stepResults)
        }
      };

      // Add validation errors
      if (testCase.expectedOutput) {
        const outputValidation = this.validateOutput(
          execution.context.lastStepResult,
          testCase.expectedOutput
        );
        if (!outputValidation.passed) {
          testResult.errors.push(`Output validation failed: ${outputValidation.message}`);
          testResult.status = 'failed';
        }
      }

      return testResult;
    } catch (error) {
      const endTime = new Date();
      
      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        templateId: testCase.templateId,
        executionId,
        status: 'error',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        stepsExecuted: stepResults.length,
        expectedSteps: testCase.expectedSteps?.length || template.steps.length,
        errors: [error.message],
        warnings: [],
        stepResults,
        performanceMetrics: {
          memoryUsage: 0,
          cpuTime: endTime.getTime() - startTime.getTime(),
          networkCalls: 0
        }
      };
    }
  }

  async validateWorkflowForTesting(templateId: string): Promise<{
    isTestable: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const template = await this.templateService.getTemplate(templateId);
      const validation = await this.templateService.validateWorkflowTemplate(template);
      
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check if workflow is valid
      if (!validation.isValid) {
        issues.push(...validation.errors);
      }

      // Check for testability issues
      const hasUserApprovalSteps = template.steps.some(s => s.type === StepType.USER_APPROVAL);
      if (hasUserApprovalSteps) {
        recommendations.push('Workflow contains user approval steps - consider adding auto-approval for testing');
      }

      const hasExternalAPICalls = template.steps.some(s => s.type === StepType.EXTERNAL_API_CALL);
      if (hasExternalAPICalls) {
        recommendations.push('Workflow makes external API calls - consider mocking for reliable testing');
      }

      const hasLongTimeouts = template.steps.some(s => (s.timeout || 0) > 60000);
      if (hasLongTimeouts) {
        recommendations.push('Some steps have long timeouts - consider reducing for faster testing');
      }

      return {
        isTestable: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to validate workflow for testing', error, { templateId });
      throw error;
    }
  }

  async generateTestCases(templateId: string): Promise<WorkflowTestCase[]> {
    try {
      const template = await this.templateService.getTemplate(templateId);
      const testCases: WorkflowTestCase[] = [];

      // Generate basic happy path test
      testCases.push({
        id: this.generateId(),
        name: 'Happy Path Test',
        description: 'Tests the workflow with valid input data',
        templateId,
        inputData: this.generateSampleInput(template),
        expectedSteps: template.steps.map(s => s.id),
        tags: ['happy-path', 'auto-generated'],
        createdBy: 'system',
        createdAt: new Date()
      });

      // Generate error handling tests
      testCases.push({
        id: this.generateId(),
        name: 'Invalid Input Test',
        description: 'Tests workflow behavior with invalid input',
        templateId,
        inputData: null,
        shouldFail: true,
        tags: ['error-handling', 'auto-generated'],
        createdBy: 'system',
        createdAt: new Date()
      });

      // Generate edge case tests based on step types
      const conditionalSteps = template.steps.filter(s => s.type === StepType.CONDITIONAL);
      for (const step of conditionalSteps) {
        testCases.push({
          id: this.generateId(),
          name: `Conditional Branch Test - ${step.name}`,
          description: `Tests different branches of conditional step: ${step.name}`,
          templateId,
          inputData: this.generateConditionalTestInput(step),
          tags: ['conditional', 'auto-generated'],
          createdBy: 'system',
          createdAt: new Date()
        });
      }

      logger.info('Generated test cases', {
        templateId,
        testCaseCount: testCases.length
      });

      return testCases;
    } catch (error) {
      logger.error('Failed to generate test cases', error, { templateId });
      throw error;
    }
  }

  private async validateTestSuite(suite: WorkflowTestSuite): Promise<void> {
    // Validate template exists
    await this.templateService.getTemplate(suite.templateId);

    // Validate test cases
    if (suite.testCases.length === 0) {
      throw new AppError('Test suite must have at least one test case', 400, 'EMPTY_TEST_SUITE');
    }

    // Validate configuration
    if (suite.configuration.timeout < 1000) {
      throw new AppError('Timeout must be at least 1000ms', 400, 'INVALID_TIMEOUT');
    }
  }

  private async waitForExecution(executionId: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const execution = this.workflowEngine.getExecution(executionId);
      
      if (execution && ['completed', 'failed'].includes(execution.status)) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Execution did not complete within timeout');
  }

  private analyzeStepResult(step: WorkflowStep, execution: WorkflowExecution, testCase: WorkflowTestCase): StepTestResult {
    const stepResult = execution.context[`step_${step.id}_result`];
    
    return {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      status: stepResult ? 'passed' : 'failed',
      duration: 0, // Would need detailed timing
      input: execution.context,
      output: stepResult,
      assertions: [] // Would be populated with actual assertions
    };
  }

  private determineTestStatus(
    execution: WorkflowExecution,
    testCase: WorkflowTestCase,
    stepResults: StepTestResult[]
  ): 'passed' | 'failed' | 'error' {
    if (testCase.shouldFail) {
      return execution.status === 'failed' ? 'passed' : 'failed';
    }
    
    if (execution.status === 'completed') {
      const failedSteps = stepResults.filter(s => s.status === 'failed');
      return failedSteps.length === 0 ? 'passed' : 'failed';
    }
    
    return 'failed';
  }

  private validateOutput(actual: any, expected: any): { passed: boolean; message?: string } {
    try {
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        return { passed: true };
      }
      
      return {
        passed: false,
        message: `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      };
    } catch (error) {
      return {
        passed: false,
        message: `Output validation error: ${error.message}`
      };
    }
  }

  private calculateCoverage(testResults: WorkflowTestResult[], steps: WorkflowStep[]): TestSuiteResult['coverage'] {
    const coveredSteps = new Set<string>();
    
    testResults.forEach(result => {
      result.stepResults.forEach(stepResult => {
        if (stepResult.status === 'passed') {
          coveredSteps.add(stepResult.stepId);
        }
      });
    });
    
    const uncoveredSteps = steps
      .filter(step => !coveredSteps.has(step.id))
      .map(step => step.name);
    
    return {
      stepsCovered: coveredSteps.size,
      totalSteps: steps.length,
      coveragePercentage: steps.length > 0 ? (coveredSteps.size / steps.length) * 100 : 0,
      uncoveredSteps
    };
  }

  private countNetworkCalls(stepResults: StepTestResult[]): number {
    return stepResults.filter(s => s.stepType === StepType.EXTERNAL_API_CALL).length;
  }

  private createErrorTestResult(testCase: WorkflowTestCase, error: any): WorkflowTestResult {
    const now = new Date();
    
    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      templateId: testCase.templateId,
      executionId: '',
      status: 'error',
      startTime: now,
      endTime: now,
      duration: 0,
      stepsExecuted: 0,
      expectedSteps: testCase.expectedSteps?.length || 0,
      errors: [error.message || 'Unknown error'],
      warnings: [],
      stepResults: [],
      performanceMetrics: {
        memoryUsage: 0,
        cpuTime: 0,
        networkCalls: 0
      }
    };
  }

  private generateSampleInput(template: WorkflowTemplate): any {
    // Generate sample input based on workflow steps
    return {
      message: 'Sample test input',
      data: { test: true },
      timestamp: new Date().toISOString()
    };
  }

  private generateConditionalTestInput(step: WorkflowStep): any {
    // Generate input that would trigger different conditional branches
    return {
      condition_test: true,
      branch_data: 'test_value'
    };
  }

  private generateId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Public methods for managing test suites and results
  getTestSuite(suiteId: string): WorkflowTestSuite | undefined {
    return this.testSuites.get(suiteId);
  }

  getTestResults(suiteId: string): TestSuiteResult[] {
    return this.testResults.get(suiteId) || [];
  }

  getAllTestSuites(): WorkflowTestSuite[] {
    return Array.from(this.testSuites.values());
  }
}