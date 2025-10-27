import * as crypto from 'crypto';
import axios from 'axios';
import { EncryptedCredentials, TokenRefreshResult } from './types/IntegrationTypes';
import { logger } from '../shared/utils/logger';

/**
 * CredentialManager - Handles secure credential encryption, decryption, and token refresh
 */
export class CredentialManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly encryptionKey: Buffer;
  private tokenRefreshHandlers: Map<string, (credentials: any) => Promise<TokenRefreshResult>>;

  constructor() {
    // In production, this should come from environment variables or secure key management
    this.encryptionKey = this.deriveKey(process.env.ENCRYPTION_KEY || 'default-key-change-in-production');
    this.tokenRefreshHandlers = new Map();
    this.setupTokenRefreshHandlers();

    logger.info('CredentialManager initialized');
  }

  /**
   * Encrypt credentials for secure storage
   */
  async encrypt(data: any): Promise<EncryptedCredentials> {
    try {
      const plaintext = JSON.stringify(data);
      const iv = crypto.randomBytes(this.ivLength);

      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('integration-credentials'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted: encrypted,
        algorithm: this.algorithm,
        iv: iv.toString('hex') + tag.toString('hex')
      };
    } catch (error) {
      logger.error('Failed to encrypt credentials', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Credential encryption failed');
    }
  }

  /**
   * Decrypt credentials for use
   */
  async decrypt(credentials: EncryptedCredentials): Promise<any> {
    try {
      const ivAndTag = Buffer.from(credentials.iv, 'hex');
      const iv = ivAndTag.slice(0, this.ivLength);
      const tag = ivAndTag.slice(this.ivLength);

      const decipher = crypto.createDecipher(credentials.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('integration-credentials'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(credentials.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt credentials', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Credential decryption failed');
    }
  }

  /**
   * Rotate credentials for an integration
   */
  async rotate(integrationId: string, service: string, currentCredentials: EncryptedCredentials): Promise<boolean> {
    try {
      logger.info(`Rotating credentials for integration ${integrationId}`);

      const decryptedCredentials = await this.decrypt(currentCredentials);
      const refreshHandler = this.tokenRefreshHandlers.get(service);

      if (!refreshHandler) {
        logger.warn(`No token refresh handler found for service ${service}`);
        return false;
      }

      const refreshResult = await refreshHandler(decryptedCredentials);

      if (!refreshResult.success) {
        logger.error(`Token refresh failed for integration ${integrationId}`, {
          error: refreshResult.error
        });
        return false;
      }

      // Update credentials with new token
      if (refreshResult.newToken) {
        decryptedCredentials.accessToken = refreshResult.newToken;
        decryptedCredentials.expiresAt = refreshResult.expiresAt;

        // Re-encrypt with new credentials
        await this.encrypt(decryptedCredentials);

        // In a real implementation, you would update the database here
        logger.info(`Credentials rotated successfully for integration ${integrationId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to rotate credentials for integration ${integrationId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check if credentials need refresh
   */
  needsRefresh(credentials: any): boolean {
    if (!credentials.expiresAt) {
      return false;
    }

    const expirationTime = new Date(credentials.expiresAt).getTime();
    const currentTime = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return (expirationTime - currentTime) <= bufferTime;
  }

  /**
   * Derive encryption key from password
   */
  private deriveKey(password: string): Buffer {
    const salt = Buffer.from('integration-service-salt'); // In production, use random salt per credential
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Setup token refresh handlers for different services
   */
  private setupTokenRefreshHandlers(): void {
    // Gmail OAuth2 token refresh
    this.tokenRefreshHandlers.set('gmail', async (credentials: any): Promise<TokenRefreshResult> => {
      try {
        const response = await axios.post('https://oauth2.googleapis.com/token',
          new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token'
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          }
        );

        const data = response.data;

        return {
          success: true,
          newToken: data.access_token,
          expiresAt: new Date(Date.now() + (data.expires_in * 1000))
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Gmail token refresh failed'
        };
      }
    });

    // Outlook OAuth2 token refresh
    this.tokenRefreshHandlers.set('outlook', async (credentials: any): Promise<TokenRefreshResult> => {
      try {
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token',
          new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token',
            scope: 'https://graph.microsoft.com/.default'
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          }
        );

        const data = response.data;

        return {
          success: true,
          newToken: data.access_token,
          expiresAt: new Date(Date.now() + (data.expires_in * 1000))
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Outlook token refresh failed'
        };
      }
    });

    // Slack token refresh (if using OAuth)
    this.tokenRefreshHandlers.set('slack', async (credentials: any): Promise<TokenRefreshResult> => {
      try {
        const response = await axios.post('https://slack.com/api/oauth.v2.access',
          new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token'
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          }
        );

        const data = response.data;

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return {
          success: true,
          newToken: data.access_token,
          expiresAt: data.expires_in ? new Date(Date.now() + (data.expires_in * 1000)) : undefined
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Slack token refresh failed'
        };
      }
    });

    // Salesforce OAuth2 token refresh
    this.tokenRefreshHandlers.set('salesforce', async (credentials: any): Promise<TokenRefreshResult> => {
      try {
        const instanceUrl = credentials.instanceUrl || 'https://login.salesforce.com';
        const response = await axios.post(`${instanceUrl}/services/oauth2/token`,
          new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            refresh_token: credentials.refreshToken,
            grant_type: 'refresh_token'
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          }
        );

        const data = response.data;

        return {
          success: true,
          newToken: data.access_token,
          expiresAt: undefined // Salesforce tokens don't typically expire
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Salesforce token refresh failed'
        };
      }
    });

    // Microsoft Teams (uses same OAuth as Outlook)
    this.tokenRefreshHandlers.set('microsoft_teams', this.tokenRefreshHandlers.get('outlook')!);
  }

  /**
   * Get token refresh handler for service
   */
  getRefreshHandler(service: string): ((credentials: any) => Promise<TokenRefreshResult>) | undefined {
    return this.tokenRefreshHandlers.get(service);
  }

  /**
   * Add custom token refresh handler
   */
  addRefreshHandler(service: string, handler: (credentials: any) => Promise<TokenRefreshResult>): void {
    this.tokenRefreshHandlers.set(service, handler);
    logger.info(`Added token refresh handler for service ${service}`);
  }
}