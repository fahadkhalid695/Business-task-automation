import OpenAI from 'openai';

class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateText(prompt: string, options: any = {}): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: options.systemPrompt || 'You are a helpful AI assistant for business task automation.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('AI text generation error:', error);
      throw new Error('Failed to generate text');
    }
  }

  async analyzeText(text: string): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Analyze the following text and provide insights in JSON format with sentiment, topics, entities, summary, and confidence score.'
          },
          { role: 'user', content: `Analyze this text: "${text}"` }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content;
      return JSON.parse(analysis || '{}');
    } catch (error) {
      console.error('AI text analysis error:', error);
      throw new Error('Failed to analyze text');
    }
  }

  async classifyText(text: string, categories: string[]): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Classify the following text into one of these categories: ${categories.join(', ')}. Respond with only the category name.`
          },
          { role: 'user', content: text }
        ],
        max_tokens: 50,
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content?.trim() || categories[0];
    } catch (error) {
      console.error('AI text classification error:', error);
      return categories[0];
    }
  }

  async generateSummary(text: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Summarize the following text in a concise and clear manner.'
          },
          { role: 'user', content: text }
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('AI summary generation error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Translate the following text to ${targetLanguage}. Provide only the translation.`
          },
          { role: 'user', content: text }
        ],
        max_tokens: Math.ceil(text.length * 1.5),
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || text;
    } catch (error) {
      console.error('AI translation error:', error);
      return text;
    }
  }

  async generateWorkflowSuggestions(description: string): Promise<any[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Based on the workflow description, suggest an optimized workflow with steps in JSON format. Each step should have id, name, type, description, estimatedTime, and dependencies.'
          },
          { 
            role: 'user', 
            content: `Create workflow suggestions for: ${description}` 
          }
        ],
        max_tokens: 1000,
        temperature: 0.6,
      });

      const suggestions = response.choices[0]?.message?.content;
      return JSON.parse(suggestions || '[]');
    } catch (error) {
      console.error('AI workflow suggestions error:', error);
      return [];
    }
  }

  async optimizeWorkflow(workflow: any): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Optimize this workflow for better efficiency and performance. Return the optimized workflow in the same JSON format.'
          },
          { 
            role: 'user', 
            content: JSON.stringify(workflow, null, 2) 
          }
        ],
        max_tokens: 1500,
        temperature: 0.4,
      });

      const optimizedWorkflow = response.choices[0]?.message?.content;
      return JSON.parse(optimizedWorkflow || JSON.stringify(workflow));
    } catch (error) {
      console.error('AI workflow optimization error:', error);
      return workflow;
    }
  }

  async detectAnomalies(data: any[]): Promise<any[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze this data for anomalies and unusual patterns. Return findings in JSON format.'
          },
          { 
            role: 'user', 
            content: JSON.stringify(data.slice(0, 100), null, 2) 
          }
        ],
        max_tokens: 800,
        temperature: 0.2,
      });

      const anomalies = response.choices[0]?.message?.content;
      return JSON.parse(anomalies || '[]');
    } catch (error) {
      console.error('AI anomaly detection error:', error);
      return [];
    }
  }

  async generateInsights(data: any): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze this business data and generate actionable insights. Return as JSON array of strings.'
          },
          { 
            role: 'user', 
            content: JSON.stringify(data, null, 2) 
          }
        ],
        max_tokens: 600,
        temperature: 0.6,
      });

      const insights = response.choices[0]?.message?.content;
      return JSON.parse(insights || '[]');
    } catch (error) {
      console.error('AI insights generation error:', error);
      return [];
    }
  }
}

export const aiService = new AIService();