import { Logger } from '../utils/logger';
import { auditLogger, AuditEventType, AuditSeverity } from './AuditLogger';
import { encryptionService } from './EncryptionService';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('SecurityScanner');

export enum VulnerabilityType {
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  CSRF = 'CSRF',
  INSECURE_DEPENDENCIES = 'INSECURE_DEPENDENCIES',
  WEAK_AUTHENTICATION = 'WEAK_AUTHENTICATION',
  INSECURE_CONFIGURATION = 'INSECURE_CONFIGURATION',
  SENSITIVE_DATA_EXPOSURE = 'SENSITIVE_DATA_EXPOSURE',
  BROKEN_ACCESS_CONTROL = 'BROKEN_ACCESS_CONTROL',
  SECURITY_MISCONFIGURATION = 'SECURITY_MISCONFIGURATION',
  INSUFFICIENT_LOGGING = 'INSUFFICIENT_LOGGING'
}

export enum SeverityLevel {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: SeverityLevel;
  title: string;
  description: string;
  location: string;
  evidence: string;
  recommendation: string;
  cveId?: string;
  cvssScore?: number;
  detectedAt: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignedTo?: string;
  resolvedAt?: Date;
}

export interface SecurityScanResult {
  scanId: string;
  scanType: 'STATIC' | 'DYNAMIC' | 'DEPENDENCY' | 'CONFIGURATION';
  startTime: Date;
  endTime: Date;
  duration: number;
  vulnerabilities: SecurityVulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  riskScore: number;
  recommendations: string[];
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  isActive: boolean;
  lastUpdated: Date;
}

export interface SecurityRule {
  id: string;
  name: string;
  pattern: string;
  severity: SeverityLevel;
  message: string;
  recommendation: string;
}

export class SecurityScanner {
  private policies: Map<string, SecurityPolicy> = new Map();
  private vulnerabilityDatabase: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
    this.loadVulnerabilityDatabase();
  }

  /**
   * Perform comprehensive security scan
   */
  async performSecurityScan(
    scanType: 'STATIC' | 'DYNAMIC' | 'DEPENDENCY' | 'CONFIGURATION' = 'STATIC',
    targetPath?: string
  ): Promise<SecurityScanResult> {
    const scanId = encryptionService.generateSecureToken(16);
    const startTime = new Date();

    logger.info('Starting security scan', { scanId, scanType, targetPath });

    try {
      let vulnerabilities: SecurityVulnerability[] = [];

      switch (scanType) {
        case 'STATIC':
          vulnerabilities = await this.performStaticAnalysis(targetPath);
          break;
        case 'DYNAMIC':
          vulnerabilities = await this.performDynamicAnalysis();
          break;
        case 'DEPENDENCY':
          vulnerabilities = await this.performDependencyAnalysis();
          break;
        case 'CONFIGURATION':
          vulnerabilities = await this.performConfigurationAnalysis();
          break;
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const summary = this.calculateSummary(vulnerabilities);
      const riskScore = this.calculateRiskScore(vulnerabilities);
      const recommendations = this.generateRecommendations(vulnerabilities);

      const result: SecurityScanResult = {
        scanId,
        scanType,
        startTime,
        endTime,
        duration,
        vulnerabilities,
        summary,
        riskScore,
        recommendations
      };

      // Log scan completion
      await auditLogger.logEvent(
        AuditEventType.SECURITY_VIOLATION,
        'Security scan completed',
        {
          scanId,
          scanType,
          vulnerabilitiesFound: vulnerabilities.length,
          riskScore,
          duration
        },
        {
          severity: riskScore > 70 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
          complianceFlags: ['SECURITY_SCAN']
        }
      );

      logger.info('Security scan completed', {
        scanId,
        vulnerabilitiesFound: vulnerabilities.length,
        riskScore
      });

      return result;
    } catch (error) {
      logger.error('Security scan failed', { scanId, error: error.message });
      throw error;
    }
  }

  /**
   * Perform static code analysis
   */
  private async performStaticAnalysis(targetPath?: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const basePath = targetPath || process.cwd();

    try {
      // Scan TypeScript/JavaScript files
      const files = await this.getSourceFiles(basePath, ['.ts', '.js']);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const fileVulnerabilities = await this.scanFileContent(file, content);
        vulnerabilities.push(...fileVulnerabilities);
      }

      // Scan configuration files
      const configVulnerabilities = await this.scanConfigurationFiles(basePath);
      vulnerabilities.push(...configVulnerabilities);

    } catch (error) {
      logger.error('Static analysis failed', { error: error.message });
    }

    return vulnerabilities;
  }

  /**
   * Perform dynamic security testing
   */
  private async performDynamicAnalysis(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // Test for common web vulnerabilities
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      
      // Test for SQL injection
      const sqlInjectionVulns = await this.testSqlInjection(baseUrl);
      vulnerabilities.push(...sqlInjectionVulns);

      // Test for XSS
      const xssVulns = await this.testXss(baseUrl);
      vulnerabilities.push(...xssVulns);

      // Test for authentication bypass
      const authVulns = await this.testAuthenticationBypass(baseUrl);
      vulnerabilities.push(...authVulns);

    } catch (error) {
      logger.error('Dynamic analysis failed', { error: error.message });
    }

    return vulnerabilities;
  }

  /**
   * Perform dependency vulnerability analysis
   */
  private async performDependencyAnalysis(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // Read package.json
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Check dependencies against vulnerability database
      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const [name, version] of Object.entries(allDependencies)) {
        const vulns = await this.checkDependencyVulnerabilities(name, version as string);
        vulnerabilities.push(...vulns);
      }

    } catch (error) {
      logger.error('Dependency analysis failed', { error: error.message });
    }

    return vulnerabilities;
  }

  /**
   * Perform configuration security analysis
   */
  private async performConfigurationAnalysis(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // Check environment configuration
      const envVulns = await this.checkEnvironmentConfiguration();
      vulnerabilities.push(...envVulns);

      // Check database configuration
      const dbVulns = await this.checkDatabaseConfiguration();
      vulnerabilities.push(...dbVulns);

      // Check server configuration
      const serverVulns = await this.checkServerConfiguration();
      vulnerabilities.push(...serverVulns);

    } catch (error) {
      logger.error('Configuration analysis failed', { error: error.message });
    }

    return vulnerabilities;
  }

  private async scanFileContent(filePath: string, content: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check against security policies
    for (const policy of this.policies.values()) {
      if (!policy.isActive) continue;

      for (const rule of policy.rules) {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = content.match(regex);

        if (matches) {
          vulnerabilities.push({
            id: encryptionService.generateSecureToken(16),
            type: this.mapRuleToVulnerabilityType(rule.name),
            severity: rule.severity,
            title: rule.name,
            description: rule.message,
            location: filePath,
            evidence: matches.join(', '),
            recommendation: rule.recommendation,
            detectedAt: new Date(),
            status: 'OPEN'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async testSqlInjection(baseUrl: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const sqlPayloads = ["'", "1' OR '1'='1", "'; DROP TABLE users; --"];

    try {
      // Test common endpoints with SQL injection payloads
      const endpoints = ['/api/users', '/api/tasks', '/api/auth/login'];
      
      for (const endpoint of endpoints) {
        for (const payload of sqlPayloads) {
          try {
            const response = await axios.get(`${baseUrl}${endpoint}?id=${payload}`, {
              timeout: 5000,
              validateStatus: () => true
            });

            // Check for SQL error messages in response
            if (this.containsSqlErrorSignatures(response.data)) {
              vulnerabilities.push({
                id: encryptionService.generateSecureToken(16),
                type: VulnerabilityType.SQL_INJECTION,
                severity: SeverityLevel.HIGH,
                title: 'SQL Injection Vulnerability',
                description: `Endpoint ${endpoint} appears vulnerable to SQL injection`,
                location: endpoint,
                evidence: `Payload: ${payload}`,
                recommendation: 'Use parameterized queries and input validation',
                detectedAt: new Date(),
                status: 'OPEN'
              });
            }
          } catch (error) {
            // Network errors are expected for some payloads
          }
        }
      }
    } catch (error) {
      logger.error('SQL injection test failed', { error: error.message });
    }

    return vulnerabilities;
  }

  private async testXss(baseUrl: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")'
    ];

    // Implementation would test for XSS vulnerabilities
    return vulnerabilities;
  }

  private async testAuthenticationBypass(baseUrl: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // Test accessing protected endpoints without authentication
      const protectedEndpoints = ['/api/admin', '/api/users/profile'];
      
      for (const endpoint of protectedEndpoints) {
        try {
          const response = await axios.get(`${baseUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: () => true
          });

          if (response.status === 200) {
            vulnerabilities.push({
              id: encryptionService.generateSecureToken(16),
              type: VulnerabilityType.BROKEN_ACCESS_CONTROL,
              severity: SeverityLevel.HIGH,
              title: 'Authentication Bypass',
              description: `Protected endpoint ${endpoint} accessible without authentication`,
              location: endpoint,
              evidence: `HTTP ${response.status} response`,
              recommendation: 'Implement proper authentication middleware',
              detectedAt: new Date(),
              status: 'OPEN'
            });
          }
        } catch (error) {
          // Expected for properly protected endpoints
        }
      }
    } catch (error) {
      logger.error('Authentication bypass test failed', { error: error.message });
    }

    return vulnerabilities;
  }

  private async checkDependencyVulnerabilities(name: string, version: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check against known vulnerability database
    const vulnKey = `${name}@${version}`;
    if (this.vulnerabilityDatabase.has(vulnKey)) {
      const vulnData = this.vulnerabilityDatabase.get(vulnKey);
      
      vulnerabilities.push({
        id: encryptionService.generateSecureToken(16),
        type: VulnerabilityType.INSECURE_DEPENDENCIES,
        severity: vulnData.severity,
        title: `Vulnerable Dependency: ${name}`,
        description: vulnData.description,
        location: `package.json`,
        evidence: `${name}@${version}`,
        recommendation: `Update to version ${vulnData.fixedVersion} or later`,
        cveId: vulnData.cveId,
        cvssScore: vulnData.cvssScore,
        detectedAt: new Date(),
        status: 'OPEN'
      });
    }

    return vulnerabilities;
  }

  private async checkEnvironmentConfiguration(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for insecure environment variables
    const insecureEnvVars = [
      'NODE_ENV=development',
      'DEBUG=true',
      'JWT_SECRET=secret'
    ];

    for (const envVar of insecureEnvVars) {
      const [key, value] = envVar.split('=');
      if (process.env[key] === value) {
        vulnerabilities.push({
          id: encryptionService.generateSecureToken(16),
          type: VulnerabilityType.INSECURE_CONFIGURATION,
          severity: SeverityLevel.MEDIUM,
          title: 'Insecure Environment Configuration',
          description: `Insecure environment variable: ${key}`,
          location: 'Environment Variables',
          evidence: envVar,
          recommendation: `Change ${key} to a secure value`,
          detectedAt: new Date(),
          status: 'OPEN'
        });
      }
    }

    return vulnerabilities;
  }

  private async checkDatabaseConfiguration(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check MongoDB connection string for security issues
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && mongoUri.includes('mongodb://') && !mongoUri.includes('ssl=true')) {
      vulnerabilities.push({
        id: encryptionService.generateSecureToken(16),
        type: VulnerabilityType.INSECURE_CONFIGURATION,
        severity: SeverityLevel.MEDIUM,
        title: 'Insecure Database Connection',
        description: 'Database connection not using SSL/TLS',
        location: 'Database Configuration',
        evidence: 'MongoDB URI without SSL',
        recommendation: 'Enable SSL/TLS for database connections',
        detectedAt: new Date(),
        status: 'OPEN'
      });
    }

    return vulnerabilities;
  }

  private async checkServerConfiguration(): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for missing security headers
    const requiredHeaders = [
      'helmet',
      'cors',
      'compression'
    ];

    // This would check if security middleware is properly configured
    return vulnerabilities;
  }

  private async getSourceFiles(basePath: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(basePath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.getSourceFiles(fullPath, extensions);
          files.push(...subFiles);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error('Failed to read source files', { basePath, error: error.message });
    }

    return files;
  }

  private containsSqlErrorSignatures(responseData: any): boolean {
    const sqlErrorSignatures = [
      'SQL syntax error',
      'mysql_fetch_array',
      'ORA-',
      'Microsoft OLE DB Provider',
      'PostgreSQL query failed'
    ];

    const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    return sqlErrorSignatures.some(signature => responseText.includes(signature));
  }

  private mapRuleToVulnerabilityType(ruleName: string): VulnerabilityType {
    const mapping: Record<string, VulnerabilityType> = {
      'hardcoded-password': VulnerabilityType.WEAK_AUTHENTICATION,
      'sql-injection': VulnerabilityType.SQL_INJECTION,
      'xss-vulnerability': VulnerabilityType.XSS,
      'insecure-random': VulnerabilityType.WEAK_AUTHENTICATION,
      'sensitive-data': VulnerabilityType.SENSITIVE_DATA_EXPOSURE
    };

    return mapping[ruleName] || VulnerabilityType.SECURITY_MISCONFIGURATION;
  }

  private calculateSummary(vulnerabilities: SecurityVulnerability[]): any {
    const summary = {
      total: vulnerabilities.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case SeverityLevel.CRITICAL:
          summary.critical++;
          break;
        case SeverityLevel.HIGH:
          summary.high++;
          break;
        case SeverityLevel.MEDIUM:
          summary.medium++;
          break;
        case SeverityLevel.LOW:
          summary.low++;
          break;
        case SeverityLevel.INFO:
          summary.info++;
          break;
      }
    }

    return summary;
  }

  private calculateRiskScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 0;
    const weights = {
      [SeverityLevel.CRITICAL]: 10,
      [SeverityLevel.HIGH]: 7,
      [SeverityLevel.MEDIUM]: 4,
      [SeverityLevel.LOW]: 2,
      [SeverityLevel.INFO]: 1
    };

    for (const vuln of vulnerabilities) {
      score += weights[vuln.severity] || 0;
    }

    return Math.min(score, 100);
  }

  private generateRecommendations(vulnerabilities: SecurityVulnerability[]): string[] {
    const recommendations = new Set<string>();

    for (const vuln of vulnerabilities) {
      recommendations.add(vuln.recommendation);
    }

    return Array.from(recommendations);
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicy: SecurityPolicy = {
      id: 'default-security-policy',
      name: 'Default Security Policy',
      description: 'Basic security rules for code analysis',
      rules: [
        {
          id: 'hardcoded-password',
          name: 'hardcoded-password',
          pattern: '(password|pwd|pass)\\s*=\\s*["\'][^"\']{3,}["\']',
          severity: SeverityLevel.HIGH,
          message: 'Hardcoded password detected',
          recommendation: 'Use environment variables or secure configuration'
        },
        {
          id: 'sql-injection',
          name: 'sql-injection',
          pattern: '(SELECT|INSERT|UPDATE|DELETE).*\\+.*["\']',
          severity: SeverityLevel.HIGH,
          message: 'Potential SQL injection vulnerability',
          recommendation: 'Use parameterized queries'
        },
        {
          id: 'insecure-random',
          name: 'insecure-random',
          pattern: 'Math\\.random\\(\\)',
          severity: SeverityLevel.MEDIUM,
          message: 'Insecure random number generation',
          recommendation: 'Use crypto.randomBytes() for security-sensitive operations'
        }
      ],
      isActive: true,
      lastUpdated: new Date()
    };

    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  private loadVulnerabilityDatabase(): void {
    // In a real implementation, this would load from a vulnerability database
    // For now, we'll add some sample vulnerabilities
    this.vulnerabilityDatabase.set('lodash@4.17.20', {
      cveId: 'CVE-2021-23337',
      severity: SeverityLevel.HIGH,
      description: 'Command injection vulnerability',
      fixedVersion: '4.17.21',
      cvssScore: 7.2
    });
  }
}

export const securityScanner = new SecurityScanner();