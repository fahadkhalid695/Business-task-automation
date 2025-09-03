import { Priority, TaskStatus } from '../../shared/types';

// Core Finance/HR Interfaces
export interface ExpenseProcessingRequest {
  receipts: ReceiptData[];
  employeeId: string;
  submissionDate: Date;
  expensePolicy?: ExpensePolicy;
}

export interface ExpenseProcessingResult {
  processedExpenses: ProcessedExpense[];
  totalAmount: number;
  approvalRequired: boolean;
  policyViolations: PolicyViolation[];
  status: ExpenseStatus;
  approvalWorkflow?: ApprovalStep[];
}

export interface ReceiptData {
  id: string;
  imageUrl: string;
  imageData?: Buffer;
  filename: string;
  uploadedAt: Date;
  metadata?: ReceiptMetadata;
}

export interface ReceiptMetadata {
  vendor?: string;
  amount?: number;
  date?: Date;
  category?: ExpenseCategory;
  currency?: string;
  taxAmount?: number;
  confidence?: number;
}

export interface ProcessedExpense {
  id: string;
  receiptId: string;
  vendor: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  currency: string;
  taxAmount: number;
  description: string;
  isReimbursable: boolean;
  confidence: number;
  extractedData: ExtractedReceiptData;
}

export interface ExtractedReceiptData {
  vendor: string;
  amount: number;
  date: Date;
  items: LineItem[];
  taxAmount: number;
  currency: string;
  paymentMethod?: string;
  confidence: number;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export enum ExpenseCategory {
  TRAVEL = 'travel',
  MEALS = 'meals',
  OFFICE_SUPPLIES = 'office_supplies',
  SOFTWARE = 'software',
  TRAINING = 'training',
  MARKETING = 'marketing',
  UTILITIES = 'utilities',
  EQUIPMENT = 'equipment',
  OTHER = 'other'
}

export enum ExpenseStatus {
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REIMBURSED = 'reimbursed',
  REQUIRES_CLARIFICATION = 'requires_clarification'
}

export interface ExpensePolicy {
  id: string;
  name: string;
  rules: PolicyRule[];
  approvalLimits: ApprovalLimit[];
  isActive: boolean;
}

export interface PolicyRule {
  category: ExpenseCategory;
  maxAmount: number;
  requiresReceipt: boolean;
  requiresApproval: boolean;
  description: string;
}

export interface ApprovalLimit {
  role: string;
  maxAmount: number;
  categories: ExpenseCategory[];
}

export interface PolicyViolation {
  ruleId: string;
  description: string;
  severity: 'warning' | 'error';
  suggestedAction: string;
  expenseId: string;
}

export interface ApprovalStep {
  approverRole: string;
  approverEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  timestamp?: Date;
}

// Payroll Interfaces
export interface PayrollVerificationRequest {
  employeeId: string;
  payPeriod: PayPeriod;
  timeEntries: TimeEntry[];
  salaryInfo: SalaryInfo;
}

export interface PayrollVerificationResult {
  employeeId: string;
  payPeriod: PayPeriod;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  deductions: Deduction[];
  netPay: number;
  discrepancies: PayrollDiscrepancy[];
  payslip: PayslipData;
}

export interface PayPeriod {
  startDate: Date;
  endDate: Date;
  payDate: Date;
  period: string;
}

export interface TimeEntry {
  date: Date;
  clockIn: Date;
  clockOut: Date;
  breakDuration: number;
  totalHours: number;
  projectCode?: string;
  description?: string;
  approved: boolean;
}

export interface SalaryInfo {
  employeeId: string;
  baseSalary: number;
  hourlyRate?: number;
  overtimeRate?: number;
  currency: string;
  payFrequency: 'weekly' | 'biweekly' | 'monthly';
  benefits: Benefit[];
}

export interface Benefit {
  type: BenefitType;
  amount: number;
  isDeduction: boolean;
  isPreTax: boolean;
}

export enum BenefitType {
  HEALTH_INSURANCE = 'health_insurance',
  DENTAL_INSURANCE = 'dental_insurance',
  RETIREMENT_401K = 'retirement_401k',
  LIFE_INSURANCE = 'life_insurance',
  PARKING = 'parking',
  MEAL_ALLOWANCE = 'meal_allowance'
}

export interface Deduction {
  type: DeductionType;
  amount: number;
  isPreTax: boolean;
  description: string;
}

export enum DeductionType {
  FEDERAL_TAX = 'federal_tax',
  STATE_TAX = 'state_tax',
  SOCIAL_SECURITY = 'social_security',
  MEDICARE = 'medicare',
  HEALTH_INSURANCE = 'health_insurance',
  RETIREMENT = 'retirement',
  OTHER = 'other'
}

export interface PayrollDiscrepancy {
  type: 'hours' | 'rate' | 'deduction' | 'benefit';
  description: string;
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
}

export interface PayslipData {
  employeeInfo: EmployeePayInfo;
  payPeriod: PayPeriod;
  earnings: EarningsBreakdown;
  deductions: Deduction[];
  netPay: number;
  yearToDate: YearToDateSummary;
}

export interface EmployeePayInfo {
  employeeId: string;
  name: string;
  department: string;
  position: string;
}

export interface EarningsBreakdown {
  regularPay: number;
  overtimePay: number;
  bonuses: number;
  commissions: number;
  totalGross: number;
}

export interface YearToDateSummary {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  taxesPaid: number;
}

// Resume Screening Interfaces
export interface ResumeScreeningRequest {
  resumes: ResumeData[];
  jobRequirements: JobRequirements;
  screeningCriteria: ScreeningCriteria;
}

export interface ResumeScreeningResult {
  screenedCandidates: ScreenedCandidate[];
  rankings: CandidateRanking[];
  summary: ScreeningSummary;
}

export interface ResumeData {
  id: string;
  candidateName: string;
  email: string;
  phone?: string;
  resumeUrl: string;
  resumeText?: string;
  uploadedAt: Date;
}

export interface JobRequirements {
  jobTitle: string;
  department: string;
  requiredSkills: Skill[];
  preferredSkills: Skill[];
  experienceLevel: ExperienceLevel;
  education: EducationRequirement[];
  certifications: string[];
  languages: string[];
}

export interface Skill {
  name: string;
  level: SkillLevel;
  isRequired: boolean;
  weight: number;
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum ExperienceLevel {
  ENTRY = 'entry',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  EXECUTIVE = 'executive'
}

export interface EducationRequirement {
  level: EducationLevel;
  field?: string;
  isRequired: boolean;
}

export enum EducationLevel {
  HIGH_SCHOOL = 'high_school',
  ASSOCIATE = 'associate',
  BACHELOR = 'bachelor',
  MASTER = 'master',
  DOCTORATE = 'doctorate'
}

export interface ScreeningCriteria {
  minimumScore: number;
  skillWeights: { [skillName: string]: number };
  experienceWeight: number;
  educationWeight: number;
  keywordBonus: string[];
  disqualifyingKeywords: string[];
}

export interface ScreenedCandidate {
  resumeId: string;
  candidateName: string;
  email: string;
  overallScore: number;
  skillMatches: SkillMatch[];
  experienceMatch: ExperienceMatch;
  educationMatch: EducationMatch;
  strengths: string[];
  weaknesses: string[];
  recommendation: RecommendationType;
  extractedInfo: ExtractedResumeInfo;
}

export interface SkillMatch {
  skillName: string;
  required: boolean;
  found: boolean;
  level: SkillLevel;
  confidence: number;
  score: number;
}

export interface ExperienceMatch {
  yearsExperience: number;
  relevantExperience: number;
  levelMatch: boolean;
  score: number;
}

export interface EducationMatch {
  highestDegree: EducationLevel;
  relevantField: boolean;
  meetsRequirement: boolean;
  score: number;
}

export enum RecommendationType {
  STRONG_MATCH = 'strong_match',
  GOOD_MATCH = 'good_match',
  POTENTIAL_MATCH = 'potential_match',
  WEAK_MATCH = 'weak_match',
  NO_MATCH = 'no_match'
}

export interface ExtractedResumeInfo {
  personalInfo: PersonalInfo;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  languages: string[];
  summary: string;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  website?: string;
}

export interface WorkExperience {
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationDate?: Date;
  gpa?: number;
}

export interface CandidateRanking {
  resumeId: string;
  candidateName: string;
  rank: number;
  score: number;
  category: RecommendationType;
}

export interface ScreeningSummary {
  totalCandidates: number;
  qualifiedCandidates: number;
  averageScore: number;
  topSkillsFound: string[];
  commonWeaknesses: string[];
  recommendedInterviews: number;
}

// Employee Onboarding Interfaces
export interface OnboardingRequest {
  newEmployee: NewEmployeeInfo;
  position: PositionInfo;
  onboardingTemplate: OnboardingTemplate;
}

export interface OnboardingResult {
  onboardingPlan: OnboardingPlan;
  generatedForms: GeneratedForm[];
  trainingMaterials: TrainingMaterial[];
  timeline: OnboardingTimeline;
  assignedBuddy?: EmployeeBuddy;
}

export interface NewEmployeeInfo {
  employeeId: string;
  personalInfo: PersonalInfo;
  startDate: Date;
  department: string;
  position: string;
  manager: string;
  workLocation: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
}

export interface PositionInfo {
  title: string;
  department: string;
  level: string;
  requiredTraining: string[];
  equipmentNeeded: Equipment[];
  systemAccess: SystemAccess[];
}

export interface Equipment {
  type: EquipmentType;
  model?: string;
  specifications?: string;
  quantity: number;
}

export enum EquipmentType {
  LAPTOP = 'laptop',
  MONITOR = 'monitor',
  PHONE = 'phone',
  DESK = 'desk',
  CHAIR = 'chair',
  HEADSET = 'headset',
  OTHER = 'other'
}

export interface SystemAccess {
  system: string;
  accessLevel: string;
  approver: string;
  requiredBy: Date;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  department: string;
  tasks: OnboardingTask[];
  forms: FormTemplate[];
  trainingModules: string[];
  duration: number; // days
}

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  assignedTo: 'employee' | 'manager' | 'hr' | 'it';
  dueDate: number; // days from start
  dependencies: string[];
  isRequired: boolean;
  category: TaskCategory;
}

export enum TaskCategory {
  PAPERWORK = 'paperwork',
  TRAINING = 'training',
  SETUP = 'setup',
  INTRODUCTION = 'introduction',
  COMPLIANCE = 'compliance'
}

export interface FormTemplate {
  id: string;
  name: string;
  type: FormType;
  fields: FormField[];
  isRequired: boolean;
  dueDate: number; // days from start
}

export enum FormType {
  TAX_FORMS = 'tax_forms',
  EMERGENCY_CONTACT = 'emergency_contact',
  DIRECT_DEPOSIT = 'direct_deposit',
  BENEFITS_ENROLLMENT = 'benefits_enrollment',
  HANDBOOK_ACKNOWLEDGMENT = 'handbook_acknowledgment',
  IT_POLICY = 'it_policy'
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'select' | 'checkbox' | 'file';
  label: string;
  required: boolean;
  options?: string[];
  validation?: string;
}

export interface OnboardingPlan {
  employeeId: string;
  startDate: Date;
  estimatedCompletion: Date;
  tasks: ScheduledTask[];
  milestones: Milestone[];
  checkpoints: Checkpoint[];
}

export interface ScheduledTask {
  taskId: string;
  title: string;
  assignedTo: string;
  dueDate: Date;
  status: TaskStatus;
  dependencies: string[];
  completedAt?: Date;
}

export interface Milestone {
  name: string;
  description: string;
  targetDate: Date;
  criteria: string[];
  isCompleted: boolean;
}

export interface Checkpoint {
  name: string;
  date: Date;
  participants: string[];
  agenda: string[];
  isCompleted: boolean;
}

export interface GeneratedForm {
  formId: string;
  name: string;
  type: FormType;
  content: string; // HTML or PDF content
  prefilled: boolean;
  dueDate: Date;
  submissionUrl?: string;
}

export interface TrainingMaterial {
  id: string;
  title: string;
  type: 'video' | 'document' | 'interactive' | 'quiz';
  url: string;
  duration?: number; // minutes
  isRequired: boolean;
  completionCriteria: string;
}

export interface OnboardingTimeline {
  phases: OnboardingPhase[];
  totalDuration: number;
  criticalPath: string[];
}

export interface OnboardingPhase {
  name: string;
  startDay: number;
  endDay: number;
  tasks: string[];
  deliverables: string[];
}

export interface EmployeeBuddy {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  experience: number;
  specialties: string[];
}

// Service Response Types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: ResponseMetadata;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export interface ResponseMetadata {
  processingTime: number;
  requestId: string;
  version: string;
  timestamp?: Date;
}

// External Integration Types
export interface ExternalIntegration {
  service: string;
  credentials: any;
  configuration: any;
}