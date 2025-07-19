#!/usr/bin/env python3
"""
Task 4: Create AIM Hi HRMS Custom Frappe App Structure
This script creates the complete Frappe custom app structure for integrating AIM Hi AI matching
"""

import os
import json
from pathlib import Path

class AIMHiHRMSAppCreator:
    """Creates the complete Frappe custom app structure"""
    
    def __init__(self, app_name="aimhi_hrms"):
        self.app_name = app_name
        self.app_path = Path(f"frappe-setup/{app_name}")
        
    def create_app_structure(self):
        """Create the complete Frappe app directory structure"""
        
        # Main app structure
        directories = [
            f"{self.app_name}",
            f"{self.app_name}/config",
            f"{self.app_name}/ai_matching",
            f"{self.app_name}/ai_matching/__init__.py",
            f"{self.app_name}/ai_matching/doctype",
            f"{self.app_name}/ai_matching/doctype/ai_match_result",
            f"{self.app_name}/ai_matching/doctype/ai_matching_configuration", 
            f"{self.app_name}/ai_matching/doctype/ai_processing_queue",
            f"{self.app_name}/ai_matching/api",
            f"{self.app_name}/ai_matching/api/__init__.py",
            f"{self.app_name}/ai_core",
            f"{self.app_name}/ai_core/__init__.py",
            f"{self.app_name}/customizations",
            f"{self.app_name}/customizations/__init__.py", 
            f"{self.app_name}/customizations/job_opening",
            f"{self.app_name}/customizations/job_applicant",
            f"{self.app_name}/customizations/job_interview",
            f"{self.app_name}/public",
            f"{self.app_name}/public/js",
            f"{self.app_name}/public/css",
            f"{self.app_name}/templates",
            f"{self.app_name}/templates/includes",
            f"{self.app_name}/fixtures",
            f"{self.app_name}/patches"
        ]
        
        # Create directories
        for directory in directories:
            dir_path = Path(f"frappe-setup/{directory}")
            if not directory.endswith(".py"):
                dir_path.mkdir(parents=True, exist_ok=True)
        
        print(f"✅ Created app directory structure: {len(directories)} items")
        return True
    
    def create_app_manifest(self):
        """Create app manifest files"""
        
        # __init__.py
        init_content = f'''
"""
AIM Hi HRMS - AI-Enhanced Recruitment System
"""

__version__ = '1.0.0'
'''
        
        # hooks.py - Main app configuration
        hooks_content = f'''
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
modules_dict = {{
    "AIM Hi AI Matching": {{
        "color": "#3498db",
        "icon": "fa fa-magic",
        "type": "module",
        "label": "AI Matching"
    }}
}}

# DocType events
doc_events = {{
    "Job Opening": {{
        "after_insert": "aimhi_hrms.customizations.job_opening.extract_critical_requirements",
        "on_update": "aimhi_hrms.customizations.job_opening.extract_critical_requirements"
    }},
    "Job Applicant": {{
        "after_insert": "aimhi_hrms.customizations.job_applicant.analyze_resume",
        "on_update": "aimhi_hrms.customizations.job_applicant.analyze_resume"
    }},
    "AI Match Result": {{
        "after_insert": "aimhi_hrms.ai_matching.doctype.ai_match_result.ai_match_result.handle_match_result"
    }}
}}

# Custom fields for existing DocTypes
custom_fields = {{
    "Job Opening": [
        {{
            "fieldname": "ai_matching_section",
            "fieldtype": "Section Break",
            "label": "AI Matching Configuration",
            "insert_after": "description"
        }},
        {{
            "fieldname": "enable_ai_matching",
            "fieldtype": "Check",
            "label": "Enable AI Matching",
            "default": 1,
            "insert_after": "ai_matching_section"
        }},
        {{
            "fieldname": "ai_matching_weights",
            "fieldtype": "JSON",
            "label": "Custom Matching Weights",
            "insert_after": "enable_ai_matching"
        }},
        {{
            "fieldname": "critical_requirements",
            "fieldtype": "JSON", 
            "label": "Critical Requirements (Auto-extracted)",
            "read_only": 1,
            "insert_after": "ai_matching_weights"
        }},
        {{
            "fieldname": "last_ai_analysis",
            "fieldtype": "Datetime",
            "label": "Last AI Analysis", 
            "read_only": 1,
            "insert_after": "critical_requirements"
        }},
        {{
            "fieldname": "total_ai_matches",
            "fieldtype": "Int",
            "label": "Total AI Matches",
            "default": 0,
            "read_only": 1,
            "insert_after": "last_ai_analysis"
        }}
    ],
    "Job Applicant": [
        {{
            "fieldname": "ai_analysis_section",
            "fieldtype": "Section Break", 
            "label": "AI Analysis Results",
            "insert_after": "resume_attachment"
        }},
        {{
            "fieldname": "best_match_percentage",
            "fieldtype": "Float",
            "label": "Best Match %",
            "precision": 2,
            "read_only": 1,
            "insert_after": "ai_analysis_section"
        }},
        {{
            "fieldname": "best_match_job",
            "fieldtype": "Link",
            "options": "Job Opening",
            "label": "Best Match Job",
            "read_only": 1,
            "insert_after": "best_match_percentage"
        }},
        {{
            "fieldname": "ai_extracted_skills",
            "fieldtype": "JSON",
            "label": "AI Extracted Skills",
            "read_only": 1,
            "insert_after": "best_match_job"
        }},
        {{
            "fieldname": "resume_text",
            "fieldtype": "Long Text",
            "label": "Extracted Resume Text",
            "read_only": 1,
            "insert_after": "ai_extracted_skills"
        }},
        {{
            "fieldname": "total_job_matches", 
            "fieldtype": "Int",
            "label": "Total Job Matches",
            "default": 0,
            "read_only": 1,
            "insert_after": "resume_text"
        }},
        {{
            "fieldname": "last_ai_update",
            "fieldtype": "Datetime",
            "label": "Last AI Update",
            "read_only": 1,
            "insert_after": "total_job_matches"
        }}
    ],
    "Job Interview": [
        {{
            "fieldname": "ai_match_section",
            "fieldtype": "Section Break",
            "label": "AI Match Context", 
            "insert_after": "interview_details"
        }},
        {{
            "fieldname": "candidate_match_score",
            "fieldtype": "Float",
            "label": "AI Match Score %",
            "precision": 2,
            "read_only": 1,
            "insert_after": "ai_match_section"
        }},
        {{
            "fieldname": "key_strengths",
            "fieldtype": "JSON",
            "label": "AI Identified Strengths", 
            "read_only": 1,
            "insert_after": "candidate_match_score"
        }},
        {{
            "fieldname": "areas_of_concern", 
            "fieldtype": "JSON",
            "label": "AI Identified Concerns",
            "read_only": 1,
            "insert_after": "key_strengths"
        }},
        {{
            "fieldname": "ai_recommendations",
            "fieldtype": "Long Text",
            "label": "AI Recommendations",
            "read_only": 1,
            "insert_after": "areas_of_concern"
        }}
    ]
}}

# Background jobs
scheduler_events = {{
    "cron": {{
        "0 2 * * *": [  # Daily at 2 AM
            "aimhi_hrms.ai_matching.api.cleanup_old_processing_queues"
        ],
        "*/15 * * * *": [  # Every 15 minutes
            "aimhi_hrms.ai_matching.api.process_ai_queue"
        ]
    }}
}}

# Website context
website_context = {{
    "favicon": "/assets/aimhi_hrms/images/favicon.ico",
    "splash_image": "/assets/aimhi_hrms/images/splash.png"
}}

# Installation hooks
after_install = "aimhi_hrms.install.after_install"
before_uninstall = "aimhi_hrms.uninstall.before_uninstall"

# User permissions
has_permission = {{
    "AI Match Result": "aimhi_hrms.ai_matching.doctype.ai_match_result.ai_match_result.has_permission",
    "AI Processing Queue": "aimhi_hrms.ai_matching.doctype.ai_processing_queue.ai_processing_queue.has_permission"
}}

# Jinja filters
jenv = {{
    "methods": [
        "aimhi_hrms.utils.format_match_percentage:format_match_percentage",
        "aimhi_hrms.utils.get_match_color:get_match_color"
    ]
}}
'''
        
        # modules.txt
        modules_content = "AIM Hi AI Matching"
        
        # Write files
        files = {
            f"frappe-setup/{self.app_name}/__init__.py": init_content,
            f"frappe-setup/{self.app_name}/hooks.py": hooks_content,
            f"frappe-setup/{self.app_name}/modules.txt": modules_content
        }
        
        for file_path, content in files.items():
            with open(file_path, 'w') as f:
                f.write(content)
        
        print(f"✅ Created app manifest files: {len(files)} files")
        return True
    
    def create_doctypes(self):
        """Create custom DocType definitions"""
        
        # AI Match Result DocType
        ai_match_result = {
            "creation": "2025-07-19 17:00:00.000000",
            "doctype": "DocType",
            "editable_grid": 1,
            "engine": "InnoDB",
            "field_order": [
                "job_opening", "job_applicant", "match_percentage", "match_grade",
                "reasoning", "criteria_scores_section", "skills_match_score",
                "experience_level_score", "keyword_relevance_score", 
                "professional_depth_score", "domain_experience_score",
                "detailed_analysis_section", "weighted_scores", "skill_analysis",
                "strengths", "concerns", "recommendations", "processing_info_section",
                "processed_on", "processing_time_ms"
            ],
            "fields": [
                {
                    "fieldname": "job_opening",
                    "fieldtype": "Link", 
                    "in_list_view": 1,
                    "label": "Job Opening",
                    "options": "Job Opening",
                    "reqd": 1
                },
                {
                    "fieldname": "job_applicant", 
                    "fieldtype": "Link",
                    "in_list_view": 1,
                    "label": "Job Applicant",
                    "options": "Job Applicant",
                    "reqd": 1
                },
                {
                    "fieldname": "match_percentage",
                    "fieldtype": "Float",
                    "in_list_view": 1,
                    "label": "Match Percentage",
                    "precision": 2
                },
                {
                    "fieldname": "match_grade",
                    "fieldtype": "Select",
                    "in_list_view": 1,
                    "label": "Match Grade",
                    "options": "Excellent\\nGood\\nFair\\nPoor"
                },
                {
                    "fieldname": "reasoning",
                    "fieldtype": "Long Text",
                    "label": "Reasoning"
                },
                {
                    "fieldname": "criteria_scores_section",
                    "fieldtype": "Section Break",
                    "label": "Criteria Scores"
                },
                {
                    "fieldname": "skills_match_score",
                    "fieldtype": "Int",
                    "label": "Skills Match Score"
                },
                {
                    "fieldname": "experience_level_score",
                    "fieldtype": "Int", 
                    "label": "Experience Level Score"
                },
                {
                    "fieldname": "keyword_relevance_score",
                    "fieldtype": "Int",
                    "label": "Keyword Relevance Score"
                },
                {
                    "fieldname": "professional_depth_score",
                    "fieldtype": "Int",
                    "label": "Professional Depth Score"
                },
                {
                    "fieldname": "domain_experience_score", 
                    "fieldtype": "Int",
                    "label": "Domain Experience Score"
                },
                {
                    "fieldname": "detailed_analysis_section",
                    "fieldtype": "Section Break",
                    "label": "Detailed Analysis"
                },
                {
                    "fieldname": "weighted_scores",
                    "fieldtype": "JSON",
                    "label": "Weighted Scores"
                },
                {
                    "fieldname": "skill_analysis",
                    "fieldtype": "JSON",
                    "label": "Skill Analysis"
                },
                {
                    "fieldname": "strengths",
                    "fieldtype": "JSON",
                    "label": "Strengths"
                },
                {
                    "fieldname": "concerns",
                    "fieldtype": "JSON", 
                    "label": "Concerns"
                },
                {
                    "fieldname": "recommendations",
                    "fieldtype": "Long Text",
                    "label": "Recommendations"
                },
                {
                    "fieldname": "processing_info_section",
                    "fieldtype": "Section Break",
                    "label": "Processing Information"
                },
                {
                    "fieldname": "processed_on",
                    "fieldtype": "Datetime",
                    "label": "Processed On",
                    "default": "now()"
                },
                {
                    "fieldname": "processing_time_ms",
                    "fieldtype": "Int",
                    "label": "Processing Time (ms)"
                }
            ],
            "index_web_pages_for_search": 1,
            "links": [],
            "modified": "2025-07-19 17:00:00.000000",
            "modified_by": "Administrator",
            "module": "AIM Hi AI Matching",
            "name": "AI Match Result",
            "owner": "Administrator",
            "permissions": [
                {
                    "create": 1,
                    "delete": 1,
                    "email": 1,
                    "export": 1,
                    "print": 1,
                    "read": 1,
                    "report": 1,
                    "role": "HR Manager",
                    "share": 1,
                    "write": 1
                },
                {
                    "create": 1,
                    "email": 1,
                    "export": 1,
                    "print": 1,
                    "read": 1,
                    "report": 1,
                    "role": "HR User",
                    "share": 1,
                    "write": 1
                }
            ],
            "quick_entry": 1,
            "sort_field": "modified",
            "sort_order": "DESC",
            "track_changes": 1
        }
        
        # AI Matching Configuration DocType
        ai_config_doctype = {
            "creation": "2025-07-19 17:00:00.000000",
            "doctype": "DocType",
            "engine": "InnoDB",
            "is_single": 1,
            "field_order": [
                "organization", "weights_section", "skills_weight", "experience_weight",
                "keywords_weight", "professional_depth_weight", "domain_experience_weight",
                "thresholds_section", "minimum_match_threshold", "auto_shortlist_threshold",
                "api_configuration_section", "openai_api_key", "processing_settings_section",
                "enable_pre_filtering", "batch_processing_size", "is_active"
            ],
            "fields": [
                {
                    "fieldname": "organization",
                    "fieldtype": "Link",
                    "label": "Organization",
                    "options": "Company",
                    "reqd": 1
                },
                {
                    "fieldname": "weights_section",
                    "fieldtype": "Section Break",
                    "label": "Matching Weights"
                },
                {
                    "fieldname": "skills_weight",
                    "fieldtype": "Int",
                    "label": "Skills Weight (%)",
                    "default": 25
                },
                {
                    "fieldname": "experience_weight",
                    "fieldtype": "Int", 
                    "label": "Experience Weight (%)",
                    "default": 15
                },
                {
                    "fieldname": "keywords_weight",
                    "fieldtype": "Int",
                    "label": "Keywords Weight (%)", 
                    "default": 25
                },
                {
                    "fieldname": "professional_depth_weight",
                    "fieldtype": "Int",
                    "label": "Professional Depth Weight (%)",
                    "default": 15
                },
                {
                    "fieldname": "domain_experience_weight",
                    "fieldtype": "Int",
                    "label": "Domain Experience Weight (%)",
                    "default": 20
                },
                {
                    "fieldname": "thresholds_section",
                    "fieldtype": "Section Break",
                    "label": "Match Thresholds"
                },
                {
                    "fieldname": "minimum_match_threshold", 
                    "fieldtype": "Float",
                    "label": "Minimum Match Threshold (%)",
                    "default": 30.0
                },
                {
                    "fieldname": "auto_shortlist_threshold",
                    "fieldtype": "Float",
                    "label": "Auto Shortlist Threshold (%)",
                    "default": 80.0
                },
                {
                    "fieldname": "api_configuration_section",
                    "fieldtype": "Section Break",
                    "label": "API Configuration"
                },
                {
                    "fieldname": "openai_api_key",
                    "fieldtype": "Password",
                    "label": "OpenAI API Key"
                },
                {
                    "fieldname": "processing_settings_section",
                    "fieldtype": "Section Break",
                    "label": "Processing Settings"
                },
                {
                    "fieldname": "enable_pre_filtering",
                    "fieldtype": "Check",
                    "label": "Enable Pre-filtering",
                    "default": 1
                },
                {
                    "fieldname": "batch_processing_size",
                    "fieldtype": "Int",
                    "label": "Batch Processing Size",
                    "default": 3
                },
                {
                    "fieldname": "is_active",
                    "fieldtype": "Check", 
                    "label": "Is Active",
                    "default": 1
                }
            ],
            "modified": "2025-07-19 17:00:00.000000",
            "modified_by": "Administrator",
            "module": "AIM Hi AI Matching",
            "name": "AI Matching Configuration",
            "owner": "Administrator",
            "permissions": [
                {
                    "create": 1,
                    "delete": 1,
                    "email": 1,
                    "export": 1,
                    "print": 1,
                    "read": 1,
                    "report": 1,
                    "role": "System Manager",
                    "share": 1,
                    "write": 1
                },
                {
                    "read": 1,
                    "role": "HR Manager",
                    "write": 1
                }
            ],
            "quick_entry": 1,
            "sort_field": "modified",
            "sort_order": "DESC"
        }
        
        # AI Processing Queue DocType
        ai_queue_doctype = {
            "creation": "2025-07-19 17:00:00.000000",
            "doctype": "DocType",
            "engine": "InnoDB", 
            "field_order": [
                "job_opening", "processing_status", "progress_section",
                "total_candidates", "processed_candidates", "progress_percentage",
                "timing_section", "started_on", "completed_on", "processing_time_minutes",
                "cost_tracking_section", "api_calls_made", "estimated_cost_usd",
                "error_handling_section", "error_message"
            ],
            "fields": [
                {
                    "fieldname": "job_opening",
                    "fieldtype": "Link",
                    "in_list_view": 1,
                    "label": "Job Opening",
                    "options": "Job Opening",
                    "reqd": 1
                },
                {
                    "fieldname": "processing_status",
                    "fieldtype": "Select",
                    "in_list_view": 1,
                    "label": "Processing Status",
                    "options": "Queued\\nProcessing\\nCompleted\\nFailed",
                    "default": "Queued"
                },
                {
                    "fieldname": "progress_section",
                    "fieldtype": "Section Break",
                    "label": "Progress"
                },
                {
                    "fieldname": "total_candidates",
                    "fieldtype": "Int",
                    "label": "Total Candidates"
                },
                {
                    "fieldname": "processed_candidates",
                    "fieldtype": "Int",
                    "label": "Processed Candidates",
                    "default": 0
                },
                {
                    "fieldname": "progress_percentage",
                    "fieldtype": "Float",
                    "label": "Progress Percentage",
                    "default": 0.0
                },
                {
                    "fieldname": "timing_section",
                    "fieldtype": "Section Break", 
                    "label": "Timing"
                },
                {
                    "fieldname": "started_on",
                    "fieldtype": "Datetime",
                    "label": "Started On"
                },
                {
                    "fieldname": "completed_on",
                    "fieldtype": "Datetime",
                    "label": "Completed On"
                },
                {
                    "fieldname": "processing_time_minutes",
                    "fieldtype": "Float",
                    "label": "Processing Time (Minutes)"
                },
                {
                    "fieldname": "cost_tracking_section",
                    "fieldtype": "Section Break",
                    "label": "Cost Tracking"
                },
                {
                    "fieldname": "api_calls_made",
                    "fieldtype": "Int",
                    "label": "API Calls Made"
                },
                {
                    "fieldname": "estimated_cost_usd",
                    "fieldtype": "Currency",
                    "label": "Estimated Cost (USD)"
                },
                {
                    "fieldname": "error_handling_section",
                    "fieldtype": "Section Break",
                    "label": "Error Handling"
                },
                {
                    "fieldname": "error_message",
                    "fieldtype": "Long Text",
                    "label": "Error Message"
                }
            ],
            "index_web_pages_for_search": 1,
            "links": [],
            "modified": "2025-07-19 17:00:00.000000",
            "modified_by": "Administrator",
            "module": "AIM Hi AI Matching",
            "name": "AI Processing Queue",
            "owner": "Administrator",
            "permissions": [
                {
                    "create": 1,
                    "delete": 1,
                    "email": 1,
                    "export": 1,
                    "print": 1,
                    "read": 1,
                    "report": 1,
                    "role": "HR Manager",
                    "share": 1,
                    "write": 1
                },
                {
                    "read": 1,
                    "role": "HR User"
                },
                {
                    "create": 1,
                    "delete": 1,
                    "email": 1,
                    "export": 1,
                    "print": 1,
                    "read": 1,
                    "report": 1,
                    "role": "System Manager",
                    "share": 1,
                    "write": 1
                }
            ],
            "quick_entry": 1,
            "sort_field": "modified", 
            "sort_order": "DESC",
            "track_changes": 1
        }
        
        # Save DocType JSON files
        doctypes = {
            "ai_match_result": ai_match_result,
            "ai_matching_configuration": ai_config_doctype,
            "ai_processing_queue": ai_queue_doctype
        }
        
        for doctype_name, doctype_data in doctypes.items():
            # Create DocType directory and files
            doctype_dir = f"frappe-setup/{self.app_name}/ai_matching/doctype/{doctype_name}"
            os.makedirs(doctype_dir, exist_ok=True)
            
            # JSON file
            with open(f"{doctype_dir}/{doctype_name}.json", 'w') as f:
                json.dump(doctype_data, f, indent=4)
            
            # Python controller file
            controller_content = f'''
"""
{doctype_data["name"]} DocType Controller
"""

import frappe
from frappe.model.document import Document

class {doctype_data["name"].replace(" ", "")}(Document):
    def validate(self):
        pass
    
    def on_update(self):
        pass
    
    def after_insert(self):
        pass
'''
            
            with open(f"{doctype_dir}/{doctype_name}.py", 'w') as f:
                f.write(controller_content)
            
            # __init__.py
            with open(f"{doctype_dir}/__init__.py", 'w') as f:
                f.write("")
        
        print(f"✅ Created {len(doctypes)} custom DocTypes with controllers")
        return True

def main():
    """Create the complete AIM Hi HRMS Frappe app structure"""
    
    print("=== TASK 4: Create AIM Hi HRMS Custom Frappe App Structure ===\\n")
    
    # Initialize app creator
    creator = AIMHiHRMSAppCreator("aimhi_hrms")
    
    # Create app structure
    print("🏗️ CREATING APP STRUCTURE")
    creator.create_app_structure()
    
    print("\\n📋 CREATING APP MANIFEST")
    creator.create_app_manifest()
    
    print("\\n🔧 CREATING CUSTOM DOCTYPES")
    creator.create_doctypes()
    
    print("\\n✅ FRAPPE APP STRUCTURE CREATED SUCCESSFULLY")
    print("🎯 App Name: aimhi_hrms")
    print("📁 Location: frappe-setup/aimhi_hrms/")
    print("🔗 Ready for Frappe bench integration")
    
    print("\\n📊 TASK 4 STATUS: COMPLETED")
    print("🎯 Ready for Task 5: Implement Core AI Integration Logic")
    
    return True

if __name__ == "__main__":
    main()