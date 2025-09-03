import { ContentGenerator } from '../../creative-service/ContentGenerator';
import { ContentType, ContentFormat } from '../../creative-service/types';

describe('ContentGenerator', () => {
  let contentGenerator: ContentGenerator;

  beforeEach(() => {
    contentGenerator = new ContentGenerator({
      apiKey: 'test-api-key',
      model: 'gpt-4',
      maxTokens: 2000
    });
  });

  describe('Content Generation', () => {
    it('should generate email content with proper structure', async () => {
      const result = await contentGenerator.generateEmail(
        'Meeting Request',
        'Schedule a project discussion',
        {
          demographics: { ageRange: '30-50' },
          psychographics: {
            interests: ['business', 'productivity'],
            values: ['efficiency'],
            lifestyle: ['professional']
          },
          behavior: {
            preferredChannels: ['email'],
            engagementPatterns: ['morning'],
            painPoints: ['time management']
          }
        },
        'professional'
      );

      expect(result.content).toContain('Subject:');
      expect(result.content).toContain('Dear');
      expect(result.content).toContain('Best regards');
      expect(result.metadata.wordCount).toBeGreaterThan(50);
      expect(result.metadata.sentiment.label).toBe('positive');
      expect(result.variations).toHaveLength(2);
      expect(result.suggestions).toBeDefined();
    });

    it('should generate newsletter with multiple sections', async () => {
      const result = await contentGenerator.generateNewsletter(
        ['Technology Updates', 'Industry News', 'Product Features'],
        {
          demographics: { ageRange: '25-45' },
          psychographics: {
            interests: ['technology', 'innovation'],
            values: ['learning'],
            lifestyle: ['tech-savvy']
          },
          behavior: {
            preferredChannels: ['email', 'newsletter'],
            engagementPatterns: ['weekly'],
            painPoints: ['information overload']
          }
        }
      );

      expect(result.content).toContain('Newsletter');
      expect(result.content).toContain('<h1>');
      expect(result.content).toContain('<h2>');
      expect(result.metadata.wordCount).toBeGreaterThan(200);
    });

    it('should generate Twitter-compliant social post', async () => {
      const result = await contentGenerator.generateSocialPost(
        'twitter',
        'Exciting product announcement',
        ['#innovation', '#tech'],
        {
          demographics: { ageRange: '18-35' },
          psychographics: {
            interests: ['social media', 'technology'],
            values: ['innovation'],
            lifestyle: ['digital native']
          },
          behavior: {
            preferredChannels: ['twitter', 'social media'],
            engagementPatterns: ['evening'],
            painPoints: ['FOMO']
          }
        }
      );

      expect(result.content.length).toBeLessThanOrEqual(280);
      expect(result.content).toContain('#');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should generate LinkedIn professional post', async () => {
      const result = await contentGenerator.generateSocialPost(
        'linkedin',
        'Professional achievement announcement',
        ['#career', '#success'],
        {
          demographics: { ageRange: '25-45' },
          psychographics: {
            interests: ['career development', 'networking'],
            values: ['professionalism'],
            lifestyle: ['career-focused']
          },
          behavior: {
            preferredChannels: ['linkedin'],
            engagementPatterns: ['business hours'],
            painPoints: ['career advancement']
          }
        }
      );

      expect(result.content).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(10);
    });

    it('should generate structured blog outline', async () => {
      const result = await contentGenerator.generateBlogOutline(
        'The Future of Remote Work',
        ['remote work', 'productivity', 'collaboration', 'technology'],
        {
          demographics: { ageRange: '25-50' },
          psychographics: {
            interests: ['work-life balance', 'productivity'],
            values: ['flexibility'],
            lifestyle: ['remote worker']
          },
          behavior: {
            preferredChannels: ['blog', 'articles'],
            engagementPatterns: ['research mode'],
            painPoints: ['work-life balance']
          }
        }
      );

      expect(result.content).toContain('# Blog Post Outline');
      expect(result.content).toContain('## Introduction');
      expect(result.content).toContain('## Main Content');
      expect(result.content).toContain('## Conclusion');
      expect(result.content).toContain('### Section');
    });

    it('should generate product description with benefits', async () => {
      const result = await contentGenerator.generateProductDescription(
        'AI-Powered Task Manager',
        ['intelligent scheduling', 'automated reminders', 'team collaboration'],
        ['increased productivity', 'better time management', 'reduced stress'],
        {
          demographics: { ageRange: '25-45' },
          psychographics: {
            interests: ['productivity tools', 'technology'],
            values: ['efficiency', 'organization'],
            lifestyle: ['busy professional']
          },
          behavior: {
            preferredChannels: ['website', 'app store'],
            engagementPatterns: ['problem-solving mode'],
            painPoints: ['task management', 'time constraints']
          }
        }
      );

      expect(result.content).toContain('AI-Powered Task Manager');
      expect(result.metadata.wordCount).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('productivity');
    });
  });

  describe('Content Analysis', () => {
    it('should analyze content metadata correctly', async () => {
      const result = await contentGenerator.generateEmail(
        'Exciting News!',
        'Share amazing updates',
        {
          demographics: {},
          psychographics: { interests: [], values: [], lifestyle: [] },
          behavior: { preferredChannels: [], engagementPatterns: [], painPoints: [] }
        },
        'friendly'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.readingTime).toBeGreaterThan(0);
      expect(result.metadata.sentiment).toBeDefined();
      expect(result.metadata.keywords).toBeDefined();
      expect(result.metadata.topics).toBeDefined();
      expect(result.metadata.language).toBe('en');
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it('should detect positive sentiment in enthusiastic content', async () => {
      const result = await contentGenerator.generateSocialPost(
        'instagram',
        'Amazing fantastic wonderful excellent great news to share!',
        ['#amazing', '#fantastic']
      );

      expect(result.metadata.sentiment.label).toBe('positive');
      expect(result.metadata.sentiment.score).toBeGreaterThan(0);
    });

    it('should extract relevant keywords', async () => {
      const result = await contentGenerator.generateContent({
        type: ContentType.BLOG_OUTLINE,
        format: ContentFormat.MARKDOWN,
        parameters: {
          tone: 'informative',
          length: 'long',
          keywords: ['artificial intelligence', 'machine learning', 'automation'],
          subject: 'AI in Business'
        }
      });

      expect(result.metadata.keywords).toContain('artificial');
      expect(result.metadata.keywords).toContain('intelligence');
      expect(result.metadata.keywords).toContain('business');
    });
  });

  describe('Content Variations', () => {
    it('should generate multiple content variations', async () => {
      const result = await contentGenerator.generateContent({
        type: ContentType.EMAIL,
        format: ContentFormat.HTML,
        parameters: {
          tone: 'professional',
          length: 'medium',
          subject: 'Project Update'
        }
      });

      expect(result.variations).toBeDefined();
      expect(result.variations!.length).toBe(2);
      expect(result.variations![0]).not.toBe(result.content);
      expect(result.variations![1]).not.toBe(result.content);
    });

    it('should provide helpful suggestions', async () => {
      const result = await contentGenerator.generateContent({
        type: ContentType.EMAIL,
        format: ContentFormat.PLAIN_TEXT,
        parameters: {
          tone: 'friendly',
          length: 'short',
          keywords: ['meeting', 'schedule', 'important']
        }
      });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid content type gracefully', async () => {
      const invalidRequest = {
        type: 'invalid_type' as any,
        format: ContentFormat.HTML,
        parameters: {
          tone: 'professional' as any,
          length: 'medium' as any
        }
      };

      await expect(contentGenerator.generateContent(invalidRequest)).rejects.toThrow();
    });

    it('should handle missing parameters gracefully', async () => {
      const incompleteRequest = {
        type: ContentType.EMAIL,
        format: ContentFormat.HTML,
        parameters: {} as any
      };

      const result = await contentGenerator.generateContent(incompleteRequest);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Brand Guidelines Integration', () => {
    it('should incorporate brand guidelines in content', async () => {
      const brandGuidelines = {
        colors: {
          primary: '#007bff',
          secondary: ['#6c757d']
        },
        fonts: {
          primary: 'Arial',
          secondary: 'Helvetica'
        },
        voice: {
          tone: 'professional',
          personality: ['innovative', 'trustworthy', 'approachable'],
          doNots: ['casual', 'unprofessional', 'overly technical']
        }
      };

      const result = await contentGenerator.generateContent({
        type: ContentType.EMAIL,
        format: ContentFormat.HTML,
        parameters: {
          tone: 'professional',
          length: 'medium'
        },
        brandGuidelines
      });

      expect(result.content).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });
  });
});