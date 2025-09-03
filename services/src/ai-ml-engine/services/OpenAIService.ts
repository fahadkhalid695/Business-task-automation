import axios, { AxiosInstance } from 'axios';
import { logger } from '../../shared/utils/logger';
import { InferenceRequest, InferenceResult, AIServiceError } from '../types/AITypes';

export class OpenAIService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('OpenAI API key not found. OpenAI services will not be available.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  /**
   * Generate text using OpenAI's chat completion API
   */
  async generateText(request: InferenceRequest): Promise<InferenceResult> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const messages = [
        {
          role: 'user',
          content: request.input
        }
      ];

      // Add system prompt if provided
      if (request.options?.systemPrompt) {
        messages.unshift({
          role: 'system',
          content: request.options.systemPrompt
        });
      }

      // Add conversation history if provided
      if (request.options?.conversationHistory) {
        messages.splice(-1, 0, ...request.options.conversationHistory);
      }

      const response = await this.client.post('/chat/completions', {
        model: this.getOpenAIModel(request.modelId),
        messages,
        max_tokens: request.options?.maxTokens || 1000,
        temperature: request.options?.temperature || 0.7,
        top_p: request.options?.topP || 1.0,
        frequency_penalty: request.options?.frequencyPenalty || 0,
        presence_penalty: request.options?.presencePenalty || 0,
        stop: request.options?.stop
      });

      const responseTime = Date.now() - startTime;
      const tokensUsed = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(request.modelId, tokensUsed);

      return {
        success: true,
        output: response.data.choices[0]?.message?.content || '',
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          tokensUsed,
          responseTime,
          cost,
          finishReason: response.data.choices[0]?.finish_reason
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('OpenAI text generation failed:', error);
      
      return {
        success: false,
        output: null,
        error: this.formatError(error),
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          responseTime
        }
      };
    }
  }

  /**
   * Classify text using OpenAI
   */
  async classify(request: InferenceRequest, categories?: string[]): Promise<InferenceResult> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      let prompt = request.input;
      
      // If categories are provided, format as classification task
      if (categories && categories.length > 0) {
        prompt = `Classify the following text into one of these categories: ${categories.join(', ')}\n\nText: "${request.input}"\n\nCategory:`;
      }

      const response = await this.client.post('/chat/completions', {
        model: this.getOpenAIModel(request.modelId),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: request.options?.maxTokens || 100,
        temperature: request.options?.temperature || 0.3,
        top_p: request.options?.topP || 1.0
      });

      const responseTime = Date.now() - startTime;
      const tokensUsed = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(request.modelId, tokensUsed);

      const output = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Extract confidence if available (for classification tasks)
      let confidence: number | undefined;
      if (categories && categories.includes(output.toLowerCase())) {
        confidence = 0.8; // Default confidence for exact category match
      }

      return {
        success: true,
        output,
        confidence,
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          tokensUsed,
          responseTime,
          cost,
          categories,
          classificationType: 'text_classification'
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('OpenAI classification failed:', error);
      
      return {
        success: false,
        output: null,
        error: this.formatError(error),
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          responseTime
        }
      };
    }
  }

  /**
   * Translate text using OpenAI
   */
  async translate(request: InferenceRequest, sourceLang: string, targetLang: string): Promise<InferenceResult> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Provide only the translation without any additional text or explanation.\n\nText: "${request.input}"\n\nTranslation:`;

      const response = await this.client.post('/chat/completions', {
        model: this.getOpenAIModel(request.modelId),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: request.options?.maxTokens || Math.max(request.input.length * 2, 500),
        temperature: request.options?.temperature || 0.3,
        top_p: request.options?.topP || 1.0
      });

      const responseTime = Date.now() - startTime;
      const tokensUsed = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(request.modelId, tokensUsed);

      return {
        success: true,
        output: response.data.choices[0]?.message?.content?.trim() || '',
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          tokensUsed,
          responseTime,
          cost,
          sourceLang,
          targetLang,
          translationType: 'text_translation'
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('OpenAI translation failed:', error);
      
      return {
        success: false,
        output: null,
        error: this.formatError(error),
        timestamp: new Date(),
        metadata: {
          modelId: request.modelId,
          responseTime,
          sourceLang,
          targetLang
        }
      };
    }
  }

  /**
   * Check if OpenAI service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Make a simple API call to check connectivity
      const response = await this.client.get('/models', {
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      logger.error('OpenAI health check failed:', error);
      return false;
    }
  }

  /**
   * Get available OpenAI models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (!this.apiKey) {
        return [];
      }

      const response = await this.client.get('/models');
      return response.data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id);
    } catch (error) {
      logger.error('Failed to fetch OpenAI models:', error);
      return [];
    }
  }

  /**
   * Map internal model ID to OpenAI model name
   */
  private getOpenAIModel(modelId: string): string {
    const modelMap: Record<string, string> = {
      'openai-gpt-3.5': 'gpt-3.5-turbo',
      'openai-gpt-4': 'gpt-4',
      'openai-classification': 'gpt-3.5-turbo',
      'openai-translation': 'gpt-3.5-turbo'
    };

    return modelMap[modelId] || 'gpt-3.5-turbo';
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(modelId: string, tokensUsed: number): number {
    const costPerToken: Record<string, number> = {
      'openai-gpt-3.5': 0.002 / 1000, // $0.002 per 1K tokens
      'openai-gpt-4': 0.03 / 1000,    // $0.03 per 1K tokens
      'openai-classification': 0.002 / 1000,
      'openai-translation': 0.002 / 1000
    };

    const rate = costPerToken[modelId] || 0.002 / 1000;
    return tokensUsed * rate;
  }

  /**
   * Format error messages
   */
  private formatError(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.message;
        
        switch (status) {
          case 401:
            return 'Invalid API key or authentication failed';
          case 429:
            return 'Rate limit exceeded. Please try again later';
          case 500:
            return 'OpenAI service temporarily unavailable';
          default:
            return `OpenAI API error (${status}): ${message}`;
        }
      } else if (error.request) {
        return 'Network error: Unable to reach OpenAI API';
      }
    }

    return error.message || 'Unknown error occurred';
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`OpenAI API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('OpenAI API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`OpenAI API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`OpenAI API Error: ${error.response.status} ${error.response.data?.error?.message || error.message}`);
        } else {
          logger.error('OpenAI API Network Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }
}