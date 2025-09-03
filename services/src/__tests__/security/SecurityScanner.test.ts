import { securityScanner, SecurityScanner, VulnerabilityType, SeverityLevel } from '../../shared/security/SecurityScanner';
import fs from 'fs/promises';
import path from 'path';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;
  let tempDir: string;

  beforeEach(async () => {
    scanner = new SecurityScanner();
    tempDir = path.join(__dirname, 'temp-scan');
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might not exist or have files
    }
  });

  describe('performSecurityScan', () => {
    it('should perform static analysis scan', async () => {
      // Create test file with vulnerability
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, `
        const password = "hardcoded123";
        const query = "SELECT * FROM users WHERE id = " + userId;
        const random = Math.random();
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result.scanType).toBe('STATIC');
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should perform dependency analysis', async () => {
      // Create test package.json
      const packageJson = {
        dependencies: {
          'lodash': '4.17.20' // Known vulnerable version
        },
        devDependencies: {
          'test-package': '1.0.0'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Change working directory temporarily
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = await scanner.performSecurityScan('DEPENDENCY');

        expect(result.scanType).toBe('DEPENDENCY');
        expect(result.vulnerabilities.some(v => 
          v.type === VulnerabilityType.INSECURE_DEPENDENCIES
        )).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should perform configuration analysis', async () => {
      // Set insecure environment variables
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const result = await scanner.performSecurityScan('CONFIGURATION');

        expect(result.scanType).toBe('CONFIGURATION');
        expect(result.vulnerabilities.some(v => 
          v.type === VulnerabilityType.INSECURE_CONFIGURATION
        )).toBe(true);
      } finally {
        if (originalEnv) {
          process.env.NODE_ENV = originalEnv;
        } else {
          delete process.env.NODE_ENV;
        }
      }
    });

    it('should calculate risk score correctly', async () => {
      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should generate appropriate recommendations', async () => {
      // Create file with multiple vulnerabilities
      const testFile = path.join(tempDir, 'vulnerable.ts');
      await fs.writeFile(testFile, `
        const password = "secret123";
        const apiKey = "hardcoded-api-key";
        const sql = "SELECT * FROM users WHERE name = '" + userName + "'";
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => 
        r.includes('environment variables') || r.includes('parameterized queries')
      )).toBe(true);
    });
  });

  describe('vulnerability detection', () => {
    it('should detect hardcoded passwords', async () => {
      const testFile = path.join(tempDir, 'password.ts');
      await fs.writeFile(testFile, `
        const password = "mypassword123";
        const pwd = 'secret';
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);
      const passwordVulns = result.vulnerabilities.filter(v => 
        v.title.toLowerCase().includes('password')
      );

      expect(passwordVulns.length).toBeGreaterThan(0);
      expect(passwordVulns[0].severity).toBe(SeverityLevel.HIGH);
    });

    it('should detect potential SQL injection', async () => {
      const testFile = path.join(tempDir, 'sql.ts');
      await fs.writeFile(testFile, `
        const query = "SELECT * FROM users WHERE id = " + userId;
        const update = "UPDATE users SET name = '" + name + "' WHERE id = " + id;
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);
      const sqlVulns = result.vulnerabilities.filter(v => 
        v.type === VulnerabilityType.SQL_INJECTION
      );

      expect(sqlVulns.length).toBeGreaterThan(0);
      expect(sqlVulns[0].severity).toBe(SeverityLevel.HIGH);
    });

    it('should detect insecure random usage', async () => {
      const testFile = path.join(tempDir, 'random.ts');
      await fs.writeFile(testFile, `
        const token = Math.random().toString();
        const sessionId = Math.random() * 1000000;
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);
      const randomVulns = result.vulnerabilities.filter(v => 
        v.title.toLowerCase().includes('random')
      );

      expect(randomVulns.length).toBeGreaterThan(0);
      expect(randomVulns[0].severity).toBe(SeverityLevel.MEDIUM);
    });
  });

  describe('scan summary', () => {
    it('should calculate vulnerability summary correctly', async () => {
      const testFile = path.join(tempDir, 'mixed.ts');
      await fs.writeFile(testFile, `
        const password = "secret123"; // HIGH
        const random = Math.random(); // MEDIUM
      `);

      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result.summary.total).toBe(result.vulnerabilities.length);
      expect(result.summary.high).toBeGreaterThan(0);
      expect(result.summary.medium).toBeGreaterThan(0);
    });

    it('should track scan duration', async () => {
      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result.duration).toBeGreaterThan(0);
      expect(result.endTime.getTime()).toBeGreaterThan(result.startTime.getTime());
    });
  });

  describe('error handling', () => {
    it('should handle scan errors gracefully', async () => {
      // Try to scan non-existent directory
      const result = await scanner.performSecurityScan('STATIC', '/non/existent/path');

      expect(result.scanType).toBe('STATIC');
      expect(result.vulnerabilities).toBeDefined();
      expect(Array.isArray(result.vulnerabilities)).toBe(true);
    });

    it('should handle file read errors', async () => {
      // Create directory instead of file with .ts extension
      await fs.mkdir(path.join(tempDir, 'notafile.ts'));

      const result = await scanner.performSecurityScan('STATIC', tempDir);

      expect(result).toBeDefined();
      expect(result.vulnerabilities).toBeDefined();
    });
  });
});