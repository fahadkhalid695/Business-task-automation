import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'testing/e2e/support/e2e.ts',
    specPattern: 'testing/e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
    fixturesFolder: 'testing/e2e/fixtures',
    screenshotsFolder: 'testing/e2e/screenshots',
    videosFolder: 'testing/e2e/videos',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    retries: {
      runMode: 2,
      openMode: 0
    },
    env: {
      apiUrl: 'http://localhost:3000/api/v1',
      testUser: 'user@test.com',
      testPassword: 'TestUser123!',
      adminUser: 'admin@test.com',
      adminPassword: 'TestAdmin123!'
    },
    setupNodeEvents(on, config) {
      // Database seeding and cleanup
      on('task', {
        seedDatabase() {
          // Seed test data
          return null;
        },
        cleanDatabase() {
          // Clean test data
          return null;
        }
      });

      // Code coverage
      require('@cypress/code-coverage/task')(on, config);
      
      return config;
    },
  },
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
    specPattern: 'testing/e2e/components/**/*.cy.{js,jsx,ts,tsx}',
  },
});