import { PayrollProcessor } from '../finance-hr-service/PayrollProcessor';
import { 
  PayrollVerificationRequest,
  BenefitType,
  DeductionType
} from '../finance-hr-service/types/FinanceHRTypes';

// Mock the dependencies
jest.mock('../shared/utils/logger');

describe('PayrollProcessor', () => {
  let payrollProcessor: PayrollProcessor;

  beforeEach(() => {
    payrollProcessor = new PayrollProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyPayroll', () => {
    it('should calculate hours correctly for regular work week', async () => {
      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          payDate: new Date('2024-01-08'),
          period: '2024-W1'
        },
        timeEntries: [
          {
            date: new Date('2024-01-01'),
            clockIn: new Date('2024-01-01T09:00:00'),
            clockOut: new Date('2024-01-01T17:00:00'),
            breakDuration: 60,
            totalHours: 8,
            approved: true
          },
          {
            date: new Date('2024-01-02'),
            clockIn: new Date('2024-01-02T09:00:00'),
            clockOut: new Date('2024-01-02T17:00:00'),
            breakDuration: 60,
            totalHours: 8,
            approved: true
          }
        ],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 52000,
          hourlyRate: 25,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.totalHours).toBe(16);
      expect(result.regularHours).toBe(16);
      expect(result.overtimeHours).toBe(0);
      expect(result.grossPay).toBe(400); // 16 hours * $25/hour
    });

    it('should calculate overtime correctly', async () => {
      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-01'),
          payDate: new Date('2024-01-02'),
          period: '2024-W1'
        },
        timeEntries: [
          {
            date: new Date('2024-01-01'),
            clockIn: new Date('2024-01-01T09:00:00'),
            clockOut: new Date('2024-01-01T19:00:00'), // 10 hours
            breakDuration: 60,
            totalHours: 10,
            approved: true
          }
        ],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 52000,
          hourlyRate: 25,
          overtimeRate: 37.5,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.totalHours).toBe(10);
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      expect(result.grossPay).toBe(275); // (8 * $25) + (2 * $37.5)
    });

    it('should calculate deductions correctly', async () => {
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
          baseSalary: 52000,
          hourlyRate: 25,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: [
            {
              type: BenefitType.HEALTH_INSURANCE,
              amount: 150,
              isDeduction: true,
              isPreTax: true
            },
            {
              type: BenefitType.RETIREMENT_401K,
              amount: 100,
              isDeduction: true,
              isPreTax: true
            }
          ]
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.deductions).toBeDefined();
      expect(result.deductions.length).toBeGreaterThan(0);
      
      // Check for tax deductions
      const federalTax = result.deductions.find(d => d.type === DeductionType.FEDERAL_TAX);
      const socialSecurity = result.deductions.find(d => d.type === DeductionType.SOCIAL_SECURITY);
      const medicare = result.deductions.find(d => d.type === DeductionType.MEDICARE);
      
      expect(federalTax).toBeDefined();
      expect(socialSecurity).toBeDefined();
      expect(medicare).toBeDefined();
      
      // Check for benefit deductions
      const healthInsurance = result.deductions.find(d => d.type === DeductionType.HEALTH_INSURANCE);
      const retirement = result.deductions.find(d => d.type === DeductionType.RETIREMENT);
      
      expect(healthInsurance).toBeDefined();
      expect(retirement).toBeDefined();
      expect(healthInsurance?.amount).toBe(150);
      expect(retirement?.amount).toBe(100);
    });

    it('should identify discrepancies', async () => {
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
          baseSalary: 52000,
          hourlyRate: 5, // Below minimum wage - should trigger discrepancy
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.discrepancies).toBeDefined();
      expect(result.discrepancies.length).toBeGreaterThan(0);
      
      // Should have discrepancy for high hours
      const hoursDiscrepancy = result.discrepancies.find(d => d.type === 'hours');
      expect(hoursDiscrepancy).toBeDefined();
      
      // Should have discrepancy for low wage
      const rateDiscrepancy = result.discrepancies.find(d => d.type === 'rate');
      expect(rateDiscrepancy).toBeDefined();
    });

    it('should generate payslip data', async () => {
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
          baseSalary: 52000,
          hourlyRate: 25,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.payslip).toBeDefined();
      expect(result.payslip.employeeInfo).toBeDefined();
      expect(result.payslip.employeeInfo.employeeId).toBe('emp-001');
      expect(result.payslip.payPeriod).toEqual(request.payPeriod);
      expect(result.payslip.earnings).toBeDefined();
      expect(result.payslip.earnings.totalGross).toBe(result.grossPay);
      expect(result.payslip.netPay).toBe(result.netPay);
      expect(result.payslip.yearToDate).toBeDefined();
    });

    it('should handle salaried employees', async () => {
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
          baseSalary: 52000,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.grossPay).toBe(2000); // $52,000 / 26 pay periods
    });

    it('should skip unapproved time entries', async () => {
      const request: PayrollVerificationRequest = {
        employeeId: 'emp-001',
        payPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-02'),
          payDate: new Date('2024-01-03'),
          period: '2024-W1'
        },
        timeEntries: [
          {
            date: new Date('2024-01-01'),
            clockIn: new Date('2024-01-01T09:00:00'),
            clockOut: new Date('2024-01-01T17:00:00'),
            breakDuration: 60,
            totalHours: 8,
            approved: true
          },
          {
            date: new Date('2024-01-02'),
            clockIn: new Date('2024-01-02T09:00:00'),
            clockOut: new Date('2024-01-02T17:00:00'),
            breakDuration: 60,
            totalHours: 8,
            approved: false // This should be skipped
          }
        ],
        salaryInfo: {
          employeeId: 'emp-001',
          baseSalary: 52000,
          hourlyRate: 25,
          currency: 'USD',
          payFrequency: 'biweekly',
          benefits: []
        }
      };

      const result = await payrollProcessor.verifyPayroll(request);

      expect(result.totalHours).toBe(8); // Only approved hours counted
    });
  });

  describe('configureIntegration', () => {
    it('should configure integration successfully', async () => {
      const integration = {
        service: 'adp',
        credentials: { apiKey: 'test-key' },
        configuration: { syncInterval: 3600 }
      };

      await expect(payrollProcessor.configureIntegration('adp-001', integration))
        .resolves.not.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const status = await payrollProcessor.getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.taxCalculation).toBe('available');
      expect(status.hoursValidation).toBe('available');
      expect(Array.isArray(status.integrations)).toBe(true);
    });
  });
});