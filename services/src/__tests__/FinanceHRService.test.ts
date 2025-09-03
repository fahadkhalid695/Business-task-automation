import { FinanceHRService } from '../finance-hr-service/FinanceHRService';
import { 
  ExpenseProcessingRequest, 
  PayrollVerificationRequest,
  ResumeScreeningRequest,
  OnboardingRequest,
  ExpenseCategory,
  ExpenseStatus,
  SkillLevel,
  ExperienceLevel,
  EducationLevel,
  FormType,
  BenefitType,
  DeductionType
} from '../finance-hr-service/types/FinanceHRTypes';

// Mock the dependencies
jest.mock('../shared/utils/logger');
jest.mock('../ai-ml-engine/InferenceEngine');

describe('FinanceHRService', () => {
  let financeHRService: FinanceHRService;

  beforeEach(() => {
    financeHRService = new FinanceHRService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExpenses', () => {
    it('should process expense receipts successfully', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await financeHRService.processExpenses(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.processedExpenses).toHaveLength(1);
      expect(result.metadata?.requestId).toMatch(/^finhr-/);
    });

    it('should handle expense processing errors gracefully', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await financeHRService.processExpenses(request);

      expect(result.success).toBe(true);
      expect(result.data?.processedExpenses).toHaveLength(0);
      expect(result.data?.totalAmount).toBe(0);
    });

    it('should validate expense policy violations', async () => {
      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'https://example.com/receipt1.jpg',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date(),
        expensePolicy: {
          id: 'policy-1',
          name: 'Standard Policy',
          rules: [
            {
              category: ExpenseCategory.MEALS,
              maxAmount: 50,
              requiresReceipt: true,
              requiresApproval: false,
              description: 'Meal expense limit'
            }
          ],
          approvalLimits: [],
          isActive: true
        }
      };

      const result = await financeHRService.processExpenses(request);

      expect(result.success).toBe(true);
      expect(result.data?.policyViolations).toBeDefined();
    });
  });

  describe('verifyPayroll', () => {
    it('should verify payroll data successfully', async () => {
      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
          payDate: new Date('2024-01-15'),
          period: '2024-01'
        },
        timeEntries: [
          {
            date: new Date('2024-01-01'),
            clockIn: new Date('2024-01-01T09:00:00'),
            clockOut: new Date('2024-01-01T17:00:00'),
            breakDuration: 60,
            totalHours: 8,
            approved: true
          }
        ],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 50000,
          hourlyRate: 25,
          overtimeRate: 37.5,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: [
            {
              type: BenefitType.HEALTH_INSURANCE,
              amount: 200,
              isDeduction: true,
              isPreTax: true
            }
          ]
        }
      };

      const result = await financeHRService.verifyPayroll(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.totalHours).toBe(8);
      expect(result.data?.grossPay).toBeGreaterThan(0);
      expect(result.data?.deductions).toBeDefined();
      expect(result.data?.payslip).toBeDefined();
    });

    it('should identify payroll discrepancies', async () => {
      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
          payDate: new Date('2024-01-15'),
          period: '2024-01'
        },
        timeEntries: [
          {
            date: new Date('2024-01-01'),
            clockIn: new Date('2024-01-01T09:00:00'),
            clockOut: new Date('2024-01-01T23:00:00'), // 14 hours - should trigger discrepancy
            breakDuration: 60,
            totalHours: 14,
            approved: true
          }
        ],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 50000,
          hourlyRate: 25,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await financeHRService.verifyPayroll(request);

      expect(result.success).toBe(true);
      expect(result.data?.discrepancies).toBeDefined();
      expect(result.data?.overtimeHours).toBeGreaterThan(0);
    });
  });

  describe('screenResumes', () => {
    it('should screen resumes successfully', async () => {
      const request: ResumeScreeningRequest = {
        resumes: [
          {
            id: 'resume-1',
            candidateName: 'John Doe',
            email: 'john.doe@email.com',
            resumeUrl: 'https://example.com/resume1.pdf',
            resumeText: 'Software Engineer with 5 years experience in JavaScript, React, Node.js',
            uploadedAt: new Date()
          }
        ],
        jobRequirements: {
          jobTitle: 'Senior Software Engineer',
          department: 'Engineering',
          requiredSkills: [
            {
              name: 'JavaScript',
              level: SkillLevel.ADVANCED,
              isRequired: true,
              weight: 0.8
            },
            {
              name: 'React',
              level: SkillLevel.INTERMEDIATE,
              isRequired: true,
              weight: 0.7
            }
          ],
          preferredSkills: [
            {
              name: 'Node.js',
              level: SkillLevel.INTERMEDIATE,
              isRequired: false,
              weight: 0.5
            }
          ],
          experienceLevel: ExperienceLevel.SENIOR,
          education: [
            {
              level: EducationLevel.BACHELOR,
              field: 'Computer Science',
              isRequired: true
            }
          ],
          certifications: [],
          languages: ['English']
        },
        screeningCriteria: {
          minimumScore: 60,
          skillWeights: { 'JavaScript': 0.8, 'React': 0.7 },
          experienceWeight: 0.3,
          educationWeight: 0.2,
          keywordBonus: ['leadership', 'team'],
          disqualifyingKeywords: []
        }
      };

      const result = await financeHRService.screenResumes(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.screenedCandidates).toHaveLength(1);
      expect(result.data?.rankings).toHaveLength(1);
      expect(result.data?.summary).toBeDefined();
      expect(result.data?.summary.totalCandidates).toBe(1);
    });

    it('should rank candidates correctly', async () => {
      const request: ResumeScreeningRequest = {
        resumes: [
          {
            id: 'resume-1',
            candidateName: 'John Doe',
            email: 'john.doe@email.com',
            resumeUrl: 'https://example.com/resume1.pdf',
            resumeText: 'Senior Software Engineer with 8 years experience',
            uploadedAt: new Date()
          },
          {
            id: 'resume-2',
            candidateName: 'Jane Smith',
            email: 'jane.smith@email.com',
            resumeUrl: 'https://example.com/resume2.pdf',
            resumeText: 'Junior Developer with 2 years experience',
            uploadedAt: new Date()
          }
        ],
        jobRequirements: {
          jobTitle: 'Software Engineer',
          department: 'Engineering',
          requiredSkills: [],
          preferredSkills: [],
          experienceLevel: ExperienceLevel.MID,
          education: [],
          certifications: [],
          languages: []
        },
        screeningCriteria: {
          minimumScore: 50,
          skillWeights: {},
          experienceWeight: 0.5,
          educationWeight: 0.3,
          keywordBonus: [],
          disqualifyingKeywords: []
        }
      };

      const result = await financeHRService.screenResumes(request);

      expect(result.success).toBe(true);
      expect(result.data?.rankings).toHaveLength(2);
      expect(result.data?.rankings[0].rank).toBe(1);
      expect(result.data?.rankings[1].rank).toBe(2);
    });
  });

  describe('createOnboarding', () => {
    it('should create onboarding plan successfully', async () => {
      const request: OnboardingRequest = {
        newEmployee: {
          employeeId: 'emp-001',
          personalInfo: {
            name: 'John Doe',
            email: 'john.doe@company.com',
            phone: '555-0123'
          },
          startDate: new Date('2024-02-01'),
          department: 'Engineering',
          position: 'Software Engineer',
          manager: 'manager@company.com',
          workLocation: 'Office',
          employmentType: 'full-time'
        },
        position: {
          title: 'Software Engineer',
          department: 'Engineering',
          level: 'Mid',
          requiredTraining: ['safety', 'security'],
          equipmentNeeded: [
            {
              type: 'laptop' as any,
              model: 'MacBook Pro',
              quantity: 1
            }
          ],
          systemAccess: [
            {
              system: 'GitHub',
              accessLevel: 'Developer',
              approver: 'it@company.com',
              requiredBy: new Date('2024-02-01')
            }
          ]
        },
        onboardingTemplate: {
          id: 'template-1',
          name: 'Engineering Onboarding',
          department: 'Engineering',
          tasks: [
            {
              id: 'task-1',
              title: 'Complete paperwork',
              description: 'Fill out all required forms',
              assignedTo: 'employee',
              dueDate: 1,
              dependencies: [],
              isRequired: true,
              category: 'paperwork' as any
            }
          ],
          forms: [
            {
              id: 'form-1',
              name: 'Tax Forms',
              type: FormType.TAX_FORMS,
              fields: [],
              isRequired: true,
              dueDate: 3
            }
          ],
          trainingModules: ['general-001', 'safety-001'],
          duration: 90
        }
      };

      const result = await financeHRService.createOnboarding(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.onboardingPlan).toBeDefined();
      expect(result.data?.generatedForms).toBeDefined();
      expect(result.data?.trainingMaterials).toBeDefined();
      expect(result.data?.timeline).toBeDefined();
    });

    it('should generate required forms', async () => {
      const request: OnboardingRequest = {
        newEmployee: {
          employeeId: 'emp-001',
          personalInfo: {
            name: 'John Doe',
            email: 'john.doe@company.com'
          },
          startDate: new Date('2024-02-01'),
          department: 'Engineering',
          position: 'Software Engineer',
          manager: 'manager@company.com',
          workLocation: 'Office',
          employmentType: 'full-time'
        },
        position: {
          title: 'Software Engineer',
          department: 'Engineering',
          level: 'Mid',
          requiredTraining: [],
          equipmentNeeded: [],
          systemAccess: []
        },
        onboardingTemplate: {
          id: 'template-1',
          name: 'Engineering Onboarding',
          department: 'Engineering',
          tasks: [],
          forms: [
            {
              id: 'form-1',
              name: 'Tax Forms',
              type: FormType.TAX_FORMS,
              fields: [],
              isRequired: true,
              dueDate: 3
            },
            {
              id: 'form-2',
              name: 'Emergency Contact',
              type: FormType.EMERGENCY_CONTACT,
              fields: [],
              isRequired: true,
              dueDate: 1
            }
          ],
          trainingModules: [],
          duration: 30
        }
      };

      const result = await financeHRService.createOnboarding(request);

      expect(result.success).toBe(true);
      expect(result.data?.generatedForms).toHaveLength(2);
      expect(result.data?.generatedForms[0].type).toBe(FormType.TAX_FORMS);
      expect(result.data?.generatedForms[1].type).toBe(FormType.EMERGENCY_CONTACT);
    });
  });

  describe('integration management', () => {
    it('should add integration successfully', async () => {
      const integration = {
        service: 'quickbooks',
        credentials: { apiKey: 'test-key' },
        configuration: { syncInterval: 3600 }
      };

      const result = await financeHRService.addIntegration('qb-001', integration);

      expect(result.success).toBe(true);
    });

    it('should remove integration successfully', async () => {
      const integration = {
        service: 'quickbooks',
        credentials: { apiKey: 'test-key' },
        configuration: { syncInterval: 3600 }
      };

      await financeHRService.addIntegration('qb-001', integration);
      const result = await financeHRService.removeIntegration('qb-001');

      expect(result.success).toBe(true);
    });

    it('should handle removing non-existent integration', async () => {
      const result = await financeHRService.removeIntegration('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTEGRATION_REMOVAL_ERROR');
    });
  });

  describe('health status', () => {
    it('should return healthy status', async () => {
      const result = await financeHRService.getHealthStatus();

      expect(result.success).toBe(true);
      expect(result.data?.service).toBe('FinanceHRService');
      expect(result.data?.status).toBe('healthy');
      expect(result.data?.components).toBeDefined();
      expect(result.data?.components.expenseProcessor).toBeDefined();
      expect(result.data?.components.payrollProcessor).toBeDefined();
      expect(result.data?.components.resumeScreener).toBeDefined();
      expect(result.data?.components.onboardingManager).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle expense processing errors', async () => {
      // Mock the expense processor to throw an error
      const originalProcessExpenses = financeHRService['expenseProcessor'].processExpenses;
      financeHRService['expenseProcessor'].processExpenses = jest.fn().mockRejectedValue(new Error('Processing failed'));

      const request: ExpenseProcessingRequest = {
        receipts: [
          {
            id: 'receipt-1',
            imageUrl: 'invalid-url',
            filename: 'receipt1.jpg',
            uploadedAt: new Date()
          }
        ],
        employeeId: 'emp-001',
        submissionDate: new Date()
      };

      const result = await financeHRService.processExpenses(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXPENSE_PROCESSING_ERROR');

      // Restore original method
      financeHRService['expenseProcessor'].processExpenses = originalProcessExpenses;
    });

    it('should handle payroll verification errors', async () => {
      // Mock the payroll processor to throw an error
      const originalVerifyPayroll = financeHRService['payrollProcessor'].verifyPayroll;
      financeHRService['payrollProcessor'].verifyPayroll = jest.fn().mockRejectedValue(new Error('Verification failed'));

      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date(),
          endDate: new Date(),
          payDate: new Date(),
          period: '2024-01'
        },
        timeEntries: [],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 50000,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await financeHRService.verifyPayroll(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYROLL_VERIFICATION_ERROR');

      // Restore original method
      financeHRService['payrollProcessor'].verifyPayroll = originalVerifyPayroll;
    });
  });
});