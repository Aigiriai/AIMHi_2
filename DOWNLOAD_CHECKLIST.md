# 📁 AIM Hi HRMS Download Checklist

## Files to Download from Replit

### ✅ Required Files

**1. Custom App Folder** (CRITICAL - Contains all AI integration)
```
📁 frappe-setup/aimhi_hrms/
   ├── 📁 aimhi_hrms/
   │   ├── 📁 ai_matching/
   │   ├── 📁 customizations/  
   │   ├── 📁 ai_match_result/
   │   ├── 📁 ai_matching_configuration/
   │   ├── 📄 hooks.py
   │   └── 📄 modules.txt
   ├── 📄 __init__.py
   └── 📄 setup.py
```
**Size**: ~50 files
**What it does**: Contains your entire AI matching integration

**2. Installation Script** (RECOMMENDED - Automates everything)
```
📄 frappe-setup/install_aimhi_hrms.sh
```
**What it does**: Automatically installs everything with one command

### ✅ Optional but Helpful

**3. Setup Documentation**
```
📄 frappe-setup/README_LOCAL_SETUP.md
📄 LOCAL_INSTALLATION_GUIDE.md
📄 DOWNLOAD_CHECKLIST.md (this file)
```

**4. Deployment Configuration** (For production later)
```
📄 frappe-setup/docker-compose.yml
📁 frappe-setup/aimhi_hrms/ (already included above)
```

## How to Download from Replit

### Method 1: Individual File Download
1. Click on each file in the Replit file explorer
2. Use Ctrl+A to select all content
3. Copy and paste into new file on your computer
4. Save with exact same name and extension

### Method 2: Replit Download Feature
1. Right-click on `frappe-setup/aimhi_hrms/` folder
2. Select "Download" if available
3. Extract the ZIP file to your computer

### Method 3: Git Clone (Advanced)
```bash
# If this project is in a Git repository
git clone [repository-url]
cd [project-folder]/frappe-setup/
```

## Verify Your Downloads

### Check Folder Structure
Your downloaded files should look like:
```
your-downloads/
├── aimhi_hrms/                    ✅ (Main app folder)
│   ├── aimhi_hrms/
│   │   ├── ai_matching/           ✅ (AI engine)
│   │   ├── ai_match_result/       ✅ (Results DocType)
│   │   ├── customizations/        ✅ (UI enhancements)
│   │   ├── hooks.py               ✅ (Configuration)
│   │   └── modules.txt            ✅ (Module list)
│   └── setup.py                   ✅ (App metadata)
└── install_aimhi_hrms.sh          ✅ (Installation script)
```

### File Size Check
- **aimhi_hrms folder**: Should contain ~50 files
- **install_aimhi_hrms.sh**: ~300 lines of code
- **Total size**: ~500KB - 1MB

### Critical Files Checklist
- [ ] `aimhi_hrms/aimhi_hrms/hooks.py` (App configuration)
- [ ] `aimhi_hrms/aimhi_hrms/ai_matching/matching_engine.py` (AI engine)
- [ ] `aimhi_hrms/aimhi_hrms/ai_match_result/` (Results storage)
- [ ] `install_aimhi_hrms.sh` (Installation script)

## Next Steps After Download

### 1. Organize Files
```bash
# Create installation folder
mkdir aimhi-hrms-setup
cd aimhi-hrms-setup

# Move downloaded files here
mv ~/Downloads/aimhi_hrms ./
mv ~/Downloads/install_aimhi_hrms.sh ./
```

### 2. Verify Script Permissions
```bash
# Make script executable
chmod +x install_aimhi_hrms.sh

# Check it's executable
ls -la install_aimhi_hrms.sh
# Should show: -rwxr-xr-x ... install_aimhi_hrms.sh
```

### 3. Prepare Installation Info
Have ready:
- **OpenAI API Key**: Your sk-... key for AI functionality
- **Admin Password**: What you want as administrator password
- **Admin Email**: Your email for system admin

### 4. Run Installation
```bash
./install_aimhi_hrms.sh
```

## Common Download Issues

### "File too large" errors
- Download folder by folder instead of all at once
- Use zip download if available

### "Permission denied" on script
```bash
chmod +x install_aimhi_hrms.sh
```

### Missing files
- Double-check you downloaded the entire `aimhi_hrms/` folder
- Ensure all subfolders are included

### Corrupt files
- Re-download if files seem empty or incomplete
- Check file extensions are correct (.py, .sh, .md)

## Alternative: Manual Setup

If automated installation fails, you can:
1. Follow `README_LOCAL_SETUP.md` for manual steps
2. Use the deployment documentation
3. Get help from the Frappe community

## Ready to Install?

Once you have:
- [ ] Downloaded `aimhi_hrms/` folder
- [ ] Downloaded `install_aimhi_hrms.sh` script  
- [ ] Made script executable
- [ ] Prepared your OpenAI API key

You're ready to run:
```bash
./install_aimhi_hrms.sh
```

This will give you the full Frappe HRMS with your AI integration running at **http://aimhi.local:8000**