import { Logger } from './logger';
import { performance } from 'perf_hooks';

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

export interface BusinessMetrics {
  tasksCompleted: number;
  tasksCreated: number;
  userSatisfactionScore: number;
  workflowEfficiency: number;
  systemUptime: number;
}

export interface AlertRule {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration: number; // in milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, MetricValue[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private logger: Logger;
  private alertRules: AlertRule[] = [];
  private alertStates: Map<string, { triggered: boolean; since: Date }> = new Map();

  private constructor() {
    this.logger = new Logger('MetricsCollector');
    this.setupDefaultAlerts();
    this.startMetricsCollection();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Counter metrics (monotonically increasing)
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.recordMetric(key, current + value, labels);
  }

  // Gauge metrics (can go up or down)
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric(key, value, labels);
  }

  // Histogram metrics (for measuring distributions)
  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(key, values);
    this.recordMetric(key, value, labels);
  }

  // Timer utility for measuring execution time
  startTimer(name: string, labels?: Record<string, string>) {
    const startTime = performance.now();
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.recordHistogram(`${name}_duration_ms`, duration, labels);
        return duration;
      }
    };
  }

  private recordMetric(name: string, value: number, labels?: Record<string, string>) {
    const metrics = this.metrics.get(name) || [];
    metrics.push({
      value,
      timestamp: new Date(),
      labels
    });

    // Keep only last 1000 data points per metric
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.metrics.set(name, metrics);
    this.checkAlerts(name, value);
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  // Performance monitoring
  recordResponseTime(endpoint: string, method: string, statusCode: number, duration: number) {
    this.recordHistogram('http_request_duration_ms', duration, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    this.incrementCounter('http_requests_total', 1, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, {
        endpoint,
        method,
        status_code: statusCode.toString()
      });
    }
  }

  // Business metrics
  recordTaskCompletion(taskType: string, success: boolean, duration: number) {
    this.incrementCounter('tasks_completed_total', 1, {
      task_type: taskType,
      success: success.toString()
    });

    this.recordHistogram('task_duration_ms', duration, {
      task_type: taskType
    });

    if (success) {
      this.incrementCounter('tasks_successful_total', 1, { task_type: taskType });
    } else {
      this.incrementCounter('tasks_failed_total', 1, { task_type: taskType });
    }
  }

  recordUserSatisfaction(score: number, feature: string) {
    this.recordHistogram('user_satisfaction_score', score, { feature });
  }

  recordSystemResource(type: 'cpu' | 'memory' | 'disk', usage: number) {
    this.setGauge(`system_${type}_usage_percent`, usage);
  }

  // Alert management
  addAlertRule(rule: AlertRule) {
    this.alertRules.push(rule);
    this.logger.info(`Added alert rule for metric: ${rule.metric}`, { rule });
  }

  private checkAlerts(metricName: string, value: number) {
    const relevantRules = this.alertRules.filter(rule => rule.metric === metricName);
    
    for (const rule of relevantRules) {
      const shouldTrigger = this.evaluateAlertCondition(rule, value);
      const alertKey = `${rule.metric}_${rule.threshold}_${rule.operator}`;
      const currentState = this.alertStates.get(alertKey);

      if (shouldTrigger && !currentState?.triggered) {
        this.triggerAlert(rule, value);
        this.alertStates.set(alertKey, { triggered: true, since: new Date() });
      } else if (!shouldTrigger && currentState?.triggered) {
        this.resolveAlert(rule, value);
        this.alertStates.set(alertKey, { triggered: false, since: new Date() });
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'lte': return value <= rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number) {
    this.logger.security(`Alert triggered: ${rule.description}`, rule.severity, {
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: value,
      operator: rule.operator
    });

    // Increment alert counter
    this.incrementCounter('alerts_triggered_total', 1, {
      metric: rule.metric,
      severity: rule.severity
    });
  }

  private resolveAlert(rule: AlertRule, value: number) {
    this.logger.info(`Alert resolved: ${rule.description}`, {
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: value
    });

    this.incrementCounter('alerts_resolved_total', 1, {
      metric: rule.metric,
      severity: rule.severity
    });
  }

  private setupDefaultAlerts() {
    // Performance alerts
    this.addAlertRule({
      metric: 'http_request_duration_ms',
      threshold: 5000,
      operator: 'gt',
      duration: 60000,
      severity: 'medium',
      description: 'HTTP response time exceeds 5 seconds'
    });

    this.addAlertRule({
      metric: 'system_memory_usage_percent',
      threshold: 85,
      operator: 'gt',
      duration: 300000,
      severity: 'high',
      description: 'Memory usage exceeds 85%'
    });

    this.addAlertRule({
      metric: 'system_cpu_usage_percent',
      threshold: 90,
      operator: 'gt',
      duration: 300000,
      severity: 'high',
      description: 'CPU usage exceeds 90%'
    });

    // Error rate alerts
    this.addAlertRule({
      metric: 'http_errors_total',
      threshold: 10,
      operator: 'gt',
      duration: 60000,
      severity: 'medium',
      description: 'High error rate detected'
    });
  }

  private startMetricsCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Calculate derived metrics every minute
    setInterval(() => {
      this.calculateDerivedMetrics();
    }, 60000);
  }

  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    this.setGauge('system_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('system_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('system_memory_usage_percent', memUsagePercent);
    
    // CPU usage would require additional libraries in production
    // For now, we'll simulate it based on memory pressure
    const cpuUsageEstimate = Math.min(memUsagePercent * 1.2, 100);
    this.setGauge('system_cpu_usage_percent', cpuUsageEstimate);
  }

  private calculateDerivedMetrics() {
    // Calculate error rates
    const totalRequests = this.counters.get('http_requests_total') || 0;
    const totalErrors = this.counters.get('http_errors_total') || 0;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    this.setGauge('http_error_rate_percent', errorRate);

    // Calculate task success rate
    const successfulTasks = this.counters.get('tasks_successful_total') || 0;
    const totalTasks = this.counters.get('tasks_completed_total') || 0;
    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;
    
    this.setGauge('task_success_rate_percent', successRate);
  }

  // Export metrics for monitoring systems
  getMetrics(): Record<string, any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: this.getHistogramStats(),
      recentMetrics: this.getRecentMetrics(oneHourAgo),
      alerts: {
        active: Array.from(this.alertStates.entries())
          .filter(([, state]) => state.triggered)
          .map(([key, state]) => ({ key, since: state.since })),
        rules: this.alertRules
      }
    };
  }

  private getHistogramStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, values] of this.histograms) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      stats[name] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }
    
    return stats;
  }

  private getRecentMetrics(since: Date): Record<string, MetricValue[]> {
    const recent: Record<string, MetricValue[]> = {};
    
    for (const [name, values] of this.metrics) {
      recent[name] = values.filter(v => v.timestamp >= since);
    }
    
    return recent;
  }
}