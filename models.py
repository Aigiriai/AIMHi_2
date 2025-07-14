from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Job Models
class JobBase(BaseModel):
    title: str
    description: str
    experience_level: str
    job_type: str
    keywords: str

class JobCreate(JobBase):
    pass

class Job(JobBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Candidate Models
class CandidateBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    experience: int
    resume_content: str
    resume_file_name: str

class CandidateCreate(CandidateBase):
    pass

class Candidate(CandidateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Job Match Models
class JobMatchBase(BaseModel):
    job_id: int
    candidate_id: int
    match_percentage: float
    ai_reasoning: Optional[str] = None

class JobMatchCreate(JobMatchBase):
    pass

class JobMatch(JobMatchBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class JobMatchResult(JobMatch):
    job: Job
    candidate: Candidate

# AI Matching Request
class AIMatchRequest(BaseModel):
    min_match_percentage: Optional[float] = 50
    additional_keywords: Optional[str] = None

# Stats Response
class StatsResponse(BaseModel):
    active_jobs: int
    total_candidates: int
    ai_matches: int
    avg_match_rate: int

# Extracted Resume Data
class ExtractedResumeData(BaseModel):
    name: str
    email: str
    phone: str
    experience: int
    resume_content: str