import { FormProcessor } from '../administrative-service/FormProcessor';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';
import { FormProcessingRequest, FormType, FormAttachment } from '../administrative-service/types/AdministrativeTypes';

// Mock dependencies
jest.mock('../ai-ml-engine/InferenceEngine');
jest.mock('../shared/utils/logger');

describe('FormProcessor', () => {
  let formProcessor: FormProcessor;
  let mockInferenceEngine: jest.Mocked<InferenceEngine>;

  beforeEach(() => {
    jest.clearAllMocks();
    formProcessor = new FormProcessor();
    mockInferenceEngine = (formProcessor as any).inferenceEngine;
  });

  describe('Form Processing', () => {
    it('should process expense report successfully', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 500,
            category: 'Travel',
            date: '2024-01-15',
            description: 'Business trip to client site'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          validateData: true,
          autoApprove: false
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('processed');
      expect(result.validationErrors).toHaveLength(0);
      expect(result.approvalRequired).toBe(false); // Amount is under $1000
      expect(result.formId).toMatch(/^form-\d+-[a-z0-9]+$/);
      expect(result.nextSteps).toContain('Form has been processed successfully');
    });

    it('should require approval for high-value expense reports', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 1500,
            category: 'Equipment',
            date: '2024-01-15',
            description: 'New laptop purchase'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.approvalRequired).toBe(true);
      expect(result.nextSteps).toContain('Awaiting approval from designated approver');
    });

    it('should validate expense report fields', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: -100, // Invalid negative amount
            category: '', // Missing category
            date: '', // Missing date
            description: 'Invalid expense'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          validateData: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('rejected');
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors.some(e => e.field === 'amount')).toBe(true);
      expect(result.validationErrors.some(e => e.field === 'category')).toBe(true);
      expect(result.validationErrors.some(e => e.field === 'date')).toBe(true);
      expect(result.nextSteps).toContain('Fix validation errors and resubmit');
    });

    it('should process leave request successfully', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.LEAVE_REQUEST,
        data: {
          fields: {
            startDate: '2024-02-01',
            endDate: '2024-02-03',
            days: 3,
            reason: 'Personal vacation',
            type: 'vacation'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('processed');
      expect(result.approvalRequired).toBe(false); // 3 days is under 5-day threshold
      expect(result.nextSteps).toContain('Update your calendar once approved');
    });

    it('should require approval for extended leave requests', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.LEAVE_REQUEST,
        data: {
          fields: {
            startDate: '2024-02-01',
            endDate: '2024-02-10',
            days: 8,
            reason: 'Extended vacation',
            type: 'vacation'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.approvalRequired).toBe(true); // More than 5 days
    });

    it('should validate leave request dates', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.LEAVE_REQUEST,
        data: {
          fields: {
            startDate: '2024-02-10',
            endDate: '2024-02-05', // End date before start date
            reason: 'Vacation'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('rejected');
      expect(result.validationErrors.some(e => e.field === 'endDate')).toBe(true);
      expect(result.validationErrors.some(e => e.message.includes('End date must be after start date'))).toBe(true);
    });

    it('should process purchase order successfully', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.PURCHASE_ORDER,
        data: {
          fields: {
            vendor: 'Office Supplies Inc.',
            items: [
              { description: 'Printer paper', quantity: 10, unitPrice: 25 },
              { description: 'Pens', quantity: 50, unitPrice: 2 }
            ],
            total: 350,
            department: 'IT',
            requestedBy: 'manager@example.com'
          },
          submittedBy: 'manager@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('processed');
      expect(result.approvalRequired).toBe(false); // Under $500 threshold
    });

    it('should require approval for high-value purchase orders', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.PURCHASE_ORDER,
        data: {
          fields: {
            vendor: 'Tech Equipment Co.',
            items: [
              { description: 'Server', quantity: 1, unitPrice: 2000 }
            ],
            total: 2000,
            department: 'IT'
          },
          submittedBy: 'manager@example.com',
          submittedAt: new Date()
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.approvalRequired).toBe(true); // Over $500 threshold
    });
  });

  describe('Attachment Processing', () => {
    it('should extract data from PDF attachments', async () => {
      // Arrange
      const attachments: FormAttachment[] = [
        {
          id: 'att-1',
          filename: 'receipt.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        }
      ];

      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 100,
            category: 'Meals'
          },
          attachments,
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          extractFromAttachments: true
        }
      };

      // Mock AI response for PDF extraction
      mockInferenceEngine.generateText.mockResolvedValue({
        text: '{"amount": 125.50, "vendor": "Restaurant ABC", "date": "2024-01-15"}',
        usage: { totalTokens: 50 }
      });

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.extractedData.amount).toBe(125.50);
      expect(result.extractedData.vendor).toBe('Restaurant ABC');
      expect(attachments[0].extractedData).toBeDefined();
    });

    it('should handle image attachments with OCR simulation', async () => {
      // Arrange
      const attachments: FormAttachment[] = [
        {
          id: 'att-1',
          filename: 'receipt.jpg',
          mimeType: 'image/jpeg',
          size: 2048,
        }
      ];

      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 50,
            category: 'Office Supplies'
          },
          attachments,
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          extractFromAttachments: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.extractedData.ocrText).toContain('Simulated OCR text');
      expect(result.extractedData.confidence).toBe(0.85);
    });

    it('should handle attachment processing errors gracefully', async () => {
      // Arrange
      const attachments: FormAttachment[] = [
        {
          id: 'att-1',
          filename: 'corrupted.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        }
      ];

      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 100,
            category: 'Travel'
          },
          attachments,
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          extractFromAttachments: true
        }
      };

      // Mock AI failure
      mockInferenceEngine.generateText.mockRejectedValue(new Error('PDF processing failed'));

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.extractedData['corrupted.pdf_error']).toBe('PDF processing failed');
    });
  });

  describe('Auto-approval', () => {
    it('should auto-approve eligible forms', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 50,
            category: 'Office Supplies',
            date: '2024-01-15',
            description: 'Pens and paper'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          autoApprove: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.nextSteps[0]).toBe('Form automatically approved and processed');
    });

    it('should not auto-approve forms with errors', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: -50, // Invalid amount
            category: 'Office Supplies',
            date: '2024-01-15'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          autoApprove: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('rejected');
      expect(result.nextSteps).not.toContain('Form automatically approved and processed');
    });

    it('should not auto-approve forms requiring manual approval', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 1500, // High amount requiring approval
            category: 'Equipment',
            date: '2024-01-15',
            description: 'Laptop purchase'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          autoApprove: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.approvalRequired).toBe(true);
      expect(result.nextSteps).not.toContain('Form automatically approved and processed');
    });
  });

  describe('Notification System', () => {
    it('should notify approvers when requested', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 1200,
            category: 'Travel',
            date: '2024-01-15',
            description: 'Conference travel'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        },
        options: {
          notifyApprovers: true
        }
      };

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.approvalRequired).toBe(true);
      expect(result.nextSteps).toContain('Approvers have been notified');
    });
  });

  describe('Utility Functions', () => {
    it('should extract numeric values correctly', () => {
      // Act & Assert
      expect((formProcessor as any).getNumericValue(100)).toBe(100);
      expect((formProcessor as any).getNumericValue('$150.50')).toBe(150.50);
      expect((formProcessor as any).getNumericValue('1,234.56')).toBe(1234.56);
      expect((formProcessor as any).getNumericValue('invalid')).toBe(0);
      expect((formProcessor as any).getNumericValue(null)).toBe(0);
    });

    it('should generate unique form IDs', () => {
      // Act
      const id1 = (formProcessor as any).generateFormId();
      const id2 = (formProcessor as any).generateFormId();

      // Assert
      expect(id1).toMatch(/^form-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^form-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should determine approval requirements correctly', () => {
      // Act & Assert
      expect((formProcessor as any).requiresApproval(FormType.EXPENSE_REPORT, { amount: 500 })).toBe(false);
      expect((formProcessor as any).requiresApproval(FormType.EXPENSE_REPORT, { amount: 1500 })).toBe(true);
      expect((formProcessor as any).requiresApproval(FormType.LEAVE_REQUEST, { days: 3 })).toBe(false);
      expect((formProcessor as any).requiresApproval(FormType.LEAVE_REQUEST, { days: 8 })).toBe(true);
      expect((formProcessor as any).requiresApproval(FormType.PURCHASE_ORDER, { total: 300 })).toBe(false);
      expect((formProcessor as any).requiresApproval(FormType.PURCHASE_ORDER, { total: 800 })).toBe(true);
    });
  });

  describe('Integration and Health', () => {
    it('should configure integrations', async () => {
      // Arrange
      const integration = {
        service: 'gmail' as const,
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      // Act
      await formProcessor.configureIntegration('integration-1', integration);

      // Assert
      const integrations = (formProcessor as any).integrations;
      expect(integrations.has('integration-1')).toBe(true);
    });

    it('should return health status', async () => {
      // Act
      const status = await formProcessor.getHealthStatus();

      // Assert
      expect(status.status).toBe('healthy');
      expect(status.validators).toBeGreaterThan(0);
      expect(status.supportedFormTypes).toContain(FormType.EXPENSE_REPORT);
      expect(status.supportedFormTypes).toContain(FormType.LEAVE_REQUEST);
      expect(status.supportedFormTypes).toContain(FormType.PURCHASE_ORDER);
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 100,
            category: 'Travel'
          },
          submittedBy: 'employee@example.com',
          submittedAt: new Date()
        }
      };

      // Mock validation to throw error
      const originalValidate = (formProcessor as any).formValidators.get(FormType.EXPENSE_REPORT).validate;
      (formProcessor as any).formValidators.get(FormType.EXPENSE_REPORT).validate = jest.fn().mockRejectedValue(new Error('Validation service down'));

      // Act
      const result = await formProcessor.processForm(request);

      // Assert
      expect(result.status).toBe('rejected');
      expect(result.validationErrors[0].field).toBe('system');
      expect(result.validationErrors[0].message).toContain('Processing failed');
      expect(result.nextSteps).toContain('Manual review required due to processing error');

      // Restore original function
      (formProcessor as any).formValidators.get(FormType.EXPENSE_REPORT).validate = originalValidate;
    });
  });
});