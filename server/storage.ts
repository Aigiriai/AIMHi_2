import type { InsertJob, Job, InsertCandidate, Candidate, InsertJobMatch, JobMatch, JobMatchResult, InsertInterview, Interview, InterviewWithDetails } from "@shared/schema";

export interface IStorage {
  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  
  // Candidate operations
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  getAllCandidates(): Promise<Candidate[]>;
  getCandidatesByOrganization(organizationId: number): Promise<Candidate[]>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  
  // Job match operations
  createJobMatch(match: InsertJobMatch): Promise<JobMatch>;
  getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  deleteJobMatchesByJobId(jobId: number): Promise<void>;
  clearAllMatches(): Promise<void>;
  
  // Bulk delete operations
  deleteAllJobs(): Promise<void>;
  deleteAllCandidates(): Promise<void>;
  
  // Interview operations
  createInterview(interview: InsertInterview): Promise<Interview>;
  getInterview(id: number): Promise<Interview | undefined>;
  getAllInterviews(): Promise<InterviewWithDetails[]>;
  getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]>;
  getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]>;
  updateInterviewStatus(id: number, status: string): Promise<void>;
  deleteInterview(id: number): Promise<void>;
}

import { DatabaseStorage } from "./database-storage";

export const storage = new DatabaseStorage();