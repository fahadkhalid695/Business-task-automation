import { FilterQuery } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { UserModel, UserDocument } from '../models/User';
import { UserRole, Permission } from '../types';

export class UserRepository extends BaseRepository<UserDocument> {
  constructor() {
    super(UserModel, 'User');
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    try {
      const user = await this.model.findOne({ email: email.toLowerCase() }).select('+password');
      return user;
    } catch (error) {
      this.logger.error('Failed to find user by email with password', error, { email });
      throw error;
    }
  }

  async findActiveUsers(): Promise<UserDocument[]> {
    return this.findMany({ isActive: true });
  }

  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.findMany({ role, isActive: true });
  }

  async findUsersWithPermission(permission: Permission): Promise<UserDocument[]> {
    return this.findMany({ 
      permissions: { $in: [permission] },
      isActive: true 
    });
  }

  async updateLastLogin(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, { 
      $set: { 
        'metadata.lastLoginAt': new Date(),
        'metadata.loginCount': { $inc: 1 }
      }
    });
  }

  async deactivateUser(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, { 
      isActive: false,
      updatedAt: new Date()
    });
  }

  async updatePreferences(userId: string, preferences: any): Promise<UserDocument | null> {
    return this.updateById(userId, { 
      preferences,
      updatedAt: new Date()
    });
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    byRole: Record<string, number>;
  }> {
    const [total, active, roleStats] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    const byRole = roleStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    return { total, active, byRole };
  }

  async searchUsers(query: string, limit: number = 20): Promise<UserDocument[]> {
    const searchFilter: FilterQuery<UserDocument> = {
      $and: [
        { isActive: true },
        {
          $or: [
            { email: { $regex: query, $options: 'i' } },
            { 'profile.firstName': { $regex: query, $options: 'i' } },
            { 'profile.lastName': { $regex: query, $options: 'i' } }
          ]
        }
      ]
    };

    return this.findMany(searchFilter, { limit });
  }
}