#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const Redis = require('redis');

class TestEnvironmentCleanup {
  constructor() {
    this.config = require('../configs/test-config.json');
    this.cleanupSteps = [];
  }

  async cleanupTestEnvironment() {
    console.log('🧹 Starting comprehensive test environment cleanup...');
    
    try {
      // Stop application services
      await this.stopApplicationServices();
      
      // Stop infrastructure services
      await this.stopInfrastructureServices();
      
      // Clean databases
      await this.cleanDatabases();
      
      // Remove test files
      await this.removeTestFiles();
      
      // Clean Docker resources
      await this.cleanDockerResources();
      
      // Generate cleanup report
      this.generateCleanupReport();
      
      console.log('✅ Test environment cleanup completed successfully!');
      
    } catch (error) {
      console.error('❌ Test environment cleanup failed:', error.message);
      // Continue with cleanup even if some steps fail
    }
  }

  async stopApplicationServices() {
    console.log('Stopping application services...');
    
    try {
      // Stop services using docker-compose
      await this.runCommand('docker-compose', ['-f', 'docker-compose.test.yml', 'down', '-v']);
      this.cleanupSteps.push({ step: 'Stop Application Services', status: 'SUCCESS' });
      console.log('✅ Application services stopped');
    } catch (error) {
      this.cleanupSteps.push({ step: 'Stop Application Services', status: 'FAILED', error: error.message });
      console.log('⚠️  Failed to stop application services:', error.message);
    }
  }

  async stopInfrastructureServices() {
    console.log('Stopping infrastructure services...');
    
    const infraServices = [
      'test-mongodb',
      'test-redis', 
      'test-elasticsearch',
      'test-mailhog'
    ];

    for (const serviceName of infraServices) {
      try {
        // Stop container
        await this.runCommand('docker', ['stop', serviceName]);
        console.log(`✅ Stopped ${serviceName}`);
        
        // Remove container
        await this.runCommand('docker', ['rm', serviceName]);
        console.log(`✅ Removed ${serviceName}`);
        
        this.cleanupSteps.push({ step: `Stop ${serviceName}`, status: 'SUCCESS' });
      } catch (error) {
        this.cleanupSteps.push({ step: `Stop ${serviceName}`, status: 'FAILED', error: error.message });
        console.log(`⚠️  Failed to stop ${serviceName}:`, error.message);
      }
    }
  }

  async cleanDatabases() {
    console.log('Cleaning test databases...');
    
    try {
      await this.cleanMongoDB();
      await this.cleanRedis();
      
      this.cleanupSteps.push({ step: 'Clean Databases', status: 'SUCCESS' });
      console.log('✅ Test databases cleaned');
    } catch (error) {
      this.cleanupSteps.push({ step: 'Clean Databases', status: 'FAILED', error: error.message });
      console.log('⚠️  Failed to clean databases:', error.message);
    }
  }

  async cleanMongoDB() {
    try {
      const client = new MongoClient(this.config.environments.development.database);
      await client.connect();
      
      const db = client.db();
      
      // Drop test collections
      const collections = ['users', 'workflows', 'executions', 'models', 'data_sources', 'notifications'];
      
      for (const collectionName of collections) {
        try {
          await db.collection(collectionName).drop();
          console.log(`✅ Dropped collection: ${collectionName}`);
        } catch (error) {
          // Collection might not exist
          console.log(`ℹ️  Collection ${collectionName} does not exist or already dropped`);
        }
      }
      
      await client.close();
      console.log('✅ MongoDB cleanup completed');
    } catch (error) {
      console.log('⚠️  MongoDB cleanup failed:', error.message);
    }
  }

  async cleanRedis() {
    try {
      const client = Redis.createClient({ url: this.config.environments.development.redis });
      await client.connect();
      
      // Clear all test data
      await client.flushDb();
      
      await client.quit();
      console.log('✅ Redis cleanup completed');
    } catch (error) {
      console.log('⚠️  Redis cleanup failed:', error.message);
    }
  }

  async removeTestFiles() {
    console.log('Removing test files...');
    
    const testDirectories = [
      'test-storage',
      'testing/reports',
      'testing/e2e/screenshots',
      'testing/e2e/videos',
      'testing/performance/reports',
      'testing/security/reports',
      'testing/integration/reports',
      'testing/contract/reports',
      'testing/contract/pacts',
      'testing/chaos/reports',
      'testing/data-quality/reports'
    ];

    for (const dir of testDirectories) {
      try {
        const fullPath = path.join(process.cwd(), dir);
        
        if (fs.existsSync(fullPath)) {
          await this.removeDirectory(fullPath);
          console.log(`✅ Removed directory: ${dir}`);
        }
        
        this.cleanupSteps.push({ step: `Remove ${dir}`, status: 'SUCCESS' });
      } catch (error) {
        this.cleanupSteps.push({ step: `Remove ${dir}`, status: 'FAILED', error: error.message });
        console.log(`⚠️  Failed to remove ${dir}:`, error.message);
      }
    }
    
    // Remove specific test files
    const testFiles = [
      'testing/data-quality/datasets/customers.csv',
      'testing/data-quality/datasets/transactions.csv',
      'testing/data-quality/datasets/products.csv',
      'testing/data-quality/datasets/validation_classification.json',
      'testing/data-quality/datasets/validation_regression.json'
    ];

    for (const file of testFiles) {
      try {
        const fullPath = path.join(process.cwd(), file);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✅ Removed file: ${file}`);
        }
      } catch (error) {
        console.log(`⚠️  Failed to remove ${file}:`, error.message);
      }
    }
  }

  async cleanDockerResources() {
    console.log('Cleaning Docker resources...');
    
    try {
      // Remove unused volumes
      await this.runCommand('docker', ['volume', 'prune', '-f']);
      console.log('✅ Removed unused Docker volumes');
      
      // Remove unused networks
      await this.runCommand('docker', ['network', 'prune', '-f']);
      console.log('✅ Removed unused Docker networks');
      
      // Remove unused images (test images only)
      try {
        await this.runCommand('docker', ['image', 'prune', '-f']);
        console.log('✅ Removed unused Docker images');
      } catch (error) {
        console.log('ℹ️  No unused Docker images to remove');
      }
      
      this.cleanupSteps.push({ step: 'Clean Docker Resources', status: 'SUCCESS' });
    } catch (error) {
      this.cleanupSteps.push({ step: 'Clean Docker Resources', status: 'FAILED', error: error.message });
      console.log('⚠️  Failed to clean Docker resources:', error.message);
    }
  }

  async removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          await this.removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      
      fs.rmdirSync(dirPath);
    }
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  generateCleanupReport() {
    const report = {
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      steps: this.cleanupSteps,
      summary: {
        total: this.cleanupSteps.length,
        successful: this.cleanupSteps.filter(step => step.status === 'SUCCESS').length,
        failed: this.cleanupSteps.filter(step => step.status === 'FAILED').length
      }
    };
    
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(reportsDir, `cleanup-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Cleanup report generated: ${reportPath}`);
  }

  async forceCleanup() {
    console.log('🔥 Performing force cleanup...');
    
    // Force stop and remove all test containers
    try {
      const { stdout } = await this.runCommand('docker', ['ps', '-a', '--filter', 'name=test-', '--format', '{{.Names}}']);
      const containers = stdout.trim().split('\n').filter(name => name);
      
      if (containers.length > 0) {
        await this.runCommand('docker', ['rm', '-f', ...containers]);
        console.log(`✅ Force removed ${containers.length} test containers`);
      }
    } catch (error) {
      console.log('ℹ️  No test containers to force remove');
    }
    
    // Force remove test volumes
    try {
      const { stdout } = await this.runCommand('docker', ['volume', 'ls', '--filter', 'name=test-', '--format', '{{.Name}}']);
      const volumes = stdout.trim().split('\n').filter(name => name);
      
      if (volumes.length > 0) {
        await this.runCommand('docker', ['volume', 'rm', '-f', ...volumes]);
        console.log(`✅ Force removed ${volumes.length} test volumes`);
      }
    } catch (error) {
      console.log('ℹ️  No test volumes to force remove');
    }
    
    // Force remove test networks
    try {
      const { stdout } = await this.runCommand('docker', ['network', 'ls', '--filter', 'name=test-', '--format', '{{.Name}}']);
      const networks = stdout.trim().split('\n').filter(name => name && name !== 'bridge' && name !== 'host' && name !== 'none');
      
      if (networks.length > 0) {
        await this.runCommand('docker', ['network', 'rm', ...networks]);
        console.log(`✅ Force removed ${networks.length} test networks`);
      }
    } catch (error) {
      console.log('ℹ️  No test networks to force remove');
    }
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const cleanup = new TestEnvironmentCleanup();
  
  // Check for force flag
  const forceCleanup = process.argv.includes('--force');
  
  if (forceCleanup) {
    cleanup.forceCleanup().then(() => {
      cleanup.cleanupTestEnvironment();
    });
  } else {
    cleanup.cleanupTestEnvironment();
  }
}

module.exports = TestEnvironmentCleanup;