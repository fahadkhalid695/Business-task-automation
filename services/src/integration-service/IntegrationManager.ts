import { IntegrationEcosystem, IntegrationConfig } from './IntegrationEcosystem';
import { logger } from '../shared/utils/Logger';

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
    return IntegrationManager.instance