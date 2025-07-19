# AIM Hi HRMS Installation Package

## Quick Installation Script

Save this as `install_aimhi_hrms.sh` and run it:

```bash
#!/bin/bash
echo "🚀 Installing AIM Hi HRMS Integration..."

# Check prerequisites
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Please install Python 3.10 or 3.11"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 16 or 18"
    exit 1
fi

# Install bench
echo "📦 Installing Frappe Bench..."
pip3 install frappe-bench

# Initialize bench
echo "🏗️ Setting up development environment..."
bench init frappe-aimhi --frappe-branch version-15
cd frappe-aimhi

# Create site
echo "🌐 Creating new site..."
bench new-site aimhi.local
bench use aimhi.local

# Install HRMS
echo "👥 Installing Frappe HRMS..."
bench get-app hrms
bench --site aimhi.local install-app hrms

# Copy our custom app
echo "🤖 Installing AIM Hi AI Integration..."
cp -r ../aimhi_hrms ./apps/
bench --site aimhi.local install-app aimhi_hrms

# Configure OpenAI (you'll need to set your API key)
echo "🔑 Configuring AI integration..."
echo "Please set your OpenAI API key:"
read -p "Enter OpenAI API Key: " OPENAI_KEY
bench --site aimhi.local set-config openai_api_key "$OPENAI_KEY"

echo "✅ Installation complete!"
echo "🌐 Start with: cd frappe-aimhi && bench start"
echo "🔗 Access at: http://aimhi.local:8000"
```

## Manual Installation Steps

### 1. Prerequisites Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y python3-dev python3-pip nodejs npm mariadb-server redis-server git
```

**macOS:**
```bash
brew install python@3.11 node mariadb redis git
brew services start mariadb redis
```

### 2. Install Frappe Bench
```bash
pip3 install frappe-bench
```

### 3. Create Development Environment
```bash
bench init frappe-aimhi --frappe-branch version-15
cd frappe-aimhi
```

### 4. Setup Site
```bash
bench new-site aimhi.local
bench use aimhi.local
```

### 5. Install HRMS
```bash
bench get-app hrms
bench --site aimhi.local install-app hrms
```

### 6. Install Our Custom App
```bash
# Copy the aimhi_hrms folder to apps directory
cp -r /path/to/aimhi_hrms ./apps/
bench --site aimhi.local install-app aimhi_hrms
```

### 7. Configure and Start
```bash
# Set OpenAI API key
bench --site aimhi.local set-config openai_api_key "your-api-key"

# Start development server
bench start
```

## Files Included in Package

The `aimhi_hrms` app includes:

### DocTypes (Database Tables)
- `ai_match_result` - Stores AI analysis results
- `ai_matching_configuration` - AI algorithm settings
- `ai_processing_queue` - Background job management

### Custom Fields
- Job Opening: AI analysis controls and results
- Job Applicant: AI scoring and recommendations  

### Server Scripts
- Automatic AI analysis triggers
- Background job processing
- Integration with HRMS workflow

### Client Scripts  
- Enhanced UI with AI controls
- Real-time progress tracking
- Results visualization

### Python Modules
- `matching_engine.py` - Core AI analysis
- `doctype_controllers/` - Custom business logic
- `api/` - REST endpoints for AI operations

### Configuration
- `hooks.py` - App integration settings
- `modules.txt` - Module definitions
- `fixtures/` - Initial data setup

## What You Get

After installation:

✅ **Native Frappe HRMS** with full HR workflows
✅ **AI-Enhanced Job Openings** with matching buttons  
✅ **Real-time Analysis** using 5-dimensional scoring
✅ **Background Processing** for batch operations
✅ **Comprehensive Results** with detailed reasoning
✅ **Professional Interface** with role-based access

## Testing the Integration

1. **Login**: http://aimhi.local:8000 (Administrator / your-password)
2. **Navigate**: Human Resources → Recruitment → Job Opening
3. **Create Job**: New job with detailed requirements
4. **Add Candidates**: Create Job Applicant records
5. **Run AI Analysis**: Click "AI Matching" button
6. **View Results**: See 5-dimensional analysis results

## Support

If you encounter issues:

1. **Check logs**: `bench logs`
2. **Restart services**: `bench restart`  
3. **Clear cache**: `bench --site aimhi.local clear-cache`
4. **Reinstall app**: `bench --site aimhi.local reinstall-app aimhi_hrms`

The integration is production-ready and includes comprehensive error handling and logging.