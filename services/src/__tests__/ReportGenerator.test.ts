import { ReportGenerator } from '../data-analytics-service/ReportGenerator';
import { ReportType } from '../shared/types';
import { Dataset } from '../shared/types';

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;

  const mockDataset: Dataset = {
    id: 'dataset123',
    name: 'Sales Data',
    description: 'Monthly sales data',
    source: {
      type: 'file',
      location: '/tmp/sales.csv'
    },
    schema: {
      columns: [
        { name: 'date', type: 'date', nullable: false, unique: false },
        { name: 'revenue', type: 'number', nullable: false, unique: false },
        { name: 'units', type: 'number', nullable: false, unique: false }
      ]
    },
    qualityScore: 85,
    rowCount: 100,
    columnCount: 3,
    lastCleaned: new Date(),
    tags: ['sales', 'monthly'],
    createdBy: 'user123',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockReportParameters = {
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    },
    filters: [],
    metrics: ['revenue', 'units']
  };

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  describe('generateReport', () => {
    it('should generate sales report successfully', async () => {
      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.SALES,
        mockReportParameters
      );

      // Assert
      expect(result.headers).toEqual(['Period', 'Revenue', 'Units Sold', 'Average Order Value', 'Growth Rate']);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRecords).toBeGreaterThan(0);
      expect(result.summary.keyMetrics).toBeDefined();
      expect(result.summary.insights).toBeInstanceOf(Array);
      expect(result.charts).toBeInstanceOf(Array);
      expect(result.charts.length).toBeGreaterThan(0);
    });

    it('should generate financial report successfully', async () => {
      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.FINANCIAL,
        mockReportParameters
      );

      // Assert
      expect(result.headers).toEqual(['Account', 'Opening Balance', 'Debits', 'Credits', 'Closing Balance']);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.keyMetrics).toHaveProperty('Total Assets');
      expect(result.summary.keyMetrics).toHaveProperty('Total Liabilities');
      expect(result.charts).toBeInstanceOf(Array);
    });

    it('should generate performance report successfully', async () => {
      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.PERFORMANCE,
        mockReportParameters
      );

      // Assert
      expect(result.headers).toEqual(['Metric', 'Current', 'Previous', 'Change', 'Target', 'Status']);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.keyMetrics).toHaveProperty('Overall Performance Score');
      expect(result.charts).toBeInstanceOf(Array);
    });

    it('should generate analytics report successfully', async () => {
      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.ANALYTICS,
        mockReportParameters
      );

      // Assert
      expect(result.headers).toEqual(['Date', 'Page Views', 'Unique Visitors', 'Bounce Rate', 'Avg Session Duration']);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.keyMetrics).toHaveProperty('Total Page Views');
      expect(result.charts).toBeInstanceOf(Array);
    });

    it('should generate custom report successfully', async () => {
      // Arrange
      const customParameters = {
        ...mockReportParameters,
        metrics: ['custom_metric1', 'custom_metric2']
      };

      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.CUSTOM,
        customParameters
      );

      // Assert
      expect(result.headers).toEqual(['Date', 'custom_metric1', 'custom_metric2']);
      expect(result.rows).toBeInstanceOf(Array);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.charts).toBeInstanceOf(Array);
    });

    it('should handle unsupported report type', async () => {
      // Act & Assert
      await expect(reportGenerator.generateReport(
        [mockDataset],
        'UNSUPPORTED' as ReportType,
        mockReportParameters
      )).rejects.toThrow('Failed to generate report: Unsupported report type: UNSUPPORTED');
    });

    it('should handle empty datasets', async () => {
      // Act
      const result = await reportGenerator.generateReport(
        [],
        ReportType.SALES,
        mockReportParameters
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.rows).toBeInstanceOf(Array);
    });
  });

  describe('calculateKPI', () => {
    it('should calculate KPI successfully', async () => {
      // Arrange
      const kpiDefinition = {
        name: 'Revenue Growth',
        description: 'Monthly revenue growth rate',
        formula: 'SUM(revenue)',
        target: 100000,
        unit: 'USD',
        category: 'Financial'
      };

      // Act
      const result = await reportGenerator.calculateKPI([mockDataset], kpiDefinition);

      // Assert
      expect(result.name).toBe('Revenue Growth');
      expect(result.value).toBeGreaterThan(0);
      expect(result.target).toBe(100000);
      expect(result.variance).toBeDefined();
      expect(result.trend).toMatch(/^(up|down|stable)$/);
      expect(result.status).toMatch(/^(good|warning|critical)$/);
      expect(result.history).toBeInstanceOf(Array);
      expect(result.history?.length).toBeGreaterThan(0);
    });

    it('should calculate KPI without target', async () => {
      // Arrange
      const kpiDefinition = {
        name: 'Total Sales',
        description: 'Total sales amount',
        formula: 'SUM(revenue)',
        category: 'Sales'
      };

      // Act
      const result = await reportGenerator.calculateKPI([mockDataset], kpiDefinition);

      // Assert
      expect(result.name).toBe('Total Sales');
      expect(result.value).toBeGreaterThan(0);
      expect(result.target).toBe(100); // default target
      expect(result.variance).toBeDefined();
    });

    it('should handle KPI calculation errors', async () => {
      // Arrange
      const invalidKpiDefinition = null as any;

      // Act & Assert
      await expect(reportGenerator.calculateKPI([mockDataset], invalidKpiDefinition))
        .rejects.toThrow('Failed to calculate KPI');
    });
  });

  describe('createDashboard', () => {
    it('should create dashboard successfully', async () => {
      // Arrange
      const title = 'Sales Dashboard';
      const kpis = [
        {
          name: 'Revenue',
          description: 'Total revenue',
          formula: 'SUM(revenue)',
          category: 'Financial'
        },
        {
          name: 'Units Sold',
          description: 'Total units sold',
          formula: 'SUM(units)',
          category: 'Sales'
        }
      ];

      // Act
      const result = await reportGenerator.createDashboard(title, [mockDataset], kpis);

      // Assert
      expect(result.title).toBe('Sales Dashboard');
      expect(result.widgets).toBeInstanceOf(Array);
      expect(result.widgets.length).toBeGreaterThan(0);
      expect(result.refreshInterval).toBe(300000); // 5 minutes
      expect(result.filters).toBeInstanceOf(Array);
      expect(result.filters.length).toBeGreaterThan(0);

      // Check KPI widgets
      const kpiWidgets = result.widgets.filter(w => w.type === 'kpi');
      expect(kpiWidgets.length).toBe(kpis.length);
      expect(kpiWidgets[0].title).toBe('Revenue');
      expect(kpiWidgets[0].config.showTrend).toBe(true);

      // Check chart widgets
      const chartWidgets = result.widgets.filter(w => w.type === 'chart');
      expect(chartWidgets.length).toBe(1);
      expect(chartWidgets[0].title).toBe('Sales Data Analysis');
      expect(chartWidgets[0].config.datasetId).toBe(mockDataset.id);
    });

    it('should create dashboard with multiple datasets', async () => {
      // Arrange
      const title = 'Multi-Dataset Dashboard';
      const datasets = [
        mockDataset,
        {
          ...mockDataset,
          id: 'dataset456',
          name: 'Marketing Data'
        }
      ];
      const kpis = [
        {
          name: 'Conversion Rate',
          description: 'Marketing conversion rate',
          formula: 'AVG(conversion)',
          category: 'Marketing'
        }
      ];

      // Act
      const result = await reportGenerator.createDashboard(title, datasets, kpis);

      // Assert
      expect(result.title).toBe('Multi-Dataset Dashboard');
      expect(result.widgets.length).toBeGreaterThan(2); // At least 1 KPI + 2 chart widgets
      
      const chartWidgets = result.widgets.filter(w => w.type === 'chart');
      expect(chartWidgets.length).toBe(2);
      expect(chartWidgets[0].config.datasetId).toBe('dataset123');
      expect(chartWidgets[1].config.datasetId).toBe('dataset456');
    });

    it('should create dashboard with no KPIs', async () => {
      // Arrange
      const title = 'Simple Dashboard';

      // Act
      const result = await reportGenerator.createDashboard(title, [mockDataset], []);

      // Assert
      expect(result.title).toBe('Simple Dashboard');
      expect(result.widgets).toBeInstanceOf(Array);
      
      const kpiWidgets = result.widgets.filter(w => w.type === 'kpi');
      expect(kpiWidgets.length).toBe(0);
      
      const chartWidgets = result.widgets.filter(w => w.type === 'chart');
      expect(chartWidgets.length).toBe(1);
    });

    it('should handle dashboard creation errors', async () => {
      // Arrange
      const invalidTitle = null as any;

      // Act & Assert
      await expect(reportGenerator.createDashboard(invalidTitle, [mockDataset], []))
        .rejects.toThrow('Failed to create dashboard');
    });
  });

  describe('private helper methods', () => {
    it('should generate date periods correctly', async () => {
      // This tests the private generateDatePeriods method indirectly through report generation
      const shortDateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-03')
      };

      const parameters = {
        ...mockReportParameters,
        dateRange: shortDateRange
      };

      // Act
      const result = await reportGenerator.generateReport(
        [mockDataset],
        ReportType.ANALYTICS,
        parameters
      );

      // Assert
      expect(result.rows.length).toBe(3); // 3 days
      expect(result.rows[0][0]).toBe('2024-01-01');
      expect(result.rows[2][0]).toBe('2024-01-03');
    });

    it('should generate mock history data', async () => {
      // This tests the private generateMockHistory method indirectly through KPI calculation
      const kpiDefinition = {
        name: 'Test KPI',
        description: 'Test KPI description',
        formula: 'COUNT(*)',
        category: 'Test'
      };

      // Act
      const result = await reportGenerator.calculateKPI([mockDataset], kpiDefinition);

      // Assert
      expect(result.history).toBeInstanceOf(Array);
      expect(result.history?.length).toBeGreaterThan(0);
      
      if (result.history && result.history.length > 0) {
        expect(result.history[0]).toHaveProperty('date');
        expect(result.history[0]).toHaveProperty('value');
        expect(result.history[0].date).toBeInstanceOf(Date);
        expect(typeof result.history[0].value).toBe('number');
      }
    });
  });
});