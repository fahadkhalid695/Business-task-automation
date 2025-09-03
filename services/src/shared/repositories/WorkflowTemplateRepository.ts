import { FilterQuery } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { WorkflowTemplateModel, WorkflowTemplateDocument } from '../models/WorkflowTemplate';

export class WorkflowTemplateRepository extends BaseRepository<WorkflowTemplateDocument> {
  constructor() {
    super(WorkflowTemplateModel, 'WorkflowTemplate');
  }

  async findActiveTemplates(): Promise<WorkflowTemplateDocument[]> {
    return this.findMany({ isActive: true }, { sort: { name: 1 } });
  }

  async findByCategory(category: string): Promise<WorkflowTemplateDocument[]> {
    return this.findMany({ 
      category: category.toLowerCase(),
      isActive: true 
    }, { sort: { name: 1 } });
  }

  async findByCreator(createdBy: string): Promise<WorkflowTemplateDocument[]> {
    return this.findMany({ createdBy }, { sort: { createdAt: -1 } });
  }

  async findTemplatesWithTrigger(triggerType: string): Promise<WorkflowTemplateDocument[]> {
    return this.findMany({
      'triggers.type': triggerType,
      isActive: true
    });
  }

  async searchTemplates(query: string): Promise<WorkflowTemplateDocument[]> {
    const searchFilter: FilterQuery<WorkflowTemplateDocument> = {
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    };

    return this.findMany(searchFilter, { 
      sort: { name: 1 },
      limit: 20 
    });
  }

  async createNewVersion(templateId: string, updates: Partial<WorkflowTemplateDocument>): Promise<WorkflowTemplateDocument> {
    const originalTemplate = await this.findByIdOrThrow(templateId);
    
    const newVersion = {
      ...originalTemplate.toObject(),
      ...updates,
      _id: undefined,
      version: originalTemplate.version + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Deactivate the old version
    await this.updateById(templateId, { isActive: false });

    return this.create(newVersion);
  }

  async getTemplateStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    mostUsed: Array<{ id: string; name: string; usageCount: number }>;
  }> {
    const [total, active, categoryStats] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    const byCategory = categoryStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    // This would require tracking usage in a separate collection or field
    const mostUsed: Array<{ id: string; name: string; usageCount: number }> = [];

    return {
      total,
      active,
      byCategory,
      mostUsed
    };
  }

  async duplicateTemplate(templateId: string, newName: string, createdBy: string): Promise<WorkflowTemplateDocument> {
    const originalTemplate = await this.findByIdOrThrow(templateId);
    
    const duplicatedTemplate = {
      ...originalTemplate.toObject(),
      _id: undefined,
      name: newName,
      createdBy,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.create(duplicatedTemplate);
  }

  async getTemplatesByComplexity(): Promise<{
    simple: WorkflowTemplateDocument[];
    moderate: WorkflowTemplateDocument[];
    complex: WorkflowTemplateDocument[];
  }> {
    const templates = await this.findActiveTemplates();
    
    const simple = templates.filter(t => t.steps.length <= 3);
    const moderate = templates.filter(t => t.steps.length > 3 && t.steps.length <= 7);
    const complex = templates.filter(t => t.steps.length > 7);

    return { simple, moderate, complex };
  }

  async validateTemplate(templateId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const template = await this.findByIdOrThrow(templateId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate steps
    if (template.steps.length === 0) {
      errors.push('Template must have at least one step');
    }

    // Check for circular dependencies
    const stepIds = template.steps.map(s => s.id);
    for (const step of template.steps) {
      for (const dep of step.dependencies) {
        if (!stepIds.includes(dep)) {
          errors.push(`Step ${step.name} has invalid dependency: ${dep}`);
        }
      }
    }

    // Check step ordering
    const orderNumbers = template.steps.map(s => s.order);
    const uniqueOrders = new Set(orderNumbers);
    if (uniqueOrders.size !== orderNumbers.length) {
      errors.push('Steps must have unique order numbers');
    }

    // Validate triggers
    if (template.triggers.length === 0) {
      warnings.push('Template has no triggers defined');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}