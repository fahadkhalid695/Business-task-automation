describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should redirect to login when not authenticated', () => {
    cy.url().should('include', '/login');
  });

  it('should login with valid credentials', () => {
    cy.login();
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="welcome-message"]').should('be.visible');
  });

  it('should show error with invalid credentials', () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('invalid@test.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain.text', 'Invalid credentials');
  });

  it('should logout successfully', () => {
    cy.login();
    cy.logout();
    cy.url().should('include', '/login');
  });

  it('should maintain session across page refreshes', () => {
    cy.login();
    cy.reload();
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('should handle token expiration', () => {
    cy.login();
    
    // Simulate token expiration
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'expired-token');
    });
    
    cy.reload();
    cy.url().should('include', '/login');
  });
});