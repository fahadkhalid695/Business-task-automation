import { ExpenseProcessor } from './ExpenseProcessor';
import { PayrollProcessor } from './PayrollProcessor';
import { ResumeScreener } from './ResumeScreener';
import { OnboardingManager } from './OnboardingManager';
import { 
  ExpenseProcessingRequest, 
  ExpenseProcessingResult,
  PayrollVerificationRequest,
  PayrollVerificationResult,
  ResumeScreeningRequest,
  ResumeScreeningResult,
  OnboardingRequest,
  OnboardingResult,
  ServiceResponse,
  ExternalIntegration
} from './types/FinanceHRTypes';
import { logger } from '../shared/utils/logger';
import { Task, TaskStatus, TaskType } from '../shared/types';

/**
 * FinanceHRService - Main service class for handling finance and HR operations
 * Coordinates expense processing, payroll verification, resume screening, and employee onboarding
 */
export class FinanceHRService {
  private expenseProcessor: ExpenseProcessor;
  private payrollProcessor: PayrollProcessor;
  private resumeScreener: ResumeScreener;
  private onboardingManager: OnboardingManager;
  private integrations: Map<string, ExternalIntegration>;

  constructor() {
    this.expenseProcessor = new ExpenseProcessor();
    this.payrollProcessor = new PayrollProcessor();
    this.resumeScreener = new ResumeScreener();
    this.onboardingManager = new OnboardingManager();
    this.integrations = new Map();
    
    logger.info('FinanceHRService initialized');
  }

  /**
   * Process expense receipts with data extraction, categorization, and policy validation
   */
  async processExpenses(request: ExpenseProcessingRequest): Promise<ServiceResponse<ExpenseProcessingResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Processing ${request.receipts.length} expense receipts`, { 
        requestId, 
        employeeId: request.employeeId 
      });

      const result = await this.expenseProcessor.processExpenses(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Expense processing completed in ${processingTime}ms`, { 
        requestId, 
        receiptCount: request.receipts.length,
        totalAmount: result.totalAmount,
        policyViolations: result.policyViolations.length,
        status: result.status
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Expense processing failed', { 
        requestId, 
        error: error.message, 
        processingTime,
        employeeId: request.employeeId
      });

      return {
        success: false,
        error: {
          code: 'EXPENSE_PROCESSING_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Verify payroll data and generate payslips with hours validation
   */
  async verifyPayroll(request: PayrollVerificationRequest): Promise<ServiceResponse<PayrollVerificationResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Verifying payroll for employee: ${request.employeeId}`, { 
        requestId, 
        payPeriod: request.payPeriod.period,
        timeEntries: request.timeEntries.length
      });

      const result = await this.payrollProcessor.verifyPayroll(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Payroll verification completed in ${processingTime}ms`, { 
        requestId, 
        employeeId: request.employeeId,
        totalHours: result.totalHours,
        grossPay: result.grossPay,
        discrepancies: result.discrepancies.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Payroll verification failed', { 
        requestId, 
        error: error.message, 
        processingTime,
        employeeId: request.employeeId
      });

      return {
        success: false,
        error: {
          code: 'PAYROLL_VERIFICATION_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Screen resumes against job requirements and rank candidates
   */
  async screenResumes(request: ResumeScreeningRequest): Promise<ServiceResponse<ResumeScreeningResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Screening ${request.resumes.length} resumes`, { 
        requestId, 
        jobTitle: request.jobRequirements.jobTitle,
        department: request.jobRequirements.department
      });

      const result = await this.resumeScreener.screenResumes(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Resume screening completed in ${processingTime}ms`, { 
        requestId, 
        totalCandidates: result.summary.totalCandidates,
        qualifiedCandidates: result.summary.qualifiedCandidates,
        averageScore: result.summary.averageScore
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Resume screening failed', { 
        requestId, 
        error: error.message, 
        processingTime,
        jobTitle: request.jobRequirements.jobTitle
      });

      return {
        success: false,
        error: {
          code: 'RESUME_SCREENING_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Create employee onboarding workflow with forms and training materials
   */
  async createOnboarding(request: OnboardingRequest): Promise<ServiceResponse<OnboardingResult>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Creating onboarding plan for employee: ${request.newEmployee.employeeId}`, { 
        requestId, 
        position: request.newEmployee.position,
        department: request.newEmployee.department,
        startDate: request.newEmployee.startDate
      });

      const result = await this.onboardingManager.createOnboarding(request);

      const processingTime = Date.now() - startTime;
      logger.info(`Onboarding plan created in ${processingTime}ms`, { 
        requestId, 
        employeeId: request.newEmployee.employeeId,
        tasksGenerated: result.onboardingPlan.tasks.length,
        formsGenerated: result.generatedForms.length,
        trainingMaterials: result.trainingMaterials.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Onboarding creation failed', { 
        requestId, 
        error: error.message, 
        processingTime,
        employeeId: request.newEmployee.employeeId
      });

      return {
        success: false,
        error: {
          code: 'ONBOARDING_CREATION_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Add external system integration for finance/HR operations
   */
  async addIntegration(integrationId: string, integration: ExternalIntegration): Promise<ServiceResponse<void>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Adding integration: ${integration.service}`, { requestId, integrationId });

      // Validate integration credentials
      await this.validateIntegration(integration);

      this.integrations.set(integrationId, integration);

      // Configure processors with integration
      await this.configureIntegration(integrationId, integration);

      const processingTime = Date.now() - startTime;
      logger.info(`Integration added successfully in ${processingTime}ms`, { 
        requestId, 
        integrationId,
        service: integration.service
      });

      return {
        success: true,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Integration setup failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'INTEGRATION_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Remove external system integration
   */
  async removeIntegration(integrationId: string): Promise<ServiceResponse<void>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.info(`Removing integration: ${integrationId}`, { requestId });

      if (!this.integrations.has(integrationId)) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      this.integrations.delete(integrationId);

      const processingTime = Date.now() - startTime;
      logger.info(`Integration removed successfully in ${processingTime}ms`, { 
        requestId, 
        integrationId
      });

      return {
        success: true,
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Integration removal failed', { requestId, error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'INTEGRATION_REMOVAL_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<ServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const status = {
        service: 'FinanceHRService',
        status: 'healthy',
        components: {
          expenseProcessor: await this.expenseProcessor.getHealthStatus(),
          payrollProcessor: await this.payrollProcessor.getHealthStatus(),
          resumeScreener: await this.resumeScreener.getHealthStatus(),
          onboardingManager: await this.onboardingManager.getHealthStatus()
        },
        integrations: Array.from(this.integrations.keys()),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: status,
        metadata: {
          processingTime,
          requestId: this.generateRequestId(),
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Health check failed', { error: error.message, processingTime });

      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          processingTime,
          requestId: this.generateRequestId(),
          version: '1.0.0',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Validate external integration credentials and connectivity
   */
  private async validateIntegration(integration: ExternalIntegration): Promise<void> {
    if (!integration.service || !integration.credentials) {
      throw new Error('Invalid integration configuration');
    }

    logger.info(`Validating integration for service: ${integration.service}`);
    
    // Service-specific validation
    switch (integration.service) {
      case 'quickbooks':
      case 'xero':
        // Validate accounting system credentials
        break;
      case 'adp':
      case 'paychex':
        // Validate payroll system credentials
        break;
      case 'workday':
      case 'bamboohr':
        // Validate HR system credentials
        break;
      default:
        throw new Error(`Unsupported integration service: ${integration.service}`);
    }
  }

  /**
   * Configure processors with integration settings
   */
  private async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    switch (integration.service) {
      case 'quickbooks':
      case 'xero':
        await this.expenseProcessor.configureIntegration(integrationId, integration);
        break;
      case 'adp':
      case 'paychex':
        await this.payrollProcessor.configureIntegration(integrationId, integration);
        break;
      case 'workday':
      case 'bamboohr':
        await this.onboardingManager.configureIntegration(integrationId, integration);
        break;
    }
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `finhr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}