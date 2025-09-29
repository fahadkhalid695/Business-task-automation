import { logger } from '../shared/utils/Logger';

export interface IntegrationConfig {
  id: string;
  name: string;
  category: 'email' | 'calendar' | 'communication' | 'storage' | 'crm' | 'project-mgmt';
  status: 'production-ready' | 'beta' | 'development';
  credentials: Record<string, any>;
  settings: Record<string, any>;
}

export interface IntegrationCapability {
  read: boolean;
  write: boolean;
  webhook: boolean;
  realtime: boolean;
  batch: boolean;
}

export abstract class BaseIntegration {
  protected config: IntegrationConfig;
  protected capabilities: IntegrationCapability;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.capabilities = {
      read: true,
      write: true,
      webhook: false,
      realtime: false,
      batch: true
    };
  }

  abstract initialize(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract getHealthStatus(): Promise<{ healthy: boolean; message?: string }>;

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getCategory(): string {
    return this.config.category;
  }

  getCapabilities(): IntegrationCapability {
    return this.capabilities;
  }
}

export class IntegrationEcosystem {
  private integrations: Map<string, BaseIntegration> = new Map();
  private static instance: IntegrationEcosystem;

  static getInstance(): IntegrationEcosystem {
    if (!IntegrationEcosystem.instance) {
      IntegrationEcosystem.instance = new IntegrationEcosystem();
    }
    return IntegrationEcosystem.instance;
  }

  async registerIntegration(integration: BaseIntegration): Promise<void> {
    try {
      await integration.initialize();
      this.integrations.set(integration.getId(), integration);
      logger.info(`✅ Integration registered: ${integration.getName()}`);
    } catch (error) {
      logger.error(`❌ Failed to register integration ${integration.getName()}:`, error);
      throw error;
    }
  }

  getIntegration(id: string): BaseIntegration | undefined {
    return this.integrations.get(id);
  }

  getIntegrationsByCategory(category: string): BaseIntegration[] {
    return Array.from(this.integrations.values())
      .filter(integration => integration.getCategory() === category);
  }

  getAllIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [id, integration] of this.integrations) {
      try {
        results[id] = await integration.testConnection();
      } catch (error) {
        results[id] = false;
        logger.error(`Connection test failed for ${integration.getName()}:`, error);
      }
    }
    
    return results;
  }

  async getEcosystemHealth(): Promise<{
    totalIntegrations: number;
    healthyIntegrations: number;
    integrationStatus: Record<string, any>;
  }> {
    const integrationStatus: Record<string, any> = {};
    let healthyCount = 0;

    for (const [id, integration] of this.integrations) {
      try {
        const health = await integration.getHealthStatus();
        integrationStatus[id] = {
          name: integration.getName(),
          category: integration.getCategory(),
          healthy: health.healthy,
          message: health.message,
          capabilities: integration.getCapabilities()
        };
        
        if (health.healthy) healthyCount++;
      } catch (error) {
        integrationStatus[id] = {
          name: integration.getName(),
          category: integration.getCategory(),
          healthy: false,
          message: error.message,
          capabilities: integration.getCapabilities()
        };
      }
    }

    return {
      totalIntegrations: this.integrations.size,
      healthyIntegrations: healthyCount,
      integrationStatus
    };
  }
}