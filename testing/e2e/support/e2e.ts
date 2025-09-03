// Import commands
import './commands';
import 'cypress-file-upload';
import 'cypress-axe';

// Global test configuration
beforeEach(() => {
  // Intercept API calls for better test control
  cy.intercept('GET', '/api/v1/health', { fixture: 'health-check.json' });
  cy.intercept('POST', '/api/v1/auth/login', { fixture: 'auth-response.json' });
  
  // Set up viewport
  cy.viewport(1280, 720);
  
  // Clear local storage
  cy.clearLocalStorage();
});

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on unhandled promise rejections
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  return true;
});

// Custom error handling
Cypress.on('fail', (err, runnable) => {
  // Take screenshot on failure
  cy.screenshot(`failure-${runnable.title}`, { capture: 'fullPage' });
  throw err;
});