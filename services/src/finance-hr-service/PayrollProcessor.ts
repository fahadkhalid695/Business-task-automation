import { 
  PayrollVerificationRequest, 
  PayrollVerificationResult,
  TimeEntry,
  SalaryInfo,
  PayslipData,
  PayrollDiscrepancy,
  Deduction,
  DeductionType,
  BenefitType,
  ExternalIntegration
} from './types/FinanceHRTypes';
import { logger } from '../shared/utils/logger';

/**
 * PayrollProcessor - Handles payroll verification, hours validation, and payslip generation
 */
export class PayrollProcessor {
  private integrations: Map<string, ExternalIntegration>;
  private taxRates: Map<string, number>;

  constructor() {
    this.integrations = new Map();
    this.initializeTaxRates();
  }

  /**
   * Verify payroll data and generate payslips with hours validation
   */
  async verifyPayroll(request: PayrollVerificationRequest): Promise<PayrollVerificationResult> {
    logger.info(`Verifying payroll for employee ${request.employeeId}`, {
      payPeriod: request.payPeriod.period,
      timeEntries: request.timeEntries.length
    });

    // Calculate total hours worked
    const hoursCalculation = this.calculateHours(request.timeEntries);
    
    // Calculate gross pay
    const grossPay = this.calculateGrossPay(hoursCalculation, request.salaryInfo);
    
    // Calculate deductions
    const deductions = this.calculateDeductions(grossPay, request.salaryInfo);
    
    // Calculate net pay
    const netPay = grossPay - deductions.reduce((sum, d) => sum + d.amount, 0);
    
    // Identify discrepancies
    const discrepancies = await this.identifyDiscrepancies(request, hoursCalculation, grossPay);
    
    // Generate payslip
    const payslip = this.generatePayslip(request, hoursCalculation, grossPay, deductions, netPay);

    return {
      employeeId: request.employeeId,
      payPeriod: request.payPeriod,
      totalHours: hoursCalculation.totalHours,
      regularHours: hoursCalculation.regularHours,
      overtimeHours: hoursCalculation.overtimeHours,
      grossPay,
      deductions,
      netPay,
      discrepancies,
      payslip
    };
  }

  /**
   * Calculate total hours, regular hours, and overtime hours
   */
  private calculateHours(timeEntries: TimeEntry[]): { totalHours: number; regularHours: number; overtimeHours: number } {
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;

    // Group time entries by date to calculate daily hours
    const dailyHours = new Map<string, number>();
    
    for (const entry of timeEntries) {
      if (!entry.approved) {
        logger.warn(`Skipping unapproved time entry for ${entry.date}`);
        continue;
      }

      const dateKey = entry.date.toISOString().split('T')[0];
      const currentDayHours = dailyHours.get(dateKey) || 0;
      dailyHours.set(dateKey, currentDayHours + entry.totalHours);
      totalHours += entry.totalHours;
    }

    // Calculate regular and overtime hours (assuming 8 hours regular per day)
    for (const [date, hours] of dailyHours) {
      if (hours <= 8) {
        regularHours += hours;
      } else {
        regularHours += 8;
        overtimeHours += hours - 8;
      }
    }

    logger.debug('Hours calculation completed', {
      totalHours,
      regularHours,
      overtimeHours,
      daysWorked: dailyHours.size
    });

    return { totalHours, regularHours, overtimeHours };
  }

  /**
   * Calculate gross pay based on hours and salary information
   */
  private calculateGrossPay(hoursCalculation: { totalHours: number; regularHours: number; overtimeHours: number }, salaryInfo: SalaryInfo): number {
    let grossPay = 0;

    if (salaryInfo.hourlyRate) {
      // Hourly employee
      grossPay = hoursCalculation.regularHours * salaryInfo.hourlyRate;
      
      if (hoursCalculation.overtimeHours > 0 && salaryInfo.overtimeRate) {
        grossPay += hoursCalculation.overtimeHours * salaryInfo.overtimeRate;
      }
    } else {
      // Salaried employee - calculate based on pay frequency
      switch (salaryInfo.payFrequency) {
        case 'weekly':
          grossPay = salaryInfo.baseSalary / 52;
          break;
        case 'biweekly':
          grossPay = salaryInfo.baseSalary / 26;
          break;
        case 'monthly':
          grossPay = salaryInfo.baseSalary / 12;
          break;
        default:
          grossPay = salaryInfo.baseSalary / 26; // Default to biweekly
      }
    }

    logger.debug('Gross pay calculated', {
      grossPay,
      regularHours: hoursCalculation.regularHours,
      overtimeHours: hoursCalculation.overtimeHours,
      hourlyRate: salaryInfo.hourlyRate,
      baseSalary: salaryInfo.baseSalary
    });

    return Math.round(grossPay * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate all deductions including taxes and benefits
   */
  private calculateDeductions(grossPay: number, salaryInfo: SalaryInfo): Deduction[] {
    const deductions: Deduction[] = [];

    // Calculate tax deductions
    const federalTax = this.calculateFederalTax(grossPay);
    const stateTax = this.calculateStateTax(grossPay);
    const socialSecurity = grossPay * (this.taxRates.get('social_security') || 0.062);
    const medicare = grossPay * (this.taxRates.get('medicare') || 0.0145);

    deductions.push(
      {
        type: DeductionType.FEDERAL_TAX,
        amount: Math.round(federalTax * 100) / 100,
        isPreTax: false,
        description: 'Federal Income Tax'
      },
      {
        type: DeductionType.STATE_TAX,
        amount: Math.round(stateTax * 100) / 100,
        isPreTax: false,
        description: 'State Income Tax'
      },
      {
        type: DeductionType.SOCIAL_SECURITY,
        amount: Math.round(socialSecurity * 100) / 100,
        isPreTax: false,
        description: 'Social Security'
      },
      {
        type: DeductionType.MEDICARE,
        amount: Math.round(medicare * 100) / 100,
        isPreTax: false,
        description: 'Medicare'
      }
    );

    // Calculate benefit deductions
    for (const benefit of salaryInfo.benefits) {
      if (benefit.isDeduction) {
        deductions.push({
          type: this.mapBenefitToDeductionType(benefit.type),
          amount: benefit.amount,
          isPreTax: benefit.isPreTax,
          description: this.getBenefitDescription(benefit.type)
        });
      }
    }

    return deductions;
  }

  /**
   * Calculate federal tax (simplified calculation)
   */
  private calculateFederalTax(grossPay: number): number {
    // Simplified federal tax calculation - in reality this would be much more complex
    const annualizedPay = grossPay * 26; // Assuming biweekly
    let taxRate = 0.12; // Default 12% bracket

    if (annualizedPay > 85525) taxRate = 0.22;
    else if (annualizedPay > 40525) taxRate = 0.12;
    else if (annualizedPay > 9950) taxRate = 0.10;

    return grossPay * taxRate;
  }

  /**
   * Calculate state tax (simplified calculation)
   */
  private calculateStateTax(grossPay: number): number {
    // Simplified state tax calculation - would vary by state
    const stateRate = this.taxRates.get('state_tax') || 0.05;
    return grossPay * stateRate;
  }

  /**
   * Identify discrepancies in payroll data
   */
  private async identifyDiscrepancies(request: PayrollVerificationRequest, hoursCalculation: any, grossPay: number): Promise<PayrollDiscrepancy[]> {
    const discrepancies: PayrollDiscrepancy[] = [];

    // Check for unusual hour patterns
    if (hoursCalculation.totalHours > 80) {
      discrepancies.push({
        type: 'hours',
        description: 'Unusually high hours worked in pay period',
        expected: 80,
        actual: hoursCalculation.totalHours,
        severity: 'high'
      });
    }

    // Check for missing time entries (gaps in dates)
    const timeEntryDates = request.timeEntries.map(entry => entry.date.toISOString().split('T')[0]);
    const uniqueDates = new Set(timeEntryDates);
    const expectedWorkDays = this.calculateExpectedWorkDays(request.payPeriod.startDate, request.payPeriod.endDate);
    
    if (uniqueDates.size < expectedWorkDays) {
      discrepancies.push({
        type: 'hours',
        description: 'Missing time entries for some work days',
        expected: expectedWorkDays,
        actual: uniqueDates.size,
        severity: 'medium'
      });
    }

    // Check for rate discrepancies
    if (request.salaryInfo.hourlyRate && request.salaryInfo.hourlyRate < 7.25) {
      discrepancies.push({
        type: 'rate',
        description: 'Hourly rate below federal minimum wage',
        expected: 7.25,
        actual: request.salaryInfo.hourlyRate,
        severity: 'high'
      });
    }

    return discrepancies;
  }

  /**
   * Generate payslip data
   */
  private generatePayslip(request: PayrollVerificationRequest, hoursCalculation: any, grossPay: number, deductions: Deduction[], netPay: number): PayslipData {
    return {
      employeeInfo: {
        employeeId: request.employeeId,
        name: 'Employee Name', // Would come from employee database
        department: 'Department', // Would come from employee database
        position: 'Position' // Would come from employee database
      },
      payPeriod: request.payPeriod,
      earnings: {
        regularPay: hoursCalculation.regularHours * (request.salaryInfo.hourlyRate || 0),
        overtimePay: hoursCalculation.overtimeHours * (request.salaryInfo.overtimeRate || 0),
        bonuses: 0,
        commissions: 0,
        totalGross: grossPay
      },
      deductions,
      netPay,
      yearToDate: {
        grossPay: grossPay * 26, // Simplified YTD calculation
        totalDeductions: deductions.reduce((sum, d) => sum + d.amount, 0) * 26,
        netPay: netPay * 26,
        taxesPaid: deductions.filter(d => !d.isPreTax).reduce((sum, d) => sum + d.amount, 0) * 26
      }
    };
  }

  /**
   * Calculate expected work days in a pay period
   */
  private calculateExpectedWorkDays(startDate: Date, endDate: Date): number {
    let workDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        workDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workDays;
  }

  /**
   * Map benefit type to deduction type
   */
  private mapBenefitToDeductionType(benefitType: BenefitType): DeductionType {
    switch (benefitType) {
      case BenefitType.HEALTH_INSURANCE:
        return DeductionType.HEALTH_INSURANCE;
      case BenefitType.RETIREMENT_401K:
        return DeductionType.RETIREMENT;
      default:
        return DeductionType.OTHER;
    }
  }

  /**
   * Get benefit description
   */
  private getBenefitDescription(benefitType: BenefitType): string {
    switch (benefitType) {
      case BenefitType.HEALTH_INSURANCE:
        return 'Health Insurance Premium';
      case BenefitType.DENTAL_INSURANCE:
        return 'Dental Insurance Premium';
      case BenefitType.RETIREMENT_401K:
        return '401(k) Contribution';
      case BenefitType.LIFE_INSURANCE:
        return 'Life Insurance Premium';
      case BenefitType.PARKING:
        return 'Parking Fee';
      case BenefitType.MEAL_ALLOWANCE:
        return 'Meal Allowance';
      default:
        return 'Other Benefit';
    }
  }

  /**
   * Initialize tax rates
   */
  private initializeTaxRates(): void {
    this.taxRates = new Map([
      ['social_security', 0.062],
      ['medicare', 0.0145],
      ['state_tax', 0.05], // Default state tax rate
      ['federal_tax_base', 0.12] // Base federal tax rate
    ]);
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring payroll processor integration: ${integration.service}`);
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      taxCalculation: 'available',
      hoursValidation: 'available',
      integrations: Array.from(this.integrations.keys())
    };
  }
}