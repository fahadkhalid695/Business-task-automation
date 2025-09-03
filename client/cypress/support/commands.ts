/// <reference types="cypress" />

// Custom commands for the Business Task Automation platform

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with email and password
       * @example cy.login('user@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;
      
      /**
       * Custom command to login as a specific user type
       * @example cy.loginAs('admin')
       */
      loginAs(userType: 'admin' | 'manager' | 'user'): Chainable<void>;
      
      /**
       * Custom command to create a test task
       * @example cy.createTask({ title: 'Test Task', type: 'email_processing' })
       */
      createTask(taskData: Partial<{
        title: string;
        description: string;
        type: string;
        priority: string;
      }>): Chainable<void>;
      
      /**
       * Custom command to wait for real-time updates
       * @example cy.waitForRealtimeUpdate()
       */
      waitForRealtimeUpdate(): Chainable<void>;
      
      /**
       * Custom command to drag and drop tasks
       * @example cy.dragTask('task-1', 'completed-column')
       */
      dragTask(taskId: string, targetColumn: string): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('not.include', '/login');
});

// Login as specific user type
Cypress.Commands.add('loginAs', (userType: 'admin' | 'manager' | 'user') => {
  const users = {
    admin: { email: 'admin@example.com', password: 'admin123' },
    manager: { email: 'manager@example.com', password: 'manager123' },
    user: { email: 'user@example.com', password: 'user123' },
  };
  
  const user = users[userType];
  cy.login(user.email, user.password);
});

// Create task command
Cypress.Commands.add('createTask', (taskData) => {
  const defaultTask = {
    title: 'Test Task',
    description: 'This is a test task',
    type: 'email_processing',
    priority: 'medium',
    estimatedDuration: 30,
    ...taskData,
  };
  
  cy.get('[data-testid="create-task-button"]').click();
  cy.get('[data-testid="task-title-input"]').type(defaultTask.title);
  cy.get('[data-testid="task-description-input"]').type(defaultTask.description);
  cy.get('[data-testid="task-type-select"]').click();
  cy.get(`[data-value="${defaultTask.type}"]`).click();
  cy.get('[data-testid="task-priority-select"]').click();
  cy.get(`[data-value="${defaultTask.priority}"]`).click();
  cy.get('[data-testid="task-duration-input"]').clear().type(defaultTask.estimatedDuration.toString());
  cy.get('[data-testid="create-task-submit"]').click();
});

// Wait for real-time updates
Cypress.Commands.add('waitForRealtimeUpdate', () => {
  cy.get('[data-testid="connection-status"]').should('contain', 'Live');
  cy.wait(1000); // Wait for WebSocket connection to stabilize
});

// Drag and drop task
Cypress.Commands.add('dragTask', (taskId: string, targetColumn: string) => {
  cy.get(`[data-testid="task-${taskId}"]`)
    .trigger('mousedown', { which: 1 })
    .wait(100);
    
  cy.get(`[data-testid="column-${targetColumn}"]`)
    .trigger('mousemove')
    .trigger('mouseup');
    
  cy.wait(500); // Wait for drag animation to complete
});

export {};