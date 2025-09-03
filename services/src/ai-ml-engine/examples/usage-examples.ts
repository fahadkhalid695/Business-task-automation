import { ModelManager } from '../ModelManager';
import { InferenceEngine } from '../InferenceEngine';

/**
 * Example usage of the AI/ML Engine
 */
export class AIEngineExamples {
  private modelManager: ModelManager;
  private inferenceEngine: InferenceEngine;

  constructor() {
    this.modelManager = new ModelManager();
    this.inferenceEngine = new InferenceEngine(this.modelManager);
  }

  /**
   * Example: Email classification and response generation
   */
  async processEmail(emailContent: string, senderEmail: string) {
    try {
      // 1. Classify email priority and category
      const classification = await this.inferenceEngine.classify(
        emailContent,
        'openai-classification',
        ['urgent', 'normal', 'low', 'spam']
      );

      // 2. Analyze sentiment
      const sentiment = await this.inferenceEngine.analyzeSentiment(emailContent);

      // 3. Extract action items
      const actionItems = await this.inferenceEngine.extractInformation(
        emailContent,
        'action_items'
      );

      // 4. Generate response if needed
      let response = null;
      if (classification.output === 'urgent') {
        response = await this.inferenceEngine.generateText(
          `Generate a professional email response acknowledging receipt of this urgent email: "${emailContent}"`,
          'openai-gpt-3.5',
          { maxTokens: 200, temperature: 0.7 }
        );
      }

      return {
        classification: classification.output,
        sentiment: sentiment.output,
        actionItems: actionItems.output,
        suggestedResponse: response?.output,
        metadata: {
          classificationConfidence: classification.confidence,
          sentimentConfidence: sentiment.confidence
        }
      };

    } catch (error) {
      console.error('Email processing failed:', error);
      throw error;
    }
  }

  /**
   * Example: Document analysis and summarization
   */
  async analyzeDocument(documentContent: string, documentType: string) {
    try {
      // 1. Generate summary
      const summary = await this.inferenceEngine.extractInformation(
        documentContent,
        'summary'
      );

      // 2. Extract key entities
      const entities = await this.inferenceEngine.extractInformation(
        documentContent,
        'entities'
      );

      // 3. Extract keywords
      const keywords = await this.inferenceEngine.extractInformation(
        documentContent,
        'keywords'
      );

      // 4. Classify document category
      const category = await this.inferenceEngine.classify(
        documentContent,
        'openai-classification',
        ['contract', 'report', 'proposal', 'invoice', 'correspondence']
      );

      return {
        summary: summary.output,
        entities: entities.output,
        keywords: keywords.output,
        category: category.output,
        documentType,
        metadata: {
          processingTime: Date.now(),
          wordCount: documentContent.split(' ').length
        }
      };

    } catch (error) {
      console.error('Document analysis failed:', error);
      throw error;
    }
  }

  /**
   * Example: Multilingual customer support
   */
  async processCustomerInquiry(inquiry: string, customerLanguage: string = 'en') {
    try {
      let processedInquiry = inquiry;

      // 1. Translate to English if needed
      if (customerLanguage !== 'en') {
        const translation = await this.inferenceEngine.translate(
          inquiry,
          customerLanguage,
          'en'
        );
        processedInquiry = translation.output || inquiry;
      }

      // 2. Classify inquiry type
      const inquiryType = await this.inferenceEngine.classify(
        processedInquiry,
        'openai-classification',
        ['technical_support', 'billing', 'general_info', 'complaint', 'compliment']
      );

      // 3. Analyze sentiment
      const sentiment = await this.inferenceEngine.analyzeSentiment(processedInquiry);

      // 4. Generate response
      const responsePrompt = `Generate a helpful customer service response for this ${inquiryType.output} inquiry: "${processedInquiry}"`;
      const response = await this.inferenceEngine.generateText(
        responsePrompt,
        'openai-gpt-3.5',
        { maxTokens: 300, temperature: 0.8 }
      );

      // 5. Translate response back if needed
      let finalResponse = response.output;
      if (customerLanguage !== 'en' && response.output) {
        const translatedResponse = await this.inferenceEngine.translate(
          response.output,
          'en',
          customerLanguage
        );
        finalResponse = translatedResponse.output || response.output;
      }

      return {
        inquiryType: inquiryType.output,
        sentiment: sentiment.output,
        response: finalResponse,
        originalLanguage: customerLanguage,
        wasTranslated: customerLanguage !== 'en',
        metadata: {
          confidence: inquiryType.confidence,
          sentimentScore: sentiment.confidence
        }
      };

    } catch (error) {
      console.error('Customer inquiry processing failed:', error);
      throw error;
    }
  }

  /**
   * Example: Batch processing for data analysis
   */
  async batchAnalyzeReviews(reviews: string[]) {
    try {
      // Prepare batch requests for sentiment analysis
      const batchRequests = reviews.map(review => ({
        input: review,
        type: 'classification' as const,
        modelType: 'openai-classification',
        options: {
          categories: ['positive', 'negative', 'neutral']
        }
      }));

      // Process all reviews in batch
      const results = await this.inferenceEngine.batchInference(batchRequests);

      // Aggregate results
      const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
      const processedReviews = results.map((result, index) => {
        const sentiment = result.output as keyof typeof sentimentCounts;
        if (sentiment && sentimentCounts.hasOwnProperty(sentiment)) {
          sentimentCounts[sentiment]++;
        }

        return {
          review: reviews[index],
          sentiment: result.output,
          confidence: result.confidence,
          success: result.success
        };
      });

      const totalReviews = results.filter(r => r.success).length;
      const sentimentPercentages = {
        positive: (sentimentCounts.positive / totalReviews) * 100,
        negative: (sentimentCounts.negative / totalReviews) * 100,
        neutral: (sentimentCounts.neutral / totalReviews) * 100
      };

      return {
        processedReviews,
        summary: {
          totalReviews: reviews.length,
          successfullyProcessed: totalReviews,
          sentimentCounts,
          sentimentPercentages,
          overallSentiment: Object.keys(sentimentCounts).reduce((a, b) => 
            sentimentCounts[a as keyof typeof sentimentCounts] > sentimentCounts[b as keyof typeof sentimentCounts] ? a : b
          )
        }
      };

    } catch (error) {
      console.error('Batch review analysis failed:', error);
      throw error;
    }
  }

  /**
   * Example: Content generation for marketing
   */
  async generateMarketingContent(productInfo: string, contentType: string) {
    try {
      let prompt = '';
      let maxTokens = 500;

      switch (contentType) {
        case 'email':
          prompt = `Write a compelling marketing email for this product: ${productInfo}`;
          maxTokens = 300;
          break;
        case 'social_post':
          prompt = `Create an engaging social media post for this product: ${productInfo}`;
          maxTokens = 150;
          break;
        case 'blog_outline':
          prompt = `Create a detailed blog post outline about this product: ${productInfo}`;
          maxTokens = 400;
          break;
        case 'product_description':
          prompt = `Write a detailed product description for: ${productInfo}`;
          maxTokens = 250;
          break;
        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }

      const content = await this.inferenceEngine.generateText(
        prompt,
        'openai-gpt-3.5',
        { maxTokens, temperature: 0.8 }
      );

      // Generate variations
      const variations = await Promise.all([
        this.inferenceEngine.generateText(
          `${prompt} (Make it more formal)`,
          'openai-gpt-3.5',
          { maxTokens, temperature: 0.6 }
        ),
        this.inferenceEngine.generateText(
          `${prompt} (Make it more casual and friendly)`,
          'openai-gpt-3.5',
          { maxTokens, temperature: 0.9 }
        )
      ]);

      return {
        contentType,
        mainContent: content.output,
        variations: variations.map(v => v.output),
        metadata: {
          tokensUsed: content.metadata?.tokensUsed,
          cost: content.metadata?.cost,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Content generation failed:', error);
      throw error;
    }
  }

  /**
   * Get AI/ML Engine status and metrics
   */
  async getEngineStatus() {
    try {
      const loadedModels = this.modelManager.getLoadedModels();
      const allMetrics = this.modelManager.getAllMetrics();
      
      const modelStatus = await Promise.all(
        loadedModels.map(async (modelId) => {
          const health = await this.modelManager.checkModelHealth(modelId);
          const metrics = this.modelManager.getMetrics(modelId);
          const config = this.modelManager.getModelConfig(modelId);
          
          return {
            modelId,
            isHealthy: health,
            config: {
              name: config?.name,
              type: config?.type,
              provider: config?.provider
            },
            metrics: {
              totalRequests: metrics?.totalRequests || 0,
              successRate: metrics?.successRate || 0,
              averageResponseTime: metrics?.averageResponseTime || 0,
              totalTokensUsed: metrics?.totalTokensUsed || 0
            }
          };
        })
      );

      return {
        status: 'operational',
        loadedModels: loadedModels.length,
        totalRequests: Array.from(allMetrics.values()).reduce((sum, m) => sum + m.totalRequests, 0),
        modelStatus,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to get engine status:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}