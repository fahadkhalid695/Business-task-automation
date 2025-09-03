describe('AI/ML Workflow', () => {
  beforeEach(() => {
    cy.task('cleanDatabase');
    cy.task('seedDatabase');
    cy.login('user@test.com', 'TestUser123!');
  });

  it('should train and deploy custom AI model', () => {
    cy.visit('/ai-models');
    cy.get('[data-cy=create-model-button]').click();
    
    // Configure model
    cy.get('[data-cy=model-name]').type('Custom Classification Model');
    cy.get('[data-cy=model-type]').select('classification');
    cy.get('[data-cy=algorithm]').select('random-forest');
    
    // Upload training data
    cy.get('[data-cy=upload-training-data]').click();
    cy.fixture('training-data.csv', 'base64').then(fileContent => {
      cy.get('[data-cy=file-input]').attachFile({
        fileContent,
        fileName: 'training-data.csv',
        mimeType: 'text/csv',
        encoding: 'base64'
      });
    });
    
    // Configure features
    cy.get('[data-cy=feature-selection]').click();
    cy.get('[data-cy=feature-item]').each(($el) => {
      cy.wrap($el).find('[data-cy=feature-checkbox]').check();
    });
    
    // Start training
    cy.get('[data-cy=start-training]').click();
    cy.get('[data-cy=training-progress]', { timeout: 60000 }).should('be.visible');
    
    // Wait for training completion
    cy.get('[data-cy=training-complete]', { timeout: 300000 }).should('be.visible');
    cy.get('[data-cy=model-accuracy]').should('contain', '%');
    
    // Deploy model
    cy.get('[data-cy=deploy-model]').click();
    cy.get('[data-cy=deployment-success]').should('be.visible');
  });

  it('should perform real-time AI inference', () => {
    cy.visit('/ai-inference');
    
    // Select model
    cy.get('[data-cy=model-selector]').select('document-classifier');
    
    // Upload test document
    cy.fixture('test-document.pdf', 'base64').then(fileContent => {
      cy.get('[data-cy=document-upload]').attachFile({
        fileContent,
        fileName: 'test-document.pdf',
        mimeType: 'application/pdf',
        encoding: 'base64'
      });
    });
    
    // Run inference
    cy.get('[data-cy=run-inference]').click();
    cy.get('[data-cy=inference-results]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-cy=confidence-score]').should('contain', '%');
    cy.get('[data-cy=classification-result]').should('not.be.empty');
  });

  it('should monitor model performance and drift', () => {
    cy.visit('/ai-models');
    cy.get('[data-cy=model-item]').first().click();
    
    // Check performance metrics
    cy.get('[data-cy=performance-tab]').click();
    cy.get('[data-cy=accuracy-chart]').should('be.visible');
    cy.get('[data-cy=precision-metric]').should('be.visible');
    cy.get('[data-cy=recall-metric]').should('be.visible');
    
    // Check drift detection
    cy.get('[data-cy=drift-tab]').click();
    cy.get('[data-cy=drift-chart]').should('be.visible');
    cy.get('[data-cy=drift-alerts]').should('be.visible');
  });
});