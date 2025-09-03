import mongoose from 'mongoose';
import { Logger } from '../../utils/logger';
import { UserModel } from '../../models/User';
import { UserRole } from '../../types';

const logger = new Logger('Migration001');

export const up = async (): Promise<void> => {
  try {
    logger.info('Running migration 001: Initial setup');

    // Create indexes for all collections
    await createIndexes();

    // Create default admin user
    await createDefaultAdmin();

    // Create default workflow templates
    await createDefaultWorkflowTemplates();

    logger.info('Migration 001 completed successfully');
  } catch (error) {
    logger.error('Migration 001 failed', error);
    throw error;
  }
};

export const down = async (): Promise<void> => {
  try {
    logger.info('Rolling back migration 001');

    // Remove default data
    await UserModel.deleteOne({ email: 'admin@example.com' });

    logger.info('Migration 001 rollback completed');
  } catch (error) {
    logger.error('Migration 001 rollback failed', error);
    throw error;
  }
};

const createIndexes = async (): Promise<void> => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  
  for (const collection of collections) {
    logger.info(`Creating indexes for collection: ${collection.name}`);
    
    // This will trigger the index creation defined in the schemas
    const model = mongoose.connection.models[collection.name];
    if (model) {
      await model.createIndexes();
    }
  }
};

const createDefaultAdmin = async (): Promise<void> => {
  const existingAdmin = await UserModel.findOne({ email: 'admin@example.com' });
  
  if (!existingAdmin) {
    const adminUser = new UserModel({
      email: 'admin@example.com',
      password: 'password123', // This will be hashed by the pre-save middleware
      role: UserRole.ADMIN,
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          slack: false,
          taskReminders: true,
          workflowUpdates: true
        },
        dashboard: {
          widgets: ['tasks', 'workflows', 'analytics'],
          layout: 'grid',
          refreshInterval: 30000
        }
      },
      isActive: true
    });

    await adminUser.save();
    logger.info('Default admin user created');
  } else {
    logger.info('Default admin user already exists');
  }
};

const createDefaultWorkflowTemplates = async (): Promise<void> => {
  const { WorkflowTemplateModel } = await import('../../models/WorkflowTemplate');
  
  const defaultTemplates = [
    {
      name: 'Email Processing Workflow',
      description: 'Automatically process and categorize incoming emails',
      category: 'administrative',
      steps: [
        {
          id: 'step_1',
          name: 'Extract Email Content',
          type: 'ai_processing',
          configuration: {
            model: 'text-analysis',
            operation: 'extract_content'
          },
          dependencies: [],
          order: 1
        },
        {
          id: 'step_2',
          name: 'Categorize Email',
          type: 'ai_processing',
          configuration: {
            model: 'classification',
            operation: 'categorize'
          },
          dependencies: ['step_1'],
          order: 2
        },
        {
          id: 'step_3',
          name: 'Route to Department',
          type: 'conditional',
          configuration: {
            condition: 'category === "urgent"',
            trueAction: 'notify_manager',
            falseAction: 'assign_to_queue'
          },
          dependencies: ['step_2'],
          order: 3
        }
      ],
      triggers: [
        {
          type: 'email_received',
          configuration: {
            filters: ['from_external']
          }
        }
      ],
      isActive: true,
      version: 1,
      createdBy: 'system'
    },
    {
      name: 'Document Generation Workflow',
      description: 'Generate documents from templates with data',
      category: 'administrative',
      steps: [
        {
          id: 'step_1',
          name: 'Validate Input Data',
          type: 'data_transformation',
          configuration: {
            operation: 'validate',
            schema: 'document_input'
          },
          dependencies: [],
          order: 1
        },
        {
          id: 'step_2',
          name: 'Generate Document',
          type: 'ai_processing',
          configuration: {
            model: 'document-generator',
            template: 'dynamic'
          },
          dependencies: ['step_1'],
          order: 2
        },
        {
          id: 'step_3',
          name: 'Send for Review',
          type: 'user_approval',
          configuration: {
            approvers: ['manager'],
            autoApprove: false
          },
          dependencies: ['step_2'],
          order: 3
        }
      ],
      triggers: [
        {
          type: 'manual',
          configuration: {}
        }
      ],
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  ];

  for (const template of defaultTemplates) {
    const existing = await WorkflowTemplateModel.findOne({ name: template.name });
    if (!existing) {
      await WorkflowTemplateModel.create(template);
      logger.info(`Created default workflow template: ${template.name}`);
    }
  }
};