import { Logger } from '../utils/logger';
import { auditLogger, AuditEventType } from './AuditLogger';
import { encryptionService } from './EncryptionService';
import { accessControlService, AccessContext, Action, ResourceType } from './AccessControl';
import { complianceService, ComplianceFramework } from './ComplianceService';
import { securityScanner, SecurityScanResult } from './SecurityScanner';
import { backupService, BackupType } from './BackupService';
import { UserDocument } from '../models/User';
import mongoose from 'mongoose';

const logger = new Logger('SecurityService');

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SECURITY_POLICY_VIOLATION = 'SECURITY_POLICY_VIOLATION',
  VULNERABILITY_DETECTED = 'VULNERABILITY_DETECTED',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION'
}

export interface SecurityIncident {
  id: string;
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  detectedAt: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  affectedResources: string[];
  evidence: Record<string, any>;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SecurityMetrics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  incidents: {
    total: number;
    byType: Record<SecurityEventType, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    averageResolutionTime: number;
  };
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  compliance: {
    score: number;
    violations: number;
    frameworks: Record<ComplianceFramework, number>;
  };
  authentication: {
    totalAttempts: number;
    failedAttempts: number;
    successRate: number;
    suspiciousAttempts: number;
  };
}

const securityIncidentSchema = new mongoose.Schema<SecurityIncident>({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: Object.values(SecurityEventType), required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  detectedAt: { type: Date, default: Date.now },
  userId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  affectedResources: [{ type: String }],
  evidence: { type: mongoose.Schema.Types.Mixed },
  status: { 
    type: String, 
    enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'], 
    default: 'OPEN' 
  },
  assignedTo: { type: String },
  resolvedAt: { type: Date },
  resolution: { type: String }
});

const SecurityIncidentModel = mongoose.model<SecurityIncident>('SecurityIncident', securityIncidentSchema);

export class SecurityService {
  private alertThresholds: Map<SecurityEventType, number> = new Map();
  private suspiciousActivityPatterns: Map<string, any> = new Map();

  constructor() {
    this.initializeAlertThresholds();
    this.initializeSuspiciousActivityPatterns();
  }

  /**
   * Comprehensive security check for user operations
   */
  async performSecurityCheck(
    user: UserDocument,
    action: Action,
    resourceType: ResourceType,
    resourceId: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
      data?: any;
    } = {}
  ): Promise<{ allowed: boolean; violations: string[]; requirements: string[] }> {
    const violations: string[] = [];
    const requirements: string[] = [];

    try {
      // 1. Access Control Check
      const accessContext: AccessContext = {
        user,
        resource: {
          type: resourceType,
          id: resourceId,
          classification: 'INTERNAL'
        },
        action,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        sessionId: context.sessionId
      };

      const accessDecision = await accessControlService.checkAccess(accessContext);
      if (!accessDecision.allowed) {
        violations.push(`Access denied: ${accessDecision.reason}`);
      }

      // 2. Compliance Check
      const dataType = this.mapResourceTypeToDataType(resourceType);
      const complianceCheck = await complianceService.checkCompliance(
        dataType,
        this.mapActionToOperation(action),
        user,
        { encrypted: true, ...context.data }
      );

      if (!complianceCheck.compliant) {
        violations.push(...complianceCheck.violations.map(v => v.description));
      }
      requirements.push(...complianceCheck.requirements);

      // 3. Suspicious Activity Detection
      const suspiciousActivity = await this.detectSuspiciousActivity(user, context);
      if (suspiciousActivity.length > 0) {
        violations.push(...suspiciousActivity);
      }

      // 4. Rate Limiting Check
      const rateLimitViolation = await this.checkRateLimit(user.id, action, context.ipAddress);
      if (rateLimitViolation) {
        violations.push('Rate limit exceeded');
      }

      const allowed = violations.length === 0;

      // Log security check
      await auditLogger.logEvent(
        AuditEventType.DATA_ACCESS,
        `Security check ${allowed ? 'passed' : 'failed'}`,
        {
          action,
          resourceType,
          resourceId,
          violations,
          requirements
        },
        {
          user,
          success: allowed,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          sessionId: context.sessionId,
          complianceFlags: ['SECURITY_CHECK']
        }
      );

      return { allowed, violations, requirements };
    } catch (error) {
      logger.error('Security check failed', { 
        userId: user.id, 
        action, 
        resourceType, 
        error: error.message 
      });
      
      return { 
        allowed: false, 
        violations: ['Security check system error'], 
        requirements: [] 
      };
    }
  }

  /**
   * Report security incident
   */
  async reportSecurityIncident(
    type: SecurityEventType,
    title: string,
    description: string,
    evidence: Record<string, any>,
    context: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      affectedResources?: string[];
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    } = {}
  ): Promise<SecurityIncident> {
    const incidentId = encryptionService.generateSecureToken(16);
    
    const incident: SecurityIncident = {
      id: incidentId,
      type,
      severity: context.severity || this.determineSeverity(type),
      title,
      description,
      detectedAt: new Date(),
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      affectedResources: context.affectedResources || [],
      evidence,
      status: 'OPEN'
    };

    try {
      // Save incident
      await SecurityIncidentModel.create(incident);

      // Log incident
      await auditLogger.logEvent(
        AuditEventType.SECURITY_VIOLATION,
        `Security incident reported: ${title}`,
        {
          incidentId,
          type,
          severity: incident.severity,
          affectedResources: incident.affectedResources
        },
        {
          severity: incident.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          complianceFlags: ['SECURITY_INCIDENT']
        }
      );

      // Send alerts if severity is high
      if (incident.severity === 'HIGH' || incident.severity === 'CRITICAL') {
        await this.sendSecurityAlert(incident);
      }

      logger.info('Security incident reported', {
        incidentId,
        type,
        severity: incident.severity
      });

      return incident;
    } catch (error) {
      logger.error('Failed to report security incident', { 
        type, 
        title, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Perform automated security scan
   */
  async performSecurityScan(
    scanType: 'STATIC' | 'DYNAMIC' | 'DEPENDENCY' | 'CONFIGURATION' = 'STATIC'
  ): Promise<SecurityScanResult> {
    try {
      logger.info('Starting automated security scan', { scanType });

      const scanResult = await securityScanner.performSecurityScan(scanType);

      // Report critical vulnerabilities as incidents
      for (const vulnerability of scanResult.vulnerabilities) {
        if (vulnerability.severity === 'CRITICAL' || vulnerability.severity === 'HIGH') {
          await this.reportSecurityIncident(
            SecurityEventType.VULNERABILITY_DETECTED,
            vulnerability.title,
            vulnerability.description,
            {
              vulnerability: vulnerability,
              scanId: scanResult.scanId
            },
            {
              severity: vulnerability.severity as any,
              affectedResources: [vulnerability.location]
            }
          );
        }
      }

      return scanResult;
    } catch (error) {
      logger.error('Security scan failed', { scanType, error: error.message });
      throw error;
    }
  }

  /**
   * Generate security metrics report
   */
  async generateSecurityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<SecurityMetrics> {
    try {
      // Get incidents for the period
      const incidents = await SecurityIncidentModel.find({
        detectedAt: { $gte: startDate, $lte: endDate }
      }).lean();

      // Get audit logs for authentication metrics
      const authLogs = await auditLogger.queryAuditLogs({
        startDate,
        endDate,
        eventTypes: [AuditEventType.USER_LOGIN, AuditEventType.SECURITY_VIOLATION]
      });

      // Get recent vulnerability scan results
      const vulnerabilityScans = await securityScanner.performSecurityScan('STATIC');

      // Calculate metrics
      const incidentsByType = this.groupIncidentsByType(incidents);
      const incidentsBySeverity = this.groupIncidentsBySeverity(incidents);
      const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED');
      const averageResolutionTime = this.calculateAverageResolutionTime(resolvedIncidents);

      const authAttempts = authLogs.events.filter(e => 
        e.eventType === AuditEventType.USER_LOGIN || 
        e.eventType === AuditEventType.SECURITY_VIOLATION
      );
      const failedAttempts = authAttempts.filter(e => !e.success);
      const suspiciousAttempts = authAttempts.filter(e => 
        e.eventType === AuditEventType.SECURITY_VIOLATION
      );

      const metrics: SecurityMetrics = {
        period: { startDate, endDate },
        incidents: {
          total: incidents.length,
          byType: incidentsByType,
          bySeverity: incidentsBySeverity,
          resolved: resolvedIncidents.length,
          averageResolutionTime
        },
        vulnerabilities: {
          total: vulnerabilityScans.vulnerabilities.length,
          critical: vulnerabilityScans.summary.critical,
          high: vulnerabilityScans.summary.high,
          medium: vulnerabilityScans.summary.medium,
          low: vulnerabilityScans.summary.low
        },
        compliance: {
          score: 85, // This would be calculated from compliance service
          violations: 0,
          frameworks: {} as any
        },
        authentication: {
          totalAttempts: authAttempts.length,
          failedAttempts: failedAttempts.length,
          successRate: authAttempts.length > 0 ? 
            ((authAttempts.length - failedAttempts.length) / authAttempts.length) * 100 : 100,
          suspiciousAttempts: suspiciousAttempts.length
        }
      };

      return metrics;
    } catch (error) {
      logger.error('Failed to generate security metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Create emergency backup
   */
  async createEmergencyBackup(
    user: UserDocument,
    reason: string
  ): Promise<{ backupId: string; location: string }> {
    try {
      logger.info('Creating emergency backup', { userId: user.id, reason });

      const backupJob = await backupService.createBackup(
        BackupType.FULL,
        [], // All collections
        user,
        {
          encrypt: true,
          retentionPeriod: 365, // 1 year for emergency backups
          description: `Emergency backup: ${reason}`
        }
      );

      await this.reportSecurityIncident(
        SecurityEventType.DATA_BREACH_ATTEMPT,
        'Emergency backup created',
        `Emergency backup created due to: ${reason}`,
        {
          backupId: backupJob.id,
          reason,
          triggeredBy: user.id
        },
        {
          userId: user.id,
          severity: 'HIGH',
          affectedResources: ['DATABASE']
        }
      );

      return {
        backupId: backupJob.id,
        location: backupJob.location
      };
    } catch (error) {
      logger.error('Failed to create emergency backup', { error: error.message });
      throw error;
    }
  }

  private async detectSuspiciousActivity(
    user: UserDocument,
    context: any
  ): Promise<string[]> {
    const suspiciousActivities: string[] = [];

    // Check for unusual IP address
    if (context.ipAddress && await this.isUnusualIpAddress(user.id, context.ipAddress)) {
      suspiciousActivities.push('Login from unusual IP address');
    }

    // Check for unusual time patterns
    if (await this.isUnusualTimePattern(user.id)) {
      suspiciousActivities.push('Activity at unusual time');
    }

    // Check for rapid successive requests
    if (await this.hasRapidSuccessiveRequests(user.id)) {
      suspiciousActivities.push('Rapid successive requests detected');
    }

    return suspiciousActivities;
  }

  private async checkRateLimit(
    userId: string,
    action: Action,
    ipAddress?: string
  ): Promise<boolean> {
    // Implementation would check rate limits based on user and IP
    // For now, return false (no rate limit violation)
    return false;
  }

  private async isUnusualIpAddress(userId: string, ipAddress: string): Promise<boolean> {
    // Implementation would check against user's historical IP addresses
    return false;
  }

  private async isUnusualTimePattern(userId: string): Promise<boolean> {
    // Implementation would check against user's typical activity patterns
    return false;
  }

  private async hasRapidSuccessiveRequests(userId: string): Promise<boolean> {
    // Implementation would check for rapid requests in short time window
    return false;
  }

  private async sendSecurityAlert(incident: SecurityIncident): Promise<void> {
    // Implementation would send alerts via email, SMS, or other channels
    logger.warn('Security alert triggered', {
      incidentId: incident.id,
      type: incident.type,
      severity: incident.severity
    });
  }

  private mapResourceTypeToDataType(resourceType: ResourceType): string {
    const mapping: Record<ResourceType, string> = {
      [ResourceType.TASK]: 'task_data',
      [ResourceType.WORKFLOW]: 'workflow_data',
      [ResourceType.USER]: 'user_profile',
      [ResourceType.INTEGRATION]: 'integration_data',
      [ResourceType.DOCUMENT]: 'document_data',
      [ResourceType.REPORT]: 'report_data',
      [ResourceType.ANALYTICS]: 'analytics_data',
      [ResourceType.SYSTEM]: 'system_data'
    };

    return mapping[resourceType] || 'unknown_data';
  }

  private mapActionToOperation(action: Action): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' {
    const mapping: Record<Action, 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT'> = {
      [Action.CREATE]: 'CREATE',
      [Action.READ]: 'READ',
      [Action.UPDATE]: 'UPDATE',
      [Action.DELETE]: 'DELETE',
      [Action.EXECUTE]: 'UPDATE',
      [Action.APPROVE]: 'UPDATE',
      [Action.EXPORT]: 'EXPORT',
      [Action.SHARE]: 'READ'
    };

    return mapping[action] || 'READ';
  }

  private determineSeverity(type: SecurityEventType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMapping: Record<SecurityEventType, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      [SecurityEventType.AUTHENTICATION_FAILURE]: 'MEDIUM',
      [SecurityEventType.AUTHORIZATION_FAILURE]: 'MEDIUM',
      [SecurityEventType.DATA_BREACH_ATTEMPT]: 'CRITICAL',
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: 'HIGH',
      [SecurityEventType.SECURITY_POLICY_VIOLATION]: 'MEDIUM',
      [SecurityEventType.VULNERABILITY_DETECTED]: 'HIGH',
      [SecurityEventType.COMPLIANCE_VIOLATION]: 'HIGH'
    };

    return severityMapping[type] || 'MEDIUM';
  }

  private groupIncidentsByType(incidents: SecurityIncident[]): Record<SecurityEventType, number> {
    const grouped = {} as Record<SecurityEventType, number>;
    
    for (const type of Object.values(SecurityEventType)) {
      grouped[type] = incidents.filter(i => i.type === type).length;
    }

    return grouped;
  }

  private groupIncidentsBySeverity(incidents: SecurityIncident[]): Record<string, number> {
    const grouped = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    for (const incident of incidents) {
      grouped[incident.severity]++;
    }

    return grouped;
  }

  private calculateAverageResolutionTime(resolvedIncidents: SecurityIncident[]): number {
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      if (incident.resolvedAt) {
        return sum + (incident.resolvedAt.getTime() - incident.detectedAt.getTime());
      }
      return sum;
    }, 0);

    return totalTime / resolvedIncidents.length / (1000 * 60 * 60); // Convert to hours
  }

  private initializeAlertThresholds(): void {
    this.alertThresholds.set(SecurityEventType.AUTHENTICATION_FAILURE, 5);
    this.alertThresholds.set(SecurityEventType.AUTHORIZATION_FAILURE, 10);
    this.alertThresholds.set(SecurityEventType.DATA_BREACH_ATTEMPT, 1);
    this.alertThresholds.set(SecurityEventType.SUSPICIOUS_ACTIVITY, 3);
  }

  private initializeSuspiciousActivityPatterns(): void {
    this.suspiciousActivityPatterns.set('rapid_requests', {
      threshold: 100,
      timeWindow: 60000 // 1 minute
    });
    
    this.suspiciousActivityPatterns.set('unusual_hours', {
      startHour: 22,
      endHour: 6
    });
  }
}

export const securityService = new SecurityService();