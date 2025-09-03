import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { 
  DataQualityReport, 
  DataQualityIssue, 
  CleaningResult, 
  CleaningOperation,
  DataStats,
  ParsedData,
  DataFormat,
  ParseError,
  ValidationResult,
  ValidationRule,
  ValidationError,
  ValidationWarning
} from './types';
import { Logger } from '../shared/utils/Logger';

export class DataCleaner {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DataCleaner');
  }

  /**
   * Parse data file (CSV, JSON, Excel)
   */
  async parseFile(file: Express.Multer.File): Promise<ParsedData> {
    try {
      const extension = path.extname(file.originalname).toLowerCase();
      const format: DataFormat = this.determineFormat(extension);

      this.logger.info(`Parsing file: ${file.originalname}, format: ${format.type}`);

      switch (format.type) {
        case 'csv':
          return await this.parseCSV(file.path, format);
        case 'json':
          return await this.parseJSON(file.path);
        case 'excel':
          return await this.parseExcel(file.path, format);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      this.logger.error('Error parsing file:', error);
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Load data from existing file
   */
  async loadDataFromFile(filePath: string): Promise<ParsedData> {
    try {
      const extension = path.extname(filePath).toLowerCase();
      const format: DataFormat = this.determineFormat(extension);

      switch (format.type) {
        case 'csv':
          return await this.parseCSV(filePath, format);
        case 'json':
          return await this.parseJSON(filePath);
        case 'excel':
          return await this.parseExcel(filePath, format);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      this.logger.error('Error loading data from file:', error);
      throw new Error(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Assess data quality
   */
  async assessDataQuality(data: ParsedData): Promise<DataQualityReport> {
    try {
      this.logger.info('Assessing data quality');

      const issues: DataQualityIssue[] = [];
      const stats = this.calculateDataStats(data);

      // Check for missing values
      for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
        const column = data.headers[colIndex];
        const missingCount = data.rows.filter(row => 
          row[colIndex] == null || row[colIndex] === '' || row[colIndex] === undefined
        ).length;

        if (missingCount > 0) {
          const percentage = (missingCount / data.rows.length) * 100;
          issues.push({
            type: 'missing_values',
            column,
            description: `${missingCount} missing values (${percentage.toFixed(1)}%)`,
            severity: percentage > 50 ? 'critical' : percentage > 20 ? 'high' : 'medium',
            count: missingCount,
            percentage
          });
        }
      }

      // Check for duplicate rows
      const duplicates = this.findDuplicateRows(data);
      if (duplicates.length > 0) {
        issues.push({
          type: 'duplicates',
          column: 'all',
          description: `${duplicates.length} duplicate rows found`,
          severity: duplicates.length > data.rows.length * 0.1 ? 'high' : 'medium',
          count: duplicates.length,
          percentage: (duplicates.length / data.rows.length) * 100
        });
      }

      // Check for outliers in numeric columns
      for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
        const column = data.headers[colIndex];
        const numericValues = data.rows
          .map(row => row[colIndex])
          .filter(val => val != null && !isNaN(Number(val)))
          .map(val => Number(val));

        if (numericValues.length > 10) {
          const outliers = this.detectOutliers(numericValues);
          if (outliers.length > 0) {
            issues.push({
              type: 'outliers',
              column,
              description: `${outliers.length} outliers detected`,
              severity: 'low',
              count: outliers.length,
              percentage: (outliers.length / numericValues.length) * 100,
              examples: outliers.slice(0, 5)
            });
          }
        }
      }

      // Check for format inconsistencies
      for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
        const column = data.headers[colIndex];
        const formatIssues = this.checkFormatConsistency(data.rows, colIndex);
        
        if (formatIssues.length > 0) {
          issues.push({
            type: 'format_errors',
            column,
            description: `${formatIssues.length} format inconsistencies`,
            severity: 'medium',
            count: formatIssues.length,
            percentage: (formatIssues.length / data.rows.length) * 100,
            examples: formatIssues.slice(0, 5)
          });
        }
      }

      const overallScore = this.calculateQualityScore(issues, stats);
      const recommendations = this.generateRecommendations(issues);

      return {
        overallScore,
        issues,
        recommendations,
        summary: {
          totalRows: stats.rowCount,
          totalColumns: stats.columnCount,
          missingValues: stats.missingValues,
          duplicateRows: duplicates.length,
          outliers: issues.filter(i => i.type === 'outliers').reduce((sum, i) => sum + i.count, 0)
        }
      };
    } catch (error) {
      this.logger.error('Error assessing data quality:', error);
      throw new Error(`Failed to assess data quality: ${error.message}`);
    }
  }

  /**
   * Clean data using specified operations
   */
  async cleanData(data: ParsedData, operations: string[]): Promise<CleaningResult> {
    try {
      this.logger.info(`Cleaning data with operations: ${operations.join(', ')}`);

      const beforeStats = this.calculateDataStats(data);
      let cleanedData = { ...data };
      const appliedOperations: CleaningOperation[] = [];
      let totalAffectedRows = 0;

      for (const operation of operations) {
        switch (operation) {
          case 'remove_duplicates':
            const duplicateResult = this.removeDuplicates(cleanedData);
            cleanedData = duplicateResult.data;
            totalAffectedRows += duplicateResult.affectedRows;
            appliedOperations.push({
              type: 'remove_duplicates',
              parameters: {}
            });
            break;

          case 'fill_missing_values':
            const fillResult = this.fillMissingValues(cleanedData);
            cleanedData = fillResult.data;
            totalAffectedRows += fillResult.affectedRows;
            appliedOperations.push({
              type: 'fill_missing',
              parameters: { strategy: 'mean_mode' }
            });
            break;

          case 'remove_outliers':
            const outlierResult = this.removeOutliers(cleanedData);
            cleanedData = outlierResult.data;
            totalAffectedRows += outlierResult.affectedRows;
            appliedOperations.push({
              type: 'remove_outliers',
              parameters: { method: 'iqr' }
            });
            break;

          case 'standardize_formats':
            const formatResult = this.standardizeFormats(cleanedData);
            cleanedData = formatResult.data;
            totalAffectedRows += formatResult.affectedRows;
            appliedOperations.push({
              type: 'standardize_format',
              parameters: {}
            });
            break;

          default:
            this.logger.warn(`Unknown cleaning operation: ${operation}`);
        }
      }

      const afterStats = this.calculateDataStats(cleanedData);

      return {
        success: true,
        message: `Data cleaned successfully. Applied ${appliedOperations.length} operations.`,
        affectedRows: totalAffectedRows,
        beforeStats,
        afterStats,
        operations: appliedOperations
      };
    } catch (error) {
      this.logger.error('Error cleaning data:', error);
      return {
        success: false,
        message: `Failed to clean data: ${error.message}`,
        affectedRows: 0,
        beforeStats: this.calculateDataStats(data),
        afterStats: this.calculateDataStats(data),
        operations: []
      };
    }
  }

  /**
   * Validate data against rules
   */
  async validateData(data: ParsedData, rules: ValidationRule[]): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating data with ${rules.length} rules`);

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const row = data.rows[rowIndex];

        for (const rule of rules) {
          const columnIndex = data.headers.indexOf(rule.column);
          if (columnIndex === -1) continue;

          const value = row[columnIndex];
          const validation = this.validateValue(value, rule);

          if (!validation.isValid) {
            if (validation.severity === 'error') {
              errors.push({
                row: rowIndex + 1,
                column: rule.column,
                value,
                rule: rule.type,
                message: validation.message
              });
            } else {
              warnings.push({
                row: rowIndex + 1,
                column: rule.column,
                value,
                message: validation.message
              });
            }
          }
        }
      }

      const totalRows = data.rows.length;
      const errorRows = new Set(errors.map(e => e.row)).size;
      const warningRows = new Set(warnings.map(w => w.row)).size;

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalRows,
          validRows: totalRows - errorRows,
          errorRows,
          warningRows
        }
      };
    } catch (error) {
      this.logger.error('Error validating data:', error);
      throw new Error(`Failed to validate data: ${error.message}`);
    }
  }

  // Private helper methods

  private determineFormat(extension: string): DataFormat {
    switch (extension) {
      case '.csv':
        return { type: 'csv', delimiter: ',', hasHeader: true };
      case '.json':
        return { type: 'json' };
      case '.xlsx':
      case '.xls':
        return { type: 'excel', hasHeader: true };
      default:
        throw new Error(`Unsupported file extension: ${extension}`);
    }
  }

  private async parseCSV(filePath: string, format: DataFormat): Promise<ParsedData> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const delimiter = format.delimiter || ',';
    
    const parseErrors: ParseError[] = [];
    const rows: any[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const row = this.parseCSVLine(lines[i], delimiter);
        rows.push(row);
      } catch (error) {
        parseErrors.push({
          row: i + 1,
          column: 'all',
          value: lines[i],
          error: error.message
        });
      }
    }

    const headers = format.hasHeader ? rows.shift() || [] : 
      Array.from({ length: rows[0]?.length || 0 }, (_, i) => `Column${i + 1}`);

    return {
      headers,
      rows,
      metadata: {
        totalRows: rows.length,
        totalColumns: headers.length,
        format,
        parseErrors
      }
    };
  }

  private async parseJSON(filePath: string): Promise<ParsedData> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    
    let rows: any[][];
    let headers: string[];

    if (Array.isArray(jsonData)) {
      if (jsonData.length === 0) {
        return {
          headers: [],
          rows: [],
          metadata: {
            totalRows: 0,
            totalColumns: 0,
            format: { type: 'json' },
            parseErrors: []
          }
        };
      }

      // Extract headers from first object
      headers = Object.keys(jsonData[0]);
      rows = jsonData.map(obj => headers.map(header => obj[header]));
    } else {
      throw new Error('JSON data must be an array of objects');
    }

    return {
      headers,
      rows,
      metadata: {
        totalRows: rows.length,
        totalColumns: headers.length,
        format: { type: 'json' },
        parseErrors: []
      }
    };
  }

  private async parseExcel(filePath: string, format: DataFormat): Promise<ParsedData> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = format.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const rows = jsonData as any[][];
    
    const headers = format.hasHeader ? rows.shift() || [] : 
      Array.from({ length: rows[0]?.length || 0 }, (_, i) => `Column${i + 1}`);

    return {
      headers,
      rows,
      metadata: {
        totalRows: rows.length,
        totalColumns: headers.length,
        format,
        parseErrors: []
      }
    };
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private calculateDataStats(data: ParsedData): DataStats {
    const stats: DataStats = {
      rowCount: data.rows.length,
      columnCount: data.headers.length,
      missingValues: 0,
      duplicateRows: 0,
      dataTypes: {},
      nullPercentage: {}
    };

    // Calculate missing values and data types
    for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
      const column = data.headers[colIndex];
      const values = data.rows.map(row => row[colIndex]);
      const nullCount = values.filter(val => val == null || val === '').length;
      
      stats.missingValues += nullCount;
      stats.nullPercentage[column] = (nullCount / data.rows.length) * 100;
      stats.dataTypes[column] = this.inferDataType(values);
    }

    // Calculate duplicate rows
    stats.duplicateRows = this.findDuplicateRows(data).length;

    return stats;
  }

  private findDuplicateRows(data: ParsedData): number[] {
    const seen = new Set<string>();
    const duplicates: number[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const rowKey = JSON.stringify(data.rows[i]);
      if (seen.has(rowKey)) {
        duplicates.push(i);
      } else {
        seen.add(rowKey);
      }
    }

    return duplicates;
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

  private checkFormatConsistency(rows: any[][], columnIndex: number): any[] {
    const values = rows.map(row => row[columnIndex]).filter(val => val != null);
    if (values.length === 0) return [];

    // Check for date format consistency
    const dateValues = values.filter(val => !isNaN(Date.parse(val)));
    if (dateValues.length > values.length * 0.5) {
      const formats = new Set<string>();
      dateValues.forEach(val => {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          formats.add(this.getDateFormat(val));
        }
      });
      
      if (formats.size > 1) {
        return values.filter(val => this.getDateFormat(val) !== Array.from(formats)[0]);
      }
    }

    return [];
  }

  private getDateFormat(dateString: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return 'YYYY-MM-DD';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return 'MM/DD/YYYY';
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) return 'MM-DD-YYYY';
    return 'unknown';
  }

  private calculateQualityScore(issues: DataQualityIssue[], stats: DataStats): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= issue.percentage * 0.8;
          break;
        case 'high':
          score -= issue.percentage * 0.5;
          break;
        case 'medium':
          score -= issue.percentage * 0.3;
          break;
        case 'low':
          score -= issue.percentage * 0.1;
          break;
      }
    }

    return Math.max(0, Math.round(score));
  }

  private generateRecommendations(issues: DataQualityIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'missing_values' && i.severity === 'critical')) {
      recommendations.push('Consider removing columns with >50% missing values or implement data collection improvements');
    }

    if (issues.some(i => i.type === 'duplicates')) {
      recommendations.push('Remove duplicate rows to improve data quality and reduce storage costs');
    }

    if (issues.some(i => i.type === 'outliers')) {
      recommendations.push('Investigate outliers - they may represent data errors or important edge cases');
    }

    if (issues.some(i => i.type === 'format_errors')) {
      recommendations.push('Standardize data formats to ensure consistency across the dataset');
    }

    if (recommendations.length === 0) {
      recommendations.push('Data quality is good. Consider regular monitoring to maintain quality over time');
    }

    return recommendations;
  }

  private inferDataType(values: any[]): string {
    const nonNullValues = values.filter(val => val != null && val !== '');
    if (nonNullValues.length === 0) return 'string';

    const numericCount = nonNullValues.filter(val => !isNaN(Number(val))).length;
    const dateCount = nonNullValues.filter(val => !isNaN(Date.parse(val))).length;
    const booleanCount = nonNullValues.filter(val => 
      typeof val === 'boolean' || val === 'true' || val === 'false'
    ).length;

    const total = nonNullValues.length;
    
    if (booleanCount / total > 0.8) return 'boolean';
    if (numericCount / total > 0.8) return 'number';
    if (dateCount / total > 0.8) return 'date';
    
    return 'string';
  }

  private removeDuplicates(data: ParsedData): { data: ParsedData; affectedRows: number } {
    const seen = new Set<string>();
    const uniqueRows: any[][] = [];
    let duplicateCount = 0;

    for (const row of data.rows) {
      const rowKey = JSON.stringify(row);
      if (!seen.has(rowKey)) {
        seen.add(rowKey);
        uniqueRows.push(row);
      } else {
        duplicateCount++;
      }
    }

    return {
      data: {
        ...data,
        rows: uniqueRows,
        metadata: {
          ...data.metadata,
          totalRows: uniqueRows.length
        }
      },
      affectedRows: duplicateCount
    };
  }

  private fillMissingValues(data: ParsedData): { data: ParsedData; affectedRows: number } {
    const filledRows = [...data.rows];
    let affectedRows = 0;

    for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
      const values = data.rows.map(row => row[colIndex]).filter(val => val != null && val !== '');
      
      if (values.length === 0) continue;

      const dataType = this.inferDataType(values);
      let fillValue: any;

      switch (dataType) {
        case 'number':
          const numericValues = values.map(val => Number(val)).filter(val => !isNaN(val));
          fillValue = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          break;
        case 'string':
          const counts = values.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          }, {} as { [key: string]: number });
          fillValue = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
          break;
        default:
          fillValue = values[0];
      }

      for (let rowIndex = 0; rowIndex < filledRows.length; rowIndex++) {
        if (filledRows[rowIndex][colIndex] == null || filledRows[rowIndex][colIndex] === '') {
          filledRows[rowIndex][colIndex] = fillValue;
          affectedRows++;
        }
      }
    }

    return {
      data: {
        ...data,
        rows: filledRows
      },
      affectedRows
    };
  }

  private removeOutliers(data: ParsedData): { data: ParsedData; affectedRows: number } {
    const filteredRows: any[][] = [];
    let removedCount = 0;

    for (const row of data.rows) {
      let isOutlier = false;

      for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
        const value = row[colIndex];
        if (value != null && !isNaN(Number(value))) {
          const columnValues = data.rows
            .map(r => r[colIndex])
            .filter(val => val != null && !isNaN(Number(val)))
            .map(val => Number(val));

          if (columnValues.length > 10) {
            const outliers = this.detectOutliers(columnValues);
            if (outliers.includes(Number(value))) {
              isOutlier = true;
              break;
            }
          }
        }
      }

      if (!isOutlier) {
        filteredRows.push(row);
      } else {
        removedCount++;
      }
    }

    return {
      data: {
        ...data,
        rows: filteredRows,
        metadata: {
          ...data.metadata,
          totalRows: filteredRows.length
        }
      },
      affectedRows: removedCount
    };
  }

  private standardizeFormats(data: ParsedData): { data: ParsedData; affectedRows: number } {
    const standardizedRows = [...data.rows];
    let affectedRows = 0;

    for (let colIndex = 0; colIndex < data.headers.length; colIndex++) {
      const values = data.rows.map(row => row[colIndex]).filter(val => val != null);
      const dataType = this.inferDataType(values);

      if (dataType === 'date') {
        for (let rowIndex = 0; rowIndex < standardizedRows.length; rowIndex++) {
          const value = standardizedRows[rowIndex][colIndex];
          if (value != null && !isNaN(Date.parse(value))) {
            const standardizedDate = new Date(value).toISOString().split('T')[0];
            if (standardizedDate !== value) {
              standardizedRows[rowIndex][colIndex] = standardizedDate;
              affectedRows++;
            }
          }
        }
      }
    }

    return {
      data: {
        ...data,
        rows: standardizedRows
      },
      affectedRows
    };
  }

  private validateValue(value: any, rule: ValidationRule): { isValid: boolean; severity: 'error' | 'warning'; message: string } {
    switch (rule.type) {
      case 'required':
        if (value == null || value === '') {
          return {
            isValid: false,
            severity: 'error',
            message: rule.message || 'Value is required'
          };
        }
        break;

      case 'type':
        const expectedType = rule.parameters.type;
        const actualType = this.inferDataType([value]);
        if (actualType !== expectedType) {
          return {
            isValid: false,
            severity: 'error',
            message: rule.message || `Expected ${expectedType}, got ${actualType}`
          };
        }
        break;

      case 'range':
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          const { min, max } = rule.parameters;
          if ((min != null && numValue < min) || (max != null && numValue > max)) {
            return {
              isValid: false,
              severity: 'warning',
              message: rule.message || `Value ${numValue} is outside range [${min}, ${max}]`
            };
          }
        }
        break;

      case 'pattern':
        const pattern = new RegExp(rule.parameters.pattern);
        if (!pattern.test(String(value))) {
          return {
            isValid: false,
            severity: 'error',
            message: rule.message || 'Value does not match required pattern'
          };
        }
        break;
    }

    return { isValid: true, severity: 'error', message: '' };
  }
}