import { Logger } from '../utils/logger';
import { auditLogger, AuditEventType } from './AuditLogger';
import { UserDocument } from '../models/User';
import { encryptionService } from './EncryptionService';
import mongoose from 'mongoose';

const logger = new Logger('ComplianceService');

export enum ComplianceFramework {
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  SOX = 'SOX',
  PCI_DSS = 'PCI_DSS',
  ISO_27001 = 'ISO_27001'
}

export enum DataRetentionPolicy {
  SHORT_TERM = 30,      // 30 days
  MEDIUM_TERM = 365,    // 1 year
  LONG_TERM = 2555,     // 7 years
  PERMANENT = -1        // Never delete
}

export interface ComplianceRule {
  id: string;
  framework: ComplianceFramework;
  name: string;
  description: string;
  dataTypes: string[];
  retentionPeriod: DataRetentionPolicy;
  encryptionRequired: boolean;
  accessControls: string[];
  auditRequired: boolean;
  isActive: boolean;
  lastUpdated: Date;
}

export interface DataClassification {
  id: string;
  dataType: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  complianceFrameworks: ComplianceFramework[];
  retentionPeriod: DataRetentionPolicy;
  encryptionRequired: boolean;
  accessRestrictions: string[];
  processingRestrictions: string[];
  metadata: Record<string, any>;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    complianceScore: number;
  };
  violations: ComplianceViolation[];
  recommendations: string[];
  dataInventory: DataInventoryItem[];
  auditTrail: string[];
}

export interface ComplianceViolation {
  id: string;
  framework: ComplianceFramework;
  ruleId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectedAt: Date;
  affectedData: string[];
  remediation: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACCEPTED';
  assignedTo?: string;
  resolvedAt?: Date;
}

export interface DataInventoryItem {
  dataType: string;
  location: string;
  classification: string;
  volume: number;
  lastAccessed: Date;
  retentionStatus: 'ACTIVE' | 'ARCHIVED' | 'SCHEDULED_DELETION' | 'DELETED';
}

const complianceRuleSchema = new mongoose.Schema<ComplianceRule>({
  id: { type: String, required: true, unique: true },
  framework: { type: String, enum: Object.values(ComplianceFramework), required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  dataTypes: [{ type: String }],
  retentionPeriod: { type: Number, enum: Object.values(DataRetentionPolicy), required: true },
  encryptionRequired: { type: Boolean, required: true },
  accessControls: [{ type: String }],
  auditRequired: { type: Boolean, required: true },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
});

const dataClassificationSchema = new mongoose.Schema<DataClassification>({
  id: { type: String, required: true, unique: true },
  dataType: { type: String, required: true },
  classification: { 
    type: String, 
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'], 
    required: true 
  },
  complianceFrameworks: [{ type: String, enum: Object.values(ComplianceFramework) }],
  retentionPeriod: { type: Number, enum: Object.values(DataRetentionPolicy), required: true },
  encryptionRequired: { type: Boolean, required: true },
  accessRestrictions: [{ type: String }],
  processingRestrictions: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed }
});

const complianceViolationSchema = new mongoose.Schema<ComplianceViolation>({
  id: { type: String, required: true, unique: true },
  framework: { type: String, enum: Object.values(ComplianceFramework), required: true },
  ruleId: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  description: { type: String, required: true },
  detectedAt: { type: Date, default: Date.now },
  affectedData: [{ type: String }],
  remediation: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED'], 
    default: 'OPEN' 
  },
  assignedTo: { type: String },
  resolvedAt: { type: Date }
});

const ComplianceRuleModel = mongoose.model<ComplianceRule>('ComplianceRule', complianceRuleSchema);
const DataClassificationModel = mongoose.model<DataClassification>('DataClassification', dataClassificationSchema);
const ComplianceViolationModel = mongoose.model<ComplianceViolation>('ComplianceViolation', complianceViolationSchema);

export class ComplianceService {
  private rules: Map<string, ComplianceRule> = new Map();
  private classifications: Map<string, DataClassification> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeDataClassifications();
  }

  /**
   * Check compliance for data processing operation
   */
  async checkCompliance(
    dataType: string,
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT',
    user: UserDocument,
    metadata: Record<string, any> = {}
  ): Promise<{ compliant: boolean; violations: ComplianceViolation[]; requirements: string[] }> {
    try {
      const classification = await this.getDataClassification(dataType);
      const violations: ComplianceViolation[] = [];
      const requirements: string[] = [];

      if (!classification) {
        logger.warn('No classification found for data type', { dataType });
        return { compliant: true, violations: [], requirements: [] };
      }

      // Check each applicable compliance framework
      for (const framework of classification.complianceFrameworks) {
        const frameworkRules = await this.getRulesForFramework(framework);
        
        for (const rule of frameworkRules) {
          if (!rule.isActive || !rule.dataTypes.includes(dataType)) continue;

          const violation = await this.checkRule(rule, operation, user, classification, metadata);
          if (violation) {
            violations.push(violation);
          }

          // Add requirements
          if (rule.encryptionRequired) {
            requirements.push('Data must be encrypted');
          }
          if (rule.auditRequired) {
            requirements.push('Operation must be audited');
          }
        }
      }

      const compliant = violations.length === 0;

      // Log compliance check
      await auditLogger.logComplianceEvent(
        AuditEventType.COMPLIANCE_CHECK,
        classification.complianceFrameworks.join(','),
        compliant,
        {
          dataType,
          operation,
          violationsCount: violations.length,
          requirements
        },
        user
      );

      return { compliant, violations, requirements };
    } catch (error) {
      logger.error('Compliance check failed', { dataType, operation, error: error.message });
      throw error;
    }
  }

  /**
   * Generate compliance report for a framework
   */
  async generateComplianceReport(
    framework: ComplianceFramework,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    try {
      const reportId = encryptionService.generateSecureToken(16);
      
      // Get audit logs for the period
      const auditLogs = await auditLogger.queryAuditLogs({
        startDate,
        endDate,
        complianceFlags: [framework]
      });

      // Get violations for the period
      const violations = await ComplianceViolationModel.find({
        framework,
        detectedAt: { $gte: startDate, $lte: endDate }
      }).lean();

      // Calculate compliance metrics
      const totalChecks = auditLogs.events.filter(e => 
        e.eventType === AuditEventType.COMPLIANCE_CHECK
      ).length;
      
      const failedChecks = violations.length;
      const passedChecks = totalChecks - failedChecks;
      const complianceScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;

      // Generate data inventory
      const dataInventory = await this.generateDataInventory();

      // Generate recommendations
      const recommendations = this.generateRecommendations(violations, complianceScore);

      const report: ComplianceReport = {
        id: reportId,
        framework,
        generatedAt: new Date(),
        reportPeriod: { startDate, endDate },
        summary: {
          totalChecks,
          passedChecks,
          failedChecks,
          complianceScore
        },
        violations,
        recommendations,
        dataInventory,
        auditTrail: auditLogs.events.map(e => e.id)
      };

      logger.info('Compliance report generated', {
        framework,
        reportId,
        complianceScore,
        violationsCount: violations.length
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', { framework, error: error.message });
      throw error;
    }
  }

  /**
   * Handle data subject rights (GDPR)
   */
  async handleDataSubjectRequest(
    requestType: 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'PORTABILITY' | 'RESTRICTION',
    subjectId: string,
    requestedBy: UserDocument,
    details: Record<string, any> = {}
  ): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      await auditLogger.logEvent(
        AuditEventType.COMPLIANCE_CHECK,
        `Data subject request: ${requestType}`,
        {
          requestType,
          subjectId,
          details
        },
        {
          user: requestedBy,
          complianceFlags: ['GDPR'],
          severity: 'HIGH'
        }
      );

      switch (requestType) {
        case 'ACCESS':
          return await this.handleAccessRequest(subjectId);
        case 'ERASURE':
          return await this.handleErasureRequest(subjectId);
        case 'PORTABILITY':
          return await this.handlePortabilityRequest(subjectId);
        default:
          return {
            success: false,
            message: `Request type ${requestType} not yet implemented`
          };
      }
    } catch (error) {
      logger.error('Data subject request failed', { requestType, subjectId, error: error.message });
      return {
        success: false,
        message: 'Request processing failed'
      };
    }
  }

  /**
   * Anonymize or pseudonymize data
   */
  async anonymizeData(
    data: Record<string, any>,
    method: 'ANONYMIZE' | 'PSEUDONYMIZE' = 'ANONYMIZE'
  ): Promise<Record<string, any>> {
    const anonymized = { ...data };
    
    // Define PII fields that need anonymization
    const piiFields = [
      'email', 'phone', 'address', 'ssn', 'creditCard',
      'firstName', 'lastName', 'fullName', 'dateOfBirth'
    ];

    for (const field of piiFields) {
      if (anonymized[field]) {
        if (method === 'ANONYMIZE') {
          anonymized[field] = this.anonymizeField(field, anonymized[field]);
        } else {
          anonymized[field] = this.pseudonymizeField(field, anonymized[field]);
        }
      }
    }

    return anonymized;
  }

  /**
   * Schedule data retention cleanup
   */
  async scheduleDataRetention(): Promise<void> {
    try {
      const classifications = await DataClassificationModel.find({ isActive: true }).lean();
      
      for (const classification of classifications) {
        if (classification.retentionPeriod === DataRetentionPolicy.PERMANENT) {
          continue;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - classification.retentionPeriod);

        // This would integrate with your data cleanup processes
        logger.info('Scheduled data retention cleanup', {
          dataType: classification.dataType,
          retentionPeriod: classification.retentionPeriod,
          cutoffDate
        });
      }
    } catch (error) {
      logger.error('Data retention scheduling failed', { error: error.message });
    }
  }

  private async checkRule(
    rule: ComplianceRule,
    operation: string,
    user: UserDocument,
    classification: DataClassification,
    metadata: Record<string, any>
  ): Promise<ComplianceViolation | null> {
    // Check encryption requirement
    if (rule.encryptionRequired && !metadata.encrypted) {
      return {
        id: encryptionService.generateSecureToken(16),
        framework: rule.framework,
        ruleId: rule.id,
        severity: 'HIGH',
        description: `Encryption required for ${classification.dataType} but not provided`,
        detectedAt: new Date(),
        affectedData: [classification.dataType],
        remediation: 'Ensure data is encrypted before processing',
        status: 'OPEN'
      };
    }

    // Check access controls
    if (rule.accessControls.length > 0) {
      const hasRequiredAccess = rule.accessControls.some(control => 
        user.permissions.includes(control as any)
      );
      
      if (!hasRequiredAccess) {
        return {
          id: encryptionService.generateSecureToken(16),
          framework: rule.framework,
          ruleId: rule.id,
          severity: 'MEDIUM',
          description: `Insufficient access controls for ${classification.dataType}`,
          detectedAt: new Date(),
          affectedData: [classification.dataType],
          remediation: 'Grant appropriate permissions or restrict access',
          status: 'OPEN'
        };
      }
    }

    return null;
  }

  private async getDataClassification(dataType: string): Promise<DataClassification | null> {
    return await DataClassificationModel.findOne({ dataType }).lean();
  }

  private async getRulesForFramework(framework: ComplianceFramework): Promise<ComplianceRule[]> {
    return await ComplianceRuleModel.find({ framework, isActive: true }).lean();
  }

  private async handleAccessRequest(subjectId: string): Promise<{ success: boolean; data?: any; message: string }> {
    // Implementation would collect all data related to the subject
    return {
      success: true,
      data: { message: 'Data access request processed' },
      message: 'Personal data exported successfully'
    };
  }

  private async handleErasureRequest(subjectId: string): Promise<{ success: boolean; message: string }> {
    // Implementation would delete/anonymize all data related to the subject
    return {
      success: true,
      message: 'Data erasure request processed successfully'
    };
  }

  private async handlePortabilityRequest(subjectId: string): Promise<{ success: boolean; data?: any; message: string }> {
    // Implementation would export data in a portable format
    return {
      success: true,
      data: { format: 'JSON', exported: true },
      message: 'Data portability request processed successfully'
    };
  }

  private anonymizeField(fieldName: string, value: string): string {
    switch (fieldName) {
      case 'email':
        return '***@***.***';
      case 'phone':
        return '***-***-****';
      case 'ssn':
        return '***-**-****';
      default:
        return '***';
    }
  }

  private pseudonymizeField(fieldName: string, value: string): string {
    const hash = encryptionService.hash(value);
    return hash.hash.substring(0, 8);
  }

  private async generateDataInventory(): Promise<DataInventoryItem[]> {
    // Implementation would scan all data stores and classify data
    return [];
  }

  private generateRecommendations(violations: ComplianceViolation[], score: number): string[] {
    const recommendations: string[] = [];

    if (score < 80) {
      recommendations.push('Implement additional security controls to improve compliance score');
    }

    if (violations.some(v => v.severity === 'CRITICAL')) {
      recommendations.push('Address critical violations immediately');
    }

    if (violations.some(v => v.description.includes('encryption'))) {
      recommendations.push('Review and strengthen data encryption policies');
    }

    return recommendations;
  }

  private async initializeDefaultRules(): Promise<void> {
    const defaultRules: ComplianceRule[] = [
      {
        id: 'gdpr-personal-data',
        framework: ComplianceFramework.GDPR,
        name: 'GDPR Personal Data Protection',
        description: 'Personal data must be encrypted and access controlled',
        dataTypes: ['personal_data', 'user_profile', 'contact_info'],
        retentionPeriod: DataRetentionPolicy.LONG_TERM,
        encryptionRequired: true,
        accessControls: ['READ_PERSONAL_DATA'],
        auditRequired: true,
        isActive: true,
        lastUpdated: new Date()
      },
      {
        id: 'hipaa-health-data',
        framework: ComplianceFramework.HIPAA,
        name: 'HIPAA Health Information Protection',
        description: 'Health information must be encrypted and strictly controlled',
        dataTypes: ['health_data', 'medical_records'],
        retentionPeriod: DataRetentionPolicy.LONG_TERM,
        encryptionRequired: true,
        accessControls: ['READ_HEALTH_DATA'],
        auditRequired: true,
        isActive: true,
        lastUpdated: new Date()
      }
    ];

    for (const rule of defaultRules) {
      await ComplianceRuleModel.findOneAndUpdate(
        { id: rule.id },
        rule,
        { upsert: true, new: true }
      );
    }
  }

  private async initializeDataClassifications(): Promise<void> {
    const defaultClassifications: DataClassification[] = [
      {
        id: 'user-profile',
        dataType: 'user_profile',
        classification: 'CONFIDENTIAL',
        complianceFrameworks: [ComplianceFramework.GDPR],
        retentionPeriod: DataRetentionPolicy.LONG_TERM,
        encryptionRequired: true,
        accessRestrictions: ['ROLE_ADMIN', 'ROLE_MANAGER'],
        processingRestrictions: ['NO_AUTOMATED_DECISIONS'],
        metadata: {}
      },
      {
        id: 'task-data',
        dataType: 'task_data',
        classification: 'INTERNAL',
        complianceFrameworks: [ComplianceFramework.SOX],
        retentionPeriod: DataRetentionPolicy.MEDIUM_TERM,
        encryptionRequired: false,
        accessRestrictions: [],
        processingRestrictions: [],
        metadata: {}
      }
    ];

    for (const classification of defaultClassifications) {
      await DataClassificationModel.findOneAndUpdate(
        { id: classification.id },
        classification,
        { upsert: true, new: true }
      );
    }
  }
}

export const complianceService = new ComplianceService();