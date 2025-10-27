import { IntegrationEcosystem, IntegrationConfig } from './IntegrationEcosystem';
import { logger } from '../shared/utils/logger';

// Email Integrations
import { GmailIntegration, OutlookIntegration, ExchangeIntegration } from './adapters/EmailIntegrations';

// Calendar Integrations
import { GoogleCalendarIntegration, OutlookCalendarIntegration } from './adapters/CalendarIntegrations';

// Communication Integrations
import { SlackIntegration, MicrosoftTeamsIntegration, DiscordIntegration } from './adapters/CommunicationIntegrations';

// Storage Integrations
import { GoogleDriveIntegration, OneDriveIntegration, DropboxIntegration } from './adapters/StorageIntegrations';

// CRM Integrations
import { SalesforceIntegration, HubSpotIntegration, PipedriveIntegration } from './adapters/CRMIntegrations';

// Project Management Integrations
import { JiraIntegration, TrelloIntegration, AsanaIntegration, MondayIntegration } from './adapters/ProjectManagementIntegrations';

export class IntegrationManager {
  private ecosystem: IntegrationEcosystem;
  private static instance: IntegrationManager;

  private constructor() {
    this.ecosystem = IntegrationEcosystem.getInstance();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  async initializeIntegrations(): Promise<void> {
    try {
      logger.info('Initializing integration ecosystem...');

      // Register all available integrations
      await this.registerEmailIntegrations();
      await this.registerCalendarIntegrations();
      await this.registerCommunicationIntegrations();
      await this.registerStorageIntegrations();
      await this.registerCRMIntegrations();
      await this.registerProjectManagementIntegrations();

      logger.info('Integration ecosystem initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize integration ecosystem:', error);
      throw error;
    }
  }

  private async registerEmailIntegrations(): Promise<void> {
    const emailConfigs = [
      { id: 'gmail', name: 'Gmail', category: 'email' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'outlook', name: 'Outlook', category: 'email' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'exchange', name: 'Exchange', category: 'email' as const, status: 'production-ready' as const, credentials: {}, settings: {} }
    ];

    const emailIntegrations = [
      new GmailIntegration(emailConfigs[0]),
      new OutlookIntegration(emailConfigs[1]),
      new ExchangeIntegration(emailConfigs[2])
    ];

    for (const integration of emailIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  private async registerCalendarIntegrations(): Promise<void> {
    const calendarConfigs = [
      { id: 'google-calendar', name: 'Google Calendar', category: 'calendar' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'outlook-calendar', name: 'Outlook Calendar', category: 'calendar' as const, status: 'production-ready' as const, credentials: {}, settings: {} }
    ];

    const calendarIntegrations = [
      new GoogleCalendarIntegration(calendarConfigs[0]),
      new OutlookCalendarIntegration(calendarConfigs[1])
    ];

    for (const integration of calendarIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  private async registerCommunicationIntegrations(): Promise<void> {
    const communicationConfigs = [
      { id: 'slack', name: 'Slack', category: 'communication' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'teams', name: 'Microsoft Teams', category: 'communication' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'discord', name: 'Discord', category: 'communication' as const, status: 'beta' as const, credentials: {}, settings: {} }
    ];

    const communicationIntegrations = [
      new SlackIntegration(communicationConfigs[0]),
      new MicrosoftTeamsIntegration(communicationConfigs[1]),
      new DiscordIntegration(communicationConfigs[2])
    ];

    for (const integration of communicationIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  private async registerStorageIntegrations(): Promise<void> {
    const storageConfigs = [
      { id: 'google-drive', name: 'Google Drive', category: 'storage' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'onedrive', name: 'OneDrive', category: 'storage' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'dropbox', name: 'Dropbox', category: 'storage' as const, status: 'production-ready' as const, credentials: {}, settings: {} }
    ];

    const storageIntegrations = [
      new GoogleDriveIntegration(storageConfigs[0]),
      new OneDriveIntegration(storageConfigs[1]),
      new DropboxIntegration(storageConfigs[2])
    ];

    for (const integration of storageIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  private async registerCRMIntegrations(): Promise<void> {
    const crmConfigs = [
      { id: 'salesforce', name: 'Salesforce', category: 'crm' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'hubspot', name: 'HubSpot', category: 'crm' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'pipedrive', name: 'Pipedrive', category: 'crm' as const, status: 'beta' as const, credentials: {}, settings: {} }
    ];

    const crmIntegrations = [
      new SalesforceIntegration(crmConfigs[0]),
      new HubSpotIntegration(crmConfigs[1]),
      new PipedriveIntegration(crmConfigs[2])
    ];

    for (const integration of crmIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  private async registerProjectManagementIntegrations(): Promise<void> {
    const pmConfigs = [
      { id: 'jira', name: 'Jira', category: 'project-mgmt' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'trello', name: 'Trello', category: 'project-mgmt' as const, status: 'production-ready' as const, credentials: {}, settings: {} },
      { id: 'asana', name: 'Asana', category: 'project-mgmt' as const, status: 'beta' as const, credentials: {}, settings: {} },
      { id: 'monday', name: 'Monday.com', category: 'project-mgmt' as const, status: 'beta' as const, credentials: {}, settings: {} }
    ];

    const pmIntegrations = [
      new JiraIntegration(pmConfigs[0]),
      new TrelloIntegration(pmConfigs[1]),
      new AsanaIntegration(pmConfigs[2]),
      new MondayIntegration(pmConfigs[3])
    ];

    for (const integration of pmIntegrations) {
      await this.ecosystem.registerIntegration(integration);
    }
  }

  async getAvailableIntegrations(): Promise<IntegrationConfig[]> {
    const integrations = this.ecosystem.getAllIntegrations();
    return integrations.map(integration => {
      const config = (integration as any).config as IntegrationConfig;
      return {
        id: integration.getId(),
        name: integration.getName(),
        category: integration.getCategory() as any,
        status: config.status,
        credentials: config.credentials,
        settings: config.settings
      };
    });
  }

  async getIntegrationsByCategory(category: string): Promise<IntegrationConfig[]> {
    const integrations = this.ecosystem.getIntegrationsByCategory(category);
    return integrations.map(integration => {
      const config = (integration as any).config as IntegrationConfig;
      return {
        id: integration.getId(),
        name: integration.getName(),
        category: integration.getCategory() as any,
        status: config.status,
        credentials: config.credentials,
        settings: config.settings
      };
    });
  }

  async enableIntegration(integrationId: string, config: any): Promise<void> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    // Update configuration
    (integration as any).config.credentials = { ...(integration as any).config.credentials, ...config.credentials };
    (integration as any).config.settings = { ...(integration as any).config.settings, ...config.settings };

    // Re-initialize with new config
    await integration.initialize();
    logger.info(`Integration ${integrationId} enabled successfully`);
  }

  async disableIntegration(integrationId: string): Promise<void> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    // Clear credentials to disable
    (integration as any).config.credentials = {};
    logger.info(`Integration ${integrationId} disabled successfully`);
  }

  async executeIntegrationAction(integrationId: string, action: string, params: any): Promise<any> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    // Check if integration has credentials (enabled)
    const hasCredentials = Object.keys((integration as any).config.credentials).length > 0;
    if (!hasCredentials) {
      throw new Error(`Integration ${integrationId} is not enabled`);
    }

    // Execute action based on integration type and action
    if (typeof (integration as any)[action] === 'function') {
      return await (integration as any)[action](...(Array.isArray(params) ? params : [params]));
    } else {
      throw new Error(`Action ${action} not supported by integration ${integrationId}`);
    }
  }

  async getIntegrationStatus(integrationId: string): Promise<any> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    const health = await integration.getHealthStatus();
    const hasCredentials = Object.keys((integration as any).config.credentials).length > 0;

    return {
      id: integration.getId(),
      name: integration.getName(),
      category: integration.getCategory(),
      enabled: hasCredentials,
      healthy: health.healthy,
      message: health.message,
      capabilities: integration.getCapabilities()
    };
  }

  async refreshIntegrationCredentials(integrationId: string): Promise<void> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    // Re-initialize to refresh credentials
    await integration.initialize();
    logger.info(`Credentials refreshed for integration ${integrationId}`);
  }

  async testIntegrationConnection(integrationId: string): Promise<boolean> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    try {
      return await integration.testConnection();
    } catch (error) {
      logger.error(`Connection test failed for integration ${integrationId}:`, error);
      return false;
    }
  }

  async getIntegrationMetrics(integrationId: string): Promise<any> {
    const integration = this.ecosystem.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    // Return basic metrics since getMetrics is not in BaseIntegration
    const health = await integration.getHealthStatus();
    return {
      id: integration.getId(),
      name: integration.getName(),
      category: integration.getCategory(),
      healthy: health.healthy,
      capabilities: integration.getCapabilities(),
      lastChecked: new Date().toISOString()
    };
  }
}