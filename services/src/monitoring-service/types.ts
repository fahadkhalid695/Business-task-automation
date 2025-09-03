export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
  SUPPRESSED = 'suppressed'
}

export enum SystemHealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  DOWN = 'down'
}

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
  service: string;
}

export interface BusinessMetric {
  id: string;
  name: string;
  value: number;
  target?: number;
  unit: string;
  category: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  condition: string;
  threshold: number;
  currentValue: number;
  service: string;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  escalationLevel: number;
  assignedTo?: string;
}

export interface SystemHealth {
  overall: SystemHealthStatus;
  services: ServiceHealth[];
  score: number;
  lastUpdated: Date;
  issues: HealthIssue[];
}

export interface ServiceHealth {
  name: string;
  status: SystemHealthStatus;
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
  dependencies: string[];
}

export interface HealthIssue {
  id: string;
  service: string;
  type: string;
  severity: AlertSeverity;
  description: string;
  impact: string;
  recommendation: string;
  createdAt: Date;
}

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: {
    inbound: number;
    outbound: number;
  };
}

export interface UserBehaviorMetrics {
  activeUsers: number;
  sessionDuration: number;
  pageViews: number;
  featureUsage: Record<string, number>;
  userJourney: UserJourneyStep[];
  conversionRates: Record<string, number>;
}

export interface UserJourneyStep {
  step: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface CostMetrics {
  totalCost: number;
  costByService: Record<string, number>;
  costByResource: Record<string, number>;
  costTrend: CostTrendPoint[];
  optimization: CostOptimization[];
}

export interface CostTrendPoint {
  timestamp: Date;
  cost: number;
  usage: number;
}

export interface CostOptimization {
  type: string;
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

export interface CapacityMetrics {
  current: ResourceUsage;
  predicted: ResourceUsage;
  recommendations: CapacityRecommendation[];
  scalingEvents: ScalingEvent[];
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  timestamp: Date;
}

export interface CapacityRecommendation {
  resource: string;
  action: 'scale_up' | 'scale_down' | 'optimize';
  reason: string;
  impact: string;
  timeline: string;
  confidence: number;
}

export interface ScalingEvent {
  timestamp: Date;
  resource: string;
  action: string;
  trigger: string;
  result: 'success' | 'failed';
  metadata?: Record<string, any>;
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  refreshInterval: number;
  permissions: string[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert' | 'text';
  title: string;
  query: string;
  config: Record<string, any>;
  position: WidgetPosition;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  responsive: boolean;
}