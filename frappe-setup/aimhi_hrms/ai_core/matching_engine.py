"""
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
        return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', content.lower())).strip()
    
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
