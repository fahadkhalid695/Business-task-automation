import { DataAnalyticsService } from '../data-analytics-service/DataAnalyticsService';
import { DataCleaner } from '../data-analytics-service/DataCleaner';
import { ReportGenerator } from '../data-analytics-service/ReportGenerator';
import { TrendAnalyzer } from '../data-analytics-service/TrendAnalyzer';
import { DatasetModel } from '../shared/models/Dataset';
import { ReportModel } from '../shared/models/Report';
import { ReportType, ReportFormat } from '../shared/types';

// Mock the models
jest.mock('../shared/models/Dataset');
jest.mock('../shared/models/Report');

// Mock the service dependencies
jest.mock('../data-analytics-service/DataCleaner');
jest.mock('../data-analytics-service/ReportGenerator');
jest.mock('../data-analytics-service/TrendAnalyzer');

describe('DataAnalyticsService', () => {
  let service: DataAnalyticsService;
  let mockDataCleaner: jest.Mocked<DataCleaner>;
  let mockReportGenerator: jest.Mocked<ReportGenerator>;
  let mockTrendAnalyzer: jest.Mocked<TrendAnalyzer>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.csv',
    encoding: '7bit',
    mimetype: 'text/csv',
    size: 1000,
    destination: '/tmp',
    filename: 'test.csv',
    path: '/tmp/test.csv',
    buffer: Buffer.from(''),
    stream: {} as any
  };

  const mockParsedData = {
    headers: ['date', 'value', 'category'],
    rows: [
      ['2024-01-01', 100, 'A'],
      ['2024-01-02', 150, 'B'],
      ['2024-01-03', 120, 'A']
    ],
    metadata: {
      totalRows: 3,
      totalColumns: 3,
      format: { type: 'csv' as const },
      parseErrors: []
    }
  };

  const mockQualityReport = {
    overallScore: 85,
    issues: [],
    recommendations: ['Data quality is good'],
    summary: {
      totalRows: 3,
      totalColumns: 3,
      missingValues: 0,
      duplicateRows: 0,
      outliers: 0
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    service = new DataAnalyticsService();

    // Get mocked instances
    mockDataCleaner = (service as any).dataCleaner;
    mockReportGenerator = (service as any).reportGenerator;
    mockTrendAnalyzer = (service as any).trendAnalyzer;
  });

  describe('processDataFile', () => {
    it('should process a CSV file successfully', async () => {
      // Arrange
      const userId = 'user123';
      const metadata = {
        name: 'Test Dataset',
        description: 'Test description',
        tags: ['test']
      };

      mockDataCleaner.parseFile.mockResolvedValue(mockParsedData);
      mockDataCleaner.assessDataQuality.mockResolvedValue(mockQualityReport);

      const mockDataset = {
        id: 'dataset123',
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({ id: 'dataset123', name: 'Test Dataset' })
      };

      (DatasetModel as any).mockImplementation(() => mockDataset);

      // Act
      const result = await service.processDataFile(mockFile, userId, metadata);

      // Assert
      expect(mockDataCleaner.parseFile).toHaveBeenCalledWith(mockFile);
      expect(mockDataCleaner.assessDataQuality).toHaveBeenCalledWith(mockParsedData);
      expect(mockDataset.save).toHaveBeenCalled();
      expect(result.dataset).toBeDefined();
      expect(result.qualityReport).toEqual(mockQualityReport);
    });

    it('should handle file parsing errors', async () => {
      // Arrange
      const userId = 'user123';
      const metadata = { name: 'Test Dataset' };

      mockDataCleaner.parseFile.mockRejectedValue(new Error('Invalid file format'));

      // Act & Assert
      await expect(service.processDataFile(mockFile, userId, metadata))
        .rejects.toThrow('Failed to process data file: Invalid file format');
    });
  });

  describe('cleanDataset', () => {
    it('should clean dataset successfully', async () => {
      // Arrange
      const datasetId = 'dataset123';
      const operations = ['remove_duplicates', 'fill_missing_values'];
      const userId = 'user123';

      const mockDataset = {
        id: datasetId,
        source: { location: '/tmp/test.csv' },
        qualityScore: 70,
        rowCount: 100,
        lastCleaned: null,
        processingHistory: [],
        save: jest.fn().mockResolvedValue(undefined)
      };

      const mockCleaningResult = {
        success: true,
        message: 'Data cleaned successfully',
        affectedRows: 10,
        beforeStats: { rowCount: 100, columnCount: 3, missingValues: 15, duplicateRows: 5, dataTypes: {}, nullPercentage: {} },
        afterStats: { rowCount: 95, columnCount: 3, missingValues: 0, duplicateRows: 0, dataTypes: {}, nullPercentage: {} },
        operations: []
      };

      (DatasetModel.findById as jest.Mock).mockResolvedValue(mockDataset);
      mockDataCleaner.loadDataFromFile.mockResolvedValue(mockParsedData);
      mockDataCleaner.cleanData.mockResolvedValue(mockCleaningResult);

      // Act
      const result = await service.cleanDataset(datasetId, operations, userId);

      // Assert
      expect(DatasetModel.findById).toHaveBeenCalledWith(datasetId);
      expect(mockDataCleaner.loadDataFromFile).toHaveBeenCalledWith('/tmp/test.csv');
      expect(mockDataCleaner.cleanData).toHaveBeenCalledWith(mockParsedData, operations);
      expect(mockDataset.save).toHaveBeenCalled();
      expect(result).toEqual(mockCleaningResult);
    });

    it('should handle dataset not found', async () => {
      // Arrange
      const datasetId = 'nonexistent';
      const operations = ['remove_duplicates'];
      const userId = 'user123';

      (DatasetModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.cleanDataset(datasetId, operations, userId))
        .rejects.toThrow('Failed to clean dataset: Dataset not found');
    });
  });

  describe('generateReport', () => {
    it('should generate report successfully', async () => {
      // Arrange
      const reportConfig = {
        name: 'Sales Report',
        type: ReportType.SALES,
        datasetIds: ['dataset123'],
        parameters: {
          dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
          filters: [],
          metrics: ['revenue', 'units']
        },
        format: ReportFormat.PDF
      };
      const userId = 'user123';

      const mockDatasets = [{
        id: 'dataset123',
        name: 'Sales Data',
        toObject: () => ({ id: 'dataset123', name: 'Sales Data' })
      }];

      const mockReportData = {
        headers: ['Date', 'Revenue', 'Units'],
        rows: [['2024-01-01', 1000, 10]],
        summary: { totalRecords: 1, keyMetrics: {}, insights: [] },
        charts: []
      };

      const mockReport = {
        id: 'report123',
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({ id: 'report123', name: 'Sales Report' })
      };

      (DatasetModel.find as jest.Mock).mockResolvedValue(mockDatasets);
      mockReportGenerator.generateReport.mockResolvedValue(mockReportData);
      (ReportModel as any).mockImplementation(() => mockReport);

      // Act
      const result = await service.generateReport(reportConfig, userId);

      // Assert
      expect(DatasetModel.find).toHaveBeenCalledWith({
        _id: { $in: reportConfig.datasetIds },
        isActive: true
      });
      expect(mockReportGenerator.generateReport).toHaveBeenCalledWith(
        [{ id: 'dataset123', name: 'Sales Data' }],
        ReportType.SALES,
        reportConfig.parameters
      );
      expect(mockReport.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 'report123', name: 'Sales Report' });
    });

    it('should handle no valid datasets', async () => {
      // Arrange
      const reportConfig = {
        name: 'Sales Report',
        type: ReportType.SALES,
        datasetIds: ['nonexistent'],
        parameters: { dateRange: { start: new Date(), end: new Date() }, filters: [], metrics: [] },
        format: ReportFormat.PDF
      };
      const userId = 'user123';

      (DatasetModel.find as jest.Mock).mockResolvedValue([]);

      // Act & Assert
      await expect(service.generateReport(reportConfig, userId))
        .rejects.toThrow('Failed to generate report: No valid datasets found');
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze trends successfully', async () => {
      // Arrange
      const datasetId = 'dataset123';
      const column = 'value';
      const timeColumn = 'date';

      const mockDataset = {
        id: datasetId,
        source: { location: '/tmp/test.csv' },
        processingHistory: [],
        save: jest.fn().mockResolvedValue(undefined)
      };

      const mockTrendResult = {
        trend: 'increasing' as const,
        confidence: 0.85,
        slope: 0.5,
        correlation: 0.7,
        insights: ['Strong upward trend detected']
      };

      (DatasetModel.findById as jest.Mock).mockResolvedValue(mockDataset);
      mockDataCleaner.loadDataFromFile.mockResolvedValue(mockParsedData);
      mockTrendAnalyzer.analyzeTrend.mockResolvedValue(mockTrendResult);

      // Act
      const result = await service.analyzeTrends(datasetId, column, timeColumn);

      // Assert
      expect(DatasetModel.findById).toHaveBeenCalledWith(datasetId);
      expect(mockDataCleaner.loadDataFromFile).toHaveBeenCalledWith('/tmp/test.csv');
      expect(mockTrendAnalyzer.analyzeTrend).toHaveBeenCalledWith(mockParsedData, column, timeColumn);
      expect(mockDataset.save).toHaveBeenCalled();
      expect(result).toEqual(mockTrendResult);
    });
  });

  describe('calculateKPIs', () => {
    it('should calculate KPIs successfully', async () => {
      // Arrange
      const datasetIds = ['dataset123'];
      const kpiDefinitions = [{
        name: 'Revenue Growth',
        description: 'Monthly revenue growth rate',
        formula: 'SUM(revenue)',
        target: 100000,
        unit: 'USD',
        category: 'Financial'
      }];

      const mockDatasets = [{
        id: 'dataset123',
        toObject: () => ({ id: 'dataset123', name: 'Sales Data' })
      }];

      const mockKPIResult = {
        name: 'Revenue Growth',
        value: 105000,
        target: 100000,
        variance: 5,
        trend: 'up' as const,
        status: 'good' as const
      };

      (DatasetModel.find as jest.Mock).mockResolvedValue(mockDatasets);
      mockReportGenerator.calculateKPI.mockResolvedValue(mockKPIResult);

      // Act
      const result = await service.calculateKPIs(datasetIds, kpiDefinitions);

      // Assert
      expect(DatasetModel.find).toHaveBeenCalledWith({
        _id: { $in: datasetIds },
        isActive: true
      });
      expect(mockReportGenerator.calculateKPI).toHaveBeenCalledWith(
        [{ id: 'dataset123', name: 'Sales Data' }],
        kpiDefinitions[0]
      );
      expect(result).toEqual([mockKPIResult]);
    });
  });

  describe('performMarketResearch', () => {
    it('should perform market research successfully', async () => {
      // Arrange
      const query = 'AI software market';
      const industry = 'Technology';

      const mockMarketData = {
        competitors: [],
        industryTrends: [],
        marketSize: { total: 1000000, growth: 10, segments: {}, forecast: [] },
        keyInsights: ['Market is growing rapidly'],
        sources: ['Industry reports'],
        lastUpdated: new Date()
      };

      mockTrendAnalyzer.performMarketResearch.mockResolvedValue(mockMarketData);

      // Act
      const result = await service.performMarketResearch(query, industry);

      // Assert
      expect(mockTrendAnalyzer.performMarketResearch).toHaveBeenCalledWith(query, industry);
      expect(result).toEqual(mockMarketData);
    });
  });

  describe('getDatasetQualityReport', () => {
    it('should get quality report successfully', async () => {
      // Arrange
      const datasetId = 'dataset123';

      const mockDataset = {
        id: datasetId,
        source: { location: '/tmp/test.csv' }
      };

      (DatasetModel.findById as jest.Mock).mockResolvedValue(mockDataset);
      mockDataCleaner.loadDataFromFile.mockResolvedValue(mockParsedData);
      mockDataCleaner.assessDataQuality.mockResolvedValue(mockQualityReport);

      // Act
      const result = await service.getDatasetQualityReport(datasetId);

      // Assert
      expect(DatasetModel.findById).toHaveBeenCalledWith(datasetId);
      expect(mockDataCleaner.loadDataFromFile).toHaveBeenCalledWith('/tmp/test.csv');
      expect(mockDataCleaner.assessDataQuality).toHaveBeenCalledWith(mockParsedData);
      expect(result).toEqual(mockQualityReport);
    });

    it('should handle dataset not found', async () => {
      // Arrange
      const datasetId = 'nonexistent';

      (DatasetModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getDatasetQualityReport(datasetId))
        .rejects.toThrow('Failed to get quality report: Dataset not found');
    });
  });

  describe('validateData', () => {
    it('should validate data successfully', async () => {
      // Arrange
      const datasetId = 'dataset123';
      const validationRules = [{
        column: 'value',
        type: 'required' as const,
        parameters: {},
        message: 'Value is required'
      }];

      const mockDataset = {
        id: datasetId,
        source: { location: '/tmp/test.csv' }
      };

      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        summary: {
          totalRows: 3,
          validRows: 3,
          errorRows: 0,
          warningRows: 0
        }
      };

      (DatasetModel.findById as jest.Mock).mockResolvedValue(mockDataset);
      mockDataCleaner.loadDataFromFile.mockResolvedValue(mockParsedData);
      mockDataCleaner.validateData.mockResolvedValue(mockValidationResult);

      // Act
      const result = await service.validateData(datasetId, validationRules);

      // Assert
      expect(DatasetModel.findById).toHaveBeenCalledWith(datasetId);
      expect(mockDataCleaner.loadDataFromFile).toHaveBeenCalledWith('/tmp/test.csv');
      expect(mockDataCleaner.validateData).toHaveBeenCalledWith(mockParsedData, validationRules);
      expect(result).toEqual(mockValidationResult);
    });
  });

  describe('getDatasets', () => {
    it('should get datasets for user', async () => {
      // Arrange
      const userId = 'user123';
      const filters = { tags: ['test'], qualityScore: 80 };

      const mockDatasets = [{
        id: 'dataset123',
        name: 'Test Dataset',
        toObject: () => ({ id: 'dataset123', name: 'Test Dataset' })
      }];

      (DatasetModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockDatasets)
        })
      });

      // Act
      const result = await service.getDatasets(userId, filters);

      // Assert
      expect(DatasetModel.find).toHaveBeenCalledWith({
        createdBy: userId,
        isActive: true,
        tags: { $in: filters.tags },
        qualityScore: { $gte: filters.qualityScore }
      });
      expect(result).toEqual([{ id: 'dataset123', name: 'Test Dataset' }]);
    });
  });

  describe('getReports', () => {
    it('should get reports for user', async () => {
      // Arrange
      const userId = 'user123';
      const filters = { type: ReportType.SALES, status: 'completed' };

      const mockReports = [{
        id: 'report123',
        name: 'Sales Report',
        toObject: () => ({ id: 'report123', name: 'Sales Report' })
      }];

      (ReportModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockReports)
        })
      });

      // Act
      const result = await service.getReports(userId, filters);

      // Assert
      expect(ReportModel.find).toHaveBeenCalledWith({
        createdBy: userId,
        type: filters.type,
        status: filters.status
      });
      expect(result).toEqual([{ id: 'report123', name: 'Sales Report' }]);
    });
  });
});