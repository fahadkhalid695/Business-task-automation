import { DataCleaner } from './DataCleaner';
import { ReportGenerator } from './ReportGenerator';
import { TrendAnalyzer } from './TrendAnalyzer';
import { DatasetModel } from '../shared/models/Dataset';
import { ReportModel } from '../shared/models/Report';
import { 
  DataQualityReport, 
  CleaningResult, 
  TrendAnalysisResult, 
  ParsedData, 
  ValidationResult,
  KPIResult,
  MarketResearchData
} from './types';
import { Dataset, Report, ReportType, ReportFormat } from '../shared/types';
import { Logger } from '../shared/utils/Logger';

export class DataAnalyticsService {
  private dataCleaner: DataCleaner;
  private reportGenerator: ReportGenerator;
  private trendAnalyzer: TrendAnalyzer;
  private logger: Logger;

  constructor() {
    this.dataCleaner = new DataCleaner();
    this.reportGenerator = new ReportGenerator();
    this.trendAnalyzer = new TrendAnalyzer();
    this.logger = new Logger('DataAnalyticsService');
  }

  /**
   * Process uploaded data file and create dataset
   */
  async processDataFile(
    file: Express.Multer.File,
    userId: string,
    metadata: {
      name: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<{ dataset: Dataset; qualityReport: DataQualityReport }> {
    try {
      this.logger.info(`Processing data file: ${file.originalname}`);

      // Parse the data file
      const parsedData = await this.dataCleaner.parseFile(file);
      
      // Perform initial quality assessment
      const qualityReport = await this.dataCleaner.assessDataQuality(parsedData);

      // Create dataset record
      const dataset = new DatasetModel({
        name: metadata.name,
        description: metadata.description,
        source: {
          type: 'file',
          location: file.path
        },
        schema: {
          columns: parsedData.headers.map(header => ({
            name: header,
            type: this.inferColumnType(parsedData.rows, parsedData.headers.indexOf(header)),
            nullable: true,
            unique: false
          }))
        },
        qualityScore: qualityReport.overallScore,
        rowCount: parsedData.metadata.totalRows,
        columnCount: parsedData.metadata.totalColumns,
        tags: metadata.tags || [],
        createdBy: userId,
        dataQualityIssues: qualityReport.issues.map(issue => ({
          type: issue.type,
          column: issue.column,
          description: issue.description,
          severity: issue.severity,
          count: issue.count,
          detectedAt: new Date()
        }))
      });

      await dataset.save();
      this.logger.info(`Dataset created with ID: ${dataset.id}`);

      return { dataset: dataset.toObject(), qualityReport };
    } catch (error) {
      this.logger.error('Error processing data file:', error);
      throw new Error(`Failed to process data file: ${error.message}`);
    }
  }

  /**
   * Clean dataset using specified operations
   */
  async cleanDataset(
    datasetId: string,
    operations: string[],
    userId: string
  ): Promise<CleaningResult> {
    try {
      this.logger.info(`Cleaning dataset: ${datasetId}`);

      const dataset = await DatasetModel.findById(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      // Load data from file
      const parsedData = await this.dataCleaner.loadDataFromFile(dataset.source.location);
      
      // Apply cleaning operations
      const cleaningResult = await this.dataCleaner.cleanData(parsedData, operations);

      // Update dataset with cleaning results
      dataset.qualityScore = this.calculateQualityScore(cleaningResult.afterStats);
      dataset.rowCount = cleaningResult.afterStats.rowCount;
      dataset.lastCleaned = new Date();
      
      // Add to processing history
      dataset.processingHistory.push({
        operation: 'data_cleaning',
        parameters: { operations },
        executedAt: new Date(),
        executedBy: userId,
        result: {
          success: cleaningResult.success,
          message: cleaningResult.message,
          affectedRows: cleaningResult.affectedRows
        }
      });

      await dataset.save();
      this.logger.info(`Dataset cleaned successfully: ${datasetId}`);

      return cleaningResult;
    } catch (error) {
      this.logger.error('Error cleaning dataset:', error);
      throw new Error(`Failed to clean dataset: ${error.message}`);
    }
  }

  /**
   * Generate automated report
   */
  async generateReport(
    reportConfig: {
      name: string;
      type: ReportType;
      datasetIds: string[];
      parameters: any;
      format: ReportFormat;
    },
    userId: string
  ): Promise<Report> {
    try {
      this.logger.info(`Generating report: ${reportConfig.name}`);

      // Load datasets
      const datasets = await DatasetModel.find({
        _id: { $in: reportConfig.datasetIds },
        isActive: true
      });

      if (datasets.length === 0) {
        throw new Error('No valid datasets found');
      }

      // Generate report data
      const reportData = await this.reportGenerator.generateReport(
        datasets.map(d => d.toObject()),
        reportConfig.type,
        reportConfig.parameters
      );

      // Create report record
      const report = new ReportModel({
        name: reportConfig.name,
        type: reportConfig.type,
        parameters: reportConfig.parameters,
        data: reportData,
        format: reportConfig.format,
        createdBy: userId,
        status: 'completed'
      });

      await report.save();
      this.logger.info(`Report generated with ID: ${report.id}`);

      return report.toObject();
    } catch (error) {
      this.logger.error('Error generating report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Perform trend analysis on dataset
   */
  async analyzeTrends(
    datasetId: string,
    column: string,
    timeColumn?: string
  ): Promise<TrendAnalysisResult> {
    try {
      this.logger.info(`Analyzing trends for dataset: ${datasetId}, column: ${column}`);

      const dataset = await DatasetModel.findById(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      // Load data
      const parsedData = await this.dataCleaner.loadDataFromFile(dataset.source.location);
      
      // Perform trend analysis
      const trendResult = await this.trendAnalyzer.analyzeTrend(
        parsedData,
        column,
        timeColumn
      );

      // Update dataset with analysis timestamp
      dataset.processingHistory.push({
        operation: 'trend_analysis',
        parameters: { column, timeColumn },
        executedAt: new Date(),
        executedBy: 'system',
        result: {
          success: true,
          message: `Trend analysis completed for column: ${column}`,
          affectedRows: parsedData.metadata.totalRows
        }
      });

      await dataset.save();
      this.logger.info(`Trend analysis completed for dataset: ${datasetId}`);

      return trendResult;
    } catch (error) {
      this.logger.error('Error analyzing trends:', error);
      throw new Error(`Failed to analyze trends: ${error.message}`);
    }
  }

  /**
   * Calculate KPIs for datasets
   */
  async calculateKPIs(
    datasetIds: string[],
    kpiDefinitions: any[]
  ): Promise<KPIResult[]> {
    try {
      this.logger.info(`Calculating KPIs for ${datasetIds.length} datasets`);

      const datasets = await DatasetModel.find({
        _id: { $in: datasetIds },
        isActive: true
      });

      const results: KPIResult[] = [];

      for (const kpiDef of kpiDefinitions) {
        const kpiResult = await this.reportGenerator.calculateKPI(
          datasets.map(d => d.toObject()),
          kpiDef
        );
        results.push(kpiResult);
      }

      this.logger.info(`Calculated ${results.length} KPIs`);
      return results;
    } catch (error) {
      this.logger.error('Error calculating KPIs:', error);
      throw new Error(`Failed to calculate KPIs: ${error.message}`);
    }
  }

  /**
   * Perform market research analysis
   */
  async performMarketResearch(
    query: string,
    industry: string
  ): Promise<MarketResearchData> {
    try {
      this.logger.info(`Performing market research for: ${query} in ${industry}`);

      const marketData = await this.trendAnalyzer.performMarketResearch(query, industry);
      
      this.logger.info('Market research completed');
      return marketData;
    } catch (error) {
      this.logger.error('Error performing market research:', error);
      throw new Error(`Failed to perform market research: ${error.message}`);
    }
  }

  /**
   * Get dataset quality report
   */
  async getDatasetQualityReport(datasetId: string): Promise<DataQualityReport> {
    try {
      const dataset = await DatasetModel.findById(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      const parsedData = await this.dataCleaner.loadDataFromFile(dataset.source.location);
      return await this.dataCleaner.assessDataQuality(parsedData);
    } catch (error) {
      this.logger.error('Error getting quality report:', error);
      throw new Error(`Failed to get quality report: ${error.message}`);
    }
  }

  /**
   * Validate data against rules
   */
  async validateData(
    datasetId: string,
    validationRules: any[]
  ): Promise<ValidationResult> {
    try {
      const dataset = await DatasetModel.findById(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      const parsedData = await this.dataCleaner.loadDataFromFile(dataset.source.location);
      return await this.dataCleaner.validateData(parsedData, validationRules);
    } catch (error) {
      this.logger.error('Error validating data:', error);
      throw new Error(`Failed to validate data: ${error.message}`);
    }
  }

  /**
   * Get available datasets for user
   */
  async getDatasets(userId: string, filters?: any): Promise<Dataset[]> {
    try {
      const query: any = { createdBy: userId, isActive: true };
      
      if (filters?.tags) {
        query.tags = { $in: filters.tags };
      }
      
      if (filters?.qualityScore) {
        query.qualityScore = { $gte: filters.qualityScore };
      }

      const datasets = await DatasetModel.find(query)
        .sort({ updatedAt: -1 })
        .limit(filters?.limit || 50);

      return datasets.map(d => d.toObject());
    } catch (error) {
      this.logger.error('Error getting datasets:', error);
      throw new Error(`Failed to get datasets: ${error.message}`);
    }
  }

  /**
   * Get reports for user
   */
  async getReports(userId: string, filters?: any): Promise<Report[]> {
    try {
      const query: any = { createdBy: userId };
      
      if (filters?.type) {
        query.type = filters.type;
      }
      
      if (filters?.status) {
        query.status = filters.status;
      }

      const reports = await ReportModel.find(query)
        .sort({ generatedAt: -1 })
        .limit(filters?.limit || 50);

      return reports.map(r => r.toObject());
    } catch (error) {
      this.logger.error('Error getting reports:', error);
      throw new Error(`Failed to get reports: ${error.message}`);
    }
  }

  /**
   * Helper method to infer column data type
   */
  private inferColumnType(rows: any[][], columnIndex: number): string {
    const sample = rows.slice(0, 100).map(row => row[columnIndex]).filter(val => val != null);
    
    if (sample.length === 0) return 'string';

    const numericCount = sample.filter(val => !isNaN(Number(val))).length;
    const dateCount = sample.filter(val => !isNaN(Date.parse(val))).length;
    const booleanCount = sample.filter(val => 
      typeof val === 'boolean' || val === 'true' || val === 'false'
    ).length;

    const total = sample.length;
    
    if (booleanCount / total > 0.8) return 'boolean';
    if (numericCount / total > 0.8) return 'number';
    if (dateCount / total > 0.8) return 'date';
    
    return 'string';
  }

  /**
   * Helper method to calculate quality score
   */
  private calculateQualityScore(stats: any): number {
    const completeness = 1 - (stats.missingValues / (stats.rowCount * stats.columnCount));
    const uniqueness = 1 - (stats.duplicateRows / stats.rowCount);
    
    return Math.round((completeness * 0.6 + uniqueness * 0.4) * 100);
  }
}