import { ChatbotEngine } from './ChatbotEngine';
import { TranscriptionService } from './TranscriptionService';
import { TranslationService } from './TranslationService';
import { NotificationService } from './NotificationService';
import { NLPUtils } from './NLPUtils';
import {
  ChatMessage,
  Conversation,
  ConversationStatus,
  TranscriptionResult,
  TranslationResult,
  NotificationMessage,
  NLPAnalysisResult,
  CommunicationServiceConfig,
  CustomerInfo,
  ConversationContext
} from './types';
import { Task, TaskStatus, Priority } from '../shared/types';
import { logger } from '../shared/utils/logger';

export class CommunicationService {
  private chatbotEngine: ChatbotEngine;
  private transcriptionService: TranscriptionService;
  private translationService: TranslationService;
  private notificationService: NotificationService;
  private nlpUtils: NLPUtils;
  private config: CommunicationServiceConfig;

  constructor(config: CommunicationServiceConfig) {
    this.config = config;
    this.chatbotEngine = new ChatbotEngine(config.openai);
    this.transcriptionService = new TranscriptionService(config.googleCloud);
    this.translationService = new TranslationService(config.googleCloud);
    this.notificationService = new NotificationService(config.notifications);
    this.nlpUtils = new NLPUtils(config.openai);
  }

  /**
   * Process a customer inquiry and route it appropriately
   * Requirement 3.1: Route customer inquiries to appropriate departments
   */
  async processCustomerInquiry(
    message: string,
    customerInfo: CustomerInfo,
    conversationId?: string
  ): Promise<{
    response: string;
    conversation: Conversation;
    routingDecision: {
      department: string;
      priority: Priority;
      requiresHuman: boolean;
    };
  }> {
    try {
      logger.info('Processing customer inquiry', { 
        customerId: customerInfo.id, 
        conversationId 
      });

      // Analyze the message for intent and sentiment
      const nlpAnalysis = await this.nlpUtils.analyzeText(message);
      
      // Determine routing based on analysis
      const routingDecision = await this.determineRouting(message, nlpAnalysis, customerInfo);
      
      // Get or create conversation
      const conversation = conversationId 
        ? await this.getConversation(conversationId)
        : await this.createConversation(customerInfo, routingDecision);

      // Generate response using chatbot
      const response = await this.chatbotEngine.generateResponse(
        message,
        conversation.context,
        nlpAnalysis
      );

      // Update conversation with new messages
      const userMessage: ChatMessage = {
        id: this.generateId(),
        conversationId: conversation.id,
        sender: 'user',
        content: message,
        timestamp: new Date(),
        metadata: {
          intent: nlpAnalysis.entities.find(e => e.type === 'intent')?.value,
          confidence: nlpAnalysis.sentiment.confidence,
          entities: nlpAnalysis.entities
        }
      };

      const botMessage: ChatMessage = {
        id: this.generateId(),
        conversationId: conversation.id,
        sender: 'bot',
        content: response,
        timestamp: new Date()
      };

      conversation.messages.push(userMessage, botMessage);
      conversation.updatedAt = new Date();

      // If requires human intervention, escalate
      if (routingDecision.requiresHuman) {
        await this.escalateToHuman(conversation, routingDecision);
      }

      return {
        response,
        conversation,
        routingDecision
      };

    } catch (error) {
      logger.error('Error processing customer inquiry', error);
      throw error;
    }
  }

  /**
   * Handle FAQ queries with intelligent matching
   * Requirement 3.4: Provide FAQ responses with step-by-step guidance
   */
  async handleFAQQuery(query: string): Promise<{
    answer: string;
    confidence: number;
    relatedQuestions: string[];
  }> {
    try {
      return await this.chatbotEngine.handleFAQ(query);
    } catch (error) {
      logger.error('Error handling FAQ query', error);
      throw error;
    }
  }

  /**
   * Transcribe audio with speaker identification
   * Requirement 3.2: Generate accurate transcriptions with action items
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    options: {
      language?: string;
      enableSpeakerDiarization?: boolean;
      enableWordTimestamps?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    try {
      logger.info('Starting audio transcription', { 
        audioSize: audioBuffer.length,
        options 
      });

      const result = await this.transcriptionService.transcribe(audioBuffer, options);
      
      // Extract action items from transcription
      if (result.text) {
        const nlpAnalysis = await this.nlpUtils.analyzeText(result.text);
        const actionItems = await this.nlpUtils.extractActionItems(result.text);
        
        // Add action items to metadata
        result.metadata = {
          ...result.metadata,
          actionItems,
          sentiment: nlpAnalysis.sentiment,
          topics: nlpAnalysis.topics
        };
      }

      return result;
    } catch (error) {
      logger.error('Error transcribing audio', error);
      throw error;
    }
  }

  /**
   * Translate text with context awareness
   * Requirement 3.3: Provide real-time translation with context awareness
   */
  async translateText(
    text: string,
    targetLanguage: string,
    options: {
      sourceLanguage?: string;
      context?: string;
      formality?: 'formal' | 'informal';
    } = {}
  ): Promise<TranslationResult> {
    try {
      logger.info('Translating text', { 
        textLength: text.length,
        targetLanguage,
        options 
      });

      return await this.translationService.translate(text, targetLanguage, options);
    } catch (error) {
      logger.error('Error translating text', error);
      throw error;
    }
  }

  /**
   * Send notifications through multiple channels
   * Requirement 3.5: Implement notification system for various channels
   */
  async sendNotification(notification: NotificationMessage): Promise<{
    success: boolean;
    results: { [channel: string]: boolean };
    errors: string[];
  }> {
    try {
      logger.info('Sending notification', { 
        notificationId: notification.id,
        channels: notification.channels 
      });

      return await this.notificationService.send(notification);
    } catch (error) {
      logger.error('Error sending notification', error);
      throw error;
    }
  }

  /**
   * Analyze text content for insights
   */
  async analyzeContent(text: string): Promise<NLPAnalysisResult> {
    try {
      return await this.nlpUtils.analyzeText(text);
    } catch (error) {
      logger.error('Error analyzing content', error);
      throw error;
    }
  }

  /**
   * Process communication task
   */
  async processTask(task: Task): Promise<Task> {
    try {
      logger.info('Processing communication task', { taskId: task.id, type: task.type });

      task.status = TaskStatus.IN_PROGRESS;
      task.updatedAt = new Date();

      const { input } = task.data;

      switch (task.type) {
        case 'customer_inquiry':
          const inquiryResult = await this.processCustomerInquiry(
            input.message,
            input.customerInfo,
            input.conversationId
          );
          task.data.output = inquiryResult;
          break;

        case 'transcription':
          const transcriptionResult = await this.transcribeAudio(
            input.audioBuffer,
            input.options
          );
          task.data.output = transcriptionResult;
          break;

        case 'translation':
          const translationResult = await this.translateText(
            input.text,
            input.targetLanguage,
            input.options
          );
          task.data.output = translationResult;
          break;

        case 'notification':
          const notificationResult = await this.sendNotification(input.notification);
          task.data.output = notificationResult;
          break;

        case 'content_analysis':
          const analysisResult = await this.analyzeContent(input.text);
          task.data.output = analysisResult;
          break;

        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.updatedAt = new Date();

      logger.info('Communication task completed', { taskId: task.id });
      return task;

    } catch (error) {
      logger.error('Error processing communication task', error);
      task.status = TaskStatus.FAILED;
      task.data.output = { error: error.message };
      task.updatedAt = new Date();
      throw error;
    }
  }

  // Private helper methods
  private async determineRouting(
    message: string,
    nlpAnalysis: NLPAnalysisResult,
    customerInfo: CustomerInfo
  ): Promise<{
    department: string;
    priority: Priority;
    requiresHuman: boolean;
  }> {
    // Simple routing logic based on keywords and sentiment
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
    const technicalKeywords = ['bug', 'error', 'not working', 'broken', 'issue'];
    const billingKeywords = ['payment', 'invoice', 'billing', 'charge', 'refund'];
    const salesKeywords = ['pricing', 'quote', 'purchase', 'buy', 'upgrade'];

    const lowerMessage = message.toLowerCase();
    let department = 'general';
    let priority = Priority.MEDIUM;
    let requiresHuman = false;

    // Determine department
    if (technicalKeywords.some(keyword => lowerMessage.includes(keyword))) {
      department = 'technical';
    } else if (billingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      department = 'billing';
    } else if (salesKeywords.some(keyword => lowerMessage.includes(keyword))) {
      department = 'sales';
    }

    // Determine priority
    if (urgentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      priority = Priority.URGENT;
      requiresHuman = true;
    } else if (nlpAnalysis.sentiment.label === 'negative' && nlpAnalysis.sentiment.confidence > 0.8) {
      priority = Priority.HIGH;
      requiresHuman = true;
    } else if (customerInfo.tier === 'enterprise') {
      priority = Priority.HIGH;
    }

    // Complex issues require human intervention
    if (message.length > 500 || nlpAnalysis.topics.length > 3) {
      requiresHuman = true;
    }

    return { department, priority, requiresHuman };
  }

  private async createConversation(
    customerInfo: CustomerInfo,
    routingDecision: any
  ): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateId(),
      userId: customerInfo.id,
      title: `Inquiry from ${customerInfo.name}`,
      status: ConversationStatus.ACTIVE,
      messages: [],
      context: {
        department: routingDecision.department,
        priority: routingDecision.priority,
        tags: [],
        customerInfo,
        previousInteractions: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return conversation;
  }

  private async getConversation(conversationId: string): Promise<Conversation> {
    // In a real implementation, this would fetch from database
    // For now, return a mock conversation
    return {
      id: conversationId,
      userId: 'user-id',
      title: 'Existing Conversation',
      status: ConversationStatus.ACTIVE,
      messages: [],
      context: {
        department: 'general',
        priority: Priority.MEDIUM,
        tags: [],
        previousInteractions: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async escalateToHuman(
    conversation: Conversation,
    routingDecision: any
  ): Promise<void> {
    conversation.status = ConversationStatus.ESCALATED;
    
    // Send notification to appropriate department
    const notification: NotificationMessage = {
      id: this.generateId(),
      title: `Escalated Customer Inquiry - ${routingDecision.department}`,
      content: `Conversation ${conversation.id} has been escalated and requires human attention.`,
      priority: routingDecision.priority,
      channels: ['email', 'slack'],
      recipients: [
        {
          type: 'role',
          identifier: `${routingDecision.department}_support`
        }
      ],
      status: 'pending'
    };

    await this.sendNotification(notification);
  }

  private generateId(): string {
    return `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}