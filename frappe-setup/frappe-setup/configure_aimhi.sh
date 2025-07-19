#!/bin/bash
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
