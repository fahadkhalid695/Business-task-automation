import { complianceService, ComplianceService, ComplianceFramework, DataRetentionPolicy } from '../../shared/security/ComplianceService';
import { UserDocument } from '../../shared/models/User';
import { UserRole, Permission } from '../../shared/types';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let mockUser: UserDocument;

  beforeEach(() => {
    service = new ComplianceService();
    
    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      role: UserRole.USER,
      permissions: [Permission.READ_PERSONAL_DATA],
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          sms: false
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as UserDocument;
  });

  describe('checkCompliance', () => {
    it('should pass compliance for valid operations', async () => {
      const result = await service.checkCompliance(
        'task_data',
        'READ',
        mockUser,
        { encrypted: false }
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect encryption requirement violations', async () => {
      const result = await service.checkCompliance(
        'personal_data',
        'CREATE',
        mockUser,
        { encrypted: false }
      );

      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => 
        v.description.includes('Encryption required')
      )).toBe(true);
    });

    it('should detect access control violations', async () => {
      const userWithoutPermission = {
        ...mockUser,
        permissions: []
      };

      const result = await service.checkCompliance(
        'personal_data',
        'READ',
        userWithoutPermission,
        { encrypted: true }
      );

      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => 
        v.description.includes('Insufficient access controls')
      )).toBe(true);
    });

    it('should provide compliance requirements', async () => {
      const result = await service.checkCompliance(
        'personal_data',
        'CREATE',
        mockUser,
        { encrypted: true }
      );

      expect(result.requirements).toContain('Data must be encrypted');
      expect(result.requirements).toContain('Operation must be audited');
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate GDPR compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await service.generateComplianceReport(
        ComplianceFramework.GDPR,
        startDate,
        endDate
      );

      expect(report.framework).toBe(ComplianceFramework.GDPR);
      expect(report.reportPeriod.startDate).toEqual(startDate);
      expect(report.reportPeriod.endDate).toEqual(endDate);
      expect(report.summary).toBeDefined();
      expect(report.summary.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.complianceScore).toBeLessThanOrEqual(100);
      expect(report.violations).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.dataInventory).toBeDefined();
    });

    it('should generate HIPAA compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await service.generateComplianceReport(
        ComplianceFramework.HIPAA,
        startDate,
        endDate
      );

      expect(report.framework).toBe(ComplianceFramework.HIPAA);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should calculate compliance score correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await service.generateComplianceReport(
        ComplianceFramework.GDPR,
        startDate,
        endDate
      );

      expect(typeof report.summary.complianceScore).toBe('number');
      expect(report.summary.totalChecks).toBeGreaterThanOrEqual(0);
      expect(report.summary.passedChecks).toBeGreaterThanOrEqual(0);
      expect(report.summary.failedChecks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('handleDataSubjectRequest', () => {
    it('should handle data access requests', async () => {
      const result = await service.handleDataSubjectRequest(
        'ACCESS',
        'subject123',
        mockUser
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('exported successfully');
      expect(result.data).toBeDefined();
    });

    it('should handle data erasure requests', async () => {
      const result = await service.handleDataSubjectRequest(
        'ERASURE',
        'subject123',
        mockUser
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('erasure request processed');
    });

    it('should handle data portability requests', async () => {
      const result = await service.handleDataSubjectRequest(
        'PORTABILITY',
        'subject123',
        mockUser
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('portability request processed');
      expect(result.data).toBeDefined();
    });

    it('should handle unsupported request types', async () => {
      const result = await service.handleDataSubjectRequest(
        'RECTIFICATION',
        'subject123',
        mockUser
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not yet implemented');
    });
  });

  describe('anonymizeData', () => {
    it('should anonymize PII fields', async () => {
      const data = {
        id: '123',
        email: 'john@example.com',
        phone: '555-1234',
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St',
        nonPiiField: 'keep this'
      };

      const anonymized = await service.anonymizeData(data, 'ANONYMIZE');

      expect(anonymized.email).toBe('***@***.***');
      expect(anonymized.phone).toBe('***-***-****');
      expect(anonymized.firstName).toBe('***');
      expect(anonymized.lastName).toBe('***');
      expect(anonymized.address).toBe('***');
      expect(anonymized.nonPiiField).toBe('keep this');
      expect(anonymized.id).toBe('123');
    });

    it('should pseudonymize PII fields', async () => {
      const data = {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const pseudonymized = await service.anonymizeData(data, 'PSEUDONYMIZE');

      expect(pseudonymized.email).not.toBe('john@example.com');
      expect(pseudonymized.firstName).not.toBe('John');
      expect(pseudonymized.lastName).not.toBe('Doe');
      expect(pseudonymized.email.length).toBe(8); // Hash substring
    });

    it('should preserve non-PII fields', async () => {
      const data = {
        id: '123',
        status: 'active',
        createdAt: '2024-01-01',
        email: 'john@example.com'
      };

      const anonymized = await service.anonymizeData(data);

      expect(anonymized.id).toBe('123');
      expect(anonymized.status).toBe('active');
      expect(anonymized.createdAt).toBe('2024-01-01');
      expect(anonymized.email).toBe('***@***.***');
    });
  });

  describe('scheduleDataRetention', () => {
    it('should schedule data retention cleanup', async () => {
      await expect(service.scheduleDataRetention()).resolves.not.toThrow();
    });
  });

  describe('compliance frameworks', () => {
    it('should support GDPR framework', async () => {
      const result = await service.checkCompliance(
        'personal_data',
        'READ',
        mockUser
      );

      expect(result).toBeDefined();
    });

    it('should support HIPAA framework', async () => {
      const result = await service.checkCompliance(
        'health_data',
        'READ',
        mockUser
      );

      expect(result).toBeDefined();
    });

    it('should support SOX framework', async () => {
      const result = await service.checkCompliance(
        'financial_data',
        'UPDATE',
        mockUser
      );

      expect(result).toBeDefined();
    });
  });

  describe('data retention policies', () => {
    it('should handle short-term retention', () => {
      expect(DataRetentionPolicy.SHORT_TERM).toBe(30);
    });

    it('should handle medium-term retention', () => {
      expect(DataRetentionPolicy.MEDIUM_TERM).toBe(365);
    });

    it('should handle long-term retention', () => {
      expect(DataRetentionPolicy.LONG_TERM).toBe(2555);
    });

    it('should handle permanent retention', () => {
      expect(DataRetentionPolicy.PERMANENT).toBe(-1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid data types gracefully', async () => {
      const result = await service.checkCompliance(
        'invalid_data_type',
        'READ',
        mockUser
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle compliance check errors', async () => {
      // Test with null user
      await expect(
        service.checkCompliance('personal_data', 'READ', null as any)
      ).rejects.toThrow();
    });
  });
});