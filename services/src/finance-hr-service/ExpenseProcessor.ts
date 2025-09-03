import { 
  ExpenseProcessingRequest, 
  ExpenseProcessingResult,
  ReceiptData,
  ProcessedExpense,
  ExtractedReceiptData,
  ExpenseCategory,
  ExpenseStatus,
  PolicyViolation,
  ApprovalStep,
  ExternalIntegration
} from './types/FinanceHRTypes';
import { logger } from '../shared/utils/logger';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';

/**
 * ExpenseProcessor - Handles receipt data extraction, categorization, and policy validation
 */
export class ExpenseProcessor {
  private inferenceEngine: InferenceEngine;
  private integrations: Map<string, ExternalIntegration>;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.integrations = new Map();
  }

  /**
   * Process expense receipts with OCR, categorization, and policy validation
   */
  async processExpenses(request: ExpenseProcessingRequest): Promise<ExpenseProcessingResult> {
    logger.info(`Processing ${request.receipts.length} receipts for employee ${request.employeeId}`);

    const processedExpenses: ProcessedExpense[] = [];
    let totalAmount = 0;
    const policyViolations: PolicyViolation[] = [];

    // Process each receipt
    for (const receipt of request.receipts) {
      try {
        const extractedData = await this.extractReceiptData(receipt);
        const processedExpense = await this.createProcessedExpense(receipt, extractedData);
        
        processedExpenses.push(processedExpense);
        totalAmount += processedExpense.amount;

        // Validate against expense policy
        if (request.expensePolicy) {
          const violations = await this.validateExpensePolicy(processedExpense, request.expensePolicy);
          policyViolations.push(...violations);
        }
      } catch (error) {
        logger.error(`Failed to process receipt ${receipt.id}`, { error: error.message });
        
        // Create a failed expense entry
        const failedExpense: ProcessedExpense = {
          id: this.generateExpenseId(),
          receiptId: receipt.id,
          vendor: 'Unknown',
          amount: 0,
          date: new Date(),
          category: ExpenseCategory.OTHER,
          currency: 'USD',
          taxAmount: 0,
          description: 'Failed to process receipt',
          isReimbursable: false,
          confidence: 0,
          extractedData: {
            vendor: 'Unknown',
            amount: 0,
            date: new Date(),
            items: [],
            taxAmount: 0,
            currency: 'USD',
            confidence: 0
          }
        };
        
        processedExpenses.push(failedExpense);
      }
    }

    // Determine approval requirements
    const approvalRequired = this.requiresApproval(processedExpenses, policyViolations, request.expensePolicy);
    const approvalWorkflow = approvalRequired ? await this.createApprovalWorkflow(processedExpenses, request.expensePolicy) : undefined;

    // Determine overall status
    const status = this.determineExpenseStatus(processedExpenses, policyViolations, approvalRequired);

    return {
      processedExpenses,
      totalAmount,
      approvalRequired,
      policyViolations,
      status,
      approvalWorkflow
    };
  }

  /**
   * Extract data from receipt using OCR and AI
   */
  private async extractReceiptData(receipt: ReceiptData): Promise<ExtractedReceiptData> {
    logger.debug(`Extracting data from receipt ${receipt.id}`);

    try {
      // Use AI/ML engine for OCR and data extraction
      const ocrResult = await this.inferenceEngine.processImage({
        imageUrl: receipt.imageUrl,
        imageData: receipt.imageData,
        task: 'receipt_extraction',
        parameters: {
          extractFields: ['vendor', 'amount', 'date', 'items', 'tax', 'currency'],
          language: 'en'
        }
      });

      // Parse OCR results into structured data
      const extractedData: ExtractedReceiptData = {
        vendor: ocrResult.data.vendor || 'Unknown Vendor',
        amount: parseFloat(ocrResult.data.amount) || 0,
        date: new Date(ocrResult.data.date) || new Date(),
        items: ocrResult.data.items || [],
        taxAmount: parseFloat(ocrResult.data.tax) || 0,
        currency: ocrResult.data.currency || 'USD',
        paymentMethod: ocrResult.data.paymentMethod,
        confidence: ocrResult.confidence || 0
      };

      logger.debug(`Extracted receipt data`, { 
        receiptId: receipt.id, 
        vendor: extractedData.vendor,
        amount: extractedData.amount,
        confidence: extractedData.confidence
      });

      return extractedData;
    } catch (error) {
      logger.error(`OCR extraction failed for receipt ${receipt.id}`, { error: error.message });
      
      // Return default data if extraction fails
      return {
        vendor: 'Unknown Vendor',
        amount: 0,
        date: new Date(),
        items: [],
        taxAmount: 0,
        currency: 'USD',
        confidence: 0
      };
    }
  }

  /**
   * Create processed expense from extracted data
   */
  private async createProcessedExpense(receipt: ReceiptData, extractedData: ExtractedReceiptData): Promise<ProcessedExpense> {
    // Categorize expense using AI
    const category = await this.categorizeExpense(extractedData);
    
    // Determine if expense is reimbursable
    const isReimbursable = this.isExpenseReimbursable(category, extractedData.amount);

    return {
      id: this.generateExpenseId(),
      receiptId: receipt.id,
      vendor: extractedData.vendor,
      amount: extractedData.amount,
      date: extractedData.date,
      category,
      currency: extractedData.currency,
      taxAmount: extractedData.taxAmount,
      description: this.generateExpenseDescription(extractedData),
      isReimbursable,
      confidence: extractedData.confidence,
      extractedData
    };
  }

  /**
   * Categorize expense using AI classification
   */
  private async categorizeExpense(extractedData: ExtractedReceiptData): Promise<ExpenseCategory> {
    try {
      const classificationResult = await this.inferenceEngine.classify({
        text: `${extractedData.vendor} ${extractedData.items.map(item => item.description).join(' ')}`,
        categories: Object.values(ExpenseCategory),
        task: 'expense_categorization'
      });

      return classificationResult.category as ExpenseCategory || ExpenseCategory.OTHER;
    } catch (error) {
      logger.error('Expense categorization failed', { error: error.message });
      return ExpenseCategory.OTHER;
    }
  }

  /**
   * Validate expense against company policy
   */
  private async validateExpensePolicy(expense: ProcessedExpense, policy: any): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    if (!policy || !policy.rules) {
      return violations;
    }

    // Check category-specific rules
    const categoryRule = policy.rules.find((rule: any) => rule.category === expense.category);
    
    if (categoryRule) {
      // Check amount limits
      if (expense.amount > categoryRule.maxAmount) {
        violations.push({
          ruleId: `${expense.category}_amount_limit`,
          description: `Expense amount $${expense.amount} exceeds limit of $${categoryRule.maxAmount} for ${expense.category}`,
          severity: 'error',
          suggestedAction: 'Reduce expense amount or get manager approval',
          expenseId: expense.id
        });
      }

      // Check receipt requirement
      if (categoryRule.requiresReceipt && expense.confidence < 0.7) {
        violations.push({
          ruleId: `${expense.category}_receipt_required`,
          description: `Receipt quality is poor (confidence: ${expense.confidence}). Clear receipt required for ${expense.category}`,
          severity: 'warning',
          suggestedAction: 'Upload a clearer receipt image',
          expenseId: expense.id
        });
      }
    }

    // Check for suspicious patterns
    if (expense.amount > 1000 && expense.confidence < 0.8) {
      violations.push({
        ruleId: 'high_amount_low_confidence',
        description: `High amount expense ($${expense.amount}) with low OCR confidence (${expense.confidence})`,
        severity: 'warning',
        suggestedAction: 'Manual review recommended',
        expenseId: expense.id
      });
    }

    return violations;
  }

  /**
   * Determine if expenses require approval
   */
  private requiresApproval(expenses: ProcessedExpense[], violations: PolicyViolation[], policy: any): boolean {
    // Require approval if there are policy violations
    if (violations.some(v => v.severity === 'error')) {
      return true;
    }

    // Require approval for high amounts
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    if (totalAmount > 500) {
      return true;
    }

    // Check policy-specific approval requirements
    if (policy && policy.approvalLimits) {
      for (const expense of expenses) {
        const limit = policy.approvalLimits.find((l: any) => 
          l.categories.includes(expense.category) && expense.amount > l.maxAmount
        );
        if (limit) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Create approval workflow based on policy
   */
  private async createApprovalWorkflow(expenses: ProcessedExpense[], policy: any): Promise<ApprovalStep[]> {
    const workflow: ApprovalStep[] = [];
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Default approval workflow
    if (totalAmount > 100) {
      workflow.push({
        approverRole: 'manager',
        approverEmail: 'manager@company.com', // This would come from employee data
        status: 'pending'
      });
    }

    if (totalAmount > 1000) {
      workflow.push({
        approverRole: 'finance_director',
        approverEmail: 'finance@company.com',
        status: 'pending'
      });
    }

    return workflow;
  }

  /**
   * Determine overall expense status
   */
  private determineExpenseStatus(expenses: ProcessedExpense[], violations: PolicyViolation[], approvalRequired: boolean): ExpenseStatus {
    // Check if any expenses failed to process
    if (expenses.some(e => e.confidence === 0)) {
      return ExpenseStatus.REQUIRES_CLARIFICATION;
    }

    // Check for policy violations
    if (violations.some(v => v.severity === 'error')) {
      return ExpenseStatus.REQUIRES_CLARIFICATION;
    }

    // Check if approval is required
    if (approvalRequired) {
      return ExpenseStatus.SUBMITTED;
    }

    return ExpenseStatus.PROCESSING;
  }

  /**
   * Check if expense is reimbursable
   */
  private isExpenseReimbursable(category: ExpenseCategory, amount: number): boolean {
    // Business logic for determining reimbursability
    const nonReimbursableCategories = [ExpenseCategory.OTHER];
    
    if (nonReimbursableCategories.includes(category)) {
      return false;
    }

    // Check amount limits
    if (amount <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Generate expense description from extracted data
   */
  private generateExpenseDescription(extractedData: ExtractedReceiptData): string {
    const items = extractedData.items.slice(0, 3).map(item => item.description).join(', ');
    return `${extractedData.vendor} - ${items}${extractedData.items.length > 3 ? '...' : ''}`;
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring expense processor integration: ${integration.service}`);
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      ocrEngine: 'available',
      aiClassification: 'available',
      integrations: Array.from(this.integrations.keys())
    };
  }

  /**
   * Generate unique expense ID
   */
  private generateExpenseId(): string {
    return `exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}