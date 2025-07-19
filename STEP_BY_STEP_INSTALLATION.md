# 🎯 Step-by-Step Local Installation Guide

## PART 1: Download Files (5 minutes)

### From This Replit Project, Download:

**1. The AI Integration App** (CRITICAL)
- Go to file explorer → `frappe-setup/aimhi_hrms/`
- Right-click the folder → Download (if available)
- OR manually copy all files in this folder structure to your computer

**2. Installation Script** (SAVES TIME)
- Go to `frappe-setup/install_aimhi_hrms.sh`
- Copy all content → save as `install_aimhi_hrms.sh` on your computer

### Your Downloaded Folder Should Look Like:
```
my-download-folder/
├── aimhi_hrms/                    ← Main integration folder
│   ├── aimhi_hrms/
│   │   ├── ai_matching/           ← AI engine code
│   │   ├── ai_match_result/       ← Results storage
│   │   ├── customizations/        ← UI enhancements  
│   │   └── hooks.py               ← Configuration
│   └── setup.py
└── install_aimhi_hrms.sh          ← Installation script
```

## PART 2: Prepare Your Computer (10 minutes)

### What Operating System Do You Have?

**For Windows:**
1. Install WSL2 (Windows Subsystem for Linux)
2. Open WSL terminal for all commands below

**For Mac:**
1. Open Terminal app
2. Install Homebrew if not already: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**For Linux (Ubuntu/Debian):**
1. Open Terminal
2. Ready to go!

### Get Your OpenAI API Key Ready
- You'll need your OpenAI API key (starts with "sk-...")
- If you don't have one: https://platform.openai.com/api-keys

## PART 3: Run Installation (15-30 minutes)

### Option A: Automatic Installation (RECOMMENDED)

1. **Navigate to your download folder:**
   ```bash
   cd /path/to/your/downloaded/files
   ```

2. **Make script executable:**
   ```bash
   chmod +x install_aimhi_hrms.sh
   ```

3. **Run installation:**
   ```bash
   ./install_aimhi_hrms.sh
   ```

4. **Follow prompts:**
   - Enter administrator password (choose something secure)
   - Enter your OpenAI API key when asked
   - Wait for installation to complete (15-30 minutes)

### Option B: Manual Installation (If automatic fails)

1. **Install Frappe Bench:**
   ```bash
   pip3 install frappe-bench
   ```

2. **Create development environment:**
   ```bash
   bench init frappe-aimhi --frappe-branch version-15
   cd frappe-aimhi
   ```

3. **Create site:**
   ```bash
   bench new-site aimhi.local
   bench use aimhi.local
   ```

4. **Install HRMS:**
   ```bash
   bench get-app hrms
   bench --site aimhi.local install-app hrms
   ```

5. **Copy our custom app:**
   ```bash
   cp -r /path/to/downloaded/aimhi_hrms ./apps/
   bench --site aimhi.local install-app aimhi_hrms
   ```

6. **Configure OpenAI:**
   ```bash
   bench --site aimhi.local set-config openai_api_key "your-api-key-here"
   ```

## PART 4: Start Your HRMS (2 minutes)

1. **Start the server:**
   ```bash
   cd frappe-aimhi  # (if not already there)
   bench start
   ```

2. **Wait for startup messages:**
   - Look for "Serving on http://0.0.0.0:8000"
   - May take 1-2 minutes first time

3. **Access your system:**
   - Open browser → http://aimhi.local:8000
   - Or try: http://localhost:8000

## PART 5: Test Your AI Integration (5 minutes)

### Login:
- **Username**: Administrator
- **Password**: [what you set during installation]

### Navigate to HRMS:
1. Click "Human Resources" module
2. Go to "Recruitment" → "Job Opening"
3. Click "New" to create a job

### Create Test Job:
- **Job Title**: "Senior Python Developer"
- **Department**: Create "Engineering" if needed
- **Description**: Add detailed requirements (Python, Django, etc.)
- **Save** the job

### Test AI Matching:
1. Open your saved job opening
2. Look for "AI Matching" button (this is our integration!)
3. Click "Run AI Analysis"
4. Watch the analysis progress
5. View detailed results with 5-dimensional scoring

### Expected Results:
- ✅ Skills, Keywords, Domain, Experience, Depth scores
- ✅ Overall match percentages
- ✅ Detailed reasoning for each candidate
- ✅ Professional results table

## SUCCESS! You Now Have:

✅ **Full Frappe HRMS** - Professional HR management system
✅ **AI Integration** - 5-dimensional candidate matching built-in
✅ **Complete Workflows** - Job → Applicant → Interview → Offer
✅ **Multi-user System** - Add team members with different roles
✅ **Background Processing** - AI analysis runs automatically

## Common Issues & Solutions

### "Site not accessible"
```bash
# Add to hosts file
echo "127.0.0.1 aimhi.local" | sudo tee -a /etc/hosts
```

### "AI matching not working"
```bash
# Check/set OpenAI key
bench --site aimhi.local set-config openai_api_key "sk-your-key"
```

### "Installation failed"
1. Check you have Python 3.10/3.11: `python3 --version`
2. Check you have Node.js 16+: `node --version`
3. Try manual installation steps above

### "Permission errors"
```bash
# Fix permissions
sudo chown -R $USER:$USER frappe-aimhi/
```

## What's Different from Current System?

**Current (Port 5000)**: Basic recruitment platform
**New Local HRMS**: Complete professional HR system with:
- Native Frappe interface (used by 10,000+ companies)
- Full HR workflows and permissions
- Your AI integration built seamlessly into forms
- Multi-company and role-based access
- Professional reporting and analytics

## Next Steps

1. **Explore the interface** - Navigate through different modules
2. **Add users** - Create accounts for team members
3. **Test full workflow** - Create jobs, add applicants, schedule interviews
4. **Customize settings** - Adjust AI weights and company settings
5. **Deploy to production** - When ready, use cloud hosting

You'll have the complete professional HRMS experience with all your AI enhancements!