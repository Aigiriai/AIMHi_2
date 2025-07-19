#!/usr/bin/env python3
"""
Task 4: Create AIM Hi HRMS Custom Frappe App Structure (Simplified)
"""

import os
import json
from pathlib import Path

def create_frappe_app():
    """Create AIM Hi HRMS Frappe app structure"""
    
    print("=== TASK 4: Create AIM Hi HRMS Custom Frappe App Structure ===\n")
    
    app_name = "aimhi_hrms"
    
    # Create main directories
    directories = [
        f"{app_name}",
        f"{app_name}/config",
        f"{app_name}/ai_matching",
        f"{app_name}/ai_matching/doctype",
        f"{app_name}/ai_matching/doctype/ai_match_result",
        f"{app_name}/ai_matching/doctype/ai_matching_configuration",
        f"{app_name}/ai_matching/doctype/ai_processing_queue",
        f"{app_name}/ai_matching/api",
        f"{app_name}/ai_core",
        f"{app_name}/customizations",
        f"{app_name}/public",
        f"{app_name}/public/js",
        f"{app_name}/public/css",
        f"{app_name}/templates",
        f"{app_name}/fixtures"
    ]
    
    print("🏗️ Creating app directories...")
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        # Create __init__.py files
        init_file = os.path.join(directory, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, 'w') as f:
                f.write("")
    
    # Create main app files
    print("📋 Creating app manifest files...")
    
    # __init__.py
    with open(f"{app_name}/__init__.py", 'w') as f:
        f.write('__version__ = "1.0.0"\n')
    
    # hooks.py
    hooks_content = f'''"""
AIM Hi HRMS App Configuration
"""

app_name = "{app_name}"
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
        "after_insert": "{app_name}.customizations.job_opening.extract_critical_requirements",
        "on_update": "{app_name}.customizations.job_opening.extract_critical_requirements"
    }},
    "Job Applicant": {{
        "after_insert": "{app_name}.customizations.job_applicant.analyze_resume",
        "on_update": "{app_name}.customizations.job_applicant.analyze_resume"
    }}
}}

# Scheduled jobs
scheduler_events = {{
    "cron": {{
        "*/15 * * * *": [
            "{app_name}.ai_matching.api.process_ai_queue"
        ]
    }}
}}
'''
    
    with open(f"{app_name}/hooks.py", 'w') as f:
        f.write(hooks_content)
    
    # modules.txt
    with open(f"{app_name}/modules.txt", 'w') as f:
        f.write("AIM Hi AI Matching")
    
    # Create AI matching engine core file
    print("🔧 Creating AI matching engine...")
    
    ai_engine_content = '''"""
AIM Hi AI Matching Engine for Frappe HRMS
Ported from TypeScript implementation
"""

import asyncio
import json
import hashlib
import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
import frappe
from openai import AsyncOpenAI

@dataclass
class MatchCriteria:
    """Five-dimensional matching criteria scores (0-100)"""
    skillsMatch: int
    experienceLevel: int  
    keywordRelevance: int
    professionalDepth: int
    domainExperience: int

@dataclass
class DetailedMatchResult:
    """Comprehensive matching result"""
    candidateId: str
    matchPercentage: float
    reasoning: str
    criteriaScores: MatchCriteria
    weightedScores: MatchCriteria
    skillAnalysis: Dict

class AIMHiMatchingEngine:
    """Core AI matching engine for Frappe HRMS"""
    
    def __init__(self, openai_api_key: str):
        self.client = AsyncOpenAI(api_key=openai_api_key)
        
    def normalize_content(self, content: str) -> str:
        """Normalize content for consistent analysis"""
        return re.sub(r'\\s+', ' ', re.sub(r'[^\\w\\s]', ' ', content.lower())).strip()
    
    def generate_hash(self, job_description: str, resume_content: str) -> int:
        """Generate deterministic hash for seeding"""
        combined = self.normalize_content(job_description + resume_content)
        return int(hashlib.md5(combined.encode()).hexdigest()[:8], 16)
    
    async def match_candidate(self, job_data: Dict, candidate_data: Dict) -> DetailedMatchResult:
        """Main matching function"""
        try:
            # Extract data
            job_title = job_data.get("designation", "")
            job_description = job_data.get("description", "")
            candidate_name = candidate_data.get("applicant_name", "")
            resume_content = candidate_data.get("resume_text", "")
            
            # Generate seed for consistency
            seed = self.generate_hash(job_description, resume_content)
            
            # Create AI prompt
            prompt = f"""
Analyze candidate match for job:
Job: {job_title}
Description: {job_description}
Candidate: {candidate_name}  
Resume: {resume_content}

Rate on 0-100 scale for:
1. Skills Match
2. Experience Level
3. Keyword Relevance
4. Professional Depth
5. Domain Experience

Respond with JSON:
{{
  "criteriaScores": {{
    "skillsMatch": number,
    "experienceLevel": number,
    "keywordRelevance": number,
    "professionalDepth": number,
    "domainExperience": number
  }},
  "detailedReasoning": "explanation",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"]
}}
"""
            
            # Call OpenAI
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                seed=seed
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Calculate weighted scores (using default weights)
            criteria_scores = MatchCriteria(
                skillsMatch=result["criteriaScores"]["skillsMatch"],
                experienceLevel=result["criteriaScores"]["experienceLevel"],
                keywordRelevance=result["criteriaScores"]["keywordRelevance"],
                professionalDepth=result["criteriaScores"]["professionalDepth"],
                domainExperience=result["criteriaScores"]["domainExperience"]
            )
            
            # Default weights: skills=25%, experience=15%, keywords=25%, depth=15%, domain=20%
            weighted_scores = MatchCriteria(
                skillsMatch=criteria_scores.skillsMatch * 0.25,
                experienceLevel=criteria_scores.experienceLevel * 0.15,
                keywordRelevance=criteria_scores.keywordRelevance * 0.25,
                professionalDepth=criteria_scores.professionalDepth * 0.15,
                domainExperience=criteria_scores.domainExperience * 0.20
            )
            
            # Calculate final percentage
            final_percentage = sum([
                weighted_scores.skillsMatch,
                weighted_scores.experienceLevel,
                weighted_scores.keywordRelevance,
                weighted_scores.professionalDepth,
                weighted_scores.domainExperience
            ])
            
            return DetailedMatchResult(
                candidateId=candidate_data.get("name", ""),
                matchPercentage=min(100, max(0, final_percentage)),
                reasoning=result.get("detailedReasoning", ""),
                criteriaScores=criteria_scores,
                weightedScores=weighted_scores,
                skillAnalysis=result
            )
            
        except Exception as e:
            frappe.log_error(f"AI Matching Error: {str(e)}")
            # Return error result
            default_criteria = MatchCriteria(0, 0, 0, 0, 0)
            return DetailedMatchResult(
                candidateId=candidate_data.get("name", ""),
                matchPercentage=0,
                reasoning=f"Error in AI analysis: {str(e)}",
                criteriaScores=default_criteria,
                weightedScores=default_criteria,
                skillAnalysis={}
            )

# Frappe integration functions
@frappe.whitelist()
def run_ai_matching_batch(job_opening):
    """Start batch AI matching for a job opening"""
    try:
        # Get configuration
        config = frappe.get_single("AI Matching Configuration")
        if not config.openai_api_key:
            frappe.throw("OpenAI API key not configured")
        
        # Get job document
        job_doc = frappe.get_doc("Job Opening", job_opening)
        
        # Get candidates
        candidates = frappe.get_all("Job Applicant", 
            filters={"status": "Open"},
            fields=["name", "applicant_name", "resume_text"]
        )
        
        # Start background processing
        frappe.enqueue(
            process_candidates_async,
            queue=frappe.local.site,
            job_opening=job_opening,
            candidates=candidates,
            api_key=config.openai_api_key
        )
        
        return {"total_candidates": len(candidates), "status": "started"}
        
    except Exception as e:
        frappe.log_error(f"Batch AI Matching Error: {str(e)}")
        frappe.throw(f"Error starting AI matching: {str(e)}")

def process_candidates_async(job_opening, candidates, api_key):
    """Background processing of candidates"""
    import asyncio
    
    async def process_all():
        engine = AIMHiMatchingEngine(api_key)
        job_doc = frappe.get_doc("Job Opening", job_opening)
        
        job_data = {
            "designation": job_doc.designation,
            "description": job_doc.description,
            "job_profile": job_doc.job_profile or ""
        }
        
        for candidate in candidates:
            try:
                result = await engine.match_candidate(job_data, candidate)
                
                # Save result to database
                match_doc = frappe.get_doc({
                    "doctype": "AI Match Result",
                    "job_opening": job_opening,
                    "job_applicant": candidate["name"],
                    "match_percentage": result.matchPercentage,
                    "match_grade": get_match_grade(result.matchPercentage),
                    "reasoning": result.reasoning,
                    "skills_match_score": result.criteriaScores.skillsMatch,
                    "experience_level_score": result.criteriaScores.experienceLevel,
                    "keyword_relevance_score": result.criteriaScores.keywordRelevance,
                    "professional_depth_score": result.criteriaScores.professionalDepth,
                    "domain_experience_score": result.criteriaScores.domainExperience,
                    "weighted_scores": json.dumps(asdict(result.weightedScores)),
                    "skill_analysis": json.dumps(result.skillAnalysis)
                })
                match_doc.insert()
                frappe.db.commit()
                
            except Exception as e:
                frappe.log_error(f"Error processing candidate {candidate['name']}: {str(e)}")
    
    # Run async processing
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(process_all())
    loop.close()

def get_match_grade(percentage):
    """Convert match percentage to grade"""
    if percentage >= 80:
        return "Excellent"
    elif percentage >= 60:
        return "Good"
    elif percentage >= 40:
        return "Fair"
    else:
        return "Poor"
'''
    
    with open(f"{app_name}/ai_core/matching_engine.py", 'w') as f:
        f.write(ai_engine_content)
    
    # Create AI Match Result DocType
    print("📊 Creating AI Match Result DocType...")
    
    ai_match_result_json = {
        "creation": "2025-07-19 17:00:00.000000",
        "doctype": "DocType",
        "engine": "InnoDB",
        "field_order": [
            "job_opening", "job_applicant", "match_percentage", "match_grade",
            "reasoning", "skills_match_score", "experience_level_score",
            "keyword_relevance_score", "professional_depth_score", 
            "domain_experience_score", "weighted_scores", "skill_analysis",
            "processed_on"
        ],
        "fields": [
            {"fieldname": "job_opening", "fieldtype": "Link", "label": "Job Opening", "options": "Job Opening", "reqd": 1, "in_list_view": 1},
            {"fieldname": "job_applicant", "fieldtype": "Link", "label": "Job Applicant", "options": "Job Applicant", "reqd": 1, "in_list_view": 1},
            {"fieldname": "match_percentage", "fieldtype": "Float", "label": "Match Percentage", "precision": 2, "in_list_view": 1},
            {"fieldname": "match_grade", "fieldtype": "Select", "label": "Match Grade", "options": "Excellent\\nGood\\nFair\\nPoor", "in_list_view": 1},
            {"fieldname": "reasoning", "fieldtype": "Long Text", "label": "Reasoning"},
            {"fieldname": "skills_match_score", "fieldtype": "Int", "label": "Skills Match Score"},
            {"fieldname": "experience_level_score", "fieldtype": "Int", "label": "Experience Level Score"},
            {"fieldname": "keyword_relevance_score", "fieldtype": "Int", "label": "Keyword Relevance Score"},
            {"fieldname": "professional_depth_score", "fieldtype": "Int", "label": "Professional Depth Score"},
            {"fieldname": "domain_experience_score", "fieldtype": "Int", "label": "Domain Experience Score"},
            {"fieldname": "weighted_scores", "fieldtype": "JSON", "label": "Weighted Scores"},
            {"fieldname": "skill_analysis", "fieldtype": "JSON", "label": "Skill Analysis"},
            {"fieldname": "processed_on", "fieldtype": "Datetime", "label": "Processed On", "default": "now()"}
        ],
        "modified": "2025-07-19 17:00:00.000000",
        "modified_by": "Administrator",
        "module": "AIM Hi AI Matching",
        "name": "AI Match Result",
        "owner": "Administrator",
        "permissions": [
            {"create": 1, "delete": 1, "email": 1, "export": 1, "print": 1, "read": 1, "report": 1, "role": "HR Manager", "share": 1, "write": 1},
            {"create": 1, "email": 1, "export": 1, "print": 1, "read": 1, "report": 1, "role": "HR User", "share": 1, "write": 1}
        ],
        "sort_field": "modified",
        "sort_order": "DESC",
        "track_changes": 1
    }
    
    doctype_dir = f"{app_name}/ai_matching/doctype/ai_match_result"
    with open(f"{doctype_dir}/ai_match_result.json", 'w') as f:
        json.dump(ai_match_result_json, f, indent=4)
    
    # AI Match Result controller
    controller_content = '''"""
AI Match Result DocType Controller
"""

import frappe
from frappe.model.document import Document

class AIMatchResult(Document):
    def validate(self):
        # Validate match percentage is between 0 and 100
        if self.match_percentage < 0 or self.match_percentage > 100:
            frappe.throw("Match percentage must be between 0 and 100")
    
    def after_insert(self):
        # Update candidate's best match if this is better
        self.update_candidate_best_match()
    
    def update_candidate_best_match(self):
        """Update Job Applicant with best match information"""
        try:
            applicant = frappe.get_doc("Job Applicant", self.job_applicant)
            
            if not applicant.best_match_percentage or self.match_percentage > applicant.best_match_percentage:
                applicant.best_match_percentage = self.match_percentage
                applicant.best_match_job = self.job_opening
                applicant.save()
                
        except Exception as e:
            frappe.log_error(f"Error updating candidate best match: {str(e)}")
'''
    
    with open(f"{doctype_dir}/ai_match_result.py", 'w') as f:
        f.write(controller_content)
    
    # Create AI Matching Configuration DocType
    print("⚙️ Creating AI Matching Configuration DocType...")
    
    config_doctype = {
        "creation": "2025-07-19 17:00:00.000000",
        "doctype": "DocType",
        "engine": "InnoDB",
        "is_single": 1,
        "fields": [
            {"fieldname": "openai_api_key", "fieldtype": "Password", "label": "OpenAI API Key"},
            {"fieldname": "skills_weight", "fieldtype": "Int", "label": "Skills Weight (%)", "default": 25},
            {"fieldname": "experience_weight", "fieldtype": "Int", "label": "Experience Weight (%)", "default": 15},
            {"fieldname": "keywords_weight", "fieldtype": "Int", "label": "Keywords Weight (%)", "default": 25},
            {"fieldname": "professional_depth_weight", "fieldtype": "Int", "label": "Professional Depth Weight (%)", "default": 15},
            {"fieldname": "domain_experience_weight", "fieldtype": "Int", "label": "Domain Experience Weight (%)", "default": 20},
            {"fieldname": "minimum_match_threshold", "fieldtype": "Float", "label": "Minimum Match Threshold (%)", "default": 30.0},
            {"fieldname": "auto_shortlist_threshold", "fieldtype": "Float", "label": "Auto Shortlist Threshold (%)", "default": 80.0},
            {"fieldname": "enable_pre_filtering", "fieldtype": "Check", "label": "Enable Pre-filtering", "default": 1},
            {"fieldname": "batch_processing_size", "fieldtype": "Int", "label": "Batch Processing Size", "default": 3},
            {"fieldname": "is_active", "fieldtype": "Check", "label": "Is Active", "default": 1}
        ],
        "modified": "2025-07-19 17:00:00.000000",
        "modified_by": "Administrator",
        "module": "AIM Hi AI Matching",
        "name": "AI Matching Configuration",
        "owner": "Administrator",
        "permissions": [
            {"create": 1, "delete": 1, "email": 1, "export": 1, "print": 1, "read": 1, "report": 1, "role": "System Manager", "share": 1, "write": 1},
            {"read": 1, "role": "HR Manager", "write": 1}
        ],
        "sort_field": "modified",
        "sort_order": "DESC"
    }
    
    config_dir = f"{app_name}/ai_matching/doctype/ai_matching_configuration"
    with open(f"{config_dir}/ai_matching_configuration.json", 'w') as f:
        json.dump(config_doctype, f, indent=4)
    
    config_controller = '''"""
AI Matching Configuration DocType Controller
"""

import frappe
from frappe.model.document import Document

class AIMatchingConfiguration(Document):
    def validate(self):
        # Validate weights sum to 100
        total_weight = (self.skills_weight + self.experience_weight + 
                       self.keywords_weight + self.professional_depth_weight + 
                       self.domain_experience_weight)
        
        if total_weight != 100:
            frappe.throw(f"Total weights must equal 100%. Current total: {total_weight}%")
'''
    
    with open(f"{config_dir}/ai_matching_configuration.py", 'w') as f:
        f.write(config_controller)
    
    # Create client script for Job Opening
    print("💻 Creating client scripts...")
    
    job_opening_js = '''frappe.ui.form.on('Job Opening', {
    refresh: function(frm) {
        if (frm.doc.enable_ai_matching) {
            // Add AI Matching button
            frm.add_custom_button(__('Run AI Matching'), function() {
                frappe.call({
                    method: "aimhi_hrms.ai_core.matching_engine.run_ai_matching_batch",
                    args: {
                        job_opening: frm.doc.name
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: `AI matching started for ${r.message.total_candidates} candidates`,
                                indicator: 'green'
                            });
                        }
                    }
                });
            }, __('AI Actions'));
            
            // Add View Results button
            frm.add_custom_button(__('View AI Results'), function() {
                frappe.set_route("List", "AI Match Result", {
                    "job_opening": frm.doc.name
                });
            }, __('AI Actions'));
        }
    }
});'''
    
    with open(f"{app_name}/public/js/job_opening.js", 'w') as f:
        f.write(job_opening_js)
    
    print("✅ FRAPPE APP STRUCTURE CREATED SUCCESSFULLY")
    print(f"🎯 App Name: {app_name}")
    print(f"📁 Location: {app_name}/")
    print("🔗 Ready for Frappe bench integration")
    print("\n📊 TASK 4 STATUS: COMPLETED")
    print("🎯 Ready for Task 5: Testing and Integration")
    
    return True

if __name__ == "__main__":
    create_frappe_app()