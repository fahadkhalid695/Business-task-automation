import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';

export interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  customFields?: Record<string, any>;
}

export interface Deal {
  id?: string;
  name: string;
  amount: number;
  stage: string;
  contactId?: string;
  closeDate?: Date;
  probability?: number;
  customFields?: Record<string, any>;
}

export interface Company {
  id?: string;
  name: string;
  domain?: string;
  industry?: string;
  employees?: number;
  revenue?: number;
  customFields?: Record<string, any>;
}

// Salesforce Integration
export class SalesforceIntegration extends BaseIntegration {
  private client: AxiosInstance;
  private instanceUrl: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.instanceUrl = config.credentials.instanceUrl;
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
      baseURL: `${this.instanceUrl}/services/data/v58.0`,
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/sobjects');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Salesforce connected' : 'Salesforce connection failed'
    };
  }

  async createContact(contact: Contact): Promise<string | null> {
    try {
      const response = await this.client.post('/sobjects/Contact', {
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Email: contact.email,
        Phone: contact.phone,
        Title: contact.title,
        ...contact.customFields
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Salesforce create contact failed:', error);
      return null;
    }
  }

  async getContacts(limit: number = 100): Promise<Contact[]> {
    try {
      const query = `SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact LIMIT ${limit}`;
      const response = await this.client.get('/query', {
        params: { q: query }
      });
      
      return response.data.records?.map((record: any) => ({
        id: record.Id,
        firstName: record.FirstName,
        lastName: record.LastName,
        email: record.Email,
        phone: record.Phone,
        title: record.Title
      })) || [];
    } catch (error) {
      logger.error('Salesforce get contacts failed:', error);
      return [];
    }
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<boolean> {
    try {
      const updateData: any = {};
      if (updates.firstName) updateData.FirstName = updates.firstName;
      if (updates.lastName) updateData.LastName = updates.lastName;
      if (updates.email) updateData.Email = updates.email;
      if (updates.phone) updateData.Phone = updates.phone;
      if (updates.title) updateData.Title = updates.title;
      
      const response = await this.client.patch(`/sobjects/Contact/${contactId}`, updateData);
      return response.status === 204;
    } catch (error) {
      logger.error('Salesforce update contact failed:', error);
      return false;
    }
  }

  async createDeal(deal: Deal): Promise<string | null> {
    try {
      const response = await this.client.post('/sobjects/Opportunity', {
        Name: deal.name,
        Amount: deal.amount,
        StageName: deal.stage,
        CloseDate: deal.closeDate?.toISOString().split('T')[0],
        Probability: deal.probability,
        ...deal.customFields
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Salesforce create deal failed:', error);
      return null;
    }
  }

  async getDeals(limit: number = 100): Promise<Deal[]> {
    try {
      const query = `SELECT Id, Name, Amount, StageName, CloseDate, Probability FROM Opportunity LIMIT ${limit}`;
      const response = await this.client.get('/query', {
        params: { q: query }
      });
      
      return response.data.records?.map((record: any) => ({
        id: record.Id,
        name: record.Name,
        amount: record.Amount,
        stage: record.StageName,
        closeDate: record.CloseDate ? new Date(record.CloseDate) : undefined,
        probability: record.Probability
      })) || [];
    } catch (error) {
      logger.error('Salesforce get deals failed:', error);
      return [];
    }
  }

  async createCompany(company: Company): Promise<string | null> {
    try {
      const response = await this.client.post('/sobjects/Account', {
        Name: company.name,
        Website: company.domain,
        Industry: company.industry,
        NumberOfEmployees: company.employees,
        AnnualRevenue: company.revenue,
        ...company.customFields
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Salesforce create company failed:', error);
      return null;
    }
  }
}

// HubSpot Integration
export class HubSpotIntegration extends BaseIntegration {
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
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/crm/v3/objects/contacts', {
        params: { limit: 1 }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'HubSpot connected' : 'HubSpot connection failed'
    };
  }

  async createContact(contact: Contact): Promise<string | null> {
    try {
      const response = await this.client.post('/crm/v3/objects/contacts', {
        properties: {
          firstname: contact.firstName,
          lastname: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          jobtitle: contact.title,
          ...contact.customFields
        }
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('HubSpot create contact failed:', error);
      return null;
    }
  }

  async getContacts(limit: number = 100): Promise<Contact[]> {
    try {
      const response = await this.client.get('/crm/v3/objects/contacts', {
        params: {
          limit,
          properties: 'firstname,lastname,email,phone,company,jobtitle'
        }
      });
      
      return response.data.results?.map((contact: any) => ({
        id: contact.id,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        email: contact.properties.email,
        phone: contact.properties.phone,
        company: contact.properties.company,
        title: contact.properties.jobtitle
      })) || [];
    } catch (error) {
      logger.error('HubSpot get contacts failed:', error);
      return [];
    }
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<boolean> {
    try {
      const properties: any = {};
      if (updates.firstName) properties.firstname = updates.firstName;
      if (updates.lastName) properties.lastname = updates.lastName;
      if (updates.email) properties.email = updates.email;
      if (updates.phone) properties.phone = updates.phone;
      if (updates.company) properties.company = updates.company;
      if (updates.title) properties.jobtitle = updates.title;
      
      const response = await this.client.patch(`/crm/v3/objects/contacts/${contactId}`, {
        properties
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error('HubSpot update contact failed:', error);
      return false;
    }
  }

  async createDeal(deal: Deal): Promise<string | null> {
    try {
      const response = await this.client.post('/crm/v3/objects/deals', {
        properties: {
          dealname: deal.name,
          amount: deal.amount.toString(),
          dealstage: deal.stage,
          closedate: deal.closeDate?.toISOString(),
          ...deal.customFields
        }
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('HubSpot create deal failed:', error);
      return null;
    }
  }

  async getDeals(limit: number = 100): Promise<Deal[]> {
    try {
      const response = await this.client.get('/crm/v3/objects/deals', {
        params: {
          limit,
          properties: 'dealname,amount,dealstage,closedate'
        }
      });
      
      return response.data.results?.map((deal: any) => ({
        id: deal.id,
        name: deal.properties.dealname,
        amount: parseFloat(deal.properties.amount) || 0,
        stage: deal.properties.dealstage,
        closeDate: deal.properties.closedate ? new Date(deal.properties.closedate) : undefined
      })) || [];
    } catch (error) {
      logger.error('HubSpot get deals failed:', error);
      return [];
    }
  }

  async createCompany(company: Company): Promise<string | null> {
    try {
      const response = await this.client.post('/crm/v3/objects/companies', {
        properties: {
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          numberofemployees: company.employees?.toString(),
          annualrevenue: company.revenue?.toString(),
          ...company.customFields
        }
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('HubSpot create company failed:', error);
      return null;
    }
  }
}

// Pipedrive Integration
export class PipedriveIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: false,
      batch: true
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: `https://${this.config.credentials.companyDomain}.pipedrive.com/api/v1`,
      params: {
        api_token: this.config.credentials.apiToken
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.data.success;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Pipedrive connected' : 'Pipedrive connection failed'
    };
  }

  async createContact(contact: Contact): Promise<string | null> {
    try {
      const response = await this.client.post('/persons', {
        name: `${contact.firstName} ${contact.lastName}`,
        email: [{ value: contact.email, primary: true }],
        phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
        job_title: contact.title,
        org_name: contact.company
      });
      
      return response.data.success ? response.data.data.id.toString() : null;
    } catch (error) {
      logger.error('Pipedrive create contact failed:', error);
      return null;
    }
  }

  async getContacts(limit: number = 100): Promise<Contact[]> {
    try {
      const response = await this.client.get('/persons', {
        params: { limit }
      });
      
      if (!response.data.success) return [];
      
      return response.data.data?.map((person: any) => {
        const nameParts = person.name?.split(' ') || ['', ''];
        return {
          id: person.id.toString(),
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          email: person.email?.[0]?.value || '',
          phone: person.phone?.[0]?.value,
          title: person.job_title,
          company: person.org_name
        };
      }) || [];
    } catch (error) {
      logger.error('Pipedrive get contacts failed:', error);
      return [];
    }
  }

  async createDeal(deal: Deal): Promise<string | null> {
    try {
      const response = await this.client.post('/deals', {
        title: deal.name,
        value: deal.amount,
        stage_id: deal.stage,
        expected_close_date: deal.closeDate?.toISOString().split('T')[0],
        person_id: deal.contactId
      });
      
      return response.data.success ? response.data.data.id.toString() : null;
    } catch (error) {
      logger.error('Pipedrive create deal failed:', error);
      return null;
    }
  }

  async getDeals(limit: number = 100): Promise<Deal[]> {
    try {
      const response = await this.client.get('/deals', {
        params: { limit }
      });
      
      if (!response.data.success) return [];
      
      return response.data.data?.map((deal: any) => ({
        id: deal.id.toString(),
        name: deal.title,
        amount: deal.value || 0,
        stage: deal.stage_name,
        closeDate: deal.expected_close_date ? new Date(deal.expected_close_date) : undefined,
        contactId: deal.person_id?.toString()
      })) || [];
    } catch (error) {
      logger.error('Pipedrive get deals failed:', error);
      return [];
    }
  }
}