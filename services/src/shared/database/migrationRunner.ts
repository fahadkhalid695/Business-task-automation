import mongoose from 'mongoose';
import { Logger } from '../utils/logger';

const logger = new Logger('MigrationRunner');

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Migration tracking schema
const migrationSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  executedAt: { type: Date, default: Date.now }
});

const MigrationModel = mongoose.model('Migration', migrationSchema);

export class MigrationRunner {
  private migrations: Migration[] = [];

  constructor() {
    this.loadMigrations();
  }

  private async loadMigrations(): Promise<void> {
    // Import all migration files
    const migration001 = await import('./migrations/001_initial_setup');
    
    this.migrations = [
      {
        version: 1,
        name: 'initial_setup',
        up: migration001.up,
        down: migration001.down
      }
    ];

    // Sort migrations by version
    this.migrations.sort((a, b) => a.version - b.version);
  }

  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations');

      // Get executed migrations
      const executedMigrations = await MigrationModel.find().sort({ version: 1 });
      const executedVersions = new Set(executedMigrations.map(m => m.version));

      // Run pending migrations
      for (const migration of this.migrations) {
        if (!executedVersions.has(migration.version)) {
          logger.info(`Running migration ${migration.version}: ${migration.name}`);
          
          await migration.up();
          
          // Record migration as executed
          await MigrationModel.create({
            version: migration.version,
            name: migration.name
          });
          
          logger.info(`Migration ${migration.version} completed successfully`);
        } else {
          logger.info(`Migration ${migration.version} already executed, skipping`);
        }
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', error);
      throw error;
    }
  }

  async rollbackMigration(version: number): Promise<void> {
    try {
      logger.info(`Rolling back migration ${version}`);

      const migration = this.migrations.find(m => m.version === version);
      if (!migration) {
        throw new Error(`Migration ${version} not found`);
      }

      const executedMigration = await MigrationModel.findOne({ version });
      if (!executedMigration) {
        throw new Error(`Migration ${version} was not executed`);
      }

      await migration.down();
      await MigrationModel.deleteOne({ version });

      logger.info(`Migration ${version} rolled back successfully`);
    } catch (error) {
      logger.error(`Rollback of migration ${version} failed`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<{
    executed: Array<{ version: number; name: string; executedAt: Date }>;
    pending: Array<{ version: number; name: string }>;
  }> {
    const executedMigrations = await MigrationModel.find().sort({ version: 1 });
    const executedVersions = new Set(executedMigrations.map(m => m.version));

    const executed = executedMigrations.map(m => ({
      version: m.version,
      name: m.name,
      executedAt: m.executedAt
    }));

    const pending = this.migrations
      .filter(m => !executedVersions.has(m.version))
      .map(m => ({
        version: m.version,
        name: m.name
      }));

    return { executed, pending };
  }

  async resetDatabase(): Promise<void> {
    logger.warn('Resetting database - this will drop all data!');
    
    // Drop all collections except system collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      if (!collection.name.startsWith('system.')) {
        await mongoose.connection.db.dropCollection(collection.name);
        logger.info(`Dropped collection: ${collection.name}`);
      }
    }

    logger.info('Database reset completed');
  }
}