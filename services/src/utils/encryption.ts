import crypto from 'crypto';

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer;

  constructor() {
    const keyString = process.env.ENCRYPTION_KEY;
    
    if (!keyString || keyString.length !== 64) { // 32 bytes = 64 hex chars
      throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
    }
    
    this.key = Buffer.from(keyString, 'hex');
  }

  encrypt(plaintext: string): EncryptedData {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Hash sensitive data for storage (one-way)
  hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate secure random tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate API keys
  generateApiKey(): string {
    const prefix = 'bta_'; // business task automation
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return prefix + randomPart;
  }
}

export class ConfigService {
  private static instance: ConfigService;
  private config: Map<string, string> = new Map();

  private constructor() {
    this.loadConfiguration();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfiguration(): void {
    // Load from environment variables
    const requiredVars = [
      'JWT_SECRET', 'ENCRYPTION_KEY'
    ];

    const optionalVars = [
      'DATABASE_URL', 'REDIS_URL', 'GROK_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Required environment variable ${varName} is not set`);
      }
      this.config.set(varName, value);
    }

    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value) {
        this.config.set(varName, value);
      }
    }

    // Validate configuration
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const jwtSecret = this.config.get('JWT_SECRET')!;
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    const encryptionKey = this.config.get('ENCRYPTION_KEY')!;
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters');
    }
  }

  get(key: string): string | undefined {
    return this.config.get(key);
  }

  getRequired(key: string): string {
    const value = this.config.get(key);
    if (!value) {
      throw new Error(`Configuration key ${key} not found`);
    }
    return value;
  }

  // Never log sensitive configuration
  getSafeConfig(): Record<string, string> {
    const safeKeys = ['NODE_ENV', 'PORT', 'LOG_LEVEL', 'AI_PROVIDER'];
    const safeConfig: Record<string, string> = {};
    
    for (const key of safeKeys) {
      const value = process.env[key];
      if (value) {
        safeConfig[key] = value;
      }
    }
    
    return safeConfig;
  }
}