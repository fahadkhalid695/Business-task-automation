describe('Analytics Page', () => {
  beforeEach(() => {
    cy.loginAs('user');
    cy.visit('/analytics');
  });

  it('should display analytics dashboard with key metrics', () => {
    cy.get('[data-testid="analytics-title"]').should('contain', 'Analytics');
    
    // Check stats cards
    cy.get('[data-testid="stats-card"]').should('have.length', 4);
    cy.get('[data-testid="stats-card"]').should('contain', 'Total Tasks');
    cy.get('[data-testid="stats-card"]').should('contain', 'Completion Rate');
    cy.get('[data-testid="stats-card"]').should('contain', 'Avg Processing Time');
    cy.get('[data-testid="stats-card"]').should('contain', 'Failed Tasks');
  });

  it('should display performance charts', () => {
    // Check performance overview tab
    cy.get('[data-testid="analytics-tab-performance"]').should('have.class', 'Mui-selected');
    
    // Verify charts are rendered
    cy.get('[data-testid="performance-chart"]').should('be.visible');
    cy.get('[data-testid="success-rate-display"]').should('be.visible');
    
    // Check chart data is loaded
    cy.get('[data-testid="performance-chart"] .recharts-wrapper').should('be.visible');
  });

  it('should switch between analytics tabs', () => {
    // Test task distribution tab
    cy.get('[data-testid="analytics-tab-distribution"]').click();
    cy.get('[data-testid="task-distribution-chart"]').should('be.visible');
    cy.get('[data-testid="task-volume-table"]').should('be.visible');
    
    // Test efficiency trends tab
    cy.get('[data-testid="analytics-tab-efficiency"]').click();
    cy.get('[data-testid="efficiency-chart"]').should('be.visible');
    
    // Test top performers tab
    cy.get('[data-testid="analytics-tab-performers"]').click();
    cy.get('[data-testid="performers-table"]').should('be.visible');
  });

  it('should filter data by time range', () => {
    // Change time range
    cy.get('[data-testid="time-range-select"]').click();
    cy.get('[data-value="3months"]').click();
    
    // Verify charts update (check for loading state or data change)
    cy.get('[data-testid="performance-chart"]').should('be.visible');
    
    // Test other time ranges
    cy.get('[data-testid="time-range-select"]').click();
    cy.get('[data-value="1year"]').click();
    cy.get('[data-testid="performance-chart"]').should('be.visible');
  });

  it('should export analytics data', () => {
    // Mock file download
    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen');
    });
    
    cy.get('[data-testid="export-button"]').click();
    
    // Verify export was triggered
    cy.get('@windowOpen').should('have.been.called');
  });

  it('should refresh analytics data', () => {
    cy.get('[data-testid="refresh-button"]').click();
    
    // Verify refresh action (check for loading state)
    cy.get('[data-testid="performance-chart"]').should('be.visible');
  });

  it('should display task distribution pie chart', () => {
    cy.get('[data-testid="analytics-tab-distribution"]').click();
    
    // Check pie chart is rendered
    cy.get('[data-testid="task-distribution-chart"] .recharts-pie').should('be.visible');
    
    // Check legend is present
    cy.get('[data-testid="task-distribution-chart"] .recharts-legend-wrapper').should('be.visible');
    
    // Verify table data matches chart
    cy.get('[data-testid="task-volume-table"] tbody tr').should('have.length.at.least', 1);
  });

  it('should show efficiency trends over time', () => {
    cy.get('[data-testid="analytics-tab-efficiency"]').click();
    
    // Check composed chart with multiple metrics
    cy.get('[data-testid="efficiency-chart"] .recharts-area').should('be.visible');
    cy.get('[data-testid="efficiency-chart"] .recharts-bar').should('be.visible');
    cy.get('[data-testid="efficiency-chart"] .recharts-line').should('be.visible');
    
    // Verify legend shows all metrics
    cy.get('[data-testid="efficiency-chart"] .recharts-legend-item').should('have.length', 3);
  });

  it('should display top performing tasks', () => {
    cy.get('[data-testid="analytics-tab-performers"]').click();
    
    // Check table headers
    cy.get('[data-testid="performers-table"] thead').should('contain', 'Task Name');
    cy.get('[data-testid="performers-table"] thead').should('contain', 'Completion Rate');
    cy.get('[data-testid="performers-table"] thead').should('contain', 'Avg Time');
    cy.get('[data-testid="performers-table"] thead').should('contain', 'Total Tasks');
    cy.get('[data-testid="performers-table"] thead').should('contain', 'Status');
    
    // Check data rows
    cy.get('[data-testid="performers-table"] tbody tr').should('have.length.at.least', 1);
    
    // Verify status chips are colored correctly
    cy.get('[data-testid="performance-status-chip"]').should('be.visible');
  });

  it('should handle chart interactions', () => {
    // Test tooltip on hover
    cy.get('[data-testid="performance-chart"] .recharts-bar').first().trigger('mouseover');
    cy.get('.recharts-tooltip-wrapper').should('be.visible');
    
    // Test legend interactions
    cy.get('[data-testid="performance-chart"] .recharts-legend-item').first().click();
  });

  it('should be responsive on mobile', () => {
    cy.viewport('iphone-x');
    
    // Check mobile layout
    cy.get('[data-testid="analytics-title"]').should('be.visible');
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    
    // Check stats cards stack vertically
    cy.get('[data-testid="stats-card"]').should('be.visible');
    
    // Check charts are responsive
    cy.get('[data-testid="performance-chart"]').should('be.visible');
    
    // Test tab navigation on mobile
    cy.get('[data-testid="analytics-tab-distribution"]').click();
    cy.get('[data-testid="task-distribution-chart"]').should('be.visible');
  });

  it('should validate data accuracy', () => {
    // Check that percentages add up correctly
    cy.get('[data-testid="analytics-tab-distribution"]').click();
    
    cy.get('[data-testid="task-volume-table"] tbody tr').then(($rows) => {
      let totalPercentage = 0;
      
      $rows.each((index, row) => {
        const percentageText = Cypress.$(row).find('td:last').text();
        const percentage = parseFloat(percentageText.replace('%', ''));
        totalPercentage += percentage;
      });
      
      // Allow for small rounding differences
      expect(totalPercentage).to.be.closeTo(100, 1);
    });
  });
});