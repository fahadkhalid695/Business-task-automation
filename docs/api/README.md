# API Documentation

This directory contains comprehensive API documentation for all service endpoints in the Business Task Automation Platform.

## API Overview

The platform exposes RESTful APIs through a centralized API Gateway, providing secure and standardized access to all business automation services.

### Base URL
```
Production: https://api.business-automation.com/v1
Development: http://localhost:3000/api/v1
```

### Authentication
All API endpoints require authentication using JWT tokens:
```
Authorization: Bearer <jwt_token>
```

## Service APIs

### Core Services
- [Authentication API](auth-api.md) - User authentication and authorization
- [User Management API](user-api.md) - User profile and preference management
- [Task Management API](task-api.md) - Task creation, tracking, and management
- [Workflow API](workflow-api.md) - Workflow templates and execution

### Business Domain Services
- [Administrative Service API](administrative-api.md) - Email, calendar, document automation
- [Data Analytics API](data-analytics-api.md) - Data processing and reporting
- [Communication API](communication-api.md) - Chatbot, transcription, translation
- [Project Management API](project-management-api.md) - Project tracking and coordination
- [Finance & HR API](finance-hr-api.md) - Financial and HR process automation
- [Creative Service API](creative-api.md) - Content generation and design assistance

### Integration Services
- [Integration API](integration-api.md) - External system integrations
- [Monitoring API](monitoring-api.md) - System metrics and health monitoring
- [AI/ML Engine API](ai-ml-api.md) - AI model management and inference

## OpenAPI Specifications

Complete OpenAPI 3.0 specifications are available:
- [Complete API Spec](openapi.yaml) - Full system API specification
- [Postman Collection](postman-collection.json) - Ready-to-use API collection

## Quick Start

1. **Get API Token**: Authenticate using `/auth/login` endpoint
2. **Explore APIs**: Use the interactive Swagger UI at `/api/docs`
3. **Test Endpoints**: Import the Postman collection for testing
4. **Rate Limits**: Check response headers for rate limit information

## Response Format

All APIs follow a consistent response format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-12-03T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-12-03T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting

API requests are rate limited:
- **Authenticated Users**: 1000 requests/hour
- **Premium Users**: 5000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:
```
GET /api/v1/tasks?page=1&limit=20&sort=createdAt&order=desc
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## WebSocket API

Real-time updates are available via WebSocket:
```javascript
const socket = io('ws://localhost:3000', {
  auth: { token: 'jwt_token' }
});

socket.on('task:updated', (data) => {
  console.log('Task updated:', data);
});
```

## SDK and Libraries

Official SDKs available:
- [JavaScript/TypeScript SDK](https://github.com/business-automation/js-sdk)
- [Python SDK](https://github.com/business-automation/python-sdk)
- [REST Client Examples](examples/) - Code examples in various languages