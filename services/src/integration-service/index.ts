import { IntegrationService } from './IntegrationService';
import { GmailAdapter } from './adapters/GmailAdapter';
import { OutlookAdapter } from './adapters/OutlookAdapter';
import { SlackAdapter } from './adapters/SlackAdapter';
import { SalesforceAdapter } from './adapters/SalesforceAdapter';
import { MicrosoftTeamsAdapter } from './adapters/MicrosoftTeamsAdapter';
import { WebhookHandler } from './WebhookHandler';
import { IntegrationHealthMonitor } from './IntegrationHealthMonitor';

export {
  IntegrationService,
  GmailAdapter,
  OutlookAdapter,
  SlackAdapter,
  SalesforceAdapter,
  MicrosoftTeamsAdapter,
  WebhookHandler,
  IntegrationHealthMonitor
};

export * from './types/IntegrationTypes';