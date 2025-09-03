import dotenv from 'dotenv';
import { APIGateway } from './api-gateway';

// Load environment variables
dotenv.config();

// Export all services for external use
export * from './api-gateway';
export * from './task-orchestrator';
export * from './administrative-service';
export * from './data-analytics-service';
export * from './communication-service';
export * from './project-management-service';
export * from './finance-hr-service';
export * from './creative-service';
export * from './ai-ml-engine';
export * from './shared';

// Start services
async function startServices() {
  try {
    // Start the API Gateway (which includes all service routes)
    const gateway = new APIGateway();
    await gateway.start();
    
    console.log('All services started successfully');
  } catch (error) {
    console.error('Failed to start services:', error);
    process.exit(1);
  }
}

// Only start services if this file is run directly
if (require.main === module) {
  startServices();
}