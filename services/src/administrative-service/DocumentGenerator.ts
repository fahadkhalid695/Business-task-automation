import {
  DocumentGenerationRequest,
  DocumentGenerationResult,
  DocumentType,
  DocumentData,
  DocumentOptions,
  GeneratedDocumentMetadata
} from './types/AdministrativeTypes';
import { Document } from '../shared/types';
import { logger } from '../shared/utils/logger';
import { DocumentModel } from '../shared/models/Document';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';

/**
 * DocumentGenerator - Creates various document types from templates
 */
export class DocumentGenerator {
  private inferenceEngine: InferenceEngine;
  private templates: Map<string, DocumentTemplate>;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.templates = new Map();
    this.initializeTemplates();
    
    logger.info('DocumentGenerator initialized');
  }

  /**
   * Generate document from template and data
   */
  async generateDocument(request: DocumentGenerationRequest): Promise<DocumentGenerationResult> {
    const startTime = Date.now();
    const { type, template, data, options = {} } = request;

    logger.info(`Generating document: ${type}`, { title: data.title });

    try {
      // Get or create template
      const documentTemplate = template 
        ? await this.parseCustomTemplate(template)
        : this.getDefaultTemplate(type);

      if (!documentTemplate) {
        throw new Error(`No template found for document type: ${type}`);
      }

      // Generate content using AI if needed
      const content = await this.generateContent(type, data, documentTemplate);

      // Apply template and variables
      const processedContent = this.processTemplate(content, data.variables || {});

      // Create document object
      const document: Partial<Document> = {
        type: type as any,
        title: data.title,
        content: processedContent,
        metadata: {
          ...data.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: data.metadata?.version || '1.0.0'
        },
        tags: data.metadata?.tags || [],
        createdBy: data.metadata?.author || 'system'
      };

      // Save document
      const savedDocument = await this.saveDocument(document);

      // Generate URLs (simplified for demo)
      const downloadUrl = `/api/documents/${savedDocument.id}/download`;
      const previewUrl = `/api/documents/${savedDocument.id}/preview`;

      const generationTime = Date.now() - startTime;
      const wordCount = this.countWords(processedContent);
      const pageCount = Math.ceil(wordCount / 250); // Estimate 250 words per page

      logger.info(`Document generated successfully in ${generationTime}ms`, {
        documentId: savedDocument.id,
        wordCount,
        pageCount
      });

      return {
        document: savedDocument,
        downloadUrl,
        previewUrl,
        metadata: {
          wordCount,
          pageCount,
          generationTime,
          templateUsed: documentTemplate.name,
          quality: 'draft'
        }
      };

    } catch (error) {
      const generationTime = Date.now() - startTime;
      logger.error('Document generation failed:', { error: error.message, generationTime });
      throw error;
    }
  }

  /**
   * Generate content using AI based on document type and data
   */
  private async generateContent(type: DocumentType, data: DocumentData, template: DocumentTemplate): Promise<string> {
    if (data.content) {
      return typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    }

    const prompt = this.buildContentPrompt(type, data, template);
    
    try {
      const result = await this.inferenceEngine.generateText({
        prompt,
        maxTokens: this.getMaxTokensForType(type),
        temperature: 0.3
      });

      return result.text.trim();
    } catch (error) {
      logger.error('AI content generation failed, using template fallback:', error);
      return template.fallbackContent || `# ${data.title}\n\n[Content to be added]`;
    }
  }

  /**
   * Build AI prompt for content generation
   */
  private buildContentPrompt(type: DocumentType, data: DocumentData, template: DocumentTemplate): string {
    const basePrompt = `Generate professional ${type.replace('_', ' ')} content with the following details:

Title: ${data.title}
${data.metadata?.author ? `Author: ${data.metadata.author}` : ''}
${data.metadata?.department ? `Department: ${data.metadata.department}` : ''}

`;

    switch (type) {
      case DocumentType.REPORT:
        return basePrompt + `Create a comprehensive business report with:
- Executive summary
- Key findings
- Data analysis
- Recommendations
- Conclusion

Variables available: ${JSON.stringify(data.variables || {})}`;

      case DocumentType.CONTRACT:
        return basePrompt + `Create a professional contract with:
- Parties involved
- Terms and conditions
- Deliverables
- Payment terms
- Legal clauses

Variables available: ${JSON.stringify(data.variables || {})}`;

      case DocumentType.PROPOSAL:
        return basePrompt + `Create a business proposal with:
- Problem statement
- Proposed solution
- Benefits
- Timeline
- Pricing
- Next steps

Variables available: ${JSON.stringify(data.variables || {})}`;

      case DocumentType.MEETING_NOTES:
        return basePrompt + `Create structured meeting notes with:
- Meeting details (date, time, attendees)
- Agenda items discussed
- Key decisions made
- Action items
- Next meeting date

Variables available: ${JSON.stringify(data.variables || {})}`;

      case DocumentType.EMAIL_TEMPLATE:
        return basePrompt + `Create a professional email template with:
- Appropriate subject line
- Professional greeting
- Clear body content
- Call to action
- Professional closing

Variables available: ${JSON.stringify(data.variables || {})}`;

      case DocumentType.MEMO:
        return basePrompt + `Create a business memo with:
- Header (To, From, Date, Subject)
- Purpose statement
- Background information
- Key points
- Action required

Variables available: ${JSON.stringify(data.variables || {})}`;

      default:
        return basePrompt + `Create professional ${type} content that is well-structured and appropriate for business use.

Variables available: ${JSON.stringify(data.variables || {})}`;
    }
  }

  /**
   * Process template with variable substitution
   */
  private processTemplate(content: string, variables: { [key: string]: any }): string {
    let processedContent = content;

    // Replace variables in format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    });

    // Add current date if {{date}} is used
    processedContent = processedContent.replace(/{{date}}/g, new Date().toLocaleDateString());
    processedContent = processedContent.replace(/{{datetime}}/g, new Date().toLocaleString());

    return processedContent;
  }

  /**
   * Get default template for document type
   */
  private getDefaultTemplate(type: DocumentType): DocumentTemplate | null {
    return this.templates.get(type) || null;
  }

  /**
   * Parse custom template string
   */
  private async parseCustomTemplate(template: string): Promise<DocumentTemplate> {
    return {
      name: 'custom',
      content: template,
      variables: this.extractVariables(template),
      fallbackContent: template
    };
  }

  /**
   * Extract variables from template content
   */
  private extractVariables(content: string): string[] {
    const variableRegex = /{{(\s*\w+\s*)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Get maximum tokens for document type
   */
  private getMaxTokensForType(type: DocumentType): number {
    switch (type) {
      case DocumentType.REPORT:
        return 2000;
      case DocumentType.CONTRACT:
      case DocumentType.PROPOSAL:
        return 1500;
      case DocumentType.MEETING_NOTES:
      case DocumentType.MEMO:
        return 800;
      case DocumentType.EMAIL_TEMPLATE:
        return 400;
      default:
        return 1000;
    }
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content.trim().split(/\s+/).length;
  }

  /**
   * Save document to database
   */
  private async saveDocument(documentData: Partial<Document>): Promise<Document> {
    const document = new DocumentModel(documentData);
    return await document.save();
  }

  /**
   * Initialize default templates
   */
  private initializeTemplates(): void {
    // Report template
    this.templates.set(DocumentType.REPORT, {
      name: 'Business Report',
      content: `# {{title}}

**Prepared by:** {{author}}
**Date:** {{date}}
**Department:** {{department}}

## Executive Summary

{{executiveSummary}}

## Key Findings

{{keyFindings}}

## Analysis

{{analysis}}

## Recommendations

{{recommendations}}

## Conclusion

{{conclusion}}`,
      variables: ['title', 'author', 'date', 'department', 'executiveSummary', 'keyFindings', 'analysis', 'recommendations', 'conclusion'],
      fallbackContent: '# Business Report\n\n[Report content to be added]'
    });

    // Meeting Notes template
    this.templates.set(DocumentType.MEETING_NOTES, {
      name: 'Meeting Notes',
      content: `# {{title}}

**Date:** {{date}}
**Time:** {{time}}
**Location:** {{location}}
**Attendees:** {{attendees}}

## Agenda

{{agenda}}

## Discussion Points

{{discussionPoints}}

## Decisions Made

{{decisions}}

## Action Items

{{actionItems}}

## Next Meeting

{{nextMeeting}}`,
      variables: ['title', 'date', 'time', 'location', 'attendees', 'agenda', 'discussionPoints', 'decisions', 'actionItems', 'nextMeeting'],
      fallbackContent: '# Meeting Notes\n\n[Meeting notes to be added]'
    });

    // Email Template
    this.templates.set(DocumentType.EMAIL_TEMPLATE, {
      name: 'Professional Email',
      content: `Subject: {{subject}}

Dear {{recipient}},

{{greeting}}

{{body}}

{{closing}}

Best regards,
{{sender}}
{{title}}
{{company}}`,
      variables: ['subject', 'recipient', 'greeting', 'body', 'closing', 'sender', 'title', 'company'],
      fallbackContent: 'Professional email template'
    });

    // Memo template
    this.templates.set(DocumentType.MEMO, {
      name: 'Business Memo',
      content: `MEMORANDUM

TO: {{to}}
FROM: {{from}}
DATE: {{date}}
SUBJECT: {{subject}}

## Purpose

{{purpose}}

## Background

{{background}}

## Key Points

{{keyPoints}}

## Action Required

{{actionRequired}}

## Deadline

{{deadline}}`,
      variables: ['to', 'from', 'date', 'subject', 'purpose', 'background', 'keyPoints', 'actionRequired', 'deadline'],
      fallbackContent: '# Business Memo\n\n[Memo content to be added]'
    });

    logger.info(`Initialized ${this.templates.size} document templates`);
  }

  /**
   * Get health status of document generator
   */
  async getHealthStatus(): Promise<any> {
    const templateCount = this.templates.size;
    
    return {
      status: 'healthy',
      templates: templateCount,
      supportedFormats: ['pdf', 'docx', 'html', 'markdown'],
      lastGenerated: new Date().toISOString()
    };
  }
}

/**
 * Document template interface
 */
interface DocumentTemplate {
  name: string;
  content: string;
  variables: string[];
  fallbackContent: string;
}