# AIM Hi HRMS - Local Development Setup Guide

## Prerequisites

### System Requirements
- **Operating System**: Linux, macOS, or Windows (with WSL)
- **Python**: 3.10 or 3.11 (recommended)
- **Node.js**: 16 or 18
- **Database**: MariaDB or MySQL
- **Memory**: Minimum 4GB RAM (8GB recommended)

### Required Software
```bash
# For Ubuntu/Debian
sudo apt update
sudo apt install -y python3-dev python3-pip python3-venv
sudo apt install -y nodejs npm
sudo apt install -y mariadb-server mariadb-client
sudo apt install -y redis-server
sudo apt install -y git curl

# For macOS (using Homebrew)
brew install python@3.11 node mariadb redis git
brew services start mariadb
brew services start redis

# For Windows
# Install WSL2 with Ubuntu, then follow Ubuntu instructions
```

## Step 1: Install Frappe Bench

```bash
# Install bench CLI
pip3 install frappe-bench

# Verify installation
bench --version
```

## Step 2: Initialize Bench Directory

```bash
# Create new bench (development environment)
bench init frappe-aimhi --frappe-branch version-15

# Navigate to bench directory
cd frappe-aimhi

# Start services
bench start
```

**What this does:**
- Downloads Frappe framework
- Sets up virtual environment
- Configures Redis and database
- Creates development server

## Step 3: Create New Site

```bash
# Create a new site
bench new-site aimhi.local

# Set as default site (optional)
bench use aimhi.local
```

**You'll be prompted for:**
- MariaDB root password
- Site administrator password

## Step 4: Install Frappe HRMS

```bash
# Download HRMS app
bench get-app hrms

# Install HRMS on your site
bench --site aimhi.local install-app hrms
```

## Step 5: Deploy Our Custom AIM Hi Integration

### Option A: Copy App Directly

```bash
# Copy our custom app to apps directory
cp -r /path/to/your/replit/frappe-setup/aimhi_hrms ./apps/

# Install our custom app
bench --site aimhi.local install-app aimhi_hrms
```

### Option B: Link Development App

```bash
# Create symlink for development
ln -s /path/to/your/replit/frappe-setup/aimhi_hrms ./apps/aimhi_hrms

# Install the linked app
bench --site aimhi.local install-app aimhi_hrms
```

## Step 6: Configure OpenAI Integration

```bash
# Set OpenAI API key
bench --site aimhi.local set-config openai_api_key "your-openai-api-key"

# Configure AI matching weights (optional)
bench --site aimhi.local set-config ai_matching_weights '{
  "skills_weight": 25,
  "keywords_weight": 25,
  "domain_weight": 20,
  "experience_weight": 15,
  "professional_depth_weight": 15
}'
```

## Step 7: Start Development Server

```bash
# Start all services
bench start

# Or start specific services
bench serve --port 8000    # Web server
bench worker                # Background jobs
bench schedule              # Scheduled jobs
```

## Step 8: Access Your System

**Open your browser and visit:**
- **Main Site**: http://aimhi.local:8000
- **Desk**: http://aimhi.local:8000/app

**Default Login:**
- **Username**: Administrator
- **Password**: [password you set during site creation]

## Step 9: Test AI Integration

### Navigate to HRMS Module
1. Go to http://aimhi.local:8000/app
2. Click "Human Resources" module
3. Go to "Recruitment" → "Job Opening"

### Create Test Job
1. Click "New Job Opening"
2. Fill required fields:
   - Job Title: "Senior Python Developer"
   - Department: "Engineering"
   - Designation: "Senior Developer"
3. Add job description with requirements
4. Save

### Test AI Matching
1. Open the job opening
2. Look for "AI Matching" button (added by our integration)
3. Click "Run AI Analysis" 
4. View results in "AI Match Results" section

## Development Commands

### Useful Bench Commands
```bash
# Restart services
bench restart

# Update apps
bench update

# Install new app
bench get-app [app-name]
bench --site [site] install-app [app-name]

# Database operations
bench migrate
bench --site [site] migrate

# Clear cache
bench --site [site] clear-cache

# View logs
bench logs

# Access database
bench --site [site] mariadb
```

### Custom App Development
```bash
# Create new DocType
bench --site [site] create-new-doctype "AI Match Result"

# Generate fixtures
bench --site [site] export-fixtures

# Reload app after changes
bench --site [site] reload-app aimhi_hrms
```

## Project Structure

After setup, your directory will look like:
```
frappe-aimhi/
├── apps/
│   ├── frappe/          # Core Frappe framework
│   ├── hrms/            # Frappe HRMS app
│   └── aimhi_hrms/      # Our custom integration
├── sites/
│   └── aimhi.local/     # Your site
├── config/
├── logs/
└── env/                 # Python virtual environment
```

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
bench set-config http_port 8001
bench restart
```

**Database connection issues:**
```bash
# Check MariaDB status
sudo systemctl status mariadb

# Reset database
bench --site [site] reinstall
```

**Permission issues:**
```bash
# Fix permissions
chmod -R 755 frappe-aimhi/
```

**App installation errors:**
```bash
# Force reinstall
bench --site [site] uninstall-app aimhi_hrms
bench --site [site] install-app aimhi_hrms --force
```

### Getting Help
- **Frappe Documentation**: https://frappeframework.com/docs
- **HRMS Documentation**: https://hrms.erpnext.com
- **Community Forum**: https://discuss.erpnext.com

## What You'll See

After successful setup, you'll have:

✅ **Full Frappe HRMS Interface**
- Native HR workflows and forms
- Professional UI with role-based access
- Multi-company support

✅ **AIM Hi AI Integration**
- Enhanced Job Opening forms
- AI matching buttons and controls
- Real-time candidate analysis
- 5-dimensional scoring results

✅ **Background Processing**
- Automated AI analysis jobs
- Batch candidate processing
- Results stored in native DocTypes

✅ **Complete HR Workflow**
- Job Opening → Job Applicant → Interview → Job Offer
- Integrated AI recommendations at each step
- Comprehensive reporting and analytics

## Next Steps

1. **Follow this setup process**
2. **Test the AI matching functionality**
3. **Customize the integration as needed**
4. **Deploy to production when ready**

This gives you the full Frappe HRMS experience with all our AI enhancements integrated natively into the workflow.