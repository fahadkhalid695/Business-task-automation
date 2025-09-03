describe('Authentication Workflow', () => {
  beforeEach(() => {
    cy.task('cleanDatabase');
    cy.task('seedDatabase');
    cy.visit('/');
  });

  it('should complete user registration and login flow', () => {
    // Registration
    cy.get('[data-cy=register-link]').click();
    cy.get('[data-cy=email-input]').type('newuser@test.com');
    cy.get('[data-cy=password-input]').type('NewUser123!');
    cy.get('[data-cy=confirm-password-input]').type('NewUser123!');
    cy.get('[data-cy=register-button]').click();
    
    cy.get('[data-cy=success-message]').should('contain', 'Registration successful');
    
    // Login
    cy.get('[data-cy=email-input]').type('newuser@test.com');
    cy.get('[data-cy=password-input]').type('NewUser123!');
    cy.get('[data-cy=login-button]').click();
    
    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=user-menu]').should('be.visible');
  });

  it('should handle password reset flow', () => {
    cy.get('[data-cy=forgot-password-link]').click();
    cy.get('[data-cy=email-input]').type('user@test.com');
    cy.get('[data-cy=reset-button]').click();
    
    cy.get('[data-cy=success-message]').should('contain', 'Reset email sent');
  });

  it('should enforce role-based access control', () => {
    // Login as regular user
    cy.login('user@test.com', 'TestUser123!');
    
    // Try to access admin area
    cy.visit('/admin');
    cy.get('[data-cy=access-denied]').should('be.visible');
    
    // Login as admin
    cy.login('admin@test.com', 'TestAdmin123!');
    cy.visit('/admin');
    cy.get('[data-cy=admin-dashboard]').should('be.visible');
  });
});