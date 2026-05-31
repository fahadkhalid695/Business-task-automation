import axios, { AxiosInstance } from 'axios';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
  systemInstruction?: {
    parts: { text: string }[];
  };
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
    safetyRatings: any[];
  }[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

class GeminiService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
    this.baseURL = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (!this.apiKey) {
      console.warn('Gemini API key not found. Please set GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
  }

  private async makeRequest(data: GeminiRequest, model?: string): Promise<string> {
    try {
      const modelName = model || this.defaultModel;
      const url = `/models/${modelName}:generateContent?key=${this.apiKey}`;

      const response = await this.client.post<GeminiResponse>(url, data);

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('No content in Gemini response');
      }

      return content;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error('Gemini API error:', errorMessage);
      throw new Error(`Gemini API request failed: ${errorMessage}`);
    }
  }

  async generateText(prompt: string, options: any = {}): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 1000,
          topP: 0.95,
        },
      };

      if (options.systemPrompt) {
        request.systemInstruction = {
          parts: [{ text: options.systemPrompt }]
        };
      } else {
        request.systemInstruction = {
          parts: [{ text: 'You are a helpful AI assistant for business task automation.' }]
        };
      }

      return await this.makeRequest(request, options.model);
    } catch (error) {
      console.error('Gemini text generation error:', error);
      throw new Error('Failed to generate text with Gemini');
    }
  }

  async analyzeText(text: string): Promise<any> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Analyze the following text and provide insights in JSON format with the following structure:
{
  "sentiment": "positive/negative/neutral",
  "topics": ["topic1", "topic2"],
  "entities": ["entity1", "entity2"],
  "summary": "brief summary",
  "confidence": 0.95
}

Text to analyze: "${text}"` }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
        systemInstruction: {
          parts: [{ text: 'You are an expert text analyst. Always respond with valid JSON only, no markdown formatting.' }]
        }
      };

      const response = await this.makeRequest(request);
      // Strip markdown code blocks if present
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini text analysis error:', error);
      throw new Error('Failed to analyze text with Gemini');
    }
  }

  async classifyText(text: string, categories: string[]): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Classify the following text into one of these categories: ${categories.join(', ')}.
Respond with only the category name, nothing else.

Text: "${text}"` }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50,
        },
        systemInstruction: {
          parts: [{ text: 'You are a text classifier. Respond with only the category name, no explanation.' }]
        }
      };

      const response = await this.makeRequest(request);
      const classification = response.trim();
      return categories.includes(classification) ? classification : categories[0];
    } catch (error) {
      console.error('Gemini text classification error:', error);
      return categories[0];
    }
  }

  async generateSummary(text: string): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Summarize the following text in a concise and clear manner:\n\n${text}` }]
        }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 200,
        },
        systemInstruction: {
          parts: [{ text: 'You are an expert at creating concise, informative summaries.' }]
        }
      };

      return await this.makeRequest(request);
    } catch (error) {
      console.error('Gemini summary generation error:', error);
      throw new Error('Failed to generate summary with Gemini');
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Translate the following text to ${targetLanguage}. Provide only the translation, no explanations:\n\n${text}` }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: Math.ceil(text.length * 2),
        },
        systemInstruction: {
          parts: [{ text: `You are a professional translator. Translate accurately to ${targetLanguage}. Provide only the translation.` }]
        }
      };

      return await this.makeRequest(request);
    } catch (error) {
      console.error('Gemini translation error:', error);
      return text;
    }
  }

  async generateWorkflowSuggestions(description: string): Promise<any[]> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Based on this workflow description: "${description}", suggest an optimized workflow with steps in JSON format:
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

Provide 3-5 logical steps for an efficient workflow. Respond with valid JSON array only.` }]
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1000,
        },
        systemInstruction: {
          parts: [{ text: 'You are a workflow optimization expert. Always respond with valid JSON array only, no markdown formatting.' }]
        }
      };

      const response = await this.makeRequest(request);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini workflow suggestions error:', error);
      return [];
    }
  }

  async optimizeWorkflow(workflow: any): Promise<any> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Optimize this workflow for better efficiency and performance. Return the optimized workflow in the same JSON format:\n\n${JSON.stringify(workflow, null, 2)}` }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1500,
        },
        systemInstruction: {
          parts: [{ text: 'You are a workflow optimization expert. Analyze and improve workflows for maximum efficiency. Respond with valid JSON only.' }]
        }
      };

      const response = await this.makeRequest(request);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini workflow optimization error:', error);
      return workflow;
    }
  }

  async detectAnomalies(data: any[]): Promise<any[]> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Analyze this data for anomalies and unusual patterns. Return findings in JSON array format:\n\n${JSON.stringify(data.slice(0, 100), null, 2)}` }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
        },
        systemInstruction: {
          parts: [{ text: 'You are a data analyst expert at detecting anomalies and patterns. Respond with JSON array of findings only.' }]
        }
      };

      const response = await this.makeRequest(request);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini anomaly detection error:', error);
      return [];
    }
  }

  async generateInsights(data: any): Promise<string[]> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Analyze this business data and generate actionable insights. Return as JSON array of strings:\n\n${JSON.stringify(data, null, 2)}` }]
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 600,
        },
        systemInstruction: {
          parts: [{ text: 'You are a business intelligence expert. Generate actionable insights from data. Respond with JSON array of insight strings only.' }]
        }
      };

      const response = await this.makeRequest(request);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini insights generation error:', error);
      return [];
    }
  }

  async generateCode(description: string, language: string = 'javascript'): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Generate ${language} code for: ${description}\n\nProvide clean, well-commented code only.` }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
        systemInstruction: {
          parts: [{ text: `You are an expert ${language} developer. Generate clean, efficient, and well-documented code. Provide only the code without markdown formatting.` }]
        }
      };

      const response = await this.makeRequest(request);
      // Strip markdown code blocks if present
      return response.replace(/```\w*\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error) {
      console.error('Gemini code generation error:', error);
      throw new Error('Failed to generate code with Gemini');
    }
  }

  async explainCode(code: string): Promise<string> {
    try {
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: `Explain what this code does in simple terms:\n\n${code}` }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
        systemInstruction: {
          parts: [{ text: 'You are a code explainer. Break down code functionality in clear, simple terms.' }]
        }
      };

      return await this.makeRequest(request);
    } catch (error) {
      console.error('Gemini code explanation error:', error);
      throw new Error('Failed to explain code with Gemini');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest({
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello' }]
        }],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1,
        }
      });
      return true;
    } catch (error) {
      console.error('Gemini health check failed:', error);
      return false;
    }
  }
}

export const geminiService = new GeminiService();
