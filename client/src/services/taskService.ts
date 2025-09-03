import axios from 'axios';
import { Task, TaskStatus, TaskType, Priority, ApiResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export interface CreateTaskRequest {
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  estimatedDuration: number;
  dueDate: string;
  data?: any;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  estimatedDuration?: number;
  dueDate?: string;
  data?: any;
}

export interface TaskFilters {
  status?: TaskStatus[];
  type?: TaskType[];
  priority?: Priority[];
  assignedTo?: string;
  createdBy?: string;
  search?: string;
  page?: number;
  limit?: number;
}

class TaskService {
  private baseURL = `${API_BASE_URL}/tasks`;

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async getTasks(filters?: TaskFilters): Promise<ApiResponse<Task[]>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response = await axios.get(`${this.baseURL}?${params.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async getTask(id: string): Promise<ApiResponse<Task>> {
    const response = await axios.get(`${this.baseURL}/${id}`, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async createTask(taskData: CreateTaskRequest): Promise<ApiResponse<Task>> {
    const response = await axios.post(this.baseURL, taskData, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<ApiResponse<Task>> {
    const response = await axios.patch(`${this.baseURL}/${id}`, updates, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async deleteTask(id: string): Promise<ApiResponse<void>> {
    const response = await axios.delete(`${this.baseURL}/${id}`, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<ApiResponse<Task>> {
    const response = await axios.patch(`${this.baseURL}/${id}/status`, { status }, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async startTask(id: string): Promise<ApiResponse<Task>> {
    const response = await axios.post(`${this.baseURL}/${id}/start`, {}, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async pauseTask(id: string): Promise<ApiResponse<Task>> {
    const response = await axios.post(`${this.baseURL}/${id}/pause`, {}, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async stopTask(id: string): Promise<ApiResponse<Task>> {
    const response = await axios.post(`${this.baseURL}/${id}/stop`, {}, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  async uploadAttachment(taskId: string, file: File): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${this.baseURL}/${taskId}/attachments`, formData, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async getTaskMetrics(): Promise<ApiResponse<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageCompletionTime: number;
    tasksByStatus: Record<TaskStatus, number>;
    tasksByType: Record<TaskType, number>;
  }>> {
    const response = await axios.get(`${this.baseURL}/metrics`, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }
}

export const taskService = new TaskService();