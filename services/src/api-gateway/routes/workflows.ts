import { Router } from 'express';
import { authenticate, authorize } from '../../shared/utils/auth';
import { Permission } from '../../shared/types';
import { handleAsyncError } from '../../shared/utils/errors';
import { WorkflowTemplateService } from '../../task-orchestrator/WorkflowTemplateService';
import { WorkflowTriggerService } from '../../task-orchestrator/WorkflowTriggerService';
import { WorkflowAnalyticsService } from '../../task-orchestrator/WorkflowAnalyticsService';
import { WorkflowTestingService } from '../../task-orchestrator/WorkflowTestingService';
import { WorkflowEngine } from '../../task-orchestrator/WorkflowEngine';

const router = Router();
const templateService = new WorkflowTemplateService();
const workflowEngine = new WorkflowEngine();
const triggerService = new WorkflowTriggerService(workflowEngine);
const analyticsService = new WorkflowAnalyticsService();
const testingService = new WorkflowTestingService(workflowEngine, templateService);

// Apply authentication to all routes
router.use(authenticate);

// Workflow Template Management
router.get('/templates', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const { category, isActive, createdBy, search } = req.query;
  
  const templates = await templateService.getTemplates({
    category: category as string,
    isActive: isActive === 'true',
    createdBy: createdBy as string,
    search: search as string
  });

  res.json({
    success: true,
    data: templates,
    meta: { total: templates.length }
  });
}));

router.post('/templates', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const template = await templateService.createTemplate({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: template
  });
}));

router.get('/templates/:id', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const template = await templateService.getTemplate(req.params.id);

  res.json({
    success: true,
    data: template
  });
}));

router.put('/templates/:id', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const { createNewVersion } = req.query;
  
  const template = await templateService.updateTemplate(
    req.params.id,
    req.body,
    createNewVersion === 'true'
  );

  res.json({
    success: true,
    data: template
  });
}));

router.delete('/templates/:id', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  await templateService.deleteTemplate(req.params.id);

  res.json({
    success: true,
    message: 'Template deleted successfully'
  });
}));

router.post('/templates/:id/duplicate', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const { newName } = req.body;
  
  const duplicated = await templateService.duplicateTemplate(
    req.params.id,
    newName,
    req.user.id
  );

  res.status(201).json({
    success: true,
    data: duplicated
  });
}));

router.post('/templates/:id/validate', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const template = await templateService.getTemplate(req.params.id);
  const validation = await templateService.validateWorkflowTemplate(template);

  res.json({
    success: true,
    data: validation
  });
}));

// Workflow Execution
router.post('/templates/:id/execute', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const { taskId, context } = req.body;
  
  const executionId = await workflowEngine.executeWorkflow(
    req.params.id,
    taskId,
    context
  );

  res.status(201).json({
    success: true,
    data: { executionId }
  });
}));

router.get('/executions/:id', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const execution = workflowEngine.getExecution(req.params.id);

  if (!execution) {
    return res.status(404).json({
      success: false,
      error: { message: 'Execution not found' }
    });
  }

  res.json({
    success: true,
    data: execution
  });
}));

router.post('/executions/:id/pause', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  await workflowEngine.pauseWorkflow(req.params.id);

  res.json({
    success: true,
    message: 'Workflow paused successfully'
  });
}));

router.post('/executions/:id/resume', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  await workflowEngine.resumeWorkflow(req.params.id);

  res.json({
    success: true,
    message: 'Workflow resumed successfully'
  });
}));

router.get('/executions', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const executions = workflowEngine.getAllExecutions();

  res.json({
    success: true,
    data: executions,
    meta: { total: executions.length }
  });
}));

// Workflow Triggers
router.post('/triggers/webhook/:endpoint', handleAsyncError(async (req, res) => {
  const executionIds = await triggerService.handleWebhookRequest(
    req.params.endpoint,
    req.body,
    req.headers
  );

  res.json({
    success: true,
    data: { executionIds }
  });
}));

router.get('/triggers/webhooks', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const webhooks = await triggerService.getActiveWebhookEndpoints();

  res.json({
    success: true,
    data: webhooks
  });
}));

router.post('/triggers/refresh', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  await triggerService.refreshTriggers();

  res.json({
    success: true,
    message: 'Triggers refreshed successfully'
  });
}));

// Workflow Analytics
router.get('/analytics/templates/:id/performance', authorize(Permission.VIEW_ANALYTICS), handleAsyncError(async (req, res) => {
  const { days } = req.query;
  
  const metrics = await analyticsService.getPerformanceMetrics(
    req.params.id,
    days ? parseInt(days as string) : 30
  );

  res.json({
    success: true,
    data: metrics
  });
}));

router.get('/analytics/templates/:id/recommendations', authorize(Permission.VIEW_ANALYTICS), handleAsyncError(async (req, res) => {
  const recommendations = await analyticsService.generateOptimizationRecommendations(req.params.id);

  res.json({
    success: true,
    data: recommendations
  });
}));

router.get('/analytics/templates/:id/usage', authorize(Permission.VIEW_ANALYTICS), handleAsyncError(async (req, res) => {
  const { days } = req.query;
  
  const analytics = await analyticsService.getUsageAnalytics(
    req.params.id,
    days ? parseInt(days as string) : 30
  );

  res.json({
    success: true,
    data: analytics
  });
}));

router.get('/analytics/system', authorize(Permission.VIEW_ANALYTICS), handleAsyncError(async (req, res) => {
  const analytics = await analyticsService.getSystemWideAnalytics();

  res.json({
    success: true,
    data: analytics
  });
}));

// Workflow Testing
router.post('/testing/suites', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const suite = await testingService.createTestSuite({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: suite
  });
}));

router.post('/testing/suites/:id/run', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const result = await testingService.runTestSuite(req.params.id);

  res.json({
    success: true,
    data: result
  });
}));

router.get('/testing/suites/:id', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const suite = testingService.getTestSuite(req.params.id);

  if (!suite) {
    return res.status(404).json({
      success: false,
      error: { message: 'Test suite not found' }
    });
  }

  res.json({
    success: true,
    data: suite
  });
}));

router.get('/testing/suites/:id/results', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const results = testingService.getTestResults(req.params.id);

  res.json({
    success: true,
    data: results,
    meta: { total: results.length }
  });
}));

router.get('/testing/suites', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const suites = testingService.getAllTestSuites();

  res.json({
    success: true,
    data: suites,
    meta: { total: suites.length }
  });
}));

router.post('/testing/templates/:id/validate', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const validation = await testingService.validateWorkflowForTesting(req.params.id);

  res.json({
    success: true,
    data: validation
  });
}));

router.post('/testing/templates/:id/generate-tests', authorize(Permission.MANAGE_WORKFLOWS), handleAsyncError(async (req, res) => {
  const testCases = await testingService.generateTestCases(req.params.id);

  res.json({
    success: true,
    data: testCases,
    meta: { total: testCases.length }
  });
}));

export { router as workflowRoutes };