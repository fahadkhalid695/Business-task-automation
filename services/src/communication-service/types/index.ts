// Communication Service Types
export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    entities?: Entity[];
  };
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  messages: ChatMessage[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
}

export enum ConversationStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  ARCHIVED = 'archived'
}

export interface ConversationContext {
  department?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  customerInfo?: CustomerInfo;
  previousInteractions?: string[];
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tier: 'basic' | 'premium' | 'enterprise';
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Intent {
  name: string;
  confidence: number;
  parameters: { [key: string]: any };
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  confidence: number;
  usage_count: number;
  last_updated: Date;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  confidence: number;
  language: string;
  speakers?: SpeakerSegment[];
  duration: number;
  timestamps: WordTimestamp[];
  metadata: TranscriptionMetadata;
}

export interface SpeakerSegment {
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

export interface WordTimestamp {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionMetadata {
  audioFormat: string;
  sampleRate: number;
  channels: number;
  processingTime: number;
  model: string;
}

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  context?: TranslationContext;
  alternatives?: string[];
  metadata: TranslationMetadata;
}

export interface TranslationContext {
  domain?: string;
  formality?: 'formal' | 'informal';
  audience?: string;
  previousTranslations?: string[];
}

export interface TranslationMetadata {
  model: string;
  processingTime: number;
  characterCount: number;
  detectedLanguage?: string;
}

export interface NotificationChannel {
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  isActive: boolean;
}

export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  PUSH = 'push'
}

export interface NotificationChannelConfig {
  [key: string]: any;
}

export interface NotificationMessage {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: NotificationChannelType[];
  recipients: NotificationRecipient[];
  scheduledAt?: Date;
  sentAt?: Date;
  status: NotificationStatus;
  metadata?: { [key: string]: any };
}

export interface NotificationRecipient {
  type: 'user' | 'group' | 'role';
  identifier: string;
  preferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  channels: NotificationChannelType[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  frequency: 'immediate' | 'batched' | 'daily_digest';
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface NLPAnalysisResult {
  sentiment: SentimentAnalysis;
  entities: Entity[];
  keywords: Keyword[];
  topics: Topic[];
  language: string;
  readabilityScore: number;
  summary?: string;
}

export interface SentimentAnalysis {
  score: number; // -1 to 1
  confidence: number;
  label: 'positive' | 'negative' | 'neutral';
  emotions?: EmotionScore[];
}

export interface EmotionScore {
  emotion: string;
  score: number;
  confidence: number;
}

export interface Keyword {
  text: string;
  relevance: number;
  count: number;
}

export interface Topic {
  name: string;
  confidence: number;
  keywords: string[];
}

export interface CommunicationServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  googleCloud: {
    projectId: string;
    keyFilename: string;
  };
  notifications: {
    email: {
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    slack: {
      botToken: string;
      signingSecret: string;
    };
    sms: {
      provider: string;
      apiKey: string;
      from: string;
    };
  };
}