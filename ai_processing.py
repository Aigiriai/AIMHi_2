import os
import base64
from openai import OpenAI
from models import ExtractedResumeData
from typing import Dict, Any
import json

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def extract_resume_data_from_image(image_bytes: bytes) -> ExtractedResumeData:
    """Extract resume information from image using OpenAI Vision API"""
    try:
        # Convert bytes to base64
        base64_image = base64.b64encode(image_bytes).decode('utf-8')

        response = client.chat.completions.create(
            model="gpt-4o",  # the newest OpenAI model is "gpt-4o" which was released May 13, 2024
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert resume parser. Analyze the resume image and extract key information. 
                    Return the data in JSON format with these exact fields:
                    - name: Full name of the candidate
                    - email: Email address 
                    - phone: Phone number (include country code if visible)
                    - experience: Number of years of total work experience (as a number)
                    - resume_content: A comprehensive summary of the resume including skills, education, work history, and achievements
                    
                    If any field is not clearly visible or missing, use reasonable defaults:
                    - name: "Unknown Candidate"
                    - email: "no-email@provided.com"
                    - phone: "No phone provided"
                    - experience: 0
                    - resume_content: should always contain what you can see in the image"""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Please extract the resume information from this image and return it in the specified JSON format."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ],
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(response.choices[0].message.content or "{}")
        
        return ExtractedResumeData(
            name=result.get("name", "Unknown Candidate"),
            email=result.get("email", "no-email@provided.com"),
            phone=result.get("phone", "No phone provided"),
            experience=max(0, int(result.get("experience", 0))),
            resume_content=result.get("resume_content", "Resume content could not be extracted from image")
        )
    except Exception as e:
        raise Exception(f"Failed to process resume image: {str(e)}")


class MatchResult:
    def __init__(self, candidate_id: int, match_percentage: float, reasoning: str):
        self.candidate_id = candidate_id
        self.match_percentage = match_percentage
        self.reasoning = reasoning


async def match_candidate_to_job(job: Dict[str, Any], candidate: Dict[str, Any]) -> MatchResult:
    """Match a single candidate to a job using AI"""
    try:
        prompt = f"""
You are an expert HR AI assistant that analyzes job requirements and candidate profiles to determine compatibility, with special emphasis on keyword recency and skill currency.

Job Details:
- Title: {job['title']}
- Description: {job['description']}
- Experience Level: {job['experience_level']}
- Job Type: {job['job_type']}
- Keywords: {job['keywords']}

Candidate Profile:
- Name: {candidate['name']}
- Experience: {candidate['experience']} years
- Resume Content: {candidate['resume_content']}

Please analyze the compatibility between this job and candidate. Consider:
1. Skills alignment with job requirements
2. Experience level match
3. KEYWORD RECENCY AND CURRENCY (CRITICAL):
   - How recently has the candidate worked with the required skills/keywords?
   - Skills used 0-2 years ago: Full credit
   - Skills used 3-5 years ago: 70% credit
   - Skills used 6-8 years ago: 40% credit
   - Skills used 8+ years ago: 20% credit or lower
   - Heavily penalize outdated technologies and stale skills
4. Relevant background and expertise
5. Overall fit for the role with emphasis on current skill relevance

IMPORTANT: A candidate who mentions React but last used it 8 years ago should score much lower than someone who used React recently, even if both have it on their resume.

Return your analysis in JSON format with:
- matchPercentage: A number between 0-100 representing the match quality (heavily weighted by skill recency)
- reasoning: A detailed explanation including specific analysis of skill recency and currency

Be objective and thorough, with special attention to how current vs outdated the candidate's skills are.
"""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Cost-optimized model with increased token allowance
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert HR AI assistant. Analyze job-candidate compatibility and respond with JSON containing matchPercentage (0-100) and reasoning (detailed explanation)."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=2500,  # Increased tokens for detailed analysis with cheaper model
            temperature=0.3,
        )

        result = json.loads(response.choices[0].message.content or "{}")
        
        return MatchResult(
            candidate_id=candidate['id'],
            match_percentage=max(0, min(100, float(result.get('matchPercentage', 0)))),
            reasoning=result.get('reasoning', 'Unable to generate analysis')
        )
    except Exception as e:
        return MatchResult(
            candidate_id=candidate['id'],
            match_percentage=0,
            reasoning=f"Error during AI analysis: {str(e)}"
        )


async def batch_match_candidates(job: Dict[str, Any], candidates: list) -> list:
    """Match multiple candidates to a job"""
    results = []
    
    for candidate in candidates:
        try:
            result = await match_candidate_to_job(job, candidate.model_dump())
            results.append(result)
            
            # Small delay to be respectful to API rate limits
            import asyncio
            await asyncio.sleep(0.1)
        except Exception as e:
            print(f"Error matching candidate {candidate.id}: {e}")
            results.append(MatchResult(
                candidate_id=candidate.id,
                match_percentage=0,
                reasoning="Error during processing"
            ))
    
    return results