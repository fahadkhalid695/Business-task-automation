import winston from 'winston';

interface AuthEvent {
  type: 'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'ACCOUNT_LOCKED';
  userId?: string;
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  sessionId?: string;
}

interface AuthzEvent {
  userId: string;
  resource: string;
  action: string;
  granted: boolean;
  ip: string;
}

interface DataAccessEvent {
  userId: string;
  resource: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  recordId?: string;
  ip: string;
}

interface SecurityIncident {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'INJECTION' | 'XSS' | 'CSRF' | 'BRUTE_FORCE' | 'DATA_BREACH' | 'OTHER';
  description: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  additionalData?: any;
}

export class AuditLogger {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'business-automation' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/audit.log',
          level: 'info'
        }),
        new winston.transports.File({ 
          filename: 'logs/security.log',
          level: 'warn'
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ],
    });
  }

  logAuthenticationEvent(event: AuthEvent): void {
    this.logger.info('Authentication event', {
      type: 'AUTHENTICATION',
      event: event.type,
      userId: event.userId,
      email: event.email,
      ip: event.ip,
      userAgent: event.userAgent,
      success: event.success,
      timestamp: new Date().toISOString(),
      sessionId: event.sessionId
    });
  }

  logAuthorizationEvent(event: AuthzEvent): void {
    this.logger.info('Authorization event', {
      type: 'AUTHORIZATION',
      userId: event.userId,
      resource: event.resource,
      action: event.action,
      granted: event.granted,
      ip: event.ip,
      timestamp: new Date().toISOString()
    });
  }

  logDataAccess(event: DataAccessEvent): void {
    this.logger.info('Data access event', {
      type: 'DATA_ACCESS',
      userId: event.userId,
      resource: event.resource,
      action: event.action,
      recordId: event.recordId,
      ip: event.ip,
      timestamp: new Date().toISOString()
    });
  }

  logSecurityIncident(event: SecurityIncident): void {
    this.logger.error('Security incident', {
      type: 'SECURITY_INCIDENT',
      severity: event.severity,
      category: event.category,
      description: event.description,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      timestamp: new Date().toISOString(),
      additionalData: event.additionalData
    });
  }
}