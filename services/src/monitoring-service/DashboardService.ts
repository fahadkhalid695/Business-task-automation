import { IDashboardService } from './interfaces';
import { DashboardConfig, DashboardWidget } from './types';
import { Logger } from '../shared/utils/Logger';
import { DatabaseService } from '../shared/database/DatabaseService';
import { MetricsCollector } from './MetricsCollector';
import { AlertManager } from './AlertManager';
import { v4 as uuidv4 } from 'uuid';

export class DashboardService implements IDashboardService {
  private logger = Logger.getInstance();
  private db = DatabaseService.getInstance();
  private metricsCollector = new MetricsCollector();
  private alertManager = new AlertManager();

  async createDashboard(config: Omit<DashboardConfig, 'id'>): Promise<DashboardConfig> {
    try {
      const dashboard: DashboardConfig = {
        ...config,
        id: uuidv4()
      };

      const collection = this.db.getCollection('dashboards');
      await collection.insertOne(dashboard);

      this.logger.info(`Dashboard created: ${dashboard.name}`);
      return dashboard;
    } catch (error) {
      this.logger.error('Error creating dashboard:', error);
      throw error;
    }
  }

  async updateDashboard(id: string, config: Partial<DashboardConfig>): Promise<DashboardConfig> {
    try {
      const collection = this.db.getCollection('dashboards');
      const result = await collection.findOneAndUpdate(
        { id },
        { $set: config },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error(`Dashboard not found: ${id}`);
      }

      this.logger.info(`Dashboard updated: ${id}`);
      return result.value as DashboardConfig;
    } catch (error) {
      this.logger.error('Error updating dashboard:', error);
      throw error;
    }
  }

  async deleteDashboard(id: string): Promise<void> {
    try {
      const collection = this.db.getCollection('dashboards');
      const result = await collection.deleteOne({ id });

      if (result.deletedCount === 0) {
        throw new Error(`Dashboard not found: ${id}`);
      }

      this.logger.info(`Dashboard deleted: ${id}`);
    } catch (error) {
      this.logger.error('Error deleting dashboard:', error);
      throw error;
    }
  }

  async getDashboard(id: string): Promise<DashboardConfig> {
    try {
      const collection = this.db.getCollection('dashboards');
      const dashboard = await collection.findOne({ id }) as DashboardConfig;

      if (!dashboard) {
        throw new Error(`Dashboard not found: ${id}`);
      }

      return dashboard;
    } catch (error) {
      this.logger.error('Error getting dashboard:', error);
      throw error;
    }
  }

  async getDashboards(userId: string): Promise<DashboardConfig[]> {
    try {
      const collection = this.db.getCollection('dashboards');
      return await collection.find({
        $or: [
          { permissions: { $in: [userId, 'public'] } },
          { permissions: { $exists: false } }
        ]
      }).toArray() as DashboardConfig[];
    } catch (error) {
      this.logger.error('Error getting dashboards:', error);
      throw error;
    }
  }

  async executeQuery(query: string): Promise<any> {
    try {
      const parsedQuery = this.parseQuery(query);
      
      switch (parsedQuery.type) {
        case 'metrics':
          return await this.executeMetricsQuery(parsedQuery);
        case 'alerts':
          return await this.executeAlertsQuery(parsedQuery);
        case 'business':
          return await this.executeBusinessQuery(parsedQuery);
        case 'performance':
          return await this.executePerformanceQuery(parsedQuery);
        default:
          throw new Error(`Unsupported query type: ${parsedQuery.type}`);
      }
    } catch (error) {
      this.logger.error('Error executing query:', error);
      throw error;
    }
  }

  async getWidgetData(widgetId: string): Promise<any> {
    try {
      // Find the widget in all dashboards
      const collection = this.db.getCollection('dashboards');
      const dashboards = await collection.find({
        'widgets.id': widgetId
      }).toArray() as DashboardConfig[];

      if (dashboards.length === 0) {
        throw new Error(`Widget not found: ${widgetId}`);
      }

      const dashboard = dashboards[0];
      const widget = dashboard.widgets.find(w => w.id === widgetId);

      if (!widget) {
        throw new Error(`Widget not found: ${widgetId}`);
      }

      // Execute the widget's query
      const data = await this.executeQuery(widget.query);

      // Apply widget-specific formatting
      return this.formatWidgetData(widget, data);
    } catch (error) {
      this.logger.error('Error getting widget data:', error);
      throw error;
    }
  }

  private parseQuery(query: string): any {
    try {
      // Simple query parser - in production, use a proper query language
      const parts = query.split(' ');
      const type = parts[0].toLowerCase();
      
      const parsedQuery = {
        type,
        filters: {},
        timeRange: {},
        aggregation: null,
        groupBy: null
      };

      // Parse time range
      const timeRangeMatch = query.match(/time_range\(([^)]+)\)/);
      if (timeRangeMatch) {
        const [start, end] = timeRangeMatch[1].split(',');
        parsedQuery.timeRange = {
          start: new Date(start.trim()),
          end: new Date(end.trim())
        };
      }

      // Parse filters
      const filterMatches = query.match(/where\s+(.+?)(?:\s+group_by|\s+time_range|$)/i);
      if (filterMatches) {
        const filterStr = filterMatches[1];
        const filters = filterStr.split(' and ');
        
        filters.forEach(filter => {
          const [key, operator, value] = filter.trim().split(/\s*(=|!=|>|<|>=|<=)\s*/);
          parsedQuery.filters[key] = {
            operator,
            value: isNaN(Number(value)) ? value.replace(/['"]/g, '') : Number(value)
          };
        });
      }

      // Parse aggregation
      const aggMatch = query.match(/(avg|sum|count|min|max)\(([^)]+)\)/);
      if (aggMatch) {
        parsedQuery.aggregation = {
          function: aggMatch[1],
          field: aggMatch[2]
        };
      }

      // Parse group by
      const groupByMatch = query.match(/group_by\s+(.+?)(?:\s+time_range|$)/i);
      if (groupByMatch) {
        parsedQuery.groupBy = groupByMatch[1].trim();
      }

      return parsedQuery;
    } catch (error) {
      this.logger.error('Error parsing query:', error);
      throw new Error(`Invalid query syntax: ${query}`);
    }
  }

  private async executeMetricsQuery(query: any): Promise<any> {
    const collection = this.db.getCollection('metrics');
    
    // Build MongoDB query
    const mongoQuery: any = {};
    
    // Apply filters
    Object.entries(query.filters).forEach(([key, filter]: [string, any]) => {
      switch (filter.operator) {
        case '=':
          mongoQuery[key] = filter.value;
          break;
        case '!=':
          mongoQuery[key] = { $ne: filter.value };
          break;
        case '>':
          mongoQuery[key] = { $gt: filter.value };
          break;
        case '<':
          mongoQuery[key] = { $lt: filter.value };
          break;
        case '>=':
          mongoQuery[key] = { $gte: filter.value };
          break;
        case '<=':
          mongoQuery[key] = { $lte: filter.value };
          break;
      }
    });

    // Apply time range
    if (query.timeRange.start && query.timeRange.end) {
      mongoQuery.timestamp = {
        $gte: query.timeRange.start,
        $lte: query.timeRange.end
      };
    }

    // Execute query with aggregation
    if (query.aggregation || query.groupBy) {
      const pipeline: any[] = [{ $match: mongoQuery }];

      if (query.groupBy) {
        const groupStage: any = {
          _id: `$${query.groupBy}`
        };

        if (query.aggregation) {
          const aggFunction = `$${query.aggregation.function}`;
          groupStage[query.aggregation.function] = {};
          groupStage[query.aggregation.function][aggFunction] = `$${query.aggregation.field}`;
        } else {
          groupStage.count = { $sum: 1 };
        }

        pipeline.push({ $group: groupStage });
      } else if (query.aggregation) {
        const groupStage: any = {
          _id: null
        };
        const aggFunction = `$${query.aggregation.function}`;
        groupStage[query.aggregation.function] = {};
        groupStage[query.aggregation.function][aggFunction] = `$${query.aggregation.field}`;
        
        pipeline.push({ $group: groupStage });
      }

      return await collection.aggregate(pipeline).toArray();
    } else {
      return await collection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
    }
  }

  private async executeAlertsQuery(query: any): Promise<any> {
    const alerts = await this.alertManager.getActiveAlerts();
    
    // Apply filters
    let filteredAlerts = alerts;
    
    Object.entries(query.filters).forEach(([key, filter]: [string, any]) => {
      filteredAlerts = filteredAlerts.filter(alert => {
        const value = (alert as any)[key];
        
        switch (filter.operator) {
          case '=':
            return value === filter.value;
          case '!=':
            return value !== filter.value;
          case '>':
            return value > filter.value;
          case '<':
            return value < filter.value;
          case '>=':
            return value >= filter.value;
          case '<=':
            return value <= filter.value;
          default:
            return true;
        }
      });
    });

    return filteredAlerts;
  }

  private async executeBusinessQuery(query: any): Promise<any> {
    const collection = this.db.getCollection('business_metrics');
    
    // Similar to metrics query but for business metrics
    const mongoQuery: any = {};
    
    Object.entries(query.filters).forEach(([key, filter]: [string, any]) => {
      switch (filter.operator) {
        case '=':
          mongoQuery[key] = filter.value;
          break;
        case '!=':
          mongoQuery[key] = { $ne: filter.value };
          break;
        case '>':
          mongoQuery[key] = { $gt: filter.value };
          break;
        case '<':
          mongoQuery[key] = { $lt: filter.value };
          break;
        case '>=':
          mongoQuery[key] = { $gte: filter.value };
          break;
        case '<=':
          mongoQuery[key] = { $lte: filter.value };
          break;
      }
    });

    if (query.timeRange.start && query.timeRange.end) {
      mongoQuery.timestamp = {
        $gte: query.timeRange.start,
        $lte: query.timeRange.end
      };
    }

    return await collection.find(mongoQuery).sort({ timestamp: -1 }).limit(1000).toArray();
  }

  private async executePerformanceQuery(query: any): Promise<any> {
    const service = query.filters.service?.value || 'api-gateway';
    return await this.metricsCollector.collectPerformanceMetrics(service);
  }

  private formatWidgetData(widget: DashboardWidget, data: any): any {
    switch (widget.type) {
      case 'chart':
        return this.formatChartData(widget, data);
      case 'metric':
        return this.formatMetricData(widget, data);
      case 'table':
        return this.formatTableData(widget, data);
      case 'alert':
        return this.formatAlertData(widget, data);
      default:
        return data;
    }
  }

  private formatChartData(widget: DashboardWidget, data: any): any {
    const config = widget.config;
    
    if (Array.isArray(data)) {
      return {
        labels: data.map(item => item._id || item.timestamp),
        datasets: [{
          label: widget.title,
          data: data.map(item => item.value || item.count || item[config.valueField]),
          backgroundColor: config.backgroundColor || 'rgba(54, 162, 235, 0.2)',
          borderColor: config.borderColor || 'rgba(54, 162, 235, 1)',
          borderWidth: config.borderWidth || 1
        }]
      };
    }

    return data;
  }

  private formatMetricData(widget: DashboardWidget, data: any): any {
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[0];
      return {
        value: latest.value || latest.count,
        unit: widget.config.unit || '',
        trend: this.calculateTrend(data),
        timestamp: latest.timestamp
      };
    }

    return {
      value: 0,
      unit: widget.config.unit || '',
      trend: 0,
      timestamp: new Date()
    };
  }

  private formatTableData(widget: DashboardWidget, data: any): any {
    if (!Array.isArray(data)) {
      return { rows: [], columns: [] };
    }

    const columns = widget.config.columns || Object.keys(data[0] || {});
    const rows = data.map(item => 
      columns.map(col => item[col])
    );

    return {
      columns,
      rows
    };
  }

  private formatAlertData(widget: DashboardWidget, data: any): any {
    if (!Array.isArray(data)) {
      return { alerts: [], summary: {} };
    }

    const summary = data.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    return {
      alerts: data.slice(0, widget.config.maxAlerts || 10),
      summary
    };
  }

  private calculateTrend(data: any[]): number {
    if (data.length < 2) return 0;

    const current = data[0].value || data[0].count;
    const previous = data[1].value || data[1].count;

    if (previous === 0) return 0;

    return ((current - previous) / previous) * 100;
  }

  // Predefined dashboard templates
  async createSystemOverviewDashboard(): Promise<DashboardConfig> {
    const dashboard = await this.createDashboard({
      name: 'System Overview',
      description: 'High-level system health and performance metrics',
      widgets: [
        {
          id: uuidv4(),
          type: 'metric',
          title: 'CPU Usage',
          query: 'metrics where name = system.cpu.usage',
          config: { unit: '%', threshold: 80 },
          position: { x: 0, y: 0, width: 3, height: 2 }
        },
        {
          id: uuidv4(),
          type: 'metric',
          title: 'Memory Usage',
          query: 'metrics where name = system.memory.usage',
          config: { unit: '%', threshold: 85 },
          position: { x: 3, y: 0, width: 3, height: 2 }
        },
        {
          id: uuidv4(),
          type: 'chart',
          title: 'Response Time Trend',
          query: 'metrics where name = http.response_time time_range(24h)',
          config: { chartType: 'line' },
          position: { x: 0, y: 2, width: 6, height: 4 }
        },
        {
          id: uuidv4(),
          type: 'alert',
          title: 'Active Alerts',
          query: 'alerts where status = active',
          config: { maxAlerts: 5 },
          position: { x: 6, y: 0, width: 6, height: 6 }
        }
      ],
      layout: {
        columns: 12,
        rows: 8,
        responsive: true
      },
      refreshInterval: 30,
      permissions: ['admin', 'operator']
    });

    return dashboard;
  }

  async createBusinessMetricsDashboard(): Promise<DashboardConfig> {
    const dashboard = await this.createDashboard({
      name: 'Business Metrics',
      description: 'Key business performance indicators and analytics',
      widgets: [
        {
          id: uuidv4(),
          type: 'metric',
          title: 'Task Completion Rate',
          query: 'business where name = business.task.completion_rate',
          config: { unit: '%', target: 95 },
          position: { x: 0, y: 0, width: 3, height: 2 }
        },
        {
          id: uuidv4(),
          type: 'metric',
          title: 'User Satisfaction',
          query: 'business where name = business.user.satisfaction_score',
          config: { unit: '/5', target: 4.5 },
          position: { x: 3, y: 0, width: 3, height: 2 }
        },
        {
          id: uuidv4(),
          type: 'chart',
          title: 'Daily Task Volume',
          query: 'business where category = productivity group_by date',
          config: { chartType: 'bar' },
          position: { x: 0, y: 2, width: 6, height: 4 }
        },
        {
          id: uuidv4(),
          type: 'table',
          title: 'Top Workflows',
          query: 'business where category = efficiency',
          config: { columns: ['name', 'executions', 'success_rate'] },
          position: { x: 6, y: 0, width: 6, height: 6 }
        }
      ],
      layout: {
        columns: 12,
        rows: 8,
        responsive: true
      },
      refreshInterval: 60,
      permissions: ['admin', 'manager', 'analyst']
    });

    return dashboard;
  }
}