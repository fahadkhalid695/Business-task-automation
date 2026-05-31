import { aiService } from './aiService';
import { grokService } from './grokService';
import { geminiService } from './geminiService';

type AIProvider = 'openai' | 'grok' | 'gemini';

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
    this.currentProvider = (process.env.AI_PROVIDER as AIProvider) || 'grok';
    this.fallbackProvider = this.determineFallback(this.currentProvider);
    
    console.log(`AI Service initialized with primary provider: ${this.currentProvider}`);
    console.log(`Fallback provider: ${this.fallbackProvider}`);
  }

  /**
   * Determine the best fallback provider based on available API keys
   */
  private determineFallback(primary: AIProvider): AIProvider {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGrok = !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY);
    const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);

    // Pick the first available provider that isn't the primary
    const fallbackOrder: AIProvider[] = ['gemini', 'openai', 'grok'];
    const available: Record<AIProvider, boolean> = { openai: hasOpenAI, grok: hasGrok, gemini: hasGemini };

    for (const provider of fallbackOrder) {
      if (provider !== primary && available[provider]) {
        return provider;
      }
    }

    // Default fallback if no keys are configured
    return primary === 'openai' ? 'gemini' : 'openai';
  }

  private getService(provider?: AIProvider) {
    const p = provider || this.currentProvider;
    switch (p) {
      case 'openai': return aiService;
      case 'grok': return grokService;
      case 'gemini': return geminiService;
      default: return grokService;
    }
  }

  private getFallbackService() {
    return this.getService(this.fallbackProvider);
  }

  async switchProvider(provider: AIProvider): Promise<void> {
    this.currentProvider = provider;
    this.fallbackProvider = this.determineFallback(provider);
    console.log(`Switched AI provider to: ${provider}, fallback: ${this.fallbackProvider}`);
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  getFallbackProvider(): AIProvider {
    return this.fallbackProvider;
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
        throw new Error(`${operation} failed with both AI providers (${this.currentProvider} and ${this.fallbackProvider})`);
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

  async generateCode(description: string, language: string = 'javascript'): Promise<string> {
    const service = this.getService();
    try {
      if ('generateCode' in service) {
        return await (service as any).generateCode(description, language);
      }
      // Fallback to generic text generation with code prompt
      return await service.generateText(
        `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.`,
        { temperature: 0.3 }
      );
    } catch (error) {
      console.warn(`Code generation failed with ${this.currentProvider}, trying fallback`);
      const fallback = this.getFallbackService();
      if ('generateCode' in fallback) {
        return await (fallback as any).generateCode(description, language);
      }
      return await fallback.generateText(
        `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.`,
        { temperature: 0.3 }
      );
    }
  }

  async explainCode(code: string): Promise<string> {
    const service = this.getService();
    try {
      if ('explainCode' in service) {
        return await (service as any).explainCode(code);
      }
      return await service.generateText(
        `Explain what this code does in simple terms:\n\n${code}`,
        { temperature: 0.4 }
      );
    } catch (error) {
      console.warn(`Code explanation failed with ${this.currentProvider}, trying fallback`);
      const fallback = this.getFallbackService();
      if ('explainCode' in fallback) {
        return await (fallback as any).explainCode(code);
      }
      return await fallback.generateText(
        `Explain what this code does in simple terms:\n\n${code}`,
        { temperature: 0.4 }
      );
    }
  }

  // Health check for all providers
  async healthCheck(): Promise<{ [key in AIProvider]: boolean }> {
    const results: { [key in AIProvider]: boolean } = {
      openai: false,
      grok: false,
      gemini: false
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

    // Check Gemini
    try {
      results.gemini = await geminiService.healthCheck();
    } catch (error) {
      console.warn('Gemini health check failed:', error);
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
      geminiApiKey: boolean;
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
        geminiApiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
      }
    };
  }
}

export const unifiedAiService = new UnifiedAIService();
export { AIProvider, AIServiceOptions };
