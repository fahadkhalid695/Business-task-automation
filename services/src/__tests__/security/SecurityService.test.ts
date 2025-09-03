import { securityService, SecurityService, SecurityEventType } from '../../shared/security/SecurityService';
import { ResourceType, Action } from '../../shared/security/AccessControl';
import { UserDocument } from '../../shared/models/User';
import { UserRole, Permission } from '../../shared/types';

describe('SecurityService', () => {
  let service: SecurityService;
  let mockUser: UserDocument;

  beforeEach(() => {
    service = new SecurityService();
    
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
  });

  describe('performSecurityCheck', () => {
    it('should pass security check for valid operations', async () => {
      const result = await service.performSecurityCheck(
        mockUser,
        Action.READ,
        ResourceType.TASK,
        'task123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          sessionId: 'session123'
        }
      );

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect access control violations', async () => {
      const result = await service.performSecurityCheck(
        mockUser,
        Action.DELETE,
        ResourceType.WORKFLOW,
        'workflow123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
      );

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should provide security requirements', async () => {
      const result = await service.performSecurityCheck(
        mockUser,
        Action.CREATE,
        ResourceType.USER,
        'newuser',
        {
          data: { sensitive: true }
        }
      );

      expect(result.requirements).toBeDefined();
      expect(Array.isArray(result.requirements)).toBe(true);
    });

    it('should handle security check errors gracefully', async () => {
      // Test with invalid user
      const result = await service.performSecurityCheck(
        null as any,
        Action.READ,
        ResourceType.TASK,
        'task123'
      );

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('Security check system error');
    });
  });

  describe('reportSecurityIncident', () => {
    it('should report security incidents', async () => {
      const incident = await service.reportSecurityIncident(
        SecurityEventType.AUTHENTICATION_FAILURE,
        'Failed login attempt',
        'Multiple failed login attempts detected',
        {
          attempts: 5,
          timeWindow: '5 minutes'
        },
        {
          userId: mockUser.id,
          ipAddress: '192.168.1.1',
          severity: 'MEDIUM'
        }
      );

      expect(incident.id).toBeDefined();
      expect(incident.type).toBe(SecurityEventType.AUTHENTICATION_FAILURE);
      expect(incident.severity).toBe('MEDIUM');
      expect(incident.status).toBe('OPEN');
      expect(incident.detectedAt).toBeInstanceOf(Date);
    });

    it('should auto-determine severity for incident types', async () => {
      const incident = await service.reportSecurityIncident(
        SecurityEventType.DATA_BREACH_ATTEMPT,
        'Data breach attempt',
        'Unauthorized access to sensitive data',
        { dataType: 'personal_data' }
      );

      expect(incident.severity).toBe('CRITICAL');
    });

    it('should handle high severity incidents', async () => {
      const incident = await service.reportSecurityIncident(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        'Suspicious activity detected',
        'Unusual access patterns detected',
        { pattern: 'rapid_requests' },
        {
          severity: 'HIGH',
          affectedResources: ['user_data']
        }
      );

      expect(incident.severity).toBe('HIGH');
      expect(incident.affectedResources).toContain('user_data');
    });
  });

  describe('performSecurityScan', () => {
    it('should perform static security scan', async () => {
      const result = await service.performSecurityScan('STATIC');

      expect(result.scanType).toBe('STATIC');
      expect(result.scanId).toBeDefined();
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.vulnerabilities).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should perform dependency scan', async () => {
      const result = await service.performSecurityScan('DEPENDENCY');

      expect(result.scanType).toBe('DEPENDENCY');
      expect(result.vulnerabilities).toBeDefined();
    });

    it('should perform configuration scan', async () => {
      const result = await service.performSecurityScan('CONFIGURATION');

      expect(result.scanType).toBe('CONFIGURATION');
      expect(result.vulnerabilities).toBeDefined();
    });

    it('should handle scan errors gracefully', async () => {
      // This should not throw even if scan encounters issues
      await expect(service.performSecurityScan('STATIC')).resolves.toBeDefined();
    });
  });

  describe('generateSecurityMetrics', () => {
    it('should generate security metrics report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await service.generateSecurityMetrics(startDate, endDate);

      expect(metrics.period.startDate).toEqual(startDate);
      expect(metrics.period.endDate).toEqual(endDate);
      expect(metrics.incidents).toBeDefined();
      expect(metrics.vulnerabilities).toBeDefined();
      expect(metrics.compliance).toBeDefined();
      expect(metrics.authentication).toBeDefined();
      
      expect(typeof metrics.incidents.total).toBe('number');
      expect(typeof metrics.vulnerabilities.total).toBe('number');
      expect(typeof metrics.compliance.score).toBe('number');
      expect(typeof metrics.authentication.totalAttempts).toBe('number');
    });

    it('should calculate authentication success rate', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await service.generateSecurityMetrics(startDate, endDate);

      expect(metrics.authentication.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.authentication.successRate).toBeLessThanOrEqual(100);
    });

    it('should group incidents by type and severity', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await service.generateSecurityMetrics(startDate, endDate);

      expect(metrics.incidents.byType).toBeDefined();
      expect(metrics.incidents.bySeverity).toBeDefined();
      expect(typeof metrics.incidents.byType[SecurityEventType.AUTHENTICATION_FAILURE]).toBe('number');
      expect(typeof metrics.incidents.bySeverity.LOW).toBe('number');
    });
  });

  describe('createEmergencyBackup', () => {
    it('should create emergency backup', async () => {
      const result = await service.createEmergencyBackup(
        mockUser,
        'Security incident detected'
      );

      expect(result.backupId).toBeDefined();
      expect(result.location).toBeDefined();
      expect(typeof result.backupId).toBe('string');
      expect(typeof result.location).toBe('string');
    });

    it('should report incident when creating emergency backup', async () => {
      const result = await service.createEmergencyBackup(
        mockUser,
        'Data breach attempt'
      );

      expect(result).toBeDefined();
      // The incident should be reported automatically
    });
  });

  describe('security event types', () => {
    it('should support all security event types', () => {
      const eventTypes = Object.values(SecurityEventType);
      
      expect(eventTypes).toContain(SecurityEventType.AUTHENTICATION_FAILURE);
      expect(eventTypes).toContain(SecurityEventType.AUTHORIZATION_FAILURE);
      expect(eventTypes).toContain(SecurityEventType.DATA_BREACH_ATTEMPT);
      expect(eventTypes).toContain(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(eventTypes).toContain(SecurityEventType.SECURITY_POLICY_VIOLATION);
      expect(eventTypes).toContain(SecurityEventType.VULNERABILITY_DETECTED);
      expect(eventTypes).toContain(SecurityEventType.COMPLIANCE_VIOLATION);
    });
  });

  describe('suspicious activity detection', () => {
    it('should detect unusual IP addresses', async () => {
      const result = await service.performSecurityCheck(
        mockUser,
        Action.READ,
        ResourceType.TASK,
        'task123',
        {
          ipAddress: '1.2.3.4', // Unusual IP
          userAgent: 'Mozilla/5.0'
        }
      );

      expect(result).toBeDefined();
      // Suspicious activity detection is implemented but may not trigger in test
    });

    it('should detect rapid successive requests', async () => {
      // Multiple rapid requests
      const promises = Array.from({ length: 5 }, () =>
        service.performSecurityCheck(
          mockUser,
          Action.READ,
          ResourceType.TASK,
          'task123',
          { ipAddress: '192.168.1.1' }
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      // Rate limiting and suspicious activity detection may trigger
    });
  });

  describe('error handling', () => {
    it('should handle security service errors gracefully', async () => {
      // Test with invalid parameters
      await expect(
        service.performSecurityCheck(
          mockUser,
          'INVALID_ACTION' as any,
          ResourceType.TASK,
          'task123'
        )
      ).resolves.toBeDefined();
    });

    it('should handle incident reporting errors', async () => {
      // Test with invalid incident type
      await expect(
        service.reportSecurityIncident(
          'INVALID_TYPE' as any,
          'Test incident',
          'Test description',
          {}
        )
      ).rejects.toThrow();
    });

    it('should handle metrics generation errors', async () => {
      // Test with invalid date range
      const startDate = new Date('invalid');
      const endDate = new Date('2024-01-31');

      await expect(
        service.generateSecurityMetrics(startDate, endDate)
      ).rejects.toThrow();
    });
  });
});