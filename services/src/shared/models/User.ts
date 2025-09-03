import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User as IUser, UserRole, Permission } from '../types';

export interface UserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasPermission(permission: Permission): boolean;
  toJSON(): any;
}

const userSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER
  },
  permissions: [{
    type: String,
    enum: Object.values(Permission)
  }],
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      slack: { type: Boolean, default: false },
      taskReminders: { type: Boolean, default: true },
      workflowUpdates: { type: Boolean, default: true }
    },
    dashboard: {
      widgets: [{ type: String }],
      layout: {
        type: String,
        enum: ['grid', 'list'],
        default: 'grid'
      },
      refreshInterval: {
        type: Number,
        default: 30000
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check permissions
userSchema.methods.hasPermission = function(permission: Permission): boolean {
  return this.permissions.includes(permission);
};

// Set default permissions based on role
userSchema.pre('save', function(next) {
  if (!this.isModified('role')) return next();
  
  switch (this.role) {
    case UserRole.ADMIN:
      this.permissions = Object.values(Permission);
      break;
    case UserRole.MANAGER:
      this.permissions = [
        Permission.READ_TASKS,
        Permission.WRITE_TASKS,
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_WORKFLOWS
      ];
      break;
    case UserRole.USER:
      this.permissions = [
        Permission.READ_TASKS,
        Permission.WRITE_TASKS
      ];
      break;
    case UserRole.VIEWER:
      this.permissions = [
        Permission.READ_TASKS,
        Permission.VIEW_ANALYTICS
      ];
      break;
  }
  
  next();
});

export const UserModel = mongoose.model<UserDocument>('User', userSchema);