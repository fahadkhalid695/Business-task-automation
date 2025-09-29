import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  location?: string;
  recurrence?: string;
}

// Google Calendar Integration
export class GoogleCalendarIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/calendar/v3',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/calendars/primary');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Google Calendar connected' : 'Google Calendar connection failed'
    };
  }

  async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<string | null> {
    try {
      const googleEvent = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'UTC'
        },
        attendees: event.attendees?.map(email => ({ email })) || [],
        recurrence: event.recurrence ? [event.recurrence] : undefined
      };

      const response = await this.client.post(`/calendars/${calendarId}/events`, googleEvent);
      return response.data.id;
    } catch (error) {
      logger.error('Google Calendar create event failed:', error);
      return null;
    }
  }

  async getEvents(calendarId: string = 'primary', timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      const params: any = {
        singleEvents: true,
        orderBy: 'startTime'
      };
      
      if (timeMin) params.timeMin = timeMin.toISOString();
      if (timeMax) params.timeMax = timeMax.toISOString();

      const response = await this.client.get(`/calendars/${calendarId}/events`, { params });
      
      return response.data.items?.map((item: any) => ({
        id: item.id,
        title: item.summary,
        description: item.description,
        startTime: new Date(item.start.dateTime || item.start.date),
        endTime: new Date(item.end.dateTime || item.end.date),
        attendees: item.attendees?.map((att: any) => att.email) || [],
        location: item.location
      })) || [];
    } catch (error) {
      logger.error('Google Calendar get events failed:', error);
      return [];
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>, calendarId: string = 'primary'): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (event.title) updateData.summary = event.title;
      if (event.description) updateData.description = event.description;
      if (event.location) updateData.location = event.location;
      if (event.startTime) {
        updateData.start = {
          dateTime: event.startTime.toISOString(),
          timeZone: 'UTC'
        };
      }
      if (event.endTime) {
        updateData.end = {
          dateTime: event.endTime.toISOString(),
          timeZone: 'UTC'
        };
      }
      if (event.attendees) {
        updateData.attendees = event.attendees.map(email => ({ email }));
      }

      const response = await this.client.put(`/calendars/${calendarId}/events/${eventId}`, updateData);
      return response.status === 200;
    } catch (error) {
      logger.error('Google Calendar update event failed:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    try {
      const response = await this.client.delete(`/calendars/${calendarId}/events/${eventId}`);
      return response.status === 204;
    } catch (error) {
      logger.error('Google Calendar delete event failed:', error);
      return false;
    }
  }
}

// Outlook Calendar Integration
export class OutlookCalendarIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/me/calendar');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Outlook Calendar connected' : 'Outlook Calendar connection failed'
    };
  }

  async createEvent(event: CalendarEvent): Promise<string | null> {
    try {
      const outlookEvent = {
        subject: event.title,
        body: {
          contentType: 'HTML',
          content: event.description || ''
        },
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'UTC'
        },
        location: {
          displayName: event.location || ''
        },
        attendees: event.attendees?.map(email => ({
          emailAddress: {
            address: email,
            name: email
          }
        })) || []
      };

      const response = await this.client.post('/me/events', outlookEvent);
      return response.data.id;
    } catch (error) {
      logger.error('Outlook Calendar create event failed:', error);
      return null;
    }
  }

  async getEvents(startTime?: Date, endTime?: Date): Promise<CalendarEvent[]> {
    try {
      const params: any = {
        $orderby: 'start/dateTime'
      };
      
      if (startTime && endTime) {
        params.$filter = `start/dateTime ge '${startTime.toISOString()}' and end/dateTime le '${endTime.toISOString()}'`;
      }

      const response = await this.client.get('/me/events', { params });
      
      return response.data.value?.map((item: any) => ({
        id: item.id,
        title: item.subject,
        description: item.body?.content,
        startTime: new Date(item.start.dateTime),
        endTime: new Date(item.end.dateTime),
        attendees: item.attendees?.map((att: any) => att.emailAddress.address) || [],
        location: item.location?.displayName
      })) || [];
    } catch (error) {
      logger.error('Outlook Calendar get events failed:', error);
      return [];
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (event.title) updateData.subject = event.title;
      if (event.description) {
        updateData.body = {
          contentType: 'HTML',
          content: event.description
        };
      }
      if (event.location) {
        updateData.location = {
          displayName: event.location
        };
      }
      if (event.startTime) {
        updateData.start = {
          dateTime: event.startTime.toISOString(),
          timeZone: 'UTC'
        };
      }
      if (event.endTime) {
        updateData.end = {
          dateTime: event.endTime.toISOString(),
          timeZone: 'UTC'
        };
      }
      if (event.attendees) {
        updateData.attendees = event.attendees.map(email => ({
          emailAddress: {
            address: email,
            name: email
          }
        }));
      }

      const response = await this.client.patch(`/me/events/${eventId}`, updateData);
      return response.status === 200;
    } catch (error) {
      logger.error('Outlook Calendar update event failed:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/me/events/${eventId}`);
      return response.status === 204;
    } catch (error) {
      logger.error('Outlook Calendar delete event failed:', error);
      return false;
    }
  }
}