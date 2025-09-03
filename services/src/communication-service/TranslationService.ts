import { Translate } from '@google-cloud/translate/build/src/v2';
import {
  TranslationResult,
  TranslationContext,
  TranslationMetadata
} from './types';
import { logger } from '../shared/utils/logger';

export class TranslationService {
  private translateClient: Translate;
  private projectId: string;
  private supportedLanguages: Map<string, string>;

  constructor(config: { projectId: string; keyFilename: string }) {
    this.projectId = config.projectId;
    this.translateClient = new Translate({
      projectId: config.projectId,
      keyFilename: config.keyFilename
    });
    this.supportedLanguages = new Map();
    this.initializeSupportedLanguages();
  }

  /**
   * Translate text with context awareness
   * Requirement 3.3: Provide real-time translation with context awareness
   */
  async translate(
    text: string,
    targetLanguage: string,
    options: {
      sourceLanguage?: string;
      context?: string;
      formality?: 'formal' | 'informal';
      domain?: string;
    } = {}
  ): Promise<TranslationResult> {
    try {
      const startTime = Date.now();
      
      logger.info('Starting text translation', {
        textLength: text.length,
        targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto-detect',
        context: options.context ? 'provided' : 'none'
      });

      // Validate target language
      if (!this.isLanguageSupported(targetLanguage)) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      // Detect source language if not provided
      let sourceLanguage = options.sourceLanguage;
      if (!sourceLanguage) {
        const [detection] = await this.translateClient.detect(text);
        sourceLanguage = Array.isArray(detection) ? detection[0].language : detection.language;
        
        if (!sourceLanguage) {
          throw new Error('Could not detect source language');
        }
      }

      // If source and target are the same, return original text
      if (sourceLanguage === targetLanguage) {
        return {
          id: this.generateId(),
          originalText: text,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          confidence: 1.0,
          alternatives: [],
          metadata: {
            model: 'google-translate-v2',
            processingTime: Date.now() - startTime,
            characterCount: text.length
          }
        };
      }

      // Prepare text for context-aware translation
      const contextualText = this.prepareContextualText(text, options);

      // Perform translation
      const [translation] = await this.translateClient.translate(contextualText, {
        from: sourceLanguage,
        to: targetLanguage,
        format: 'text'
      });

      // Post-process translation based on context
      const processedTranslation = this.postProcessTranslation(
        translation,
        text,
        options
      );

      // Generate alternatives if possible
      const alternatives = await this.generateAlternatives(
        text,
        sourceLanguage,
        targetLanguage,
        options
      );

      const processingTime = Date.now() - startTime;

      const result: TranslationResult = {
        id: this.generateId(),
        originalText: text,
        translatedText: processedTranslation,
        sourceLanguage,
        targetLanguage,
        confidence: this.calculateConfidence(text, processedTranslation, sourceLanguage, targetLanguage),
        context: {
          domain: options.domain,
          formality: options.formality,
          audience: options.context
        },
        alternatives,
        metadata: {
          model: 'google-translate-v2',
          processingTime,
          characterCount: text.length,
          detectedLanguage: options.sourceLanguage ? undefined : sourceLanguage
        }
      };

      logger.info('Text translation completed', {
        translationId: result.id,
        sourceLanguage,
        targetLanguage,
        confidence: result.confidence,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('Error translating text', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Batch translate multiple texts
   */
  async translateBatch(
    texts: string[],
    targetLanguage: string,
    options: {
      sourceLanguage?: string;
      context?: string;
      formality?: 'formal' | 'informal';
    } = {}
  ): Promise<TranslationResult[]> {
    try {
      logger.info('Starting batch translation', {
        textCount: texts.length,
        targetLanguage
      });

      const results = await Promise.all(
        texts.map(text => this.translate(text, targetLanguage, options))
      );

      return results;

    } catch (error) {
      logger.error('Error in batch translation', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<{ [code: string]: string }> {
    try {
      if (this.supportedLanguages.size === 0) {
        const [languages] = await this.translateClient.getLanguages();
        languages.forEach(lang => {
          this.supportedLanguages.set(lang.code, lang.name);
        });
      }

      return Object.fromEntries(this.supportedLanguages);

    } catch (error) {
      logger.error('Error getting supported languages', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{
    language: string;
    confidence: number;
  }> {
    try {
      const [detection] = await this.translateClient.detect(text);
      const result = Array.isArray(detection) ? detection[0] : detection;

      return {
        language: result.language,
        confidence: result.confidence || 0.5
      };

    } catch (error) {
      logger.error('Error detecting language', error);
      throw error;
    }
  }

  // Private helper methods
  private prepareContextualText(
    text: string,
    options: {
      context?: string;
      formality?: 'formal' | 'informal';
      domain?: string;
    }
  ): string {
    let contextualText = text;

    // Add context hints for better translation
    if (options.context) {
      // For now, we'll just use the original text
      // In a more advanced implementation, we could prepend context
      contextualText = text;
    }

    return contextualText;
  }

  private postProcessTranslation(
    translation: string,
    originalText: string,
    options: {
      formality?: 'formal' | 'informal';
      domain?: string;
    }
  ): string {
    let processedTranslation = translation;

    // Apply formality adjustments
    if (options.formality === 'formal') {
      processedTranslation = this.makeFormal(processedTranslation);
    } else if (options.formality === 'informal') {
      processedTranslation = this.makeInformal(processedTranslation);
    }

    // Apply domain-specific adjustments
    if (options.domain) {
      processedTranslation = this.applyDomainSpecificTerms(processedTranslation, options.domain);
    }

    return processedTranslation;
  }

  private async generateAlternatives(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: any
  ): Promise<string[]> {
    try {
      // For now, return empty array
      // In a more advanced implementation, we could use multiple translation services
      // or different models to generate alternatives
      return [];

    } catch (error) {
      logger.error('Error generating translation alternatives', error);
      return [];
    }
  }

  private calculateConfidence(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): number {
    // Simple confidence calculation based on text characteristics
    let confidence = 0.8; // Base confidence

    // Adjust based on text length
    if (originalText.length < 10) {
      confidence -= 0.1; // Short texts are less reliable
    } else if (originalText.length > 1000) {
      confidence -= 0.05; // Very long texts might have more errors
    }

    // Adjust based on language pair
    const commonLanguagePairs = [
      ['en', 'es'], ['en', 'fr'], ['en', 'de'], ['en', 'it'],
      ['es', 'en'], ['fr', 'en'], ['de', 'en'], ['it', 'en']
    ];

    const isCommonPair = commonLanguagePairs.some(pair => 
      (pair[0] === sourceLanguage && pair[1] === targetLanguage) ||
      (pair[1] === sourceLanguage && pair[0] === targetLanguage)
    );

    if (isCommonPair) {
      confidence += 0.1;
    } else {
      confidence -= 0.1;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  private makeFormal(text: string): string {
    // Simple formality adjustments
    return text
      .replace(/\bcan't\b/g, 'cannot')
      .replace(/\bwon't\b/g, 'will not')
      .replace(/\bdon't\b/g, 'do not')
      .replace(/\bisn't\b/g, 'is not')
      .replace(/\baren't\b/g, 'are not');
  }

  private makeInformal(text: string): string {
    // Simple informality adjustments
    return text
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bwill not\b/g, "won't")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bis not\b/g, "isn't")
      .replace(/\bare not\b/g, "aren't");
  }

  private applyDomainSpecificTerms(text: string, domain: string): string {
    // Domain-specific term replacements
    const domainTerms: { [domain: string]: { [key: string]: string } } = {
      'medical': {
        'doctor': 'physician',
        'medicine': 'medication'
      },
      'legal': {
        'agreement': 'contract',
        'rule': 'regulation'
      },
      'technical': {
        'problem': 'issue',
        'fix': 'resolve'
      }
    };

    const terms = domainTerms[domain];
    if (!terms) return text;

    let processedText = text;
    Object.entries(terms).forEach(([from, to]) => {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      processedText = processedText.replace(regex, to);
    });

    return processedText;
  }

  private isLanguageSupported(languageCode: string): boolean {
    // Common language codes that Google Translate supports
    const commonLanguages = [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no'
    ];

    return commonLanguages.includes(languageCode.toLowerCase());
  }

  private initializeSupportedLanguages(): void {
    // Initialize with common languages
    const commonLanguages = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian'
    };

    Object.entries(commonLanguages).forEach(([code, name]) => {
      this.supportedLanguages.set(code, name);
    });
  }

  private generateId(): string {
    return `translation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}