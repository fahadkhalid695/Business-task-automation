import { Logger } from '../utils/logger';
import { encryptionService } from './EncryptionService';
import { auditLogger, AuditEventType } from './AuditLogger';
import { UserDocument } from '../models/User';

const logger = new Logger('DataAnonymizer');

export enum AnonymizationMethod {
  MASKING = 'MASKING',
  PSEUDONYMIZATION = 'PSEUDONYMIZATION',
  GENERALIZATION = 'GENERALIZATION',
  SUPPRESSION = 'SUPPRESSION',
  NOISE_ADDITION = 'NOISE_ADDITION',
  SYNTHETIC_DATA = 'SYNTHETIC_DATA'
}

export interface AnonymizationRule {
  id: string;
  fieldName: string;
  fieldType: 'EMAIL' | 'PHONE' | 'NAME' | 'ADDRESS' | 'SSN' | 'CREDIT_CARD' | 'DATE' | 'NUMBER' | 'TEXT';
  method: AnonymizationMethod;
  parameters: Record<string, any>;
  preserveFormat: boolean;
  isActive: boolean;
}

export interface AnonymizationResult {
  originalData: Record<string, any>;
  anonymizedData: Record<string, any>;
  appliedRules: string[];
  anonymizationMap: Record<string, string>;
  reversible: boolean;
  timestamp: Date;
}

export class DataAnonymizer {
  private rules: Map<string, AnonymizationRule> = new Map();
  private pseudonymMap: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Anonymize data according to configured rules
   */
  async anonymizeData(
    data: Record<string, any>,
    user: UserDocument,
    options: {
      method?: AnonymizationMethod;
      preserveStructure?: boolean;
      reversible?: boolean;
      customRules?: AnonymizationRule[];
    } = {}
  ): Promise<AnonymizationResult> {
    try {
      const anonymizedData = { ...data };
      const appliedRules: string[] = [];
      const anonymizationMap: Record<string, string> = {};

      // Use custom rules if provided, otherwise use default rules
      const rulesToApply = options.customRules || Array.from(this.rules.values());

      for (const rule of rulesToApply) {
        if (!rule.isActive) continue;

        const fieldValue = this.getNestedValue(data, rule.fieldName);
        if (fieldValue !== undefined && fieldValue !== null) {
          const anonymizedValue = await this.applyAnonymizationRule(
            fieldValue,
            rule,
            options.reversible || false
          );

          this.setNestedValue(anonymizedData, rule.fieldName, anonymizedValue);
          appliedRules.push(rule.id);

          if (options.reversible) {
            anonymizationMap[rule.fieldName] = this.generateReverseKey(fieldValue, rule);
          }
        }
      }

      const result: AnonymizationResult = {
        originalData: data,
        anonymizedData,
        appliedRules,
        anonymizationMap,
        reversible: options.reversible || false,
        timestamp: new Date()
      };

      // Log anonymization activity
      await auditLogger.logEvent(
        AuditEventType.DATA_MODIFIED,
        'Data anonymization performed',
        {
          fieldsAnonymized: appliedRules.length,
          method: options.method,
          reversible: options.reversible
        },
        {
          user,
          complianceFlags: ['DATA_ANONYMIZATION', 'GDPR', 'PRIVACY']
        }
      );

      logger.info('Data anonymization completed', {
        fieldsProcessed: appliedRules.length,
        reversible: options.reversible
      });

      return result;
    } catch (error) {
      logger.error('Data anonymization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * De-anonymize data if reversible anonymization was used
   */
  async deAnonymizeData(
    anonymizedData: Record<string, any>,
    anonymizationMap: Record<string, string>,
    user: UserDocument
  ): Promise<Record<string, any>> {
    try {
      const deAnonymizedData = { ...anonymizedData };

      for (const [fieldName, reverseKey] of Object.entries(anonymizationMap)) {
        const anonymizedValue = this.getNestedValue(anonymizedData, fieldName);
        if (anonymizedValue !== undefined) {
          const originalValue = await this.reverseAnonymization(anonymizedValue, reverseKey);
          this.setNestedValue(deAnonymizedData, fieldName, originalValue);
        }
      }

      // Log de-anonymization activity
      await auditLogger.logEvent(
        AuditEventType.DATA_ACCESS,
        'Data de-anonymization performed',
        {
          fieldsDeAnonymized: Object.keys(anonymizationMap).length
        },
        {
          user,
          complianceFlags: ['DATA_DE_ANONYMIZATION', 'GDPR'],
          severity: 'HIGH'
        }
      );

      return deAnonymizedData;
    } catch (error) {
      logger.error('Data de-anonymization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate synthetic data based on original data patterns
   */
  async generateSyntheticData(
    originalData: Record<string, any>[],
    count: number,
    user: UserDocument
  ): Promise<Record<string, any>[]> {
    try {
      const syntheticData: Record<string, any>[] = [];

      for (let i = 0; i < count; i++) {
        const syntheticRecord: Record<string, any> = {};

        // Analyze patterns in original data
        const patterns = this.analyzeDataPatterns(originalData);

        for (const [fieldName, pattern] of Object.entries(patterns)) {
          syntheticRecord[fieldName] = this.generateSyntheticValue(pattern);
        }

        syntheticData.push(syntheticRecord);
      }

      // Log synthetic data generation
      await auditLogger.logEvent(
        AuditEventType.DATA_MODIFIED,
        'Synthetic data generation performed',
        {
          originalRecords: originalData.length,
          syntheticRecords: count
        },
        {
          user,
          complianceFlags: ['SYNTHETIC_DATA', 'PRIVACY']
        }
      );

      return syntheticData;
    } catch (error) {
      logger.error('Synthetic data generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Add anonymization rule
   */
  addRule(rule: AnonymizationRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Anonymization rule added', { ruleId: rule.id, fieldName: rule.fieldName });
  }

  /**
   * Remove anonymization rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Anonymization rule removed', { ruleId });
  }

  /**
   * Get all active rules
   */
  getActiveRules(): AnonymizationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.isActive);
  }

  private async applyAnonymizationRule(
    value: any,
    rule: AnonymizationRule,
    reversible: boolean
  ): Promise<any> {
    switch (rule.method) {
      case AnonymizationMethod.MASKING:
        return this.applyMasking(value, rule);
      case AnonymizationMethod.PSEUDONYMIZATION:
        return this.applyPseudonymization(value, rule, reversible);
      case AnonymizationMethod.GENERALIZATION:
        return this.applyGeneralization(value, rule);
      case AnonymizationMethod.SUPPRESSION:
        return this.applySuppression(value, rule);
      case AnonymizationMethod.NOISE_ADDITION:
        return this.applyNoiseAddition(value, rule);
      case AnonymizationMethod.SYNTHETIC_DATA:
        return this.generateSyntheticValue({ type: rule.fieldType, sample: value });
      default:
        return value;
    }
  }

  private applyMasking(value: string, rule: AnonymizationRule): string {
    const maskChar = rule.parameters.maskChar || '*';
    const preserveLength = rule.parameters.preserveLength !== false;
    const preserveFormat = rule.preserveFormat;

    switch (rule.fieldType) {
      case 'EMAIL':
        const [localPart, domain] = value.split('@');
        if (preserveFormat && domain) {
          const maskedLocal = localPart.charAt(0) + maskChar.repeat(Math.max(0, localPart.length - 2)) + localPart.charAt(localPart.length - 1);
          return `${maskedLocal}@${domain}`;
        }
        return preserveLength ? maskChar.repeat(value.length) : maskChar.repeat(8);

      case 'PHONE':
        if (preserveFormat) {
          return value.replace(/\d/g, maskChar);
        }
        return preserveLength ? maskChar.repeat(value.length) : maskChar.repeat(10);

      case 'SSN':
        if (preserveFormat) {
          return value.replace(/\d/g, maskChar);
        }
        return 'XXX-XX-XXXX';

      case 'CREDIT_CARD':
        if (preserveFormat && value.length >= 4) {
          return maskChar.repeat(value.length - 4) + value.slice(-4);
        }
        return maskChar.repeat(16);

      default:
        const visibleChars = Math.min(2, Math.floor(value.length * 0.2));
        if (visibleChars > 0 && value.length > visibleChars * 2) {
          return value.substring(0, visibleChars) + 
                 maskChar.repeat(value.length - visibleChars * 2) + 
                 value.substring(value.length - visibleChars);
        }
        return preserveLength ? maskChar.repeat(value.length) : maskChar.repeat(8);
    }
  }

  private applyPseudonymization(value: string, rule: AnonymizationRule, reversible: boolean): string {
    const key = `${rule.fieldName}:${value}`;
    
    if (this.pseudonymMap.has(key)) {
      return this.pseudonymMap.get(key)!;
    }

    let pseudonym: string;
    
    if (reversible) {
      // Use deterministic pseudonymization for reversibility
      const hash = encryptionService.hash(value + rule.id);
      pseudonym = this.formatPseudonym(hash.hash.substring(0, 16), rule);
    } else {
      // Use random pseudonymization
      pseudonym = this.generateRandomPseudonym(rule);
    }

    this.pseudonymMap.set(key, pseudonym);
    return pseudonym;
  }

  private applyGeneralization(value: any, rule: AnonymizationRule): any {
    switch (rule.fieldType) {
      case 'DATE':
        const date = new Date(value);
        const precision = rule.parameters.precision || 'month';
        
        switch (precision) {
          case 'year':
            return date.getFullYear().toString();
          case 'month':
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          case 'quarter':
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            return `${date.getFullYear()}-Q${quarter}`;
          default:
            return value;
        }

      case 'NUMBER':
        const num = parseFloat(value);
        const range = rule.parameters.range || 10;
        const lowerBound = Math.floor(num / range) * range;
        return `${lowerBound}-${lowerBound + range - 1}`;

      case 'ADDRESS':
        // Generalize to city/state level
        const parts = value.split(',');
        if (parts.length >= 2) {
          return parts.slice(-2).join(',').trim();
        }
        return 'City, State';

      default:
        return value;
    }
  }

  private applySuppression(value: any, rule: AnonymizationRule): any {
    const suppressionValue = rule.parameters.suppressionValue;
    
    if (suppressionValue !== undefined) {
      return suppressionValue;
    }

    // Default suppression values by type
    switch (rule.fieldType) {
      case 'EMAIL':
        return '[SUPPRESSED_EMAIL]';
      case 'PHONE':
        return '[SUPPRESSED_PHONE]';
      case 'NAME':
        return '[SUPPRESSED_NAME]';
      case 'ADDRESS':
        return '[SUPPRESSED_ADDRESS]';
      default:
        return '[SUPPRESSED]';
    }
  }

  private applyNoiseAddition(value: any, rule: AnonymizationRule): any {
    if (rule.fieldType === 'NUMBER') {
      const num = parseFloat(value);
      const noiseLevel = rule.parameters.noiseLevel || 0.1;
      const noise = (Math.random() - 0.5) * 2 * noiseLevel * num;
      return num + noise;
    }

    if (rule.fieldType === 'DATE') {
      const date = new Date(value);
      const noiseDays = rule.parameters.noiseDays || 30;
      const noise = (Math.random() - 0.5) * 2 * noiseDays;
      date.setDate(date.getDate() + Math.round(noise));
      return date.toISOString();
    }

    return value;
  }

  private formatPseudonym(hash: string, rule: AnonymizationRule): string {
    switch (rule.fieldType) {
      case 'EMAIL':
        return `user${hash.substring(0, 8)}@example.com`;
      case 'PHONE':
        return `555-${hash.substring(0, 3)}-${hash.substring(3, 7)}`;
      case 'NAME':
        return `User${hash.substring(0, 6)}`;
      case 'SSN':
        return `${hash.substring(0, 3)}-${hash.substring(3, 5)}-${hash.substring(5, 9)}`;
      default:
        return hash.substring(0, 12);
    }
  }

  private generateRandomPseudonym(rule: AnonymizationRule): string {
    const randomId = encryptionService.generateSecureToken(8);
    return this.formatPseudonym(randomId, rule);
  }

  private generateReverseKey(originalValue: any, rule: AnonymizationRule): string {
    return encryptionService.hash(originalValue + rule.id + 'reverse').hash;
  }

  private async reverseAnonymization(anonymizedValue: any, reverseKey: string): Promise<any> {
    // In a real implementation, this would use the reverse key to decrypt/reverse the anonymization
    // For now, we'll return a placeholder indicating the original value would be restored
    return `[ORIGINAL_VALUE_FOR_${reverseKey.substring(0, 8)}]`;
  }

  private analyzeDataPatterns(data: Record<string, any>[]): Record<string, any> {
    const patterns: Record<string, any> = {};

    if (data.length === 0) return patterns;

    const sampleRecord = data[0];
    
    for (const [fieldName, value] of Object.entries(sampleRecord)) {
      const fieldType = this.detectFieldType(value);
      const samples = data.map(record => record[fieldName]).filter(v => v !== undefined);
      
      patterns[fieldName] = {
        type: fieldType,
        samples: samples.slice(0, 10), // Keep sample values for pattern generation
        length: typeof value === 'string' ? value.length : undefined,
        range: typeof value === 'number' ? this.calculateRange(samples) : undefined
      };
    }

    return patterns;
  }

  private generateSyntheticValue(pattern: any): any {
    switch (pattern.type) {
      case 'EMAIL':
        const randomUser = encryptionService.generateSecureToken(4);
        return `user${randomUser}@example.com`;
      
      case 'PHONE':
        return `555-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
      
      case 'NAME':
        const names = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana'];
        return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
      
      case 'NUMBER':
        if (pattern.range) {
          return Math.random() * (pattern.range.max - pattern.range.min) + pattern.range.min;
        }
        return Math.floor(Math.random() * 1000);
      
      case 'DATE':
        const now = new Date();
        const randomDays = Math.floor(Math.random() * 365);
        const syntheticDate = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
        return syntheticDate.toISOString();
      
      default:
        if (pattern.samples && pattern.samples.length > 0) {
          return pattern.samples[Math.floor(Math.random() * pattern.samples.length)];
        }
        return `synthetic_${encryptionService.generateSecureToken(4)}`;
    }
  }

  private detectFieldType(value: any): string {
    if (typeof value === 'number') return 'NUMBER';
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) return 'DATE';
    if (typeof value === 'string') {
      if (value.includes('@')) return 'EMAIL';
      if (/^\d{3}-\d{3}-\d{4}$/.test(value)) return 'PHONE';
      if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return 'SSN';
      if (/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(value)) return 'CREDIT_CARD';
    }
    return 'TEXT';
  }

  private calculateRange(values: any[]): { min: number; max: number } | undefined {
    const numbers = values.filter(v => typeof v === 'number');
    if (numbers.length === 0) return undefined;
    
    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers)
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private initializeDefaultRules(): void {
    const defaultRules: AnonymizationRule[] = [
      {
        id: 'email-masking',
        fieldName: 'email',
        fieldType: 'EMAIL',
        method: AnonymizationMethod.MASKING,
        parameters: { maskChar: '*' },
        preserveFormat: true,
        isActive: true
      },
      {
        id: 'phone-masking',
        fieldName: 'phone',
        fieldType: 'PHONE',
        method: AnonymizationMethod.MASKING,
        parameters: { maskChar: 'X' },
        preserveFormat: true,
        isActive: true
      },
      {
        id: 'name-pseudonymization',
        fieldName: 'firstName',
        fieldType: 'NAME',
        method: AnonymizationMethod.PSEUDONYMIZATION,
        parameters: {},
        preserveFormat: false,
        isActive: true
      },
      {
        id: 'ssn-suppression',
        fieldName: 'ssn',
        fieldType: 'SSN',
        method: AnonymizationMethod.SUPPRESSION,
        parameters: { suppressionValue: 'XXX-XX-XXXX' },
        preserveFormat: true,
        isActive: true
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }
}

export const dataAnonymizer = new DataAnonymizer();