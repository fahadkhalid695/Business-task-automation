import { Router } from 'express';
import { FinanceHRService } from '../../finance-hr-service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { 
  ExpenseProcessingRequest,
  PayrollVerificationRequest,
  ResumeScreeningRequest,
  OnboardingRequest
} from '../../finance-hr-service/types/FinanceHRTypes';
import { logger } from '../../shared/utils/logger';

const router = Router();
const financeHRService = new FinanceHRService();

/**
 * @route POST /api/v1/finance-hr/expenses/process
 * @desc Process expense receipts with OCR and policy validation
 * @access Private
 */
router.post('/expenses/process', authenticate, async (req, res, next) => {
  try {
    const request: ExpenseProcessingRequest = req.body;
    const result = await financeHRService.processExpenses(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Expense processing failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route POST /api/v1/finance-hr/payroll/verify
 * @desc Verify payroll data and generate payslips
 * @access Private
 */
router.post('/payroll/verify', authenticate, async (req, res, next) => {
  try {
    const request: PayrollVerificationRequest = req.body;
    const result = await financeHRService.verifyPayroll(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Payroll verification failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route POST /api/v1/finance-hr/resumes/screen
 * @desc Screen resumes against job requirements
 * @access Private
 */
router.post('/resumes/screen', authenticate, async (req, res, next) => {
  try {
    const request: ResumeScreeningRequest = req.body;
    const result = await financeHRService.screenResumes(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Resume screening failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route POST /api/v1/finance-hr/onboarding/create
 * @desc Create employee onboarding plan
 * @access Private
 */
router.post('/onboarding/create', authenticate, async (req, res, next) => {
  try {
    const request: OnboardingRequest = req.body;
    const result = await financeHRService.createOnboarding(request);
    
    res.json(result);
  } catch (error) {
    logger.error('Onboarding creation failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route POST /api/v1/finance-hr/integrations/:id
 * @desc Add external system integration
 * @access Private
 */
router.post('/integrations/:id', authenticate, async (req, res, next) => {
  try {
    const integrationId = req.params.id;
    const integration = req.body;
    const result = await financeHRService.addIntegration(integrationId, integration);
    
    res.json(result);
  } catch (error) {
    logger.error('Integration setup failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route DELETE /api/v1/finance-hr/integrations/:id
 * @desc Remove external system integration
 * @access Private
 */
router.delete('/integrations/:id', authenticate, async (req, res, next) => {
  try {
    const integrationId = req.params.id;
    const result = await financeHRService.removeIntegration(integrationId);
    
    res.json(result);
  } catch (error) {
    logger.error('Integration removal failed', { error: error.message, userId: req.user?.id });
    next(error);
  }
});

/**
 * @route GET /api/v1/finance-hr/health
 * @desc Get Finance/HR service health status
 * @access Private
 */
router.get('/health', authenticate, async (req, res, next) => {
  try {
    const result = await financeHRService.getHealthStatus();
    res.json(result);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    next(error);
  }
});

export { router as financeHRRoutes };