import { Task, Priority, User, Document } from '../../shared/types';

// Main service request/response types
export interface ProjectManagementRequest {
  type: 'task_assignment' | 'reminder' | 'approval_workflow' | 'knowledge_base' | 'progress_tracking';
  data: any;
  requesterId: string;
  timestamp: Date;
}

export interface ProjectManagementResult {
  success: boolean;
  data: any;
  message: string;
  timestamp: Date;
}

// Service response wrapper
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    processingTime: number;
    requestId: string;
    version: string;
  };
}

// Task Assignment Types
export interface TaskAssignmentRequest {
  tasks: Task[];
  criteria: AssignmentCriteria;
  teamMembers?: TeamMember[];
  constraints?: AssignmentConstraint[];
}

export interface TaskAssignmentResult {
  assignments: TaskAssignment[];
  unassignedTasks: Task[];
  assignmentReasons: string[];
  totalTasks: number;
  assignmentRate: number;
  timestamp: Date;
}

export interface AssignmentCriteria {
  prioritizeSkillMatch: boolean;
  prioritizeAvailability: boolean;
  balanceWorkload: boolean;
  minimumScore: number;
  maxWorkloadHours?: number;
}

export interface TaskAssignment {
  taskId: string;
  assigneeId: string;
  assigneeName: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  confidence: number;
  reason: string;
  skillsMatched: SkillMatch[];
  taskPriority?: Priority;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: Skill[];
  availability: Availability;
  currentWorkload?: number;
  efficiency?: number;
  maxCapacity?: number;
}

export interface Skill {
  name: string;
  level: number; // 1-5 scale
  yearsExperience: number;
  certifications?: string[];
}

export interface Availability {
  status: AvailabilityStatus;
  hoursPerWeek: number;
  scheduledTimeOff?: TimeOffPeriod[];
  preferredWorkingHours?: WorkingHours;
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  LIMITED = 'limited',
  UNAVAILABLE = 'unavailable'
}

export interface TimeOffPeriod {
  start: Date;
  end: Date;
  type: 'vacation' | 'sick' | 'personal' | 'training';
}

export interface WorkingHours {
  start: string; // "09:00"
  end: string;   // "17:00"
  timezone: string;
}

export interface SkillMatch {
  skillName: string;
  requiredLevel: number;
  memberLevel: number;
  match: boolean;
}

export interface AssignmentConstraint {
  type: 'skill_required' | 'availability_required' | 'workload_limit' | 'role_required';
  value: any;
  strict: boolean;
}

// Reminder and Notification Types
export interface ReminderRequest {
  type: ReminderType;
  tasks?: Task[];
  milestones?: ProjectMilestone[];
  users?: User[];
  criteria?: ReminderCriteria;
}

export interface ReminderResult {
  notificationsSent: number;
  notifications: any[];
  failedNotifications: any[];
  reminderType: ReminderType;
  processedAt: Date;
  nextScheduledCheck: Date;
}

export enum ReminderType {
  DEADLINE = 'deadline',
  MILESTONE = 'milestone',
  OVERDUE = 'overdue',
  FOLLOW_UP = 'follow_up'
}

export interface ReminderCriteria {
  advanceNoticeHours: number[];
  channels: string[];
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  condition: string;
  action: string;
  delayHours: number;
}

export interface ReminderSchedule {
  itemId: string;
  type: ReminderType;
  lastSent: Date;
  nextScheduled: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface NotificationChannel {
  name: string;
  type: 'email' | 'slack' | 'push' | 'sms';
  isActive: boolean;
  configuration?: any;
}

export interface ReminderRule {
  priority: Priority;
  reminderHours: number[];
  channels: string[];
}

// Approval Workflow Types
export interface ApprovalWorkflowRequest {
  workflowType: WorkflowType;
  document: Document;
  requesterId: string;
  urgency?: Priority;
  customApprovers?: string[];
}

export interface ApprovalWorkflowResult {
  workflowId: string;
  status: ApprovalStatus;
  currentStep: ApprovalStep | null;
  approvers: ApproverInfo[];
  estimatedCompletion: Date;
  nextAction: string;
  createdAt: Date;
  completedAt?: Date;
  escalationLevel?: number;
}

export enum WorkflowType {
  DOCUMENT_APPROVAL = 'document_approval',
  BUDGET_APPROVAL = 'budget_approval',
  CONTRACT_APPROVAL = 'contract_approval',
  POLICY_APPROVAL = 'policy_approval',
  CHANGE_REQUEST = 'change_request'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  CANCELLED = 'cancelled'
}

export interface ApprovalChain {
  id: string;
  workflowType: WorkflowType;
  documentId: string;
  requesterId: string;
  steps: ApprovalStep[];
  currentStepIndex: number;
  status: ApprovalStatus;
  createdAt: Date;
  completedAt?: Date;
  priority: Priority;
  escalationLevel: number;
}

export interface ApprovalStep {
  id: string;
  order: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: ApprovalStatus;
  isRequired: boolean;
  timeoutHours: number;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  comments?: string;
  isEscalation?: boolean;
  escalationReason?: string;
}

export interface ApprovalRule {
  workflowType: WorkflowType;
  approvers: ApproverConfig[];
  conditions?: ApprovalCondition[];
  allowEscalation: boolean;
  maxEscalationLevels?: number;
  defaultTimeoutHours: number;
}

export interface ApproverConfig {
  userId: string;
  name: string;
  role: string;
  isRequired: boolean;
  timeoutHours?: number;
}

export interface ApprovalCondition {
  field: string;
  operator: string;
  value: any;
}

export interface ApprovalDecision {
  approverId: string;
  approved: boolean;
  comments?: string;
  timestamp?: Date;
}

export interface ApproverInfo {
  id: string;
  name: string;
  role: string;
  status: ApprovalStatus;
  order: number;
}

// Knowledge Base Types
export interface KnowledgeBaseRequest {
  updateType: KnowledgeBaseUpdateType;
  sourceData: any;
  targetDocuments?: string[];
  updateRules?: string[];
}

export interface KnowledgeBaseResult {
  documentsUpdated: number;
  documentsCreated: number;
  updatedDocuments: string[];
  errors: string[];
  updateType: KnowledgeBaseUpdateType;
  processedAt: Date;
  nextScheduledUpdate: Date;
}

export enum KnowledgeBaseUpdateType {
  SOP_UPDATE = 'sop_update',
  PROCESS_DOCUMENTATION = 'process_documentation',
  TEMPLATE_UPDATE = 'template_update',
  KNOWLEDGE_ARTICLE = 'knowledge_article',
  AUTOMATED_SYNC = 'automated_sync'
}

export interface SOPDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  version: number;
  createdAt: Date;
  lastUpdated: Date;
  createdBy: string;
  tags: string[];
  isActive: boolean;
}

export interface KnowledgeArticle {
  id: string;
  topic: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  lastUpdated: Date;
  createdBy: string;
  viewCount: number;
  rating: number;
  isPublished: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: Date;
  lastUpdated: Date;
  createdBy: string;
  usageCount: number;
  isActive: boolean;
}

export interface UpdateRule {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  isActive: boolean;
}

export interface ContentAnalysis {
  sopUpdates: any[];
  processChanges: any[];
  templateNeeds: any[];
  knowledgeGaps: any[];
}

// Progress Tracking Types
export interface ProgressTrackingRequest {
  projectId: string;
  tasks?: Task[];
  milestones?: ProjectMilestone[];
  timeframe?: DateRange;
  includeMetrics?: string[];
}

export interface ProgressTrackingResult {
  projectId: string;
  completionPercentage: number;
  progressMetrics: ProgressMetrics;
  milestoneUpdates: MilestoneUpdates;
  progressReport: ProgressReport;
  healthAssessment: ProjectHealth;
  nextSteps: string[];
  recommendations: string[];
  trackedAt: Date;
  nextTrackingDate: Date;
}

export interface ProgressMetrics {
  totalTasks: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksPending: number;
  tasksFailed: number;
  tasksOverdue: number;
  completionRate: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  hoursVariance: number;
  velocity: number;
  qualityScore: number;
  budgetMetrics: BudgetMetrics | null;
  lastCalculated: Date;
}

export interface BudgetMetrics {
  budgetAllocated: number;
  budgetSpent: number;
  utilizationPercentage: number;
  projectedOverrun: number;
  costPerTask: number;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  dueDate: Date;
  status: MilestoneStatus;
  progressPercentage: number;
  associatedTasks?: string[];
  stakeholders: string[];
  createdAt: Date;
  lastUpdated: Date;
}

export enum MilestoneStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export interface MilestoneUpdates {
  completed: ProjectMilestone[];
  upcoming: ProjectMilestone[];
  overdue: ProjectMilestone[];
}

export interface ProgressReport {
  projectId: string;
  reportDate: Date;
  executiveSummary: string;
  keyMetrics: {
    completionRate: number;
    velocity: number;
    qualityScore: number;
    budgetUtilization: number;
  };
  milestoneStatus: {
    completed: number;
    upcoming: number;
    overdue: number;
  };
  trends: any;
  achievements: string[];
  challenges: string[];
  recommendations: string[];
}

export interface ProjectHealth {
  projectId: string;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  healthScore: number;
  riskAssessment: RiskAssessment;
  criticalIssues: string[];
  recommendations: string[];
  assessedAt: Date;
}

export interface RiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: Risk[];
  riskScore: number;
  assessedAt: Date;
}

export interface Risk {
  type: 'schedule' | 'budget' | 'quality' | 'resource' | 'technical';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  mitigation: string;
}

export interface TaskProgress {
  taskId: string;
  progressPercentage: number;
  timeSpent: number;
  estimatedTimeRemaining: number;
  blockers: string[];
  lastUpdated: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Utility Types
export interface ExternalIntegration {
  service: string;
  credentials: any;
  configuration?: any;
}