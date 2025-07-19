"""
AIM Hi HRMS App Configuration
"""

app_name = "aimhi_hrms"
app_title = "AIM Hi HRMS"
app_publisher = "AIM Hi Technologies"
app_description = "AI-Enhanced HRMS with Advanced Candidate Matching"
app_icon = "fa fa-magic"
app_color = "#3498db"
app_email = "support@aimhi.app"
app_license = "MIT"
app_version = "1.0.0"

# Required apps
required_apps = ["frappe", "hrms"]

# Module definitions
modules_dict = {
    "AIM Hi AI Matching": {
        "color": "#3498db",
        "icon": "fa fa-magic",
        "type": "module",
        "label": "AI Matching"
    }
}

# DocType events
doc_events = {
    "Job Opening": {
        "after_insert": "aimhi_hrms.customizations.job_opening.extract_critical_requirements",
        "on_update": "aimhi_hrms.customizations.job_opening.extract_critical_requirements"
    },
    "Job Applicant": {
        "after_insert": "aimhi_hrms.customizations.job_applicant.analyze_resume",
        "on_update": "aimhi_hrms.customizations.job_applicant.analyze_resume"
    }
}

# Scheduled jobs
scheduler_events = {
    "cron": {
        "*/15 * * * *": [
            "aimhi_hrms.ai_matching.api.process_ai_queue"
        ]
    }
}
