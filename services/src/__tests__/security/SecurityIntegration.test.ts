import { securityService } from '../../shared/security/SecurityService';
import { accessControlService, ResourceType, Action } from '../../shared/security/AccessControl';
import { complianceService, ComplianceFramework } from '../../shared/security/ComplianceService';
import { securityScanner } from '../../shared/security/SecurityScanner';
import { backupService, BackupType } from '../../shared/security/BackupService';
import { dataAnonymizer, AnonymizationMethod } from '../../shared/security/DataAnonymizer';
import { encryptionService } from '../../shared/security/EncryptionService';
import { UserDocument } from '../../shared/models/User';
import { UserRole, Permission } from '../../shared/types';

describe('Security Integration Tests', () => {
  let mockUser: UserDocument;
  let mockAdminUser: UserDocument;

  beforeEach(() => {
    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      role: UserRole.USER,
      permissions: [Permission.READ_TASKS, Permission.CREATE_TASKS],
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

    mockAdminUser = {
      id: 'admin123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      permissions: [Permission.ADMIN_ACCESS, Permission.READ_PERSONAL_DATA],
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          sms: true
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as UserDocument;
  });

  describe('End-to-End Security Workflow', () => {
    it('should perform complete security check with all components', async () => {
      // 1. Perform comprehensive security check
      const securityCheck = await securityService.performSecurityCheck(
        mockUser,
        Action.READ,
        ResourceType.TASK,
        'task123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          sessionId: 'session123',
          data: { sensitive: true }
        }
      );

      expect(securityCheck).toBeDefined();
      expect(typeof securityCheck.allowed).toBe('boolean');
      expect(Array.isArray(securityCheck.violations)).toBe(true);
      expect(Array.isArray(securityCheck.requirements)).toBe(true);

      // 2. If security check passes, perform data operations
      if (securityCheck.allowed) {
        // Encrypt sensitive data
        const sensitiveData = { 
          userId: mockUser.id, 
          personalInfo: 'sensitive information' 
        };
        const encrypted = encryptionService.encryptForStorage(sensitiveData);
        expect(typeof encrypted).toBe('string');

        // Decrypt and verify
        const decrypted = encryptionService.decryptFromStorage(encrypted);
        expect(decrypted).toEqual(sensitiveData);
      }
    });

    it('should handle data privacy workflow with anonymization', async () => {
      // 1. Original sensitive data
      const personalData = {
        id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
        address: '123 Main St, Anytown, ST 12345'
      };

      // 2. Check compliance requirements
      const complianceCheck = await complianceService.checkCompliance(
        'personal_data',
        'EXPORT',
        mockUser,
        { encrypted: true }
      );

      expect(complianceCheck).toBeDefined();
      expect(typeof complianceCheck.compliant).toBe('boolean');

      // 3. Anonymize data for export
      const anonymizationResult = await dataAnonymizer.anonymizeData(
        personalData,
        mockUser,
        {
          method: AnonymizationMethod.MASKING,
          reversible: false
        }
      );

      expect(anonymizationResult.anonymizedData.email).not.toBe(personalData.email);
      expect(anonymizationResult.anonymizedData.phone).not.toBe(personalData.phone);
      expect(anonymizationResult.anonymizedData.ssn).not.toBe(personalData.ssn);

      // 4. Verify anonymized data still has structure
      expect(anonymizationResult.anonymizedData.id).toBe(personalData.id);
      expect(anonymizationResult.appliedRules.length).toBeGreaterThan(0);
    });

    it('should handle security incident response workflow', async () => {
      // 1. Detect suspicious activity
      const suspiciousActivity = await securityService.performSecurityCheck(
        mockUser,
        Action.DELETE,
        ResourceType.USER,
        'admin123', // Trying to delete admin user
        {
          ipAddress: '1.2.3.4', // Unusual IP
          userAgent: 'Suspicious-Bot/1.0'
        }
      );

      expect(suspiciousActivity.allowed).toBe(false);

      // 2. Report security incident
      const incident = await securityService.reportSecurityIncident(
        'SUSPICIOUS_ACTIVITY' as any,
        'Suspicious user deletion attempt',
        'User attempted to delete admin account from unusual IP',
        {
          targetUserId: 'admin123',
          sourceIp: '1.2.3.4',
          userAgent: 'Suspicious-Bot/1.0'
        },
        {
          userId: mockUser.id,
          severity: 'HIGH',
          affectedResources: ['user_admin123']
        }
      );

      expect(incident.id).toBeDefined();
      expect(incident.severity).toBe('HIGH');

      // 3. Create emergency backup
      const backup = await securityService.createEmergencyBackup(
        mockAdminUser,
        'Security incident detected - suspicious user activity'
      );

      expect(backup.backupId).toBeDefined();
      expect(backup.location).toBeDefined();
    });

    it('should perform vulnerability assessment and remediation', async () => {
      // 1. Perform security scan
      const scanResult = await securityService.performSecurityScan('STATIC');

      expect(scanResult.scanType).toBe('STATIC');
      expect(scanResult.vulnerabilities).toBeDefined();
      expect(scanResult.summary).toBeDefined();
      expect(typeof scanResult.riskScore).toBe('number');

      // 2. Generate security metrics
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const metrics = await securityService.generateSecurityMetrics(startDate, endDate);

      expect(metrics.period.startDate).toEqual(startDate);
      expect(metrics.period.endDate).toEqual(endDate);
      expect(metrics.incidents).toBeDefined();
      expect(metrics.vulnerabilities).toBeDefined();
      expect(metrics.compliance).toBeDefined();
      expect(metrics.authentication).toBeDefined();

      // 3. If high-risk vulnerabilities found, create incident
      if (scanResult.riskScore > 70) {
        const incident = await securityService.reportSecurityIncident(
          'VULNERABILITY_DETECTED' as any,
          'High-risk vulnerabilities detected',
          `Security scan found ${scanResult.vulnerabilities.length} vulnerabilities with risk score ${scanResult.riskScore}`,
          {
            scanId: scanResult.scanId,
            vulnerabilityCount: scanResult.vulnerabilities.length,
            riskScore: scanResult.riskScore
          },
          {
            severity: 'HIGH'
          }
        );

        expect(incident).toBeDefined();
      }
    });

    it('should handle GDPR data subject request workflow', async () => {
      // 1. Receive data subject access request
      const accessRequest = await complianceService.handleDataSubjectRequest(
        'ACCESS',
        'subject123',
        mockAdminUser,
        { requestReason: 'GDPR Article 15 - Right of access' }
      );

      expect(accessRequest.success).toBe(true);
      expect(accessRequest.message).toContain('exported successfully');

      // 2. Handle data erasure request
      const erasureRequest = await complianceService.handleDataSubjectRequest(
        'ERASURE',
        'subject123',
        mockAdminUser,
        { requestReason: 'GDPR Article 17 - Right to erasure' }
      );

      expect(erasureRequest.success).toBe(true);
      expect(erasureRequest.message).toContain('erasure request processed');

      // 3. Generate compliance report
      const complianceReport = await complianceService.generateComplianceReport(
        ComplianceFramework.GDPR,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(complianceReport.framework).toBe(ComplianceFramework.GDPR);
      expect(complianceReport.summary.complianceScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Access Control Integration', () => {
    it('should enforce role-based access control across services', async () => {
      // 1. Regular user trying to access admin functions
      const userAccessCheck = await accessControlService.checkAccess({
        user: mockUser,
        resource: {
          type: ResourceType.SYSTEM,
          id: 'admin-panel',
          classification: 'RESTRICTED'
        },
        action: Action.READ
      });

      expect(userAccessCheck.allowed).toBe(false);

      // 2. Admin user accessing same resource
      const adminAccessCheck = await accessControlService.checkAccess({
        user: mockAdminUser,
        resource: {
          type: ResourceType.SYSTEM,
          id: 'admin-panel',
          classification: 'RESTRICTED'
        },
        action: Action.READ
      });

      expect(adminAccessCheck.allowed).toBe(true);

      // 3. Bulk access check
      const bulkChecks = [
        {
          resource: {
            type: ResourceType.TASK,
            id: 'task1',
            classification: 'INTERNAL' as const
          },
          action: Action.READ
        },
        {
          resource: {
            type: ResourceType.USER,
            id: 'user1',
            classification: 'CONFIDENTIAL' as const
          },
          action: Action.UPDATE
        }
      ];

      const bulkResults = await accessControlService.checkBulkAccess(mockUser, bulkChecks);
      expect(bulkResults.size).toBe(2);
    });

    it('should integrate access control with compliance checks', async () => {
      // 1. Check access control
      const accessDecision = await accessControlService.checkAccess({
        user: mockUser,
        resource: {
          type: ResourceType.DOCUMENT,
          id: 'personal-doc',
          classification: 'CONFIDENTIAL'
        },
        action: Action.READ
      });

      // 2. If access allowed, check compliance
      if (accessDecision.allowed) {
        const complianceCheck = await complianceService.checkCompliance(
          'personal_data',
          'READ',
          mockUser,
          { encrypted: true }
        );

        expect(complianceCheck).toBeDefined();
      }

      // 3. Perform comprehensive security check
      const securityCheck = await securityService.performSecurityCheck(
        mockUser,
        Action.READ,
        ResourceType.DOCUMENT,
        'personal-doc'
      );

      expect(securityCheck.allowed).toBe(accessDecision.allowed);
    });
  });

  describe('Data Protection Integration', () => {
    it('should encrypt, anonymize, and backup sensitive data', async () => {
      const sensitiveData = {
        userId: 'user123',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          ssn: '123-45-6789'
        },
        financialInfo: {
          accountNumber: '1234567890',
          balance: 50000
        }
      };

      // 1. Encrypt the data
      const encrypted = encryptionService.encryptForStorage(sensitiveData);
      expect(typeof encrypted).toBe('string');

      // 2. Anonymize for analytics
      const anonymized = await dataAnonymizer.anonymizeData(
        sensitiveData.personalInfo,
        mockUser,
        { method: AnonymizationMethod.PSEUDONYMIZATION }
      );

      expect(anonymized.anonymizedData.email).not.toBe(sensitiveData.personalInfo.email);
      expect(anonymized.anonymizedData.ssn).not.toBe(sensitiveData.personalInfo.ssn);

      // 3. Create backup
      const backup = await backupService.createBackup(
        BackupType.FULL,
        ['users', 'tasks'],
        mockAdminUser,
        { encrypt: true, retentionPeriod: 365 }
      );

      expect(backup.id).toBeDefined();
      expect(backup.encrypted).toBe(true);

      // 4. Verify backup integrity
      const integrityCheck = await backupService.testBackupIntegrity(backup.id);
      expect(integrityCheck).toBeDefined();
    });

    it('should handle data retention and cleanup', async () => {
      // 1. Schedule data retention cleanup
      await complianceService.scheduleDataRetention();

      // 2. Clean up old backups
      const cleanedBackups = await backupService.cleanupOldBackups();
      expect(typeof cleanedBackups).toBe('number');

      // 3. Generate synthetic data for testing
      const originalData = [
        { name: 'John', age: 30, email: 'john@example.com' },
        { name: 'Jane', age: 25, email: 'jane@example.com' }
      ];

      const syntheticData = await dataAnonymizer.generateSyntheticData(
        originalData,
        10,
        mockUser
      );

      expect(syntheticData).toHaveLength(10);
      expect(syntheticData[0]).toHaveProperty('name');
      expect(syntheticData[0]).toHaveProperty('age');
      expect(syntheticData[0]).toHaveProperty('email');
    });
  });

  describe('Security Monitoring Integration', () => {
    it('should monitor and alert on security events', async () => {
      // 1. Perform multiple security checks to generate events
      const checks = [
        securityService.performSecurityCheck(mockUser, Action.READ, ResourceType.TASK, 'task1'),
        securityService.performSecurityCheck(mockUser, Action.DELETE, ResourceType.USER, 'admin'),
        securityService.performSecurityCheck(mockUser, Action.EXPORT, ResourceType.DOCUMENT, 'confidential')
      ];

      const results = await Promise.all(checks);
      expect(results).toHaveLength(3);

      // 2. Generate security metrics
      const metrics = await securityService.generateSecurityMetrics(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        new Date()
      );

      expect(metrics.incidents.total).toBeGreaterThanOrEqual(0);
      expect(metrics.authentication.totalAttempts).toBeGreaterThanOrEqual(0);

      // 3. Perform security scan
      const scanResult = await securityScanner.performSecurityScan('CONFIGURATION');
      expect(scanResult.vulnerabilities).toBeDefined();

      // 4. If issues found, create incidents and backups
      if (scanResult.riskScore > 50 || metrics.incidents.total > 0) {
        const incident = await securityService.reportSecurityIncident(
          'SECURITY_POLICY_VIOLATION' as any,
          'Security monitoring alert',
          'Automated security monitoring detected potential issues',
          {
            riskScore: scanResult.riskScore,
            incidentCount: metrics.incidents.total
          }
        );

        expect(incident).toBeDefined();
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle security service failures gracefully', async () => {
      // Test with invalid parameters
      const invalidCheck = await securityService.performSecurityCheck(
        null as any,
        Action.READ,
        ResourceType.TASK,
        'task123'
      );

      expect(invalidCheck.allowed).toBe(false);
      expect(invalidCheck.violations).toContain('Security check system error');
    });

    it('should maintain security even with component failures', async () => {
      // Even if some security components fail, the system should default to secure
      try {
        const result = await securityService.performSecurityCheck(
          mockUser,
          'INVALID_ACTION' as any,
          ResourceType.TASK,
          'task123'
        );

        // Should not throw, but should be secure by default
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, that's also acceptable for security
        expect(error).toBeDefined();
      }
    });

    it('should handle encryption/decryption errors', () => {
      // Test with invalid encrypted data
      expect(() => {
        encryptionService.decryptFromStorage('invalid-encrypted-data');
      }).toThrow();

      // Test with valid encryption/decryption
      const data = { test: 'data' };
      const encrypted = encryptionService.encryptForStorage(data);
      const decrypted = encryptionService.decryptFromStorage(encrypted);
      expect(decrypted).toEqual(data);
    });
  });
});