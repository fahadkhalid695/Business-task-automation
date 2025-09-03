# System Administration and Maintenance Procedures

## Overview

This document provides comprehensive procedures for system administrators to maintain, monitor, and troubleshoot the Business Task Automation Platform. It covers daily operations, maintenance schedules, backup procedures, and emergency response protocols.

## Daily Operations

### Morning Health Check Routine

**System Status Verification (15 minutes)**
1. Check system status dashboard at `/admin/system-status`
2. Verify all services are running and healthy
3. Review overnight error logs and alerts
4. Check database and Redis connectivity
5. Verify external integrations are functioning
6. Monitor resource utilization (CPU, memory, disk)

**Service Health Commands:**
```bash
# Check service status
kubectl get pods -n business-automation
docker-compose ps

# Check service health endpoints
curl -f http://localhost:3000/api/health
curl -f http://localhost:3001/health
curl -f http://localhost:3002/health

# Check database connectivity
mongosh --eval "db.adminCommand('ping')"
redis-cli ping
```

**Key Metrics to Monitor:**
- Response times < 2 seconds for API endpoints
- CPU utilization < 70%
- Memory usage < 80%
- Disk usage < 85%
- Error rate < 1%
- Active user sessions

### User Management Tasks

**Daily User Activities:**
1. Review new user registration requests
2. Process account activation/deactivation requests
3. Monitor failed login attempts and locked accounts
4. Check user permission change requests
5. Review audit logs for suspicious activities

**User Management Commands:**
```bash
# List locked accounts
node scripts/admin/list-locked-accounts.js

# Unlock user account
node scripts/admin/unlock-account.js --email user@example.com

# Reset user password
node scripts/admin/reset-password.js --email user@example.com

# Deactivate user account
node scripts/admin/deactivate-user.js --email user@example.com
```

### Workflow Monitoring

**Workflow Health Check:**
1. Monitor active workflow executions
2. Check for stuck or long-running workflows
3. Review workflow failure rates and error patterns
4. Verify AI service performance and accuracy
5. Monitor external integration status

**Workflow Management Commands:**
```bash
# List active workflows
node scripts/admin/list-active-workflows.js

# Cancel stuck workflow
node scripts/admin/cancel-workflow.js --id workflow_id

# Restart failed workflow
node scripts/admin/restart-workflow.js --id workflow_id

# Check workflow performance
node scripts/admin/workflow-stats.js --days 7
```

## Weekly Maintenance

### System Performance Review

**Performance Analysis (30 minutes weekly)**
1. Generate weekly performance report
2. Analyze response time trends
3. Review resource utilization patterns
4. Identify performance bottlenecks
5. Plan capacity adjustments if needed

**Performance Commands:**
```bash
# Generate performance report
node scripts/admin/generate-performance-report.js --week

# Analyze slow queries
node scripts/admin/analyze-slow-queries.js

# Check cache hit rates
node scripts/admin/cache-statistics.js

# Review error patterns
node scripts/admin/error-analysis.js --days 7
```

### Database Maintenance

**Weekly Database Tasks:**
1. Analyze database performance metrics
2. Review and optimize slow queries
3. Check index usage and effectiveness
4. Clean up temporary collections
5. Verify backup integrity

**Database Maintenance Commands:**
```bash
# Analyze database performance
mongosh --eval "db.runCommand({dbStats: 1})"

# Check index usage
node scripts/admin/analyze-indexes.js

# Clean up old data
node scripts/admin/cleanup-old-data.js --days 90

# Verify backup integrity
node scripts/admin/verify-backups.js --latest
```

### Security Review

**Weekly Security Tasks:**
1. Review security audit logs
2. Check for failed authentication attempts
3. Analyze access patterns for anomalies
4. Update security patches if available
5. Review user permissions and roles

**Security Commands:**
```bash
# Security audit report
node scripts/admin/security-audit.js --week

# Check failed logins
node scripts/admin/failed-logins.js --days 7

# Review user permissions
node scripts/admin/permission-audit.js

# Check for security updates
npm audit
pip list --outdated
```

## Monthly Maintenance

### Comprehensive System Review

**Monthly System Health Assessment (2 hours monthly)**
1. Full system performance analysis
2. Capacity planning and resource forecasting
3. Security compliance review
4. Backup and disaster recovery testing
5. Documentation updates

### Data Archival and Cleanup

**Monthly Data Management:**
1. Archive old workflow executions
2. Clean up temporary files and logs
3. Compress historical data
4. Update data retention policies
5. Verify compliance with regulations

**Data Management Commands:**
```bash
# Archive old executions
node scripts/admin/archive-executions.js --older-than 90

# Clean up temporary files
find /tmp -name "*.tmp" -mtime +7 -delete

# Compress log files
gzip /var/log/business-automation/*.log

# Check data retention compliance
node scripts/admin/retention-compliance.js
```

### System Updates and Patches

**Monthly Update Process:**
1. Review available system updates
2. Test updates in staging environment
3. Schedule maintenance window
4. Apply updates with rollback plan
5. Verify system functionality post-update

**Update Commands:**
```bash
# Check for updates
npm outdated
pip list --outdated
kubectl get nodes -o wide

# Update dependencies (in staging first)
npm update
pip install --upgrade -r requirements.txt

# Update system packages
apt update && apt upgrade
yum update
```

## Backup Procedures

### Automated Backup Configuration

**Database Backups:**
```bash
#!/bin/bash
# Daily MongoDB backup script
BACKUP_DIR="/backups/mongodb/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

mongodump --host localhost:27017 --out $BACKUP_DIR
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

# Upload to cloud storage
aws s3 cp $BACKUP_DIR.tar.gz s3://backup-bucket/mongodb/
```

**File System Backups:**
```bash
#!/bin/bash
# Daily file backup script
BACKUP_DIR="/backups/files/$(date +%Y%m%d)"
SOURCE_DIRS="/app/uploads /app/documents /app/logs"

for dir in $SOURCE_DIRS; do
    rsync -av $dir $BACKUP_DIR/
done

tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR
```

**Configuration Backups:**
```bash
#!/bin/bash
# Configuration backup script
CONFIG_BACKUP="/backups/config/$(date +%Y%m%d)"
mkdir -p $CONFIG_BACKUP

# Backup Kubernetes configurations
kubectl get all --all-namespaces -o yaml > $CONFIG_BACKUP/k8s-config.yaml

# Backup environment files
cp -r /app/.env* $CONFIG_BACKUP/
cp -r /app/config/ $CONFIG_BACKUP/

tar -czf $CONFIG_BACKUP.tar.gz $CONFIG_BACKUP
```

### Backup Verification

**Daily Backup Verification:**
```bash
#!/bin/bash
# Verify backup integrity
LATEST_BACKUP=$(ls -t /backups/mongodb/*.tar.gz | head -1)

# Test backup extraction
mkdir -p /tmp/backup-test
tar -xzf $LATEST_BACKUP -C /tmp/backup-test

# Verify backup contents
if [ -d "/tmp/backup-test" ]; then
    echo "Backup verification successful"
    rm -rf /tmp/backup-test
else
    echo "Backup verification failed" | mail -s "Backup Alert" admin@company.com
fi
```

### Disaster Recovery Testing

**Monthly DR Test Procedure:**
1. Restore from backup in isolated environment
2. Verify data integrity and completeness
3. Test application functionality
4. Document recovery time and issues
5. Update recovery procedures if needed

**DR Test Commands:**
```bash
# Restore MongoDB from backup
mongorestore --host localhost:27017 --drop /path/to/backup

# Restore file system
tar -xzf /backups/files/latest.tar.gz -C /restore/location

# Test application startup
docker-compose -f docker-compose.restore.yml up -d
```

## Monitoring and Alerting

### Alert Configuration

**Critical Alerts (Immediate Response):**
- Service downtime > 1 minute
- Database connectivity failure
- Disk usage > 90%
- Memory usage > 95%
- Error rate > 5%

**Warning Alerts (Response within 1 hour):**
- Response time > 5 seconds
- CPU usage > 80%
- Memory usage > 85%
- Disk usage > 80%
- Failed backup jobs

**Alert Configuration Example:**
```yaml
# Prometheus alerting rules
groups:
- name: business-automation-alerts
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.instance }} is down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
```

### Log Management

**Log Rotation Configuration:**
```bash
# /etc/logrotate.d/business-automation
/var/log/business-automation/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 app app
    postrotate
        systemctl reload business-automation
    endscript
}
```

**Log Analysis Commands:**
```bash
# Check error patterns
grep -i error /var/log/business-automation/*.log | tail -100

# Monitor real-time logs
tail -f /var/log/business-automation/application.log

# Analyze access patterns
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr
```

## Performance Optimization

### Database Optimization

**Index Management:**
```javascript
// MongoDB index optimization
db.workflows.createIndex({ "createdBy": 1, "status": 1 });
db.tasks.createIndex({ "assignedTo": 1, "status": 1, "priority": 1 });
db.executions.createIndex({ "workflowId": 1, "createdAt": -1 });

// Check index usage
db.workflows.aggregate([
  { $indexStats: {} }
]);
```

**Query Optimization:**
```bash
# Enable MongoDB profiler
mongosh --eval "db.setProfilingLevel(2, { slowms: 100 })"

# Analyze slow queries
node scripts/admin/analyze-slow-queries.js --threshold 100
```

### Cache Optimization

**Redis Cache Management:**
```bash
# Check cache statistics
redis-cli info stats

# Monitor cache hit rate
redis-cli info stats | grep keyspace_hits

# Clear specific cache patterns
redis-cli --scan --pattern "workflow:*" | xargs redis-cli del
```

### Application Performance

**Performance Monitoring:**
```bash
# Check Node.js memory usage
node --inspect scripts/admin/memory-usage.js

# Profile application performance
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

## Security Procedures

### Security Monitoring

**Daily Security Checks:**
1. Review authentication logs
2. Check for brute force attempts
3. Monitor privilege escalations
4. Verify SSL certificate status
5. Check for security vulnerabilities

**Security Commands:**
```bash
# Check failed login attempts
grep "authentication failed" /var/log/auth.log

# Monitor privilege changes
grep "sudo" /var/log/auth.log | tail -20

# Check SSL certificate expiry
openssl x509 -in /etc/ssl/certs/app.crt -noout -dates

# Scan for vulnerabilities
npm audit --audit-level moderate
```

### Access Control Management

**User Access Review:**
```bash
# List users with admin privileges
node scripts/admin/list-admin-users.js

# Review recent permission changes
node scripts/admin/permission-changes.js --days 7

# Check inactive accounts
node scripts/admin/inactive-accounts.js --days 90
```

### Incident Response

**Security Incident Procedure:**
1. **Immediate Response (0-15 minutes)**
   - Identify and contain the threat
   - Preserve evidence and logs
   - Notify security team and management

2. **Assessment (15-60 minutes)**
   - Determine scope and impact
   - Identify affected systems and data
   - Document timeline of events

3. **Containment (1-4 hours)**
   - Isolate affected systems
   - Implement temporary fixes
   - Monitor for additional threats

4. **Recovery (4-24 hours)**
   - Restore systems from clean backups
   - Apply security patches
   - Verify system integrity

5. **Post-Incident (24-72 hours)**
   - Conduct thorough investigation
   - Update security procedures
   - Provide incident report

## Troubleshooting Procedures

### Service Recovery

**Service Restart Procedures:**
```bash
# Restart individual services
docker-compose restart api-gateway
kubectl rollout restart deployment/task-orchestrator

# Full system restart
docker-compose down && docker-compose up -d
kubectl delete pods --all -n business-automation

# Check service dependencies
node scripts/admin/check-dependencies.js
```

### Database Issues

**Database Recovery:**
```bash
# Check database status
mongosh --eval "db.adminCommand('serverStatus')"

# Repair database if needed
mongod --repair --dbpath /data/db

# Restore from backup if corrupted
mongorestore --drop /path/to/backup
```

### Network Issues

**Network Troubleshooting:**
```bash
# Check service connectivity
telnet localhost 3000
nc -zv localhost 27017

# Test external integrations
curl -I https://api.external-service.com/health

# Check DNS resolution
nslookup api.external-service.com
```

## Emergency Procedures

### System Outage Response

**Outage Response Checklist:**
1. **Immediate (0-5 minutes)**
   - [ ] Acknowledge the outage
   - [ ] Check system status dashboard
   - [ ] Notify stakeholders
   - [ ] Begin initial diagnosis

2. **Short-term (5-30 minutes)**
   - [ ] Identify root cause
   - [ ] Implement quick fixes if possible
   - [ ] Activate backup systems
   - [ ] Provide status updates

3. **Recovery (30+ minutes)**
   - [ ] Execute recovery procedures
   - [ ] Verify system functionality
   - [ ] Monitor for stability
   - [ ] Document incident

### Data Loss Recovery

**Data Recovery Procedure:**
1. Stop all write operations immediately
2. Assess extent of data loss
3. Identify most recent clean backup
4. Restore from backup in isolated environment
5. Verify data integrity
6. Merge any recoverable recent changes
7. Switch to restored system
8. Monitor for issues

### Communication Templates

**Outage Notification Template:**
```
Subject: [URGENT] System Outage - Business Automation Platform

We are currently experiencing an outage with the Business Automation Platform.

Status: Investigating
Start Time: [TIME]
Affected Services: [SERVICES]
Impact: [DESCRIPTION]

We are working to resolve this issue as quickly as possible and will provide updates every 15 minutes.

Next Update: [TIME]
Status Page: [URL]
```

## Maintenance Schedules

### Daily Tasks (15-30 minutes)
- [ ] System health check
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Check backup completion
- [ ] Review user activities

### Weekly Tasks (1-2 hours)
- [ ] Performance analysis
- [ ] Security review
- [ ] Database maintenance
- [ ] Update system documentation
- [ ] Test disaster recovery procedures

### Monthly Tasks (4-8 hours)
- [ ] Comprehensive system review
- [ ] Capacity planning
- [ ] Security audit
- [ ] System updates and patches
- [ ] Data archival and cleanup

### Quarterly Tasks (1-2 days)
- [ ] Full disaster recovery test
- [ ] Security penetration testing
- [ ] Performance benchmarking
- [ ] Documentation review and update
- [ ] Staff training and certification

## Contact Information

### Emergency Contacts
- **System Administrator**: admin@company.com, +1-555-0100
- **Database Administrator**: dba@company.com, +1-555-0101
- **Security Team**: security@company.com, +1-555-0102
- **Development Team**: dev@company.com, +1-555-0103

### Vendor Support
- **MongoDB Support**: Case Portal, +1-844-666-4632
- **Redis Support**: support@redis.com
- **AWS Support**: Console, +1-206-266-4064
- **Docker Support**: support.docker.com

### Escalation Matrix
1. **Level 1**: System Administrator (Response: 15 minutes)
2. **Level 2**: Senior Administrator (Response: 30 minutes)
3. **Level 3**: Engineering Manager (Response: 1 hour)
4. **Level 4**: CTO/VP Engineering (Response: 2 hours)

---

*This document should be reviewed and updated quarterly to ensure procedures remain current and effective.*