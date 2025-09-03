import { TrendAnalyzer } from '../data-analytics-service/TrendAnalyzer';
import { ParsedData } from '../data-analytics-service/types';

describe('TrendAnalyzer', () => {
  let trendAnalyzer: TrendAnalyzer;

  const mockParsedData: ParsedData = {
    headers: ['date', 'value', 'category'],
    rows: [
      ['2024-01-01', 100, 'A'],
      ['2024-01-02', 110, 'B'],
      ['2024-01-03', 120, 'A'],
      ['2024-01-04', 130, 'B'],
      ['2024-01-05', 140, 'A'],
      ['2024-01-06', 150, 'B']
    ],
    metadata: {
      totalRows: 6,
      totalColumns: 3,
      format: { type: 'csv' },
      parseErrors: []
    }
  };

  const mockTimeSeriesData: ParsedData = {
    headers: ['date', 'value'],
    rows: [
      ['2024-01-01', 100],
      ['2024-01-02', 105],
      ['2024-01-03', 110],
      ['2024-01-04', 115],
      ['2024-01-05', 120],
      ['2024-01-06', 125],
      ['2024-01-07', 130],
      ['2024-01-08', 135],
      ['2024-01-09', 140],
      ['2024-01-10', 145],
      ['2024-01-11', 150],
      ['2024-01-12', 155]
    ],
    metadata: {
      totalRows: 12,
      totalColumns: 2,
      format: { type: 'csv' },
      parseErrors: []
    }
  };

  beforeEach(() => {
    trendAnalyzer = new TrendAnalyzer();
  });

  describe('analyzeTrend', () => {
    it('should analyze increasing trend successfully', async () => {
      // Act
      const result = await trendAnalyzer.analyzeTrend(mockParsedData, 'value');

      // Assert
      expect(result.trend).toBe('increasing');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.slope).toBeGreaterThan(0);
      expect(result.correlation).toBeDefined();
      expect(result.forecast).toBeInstanceOf(Array);
      expect(result.forecast.length).toBe(30);
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('should analyze trend with time column', async () => {
      // Act
      const result = await trendAnalyzer.analyzeTrend(mockTimeSeriesData, 'value', 'date');

      // Assert
      expect(result.trend).toBe('increasing');
      expect(result.seasonality).toBeDefined();
      expect(result.seasonality?.detected).toBe(false); // Not enough data for seasonality
      expect(result.forecast).toBeInstanceOf(Array);
      expect(result.insights).toContain(expect.stringMatching(/trend/i));
    });

    it('should handle decreasing trend', async () => {
      // Arrange
      const decreasingData: ParsedData = {
        ...mockParsedData,
        rows: [
          ['2024-01-01', 150, 'A'],
          ['2024-01-02', 140, 'B'],
          ['2024-01-03', 130, 'A'],
          ['2024-01-04', 120, 'B'],
          ['2024-01-05', 110, 'A'],
          ['2024-01-06', 100, 'B']
        ]
      };

      // Act
      const result = await trendAnalyzer.analyzeTrend(decreasingData, 'value');

      // Assert
      expect(result.trend).toBe('decreasing');
      expect(result.slope).toBeLessThan(0);
      expect(result.insights).toContain(expect.stringMatching(/downward/i));
    });

    it('should handle stable trend', async () => {
      // Arrange
      const stableData: ParsedData = {
        ...mockParsedData,
        rows: [
          ['2024-01-01', 100, 'A'],
          ['2024-01-02', 101, 'B'],
          ['2024-01-03', 99, 'A'],
          ['2024-01-04', 100, 'B'],
          ['2024-01-05', 102, 'A'],
          ['2024-01-06', 98, 'B']
        ]
      };

      // Act
      const result = await trendAnalyzer.analyzeTrend(stableData, 'value');

      // Assert
      expect(result.trend).toBe('stable');
      expect(Math.abs(result.slope)).toBeLessThan(1);
      expect(result.insights).toContain(expect.stringMatching(/stable/i));
    });

    it('should handle volatile trend', async () => {
      // Arrange
      const volatileData: ParsedData = {
        ...mockParsedData,
        rows: [
          ['2024-01-01', 100, 'A'],
          ['2024-01-02', 200, 'B'],
          ['2024-01-03', 50, 'A'],
          ['2024-01-04', 300, 'B'],
          ['2024-01-05', 25, 'A'],
          ['2024-01-06', 400, 'B']
        ]
      };

      // Act
      const result = await trendAnalyzer.analyzeTrend(volatileData, 'value');

      // Assert
      expect(result.trend).toBe('volatile');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.insights).toContain(expect.stringMatching(/volatility|fluctuate/i));
    });

    it('should handle column not found', async () => {
      // Act & Assert
      await expect(trendAnalyzer.analyzeTrend(mockParsedData, 'nonexistent'))
        .rejects.toThrow("Column 'nonexistent' not found in dataset");
    });

    it('should handle insufficient data', async () => {
      // Arrange
      const minimalData: ParsedData = {
        ...mockParsedData,
        rows: [['2024-01-01', 100, 'A']],
        metadata: { ...mockParsedData.metadata, totalRows: 1 }
      };

      // Act
      const result = await trendAnalyzer.analyzeTrend(minimalData, 'value');

      // Assert
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBe(0);
      expect(result.slope).toBe(0);
    });
  });

  describe('generateStatisticalSummary', () => {
    it('should generate summary for numeric column', async () => {
      // Act
      const result = await trendAnalyzer.generateStatisticalSummary(mockParsedData, 'value');

      // Assert
      expect(result.column).toBe('value');
      expect(result.count).toBe(6);
      expect(result.mean).toBeDefined();
      expect(result.median).toBeDefined();
      expect(result.standardDeviation).toBeDefined();
      expect(result.variance).toBeDefined();
      expect(result.min).toBe(100);
      expect(result.max).toBe(150);
      expect(result.quartiles).toBeDefined();
      expect(result.quartiles?.q1).toBeDefined();
      expect(result.quartiles?.q2).toBeDefined();
      expect(result.quartiles?.q3).toBeDefined();
    });

    it('should generate summary for non-numeric column', async () => {
      // Act
      const result = await trendAnalyzer.generateStatisticalSummary(mockParsedData, 'category');

      // Assert
      expect(result.column).toBe('category');
      expect(result.count).toBe(6);
      expect(result.mode).toBeDefined();
      expect(result.mean).toBeUndefined();
      expect(result.median).toBeUndefined();
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
    });

    it('should handle column with outliers', async () => {
      // Arrange
      const dataWithOutliers: ParsedData = {
        ...mockParsedData,
        rows: [
          ['2024-01-01', 10, 'A'],
          ['2024-01-02', 12, 'B'],
          ['2024-01-03', 11, 'A'],
          ['2024-01-04', 13, 'B'],
          ['2024-01-05', 1000, 'A'], // outlier
          ['2024-01-06', 9, 'B']
        ]
      };

      // Act
      const result = await trendAnalyzer.generateStatisticalSummary(dataWithOutliers, 'value');

      // Assert
      expect(result.outliers).toBeDefined();
      expect(result.outliers?.length).toBeGreaterThan(0);
      expect(result.outliers).toContain(1000);
    });

    it('should handle column not found', async () => {
      // Act & Assert
      await expect(trendAnalyzer.generateStatisticalSummary(mockParsedData, 'nonexistent'))
        .rejects.toThrow("Column 'nonexistent' not found in dataset");
    });
  });

  describe('calculateCorrelationMatrix', () => {
    it('should calculate correlation matrix successfully', async () => {
      // Arrange
      const numericData: ParsedData = {
        headers: ['x', 'y', 'z'],
        rows: [
          [1, 2, 3],
          [2, 4, 6],
          [3, 6, 9],
          [4, 8, 12],
          [5, 10, 15]
        ],
        metadata: {
          totalRows: 5,
          totalColumns: 3,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act
      const result = await trendAnalyzer.calculateCorrelationMatrix(numericData);

      // Assert
      expect(result.columns).toEqual(['x', 'y', 'z']);
      expect(result.matrix).toBeInstanceOf(Array);
      expect(result.matrix.length).toBe(3);
      expect(result.matrix[0].length).toBe(3);
      expect(result.matrix[0][0]).toBe(1.0); // Self-correlation
      expect(result.significantCorrelations).toBeInstanceOf(Array);
      expect(result.significantCorrelations.length).toBeGreaterThan(0);
    });

    it('should handle insufficient numeric columns', async () => {
      // Arrange
      const nonNumericData: ParsedData = {
        headers: ['text'],
        rows: [['a'], ['b'], ['c']],
        metadata: {
          totalRows: 3,
          totalColumns: 1,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act & Assert
      await expect(trendAnalyzer.calculateCorrelationMatrix(nonNumericData))
        .rejects.toThrow('Need at least 2 numeric columns for correlation analysis');
    });
  });

  describe('recognizePatterns', () => {
    it('should recognize patterns successfully', async () => {
      // Act
      const result = await trendAnalyzer.recognizePatterns(mockTimeSeriesData, 'value', 'date');

      // Assert
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.anomalies).toBeInstanceOf(Array);
      expect(result.clusters).toBeUndefined(); // Not enough data for clustering
    });

    it('should recognize patterns with clustering', async () => {
      // Arrange
      const largeDataset: ParsedData = {
        headers: ['value'],
        rows: Array.from({ length: 100 }, (_, i) => [Math.random() * 100]),
        metadata: {
          totalRows: 100,
          totalColumns: 1,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act
      const result = await trendAnalyzer.recognizePatterns(largeDataset, 'value');

      // Assert
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.anomalies).toBeInstanceOf(Array);
      expect(result.clusters).toBeDefined();
      expect(result.clusters?.length).toBeGreaterThan(0);
    });

    it('should handle column not found', async () => {
      // Act & Assert
      await expect(trendAnalyzer.recognizePatterns(mockParsedData, 'nonexistent'))
        .rejects.toThrow("Column 'nonexistent' not found in dataset");
    });
  });

  describe('performMarketResearch', () => {
    it('should perform market research successfully', async () => {
      // Act
      const result = await trendAnalyzer.performMarketResearch('AI software', 'Technology');

      // Assert
      expect(result.competitors).toBeInstanceOf(Array);
      expect(result.competitors.length).toBeGreaterThan(0);
      expect(result.competitors[0]).toHaveProperty('name');
      expect(result.competitors[0]).toHaveProperty('marketShare');
      expect(result.competitors[0]).toHaveProperty('strengths');
      expect(result.competitors[0]).toHaveProperty('weaknesses');
      expect(result.competitors[0]).toHaveProperty('recentNews');

      expect(result.industryTrends).toBeInstanceOf(Array);
      expect(result.industryTrends.length).toBeGreaterThan(0);
      expect(result.industryTrends[0]).toHaveProperty('category');
      expect(result.industryTrends[0]).toHaveProperty('trend');
      expect(result.industryTrends[0]).toHaveProperty('impact');

      expect(result.marketSize).toBeDefined();
      expect(result.marketSize.total).toBeGreaterThan(0);
      expect(result.marketSize.growth).toBeGreaterThan(0);
      expect(result.marketSize.segments).toBeDefined();
      expect(result.marketSize.forecast).toBeInstanceOf(Array);

      expect(result.keyInsights).toBeInstanceOf(Array);
      expect(result.keyInsights.length).toBeGreaterThan(0);

      expect(result.sources).toBeInstanceOf(Array);
      expect(result.sources.length).toBeGreaterThan(0);

      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle different industries', async () => {
      // Act
      const result = await trendAnalyzer.performMarketResearch('fintech', 'Financial Services');

      // Assert
      expect(result).toBeDefined();
      expect(result.competitors).toBeInstanceOf(Array);
      expect(result.industryTrends).toBeInstanceOf(Array);
      expect(result.marketSize).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty dataset', async () => {
      // Arrange
      const emptyData: ParsedData = {
        headers: [],
        rows: [],
        metadata: {
          totalRows: 0,
          totalColumns: 0,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act & Assert
      await expect(trendAnalyzer.analyzeTrend(emptyData, 'value'))
        .rejects.toThrow("Column 'value' not found in dataset");
    });

    it('should handle data with all null values', async () => {
      // Arrange
      const nullData: ParsedData = {
        headers: ['value'],
        rows: [[null], [null], [null]],
        metadata: {
          totalRows: 3,
          totalColumns: 1,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act
      const result = await trendAnalyzer.analyzeTrend(nullData, 'value');

      // Assert
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBe(0);
    });

    it('should handle mixed data types in numeric analysis', async () => {
      // Arrange
      const mixedData: ParsedData = {
        headers: ['mixed'],
        rows: [
          [100],
          ['text'],
          [200],
          [null],
          [300]
        ],
        metadata: {
          totalRows: 5,
          totalColumns: 1,
          format: { type: 'csv' },
          parseErrors: []
        }
      };

      // Act
      const result = await trendAnalyzer.generateStatisticalSummary(mixedData, 'mixed');

      // Assert
      expect(result.count).toBe(4); // Only non-null values
      expect(result.mean).toBeDefined();
      expect(result.median).toBeDefined();
    });
  });
});