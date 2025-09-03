import { DataCleaner } from '../data-analytics-service/DataCleaner';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

// Mock fs and XLSX
jest.mock('fs');
jest.mock('xlsx');

describe('DataCleaner', () => {
  let dataCleaner: DataCleaner;

  const mockCSVContent = `date,value,category
2024-01-01,100,A
2024-01-02,150,B
2024-01-03,120,A
2024-01-04,,A
2024-01-05,200,C`;

  const mockJSONContent = JSON.stringify([
    { date: '2024-01-01', value: 100, category: 'A' },
    { date: '2024-01-02', value: 150, category: 'B' },
    { date: '2024-01-03', value: 120, category: 'A' }
  ]);

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.csv',
    encoding: '7bit',
    mimetype: 'text/csv',
    size: 1000,
    destination: '/tmp',
    filename: 'test.csv',
    path: '/tmp/test.csv',
    buffer: Buffer.from(''),
    stream: {} as any
  };

  beforeEach(() => {
    dataCleaner = new DataCleaner();
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    it('should parse CSV file successfully', async () => {
      // Arrange
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCSVContent);

      // Act
      const result = await dataCleaner.parseFile(mockFile);

      // Assert
      expect(result.headers).toEqual(['date', 'value', 'category']);
      expect(result.rows).toHaveLength(5);
      expect(result.rows[0]).toEqual(['2024-01-01', '100', 'A']);
      expect(result.metadata.totalRows).toBe(5);
      expect(result.metadata.totalColumns).toBe(3);
      expect(result.metadata.format.type).toBe('csv');
    });

    it('should parse JSON file successfully', async () => {
      // Arrange
      const jsonFile = { ...mockFile, originalname: 'test.json', path: '/tmp/test.json' };
      (fs.readFileSync as jest.Mock).mockReturnValue(mockJSONContent);

      // Act
      const result = await dataCleaner.parseFile(jsonFile);

      // Assert
      expect(result.headers).toEqual(['date', 'value', 'category']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual(['2024-01-01', 100, 'A']);
      expect(result.metadata.totalRows).toBe(3);
      expect(result.metadata.totalColumns).toBe(3);
      expect(result.metadata.format.type).toBe('json');
    });

    it('should parse Excel file successfully', async () => {
      // Arrange
      const excelFile = { ...mockFile, originalname: 'test.xlsx', path: '/tmp/test.xlsx' };
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      };
      const mockSheetData = [
        ['date', 'value', 'category'],
        ['2024-01-01', 100, 'A'],
        ['2024-01-02', 150, 'B']
      ];

      (XLSX.readFile as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mockSheetData);

      // Act
      const result = await dataCleaner.parseFile(excelFile);

      // Assert
      expect(result.headers).toEqual(['date', 'value', 'category']);
      expect(result.rows).toHaveLength(2);
      expect(result.metadata.format.type).toBe('excel');
    });

    it('should handle unsupported file format', async () => {
      // Arrange
      const unsupportedFile = { ...mockFile, originalname: 'test.txt' };

      // Act & Assert
      await expect(dataCleaner.parseFile(unsupportedFile))
        .rejects.toThrow('Failed to parse file: Unsupported file format: .txt');
    });
  });

  describe('assessDataQuality', () => {
    it('should assess data quality correctly', async () => {
      // Arrange
      const data = {
        headers: ['date', 'value', 'category'],
        rows: [
          ['2024-01-01', 100, 'A'],
          ['2024-01-02', null, 'B'],
          ['2024-01-03', 120, 'A'],
          ['2024-01-01', 100, 'A'], // duplicate
          ['2024-01-05', 1000, 'C'] // outlier
        ],
        metadata: {
          totalRows: 5,
          totalColumns: 3,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.assessDataQuality(data);

      // Assert
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_values',
            column: 'value'
          }),
          expect.objectContaining({
            type: 'duplicates',
            column: 'all'
          })
        ])
      );
      expect(result.summary.totalRows).toBe(5);
      expect(result.summary.totalColumns).toBe(3);
      expect(result.summary.duplicateRows).toBe(1);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should handle empty dataset', async () => {
      // Arrange
      const data = {
        headers: [],
        rows: [],
        metadata: {
          totalRows: 0,
          totalColumns: 0,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.assessDataQuality(data);

      // Assert
      expect(result.overallScore).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.summary.totalRows).toBe(0);
    });
  });

  describe('cleanData', () => {
    it('should remove duplicates successfully', async () => {
      // Arrange
      const data = {
        headers: ['date', 'value'],
        rows: [
          ['2024-01-01', 100],
          ['2024-01-02', 150],
          ['2024-01-01', 100], // duplicate
          ['2024-01-03', 120]
        ],
        metadata: {
          totalRows: 4,
          totalColumns: 2,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.cleanData(data, ['remove_duplicates']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.afterStats.rowCount).toBe(3);
      expect(result.afterStats.duplicateRows).toBe(0);
    });

    it('should fill missing values successfully', async () => {
      // Arrange
      const data = {
        headers: ['date', 'value'],
        rows: [
          ['2024-01-01', 100],
          ['2024-01-02', null],
          ['2024-01-03', 120],
          ['2024-01-04', '']
        ],
        metadata: {
          totalRows: 4,
          totalColumns: 2,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.cleanData(data, ['fill_missing_values']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBeGreaterThan(0);
      expect(result.afterStats.missingValues).toBeLessThan(result.beforeStats.missingValues);
    });

    it('should remove outliers successfully', async () => {
      // Arrange
      const data = {
        headers: ['value'],
        rows: [
          [10], [12], [11], [13], [9], [14], [10], [11], [12], [1000] // 1000 is outlier
        ],
        metadata: {
          totalRows: 10,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.cleanData(data, ['remove_outliers']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBeGreaterThan(0);
      expect(result.afterStats.rowCount).toBeLessThan(result.beforeStats.rowCount);
    });

    it('should standardize formats successfully', async () => {
      // Arrange
      const data = {
        headers: ['date'],
        rows: [
          ['01/01/2024'],
          ['2024-01-02'],
          ['01-03-2024']
        ],
        metadata: {
          totalRows: 3,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.cleanData(data, ['standardize_formats']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'standardize_format'
          })
        ])
      );
    });

    it('should handle unknown cleaning operation', async () => {
      // Arrange
      const data = {
        headers: ['value'],
        rows: [[100]],
        metadata: {
          totalRows: 1,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.cleanData(data, ['unknown_operation']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(0);
    });
  });

  describe('validateData', () => {
    it('should validate required fields', async () => {
      // Arrange
      const data = {
        headers: ['name', 'email'],
        rows: [
          ['John', 'john@example.com'],
          ['', 'jane@example.com'], // missing name
          ['Bob', ''] // missing email
        ],
        metadata: {
          totalRows: 3,
          totalColumns: 2,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      const rules = [
        {
          column: 'name',
          type: 'required' as const,
          parameters: {},
          message: 'Name is required'
        },
        {
          column: 'email',
          type: 'required' as const,
          parameters: {},
          message: 'Email is required'
        }
      ];

      // Act
      const result = await dataCleaner.validateData(data, rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          row: 2,
          column: 'name',
          rule: 'required',
          message: 'Name is required'
        })
      );
      expect(result.summary.errorRows).toBe(2);
      expect(result.summary.validRows).toBe(1);
    });

    it('should validate data types', async () => {
      // Arrange
      const data = {
        headers: ['age', 'score'],
        rows: [
          [25, 85.5],
          ['invalid', 90], // invalid age
          [30, 'invalid'] // invalid score
        ],
        metadata: {
          totalRows: 3,
          totalColumns: 2,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      const rules = [
        {
          column: 'age',
          type: 'type' as const,
          parameters: { type: 'number' },
          message: 'Age must be a number'
        },
        {
          column: 'score',
          type: 'type' as const,
          parameters: { type: 'number' },
          message: 'Score must be a number'
        }
      ];

      // Act
      const result = await dataCleaner.validateData(data, rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate ranges', async () => {
      // Arrange
      const data = {
        headers: ['score'],
        rows: [
          [85],
          [105], // above max
          [-5] // below min
        ],
        metadata: {
          totalRows: 3,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      const rules = [
        {
          column: 'score',
          type: 'range' as const,
          parameters: { min: 0, max: 100 },
          message: 'Score must be between 0 and 100'
        }
      ];

      // Act
      const result = await dataCleaner.validateData(data, rules);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.summary.warningRows).toBe(2);
    });

    it('should validate patterns', async () => {
      // Arrange
      const data = {
        headers: ['email'],
        rows: [
          ['valid@example.com'],
          ['invalid-email'], // invalid pattern
          ['another@valid.com']
        ],
        metadata: {
          totalRows: 3,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      const rules = [
        {
          column: 'email',
          type: 'pattern' as const,
          parameters: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          message: 'Invalid email format'
        }
      ];

      // Act
      const result = await dataCleaner.validateData(data, rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid email format');
    });

    it('should handle empty validation rules', async () => {
      // Arrange
      const data = {
        headers: ['value'],
        rows: [[100]],
        metadata: {
          totalRows: 1,
          totalColumns: 1,
          format: { type: 'csv' as const },
          parseErrors: []
        }
      };

      // Act
      const result = await dataCleaner.validateData(data, []);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('loadDataFromFile', () => {
    it('should load CSV data from file', async () => {
      // Arrange
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCSVContent);

      // Act
      const result = await dataCleaner.loadDataFromFile('/tmp/test.csv');

      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/test.csv', 'utf-8');
      expect(result.headers).toEqual(['date', 'value', 'category']);
      expect(result.rows).toHaveLength(5);
    });

    it('should handle file read errors', async () => {
      // Arrange
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      // Act & Assert
      await expect(dataCleaner.loadDataFromFile('/tmp/nonexistent.csv'))
        .rejects.toThrow('Failed to load data: File not found');
    });
  });
});