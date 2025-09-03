import { Model, Document, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { Logger } from '../utils/logger';
import { NotFoundError, AppError } from '../utils/errors';

const logger = new Logger('BaseRepository');

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;
  protected logger: Logger;

  constructor(model: Model<T>, context: string) {
    this.model = model;
    this.logger = new Logger(`${context}Repository`);
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const document = new this.model(data);
      const saved = await document.save();
      
      this.logger.info('Document created', { id: saved.id });
      return saved;
    } catch (error) {
      this.logger.error('Failed to create document', error, { data });
      throw error;
    }
  }

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    try {
      const document = await this.model.findById(id, null, options);
      return document;
    } catch (error) {
      this.logger.error('Failed to find document by ID', error, { id });
      throw error;
    }
  }

  async findByIdOrThrow(id: string, options?: QueryOptions): Promise<T> {
    const document = await this.findById(id, options);
    if (!document) {
      throw new NotFoundError(`${this.model.modelName} with ID ${id}`);
    }
    return document;
  }

  async findOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    try {
      const document = await this.model.findOne(filter, null, options);
      return document;
    } catch (error) {
      this.logger.error('Failed to find document', error, { filter });
      throw error;
    }
  }

  async findMany(
    filter: FilterQuery<T> = {},
    options?: QueryOptions
  ): Promise<T[]> {
    try {
      const documents = await this.model.find(filter, null, options);
      return documents;
    } catch (error) {
      this.logger.error('Failed to find documents', error, { filter });
      throw error;
    }
  }

  async findWithPagination(
    filter: FilterQuery<T> = {},
    paginationOptions: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = paginationOptions;
      const skip = (page - 1) * limit;
      
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const [documents, total] = await Promise.all([
        this.model.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments(filter)
      ]);

      const pages = Math.ceil(total / limit);

      return {
        data: documents,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      this.logger.error('Failed to find documents with pagination', error, { filter, paginationOptions });
      throw error;
    }
  }

  async updateById(
    id: string,
    update: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    try {
      const document = await this.model.findByIdAndUpdate(id, update, options);
      
      if (document) {
        this.logger.info('Document updated', { id });
      }
      
      return document;
    } catch (error) {
      this.logger.error('Failed to update document', error, { id, update });
      throw error;
    }
  }

  async updateByIdOrThrow(
    id: string,
    update: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T> {
    const document = await this.updateById(id, update, options);
    if (!document) {
      throw new NotFoundError(`${this.model.modelName} with ID ${id}`);
    }
    return document;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    try {
      const document = await this.model.findOneAndUpdate(filter, update, options);
      return document;
    } catch (error) {
      this.logger.error('Failed to update document', error, { filter, update });
      throw error;
    }
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    try {
      const result = await this.model.updateMany(filter, update);
      
      this.logger.info('Documents updated', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      });
      
      return {
        matchedCount: result.matchedCount || 0,
        modifiedCount: result.modifiedCount || 0
      };
    } catch (error) {
      this.logger.error('Failed to update documents', error, { filter, update });
      throw error;
    }
  }

  async deleteById(id: string): Promise<T | null> {
    try {
      const document = await this.model.findByIdAndDelete(id);
      
      if (document) {
        this.logger.info('Document deleted', { id });
      }
      
      return document;
    } catch (error) {
      this.logger.error('Failed to delete document', error, { id });
      throw error;
    }
  }

  async deleteByIdOrThrow(id: string): Promise<T> {
    const document = await this.deleteById(id);
    if (!document) {
      throw new NotFoundError(`${this.model.modelName} with ID ${id}`);
    }
    return document;
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    try {
      const document = await this.model.findOneAndDelete(filter);
      return document;
    } catch (error) {
      this.logger.error('Failed to delete document', error, { filter });
      throw error;
    }
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    try {
      const result = await this.model.deleteMany(filter);
      
      this.logger.info('Documents deleted', {
        deletedCount: result.deletedCount
      });
      
      return {
        deletedCount: result.deletedCount || 0
      };
    } catch (error) {
      this.logger.error('Failed to delete documents', error, { filter });
      throw error;
    }
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      this.logger.error('Failed to count documents', error, { filter });
      throw error;
    }
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    try {
      const document = await this.model.findOne(filter).select('_id').lean();
      return !!document;
    } catch (error) {
      this.logger.error('Failed to check document existence', error, { filter });
      throw error;
    }
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    try {
      return await this.model.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to execute aggregation', error, { pipeline });
      throw error;
    }
  }

  // Transaction support
  async withTransaction<R>(
    operation: (session: any) => Promise<R>
  ): Promise<R> {
    const session = await this.model.db.startSession();
    
    try {
      session.startTransaction();
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Transaction failed', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}