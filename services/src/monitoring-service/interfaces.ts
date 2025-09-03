import {
  Metric,
  BusinessMetric,
  Alert,
  SystemHealth,
  PerformanceMetrics,
  UserBehaviorMetrics,
  CostMetrics,
  CapacityMetrics,
  DashboardConfig,
  AlertSeverity
} from './types';

export interface IMetricsCollector {
  collectSystemMetrics(): Promise<Metric[]>;
  collectBusinessMetrics(): Promise<BusinessMetric[]>;
  collectPerformanceMetrics(service: string): Promise<PerformanceMetrics>;
  collectUserBehaviorMetrics(): Promise<UserBehaviorMetrics>;
  collectCostMetrics(): Promise<CostMetrics>;
  collectCapacityMetrics(): Promise<CapacityMetrics>;
  recordCustomMetric(metric: Metric): Promise<void>;
}

export interface IAlertManager {
  createAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert>;
  updateAlert(id: string, updates: Partial<Alert>): Promise<Alert>;
  resolveAlert(id: string, resolvedBy: string): Promise<void>;
  acknowledgeAlert(id: string, acknowledgedBy: string): Promise<void>;
  escalateAlert(id: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  getAlertHistory(timeRange: { start: Date; end: Date }): Promise<Alert[]>;
  evaluateAlertConditions(): Promise<void>;
}

export interface IDashboardService {
  createDashboard(config: Omit<DashboardConfig, 'id'>): Promise<DashboardConfig>;
  updateDashboard(id: string, config: Partial<DashboardConfig>): Promise<DashboardConfig>;
  deleteDashboard(id: string): Promise<void>;
  getDashboard(id: string): Promise<DashboardConfig>;
  getDashboards(userId: string): Promise<DashboardConfig[]>;
  executeQuery(query: string): Promise<any>;
  getWidgetData(widgetId: string): Promise<any>;
}

export interface IAnalyticsEngine {
  analyzeTaskCompletionRates(): Promise<BusinessMetric[]>;
  analyzeUserSatisfaction(): Promise<BusinessMetric[]>;
  analyzeWorkflowEfficiency(): Promise<BusinessMetric[]>;
  analyzeUserBehavior(): Promise<UserBehaviorMetrics>;
  predictCapacityNeeds(): Promise<CapacityMetrics>;
  generateInsights(): Promise<Insight[]>;
  detectAnomalies(): Promise<Anomaly[]>;
}

export interface ISystemHealthMonitor {
  checkSystemHealth(): Promise<SystemHealth>;
  checkServiceHealth(serviceName: string): Promise<boolean>;
  runDiagnostics(): Promise<DiagnosticResult[]>;
  calculateHealthScore(): Promise<number>;
}

export interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  recommendations: string[];
  data: Record<string, any>;
  createdAt: Date;
}

export interface Anomaly {
  id: string;
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: AlertSeverity;
  description: string;
  detectedAt: Date;
  service: string;
}

export interface DiagnosticResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface MonitoringConfig {
  metricsRetention: number;
  alertRetention: number;
  collectionInterval: number;
  healthCheckInterval: number;
  anomalyDetectionEnabled: boolean;
  costTrackingEnabled: boolean;
  userAnalyticsEnabled: boolean;
}

export interface EscalationRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  escalationLevels: EscalationLevel[];
  isActive: boolean;
}

export interface EscalationLevel {
  level: number;
  delay: number; // minutes
  recipients: string[];
  channels: string[]; // email, slack, sms, etc.
  actions: string[];
}