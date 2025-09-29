import { BaseIntegration, IntegrationConfig } from '../IntegrationEcosystem';
import { logger } from '../../shared/utils/Logger';
import axios, { AxiosInstance } from 'axios';

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  modifiedTime: Date;
  webViewLink?: string;
  downloadUrl?: string;
  isFolder: boolean;
  parentId?: string;
}

export interface UploadOptions {
  name: string;
  content: Buffer;
  mimeType: string;
  parentId?: string;
}

// Google Drive Integration
export class GoogleDriveIntegration extends BaseIntegration {
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
      baseURL: 'https://www.googleapis.com/drive/v3',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/about', {
        params: { fields: 'user' }
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
      message: isHealthy ? 'Google Drive connected' : 'Google Drive connection failed'
    };
  }

  async listFiles(parentId?: string, pageSize: number = 100): Promise<FileItem[]> {
    try {
      const params: any = {
        pageSize,
        fields: 'files(id,name,size,mimeType,modifiedTime,webViewLink,parents)'
      };
      
      if (parentId) {
        params.q = `'${parentId}' in parents`;
      }

      const response = await this.client.get('/files', { params });
      
      return response.data.files?.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: parseInt(file.size) || 0,
        mimeType: file.mimeType,
        modifiedTime: new Date(file.modifiedTime),
        webViewLink: file.webViewLink,
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
        parentId: file.parents?.[0]
      })) || [];
    } catch (error) {
      logger.error('Google Drive list files failed:', error);
      return [];
    }
  }

  async uploadFile(options: UploadOptions): Promise<string | null> {
    try {
      // First, create the file metadata
      const metadata = {
        name: options.name,
        parents: options.parentId ? [options.parentId] : undefined
      };

      const form = new FormData();
      form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
      form.append('file', options.content, { 
        filename: options.name,
        contentType: options.mimeType 
      });

      const response = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.config.credentials.accessToken}`,
            ...form.getHeaders()
          }
        }
      );

      return response.data.id;
    } catch (error) {
      logger.error('Google Drive upload failed:', error);
      return null;
    }
  }

  async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const response = await this.client.get(`/files/${fileId}`, {
        params: { alt: 'media' },
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Google Drive download failed:', error);
      return null;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/files/${fileId}`);
      return response.status === 204;
    } catch (error) {
      logger.error('Google Drive delete failed:', error);
      return false;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<string | null> {
    try {
      const response = await this.client.post('/files', {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Google Drive create folder failed:', error);
      return null;
    }
  }
}

// OneDrive Integration
export class OneDriveIntegration extends BaseIntegration {
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
      const response = await this.client.get('/me/drive');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'OneDrive connected' : 'OneDrive connection failed'
    };
  }

  async listFiles(parentId?: string): Promise<FileItem[]> {
    try {
      const path = parentId ? `/me/drive/items/${parentId}/children` : '/me/drive/root/children';
      const response = await this.client.get(path);
      
      return response.data.value?.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size || 0,
        mimeType: item.file?.mimeType || 'application/vnd.microsoft.folder',
        modifiedTime: new Date(item.lastModifiedDateTime),
        webViewLink: item.webUrl,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
        isFolder: !!item.folder,
        parentId: item.parentReference?.id
      })) || [];
    } catch (error) {
      logger.error('OneDrive list files failed:', error);
      return [];
    }
  }

  async uploadFile(options: UploadOptions): Promise<string | null> {
    try {
      const path = options.parentId 
        ? `/me/drive/items/${options.parentId}:/${options.name}:/content`
        : `/me/drive/root:/${options.name}:/content`;

      const response = await this.client.put(path, options.content, {
        headers: {
          'Content-Type': options.mimeType
        }
      });

      return response.data.id;
    } catch (error) {
      logger.error('OneDrive upload failed:', error);
      return null;
    }
  }

  async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const response = await this.client.get(`/me/drive/items/${fileId}/content`, {
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('OneDrive download failed:', error);
      return null;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/me/drive/items/${fileId}`);
      return response.status === 204;
    } catch (error) {
      logger.error('OneDrive delete failed:', error);
      return false;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<string | null> {
    try {
      const path = parentId ? `/me/drive/items/${parentId}/children` : '/me/drive/root/children';
      
      const response = await this.client.post(path, {
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('OneDrive create folder failed:', error);
      return null;
    }
  }
}

// Dropbox Integration
export class DropboxIntegration extends BaseIntegration {
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
      baseURL: 'https://api.dropboxapi.com/2',
      headers: {
        'Authorization': `Bearer ${this.config.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post('/users/get_current_account');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; message?: string }> {
    const isHealthy = await this.testConnection();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Dropbox connected' : 'Dropbox connection failed'
    };
  }

  async listFiles(path: string = ''): Promise<FileItem[]> {
    try {
      const response = await this.client.post('/files/list_folder', {
        path: path || '',
        recursive: false
      });
      
      return response.data.entries?.map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        size: entry.size || 0,
        mimeType: entry['.tag'] === 'folder' ? 'application/vnd.dropbox.folder' : 'application/octet-stream',
        modifiedTime: entry.server_modified ? new Date(entry.server_modified) : new Date(),
        isFolder: entry['.tag'] === 'folder',
        parentId: entry.path_lower.split('/').slice(0, -1).join('/') || '/'
      })) || [];
    } catch (error) {
      logger.error('Dropbox list files failed:', error);
      return [];
    }
  }

  async uploadFile(options: UploadOptions): Promise<string | null> {
    try {
      const path = options.parentId ? `${options.parentId}/${options.name}` : `/${options.name}`;
      
      const response = await axios.post(
        'https://content.dropboxapi.com/2/files/upload',
        options.content,
        {
          headers: {
            'Authorization': `Bearer ${this.config.credentials.accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path,
              mode: 'add',
              autorename: true
            })
          }
        }
      );

      return response.data.id;
    } catch (error) {
      logger.error('Dropbox upload failed:', error);
      return null;
    }
  }

  async downloadFile(path: string): Promise<Buffer | null> {
    try {
      const response = await axios.post(
        'https://content.dropboxapi.com/2/files/download',
        null,
        {
          headers: {
            'Authorization': `Bearer ${this.config.credentials.accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path })
          },
          responseType: 'arraybuffer'
        }
      );
      
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Dropbox download failed:', error);
      return null;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      const response = await this.client.post('/files/delete_v2', { path });
      return response.status === 200;
    } catch (error) {
      logger.error('Dropbox delete failed:', error);
      return false;
    }
  }

  async createFolder(name: string, parentPath: string = ''): Promise<string | null> {
    try {
      const path = parentPath ? `${parentPath}/${name}` : `/${name}`;
      
      const response = await this.client.post('/files/create_folder_v2', {
        path,
        autorename: true
      });
      
      return response.data.metadata.id;
    } catch (error) {
      logger.error('Dropbox create folder failed:', error);
      return null;
    }
  }
}