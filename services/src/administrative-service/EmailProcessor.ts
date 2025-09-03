import { 
  EmailProcessingRequest, 
  EmailProcessingResult, 
  ProcessedEmail,
  EmailSummary,
  ActionItem,
  EmailResponse,
  ExternalIntegration
} from './types/AdministrativeTypes';
import { EmailMessage, EmailCategory, Priority, SentimentScore } from '../shared/types';
import { logger } from '../shared/utils/logger';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';

/**
 * EmailProcessor - Handles email sorting, categorization, and sentiment analysis
 */
export class EmailProcessor {
  private inferenceEngine: InferenceEngine;
  private integrations: Map<string, ExternalIntegration>;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.integrations = new Map();
    
    logger.info('EmailProcessor initialized');
  }

  /**
   * Process emails with categorization, sentiment analysis, and action item extraction
   */
  async processEmails(request: EmailProcessingRequest): Promise<EmailProcessingResult> {
    const { emails, options = {} } = request;
    const processedEmails: ProcessedEmail[] = [];
    const actionItems: ActionItem[] = [];
    const suggestedResponses: EmailResponse[] = [];

    logger.info(`Processing ${emails.length} emails with options:`, options);

    for (const email of emails) {
      try {
        const processedEmail = await this.processIndividualEmail(email, options);
        processedEmails.push(processedEmail);

        // Extract action items if requested
        if (options.extractActionItems) {
          const emailActionItems = await this.extractActionItems(email);
          actionItems.push(...emailActionItems);
        }

        // Generate suggested responses if requested
        if (options.autoRespond && this.shouldGenerateResponse(processedEmail)) {
          const response = await this.generateResponse(email);
          if (response) {
            suggestedResponses.push(response);
          }
        }
      } catch (error) {
        logger.error(`Failed to process email ${email.id}:`, error);
        
        // Add email with error status
        processedEmails.push({
          ...email,
          confidence: 0,
          processingNotes: [`Processing failed: ${error.message}`],
          suggestedActions: ['Manual review required']
        });
      }
    }

    const summary = this.generateEmailSummary(processedEmails);

    logger.info(`Email processing completed. Processed: ${processedEmails.length}, Action items: ${actionItems.length}`);

    return {
      processedEmails,
      summary,
      actionItems,
      suggestedResponses: suggestedResponses.length > 0 ? suggestedResponses : undefined
    };
  }

  /**
   * Process individual email with categorization and sentiment analysis
   */
  private async processIndividualEmail(email: EmailMessage, options: any): Promise<ProcessedEmail> {
    const processingNotes: string[] = [];
    const suggestedActions: string[] = [];
    let confidence = 0.8; // Default confidence

    // Categorize email if requested
    if (options.categorize !== false) {
      try {
        const category = await this.categorizeEmail(email);
        email.category = category.category;
        confidence = Math.min(confidence, category.confidence);
        processingNotes.push(`Categorized as ${category.category} (confidence: ${category.confidence.toFixed(2)})`);
      } catch (error) {
        processingNotes.push(`Categorization failed: ${error.message}`);
        confidence *= 0.5;
      }
    }

    // Analyze sentiment if requested
    if (options.analyzeSentiment !== false) {
      try {
        const sentiment = await this.analyzeSentiment(email);
        email.sentiment = sentiment;
        processingNotes.push(`Sentiment: ${sentiment.label} (score: ${sentiment.score.toFixed(2)})`);
      } catch (error) {
        processingNotes.push(`Sentiment analysis failed: ${error.message}`);
        confidence *= 0.8;
      }
    }

    // Determine priority
    const priority = this.determinePriority(email);
    if (priority !== email.priority) {
      email.priority = priority;
      processingNotes.push(`Priority adjusted to ${priority}`);
    }

    // Generate suggested actions
    suggestedActions.push(...this.generateSuggestedActions(email));

    return {
      ...email,
      confidence,
      processingNotes,
      suggestedActions
    };
  }

  /**
   * Categorize email using AI classification
   */
  private async categorizeEmail(email: EmailMessage): Promise<{ category: EmailCategory; confidence: number }> {
    const prompt = `Categorize this email based on its subject and content:
    
Subject: ${email.subject}
From: ${email.from}
Content: ${email.body.substring(0, 500)}...

Categories: ${Object.values(EmailCategory).join(', ')}

Return the most appropriate category.`;

    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: 50,
        temperature: 0.1
      });

      const categoryText = result.text.trim().toLowerCase();
      let category = EmailCategory.WORK; // Default
      let confidence = 0.6;

      // Map AI response to enum
      for (const cat of Object.values(EmailCategory)) {
        if (categoryText.includes(cat.toLowerCase())) {
          category = cat;
          confidence = 0.8;
          break;
        }
      }

      // Additional heuristics for better accuracy
      if (email.subject.toLowerCase().includes('urgent') || email.subject.includes('!!!')) {
        category = EmailCategory.URGENT;
        confidence = 0.9;
      } else if (email.subject.toLowerCase().includes('meeting') || email.subject.toLowerCase().includes('calendar')) {
        category = EmailCategory.MEETING;
        confidence = 0.85;
      } else if (email.subject.toLowerCase().includes('invoice') || email.subject.toLowerCase().includes('payment')) {
        category = EmailCategory.INVOICE;
        confidence = 0.9;
      }

      return { category, confidence };
    } catch (error) {
      logger.error('Email categorization failed:', error);
      return { category: EmailCategory.WORK, confidence: 0.3 };
    }
  }

  /**
   * Analyze email sentiment
   */
  private async analyzeSentiment(email: EmailMessage): Promise<SentimentScore> {
    const prompt = `Analyze the sentiment of this email content:

"${email.body.substring(0, 1000)}"

Provide a sentiment score from -1 (very negative) to 1 (very positive), and classify as positive, negative, or neutral.`;

    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: 100,
        temperature: 0.1
      });

      // Parse AI response (simplified - in production would use more robust parsing)
      const text = result.text.toLowerCase();
      let score = 0;
      let label: 'positive' | 'negative' | 'neutral' = 'neutral';
      let confidence = 0.7;

      if (text.includes('positive')) {
        label = 'positive';
        score = 0.5;
      } else if (text.includes('negative')) {
        label = 'negative';
        score = -0.5;
      }

      // Extract numeric score if present
      const scoreMatch = text.match(/-?\d+\.?\d*/);
      if (scoreMatch) {
        const parsedScore = parseFloat(scoreMatch[0]);
        if (parsedScore >= -1 && parsedScore <= 1) {
          score = parsedScore;
          confidence = 0.8;
        }
      }

      return { score, confidence, label };
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return { score: 0, confidence: 0.3, label: 'neutral' };
    }
  }

  /**
   * Extract action items from email content
   */
  private async extractActionItems(email: EmailMessage): Promise<ActionItem[]> {
    const prompt = `Extract action items from this email:

Subject: ${email.subject}
Content: ${email.body}

Identify specific tasks, deadlines, and assignments. Format as:
- Task description | Priority (high/medium/low) | Due date (if mentioned) | Assigned to (if mentioned)`;

    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: 300,
        temperature: 0.2
      });

      const actionItems: ActionItem[] = [];
      const lines = result.text.split('\n').filter(line => line.trim().startsWith('-'));

      for (let i = 0; i < lines.length && i < 5; i++) { // Limit to 5 action items
        const line = lines[i].substring(1).trim();
        const parts = line.split('|').map(p => p.trim());

        if (parts.length >= 1) {
          const actionItem: ActionItem = {
            id: `action-${email.id}-${i}`,
            description: parts[0],
            priority: this.parsePriority(parts[1]) || Priority.MEDIUM,
            sourceEmailId: email.id,
            status: 'pending'
          };

          // Parse due date if provided
          if (parts[2] && parts[2] !== 'if mentioned') {
            const dueDate = this.parseDate(parts[2]);
            if (dueDate) {
              actionItem.dueDate = dueDate;
            }
          }

          // Parse assigned person if provided
          if (parts[3] && parts[3] !== 'if mentioned') {
            actionItem.assignedTo = parts[3];
          }

          actionItems.push(actionItem);
        }
      }

      return actionItems;
    } catch (error) {
      logger.error('Action item extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate suggested email response
   */
  private async generateResponse(email: EmailMessage): Promise<EmailResponse | null> {
    if (email.category === EmailCategory.SPAM || email.category === EmailCategory.NEWSLETTER) {
      return null; // Don't generate responses for spam or newsletters
    }

    const prompt = `Generate a professional email response to:

From: ${email.from}
Subject: ${email.subject}
Content: ${email.body.substring(0, 500)}

Generate an appropriate response that:
1. Acknowledges the email
2. Addresses key points
3. Is professional and helpful
4. Includes next steps if needed

Keep it concise and professional.`;

    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: 300,
        temperature: 0.3
      });

      return {
        emailId: email.id,
        subject: `Re: ${email.subject}`,
        body: result.text.trim(),
        tone: 'professional',
        confidence: 0.7
      };
    } catch (error) {
      logger.error('Response generation failed:', error);
      return null;
    }
  }

  /**
   * Determine email priority based on content and metadata
   */
  private determinePriority(email: EmailMessage): Priority {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    // High priority indicators
    if (subject.includes('urgent') || subject.includes('asap') || subject.includes('emergency') ||
        body.includes('urgent') || body.includes('deadline') || subject.includes('!!!')) {
      return Priority.URGENT;
    }

    // Medium-high priority indicators
    if (subject.includes('important') || subject.includes('meeting') || subject.includes('deadline') ||
        body.includes('important') || body.includes('meeting')) {
      return Priority.HIGH;
    }

    // Low priority indicators
    if (email.category === EmailCategory.NEWSLETTER || email.category === EmailCategory.PERSONAL ||
        subject.includes('fyi') || subject.includes('newsletter')) {
      return Priority.LOW;
    }

    return Priority.MEDIUM;
  }

  /**
   * Generate suggested actions based on email content and category
   */
  private generateSuggestedActions(email: EmailMessage): string[] {
    const actions: string[] = [];

    switch (email.category) {
      case EmailCategory.URGENT:
        actions.push('Respond immediately', 'Escalate if needed');
        break;
      case EmailCategory.MEETING:
        actions.push('Add to calendar', 'Check availability', 'Prepare agenda');
        break;
      case EmailCategory.INVOICE:
        actions.push('Forward to accounting', 'Verify details', 'Process payment');
        break;
      case EmailCategory.WORK:
        if (email.priority === Priority.HIGH) {
          actions.push('Respond within 4 hours', 'Review attachments');
        } else {
          actions.push('Respond within 24 hours');
        }
        break;
      case EmailCategory.SPAM:
        actions.push('Mark as spam', 'Block sender');
        break;
      case EmailCategory.NEWSLETTER:
        actions.push('Archive', 'Unsubscribe if unwanted');
        break;
      default:
        actions.push('Review and respond as needed');
    }

    return actions;
  }

  /**
   * Generate email processing summary
   */
  private generateEmailSummary(emails: ProcessedEmail[]): EmailSummary {
    const categoryCounts = {} as { [key in EmailCategory]: number };
    const priorityCounts = {} as { [key in Priority]: number };
    let totalSentiment = 0;
    let urgentCount = 0;

    // Initialize counts
    Object.values(EmailCategory).forEach(cat => categoryCounts[cat] = 0);
    Object.values(Priority).forEach(pri => priorityCounts[pri] = 0);

    emails.forEach(email => {
      categoryCounts[email.category]++;
      priorityCounts[email.priority]++;
      totalSentiment += email.sentiment?.score || 0;
      
      if (email.priority === Priority.URGENT) {
        urgentCount++;
      }
    });

    return {
      totalEmails: emails.length,
      categoryCounts,
      priorityCounts,
      averageSentiment: emails.length > 0 ? totalSentiment / emails.length : 0,
      urgentCount
    };
  }

  /**
   * Check if email should generate an automatic response
   */
  private shouldGenerateResponse(email: ProcessedEmail): boolean {
    return email.category !== EmailCategory.SPAM && 
           email.category !== EmailCategory.NEWSLETTER &&
           email.priority !== Priority.LOW &&
           email.confidence > 0.6;
  }

  /**
   * Parse priority string to Priority enum
   */
  private parsePriority(priorityStr: string): Priority | null {
    if (!priorityStr) return null;
    
    const str = priorityStr.toLowerCase();
    if (str.includes('high') || str.includes('urgent')) return Priority.HIGH;
    if (str.includes('low')) return Priority.LOW;
    if (str.includes('medium')) return Priority.MEDIUM;
    
    return null;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring email integration: ${integration.service}`, { integrationId });
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status of email processor
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      integrations: this.integrations.size,
      lastProcessed: new Date().toISOString()
    };
  }
}