import { encryptionService, EncryptionService } from '../../shared/security/EncryptionService';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.encrypted).not.toBe(plaintext);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    it('should produce different encrypted results for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail to decrypt with wrong data', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);
      
      // Tamper with encrypted data
      encrypted.encrypted = 'tampered';

      expect(() => service.decrypt(encrypted)).toThrow('Decryption failed');
    });
  });

  describe('encryptForStorage/decryptFromStorage', () => {
    it('should encrypt and decrypt objects for storage', () => {
      const data = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        sensitive: true
      };

      const encrypted = service.encryptForStorage(data);
      const decrypted = service.decryptFromStorage(encrypted);

      expect(decrypted).toEqual(data);
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('hash/verifyHash', () => {
    it('should hash data with salt', () => {
      const data = 'password123';
      const result = service.hash(data);

      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.hash.length).toBe(128); // 64 bytes in hex
      expect(result.salt.length).toBe(32); // 16 bytes in hex
    });

    it('should verify hash correctly', () => {
      const data = 'password123';
      const { hash, salt } = service.hash(data);

      expect(service.verifyHash(data, hash, salt)).toBe(true);
      expect(service.verifyHash('wrongpassword', hash, salt)).toBe(false);
    });

    it('should produce same hash with same salt', () => {
      const data = 'password123';
      const salt = 'fixedsalt';
      
      const result1 = service.hash(data, salt);
      const result2 = service.hash(data, salt);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(result2.salt);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate secure random tokens', () => {
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes in hex
      expect(token2.length).toBe(64);
    });

    it('should generate tokens of specified length', () => {
      const token = service.generateSecureToken(16);
      expect(token.length).toBe(32); // 16 bytes in hex
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors gracefully', () => {
      // Test with invalid input
      expect(() => service.encrypt('')).not.toThrow();
    });

    it('should handle decryption errors gracefully', () => {
      const invalidData = {
        encrypted: 'invalid',
        iv: 'invalid',
        tag: 'invalid',
        algorithm: 'aes-256-gcm'
      };

      expect(() => service.decrypt(invalidData)).toThrow('Decryption failed');
    });
  });
});