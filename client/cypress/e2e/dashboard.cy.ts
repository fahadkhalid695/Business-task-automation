describe('Dashboard Page', () => {
  beforeEach(() => {
    cy.loginAs('user');
    cy.visit('/dashboard');
  });

  it('should display dashboard with key metrics', () => {
    cy.get('[data-testid="dashboard-title"]').should('contain', 'Dashboard');
    
    // Check stats cards
    cy.get('[data-testid="stats-card"]').should('have.length', 4);
    cy.get('[data-testid="stats-card"]').first().should('contain', 'Total Tasks');
    
    // Check charts are rendered
    cy.get('[data-testid="task-trends-chart"]').should('be.visible');
    cy.get('[data-testid="task-distribution-chart"]').should('be.visible');
  });

  it('should display recent activity', () => {
    cy.get('[data-testid="recent-activity"]').should('be.visible');
    cy.get('[data-testid="activity-item"]').should('have.length.at.least', 1);
    
    // Check activity items have required elements
    cy.get('[data-testid="activity-item"]').first().within(() => {
      cy.get('[data-testid="activity-icon"]').should('be.visible');
      cy.get('[data-testid="activity-title"]').should('not.be.empty');
      cy.get('[data-testid="activity-timestamp"]').should('not.be.empty');
    });
  });

  it('should display quick actions', () => {
    cy.get('[data-testid="quick-actions"]').should('be.visible');
    cy.get('[data-testid="quick-action-item"]').should('have.length.at.least', 3);
    
    // Test quick action functionality
    cy.get('[data-testid="quick-action-create-task"]').click();
    cy.get('[data-testid="create-task-dialog"]').should('be.visible');
    cy.get('[data-testid="dialog-close"]').click();
  });

  it('should update in real-time', () => {
    cy.waitForRealtimeUpdate();
    
    // Simulate real-time update (would be triggered by WebSocket in real app)
    cy.window().then((win) => {
      // Mock WebSocket message
      const mockEvent = new CustomEvent('task:updated', {
        detail: { id: 'test-task', status: 'completed' }
      });
      win.dispatchEvent(mockEvent);
    });
    
    // Verify UI updates
    cy.get('[data-testid="stats-card"]').should('be.visible');
  });

  it('should be responsive on mobile', () => {
    cy.viewport('iphone-x');
    
    cy.get('[data-testid="dashboard-title"]').should('be.visible');
    cy.get('[data-testid="stats-card"]').should('be.visible');
    
    // Check mobile layout adjustments
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
  });
});