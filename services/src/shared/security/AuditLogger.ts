import { Logger } from '../utils/logger';
import { UserDocument } from '../models/User';
import { encryptionService } from './EncryptionService';
import mongoose from 'mongoose';

export enum AuditEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFIED = 'DATA_MODIFIED',
  DATA_DELETED = 'DATA_DELETED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  WORKFLOW_EXECUTED = 'WORKFLOW_EXECUTED',
  INTEGRATION_ACCESS = 'INTEGRATION_ACCESS',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  DATA_EXPORT = 'DATA_EXPORT',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED'
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  metadata: {
    requestId?: string;
    correlationId?: string;
    source: string;
    version: string;
  };
  complianceFlags: string[];
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  retentionPeriod: number; // days
  hash: string; // Tamper-proof hash
}

const auditEventSchema = new mongoose.Schema<AuditEvent>({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true, default: Date.now },
  eventType: { type: String, enum: Object.values(AuditEventType), required: true },
  severity: { type: String, enum: Object.values(AuditSeverity), required: true },
  userId: { type: String },
  userEmail: { type: String },
  userRole: { type: String },
  sessionId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  resource: { type: String },
  resourceId: { type: String },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, required: true },
  success: { type: Boolean, required: true },
  errorMessage: { type: String },
  metadata: {
    requestId: { type: String },
    correlationId: { type: String },
    source: { type: String, required: true },
    version: { type: String, required: true }
  },
  complianceFlags: [{ type: String }],
  dataClassification: { 
    type: String, 
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    default: 'INTERNAL'
  },
  retentionPeriod: { type: Number, required: true, default: 2555 }, // 7 years default
  hash: { type: String, required: true }
}, {
  timestamps: false, // We manage timestamp manually
  collection: 'audit_logs'
});

// Indexes for efficient querying
auditEventSchema.index({ timestamp: -1 });
auditEventSchema.index({ eventType: 1, timestamp: -1 });
auditEventSchema.index({ userId: 1, timestamp: -1 });
auditEventSchema.index({ severity: 1, timestamp: -1 });
auditEventSchema.index({ complianceFlags: 1 });
auditEventSchema.index({ retentionPeriod: 1, timestamp: 1 });

const AuditEventModel = mongoose.model<AuditEvent>('AuditEvent', auditEventSchema);

export class AuditLogger {
  private logger: Logger;
  private readonly systemVersion: string;

  constructor() {
    this.logger = new Logger('AuditLogger');
    this.systemVersion = process.env.SYSTEM_VERSION || '1.0.0';
  }

  /**
   * Log an audit event with tamper-proof hash
   */
  async logEvent(
    eventType: AuditEventType,
    action: string,
    details: Record<string, any>,
    options: {
      user?: UserDocument;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      resource?: string;
      resourceId?: string;
      success?: boolean;
      errorMessage?: string;
      severity?: AuditSeverity;
      requestId?: string;
      correlationId?: string;
      complianceFlags?: string[];
      dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
      retentionPeriod?: number;
    } = {}
  ): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        id: encryptionService.generateSecureToken(16),
        timestamp: new Date(),
        eventType,
        severity: options.severity || this.determineSeverity(eventType),
        userId: options.user?.id,
        userEmail: options.user?.email,
        userRole: options.user?.role,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        resource: options.resource,
        resourceId: options.resourceId,
        action,
        details: this.sanitizeDetails(details),
        success: options.success !== false,
        errorMessage: options.errorMessage,
        metadata: {
          requestId: options.requestId,
          correlationId: options.correlationId,
          source: 'business-automation-system',
          version: this.systemVersion
        },
        complianceFlags: options.complianceFlags || this.determineComplianceFlags(eventType),
        dataClassification: options.dataClassification || 'INTERNAL',
        retentionPeriod: options.retentionPeriod || this.determineRetentionPeriod(eventType),
        hash: '' // Will be calculated below
      };

      // Generate tamper-proof hash
      auditEvent.hash = this.generateEventHash(auditEvent);

      // Store in database
      await AuditEventModel.create(auditEvent);

      // Log to application logger for immediate visibility
      this.logger.info('Audit event logged', {
        eventType,
        action,
        userId: auditEvent.userId,
        success: auditEvent.success,
        severity: auditEvent.severity
      });

    } catch (error) {
      this.logger.error('Failed to log audit event', {
        eventType,
        action,
        error: error.message
      });
      // Don't throw - audit logging should not break application flow
    }
  }

  /**
   * Log user authentication events
   */
  async logAuthentication(
    user: UserDocument,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent(
      success ? AuditEventType.USER_LOGIN : AuditEventType.SECURITY_VIOLATION,
      success ? 'User login successful' : 'User login failed',
      {
        loginAttempt: true,
        authMethod: 'jwt'
      },
      {
        user,
        success,
        ipAddress,
        userAgent,
        errorMessage,
        severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
        complianceFlags: ['AUTHENTICATION', 'GDPR']
      }
    );
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    user: UserDocument,
    resource: string,
    resourceId: string,
    action: string,
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' = 'INTERNAL',
    requestId?: string
  ): Promise<void> {
    await this.logEvent(
      AuditEventType.DATA_ACCESS,
      action,
      {
        accessType: 'read',
        dataVolume: 1
      },
      {
        user,
        resource,
        resourceId,
        dataClassification,
        requestId,
        severity: dataClassification === 'RESTRICTED' ? AuditSeverity.HIGH : AuditSeverity.LOW,
        complianceFlags: this.getDataComplianceFlags(dataClassification)
      }
    );
  }

  /**
   * Log compliance-related events
   */
  async logComplianceEvent(
    eventType: AuditEventType,
    complianceFramework: string,
    checkResult: boolean,
    details: Record<string, any>,
    user?: UserDocument
  ): Promise<void> {
    await this.logEvent(
      eventType,
      `Compliance check: ${complianceFramework}`,
      {
        framework: complianceFramework,
        checkResult,
        ...details
      },
      {
        user,
        success: checkResult,
        severity: checkResult ? AuditSeverity.LOW : AuditSeverity.HIGH,
        complianceFlags: [complianceFramework.toUpperCase()],
        retentionPeriod: 2555 // 7 years for compliance
      }
    );
  }

  /**
   * Query audit logs with filtering
   */
  async queryAuditLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: AuditEventType[];
    userId?: string;
    severity?: AuditSeverity[];
    complianceFlags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const query: any = {};

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    if (filters.eventTypes?.length) {
      query.eventType = { $in: filters.eventTypes };
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.severity?.length) {
      query.severity = { $in: filters.severity };
    }

    if (filters.complianceFlags?.length) {
      query.complianceFlags = { $in: filters.complianceFlags };
    }

    const total = await AuditEventModel.countDocuments(query);
    const events = await AuditEventModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100)
      .skip(filters.offset || 0)
      .lean();

    return { events, total };
  }

  /**
   * Verify audit log integrity
   */
  async verifyLogIntegrity(eventId: string): Promise<boolean> {
    try {
      const event = await AuditEventModel.findOne({ id: eventId }).lean();
      if (!event) return false;

      const storedHash = event.hash;
      const eventCopy = { ...event };
      delete eventCopy.hash;
      
      const calculatedHash = this.generateEventHash(eventCopy as AuditEvent);
      return storedHash === calculatedHash;
    } catch (error) {
      this.logger.error('Failed to verify log integrity', { eventId, error: error.message });
      return false;
    }
  }

  /**
   * Clean up expired audit logs based on retention policy
   */
  async cleanupExpiredLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 2555); // Default 7 years

      const result = await AuditEventModel.deleteMany({
        timestamp: { $lt: cutoffDate },
        retentionPeriod: { $lt: 2555 }
      });

      this.logger.info('Cleaned up expired audit logs', { deletedCount: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired logs', { error: error.message });
      return 0;
    }
  }

  private generateEventHash(event: Omit<AuditEvent, 'hash'>): string {
    const hashInput = JSON.stringify(event, Object.keys(event).sort());
    return encryptionService.hash(hashInput).hash;
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private determineSeverity(eventType: AuditEventType): AuditSeverity {
    const highSeverityEvents = [
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.USER_DELETED,
      AuditEventType.DATA_DELETED,
      AuditEventType.PERMISSION_GRANTED,
      AuditEventType.PERMISSION_REVOKED
    ];

    const mediumSeverityEvents = [
      AuditEventType.PASSWORD_CHANGED,
      AuditEventType.DATA_MODIFIED,
      AuditEventType.INTEGRATION_ACCESS
    ];

    if (highSeverityEvents.includes(eventType)) return AuditSeverity.HIGH;
    if (mediumSeverityEvents.includes(eventType)) return AuditSeverity.MEDIUM;
    return AuditSeverity.LOW;
  }

  private determineComplianceFlags(eventType: AuditEventType): string[] {
    const flags: string[] = [];

    // GDPR compliance
    if ([
      AuditEventType.USER_CREATED,
      AuditEventType.USER_UPDATED,
      AuditEventType.USER_DELETED,
      AuditEventType.DATA_ACCESS,
      AuditEventType.DATA_MODIFIED,
      AuditEventType.DATA_DELETED,
      AuditEventType.DATA_EXPORT
    ].includes(eventType)) {
      flags.push('GDPR');
    }

    // SOX compliance
    if ([
      AuditEventType.DATA_MODIFIED,
      AuditEventType.DATA_DELETED,
      AuditEventType.PERMISSION_GRANTED,
      AuditEventType.PERMISSION_REVOKED
    ].includes(eventType)) {
      flags.push('SOX');
    }

    // HIPAA compliance (if handling health data)
    if ([
      AuditEventType.DATA_ACCESS,
      AuditEventType.DATA_MODIFIED,
      AuditEventType.DATA_EXPORT
    ].includes(eventType)) {
      flags.push('HIPAA');
    }

    return flags;
  }

  private getDataComplianceFlags(classification: string): string[] {
    const flags = ['GDPR'];
    
    if (classification === 'CONFIDENTIAL' || classification === 'RESTRICTED') {
      flags.push('SOX', 'HIPAA');
    }

    return flags;
  }

  private determineRetentionPeriod(eventType: AuditEventType): number {
    // Compliance-related events: 7 years
    const longRetentionEvents = [
      AuditEventType.DATA_DELETED,
      AuditEventType.PERMISSION_GRANTED,
      AuditEventType.PERMISSION_REVOKED,
      AuditEventType.COMPLIANCE_CHECK
    ];

    if (longRetentionEvents.includes(eventType)) {
      return 2555; // 7 years
    }

    // Security events: 3 years
    if (eventType === AuditEventType.SECURITY_VIOLATION) {
      return 1095; // 3 years
    }

    // Regular events: 1 year
    return 365;
  }
}

export const auditLogger = new AuditLogger();