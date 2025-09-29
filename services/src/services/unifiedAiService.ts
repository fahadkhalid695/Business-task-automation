import { aiService } from './aiService';
import { grokService } from './grokService';

type AIProvider = 'openai' | 'grok';

interface AIServiceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

class UnifiedAIService {
  private currentProvider: AIProvider;
  private fallbackProvider: AIProvider;

  constructor() {
    // Determine primary provider based on environment variables
    this.currentProvider = process.env.AI_PROVIDER as AIProvider || 'grok';
    this.fallbackProvider = this.currentProvider === 'openai' ? 'grok' : 'openai';
    
    console.log(`AI Service initialized with primary provider: ${this.currentProvider}`);
  }

  private getService() {
    return this.currentProvider === 'openai' ? aiService : grokService;
  }

  private getFallbackService() {
    return this.fallbackProvider === 'openai' ? aiService : grokService;
  }

  async switchProvider(provider: AIProvider): Promise<void> {
    this.currentProvider = provider;
    console.log(`Switched AI provider to: ${provider}`);
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  private async executeWithFallback<T>(
    operation: string,
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (error) {
      console.warn(`${operation} failed with ${this.currentProvider}, trying ${this.fallbackProvider}:`, error);
      try {
        return await fallbackFn();
      } catch (fallbackError) {
        console.error(`${operation} failed with both providers:`, fallbackError);
        throw new Error(`${operation} failed with both AI providers`);
      }
    }
  }

  async generateText(prompt: string, options: AIServiceOptions = {}): Promise<string> {
    return this.executeWithFallback(
      'Text generation',
      () => this.getService().generateText(prompt, options),
      () => this.getFallbackService().generateText(prompt, options)
    );
  }

  async analyzeText(text: string): Promise<any> {
    return this.executeWithFallback(
      'Text analysis',
      () => this.getService().analyzeText(text),
      () => this.getFallbackService().analyzeText(text)
    );
  }

  async classifyText(text: string, categories: string[]): Promise<string> {
    return this.executeWithFallback(
      'Text classification',
      () => this.getService().classifyText(text, categories),
      () => this.getFallbackService().classifyText(text, categories)
    );
  }

  async generateSummary(text: string): Promise<string> {
    return this.executeWithFallback(
      'Summary generation',
      () => this.getService().generateSummary(text),
      () => this.getFallbackService().generateSummary(text)
    );
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    return this.executeWithFallback(
      'Text translation',
      () => this.getService().translateText(text, targetLanguage),
      () => this.getFallbackService().translateText(text, targetLanguage)
    );
  }

  async generateWorkflowSuggestions(description: string): Promise<any[]> {
    return this.executeWithFallback(
      'Workflow suggestions',
      () => this.getService().generateWorkflowSuggestions(description),
      () => this.getFallbackService().generateWorkflowSuggestions(description)
    );
  }

  async optimizeWorkflow(workflow: any): Promise<any> {
    return this.executeWithFallback(
      'Workflow optimization',
      () => this.getService().optimizeWorkflow(workflow),
      () => this.getFallbackService().optimizeWorkflow(workflow)
    );
  }

  async detectAnomalies(data: any[]): Promise<any[]> {
    return this.executeWithFallback(
      'Anomaly detection',
      () => this.getService().detectAnomalies(data),
      () => this.getFallbackService().detectAnomalies(data)
    );
  }

  async generateInsights(data: any): Promise<string[]> {
    return this.executeWithFallback(
      'Insights generation',
      () => this.getService().generateInsights(data),
      () => this.getFallbackService().generateInsights(data)
    );
  }

  // Grok-specific methods (with fallback to OpenAI equivalent)
  async generateCode(description: string, language: string = 'javascript'): Promise<string> {
    if (this.currentProvider === 'grok') {
      try {
        return await grokService.generateCode(description, language);
      } catch (error) {
        console.warn('Grok code generation failed, using OpenAI fallback');
        // Fallback to OpenAI with custom prompt
        return await aiService.generateText(
          `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.`,
          { model: 'gpt-4', temperature: 0.3 }
        );
      }
    } else {
      // Use OpenAI with custom prompt
      return await aiService.generateText(
        `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.`,
        { model: 'gpt-4', temperature: 0.3 }
      );
    }
  }

  async explainCode(code: string): Promise<string> {
    if (this.currentProvider === 'grok') {
      try {
        return await grokService.explainCode(code);
      } catch (error) {
        console.warn('Grok code explanation failed, using OpenAI fallback');
        return await aiService.generateText(
          `Explain what this code does in simple terms:\n\n${code}`,
          { model: 'gpt-3.5-turbo', temperature: 0.4 }
        );
      }
    } else {
      return await aiService.generateText(
        `Explain what this code does in simple terms:\n\n${code}`,
        { model: 'gpt-3.5-turbo', temperature: 0.4 }
      );
    }
  }

  // Health check for both providers
  async healthCheck(): Promise<{ [key in AIProvider]: boolean }> {
    const results: { [key in AIProvider]: boolean } = {
      openai: false,
      grok: false
    };

    // Check OpenAI
    try {
      await aiService.generateText('Hello', { maxTokens: 10 });
      results.openai = true;
    } catch (error) {
      console.warn('OpenAI health check failed:', error);
    }

    // Check Grok
    try {
      results.grok = await grokService.healthCheck();
    } catch (error) {
      console.warn('Grok health check failed:', error);
    }

    return results;
  }

  // Get provider status and configuration
  async getProviderStatus(): Promise<{
    current: AIProvider;
    fallback: AIProvider;
    health: { [key in AIProvider]: boolean };
    config: {
      grokApiKey: boolean;
      openaiApiKey: boolean;
    };
  }> {
    const health = await this.healthCheck();
    
    return {
      current: this.currentProvider,
      fallback: this.fallbackProvider,
      health,
      config: {
        grokApiKey: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
        openaiApiKey: !!process.env.OPENAI_API_KEY,
      }
    };
  }
}

export const unifiedAiService = new UnifiedAIService();
export { AIProvider, AIServiceOptions };