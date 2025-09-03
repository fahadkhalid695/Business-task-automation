import { Logger } from '../utils/logger';
import { auditLogger, AuditEventType } from './AuditLogger';
import { encryptionService } from './EncryptionService';
import { UserDocument } from '../models/User';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

const logger = new Logger('BackupService');

export enum BackupType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
  DIFFERENTIAL = 'DIFFERENTIAL'
}

export enum BackupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RESTORED = 'RESTORED'
}

export interface BackupJob {
  id: string;
  type: BackupType;
  status: BackupStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size: number;
  location: string;
  encrypted: boolean;
  checksum: string;
  collections: string[];
  metadata: {
    version: string;
    systemInfo: Record<string, any>;
    createdBy: string;
    retentionPeriod: number;
  };
  error?: string;
}

export interface RestoreJob {
  id: string;
  backupId: string;
  status: BackupStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  collections: string[];
  targetDatabase?: string;
  createdBy: string;
  error?: string;
}

export interface BackupSchedule {
  id: string;
  name: string;
  type: BackupType;
  cronExpression: string;
  retentionPeriod: number; // days
  isActive: boolean;
  collections: string[];
  encryptBackup: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface DisasterRecoveryPlan {
  id: string;
  name: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  procedures: RecoveryProcedure[];
  contacts: EmergencyContact[];
  isActive: boolean;
  lastTested?: Date;
}

export interface RecoveryProcedure {
  step: number;
  title: string;
  description: string;
  estimatedTime: number; // minutes
  dependencies: string[];
  automatable: boolean;
  script?: string;
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

const backupJobSchema = new mongoose.Schema<BackupJob>({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: Object.values(BackupType), required: true },
  status: { type: String, enum: Object.values(BackupStatus), required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number },
  size: { type: Number, required: true },
  location: { type: String, required: true },
  encrypted: { type: Boolean, required: true },
  checksum: { type: String, required: true },
  collections: [{ type: String }],
  metadata: {
    version: { type: String, required: true },
    systemInfo: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: String, required: true },
    retentionPeriod: { type: Number, required: true }
  },
  error: { type: String }
});

const restoreJobSchema = new mongoose.Schema<RestoreJob>({
  id: { type: String, required: true, unique: true },
  backupId: { type: String, required: true },
  status: { type: String, enum: Object.values(BackupStatus), required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number },
  collections: [{ type: String }],
  targetDatabase: { type: String },
  createdBy: { type: String, required: true },
  error: { type: String }
});

const backupScheduleSchema = new mongoose.Schema<BackupSchedule>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: Object.values(BackupType), required: true },
  cronExpression: { type: String, required: true },
  retentionPeriod: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  collections: [{ type: String }],
  encryptBackup: { type: Boolean, default: true },
  lastRun: { type: Date },
  nextRun: { type: Date }
});

const BackupJobModel = mongoose.model<BackupJob>('BackupJob', backupJobSchema);
const RestoreJobModel = mongoose.model<RestoreJob>('RestoreJob', restoreJobSchema);
const BackupScheduleModel = mongoose.model<BackupSchedule>('BackupSchedule', backupScheduleSchema);

export class BackupService {
  private backupDirectory: string;
  private maxConcurrentBackups: number = 2;
  private activeBackups: Set<string> = new Set();

  constructor() {
    this.backupDirectory = process.env.BACKUP_DIRECTORY || path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
  }

  /**
   * Create a database backup
   */
  async createBackup(
    type: BackupType = BackupType.FULL,
    collections: string[] = [],
    user: UserDocument,
    options: {
      encrypt?: boolean;
      retentionPeriod?: number;
      description?: string;
    } = {}
  ): Promise<BackupJob> {
    const backupId = encryptionService.generateSecureToken(16);
    
    if (this.activeBackups.size >= this.maxConcurrentBackups) {
      throw new Error('Maximum concurrent backups reached');
    }

    const backupJob: BackupJob = {
      id: backupId,
      type,
      status: BackupStatus.PENDING,
      startTime: new Date(),
      size: 0,
      location: '',
      encrypted: options.encrypt !== false,
      checksum: '',
      collections: collections.length > 0 ? collections : await this.getAllCollections(),
      metadata: {
        version: process.env.SYSTEM_VERSION || '1.0.0',
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        createdBy: user.id,
        retentionPeriod: options.retentionPeriod || 30
      }
    };

    try {
      // Save initial backup job
      await BackupJobModel.create(backupJob);
      this.activeBackups.add(backupId);

      // Log backup start
      await auditLogger.logEvent(
        AuditEventType.BACKUP_CREATED,
        'Database backup started',
        {
          backupId,
          type,
          collections: backupJob.collections,
          encrypted: backupJob.encrypted
        },
        {
          user,
          complianceFlags: ['DATA_BACKUP', 'DISASTER_RECOVERY']
        }
      );

      // Perform backup asynchronously
      this.performBackup(backupJob).catch(error => {
        logger.error('Backup failed', { backupId, error: error.message });
      });

      return backupJob;
    } catch (error) {
      this.activeBackups.delete(backupId);
      logger.error('Failed to create backup', { backupId, error: error.message });
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    backupId: string,
    user: UserDocument,
    options: {
      collections?: string[];
      targetDatabase?: string;
      overwrite?: boolean;
    } = {}
  ): Promise<RestoreJob> {
    const restoreId = encryptionService.generateSecureToken(16);

    try {
      // Get backup job
      const backupJob = await BackupJobModel.findOne({ id: backupId }).lean();
      if (!backupJob) {
        throw new Error('Backup not found');
      }

      if (backupJob.status !== BackupStatus.COMPLETED) {
        throw new Error('Backup is not in completed state');
      }

      const restoreJob: RestoreJob = {
        id: restoreId,
        backupId,
        status: BackupStatus.PENDING,
        startTime: new Date(),
        collections: options.collections || backupJob.collections,
        targetDatabase: options.targetDatabase,
        createdBy: user.id
      };

      // Save restore job
      await RestoreJobModel.create(restoreJob);

      // Log restore start
      await auditLogger.logEvent(
        AuditEventType.BACKUP_RESTORED,
        'Database restore started',
        {
          restoreId,
          backupId,
          collections: restoreJob.collections,
          targetDatabase: restoreJob.targetDatabase
        },
        {
          user,
          complianceFlags: ['DATA_RESTORE', 'DISASTER_RECOVERY']
        }
      );

      // Perform restore asynchronously
      this.performRestore(restoreJob, backupJob).catch(error => {
        logger.error('Restore failed', { restoreId, error: error.message });
      });

      return restoreJob;
    } catch (error) {
      logger.error('Failed to start restore', { backupId, error: error.message });
      throw error;
    }
  }

  /**
   * Schedule automatic backups
   */
  async scheduleBackup(schedule: Omit<BackupSchedule, 'id'>): Promise<BackupSchedule> {
    const scheduleId = encryptionService.generateSecureToken(16);
    
    const backupSchedule: BackupSchedule = {
      id: scheduleId,
      ...schedule
    };

    await BackupScheduleModel.create(backupSchedule);
    
    logger.info('Backup schedule created', { scheduleId, name: schedule.name });
    return backupSchedule;
  }

  /**
   * Get backup status
   */
  async getBackupStatus(backupId: string): Promise<BackupJob | null> {
    return await BackupJobModel.findOne({ id: backupId }).lean();
  }

  /**
   * List all backups
   */
  async listBackups(filters: {
    type?: BackupType;
    status?: BackupStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<BackupJob[]> {
    const query: any = {};

    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.startTime = {};
      if (filters.startDate) query.startTime.$gte = filters.startDate;
      if (filters.endDate) query.startTime.$lte = filters.endDate;
    }

    return await BackupJobModel
      .find(query)
      .sort({ startTime: -1 })
      .limit(filters.limit || 50)
      .lean();
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Default 90 days

      const oldBackups = await BackupJobModel.find({
        startTime: { $lt: cutoffDate },
        status: BackupStatus.COMPLETED
      }).lean();

      let deletedCount = 0;

      for (const backup of oldBackups) {
        try {
          // Delete backup file
          await fs.unlink(backup.location);
          
          // Delete database record
          await BackupJobModel.deleteOne({ id: backup.id });
          
          deletedCount++;
          
          logger.info('Deleted old backup', { backupId: backup.id });
        } catch (error) {
          logger.error('Failed to delete backup', { backupId: backup.id, error: error.message });
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error('Backup cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Test backup integrity
   */
  async testBackupIntegrity(backupId: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const backupJob = await BackupJobModel.findOne({ id: backupId }).lean();
      if (!backupJob) {
        return { valid: false, errors: ['Backup not found'] };
      }

      const errors: string[] = [];

      // Check if file exists
      try {
        await fs.access(backupJob.location);
      } catch {
        errors.push('Backup file not found');
      }

      // Verify checksum
      const currentChecksum = await this.calculateFileChecksum(backupJob.location);
      if (currentChecksum !== backupJob.checksum) {
        errors.push('Checksum mismatch - backup may be corrupted');
      }

      // Test decompression if compressed
      if (backupJob.location.endsWith('.gz')) {
        try {
          await this.testDecompression(backupJob.location);
        } catch (error) {
          errors.push('Failed to decompress backup file');
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      logger.error('Backup integrity test failed', { backupId, error: error.message });
      return { valid: false, errors: [error.message] };
    }
  }

  private async performBackup(backupJob: BackupJob): Promise<void> {
    try {
      // Update status to in progress
      await BackupJobModel.updateOne(
        { id: backupJob.id },
        { status: BackupStatus.IN_PROGRESS }
      );

      // Create backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${backupJob.type.toLowerCase()}-${timestamp}.json`;
      const filepath = path.join(this.backupDirectory, filename);

      // Export data from collections
      const backupData: Record<string, any[]> = {};
      
      for (const collectionName of backupJob.collections) {
        try {
          const collection = mongoose.connection.db.collection(collectionName);
          const documents = await collection.find({}).toArray();
          backupData[collectionName] = documents;
          
          logger.info('Backed up collection', { 
            collection: collectionName, 
            documents: documents.length 
          });
        } catch (error) {
          logger.error('Failed to backup collection', { 
            collection: collectionName, 
            error: error.message 
          });
        }
      }

      // Write backup data
      let finalPath = filepath;
      
      if (backupJob.encrypted) {
        const encryptedData = encryptionService.encryptForStorage(backupData);
        await fs.writeFile(filepath, encryptedData);
      } else {
        await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
      }

      // Compress backup
      const compressedPath = `${filepath}.gz`;
      await this.compressFile(filepath, compressedPath);
      await fs.unlink(filepath); // Remove uncompressed file
      finalPath = compressedPath;

      // Calculate file size and checksum
      const stats = await fs.stat(finalPath);
      const checksum = await this.calculateFileChecksum(finalPath);

      // Update backup job
      const endTime = new Date();
      await BackupJobModel.updateOne(
        { id: backupJob.id },
        {
          status: BackupStatus.COMPLETED,
          endTime,
          duration: endTime.getTime() - backupJob.startTime.getTime(),
          size: stats.size,
          location: finalPath,
          checksum
        }
      );

      logger.info('Backup completed successfully', {
        backupId: backupJob.id,
        size: stats.size,
        duration: endTime.getTime() - backupJob.startTime.getTime()
      });

    } catch (error) {
      // Update backup job with error
      await BackupJobModel.updateOne(
        { id: backupJob.id },
        {
          status: BackupStatus.FAILED,
          endTime: new Date(),
          error: error.message
        }
      );

      logger.error('Backup failed', { backupId: backupJob.id, error: error.message });
    } finally {
      this.activeBackups.delete(backupJob.id);
    }
  }

  private async performRestore(restoreJob: RestoreJob, backupJob: BackupJob): Promise<void> {
    try {
      // Update status to in progress
      await RestoreJobModel.updateOne(
        { id: restoreJob.id },
        { status: BackupStatus.IN_PROGRESS }
      );

      // Decompress backup file
      const tempPath = `${backupJob.location}.temp`;
      await this.decompressFile(backupJob.location, tempPath);

      // Read backup data
      let backupData: Record<string, any[]>;
      
      if (backupJob.encrypted) {
        const encryptedContent = await fs.readFile(tempPath, 'utf-8');
        backupData = encryptionService.decryptFromStorage(encryptedContent);
      } else {
        const content = await fs.readFile(tempPath, 'utf-8');
        backupData = JSON.parse(content);
      }

      // Restore collections
      for (const collectionName of restoreJob.collections) {
        if (backupData[collectionName]) {
          try {
            const collection = mongoose.connection.db.collection(collectionName);
            
            // Clear existing data if overwrite is enabled
            await collection.deleteMany({});
            
            // Insert backup data
            if (backupData[collectionName].length > 0) {
              await collection.insertMany(backupData[collectionName]);
            }
            
            logger.info('Restored collection', {
              collection: collectionName,
              documents: backupData[collectionName].length
            });
          } catch (error) {
            logger.error('Failed to restore collection', {
              collection: collectionName,
              error: error.message
            });
          }
        }
      }

      // Clean up temp file
      await fs.unlink(tempPath);

      // Update restore job
      const endTime = new Date();
      await RestoreJobModel.updateOne(
        { id: restoreJob.id },
        {
          status: BackupStatus.COMPLETED,
          endTime,
          duration: endTime.getTime() - restoreJob.startTime.getTime()
        }
      );

      logger.info('Restore completed successfully', {
        restoreId: restoreJob.id,
        backupId: restoreJob.backupId
      });

    } catch (error) {
      // Update restore job with error
      await RestoreJobModel.updateOne(
        { id: restoreJob.id },
        {
          status: BackupStatus.FAILED,
          endTime: new Date(),
          error: error.message
        }
      );

      logger.error('Restore failed', { restoreId: restoreJob.id, error: error.message });
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDirectory);
    } catch {
      await fs.mkdir(this.backupDirectory, { recursive: true });
      logger.info('Created backup directory', { directory: this.backupDirectory });
    }
  }

  private async getAllCollections(): Promise<string[]> {
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map(col => col.name);
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);
    const gzipStream = createGzip();

    await pipeline(readStream, gzipStream, writeStream);
  }

  private async decompressFile(inputPath: string, outputPath: string): Promise<void> {
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);
    const gunzipStream = createGunzip();

    await pipeline(readStream, gunzipStream, writeStream);
  }

  private async testDecompression(filePath: string): Promise<void> {
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    return new Promise((resolve, reject) => {
      gunzipStream.on('error', reject);
      gunzipStream.on('end', resolve);
      readStream.pipe(gunzipStream);
    });
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}

export const backupService = new BackupService();