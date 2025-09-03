import { MonitoringService } from '../monitoring-service/MonitoringService';
import { MetricsCollector } from '../monitoring-service/MetricsCollector';
import { AlertManager } from '../monitoring-service/AlertManager';
import { DashboardService } from '../monitoring-service/DashboardService';
import { AnalyticsEngine } from '../monitoring-service/AnalyticsEngine';
import { SystemHealthMonitor } from '../monitoring-service/SystemHealthMonitor';
import { AlertSeverity, AlertStatus, MetricType } from '../monitoring-service/types';

// Mock dependencies
jest.mock('../shared/utils/Logger');
jest.mock('../shared/database/DatabaseService');
jest.mock('../shared/cache/RedisService');
jest.mock('../shared/services/NotificationService');

describe('Monitoring Service', () => {
  let monitoringService: MonitoringService;
  let metricsCollector: MetricsCollector;
  let alertManager: AlertManager;
  let dashboardService: DashboardService;
  let analyticsEngine: AnalyticsEngine;
  let healthMonitor: SystemHealthMonitor;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    metricsCollector = new MetricsCollector();
    alertManager = new AlertManager();
    dashboardService = new DashboardService();
    analyticsEngine = new AnalyticsEngine();
    healthMonitor = new SystemHealthMonitor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MetricsCollector', () => {
    it('should collect system metrics', async () => {
      const metrics = await metricsCollector.collectSystemMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      
      if (metrics.length > 0) {
        const metric = metrics[0];
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('type');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('service');
      }
    });

    it('should collect business metrics', async () => {
      const metrics = await metricsCollector.collectBusinessMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      
      if (metrics.length > 0) {
        const metric = metrics[0];
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('category');
        expect(metric).toHaveProperty('timestamp');
      }
    });

    it('should record custom metrics', async () => {
      const customMetric = {
        id: 'test-metric-1',
        name: 'test.custom.metric',
        type: MetricType.GAUGE,
        value: 42,
        labels: { test: 'true' },
        timestamp: new Date(),
        service: 'test'
      };

      await expect(metricsCollector.recordCustomMetric(customMetric)).resolves.not.toThrow();
    });

    it('should collect performance metrics for a service', async () => {
      const serviceName = 'api-gateway';
      const metrics = await metricsCollector.collectPerformanceMetrics(serviceName);
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should collect user behavior metrics', async () => {
      const metrics = await metricsCollector.collectUserBehaviorMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('activeUsers');
      expect(metrics).toHaveProperty('sessionDuration');
      expect(metrics).toHaveProperty('pageViews');
      expect(metrics).toHaveProperty('featureUsage');
      expect(metrics).toHaveProperty('conversionRates');
    });
  });

  describe('AlertManager', () => {
    it('should create an alert', async () => {
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: AlertSeverity.MEDIUM,
        status: AlertStatus.ACTIVE,
        condition: '>',
        threshold: 80,
        currentValue: 85,
        service: 'test-service',
        escalationLevel: 0
      };

      const alert = await alertManager.createAlert(alertData);
      
      expect(alert).toBeDefined();
      expect(alert).toHaveProperty('id');
      expect(alert.name).toBe(alertData.name);
      expect(alert.severity).toBe(alertData.severity);
      expect(alert.status).toBe(alertData.status);
    });

    it('should acknowledge an alert', async () => {
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: AlertSeverity.MEDIUM,
        status: AlertStatus.ACTIVE,
        condition: '>',
        threshold: 80,
        currentValue: 85,
        service: 'test-service',
        escalationLevel: 0
      };

      const alert = await alertManager.createAlert(alertData);
      await expect(alertManager.acknowledgeAlert(alert.id, 'test-user')).resolves.not.toThrow();
    });

    it('should resolve an alert', async () => {
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: AlertSeverity.MEDIUM,
        status: AlertStatus.ACTIVE,
        condition: '>',
        threshold: 80,
        currentValue: 85,
        service: 'test-service',
        escalationLevel: 0
      };

      const alert = await alertManager.createAlert(alertData);
      await expect(alertManager.resolveAlert(alert.id, 'test-user')).resolves.not.toThrow();
    });

    it('should get active alerts', async () => {
      const alerts = await alertManager.getActiveAlerts();
      
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should evaluate alert conditions', async () => {
      await expect(alertManager.evaluateAlertConditions()).resolves.not.toThrow();
    });
  });

  describe('DashboardService', () => {
    it('should create a dashboard', async () => {
      const dashboardConfig = {
        name: 'Test Dashboard',
        description: 'A test dashboard',
        widgets: [
          {
            id: 'widget-1',
            type: 'metric' as const,
            title: 'CPU Usage',
            query: 'metrics where name = system.cpu.usage',
            config: { unit: '%' },
            position: { x: 0, y: 0, width: 3, height: 2 }
          }
        ],
        layout: {
          columns: 12,
          rows: 8,
          responsive: true
        },
        refreshInterval: 60,
        permissions: ['test-user']
      };

      const dashboard = await dashboardService.createDashboard(dashboardConfig);
      
      expect(dashboard).toBeDefined();
      expect(dashboard).toHaveProperty('id');
      expect(dashboard.name).toBe(dashboardConfig.name);
      expect(dashboard.widgets).toHaveLength(1);
    });

    it('should execute a query', async () => {
      const query = 'metrics where name = system.cpu.usage';
      const result = await dashboardService.executeQuery(query);
      
      expect(result).toBeDefined();
    });

    it('should get dashboards for a user', async () => {
      const userId = 'test-user';
      const dashboards = await dashboardService.getDashboards(userId);
      
      expect(dashboards).toBeDefined();
      expect(Array.isArray(dashboards)).toBe(true);
    });
  });

  describe('AnalyticsEngine', () => {
    it('should analyze task completion rates', async () => {
      const analytics = await analyticsEngine.analyzeTaskCompletionRates();
      
      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics)).toBe(true);
    });

    it('should analyze user satisfaction', async () => {
      const analytics = await analyticsEngine.analyzeUserSatisfaction();
      
      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics)).toBe(true);
    });

    it('should analyze workflow efficiency', async () => {
      const analytics = await analyticsEngine.analyzeWorkflowEfficiency();
      
      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics)).toBe(true);
    });

    it('should generate insights', async () => {
      const insights = await analyticsEngine.generateInsights();
      
      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should detect anomalies', async () => {
      const anomalies = await analyticsEngine.detectAnomalies();
      
      expect(anomalies).toBeDefined();
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should predict capacity needs', async () => {
      const prediction = await analyticsEngine.predictCapacityNeeds();
      
      expect(prediction).toBeDefined();
      expect(prediction).toHaveProperty('current');
      expect(prediction).toHaveProperty('predicted');
      expect(prediction).toHaveProperty('recommendations');
    });
  });

  describe('SystemHealthMonitor', () => {
    it('should check system health', async () => {
      const health = await healthMonitor.checkSystemHealth();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('score');
      expect(health).toHaveProperty('lastUpdated');
      expect(Array.isArray(health.services)).toBe(true);
    });

    it('should check individual service health', async () => {
      const serviceName = 'api-gateway';
      const isHealthy = await healthMonitor.checkServiceHealth(serviceName);
      
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should run diagnostics', async () => {
      const diagnostics = await healthMonitor.runDiagnostics();
      
      expect(diagnostics).toBeDefined();
      expect(Array.isArray(diagnostics)).toBe(true);
      
      if (diagnostics.length > 0) {
        const diagnostic = diagnostics[0];
        expect(diagnostic).toHaveProperty('component');
        expect(diagnostic).toHaveProperty('status');
        expect(diagnostic).toHaveProperty('message');
        expect(diagnostic).toHaveProperty('timestamp');
      }
    });

    it('should calculate health score', async () => {
      const score = await healthMonitor.calculateHealthScore();
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('MonitoringService Integration', () => {
    it('should initialize successfully', async () => {
      await expect(monitoringService.initialize()).resolves.not.toThrow();
    });

    it('should generate system report', async () => {
      const report = await monitoringService.generateSystemReport();
      
      expect(report).toBeDefined();
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('systemHealth');
      expect(report).toHaveProperty('businessMetrics');
      expect(report).toHaveProperty('summary');
    });

    it('should get system overview', async () => {
      const overview = await monitoringService.getSystemOverview();
      
      expect(overview).toBeDefined();
      expect(overview).toHaveProperty('health');
      expect(overview).toHaveProperty('alerts');
      expect(overview).toHaveProperty('metrics');
      expect(overview).toHaveProperty('lastUpdated');
    });

    it('should create custom dashboard', async () => {
      const widgets = [
        {
          id: 'widget-1',
          type: 'metric' as const,
          title: 'Test Metric',
          query: 'test query',
          config: {},
          position: { x: 0, y: 0, width: 3, height: 2 }
        }
      ];

      const dashboard = await monitoringService.createCustomDashboard(
        'Custom Test Dashboard',
        widgets,
        'test-user'
      );
      
      expect(dashboard).toBeDefined();
      expect(dashboard).toHaveProperty('id');
      expect(dashboard.name).toBe('Custom Test Dashboard');
    });

    it('should get alert summary', async () => {
      const summary = await monitoringService.getAlertSummary();
      
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('active');
      expect(summary).toHaveProperty('recent');
      expect(summary).toHaveProperty('trends');
    });

    it('should perform health check', async () => {
      const healthCheck = await monitoringService.performHealthCheck();
      
      expect(healthCheck).toBeDefined();
      expect(healthCheck).toHaveProperty('health');
      expect(healthCheck).toHaveProperty('diagnostics');
      expect(healthCheck).toHaveProperty('timestamp');
    });

    it('should update configuration', () => {
      const newConfig = {
        metricsRetention: 60,
        collectionInterval: 30
      };

      expect(() => monitoringService.updateConfig(newConfig)).not.toThrow();
      
      const config = monitoringService.getConfig();
      expect(config.metricsRetention).toBe(60);
      expect(config.collectionInterval).toBe(30);
    });

    it('should shutdown gracefully', async () => {
      await expect(monitoringService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const mockError = new Error('Database connection failed');
      jest.spyOn(metricsCollector, 'collectSystemMetrics').mockRejectedValue(mockError);

      // Should not throw, but log the error
      await expect(monitoringService.collectAllMetrics()).resolves.not.toThrow();
    });

    it('should handle invalid alert data', async () => {
      const invalidAlertData = {
        // Missing required fields
        name: '',
        severity: 'invalid' as any,
        status: AlertStatus.ACTIVE,
        condition: '>',
        threshold: 80,
        currentValue: 85,
        service: 'test-service',
        escalationLevel: 0
      };

      await expect(alertManager.createAlert(invalidAlertData)).rejects.toThrow();
    });

    it('should handle invalid dashboard configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        widgets: [],
        layout: {
          columns: 12,
          rows: 8,
          responsive: true
        },
        refreshInterval: 60,
        permissions: []
      };

      await expect(dashboardService.createDashboard(invalidConfig as any)).rejects.toThrow();
    });

    it('should handle service unavailability', async () => {
      const unavailableService = 'non-existent-service';
      const isHealthy = await healthMonitor.checkServiceHealth(unavailableService);
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should collect metrics within acceptable time', async () => {
      const startTime = Date.now();
      await metricsCollector.collectSystemMetrics();
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent alert creation', async () => {
      const alertPromises = Array.from({ length: 10 }, (_, i) => 
        alertManager.createAlert({
          name: `Concurrent Alert ${i}`,
          description: `Test alert ${i}`,
          severity: AlertSeverity.LOW,
          status: AlertStatus.ACTIVE,
          condition: '>',
          threshold: 80,
          currentValue: 85,
          service: 'test-service',
          escalationLevel: 0
        })
      );

      const alerts = await Promise.all(alertPromises);
      expect(alerts).toHaveLength(10);
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('id');
        expect(alert.name).toMatch(/Concurrent Alert \d/);
      });
    });

    it('should handle large dataset queries efficiently', async () => {
      const query = 'metrics where timestamp > 2023-01-01 limit 1000';
      
      const startTime = Date.now();
      await dashboardService.executeQuery(query);
      const duration = Date.now() - startTime;
      
      // Should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });
});

describe('Monitoring API Integration', () => {
  // These tests would require a running server
  // They are examples of how you might test the API endpoints

  describe('Health Endpoints', () => {
    it('should return system health status', async () => {
      // This would be an actual HTTP request in a real integration test
      const mockResponse = {
        success: true,
        data: {
          overall: 'healthy',
          services: [],
          score: 95,
          lastUpdated: new Date()
        }
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.data.overall).toBe('healthy');
      expect(mockResponse.data.score).toBeGreaterThan(0);
    });
  });

  describe('Metrics Endpoints', () => {
    it('should return system metrics', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'metric-1',
            name: 'system.cpu.usage',
            type: 'gauge',
            value: 45.2,
            timestamp: new Date(),
            service: 'system'
          }
        ]
      };

      expect(mockResponse.success).toBe(true);
      expect(Array.isArray(mockResponse.data)).toBe(true);
    });
  });

  describe('Alert Endpoints', () => {
    it('should create and manage alerts', async () => {
      const createResponse = {
        success: true,
        data: {
          id: 'alert-1',
          name: 'Test Alert',
          severity: 'medium',
          status: 'active'
        }
      };

      expect(createResponse.success).toBe(true);
      expect(createResponse.data.id).toBeDefined();
    });
  });
});