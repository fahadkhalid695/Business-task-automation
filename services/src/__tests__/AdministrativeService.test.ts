import { AdministrativeService } from '../administrative-service/AdministrativeService';
import { EmailProcessor } from '../administrative-service/EmailProcessor';
import { CalendarManager } from '../administrative-service/CalendarManager';
import { DocumentGenerator } from '../administrative-service/DocumentGenerator';
import { FormProcessor } from '../administrative-service/FormProcessor';
import {
  EmailProcessingRequest,
  CalendarRequest,
  DocumentGenerationRequest,
  FormProcessingRequest,
  DocumentType,
  FormType,
  ExternalIntegration
} from '../administrative-service/types/AdministrativeTypes';
import { EmailMessage, EmailCategory, Priority, CalendarEvent, EventStatus } from '../shared/types';

// Mock the dependencies
jest.mock('../administrative-service/EmailProcessor');
jest.mock('../administrative-service/CalendarManager');
jest.mock('../administrative-service/DocumentGenerator');
jest.mock('../administrative-service/FormProcessor');
jest.mock('../shared/utils/logger');

describe('AdministrativeService', () => {
  let administrativeService: AdministrativeService;
  let mockEmailProcessor: jest.Mocked<EmailProcessor>;
  let mockCalendarManager: jest.Mocked<CalendarManager>;
  let mockDocumentGenerator: jest.Mocked<DocumentGenerator>;
  let mockFormProcessor: jest.Mocked<FormProcessor>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    administrativeService = new AdministrativeService();

    // Get mocked instances
    mockEmailProcessor = (administrativeService as any).emailProcessor;
    mockCalendarManager = (administrativeService as any).calendarManager;
    mockDocumentGenerator = (administrativeService as any).documentGenerator;
    mockFormProcessor = (administrativeService as any).formProcessor;
  });

  describe('Email Processing', () => {
    it('should process emails successfully', async () => {
      // Arrange
      const mockEmails: EmailMessage[] = [
        {
          id: 'email-1',
          from: 'test@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Email',
          body: 'This is a test email',
          priority: Priority.MEDIUM,
          category: EmailCategory.WORK,
          actionItems: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const request: EmailProcessingRequest = {
        emails: mockEmails,
        options: {
          categorize: true,
          analyzeSentiment: true,
          extractActionItems: true
        }
      };

      const mockResult = {
        processedEmails: mockEmails.map(email => ({
          ...email,
          confidence: 0.9,
          processingNotes: ['Categorized as WORK'],
          suggestedActions: ['Respond within 24 hours']
        })),
        summary: {
          totalEmails: 1,
          categoryCounts: { [EmailCategory.WORK]: 1 } as any,
          priorityCounts: { [Priority.MEDIUM]: 1 } as any,
          averageSentiment: 0.5,
          urgentCount: 0
        },
        actionItems: []
      };

      mockEmailProcessor.processEmails.mockResolvedValue(mockResult);

      // Act
      const result = await administrativeService.processEmails(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockEmailProcessor.processEmails).toHaveBeenCalledWith(request);
      expect(result.metadata?.requestId).toBeDefined();
      expect(result.metadata?.processingTime).toBeDefined();
    });

    it('should handle email processing errors', async () => {
      // Arrange
      const request: EmailProcessingRequest = {
        emails: [],
        options: {}
      };

      const error = new Error('Email processing failed');
      mockEmailProcessor.processEmails.mockRejectedValue(error);

      // Act
      const result = await administrativeService.processEmails(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_PROCESSING_ERROR');
      expect(result.error?.message).toBe('Email processing failed');
    });
  });

  describe('Calendar Management', () => {
    it('should schedule events successfully', async () => {
      // Arrange
      const mockEvent: Partial<CalendarEvent> = {
        title: 'Test Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        attendees: [
          { email: 'attendee@example.com', name: 'Attendee', status: 'pending' as any, isOptional: false }
        ]
      };

      const request: CalendarRequest = {
        type: 'schedule',
        event: mockEvent,
        constraints: {
          duration: 60,
          attendees: ['attendee@example.com'],
          preferredTimes: [
            {
              start: new Date('2024-01-15T10:00:00Z'),
              end: new Date('2024-01-15T11:00:00Z')
            }
          ]
        }
      };

      const mockResponse = {
        success: true,
        event: { ...mockEvent, id: 'event-1', status: EventStatus.CONFIRMED } as CalendarEvent,
        message: 'Event scheduled successfully'
      };

      mockCalendarManager.processRequest.mockResolvedValue(mockResponse);

      // Act
      const result = await administrativeService.manageCalendar(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockCalendarManager.processRequest).toHaveBeenCalledWith(request);
    });

    it('should handle calendar conflicts', async () => {
      // Arrange
      const request: CalendarRequest = {
        type: 'find_conflicts',
        event: {
          title: 'Test Meeting',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z')
        }
      };

      const mockResponse = {
        success: true,
        conflicts: [
          {
            conflictingEventId: 'event-2',
            conflictingEventTitle: 'Existing Meeting',
            conflictType: 'overlap' as const,
            severity: 'high' as const,
            resolution: 'Reschedule one of the events'
          }
        ],
        message: 'Found 1 conflict(s)'
      };

      mockCalendarManager.processRequest.mockResolvedValue(mockResponse);

      // Act
      const result = await administrativeService.manageCalendar(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.conflicts).toHaveLength(1);
      expect(result.data?.conflicts?.[0].conflictType).toBe('overlap');
    });
  });

  describe('Document Generation', () => {
    it('should generate documents successfully', async () => {
      // Arrange
      const request: DocumentGenerationRequest = {
        type: DocumentType.REPORT,
        data: {
          title: 'Test Report',
          variables: {
            author: 'Test Author',
            department: 'IT'
          },
          metadata: {
            author: 'Test Author',
            department: 'IT',
            version: '1.0.0',
            tags: ['test'],
            confidentiality: 'internal'
          }
        },
        options: {
          format: 'pdf',
          includeHeader: true
        }
      };

      const mockResult = {
        document: {
          id: 'doc-1',
          type: DocumentType.REPORT,
          title: 'Test Report',
          content: '# Test Report\n\nReport content here',
          metadata: request.data.metadata,
          tags: ['test'],
          createdBy: 'Test Author',
          createdAt: new Date(),
          updatedAt: new Date()
        } as any,
        downloadUrl: '/api/documents/doc-1/download',
        previewUrl: '/api/documents/doc-1/preview',
        metadata: {
          wordCount: 50,
          pageCount: 1,
          generationTime: 1500,
          templateUsed: 'Business Report',
          quality: 'draft' as const
        }
      };

      mockDocumentGenerator.generateDocument.mockResolvedValue(mockResult);

      // Act
      const result = await administrativeService.generateDocument(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockDocumentGenerator.generateDocument).toHaveBeenCalledWith(request);
    });

    it('should handle document generation errors', async () => {
      // Arrange
      const request: DocumentGenerationRequest = {
        type: DocumentType.REPORT,
        data: {
          title: 'Test Report'
        }
      };

      const error = new Error('Template not found');
      mockDocumentGenerator.generateDocument.mockRejectedValue(error);

      // Act
      const result = await administrativeService.generateDocument(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DOCUMENT_GENERATION_ERROR');
      expect(result.error?.message).toBe('Template not found');
    });
  });

  describe('Form Processing', () => {
    it('should process forms successfully', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: 500,
            category: 'Travel',
            date: '2024-01-15',
            description: 'Business trip expenses'
          },
          submittedBy: 'user@example.com',
          submittedAt: new Date()
        },
        options: {
          validateData: true,
          autoApprove: false
        }
      };

      const mockResult = {
        formId: 'form-1',
        status: 'processed' as const,
        extractedData: request.data.fields,
        validationErrors: [],
        nextSteps: ['Form has been processed successfully'],
        approvalRequired: false
      };

      mockFormProcessor.processForm.mockResolvedValue(mockResult);

      // Act
      const result = await administrativeService.processForm(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockFormProcessor.processForm).toHaveBeenCalledWith(request);
    });

    it('should handle form validation errors', async () => {
      // Arrange
      const request: FormProcessingRequest = {
        formType: FormType.EXPENSE_REPORT,
        data: {
          fields: {
            amount: -100, // Invalid amount
            category: '',  // Missing category
            date: '2024-01-15'
          },
          submittedBy: 'user@example.com',
          submittedAt: new Date()
        }
      };

      const mockResult = {
        formId: 'form-2',
        status: 'rejected' as const,
        extractedData: request.data.fields,
        validationErrors: [
          {
            field: 'amount',
            message: 'Amount must be greater than 0',
            severity: 'error' as const
          },
          {
            field: 'category',
            message: 'Category is required',
            severity: 'error' as const
          }
        ],
        nextSteps: ['Fix validation errors and resubmit'],
        approvalRequired: true
      };

      mockFormProcessor.processForm.mockResolvedValue(mockResult);

      // Act
      const result = await administrativeService.processForm(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('rejected');
      expect(result.data?.validationErrors).toHaveLength(2);
    });
  });

  describe('Integration Management', () => {
    it('should add integrations successfully', async () => {
      // Arrange
      const integration: ExternalIntegration = {
        service: 'gmail',
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      mockEmailProcessor.configureIntegration = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await administrativeService.addIntegration('gmail-1', integration);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmailProcessor.configureIntegration).toHaveBeenCalledWith('gmail-1', integration);
    });

    it('should remove integrations successfully', async () => {
      // Arrange
      const integration: ExternalIntegration = {
        service: 'gmail',
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      // First add the integration
      await administrativeService.addIntegration('gmail-1', integration);

      // Act
      const result = await administrativeService.removeIntegration('gmail-1');

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle removing non-existent integration', async () => {
      // Act
      const result = await administrativeService.removeIntegration('non-existent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Integration non-existent not found');
    });
  });

  describe('Health Status', () => {
    it('should return health status successfully', async () => {
      // Arrange
      mockEmailProcessor.getHealthStatus.mockResolvedValue({ status: 'healthy' });
      mockCalendarManager.getHealthStatus.mockResolvedValue({ status: 'healthy' });
      mockDocumentGenerator.getHealthStatus.mockResolvedValue({ status: 'healthy' });
      mockFormProcessor.getHealthStatus.mockResolvedValue({ status: 'healthy' });

      // Act
      const result = await administrativeService.getHealthStatus();

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.service).toBe('AdministrativeService');
      expect(result.data?.status).toBe('healthy');
      expect(result.data?.components).toBeDefined();
      expect(result.data?.uptime).toBeDefined();
    });

    it('should handle health check errors', async () => {
      // Arrange
      mockEmailProcessor.getHealthStatus.mockRejectedValue(new Error('Health check failed'));

      // Act
      const result = await administrativeService.getHealthStatus();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HEALTH_CHECK_ERROR');
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      // Act
      const id1 = (administrativeService as any).generateRequestId();
      const id2 = (administrativeService as any).generateRequestId();

      // Assert
      expect(id1).toMatch(/^admin-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^admin-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Integration Validation', () => {
    it('should validate integration configuration', async () => {
      // Arrange
      const validIntegration: ExternalIntegration = {
        service: 'gmail',
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      // Act & Assert - should not throw
      await expect(
        (administrativeService as any).validateIntegration(validIntegration)
      ).resolves.not.toThrow();
    });

    it('should reject invalid integration configuration', async () => {
      // Arrange
      const invalidIntegration = {
        service: '',
        credentials: null
      } as any;

      // Act & Assert
      await expect(
        (administrativeService as any).validateIntegration(invalidIntegration)
      ).rejects.toThrow('Invalid integration configuration');
    });

    it('should reject unsupported integration service', async () => {
      // Arrange
      const unsupportedIntegration: ExternalIntegration = {
        service: 'unsupported' as any,
        credentials: { apiKey: 'test-key' },
        config: {
          syncInterval: 300,
          autoSync: true,
          filters: [],
          fieldMappings: {}
        }
      };

      // Act & Assert
      await expect(
        (administrativeService as any).validateIntegration(unsupportedIntegration)
      ).rejects.toThrow('Unsupported integration service: unsupported');
    });
  });
});