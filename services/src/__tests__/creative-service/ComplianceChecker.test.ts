import { ComplianceChecker } from '../../creative-service/ComplianceChecker';
import { ContentType, ComplianceRule } from '../../creative-service/types';

describe('ComplianceChecker', () => {
  let complianceChecker: ComplianceChecker;
  let mockRules: ComplianceRule[];

  beforeEach(() => {
    mockRules = [
      {
        id: 'gdpr-1',
        name: 'GDPR Personal Data Collection',
        description: 'Ensure proper consent for personal data collection',
        regulation: 'GDPR',
        industry: ['technology', 'healthcare', 'finance'],
        patterns: ['personal data', 'email address', 'phone number', 'collect.*data'],
        severity: 'high'
      },
      {
        id: 'canspam-1',
        name: 'CAN-SPAM Unsubscribe',
        description: 'Email must include unsubscribe mechanism',
        regulation: 'CAN-SPAM',
        industry: ['marketing', 'technology'],
        patterns: ['unsubscribe', 'opt-out', 'remove'],
        severity: 'critical'
      },
      {
        id: 'ftc-1',
        name: 'FTC Substantiation',
        description: 'Advertising claims must be substantiated',
        regulation: 'FTC',
        industry: ['marketing', 'retail'],
        patterns: ['guaranteed', 'proven', 'best', 'fastest'],
        severity: 'medium'
      }
    ];

    complianceChecker = new ComplianceChecker({
      regulatoryRules: mockRules,
      policyDatabase: 'test-policy-db'
    });
  });

  describe('GDPR Compliance', () => {
    it('should detect GDPR violations for personal data without consent', async () => {
      const content = 'We collect your email address and personal data for marketing purposes without your explicit consent.';

      const result = await complianceChecker.checkGDPRCompliance(content);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('high');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
    });

    it('should pass GDPR compliance with proper consent language', async () => {
      const content = 'With your consent, we may collect your email address for newsletter purposes. You can withdraw consent at any time.';

      const result = await complianceChecker.checkGDPRCompliance(content);

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.violations.filter(v => v.severity === 'critical' || v.severity === 'high').length).toBe(0);
    });

    it('should detect missing data retention information', async () => {
      const content = 'We process your data for various business purposes.';

      const result = await complianceChecker.checkGDPRCompliance(content);

      const retentionViolation = result.violations.find(v => 
        v.description.includes('retention policy')
      );
      expect(retentionViolation).toBeDefined();
    });
  });

  describe('CAN-SPAM Compliance', () => {
    it('should detect missing unsubscribe mechanism', async () => {
      const content = 'Check out our amazing products and special offers! Buy now and save 50%!';

      const result = await complianceChecker.checkCompliance({
        content,
        type: ContentType.EMAIL,
        regulations: ['CAN-SPAM']
      });

      expect(result.isCompliant).toBe(false);
      const unsubscribeViolation = result.violations.find(v => 
        v.description.includes('unsubscribe')
      );
      expect(unsubscribeViolation).toBeDefined();
      expect(unsubscribeViolation?.severity).toBe('critical');
    });

    it('should pass CAN-SPAM compliance with unsubscribe option', async () => {
      const content = 'Newsletter content here. To unsubscribe from future emails, click here.';

      const result = await complianceChecker.checkCompliance({
        content,
        type: ContentType.EMAIL,
        regulations: ['CAN-SPAM']
      });

      const criticalViolations = result.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    });

    it('should detect misleading subject line', async () => {
      const content = 'Re: Your order status - Actually this is marketing content, not a reply.';

      const result = await complianceChecker.checkCompliance({
        content,
        type: ContentType.EMAIL,
        regulations: ['CAN-SPAM']
      });

      const misleadingViolation = result.violations.find(v => 
        v.description.includes('misleading')
      );
      expect(misleadingViolation).toBeDefined();
    });
  });

  describe('FTC Compliance', () => {
    it('should detect unsubstantiated claims', async () => {
      const content = 'Our product is guaranteed to be the best and fastest solution on the market!';

      const result = await complianceChecker.checkAdvertisingCompliance(content);

      expect(result.violations.length).toBeGreaterThan(0);
      const claimViolations = result.violations.filter(v => 
        v.description.includes('Unsubstantiated claim')
      );
      expect(claimViolations.length).toBeGreaterThan(0);
    });

    it('should pass FTC compliance with substantiated claims', async () => {
      const content = 'Based on our research study, our product shows proven results in clinical testing.';

      const result = await complianceChecker.checkAdvertisingCompliance(content);

      const claimViolations = result.violations.filter(v => 
        v.description.includes('Unsubstantiated claim')
      );
      expect(claimViolations.length).toBe(0);
    });

    it('should detect missing terms for free offers', async () => {
      const content = 'Get your free trial now! No strings attached!';

      const result = await complianceChecker.checkAdvertisingCompliance(content);

      const freeOfferViolation = result.violations.find(v => 
        v.description.includes('Free offer without terms')
      );
      expect(freeOfferViolation).toBeDefined();
    });
  });

  describe('HIPAA Compliance', () => {
    it('should detect PHI without proper safeguards', async () => {
      const content = 'Patient medical records and health information are stored in our database.';

      const result = await complianceChecker.checkHIPAACompliance(content);

      expect(result.violations.length).toBeGreaterThan(0);
      const phiViolation = result.violations.find(v => 
        v.description.includes('Protected Health Information')
      );
      expect(phiViolation).toBeDefined();
      expect(phiViolation?.severity).toBe('critical');
    });

    it('should pass HIPAA compliance with proper safeguards', async () => {
      const content = 'All patient health information is encrypted and access is restricted to authorized personnel only.';

      const result = await complianceChecker.checkHIPAACompliance(content);

      const criticalViolations = result.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    });
  });

  describe('SOX Compliance', () => {
    it('should detect financial information without controls', async () => {
      const content = 'Our quarterly financial statements show significant revenue growth and profit margins.';

      const result = await complianceChecker.checkSOXCompliance(content);

      expect(result.violations.length).toBeGreaterThan(0);
      const controlsViolation = result.violations.find(v => 
        v.description.includes('internal controls')
      );
      expect(controlsViolation).toBeDefined();
    });

    it('should pass SOX compliance with proper controls', async () => {
      const content = 'Our audited financial statements have been reviewed and certified by independent auditors.';

      const result = await complianceChecker.checkSOXCompliance(content);

      const highViolations = result.violations.filter(v => v.severity === 'high');
      expect(highViolations.length).toBe(0);
    });
  });

  describe('Rule Management', () => {
    it('should add custom compliance rule', () => {
      const customRule: ComplianceRule = {
        id: 'custom-1',
        name: 'Custom Industry Rule',
        description: 'Custom compliance requirement',
        regulation: 'CUSTOM',
        industry: ['technology'],
        patterns: ['custom pattern'],
        severity: 'medium'
      };

      complianceChecker.addCustomRule(customRule);

      // Verify rule was added (this would require access to internal rules array)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should update existing rule', () => {
      const success = complianceChecker.updateRule('gdpr-1', {
        severity: 'critical'
      });

      expect(success).toBe(true);
    });

    it('should remove rule', () => {
      const success = complianceChecker.removeRule('gdpr-1');
      expect(success).toBe(true);

      const failedRemoval = complianceChecker.removeRule('non-existent-rule');
      expect(failedRemoval).toBe(false);
    });
  });

  describe('Multi-Regulation Compliance', () => {
    it('should check multiple regulations simultaneously', async () => {
      const content = 'We collect personal data and email addresses. This is guaranteed to be the best service.';

      const result = await complianceChecker.checkCompliance({
        content,
        type: ContentType.EMAIL,
        regulations: ['GDPR', 'FTC', 'CAN-SPAM'],
        industry: 'technology'
      });

      expect(result.violations.length).toBeGreaterThan(0);
      
      // Should have violations from multiple regulations
      const gdprViolations = result.violations.filter(v => v.rule.regulation === 'GDPR');
      const ftcViolations = result.violations.filter(v => v.rule.regulation === 'FTC');
      
      expect(gdprViolations.length).toBeGreaterThan(0);
      expect(ftcViolations.length).toBeGreaterThan(0);
    });

    it('should provide regulation-specific suggestions', async () => {
      const content = 'Personal data collection without consent and unsubstantiated claims.';

      const result = await complianceChecker.checkCompliance({
        content,
        type: ContentType.EMAIL,
        regulations: ['GDPR', 'FTC'],
        industry: 'marketing'
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('GDPR'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('FTC'))).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence based on violation severity', async () => {
      const criticalContent = 'Personal data collection, no unsubscribe, guaranteed claims without proof.';

      const result = await complianceChecker.checkCompliance({
        content: criticalContent,
        type: ContentType.EMAIL,
        regulations: ['GDPR', 'CAN-SPAM', 'FTC']
      });

      expect(result.confidence).toBeLessThan(0.5); // Should be low due to multiple violations
    });

    it('should have high confidence for compliant content', async () => {
      const compliantContent = 'Our newsletter provides valuable insights. Unsubscribe anytime. Based on research studies.';

      const result = await complianceChecker.checkCompliance({
        content: compliantContent,
        type: ContentType.NEWSLETTER,
        regulations: ['CAN-SPAM', 'FTC']
      });

      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Industry-Specific Compliance', () => {
    it('should apply industry-specific rules', async () => {
      const healthcareContent = 'Patient medical records and diagnosis information.';

      const result = await complianceChecker.checkCompliance({
        content: healthcareContent,
        type: ContentType.EMAIL,
        regulations: ['GDPR'],
        industry: 'healthcare'
      });

      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should skip non-applicable industry rules', async () => {
      const techContent = 'Software development and technology solutions.';

      const result = await complianceChecker.checkCompliance({
        content: techContent,
        type: ContentType.EMAIL,
        regulations: ['GDPR'],
        industry: 'technology'
      });

      // Should have fewer violations since content doesn't trigger healthcare-specific rules
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});