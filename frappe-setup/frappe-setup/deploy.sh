#!/bin/bash
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
