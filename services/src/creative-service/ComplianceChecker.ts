import {
  ComplianceCheckRequest,
  ComplianceResult,
  ComplianceRule,
  ComplianceViolation,
  ContentType
} from './types';
import { logger } from '../shared/utils/logger';

export class ComplianceChecker {
  private rules: ComplianceRule[];
  private policyDatabase: string;

  constructor(config: { regulatoryRules: ComplianceRule[]; policyDatabase: string }) {
    this.rules = config.regulatoryRules;
    this.policyDatabase = config.policyDatabase;
  }

  /**
   * Check content compliance against regulatory requirements
   * Requirement 6.4: Verify documents against regulatory requirements and policies
   */
  async checkCompliance(request: ComplianceCheckRequest): Promise<ComplianceResult> {
    try {
      logger.info('Checking compliance', { 
        contentType: request.type,
        regulations: request.regulations 
      });

      const violations: ComplianceViolation[] = [];
      const suggestions: string[] = [];

      // Filter rules based on requested regulations and industry
      const applicableRules = this.getApplicableRules(request.regulations, request.industry);

      // Check each rule against the content
      for (const rule of applicableRules) {
        const ruleViolations = await this.checkRule(request.content, rule);
        violations.push(...ruleViolations);
      }

      // Generate suggestions based on violations
      const complianceSuggestions = this.generateSuggestions(violations, request);
      suggestions.push(...complianceSuggestions);

      // Calculate overall compliance confidence
      const confidence = this.calculateConfidence(violations, applicableRules.length);

      const isCompliant = violations.filter(v => v.severity === 'high' || v.severity === 'critical').length === 0;

      return {
        isCompliant,
        violations,
        suggestions,
        confidence
      };

    } catch (error) {
      logger.error('Error checking compliance', error);
      throw error;
    }
  }

  /**
   * Check GDPR compliance for data processing content
   */
  async checkGDPRCompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.EMAIL,
      regulations: ['GDPR'],
      industry: 'technology'
    });
  }

  /**
   * Check HIPAA compliance for healthcare content
   */
  async checkHIPAACompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.EMAIL,
      regulations: ['HIPAA'],
      industry: 'healthcare'
    });
  }

  /**
   * Check SOX compliance for financial content
   */
  async checkSOXCompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.REPORT,
      regulations: ['SOX'],
      industry: 'finance'
    });
  }

  /**
   * Check advertising compliance (FTC guidelines)
   */
  async checkAdvertisingCompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.AD_COPY,
      regulations: ['FTC'],
      industry: 'marketing'
    });
  }

  /**
   * Check email marketing compliance (CAN-SPAM)
   */
  async checkEmailMarketingCompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.EMAIL,
      regulations: ['CAN-SPAM'],
      industry: 'marketing'
    });
  }

  /**
   * Check financial services compliance
   */
  async checkFinancialServicesCompliance(content: string): Promise<ComplianceResult> {
    return this.checkCompliance({
      content,
      type: ContentType.EMAIL,
      regulations: ['SEC', 'FINRA'],
      industry: 'finance'
    });
  }

  /**
   * Add custom compliance rule
   */
  addCustomRule(rule: ComplianceRule): void {
    this.rules.push(rule);
    logger.info('Added custom compliance rule', { ruleId: rule.id, regulation: rule.regulation });
  }

  /**
   * Update existing compliance rule
   */
  updateRule(ruleId: string, updates: Partial<ComplianceRule>): boolean {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    logger.info('Updated compliance rule', { ruleId });
    return true;
  }

  /**
   * Remove compliance rule
   */
  removeRule(ruleId: string): boolean {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.rules.splice(ruleIndex, 1);
    logger.info('Removed compliance rule', { ruleId });
    return true;
  }

  // Private helper methods
  private getApplicableRules(regulations: string[], industry?: string): ComplianceRule[] {
    return this.rules.filter(rule => {
      // Check if rule applies to requested regulations
      const regulationMatch = regulations.includes(rule.regulation);
      
      // Check if rule applies to industry (if specified)
      const industryMatch = !industry || rule.industry.includes(industry);
      
      return regulationMatch && industryMatch;
    });
  }

  private async checkRule(content: string, rule: ComplianceRule): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check each pattern in the rule
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = content.match(regex);

      if (matches) {
        for (const match of matches) {
          const violation: ComplianceViolation = {
            rule,
            location: this.findMatchLocation(content, match),
            description: `Found potential violation: "${match}" matches pattern "${pattern}"`,
            severity: rule.severity,
            suggestion: this.generateRuleSuggestion(rule, match)
          };
          violations.push(violation);
        }
      }
    }

    // Special checks based on regulation type
    const specialViolations = await this.performSpecialChecks(content, rule);
    violations.push(...specialViolations);

    return violations;
  }

  private async performSpecialChecks(content: string, rule: ComplianceRule): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    switch (rule.regulation) {
      case 'GDPR':
        violations.push(...this.checkGDPRSpecific(content, rule));
        break;
      case 'HIPAA':
        violations.push(...this.checkHIPAASpecific(content, rule));
        break;
      case 'SOX':
        violations.push(...this.checkSOXSpecific(content, rule));
        break;
      case 'FTC':
        violations.push(...this.checkFTCSpecific(content, rule));
        break;
      case 'CAN-SPAM':
        violations.push(...this.checkCANSPAMSpecific(content, rule));
        break;
    }

    return violations;
  }

  private checkGDPRSpecific(content: string, rule: ComplianceRule): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check for personal data without consent language
    const personalDataKeywords = ['email address', 'phone number', 'name', 'address', 'personal data'];
    const consentKeywords = ['consent', 'agree', 'opt-in', 'permission'];

    const hasPersonalData = personalDataKeywords.some(keyword => lowerContent.includes(keyword));
    const hasConsentLanguage = consentKeywords.some(keyword => lowerContent.includes(keyword));

    if (hasPersonalData && !hasConsentLanguage) {
      violations.push({
        rule,
        location: 'Content body',
        description: 'Personal data mentioned without explicit consent language',
        severity: 'high',
        suggestion: 'Add clear consent language when collecting or processing personal data'
      });
    }

    // Check for data retention information
    if (lowerContent.includes('data') && !lowerContent.includes('retention') && !lowerContent.includes('delete')) {
      violations.push({
        rule,
        location: 'Content body',
        description: 'Data processing mentioned without retention policy information',
        severity: 'medium',
        suggestion: 'Include information about data retention and deletion policies'
      });
    }

    return violations;
  }

  private checkHIPAASpecific(content: string, rule: ComplianceRule): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check for PHI without proper safeguards
    const phiKeywords = ['medical record', 'health information', 'patient data', 'diagnosis', 'treatment'];
    const safeguardKeywords = ['encrypted', 'secure', 'confidential', 'authorized'];

    const hasPHI = phiKeywords.some(keyword => lowerContent.includes(keyword));
    const hasSafeguards = safeguardKeywords.some(keyword => lowerContent.includes(keyword));

    if (hasPHI && !hasSafeguards) {
      violations.push({
        rule,
        location: 'Content body',
        description: 'Protected Health Information mentioned without security safeguards',
        severity: 'critical',
        suggestion: 'Ensure PHI is properly protected and access is restricted to authorized personnel'
      });
    }

    return violations;
  }

  private checkSOXSpecific(content: string, rule: ComplianceRule): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check for financial statements without proper controls
    const financialKeywords = ['financial statement', 'earnings', 'revenue', 'profit', 'loss'];
    const controlKeywords = ['audited', 'verified', 'reviewed', 'certified'];

    const hasFinancialData = financialKeywords.some(keyword => lowerContent.includes(keyword));
    const hasControls = controlKeywords.some(keyword => lowerContent.includes(keyword));

    if (hasFinancialData && !hasControls) {
      violations.push({
        rule,
        location: 'Content body',
        description: 'Financial information without proper internal controls documentation',
        severity: 'high',
        suggestion: 'Ensure financial information is properly audited and verified'
      });
    }

    return violations;
  }

  private checkFTCSpecific(content: string, rule: ComplianceRule): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check for claims without substantiation
    const claimKeywords = ['proven', 'guaranteed', 'best', 'fastest', 'most effective'];
    const substantiationKeywords = ['study', 'research', 'tested', 'evidence'];

    claimKeywords.forEach(claim => {
      if (lowerContent.includes(claim)) {
        const hasSubstantiation = substantiationKeywords.some(keyword => 
          lowerContent.includes(keyword)
        );
        
        if (!hasSubstantiation) {
          violations.push({
            rule,
            location: `Near "${claim}"`,
            description: `Unsubstantiated claim: "${claim}"`,
            severity: 'medium',
            suggestion: 'Provide evidence or research to support advertising claims'
          });
        }
      }
    });

    // Check for missing disclosures
    if (lowerContent.includes('free') && !lowerContent.includes('terms') && !lowerContent.includes('conditions')) {
      violations.push({
        rule,
        location: 'Content body',
        description: 'Free offer without terms and conditions disclosure',
        severity: 'medium',
        suggestion: 'Include clear terms and conditions for free offers'
      });
    }

    return violations;
  }

  private checkCANSPAMSpecific(content: string, rule: ComplianceRule): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check for missing unsubscribe option
    const unsubscribeKeywords = ['unsubscribe', 'opt-out', 'remove'];
    const hasUnsubscribe = unsubscribeKeywords.some(keyword => lowerContent.includes(keyword));

    if (!hasUnsubscribe) {
      violations.push({
        rule,
        location: 'Email footer',
        description: 'Missing unsubscribe/opt-out mechanism',
        severity: 'critical',
        suggestion: 'Include clear unsubscribe instructions in email footer'
      });
    }

    // Check for misleading subject line
    if (lowerContent.includes('re:') && !lowerContent.includes('reply')) {
      violations.push({
        rule,
        location: 'Subject line',
        description: 'Potentially misleading "Re:" in subject line',
        severity: 'medium',
        suggestion: 'Avoid misleading subject line prefixes like "Re:" unless it\'s actually a reply'
      });
    }

    return violations;
  }

  private findMatchLocation(content: string, match: string): string {
    const index = content.indexOf(match);
    if (index === -1) return 'Unknown location';

    const lines = content.substring(0, index).split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;

    return `Line ${lineNumber}, Column ${columnNumber}`;
  }

  private generateRuleSuggestion(rule: ComplianceRule, match: string): string {
    const suggestions: { [key: string]: string } = {
      'GDPR': 'Ensure proper consent mechanisms and data protection measures are in place',
      'HIPAA': 'Implement appropriate safeguards for protected health information',
      'SOX': 'Maintain proper internal controls and audit trails for financial information',
      'FTC': 'Provide substantiation for advertising claims and clear disclosures',
      'CAN-SPAM': 'Include required email marketing disclosures and opt-out mechanisms'
    };

    return suggestions[rule.regulation] || `Review content for ${rule.regulation} compliance`;
  }

  private generateSuggestions(violations: ComplianceViolation[], request: ComplianceCheckRequest): string[] {
    const suggestions: string[] = [];
    const violationsByRegulation: { [key: string]: ComplianceViolation[] } = {};

    // Group violations by regulation
    violations.forEach(violation => {
      const regulation = violation.rule.regulation;
      if (!violationsByRegulation[regulation]) {
        violationsByRegulation[regulation] = [];
      }
      violationsByRegulation[regulation].push(violation);
    });

    // Generate regulation-specific suggestions
    Object.entries(violationsByRegulation).forEach(([regulation, regViolations]) => {
      const criticalCount = regViolations.filter(v => v.severity === 'critical').length;
      const highCount = regViolations.filter(v => v.severity === 'high').length;

      if (criticalCount > 0) {
        suggestions.push(`Address ${criticalCount} critical ${regulation} compliance issues immediately`);
      }
      if (highCount > 0) {
        suggestions.push(`Review and fix ${highCount} high-priority ${regulation} violations`);
      }
    });

    // General suggestions based on content type
    switch (request.type) {
      case ContentType.EMAIL:
        suggestions.push('Review email content for marketing compliance requirements');
        break;
      case ContentType.AD_COPY:
        suggestions.push('Ensure all advertising claims are substantiated with evidence');
        break;
      case ContentType.PRESS_RELEASE:
        suggestions.push('Verify all statements are factual and properly disclosed');
        break;
    }

    return suggestions;
  }

  private calculateConfidence(violations: ComplianceViolation[], totalRules: number): number {
    if (totalRules === 0) return 1.0;

    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    const mediumViolations = violations.filter(v => v.severity === 'medium').length;
    const lowViolations = violations.filter(v => v.severity === 'low').length;

    // Weight violations by severity
    const weightedScore = (criticalViolations * 4) + (highViolations * 3) + (mediumViolations * 2) + (lowViolations * 1);
    const maxPossibleScore = totalRules * 4;

    if (maxPossibleScore === 0) return 1.0;

    const confidence = Math.max(0, 1 - (weightedScore / maxPossibleScore));
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
}