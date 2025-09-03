import { 
  ReportData, 
  ReportType, 
  ReportParameters,
  ChartData,
  ReportSummary,
  KPIDefinition,
  KPIResult,
  DashboardConfig,
  DashboardWidget
} from '../shared/types';
import { Dataset } from '../shared/types';
import { Logger } from '../shared/utils/Logger';

export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ReportGenerator');
  }

  /**
   * Generate report based on datasets and parameters
   */
  async generateReport(
    datasets: Dataset[],
    reportType: ReportType,
    parameters: ReportParameters
  ): Promise<ReportData> {
    try {
      this.logger.info(`Generating ${reportType} report for ${datasets.length} datasets`);

      switch (reportType) {
        case ReportType.SALES:
          return await this.generateSalesReport(datasets, parameters);
        case ReportType.FINANCIAL:
          return await this.generateFinancialReport(datasets, parameters);
        case ReportType.PERFORMANCE:
          return await this.generatePerformanceReport(datasets, parameters);
        case ReportType.ANALYTICS:
          return await this.generateAnalyticsReport(datasets, parameters);
        case ReportType.CUSTOM:
          return await this.generateCustomReport(datasets, parameters);
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }
    } catch (error) {
      this.logger.error('Error generating report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Calculate KPI value
   */
  async calculateKPI(datasets: Dataset[], kpiDefinition: KPIDefinition): Promise<KPIResult> {
    try {
      this.logger.info(`Calculating KPI: ${kpiDefinition.name}`);

      // This is a simplified implementation - in practice, you'd parse the formula
      // and execute it against the actual data
      const mockValue = Math.random() * 100;
      const target = kpiDefinition.target || 100;
      const variance = ((mockValue - target) / target) * 100;

      let status: 'good' | 'warning' | 'critical' = 'good';
      if (Math.abs(variance) > 20) status = 'critical';
      else if (Math.abs(variance) > 10) status = 'warning';

      const trend = variance > 0 ? 'up' : variance < 0 ? 'down' : 'stable';

      return {
        name: kpiDefinition.name,
        value: mockValue,
        target,
        variance,
        trend,
        status,
        history: this.generateMockHistory(mockValue, 30)
      };
    } catch (error) {
      this.logger.error('Error calculating KPI:', error);
      throw new Error(`Failed to calculate KPI: ${error.message}`);
    }
  }

  /**
   * Create dashboard configuration
   */
  async createDashboard(
    title: string,
    datasets: Dataset[],
    kpis: KPIDefinition[]
  ): Promise<DashboardConfig> {
    try {
      this.logger.info(`Creating dashboard: ${title}`);

      const widgets: DashboardWidget[] = [];

      // Add KPI widgets
      kpis.forEach((kpi, index) => {
        widgets.push({
          id: `kpi-${index}`,
          type: 'kpi',
          title: kpi.name,
          position: { x: (index % 4) * 3, y: 0, width: 3, height: 2 },
          config: {
            kpiDefinition: kpi,
            showTrend: true,
            showTarget: true
          }
        });
      });

      // Add chart widgets
      datasets.forEach((dataset, index) => {
        widgets.push({
          id: `chart-${index}`,
          type: 'chart',
          title: `${dataset.name} Analysis`,
          position: { x: 0, y: 3 + index * 4, width: 6, height: 4 },
          config: {
            datasetId: dataset.id,
            chartType: 'line',
            xAxis: dataset.schema.columns[0]?.name || 'date',
            yAxis: dataset.schema.columns[1]?.name || 'value'
          }
        });
      });

      return {
        title,
        widgets,
        refreshInterval: 300000, // 5 minutes
        filters: [
          {
            name: 'dateRange',
            type: 'date',
            defaultValue: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              end: new Date()
            }
          }
        ]
      };
    } catch (error) {
      this.logger.error('Error creating dashboard:', error);
      throw new Error(`Failed to create dashboard: ${error.message}`);
    }
  }

  // Private helper methods for different report types

  private async generateSalesReport(
    datasets: Dataset[],
    parameters: ReportParameters
  ): Promise<ReportData> {
    const headers = ['Period', 'Revenue', 'Units Sold', 'Average Order Value', 'Growth Rate'];
    const rows: any[][] = [];

    // Generate mock sales data
    const periods = this.generateDatePeriods(parameters.dateRange, 'monthly');
    
    periods.forEach((period, index) => {
      const revenue = 50000 + Math.random() * 100000;
      const units = Math.floor(revenue / (50 + Math.random() * 100));
      const aov = revenue / units;
      const growth = index > 0 ? ((revenue - (rows[index - 1]?.[1] || revenue)) / (rows[index - 1]?.[1] || revenue)) * 100 : 0;

      rows.push([
        period.toISOString().split('T')[0],
        Math.round(revenue),
        units,
        Math.round(aov * 100) / 100,
        Math.round(growth * 100) / 100
      ]);
    });

    const summary: ReportSummary = {
      totalRecords: rows.length,
      keyMetrics: {
        'Total Revenue': rows.reduce((sum, row) => sum + row[1], 0),
        'Total Units': rows.reduce((sum, row) => sum + row[2], 0),
        'Average AOV': rows.reduce((sum, row) => sum + row[3], 0) / rows.length,
        'Average Growth': rows.reduce((sum, row) => sum + row[4], 0) / rows.length
      },
      insights: [
        'Revenue shows consistent growth trend',
        'Q4 typically shows highest performance',
        'Average order value has increased by 15% year-over-year'
      ]
    };

    const charts: ChartData[] = [
      {
        type: 'line',
        title: 'Revenue Trend',
        data: rows.map(row => ({ x: row[0], y: row[1] }))
      },
      {
        type: 'bar',
        title: 'Units Sold by Period',
        data: rows.map(row => ({ x: row[0], y: row[2] }))
      }
    ];

    return { headers, rows, summary, charts };
  }

  private async generateFinancialReport(
    datasets: Dataset[],
    parameters: ReportParameters
  ): Promise<ReportData> {
    const headers = ['Account', 'Opening Balance', 'Debits', 'Credits', 'Closing Balance'];
    const rows: any[][] = [
      ['Cash', 100000, 50000, 75000, 125000],
      ['Accounts Receivable', 80000, 120000, 90000, 110000],
      ['Inventory', 150000, 80000, 60000, 170000],
      ['Accounts Payable', 60000, 40000, 55000, 75000],
      ['Revenue', 0, 0, 200000, 200000],
      ['Expenses', 0, 120000, 0, 120000]
    ];

    const summary: ReportSummary = {
      totalRecords: rows.length,
      keyMetrics: {
        'Total Assets': 405000,
        'Total Liabilities': 75000,
        'Net Income': 80000,
        'Cash Flow': 25000
      },
      insights: [
        'Strong cash position with 25% increase',
        'Accounts receivable collection improved',
        'Inventory turnover within target range'
      ]
    };

    const charts: ChartData[] = [
      {
        type: 'pie',
        title: 'Asset Distribution',
        data: [
          { label: 'Cash', value: 125000 },
          { label: 'Accounts Receivable', value: 110000 },
          { label: 'Inventory', value: 170000 }
        ]
      }
    ];

    return { headers, rows, summary, charts };
  }

  private async generatePerformanceReport(
    datasets: Dataset[],
    parameters: ReportParameters
  ): Promise<ReportData> {
    const headers = ['Metric', 'Current', 'Previous', 'Change', 'Target', 'Status'];
    const rows: any[][] = [
      ['Customer Satisfaction', 4.2, 4.0, '+5%', 4.5, 'On Track'],
      ['Response Time (ms)', 250, 300, '-17%', 200, 'Needs Improvement'],
      ['Conversion Rate', 3.2, 2.8, '+14%', 3.5, 'On Track'],
      ['Churn Rate', 2.1, 2.5, '-16%', 2.0, 'Close to Target'],
      ['Monthly Active Users', 15420, 14800, '+4%', 16000, 'On Track']
    ];

    const summary: ReportSummary = {
      totalRecords: rows.length,
      keyMetrics: {
        'Metrics On Track': 3,
        'Metrics Needing Attention': 1,
        'Overall Performance Score': 85
      },
      insights: [
        'Customer satisfaction trending upward',
        'Response time needs optimization',
        'User engagement metrics are strong'
      ]
    };

    const charts: ChartData[] = [
      {
        type: 'bar',
        title: 'Performance vs Target',
        data: rows.map(row => ({
          metric: row[0],
          current: parseFloat(row[1]),
          target: parseFloat(row[4])
        }))
      }
    ];

    return { headers, rows, summary, charts };
  }

  private async generateAnalyticsReport(
    datasets: Dataset[],
    parameters: ReportParameters
  ): Promise<ReportData> {
    const headers = ['Date', 'Page Views', 'Unique Visitors', 'Bounce Rate', 'Avg Session Duration'];
    const rows: any[][] = [];

    // Generate mock analytics data
    const periods = this.generateDatePeriods(parameters.dateRange, 'daily');
    
    periods.forEach(period => {
      const pageViews = Math.floor(1000 + Math.random() * 5000);
      const uniqueVisitors = Math.floor(pageViews * (0.3 + Math.random() * 0.4));
      const bounceRate = Math.round((0.3 + Math.random() * 0.4) * 100);
      const avgDuration = Math.round((120 + Math.random() * 300) * 100) / 100;

      rows.push([
        period.toISOString().split('T')[0],
        pageViews,
        uniqueVisitors,
        bounceRate,
        avgDuration
      ]);
    });

    const summary: ReportSummary = {
      totalRecords: rows.length,
      keyMetrics: {
        'Total Page Views': rows.reduce((sum, row) => sum + row[1], 0),
        'Total Unique Visitors': rows.reduce((sum, row) => sum + row[2], 0),
        'Average Bounce Rate': rows.reduce((sum, row) => sum + row[3], 0) / rows.length,
        'Average Session Duration': rows.reduce((sum, row) => sum + row[4], 0) / rows.length
      },
      insights: [
        'Traffic shows seasonal patterns',
        'Mobile traffic accounts for 65% of visits',
        'Organic search is the top traffic source'
      ]
    };

    const charts: ChartData[] = [
      {
        type: 'line',
        title: 'Traffic Trend',
        data: rows.map(row => ({ x: row[0], y: row[1] }))
      },
      {
        type: 'line',
        title: 'Bounce Rate Trend',
        data: rows.map(row => ({ x: row[0], y: row[3] }))
      }
    ];

    return { headers, rows, summary, charts };
  }

  private async generateCustomReport(
    datasets: Dataset[],
    parameters: ReportParameters
  ): Promise<ReportData> {
    // For custom reports, we'd typically parse the parameters to determine
    // which columns to include, how to aggregate data, etc.
    
    const headers = parameters.metrics || ['Date', 'Value'];
    const rows: any[][] = [];

    // Generate sample data based on parameters
    const periods = this.generateDatePeriods(parameters.dateRange, 'daily');
    
    periods.forEach(period => {
      const row = [period.toISOString().split('T')[0]];
      
      // Add values for each metric
      for (let i = 1; i < headers.length; i++) {
        row.push(Math.round((Math.random() * 1000) * 100) / 100);
      }
      
      rows.push(row);
    });

    const summary: ReportSummary = {
      totalRecords: rows.length,
      keyMetrics: {},
      insights: ['Custom report generated based on specified parameters']
    };

    // Calculate key metrics for each column
    for (let i = 1; i < headers.length; i++) {
      const values = rows.map(row => row[i]).filter(val => typeof val === 'number');
      if (values.length > 0) {
        summary.keyMetrics[`Total ${headers[i]}`] = values.reduce((sum, val) => sum + val, 0);
        summary.keyMetrics[`Average ${headers[i]}`] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    }

    const charts: ChartData[] = [
      {
        type: 'line',
        title: 'Custom Metrics Trend',
        data: rows.map(row => ({ x: row[0], y: row[1] }))
      }
    ];

    return { headers, rows, summary, charts };
  }

  private generateDatePeriods(dateRange: { start: Date; end: Date }, frequency: 'daily' | 'weekly' | 'monthly'): Date[] {
    const periods: Date[] = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      periods.push(new Date(current));
      
      switch (frequency) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return periods;
  }

  private generateMockHistory(currentValue: number, days: number): { date: Date; value: number }[] {
    const history: { date: Date; value: number }[] = [];
    const baseValue = currentValue;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Add some random variation around the base value
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const value = baseValue * (1 + variation);
      
      history.push({ date, value: Math.round(value * 100) / 100 });
    }
    
    return history;
  }
}