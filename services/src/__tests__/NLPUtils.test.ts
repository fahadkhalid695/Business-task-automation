import { NLPUtils } from '../communication-service/NLPUtils';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('NLPUtils', () => {
  let nlpUtils: NLPUtils;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAI);

    nlpUtils = new NLPUtils({
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 500
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeText', () => {
    it('should analyze text and return comprehensive NLP results', async () => {
      const testText = 'I am very happy with your excellent customer service!';

      // Mock OpenAI responses for different analysis calls
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 0.8,
                confidence: 0.9,
                label: 'positive',
                emotions: [
                  { emotion: 'joy', score: 0.8, confidence: 0.9 },
                  { emotion: 'satisfaction', score: 0.7, confidence: 0.8 }
                ]
              })
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'PERSON', value: 'customer', confidence: 0.8, start: 0, end: 8 }
              ])
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                { text: 'customer service', relevance: 0.9, count: 1 },
                { text: 'excellent', relevance: 0.8, count: 1 }
              ])
            }
          }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                { name: 'Customer Service', confidence: 0.9, keywords: ['service', 'customer'] }
              ])
            }
          }]
        } as any);

      const result = await nlpUtils.analyzeText(testText);

      expect(result).toHaveProperty('sentiment');
      expect(result.sentiment.label).toBe('positive');
      expect(result.sentiment.score).toBe(0.8);
      expect(result.sentiment.confidence).toBe(0.9);
      expect(result.sentiment.emotions).toHaveLength(2);

      expect(result).toHaveProperty('entities');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('PERSON');

      expect(result).toHaveProperty('keywords');
      expect(result.keywords).toHaveLength(2);
      expect(result.keywords[0].text).toBe('customer service');

      expect(result).toHaveProperty('topics');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].name).toBe('Customer Service');

      expect(result).toHaveProperty('language');
      expect(result.language).toBe('en');

      expect(result).toHaveProperty('readabilityScore');
      expect(typeof result.readabilityScore).toBe('number');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const testText = 'Test text for error handling';

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(nlpUtils.analyzeText(testText)).rejects.toThrow('NLP analysis failed');
    });

    it('should generate summary for long text', async () => {
      const longText = 'A'.repeat(600); // Text longer than 500 characters

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify({ score: 0, confidence: 0.5, label: 'neutral', emotions: [] }) } }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([]) } }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([]) } }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([]) } }]
        } as any)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'This is a test summary.' } }]
        } as any);

      const result = await nlpUtils.analyzeText(longText);

      expect(result.summary).toBe('This is a test summary.');
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 0.8,
              confidence: 0.9,
              label: 'positive',
              emotions: [{ emotion: 'joy', score: 0.8, confidence: 0.9 }]
            })
          }
        }]
      } as any);

      const result = await nlpUtils.analyzeSentiment('I love this product!');

      expect(result.label).toBe('positive');
      expect(result.score).toBe(0.8);
      expect(result.confidence).toBe(0.9);
      expect(result.emotions).toHaveLength(1);
    });

    it('should analyze negative sentiment correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              score: -0.7,
              confidence: 0.85,
              label: 'negative',
              emotions: [{ emotion: 'anger', score: 0.7, confidence: 0.8 }]
            })
          }
        }]
      } as any);

      const result = await nlpUtils.analyzeSentiment('This is terrible and I hate it!');

      expect(result.label).toBe('negative');
      expect(result.score).toBe(-0.7);
      expect(result.confidence).toBe(0.85);
    });

    it('should fallback to simple sentiment analysis on API error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await nlpUtils.analyzeSentiment('I am happy with good service');

      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(result.label).toBe('positive'); // Should detect positive words
    });
  });

  describe('extractEntities', () => {
    it('should extract named entities from text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              { type: 'PERSON', value: 'John Smith', confidence: 0.95, start: 0, end: 10 },
              { type: 'ORGANIZATION', value: 'Microsoft', confidence: 0.9, start: 15, end: 24 }
            ])
          }
        }]
      } as any);

      const result = await nlpUtils.extractEntities('John Smith works at Microsoft');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('PERSON');
      expect(result[0].value).toBe('John Smith');
      expect(result[1].type).toBe('ORGANIZATION');
      expect(result[1].value).toBe('Microsoft');
    });

    it('should fallback to simple entity extraction on API error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await nlpUtils.extractEntities('Contact me at john@example.com or call 555-123-4567');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(entity => entity.type === 'EMAIL')).toBe(true);
    });
  });

  describe('extractKeywords', () => {
    it('should extract relevant keywords from text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              { text: 'machine learning', relevance: 0.95, count: 3 },
              { text: 'artificial intelligence', relevance: 0.8, count: 2 }
            ])
          }
        }]
      } as any);

      const result = await nlpUtils.extractKeywords('Machine learning and artificial intelligence are transforming technology');

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('machine learning');
      expect(result[0].relevance).toBe(0.95);
      expect(result[0].count).toBe(3);
    });

    it('should fallback to simple keyword extraction on API error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await nlpUtils.extractKeywords('customer service support help assistance');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('relevance');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('extractTopics', () => {
    it('should extract main topics from text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              { name: 'Customer Service', confidence: 0.9, keywords: ['support', 'help', 'assistance'] },
              { name: 'Technical Issues', confidence: 0.8, keywords: ['bug', 'error', 'problem'] }
            ])
          }
        }]
      } as any);

      const result = await nlpUtils.extractTopics('I need help with customer support for a technical bug');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Customer Service');
      expect(result[0].confidence).toBe(0.9);
      expect(result[0].keywords).toContain('support');
    });
  });

  describe('detectLanguage', () => {
    it('should detect English language', async () => {
      const result = await nlpUtils.detectLanguage('This is an English sentence with common words');

      expect(result).toBe('en');
    });

    it('should detect Spanish language', async () => {
      const result = await nlpUtils.detectLanguage('Esta es una oración en español con palabras comunes');

      expect(result).toBe('es');
    });

    it('should default to English for unknown languages', async () => {
      const result = await nlpUtils.detectLanguage('xyz abc def');

      expect(result).toBe('en');
    });
  });

  describe('calculateReadabilityScore', () => {
    it('should calculate readability score for simple text', () => {
      const result = nlpUtils.calculateReadabilityScore('This is a simple sentence. It is easy to read.');

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle empty text gracefully', () => {
      const result = nlpUtils.calculateReadabilityScore('');

      expect(result).toBe(50); // Neutral score
    });

    it('should calculate higher scores for simpler text', () => {
      const simpleText = 'Cat sat on mat. Dog ran fast.';
      const complexText = 'The multifaceted implementation of sophisticated algorithms necessitates comprehensive understanding of computational complexity.';

      const simpleScore = nlpUtils.calculateReadabilityScore(simpleText);
      const complexScore = nlpUtils.calculateReadabilityScore(complexText);

      expect(simpleScore).toBeGreaterThan(complexScore);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for long text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'This is a concise summary of the main points.'
          }
        }]
      } as any);

      const longText = 'This is a very long text that needs to be summarized. '.repeat(20);
      const result = await nlpUtils.generateSummary(longText);

      expect(result).toBe('This is a concise summary of the main points.');
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await nlpUtils.generateSummary('Some text to summarize');

      expect(result).toBe('Summary not available.');
    });
  });

  describe('extractActionItems', () => {
    it('should extract action items from meeting text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              'John will prepare the report by Friday',
              'Schedule follow-up meeting with client',
              'Review contract terms'
            ])
          }
        }]
      } as any);

      const meetingText = 'John will prepare the report by Friday. We need to schedule a follow-up meeting with the client. Someone should review the contract terms.';
      const result = await nlpUtils.extractActionItems(meetingText);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('John will prepare the report by Friday');
      expect(result[1]).toBe('Schedule follow-up meeting with client');
      expect(result[2]).toBe('Review contract terms');
    });

    it('should fallback to simple action item extraction on API error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await nlpUtils.extractActionItems('John will complete the task. We need to follow up on this issue.');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(item => item.includes('will complete'))).toBe(true);
    });

    it('should handle text with no action items', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([])
          }
        }]
      } as any);

      const result = await nlpUtils.extractActionItems('This is just a regular conversation with no specific actions.');

      expect(result).toHaveLength(0);
    });
  });
});