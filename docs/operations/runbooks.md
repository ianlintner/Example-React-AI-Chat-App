# Operations Runbooks

Step-by-step procedures for operating, monitoring, and maintaining the AI Chat system in production.

## System Health Monitoring

### Daily Health Check

```bash
#!/bin/bash
# Daily system health verification

echo "=== AI Chat System Health Check $(date) ==="

# Check service availability
echo "1. Service Health:"
curl -f http://localhost:3001/health && echo "✅ Backend healthy" || echo "❌ Backend down"
curl -f http://localhost:8080/health && echo "✅ Frontend healthy" || echo "❌ Frontend down"

# Check database connectivity
echo "2. Database Status:"
docker-compose exec database pg_isready -U postgres && echo "✅ Database connected" || echo "❌ Database issues"

# Check message queue
echo "3. Queue Status:"
docker-compose exec redis redis-cli ping && echo "✅ Redis queue operational" || echo "❌ Redis issues"

# Check observability stack
echo "4. Observability:"
curl -f http://localhost:9090/api/v1/query?query=up && echo "✅ Prometheus collecting" || echo "❌ Prometheus issues"
curl -f http://localhost:3000/api/health && echo "✅ Grafana accessible" || echo "❌ Grafana issues"

# Check disk space
echo "5. System Resources:"
df -h | grep -E "(/$|/var)" | awk '{print $5 " used on " $6}' | while read line; do
  usage=$(echo $line | cut -d' ' -f1 | sed 's/%//')
  if [ $usage -gt 80 ]; then
    echo "⚠️  High disk usage: $line"
  else
    echo "✅ Disk usage OK: $line"
  fi
done

echo "=== Health Check Complete ==="
```

### Service Status Dashboard

```bash
# Quick service status overview
function service_status() {
  echo "=== Service Status Overview ==="
  
  # Docker containers
  echo "Container Status:"
  docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
  
  # Resource usage
  echo -e "\nResource Usage:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
  
  # Network connectivity
  echo -e "\nNetwork Tests:"
  ping -c 1 8.8.8.8 >/dev/null && echo "✅ Internet connectivity" || echo "❌ No internet"
  
  # Recent logs (last 5 minutes)
  echo -e "\nRecent Errors:"
  docker-compose logs --since 5m 2>&1 | grep -i "error\|exception\|failed" | tail -10
}
```

## Incident Response

### Service Down Recovery

**Symptom**: Service unreachable or returning 5xx errors

```bash
# Step 1: Immediate assessment
echo "=== Service Recovery Procedure ==="

# Check which services are down
docker-compose ps

# Check recent logs for errors
docker-compose logs --tail=50 backend frontend

# Step 2: Quick restart attempt
docker-compose restart

# Step 3: Wait and verify
sleep 30
curl -f http://localhost:3001/health
curl -f http://localhost:8080/health

# Step 4: If still failing, full rebuild
if [ $? -ne 0 ]; then
  echo "Restart failed, performing full rebuild..."
  docker-compose down
  docker-compose build --no-cache
  docker-compose up -d
  
  # Wait for services to initialize
  sleep 60
  
  # Verify recovery
  curl -f http://localhost:3001/health && echo "✅ Recovery successful" || echo "❌ Recovery failed"
fi
```

### Database Issues

**Symptom**: Database connection errors or data inconsistency

```bash
# Database recovery procedure
function db_recovery() {
  echo "=== Database Recovery Procedure ==="
  
  # Step 1: Check database status
  docker-compose exec database pg_isready -U postgres
  
  # Step 2: Check for corrupted connections
  docker-compose exec database psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
  
  # Step 3: Restart database if needed
  if [ $? -ne 0 ]; then
    echo "Restarting database container..."
    docker-compose restart database
    sleep 20
  fi
  
  # Step 4: Run integrity checks
  echo "Running database integrity checks..."
  docker-compose exec database psql -U postgres -d chatdb -c "
    SELECT schemaname, tablename, attname, n_distinct, correlation 
    FROM pg_stats 
    WHERE tablename IN ('messages', 'conversations', 'agents');
  "
  
  # Step 5: Vacuum and analyze (if needed)
  docker-compose exec database psql -U postgres -d chatdb -c "VACUUM ANALYZE;"
  
  echo "Database recovery complete"
}
```

### Message Queue Overflow

**Symptom**: High memory usage, slow message processing

```bash
# Queue overflow management
function queue_overflow_recovery() {
  echo "=== Queue Overflow Recovery ==="
  
  # Step 1: Check queue sizes
  echo "Current queue status:"
  docker-compose exec redis redis-cli info memory
  docker-compose exec redis redis-cli llen message_queue
  docker-compose exec redis redis-cli llen dead_letter_queue
  
  # Step 2: Process dead letter queue
  echo "Processing dead letter queue..."
  docker-compose exec backend npm run queue:process-dlq
  
  # Step 3: Increase processing workers temporarily
  docker-compose scale backend=3
  
  # Step 4: Monitor queue drain
  while [ $(docker-compose exec redis redis-cli llen message_queue) -gt 1000 ]; do
    echo "Queue size: $(docker-compose exec redis redis-cli llen message_queue)"
    sleep 30
  done
  
  # Step 5: Scale back to normal
  docker-compose scale backend=1
  
  echo "Queue overflow resolved"
}
```

## Deployment Procedures

### Production Deployment

```bash
#!/bin/bash
# Production deployment checklist

echo "=== Production Deployment Procedure ==="

# Pre-deployment checks
echo "1. Pre-deployment verification:"
git status
npm test
npm run lint
docker-compose -f docker-compose.prod.yml build

# Create backup
echo "2. Creating backup:"
timestamp=$(date +%Y%m%d_%H%M%S)
docker-compose exec database pg_dump -U postgres chatdb > "backup_${timestamp}.sql"
docker-compose exec redis redis-cli --rdb "backup_redis_${timestamp}.rdb"

# Deploy new version
echo "3. Deploying new version:"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Post-deployment verification
echo "4. Post-deployment checks:"
sleep 60

# Health checks
curl -f http://localhost:3001/health || { echo "❌ Backend health check failed"; exit 1; }
curl -f http://localhost:8080/health || { echo "❌ Frontend health check failed"; exit 1; }

# Functional tests
echo "5. Running smoke tests:"
npm run test:smoke

echo "✅ Deployment completed successfully"
```

### Rollback Procedure

```bash
# Emergency rollback
function emergency_rollback() {
  echo "=== EMERGENCY ROLLBACK INITIATED ==="
  
  # Step 1: Stop current version
  docker-compose -f docker-compose.prod.yml down
  
  # Step 2: Switch to previous stable version
  git checkout HEAD~1
  docker-compose -f docker-compose.prod.yml build
  docker-compose -f docker-compose.prod.yml up -d
  
  # Step 3: Restore database if needed
  if [ -f "backup_*.sql" ]; then
    latest_backup=$(ls -t backup_*.sql | head -1)
    docker-compose exec database psql -U postgres -d chatdb < $latest_backup
  fi
  
  # Step 4: Verify rollback
  sleep 30
  curl -f http://localhost:3001/health && echo "✅ Rollback successful" || echo "❌ Rollback failed"
  
  echo "ROLLBACK COMPLETED - INVESTIGATE FAILURE"
}
```

## Performance Optimization

### CPU and Memory Optimization

```bash
# Performance tuning for high load
function optimize_performance() {
  echo "=== Performance Optimization ==="
  
  # Step 1: Analyze current resource usage
  echo "Current resource usage:"
  docker stats --no-stream
  
  # Step 2: Optimize Docker resources
  echo "Optimizing container resources..."
  
  # Update docker-compose with resource limits
  cat > docker-compose.override.yml << EOF
version: '3.8'
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          memory: 1G
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
  
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
EOF
  
  # Step 3: Apply optimizations
  docker-compose up -d
  
  # Step 4: Verify improvements
  sleep 30
  docker stats --no-stream
}
```

### Database Performance Tuning

```bash
# Database optimization
function optimize_database() {
  echo "=== Database Performance Optimization ==="
  
  # Step 1: Analyze slow queries
  docker-compose exec database psql -U postgres -d chatdb -c "
    SELECT query, calls, total_time, mean_time
    FROM pg_stat_statements
    ORDER BY total_time DESC
    LIMIT 10;
  "
  
  # Step 2: Update database configuration
  docker-compose exec database psql -U postgres -c "
    ALTER SYSTEM SET shared_buffers = '256MB';
    ALTER SYSTEM SET effective_cache_size = '1GB';
    ALTER SYSTEM SET maintenance_work_mem = '64MB';
    SELECT pg_reload_conf();
  "
  
  # Step 3: Create indexes for common queries
  docker-compose exec database psql -U postgres -d chatdb -c "
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_timestamp 
    ON messages(timestamp DESC);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user 
    ON conversations(user_id);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_status 
    ON agents(status, last_active);
  "
  
  # Step 4: Update table statistics
  docker-compose exec database psql -U postgres -d chatdb -c "ANALYZE;"
  
  echo "Database optimization complete"
}
```

## Backup and Recovery

### Automated Backup

```bash
#!/bin/bash
# Automated backup script (run via cron)

backup_dir="/opt/backups/ai-chat"
timestamp=$(date +%Y%m%d_%H%M%S)
retention_days=30

echo "=== Starting Automated Backup $(date) ==="

# Create backup directory if it doesn't exist
mkdir -p "$backup_dir"

# Database backup
echo "Backing up database..."
docker-compose exec -T database pg_dump -U postgres chatdb > "$backup_dir/database_$timestamp.sql"

# Redis backup
echo "Backing up Redis..."
docker-compose exec -T redis redis-cli --rdb /data/backup.rdb
docker cp $(docker-compose ps -q redis):/data/backup.rdb "$backup_dir/redis_$timestamp.rdb"

# Application data backup
echo "Backing up application data..."
tar -czf "$backup_dir/app_data_$timestamp.tar.gz" -C / \
  opt/ai-chat/logs \
  opt/ai-chat/uploads \
  opt/ai-chat/config

# Verification
echo "Verifying backups..."
ls -la "$backup_dir"/*$timestamp*

# Cleanup old backups
echo "Cleaning up old backups (older than $retention_days days)..."
find "$backup_dir" -name "*.sql" -mtime +$retention_days -delete
find "$backup_dir" -name "*.rdb" -mtime +$retention_days -delete
find "$backup_dir" -name "*.tar.gz" -mtime +$retention_days -delete

echo "=== Backup completed successfully ==="
```

### Recovery from Backup

```bash
#!/bin/bash
# Recovery procedure from backup

function restore_from_backup() {
  local backup_date=$1
  
  if [ -z "$backup_date" ]; then
    echo "Usage: restore_from_backup YYYYMMDD_HHMMSS"
    echo "Available backups:"
    ls -la /opt/backups/ai-chat/ | grep -E "database_|redis_|app_data_"
    return 1
  fi
  
  echo "=== Starting Recovery from $backup_date ==="
  
  # Stop services
  echo "Stopping services..."
  docker-compose down
  
  # Restore database
  echo "Restoring database..."
  docker-compose up -d database
  sleep 10
  cat "/opt/backups/ai-chat/database_$backup_date.sql" | \
    docker-compose exec -T database psql -U postgres -d chatdb
  
  # Restore Redis
  echo "Restoring Redis..."
  docker cp "/opt/backups/ai-chat/redis_$backup_date.rdb" \
    $(docker-compose ps -q redis):/data/dump.rdb
  docker-compose restart redis
  
  # Restore application data
  echo "Restoring application data..."
  tar -xzf "/opt/backups/ai-chat/app_data_$backup_date.tar.gz" -C /
  
  # Start all services
  echo "Starting all services..."
  docker-compose up -d
  
  # Wait and verify
  sleep 60
  curl -f http://localhost:3001/health && echo "✅ Recovery successful" || echo "❌ Recovery failed"
  
  echo "=== Recovery completed ==="
}
```

## Security Procedures

### Security Incident Response

```bash
# Security breach response
function security_incident_response() {
  echo "=== SECURITY INCIDENT RESPONSE ACTIVATED ==="
  
  # Step 1: Immediate containment
  echo "1. Immediate containment:"
  
  # Stop external access
  docker-compose exec nginx nginx -s stop
  
  # Rotate API keys and secrets
  echo "Rotating API keys..."
  kubectl create secret generic api-secrets \
    --from-literal=openai-key="$(generate_new_key)" \
    --dry-run=client -o yaml | kubectl apply -f -
  
  # Step 2: Assessment
  echo "2. Security assessment:"
  
  # Check for suspicious activities
  docker-compose logs --since 24h | grep -iE "unauthorized|failed|error|attack" > security_audit.log
  
  # Network analysis
  netstat -tulpn | grep :3001
  ss -tulpn | grep :8080
  
  # Step 3: Evidence collection
  echo "3. Collecting evidence:"
  
  # Save current state
  docker-compose logs > incident_logs_$(date +%Y%m%d_%H%M%S).txt
  docker ps -a > container_status_$(date +%Y%m%d_%H%M%S).txt
  
  # Step 4: Recovery preparation
  echo "4. Preparing recovery:"
  
  # Create clean backup
  timestamp=$(date +%Y%m%d_%H%M%S)
  docker-compose exec database pg_dump -U postgres chatdb > "incident_backup_$timestamp.sql"
  
  echo "SECURITY INCIDENT RESPONSE COMPLETED"
  echo "Next steps: Review logs, patch vulnerabilities, restore from clean backup"
}
```

### Access Control Audit

```bash
# Regular access control audit
function access_control_audit() {
  echo "=== Access Control Audit $(date) ==="
  
  # Check user permissions
  echo "1. System user permissions:"
  getent passwd | grep -E "ai-chat|www-data|postgres"
  
  # File permissions audit
  echo "2. Critical file permissions:"
  find /opt/ai-chat -name "*.env" -exec ls -la {} \;
  find /opt/ai-chat -name "*.key" -exec ls -la {} \;
  find /opt/ai-chat -name "*.pem" -exec ls -la {} \;
  
  # Network security check
  echo "3. Network exposure:"
  nmap -sT localhost -p 3000-3010 | grep open
  
  # Docker security
  echo "4. Container security:"
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image ai-chat-backend:latest
  
  echo "Access control audit completed"
}
```

## Maintenance Windows

### Scheduled Maintenance

```bash
#!/bin/bash
# Scheduled maintenance procedure

function scheduled_maintenance() {
  local maintenance_type=$1  # patch, upgrade, cleanup
  
  echo "=== Scheduled Maintenance: $maintenance_type $(date) ==="
  
  # Pre-maintenance checks
  echo "1. Pre-maintenance verification:"
  service_status
  
  # Create maintenance backup
  echo "2. Creating maintenance backup..."
  backup_timestamp=$(date +%Y%m%d_%H%M%S)
  ./backup.sh
  
  # Enable maintenance mode
  echo "3. Enabling maintenance mode..."
  docker-compose exec nginx cp /etc/nginx/maintenance.conf /etc/nginx/nginx.conf
  docker-compose exec nginx nginx -s reload
  
  case $maintenance_type in
    "patch")
      echo "4. Applying security patches..."
      docker-compose pull
      docker-compose up -d --force-recreate
      ;;
    "upgrade")
      echo "4. Performing system upgrade..."
      git pull origin main
      docker-compose build --no-cache
      docker-compose up -d
      ;;
    "cleanup")
      echo "4. Performing system cleanup..."
      docker system prune -f
      docker volume prune -f
      find /var/log -name "*.log" -mtime +30 -delete
      ;;
  esac
  
  # Post-maintenance verification
  echo "5. Post-maintenance verification:"
  sleep 60
  
  # Disable maintenance mode
  echo "6. Disabling maintenance mode..."
  docker-compose exec nginx cp /etc/nginx/normal.conf /etc/nginx/nginx.conf
  docker-compose exec nginx nginx -s reload
  
  # Final health check
  service_status
  
  echo "=== Maintenance completed successfully ==="
}
```

## Monitoring and Alerting

### Custom Alert Rules

```bash
# Custom monitoring setup
function setup_custom_alerts() {
  echo "=== Setting up Custom Alert Rules ==="
  
  # Create alert rules file
  cat > /opt/monitoring/alert_rules.yml << 'EOF'
groups:
  - name: ai_chat_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests per second"
      
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"
      
      - alert: QueueBacklog
        expr: queue_pending_messages > 1000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Message queue backlog"
          description: "Queue has {{ $value }} pending messages"
EOF
  
  # Reload Prometheus configuration
  curl -X POST http://localhost:9090/-/reload
  
  echo "Custom alert rules configured"
}
```

### Health Dashboard

```bash
# Generate health dashboard
function generate_health_dashboard() {
  echo "=== System Health Dashboard $(date) ==="
  
  echo "📊 System Overview:"
  echo "==================="
  
  # Service status
  printf "%-20s %s\n" "Backend Status:" "$(curl -s http://localhost:3001/health >/dev/null && echo "✅ Healthy" || echo "❌ Down")"
  printf "%-20s %s\n" "Frontend Status:" "$(curl -s http://localhost:8080/health >/dev/null && echo "✅ Healthy" || echo "❌ Down")"
  printf "%-20s %s\n" "Database Status:" "$(docker-compose exec database pg_isready -U postgres >/dev/null 2>&1 && echo "✅ Connected" || echo "❌ Down")"
  printf "%-20s %s\n" "Queue Status:" "$(docker-compose exec redis redis-cli ping >/dev/null 2>&1 && echo "✅ Connected" || echo "❌ Down")"
  
  # Resource utilization
  echo -e "\n📈 Resource Usage:"
  echo "=================="
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | \
    head -5
  
  # Recent activity
  echo -e "\n📝 Recent Activity:"
  echo "==================="
  echo "Messages processed (last hour):"
  docker-compose exec redis redis-cli llen processed_messages 2>/dev/null || echo "N/A"
  
  echo "Recent errors (last 10):"
  docker-compose logs --tail 10 2>&1 | grep -i error | head -5 || echo "No recent errors"
  
  echo -e "\n⚡ Quick Actions:"
  echo "================="
  echo "• Restart services: docker-compose restart"
  echo "• View logs: docker-compose logs -f"
  echo "• Scale backend: docker-compose up -d --scale backend=3"
  echo "• Emergency stop: docker-compose down"
}
```

## Related Documentation

- **Observability**: [Operations → Observability](observability.md) - Monitoring and metrics setup
- **CI/CD**: [Operations → CI/CD](ci-cd.md) - Continuous integration and deployment
- **Troubleshooting**: [Getting Started → Troubleshooting](../getting-started/troubleshooting.md) - Common issue resolution
- **Architecture**: [Architecture → System Overview](../architecture/system-overview.md) - System architecture understanding
