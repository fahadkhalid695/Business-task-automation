import { ContentGenerator } from './ContentGenerator';
import { DesignAssistant } from './DesignAssistant';
import { CodeAutomation } from './CodeAutomation';
import { ComplianceChecker } from './ComplianceChecker';
import { CreativeBriefProcessor } from './CreativeBriefProcessor';
import {
  CreativeServiceConfig,
  ContentGenerationRequest,
  ContentGenerationResult,
  DesignRequest,
  DesignResult,
  CodeGenerationRequest,
  CodeGenerationResult,
  ComplianceCheckRequest,
  ComplianceResult,
  CreativeBrief,
  CreativeConcept,
  ContentType,
  DesignType,
  CodeType,
  ProgrammingLanguage
} from './types';
import { Task, TaskStatus, Priority } from '../shared/types';
import { logger } from '../shared/utils/logger';

export class CreativeService {
  private contentGenerator: ContentGenerator;
  private designAssistant: DesignAssistant;
  private codeAutomation: CodeAutomation;
  private complianceChecker: ComplianceChecker;
  private briefProcessor: CreativeBriefProcessor;
  private config: CreativeServiceConfig;

  constructor(config: CreativeServiceConfig) {
    this.config = config;
    this.contentGenerator = new ContentGenerator(config.openai);
    this.designAssistant = new DesignAssistant(config.designTools);
    this.codeAutomation = new CodeAutomation(config.openai);
    this.complianceChecker = new ComplianceChecker(config.compliance);
    this.briefProcessor = new CreativeBriefProcessor(
      this.contentGenerator,
      this.designAssistant,
      this.codeAutomation
    );
  }

  /**
   * Generate content for various formats
   * Requirement 6.1: Generate drafts for emails, newsletters, social posts, and blog outlines
   */
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    try {
      logger.info('Generating content', { type: request.type });

      const result = await this.contentGenerator.generateContent(request);

      // Check compliance if required
      if (this.shouldCheckCompliance(request.type)) {
        const complianceResult = await this.complianceChecker.checkCompliance({
          content: result.content,
          type: request.type,
          regulations: this.getApplicableRegulations(request.type)
        });
        result.complianceCheck = complianceResult;
      }

      return result;

    } catch (error) {
      logger.error('Error generating content', error);
      throw error;
    }
  }

  /**
   * Create design assets
   * Requirement 6.2: Create slide decks, templates, and basic graphics
   */
  async createDesign(request: DesignRequest): Promise<DesignResult> {
    try {
      logger.info('Creating design', { type: request.type });
      return await this.designAssistant.createDesign(request);
    } catch (error) {
      logger.error('Error creating design', error);
      throw error;
    }
  }

  /**
   * Generate code and automation scripts
   * Requirement 6.3: Generate scripts, debug issues, and create documentation
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    try {
      logger.info('Generating code', { type: request.type, language: request.language });
      return await this.codeAutomation.generateCode(request);
    } catch (error) {
      logger.error('Error generating code', error);
      throw error;
    }
  }

  /**
   * Check compliance against regulations
   * Requirement 6.4: Verify documents against regulatory requirements and policies
   */
  async checkCompliance(request: ComplianceCheckRequest): Promise<ComplianceResult> {
    try {
      logger.info('Checking compliance', { regulations: request.regulations });
      return await this.complianceChecker.checkCompliance(request);
    } catch (error) {
      logger.error('Error checking compliance', error);
      throw error;
    }
  }

  /**
   * Process creative brief and generate concepts
   * Requirement 6.5: Generate multiple concept variations for review
   */
  async processCreativeBrief(brief: CreativeBrief): Promise<CreativeConcept[]> {
    try {
      logger.info('Processing creative brief', { briefId: brief.id });
      return await this.briefProcessor.processBrief(brief);
    } catch (error) {
      logger.error('Error processing creative brief', error);
      throw error;
    }
  }

  /**
   * Generate email content with specific parameters
   */
  async generateEmail(
    subject: string,
    purpose: string,
    audience: any,
    tone: string = 'professional'
  ): Promise<ContentGenerationResult> {
    return this.contentGenerator.generateEmail(subject, purpose, audience, tone);
  }

  /**
   * Generate newsletter content
   */
  async generateNewsletter(
    topics: string[],
    audience: any,
    brandGuidelines?: any
  ): Promise<ContentGenerationResult> {
    return this.contentGenerator.generateNewsletter(topics, audience, brandGuidelines);
  }

  /**
   * Generate social media posts
   */
  async generateSocialPost(
    platform: string,
    message: string,
    hashtags?: string[],
    audience?: any
  ): Promise<ContentGenerationResult> {
    return this.contentGenerator.generateSocialPost(platform, message, hashtags, audience);
  }

  /**
   * Generate blog outline
   */
  async generateBlogOutline(
    topic: string,
    keywords: string[],
    audience: any
  ): Promise<ContentGenerationResult> {
    return this.contentGenerator.generateBlogOutline(topic, keywords, audience);
  }

  /**
   * Create slide deck
   */
  async createSlideDeck(specifications: any, content?: string, brandGuidelines?: any): Promise<DesignResult> {
    return this.designAssistant.createSlideDeck({
      type: DesignType.SLIDE_DECK,
      specifications,
      content,
      brandGuidelines
    });
  }

  /**
   * Create presentation
   */
  async createPresentation(specifications: any, brandGuidelines?: any): Promise<DesignResult> {
    return this.designAssistant.createPresentation({
      type: DesignType.PRESENTATION,
      specifications,
      brandGuidelines
    });
  }

  /**
   * Generate utility script
   */
  async generateScript(
    purpose: string,
    language: ProgrammingLanguage,
    requirements: string[]
  ): Promise<CodeGenerationResult> {
    return this.codeAutomation.generateScript(purpose, language, requirements);
  }

  /**
   * Debug code
   */
  async debugCode(
    code: string,
    language: ProgrammingLanguage,
    errorDescription: string
  ): Promise<{
    fixedCode: string;
    explanation: string;
    issues: string[];
    suggestions: string[];
  }> {
    return this.codeAutomation.debugCode(code, language, errorDescription);
  }

  /**
   * Check GDPR compliance
   */
  async checkGDPRCompliance(content: string): Promise<ComplianceResult> {
    return this.complianceChecker.checkGDPRCompliance(content);
  }

  /**
   * Check advertising compliance
   */
  async checkAdvertisingCompliance(content: string): Promise<ComplianceResult> {
    return this.complianceChecker.checkAdvertisingCompliance(content);
  }

  /**
   * Process creative task
   */
  async processTask(task: Task): Promise<Task> {
    try {
      logger.info('Processing creative task', { taskId: task.id, type: task.type });

      task.status = TaskStatus.IN_PROGRESS;
      task.updatedAt = new Date();

      const { input } = task.data;

      switch (task.type) {
        case 'content_generation':
          const contentResult = await this.generateContent(input.request);
          task.data.output = contentResult;
          break;

        case 'design_creation':
          const designResult = await this.createDesign(input.request);
          task.data.output = designResult;
          break;

        case 'code_generation':
          const codeResult = await this.generateCode(input.request);
          task.data.output = codeResult;
          break;

        case 'compliance_check':
          const complianceResult = await this.checkCompliance(input.request);
          task.data.output = complianceResult;
          break;

        case 'creative_brief_processing':
          const conceptsResult = await this.processCreativeBrief(input.brief);
          task.data.output = { concepts: conceptsResult };
          break;

        case 'email_generation':
          const emailResult = await this.generateEmail(
            input.subject,
            input.purpose,
            input.audience,
            input.tone
          );
          task.data.output = emailResult;
          break;

        case 'social_post_generation':
          const socialResult = await this.generateSocialPost(
            input.platform,
            input.message,
            input.hashtags,
            input.audience
          );
          task.data.output = socialResult;
          break;

        case 'blog_outline_generation':
          const blogResult = await this.generateBlogOutline(
            input.topic,
            input.keywords,
            input.audience
          );
          task.data.output = blogResult;
          break;

        case 'slide_deck_creation':
          const slideDeckResult = await this.createSlideDeck(
            input.specifications,
            input.content,
            input.brandGuidelines
          );
          task.data.output = slideDeckResult;
          break;

        case 'script_generation':
          const scriptResult = await this.generateScript(
            input.purpose,
            input.language,
            input.requirements
          );
          task.data.output = scriptResult;
          break;

        case 'code_debugging':
          const debugResult = await this.debugCode(
            input.code,
            input.language,
            input.errorDescription
          );
          task.data.output = debugResult;
          break;

        default:
          throw new Error(`Unsupported creative task type: ${task.type}`);
      }

      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.updatedAt = new Date();

      logger.info('Creative task completed', { taskId: task.id });
      return task;

    } catch (error) {
      logger.error('Error processing creative task', error);
      task.status = TaskStatus.FAILED;
      task.data.output = { error: error.message };
      task.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: { [key: string]: boolean };
    timestamp: Date;
  }> {
    const services = {
      contentGenerator: true, // Mock health check
      designAssistant: true,
      codeAutomation: true,
      complianceChecker: true,
      briefProcessor: true
    };

    const allHealthy = Object.values(services).every(status => status);
    const someHealthy = Object.values(services).some(status => status);

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      status = 'healthy';
    } else if (someHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      timestamp: new Date()
    };
  }

  // Private helper methods
  private shouldCheckCompliance(contentType: ContentType): boolean {
    const complianceRequiredTypes = [
      ContentType.EMAIL,
      ContentType.NEWSLETTER,
      ContentType.AD_COPY,
      ContentType.PRESS_RELEASE,
      ContentType.PRODUCT_DESCRIPTION
    ];

    return complianceRequiredTypes.includes(contentType);
  }

  private getApplicableRegulations(contentType: ContentType): string[] {
    const regulationMap: { [key in ContentType]?: string[] } = {
      [ContentType.EMAIL]: ['CAN-SPAM', 'GDPR'],
      [ContentType.NEWSLETTER]: ['CAN-SPAM', 'GDPR'],
      [ContentType.AD_COPY]: ['FTC', 'GDPR'],
      [ContentType.PRESS_RELEASE]: ['SEC', 'FTC'],
      [ContentType.PRODUCT_DESCRIPTION]: ['FTC', 'GDPR']
    };

    return regulationMap[contentType] || [];
  }
}