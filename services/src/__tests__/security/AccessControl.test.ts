import { accessControlService, AccessControlService, ResourceType, Action } from '../../shared/security/AccessControl';
import { UserDocument } from '../../shared/models/User';
import { Permission, UserRole } from '../../shared/types';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let mockUser: UserDocument;

  beforeEach(() => {
    service = new AccessControlService();
    
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

  describe('checkAccess', () => {
    it('should allow access for valid permissions', async () => {
      const context = {
        user: mockUser,
        resource: {
          type: ResourceType.TASK,
          id: 'task123',
          ownerId: 'user123',
          classification: 'INTERNAL' as const
        },
        action: Action.READ
      };

      const decision = await service.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access for insufficient permissions', async () => {
      const context = {
        user: mockUser,
        resource: {
          type: ResourceType.WORKFLOW,
          id: 'workflow123',
          classification: 'INTERNAL' as const
        },
        action: Action.DELETE
      };

      const decision = await service.checkAccess(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('No applicable rules found');
    });

    it('should allow admin full access', async () => {
      const adminUser = {
        ...mockUser,
        role: UserRole.ADMIN,
        permissions: [Permission.ADMIN_ACCESS]
      };

      const context = {
        user: adminUser,
        resource: {
          type: ResourceType.TASK,
          id: 'task123',
          classification: 'CONFIDENTIAL' as const
        },
        action: Action.DELETE
      };

      const decision = await service.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access to confidential data for regular users', async () => {
      const context = {
        user: mockUser,
        resource: {
          type: ResourceType.DOCUMENT,
          id: 'doc123',
          classification: 'CONFIDENTIAL' as const
        },
        action: Action.READ
      };

      const decision = await service.checkAccess(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Access denied by rule');
    });
  });

  describe('enforceAccess', () => {
    it('should not throw for allowed access', async () => {
      const context = {
        user: mockUser,
        resource: {
          type: ResourceType.TASK,
          id: 'task123',
          ownerId: 'user123',
          classification: 'INTERNAL' as const
        },
        action: Action.READ
      };

      await expect(service.enforceAccess(context)).resolves.not.toThrow();
    });

    it('should throw AccessDeniedError for denied access', async () => {
      const context = {
        user: mockUser,
        resource: {
          type: ResourceType.DOCUMENT,
          id: 'doc123',
          classification: 'CONFIDENTIAL' as const
        },
        action: Action.READ
      };

      await expect(service.enforceAccess(context)).rejects.toThrow('Access denied');
    });
  });

  describe('checkBulkAccess', () => {
    it('should check multiple permissions at once', async () => {
      const checks = [
        {
          resource: {
            type: ResourceType.TASK,
            id: 'task1',
            ownerId: 'user123',
            classification: 'INTERNAL' as const
          },
          action: Action.READ
        },
        {
          resource: {
            type: ResourceType.TASK,
            id: 'task2',
            classification: 'CONFIDENTIAL' as const
          },
          action: Action.DELETE
        }
      ];

      const results = await service.checkBulkAccess(mockUser, checks);
      
      expect(results.size).toBe(2);
      expect(results.get('TASK:task1:READ')?.allowed).toBe(true);
      expect(results.get('TASK:task2:DELETE')?.allowed).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return allowed actions for resource type', async () => {
      const permissions = await service.getEffectivePermissions(mockUser, ResourceType.TASK);
      
      expect(permissions).toContain(Action.READ);
      expect(permissions).not.toContain(Action.DELETE);
    });

    it('should return all actions for admin', async () => {
      const adminUser = {
        ...mockUser,
        role: UserRole.ADMIN,
        permissions: [Permission.ADMIN_ACCESS]
      };

      const permissions = await service.getEffectivePermissions(adminUser, ResourceType.TASK);
      
      expect(permissions).toContain(Action.READ);
      expect(permissions).toContain(Action.CREATE);
      expect(permissions).toContain(Action.UPDATE);
      expect(permissions).toContain(Action.DELETE);
    });
  });

  describe('custom rules', () => {
    it('should allow adding custom access rules', () => {
      const customRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'Test custom rule',
        resourceType: ResourceType.TASK,
        action: Action.CREATE,
        conditions: [
          { type: 'ROLE' as const, operator: 'EQUALS' as const, field: 'role', value: 'USER' }
        ],
        effect: 'ALLOW' as const,
        priority: 500,
        isActive: true
      };

      expect(() => service.addRule(customRule)).not.toThrow();
    });

    it('should allow removing access rules', () => {
      const ruleId = 'test-rule';
      expect(() => service.removeRule(ruleId)).not.toThrow();
    });
  });
});