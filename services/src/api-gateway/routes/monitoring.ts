import { Router } from 'express';
import { MonitoringService } from '../../../monitoring-service/MonitoringService';
import { MetricsCollector } from '../../../monitoring-service/MetricsCollector';
import { AlertManager } from '../../../monitoring-service/AlertManager';
import { DashboardService } from '../../../monitoring-service/DashboardService';
import { AnalyticsEngine } from '../../../monitoring-service/AnalyticsEngine';
import { SystemHealthMonitor } from '../../../monitoring-service/SystemHealthMonitor';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { Logger } from '../../../shared/utils/Logger';
import { Joi } from 'joi';

const router = Router();
const logger = Logger.getInstance();

// Initialize monitoring services
const monitoringService = new MonitoringService();
const metricsCollector = new MetricsCollector();
const alertManager = new AlertManager();
const dashboardService = new DashboardService();
const analyticsEngine = new AnalyticsEngine();
const healthMonitor = new SystemHealthMonitor();

// Initialize monitoring service
monitoringService.initialize().catch(error => {
  logger.error('Failed to initialize monitoring service:', error);
});

// Validation schemas
const createAlertSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  condition: Joi.string().required(),
  threshold: Joi.number().required(),
  service: Joi.string().required()
});

const createDashboardSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string(),
  widgets: Joi.array().items(Joi.object({
    type: Joi.string().valid('chart', 'metric', 'table', 'alert', 'text').required(),
    title: Joi.string().required(),
    query: Joi.string().required(),
    config: Joi.object(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().required(),
      height: Joi.number().required()
    }).required()
  })).required(),
  refreshInterval: Joi.number().min(10).default(60)
});

const querySchema = Joi.object({
  query: Joi.string().required(),
  timeRange: Joi.object({
    start: Joi.date(),
    end: Joi.date()
  }),
  limit: Joi.number().min(1).max(1000).default(100)
});

// System Health Routes
router.get('/health', async (req, res) => {
  try {
    const health = await healthMonitor.checkSystemHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    });
  }
});

router.get('/health/detailed', authMiddleware, async (req, res) => {
  try {
    const healthCheck = await monitoringService.performHealthCheck();
    res.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    logger.error('Error performing detailed health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check'
    });
  }
});

router.get('/health/diagnostics', authMiddleware, async (req, res) => {
  try {
    const diagnostics = await healthMonitor.runDiagnostics();
    res.json({
      success: true,
      data: diagnostics
    });
  } catch (error) {
    logger.error('Error running diagnostics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run diagnostics'
    });
  }
});

// Metrics Routes
router.get('/metrics/system', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectSystemMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect system metrics'
    });
  }
});

router.get('/metrics/business', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectBusinessMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting business metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect business metrics'
    });
  }
});

router.get('/metrics/performance/:service', authMiddleware, async (req, res) => {
  try {
    const { service } = req.params;
    const metrics = await metricsCollector.collectPerformanceMetrics(service);
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect performance metrics'
    });
  }
});

router.get('/metrics/user-behavior', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectUserBehaviorMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting user behavior metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect user behavior metrics'
    });
  }
});

router.get('/metrics/cost', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectCostMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting cost metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect cost metrics'
    });
  }
});

router.get('/metrics/capacity', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectCapacityMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error collecting capacity metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect capacity metrics'
    });
  }
});

router.post('/metrics/custom', authMiddleware, async (req, res) => {
  try {
    const { metric } = req.body;
    await metricsCollector.recordCustomMetric(metric);
    res.json({
      success: true,
      message: 'Custom metric recorded successfully'
    });
  } catch (error) {
    logger.error('Error recording custom metric:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record custom metric'
    });
  }
});

// Analytics Routes
router.get('/analytics/task-completion', authMiddleware, async (req, res) => {
  try {
    const analytics = await analyticsEngine.analyzeTaskCompletionRates();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error analyzing task completion rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze task completion rates'
    });
  }
});

router.get('/analytics/user-satisfaction', authMiddleware, async (req, res) => {
  try {
    const analytics = await analyticsEngine.analyzeUserSatisfaction();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error analyzing user satisfaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze user satisfaction'
    });
  }
});

router.get('/analytics/workflow-efficiency', authMiddleware, async (req, res) => {
  try {
    const analytics = await analyticsEngine.analyzeWorkflowEfficiency();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error analyzing workflow efficiency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze workflow efficiency'
    });
  }
});

router.get('/analytics/insights', authMiddleware, async (req, res) => {
  try {
    const insights = await analyticsEngine.generateInsights();
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights'
    });
  }
});

router.get('/analytics/anomalies', authMiddleware, async (req, res) => {
  try {
    const anomalies = await analyticsEngine.detectAnomalies();
    res.json({
      success: true,
      data: anomalies
    });
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect anomalies'
    });
  }
});

router.get('/analytics/capacity-prediction', authMiddleware, async (req, res) => {
  try {
    const prediction = await analyticsEngine.predictCapacityNeeds();
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    logger.error('Error predicting capacity needs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict capacity needs'
    });
  }
});

// Alert Routes
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const alerts = await alertManager.getActiveAlerts();
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

router.get('/alerts/summary', authMiddleware, async (req, res) => {
  try {
    const summary = await monitoringService.getAlertSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error getting alert summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert summary'
    });
  }
});

router.get('/alerts/history', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    const timeRange = {
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };
    
    const alerts = await alertManager.getAlertHistory(timeRange);
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error getting alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert history'
    });
  }
});

router.post('/alerts', authMiddleware, validateRequest(createAlertSchema), async (req, res) => {
  try {
    const alertData = {
      ...req.body,
      status: 'active' as const,
      currentValue: 0,
      escalationLevel: 0
    };
    
    const alert = await alertManager.createAlert(alertData);
    res.status(201).json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert'
    });
  }
});

router.put('/alerts/:id/acknowledge', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    
    await alertManager.acknowledgeAlert(id, userId);
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

router.put('/alerts/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    
    await alertManager.resolveAlert(id, userId);
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

// Dashboard Routes
router.get('/dashboards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const dashboards = await dashboardService.getDashboards(userId);
    res.json({
      success: true,
      data: dashboards
    });
  } catch (error) {
    logger.error('Error getting dashboards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboards'
    });
  }
});

router.get('/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await dashboardService.getDashboard(id);
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error getting dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard'
    });
  }
});

router.post('/dashboards', authMiddleware, validateRequest(createDashboardSchema), async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const dashboardData = {
      ...req.body,
      permissions: [userId],
      layout: {
        columns: 12,
        rows: 8,
        responsive: true,
        ...req.body.layout
      }
    };
    
    const dashboard = await dashboardService.createDashboard(dashboardData);
    res.status(201).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error creating dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dashboard'
    });
  }
});

router.put('/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await dashboardService.updateDashboard(id, req.body);
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error updating dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update dashboard'
    });
  }
});

router.delete('/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await dashboardService.deleteDashboard(id);
    res.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dashboard'
    });
  }
});

router.get('/dashboards/:id/widgets/:widgetId/data', authMiddleware, async (req, res) => {
  try {
    const { widgetId } = req.params;
    const data = await dashboardService.getWidgetData(widgetId);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Error getting widget data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get widget data'
    });
  }
});

// Query Routes
router.post('/query', authMiddleware, validateRequest(querySchema), async (req, res) => {
  try {
    const { query } = req.body;
    const result = await dashboardService.executeQuery(query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute query'
    });
  }
});

// Reports Routes
router.get('/reports/system', authMiddleware, async (req, res) => {
  try {
    const report = await monitoringService.generateSystemReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating system report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate system report'
    });
  }
});

router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const overview = await monitoringService.getSystemOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Error getting system overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system overview'
    });
  }
});

// Configuration Routes
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const config = monitoringService.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error getting monitoring config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring config'
    });
  }
});

router.put('/config', authMiddleware, async (req, res) => {
  try {
    monitoringService.updateConfig(req.body);
    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating monitoring config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update monitoring config'
    });
  }
});

export default router;