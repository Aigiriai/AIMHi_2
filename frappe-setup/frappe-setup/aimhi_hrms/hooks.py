
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
    },
    "AI Match Result": {
        "after_insert": "aimhi_hrms.ai_matching.doctype.ai_match_result.ai_match_result.handle_match_result"
    }
}

# Custom fields for existing DocTypes
custom_fields = {
    "Job Opening": [
        {
            "fieldname": "ai_matching_section",
            "fieldtype": "Section Break",
            "label": "AI Matching Configuration",
            "insert_after": "description"
        },
        {
            "fieldname": "enable_ai_matching",
            "fieldtype": "Check",
            "label": "Enable AI Matching",
            "default": 1,
            "insert_after": "ai_matching_section"
        },
        {
            "fieldname": "ai_matching_weights",
            "fieldtype": "JSON",
            "label": "Custom Matching Weights",
            "insert_after": "enable_ai_matching"
        },
        {
            "fieldname": "critical_requirements",
            "fieldtype": "JSON", 
            "label": "Critical Requirements (Auto-extracted)",
            "read_only": 1,
            "insert_after": "ai_matching_weights"
        },
        {
            "fieldname": "last_ai_analysis",
            "fieldtype": "Datetime",
            "label": "Last AI Analysis", 
            "read_only": 1,
            "insert_after": "critical_requirements"
        },
        {
            "fieldname": "total_ai_matches",
            "fieldtype": "Int",
            "label": "Total AI Matches",
            "default": 0,
            "read_only": 1,
            "insert_after": "last_ai_analysis"
        }
    ],
    "Job Applicant": [
        {
            "fieldname": "ai_analysis_section",
            "fieldtype": "Section Break", 
            "label": "AI Analysis Results",
            "insert_after": "resume_attachment"
        },
        {
            "fieldname": "best_match_percentage",
            "fieldtype": "Float",
            "label": "Best Match %",
            "precision": 2,
            "read_only": 1,
            "insert_after": "ai_analysis_section"
        },
        {
            "fieldname": "best_match_job",
            "fieldtype": "Link",
            "options": "Job Opening",
            "label": "Best Match Job",
            "read_only": 1,
            "insert_after": "best_match_percentage"
        },
        {
            "fieldname": "ai_extracted_skills",
            "fieldtype": "JSON",
            "label": "AI Extracted Skills",
            "read_only": 1,
            "insert_after": "best_match_job"
        },
        {
            "fieldname": "resume_text",
            "fieldtype": "Long Text",
            "label": "Extracted Resume Text",
            "read_only": 1,
            "insert_after": "ai_extracted_skills"
        },
        {
            "fieldname": "total_job_matches", 
            "fieldtype": "Int",
            "label": "Total Job Matches",
            "default": 0,
            "read_only": 1,
            "insert_after": "resume_text"
        },
        {
            "fieldname": "last_ai_update",
            "fieldtype": "Datetime",
            "label": "Last AI Update",
            "read_only": 1,
            "insert_after": "total_job_matches"
        }
    ],
    "Job Interview": [
        {
            "fieldname": "ai_match_section",
            "fieldtype": "Section Break",
            "label": "AI Match Context", 
            "insert_after": "interview_details"
        },
        {
            "fieldname": "candidate_match_score",
            "fieldtype": "Float",
            "label": "AI Match Score %",
            "precision": 2,
            "read_only": 1,
            "insert_after": "ai_match_section"
        },
        {
            "fieldname": "key_strengths",
            "fieldtype": "JSON",
            "label": "AI Identified Strengths", 
            "read_only": 1,
            "insert_after": "candidate_match_score"
        },
        {
            "fieldname": "areas_of_concern", 
            "fieldtype": "JSON",
            "label": "AI Identified Concerns",
            "read_only": 1,
            "insert_after": "key_strengths"
        },
        {
            "fieldname": "ai_recommendations",
            "fieldtype": "Long Text",
            "label": "AI Recommendations",
            "read_only": 1,
            "insert_after": "areas_of_concern"
        }
    ]
}

# Background jobs
scheduler_events = {
    "cron": {
        "0 2 * * *": [  # Daily at 2 AM
            "aimhi_hrms.ai_matching.api.cleanup_old_processing_queues"
        ],
        "*/15 * * * *": [  # Every 15 minutes
            "aimhi_hrms.ai_matching.api.process_ai_queue"
        ]
    }
}

# Website context
website_context = {
    "favicon": "/assets/aimhi_hrms/images/favicon.ico",
    "splash_image": "/assets/aimhi_hrms/images/splash.png"
}

# Installation hooks
after_install = "aimhi_hrms.install.after_install"
before_uninstall = "aimhi_hrms.uninstall.before_uninstall"

# User permissions
has_permission = {
    "AI Match Result": "aimhi_hrms.ai_matching.doctype.ai_match_result.ai_match_result.has_permission",
    "AI Processing Queue": "aimhi_hrms.ai_matching.doctype.ai_processing_queue.ai_processing_queue.has_permission"
}

# Jinja filters
jenv = {
    "methods": [
        "aimhi_hrms.utils.format_match_percentage:format_match_percentage",
        "aimhi_hrms.utils.get_match_color:get_match_color"
    ]
}
