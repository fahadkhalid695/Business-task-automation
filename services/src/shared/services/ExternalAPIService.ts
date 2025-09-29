import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/Logger';

export class ExternalAPIService {
  private static instance: ExternalAPIService;
  private clients: Map<string, AxiosInstance> = new Map();

  static getInstance(): ExternalAPIService {
    if (!ExternalAPIService.instance) {
      ExternalAPIService.instance = new ExternalAPIService();
    }
    return ExternalAPIService.instance;
  }

  // Gmail API Integration
  async setupGmailAPI(): Promise<void> {
    const gmailClient = axios.create({
      baseURL: 'https://gmail.googleapis.com/gmail/v1',
      headers: {
        'Authorization': `Bearer ${process.env.GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.clients.set('gmail', gmailClient);
    logger.info('✅ Gmail API configured');
  }

  // Google Calendar API
  async setupCalendarAPI(): Promise<void> {
    const calendarClient = axios.create({
      baseURL: 'https://www.googleapis.com/calendar/v3',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_CALENDAR_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.clients.set('calendar', calendarClient);
    logger.info('✅ Google Calendar API configured');
  }

  // Slack API Integration
  async setupSlackAPI(): Promise<void> {
    const slackClient = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.clients.set('slack', slackClient);
    logger.info('✅ Slack API configured');
  }

  // OpenAI API Integration
  async setupOpenAI(): Promise<void> {
    const openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.clients.set('openai', openaiClient);
    logger.info('✅ OpenAI API configured');
  }

  getClient(service: string): AxiosInstance | undefined {
    return this.clients.get(service);
  }

  async initializeAll(): Promise<void> {
    await Promise.all([
      this.setupGmailAPI(),
      this.setupCalendarAPI(), 
      this.setupSlackAPI(),
      this.setupOpenAI()
    ]);
  }
}