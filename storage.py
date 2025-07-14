from typing import Dict, List, Optional
from datetime import datetime
from models import Job, JobCreate, Candidate, CandidateCreate, JobMatch, JobMatchCreate, JobMatchResult

class MemoryStorage:
    def __init__(self):
        self.jobs: Dict[int, Job] = {}
        self.candidates: Dict[int, Candidate] = {}
        self.job_matches: Dict[int, JobMatch] = {}
        self.current_job_id = 1
        self.current_candidate_id = 1
        self.current_match_id = 1

    # Job operations
    def create_job(self, job_data: JobCreate) -> Job:
        job = Job(
            id=self.current_job_id,
            created_at=datetime.now(),
            **job_data.model_dump()
        )
        self.jobs[self.current_job_id] = job
        self.current_job_id += 1
        return job

    def get_job(self, job_id: int) -> Optional[Job]:
        return self.jobs.get(job_id)

    def get_all_jobs(self) -> List[Job]:
        return list(self.jobs.values())

    # Candidate operations
    def create_candidate(self, candidate_data: CandidateCreate) -> Candidate:
        candidate = Candidate(
            id=self.current_candidate_id,
            created_at=datetime.now(),
            **candidate_data.model_dump()
        )
        self.candidates[self.current_candidate_id] = candidate
        self.current_candidate_id += 1
        return candidate

    def get_candidate(self, candidate_id: int) -> Optional[Candidate]:
        return self.candidates.get(candidate_id)

    def get_all_candidates(self) -> List[Candidate]:
        return list(self.candidates.values())

    def get_candidate_by_email(self, email: str) -> Optional[Candidate]:
        for candidate in self.candidates.values():
            if candidate.email == email:
                return candidate
        return None

    # Job match operations
    def create_job_match(self, match_data: JobMatchCreate) -> JobMatch:
        match = JobMatch(
            id=self.current_match_id,
            created_at=datetime.now(),
            **match_data.model_dump()
        )
        self.job_matches[self.current_match_id] = match
        self.current_match_id += 1
        return match

    def get_job_matches(self, job_id: Optional[int] = None, min_percentage: Optional[float] = None) -> List[JobMatchResult]:
        matches = list(self.job_matches.values())
        
        if job_id is not None:
            matches = [m for m in matches if m.job_id == job_id]
        
        if min_percentage is not None:
            matches = [m for m in matches if m.match_percentage >= min_percentage]

        # Sort by match percentage descending
        matches.sort(key=lambda x: x.match_percentage, reverse=True)

        # Join with job and candidate data
        results = []
        for match in matches:
            job = self.jobs.get(match.job_id)
            candidate = self.candidates.get(match.candidate_id)
            
            if job and candidate:
                results.append(JobMatchResult(
                    **match.model_dump(),
                    job=job,
                    candidate=candidate
                ))

        return results

    def delete_job_matches_by_job_id(self, job_id: int) -> None:
        matches_to_delete = [
            match_id for match_id, match in self.job_matches.items()
            if match.job_id == job_id
        ]
        
        for match_id in matches_to_delete:
            del self.job_matches[match_id]

# Global storage instance
storage = MemoryStorage()