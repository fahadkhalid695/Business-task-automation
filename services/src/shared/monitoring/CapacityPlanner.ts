import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

const logger = new Logger('CapacityPlanner');
const metrics = MetricsCollector.getInstance();

export interface ResourceUsageData {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  requests: number;
  activeUsers: number;
  queueLength: number;
}

export interface CapacityForecast {
  resource: 'cpu' | 'memory' | 'disk' | 'network' | 'requests';
  currentUsage: number;
  projectedUsage: number;
  timeToCapacity: number; // days
  recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_out' | 'optimize';
  confidence: number; // 0-1
  details: {
    trend: 'increasing' | 'decreasing' | 'stable';
    growthRate: number; // per day
    seasonality: boolean;
    anomalies: number;
  };
}

export interface ScalingRecommendation {
  type: 'horizontal' | 'vertical';
  resource: string;
  currentCapacity: number;
  recommendedCapacity: number;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  timeline: string;
}

export interface ResourceThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  disk: { warning: number; critical: number };
  network: { warning: number; critical: number };
  requests: { warning: number; critical: number };
}

export class CapacityPlanner {
  private static instance: CapacityPlanner;
  private usageHistory: ResourceUsageData[] = [];
  private forecasts: Map<string, CapacityForecast> = new Map();
  private thresholds: ResourceThresholds;
  private maxHistoryDays: number = 90;
  private forecastHorizonDays: number = 30;

  private constructor() {
    this.thresholds = {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 75, critical: 90 },
      disk: { warning: 80, critical: 95 },
      network: { warning: 70, critical: 85 },
      requests: { warning: 1000, critical: 1500 }
    };

    this.startDataCollection();
    this.startForecastGeneration();
  }

  static getInstance(): CapacityPlanner {
    if (!CapacityPlanner.instance) {
      CapacityPlanner.instance = new CapacityPlanner();
    }
    return CapacityPlanner.instance;
  }

  private startDataCollection(): void {
    // Collect resource usage data every 5 minutes
    setInterval(() => {
      this.collectResourceUsage();
    }, 5 * 60 * 1000);

    // Initial collection
    this.collectResourceUsage();
  }

  private startForecastGeneration(): void {
    // Generate forecasts every hour
    setInterval(() => {
      this.generateForecasts();
    }, 60 * 60 * 1000);

    // Initial forecast generation after 10 minutes (to have some data)
    setTimeout(() => {
      this.generateForecasts();
    }, 10 * 60 * 1000);
  }

  private async collectResourceUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get additional metrics from the metrics collector
      const metricsData = metrics.getMetrics();
      
      const usageData: ResourceUsageData = {
        timestamp: new Date(),
        cpu: this.calculateCpuUsage(cpuUsage),
        memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        disk: await this.getDiskUsage(),
        network: await this.getNetworkUsage(),
        requests: this.getRequestCount(),
        activeUsers: this.getActiveUserCount(),
        queueLength: this.getQueueLength()
      };

      this.usageHistory.push(usageData);

      // Keep only data from the last maxHistoryDays
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxHistoryDays);
      this.usageHistory = this.usageHistory.filter(data => data.timestamp >= cutoffDate);

      // Record metrics
      metrics.setGauge('capacity_cpu_usage_percent', usageData.cpu);
      metrics.setGauge('capacity_memory_usage_percent', usageData.memory);
      metrics.setGauge('capacity_disk_usage_percent', usageData.disk);
      metrics.setGauge('capacity_network_usage_percent', usageData.network);
      metrics.setGauge('capacity_active_requests', usageData.requests);
      metrics.setGauge('capacity_active_users', usageData.activeUsers);
      metrics.setGauge('capacity_queue_length', usageData.queueLength);

      // Check thresholds
      this.checkThresholds(usageData);

    } catch (error) {
      logger.error('Failed to collect resource usage data', error);
    }
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU usage calculation
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / 1000000) / 5000 * 100); // Approximate percentage
  }

  private async getDiskUsage(): Promise<number> {
    // In a real implementation, you'd check actual disk usage
    // For now, simulate based on memory usage as a proxy
    const memUsage = process.memoryUsage();
    return Math.min(100, (memUsage.external / (1024 * 1024 * 1024)) * 10); // Rough approximation
  }

  private async getNetworkUsage(): Promise<number> {
    // In a real implementation, you'd monitor network I/O
    // For now, simulate based on request patterns
    return Math.random() * 50 + 10; // 10-60% usage
  }

  private getRequestCount(): number {
    const metricsData = metrics.getMetrics();
    return metricsData.counters['http_requests_total'] || 0;
  }

  private getActiveUserCount(): number {
    const metricsData = metrics.getMetrics();
    return metricsData.gauges['active_users'] || 0;
  }

  private getQueueLength(): number {
    const metricsData = metrics.getMetrics();
    return metricsData.gauges['queue_length'] || 0;
  }

  private checkThresholds(data: ResourceUsageData): void {
    const checks = [
      { name: 'cpu', value: data.cpu, thresholds: this.thresholds.cpu },
      { name: 'memory', value: data.memory, thresholds: this.thresholds.memory },
      { name: 'disk', value: data.disk, thresholds: this.thresholds.disk },
      { name: 'network', value: data.network, thresholds: this.thresholds.network }
    ];


for (const check of checks) {
  if (check.value >= check.thresholds.critical) {
    // Critical usage detected
    logger.security(`Critical ${check.name} usage detected`, 'critical', {
      resource: check.name,
      usage: check.value,
      threshold: check.thresholds.critical
    });

    // Increment the counter for critical violations
    metrics.incrementCounter('capacity_threshold_violations_total', 1, {
      resource: check.name,
      severity: 'critical'
    });
  } else if (check.value >= check.thresholds.warning) {
    // High usage (warning) detected
    logger.warn(`High ${check.name} usage detected`, {
      resource: check.name,
      usage: check.value,
      threshold: check.thresholds.warning
    });

    // Increment the counter for warning violations
    metrics.incrementCounter('capacity_threshold_violations_total', 1, {
      resource: check.name,
      severity: 'warning'
    });
  } else {
    // Usage is within safe limits
    logger.info(`${check.name} usage is normal`, {
      resource: check.name,
      usage: check.value,
      threshold: check.thresholds.warning
    });
  }
}  // This closing brace is necessary to close the 'for' loop
