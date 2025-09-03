import { UserDocument } from '../models/User';
import { Permission } from '../types';
import { Logger } from '../utils/logger';
import { auditLogger, AuditEventType } from './AuditLogger';

const logger = new Logger('AccessControl');

export enum ResourceType {
  TASK = 'TASK',
  WORKFLOW = 'WORKFLOW',
  USER = 'USER',
  INTEGRATION = 'INTEGRATION',
  DOCUMENT = 'DOCUMENT',
  REPORT = 'REPORT',
  ANALYTICS = 'ANALYTICS',
  SYSTEM = 'SYSTEM'
}

export enum Action {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXECUTE = 'EXECUTE',
  APPROVE = 'APPROVE',
  EXPORT = 'EXPORT',
  SHARE = 'SHARE'
}

export interface Resource {
  type: ResourceType;
  id: string;
  ownerId?: string;
  organizationId?: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  metadata?: Record<string, any>;
}

export interface AccessContext {
  user: UserDocument;
  resource: Resource;
  action: Action;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
}

export interface AccessRule {
  id: string;
  name: string;
  description: string;
  resourceType: ResourceType;
  action: Action;
  conditions: AccessCondition[];
  effect: 'ALLOW' | 'DENY';
  priority: number;
  isActive: boolean;
}

export interface AccessCondition {
  type: 'ROLE' | 'PERMISSION' | 'OWNERSHIP' | 'TIME' | 'IP' | 'CUSTOM';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';
  field: string;
  value: any;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  appliedRules: string[];
  conditions: AccessCondition[];
  metadata: Record<string, any>;
}

export class AccessControlService {
  private rules: Map<string, AccessRule> = new Map();
  private defaultRules: AccessRule[];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Check if user has access to perform action on resource
   */
  async checkAccess(context: AccessContext): Promise<AccessDecision> {
    try {
      const decision = await this.evaluateAccess(context);
      
      // Log access attempt
      await auditLogger.logEvent(
        AuditEventType.DATA_ACCESS,
        `Access ${decision.allowed ? 'granted' : 'denied'}: ${context.action} on ${context.resource.type}`,
        {
          resourceType: context.resource.type,
          resourceId: context.resource.id,
          action: context.action,
          decision: decision.allowed,
          reason: decision.reason,
          appliedRules: decision.appliedRules
        },
        {
          user: context.user,
          resource: context.resource.type,
          resourceId: context.resource.id,
          success: decision.allowed,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          sessionId: context.sessionId,
          dataClassification: context.resource.classification,
          complianceFlags: ['ACCESS_CONTROL', 'GDPR', 'SOX']
        }
      );

      return decision;
    } catch (error) {
      logger.error('Access control check failed', {
        userId: context.user.id,
        resourceType: context.resource.type,
        action: context.action,
        error: error.message
      });

      return {
        allowed: false,
        reason: 'Access control system error',
        appliedRules: [],
        conditions: [],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Enforce access control - throws error if access denied
   */
  async enforceAccess(context: AccessContext): Promise<void> {
    const decision = await this.checkAccess(context);
    
    if (!decision.allowed) {
      const error = new Error(`Access denied: ${decision.reason}`);
      error.name = 'AccessDeniedError';
      throw error;
    }
  }

  /**
   * Check multiple permissions at once
   */
  async checkBulkAccess(
    user: UserDocument,
    checks: Array<{ resource: Resource; action: Action }>
  ): Promise<Map<string, AccessDecision>> {
    const results = new Map<string, AccessDecision>();

    for (const check of checks) {
      const key = `${check.resource.type}:${check.resource.id}:${check.action}`;
      const context: AccessContext = {
        user,
        resource: check.resource,
        action: check.action
      };
      
      results.set(key, await this.checkAccess(context));
    }

    return results;
  }

  /**
   * Add custom access rule
   */
  addRule(rule: AccessRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Access rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove access rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Access rule removed', { ruleId });
  }

  /**
   * Get effective permissions for user on resource type
   */
  async getEffectivePermissions(
    user: UserDocument,
    resourceType: ResourceType
  ): Promise<Action[]> {
    const allowedActions: Action[] = [];

    for (const action of Object.values(Action)) {
      const mockResource: Resource = {
        type: resourceType,
        id: 'test',
        classification: 'INTERNAL'
      };

      const decision = await this.checkAccess({
        user,
        resource: mockResource,
        action
      });

      if (decision.allowed) {
        allowedActions.push(action);
      }
    }

    return allowedActions;
  }

  private async evaluateAccess(context: AccessContext): Promise<AccessDecision> {
    const applicableRules = this.getApplicableRules(context);
    const appliedRules: string[] = [];
    let finalDecision = false;
    let reason = 'No applicable rules found';

    // Sort rules by priority (higher priority first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      if (!rule.isActive) continue;

      const ruleMatches = await this.evaluateRule(rule, context);
      
      if (ruleMatches) {
        appliedRules.push(rule.id);
        
        if (rule.effect === 'DENY') {
          // Deny rules take precedence
          return {
            allowed: false,
            reason: `Access denied by rule: ${rule.name}`,
            appliedRules,
            conditions: rule.conditions,
            metadata: { denyRule: rule.id }
          };
        } else if (rule.effect === 'ALLOW') {
          finalDecision = true;
          reason = `Access granted by rule: ${rule.name}`;
        }
      }
    }

    return {
      allowed: finalDecision,
      reason,
      appliedRules,
      conditions: [],
      metadata: {}
    };
  }

  private getApplicableRules(context: AccessContext): AccessRule[] {
    const rules = [...this.defaultRules, ...Array.from(this.rules.values())];
    
    return rules.filter(rule => 
      rule.resourceType === context.resource.type &&
      rule.action === context.action
    );
  }

  private async evaluateRule(rule: AccessRule, context: AccessContext): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: AccessCondition, context: AccessContext): Promise<boolean> {
    let actualValue: any;

    switch (condition.type) {
      case 'ROLE':
        actualValue = context.user.role;
        break;
      case 'PERMISSION':
        actualValue = context.user.permissions;
        break;
      case 'OWNERSHIP':
        actualValue = context.resource.ownerId;
        break;
      case 'TIME':
        actualValue = new Date().getHours();
        break;
      case 'IP':
        actualValue = context.ipAddress;
        break;
      default:
        return true;
    }

    return this.evaluateOperator(condition.operator, actualValue, condition.value);
  }

  private evaluateOperator(operator: string, actual: any, expected: any): boolean {
    switch (operator) {
      case 'EQUALS':
        return actual === expected;
      case 'NOT_EQUALS':
        return actual !== expected;
      case 'IN':
        return Array.isArray(expected) && expected.includes(actual);
      case 'NOT_IN':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'CONTAINS':
        return Array.isArray(actual) && actual.includes(expected);
      case 'GREATER_THAN':
        return actual > expected;
      case 'LESS_THAN':
        return actual < expected;
      default:
        return false;
    }
  }

  private initializeDefaultRules(): void {
    this.defaultRules = [
      // Admin can do everything
      {
        id: 'admin-full-access',
        name: 'Admin Full Access',
        description: 'Administrators have full access to all resources',
        resourceType: ResourceType.TASK,
        action: Action.CREATE,
        conditions: [
          { type: 'ROLE', operator: 'EQUALS', field: 'role', value: 'ADMIN' }
        ],
        effect: 'ALLOW',
        priority: 1000,
        isActive: true
      },
      
      // Users can read their own tasks
      {
        id: 'user-own-task-read',
        name: 'User Own Task Read',
        description: 'Users can read their own tasks',
        resourceType: ResourceType.TASK,
        action: Action.READ,
        conditions: [
          { type: 'OWNERSHIP', operator: 'EQUALS', field: 'ownerId', value: 'USER_ID' },
          { type: 'PERMISSION', operator: 'CONTAINS', field: 'permissions', value: Permission.READ_TASKS }
        ],
        effect: 'ALLOW',
        priority: 100,
        isActive: true
      },

      // Managers can manage workflows
      {
        id: 'manager-workflow-access',
        name: 'Manager Workflow Access',
        description: 'Managers can manage workflows',
        resourceType: ResourceType.WORKFLOW,
        action: Action.UPDATE,
        conditions: [
          { type: 'ROLE', operator: 'IN', field: 'role', value: ['MANAGER', 'ADMIN'] },
          { type: 'PERMISSION', operator: 'CONTAINS', field: 'permissions', value: Permission.MANAGE_WORKFLOWS }
        ],
        effect: 'ALLOW',
        priority: 200,
        isActive: true
      },

      // Restrict access to confidential data
      {
        id: 'confidential-data-restriction',
        name: 'Confidential Data Restriction',
        description: 'Restrict access to confidential data',
        resourceType: ResourceType.DOCUMENT,
        action: Action.READ,
        conditions: [
          { type: 'CUSTOM', operator: 'EQUALS', field: 'classification', value: 'CONFIDENTIAL' },
          { type: 'ROLE', operator: 'NOT_IN', field: 'role', value: ['ADMIN', 'MANAGER'] }
        ],
        effect: 'DENY',
        priority: 900,
        isActive: true
      }
    ];
  }
}

export const accessControlService = new AccessControlService();