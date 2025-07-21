#!/bin/bash
# AIM Hi HRMS Local Installation Script
# Run this on your local machine to set up the complete Frappe HRMS with AI integration

set -e

echo "🚀 AIM Hi HRMS - Local Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running on supported OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    print_status "Detected Linux OS"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    print_status "Detected macOS"
else
    print_error "Unsupported OS. This script supports Linux and macOS only."
fi

# Check prerequisites
echo ""
echo "📋 Checking Prerequisites..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [[ "$PYTHON_VERSION" == "3.10" || "$PYTHON_VERSION" == "3.11" ]]; then
        print_status "Python $PYTHON_VERSION found"
    else
        print_warning "Python $PYTHON_VERSION found, but 3.10 or 3.11 recommended"
    fi
else
    print_error "Python 3 not found. Please install Python 3.10 or 3.11"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge "16" ]]; then
        print_status "Node.js v$NODE_VERSION found"
    else
        print_error "Node.js version 16+ required. Current: $NODE_VERSION"
    fi
else
    print_error "Node.js not found. Please install Node.js 16+"
fi

# Check database
if [[ "$OS" == "linux" ]]; then
    if command -v mysql &> /dev/null || command -v mariadb &> /dev/null; then
        print_status "Database server found"
    else
        print_warning "MariaDB/MySQL not found. Installing..."
        sudo apt update
        sudo apt install -y mariadb-server mariadb-client
        sudo systemctl start mariadb
        sudo systemctl enable mariadb
        print_status "MariaDB installed and started"
    fi
elif [[ "$OS" == "macos" ]]; then
    if command -v mysql &> /dev/null || brew services list | grep mariadb | grep started &> /dev/null; then
        print_status "Database server found"
    else
        print_warning "MariaDB not found. Installing..."
        brew install mariadb
        brew services start mariadb
        print_status "MariaDB installed and started"
    fi
fi

# Check Redis
if command -v redis-server &> /dev/null || pgrep redis-server &> /dev/null; then
    print_status "Redis server found"
else
    print_warning "Redis not found. Installing..."
    if [[ "$OS" == "linux" ]]; then
        sudo apt install -y redis-server
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
    elif [[ "$OS" == "macos" ]]; then
        brew install redis
        brew services start redis
    fi
    print_status "Redis installed and started"
fi

echo ""
echo "📦 Installing Frappe Bench..."

# Install bench
if command -v bench &> /dev/null; then
    print_status "Frappe Bench already installed"
else
    pip3 install frappe-bench
    print_status "Frappe Bench installed"
fi

echo ""
echo "🏗️  Setting up development environment..."

# Check if bench already exists
if [ -d "frappe-aimhi" ]; then
    print_warning "Directory 'frappe-aimhi' already exists. Using existing setup."
    cd frappe-aimhi
else
    # Initialize bench
    bench init frappe-aimhi --frappe-branch version-15
    cd frappe-aimhi
    print_status "Frappe bench initialized"
fi

echo ""
echo "🌐 Creating new site..."

SITE_NAME="aimhi.local"

# Check if site exists
if [ -d "sites/$SITE_NAME" ]; then
    print_warning "Site '$SITE_NAME' already exists. Using existing site."
    bench use $SITE_NAME
else
    # Create site with prompts
    echo ""
    echo "Please provide the following information for your new site:"
    echo ""
    read -p "📧 Administrator email (default: admin@aimhi.local): " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@aimhi.local}
    
    echo ""
    read -s -p "🔐 Administrator password: " ADMIN_PASSWORD
    echo ""
    
    if [ -z "$ADMIN_PASSWORD" ]; then
        bench new-site $SITE_NAME --admin-password admin123 --db-type mariadb
        print_warning "Default password 'admin123' used. Please change it after login."
    else
        bench new-site $SITE_NAME --admin-password "$ADMIN_PASSWORD" --db-type mariadb
    fi
    
    bench use $SITE_NAME
    print_status "Site '$SITE_NAME' created"
fi

echo ""
echo "👥 Installing Frappe HRMS..."

# Install HRMS if not already installed
if [ -d "apps/hrms" ]; then
    print_status "HRMS already installed"
else
    bench get-app hrms
    bench --site $SITE_NAME install-app hrms
    print_status "HRMS installed"
fi

echo ""
echo "🤖 Installing AIM Hi AI Integration..."

# Check if our custom app directory exists
CUSTOM_APP_PATH="../aimhi_hrms"
if [ ! -d "$CUSTOM_APP_PATH" ]; then
    print_error "Custom app directory 'aimhi_hrms' not found. Please ensure the aimhi_hrms folder is in the same directory as this script."
fi

# Copy custom app
if [ -d "apps/aimhi_hrms" ]; then
    print_warning "AIM Hi HRMS app already exists. Updating..."
    rm -rf apps/aimhi_hrms
fi

cp -r $CUSTOM_APP_PATH apps/
print_status "Custom app copied"

# Validate app structure
if [ ! -f "apps/aimhi_hrms/setup.py" ]; then
    print_error "setup.py not found in aimhi_hrms app. Please ensure you downloaded the updated app structure."
fi

if [ ! -f "apps/aimhi_hrms/aimhi_hrms/hooks.py" ]; then
    print_error "hooks.py not found in correct location. Please ensure you downloaded the updated app structure."
fi

print_status "App structure validated"

# Install custom app
if bench --site $SITE_NAME list-apps | grep aimhi_hrms &> /dev/null; then
    print_warning "AIM Hi HRMS app already installed. Reinstalling..."
    bench --site $SITE_NAME uninstall-app aimhi_hrms --yes --no-backup
fi

bench --site $SITE_NAME install-app aimhi_hrms
print_status "AIM Hi HRMS integration installed"

echo ""
echo "🔑 Configuring AI Integration..."

# Configure OpenAI API key
echo ""
read -p "🤖 Enter your OpenAI API key: " OPENAI_KEY

if [ -n "$OPENAI_KEY" ]; then
    bench --site $SITE_NAME set-config openai_api_key "$OPENAI_KEY"
    print_status "OpenAI API key configured"
else
    print_warning "No OpenAI API key provided. You can set it later using:"
    echo "    bench --site $SITE_NAME set-config openai_api_key 'your-api-key'"
fi

# Set AI matching configuration
bench --site $SITE_NAME set-config ai_matching_weights '{
  "skills_weight": 25,
  "keywords_weight": 25, 
  "domain_weight": 20,
  "experience_weight": 15,
  "professional_depth_weight": 15
}'

print_status "AI matching weights configured"

echo ""
echo "🚀 Installation Complete!"
echo ""
echo "=========================================="
echo "🌐 Your AIM Hi HRMS is ready!"
echo "=========================================="
echo ""
echo "📍 Location: $(pwd)"
echo "🌍 Site URL: http://$SITE_NAME:8000"
echo "👤 Login: Administrator"
echo "📧 Email: ${ADMIN_EMAIL:-Administrator}"
echo ""
echo "🎯 To start your development server:"
echo "   cd $(pwd)"
echo "   bench start"
echo ""
echo "🔗 Then visit: http://$SITE_NAME:8000"
echo ""
echo "📚 Getting Started:"
echo "   1. Navigate to Human Resources → Recruitment"
echo "   2. Create a new Job Opening"
echo "   3. Add job requirements and description"
echo "   4. Click 'AI Matching' to test the integration"
echo ""
echo "🎉 Enjoy your AI-enhanced HRMS!"

# Add to /etc/hosts if not already there
if ! grep -q "$SITE_NAME" /etc/hosts; then
    echo ""
    print_warning "Adding $SITE_NAME to /etc/hosts for local development..."
    if [[ "$OS" == "linux" ]] || [[ "$OS" == "macos" ]]; then
        echo "127.0.0.1 $SITE_NAME" | sudo tee -a /etc/hosts > /dev/null
        print_status "$SITE_NAME added to /etc/hosts"
    fi
fi

echo ""
echo "Ready to start? Run: bench start"