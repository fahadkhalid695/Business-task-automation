// Data Analytics Service Types

export interface DataQualityReport {
  overallScore: number;
  issues: DataQualityIssue[];
  recommendations: string[];
  summary: {
    totalRows: number;
    totalColumns: number;
    missingValues: number;
    duplicateRows: number;
    outliers: number;
  };
}

export interface DataQualityIssue {
  type: 'missing_values' | 'duplicates' | 'outliers' | 'format_errors' | 'inconsistent_data';
  column: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  percentage: number;
  examples?: any[];
}

export interface CleaningOperation {
  type: 'remove_duplicates' | 'fill_missing' | 'remove_outliers' | 'standardize_format' | 'validate_data';
  column?: string;
  parameters: { [key: string]: any };
}

export interface CleaningResult {
  success: boolean;
  message: string;
  affectedRows: number;
  beforeStats: DataStats;
  afterStats: DataStats;
  operations: CleaningOperation[];
}

export interface DataStats {
  rowCount: number;
  columnCount: number;
  missingValues: number;
  duplicateRows: number;
  dataTypes: { [column: string]: string };
  nullPercentage: { [column: string]: number };
}

export interface TrendAnalysisResult {
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number;
  slope: number;
  correlation: number;
  seasonality?: SeasonalityInfo;
  forecast?: ForecastData[];
  insights: string[];
}

export interface SeasonalityInfo {
  detected: boolean;
  period: number;
  strength: number;
}

export interface ForecastData {
  date: Date;
  value: number;
  confidence: {
    lower: number;
    upper: number;
  };
}

export interface StatisticalSummary {
  column: string;
  count: number;
  mean?: number;
  median?: number;
  mode?: any;
  standardDeviation?: number;
  variance?: number;
  min?: any;
  max?: any;
  quartiles?: {
    q1: number;
    q2: number;
    q3: number;
  };
  outliers?: any[];
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
  significantCorrelations: {
    column1: string;
    column2: string;
    correlation: number;
    pValue: number;
  }[];
}

export interface PatternRecognitionResult {
  patterns: DetectedPattern[];
  anomalies: Anomaly[];
  clusters?: ClusterInfo[];
}

export interface DetectedPattern {
  type: 'seasonal' | 'cyclical' | 'trend' | 'recurring';
  description: string;
  confidence: number;
  frequency?: string;
  strength: number;
}

export interface Anomaly {
  index: number;
  value: any;
  expectedValue?: any;
  anomalyScore: number;
  type: 'point' | 'contextual' | 'collective';
}

export interface ClusterInfo {
  id: number;
  center: number[];
  size: number;
  variance: number;
}

export interface DataFormat {
  type: 'csv' | 'json' | 'excel' | 'xml';
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
  sheetName?: string;
}

export interface ParsedData {
  headers: string[];
  rows: any[][];
  metadata: {
    totalRows: number;
    totalColumns: number;
    format: DataFormat;
    parseErrors: ParseError[];
  };
}

export interface ParseError {
  row: number;
  column: string;
  value: any;
  error: string;
}

export interface ValidationRule {
  column: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: { [key: string]: any };
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
}

export interface ValidationError {
  row: number;
  column: string;
  value: any;
  rule: string;
  message: string;
}

export interface ValidationWarning {
  row: number;
  column: string;
  value: any;
  message: string;
}

export interface KPIDefinition {
  name: string;
  description: string;
  formula: string;
  target?: number;
  unit?: string;
  category: string;
}

export interface KPIResult {
  name: string;
  value: number;
  target?: number;
  variance?: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  history?: { date: Date; value: number }[];
}

export interface DashboardConfig {
  title: string;
  widgets: DashboardWidget[];
  refreshInterval: number;
  filters: DashboardFilter[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'kpi' | 'table' | 'text';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: { [key: string]: any };
}

export interface DashboardFilter {
  name: string;
  type: 'date' | 'select' | 'multiselect' | 'range';
  options?: any[];
  defaultValue?: any;
}

export interface MarketResearchData {
  competitors: CompetitorInfo[];
  industryTrends: TrendData[];
  marketSize: MarketSizeData;
  keyInsights: string[];
  sources: string[];
  lastUpdated: Date;
}

export interface CompetitorInfo {
  name: string;
  marketShare: number;
  revenue?: number;
  strengths: string[];
  weaknesses: string[];
  recentNews: NewsItem[];
}

export interface TrendData {
  category: string;
  trend: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  confidence: number;
}

export interface MarketSizeData {
  total: number;
  growth: number;
  segments: { [key: string]: number };
  forecast: { year: number; size: number }[];
}

export interface NewsItem {
  title: string;
  summary: string;
  date: Date;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}