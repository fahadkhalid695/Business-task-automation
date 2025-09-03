import OpenAI from 'openai';
import {
  NLPAnalysisResult,
  SentimentAnalysis,
  Entity,
  Keyword,
  Topic,
  EmotionScore
} from './types';
import { logger } from '../shared/utils/logger';

export class NLPUtils {
  private openai: OpenAI;

  constructor(config: { apiKey: string; model: string; maxTokens: number }) {
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
  }

  /**
   * Comprehensive text analysis for content insights
   * Requirement 3.1, 3.4: Natural language processing for content analysis
   */
  async analyzeText(text: string): Promise<NLPAnalysisResult> {
    try {
      logger.info('Starting NLP text analysis', { textLength: text.length });

      // Perform parallel analysis
      const [
        sentiment,
        entities,
        keywords,
        topics,
        language,
        readabilityScore,
        summary
      ] = await Promise.all([
        this.analyzeSentiment(text),
        this.extractEntities(text),
        this.extractKeywords(text),
        this.extractTopics(text),
        this.detectLanguage(text),
        this.calculateReadabilityScore(text),
        text.length > 500 ? this.generateSummary(text) : Promise.resolve(undefined)
      ]);

      const result: NLPAnalysisResult = {
        sentiment,
        entities,
        keywords,
        topics,
        language,
        readabilityScore,
        summary
      };

      logger.info('NLP text analysis completed', {
        sentiment: sentiment.label,
        entityCount: entities.length,
        keywordCount: keywords.length,
        topicCount: topics.length,
        language
      });

      return result;

    } catch (error) {
      logger.error('Error analyzing text', error);
      throw new Error(`NLP analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze sentiment with emotion detection
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Analyze the sentiment and emotions in the given text. Return a JSON response with this format:
{
  "score": -0.8,
  "confidence": 0.95,
  "label": "negative",
  "emotions": [
    {"emotion": "anger", "score": 0.7, "confidence": 0.9},
    {"emotion": "frustration", "score": 0.6, "confidence": 0.8}
  ]
}

Score should be between -1 (very negative) and 1 (very positive).
Label should be "positive", "negative", or "neutral".
Include up to 3 most prominent emotions with their scores (0-1) and confidence levels.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const parsed = JSON.parse(response);
          return {
            score: parsed.score || 0,
            confidence: parsed.confidence || 0.5,
            label: parsed.label || 'neutral',
            emotions: parsed.emotions || []
          };
        } catch {
          // Fallback to simple sentiment analysis
          return this.simpleSentimentAnalysis(text);
        }
      }

      return this.simpleSentimentAnalysis(text);

    } catch (error) {
      logger.error('Error analyzing sentiment', error);
      return this.simpleSentimentAnalysis(text);
    }
  }

  /**
   * Extract named entities from text
   */
  async extractEntities(text: string): Promise<Entity[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Extract named entities from the text. Return a JSON array with this format:
[
  {"type": "PERSON", "value": "John Smith", "confidence": 0.95, "start": 0, "end": 10},
  {"type": "ORGANIZATION", "value": "Microsoft", "confidence": 0.9, "start": 15, "end": 24}
]

Entity types: PERSON, ORGANIZATION, LOCATION, DATE, TIME, MONEY, PERCENT, PRODUCT, EVENT, EMAIL, PHONE, URL`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const entities = JSON.parse(response);
          return Array.isArray(entities) ? entities : [];
        } catch {
          return this.simpleEntityExtraction(text);
        }
      }

      return this.simpleEntityExtraction(text);

    } catch (error) {
      logger.error('Error extracting entities', error);
      return this.simpleEntityExtraction(text);
    }
  }

  /**
   * Extract keywords with relevance scores
   */
  async extractKeywords(text: string): Promise<Keyword[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Extract the most important keywords and phrases from the text. Return a JSON array with this format:
[
  {"text": "machine learning", "relevance": 0.95, "count": 3},
  {"text": "artificial intelligence", "relevance": 0.8, "count": 2}
]

Include up to 10 keywords, ranked by relevance (0-1). Count how many times each keyword appears.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 400,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const keywords = JSON.parse(response);
          return Array.isArray(keywords) ? keywords : [];
        } catch {
          return this.simpleKeywordExtraction(text);
        }
      }

      return this.simpleKeywordExtraction(text);

    } catch (error) {
      logger.error('Error extracting keywords', error);
      return this.simpleKeywordExtraction(text);
    }
  }

  /**
   * Extract topics and themes
   */
  async extractTopics(text: string): Promise<Topic[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Identify the main topics and themes in the text. Return a JSON array with this format:
[
  {"name": "Customer Service", "confidence": 0.9, "keywords": ["support", "help", "assistance"]},
  {"name": "Technical Issues", "confidence": 0.8, "keywords": ["bug", "error", "problem"]}
]

Include up to 5 topics with confidence scores (0-1) and related keywords.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 400,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const topics = JSON.parse(response);
          return Array.isArray(topics) ? topics : [];
        } catch {
          return this.simpleTopicExtraction(text);
        }
      }

      return this.simpleTopicExtraction(text);

    } catch (error) {
      logger.error('Error extracting topics', error);
      return this.simpleTopicExtraction(text);
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      // Simple language detection based on common words
      const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const spanishWords = ['el', 'la', 'y', 'o', 'pero', 'en', 'con', 'por', 'para', 'de', 'que'];
      const frenchWords = ['le', 'la', 'et', 'ou', 'mais', 'dans', 'sur', 'avec', 'par', 'pour', 'de'];

      const lowerText = text.toLowerCase();
      const words = lowerText.split(/\s+/);

      const englishScore = englishWords.reduce((score, word) => 
        score + (words.includes(word) ? 1 : 0), 0);
      const spanishScore = spanishWords.reduce((score, word) => 
        score + (words.includes(word) ? 1 : 0), 0);
      const frenchScore = frenchWords.reduce((score, word) => 
        score + (words.includes(word) ? 1 : 0), 0);

      if (englishScore >= spanishScore && englishScore >= frenchScore) {
        return 'en';
      } else if (spanishScore >= frenchScore) {
        return 'es';
      } else if (frenchScore > 0) {
        return 'fr';
      }

      return 'en'; // Default to English

    } catch (error) {
      logger.error('Error detecting language', error);
      return 'en';
    }
  }

  /**
   * Calculate readability score
   */
  calculateReadabilityScore(text: string): number {
    try {
      // Simple Flesch Reading Ease approximation
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

      if (sentences.length === 0 || words.length === 0) {
        return 50; // Neutral score
      }

      const avgWordsPerSentence = words.length / sentences.length;
      const avgSyllablesPerWord = syllables / words.length;

      // Flesch Reading Ease formula
      const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

      // Normalize to 0-100 scale
      return Math.max(0, Math.min(100, score));

    } catch (error) {
      logger.error('Error calculating readability score', error);
      return 50;
    }
  }

  /**
   * Generate summary of long text
   */
  async generateSummary(text: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Provide a concise summary of the following text in 2-3 sentences, capturing the main points and key information.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      return completion.choices[0]?.message?.content || 'Summary not available.';

    } catch (error) {
      logger.error('Error generating summary', error);
      return 'Summary not available.';
    }
  }

  /**
   * Extract action items from text
   * Requirement 3.2: Extract action items from transcriptions
   */
  async extractActionItems(text: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Extract action items from the text. Look for tasks, assignments, deadlines, and follow-ups. Return a JSON array of strings:
["John will prepare the report by Friday", "Schedule follow-up meeting with client", "Review contract terms"]

Focus on specific, actionable items with clear ownership when possible.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const actionItems = JSON.parse(response);
          return Array.isArray(actionItems) ? actionItems : [];
        } catch {
          return this.simpleActionItemExtraction(text);
        }
      }

      return this.simpleActionItemExtraction(text);

    } catch (error) {
      logger.error('Error extracting action items', error);
      return this.simpleActionItemExtraction(text);
    }
  }

  // Private helper methods
  private simpleSentimentAnalysis(text: string): SentimentAnalysis {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'frustrated', 'disappointed', 'upset'];

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);

    const positiveCount = positiveWords.reduce((count, word) => 
      count + (words.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((count, word) => 
      count + (words.includes(word) ? 1 : 0), 0);

    const totalSentimentWords = positiveCount + negativeCount;
    
    if (totalSentimentWords === 0) {
      return { score: 0, confidence: 0.5, label: 'neutral', emotions: [] };
    }

    const score = (positiveCount - negativeCount) / totalSentimentWords;
    const confidence = Math.min(0.9, totalSentimentWords / words.length * 10);

    let label: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (score > 0.1) label = 'positive';
    else if (score < -0.1) label = 'negative';

    return { score, confidence, label, emotions: [] };
  }

  private simpleEntityExtraction(text: string): Entity[] {
    const entities: Entity[] = [];
    
    // Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: 'EMAIL',
        value: match[0],
        confidence: 0.9,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Phone pattern (simple)
    const phoneRegex = /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        type: 'PHONE',
        value: match[0],
        confidence: 0.8,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return entities;
  }

  private simpleKeywordExtraction(text: string): Keyword[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordCount: { [word: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([text, count]) => ({
        text,
        relevance: Math.min(1, count / words.length * 10),
        count
      }));
  }

  private simpleTopicExtraction(text: string): Topic[] {
    const businessTopics = [
      { name: 'Customer Service', keywords: ['customer', 'service', 'support', 'help'] },
      { name: 'Technical Issues', keywords: ['bug', 'error', 'problem', 'issue', 'technical'] },
      { name: 'Billing', keywords: ['payment', 'invoice', 'billing', 'charge', 'refund'] },
      { name: 'Sales', keywords: ['sales', 'purchase', 'buy', 'pricing', 'quote'] }
    ];

    const lowerText = text.toLowerCase();
    
    return businessTopics
      .map(topic => {
        const matchCount = topic.keywords.reduce((count, keyword) => 
          count + (lowerText.includes(keyword) ? 1 : 0), 0);
        
        return {
          name: topic.name,
          confidence: Math.min(1, matchCount / topic.keywords.length),
          keywords: topic.keywords.filter(keyword => lowerText.includes(keyword))
        };
      })
      .filter(topic => topic.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);
  }

  private simpleActionItemExtraction(text: string): string[] {
    const actionPatterns = [
      /will\s+\w+/gi,
      /need\s+to\s+\w+/gi,
      /should\s+\w+/gi,
      /must\s+\w+/gi,
      /action:\s*(.+)/gi,
      /todo:\s*(.+)/gi,
      /follow.up:\s*(.+)/gi
    ];

    const actionItems: string[] = [];
    
    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const item = match[1] || match[0];
        if (item && item.length > 10) {
          actionItems.push(item.trim());
        }
      }
    });

    return [...new Set(actionItems)].slice(0, 10); // Remove duplicates and limit
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = 'aeiouy';
    let syllableCount = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      previousWasVowel = isVowel;
    }

    // Handle silent 'e'
    if (word.endsWith('e')) {
      syllableCount--;
    }

    return Math.max(1, syllableCount);
  }
}