import { ProjectManagementService } from '../project-management-service/ProjectManagementService';
import { TaskAssignmentEngine } from '../project-management-service/TaskAssignmentEngine';
import { ReminderNotificationSystem } from '../project-management-service/ReminderNotificationSystem';
import { ApprovalWorkflowRouter } from '../project-management-service/ApprovalWorkflowRouter';
import { KnowledgeBaseManager } from '../project-management-service/KnowledgeBaseManager';
import { ProgressTracker } from '../project-management-service/ProgressTracker';
import { 
  TaskAssignmentRequest,
  ReminderRequest,
  ReminderType,
  ApprovalWorkflowRequest,
  WorkflowType,
  KnowledgeBaseRequest,
  KnowledgeBaseUpdateType,
  ProgressTrackingRequest,
  TeamMember,
  AvailabilityStatus,
  ProjectMilestone,
  MilestoneStatus
} from '../project-management-service/types/ProjectManagementTypes';
import { Task, TaskStatus, Priority, DocumentType } from '../shared/types';

describe('ProjectManagementService', () => {
  let service: ProjectManagementService;

  beforeEach(() => {
    service = new ProjectManagementService();
  });

  describe('Task Assignment', () => {
    it('should assign tasks based on team member availability and expertise', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          type: 'project_management',
          status: TaskStatus.PENDING,
          priority: Priority.HIGH,
          assignedTo: '',
          createdBy: 'user-1',
          title: 'Project Planning Task',
          description: 'Plan the project timeline and resources',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          estimatedDuration: 8
        }
      ];

      const request: TaskAssignmentRequest = {
        tasks: mockTasks,
        criteria: {
          prioritizeSkillMatch: true,
          prioritizeAvailability: true,
          balanceWorkload: true,
          minimumScore: 60
        }
      };

      // Add a team member to the service
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'project_manager',
        skills: [
          { name: 'project management', level: 4, yearsExperience: 5 },
          { name: 'planning', level: 5, yearsExperience: 6 }
        ],
        availability: {
          status: AvailabilityStatus.AVAILABLE,
          hoursPerWeek: 40
        },
        currentWorkload: 20,
        efficiency: 1.2
      };

      await service.addTeamMember('member-1', teamMember);

      const result = await service.assignTasks(request);

      expect(result.success).toBe(true);
      expect(result.data.assignments).toHaveLength(1);
      expect(result.data.assignments[0].assigneeId).toBe('member-1');
      expect(result.data.assignmentRate).toBeGreaterThan(0);
    });

    it('should handle tasks that cannot be assigned', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          type: 'project_management',
          status: TaskStatus.PENDING,
          priority: Priority.HIGH,
          assignedTo: '',
          createdBy: 'user-1',
          title: 'Specialized Task',
          description: 'Requires very specific skills',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedDuration: 8
        }
      ];

      const request: TaskAssignmentRequest = {
        tasks: mockTasks,
        criteria: {
          prioritizeSkillMatch: true,
          prioritizeAvailability: true,
          balanceWorkload: true,
          minimumScore: 95 // Very high threshold
        }
      };

      const result = await service.assignTasks(request);

      expect(result.success).toBe(true);
      expect(result.data.unassignedTasks).toHaveLength(1);
      expect(result.data.assignmentRate).toBe(0);
    });
  });

  describe('Reminder Notifications', () => {
    it('should send deadline reminders for upcoming tasks', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          type: 'project_management',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          assignedTo: 'user-1',
          createdBy: 'user-1',
          title: 'Important Task',
          description: 'This task is due soon',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
        }
      ];

      const request: ReminderRequest = {
        type: ReminderType.DEADLINE,
        tasks: mockTasks
      };

      const result = await service.sendReminders(request);

      expect(result.success).toBe(true);
      expect(result.data.reminderType).toBe(ReminderType.DEADLINE);
      expect(result.data.notificationsSent).toBeGreaterThanOrEqual(0);
    });

    it('should send overdue reminders for past due tasks', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          type: 'project_management',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          assignedTo: 'user-1',
          createdBy: 'user-1',
          title: 'Overdue Task',
          description: 'This task is overdue',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];

      const request: ReminderRequest = {
        type: ReminderType.OVERDUE,
        tasks: mockTasks
      };

      const result = await service.sendReminders(request);

      expect(result.success).toBe(true);
      expect(result.data.reminderType).toBe(ReminderType.OVERDUE);
    });
  });

  describe('Approval Workflows', () => {
    it('should route document through approval workflow', async () => {
      const mockDocument = {
        id: 'doc-1',
        type: DocumentType.CONTRACT,
        title: 'Service Agreement',
        content: 'Contract content here',
        metadata: {
          author: 'user-1',
          category: 'legal',
          keywords: ['contract', 'service'],
          language: 'en',
          lastModifiedBy: 'user-1',
          amount: 50000
        },
        tags: ['contract'],
        createdBy: 'user-1',
        version: 1,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const request: ApprovalWorkflowRequest = {
        workflowType: WorkflowType.CONTRACT_APPROVAL,
        document: mockDocument,
        requesterId: 'user-1',
        urgency: Priority.HIGH
      };

      const result = await service.routeApprovalWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.data.workflowId).toBeDefined();
      expect(result.data.approvers.length).toBeGreaterThan(0);
      expect(result.data.status).toBe('pending');
    });

    it('should handle budget approval workflows', async () => {
      const mockDocument = {
        id: 'doc-2',
        type: DocumentType.PROPOSAL,
        title: 'Budget Proposal',
        content: 'Budget proposal content',
        metadata: {
          author: 'user-1',
          category: 'finance',
          keywords: ['budget', 'proposal'],
          language: 'en',
          lastModifiedBy: 'user-1',
          amount: 25000
        },
        tags: ['budget'],
        createdBy: 'user-1',
        version: 1,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const request: ApprovalWorkflowRequest = {
        workflowType: WorkflowType.BUDGET_APPROVAL,
        document: mockDocument,
        requesterId: 'user-1'
      };

      const result = await service.routeApprovalWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.data.workflowType).toBe(WorkflowType.BUDGET_APPROVAL);
    });
  });

  describe('Knowledge Base Management', () => {
    it('should update SOPs based on completed tasks', async () => {
      const mockSourceData = {
        completedTasks: [
          {
            id: 'task-1',
            type: 'process_improvement',
            title: 'Improve Onboarding Process',
            description: 'Update the employee onboarding procedure',
            status: TaskStatus.COMPLETED,
            priority: Priority.MEDIUM,
            completedAt: new Date()
          }
        ]
      };

      const request: KnowledgeBaseRequest = {
        updateType: KnowledgeBaseUpdateType.SOP_UPDATE,
        sourceData: mockSourceData
      };

      const result = await service.updateKnowledgeBase(request);

      expect(result.success).toBe(true);
      expect(result.data.updateType).toBe(KnowledgeBaseUpdateType.SOP_UPDATE);
      expect(result.data.documentsUpdated + result.data.documentsCreated).toBeGreaterThanOrEqual(0);
    });

    it('should update process documentation', async () => {
      const mockSourceData = {
        completedTasks: [
          {
            id: 'task-1',
            type: 'project_management',
            title: 'Project Planning',
            description: 'Plan project timeline',
            status: TaskStatus.COMPLETED,
            workflow: [
              { id: 'step-1', name: 'Requirements Gathering', type: 'ai_processing', configuration: {}, dependencies: [], order: 1 },
              { id: 'step-2', name: 'Timeline Creation', type: 'data_transformation', configuration: {}, dependencies: ['step-1'], order: 2 }
            ]
          }
        ]
      };

      const request: KnowledgeBaseRequest = {
        updateType: KnowledgeBaseUpdateType.PROCESS_DOCUMENTATION,
        sourceData: mockSourceData
      };

      const result = await service.updateKnowledgeBase(request);

      expect(result.success).toBe(true);
      expect(result.data.updateType).toBe(KnowledgeBaseUpdateType.PROCESS_DOCUMENTATION);
    });
  });

  describe('Progress Tracking', () => {
    it('should track project progress and generate reports', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          type: 'project_management',
          status: TaskStatus.COMPLETED,
          priority: Priority.HIGH,
          assignedTo: 'user-1',
          createdBy: 'user-1',
          title: 'Completed Task',
          description: 'This task is done',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          completedAt: new Date(),
          estimatedDuration: 8,
          actualDuration: 6
        },
        {
          id: 'task-2',
          type: 'project_management',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.MEDIUM,
          assignedTo: 'user-2',
          createdBy: 'user-1',
          title: 'In Progress Task',
          description: 'This task is being worked on',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedDuration: 12
        }
      ];

      const milestone: ProjectMilestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        name: 'Phase 1 Complete',
        description: 'Complete first phase of project',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: MilestoneStatus.IN_PROGRESS,
        progressPercentage: 50,
        associatedTasks: ['task-1', 'task-2'],
        stakeholders: ['user-1', 'user-2'],
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      await service.addProjectMilestone('milestone-1', milestone);

      const request: ProgressTrackingRequest = {
        projectId: 'project-1',
        tasks: mockTasks,
        milestones: [milestone]
      };

      const result = await service.trackProgress(request);

      expect(result.success).toBe(true);
      expect(result.data.projectId).toBe('project-1');
      expect(result.data.completionPercentage).toBeGreaterThan(0);
      expect(result.data.progressMetrics).toBeDefined();
      expect(result.data.progressReport).toBeDefined();
      expect(result.data.healthAssessment).toBeDefined();
    });

    it('should identify overdue tasks and milestones', async () => {
      const overdueTasks: Task[] = [
        {
          id: 'task-overdue',
          type: 'project_management',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          assignedTo: 'user-1',
          createdBy: 'user-1',
          title: 'Overdue Task',
          description: 'This task is overdue',
          data: { input: {}, context: { userId: 'user-1', metadata: {} } },
          workflow: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];

      const request: ProgressTrackingRequest = {
        projectId: 'project-overdue',
        tasks: overdueTasks
      };

      const result = await service.trackProgress(request);

      expect(result.success).toBe(true);
      expect(result.data.progressMetrics.tasksOverdue).toBe(1);
      expect(result.data.healthAssessment.overallHealth).not.toBe('excellent');
    });
  });

  describe('Service Health', () => {
    it('should return healthy status for all components', async () => {
      const result = await service.getHealthStatus();

      expect(result.success).toBe(true);
      expect(result.data.service).toBe('ProjectManagementService');
      expect(result.data.status).toBe('healthy');
      expect(result.data.components).toBeDefined();
      expect(result.data.components.taskAssignmentEngine).toBeDefined();
      expect(result.data.components.reminderNotificationSystem).toBeDefined();
      expect(result.data.components.approvalWorkflowRouter).toBeDefined();
      expect(result.data.components.knowledgeBaseManager).toBeDefined();
      expect(result.data.components.progressTracker).toBeDefined();
    });
  });
});

describe('TaskAssignmentEngine', () => {
  let engine: TaskAssignmentEngine;

  beforeEach(() => {
    engine = new TaskAssignmentEngine();
  });

  it('should calculate assignment scores correctly', async () => {
    const teamMember: TeamMember = {
      id: 'member-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'developer',
      skills: [
        { name: 'frontend development', level: 4, yearsExperience: 3 },
        { name: 'ui/ux', level: 3, yearsExperience: 2 }
      ],
      availability: {
        status: AvailabilityStatus.AVAILABLE,
        hoursPerWeek: 40
      },
      currentWorkload: 15,
      efficiency: 1.1
    };

    await engine.updateTeamMember('member-1', teamMember);

    const task: Task = {
      id: 'task-ui',
      type: 'project_management',
      status: TaskStatus.PENDING,
      priority: Priority.MEDIUM,
      assignedTo: '',
      createdBy: 'user-1',
      title: 'UI Development Task',
      description: 'Create frontend UI components',
      data: { input: {}, context: { userId: 'user-1', metadata: {} } },
      workflow: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedDuration: 16
    };

    const request: TaskAssignmentRequest = {
      tasks: [task],
      criteria: {
        prioritizeSkillMatch: true,
        prioritizeAvailability: true,
        balanceWorkload: true,
        minimumScore: 50
      }
    };

    const result = await engine.assignTasks(request);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].confidence).toBeGreaterThan(50);
    expect(result.assignments[0].skillsMatched.length).toBeGreaterThan(0);
  });

  it('should handle workload thresholds', async () => {
    const overloadedMember: TeamMember = {
      id: 'member-overloaded',
      name: 'Busy Person',
      email: 'busy@example.com',
      role: 'developer',
      skills: [
        { name: 'project management', level: 5, yearsExperience: 10 }
      ],
      availability: {
        status: AvailabilityStatus.LIMITED,
        hoursPerWeek: 20
      },
      currentWorkload: 45, // Overloaded
      efficiency: 1.0
    };

    await engine.updateTeamMember('member-overloaded', overloadedMember);
    await engine.setWorkloadThreshold('member-overloaded', 40);

    const task: Task = {
      id: 'task-pm',
      type: 'project_management',
      status: TaskStatus.PENDING,
      priority: Priority.LOW,
      assignedTo: '',
      createdBy: 'user-1',
      title: 'Project Management Task',
      description: 'Manage project activities',
      data: { input: {}, context: { userId: 'user-1', metadata: {} } },
      workflow: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedDuration: 8
    };

    const request: TaskAssignmentRequest = {
      tasks: [task],
      criteria: {
        prioritizeSkillMatch: true,
        prioritizeAvailability: true,
        balanceWorkload: true,
        minimumScore: 70 // High threshold
      }
    };

    const result = await engine.assignTasks(request);

    // Should not assign due to workload
    expect(result.unassignedTasks).toHaveLength(1);
  });
});

describe('ReminderNotificationSystem', () => {
  let reminderSystem: ReminderNotificationSystem;

  beforeEach(() => {
    reminderSystem = new ReminderNotificationSystem();
  });

  it('should process milestone reminders', async () => {
    const milestone: ProjectMilestone = {
      id: 'milestone-upcoming',
      projectId: 'project-1',
      name: 'Upcoming Milestone',
      description: 'This milestone is due soon',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      status: MilestoneStatus.IN_PROGRESS,
      progressPercentage: 75,
      stakeholders: ['user-1', 'user-2'],
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    const request: ReminderRequest = {
      type: ReminderType.MILESTONE,
      milestones: [milestone]
    };

    const result = await reminderSystem.processReminders(request);

    expect(result.reminderType).toBe(ReminderType.MILESTONE);
    expect(result.processedAt).toBeDefined();
    expect(result.nextScheduledCheck).toBeDefined();
  });
});

describe('Integration Tests', () => {
  let service: ProjectManagementService;

  beforeEach(() => {
    service = new ProjectManagementService();
  });

  it('should handle complete project management workflow', async () => {
    // 1. Add team members
    const teamMember: TeamMember = {
      id: 'pm-1',
      name: 'Project Manager',
      email: 'pm@example.com',
      role: 'project_manager',
      skills: [
        { name: 'project management', level: 5, yearsExperience: 8 },
        { name: 'planning', level: 4, yearsExperience: 6 }
      ],
      availability: {
        status: AvailabilityStatus.AVAILABLE,
        hoursPerWeek: 40
      },
      currentWorkload: 10,
      efficiency: 1.3
    };

    await service.addTeamMember('pm-1', teamMember);

    // 2. Create and assign tasks
    const tasks: Task[] = [
      {
        id: 'integration-task-1',
        type: 'project_management',
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        assignedTo: '',
        createdBy: 'user-1',
        title: 'Integration Test Task',
        description: 'Test the complete workflow',
        data: { input: {}, context: { userId: 'user-1', metadata: {} } },
        workflow: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedDuration: 16
      }
    ];

    const assignmentResult = await service.assignTasks({
      tasks,
      criteria: {
        prioritizeSkillMatch: true,
        prioritizeAvailability: true,
        balanceWorkload: true,
        minimumScore: 60
      }
    });

    expect(assignmentResult.success).toBe(true);

    // 3. Track progress
    const progressResult = await service.trackProgress({
      projectId: 'integration-project',
      tasks
    });

    expect(progressResult.success).toBe(true);

    // 4. Check service health
    const healthResult = await service.getHealthStatus();

    expect(healthResult.success).toBe(true);
    expect(healthResult.data.status).toBe('healthy');
  });
});