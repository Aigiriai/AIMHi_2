#!/usr/bin/env python3
"""
AIM Hi AI Matching Engine - Python Version
Converted from TypeScript for Frappe HRMS integration

This module provides the core AI matching capabilities from AIM Hi system,
converted to Python for integration with Frappe HRMS platform.
"""

import asyncio
import json
import hashlib
import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Union
import openai
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
class MatchWeights:
    """Configurable weights for matching criteria (totals 100%)"""
    skills: int = 25
    experience: int = 15
    keywords: int = 25
    professionalDepth: int = 15
    domainExperience: int = 20

@dataclass
class SkillAnalysis:
    """Analysis breakdown for each criteria"""
    skillsHas: List[str]
    skillsMissing: List[str]
    criteriaExplanation: str

@dataclass
class DetailedMatchResult:
    """Comprehensive matching result with detailed analysis"""
    candidateId: int
    matchPercentage: float
    reasoning: str
    criteriaScores: MatchCriteria
    weightedScores: MatchCriteria
    skillAnalysis: Dict[str, SkillAnalysis]

class AIMHiMatchingEngine:
    """Core AI matching engine ported from AIM Hi TypeScript implementation"""
    
    def __init__(self, openai_api_key: str):
        """Initialize the matching engine with OpenAI credentials"""
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.default_weights = MatchWeights()
        
    def normalize_resume_content(self, content: str) -> str:
        """Normalize resume content for consistent analysis"""
        return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', content.lower())).strip()
    
    def generate_content_hash(self, job_description: str, resume_content: str) -> int:
        """Generate deterministic hash for consistent AI seeding"""
        combined = self.normalize_resume_content(job_description + resume_content)
        hash_obj = hashlib.md5(combined.encode())
        return int(hash_obj.hexdigest()[:8], 16)
    
    async def extract_critical_requirements(self, job_description: str, keywords: str = "") -> List[str]:
        """Extract critical requirements using AI (GPT-3.5-turbo)"""
        try:
            combined = job_description + (f" {keywords}" if keywords else "")
            
            prompt = f"""
Analyze the following job description and extract the critical requirements, skills, and qualifications explicitly mentioned as essential for this role.

Job Description: {combined}

Extract requirements in these categories:
1. ESSENTIAL SKILLS - Specific skills, competencies, or abilities explicitly mentioned as required
2. REQUIRED QUALIFICATIONS - Degrees, certifications, licenses, or credentials that are mandatory
3. CRITICAL TOOLS/EQUIPMENT - Specific tools, software, equipment, or systems that must be used
4. MANDATORY EXPERIENCE - Specific types of experience, processes, or methodologies required
5. ESSENTIAL KNOWLEDGE - Domain-specific knowledge, procedures, or expertise areas
6. REQUIRED CAPABILITIES - Physical, mental, or professional capabilities needed

Rules:
- Only extract requirements that are clearly REQUIRED, ESSENTIAL, or MANDATORY
- Include exact terms, names, and phrases from the job description
- Focus on specific, measurable requirements rather than generic terms
- Include professional terminology and industry-specific language
- Avoid inferring or adding requirements not explicitly stated
- Limit to maximum 30 total requirements for focused matching

Respond with a JSON object:
{{
  "essential_requirements": ["requirement1", "requirement2", "requirement3"],
  "all_critical_requirements": ["combined list of all essential requirements"]
}}

Example for a nursing position:
{{
  "essential_requirements": ["RN License", "CPR Certification", "IV Therapy", "Electronic Health Records", "Patient Assessment"],
  "all_critical_requirements": ["RN License", "CPR Certification", "IV Therapy", "Electronic Health Records", "Patient Assessment"]
}}
"""

            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=500,
                temperature=0.0
            )
            
            content = response.choices[0].message.content
            if not content:
                return []
                
            result = json.loads(content)
            
            # Handle different response formats
            requirements = []
            if result.get("all_critical_requirements") and isinstance(result["all_critical_requirements"], list):
                requirements = result["all_critical_requirements"]
            elif result.get("essential_requirements") and isinstance(result["essential_requirements"], list):
                requirements = result["essential_requirements"]
            elif result.get("requirements") and isinstance(result["requirements"], list):
                requirements = result["requirements"]
            elif isinstance(result, list):
                requirements = result
                
            # Filter and normalize
            filtered_requirements = [
                req.strip().upper() 
                for req in requirements 
                if req and isinstance(req, str) and len(req) > 1
            ][:30]  # Limit to 30 requirements
            
            print(f"Extracted critical requirements: {filtered_requirements}")
            return filtered_requirements
            
        except Exception as e:
            print(f"Error extracting critical requirements: {e}")
            return self.extract_fallback_requirements(job_description, keywords)
    
    def extract_fallback_requirements(self, job_description: str, keywords: str = "") -> List[str]:
        """Fallback regex-based requirements extraction"""
        combined = f"{job_description} {keywords}".lower()
        
        # Generic requirement patterns that work across all professions
        patterns = [
            r'required:?\s*([^.]+)',
            r'must have:?\s*([^.]+)',
            r'essential:?\s*([^.]+)',
            r'mandatory:?\s*([^.]+)',
            r'minimum:?\s*([^.]+)',
            r'qualification:?\s*([^.]+)',
            r'license:?\s*([^.]+)',
            r'certification:?\s*([^.]+)',
            r'degree:?\s*([^.]+)',
            r'experience:?\s*([^.]+)'
        ]
        
        found_requirements = []
        for pattern in patterns:
            matches = re.findall(pattern, combined, re.IGNORECASE)
            for match in matches:
                requirement = re.sub(
                    r'^(required|must have|essential|mandatory|minimum|qualification|license|certification|degree|experience):?\s*',
                    '', match.strip(), flags=re.IGNORECASE
                )
                if len(requirement) > 2:
                    found_requirements.append(requirement.upper())
        
        return found_requirements[:20]  # Limit to 20 requirements
    
    async def match_candidate_to_job(
        self, 
        job_data: Dict,  # Job information from Frappe HRMS
        candidate_data: Dict,  # Candidate information from Frappe HRMS  
        weights: Optional[MatchWeights] = None
    ) -> DetailedMatchResult:
        """
        Main matching function - matches candidate to job using AI analysis
        
        Args:
            job_data: Dictionary with job details (title, description, experience_level, etc.)
            candidate_data: Dictionary with candidate details (name, resume_content, experience, etc.)
            weights: Optional custom weights for criteria
        
        Returns:
            DetailedMatchResult with comprehensive matching analysis
        """
        try:
            # Use default weights if not provided
            final_weights = weights or self.default_weights
            
            # Extract data from dictionaries
            job_title = job_data.get("designation", "")
            job_description = job_data.get("description", "")
            job_experience = job_data.get("experience", "")
            job_keywords = job_data.get("job_profile", "")
            
            candidate_id = candidate_data.get("name", 0)  # Frappe uses 'name' as ID
            candidate_name = candidate_data.get("applicant_name", "")
            resume_content = candidate_data.get("resume_text", "")
            candidate_experience = candidate_data.get("experience", 0)
            
            # Generate consistent seed for deterministic results
            content_seed = self.generate_content_hash(job_description, resume_content)
            
            # Extract critical requirements
            critical_requirements = await self.extract_critical_requirements(job_description, job_keywords)
            has_critical_req = len(critical_requirements) > 0
            
            # Pre-filter: Check if candidate has ANY critical requirements
            if has_critical_req:
                normalized_resume = resume_content.lower()
                found_req_count = sum(1 for req in critical_requirements if req.lower() in normalized_resume)
                
                if found_req_count == 0:
                    print(f"Pre-filter rejection: Candidate {candidate_name} has no critical requirements")
                    return self._create_low_score_result(candidate_id, critical_requirements)
                    
                print(f"Pre-filter passed: Candidate {candidate_name} has {found_req_count}/{len(critical_requirements)} critical requirements")
            
            # Create detailed AI analysis prompt
            prompt = self._create_matching_prompt(
                job_title, job_description, job_experience, job_keywords,
                candidate_name, candidate_experience, resume_content,
                final_weights, critical_requirements, has_critical_req
            )
            
            # Call OpenAI with timeout protection
            try:
                response = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        max_tokens=2500,
                        temperature=0.0,
                        seed=content_seed
                    ),
                    timeout=30.0
                )
            except asyncio.TimeoutError:
                raise Exception("OpenAI API timeout")
            
            # Parse response
            content = response.choices[0].message.content
            if not content:
                raise Exception("Empty response from OpenAI")
                
            result = json.loads(content)
            
            # Extract criteria scores
            criteria_scores = MatchCriteria(
                skillsMatch=result.get("criteriaScores", {}).get("skillsMatch", 0),
                experienceLevel=result.get("criteriaScores", {}).get("experienceLevel", 0),
                keywordRelevance=result.get("criteriaScores", {}).get("keywordRelevance", 0),
                professionalDepth=result.get("criteriaScores", {}).get("professionalDepth", 0),
                domainExperience=result.get("criteriaScores", {}).get("domainExperience", 0)
            )
            
            # Calculate weighted scores
            weighted_scores = MatchCriteria(
                skillsMatch=criteria_scores.skillsMatch * final_weights.skills / 100,
                experienceLevel=criteria_scores.experienceLevel * final_weights.experience / 100,
                keywordRelevance=criteria_scores.keywordRelevance * final_weights.keywords / 100,
                professionalDepth=criteria_scores.professionalDepth * final_weights.professionalDepth / 100,
                domainExperience=criteria_scores.domainExperience * final_weights.domainExperience / 100
            )
            
            # Calculate final match percentage using mathematical weighted sum
            final_match_percentage = sum([
                weighted_scores.skillsMatch,
                weighted_scores.experienceLevel, 
                weighted_scores.keywordRelevance,
                weighted_scores.professionalDepth,
                weighted_scores.domainExperience
            ])
            
            # Create skill analysis
            skill_analysis = self._create_skill_analysis(result.get("skillBreakdown", {}), result.get("scoreExplanations", {}))
            
            # Build enhanced reasoning
            detailed_reasoning = result.get("detailedReasoning", "No detailed reasoning provided")
            enhanced_reasoning = f"{detailed_reasoning}\n\nMatch Calculation: {final_match_percentage:.1f}% (Weighted Sum)"
            
            return DetailedMatchResult(
                candidateId=candidate_id,
                matchPercentage=max(0, min(100, final_match_percentage)),
                reasoning=enhanced_reasoning,
                criteriaScores=criteria_scores,
                weightedScores=weighted_scores,
                skillAnalysis=skill_analysis
            )
            
        except Exception as e:
            print(f"Error in AI matching for candidate {candidate_data.get('applicant_name', 'Unknown')}: {e}")
            return self._create_error_result(candidate_data.get("name", 0), str(e))
    
    def _create_low_score_result(self, candidate_id: int, critical_requirements: List[str]) -> DetailedMatchResult:
        """Create low-score result for pre-filter rejection"""
        default_scores = MatchCriteria(
            skillsMatch=5, experienceLevel=5, keywordRelevance=5, 
            professionalDepth=5, domainExperience=5
        )
        weighted_scores = MatchCriteria(
            skillsMatch=1.25, experienceLevel=0.75, keywordRelevance=1.25,
            professionalDepth=0.75, domainExperience=1.0
        )
        
        return DetailedMatchResult(
            candidateId=candidate_id,
            matchPercentage=5,
            reasoning=f"Pre-screening failed: No critical requirements found in resume. Required qualifications: {', '.join(critical_requirements)}. This candidate's background does not align with the essential requirements for this role.",
            criteriaScores=default_scores,
            weightedScores=weighted_scores,
            skillAnalysis=self._create_empty_skill_analysis()
        )
    
    def _create_error_result(self, candidate_id: int, error_msg: str) -> DetailedMatchResult:
        """Create error result for exception handling"""
        default_scores = MatchCriteria(
            skillsMatch=0, experienceLevel=0, keywordRelevance=0,
            professionalDepth=0, domainExperience=0
        )
        
        return DetailedMatchResult(
            candidateId=candidate_id,
            matchPercentage=0,
            reasoning=f"Error occurred during advanced matching analysis: {error_msg}",
            criteriaScores=default_scores,
            weightedScores=default_scores,
            skillAnalysis=self._create_empty_skill_analysis()
        )
    
    def _create_skill_analysis(self, skill_breakdown: Dict, score_explanations: Dict) -> Dict[str, SkillAnalysis]:
        """Create skill analysis from OpenAI response"""
        criteria_names = ["skillsMatch", "experienceLevel", "keywordRelevance", "professionalDepth", "domainExperience"]
        skill_analysis = {}
        
        for criteria in criteria_names:
            breakdown = skill_breakdown.get(criteria, {})
            skill_analysis[criteria] = SkillAnalysis(
                skillsHas=breakdown.get("has", []),
                skillsMissing=breakdown.get("missing", []),
                criteriaExplanation=score_explanations.get(criteria, "No explanation available")
            )
        
        return skill_analysis
    
    def _create_empty_skill_analysis(self) -> Dict[str, SkillAnalysis]:
        """Create empty skill analysis for error cases"""
        empty_analysis = SkillAnalysis(
            skillsHas=[],
            skillsMissing=[],
            criteriaExplanation="Error occurred during analysis"
        )
        
        return {
            "skillsMatch": empty_analysis,
            "experienceLevel": empty_analysis, 
            "keywordRelevance": empty_analysis,
            "professionalDepth": empty_analysis,
            "domainExperience": empty_analysis
        }
    
    def _create_matching_prompt(self, job_title: str, job_description: str, job_experience: str, 
                               job_keywords: str, candidate_name: str, candidate_experience: int,
                               resume_content: str, weights: MatchWeights, critical_requirements: List[str],
                               has_critical_req: bool) -> str:
        """Create the detailed AI matching prompt"""
        
        critical_req_section = ""
        if has_critical_req:
            critical_req_section = f"""
CRITICAL REQUIREMENTS DETECTED: {', '.join(critical_requirements)}
NOTE: This job has specific requirements that are essential for success in this role. Candidates without direct experience with these requirements should receive appropriately adjusted scores.
"""
        
        return f"""
You are an expert HR AI assistant that analyzes job requirements and candidate profiles with advanced multi-criteria matching, focusing on accurate skill assessment and experience recency analysis across all professions.

Job Position: {job_title}
Job Description: {job_description}
Required Experience Level: {job_experience}
Keywords: {job_keywords}

{critical_req_section}

Candidate Profile:
Name: {candidate_name}
Experience: {candidate_experience} years  
Resume Content: {resume_content}

ANALYSIS CRITERIA (Rate each from 0-100):

1. SKILLS MATCH (Weight: {weights.skills}%):
   - Required competencies alignment with job requirements
   - Tools, equipment, software, or methodologies match
   - Professional skills and certifications
   - Domain-specific abilities and knowledge
   - IMPORTANT: In skillBreakdown.skillsMatch, list specific skills the candidate HAS vs MISSING

2. EXPERIENCE LEVEL (Weight: {weights.experience}%):
   - Years of experience vs requirements
   - Seniority level appropriateness
   - Career progression alignment
   - Leadership and responsibility level match

3. KEYWORD RELEVANCE & RECENCY (Weight: {weights.keywords}%):
   - Job keywords present in resume
   - CRITICAL: Parse employment dates accurately - "Present", "Current", "Till Date" means ONGOING work
   - Employment periods like "Aug 2024 - Present" or "April 2019 - Present" = CURRENT work (100% relevance)
   - Experience from 2023-Present = Very Recent (100% relevance)
   - Experience from 2020-2022 = Recent (80% relevance)
   - Experience from 2017-2019 = Somewhat Recent (60% relevance)
   - Experience from 2014-2016 = Less Recent (40% relevance)
   - Experience older than 2014 = Not Recent (20% relevance)
   - Continuous employment in relevant field from past to present = Maximum recency score
   - Professional terminology usage and field-specific language

4. PROFESSIONAL DEPTH vs BREADTH (Weight: {weights.professionalDepth}%):
   - Specialist vs generalist assessment
   - Deep expertise in specific domains vs broad knowledge
   - Advanced professional competencies
   - Mastery level of core skills and methodologies

5. DOMAIN/FIELD EXPERIENCE (Weight: {weights.domainExperience}%):
   - Direct experience with specific requirements mentioned in job description
   - Relevant industry, sector, or field background
   - Similar work environment and project complexity
   - Methodology, process, and system familiarity

CONSISTENCY REQUIREMENTS:
- Use exact numeric scoring (avoid ranges like "75-80")
- Identical resume content must produce identical scores
- Base scores on quantifiable metrics rather than subjective interpretation
- Focus on exact matches and demonstrated experience

Respond in JSON format with:
{{
  "criteriaScores": {{
    "skillsMatch": number,
    "experienceLevel": number,
    "keywordRelevance": number,
    "professionalDepth": number,
    "domainExperience": number
  }},
  "detailedReasoning": "comprehensive explanation including experience recency analysis",
  "scoreExplanations": {{
    "skillsMatch": "Why this specific score for skills alignment",
    "experienceLevel": "Why this specific score for experience match",
    "keywordRelevance": "Why this specific score for keyword/recency match", 
    "professionalDepth": "Why this specific score for professional depth",
    "domainExperience": "Why this specific score for domain experience"
  }},
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendations": "hiring recommendation with focus on experience currency",
  "skillBreakdown": {{
    "skillsMatch": {{
      "has": ["specific skills/competencies candidate possesses"],
      "missing": ["specific skills/competencies candidate lacks"]
    }},
    "experienceLevel": {{
      "has": ["experience levels/types candidate has"],
      "missing": ["experience gaps candidate has"]
    }},
    "keywordRelevance": {{
      "has": ["job keywords found in candidate resume"],
      "missing": ["job keywords not found in candidate resume"]
    }},
    "professionalDepth": {{
      "has": ["areas of deep expertise candidate shows"],
      "missing": ["areas where candidate needs deeper expertise"]
    }},
    "domainExperience": {{
      "has": ["relevant industry/domain experience candidate has"],
      "missing": ["industry/domain experience candidate lacks"]
    }}
  }}
}}

CRITICAL INSTRUCTIONS FOR SKILL BREAKDOWN:
- For each criteria, provide specific, actionable items in "has" and "missing" arrays
- "has" should contain actual skills/experience found in the candidate's resume
- "missing" should contain specific requirements from the job that the candidate doesn't have
- Be specific rather than generic (e.g., "React.js" not "frontend skills")
- Include at least 2-5 items in each "has" and "missing" array when possible
"""

# Example usage and testing functions
async def test_matching_engine():
    """Test function to validate the matching engine"""
    # This would be used for testing the engine with sample data
    pass

if __name__ == "__main__":
    # Test the engine
    asyncio.run(test_matching_engine())