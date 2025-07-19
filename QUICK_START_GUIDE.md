# 🚀 Quick Start: Get Your Frappe HRMS Running in 30 Minutes

## What You're Installing

**Frappe HRMS** = Professional HR management software (used by 10,000+ companies)
**+ Your AI Integration** = 5-dimensional candidate matching built right into the interface

Result: Complete HR system with Job Opening → Applicant → Interview → Offer workflow

## STEP 1: Download Files (2 minutes)

### From This Replit Project:

**Download These 2 Items:**
1. **Folder**: `frappe-setup/aimhi_hrms/` (entire folder - this is your AI integration)
2. **File**: `frappe-setup/install_aimhi_hrms.sh` (installation script)

**How to Download:**
- Click on each item in Replit's file explorer
- Right-click → Download (if available)
- OR copy content and save to files on your computer

**Save Both Items to Same Folder on Your Computer**

## STEP 2: Prepare Your Computer (5 minutes)

### Requirements Check:
- **OS**: Windows (with WSL), Mac, or Linux
- **Memory**: 4GB+ RAM 
- **Space**: 2GB free disk space

### Get Your OpenAI API Key:
- You'll need your API key (starts with "sk-...")
- Get one at: https://platform.openai.com/api-keys

## STEP 3: Install Everything (20 minutes)

### Open Terminal/Command Prompt:
```bash
# Navigate to where you saved the files
cd /path/to/your/downloads

# Make script executable (Mac/Linux)
chmod +x install_aimhi_hrms.sh

# Run the installation
./install_aimhi_hrms.sh
```

### What Happens:
1. ✅ Checks your system
2. ✅ Installs Python, Node.js, Database automatically
3. ✅ Sets up Frappe development environment
4. ✅ Creates your local site
5. ✅ Installs HRMS application  
6. ✅ Deploys your AI integration
7. ✅ Asks for your OpenAI API key
8. ✅ Configures everything

**Just Answer Prompts:**
- Administrator password: (choose something secure)
- OpenAI API key: (paste your sk-... key)

## STEP 4: Start Your HRMS (2 minutes)

```bash
# Start the system
cd frappe-aimhi
bench start
```

**Wait for:**
- "Serving on http://0.0.0.0:8000" message
- May take 1-2 minutes first startup

## STEP 5: Access Your Professional HRMS (1 minute)

**Open Browser:**
- Go to: **http://aimhi.local:8000**
- Or try: **http://localhost:8000**

**Login:**
- Username: **Administrator**
- Password: [what you set during installation]

## STEP 6: Test AI Integration (5 minutes)

### Navigate to HR Module:
1. Click **"Human Resources"** 
2. Go to **"Recruitment"** → **"Job Opening"**
3. Click **"New"**

### Create Test Job:
- Job Title: **"Senior Python Developer"**
- Department: **"Engineering"** (create if needed)
- Description: Add detailed requirements
- **Save**

### Test Your AI:
1. Open the saved job
2. Look for **"AI Matching"** button ← This is your integration!
3. Click **"Run AI Analysis"**
4. Watch real-time progress
5. View 5-dimensional results

### Success = You See:
- ✅ Skills, Keywords, Domain, Experience, Depth scores
- ✅ Overall match percentages  
- ✅ Professional results table
- ✅ Detailed candidate reasoning

## 🎉 CONGRATULATIONS!

You now have:
- **Professional HRMS interface** (same as enterprise companies use)
- **Your AI matching** built seamlessly into the workflow
- **Complete HR processes** from job posting to offer letters
- **Multi-user system** ready for your team

## What's Different from Port 5000?

**Port 5000 (Current)**: Basic recruitment platform
**Local HRMS (New)**: Complete professional HR system with:
- Native Frappe interface and workflows
- Role-based permissions and multi-company support
- Your AI integration built into standard forms
- Background job processing
- Comprehensive reporting and analytics

## Troubleshooting

**Can't access site?**
```bash
echo "127.0.0.1 aimhi.local" | sudo tee -a /etc/hosts
```

**AI not working?**
```bash
bench --site aimhi.local set-config openai_api_key "sk-your-key"
```

**Installation failed?**
- Check you have the `aimhi_hrms/` folder downloaded
- Ensure `install_aimhi_hrms.sh` is in same directory
- Try manual steps in `LOCAL_INSTALLATION_GUIDE.md`

## Next Steps

1. **Add team members** - Create user accounts with different roles
2. **Test full workflow** - Job → Applicant → Interview → Offer
3. **Customize AI weights** - Adjust the matching criteria
4. **Explore modules** - Payroll, Leave Management, Performance
5. **Deploy to cloud** - When ready for production use

You've successfully transformed your AI recruitment system into a complete professional HRMS!