describe('Administrative Workflow', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Email Processing', () => {
    it('should process and categorize incoming emails', () => {
      cy.visit('/admin/email-processing');
      
      // Upload email data
      cy.get('[data-testid="upload-emails-button"]').click();
      cy.uploadFile('sample-emails.json', 'application/json');
      
      // Start processing
      cy.get('[data-testid="process-emails-button"]').click();
      
      // Wait for processing to complete
      cy.get('[data-testid="processing-status"]', { timeout: 30000 })
        .should('contain.text', 'Processing completed');
      
      // Verify categorization
      cy.get('[data-testid="email-categories"]').should('be.visible');
      cy.get('[data-testid="category-urgent"]').should('exist');
      cy.get('[data-testid="category-normal"]').should('exist');
      cy.get('[data-testid="category-low"]').should('exist');
      
      // Check email details
      cy.get('[data-testid="email-item"]').first().click();
      cy.get('[data-testid="email-sentiment"]').should('be.visible');
      cy.get('[data-testid="email-action-items"]').should('be.visible');
    });

    it('should generate email responses', () => {
      cy.visit('/admin/email-processing');
      
      // Select an email
      cy.get('[data-testid="email-item"]').first().click();
      
      // Generate response
      cy.get('[data-testid="generate-response-button"]').click();
      
      // Wait for AI response generation
      cy.get('[data-testid="generated-response"]', { timeout: 15000 })
        .should('be.visible')
        .and('not.be.empty');
      
      // Review and send
      cy.get('[data-testid="review-response-button"]').click();
      cy.get('[data-testid="send-response-button"]').click();
      
      cy.checkNotification('Email response sent successfully');
    });
  });

  describe('Calendar Management', () => {
    it('should detect and resolve scheduling conflicts', () => {
      cy.visit('/admin/calendar');
      
      // Create conflicting meetings
      cy.get('[data-testid="create-meeting-button"]').click();
      cy.get('[data-testid="meeting-title"]').type('Team Standup');
      cy.get('[data-testid="meeting-date"]').type('2024-01-15');
      cy.get('[data-testid="meeting-time"]').type('10:00');
      cy.get('[data-testid="meeting-duration"]').type('60');
      cy.get('[data-testid="save-meeting-button"]').click();
      
      // Create another meeting at the same time
      cy.get('[data-testid="create-meeting-button"]').click();
      cy.get('[data-testid="meeting-title"]').type('Client Call');
      cy.get('[data-testid="meeting-date"]').type('2024-01-15');
      cy.get('[data-testid="meeting-time"]').type('10:30');
      cy.get('[data-testid="meeting-duration"]').type('60');
      cy.get('[data-testid="save-meeting-button"]').click();
      
      // Check conflict detection
      cy.get('[data-testid="conflict-warning"]')
        .should('be.visible')
        .and('contain.text', 'Scheduling conflict detected');
      
      // Resolve conflict
      cy.get('[data-testid="resolve-conflict-button"]').click();
      cy.get('[data-testid="suggested-times"]').should('be.visible');
      cy.get('[data-testid="suggested-time"]').first().click();
      cy.get('[data-testid="accept-suggestion-button"]').click();
      
      cy.checkNotification('Conflict resolved successfully');
    });
  });

  describe('Document Generation', () => {
    it('should generate documents from templates', () => {
      cy.visit('/admin/documents');
      
      // Select document template
      cy.get('[data-testid="template-selector"]').click();
      cy.get('[data-value="meeting-notes"]').click();
      
      // Fill template data
      cy.get('[data-testid="template-form"]').should('be.visible');
      cy.get('[data-testid="meeting-title-input"]').type('Weekly Team Meeting');
      cy.get('[data-testid="meeting-date-input"]').type('2024-01-15');
      cy.get('[data-testid="attendees-input"]').type('John Doe, Jane Smith');
      
      // Generate document
      cy.get('[data-testid="generate-document-button"]').click();
      
      // Wait for generation
      cy.get('[data-testid="document-preview"]', { timeout: 10000 })
        .should('be.visible');
      
      // Download document
      cy.get('[data-testid="download-document-button"]').click();
      
      cy.checkNotification('Document generated successfully');
    });
  });
});