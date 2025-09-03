// Custom Cypress commands for business automation testing

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      createWorkflow(workflowData: any): Chainable<void>;
      uploadFile(selector: string, fileName: string, fileType?: string): Chainable<void>;
      waitForAIProcessing(): Chainable<void>;
      checkAccessibility(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type(email);
    cy.get('[data-cy=password-input]').type(password);
    cy.get('[data-cy=login-button]').click();
    cy.url().should('include', '/dashboard');
  });
});

Cypress.Commands.add('createWorkflow', (workflowData) => {
  cy.request({
    method: 'POST',
    url: '/api/v1/workflows',
    body: workflowData,
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('token')}`
    }
  }).then((response) => {
    expect(response.status).to.eq(201);
  });
});

Cypress.Commands.add('uploadFile', (selector: string, fileName: string, fileType = 'application/octet-stream') => {
  cy.fixture(fileName, 'base64').then(fileContent => {
    cy.get(selector).attachFile({
      fileContent,
      fileName,
      mimeType: fileType,
      encoding: 'base64'
    });
  });
});

Cypress.Commands.add('waitForAIProcessing', () => {
  cy.get('[data-cy=processing-indicator]', { timeout: 60000 }).should('not.exist');
  cy.get('[data-cy=processing-complete]', { timeout: 60000 }).should('be.visible');
});

Cypress.Commands.add('checkAccessibility', () => {
  cy.injectAxe();
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true }
    }
  });
});

// Database helpers
Cypress.Commands.add('seedTestData', () => {
  cy.task('seedDatabase');
});

Cypress.Commands.add('cleanTestData', () => {
  cy.task('cleanDatabase');
});

export {};