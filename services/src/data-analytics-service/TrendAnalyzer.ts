import { 
  TrendAnalysisResult, 
  SeasonalityInfo, 
  ForecastData, 
  StatisticalSummary,
  CorrelationMatrix,
  PatternRecognitionResult,
  DetectedPattern,
  Anomaly,
  ClusterInfo,
  ParsedData,
  MarketResearchData,
  CompetitorInfo,
  TrendData,
  MarketSizeData,
  NewsItem
} from './types';
import { Logger } from '../shared/utils/Logger';

export class TrendAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('TrendAnalyzer');
  }

  /**
   * Analyze trend in a specific column
   */
  async analyzeTrend(
    data: ParsedData,
    column: string,
    timeColumn?: string
  ): Promise<TrendAnalysisResult> {
    try {
      this.logger.info(`Analyzing trend for column: ${column}`);

      const columnIndex = data.headers.indexOf(column);
      const timeIndex = timeColumn ? data.headers.indexOf(timeColumn) : 0;

      if (columnIndex === -1) {
        throw new Error(`Column '${column}' not found in dataset`);
      }

      // Extract and prepare data
      const values = this.extractNumericValues(data.rows, columnIndex);
      const timeValues = timeColumn ? this.extractTimeValues(data.rows, timeIndex) : null;

      // Calculate trend
      const trend = this.calculateTrend(values);
      const correlation = this.calculateCorrelation(values);
      const seasonality = timeValues ? this.detectSeasonality(values, timeValues) : undefined;
      const forecast = this.generateForecast(values, 30); // 30 periods ahead
      const insights = this.generateTrendInsights(trend, correlation, seasonality);

      return {
        trend: trend.direction,
        confidence: trend.confidence,
        slope: trend.slope,
        correlation,
        seasonality,
        forecast,
        insights
      };
    } catch (error) {
      this.logger.error('Error analyzing trend:', error);
      throw new Error(`Failed to analyze trend: ${error.message}`);
    }
  }

  /**
   * Generate statistical summary for a column
   */
  async generateStatisticalSummary(
    data: ParsedData,
    column: string
  ): Promise<StatisticalSummary> {
    try {
      this.logger.info(`Generating statistical summary for column: ${column}`);

      const columnIndex = data.headers.indexOf(column);
      if (columnIndex === -1) {
        throw new Error(`Column '${column}' not found in dataset`);
      }

      const values = data.rows.map(row => row[columnIndex]).filter(val => val != null);
      const numericValues = values.filter(val => !isNaN(Number(val))).map(val => Number(val));

      if (numericValues.length === 0) {
        // Handle non-numeric data
        const counts = values.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        const mode = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

        return {
          column,
          count: values.length,
          mode,
          min: null,
          max: null
        };
      }

      // Calculate statistics for numeric data
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
      const median = this.calculateMedian(sorted);
      const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length;
      const standardDeviation = Math.sqrt(variance);
      const quartiles = this.calculateQuartiles(sorted);
      const outliers = this.detectOutliers(numericValues);

      return {
        column,
        count: numericValues.length,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        standardDeviation: Math.round(standardDeviation * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        quartiles,
        outliers: outliers.slice(0, 10) // Limit to first 10 outliers
      };
    } catch (error) {
      this.logger.error('Error generating statistical summary:', error);
      throw new Error(`Failed to generate statistical summary: ${error.message}`);
    }
  }

  /**
   * Calculate correlation matrix between numeric columns
   */
  async calculateCorrelationMatrix(data: ParsedData): Promise<CorrelationMatrix> {
    try {
      this.logger.info('Calculating correlation matrix');

      // Find numeric columns
      const numericColumns: { name: string; index: number; values: number[] }[] = [];
      
      for (let i = 0; i < data.headers.length; i++) {
        const values = data.rows
          .map(row => row[i])
          .filter(val => val != null && !isNaN(Number(val)))
          .map(val => Number(val));
        
        if (values.length > data.rows.length * 0.5) { // At least 50% numeric values
          numericColumns.push({
            name: data.headers[i],
            index: i,
            values
          });
        }
      }

      if (numericColumns.length < 2) {
        throw new Error('Need at least 2 numeric columns for correlation analysis');
      }

      // Calculate correlation matrix
      const matrix: number[][] = [];
      const significantCorrelations: { column1: string; column2: string; correlation: number; pValue: number }[] = [];

      for (let i = 0; i < numericColumns.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < numericColumns.length; j++) {
          if (i === j) {
            matrix[i][j] = 1.0;
          } else {
            const correlation = this.calculatePearsonCorrelation(
              numericColumns[i].values,
              numericColumns[j].values
            );
            matrix[i][j] = Math.round(correlation * 1000) / 1000;

            // Check for significant correlations
            if (Math.abs(correlation) > 0.5 && i < j) {
              significantCorrelations.push({
                column1: numericColumns[i].name,
                column2: numericColumns[j].name,
                correlation: Math.round(correlation * 1000) / 1000,
                pValue: 0.05 // Simplified - would need proper statistical test
              });
            }
          }
        }
      }

      return {
        columns: numericColumns.map(col => col.name),
        matrix,
        significantCorrelations
      };
    } catch (error) {
      this.logger.error('Error calculating correlation matrix:', error);
      throw new Error(`Failed to calculate correlation matrix: ${error.message}`);
    }
  }

  /**
   * Perform pattern recognition on data
   */
  async recognizePatterns(
    data: ParsedData,
    column: string,
    timeColumn?: string
  ): Promise<PatternRecognitionResult> {
    try {
      this.logger.info(`Recognizing patterns in column: ${column}`);

      const columnIndex = data.headers.indexOf(column);
      if (columnIndex === -1) {
        throw new Error(`Column '${column}' not found in dataset`);
      }

      const values = this.extractNumericValues(data.rows, columnIndex);
      const timeValues = timeColumn ? this.extractTimeValues(data.rows, data.headers.indexOf(timeColumn)) : null;

      const patterns = this.detectPatterns(values, timeValues);
      const anomalies = this.detectAnomalies(values);
      const clusters = values.length > 50 ? this.performClustering(values) : undefined;

      return {
        patterns,
        anomalies,
        clusters
      };
    } catch (error) {
      this.logger.error('Error recognizing patterns:', error);
      throw new Error(`Failed to recognize patterns: ${error.message}`);
    }
  }

  /**
   * Perform market research analysis
   */
  async performMarketResearch(query: string, industry: string): Promise<MarketResearchData> {
    try {
      this.logger.info(`Performing market research for: ${query} in ${industry}`);

      // This is a mock implementation - in practice, you'd integrate with
      // external APIs like Google Trends, news APIs, market research databases
      
      const competitors: CompetitorInfo[] = [
        {
          name: 'Competitor A',
          marketShare: 25.5,
          revenue: 500000000,
          strengths: ['Strong brand recognition', 'Extensive distribution network'],
          weaknesses: ['Higher pricing', 'Limited innovation'],
          recentNews: [
            {
              title: 'Competitor A launches new product line',
              summary: 'Major expansion into emerging markets',
              date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              source: 'Industry News',
              sentiment: 'positive'
            }
          ]
        },
        {
          name: 'Competitor B',
          marketShare: 18.2,
          revenue: 350000000,
          strengths: ['Innovative technology', 'Competitive pricing'],
          weaknesses: ['Limited market presence', 'Customer service issues'],
          recentNews: [
            {
              title: 'Competitor B faces regulatory challenges',
              summary: 'New regulations may impact operations',
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              source: 'Regulatory News',
              sentiment: 'negative'
            }
          ]
        }
      ];

      const industryTrends: TrendData[] = [
        {
          category: 'Technology Adoption',
          trend: 'AI and automation increasing rapidly',
          impact: 'high',
          timeframe: '2024-2025',
          confidence: 0.85
        },
        {
          category: 'Consumer Behavior',
          trend: 'Shift towards sustainable products',
          impact: 'medium',
          timeframe: '2024-2026',
          confidence: 0.75
        },
        {
          category: 'Market Dynamics',
          trend: 'Consolidation through M&A activity',
          impact: 'high',
          timeframe: '2024',
          confidence: 0.90
        }
      ];

      const marketSize: MarketSizeData = {
        total: 2500000000, // $2.5B
        growth: 8.5, // 8.5% CAGR
        segments: {
          'Enterprise': 1500000000,
          'SMB': 750000000,
          'Consumer': 250000000
        },
        forecast: [
          { year: 2024, size: 2500000000 },
          { year: 2025, size: 2712500000 },
          { year: 2026, size: 2943062500 },
          { year: 2027, size: 3194222813 }
        ]
      };

      const keyInsights = [
        'Market showing strong growth driven by digital transformation',
        'Competitive landscape becoming more fragmented',
        'Customer preferences shifting towards integrated solutions',
        'Regulatory environment creating both challenges and opportunities'
      ];

      return {
        competitors,
        industryTrends,
        marketSize,
        keyInsights,
        sources: [
          'Industry Research Reports',
          'Company Financial Statements',
          'News and Media Analysis',
          'Market Intelligence Platforms'
        ],
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Error performing market research:', error);
      throw new Error(`Failed to perform market research: ${error.message}`);
    }
  }

  // Private helper methods

  private extractNumericValues(rows: any[][], columnIndex: number): number[] {
    return rows
      .map(row => row[columnIndex])
      .filter(val => val != null && !isNaN(Number(val)))
      .map(val => Number(val));
  }

  private extractTimeValues(rows: any[][], columnIndex: number): Date[] {
    return rows
      .map(row => row[columnIndex])
      .filter(val => val != null && !isNaN(Date.parse(val)))
      .map(val => new Date(val));
  }

  private calculateTrend(values: number[]): { direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'; confidence: number; slope: number } {
    if (values.length < 2) {
      return { direction: 'stable', confidence: 0, slope: 0 };
    }

    // Calculate linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssRes = values.reduce((sum, val, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssRes / ssTotal);

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    const slopeThreshold = Math.abs(slope) / (Math.max(...values) - Math.min(...values)) * values.length;
    
    if (slopeThreshold < 0.1) {
      direction = 'stable';
    } else if (rSquared < 0.3) {
      direction = 'volatile';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      confidence: Math.round(rSquared * 100) / 100,
      slope: Math.round(slope * 1000) / 1000
    };
  }

  private calculateCorrelation(values: number[]): number {
    if (values.length < 2) return 0;

    const indices = Array.from({ length: values.length }, (_, i) => i);
    return this.calculatePearsonCorrelation(values, indices);
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private detectSeasonality(values: number[], timeValues: Date[]): SeasonalityInfo {
    // Simplified seasonality detection
    // In practice, you'd use more sophisticated methods like FFT or autocorrelation
    
    if (values.length < 12) {
      return { detected: false, period: 0, strength: 0 };
    }

    // Check for monthly patterns (simplified)
    const monthlyAverages = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);

    timeValues.forEach((date, index) => {
      const month = date.getMonth();
      monthlyAverages[month] += values[index];
      monthlyCounts[month]++;
    });

    for (let i = 0; i < 12; i++) {
      if (monthlyCounts[i] > 0) {
        monthlyAverages[i] /= monthlyCounts[i];
      }
    }

    const overallMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const seasonalVariance = monthlyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallMean, 2), 0) / 12;
    const totalVariance = values.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / values.length;

    const strength = totalVariance > 0 ? seasonalVariance / totalVariance : 0;

    return {
      detected: strength > 0.1,
      period: 12, // Monthly
      strength: Math.round(strength * 100) / 100
    };
  }

  private generateForecast(values: number[], periods: number): ForecastData[] {
    if (values.length < 3) return [];

    const trend = this.calculateTrend(values);
    const lastValue = values[values.length - 1];
    const forecast: ForecastData[] = [];

    for (let i = 1; i <= periods; i++) {
      const predictedValue = lastValue + trend.slope * i;
      const confidence = Math.max(0.1, trend.confidence - (i * 0.02)); // Decrease confidence over time
      const margin = predictedValue * (1 - confidence) * 0.5;

      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000), // Daily forecast
        value: Math.round(predictedValue * 100) / 100,
        confidence: {
          lower: Math.round((predictedValue - margin) * 100) / 100,
          upper: Math.round((predictedValue + margin) * 100) / 100
        }
      });
    }

    return forecast;
  }

  private generateTrendInsights(
    trend: { direction: string; confidence: number; slope: number },
    correlation: number,
    seasonality?: SeasonalityInfo
  ): string[] {
    const insights: string[] = [];

    // Trend insights
    switch (trend.direction) {
      case 'increasing':
        insights.push(`Strong upward trend detected with ${Math.round(trend.confidence * 100)}% confidence`);
        break;
      case 'decreasing':
        insights.push(`Downward trend identified with ${Math.round(trend.confidence * 100)}% confidence`);
        break;
      case 'stable':
        insights.push('Values remain relatively stable over time');
        break;
      case 'volatile':
        insights.push('High volatility detected - values fluctuate significantly');
        break;
    }

    // Correlation insights
    if (Math.abs(correlation) > 0.7) {
      insights.push(`Strong ${correlation > 0 ? 'positive' : 'negative'} correlation with time`);
    } else if (Math.abs(correlation) > 0.3) {
      insights.push(`Moderate ${correlation > 0 ? 'positive' : 'negative'} correlation with time`);
    }

    // Seasonality insights
    if (seasonality?.detected) {
      insights.push(`Seasonal patterns detected with ${seasonality.period}-period cycle`);
    }

    return insights;
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private calculateQuartiles(sortedValues: number[]): { q1: number; q2: number; q3: number } {
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q2Index = Math.floor(sortedValues.length * 0.5);
    const q3Index = Math.floor(sortedValues.length * 0.75);

    return {
      q1: sortedValues[q1Index],
      q2: sortedValues[q2Index],
      q3: sortedValues[q3Index]
    };
  }

  private detectOutliers(values: number[]): number[] {
    if (values.length < 4) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.filter(val => val < lowerBound || val > upperBound);
  }

  private detectPatterns(values: number[], timeValues?: Date[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Detect trend patterns
    const trend = this.calculateTrend(values);
    if (trend.confidence > 0.5) {
      patterns.push({
        type: 'trend',
        description: `${trend.direction} trend with slope ${trend.slope}`,
        confidence: trend.confidence,
        strength: Math.abs(trend.slope)
      });
    }

    // Detect cyclical patterns (simplified)
    if (values.length > 20) {
      const cycles = this.detectCycles(values);
      if (cycles.length > 0) {
        patterns.push({
          type: 'cyclical',
          description: `Cyclical pattern with period ~${cycles[0]} data points`,
          confidence: 0.7,
          frequency: `${cycles[0]} periods`,
          strength: 0.6
        });
      }
    }

    return patterns;
  }

  private detectCycles(values: number[]): number[] {
    // Simplified cycle detection using autocorrelation
    const cycles: number[] = [];
    const maxLag = Math.min(values.length / 4, 50);

    for (let lag = 2; lag < maxLag; lag++) {
      const correlation = this.calculateAutocorrelation(values, lag);
      if (correlation > 0.5) {
        cycles.push(lag);
      }
    }

    return cycles;
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

    const n = values.length - lag;
    const x1 = values.slice(0, n);
    const x2 = values.slice(lag, lag + n);

    return this.calculatePearsonCorrelation(x1, x2);
  }

  private detectAnomalies(values: number[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const outliers = this.detectOutliers(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    outliers.forEach(outlier => {
      const index = values.indexOf(outlier);
      const anomalyScore = Math.abs(outlier - mean) / Math.max(...values);

      anomalies.push({
        index,
        value: outlier,
        expectedValue: mean,
        anomalyScore: Math.round(anomalyScore * 100) / 100,
        type: 'point'
      });
    });

    return anomalies.slice(0, 20); // Limit to top 20 anomalies
  }

  private performClustering(values: number[]): ClusterInfo[] {
    // Simplified k-means clustering for 1D data
    const k = Math.min(5, Math.floor(values.length / 10)); // Max 5 clusters
    if (k < 2) return [];

    const clusters: ClusterInfo[] = [];
    const sorted = [...values].sort((a, b) => a - b);
    
    // Initialize cluster centers
    const centers: number[] = [];
    for (let i = 0; i < k; i++) {
      const index = Math.floor((sorted.length * i) / (k - 1));
      centers.push(sorted[Math.min(index, sorted.length - 1)]);
    }

    // Simple clustering assignment
    for (let i = 0; i < k; i++) {
      const clusterValues = values.filter(val => {
        const distances = centers.map(center => Math.abs(val - center));
        const minDistance = Math.min(...distances);
        return Math.abs(val - centers[i]) === minDistance;
      });

      if (clusterValues.length > 0) {
        const variance = clusterValues.reduce((sum, val) => {
          return sum + Math.pow(val - centers[i], 2);
        }, 0) / clusterValues.length;

        clusters.push({
          id: i,
          center: [centers[i]],
          size: clusterValues.length,
          variance: Math.round(variance * 100) / 100
        });
      }
    }

    return clusters;
  }
}