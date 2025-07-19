#!/usr/bin/env python3
"""
Task 5: Deploy Full Frappe HRMS Integration for Testing
Complete deployment and testing setup
"""

import os
import subprocess
import json
from pathlib import Path

def deploy_frappe_integration():
    """Deploy the complete Frappe HRMS integration"""
    
    print("=== TASK 5: Deploy Full Frappe HRMS Integration ===\n")
    
    print("🚀 DEPLOYMENT STRATEGY")
    print("Given Replit environment constraints, we'll use Docker Compose for Frappe deployment")
    print("This ensures consistent environment and proper dependency management\n")
    
    # Create Docker Compose configuration
    print("📋 Creating Docker Compose configuration...")
    create_docker_compose()
    
    # Create deployment scripts
    print("🔧 Creating deployment scripts...")
    create_deployment_scripts()
    
    # Create testing procedures
    print("🧪 Creating testing procedures...")
    create_testing_procedures()
    
    # Create integration validation
    print("✅ Creating integration validation...")
    create_validation_procedures()
    
    print("\n🎯 DEPLOYMENT READY")
    print("Next steps:")
    print("1. Run: docker-compose up -d")
    print("2. Install custom app: ./install_aimhi_app.sh")
    print("3. Configure API keys and settings")
    print("4. Run validation tests")
    
    return True

def create_docker_compose():
    """Create Docker Compose configuration for Frappe HRMS"""
    
    docker_compose_content = """version: '3.8'

services:
  db:
    image: mariadb:10.11
    environment:
      MYSQL_ROOT_PASSWORD: frappe_root
      MYSQL_DATABASE: frappe_hrms
      MYSQL_USER: frappe
      MYSQL_PASSWORD: frappe_pass
    volumes:
      - mariadb_data:/var/lib/mysql
      - ./sql:/docker-entrypoint-initdb.d
    ports:
      - "3307:3306"
    networks:
      - frappe_network
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6380:6379"
    networks:
      - frappe_network

  frappe:
    image: frappe/frappe:version-15-beta
    depends_on:
      - db
      - redis
    environment:
      - DB_HOST=db
      - DB_PORT=3306
      - DB_ROOT_USER=root
      - DB_ROOT_PASSWORD=frappe_root
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - FRAPPE_SITE_NAME=aimhi-hrms.local
      - INSTALL_APPS=hrms,aimhi_hrms
    volumes:
      - frappe_data:/home/frappe/frappe-bench
      - ./aimhi_hrms:/home/frappe/frappe-bench/apps/aimhi_hrms:ro
      - ./scripts:/home/frappe/scripts
    ports:
      - "8001:8000"  # Different port to avoid conflict with AIM Hi
      - "9001:9000"
    networks:
      - frappe_network
    command: >
      bash -c "
        cd /home/frappe/frappe-bench &&
        if [ ! -d sites/aimhi-hrms.local ]; then
          bench new-site aimhi-hrms.local 
            --admin-password admin123 
            --db-name frappe_hrms 
            --db-host db 
            --db-port 3306 
            --db-root-username root 
            --db-root-password frappe_root &&
          bench --site aimhi-hrms.local install-app hrms &&
          bench --site aimhi-hrms.local install-app aimhi_hrms
        fi &&
        bench --site aimhi-hrms.local add-to-hosts &&
        bench start
      "

volumes:
  mariadb_data:
  redis_data:
  frappe_data:

networks:
  frappe_network:
    driver: bridge"""
    
    with open('frappe-setup/docker-compose.yml', 'w') as f:
        f.write(docker_compose_content)
    
    # Create SQL initialization
    os.makedirs('frappe-setup/sql', exist_ok=True)
    
    sql_init = """-- Initialize Frappe HRMS database
CREATE DATABASE IF NOT EXISTS frappe_hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON frappe_hrms.* TO 'frappe'@'%';
FLUSH PRIVILEGES;"""
    
    with open('frappe-setup/sql/init.sql', 'w') as f:
        f.write(sql_init)
    
    print("✅ Docker Compose configuration created")
    return True

def create_deployment_scripts():
    """Create deployment and installation scripts"""
    
    # Main deployment script
    deploy_script = """#!/bin/bash
# AIM Hi HRMS Deployment Script

echo "🚀 Starting AIM Hi HRMS Integration Deployment"

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }

echo "📋 Dependencies verified"

# Start services
echo "🔧 Starting Frappe HRMS services..."
docker-compose up -d db redis

echo "⏳ Waiting for database to be ready..."
sleep 30

echo "🏗️ Starting Frappe application..."
docker-compose up -d frappe

echo "⏳ Waiting for Frappe to initialize (this may take 5-10 minutes)..."
sleep 60

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

echo "✅ Deployment completed!"
echo ""
echo "🌐 Access URLs:"
echo "- Frappe HRMS: http://localhost:8001"
echo "- Site: aimhi-hrms.local"
echo "- Admin Login: Administrator / admin123"
echo ""
echo "📋 Next Steps:"
echo "1. Run ./configure_aimhi.sh to set up AI matching"
echo "2. Navigate to AI Matching Configuration"
echo "3. Enter your OpenAI API key"
echo "4. Test the integration with ./test_integration.sh"
"""
    
    with open('frappe-setup/deploy.sh', 'w') as f:
        f.write(deploy_script)
    os.chmod('frappe-setup/deploy.sh', 0o755)
    
    # Configuration script
    config_script = """#!/bin/bash
# AIM Hi HRMS Configuration Script

echo "⚙️ Configuring AIM Hi HRMS Integration"

# Wait for Frappe to be fully ready
echo "⏳ Ensuring Frappe is ready..."
sleep 10

# Install Python dependencies in container
echo "📦 Installing Python dependencies..."
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench pip install openai &&
  bench pip install asyncio
"

# Create AI Matching Configuration
echo "🔧 Creating AI Matching Configuration..."
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local console <<'EOF'
import frappe

# Create AI Matching Configuration if it doesn't exist
if not frappe.db.exists('AI Matching Configuration', 'AI Matching Configuration'):
    doc = frappe.get_doc({
        'doctype': 'AI Matching Configuration',
        'name': 'AI Matching Configuration',
        'skills_weight': 25,
        'experience_weight': 15,
        'keywords_weight': 25,
        'professional_depth_weight': 15,
        'domain_experience_weight': 20,
        'minimum_match_threshold': 30.0,
        'auto_shortlist_threshold': 80.0,
        'enable_pre_filtering': 1,
        'batch_processing_size': 3,
        'is_active': 1
    })
    doc.insert()
    frappe.db.commit()
    print('AI Matching Configuration created successfully')
else:
    print('AI Matching Configuration already exists')
EOF
"

echo "✅ Configuration completed!"
echo ""
echo "🔑 IMPORTANT: Set your OpenAI API key"
echo "1. Navigate to: http://localhost:8001"
echo "2. Login as Administrator with password: admin123"
echo "3. Go to: AI Matching Configuration"
echo "4. Enter your OpenAI API key"
echo "5. Save the configuration"
echo ""
echo "🧪 Run ./test_integration.sh to validate the setup"
"""
    
    with open('frappe-setup/configure_aimhi.sh', 'w') as f:
        f.write(config_script)
    os.chmod('frappe-setup/configure_aimhi.sh', 0o755)
    
    print("✅ Deployment scripts created")
    return True

def create_testing_procedures():
    """Create comprehensive testing procedures"""
    
    test_script = """#!/bin/bash
# AIM Hi HRMS Integration Testing Script

echo "🧪 Starting AIM Hi HRMS Integration Tests"

# Test 1: Service Health Check
echo "1️⃣ Testing service health..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Docker services are running"
else
    echo "❌ Docker services are not running properly"
    exit 1
fi

# Test 2: Database Connectivity
echo "2️⃣ Testing database connectivity..."
docker-compose exec -T db mysql -u frappe -pfrappe_pass -e "SELECT 1;" frappe_hrms
if [ $? -eq 0 ]; then
    echo "✅ Database connectivity OK"
else
    echo "❌ Database connectivity failed"
    exit 1
fi

# Test 3: Frappe Application Health
echo "3️⃣ Testing Frappe application..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001)
if [ $response -eq 200 ]; then
    echo "✅ Frappe application is responding"
else
    echo "❌ Frappe application not responding (HTTP $response)"
fi

# Test 4: Custom DocTypes
echo "4️⃣ Testing custom DocTypes..."
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local console <<'EOF'
import frappe

# Test AI Match Result DocType
try:
    frappe.get_meta('AI Match Result')
    print('✅ AI Match Result DocType exists')
except:
    print('❌ AI Match Result DocType not found')

# Test AI Matching Configuration DocType  
try:
    frappe.get_meta('AI Matching Configuration')
    print('✅ AI Matching Configuration DocType exists')
except:
    print('❌ AI Matching Configuration DocType not found')

# Test HRMS DocTypes
try:
    frappe.get_meta('Job Opening')
    print('✅ Job Opening DocType exists (HRMS)')
except:
    print('❌ Job Opening DocType not found')

try:
    frappe.get_meta('Job Applicant')
    print('✅ Job Applicant DocType exists (HRMS)')
except:
    print('❌ Job Applicant DocType not found')
EOF
"

# Test 5: AI Configuration Check
echo "5️⃣ Testing AI configuration..."
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local console <<'EOF'
import frappe

try:
    config = frappe.get_single('AI Matching Configuration')
    if config.openai_api_key:
        print('✅ OpenAI API key is configured')
    else:
        print('⚠️ OpenAI API key not set - configure in AI Matching Configuration')
    
    total_weight = (config.skills_weight + config.experience_weight + 
                   config.keywords_weight + config.professional_depth_weight + 
                   config.domain_experience_weight)
    
    if total_weight == 100:
        print('✅ Matching weights are properly configured (total: 100%)')
    else:
        print(f'❌ Matching weights incorrect (total: {total_weight}%)')
        
except Exception as e:
    print(f'❌ Error checking AI configuration: {e}')
EOF
"

echo ""
echo "🎯 INTEGRATION TEST SUMMARY"
echo "================================"
echo "If all tests show ✅, your integration is ready!"
echo ""
echo "📋 Manual Testing Steps:"
echo "1. Navigate to: http://localhost:8001"
echo "2. Login as Administrator / admin123"
echo "3. Create a Job Opening with detailed description"
echo "4. Create a Job Applicant with resume"
echo "5. Click 'Run AI Matching' button on Job Opening"
echo "6. Check 'AI Match Result' for results"
echo ""
echo "🔧 If issues occur:"
echo "- Check logs: docker-compose logs frappe"
echo "- Restart services: docker-compose restart"
echo "- Full rebuild: docker-compose down && docker-compose up -d"
"""
    
    with open('frappe-setup/test_integration.sh', 'w') as f:
        f.write(test_script)
    os.chmod('frappe-setup/test_integration.sh', 0o755)
    
    print("✅ Testing procedures created")
    return True

def create_validation_procedures():
    """Create validation and troubleshooting procedures"""
    
    validation_guide = """# AIM Hi HRMS Integration Validation Guide

## Quick Validation Checklist

### ✅ Infrastructure Validation
- [ ] Docker services running: `docker-compose ps`
- [ ] Database accessible: `docker-compose exec db mysql -u frappe -pfrappe_pass frappe_hrms`
- [ ] Frappe responding: `curl http://localhost:8001`
- [ ] Redis operational: `docker-compose exec redis redis-cli ping`

### ✅ Application Validation  
- [ ] Login successful: Administrator / admin123
- [ ] HRMS module visible in desk
- [ ] Job Opening form accessible
- [ ] Job Applicant form accessible
- [ ] AI Matching Configuration accessible

### ✅ Integration Validation
- [ ] Custom DocTypes exist: AI Match Result, AI Matching Configuration
- [ ] Job Opening has AI Matching section with custom fields
- [ ] Job Opening has "Run AI Matching" button
- [ ] OpenAI API key configured in AI Matching Configuration
- [ ] Matching weights sum to 100%

### ✅ Functional Validation
- [ ] Create Job Opening with detailed description
- [ ] Create Job Applicant with resume attachment
- [ ] Click "Run AI Matching" button
- [ ] Check AI Match Result creation
- [ ] Verify match percentage and reasoning
- [ ] Validate criteria scores (skills, experience, keywords, depth, domain)

## Troubleshooting Guide

### Issue: Services Won't Start
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d

# Rebuild if needed  
docker-compose down --volumes
docker-compose up --build -d
```

### Issue: Database Connection Failed
```bash
# Check database logs
docker-compose logs db

# Reset database
docker-compose down
docker volume rm frappe-setup_mariadb_data
docker-compose up -d db
```

### Issue: Custom App Not Installed
```bash
# Reinstall custom app
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local uninstall-app aimhi_hrms --yes &&
  bench --site aimhi-hrms.local install-app aimhi_hrms
"
```

### Issue: AI Matching Not Working
1. Check OpenAI API key in AI Matching Configuration
2. Verify Python dependencies: `docker-compose exec frappe pip list | grep openai`
3. Check background jobs: Frappe > Background Jobs
4. Review error logs in Frappe > Error Log

### Issue: DocTypes Missing
```bash
# Migrate DocTypes
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local migrate
"
```

## Performance Monitoring

### Monitor Resource Usage
```bash
# Container resources
docker stats

# Database performance
docker-compose exec db mysql -u frappe -pfrappe_pass -e "SHOW PROCESSLIST;" frappe_hrms
```

### Monitor AI Processing
- Check AI Processing Queue DocType for batch job status
- Monitor API calls and costs in processing records
- Review background job queue for failures

## Success Criteria

The integration is successfully deployed when:

1. **Infrastructure**: All Docker services healthy and accessible
2. **Authentication**: Login works with provided credentials  
3. **Navigation**: HRMS modules accessible, custom DocTypes visible
4. **Configuration**: AI settings configured with valid API key
5. **Functionality**: AI matching produces results with proper scoring
6. **Performance**: Response times acceptable, no memory/CPU issues
7. **Data Integrity**: Match results stored correctly, candidate updates work

## Next Steps After Validation

1. **Production Configuration**: Update passwords, API keys, resource limits
2. **User Training**: Create user guides for HR team
3. **Data Migration**: Import existing job openings and candidates
4. **Monitoring Setup**: Configure alerts and performance monitoring
5. **Backup Strategy**: Set up regular database and file backups
"""
    
    with open('frappe-setup/VALIDATION_GUIDE.md', 'w') as f:
        f.write(validation_guide)
    
    print("✅ Validation procedures created")
    return True

if __name__ == "__main__":
    deploy_frappe_integration()