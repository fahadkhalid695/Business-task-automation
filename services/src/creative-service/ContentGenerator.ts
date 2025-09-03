import {
  ContentGenerationRequest,
  ContentGenerationResult,
  ContentType,
  ContentFormat,
  ContentParameters,
  AudienceProfile,
  BrandGuidelines,
  ContentMetadata
} from './types';
import { logger } from '../shared/utils/logger';

export class ContentGenerator {
  private openaiApiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(config: { apiKey: string; model: string; maxTokens: number }) {
    this.openaiApiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  /**
   * Generate content for various formats
   * Requirement 6.1: Generate drafts for emails, newsletters, social posts, and blog outlines
   */
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    try {
      logger.info('Generating content', { type: request.type, format: request.format });

      const prompt = this.buildPrompt(request);
      const content = await this.callOpenAI(prompt);
      
      // Generate variations if requested
      const variations = await this.generateVariations(content, request, 2);
      
      // Analyze content metadata
      const metadata = this.analyzeContent(content);
      
      // Generate suggestions for improvement
      const suggestions = await this.generateSuggestions(content, request);

      return {
        content,
        metadata,
        variations,
        suggestions
      };

    } catch (error) {
      logger.error('Error generating content', error);
      throw error;
    }
  }

  /**
   * Generate email content with specific formatting
   */
  async generateEmail(
    subject: string,
    purpose: string,
    audience: AudienceProfile,
    tone: string = 'professional',
    length: string = 'medium'
  ): Promise<ContentGenerationResult> {
    const request: ContentGenerationRequest = {
      type: ContentType.EMAIL,
      format: ContentFormat.HTML,
      parameters: {
        tone: tone as any,
        length: length as any,
        subject,
        callToAction: purpose
      },
      audience
    };

    return this.generateContent(request);
  }

  /**
   * Generate newsletter content
   */
  async generateNewsletter(
    topics: string[],
    audience: AudienceProfile,
    brandGuidelines?: BrandGuidelines
  ): Promise<ContentGenerationResult> {
    const request: ContentGenerationRequest = {
      type: ContentType.NEWSLETTER,
      format: ContentFormat.HTML,
      parameters: {
        tone: 'friendly',
        length: 'long',
        keywords: topics
      },
      audience,
      brandGuidelines
    };

    return this.generateContent(request);
  }

  /**
   * Generate social media posts
   */
  async generateSocialPost(
    platform: string,
    message: string,
    hashtags?: string[],
    audience?: AudienceProfile
  ): Promise<ContentGenerationResult> {
    const request: ContentGenerationRequest = {
      type: ContentType.SOCIAL_POST,
      format: ContentFormat.PLAIN_TEXT,
      parameters: {
        tone: 'casual',
        length: 'short',
        platform,
        keywords: hashtags
      },
      audience
    };

    // Add platform-specific constraints
    if (platform.toLowerCase() === 'twitter') {
      request.parameters.customLength = 280;
      request.parameters.length = 'custom';
    } else if (platform.toLowerCase() === 'linkedin') {
      request.parameters.tone = 'professional';
    }

    return this.generateContent(request);
  }

  /**
   * Generate blog outline
   */
  async generateBlogOutline(
    topic: string,
    targetKeywords: string[],
    audience: AudienceProfile,
    length: string = 'medium'
  ): Promise<ContentGenerationResult> {
    const request: ContentGenerationRequest = {
      type: ContentType.BLOG_OUTLINE,
      format: ContentFormat.MARKDOWN,
      parameters: {
        tone: 'informative',
        length: length as any,
        keywords: targetKeywords,
        subject: topic
      },
      audience
    };

    return this.generateContent(request);
  }

  /**
   * Generate product descriptions
   */
  async generateProductDescription(
    productName: string,
    features: string[],
    benefits: string[],
    audience: AudienceProfile
  ): Promise<ContentGenerationResult> {
    const request: ContentGenerationRequest = {
      type: ContentType.PRODUCT_DESCRIPTION,
      format: ContentFormat.HTML,
      parameters: {
        tone: 'persuasive',
        length: 'medium',
        keywords: [...features, ...benefits],
        subject: productName
      },
      audience
    };

    return this.generateContent(request);
  }

  // Private helper methods
  private buildPrompt(request: ContentGenerationRequest): string {
    let prompt = `Generate ${request.type.replace('_', ' ')} content with the following specifications:\n\n`;
    
    // Add content parameters
    prompt += `Tone: ${request.parameters.tone}\n`;
    prompt += `Length: ${request.parameters.length}`;
    
    if (request.parameters.customLength) {
      prompt += ` (${request.parameters.customLength} characters)`;
    }
    prompt += '\n';

    if (request.parameters.subject) {
      prompt += `Subject/Topic: ${request.parameters.subject}\n`;
    }

    if (request.parameters.keywords && request.parameters.keywords.length > 0) {
      prompt += `Keywords to include: ${request.parameters.keywords.join(', ')}\n`;
    }

    if (request.parameters.callToAction) {
      prompt += `Call to action: ${request.parameters.callToAction}\n`;
    }

    if (request.parameters.platform) {
      prompt += `Platform: ${request.parameters.platform}\n`;
    }

    // Add audience information
    if (request.audience) {
      prompt += '\nTarget Audience:\n';
      
      if (request.audience.demographics) {
        const demo = request.audience.demographics;
        if (demo.ageRange) prompt += `- Age: ${demo.ageRange}\n`;
        if (demo.location) prompt += `- Location: ${demo.location}\n`;
        if (demo.education) prompt += `- Education: ${demo.education}\n`;
      }

      if (request.audience.psychographics) {
        const psycho = request.audience.psychographics;
        if (psycho.interests.length > 0) {
          prompt += `- Interests: ${psycho.interests.join(', ')}\n`;
        }
        if (psycho.values.length > 0) {
          prompt += `- Values: ${psycho.values.join(', ')}\n`;
        }
      }

      if (request.audience.behavior) {
        const behavior = request.audience.behavior;
        if (behavior.painPoints.length > 0) {
          prompt += `- Pain Points: ${behavior.painPoints.join(', ')}\n`;
        }
      }
    }

    // Add brand guidelines
    if (request.brandGuidelines) {
      prompt += '\nBrand Guidelines:\n';
      if (request.brandGuidelines.voice) {
        prompt += `- Brand Voice: ${request.brandGuidelines.voice.tone}\n`;
        prompt += `- Personality: ${request.brandGuidelines.voice.personality.join(', ')}\n`;
        if (request.brandGuidelines.voice.doNots.length > 0) {
          prompt += `- Avoid: ${request.brandGuidelines.voice.doNots.join(', ')}\n`;
        }
      }
    }

    // Add format-specific instructions
    prompt += '\nFormat Requirements:\n';
    switch (request.format) {
      case ContentFormat.HTML:
        prompt += '- Use proper HTML formatting with semantic tags\n';
        prompt += '- Include appropriate headings, paragraphs, and lists\n';
        break;
      case ContentFormat.MARKDOWN:
        prompt += '- Use Markdown formatting\n';
        prompt += '- Include proper headings and bullet points\n';
        break;
      case ContentFormat.PLAIN_TEXT:
        prompt += '- Plain text only, no formatting\n';
        break;
    }

    // Add content type specific instructions
    switch (request.type) {
      case ContentType.EMAIL:
        prompt += '- Include subject line and clear structure\n';
        prompt += '- Professional email format with greeting and closing\n';
        break;
      case ContentType.SOCIAL_POST:
        prompt += '- Engaging and shareable content\n';
        prompt += '- Include relevant hashtags if appropriate\n';
        break;
      case ContentType.BLOG_OUTLINE:
        prompt += '- Create a structured outline with main points and subpoints\n';
        prompt += '- Include introduction, main sections, and conclusion\n';
        break;
      case ContentType.NEWSLETTER:
        prompt += '- Include multiple sections with varied content\n';
        prompt += '- Add engaging headlines and clear sections\n';
        break;
    }

    prompt += '\nGenerate high-quality, engaging content that meets all the above requirements.';

    return prompt;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    // Mock implementation - in real scenario, this would call OpenAI API
    logger.info('Calling OpenAI API', { promptLength: prompt.length });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock content based on prompt analysis
    if (prompt.includes('email')) {
      return this.generateMockEmail(prompt);
    } else if (prompt.includes('social_post')) {
      return this.generateMockSocialPost(prompt);
    } else if (prompt.includes('blog_outline')) {
      return this.generateMockBlogOutline(prompt);
    } else if (prompt.includes('newsletter')) {
      return this.generateMockNewsletter(prompt);
    } else {
      return this.generateMockGenericContent(prompt);
    }
  }

  private async generateVariations(
    originalContent: string,
    request: ContentGenerationRequest,
    count: number
  ): Promise<string[]> {
    const variations: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Create variation prompt
      const variationPrompt = `Create a variation of the following content while maintaining the same tone and purpose:\n\n${originalContent}\n\nVariation ${i + 1}:`;
      const variation = await this.callOpenAI(variationPrompt);
      variations.push(variation);
    }
    
    return variations;
  }

  private analyzeContent(content: string): ContentMetadata {
    const words = content.split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // Average reading speed
    
    // Simple sentiment analysis (mock)
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    let sentimentScore = 0;
    let sentimentLabel = 'neutral';
    
    if (positiveCount > negativeCount) {
      sentimentScore = 0.5;
      sentimentLabel = 'positive';
    } else if (negativeCount > positiveCount) {
      sentimentScore = -0.5;
      sentimentLabel = 'negative';
    }

    // Extract keywords (simple implementation)
    const keywords = this.extractKeywords(content);
    
    // Extract topics (mock implementation)
    const topics = this.extractTopics(content);

    return {
      wordCount: words,
      readingTime,
      sentiment: {
        score: sentimentScore,
        label: sentimentLabel
      },
      keywords,
      topics,
      language: 'en',
      generatedAt: new Date()
    };
  }

  private async generateSuggestions(
    content: string,
    request: ContentGenerationRequest
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Analyze content and provide suggestions
    const metadata = this.analyzeContent(content);
    
    if (metadata.wordCount < 50 && request.parameters.length !== 'short') {
      suggestions.push('Consider expanding the content with more details or examples');
    }
    
    if (metadata.wordCount > 500 && request.parameters.length === 'short') {
      suggestions.push('Content might be too long for the specified length requirement');
    }
    
    if (metadata.sentiment.label === 'negative' && request.parameters.tone === 'friendly') {
      suggestions.push('Consider using more positive language to match the friendly tone');
    }
    
    if (request.parameters.keywords) {
      const missingKeywords = request.parameters.keywords.filter(
        keyword => !content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (missingKeywords.length > 0) {
        suggestions.push(`Consider including these keywords: ${missingKeywords.join(', ')}`);
      }
    }
    
    return suggestions;
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction (in real implementation, use NLP library)
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractTopics(content: string): string[] {
    // Mock topic extraction
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('business') || lowerContent.includes('company')) {
      topics.push('Business');
    }
    if (lowerContent.includes('technology') || lowerContent.includes('tech')) {
      topics.push('Technology');
    }
    if (lowerContent.includes('marketing') || lowerContent.includes('promotion')) {
      topics.push('Marketing');
    }
    if (lowerContent.includes('product') || lowerContent.includes('service')) {
      topics.push('Products & Services');
    }
    
    return topics;
  }

  // Mock content generators
  private generateMockEmail(prompt: string): string {
    return `Subject: Professional Business Communication

Dear [Recipient],

I hope this email finds you well. I am writing to discuss the important matter regarding our upcoming project collaboration.

Our team has been working diligently to ensure that all requirements are met according to the specifications outlined in our previous discussions. We believe this partnership will bring significant value to both organizations.

Key points to consider:
• Timeline and deliverables alignment
• Resource allocation and responsibilities  
• Communication protocols and checkpoints
• Success metrics and evaluation criteria

I would appreciate the opportunity to schedule a meeting at your earliest convenience to discuss these details further and address any questions you may have.

Thank you for your time and consideration. I look forward to your response.

Best regards,
[Your Name]`;
  }

  private generateMockSocialPost(prompt: string): string {
    if (prompt.includes('twitter') || prompt.includes('280')) {
      return `🚀 Excited to share our latest innovation! Our team has been working on something amazing that will transform how businesses operate. Stay tuned for the big reveal! #Innovation #Business #Technology`;
    }
    
    return `We're thrilled to announce our latest achievement! 🎉

Our dedicated team has been working tirelessly to bring you innovative solutions that make a real difference. This milestone represents months of hard work, creativity, and collaboration.

Thank you to everyone who has supported us on this journey. The best is yet to come!

#TeamWork #Innovation #Success #Grateful`;
  }

  private generateMockBlogOutline(prompt: string): string {
    return `# Blog Post Outline: [Topic Title]

## Introduction
- Hook: Engaging opening statement or question
- Problem statement: What challenge does this address?
- Preview: What readers will learn

## Main Content

### Section 1: Understanding the Fundamentals
- Key concept explanation
- Why it matters
- Common misconceptions

### Section 2: Practical Applications
- Real-world examples
- Case studies
- Best practices

### Section 3: Implementation Strategy
- Step-by-step approach
- Tools and resources needed
- Timeline considerations

### Section 4: Overcoming Challenges
- Common obstacles
- Solutions and workarounds
- Expert tips

## Conclusion
- Key takeaways summary
- Call to action
- Next steps for readers

## Additional Resources
- Recommended reading
- Useful tools
- Related articles`;
  }

  private generateMockNewsletter(prompt: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Monthly Newsletter</title>
</head>
<body>
    <h1>Welcome to Our Monthly Newsletter</h1>
    
    <h2>🌟 Featured Story</h2>
    <p>This month, we're excited to share some incredible developments in our industry. Our team has been working on innovative solutions that are already making a significant impact.</p>
    
    <h2>📈 Industry Insights</h2>
    <ul>
        <li>Market trends and analysis</li>
        <li>Emerging technologies to watch</li>
        <li>Expert predictions for the coming quarter</li>
    </ul>
    
    <h2>🎯 Tips & Best Practices</h2>
    <p>Here are three actionable tips you can implement immediately:</p>
    <ol>
        <li>Optimize your workflow with automation tools</li>
        <li>Focus on customer experience improvements</li>
        <li>Invest in team development and training</li>
    </ol>
    
    <h2>📅 Upcoming Events</h2>
    <p>Don't miss these important dates:</p>
    <ul>
        <li>Webinar: "Future of Business Technology" - Next Tuesday</li>
        <li>Industry Conference - End of month</li>
        <li>Product Launch Event - Coming soon</li>
    </ul>
    
    <h2>💬 Community Spotlight</h2>
    <p>We're featuring success stories from our community members who have achieved remarkable results using our solutions.</p>
    
    <p>Thank you for being part of our community. We appreciate your continued support and engagement.</p>
    
    <p>Best regards,<br>The Team</p>
</body>
</html>`;
  }

  private generateMockGenericContent(prompt: string): string {
    return `This is professionally generated content that addresses your specific requirements. 

Our comprehensive approach ensures that every piece of content is crafted with attention to detail, audience engagement, and clear communication objectives.

Key benefits include:
• Tailored messaging for your target audience
• Professional tone and structure
• Clear call-to-action elements
• SEO-optimized content when applicable

We understand the importance of quality content in today's competitive landscape, and our solutions are designed to help you achieve your communication goals effectively.

For more information or to discuss your specific needs, please don't hesitate to reach out to our team.`;
  }
}