import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';

export interface Project {
  id?: string;
  name: string;
  description?: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  members?: string[];
  customFields?: Record<string, any>;
}

export interface Task {
  id?: string;
  name: string;
  description?: string;
  status: string;
  assignee?: string;
  dueDate?: Date;
  priority?: string;
  projectId?: string;
  customFields?: Record<string, any>;
}

export interface Comment {
  id?: string;
  text: string;
  author?: string;
  createdAt?: Date;
  taskId?: string;
}

// Jira Integration
export class JiraIntegration extends BaseIntegration {
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
      baseURL: `https://${this.config.credentials.domain}.atlassian.net/rest/api/3`,
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${this.config.credentials.email}:${this.config.credentials.apiToken}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/myself');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Jira connected' : 'Jira connection failed'
    };
  }

  async getProjects(): Promise<Project[]> {
    try {
      const response = await this.client.get('/project');
      
      return response.data?.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.projectCategory?.name || 'Active'
      })) || [];
    } catch (error) {
      logger.error('Jira get projects failed:', error);
      return [];
    }
  }

  async createIssue(task: Task): Promise<string | null> {
    try {
      const response = await this.client.post('/issue', {
        fields: {
          project: { key: task.projectId },
          summary: task.name,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: task.description || ''
              }]
            }]
          },
          issuetype: { name: 'Task' },
          assignee: task.assignee ? { accountId: task.assignee } : undefined,
          duedate: task.dueDate?.toISOString().split('T')[0],
          priority: task.priority ? { name: task.priority } : undefined
        }
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Jira create issue failed:', error);
      return null;
    }
  }

  async getIssues(projectKey?: string, jql?: string): Promise<Task[]> {
    try {
      let query = jql || 'order by created DESC';
      if (projectKey && !jql) {
        query = `project = ${projectKey} order by created DESC`;
      }

      const response = await this.client.get('/search', {
        params: {
          jql: query,
          maxResults: 100,
          fields: 'summary,description,status,assignee,duedate,priority,project'
        }
      });
      
      return response.data.issues?.map((issue: any) => ({
        id: issue.id,
        name: issue.fields.summary,
        description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.accountId,
        dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : undefined,
        priority: issue.fields.priority?.name,
        projectId: issue.fields.project.key
      })) || [];
    } catch (error) {
      logger.error('Jira get issues failed:', error);
      return [];
    }
  }

  async updateIssue(issueId: string, updates: Partial<Task>): Promise<boolean> {
    try {
      const fields: any = {};
      
      if (updates.name) fields.summary = updates.name;
      if (updates.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: updates.description
            }]
          }]
        };
      }
      if (updates.assignee) fields.assignee = { accountId: updates.assignee };
      if (updates.dueDate) fields.duedate = updates.dueDate.toISOString().split('T')[0];
      if (updates.priority) fields.priority = { name: updates.priority };

      const response = await this.client.put(`/issue/${issueId}`, { fields });
      return response.status === 204;
    } catch (error) {
      logger.error('Jira update issue failed:', error);
      return false;
    }
  }

  async addComment(issueId: string, comment: string): Promise<string | null> {
    try {
      const response = await this.client.post(`/issue/${issueId}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: comment
            }]
          }]
        }
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Jira add comment failed:', error);
      return null;
    }
  }
}

// Trello Integration
export class TrelloIntegration extends BaseIntegration {
  private client: AxiosInstance;

  constructor(config: IntegrationConfig) {
    super(config);
    this.capabilities = {
      read: true,
      write: true,
      webhook: true,
      realtime: true,
      batch: false
    };
  }

  async initialize(): Promise<void> {
    this.client = axios.create({
      baseURL: 'https://api.trello.com/1',
      params: {
        key: this.config.credentials.apiKey,
        token: this.config.credentials.token
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/members/me');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Trello connected' : 'Trello connection failed'
    };
  }

  async getBoards(): Promise<Project[]> {
    try {
      const response = await this.client.get('/members/me/boards');
      
      return response.data?.map((board: any) => ({
        id: board.id,
        name: board.name,
        description: board.desc,
        status: board.closed ? 'Closed' : 'Active'
      })) || [];
    } catch (error) {
      logger.error('Trello get boards failed:', error);
      return [];
    }
  }

  async createCard(task: Task): Promise<string | null> {
    try {
      const response = await this.client.post('/cards', {
        name: task.name,
        desc: task.description,
        idList: task.projectId, // In Trello, this would be a list ID
        due: task.dueDate?.toISOString(),
        idMembers: task.assignee ? [task.assignee] : undefined
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Trello create card failed:', error);
      return null;
    }
  }

  async getCards(boardId: string): Promise<Task[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/cards`);
      
      return response.data?.map((card: any) => ({
        id: card.id,
        name: card.name,
        description: card.desc,
        status: card.list?.name || 'Unknown',
        dueDate: card.due ? new Date(card.due) : undefined,
        projectId: boardId
      })) || [];
    } catch (error) {
      logger.error('Trello get cards failed:', error);
      return [];
    }
  }

  async updateCard(cardId: string, updates: Partial<Task>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.desc = updates.description;
      if (updates.dueDate) updateData.due = updates.dueDate.toISOString();

      const response = await this.client.put(`/cards/${cardId}`, updateData);
      return response.status === 200;
    } catch (error) {
      logger.error('Trello update card failed:', error);
      return false;
    }
  }

  async addComment(cardId: string, comment: string): Promise<string | null> {
    try {
      const response = await this.client.post(`/cards/${cardId}/actions/comments`, {
        text: comment
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Trello add comment failed:', error);
      return null;
    }
  }
}

// Asana Integration
export class AsanaIntegration extends BaseIntegration {
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
      baseURL: 'https://app.asana.com/api/1.0',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/me');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Asana connected' : 'Asana connection failed'
    };
  }

  async getProjects(): Promise<Project[]> {
    try {
      const response = await this.client.get('/projects');
      
      return response.data.data?.map((project: any) => ({
        id: project.gid,
        name: project.name,
        description: project.notes,
        status: project.archived ? 'Archived' : 'Active'
      })) || [];
    } catch (error) {
      logger.error('Asana get projects failed:', error);
      return [];
    }
  }

  async createTask(task: Task): Promise<string | null> {
    try {
      const response = await this.client.post('/tasks', {
        data: {
          name: task.name,
          notes: task.description,
          projects: task.projectId ? [task.projectId] : undefined,
          assignee: task.assignee,
          due_on: task.dueDate?.toISOString().split('T')[0]
        }
      });
      
      return response.data.data.gid;
    } catch (error) {
      logger.error('Asana create task failed:', error);
      return null;
    }
  }

  async getTasks(projectId?: string): Promise<Task[]> {
    try {
      const endpoint = projectId ? `/projects/${projectId}/tasks` : '/tasks';
      const response = await this.client.get(endpoint, {
        params: {
          opt_fields: 'name,notes,completed,assignee,due_on,projects'
        }
      });
      
      return response.data.data?.map((task: any) => ({
        id: task.gid,
        name: task.name,
        description: task.notes,
        status: task.completed ? 'Completed' : 'In Progress',
        assignee: task.assignee?.gid,
        dueDate: task.due_on ? new Date(task.due_on) : undefined,
        projectId: task.projects?.[0]?.gid
      })) || [];
    } catch (error) {
      logger.error('Asana get tasks failed:', error);
      return [];
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.notes = updates.description;
      if (updates.assignee) updateData.assignee = updates.assignee;
      if (updates.dueDate) updateData.due_on = updates.dueDate.toISOString().split('T')[0];

      const response = await this.client.put(`/tasks/${taskId}`, {
        data: updateData
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error('Asana update task failed:', error);
      return false;
    }
  }
}

// Monday.com Integration
export class MondayIntegration extends BaseIntegration {
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
      baseURL: 'https://api.monday.com/v2',
      headers: {
        'Authorization': this.config.credentials.apiToken,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post('', {
        query: 'query { me { id name } }'
      });
      return response.data.data?.me?.id !== undefined;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Monday.com connected' : 'Monday.com connection failed'
    };
  }

  async getBoards(): Promise<Project[]> {
    try {
      const response = await this.client.post('', {
        query: `
          query {
            boards {
              id
              name
              description
              state
            }
          }
        `
      });
      
      return response.data.data?.boards?.map((board: any) => ({
        id: board.id,
        name: board.name,
        description: board.description,
        status: board.state
      })) || [];
    } catch (error) {
      logger.error('Monday.com get boards failed:', error);
      return [];
    }
  }

  async createItem(task: Task): Promise<string | null> {
    try {
      const response = await this.client.post('', {
        query: `
          mutation {
            create_item (
              board_id: ${task.projectId}
              item_name: "${task.name}"
            ) {
              id
            }
          }
        `
      });
      
      return response.data.data?.create_item?.id;
    } catch (error) {
      logger.error('Monday.com create item failed:', error);
      return null;
    }
  }

  async getItems(boardId: string): Promise<Task[]> {
    try {
      const response = await this.client.post('', {
        query: `
          query {
            boards(ids: [${boardId}]) {
              items {
                id
                name
                state
                column_values {
                  id
                  text
                }
              }
            }
          }
        `
      });
      
      const items = response.data.data?.boards?.[0]?.items || [];
      
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        status: item.state,
        projectId: boardId
      }));
    } catch (error) {
      logger.error('Monday.com get items failed:', error);
      return [];
    }
  }
}