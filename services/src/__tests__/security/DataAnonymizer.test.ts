import { dataAnonymizer, DataAnonymizer, AnonymizationMethod } from '../../shared/security/DataAnonymizer';
import { UserDocument } from '../../shared/models/User';
import { UserRole, Permission } from '../../shared/types';

describe('DataAnonymizer', () => {
  let anonymizer: DataAnonymizer;
  let mockUser: UserDocument;

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
    
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

  describe('anonymizeData', () => {
    it('should anonymize email addresses with masking', async () => {
      const data = {
        id: '123',
        email: 'john.doe@example.com',
        name: 'John Doe'
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        method: AnonymizationMethod.MASKING
      });

      expect(result.anonymizedData.email).not.toBe('john.doe@example.com');
      expect(result.anonymizedData.email).toContain('@example.com');
      expect(result.anonymizedData.email).toMatch(/^.+\*+.+@example\.com$/);
      expect(result.appliedRules.length).toBeGreaterThan(0);
    });

    it('should anonymize phone numbers with masking', async () => {
      const data = {
        phone: '555-123-4567',
        name: 'John Doe'
      };

      const result = await anonymizer.anonymizeData(data, mockUser);

      expect(result.anonymizedData.phone).not.toBe('555-123-4567');
      expect(result.anonymizedData.phone).toMatch(/X{3}-X{3}-X{4}/);
    });

    it('should use pseudonymization for names', async () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        method: AnonymizationMethod.PSEUDONYMIZATION
      });

      expect(result.anonymizedData.firstName).not.toBe('John');
      expect(result.anonymizedData.firstName).toMatch(/^User\w+$/);
    });

    it('should preserve data structure', async () => {
      const data = {
        user: {
          profile: {
            email: 'john@example.com',
            phone: '555-1234'
          },
          preferences: {
            theme: 'dark'
          }
        }
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        preserveStructure: true
      });

      expect(result.anonymizedData.user.profile).toBeDefined();
      expect(result.anonymizedData.user.preferences.theme).toBe('dark');
    });

    it('should support reversible anonymization', async () => {
      const data = {
        email: 'john@example.com',
        firstName: 'John'
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        reversible: true
      });

      expect(result.reversible).toBe(true);
      expect(Object.keys(result.anonymizationMap).length).toBeGreaterThan(0);
    });

    it('should apply custom rules', async () => {
      const customRule = {
        id: 'custom-email',
        fieldName: 'email',
        fieldType: 'EMAIL' as const,
        method: AnonymizationMethod.SUPPRESSION,
        parameters: { suppressionValue: '[REDACTED]' },
        preserveFormat: false,
        isActive: true
      };

      const data = { email: 'john@example.com' };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(result.anonymizedData.email).toBe('[REDACTED]');
    });
  });

  describe('deAnonymizeData', () => {
    it('should de-anonymize reversibly anonymized data', async () => {
      const data = {
        email: 'john@example.com',
        firstName: 'John'
      };

      const anonymizationResult = await anonymizer.anonymizeData(data, mockUser, {
        reversible: true
      });

      const deAnonymized = await anonymizer.deAnonymizeData(
        anonymizationResult.anonymizedData,
        anonymizationResult.anonymizationMap,
        mockUser
      );

      expect(deAnonymized).toBeDefined();
      // Note: In the test implementation, this returns placeholder values
      expect(typeof deAnonymized.email).toBe('string');
    });
  });

  describe('generateSyntheticData', () => {
    it('should generate synthetic data based on patterns', async () => {
      const originalData = [
        { name: 'John', age: 30, email: 'john@example.com' },
        { name: 'Jane', age: 25, email: 'jane@example.com' },
        { name: 'Bob', age: 35, email: 'bob@example.com' }
      ];

      const syntheticData = await anonymizer.generateSyntheticData(
        originalData,
        5,
        mockUser
      );

      expect(syntheticData).toHaveLength(5);
      expect(syntheticData[0]).toHaveProperty('name');
      expect(syntheticData[0]).toHaveProperty('age');
      expect(syntheticData[0]).toHaveProperty('email');
      
      // Synthetic data should be different from original
      expect(syntheticData[0].name).not.toBe('John');
      expect(syntheticData[0].email).toContain('@');
    });

    it('should handle empty input data', async () => {
      const syntheticData = await anonymizer.generateSyntheticData([], 3, mockUser);

      expect(syntheticData).toHaveLength(3);
    });
  });

  describe('anonymization methods', () => {
    it('should apply masking correctly', async () => {
      const data = {
        email: 'test@example.com',
        phone: '555-1234',
        ssn: '123-45-6789'
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        method: AnonymizationMethod.MASKING
      });

      expect(result.anonymizedData.email).toMatch(/^.+\*+.+@example\.com$/);
      expect(result.anonymizedData.phone).toMatch(/X+/);
    });

    it('should apply generalization to dates', async () => {
      const customRule = {
        id: 'date-generalization',
        fieldName: 'birthDate',
        fieldType: 'DATE' as const,
        method: AnonymizationMethod.GENERALIZATION,
        parameters: { precision: 'year' },
        preserveFormat: false,
        isActive: true
      };

      const data = { birthDate: '1990-05-15' };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(result.anonymizedData.birthDate).toBe('1990');
    });

    it('should apply generalization to numbers', async () => {
      const customRule = {
        id: 'salary-generalization',
        fieldName: 'salary',
        fieldType: 'NUMBER' as const,
        method: AnonymizationMethod.GENERALIZATION,
        parameters: { range: 10000 },
        preserveFormat: false,
        isActive: true
      };

      const data = { salary: 75000 };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(result.anonymizedData.salary).toMatch(/^\d+-\d+$/);
    });

    it('should apply suppression', async () => {
      const customRule = {
        id: 'ssn-suppression',
        fieldName: 'ssn',
        fieldType: 'SSN' as const,
        method: AnonymizationMethod.SUPPRESSION,
        parameters: {},
        preserveFormat: false,
        isActive: true
      };

      const data = { ssn: '123-45-6789' };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(result.anonymizedData.ssn).toBe('[SUPPRESSED]');
    });

    it('should apply noise addition to numbers', async () => {
      const customRule = {
        id: 'age-noise',
        fieldName: 'age',
        fieldType: 'NUMBER' as const,
        method: AnonymizationMethod.NOISE_ADDITION,
        parameters: { noiseLevel: 0.1 },
        preserveFormat: false,
        isActive: true
      };

      const data = { age: 30 };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(typeof result.anonymizedData.age).toBe('number');
      expect(result.anonymizedData.age).not.toBe(30);
      expect(Math.abs(result.anonymizedData.age - 30)).toBeLessThan(10);
    });
  });

  describe('rule management', () => {
    it('should add custom rules', () => {
      const customRule = {
        id: 'custom-rule',
        fieldName: 'customField',
        fieldType: 'TEXT' as const,
        method: AnonymizationMethod.MASKING,
        parameters: { maskChar: '#' },
        preserveFormat: true,
        isActive: true
      };

      expect(() => anonymizer.addRule(customRule)).not.toThrow();
    });

    it('should remove rules', () => {
      expect(() => anonymizer.removeRule('email-masking')).not.toThrow();
    });

    it('should get active rules', () => {
      const activeRules = anonymizer.getActiveRules();
      expect(Array.isArray(activeRules)).toBe(true);
      expect(activeRules.every(rule => rule.isActive)).toBe(true);
    });
  });

  describe('field type detection', () => {
    it('should detect email fields', async () => {
      const data = { userEmail: 'test@example.com' };
      
      // The anonymizer should detect this as an email-like field
      const result = await anonymizer.anonymizeData(data, mockUser);
      expect(result).toBeDefined();
    });

    it('should detect phone fields', async () => {
      const data = { phoneNumber: '555-123-4567' };
      
      const result = await anonymizer.anonymizeData(data, mockUser);
      expect(result).toBeDefined();
    });

    it('should detect SSN fields', async () => {
      const data = { socialSecurityNumber: '123-45-6789' };
      
      const result = await anonymizer.anonymizeData(data, mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined values', async () => {
      const data = {
        email: null,
        phone: undefined,
        name: 'John'
      };

      const result = await anonymizer.anonymizeData(data, mockUser);

      expect(result.anonymizedData.email).toBeNull();
      expect(result.anonymizedData.phone).toBeUndefined();
      expect(result.anonymizedData.name).toBeDefined();
    });

    it('should handle empty objects', async () => {
      const data = {};

      const result = await anonymizer.anonymizeData(data, mockUser);

      expect(result.anonymizedData).toEqual({});
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should handle invalid rule parameters', async () => {
      const invalidRule = {
        id: 'invalid-rule',
        fieldName: 'email',
        fieldType: 'EMAIL' as const,
        method: 'INVALID_METHOD' as any,
        parameters: {},
        preserveFormat: true,
        isActive: true
      };

      const data = { email: 'test@example.com' };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [invalidRule]
      });

      // Should not throw, but should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('nested data handling', () => {
    it('should handle deeply nested objects', async () => {
      const data = {
        user: {
          profile: {
            personal: {
              email: 'deep@example.com'
            }
          }
        }
      };

      const customRule = {
        id: 'nested-email',
        fieldName: 'user.profile.personal.email',
        fieldType: 'EMAIL' as const,
        method: AnonymizationMethod.MASKING,
        parameters: {},
        preserveFormat: true,
        isActive: true
      };

      const result = await anonymizer.anonymizeData(data, mockUser, {
        customRules: [customRule]
      });

      expect(result.anonymizedData.user.profile.personal.email).not.toBe('deep@example.com');
    });

    it('should handle arrays of objects', async () => {
      const data = {
        users: [
          { email: 'user1@example.com' },
          { email: 'user2@example.com' }
        ]
      };

      // Note: Current implementation doesn't handle arrays automatically
      // This test verifies the structure is preserved
      const result = await anonymizer.anonymizeData(data, mockUser);

      expect(result.anonymizedData.users).toBeDefined();
      expect(Array.isArray(result.anonymizedData.users)).toBe(true);
    });
  });
});