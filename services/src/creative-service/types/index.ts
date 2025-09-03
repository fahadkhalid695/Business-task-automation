export interface CreativeServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  designTools: {
    canvaApiKey?: string;
    figmaToken?: string;
  };
  compliance: {
    regulatoryRules: ComplianceRule[];
    policyDatabase: string;
  };
}

export interface ContentGenerationRequest {
  type: ContentType;
  format: ContentFormat;
  parameters: ContentParameters;
  audience?: AudienceProfile;
  brandGuidelines?: BrandGuidelines;
}

export interface ContentGenerationResult {
  content: string;
  metadata: ContentMetadata;
  variations?: string[];
  suggestions?: string[];
  complianceCheck?: ComplianceResult;
}

export interface DesignRequest {
  type: DesignType;
  specifications: DesignSpecifications;
  content?: string;
  brandGuidelines?: BrandGuidelines;
}

export interface DesignResult {
  designUrl: string;
  thumbnailUrl: string;
  metadata: DesignMetadata;
  assets: DesignAsset[];
  editableUrl?: string;
}

export interface CodeGenerationRequest {
  type: CodeType;
  language: ProgrammingLanguage;
  requirements: string;
  context?: CodeContext;
  style?: CodingStyle;
}

export interface CodeGenerationResult {
  code: string;
  documentation: string;
  tests?: string;
  dependencies: string[];
  metadata: CodeMetadata;
}

export interface ComplianceCheckRequest {
  content: string;
  type: ContentType;
  regulations: string[];
  industry?: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  suggestions: string[];
  confidence: number;
}

export interface CreativeBrief {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  targetAudience: AudienceProfile;
  brandGuidelines?: BrandGuidelines;
  deliverables: Deliverable[];
  constraints: CreativeConstraints;
  deadline?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface CreativeConcept {
  id: string;
  briefId: string;
  title: string;
  description: string;
  rationale: string;
  content?: string;
  designMockups?: string[];
  variations: ConceptVariation[];
  score: number;
  feedback?: string[];
}

// Enums
export enum ContentType {
  EMAIL = 'email',
  NEWSLETTER = 'newsletter',
  SOCIAL_POST = 'social_post',
  BLOG_OUTLINE = 'blog_outline',
  BLOG_POST = 'blog_post',
  PRESS_RELEASE = 'press_release',
  PRODUCT_DESCRIPTION = 'product_description',
  AD_COPY = 'ad_copy',
  SCRIPT = 'script',
  MEMO = 'memo'
}

export enum ContentFormat {
  PLAIN_TEXT = 'plain_text',
  HTML = 'html',
  MARKDOWN = 'markdown',
  JSON = 'json',
  XML = 'xml'
}

export enum DesignType {
  SLIDE_DECK = 'slide_deck',
  PRESENTATION = 'presentation',
  INFOGRAPHIC = 'infographic',
  SOCIAL_MEDIA_POST = 'social_media_post',
  BANNER = 'banner',
  LOGO = 'logo',
  TEMPLATE = 'template',
  DIAGRAM = 'diagram',
  CHART = 'chart'
}

export enum CodeType {
  SCRIPT = 'script',
  FUNCTION = 'function',
  CLASS = 'class',
  MODULE = 'module',
  API = 'api',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
  CONFIG = 'config'
}

export enum ProgrammingLanguage {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  GO = 'go',
  RUST = 'rust',
  PHP = 'php',
  RUBY = 'ruby',
  SQL = 'sql',
  BASH = 'bash',
  POWERSHELL = 'powershell'
}

// Supporting Interfaces
export interface ContentParameters {
  tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'persuasive' | 'informative';
  length: 'short' | 'medium' | 'long' | 'custom';
  customLength?: number;
  keywords?: string[];
  callToAction?: string;
  subject?: string;
  platform?: string;
  style?: string;
}

export interface AudienceProfile {
  demographics: {
    ageRange?: string;
    gender?: string;
    location?: string;
    income?: string;
    education?: string;
  };
  psychographics: {
    interests: string[];
    values: string[];
    lifestyle: string[];
  };
  behavior: {
    preferredChannels: string[];
    engagementPatterns: string[];
    painPoints: string[];
  };
}

export interface BrandGuidelines {
  colors: {
    primary: string;
    secondary: string[];
    accent?: string[];
  };
  fonts: {
    primary: string;
    secondary?: string;
    headings?: string;
  };
  voice: {
    tone: string;
    personality: string[];
    doNots: string[];
  };
  logo: {
    url: string;
    variations?: string[];
    usage: string[];
  };
  imagery: {
    style: string;
    filters?: string[];
    restrictions?: string[];
  };
}

export interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  sentiment: {
    score: number;
    label: string;
  };
  keywords: string[];
  topics: string[];
  language: string;
  generatedAt: Date;
}

export interface DesignSpecifications {
  dimensions: {
    width: number;
    height: number;
    unit: 'px' | 'in' | 'cm' | 'mm';
  };
  format: 'png' | 'jpg' | 'svg' | 'pdf' | 'pptx';
  resolution?: number;
  colorMode?: 'rgb' | 'cmyk';
  template?: string;
  elements?: DesignElement[];
}

export interface DesignElement {
  type: 'text' | 'image' | 'shape' | 'icon';
  content?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: any;
}

export interface DesignMetadata {
  dimensions: { width: number; height: number };
  format: string;
  fileSize: number;
  colors: string[];
  fonts: string[];
  createdAt: Date;
}

export interface DesignAsset {
  type: 'image' | 'font' | 'icon' | 'template';
  url: string;
  name: string;
  license?: string;
}

export interface CodeContext {
  framework?: string;
  libraries: string[];
  patterns: string[];
  constraints: string[];
  existingCode?: string;
}

export interface CodingStyle {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  naming: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case';
  comments: 'minimal' | 'detailed' | 'jsdoc';
  errorHandling: 'try-catch' | 'promises' | 'async-await';
}

export interface CodeMetadata {
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  testCoverage?: number;
  documentation: boolean;
  generatedAt: Date;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  regulation: string;
  industry: string[];
  patterns: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceViolation {
  rule: ComplianceRule;
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export interface Deliverable {
  type: ContentType | DesignType | CodeType;
  format: string;
  specifications: any;
  deadline?: Date;
}

export interface CreativeConstraints {
  budget?: number;
  timeline: Date;
  resources: string[];
  restrictions: string[];
  requirements: string[];
}

export interface ConceptVariation {
  id: string;
  title: string;
  description: string;
  content?: string;
  designUrl?: string;
  differentiators: string[];
}