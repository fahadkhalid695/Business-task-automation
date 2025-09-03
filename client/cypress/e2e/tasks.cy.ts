describe('Tasks Management', () => {
  beforeEach(() => {
    cy.loginAs('user');
    cy.visit('/tasks');
  });

  it('should display tasks page with kanban board', () => {
    cy.get('[data-testid="tasks-title"]').should('contain', 'Tasks');
    
    // Check kanban columns
    cy.get('[data-testid="kanban-column"]').should('have.length', 4);
    cy.get('[data-testid="column-pending"]').should('contain', 'Pending');
    cy.get('[data-testid="column-in_progress"]').should('contain', 'In Progress');
    cy.get('[data-testid="column-completed"]').should('contain', 'Completed');
    cy.get('[data-testid="column-failed"]').should('contain', 'Failed');
  });

  it('should create a new task', () => {
    cy.get('[data-testid="create-task-fab"]').click();
    cy.get('[data-testid="create-task-dialog"]').should('be.visible');
    
    // Fill task form
    cy.createTask({
      title: 'E2E Test Task',
      description: 'Task created by end-to-end test',
      type: 'document_generation',
      priority: 'high',
    });
    
    // Verify task appears in pending column
    cy.get('[data-testid="column-pending"]').should('contain', 'E2E Test Task');
  });

  it('should filter tasks', () => {
    // Open filters
    cy.get('[data-testid="filter-button"]').click();
    cy.get('[data-testid="filter-menu"]').should('be.visible');
    
    // Apply status filter
    cy.get('[data-testid="filter-status-completed"]').click();
    cy.get('[data-testid="filter-menu"]').click('outside');
    
    // Verify only completed tasks are shown
    cy.get('[data-testid="task-card"]').each(($task) => {
      cy.wrap($task).should('contain', 'Completed');
    });
    
    // Clear filters
    cy.get('[data-testid="filter-button"]').click();
    cy.get('[data-testid="clear-filters"]').click();
  });

  it('should search tasks', () => {
    const searchTerm = 'email';
    
    cy.get('[data-testid="search-input"]').type(searchTerm);
    
    // Verify search results
    cy.get('[data-testid="task-card"]').each(($task) => {
      cy.wrap($task).should('contain.text', searchTerm, { matchCase: false });
    });
    
    // Clear search
    cy.get('[data-testid="search-input"]').clear();
  });

  it('should drag and drop tasks between columns', () => {
    // Ensure there's at least one task in pending
    cy.createTask({ title: 'Drag Test Task' });
    
    // Wait for task to appear
    cy.get('[data-testid="column-pending"]').should('contain', 'Drag Test Task');
    
    // Drag task from pending to in progress
    cy.dragTask('drag-test-task', 'in_progress');
    
    // Verify task moved
    cy.get('[data-testid="column-in_progress"]').should('contain', 'Drag Test Task');
    cy.get('[data-testid="column-pending"]').should('not.contain', 'Drag Test Task');
  });

  it('should switch between kanban and list view', () => {
    // Switch to list view
    cy.get('[data-testid="view-tab-list"]').click();
    cy.get('[data-testid="list-view"]').should('be.visible');
    cy.get('[data-testid="kanban-view"]').should('not.exist');
    
    // Switch back to kanban view
    cy.get('[data-testid="view-tab-kanban"]').click();
    cy.get('[data-testid="kanban-view"]').should('be.visible');
    cy.get('[data-testid="list-view"]').should('not.exist');
  });

  it('should handle task actions', () => {
    // Create a task first
    cy.createTask({ title: 'Action Test Task' });
    
    // Open task menu
    cy.get('[data-testid="task-card"]').first().within(() => {
      cy.get('[data-testid="task-menu-button"]').click();
    });
    
    cy.get('[data-testid="task-menu"]').should('be.visible');
    
    // Test edit action
    cy.get('[data-testid="task-action-edit"]').click();
    cy.get('[data-testid="edit-task-dialog"]').should('be.visible');
    cy.get('[data-testid="dialog-close"]').click();
  });

  it('should upload file attachments', () => {
    cy.get('[data-testid="create-task-fab"]').click();
    
    // Create a test file
    const fileName = 'test-document.txt';
    const fileContent = 'This is a test document for task attachment';
    
    cy.get('[data-testid="file-upload-area"]').selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName: fileName,
      mimeType: 'text/plain',
    }, { action: 'drag-drop' });
    
    // Verify file is attached
    cy.get('[data-testid="attached-file"]').should('contain', fileName);
    
    // Remove attachment
    cy.get('[data-testid="remove-attachment"]').click();
    cy.get('[data-testid="attached-file"]').should('not.exist');
  });

  it('should show real-time updates', () => {
    cy.waitForRealtimeUpdate();
    
    // Verify connection status
    cy.get('[data-testid="connection-status"]').should('contain', 'Live');
    
    // Simulate real-time task update
    cy.window().then((win) => {
      const mockTaskUpdate = {
        id: 'test-task-123',
        title: 'Updated Task',
        status: 'completed',
      };
      
      const event = new CustomEvent('task:updated', { detail: mockTaskUpdate });
      win.dispatchEvent(event);
    });
    
    // Verify UI reflects the update
    cy.get('[data-testid="task-card"]').should('be.visible');
  });

  it('should be responsive on mobile devices', () => {
    cy.viewport('iphone-x');
    
    // Check mobile layout
    cy.get('[data-testid="tasks-title"]').should('be.visible');
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    
    // Test mobile task creation
    cy.get('[data-testid="create-task-fab"]').should('be.visible').click();
    cy.get('[data-testid="create-task-dialog"]').should('be.visible');
    
    // Check form is usable on mobile
    cy.get('[data-testid="task-title-input"]').should('be.visible');
    cy.get('[data-testid="dialog-close"]').click();
  });
});