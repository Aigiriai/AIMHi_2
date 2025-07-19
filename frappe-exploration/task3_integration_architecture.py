#!/usr/bin/env python3
"""
Task 3: Frappe HRMS Integration Architecture Design
Complete technical blueprint for embedding AIM Hi AI matching into Frappe HRMS

This module designs the complete integration architecture including:
- Custom DocTypes and fields
- Server script integration points
- Client script UI enhancements  
- API endpoint specifications
- Database schema extensions
"""

import json
from datetime import datetime

class FrappeIntegrationArchitecture:
    """
    Complete architecture design for AIM Hi + Frappe HRMS integration
    """
    
    def __init__(self):
        self.architecture = {
            "project_name": "AIM Hi Enhanced HRMS",
            "version": "1.0",
            "created_date": datetime.now().isoformat(),
            "integration_approach": "Custom Frappe App with AI Matching Engine"
        }
    
    def design_custom_doctypes(self):
        """Design custom DocTypes needed for AI matching integration"""
        
        custom_doctypes = {
            "AI Match Result": {
                "purpose": "Store comprehensive AI matching results for candidate-job pairs",
                "fields": [
                    {"fieldname": "job_opening", "fieldtype": "Link", "options": "Job Opening", "reqd": 1},
                    {"fieldname": "job_applicant", "fieldtype": "Link", "options": "Job Applicant", "reqd": 1},
                    {"fieldname": "match_percentage", "fieldtype": "Float", "precision": 2},
                    {"fieldname": "match_grade", "fieldtype": "Select", "options": "Excellent\nGood\nFair\nPoor"},
                    {"fieldname": "reasoning", "fieldtype": "Long Text"},
                    {"fieldname": "skills_match_score", "fieldtype": "Int"},
                    {"fieldname": "experience_level_score", "fieldtype": "Int"},
                    {"fieldname": "keyword_relevance_score", "fieldtype": "Int"},
                    {"fieldname": "professional_depth_score", "fieldtype": "Int"},
                    {"fieldname": "domain_experience_score", "fieldtype": "Int"},
                    {"fieldname": "weighted_scores", "fieldtype": "JSON"},
                    {"fieldname": "skill_analysis", "fieldtype": "JSON"},
                    {"fieldname": "strengths", "fieldtype": "JSON"},
                    {"fieldname": "concerns", "fieldtype": "JSON"},
                    {"fieldname": "recommendations", "fieldtype": "Long Text"},
                    {"fieldname": "processed_on", "fieldtype": "Datetime", "default": "now()"},
                    {"fieldname": "processing_time_ms", "fieldtype": "Int"}
                ],
                "permissions": [
                    {"role": "HR User", "permlevel": 0, "read": 1, "write": 1, "create": 1},
                    {"role": "HR Manager", "permlevel": 0, "read": 1, "write": 1, "create": 1, "delete": 1}
                ]
            },
            
            "AI Matching Configuration": {
                "purpose": "Store organization-specific AI matching weights and settings",
                "fields": [
                    {"fieldname": "organization", "fieldtype": "Link", "options": "Company", "reqd": 1},
                    {"fieldname": "skills_weight", "fieldtype": "Int", "default": 25},
                    {"fieldname": "experience_weight", "fieldtype": "Int", "default": 15},
                    {"fieldname": "keywords_weight", "fieldtype": "Int", "default": 25},
                    {"fieldname": "professional_depth_weight", "fieldtype": "Int", "default": 15},
                    {"fieldname": "domain_experience_weight", "fieldtype": "Int", "default": 20},
                    {"fieldname": "minimum_match_threshold", "fieldtype": "Float", "default": 30.0},
                    {"fieldname": "auto_shortlist_threshold", "fieldtype": "Float", "default": 80.0},
                    {"fieldname": "openai_api_key", "fieldtype": "Password"},
                    {"fieldname": "enable_pre_filtering", "fieldtype": "Check", "default": 1},
                    {"fieldname": "batch_processing_size", "fieldtype": "Int", "default": 3},
                    {"fieldname": "is_active", "fieldtype": "Check", "default": 1}
                ],
                "permissions": [
                    {"role": "System Manager", "permlevel": 0, "read": 1, "write": 1, "create": 1, "delete": 1},
                    {"role": "HR Manager", "permlevel": 0, "read": 1, "write": 1}
                ]
            },
            
            "AI Processing Queue": {
                "purpose": "Queue system for batch processing AI matching jobs",
                "fields": [
                    {"fieldname": "job_opening", "fieldtype": "Link", "options": "Job Opening", "reqd": 1},
                    {"fieldname": "processing_status", "fieldtype": "Select", "options": "Queued\nProcessing\nCompleted\nFailed", "default": "Queued"},
                    {"fieldname": "total_candidates", "fieldtype": "Int"},
                    {"fieldname": "processed_candidates", "fieldtype": "Int", "default": 0},
                    {"fieldname": "progress_percentage", "fieldtype": "Float", "default": 0.0},
                    {"fieldname": "started_on", "fieldtype": "Datetime"},
                    {"fieldname": "completed_on", "fieldtype": "Datetime"},
                    {"fieldname": "error_message", "fieldtype": "Long Text"},
                    {"fieldname": "processing_time_minutes", "fieldtype": "Float"},
                    {"fieldname": "api_calls_made", "fieldtype": "Int"},
                    {"fieldname": "estimated_cost_usd", "fieldtype": "Currency"}
                ],
                "permissions": [
                    {"role": "HR User", "permlevel": 0, "read": 1},
                    {"role": "HR Manager", "permlevel": 0, "read": 1, "write": 1, "create": 1},
                    {"role": "System Manager", "permlevel": 0, "read": 1, "write": 1, "create": 1, "delete": 1}
                ]
            }
        }
        
        return custom_doctypes
    
    def design_doctype_customizations(self):
        """Design customizations for existing Frappe HRMS DocTypes"""
        
        customizations = {
            "Job Opening": {
                "new_fields": [
                    {"fieldname": "ai_matching_section", "fieldtype": "Section Break", "label": "AI Matching Configuration"},
                    {"fieldname": "enable_ai_matching", "fieldtype": "Check", "label": "Enable AI Matching", "default": 1},
                    {"fieldname": "ai_matching_weights", "fieldtype": "JSON", "label": "Custom Matching Weights"},
                    {"fieldname": "critical_requirements", "fieldtype": "JSON", "label": "Critical Requirements (Auto-extracted)"},
                    {"fieldname": "last_ai_analysis", "fieldtype": "Datetime", "label": "Last AI Analysis"},
                    {"fieldname": "total_ai_matches", "fieldtype": "Int", "label": "Total AI Matches", "default": 0}
                ],
                "custom_buttons": [
                    {"label": "Run AI Matching", "method": "run_ai_matching_batch", "icon": "fa fa-magic"},
                    {"label": "View Match Results", "method": "view_ai_match_results", "icon": "fa fa-chart-bar"},
                    {"label": "Export Matches", "method": "export_ai_matches", "icon": "fa fa-download"}
                ]
            },
            
            "Job Applicant": {
                "new_fields": [
                    {"fieldname": "ai_analysis_section", "fieldtype": "Section Break", "label": "AI Analysis Results"},
                    {"fieldname": "best_match_percentage", "fieldtype": "Float", "label": "Best Match %", "precision": 2, "read_only": 1},
                    {"fieldname": "best_match_job", "fieldtype": "Link", "options": "Job Opening", "label": "Best Match Job", "read_only": 1},
                    {"fieldname": "ai_extracted_skills", "fieldtype": "JSON", "label": "AI Extracted Skills", "read_only": 1},
                    {"fieldname": "resume_text", "fieldtype": "Long Text", "label": "Extracted Resume Text", "read_only": 1},
                    {"fieldname": "total_job_matches", "fieldtype": "Int", "label": "Total Job Matches", "default": 0, "read_only": 1},
                    {"fieldname": "last_ai_update", "fieldtype": "Datetime", "label": "Last AI Update", "read_only": 1}
                ],
                "custom_buttons": [
                    {"label": "Analyze Resume", "method": "analyze_resume_with_ai", "icon": "fa fa-search"},
                    {"label": "Find Best Matches", "method": "find_best_job_matches", "icon": "fa fa-bullseye"},
                    {"label": "View All Matches", "method": "view_all_ai_matches", "icon": "fa fa-list"}
                ]
            },
            
            "Job Interview": {
                "new_fields": [
                    {"fieldname": "ai_match_section", "fieldtype": "Section Break", "label": "AI Match Context"},
                    {"fieldname": "candidate_match_score", "fieldtype": "Float", "label": "AI Match Score %", "precision": 2, "read_only": 1},
                    {"fieldname": "key_strengths", "fieldtype": "JSON", "label": "AI Identified Strengths", "read_only": 1},
                    {"fieldname": "areas_of_concern", "fieldtype": "JSON", "label": "AI Identified Concerns", "read_only": 1},
                    {"fieldname": "ai_recommendations", "fieldtype": "Long Text", "label": "AI Recommendations", "read_only": 1}
                ]
            }
        }
        
        return customizations
    
    def design_server_scripts(self):
        """Design server scripts for AI integration logic"""
        
        server_scripts = {
            "Job Opening - AI Matching": {
                "doctype": "Job Opening",
                "script_type": "DocType Event",
                "events": ["after_insert", "on_update"],
                "script": """
# Extract critical requirements when job is created/updated
import frappe
import json
from aimhi_hrms.ai_matching_engine import AIMHiMatchingEngine

def extract_critical_requirements(doc, method):
    if doc.enable_ai_matching and doc.description:
        try:
            # Get AI configuration
            config = frappe.get_single("AI Matching Configuration")
            if not config.openai_api_key:
                frappe.throw("OpenAI API key not configured")
            
            # Initialize AI engine
            engine = AIMHiMatchingEngine(config.openai_api_key)
            
            # Extract requirements
            requirements = await engine.extract_critical_requirements(
                doc.description, 
                doc.job_profile or ""
            )
            
            # Update document
            doc.critical_requirements = json.dumps(requirements)
            doc.last_ai_analysis = frappe.utils.now()
            
        except Exception as e:
            frappe.log_error(f"AI Requirements Extraction Error: {str(e)}")
"""
            },
            
            "Job Applicant - Resume Analysis": {
                "doctype": "Job Applicant",
                "script_type": "DocType Event", 
                "events": ["after_insert", "on_update"],
                "script": """
# Extract resume text and analyze with AI when applicant is created/updated
import frappe
import json
from aimhi_hrms.resume_processor import extract_resume_text
from aimhi_hrms.ai_matching_engine import AIMHiMatchingEngine

def analyze_resume(doc, method):
    if doc.resume_attachment and not doc.resume_text:
        try:
            # Extract text from resume
            resume_text = extract_resume_text(doc.resume_attachment)
            doc.resume_text = resume_text
            
            # Get AI configuration
            config = frappe.get_single("AI Matching Configuration")
            if config.openai_api_key:
                # Initialize AI engine
                engine = AIMHiMatchingEngine(config.openai_api_key)
                
                # Extract skills (simplified analysis)
                skills = await engine.extract_skills_from_resume(resume_text)
                doc.ai_extracted_skills = json.dumps(skills)
                
            doc.last_ai_update = frappe.utils.now()
            
        except Exception as e:
            frappe.log_error(f"Resume Analysis Error: {str(e)}")
"""
            },
            
            "AI Match Result - Auto Actions": {
                "doctype": "AI Match Result",
                "script_type": "DocType Event",
                "events": ["after_insert"],
                "script": """
# Perform automatic actions based on AI match results
import frappe

def handle_match_result(doc, method):
    try:
        config = frappe.get_single("AI Matching Configuration")
        
        # Auto-shortlist high-scoring candidates
        if doc.match_percentage >= config.auto_shortlist_threshold:
            applicant = frappe.get_doc("Job Applicant", doc.job_applicant)
            if applicant.status == "Open":
                applicant.status = "Accepted"
                applicant.save()
                
                # Create interview if needed
                if not frappe.db.exists("Job Interview", {
                    "job_applicant": doc.job_applicant,
                    "job_opening": doc.job_opening
                }):
                    interview = frappe.get_doc({
                        "doctype": "Job Interview",
                        "job_applicant": doc.job_applicant,
                        "job_opening": doc.job_opening,
                        "interview_round": "Preliminary",
                        "candidate_match_score": doc.match_percentage,
                        "key_strengths": doc.strengths,
                        "areas_of_concern": doc.concerns,
                        "ai_recommendations": doc.recommendations
                    })
                    interview.insert()
                    
    except Exception as e:
        frappe.log_error(f"Auto Action Error: {str(e)}")
"""
            }
        }
        
        return server_scripts
    
    def design_client_scripts(self):
        """Design client scripts for enhanced UI functionality"""
        
        client_scripts = {
            "Job Opening - AI Dashboard": {
                "doctype": "Job Opening",
                "script": """
frappe.ui.form.on('Job Opening', {
    refresh: function(frm) {
        if (frm.doc.enable_ai_matching) {
            // Add AI Matching Dashboard
            frm.add_custom_button(__('AI Matching Dashboard'), function() {
                show_ai_matching_dashboard(frm.doc.name);
            }, __('AI Actions'));
            
            // Add Run AI Matching button
            frm.add_custom_button(__('Run AI Matching'), function() {
                run_ai_matching_batch(frm.doc.name);
            }, __('AI Actions'));
            
            // Show AI statistics
            if (frm.doc.total_ai_matches > 0) {
                frm.dashboard.add_progress(__('AI Matches Processed'), 
                    frm.doc.total_ai_matches, 'blue');
            }
        }
    }
});

function show_ai_matching_dashboard(job_opening) {
    frappe.route_options = {"job_opening": job_opening};
    frappe.set_route("query-report", "AI Matching Results");
}

function run_ai_matching_batch(job_opening) {
    frappe.call({
        method: "aimhi_hrms.api.run_ai_matching_batch",
        args: {
            job_opening: job_opening
        },
        callback: function(r) {
            if (r.message) {
                frappe.show_alert({
                    message: `AI matching started for ${r.message.total_candidates} candidates`,
                    indicator: 'green'
                });
                // Refresh form to show updated statistics
                cur_frm.reload_doc();
            }
        }
    });
}
"""
            },
            
            "Job Applicant - Match Visualization": {
                "doctype": "Job Applicant", 
                "script": """
frappe.ui.form.on('Job Applicant', {
    refresh: function(frm) {
        if (frm.doc.best_match_percentage) {
            // Show match percentage badge
            let match_color = get_match_color(frm.doc.best_match_percentage);
            frm.dashboard.add_indicator(__('Best Match: {0}%', [frm.doc.best_match_percentage]), match_color);
            
            // Add view matches button
            frm.add_custom_button(__('View AI Matches'), function() {
                show_candidate_matches(frm.doc.name);
            }, __('AI Analysis'));
        }
        
        // Add analyze resume button
        if (frm.doc.resume_attachment && !frm.doc.resume_text) {
            frm.add_custom_button(__('Analyze Resume'), function() {
                analyze_candidate_resume(frm.doc.name);
            }, __('AI Analysis'));
        }
    }
});

function get_match_color(percentage) {
    if (percentage >= 80) return 'green';
    if (percentage >= 60) return 'orange';
    if (percentage >= 40) return 'yellow';
    return 'red';
}

function show_candidate_matches(job_applicant) {
    frappe.route_options = {"job_applicant": job_applicant};
    frappe.set_route("List", "AI Match Result");
}

function analyze_candidate_resume(job_applicant) {
    frappe.call({
        method: "aimhi_hrms.api.analyze_resume",
        args: {
            job_applicant: job_applicant
        },
        callback: function(r) {
            if (r.message) {
                frappe.show_alert({
                    message: 'Resume analysis completed',
                    indicator: 'green'
                });
                cur_frm.reload_doc();
            }
        }
    });
}
"""
            }
        }
        
        return client_scripts
    
    def design_api_endpoints(self):
        """Design API endpoints for AI matching functionality"""
        
        api_endpoints = {
            "/api/method/aimhi_hrms.api.run_ai_matching_batch": {
                "method": "POST",
                "description": "Start batch AI matching for a job opening",
                "parameters": ["job_opening"],
                "response": {"total_candidates": "int", "queue_id": "string"},
                "implementation": """
import frappe
from aimhi_hrms.ai_processor import start_batch_matching

@frappe.whitelist()
def run_ai_matching_batch(job_opening):
    # Validate permissions
    if not frappe.has_permission("Job Opening", "write"):
        frappe.throw("Insufficient permissions")
    
    # Get job opening document
    job_doc = frappe.get_doc("Job Opening", job_opening)
    
    # Get all applicable candidates
    candidates = frappe.get_all("Job Applicant", 
        filters={"status": "Open"},
        fields=["name", "applicant_name", "resume_text"]
    )
    
    # Create processing queue entry
    queue_doc = frappe.get_doc({
        "doctype": "AI Processing Queue",
        "job_opening": job_opening,
        "total_candidates": len(candidates),
        "processing_status": "Queued"
    })
    queue_doc.insert()
    
    # Start background processing
    frappe.enqueue(
        start_batch_matching,
        queue=frappe.local.site,
        job_opening=job_opening,
        queue_id=queue_doc.name,
        candidates=candidates
    )
    
    return {
        "total_candidates": len(candidates),
        "queue_id": queue_doc.name
    }
"""
            },
            
            "/api/method/aimhi_hrms.api.get_match_results": {
                "method": "GET",
                "description": "Get AI matching results for job opening",
                "parameters": ["job_opening", "limit", "offset"],
                "response": {"matches": "array", "total_count": "int"},
                "implementation": """
@frappe.whitelist()
def get_match_results(job_opening, limit=20, offset=0):
    # Get match results
    matches = frappe.get_all("AI Match Result",
        filters={"job_opening": job_opening},
        fields=["name", "job_applicant", "match_percentage", "match_grade", "reasoning"],
        order_by="match_percentage desc",
        limit_page_length=limit,
        limit_start=offset
    )
    
    # Get total count
    total_count = frappe.db.count("AI Match Result", 
        filters={"job_opening": job_opening})
    
    return {
        "matches": matches,
        "total_count": total_count
    }
"""
            },
            
            "/api/method/aimhi_hrms.api.get_processing_status": {
                "method": "GET", 
                "description": "Get status of AI processing queue",
                "parameters": ["queue_id"],
                "response": {"status": "string", "progress": "float", "eta_minutes": "int"},
                "implementation": """
@frappe.whitelist()
def get_processing_status(queue_id):
    queue_doc = frappe.get_doc("AI Processing Queue", queue_id)
    
    # Calculate ETA if processing
    eta_minutes = None
    if queue_doc.processing_status == "Processing":
        # Estimate based on processing rate
        remaining = queue_doc.total_candidates - queue_doc.processed_candidates
        avg_time_per_candidate = 30  # seconds
        eta_minutes = (remaining * avg_time_per_candidate) / 60
    
    return {
        "status": queue_doc.processing_status,
        "progress": queue_doc.progress_percentage,
        "eta_minutes": eta_minutes,
        "error_message": queue_doc.error_message
    }
"""
            }
        }
        
        return api_endpoints
    
    def design_reports_and_dashboards(self):
        """Design custom reports and dashboards for AI matching"""
        
        reports = {
            "AI Matching Results": {
                "type": "Query Report",
                "description": "Comprehensive AI matching results analysis",
                "columns": [
                    {"fieldname": "job_opening", "label": "Job Opening", "fieldtype": "Link", "options": "Job Opening"},
                    {"fieldname": "applicant_name", "label": "Candidate", "fieldtype": "Data"},
                    {"fieldname": "match_percentage", "label": "Match %", "fieldtype": "Percent"},
                    {"fieldname": "match_grade", "label": "Grade", "fieldtype": "Data"},
                    {"fieldname": "skills_score", "label": "Skills", "fieldtype": "Int"},
                    {"fieldname": "experience_score", "label": "Experience", "fieldtype": "Int"},
                    {"fieldname": "keywords_score", "label": "Keywords", "fieldtype": "Int"},
                    {"fieldname": "processed_on", "label": "Processed On", "fieldtype": "Datetime"}
                ],
                "query": """
                SELECT
                    mr.job_opening,
                    ja.applicant_name,
                    mr.match_percentage,
                    mr.match_grade,
                    mr.skills_match_score as skills_score,
                    mr.experience_level_score as experience_score,
                    mr.keyword_relevance_score as keywords_score,
                    mr.processed_on
                FROM `tabAI Match Result` mr
                JOIN `tabJob Applicant` ja ON mr.job_applicant = ja.name
                WHERE mr.job_opening = %(job_opening)s
                ORDER BY mr.match_percentage DESC
                """
            },
            
            "AI Matching Performance Dashboard": {
                "type": "Dashboard",
                "description": "Performance metrics for AI matching system", 
                "charts": [
                    {
                        "name": "Match Distribution",
                        "type": "donut",
                        "source": "AI Match Result",
                        "group_by": "match_grade"
                    },
                    {
                        "name": "Processing Timeline", 
                        "type": "line",
                        "source": "AI Processing Queue",
                        "x_field": "creation",
                        "y_field": "processing_time_minutes"
                    },
                    {
                        "name": "API Cost Tracking",
                        "type": "bar", 
                        "source": "AI Processing Queue",
                        "x_field": "creation",
                        "y_field": "estimated_cost_usd"
                    }
                ]
            }
        }
        
        return reports
    
    def generate_complete_architecture(self):
        """Generate the complete integration architecture"""
        
        architecture = {
            "project_overview": self.architecture,
            "custom_doctypes": self.design_custom_doctypes(),
            "doctype_customizations": self.design_doctype_customizations(), 
            "server_scripts": self.design_server_scripts(),
            "client_scripts": self.design_client_scripts(),
            "api_endpoints": self.design_api_endpoints(),
            "reports_and_dashboards": self.design_reports_and_dashboards(),
            "implementation_phases": {
                "Phase 1": "Custom DocType creation and basic AI engine integration",
                "Phase 2": "DocType customizations and server script implementation", 
                "Phase 3": "Client scripts, UI enhancements, and API endpoints",
                "Phase 4": "Reports, dashboards, and performance optimization",
                "Phase 5": "Testing, documentation, and deployment"
            },
            "technical_requirements": {
                "frappe_version": ">=14.0",
                "python_version": ">=3.8",
                "required_packages": ["openai", "asyncio", "dataclasses"],
                "system_requirements": "2GB RAM, 1GB storage for AI processing"
            }
        }
        
        return architecture

def main():
    """Generate and display the complete integration architecture"""
    
    print("=== TASK 3: Frappe HRMS Integration Architecture Design ===\n")
    
    # Create architecture designer
    designer = FrappeIntegrationArchitecture()
    
    # Generate complete architecture
    architecture = designer.generate_complete_architecture()
    
    # Display key components
    print("📋 INTEGRATION ARCHITECTURE OVERVIEW")
    print("=" * 50)
    print(f"Project: {architecture['project_overview']['project_name']}")
    print(f"Approach: {architecture['project_overview']['integration_approach']}")
    print()
    
    print("🏗️ CUSTOM DOCTYPES")
    for doctype, config in architecture['custom_doctypes'].items():
        print(f"  • {doctype}: {config['purpose']}")
        print(f"    Fields: {len(config['fields'])} custom fields")
    print()
    
    print("⚙️ DOCTYPE CUSTOMIZATIONS")
    for doctype, config in architecture['doctype_customizations'].items():
        buttons_count = len(config.get('custom_buttons', []))
        print(f"  • {doctype}: {len(config['new_fields'])} new fields, {buttons_count} custom buttons")
    print()
    
    print("🔧 SERVER SCRIPTS")
    for script_name in architecture['server_scripts'].keys():
        print(f"  • {script_name}")
    print()
    
    print("💻 CLIENT SCRIPTS")  
    for script_name in architecture['client_scripts'].keys():
        print(f"  • {script_name}")
    print()
    
    print("🌐 API ENDPOINTS")
    for endpoint in architecture['api_endpoints'].keys():
        print(f"  • {endpoint}")
    print()
    
    print("📊 REPORTS & DASHBOARDS")
    for report_name, config in architecture['reports_and_dashboards'].items():
        print(f"  • {report_name} ({config['type']})")
    print()
    
    print("🎯 IMPLEMENTATION PHASES")
    for phase, description in architecture['implementation_phases'].items():
        print(f"  {phase}: {description}")
    print()
    
    print("✅ ARCHITECTURE DESIGN COMPLETED")
    print("🎯 Ready for Task 4: Create Custom Frappe App Structure")
    
    return architecture

if __name__ == "__main__":
    architecture = main()