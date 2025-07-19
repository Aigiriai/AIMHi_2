#!/bin/bash
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
