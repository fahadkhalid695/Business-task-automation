import { ExpenseProcessor } from '../finance-hr-service/ExpenseProcessor';
import { 
  ExpenseProcessingRequest, 
  ExpenseCategory,
  ExpenseStatus
} from '../finance-hr-service/types/FinanceHRTypes';

// Mock the dependencies
jest.mock('../shared/utils/logger');
jest.mock('../ai-ml-engine/InferenceEngine');

describe('ExpenseProcessor', () => {
  let expenseProcessor: ExpenseProcessor;

  beforeEach(() => {
    expenseProcessor = new ExpenseProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExpenses', () => {
    it('should process single receipt successfully', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.processedExpenses).toHaveLength(1);
      expect(result.processedExpenses[0].id).toBeDefined();
      expect(result.processedExpenses[0].receiptId).toBe('receipt-1');
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
      expect(result.status).toBeDefined();
    });

    it('should process multiple receipts', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          },
          {
            id: 'receipt-2',
            imageUrl: 'https://example.com/receipt2.jpg',
            filename: 'receipt2.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.processedExpenses).toHaveLength(2);
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    });

    it('should validate expense policy', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date(),
        expensePolicy: {
          id: 'policy-1',
          name: 'Test Policy',
          rules: [
            {
              category: ExpenseCategory.MEALS,
              maxAmount: 25,
              requiresReceipt: true,
              requiresApproval: true,
              description: 'Meal limit'
            }
          ],
          approvalLimits: [
            {
              role: 'manager',
              maxAmount: 100,
              categories: [ExpenseCategory.MEALS]
            }
          ],
          isActive: true
        }
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.policyViolations).toBeDefined();
      expect(Array.isArray(result.policyViolations)).toBe(true);
    });

    it('should determine approval requirements', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date(),
            metadata: {
              amount: 1000, // High amount should require approval
              vendor: 'Test Vendor',
              category: ExpenseCategory.EQUIPMENT
            }
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.approvalRequired).toBe(true);
      expect(result.approvalWorkflow).toBeDefined();
    });

    it('should handle receipt processing errors gracefully', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'invalid-receipt',
            imageUrl: '', // Invalid URL
            filename: 'invalid.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.processedExpenses).toHaveLength(1);
      expect(result.processedExpenses[0].confidence).toBe(0);
      expect(result.status).toBe(ExpenseStatus.REQUIRES_CLARIFICATION);
    });

    it('should categorize expenses correctly', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date(),
            metadata: {
              vendor: 'Starbucks',
              amount: 15.50
            }
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await expenseProcessor.processExpenses(request);

      expect(result.processedExpenses[0].category).toBeDefined();
      expect(Object.values(ExpenseCategory)).toContain(result.processedExpenses[0].category);
    });
  });

  describe('configureIntegration', () => {
    it('should configure integration successfully', async () => {
      const integration = {
        service: 'quickbooks',
        credentials: { apiKey: 'test-key' },
        configuration: { syncInterval: 3600 }
      };

      await expect(expenseProcessor.configureIntegration('qb-001', integration))
        .resolves.not.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const status = await expenseProcessor.getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.ocrEngine).toBe('available');
      expect(status.aiClassification).toBe('available');
      expect(Array.isArray(status.integrations)).toBe(true);
    });
  });
});