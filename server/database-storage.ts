import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql, and, gte } from "drizzle-orm";
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

  async getCandidatesByOrganization(organizationId: number): Promise<Candidate[]> {
    return await db.select().from(candidates).where(eq(candidates.organizationId, organizationId)).orderBy(desc(candidates.createdAt));
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
    console.log('❌ FALLBACK: getJobMatches called - this should NOT be called!');
    let query = db
      .select({
        id: jobMatches.id,
        organizationId: jobMatches.organizationId,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        matchedBy: jobMatches.matchedBy,
        matchPercentage: jobMatches.matchPercentage,
        aiReasoning: jobMatches.aiReasoning,
        matchCriteria: jobMatches.matchCriteria,
        status: jobMatches.status,
        createdAt: jobMatches.createdAt,
        updatedAt: jobMatches.updatedAt,
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

    return filteredResults.map(result => {
      // Parse skill analysis from matchCriteria
      let skillAnalysis = null;
      let criteriaScores = null;
      let weightedScores = null;
      
      if (result.matchCriteria && result.matchCriteria !== '{}') {
        try {
          console.log('🔍 PARSING: matchCriteria exists:', !!result.matchCriteria);
          const parsedCriteria = JSON.parse(result.matchCriteria);
          console.log('🔍 PARSING: parsed successfully, has skillAnalysis:', !!parsedCriteria.skillAnalysis);
          skillAnalysis = parsedCriteria.skillAnalysis;
          criteriaScores = parsedCriteria.criteriaScores;
          weightedScores = parsedCriteria.weightedScores;
        } catch (e) {
          console.error('Error parsing matchCriteria:', e);
        }
      } else {
        console.log('🔍 PARSING: No matchCriteria found or is empty');
      }
      
      return {
        id: result.id,
        organizationId: result.organizationId,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchedBy: result.matchedBy,
        matchPercentage: result.matchPercentage,
        aiReasoning: result.aiReasoning,
        matchCriteria: result.matchCriteria,
        skillAnalysis,
        criteriaScores,
        weightedScores,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        job: result.job!,
        candidate: result.candidate!,
      };
    });
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

  async getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    console.log('🚀🚀🚀 DATABASE-STORAGE getJobMatchesByOrganization ENTRY POINT called with:', { organizationId, jobId, minPercentage });
    console.log('🚀🚀🚀 DATABASE-STORAGE: Starting query execution...');
    
    let whereConditions = [eq(jobMatches.organizationId, organizationId)];

    if (jobId !== undefined) {
      whereConditions.push(eq(jobMatches.jobId, jobId));
    }

    if (minPercentage !== undefined) {
      whereConditions.push(gte(jobMatches.matchPercentage, minPercentage));
    }

    const results = await db
      .select({
        id: jobMatches.id,
        organizationId: jobMatches.organizationId,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        matchedBy: jobMatches.matchedBy,
        matchPercentage: jobMatches.matchPercentage,
        aiReasoning: jobMatches.aiReasoning,
        matchCriteria: jobMatches.matchCriteria,
        status: jobMatches.status,
        createdAt: jobMatches.createdAt,
        updatedAt: jobMatches.updatedAt,
        job: jobs,
        candidate: candidates,
      })
      .from(jobMatches)
      .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
      .where(and(...whereConditions))
      .orderBy(desc(jobMatches.matchPercentage));

    console.log('Raw results count:', results.length);
    if (results.length > 0) {
      console.log('First result sample:', {
        id: results[0].id,
        matchCriteria: results[0].matchCriteria ? results[0].matchCriteria.substring(0, 100) : 'null'
      });
    }
    
    const mappedResults = results.map((result: any) => {
      console.log('🔍 PROCESSING result:', result.id, 'matchCriteria type:', typeof result.matchCriteria);
      
      let skillAnalysis = null;
      let criteriaScores = null;
      let weightedScores = null;
      
      if (result.matchCriteria && result.matchCriteria !== '{}') {
        try {
          const parsedCriteria = JSON.parse(result.matchCriteria);
          skillAnalysis = parsedCriteria.skillAnalysis;
          criteriaScores = parsedCriteria.criteriaScores;
          weightedScores = parsedCriteria.weightedScores;
          console.log('🔍 PARSING: ID', result.id, '- skillAnalysis:', skillAnalysis ? 'OBJECT' : 'NULL');
        } catch (e) {
          console.error('Error parsing matchCriteria for result:', result.id, e);
        }
      } else {
        console.log('🔍 PARSING: ID', result.id, '- NO matchCriteria to parse');
      }
      
      return {
        id: result.id,
        organizationId: result.organizationId,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchedBy: result.matchedBy,
        matchPercentage: result.matchPercentage,
        aiReasoning: result.aiReasoning,
        matchCriteria: result.matchCriteria,
        skillAnalysis,
        criteriaScores,
        weightedScores,
        status: result.status,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        job: result.job!,
        candidate: result.candidate!,
      };
    });
    
    return mappedResults;
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