describe('Task Automation Workflow', () => {
  beforeEach(() => {
    cy.task('cleanDatabase');
    cy.task('seedDatabase');
    cy.login('user@test.com', 'TestUser123!');
  });

  it('should create and execute email processing workflow', () => {
    cy.visit('/workflows');
    cy.get('[data-cy=create-workflow-button]').click();
    
    // Configure email processing workflow
    cy.get('[data-cy=workflow-name]').type('Email Processing Test');
    cy.get('[data-cy=workflow-type]').select('email-processing');
    
    // Add email trigger
    cy.get('[data-cy=add-trigger]').click();
    cy.get('[data-cy=trigger-type]').select('email');
    cy.get('[data-cy=email-filter]').type('subject:invoice');
    
    // Add AI processing step
    cy.get('[data-cy=add-step]').click();
    cy.get('[data-cy=step-type]').select('ai-processing');
    cy.get('[data-cy=ai-model]').select('document-analysis');
    
    // Add data extraction step
    cy.get('[data-cy=add-step]').click();
    cy.get('[data-cy=step-type]').select('data-extraction');
    cy.get('[data-cy=extraction-fields]').type('invoice_number,amount,date');
    
    // Save workflow
    cy.get('[data-cy=save-workflow]').click();
    cy.get('[data-cy=success-message]').should('contain', 'Workflow created');
    
    // Test workflow execution
    cy.get('[data-cy=test-workflow]').click();
    cy.fixture('test-email.json').then((email) => {
      cy.get('[data-cy=test-input]').type(JSON.stringify(email));
    });
    cy.get('[data-cy=run-test]').click();
    
    cy.get('[data-cy=test-results]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-cy=extraction-results]').should('contain', 'invoice_number');
  });

  it('should create and execute document generation workflow', () => {
    cy.visit('/workflows');
    cy.get('[data-cy=create-workflow-button]').click();
    
    // Configure document generation workflow
    cy.get('[data-cy=workflow-name]').type('Report Generation Test');
    cy.get('[data-cy=workflow-type]').select('document-generation');
    
    // Add data source
    cy.get('[data-cy=add-data-source]').click();
    cy.get('[data-cy=data-source-type]').select('database');
    cy.get('[data-cy=query]').type('SELECT * FROM sales_data WHERE date >= ?');
    
    // Add template
    cy.get('[data-cy=add-template]').click();
    cy.get('[data-cy=template-type]').select('pdf');
    cy.fixture('report-template.html').then((template) => {
      cy.get('[data-cy=template-content]').type(template);
    });
    
    // Save and test
    cy.get('[data-cy=save-workflow]').click();
    cy.get('[data-cy=test-workflow]').click();
    cy.get('[data-cy=test-parameters]').type('{"date": "2024-01-01"}');
    cy.get('[data-cy=run-test]').click();
    
    cy.get('[data-cy=generated-document]', { timeout: 30000 }).should('be.visible');
  });

  it('should handle workflow scheduling and monitoring', () => {
    cy.visit('/workflows');
    cy.get('[data-cy=workflow-item]').first().click();
    
    // Set up scheduling
    cy.get('[data-cy=schedule-tab]').click();
    cy.get('[data-cy=enable-schedule]').check();
    cy.get('[data-cy=schedule-type]').select('cron');
    cy.get('[data-cy=cron-expression]').type('0 9 * * 1-5');
    cy.get('[data-cy=save-schedule]').click();
    
    // Check monitoring
    cy.get('[data-cy=monitoring-tab]').click();
    cy.get('[data-cy=execution-history]').should('be.visible');
    cy.get('[data-cy=performance-metrics]').should('be.visible');
  });
});