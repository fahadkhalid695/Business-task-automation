import crypto from 'crypto';
import { Logger } from '../utils/logger';

const logger = new Logger('EncryptionService');

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
}

export class EncryptionService {
  private readonly config: EncryptionConfig;
  private readonly masterKey: Buffer;

  constructor() {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16  // 128 bits
    };

    // In production, this should come from a secure key management service
    const keyString = process.env.ENCRYPTION_KEY || this.generateSecureKey();
    this.masterKey = Buffer.from(keyString, 'hex');

    if (this.masterKey.length !== this.config.keyLength) {
      throw new Error(`Invalid encryption key length. Expected ${this.config.keyLength} bytes`);
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipher(this.config.algorithm, this.masterKey);
      cipher.setAAD(Buffer.from('business-automation', 'utf8'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.config.algorithm
      };

      logger.debug('Data encrypted successfully');
      return result;
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const { encrypted, iv, tag, algorithm } = encryptedData;

      if (algorithm !== this.config.algorithm) {
        throw new Error('Unsupported encryption algorithm');
      }

      const decipher = crypto.createDecipher(algorithm, this.masterKey);
      decipher.setAAD(Buffer.from('business-automation', 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Data decrypted successfully');
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt data at rest for database storage
   */
  encryptForStorage(data: any): string {
    const jsonString = JSON.stringify(data);
    const encrypted = this.encrypt(jsonString);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt data from database storage
   */
  decryptFromStorage(encryptedString: string): any {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const decryptedString = this.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  /**
   * Generate a secure encryption key
   */
  private generateSecureKey(): string {
    const key = crypto.randomBytes(this.config.keyLength);
    logger.warn('Generated new encryption key. Store this securely!', { 
      key: key.toString('hex') 
    });
    return key.toString('hex');
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: actualSalt
    };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hash(data, salt);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  }

  /**
   * Generate secure random tokens
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

export const encryptionService = new EncryptionService();