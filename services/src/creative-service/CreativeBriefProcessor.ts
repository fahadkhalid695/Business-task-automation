import {
  CreativeBrief,
  CreativeConcept,
  ConceptVariation,
  ContentType,
  DesignType,
  CodeType,
  AudienceProfile,
  BrandGuidelines,
  Deliverable,
  CreativeConstraints
} from './types';
import { ContentGenerator } from './ContentGenerator';
import { DesignAssistant } from './DesignAssistant';
import { CodeAutomation } from './CodeAutomation';
import { logger } from '../shared/utils/logger';

export class CreativeBriefProcessor {
  private contentGenerator: ContentGenerator;
  private designAssistant: DesignAssistant;
  private codeAutomation: CodeAutomation;

  constructor(
    contentGenerator: ContentGenerator,
    designAssistant: DesignAssistant,
    codeAutomation: CodeAutomation
  ) {
    this.contentGenerator = contentGenerator;
    this.designAssistant = designAssistant;
    this.codeAutomation = codeAutomation;
  }

  /**
   * Process creative brief and generate multiple concept variations
   * Requirement 6.5: Generate multiple concept variations for review
   */
  async processBrief(brief: CreativeBrief): Promise<CreativeConcept[]> {
    try {
      logger.info('Processing creative brief', { briefId: brief.id, title: brief.title });

      const concepts: CreativeConcept[] = [];

      // Generate concepts for each deliverable
      for (const deliverable of brief.deliverables) {
        const deliverableConcepts = await this.generateConceptsForDeliverable(
          brief,
          deliverable
        );
        concepts.push(...deliverableConcepts);
      }

      // Score and rank concepts
      const scoredConcepts = await this.scoreConcepts(concepts, brief);

      logger.info('Creative brief processing completed', { 
        briefId: brief.id, 
        conceptsGenerated: scoredConcepts.length 
      });

      return scoredConcepts.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Error processing creative brief', error);
      throw error;
    }
  }

  /**
   * Generate concepts for a specific deliverable
   */
  async generateConceptsForDeliverable(
    brief: CreativeBrief,
    deliverable: Deliverable
  ): Promise<CreativeConcept[]> {
    const concepts: CreativeConcept[] = [];
    const variationCount = 3; // Generate 3 variations per deliverable

    for (let i = 0; i < variationCount; i++) {
      try {
        const concept = await this.generateSingleConcept(brief, deliverable, i + 1);
        concepts.push(concept);
      } catch (error) {
        logger.error('Error generating concept variation', { 
          deliverableType: deliverable.type,
          variation: i + 1,
          error 
        });
      }
    }

    return concepts;
  }

  /**
   * Generate a single concept variation
   */
  private async generateSingleConcept(
    brief: CreativeBrief,
    deliverable: Deliverable,
    variationNumber: number
  ): Promise<CreativeConcept> {
    const conceptId = this.generateConceptId(brief.id, deliverable.type, variationNumber);
    
    let content: string | undefined;
    let designMockups: string[] = [];
    const variations: ConceptVariation[] = [];

    // Generate content based on deliverable type
    if (this.isContentType(deliverable.type)) {
      content = await this.generateContentConcept(brief, deliverable, variationNumber);
      
      // Generate content variations
      const contentVariations = await this.generateContentVariations(content, brief, 2);
      variations.push(...contentVariations);
    }

    // Generate design mockups if it's a design deliverable
    if (this.isDesignType(deliverable.type)) {
      const designResult = await this.generateDesignConcept(brief, deliverable, variationNumber);
      designMockups.push(designResult.designUrl);
      
      // Generate design variations
      const designVariations = await this.generateDesignVariations(brief, deliverable, 2);
      variations.push(...designVariations);
    }

    // Generate code if it's a code deliverable
    if (this.isCodeType(deliverable.type)) {
      content = await this.generateCodeConcept(brief, deliverable, variationNumber);
      
      // Generate code variations
      const codeVariations = await this.generateCodeVariations(content, brief, deliverable, 2);
      variations.push(...codeVariations);
    }

    const concept: CreativeConcept = {
      id: conceptId,
      briefId: brief.id,
      title: this.generateConceptTitle(brief, deliverable, variationNumber),
      description: this.generateConceptDescription(brief, deliverable, variationNumber),
      rationale: this.generateConceptRationale(brief, deliverable, variationNumber),
      content,
      designMockups,
      variations,
      score: 0 // Will be calculated later
    };

    return concept;
  }

  /**
   * Generate content concept
   */
  private async generateContentConcept(
    brief: CreativeBrief,
    deliverable: Deliverable,
    variationNumber: number
  ): Promise<string> {
    const contentType = deliverable.type as ContentType;
    
    // Create content generation request based on brief
    const request = {
      type: contentType,
      format: deliverable.format as any,
      parameters: {
        tone: this.selectToneForVariation(variationNumber),
        length: 'medium' as any,
        keywords: this.extractKeywordsFromBrief(brief),
        subject: brief.title
      },
      audience: brief.targetAudience,
      brandGuidelines: brief.brandGuidelines
    };

    const result = await this.contentGenerator.generateContent(request);
    return result.content;
  }

  /**
   * Generate design concept
   */
  private async generateDesignConcept(
    brief: CreativeBrief,
    deliverable: Deliverable,
    variationNumber: number
  ) {
    const designType = deliverable.type as DesignType;
    
    const request = {
      type: designType,
      specifications: deliverable.specifications,
      content: brief.description,
      brandGuidelines: brief.brandGuidelines
    };

    return await this.designAssistant.createDesign(request);
  }

  /**
   * Generate code concept
   */
  private async generateCodeConcept(
    brief: CreativeBrief,
    deliverable: Deliverable,
    variationNumber: number
  ): Promise<string> {
    const codeType = deliverable.type as CodeType;
    
    const request = {
      type: codeType,
      language: deliverable.specifications.language || 'javascript',
      requirements: `${brief.description}. ${brief.objectives.join('. ')}`,
      context: {
        framework: deliverable.specifications.framework,
        libraries: deliverable.specifications.libraries || [],
        patterns: ['clean-code', 'best-practices'],
        constraints: brief.constraints.restrictions
      }
    };

    const result = await this.codeAutomation.generateCode(request);
    return result.code;
  }

  /**
   * Generate content variations
   */
  private async generateContentVariations(
    baseContent: string,
    brief: CreativeBrief,
    count: number
  ): Promise<ConceptVariation[]> {
    const variations: ConceptVariation[] = [];

    for (let i = 0; i < count; i++) {
      const variation: ConceptVariation = {
        id: this.generateVariationId(),
        title: `Content Variation ${i + 1}`,
        description: `Alternative approach focusing on ${this.getVariationFocus(i)}`,
        content: await this.generateContentVariation(baseContent, brief, i),
        differentiators: this.getContentDifferentiators(i)
      };
      variations.push(variation);
    }

    return variations;
  }

  /**
   * Generate design variations
   */
  private async generateDesignVariations(
    brief: CreativeBrief,
    deliverable: Deliverable,
    count: number
  ): Promise<ConceptVariation[]> {
    const variations: ConceptVariation[] = [];

    for (let i = 0; i < count; i++) {
      // Modify specifications for variation
      const variantSpecs = this.createDesignVariantSpecs(deliverable.specifications, i);
      
      const designResult = await this.designAssistant.createDesign({
        type: deliverable.type as DesignType,
        specifications: variantSpecs,
        content: brief.description,
        brandGuidelines: brief.brandGuidelines
      });

      const variation: ConceptVariation = {
        id: this.generateVariationId(),
        title: `Design Variation ${i + 1}`,
        description: `Alternative design approach with ${this.getDesignVariationFocus(i)}`,
        designUrl: designResult.designUrl,
        differentiators: this.getDesignDifferentiators(i)
      };
      variations.push(variation);
    }

    return variations;
  }

  /**
   * Generate code variations
   */
  private async generateCodeVariations(
    baseCode: string,
    brief: CreativeBrief,
    deliverable: Deliverable,
    count: number
  ): Promise<ConceptVariation[]> {
    const variations: ConceptVariation[] = [];

    for (let i = 0; i < count; i++) {
      const variantRequest = {
        type: deliverable.type as CodeType,
        language: deliverable.specifications.language || 'javascript',
        requirements: `${brief.description}. Focus on ${this.getCodeVariationFocus(i)}`,
        context: {
          framework: deliverable.specifications.framework,
          libraries: deliverable.specifications.libraries || [],
          patterns: this.getCodeVariationPatterns(i),
          constraints: brief.constraints.restrictions,
          existingCode: baseCode
        }
      };

      const result = await this.codeAutomation.generateCode(variantRequest);

      const variation: ConceptVariation = {
        id: this.generateVariationId(),
        title: `Code Variation ${i + 1}`,
        description: `Alternative implementation focusing on ${this.getCodeVariationFocus(i)}`,
        content: result.code,
        differentiators: this.getCodeDifferentiators(i)
      };
      variations.push(variation);
    }

    return variations;
  }

  /**
   * Score concepts based on brief requirements
   */
  private async scoreConcepts(concepts: CreativeConcept[], brief: CreativeBrief): Promise<CreativeConcept[]> {
    return concepts.map(concept => {
      let score = 0;

      // Score based on alignment with objectives (40%)
      score += this.scoreObjectiveAlignment(concept, brief) * 0.4;

      // Score based on target audience fit (30%)
      score += this.scoreAudienceFit(concept, brief) * 0.3;

      // Score based on brand guidelines adherence (20%)
      score += this.scoreBrandAdherence(concept, brief) * 0.2;

      // Score based on creativity and uniqueness (10%)
      score += this.scoreCreativity(concept) * 0.1;

      concept.score = Math.round(score * 100) / 100;
      return concept;
    });
  }

  // Helper methods for type checking
  private isContentType(type: string): type is ContentType {
    return Object.values(ContentType).includes(type as ContentType);
  }

  private isDesignType(type: string): type is DesignType {
    return Object.values(DesignType).includes(type as DesignType);
  }

  private isCodeType(type: string): type is CodeType {
    return Object.values(CodeType).includes(type as CodeType);
  }

  // Helper methods for concept generation
  private selectToneForVariation(variationNumber: number): string {
    const tones = ['professional', 'friendly', 'persuasive', 'informative'];
    return tones[(variationNumber - 1) % tones.length];
  }

  private extractKeywordsFromBrief(brief: CreativeBrief): string[] {
    const keywords: string[] = [];
    
    // Extract from objectives
    brief.objectives.forEach(objective => {
      const words = objective.split(' ').filter(word => word.length > 3);
      keywords.push(...words);
    });

    // Extract from description
    const descWords = brief.description.split(' ').filter(word => word.length > 3);
    keywords.push(...descWords.slice(0, 5));

    return [...new Set(keywords)].slice(0, 10);
  }

  private generateConceptTitle(brief: CreativeBrief, deliverable: Deliverable, variationNumber: number): string {
    return `${brief.title} - ${deliverable.type} Concept ${variationNumber}`;
  }

  private generateConceptDescription(brief: CreativeBrief, deliverable: Deliverable, variationNumber: number): string {
    return `Creative concept for ${deliverable.type} deliverable, variation ${variationNumber}. ${brief.description}`;
  }

  private generateConceptRationale(brief: CreativeBrief, deliverable: Deliverable, variationNumber: number): string {
    const rationales = [
      'Focuses on emotional connection with the target audience',
      'Emphasizes practical benefits and clear value proposition',
      'Takes a bold, attention-grabbing approach to stand out'
    ];
    
    return rationales[(variationNumber - 1) % rationales.length];
  }

  private async generateContentVariation(baseContent: string, brief: CreativeBrief, variationIndex: number): Promise<string> {
    // Mock content variation - in real implementation, this would use AI to create variations
    const variations = [
      baseContent.replace(/\./g, '!'), // More enthusiastic
      baseContent.toLowerCase(), // More casual
      baseContent.replace(/\b\w/g, l => l.toUpperCase()) // Title case
    ];
    
    return variations[variationIndex % variations.length];
  }

  private getVariationFocus(index: number): string {
    const focuses = ['emotional appeal', 'logical benefits', 'social proof'];
    return focuses[index % focuses.length];
  }

  private getContentDifferentiators(index: number): string[] {
    const differentiators = [
      ['Emotional tone', 'Personal connection', 'Storytelling approach'],
      ['Data-driven', 'Logical structure', 'Clear benefits'],
      ['Social validation', 'Testimonials', 'Community focus']
    ];
    
    return differentiators[index % differentiators.length];
  }

  private createDesignVariantSpecs(baseSpecs: any, variationIndex: number): any {
    // Create design variations by modifying specifications
    const variants = [
      { ...baseSpecs, colorScheme: 'vibrant' },
      { ...baseSpecs, colorScheme: 'minimal' },
      { ...baseSpecs, colorScheme: 'classic' }
    ];
    
    return variants[variationIndex % variants.length];
  }

  private getDesignVariationFocus(index: number): string {
    const focuses = ['bold colors and modern typography', 'clean minimalist design', 'classic professional layout'];
    return focuses[index % focuses.length];
  }

  private getDesignDifferentiators(index: number): string[] {
    const differentiators = [
      ['Bold colors', 'Modern typography', 'Dynamic layout'],
      ['Minimal design', 'Clean lines', 'Whitespace usage'],
      ['Professional look', 'Traditional layout', 'Conservative colors']
    ];
    
    return differentiators[index % differentiators.length];
  }

  private getCodeVariationFocus(index: number): string {
    const focuses = ['performance optimization', 'maintainability and readability', 'security and robustness'];
    return focuses[index % focuses.length];
  }

  private getCodeVariationPatterns(index: number): string[] {
    const patterns = [
      ['performance', 'optimization', 'caching'],
      ['clean-code', 'maintainable', 'readable'],
      ['secure', 'robust', 'error-handling']
    ];
    
    return patterns[index % patterns.length];
  }

  private getCodeDifferentiators(index: number): string[] {
    const differentiators = [
      ['Optimized performance', 'Efficient algorithms', 'Minimal resource usage'],
      ['Clean architecture', 'Well-documented', 'Easy to maintain'],
      ['Security-focused', 'Robust error handling', 'Input validation']
    ];
    
    return differentiators[index % differentiators.length];
  }

  // Scoring methods
  private scoreObjectiveAlignment(concept: CreativeConcept, brief: CreativeBrief): number {
    // Mock scoring - in real implementation, this would use NLP to analyze alignment
    const objectiveKeywords = brief.objectives.join(' ').toLowerCase().split(' ');
    const conceptText = (concept.content || concept.description).toLowerCase();
    
    const matchCount = objectiveKeywords.filter(keyword => 
      keyword.length > 3 && conceptText.includes(keyword)
    ).length;
    
    return Math.min(1, matchCount / Math.max(1, objectiveKeywords.length));
  }

  private scoreAudienceFit(concept: CreativeConcept, brief: CreativeBrief): number {
    // Mock scoring based on audience profile
    if (!brief.targetAudience) return 0.5;
    
    const audienceInterests = brief.targetAudience.psychographics.interests;
    const conceptText = (concept.content || concept.description).toLowerCase();
    
    const interestMatches = audienceInterests.filter(interest => 
      conceptText.includes(interest.toLowerCase())
    ).length;
    
    return Math.min(1, interestMatches / Math.max(1, audienceInterests.length));
  }

  private scoreBrandAdherence(concept: CreativeConcept, brief: CreativeBrief): number {
    // Mock scoring based on brand guidelines
    if (!brief.brandGuidelines) return 0.5;
    
    const brandPersonality = brief.brandGuidelines.voice?.personality || [];
    const conceptText = (concept.content || concept.description).toLowerCase();
    
    const personalityMatches = brandPersonality.filter(trait => 
      conceptText.includes(trait.toLowerCase())
    ).length;
    
    return Math.min(1, personalityMatches / Math.max(1, brandPersonality.length));
  }

  private scoreCreativity(concept: CreativeConcept): number {
    // Mock creativity scoring based on variation count and uniqueness
    const variationCount = concept.variations.length;
    const hasUniqueElements = concept.variations.some(v => v.differentiators.length > 2);
    
    let score = 0.3; // Base creativity score
    score += (variationCount * 0.1); // More variations = more creative
    score += hasUniqueElements ? 0.3 : 0; // Unique elements boost creativity
    
    return Math.min(1, score);
  }

  // ID generation methods
  private generateConceptId(briefId: string, deliverableType: string, variationNumber: number): string {
    return `concept_${briefId}_${deliverableType}_${variationNumber}_${Date.now()}`;
  }

  private generateVariationId(): string {
    return `variation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}