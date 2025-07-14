import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql } from "drizzle-orm";
import { jobs, candidates, jobMatches, interviews, jobTemplates } from "@shared/schema";
import type { IStorage } from "./storage";
import type { InsertJob, Job, InsertCandidate, Candidate, InsertJobMatch, JobMatch, JobMatchResult, InsertInterview, Interview, InterviewWithDetails, InsertJobTemplate, JobTemplate } from "@shared/schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log("✅ Using PostgreSQL database for persistent storage");
  }

  // Job operations
  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  // Candidate operations
  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const [candidate] = await db.insert(candidates).values(insertCandidate).returning();
    return candidate;
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate;
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidates).orderBy(desc(candidates.createdAt));
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.email, email));
    return candidate;
  }

  // Job match operations
  async createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch> {
    const [match] = await db.insert(jobMatches).values(insertMatch).returning();
    return match;
  }

  async getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    let query = db
      .select({
        id: jobMatches.id,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        matchPercentage: jobMatches.matchPercentage,
        aiReasoning: jobMatches.aiReasoning,
        createdAt: jobMatches.createdAt,
        job: jobs,
        candidate: candidates,
      })
      .from(jobMatches)
      .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id));

    const results = await query;
    
    let filteredResults = results.filter(result => result.job && result.candidate);
    
    if (jobId !== undefined) {
      filteredResults = filteredResults.filter(result => result.jobId === jobId);
    }
    
    if (minPercentage !== undefined) {
      filteredResults = filteredResults.filter(result => result.matchPercentage >= minPercentage);
    }

    // Sort by match percentage (highest first)
    filteredResults.sort((a, b) => b.matchPercentage - a.matchPercentage);

    return filteredResults.map(result => ({
      id: result.id,
      jobId: result.jobId,
      candidateId: result.candidateId,
      matchPercentage: result.matchPercentage,
      aiReasoning: result.aiReasoning,
      createdAt: result.createdAt,
      job: result.job!,
      candidate: result.candidate!,
    }));
  }

  async deleteJobMatchesByJobId(jobId: number): Promise<void> {
    await db.delete(jobMatches).where(eq(jobMatches.jobId, jobId));
  }

  async clearAllMatches(): Promise<void> {
    console.log("Clearing all matches from database...");
    // Get count before deletion
    const beforeCount = await db.select().from(jobMatches);
    console.log("Matches before deletion:", beforeCount.length);
    
    // Delete all matches using a simple approach
    const allMatches = await db.select().from(jobMatches);
    for (const match of allMatches) {
      await db.delete(jobMatches).where(eq(jobMatches.id, match.id));
    }
    
    // Verify deletion
    const afterCount = await db.select().from(jobMatches);
    console.log("Matches after deletion:", afterCount.length);
  }

  async deleteAllJobs(): Promise<void> {
    // First clear all related matches and interviews
    await db.delete(jobMatches);
    await db.delete(interviews);
    // Then delete all jobs
    await db.delete(jobs);
  }

  async deleteAllCandidates(): Promise<void> {
    // First clear all related matches and interviews
    await db.delete(jobMatches);
    await db.delete(interviews);
    // Then delete all candidates
    await db.delete(candidates);
  }

  // Interview operations
  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    const [interview] = await db.insert(interviews).values(insertInterview).returning();
    return interview;
  }

  async getInterview(id: number): Promise<Interview | undefined> {
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    return interview;
  }

  async getAllInterviews(): Promise<InterviewWithDetails[]> {
    const results = await db
      .select({
        id: interviews.id,
        jobId: interviews.jobId,
        candidateId: interviews.candidateId,
        matchId: interviews.matchId,
        scheduledDateTime: interviews.scheduledDateTime,
        duration: interviews.duration,
        interviewType: interviews.interviewType,
        status: interviews.status,
        meetingLink: interviews.meetingLink,
        notes: interviews.notes,
        interviewerName: interviews.interviewerName,
        interviewerEmail: interviews.interviewerEmail,
        reminderSent: interviews.reminderSent,
        createdAt: interviews.createdAt,
        updatedAt: interviews.updatedAt,
        job: jobs,
        candidate: candidates,
        match: jobMatches,
      })
      .from(interviews)
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobMatches, eq(interviews.matchId, jobMatches.id))
      .orderBy(desc(interviews.scheduledDateTime));

    return results
      .filter(result => result.job && result.candidate)
      .map(result => ({
        id: result.id,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchId: result.matchId,
        scheduledDateTime: result.scheduledDateTime,
        duration: result.duration,
        interviewType: result.interviewType,
        status: result.status,
        meetingLink: result.meetingLink,
        notes: result.notes,
        interviewerName: result.interviewerName,
        interviewerEmail: result.interviewerEmail,
        reminderSent: result.reminderSent,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        job: result.job!,
        candidate: result.candidate!,
        match: result.match || undefined,
      }));
  }

  async getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]> {
    const results = await db
      .select({
        id: interviews.id,
        jobId: interviews.jobId,
        candidateId: interviews.candidateId,
        matchId: interviews.matchId,
        scheduledDateTime: interviews.scheduledDateTime,
        duration: interviews.duration,
        interviewType: interviews.interviewType,
        status: interviews.status,
        meetingLink: interviews.meetingLink,
        notes: interviews.notes,
        interviewerName: interviews.interviewerName,
        interviewerEmail: interviews.interviewerEmail,
        reminderSent: interviews.reminderSent,
        createdAt: interviews.createdAt,
        updatedAt: interviews.updatedAt,
        job: jobs,
        candidate: candidates,
        match: jobMatches,
      })
      .from(interviews)
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobMatches, eq(interviews.matchId, jobMatches.id))
      .where(eq(interviews.candidateId, candidateId))
      .orderBy(desc(interviews.scheduledDateTime));

    return results
      .filter(result => result.job && result.candidate)
      .map(result => ({
        id: result.id,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchId: result.matchId,
        scheduledDateTime: result.scheduledDateTime,
        duration: result.duration,
        interviewType: result.interviewType,
        status: result.status,
        meetingLink: result.meetingLink,
        notes: result.notes,
        interviewerName: result.interviewerName,
        interviewerEmail: result.interviewerEmail,
        reminderSent: result.reminderSent,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        job: result.job!,
        candidate: result.candidate!,
        match: result.match || undefined,
      }));
  }

  async getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]> {
    const results = await db
      .select({
        id: interviews.id,
        jobId: interviews.jobId,
        candidateId: interviews.candidateId,
        matchId: interviews.matchId,
        scheduledDateTime: interviews.scheduledDateTime,
        duration: interviews.duration,
        interviewType: interviews.interviewType,
        status: interviews.status,
        meetingLink: interviews.meetingLink,
        notes: interviews.notes,
        interviewerName: interviews.interviewerName,
        interviewerEmail: interviews.interviewerEmail,
        reminderSent: interviews.reminderSent,
        createdAt: interviews.createdAt,
        updatedAt: interviews.updatedAt,
        job: jobs,
        candidate: candidates,
        match: jobMatches,
      })
      .from(interviews)
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobMatches, eq(interviews.matchId, jobMatches.id))
      .where(eq(interviews.jobId, jobId))
      .orderBy(desc(interviews.scheduledDateTime));

    return results
      .filter(result => result.job && result.candidate)
      .map(result => ({
        id: result.id,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchId: result.matchId,
        scheduledDateTime: result.scheduledDateTime,
        duration: result.duration,
        interviewType: result.interviewType,
        status: result.status,
        meetingLink: result.meetingLink,
        notes: result.notes,
        interviewerName: result.interviewerName,
        interviewerEmail: result.interviewerEmail,
        reminderSent: result.reminderSent,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        job: result.job!,
        candidate: result.candidate!,
        match: result.match || undefined,
      }));
  }

  async updateInterviewStatus(id: number, status: string): Promise<void> {
    await db
      .update(interviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(interviews.id, id));
  }

  async deleteInterview(id: number): Promise<void> {
    await db.delete(interviews).where(eq(interviews.id, id));
  }

  // Job Template operations
  async createJobTemplate(insertJobTemplate: InsertJobTemplate): Promise<JobTemplate> {
    const [template] = await db.insert(jobTemplates).values(insertJobTemplate).returning();
    return template;
  }

  async getJobTemplate(jobId: number): Promise<JobTemplate | undefined> {
    const [template] = await db.select().from(jobTemplates).where(eq(jobTemplates.jobId, jobId));
    return template;
  }

  async updateJobTemplate(jobId: number, updates: Partial<JobTemplate>): Promise<JobTemplate | undefined> {
    const [template] = await db.update(jobTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobTemplates.jobId, jobId))
      .returning();
    return template;
  }

  async deleteJobTemplate(jobId: number): Promise<void> {
    await db.delete(jobTemplates).where(eq(jobTemplates.jobId, jobId));
  }
}