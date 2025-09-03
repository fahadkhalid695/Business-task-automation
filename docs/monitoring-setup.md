# System Monitoring and Analytics Setup Guide

## Overview

This document provides comprehensive instructions for setting up and configuring the system monitoring and analytics infrastructure for the Business Task Automation Platform.

## Features

### 1. Business Metrics Tracking
- **Task Completion Rates**: Monitor success/failure rates across different task types
- **User Satisfaction**: Track user feedback and satisfaction scores
- **Workflow Efficiency**: Measure automation rates and execution times
- **Cost per Task**: Monitor operational costs and optimization opportunities

### 2. System Performance Monitoring
- **Real-time Metrics**: CPU, memory, disk, and network utilization
- **Service Health**: Availability and performance of all microservices
- **Response Times**: API endpoint performance tracking
- **Error Rates**: System-wide error monitoring and alerting

### 3. Alerting System
- **Multi-level Escalation**: Configurable escalation procedures
- **Multiple Channels**: Email, Slack, SMS, and phone notifications
- **Smart Routing**: Context-aware alert routing based on severity
- **Auto-resolution**: Automatic alert resolution when conditions normalize

### 4. Analytics and Insights
- **Anomaly Detection**: ML-powered detection of unusual patterns
- **Capacity Planning**: Predictive analytics for resource needs
- **User Behavior Analysis**: Usage patterns and feature adoption
- **Cost Optimization**: Automated recommendations for cost savings

### 5. Interactive Dashboards
- **Real-time Visualization**: Live charts and metrics
- **Custom Dashboards**: User-configurable dashboard layouts
- **Drill-down Capabilities**: Detailed analysis of specific metrics
- **Mobile Responsive**: Access from any device

## Installation

### Prerequisites

1. **Node.js** (v16 or higher)
2. **MongoDB** (v5.0 or higher)
3. **Redis** (v6.0 or higher)
4. **Docker** (optional, for containerized deployment)

### Environment Variables

Create a `.env` file in the services directory with the following variables:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/business_automation
REDIS_URL=redis://localhost:6379

# Monitoring Configuration
METRICS_RETENTION_DAYS=30
ALERT_RETENTION_DAYS=90
COLLECTION_INTERVAL_SECONDS=60
HEALTH_CHECK_INTERVAL_SECONDS=30

# Notification Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=monitoring@yourcompany.com

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Alert Recipients
ALERT_EMAIL_RECIPIENTS=admin@yourcompany.com,ops@yourcompany.com
CRITICAL_ALERT_PHONE=+1234567890

# Dashboard Configuration
DASHBOARD_URL=https://your-dashboard-url.com
```

### Installation Steps

1. **Install Dependencies**
   ```bash
   cd services
   npm install
   ```

2. **Initialize Database Collections**
   ```bash
   npm run setup:monitoring
   ```

3. **Start the Monitoring Service**
   ```bash
   npm run start:monitoring
   ```

4. **Verify Installation**
   ```bash
   curl http://localhost:3000/api/monitoring/health
   ```

## Configuration

### 1. Monitoring Configuration

Edit `services/monitoring-config.json` to customize:

- **Metrics Retention**: How long to keep historical data
- **Collection Intervals**: How frequently to collect metrics
- **Thresholds**: Warning and critical levels for various metrics
- **Alert Rules**: Escalation procedures and notification settings

### 2. Alert Configuration

Configure alert thresholds and escalation rules:

```json
{
  "thresholds": {
    "system": {
      "cpu": { "warning": 80, "critical": 90 },
      "memory": { "warning": 85, "critical": 95 }
    },
    "business": {
      "taskCompletionRate": { "target": 95, "warning": 90 }
    }
  }
}
```

### 3. Dashboard Setup

Create custom dashboards through the API or web interface:

```javascript
// Create a custom dashboard
const dashboard = await fetch('/api/monitoring/dashboards', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Custom Dashboard',
    widgets: [
      {
        type: 'metric',
        title: 'CPU Usage',
        query: 'metrics where name = system.cpu.usage',
        position: { x: 0, y: 0, width: 3, height: 2 }
      }
    ]
  })
});
```

## API Reference

### Health Endpoints

- `GET /api/monitoring/health` - Basic system health check
- `GET /api/monitoring/health/detailed` - Comprehensive health report
- `GET /api/monitoring/health/diagnostics` - System diagnostics

### Metrics Endpoints

- `GET /api/monitoring/metrics/system` - System resource metrics
- `GET /api/monitoring/metrics/business` - Business performance metrics
- `GET /api/monitoring/metrics/performance/:service` - Service performance
- `POST /api/monitoring/metrics/custom` - Record custom metrics

### Analytics Endpoints

- `GET /api/monitoring/analytics/insights` - Generated insights
- `GET /api/monitoring/analytics/anomalies` - Detected anomalies
- `GET /api/monitoring/analytics/capacity-prediction` - Capacity forecasts

### Alert Endpoints

- `GET /api/monitoring/alerts` - Active alerts
- `POST /api/monitoring/alerts` - Create custom alert
- `PUT /api/monitoring/alerts/:id/acknowledge` - Acknowledge alert
- `PUT /api/monitoring/alerts/:id/resolve` - Resolve alert

### Dashboard Endpoints

- `GET /api/monitoring/dashboards` - List dashboards
- `POST /api/monitoring/dashboards` - Create dashboard
- `GET /api/monitoring/dashboards/:id` - Get dashboard
- `PUT /api/monitoring/dashboards/:id` - Update dashboard

## Usage Examples

### 1. Creating Custom Metrics

```javascript
// Record a custom business metric
await fetch('/api/monitoring/metrics/custom', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    metric: {
      name: 'custom.sales.conversion_rate',
      type: 'gauge',
      value: 15.5,
      labels: { region: 'us-west', product: 'premium' },
      service: 'sales'
    }
  })
});
```

### 2. Setting Up Custom Alerts

```javascript
// Create a custom alert for high API response time
await fetch('/api/monitoring/alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'High API Response Time',
    description: 'API response time exceeds acceptable threshold',
    severity: 'high',
    condition: '>',
    threshold: 1000,
    service: 'api-gateway'
  })
});
```

### 3. Querying Metrics

```javascript
// Query system metrics with filters
await fetch('/api/monitoring/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'metrics where name = system.cpu.usage and service = api-gateway time_range(1h)'
  })
});
```

## Monitoring Best Practices

### 1. Metric Collection
- **Collect Relevant Metrics**: Focus on metrics that directly impact business outcomes
- **Avoid Metric Explosion**: Don't create too many high-cardinality metrics
- **Use Consistent Naming**: Follow a consistent naming convention for metrics
- **Add Context**: Include relevant labels and metadata

### 2. Alerting Strategy
- **Alert on Symptoms**: Alert on user-facing issues, not just technical metrics
- **Reduce Noise**: Tune thresholds to minimize false positives
- **Escalation Procedures**: Define clear escalation paths for different severities
- **Runbooks**: Create detailed runbooks for common alerts

### 3. Dashboard Design
- **User-Focused**: Design dashboards for specific user roles and needs
- **Actionable Information**: Include metrics that lead to actionable insights
- **Visual Hierarchy**: Use colors and layout to highlight important information
- **Performance**: Optimize dashboard queries for fast loading

### 4. Capacity Planning
- **Trend Analysis**: Monitor long-term trends for capacity planning
- **Predictive Alerts**: Set up alerts for predicted capacity issues
- **Resource Optimization**: Regularly review and optimize resource usage
- **Cost Monitoring**: Track costs and identify optimization opportunities

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metrics retention settings
   - Verify database indexes are optimized
   - Monitor for memory leaks in collection processes

2. **Missing Metrics**
   - Verify service connectivity
   - Check collection interval configuration
   - Review error logs for collection failures

3. **Alert Fatigue**
   - Review and tune alert thresholds
   - Implement alert suppression rules
   - Consolidate related alerts

4. **Dashboard Performance**
   - Optimize query performance
   - Implement proper caching
   - Reduce data granularity for long time ranges

### Log Analysis

Monitor logs for common patterns:

```bash
# Check monitoring service logs
tail -f logs/monitoring.log | grep ERROR

# Monitor alert processing
tail -f logs/alerts.log | grep "Alert created"

# Check metric collection issues
tail -f logs/metrics.log | grep "Collection failed"
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review alert summary reports
   - Check system health scores
   - Analyze capacity trends

2. **Monthly**
   - Clean up old metrics data
   - Review and update alert thresholds
   - Optimize dashboard performance

3. **Quarterly**
   - Review monitoring strategy
   - Update escalation procedures
   - Assess cost optimization opportunities

### Data Retention

Configure appropriate retention policies:

```json
{
  "retention": {
    "metrics": {
      "raw": "7d",
      "hourly": "30d",
      "daily": "1y"
    },
    "alerts": "90d",
    "logs": "30d"
  }
}
```

## Security Considerations

1. **Access Control**: Implement role-based access to monitoring data
2. **Data Encryption**: Encrypt sensitive monitoring data
3. **Audit Logging**: Log all monitoring configuration changes
4. **Network Security**: Secure monitoring endpoints and communications

## Integration with External Tools

### Prometheus Integration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'business-automation'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/monitoring/metrics/prometheus'
```

### Grafana Integration
- Import pre-built dashboards from `grafana-dashboards/`
- Configure data source to point to monitoring API
- Set up alert notifications through Grafana

### ELK Stack Integration
- Forward logs to Elasticsearch
- Create Kibana dashboards for log analysis
- Set up log-based alerts

## Support

For additional support:
- Check the troubleshooting section above
- Review system logs for error messages
- Contact the development team with specific issues
- Refer to the API documentation for detailed endpoint information