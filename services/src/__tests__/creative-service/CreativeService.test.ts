import { CreativeService } from '../../creative-service/CreativeService';
import {
  CreativeServiceConfig,
  ContentType,
  ContentFormat,
  DesignType,
  CodeType,
  ProgrammingLanguage,
  ComplianceRule
} from '../../creative-service/types';
import { Task, TaskStatus, Priority } from '../../shared/types';

describe('CreativeService', () => {
  let creativeService: CreativeService;
  let mockConfig: CreativeServiceConfig;

  beforeEach(() => {
    mockConfig = {
      openai: {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        maxTokens: 2000
      },
      designTools: {
        canvaApiKey: 'test-canva-key',
        figmaToken: 'test-figma-token'
      },
      compliance: {
        regulatoryRules: [
          {
            id: 'gdpr-1',
            name: 'GDPR Personal Data',
            description: 'Check for personal data handling',
            regulation: 'GDPR',
            industry: ['technology', 'healthcare'],
            patterns: ['personal data', 'email address', 'phone number'],
            severity: 'high'
          }
        ],
        policyDatabase: 'test-policy-db'
      }
    };

    creativeService = new CreativeService(mockConfig);
  });

  describe('Content Generation', () => {
    it('should generate email content successfully', async () => {
      const request = {
        type: ContentType.EMAIL,
        format: ContentFormat.HTML,
        parameters: {
          tone: 'professional' as any,
          length: 'medium' as any,
          subject: 'Test Email',
          callToAction: 'Schedule a meeting'
        },
        audience: {
          demographics: {
            ageRange: '25-45',
            location: 'United States'
          },
          psychographics: {
            interests: ['technology', 'business'],
            values: ['innovation', 'efficiency'],
            lifestyle: ['professional']
          },
          behavior: {
            preferredChannels: ['email'],
            engagementPatterns: ['morning'],
            painPoints: ['time management']
          }
        }
      };

      const result = await creativeService.generateContent(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.variations).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.complianceCheck).toBeDefined(); // Email should trigger compliance check
    });

    it('should generate newsletter content', async () => {
      const topics = ['AI Technology', 'Business Innovation', 'Market Trends'];
      const audience = {
        demographics: { ageRange: '30-50' },
        psychographics: {
          interests: ['technology', 'business'],
          values: ['innovation'],
          lifestyle: ['professional']
        },
        behavior: {
          preferredChannels: ['email'],
          engagementPatterns: ['weekly'],
          painPoints: ['information overload']
        }
      };

      const result = await creativeService.generateNewsletter(topics, audience);

      expect(result).toBeDefined();
      expect(result.content).toContain('Newsletter');
      expect(result.metadata.wordCount).toBeGreaterThan(100);
    });

    it('should generate social media post', async () => {
      const result = await creativeService.generateSocialPost(
        'twitter',
        'Exciting product launch announcement',
        ['#innovation', '#technology'],
        {
          demographics: { ageRange: '18-35' },
          psychographics: {
            interests: ['technology', 'social media'],
            values: ['innovation'],
            lifestyle: ['digital native']
          },
          behavior: {
            preferredChannels: ['social media'],
            engagementPatterns: ['evening'],
            painPoints: ['FOMO']
          }
        }
      );

      expect(result).toBeDefined();
      expect(result.content.length).toBeLessThanOrEqual(280); // Twitter character limit
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should generate blog outline', async () => {
      const result = await creativeService.generateBlogOutline(
        'The Future of AI in Business',
        ['artificial intelligence', 'automation', 'productivity'],
        {
          demographics: { ageRange: '25-45' },
          psychographics: {
            interests: ['technology', 'business strategy'],
            values: ['innovation', 'efficiency'],
            lifestyle: ['professional']
          },
          behavior: {
            preferredChannels: ['blog', 'linkedin'],
            engagementPatterns: ['research phase'],
            painPoints: ['staying current with technology']
          }
        }
      );

      expect(result).toBeDefined();
      expect(result.content).toContain('# Blog Post Outline');
      expect(result.content).toContain('## Introduction');
      expect(result.content).toContain('## Conclusion');
    });
  });

  describe('Design Creation', () => {
    it('should create slide deck design', async () => {
      const specifications = {
        dimensions: { width: 1920, height: 1080, unit: 'px' as const },
        format: 'pptx' as const,
        resolution: 300
      };

      const result = await creativeService.createSlideDeck(
        specifications,
        'Presentation about AI technology',
        {
          colors: {
            primary: '#007bff',
            secondary: ['#6c757d', '#28a745']
          },
          fonts: {
            primary: 'Arial',
            secondary: 'Helvetica'
          },
          voice: {
            tone: 'professional',
            personality: ['innovative', 'trustworthy'],
            doNots: ['casual', 'unprofessional']
          }
        }
      );

      expect(result).toBeDefined();
      expect(result.designUrl).toContain('slidedecks');
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.assets).toBeDefined();
      expect(result.editableUrl).toBeDefined();
    });

    it('should create presentation design', async () => {
      const specifications = {
        dimensions: { width: 1920, height: 1080, unit: 'px' as const },
        format: 'pdf' as const
      };

      const result = await creativeService.createPresentation(specifications);

      expect(result).toBeDefined();
      expect(result.designUrl).toContain('presentations');
      expect(result.metadata.dimensions).toEqual(specifications.dimensions);
    });
  });

  describe('Code Generation', () => {
    it('should generate JavaScript script', async () => {
      const result = await creativeService.generateScript(
        'data processing',
        ProgrammingLanguage.JAVASCRIPT,
        ['read CSV file', 'process data', 'generate report']
      );

      expect(result).toBeDefined();
      expect(result.code).toContain('function');
      expect(result.documentation).toBeDefined();
      expect(result.dependencies).toBeDefined();
      expect(result.metadata.linesOfCode).toBeGreaterThan(0);
    });

    it('should debug code successfully', async () => {
      const buggyCode = `
        function calculateTotal(items) {
          let total = 0;
          for (let i = 0; i <= items.length; i++) {
            total += items[i].price;
          }
          return total;
        }
      `;

      const result = await creativeService.debugCode(
        buggyCode,
        ProgrammingLanguage.JAVASCRIPT,
        'Getting undefined error when accessing array items'
      );

      expect(result).toBeDefined();
      expect(result.fixedCode).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should generate code with proper metadata', async () => {
      const request = {
        type: CodeType.FUNCTION,
        language: ProgrammingLanguage.TYPESCRIPT,
        requirements: 'Create a function that validates email addresses',
        style: {
          indentation: 'spaces' as const,
          indentSize: 2,
          naming: 'camelCase' as const,
          comments: 'detailed' as const,
          errorHandling: 'try-catch' as const
        }
      };

      const result = await creativeService.generateCode(request);

      expect(result).toBeDefined();
      expect(result.code).toContain('function');
      expect(result.metadata.complexity).toBeGreaterThan(0);
      expect(result.metadata.documentation).toBe(true);
    });
  });

  describe('Compliance Checking', () => {
    it('should check GDPR compliance', async () => {
      const content = 'We collect your email address and personal data for marketing purposes.';

      const result = await creativeService.checkGDPRCompliance(content);

      expect(result).toBeDefined();
      expect(result.isCompliant).toBe(false); // Should fail due to missing consent language
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
    });

    it('should check advertising compliance', async () => {
      const content = 'Our product is guaranteed to be the best solution on the market!';

      const result = await creativeService.checkAdvertisingCompliance(content);

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should pass compliance for compliant content', async () => {
      const content = 'Our newsletter provides valuable insights. You can unsubscribe at any time.';

      const result = await creativeService.checkCompliance({
        content,
        type: ContentType.NEWSLETTER,
        regulations: ['CAN-SPAM']
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Creative Brief Processing', () => {
    it('should process creative brief and generate concepts', async () => {
      const brief = {
        id: 'brief-123',
        title: 'Product Launch Campaign',
        description: 'Launch campaign for new AI-powered productivity tool',
        objectives: [
          'Increase brand awareness',
          'Generate leads',
          'Drive product adoption'
        ],
        targetAudience: {
          demographics: {
            ageRange: '25-45',
            location: 'North America'
          },
          psychographics: {
            interests: ['productivity', 'technology', 'business'],
            values: ['efficiency', 'innovation'],
            lifestyle: ['professional', 'tech-savvy']
          },
          behavior: {
            preferredChannels: ['email', 'social media', 'blog'],
            engagementPatterns: ['morning', 'lunch break'],
            painPoints: ['time management', 'workflow inefficiency']
          }
        },
        deliverables: [
          {
            type: ContentType.EMAIL,
            format: 'html',
            specifications: {
              tone: 'professional',
              length: 'medium'
            }
          },
          {
            type: DesignType.SOCIAL_MEDIA_POST,
            format: 'jpg',
            specifications: {
              dimensions: { width: 1080, height: 1080, unit: 'px' },
              platform: 'instagram'
            }
          }
        ],
        constraints: {
          timeline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          resources: ['design team', 'copywriter'],
          restrictions: ['no competitor mentions'],
          requirements: ['brand guidelines compliance']
        },
        createdBy: 'user-123',
        createdAt: new Date()
      };

      const concepts = await creativeService.processCreativeBrief(brief);

      expect(concepts).toBeDefined();
      expect(concepts.length).toBeGreaterThan(0);
      expect(concepts[0].briefId).toBe(brief.id);
      expect(concepts[0].score).toBeGreaterThanOrEqual(0);
      expect(concepts[0].variations).toBeDefined();
    });
  });

  describe('Task Processing', () => {
    it('should process content generation task', async () => {
      const task: Task = {
        id: 'task-123',
        type: 'content_generation',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'creative-service',
        createdBy: 'user-123',
        title: 'Generate Email Content',
        description: 'Generate professional email content',
        data: {
          input: {
            request: {
              type: ContentType.EMAIL,
              format: ContentFormat.HTML,
              parameters: {
                tone: 'professional',
                length: 'medium',
                subject: 'Product Update'
              }
            }
          },
          context: {
            userId: 'user-123',
            metadata: {}
          }
        },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await creativeService.processTask(task);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data.output).toBeDefined();
      expect(result.data.output.content).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should handle task processing errors', async () => {
      const task: Task = {
        id: 'task-456',
        type: 'invalid_task_type',
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        assignedTo: 'creative-service',
        createdBy: 'user-123',
        title: 'Invalid Task',
        description: 'This should fail',
        data: {
          input: {},
          context: {
            userId: 'user-123',
            metadata: {}
          }
        },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(creativeService.processTask(task)).rejects.toThrow();
    });
  });

  describe('Health Status', () => {
    it('should return healthy status', async () => {
      const health = await creativeService.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.services).toBeDefined();
      expect(health.services.contentGenerator).toBe(true);
      expect(health.services.designAssistant).toBe(true);
      expect(health.services.codeAutomation).toBe(true);
      expect(health.services.complianceChecker).toBe(true);
      expect(health.services.briefProcessor).toBe(true);
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle content generation errors gracefully', async () => {
      // Mock a scenario that would cause an error
      const invalidRequest = {
        type: 'invalid_type' as any,
        format: ContentFormat.HTML,
        parameters: {
          tone: 'professional' as any,
          length: 'medium' as any
        }
      };

      await expect(creativeService.generateContent(invalidRequest)).rejects.toThrow();
    });

    it('should handle design creation errors gracefully', async () => {
      const invalidRequest = {
        type: 'invalid_design_type' as any,
        specifications: {
          dimensions: { width: -1, height: -1, unit: 'px' as const },
          format: 'invalid_format' as any
        }
      };

      await expect(creativeService.createDesign(invalidRequest)).rejects.toThrow();
    });
  });
});