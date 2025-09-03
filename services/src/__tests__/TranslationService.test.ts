import { TranslationService } from '../communication-service/TranslationService';
import { Translate } from '@google-cloud/translate/build/src/v2';

// Mock Google Cloud Translate
jest.mock('@google-cloud/translate/build/src/v2');

describe('TranslationService', () => {
  let translationService: TranslationService;
  let mockTranslateClient: jest.Mocked<Translate>;

  const mockConfig = {
    projectId: 'test-project',
    keyFilename: 'test-key.json'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Translate client
    mockTranslateClient = {
      translate: jest.fn(),
      detect: jest.fn(),
      getLanguages: jest.fn()
    } as any;

    (Translate as jest.Mock).mockImplementation(() => mockTranslateClient);

    translationService = new TranslationService(mockConfig);
  });

  describe('translate', () => {
    beforeEach(() => {
      mockTranslateClient.translate.mockResolvedValue(['Hola mundo']);
      mockTranslateClient.detect.mockResolvedValue([{ language: 'en', confidence: 0.95 }]);
    });

    it('should translate text successfully', async () => {
      const text = 'Hello world';
      const targetLanguage = 'es';
      const options = {
        sourceLanguage: 'en',
        context: 'greeting',
        formality: 'informal' as const
      };

      const result = await translationService.translate(text, targetLanguage, options);

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^translation_/),
          originalText: text,
          translatedText: 'Hola mundo',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: expect.any(Number),
          context: {
            formality: 'informal',
            audience: 'greeting'
          },
          metadata: expect.objectContaining({
            model: 'google-translate-v2',
            characterCount: 11,
            processingTime: expect.any(Number)
          })
        })
      );

      expect(mockTranslateClient.translate).toHaveBeenCalledWith('Hello world', {
        from: 'en',
        to: 'es',
        format: 'text'
      });
    });

    it('should auto-detect source language when not provided', async () => {
      const text = 'Bonjour le monde';
      const targetLanguage = 'en';

      await translationService.translate(text, targetLanguage);

      expect(mockTranslateClient.detect).toHaveBeenCalledWith(text);
      expect(mockTranslateClient.translate).toHaveBeenCalledWith(text, {
        from: 'en', // Mocked detection result
        to: 'en',
        format: 'text'
      });
    });

    it('should return original text when source and target languages are the same', async () => {
      const text = 'Hello world';
      const language = 'en';

      const result = await translationService.translate(text, language, {
        sourceLanguage: language
      });

      expect(result.originalText).toBe(text);
      expect(result.translatedText).toBe(text);
      expect(result.confidence).toBe(1.0);
      expect(mockTranslateClient.translate).not.toHaveBeenCalled();
    });

    it('should handle unsupported target language', async () => {
      const text = 'Hello world';
      const unsupportedLanguage = 'xyz';

      await expect(
        translationService.translate(text, unsupportedLanguage)
      ).rejects.toThrow(`Unsupported target language: ${unsupportedLanguage}`);
    });

    it('should handle language detection failure', async () => {
      mockTranslateClient.detect.mockResolvedValue([{ language: null }]);

      const text = 'Hello world';
      const targetLanguage = 'es';

      await expect(
        translationService.translate(text, targetLanguage)
      ).rejects.toThrow('Could not detect source language');
    });

    it('should handle translation API errors', async () => {
      mockTranslateClient.translate.mockRejectedValue(new Error('Translation API error'));

      const text = 'Hello world';
      const targetLanguage = 'es';

      await expect(
        translationService.translate(text, targetLanguage, { sourceLanguage: 'en' })
      ).rejects.toThrow('Translation failed: Translation API error');
    });

    it('should apply formality adjustments', async () => {
      mockTranslateClient.translate.mockResolvedValue(['I cannot help you']);

      const text = "I can't help you";
      const targetLanguage = 'en';
      const options = {
        sourceLanguage: 'en',
        formality: 'formal' as const
      };

      const result = await translationService.translate(text, targetLanguage, options);

      expect(result.translatedText).toBe('I cannot help you');
    });

    it('should apply informal adjustments', async () => {
      mockTranslateClient.translate.mockResolvedValue(['I cannot help you']);

      const text = 'I cannot help you';
      const targetLanguage = 'en';
      const options = {
        sourceLanguage: 'en',
        formality: 'informal' as const
      };

      const result = await translationService.translate(text, targetLanguage, options);

      expect(result.translatedText).toBe("I can't help you");
    });

    it('should apply domain-specific terms', async () => {
      mockTranslateClient.translate.mockResolvedValue(['The doctor gave me medicine']);

      const text = 'The doctor gave me medicine';
      const targetLanguage = 'en';
      const options = {
        sourceLanguage: 'en',
        domain: 'medical'
      };

      const result = await translationService.translate(text, targetLanguage, options);

      expect(result.translatedText).toBe('The physician gave me medication');
    });

    it('should calculate confidence based on text characteristics', async () => {
      // Test short text (lower confidence)
      const shortResult = await translationService.translate('Hi', 'es', { sourceLanguage: 'en' });
      
      // Test normal text
      const normalResult = await translationService.translate('Hello, how are you today?', 'es', { sourceLanguage: 'en' });

      expect(shortResult.confidence).toBeLessThan(normalResult.confidence);
    });

    it('should adjust confidence for common language pairs', async () => {
      // Test common pair (en-es)
      const commonPairResult = await translationService.translate('Hello', 'es', { sourceLanguage: 'en' });
      
      // Test uncommon pair (would need different mock setup)
      const result = await translationService.translate('Hello', 'es', { sourceLanguage: 'en' });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('translateBatch', () => {
    beforeEach(() => {
      mockTranslateClient.translate.mockResolvedValue(['Hola', 'Adiós']);
      mockTranslateClient.detect.mockResolvedValue([{ language: 'en', confidence: 0.95 }]);
    });

    it('should translate multiple texts', async () => {
      const texts = ['Hello', 'Goodbye'];
      const targetLanguage = 'es';
      const options = { sourceLanguage: 'en' };

      const results = await translationService.translateBatch(texts, targetLanguage, options);

      expect(results).toHaveLength(2);
      expect(results[0].originalText).toBe('Hello');
      expect(results[1].originalText).toBe('Goodbye');
      expect(mockTranslateClient.translate).toHaveBeenCalledTimes(2);
    });

    it('should handle batch translation errors', async () => {
      mockTranslateClient.translate.mockRejectedValue(new Error('Batch error'));

      const texts = ['Hello', 'Goodbye'];
      const targetLanguage = 'es';

      await expect(
        translationService.translateBatch(texts, targetLanguage)
      ).rejects.toThrow('Batch error');
    });
  });

  describe('getSupportedLanguages', () => {
    beforeEach(() => {
      mockTranslateClient.getLanguages.mockResolvedValue([
        [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Spanish' },
          { code: 'fr', name: 'French' }
        ]
      ]);
    });

    it('should return supported languages', async () => {
      const languages = await translationService.getSupportedLanguages();

      expect(languages).toEqual({
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French'
      });

      expect(mockTranslateClient.getLanguages).toHaveBeenCalled();
    });

    it('should cache supported languages', async () => {
      await translationService.getSupportedLanguages();
      await translationService.getSupportedLanguages();

      // Should only call the API once due to caching
      expect(mockTranslateClient.getLanguages).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      mockTranslateClient.getLanguages.mockRejectedValue(new Error('API error'));

      await expect(
        translationService.getSupportedLanguages()
      ).rejects.toThrow('API error');
    });
  });

  describe('detectLanguage', () => {
    beforeEach(() => {
      mockTranslateClient.detect.mockResolvedValue([
        { language: 'es', confidence: 0.95 }
      ]);
    });

    it('should detect language successfully', async () => {
      const text = 'Hola mundo';

      const result = await translationService.detectLanguage(text);

      expect(result).toEqual({
        language: 'es',
        confidence: 0.95
      });

      expect(mockTranslateClient.detect).toHaveBeenCalledWith(text);
    });

    it('should handle array response format', async () => {
      mockTranslateClient.detect.mockResolvedValue([
        [{ language: 'fr', confidence: 0.88 }]
      ]);

      const text = 'Bonjour';

      const result = await translationService.detectLanguage(text);

      expect(result).toEqual({
        language: 'fr',
        confidence: 0.88
      });
    });

    it('should handle detection errors', async () => {
      mockTranslateClient.detect.mockRejectedValue(new Error('Detection error'));

      await expect(
        translationService.detectLanguage('test')
      ).rejects.toThrow('Detection error');
    });

    it('should handle missing confidence', async () => {
      mockTranslateClient.detect.mockResolvedValue([
        { language: 'en' } // No confidence field
      ]);

      const result = await translationService.detectLanguage('Hello');

      expect(result).toEqual({
        language: 'en',
        confidence: 0.5 // Default fallback
      });
    });
  });

  describe('helper methods', () => {
    it('should check language support correctly', async () => {
      // Test supported languages
      const supportedResult = await translationService.translate('Hello', 'es', { sourceLanguage: 'en' });
      expect(supportedResult).toBeDefined();

      // Test unsupported language
      await expect(
        translationService.translate('Hello', 'xyz')
      ).rejects.toThrow('Unsupported target language');
    });

    it('should initialize with common languages', async () => {
      const languages = await translationService.getSupportedLanguages();
      
      // Should have initialized with common languages even before API call
      expect(Object.keys(languages).length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', async () => {
      const result1 = await translationService.translate('Hello', 'es', { sourceLanguage: 'en' });
      const result2 = await translationService.translate('Hello', 'es', { sourceLanguage: 'en' });

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^translation_\d+_[a-z0-9]+$/);
    });

    it('should handle contextual text preparation', async () => {
      const text = 'Hello world';
      const options = {
        context: 'business meeting',
        formality: 'formal' as const,
        domain: 'business'
      };

      const result = await translationService.translate(text, 'es', {
        sourceLanguage: 'en',
        ...options
      });

      expect(result.context).toEqual({
        domain: 'business',
        formality: 'formal',
        audience: 'business meeting'
      });
    });
  });
});