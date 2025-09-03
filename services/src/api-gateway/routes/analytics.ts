import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../shared/utils/auth';
import { Permission, ReportType, ReportFormat } from '../../shared/types';
import { handleAsyncError } from '../../shared/utils/errors';
import { DataAnalyticsService } from '../../data-analytics-service';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const dataAnalyticsService = new DataAnalyticsService();

// Apply authentication to all routes
router.use(authenticate);

// Dataset management routes
router.post('/datasets', 
  authorize(Permission.WRITE_TASKS), 
  upload.single('file'),
  handleAsyncError(async (req, res) => {
    const { name, description, tags } = req.body;
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'File is required' }
      });
    }

    const result = await dataAnalyticsService.processDataFile(
      req.file,
      userId,
      { name, description, tags: tags ? JSON.parse(tags) : [] }
    );

    res.json({
      success: true,
      data: result,
      message: 'Dataset processed successfully'
    });
  })
);

router.get('/datasets', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const userId = req.user.id;
    const { tags, qualityScore, limit } = req.query;
    
    const filters: any = {};
    if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
    if (qualityScore) filters.qualityScore = parseInt(qualityScore as string);
    if (limit) filters.limit = parseInt(limit as string);

    const datasets = await dataAnalyticsService.getDatasets(userId, filters);

    res.json({
      success: true,
      data: datasets,
      message: 'Datasets retrieved successfully'
    });
  })
);

router.get('/datasets/:id/quality', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const { id } = req.params;
    
    const qualityReport = await dataAnalyticsService.getDatasetQualityReport(id);

    res.json({
      success: true,
      data: qualityReport,
      message: 'Quality report generated successfully'
    });
  })
);

router.post('/datasets/:id/clean', 
  authorize(Permission.WRITE_TASKS), 
  handleAsyncError(async (req, res) => {
    const { id } = req.params;
    const { operations } = req.body;
    const userId = req.user.id;
    
    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Operations array is required' }
      });
    }

    const result = await dataAnalyticsService.cleanDataset(id, operations, userId);

    res.json({
      success: true,
      data: result,
      message: 'Dataset cleaned successfully'
    });
  })
);

router.post('/datasets/:id/validate', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const { id } = req.params;
    const { rules } = req.body;
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation rules array is required' }
      });
    }

    const result = await dataAnalyticsService.validateData(id, rules);

    res.json({
      success: true,
      data: result,
      message: 'Data validation completed'
    });
  })
);

// Report generation routes
router.post('/reports', 
  authorize(Permission.WRITE_TASKS), 
  handleAsyncError(async (req, res) => {
    const { name, type, datasetIds, parameters, format } = req.body;
    const userId = req.user.id;
    
    if (!name || !type || !datasetIds || !parameters) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name, type, datasetIds, and parameters are required' }
      });
    }

    const reportConfig = {
      name,
      type: type as ReportType,
      datasetIds,
      parameters,
      format: format as ReportFormat || ReportFormat.PDF
    };

    const report = await dataAnalyticsService.generateReport(reportConfig, userId);

    res.json({
      success: true,
      data: report,
      message: 'Report generated successfully'
    });
  })
);

router.get('/reports', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const userId = req.user.id;
    const { type, status, limit } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit as string);

    const reports = await dataAnalyticsService.getReports(userId, filters);

    res.json({
      success: true,
      data: reports,
      message: 'Reports retrieved successfully'
    });
  })
);

// Trend analysis routes
router.post('/trends', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const { datasetId, column, timeColumn } = req.body;
    
    if (!datasetId || !column) {
      return res.status(400).json({
        success: false,
        error: { message: 'DatasetId and column are required' }
      });
    }

    const result = await dataAnalyticsService.analyzeTrends(datasetId, column, timeColumn);

    res.json({
      success: true,
      data: result,
      message: 'Trend analysis completed successfully'
    });
  })
);

// KPI calculation routes
router.post('/kpis', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const { datasetIds, kpiDefinitions } = req.body;
    
    if (!datasetIds || !kpiDefinitions || !Array.isArray(datasetIds) || !Array.isArray(kpiDefinitions)) {
      return res.status(400).json({
        success: false,
        error: { message: 'DatasetIds and kpiDefinitions arrays are required' }
      });
    }

    const results = await dataAnalyticsService.calculateKPIs(datasetIds, kpiDefinitions);

    res.json({
      success: true,
      data: results,
      message: 'KPIs calculated successfully'
    });
  })
);

// Market research routes
router.post('/market-research', 
  authorize(Permission.VIEW_ANALYTICS), 
  handleAsyncError(async (req, res) => {
    const { query, industry } = req.body;
    
    if (!query || !industry) {
      return res.status(400).json({
        success: false,
        error: { message: 'Query and industry are required' }
      });
    }

    const result = await dataAnalyticsService.performMarketResearch(query, industry);

    res.json({
      success: true,
      data: result,
      message: 'Market research completed successfully'
    });
  })
);

export { router as analyticsRoutes };