import OpenAI from 'openai';
import { 
  FAQItem, 
  ConversationContext, 
  NLPAnalysisResult,
  Intent,
  Entity
} from './types';
import { logger } from '../shared/utils/logger';

export class ChatbotEngine {
  private openai: OpenAI;
  private faqDatabase: FAQItem[];
  private conversationMemory: Map<string, any[]>;

  constructor(config: { apiKey: string; model: string; maxTokens: number }) {
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
    this.faqDatabase = this.initializeFAQDatabase();
    this.conversationMemory = new Map();
  }

  /**
   * Generate contextual response for customer inquiries
   * Requirement 3.1: Handle conversational AI and customer inquiry routing
   */
  async generateResponse(
    message: string,
    context: ConversationContext,
    nlpAnalysis?: NLPAnalysisResult
  ): Promise<string> {
    try {
      logger.info('Generating chatbot response', { 
        messageLength: message.length,
        department: context.department 
      });

      // Check if this is a FAQ query first
      const faqResult = await this.handleFAQ(message);
      if (faqResult.confidence > 0.8) {
        return faqResult.answer;
      }

      // Build conversation context
      const conversationHistory = this.conversationMemory.get(context.customerInfo?.id || 'anonymous') || [];
      
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(message, nlpAnalysis, conversationHistory);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I\'m having trouble generating a response right now. Please try again or contact our support team.';

      // Update conversation memory
      conversationHistory.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      );
      
      // Keep only last 10 exchanges
      if (conversationHistory.length > 20) {
        conversationHistory.splice(0, conversationHistory.length - 20);
      }
      
      this.conversationMemory.set(context.customerInfo?.id || 'anonymous', conversationHistory);

      return response;

    } catch (error) {
      logger.error('Error generating chatbot response', error);
      return 'I apologize, but I\'m experiencing technical difficulties. Please contact our support team for immediate assistance.';
    }
  }

  /**
   * Handle FAQ queries with intelligent matching
   * Requirement 3.4: Provide FAQ responses with step-by-step guidance
   */
  async handleFAQ(query: string): Promise<{
    answer: string;
    confidence: number;
    relatedQuestions: string[];
  }> {
    try {
      logger.info('Processing FAQ query', { queryLength: query.length });

      // Simple keyword matching for FAQ items
      const queryLower = query.toLowerCase();
      const matches = this.faqDatabase.map(faq => {
        const questionScore = this.calculateSimilarity(queryLower, faq.question.toLowerCase());
        const keywordScore = faq.keywords.reduce((score, keyword) => {
          return score + (queryLower.includes(keyword.toLowerCase()) ? 1 : 0);
        }, 0) / faq.keywords.length;
        
        return {
          faq,
          score: (questionScore * 0.7) + (keywordScore * 0.3)
        };
      }).sort((a, b) => b.score - a.score);

      const bestMatch = matches[0];
      
      if (bestMatch.score > 0.6) {
        // Update usage count
        bestMatch.faq.usage_count++;
        
        // Find related questions
        const relatedQuestions = matches
          .slice(1, 4)
          .filter(match => match.score > 0.3)
          .map(match => match.faq.question);

        return {
          answer: this.formatFAQAnswer(bestMatch.faq.answer),
          confidence: bestMatch.score,
          relatedQuestions
        };
      }

      // If no good match, try to generate a response using AI
      const aiResponse = await this.generateFAQResponse(query);
      
      return {
        answer: aiResponse,
        confidence: 0.5,
        relatedQuestions: this.getPopularQuestions()
      };

    } catch (error) {
      logger.error('Error handling FAQ query', error);
      return {
        answer: 'I\'m sorry, I couldn\'t find a specific answer to your question. Please contact our support team for personalized assistance.',
        confidence: 0.1,
        relatedQuestions: this.getPopularQuestions()
      };
    }
  }

  /**
   * Extract intent from user message
   */
  async extractIntent(message: string): Promise<Intent> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an intent classifier. Classify the user\'s intent and extract parameters. Respond with JSON format: {"name": "intent_name", "confidence": 0.95, "parameters": {}}'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          return JSON.parse(response);
        } catch {
          // Fallback if JSON parsing fails
          return {
            name: 'general_inquiry',
            confidence: 0.5,
            parameters: {}
          };
        }
      }

      return {
        name: 'unknown',
        confidence: 0.1,
        parameters: {}
      };

    } catch (error) {
      logger.error('Error extracting intent', error);
      return {
        name: 'error',
        confidence: 0.1,
        parameters: {}
      };
    }
  }

  /**
   * Extract entities from user message
   */
  async extractEntities(message: string): Promise<Entity[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract named entities from the text. Return JSON array with format: [{"type": "entity_type", "value": "entity_value", "confidence": 0.95, "start": 0, "end": 5}]'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          return JSON.parse(response);
        } catch {
          return [];
        }
      }

      return [];

    } catch (error) {
      logger.error('Error extracting entities', error);
      return [];
    }
  }

  // Private helper methods
  private buildSystemPrompt(context: ConversationContext): string {
    const customerTier = context.customerInfo?.tier || 'basic';
    const department = context.department || 'general';
    
    return `You are a helpful customer service assistant for a business automation platform. 
    
Context:
- Customer tier: ${customerTier}
- Department: ${department}
- Priority: ${context.priority}

Guidelines:
- Be professional, helpful, and empathetic
- Provide clear, actionable responses
- If you cannot help with something, escalate appropriately
- For technical issues, provide step-by-step guidance
- Keep responses concise but comprehensive
- Always maintain a positive tone

If the customer seems frustrated or the issue is complex, suggest escalating to a human agent.`;
  }

  private buildUserPrompt(
    message: string,
    nlpAnalysis?: NLPAnalysisResult,
    conversationHistory: any[] = []
  ): string {
    let prompt = `Customer message: "${message}"`;
    
    if (nlpAnalysis) {
      prompt += `\n\nMessage analysis:
- Sentiment: ${nlpAnalysis.sentiment.label} (confidence: ${nlpAnalysis.sentiment.confidence})
- Key topics: ${nlpAnalysis.topics.map(t => t.name).join(', ')}
- Keywords: ${nlpAnalysis.keywords.map(k => k.text).join(', ')}`;
    }

    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6); // Last 3 exchanges
      prompt += `\n\nRecent conversation history:
${recentHistory.map(h => `${h.role}: ${h.content}`).join('\n')}`;
    }

    return prompt;
  }

  private async generateFAQResponse(query: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for a business automation platform. Provide a helpful response to the user\'s question. If you\'re not sure about specific details, suggest contacting support.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      return completion.choices[0]?.message?.content || 'I\'m not sure about that specific question. Please contact our support team for detailed assistance.';

    } catch (error) {
      logger.error('Error generating FAQ response', error);
      return 'I\'m having trouble generating a response. Please contact our support team.';
    }
  }

  private formatFAQAnswer(answer: string): string {
    // Add step-by-step formatting if the answer contains numbered steps
    if (answer.includes('1.') || answer.includes('Step 1')) {
      return `Here's a step-by-step guide:\n\n${answer}`;
    }
    return answer;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private getPopularQuestions(): string[] {
    return this.faqDatabase
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 3)
      .map(faq => faq.question);
  }

  private initializeFAQDatabase(): FAQItem[] {
    return [
      {
        id: 'faq_1',
        question: 'How do I reset my password?',
        answer: 'To reset your password:\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your email for reset instructions\n5. Follow the link and create a new password',
        category: 'account',
        keywords: ['password', 'reset', 'forgot', 'login'],
        confidence: 0.9,
        usage_count: 45,
        last_updated: new Date()
      },
      {
        id: 'faq_2',
        question: 'How do I create a new workflow?',
        answer: 'To create a new workflow:\n1. Navigate to the Workflows section\n2. Click "Create New Workflow"\n3. Choose a template or start from scratch\n4. Define your workflow steps\n5. Set triggers and conditions\n6. Test your workflow\n7. Activate when ready',
        category: 'workflows',
        keywords: ['workflow', 'create', 'automation', 'template'],
        confidence: 0.9,
        usage_count: 32,
        last_updated: new Date()
      },
      {
        id: 'faq_3',
        question: 'What integrations are supported?',
        answer: 'We support integrations with:\n• Email: Gmail, Outlook\n• Calendar: Google Calendar, Microsoft Calendar\n• Communication: Slack, Microsoft Teams\n• Storage: Google Drive, Dropbox\n• CRM: Salesforce\n• And many more! Check our integrations page for the full list.',
        category: 'integrations',
        keywords: ['integration', 'connect', 'gmail', 'slack', 'salesforce'],
        confidence: 0.9,
        usage_count: 28,
        last_updated: new Date()
      },
      {
        id: 'faq_4',
        question: 'How do I upgrade my plan?',
        answer: 'To upgrade your plan:\n1. Go to Account Settings\n2. Click on "Billing & Plans"\n3. Select your desired plan\n4. Review the changes\n5. Confirm the upgrade\n\nYour new features will be available immediately.',
        category: 'billing',
        keywords: ['upgrade', 'plan', 'billing', 'subscription'],
        confidence: 0.9,
        usage_count: 19,
        last_updated: new Date()
      },
      {
        id: 'faq_5',
        question: 'Why is my task failing?',
        answer: 'Common reasons for task failures:\n1. Invalid credentials for integrations\n2. Network connectivity issues\n3. Insufficient permissions\n4. Rate limiting from external services\n5. Invalid input data\n\nCheck the task logs for specific error details. If the issue persists, contact support.',
        category: 'troubleshooting',
        keywords: ['task', 'failing', 'error', 'troubleshoot'],
        confidence: 0.9,
        usage_count: 15,
        last_updated: new Date()
      }
    ];
  }
}