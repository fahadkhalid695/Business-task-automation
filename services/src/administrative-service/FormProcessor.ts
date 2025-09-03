import {
  FormProcessingRequest,
  FormProcessingResult,
  FormType,
  FormData,
  FormProcessingOptions,
  ValidationError,
  FormAttachment,
  ExternalIntegration
} from './types/AdministrativeTypes';
import { logger } from '../shared/utils/logger';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';

/**
 * FormProcessor - Handles form automation and data extraction
 */
export class FormProcessor {
  private inferenceEngine: InferenceEngine;
  private integrations: Map<string, ExternalIntegration>;
  private formValidators: Map<FormType, FormValidator>;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.integrations = new Map();
    this.formValidators = new Map();
    this.initializeValidators();
    
    logger.info('FormProcessor initialized');
  }

  /**
   * Process form with data extraction and validation
   */
  async processForm(request: FormProcessingRequest): Promise<FormProcessingResult> {
    const { formType, data, options = {} } = request;
    const formId = this.generateFormId();

    logger.info(`Processing form: ${formType}`, { formId, submittedBy: data.submittedBy });

    try {
      // Extract data from attachments if requested
      let extractedData = { ...data.fields };
      if (options.extractFromAttachments && data.attachments) {
        const attachmentData = await this.extractDataFromAttachments(data.attachments);
        extractedData = { ...extractedData, ...attachmentData };
      }

      // Validate form data
      const validationErrors = options.validateData !== false 
        ? await this.validateFormData(formType, extractedData)
        : [];

      // Determine processing status
      const hasErrors = validationErrors.some(error => error.severity === 'error');
      const status = hasErrors ? 'rejected' : 'processed';

      // Check if approval is required
      const approvalRequired = this.requiresApproval(formType, extractedData);

      // Generate next steps
      const nextSteps = this.generateNextSteps(formType, status, approvalRequired, validationErrors);

      // Auto-approve if configured and no errors
      if (options.autoApprove && !hasErrors && !approvalRequired) {
        await this.autoApproveForm(formId, formType, extractedData);
        nextSteps.unshift('Form automatically approved and processed');
      }

      // Notify approvers if needed
      if (options.notifyApprovers && approvalRequired) {
        await this.notifyApprovers(formId, formType, data.submittedBy);
        nextSteps.push('Approvers have been notified');
      }

      logger.info(`Form processing completed: ${formId}`, {
        status,
        validationErrors: validationErrors.length,
        approvalRequired
      });

      return {
        formId,
        status,
        extractedData,
        validationErrors,
        nextSteps,
        approvalRequired
      };

    } catch (error) {
      logger.error('Form processing failed:', { formId, error: error.message });
      
      return {
        formId,
        status: 'rejected',
        extractedData: data.fields,
        validationErrors: [{
          field: 'system',
          message: `Processing failed: ${error.message}`,
          severity: 'error'
        }],
        nextSteps: ['Manual review required due to processing error'],
        approvalRequired: true
      };
    }
  }

  /**
   * Extract data from form attachments using AI
   */
  private async extractDataFromAttachments(attachments: FormAttachment[]): Promise<any> {
    const extractedData: any = {};

    for (const attachment of attachments) {
      try {
        logger.info(`Extracting data from attachment: ${attachment.filename}`);

        // For demo purposes, we'll simulate data extraction
        // In a real implementation, this would use OCR and document parsing
        const attachmentData = await this.extractFromAttachment(attachment);
        
        // Merge extracted data
        Object.assign(extractedData, attachmentData);
        
        // Store extraction results in attachment
        attachment.extractedData = attachmentData;

      } catch (error) {
        logger.error(`Failed to extract data from ${attachment.filename}:`, error);
        extractedData[`${attachment.filename}_error`] = error.message;
      }
    }

    return extractedData;
  }

  /**
   * Extract data from individual attachment
   */
  private async extractFromAttachment(attachment: FormAttachment): Promise<any> {
    // Simulate different extraction methods based on file type
    switch (attachment.mimeType) {
      case 'application/pdf':
        return await this.extractFromPDF(attachment);
      case 'image/jpeg':
      case 'image/png':
        return await this.extractFromImage(attachment);
      case 'text/csv':
      case 'application/vnd.ms-excel':
        return await this.extractFromSpreadsheet(attachment);
      default:
        logger.warn(`Unsupported attachment type: ${attachment.mimeType}`);
        return {};
    }
  }

  /**
   * Extract data from PDF using AI
   */
  private async extractFromPDF(attachment: FormAttachment): Promise<any> {
    const prompt = `Extract structured data from this PDF document: ${attachment.filename}
    
Please identify and extract:
- Dates
- Amounts/Numbers
- Names
- Addresses
- Key-value pairs
- Tables

Return the data in JSON format.`;

    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: 500,
        temperature: 0.1
      });

      // Parse AI response (simplified - would use more robust parsing in production)
      return this.parseExtractedData(result.text);
    } catch (error) {
      logger.error('PDF extraction failed:', error);
      return { extractionError: error.message };
    }
  }

  /**
   * Extract data from image using OCR simulation
   */
  private async extractFromImage(attachment: FormAttachment): Promise<any> {
    // Simulate OCR extraction
    logger.info(`Simulating OCR extraction for ${attachment.filename}`);
    
    // In a real implementation, this would use OCR services like Tesseract or cloud OCR
    return {
      ocrText: `[Simulated OCR text from ${attachment.filename}]`,
      confidence: 0.85
    };
  }

  /**
   * Extract data from spreadsheet
   */
  private async extractFromSpreadsheet(attachment: FormAttachment): Promise<any> {
    // Simulate spreadsheet parsing
    logger.info(`Simulating spreadsheet parsing for ${attachment.filename}`);
    
    return {
      rows: 10,
      columns: 5,
      data: '[Simulated spreadsheet data]'
    };
  }

  /**
   * Parse extracted data from AI response
   */
  private parseExtractedData(text: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback to simple key-value extraction
      const data: any = {};
      const lines = text.split('\n');
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          if (key && value) {
            data[key] = value;
          }
        }
      }

      return data;
    } catch (error) {
      logger.error('Failed to parse extracted data:', error);
      return { rawText: text };
    }
  }

  /**
   * Validate form data based on form type
   */
  private async validateFormData(formType: FormType, data: any): Promise<ValidationError[]> {
    const validator = this.formValidators.get(formType);
    if (!validator) {
      return [{
        field: 'formType',
        message: `No validator found for form type: ${formType}`,
        severity: 'warning'
      }];
    }

    return await validator.validate(data);
  }

  /**
   * Check if form requires approval
   */
  private requiresApproval(formType: FormType, data: any): boolean {
    switch (formType) {
      case FormType.EXPENSE_REPORT:
        return this.getNumericValue(data.amount) > 1000; // Require approval for expenses > $1000
      case FormType.LEAVE_REQUEST:
        return this.getNumericValue(data.days) > 5; // Require approval for leave > 5 days
      case FormType.PURCHASE_ORDER:
        return this.getNumericValue(data.total) > 500; // Require approval for purchases > $500
      default:
        return true; // Default to requiring approval
    }
  }

  /**
   * Generate next steps based on form processing results
   */
  private generateNextSteps(
    formType: FormType, 
    status: string, 
    approvalRequired: boolean, 
    validationErrors: ValidationError[]
  ): string[] {
    const steps: string[] = [];

    if (status === 'rejected') {
      steps.push('Fix validation errors and resubmit');
      return steps;
    }

    if (approvalRequired) {
      steps.push('Awaiting approval from designated approver');
      steps.push('You will be notified once approved or if additional information is needed');
    } else {
      steps.push('Form has been processed successfully');
    }

    // Add form-specific next steps
    switch (formType) {
      case FormType.EXPENSE_REPORT:
        if (!approvalRequired) {
          steps.push('Reimbursement will be processed in next payroll cycle');
        }
        break;
      case FormType.LEAVE_REQUEST:
        steps.push('Update your calendar once approved');
        steps.push('Coordinate with team members for coverage');
        break;
      case FormType.PURCHASE_ORDER:
        if (!approvalRequired) {
          steps.push('Purchase order has been sent to vendor');
        }
        break;
    }

    return steps;
  }

  /**
   * Auto-approve form if conditions are met
   */
  private async autoApproveForm(formId: string, formType: FormType, data: any): Promise<void> {
    logger.info(`Auto-approving form: ${formId}`, { formType });
    
    // In a real implementation, this would update the form status in the database
    // and trigger any necessary downstream processes
  }

  /**
   * Notify approvers about pending form
   */
  private async notifyApprovers(formId: string, formType: FormType, submittedBy: string): Promise<void> {
    logger.info(`Notifying approvers for form: ${formId}`, { formType, submittedBy });
    
    // In a real implementation, this would send notifications via email, Slack, etc.
  }

  /**
   * Get numeric value from data field
   */
  private getNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Generate unique form ID
   */
  private generateFormId(): string {
    return `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize form validators
   */
  private initializeValidators(): void {
    // Expense Report Validator
    this.formValidators.set(FormType.EXPENSE_REPORT, {
      validate: async (data: any): Promise<ValidationError[]> => {
        const errors: ValidationError[] = [];

        if (!data.amount || this.getNumericValue(data.amount) <= 0) {
          errors.push({
            field: 'amount',
            message: 'Amount is required and must be greater than 0',
            severity: 'error'
          });
        }

        if (!data.date) {
          errors.push({
            field: 'date',
            message: 'Expense date is required',
            severity: 'error'
          });
        }

        if (!data.category) {
          errors.push({
            field: 'category',
            message: 'Expense category is required',
            severity: 'error'
          });
        }

        if (this.getNumericValue(data.amount) > 10000) {
          errors.push({
            field: 'amount',
            message: 'Expense amount exceeds policy limit of $10,000',
            severity: 'warning'
          });
        }

        return errors;
      }
    });

    // Leave Request Validator
    this.formValidators.set(FormType.LEAVE_REQUEST, {
      validate: async (data: any): Promise<ValidationError[]> => {
        const errors: ValidationError[] = [];

        if (!data.startDate) {
          errors.push({
            field: 'startDate',
            message: 'Start date is required',
            severity: 'error'
          });
        }

        if (!data.endDate) {
          errors.push({
            field: 'endDate',
            message: 'End date is required',
            severity: 'error'
          });
        }

        if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
          errors.push({
            field: 'endDate',
            message: 'End date must be after start date',
            severity: 'error'
          });
        }

        if (!data.reason) {
          errors.push({
            field: 'reason',
            message: 'Reason for leave is required',
            severity: 'error'
          });
        }

        return errors;
      }
    });

    // Purchase Order Validator
    this.formValidators.set(FormType.PURCHASE_ORDER, {
      validate: async (data: any): Promise<ValidationError[]> => {
        const errors: ValidationError[] = [];

        if (!data.vendor) {
          errors.push({
            field: 'vendor',
            message: 'Vendor information is required',
            severity: 'error'
          });
        }

        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
          errors.push({
            field: 'items',
            message: 'At least one item is required',
            severity: 'error'
          });
        }

        if (!data.total || this.getNumericValue(data.total) <= 0) {
          errors.push({
            field: 'total',
            message: 'Total amount is required and must be greater than 0',
            severity: 'error'
          });
        }

        return errors;
      }
    });

    logger.info(`Initialized ${this.formValidators.size} form validators`);
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring form integration: ${integration.service}`, { integrationId });
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status of form processor
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      validators: this.formValidators.size,
      integrations: this.integrations.size,
      supportedFormTypes: Object.values(FormType),
      lastProcessed: new Date().toISOString()
    };
  }
}

/**
 * Form validator interface
 */
interface FormValidator {
  validate(data: any): Promise<ValidationError[]>;
}