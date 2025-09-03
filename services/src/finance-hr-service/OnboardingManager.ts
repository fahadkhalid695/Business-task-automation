import { 
  OnboardingRequest, 
  OnboardingResult,
  OnboardingPlan,
  GeneratedForm,
  TrainingMaterial,
  OnboardingTimeline,
  ScheduledTask,
  Milestone,
  Checkpoint,
  EmployeeBuddy,
  FormType,
  TaskCategory,
  ExternalIntegration
} from './types/FinanceHRTypes';
import { logger } from '../shared/utils/logger';
import { TaskStatus } from '../shared/types';

/**
 * OnboardingManager - Handles employee onboarding workflow automation with forms and training materials
 */
export class OnboardingManager {
  private integrations: Map<string, ExternalIntegration>;
  private formTemplates: Map<FormType, any>;
  private trainingCatalog: Map<string, TrainingMaterial>;

  constructor() {
    this.integrations = new Map();
    this.formTemplates = new Map();
    this.trainingCatalog = new Map();
    this.initializeFormTemplates();
    this.initializeTrainingCatalog();
  }

  /**
   * Create comprehensive onboarding plan with forms and training materials
   */
  async createOnboarding(request: OnboardingRequest): Promise<OnboardingResult> {
    logger.info(`Creating onboarding plan for employee ${request.newEmployee.employeeId}`, {
      position: request.newEmployee.position,
      department: request.newEmployee.department,
      startDate: request.newEmployee.startDate
    });

    // Generate onboarding plan
    const onboardingPlan = await this.generateOnboardingPlan(request);
    
    // Generate required forms
    const generatedForms = await this.generateForms(request);
    
    // Assign training materials
    const trainingMaterials = await this.assignTrainingMaterials(request);
    
    // Create timeline
    const timeline = this.createTimeline(request.onboardingTemplate, request.newEmployee.startDate);
    
    // Assign buddy if applicable
    const assignedBuddy = await this.assignBuddy(request.newEmployee);

    return {
      onboardingPlan,
      generatedForms,
      trainingMaterials,
      timeline,
      assignedBuddy
    };
  }

  /**
   * Generate detailed onboarding plan with scheduled tasks
   */
  private async generateOnboardingPlan(request: OnboardingRequest): Promise<OnboardingPlan> {
    const startDate = request.newEmployee.startDate;
    const estimatedCompletion = new Date(startDate);
    estimatedCompletion.setDate(estimatedCompletion.getDate() + request.onboardingTemplate.duration);

    // Create scheduled tasks from template
    const tasks: ScheduledTask[] = [];
    
    for (const templateTask of request.onboardingTemplate.tasks) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + templateTask.dueDate);

      const scheduledTask: ScheduledTask = {
        taskId: templateTask.id,
        title: templateTask.title,
        assignedTo: this.resolveAssignee(templateTask.assignedTo, request.newEmployee),
        dueDate,
        status: TaskStatus.PENDING,
        dependencies: templateTask.dependencies,
        completedAt: undefined
      };

      tasks.push(scheduledTask);
    }

    // Create milestones
    const milestones = this.createMilestones(startDate, request.onboardingTemplate.duration);
    
    // Create checkpoints
    const checkpoints = this.createCheckpoints(startDate, request.newEmployee);

    return {
      employeeId: request.newEmployee.employeeId,
      startDate,
      estimatedCompletion,
      tasks,
      milestones,
      checkpoints
    };
  }

  /**
   * Generate required forms for new employee
   */
  private async generateForms(request: OnboardingRequest): Promise<GeneratedForm[]> {
    const generatedForms: GeneratedForm[] = [];

    for (const formTemplate of request.onboardingTemplate.forms) {
      try {
        const form = await this.generateForm(formTemplate, request.newEmployee);
        generatedForms.push(form);
      } catch (error) {
        logger.error(`Failed to generate form ${formTemplate.name}`, { error: error.message });
      }
    }

    return generatedForms;
  }

  /**
   * Generate individual form from template
   */
  private async generateForm(formTemplate: any, employee: any): Promise<GeneratedForm> {
    const template = this.formTemplates.get(formTemplate.type);
    
    if (!template) {
      throw new Error(`Form template not found for type: ${formTemplate.type}`);
    }

    // Pre-fill form with employee data
    const prefilledContent = this.prefillForm(template, employee);
    
    const dueDate = new Date(employee.startDate);
    dueDate.setDate(dueDate.getDate() + formTemplate.dueDate);

    return {
      formId: this.generateFormId(),
      name: formTemplate.name,
      type: formTemplate.type,
      content: prefilledContent,
      prefilled: true,
      dueDate,
      submissionUrl: `/forms/submit/${formTemplate.type}/${employee.employeeId}`
    };
  }

  /**
   * Assign relevant training materials based on position and department
   */
  private async assignTrainingMaterials(request: OnboardingRequest): Promise<TrainingMaterial[]> {
    const assignedMaterials: TrainingMaterial[] = [];

    // Add general onboarding materials
    const generalMaterials = Array.from(this.trainingCatalog.values()).filter(material => 
      material.title.toLowerCase().includes('general') || 
      material.title.toLowerCase().includes('company')
    );
    assignedMaterials.push(...generalMaterials);

    // Add department-specific materials
    const departmentMaterials = Array.from(this.trainingCatalog.values()).filter(material => 
      material.title.toLowerCase().includes(request.newEmployee.department.toLowerCase())
    );
    assignedMaterials.push(...departmentMaterials);

    // Add position-specific materials
    const positionMaterials = Array.from(this.trainingCatalog.values()).filter(material => 
      material.title.toLowerCase().includes(request.newEmployee.position.toLowerCase())
    );
    assignedMaterials.push(...positionMaterials);

    // Add required training from template
    for (const trainingModule of request.onboardingTemplate.trainingModules) {
      const material = this.trainingCatalog.get(trainingModule);
      if (material) {
        assignedMaterials.push(material);
      }
    }

    // Remove duplicates
    const uniqueMaterials = assignedMaterials.filter((material, index, self) => 
      index === self.findIndex(m => m.id === material.id)
    );

    logger.debug(`Assigned ${uniqueMaterials.length} training materials`, {
      employeeId: request.newEmployee.employeeId,
      materials: uniqueMaterials.map(m => m.title)
    });

    return uniqueMaterials;
  }

  /**
   * Create onboarding timeline with phases
   */
  private createTimeline(template: any, startDate: Date): OnboardingTimeline {
    const phases = [
      {
        name: 'Pre-boarding',
        startDay: -5,
        endDay: 0,
        tasks: ['Send welcome email', 'Prepare workspace', 'Order equipment'],
        deliverables: ['Welcome package', 'Equipment setup', 'Access credentials']
      },
      {
        name: 'First Day',
        startDay: 1,
        endDay: 1,
        tasks: ['Office tour', 'Meet team', 'Complete paperwork'],
        deliverables: ['Employee handbook', 'ID badge', 'System access']
      },
      {
        name: 'First Week',
        startDay: 2,
        endDay: 7,
        tasks: ['Department orientation', 'Initial training', 'Shadow colleagues'],
        deliverables: ['Training completion', 'Initial feedback', 'Goal setting']
      },
      {
        name: 'First Month',
        startDay: 8,
        endDay: 30,
        tasks: ['Role-specific training', 'Project assignments', 'Performance check-ins'],
        deliverables: ['Training certifications', 'First project', '30-day review']
      },
      {
        name: 'First Quarter',
        startDay: 31,
        endDay: 90,
        tasks: ['Advanced training', 'Mentorship program', 'Performance evaluation'],
        deliverables: ['Skill assessments', 'Career plan', '90-day review']
      }
    ];

    const criticalPath = [
      'Complete tax forms',
      'System access setup',
      'Safety training',
      'Department orientation',
      '30-day review',
      '90-day evaluation'
    ];

    return {
      phases,
      totalDuration: template.duration,
      criticalPath
    };
  }

  /**
   * Create milestones for onboarding process
   */
  private createMilestones(startDate: Date, duration: number): Milestone[] {
    const milestones: Milestone[] = [];

    // Day 1 milestone
    const day1 = new Date(startDate);
    milestones.push({
      name: 'First Day Complete',
      description: 'Employee has completed first day orientation',
      targetDate: day1,
      criteria: ['Office tour completed', 'Team introductions made', 'Basic paperwork submitted'],
      isCompleted: false
    });

    // Week 1 milestone
    const week1 = new Date(startDate);
    week1.setDate(week1.getDate() + 7);
    milestones.push({
      name: 'First Week Complete',
      description: 'Employee has completed initial training and orientation',
      targetDate: week1,
      criteria: ['All required forms submitted', 'Initial training completed', 'Workspace setup'],
      isCompleted: false
    });

    // Month 1 milestone
    const month1 = new Date(startDate);
    month1.setDate(month1.getDate() + 30);
    milestones.push({
      name: '30-Day Review',
      description: 'Employee has completed 30-day performance review',
      targetDate: month1,
      criteria: ['Role-specific training completed', 'First project assigned', 'Manager feedback received'],
      isCompleted: false
    });

    // Final milestone
    const final = new Date(startDate);
    final.setDate(final.getDate() + duration);
    milestones.push({
      name: 'Onboarding Complete',
      description: 'Employee has successfully completed onboarding process',
      targetDate: final,
      criteria: ['All training completed', 'Performance goals set', 'Full productivity achieved'],
      isCompleted: false
    });

    return milestones;
  }

  /**
   * Create checkpoints for regular reviews
   */
  private createCheckpoints(startDate: Date, employee: any): Checkpoint[] {
    const checkpoints: Checkpoint[] = [];

    // Day 3 checkpoint
    const day3 = new Date(startDate);
    day3.setDate(day3.getDate() + 3);
    checkpoints.push({
      name: 'Initial Check-in',
      date: day3,
      participants: [employee.manager, 'hr@company.com'],
      agenda: ['How is the first few days going?', 'Any immediate concerns?', 'Equipment and access working?'],
      isCompleted: false
    });

    // Week 2 checkpoint
    const week2 = new Date(startDate);
    week2.setDate(week2.getDate() + 14);
    checkpoints.push({
      name: 'Two-Week Review',
      date: week2,
      participants: [employee.manager, 'hr@company.com'],
      agenda: ['Training progress review', 'Team integration feedback', 'Goal clarification'],
      isCompleted: false
    });

    // Month 1 checkpoint
    const month1 = new Date(startDate);
    month1.setDate(month1.getDate() + 30);
    checkpoints.push({
      name: '30-Day Performance Review',
      date: month1,
      participants: [employee.manager, 'hr@company.com'],
      agenda: ['Performance evaluation', 'Goal setting for next period', 'Career development discussion'],
      isCompleted: false
    });

    return checkpoints;
  }

  /**
   * Assign a buddy/mentor to new employee
   */
  private async assignBuddy(employee: any): Promise<EmployeeBuddy | undefined> {
    // In a real implementation, this would query the employee database
    // For now, we'll create a mock buddy assignment
    
    const buddyPool = [
      {
        employeeId: 'buddy001',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@company.com',
        department: employee.department,
        experience: 3,
        specialties: ['onboarding', 'team_integration']
      },
      {
        employeeId: 'buddy002',
        name: 'Mike Chen',
        email: 'mike.chen@company.com',
        department: employee.department,
        experience: 5,
        specialties: ['technical_training', 'mentorship']
      }
    ];

    // Simple assignment logic - in reality would be more sophisticated
    const assignedBuddy = buddyPool[Math.floor(Math.random() * buddyPool.length)];

    logger.info(`Assigned buddy ${assignedBuddy.name} to employee ${employee.employeeId}`);

    return assignedBuddy;
  }

  /**
   * Resolve task assignee based on role
   */
  private resolveAssignee(assignedTo: string, employee: any): string {
    switch (assignedTo) {
      case 'employee':
        return employee.email;
      case 'manager':
        return employee.manager;
      case 'hr':
        return 'hr@company.com';
      case 'it':
        return 'it@company.com';
      default:
        return assignedTo;
    }
  }

  /**
   * Pre-fill form with employee data
   */
  private prefillForm(template: any, employee: any): string {
    let content = template.content;

    // Replace placeholders with employee data
    content = content.replace(/\{employee\.name\}/g, employee.personalInfo?.name || employee.employeeId);
    content = content.replace(/\{employee\.email\}/g, employee.personalInfo?.email || '');
    content = content.replace(/\{employee\.phone\}/g, employee.personalInfo?.phone || '');
    content = content.replace(/\{employee\.startDate\}/g, employee.startDate.toISOString().split('T')[0]);
    content = content.replace(/\{employee\.position\}/g, employee.position);
    content = content.replace(/\{employee\.department\}/g, employee.department);
    content = content.replace(/\{employee\.manager\}/g, employee.manager);

    return content;
  }

  /**
   * Initialize form templates
   */
  private initializeFormTemplates(): void {
    this.formTemplates.set(FormType.TAX_FORMS, {
      content: `
        <form id="tax-forms">
          <h2>Tax Information Forms</h2>
          <div class="form-group">
            <label>Employee Name:</label>
            <input type="text" name="name" value="{employee.name}" readonly>
          </div>
          <div class="form-group">
            <label>Social Security Number:</label>
            <input type="text" name="ssn" required>
          </div>
          <div class="form-group">
            <label>Filing Status:</label>
            <select name="filing_status" required>
              <option value="">Select...</option>
              <option value="single">Single</option>
              <option value="married_joint">Married Filing Jointly</option>
              <option value="married_separate">Married Filing Separately</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </div>
          <div class="form-group">
            <label>Number of Allowances:</label>
            <input type="number" name="allowances" min="0" required>
          </div>
        </form>
      `
    });

    this.formTemplates.set(FormType.EMERGENCY_CONTACT, {
      content: `
        <form id="emergency-contact">
          <h2>Emergency Contact Information</h2>
          <div class="form-group">
            <label>Primary Contact Name:</label>
            <input type="text" name="primary_name" required>
          </div>
          <div class="form-group">
            <label>Relationship:</label>
            <input type="text" name="primary_relationship" required>
          </div>
          <div class="form-group">
            <label>Phone Number:</label>
            <input type="tel" name="primary_phone" required>
          </div>
          <div class="form-group">
            <label>Secondary Contact Name:</label>
            <input type="text" name="secondary_name">
          </div>
          <div class="form-group">
            <label>Relationship:</label>
            <input type="text" name="secondary_relationship">
          </div>
          <div class="form-group">
            <label>Phone Number:</label>
            <input type="tel" name="secondary_phone">
          </div>
        </form>
      `
    });

    this.formTemplates.set(FormType.DIRECT_DEPOSIT, {
      content: `
        <form id="direct-deposit">
          <h2>Direct Deposit Information</h2>
          <div class="form-group">
            <label>Bank Name:</label>
            <input type="text" name="bank_name" required>
          </div>
          <div class="form-group">
            <label>Routing Number:</label>
            <input type="text" name="routing_number" pattern="[0-9]{9}" required>
          </div>
          <div class="form-group">
            <label>Account Number:</label>
            <input type="text" name="account_number" required>
          </div>
          <div class="form-group">
            <label>Account Type:</label>
            <select name="account_type" required>
              <option value="">Select...</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </div>
        </form>
      `
    });
  }

  /**
   * Initialize training catalog
   */
  private initializeTrainingCatalog(): void {
    const trainingMaterials = [
      {
        id: 'general-001',
        title: 'Company Overview and Culture',
        type: 'video' as const,
        url: '/training/company-overview',
        duration: 45,
        isRequired: true,
        completionCriteria: 'Watch complete video and pass quiz'
      },
      {
        id: 'general-002',
        title: 'Employee Handbook',
        type: 'document' as const,
        url: '/training/employee-handbook',
        isRequired: true,
        completionCriteria: 'Read and acknowledge understanding'
      },
      {
        id: 'safety-001',
        title: 'Workplace Safety Training',
        type: 'interactive' as const,
        url: '/training/safety',
        duration: 30,
        isRequired: true,
        completionCriteria: 'Complete interactive modules and pass assessment'
      },
      {
        id: 'it-001',
        title: 'IT Security and Policies',
        type: 'video' as const,
        url: '/training/it-security',
        duration: 25,
        isRequired: true,
        completionCriteria: 'Complete training and sign IT policy agreement'
      },
      {
        id: 'finance-001',
        title: 'Finance Department Procedures',
        type: 'document' as const,
        url: '/training/finance-procedures',
        isRequired: false,
        completionCriteria: 'Review department-specific procedures'
      }
    ];

    for (const material of trainingMaterials) {
      this.trainingCatalog.set(material.id, material);
    }
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring onboarding manager integration: ${integration.service}`);
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      formGeneration: 'available',
      trainingAssignment: 'available',
      workflowAutomation: 'available',
      integrations: Array.from(this.integrations.keys()),
      formTemplates: Array.from(this.formTemplates.keys()),
      trainingMaterials: this.trainingCatalog.size
    };
  }

  /**
   * Generate unique form ID
   */
  private generateFormId(): string {
    return `form-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}