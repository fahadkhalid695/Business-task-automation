import axios, { AxiosInstance } from 'axios';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokCompletionRequest {
  messages: GrokMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface GrokCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class GrokService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
    this.baseURL = process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1';
    
    if (!this.apiKey) {
      console.warn('Grok API key not found. Please set GROK_API_KEY or XAI_API_KEY environment variable.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds timeout
    });
  }

  private async makeRequest(data: GrokCompletionRequest): Promise<string> {
    try {
      const response = await this.client.post<GrokCompletionResponse>('/chat/completions', {
        model: data.model || 'grok-beta',
        messages: data.messages,
        max_tokens: data.max_tokens || 1000,
        temperature: data.temperature || 0.7,
        top_p: data.top_p || 1,
        stream: false,
      });

      return response.data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('Grok API error:', error.response?.data || error.message);
      throw new Error(`Grok API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateText(prompt: string, options: any = {}): Promise<string> {
    try {
      const messages: GrokMessage[] = [
        {
          role: 'system',
          content: options.systemPrompt || 'You are a helpful AI assistant for business task automation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      return await this.makeRequest({
        messages,
        model: options.model || 'grok-beta',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
      });
    } catch (error) {
      console.error('Grok text generation error:', error);
      throw new Error('Failed to generate text with Grok');
    }
  }

  async analyzeText(text: string): Promise<any> {
    try {
      const prompt = `Analyze the following text and provide insights in JSON format with the following structure:
{
  "sentiment": "positive/negative/neutral",
  "topics": ["topic1", "topic2"],
  "entities": ["entity1", "entity2"],
  "summary": "brief summary",
  "confidence": 0.95
}

Text to analyze: "${text}"`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are an expert text analyst. Always respond with valid JSON only.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 500,
        temperature: 0.3,
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Grok text analysis error:', error);
      throw new Error('Failed to analyze text with Grok');
    }
  }

  async classifyText(text: string, categories: string[]): Promise<string> {
    try {
      const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}.
Respond with only the category name, nothing else.

Text: "${text}"`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a text classifier. Respond with only the category name.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 50,
        temperature: 0.1,
      });

      const classification = response.trim();
      return categories.includes(classification) ? classification : categories[0];
    } catch (error) {
      console.error('Grok text classification error:', error);
      return categories[0];
    }
  }

  async generateSummary(text: string): Promise<string> {
    try {
      const prompt = `Summarize the following text in a concise and clear manner:\n\n${text}`;

      return await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are an expert at creating concise, informative summaries.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 200,
        temperature: 0.5,
      });
    } catch (error) {
      console.error('Grok summary generation error:', error);
      throw new Error('Failed to generate summary with Grok');
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const prompt = `Translate the following text to ${targetLanguage}. Provide only the translation, no explanations:\n\n${text}`;

      return await this.makeRequest({
        messages: [{
          role: 'system',
          content: `You are a professional translator. Translate accurately to ${targetLanguage}.`
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: Math.ceil(text.length * 1.5),
        temperature: 0.3,
      });
    } catch (error) {
      console.error('Grok translation error:', error);
      return text;
    }
  }

  async generateWorkflowSuggestions(description: string): Promise<any[]> {
    try {
      const prompt = `Based on this workflow description: "${description}", suggest an optimized workflow with steps in JSON format:
[
  {
    "id": "step1",
    "name": "Step Name",
    "type": "action/condition/trigger",
    "description": "What this step does",
    "estimatedTime": "5 minutes",
    "dependencies": []
  }
]

Provide 3-5 logical steps for an efficient workflow.`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a workflow optimization expert. Always respond with valid JSON array only.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 1000,
        temperature: 0.6,
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Grok workflow suggestions error:', error);
      return [];
    }
  }

  async optimizeWorkflow(workflow: any): Promise<any> {
    try {
      const prompt = `Optimize this workflow for better efficiency and performance. Return the optimized workflow in the same JSON format:\n\n${JSON.stringify(workflow, null, 2)}`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a workflow optimization expert. Analyze and improve workflows for maximum efficiency.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 1500,
        temperature: 0.4,
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Grok workflow optimization error:', error);
      return workflow;
    }
  }

  async detectAnomalies(data: any[]): Promise<any[]> {
    try {
      const prompt = `Analyze this data for anomalies and unusual patterns. Return findings in JSON format:\n\n${JSON.stringify(data.slice(0, 100), null, 2)}`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a data analyst expert at detecting anomalies and patterns. Respond with JSON array of findings.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 800,
        temperature: 0.2,
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Grok anomaly detection error:', error);
      return [];
    }
  }

  async generateInsights(data: any): Promise<string[]> {
    try {
      const prompt = `Analyze this business data and generate actionable insights. Return as JSON array of strings:\n\n${JSON.stringify(data, null, 2)}`;

      const response = await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a business intelligence expert. Generate actionable insights from data. Respond with JSON array of insight strings.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 600,
        temperature: 0.6,
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Grok insights generation error:', error);
      return [];
    }
  }

  // Grok-specific features
  async generateCode(description: string, language: string = 'javascript'): Promise<string> {
    try {
      const prompt = `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.`;

      return await this.makeRequest({
        messages: [{
          role: 'system',
          content: `You are an expert ${language} developer. Generate clean, efficient, and well-documented code.`
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 1000,
        temperature: 0.3,
      });
    } catch (error) {
      console.error('Grok code generation error:', error);
      throw new Error('Failed to generate code with Grok');
    }
  }

  async explainCode(code: string): Promise<string> {
    try {
      const prompt = `Explain what this code does in simple terms:\n\n${code}`;

      return await this.makeRequest({
        messages: [{
          role: 'system',
          content: 'You are a code explainer. Break down code functionality in clear, simple terms.'
        }, {
          role: 'user',
          content: prompt
        }],
        model: 'grok-beta',
        max_tokens: 500,
        temperature: 0.4,
      });
    } catch (error) {
      console.error('Grok code explanation error:', error);
      throw new Error('Failed to explain code with Grok');
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest({
        messages: [{
          role: 'user',
          content: 'Hello'
        }],
        model: 'grok-beta',
        max_tokens: 10,
        temperature: 0.1,
      });
      return true;
    } catch (error) {
      console.error('Grok health check failed:', error);
      return false;
    }
  }
}

export const grokService = new GrokService();