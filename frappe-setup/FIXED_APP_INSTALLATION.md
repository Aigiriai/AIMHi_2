# 🔧 Fixed AIM Hi HRMS App - Installation Guide

## The Issue You Encountered

The error "Your aimhi_hrms app is either not a valid Frappe app" occurs when the app structure doesn't meet Frappe's requirements. I've fixed this by:

✅ **Added missing setup.py** - Required for all Frappe apps
✅ **Created proper DocType structure** - AI Match Result and AI Matching Configuration
✅ **Fixed module organization** - Proper Python package structure
✅ **Added requirements.txt** - Dependency specification
✅ **Corrected hooks.py location** - Must be in aimhi_hrms/aimhi_hrms/

## Download Updated Files

**You need to re-download these files with the fixes:**

### Required Files (Updated):
1. **`frappe-setup/aimhi_hrms/`** (entire folder - now with proper Frappe structure)
2. **`frappe-setup/install_aimhi_hrms.sh`** (installation script)

### New File Structure:
```
aimhi_hrms/
├── setup.py                    ← NEW: Required by Frappe
├── requirements.txt            ← NEW: Dependencies
├── __init__.py                 ← Version info
└── aimhi_hrms/                 ← Main app folder
    ├── __init__.py
    ├── hooks.py                ← App configuration
    ├── modules.txt             ← Module list
    ├── ai_match_result/        ← NEW: Complete DocType
    │   ├── __init__.py
    │   ├── ai_match_result.json
    │   └── ai_match_result.py
    ├── ai_matching_configuration/ ← NEW: Complete DocType
    │   ├── __init__.py
    │   ├── ai_matching_configuration.json
    │   └── ai_matching_configuration.py
    ├── ai_matching/            ← AI engine modules
    ├── ai_core/               ← Core AI functionality
    ├── customizations/        ← UI enhancements
    ├── public/               ← CSS/JS files
    └── templates/            ← HTML templates
```

## Installation Steps (Corrected)

### 1. Download Updated Files
- Re-download the entire `frappe-setup/aimhi_hrms/` folder
- Download `frappe-setup/install_aimhi_hrms.sh`

### 2. Verify File Structure
Check that you have:
- [ ] `aimhi_hrms/setup.py` (new file)
- [ ] `aimhi_hrms/requirements.txt` (new file)
- [ ] `aimhi_hrms/aimhi_hrms/hooks.py` (moved from root)
- [ ] `aimhi_hrms/aimhi_hrms/ai_match_result/` (complete DocType)
- [ ] `aimhi_hrms/aimhi_hrms/ai_matching_configuration/` (complete DocType)

### 3. Run Installation
```bash
# Navigate to your download folder
cd /path/to/your/downloads

# Make script executable
chmod +x install_aimhi_hrms.sh

# Run installation
./install_aimhi_hrms.sh
```

### 4. Manual Installation (Alternative)
If the automated script still has issues:

```bash
# Install Frappe Bench
pip3 install frappe-bench

# Create development environment
bench init frappe-aimhi --frappe-branch version-15
cd frappe-aimhi

# Create site
bench new-site aimhi.local
bench use aimhi.local

# Install HRMS
bench get-app hrms
bench --site aimhi.local install-app hrms

# Copy our fixed app
cp -r /path/to/aimhi_hrms ./apps/

# Validate app structure
ls -la apps/aimhi_hrms/setup.py  # Should exist
ls -la apps/aimhi_hrms/aimhi_hrms/hooks.py  # Should exist

# Install our app
bench --site aimhi.local install-app aimhi_hrms

# Configure OpenAI
bench --site aimhi.local set-config openai_api_key "your-api-key"

# Start server
bench start
```

## Validation Commands

To check if the app is properly structured:

```bash
# Check app structure
bench validate-app aimhi_hrms

# List installed apps
bench --site aimhi.local list-apps

# Check app status
bench --site aimhi.local doctor
```

## What's Fixed

### 1. Added setup.py (Critical)
```python
from setuptools import setup, find_packages
setup(
    name="aimhi_hrms",
    version="1.0.0",
    description="AI-Enhanced HRMS with Advanced Candidate Matching",
    packages=find_packages(),
    install_requires=["frappe", "hrms"]
)
```

### 2. Created Complete DocTypes
- **AI Match Result**: Stores all analysis results with proper validation
- **AI Matching Configuration**: Manages AI weights and settings

### 3. Fixed Module Structure
- Proper Python package organization
- All `__init__.py` files in place
- Correct import paths

### 4. Added Dependencies
- `requirements.txt` with frappe and hrms dependencies
- Proper version specifications

## Expected Result

After successful installation:
1. ✅ Access http://aimhi.local:8000
2. ✅ Login as Administrator
3. ✅ Navigate to Human Resources → Recruitment
4. ✅ Create Job Opening with AI matching capabilities
5. ✅ See AI Match Result and AI Matching Configuration in DocType list

## Troubleshooting

### "App not valid" error
```bash
# Check these files exist:
ls apps/aimhi_hrms/setup.py
ls apps/aimhi_hrms/aimhi_hrms/hooks.py
ls apps/aimhi_hrms/requirements.txt
```

### Installation permission errors
```bash
sudo chown -R $USER:$USER frappe-aimhi/
```

### Import errors
```bash
# Clear cache and restart
bench --site aimhi.local clear-cache
bench restart
```

## Success Indicators

You'll know it's working when:
- ✅ `bench --site aimhi.local list-apps` shows aimhi_hrms
- ✅ No validation errors during installation
- ✅ Can access the Frappe desk
- ✅ AI Match Result DocType is available
- ✅ Job Opening forms show AI enhancements

The app structure is now fully compliant with Frappe standards and should install without errors.