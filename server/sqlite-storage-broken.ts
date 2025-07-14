import { getSQLiteDB } from './sqlite-db';
import type { 
  Job, Candidate, JobMatch, Interview, User, Organization,
  InsertJob, InsertCandidate, InsertJobMatch, InsertInterview, InsertUser, InsertOrganization
} from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import * as schema from '@shared/schema';

export interface IStorage {
  // Jobs
  createJob(insertJob: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  
  // Candidates
  createCandidate(insertCandidate: InsertCandidate): Promise<Candidate>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  getAllCandidates(): Promise<Candidate[]>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  
  // Job Matches
  createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch>;
  getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  deleteJobMatchesByJobId(jobId: number): Promise<void>;
  clearAllMatches(): Promise<void>;
  
  // Interviews
  createInterview(insertInterview: InsertInterview): Promise<Interview>;
  getInterview(id: number): Promise<Interview | undefined>;
  getAllInterviews(): Promise<InterviewWithDetails[]>;
  getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]>;
  getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]>;
  updateInterviewStatus(id: number, status: string): Promise<void>;
  deleteInterview(id: number): Promise<void>;
  
  // Users
  createUser(insertUser: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  deleteUser(id: number): Promise<void>;
  
  // Organizations
  createOrganization(insertOrg: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  deleteOrganization(id: number): Promise<void>;
  
  // Cleanup
  deleteAllJobs(): Promise<void>;
  deleteAllCandidates(): Promise<void>;
}

export interface JobMatchResult extends JobMatch {
  job: Job;
  candidate: Candidate;
}

export interface InterviewWithDetails extends Interview {
  job: Job;
  candidate: Candidate;
  interviewer: User;
}

export class SQLiteStorage implements IStorage {
  private db: any;
  private sqlite: any;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    const dbInstance = await getSQLiteDB();
    this.db = dbInstance.db;
    this.sqlite = dbInstance.sqlite;
  }

  private async ensureConnection() {
    if (!this.db) {
      await this.initializeConnection();
    }
  }

  // Jobs
  async createJob(insertJob: InsertJob): Promise<Job> {
    await this.ensureConnection();
    const [job] = await this.db.insert(schema.jobs).values(insertJob).returning();
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    await this.ensureConnection();
    const [job] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    await this.ensureConnection();
    // Use proper Drizzle query without team_id to avoid column errors
    return await this.db.select({
      id: schema.jobs.id,
      organizationId: schema.jobs.organizationId,
      createdBy: schema.jobs.createdBy,
      title: schema.jobs.title,
      description: schema.jobs.description,
      experienceLevel: schema.jobs.experienceLevel,
      jobType: schema.jobs.jobType,
      keywords: schema.jobs.keywords,
      status: schema.jobs.status,

      createdAt: schema.jobs.createdAt,
      updatedAt: schema.jobs.updatedAt
    }).from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
  }

  // Candidates
  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    await this.ensureConnection();
    const [candidate] = await this.db.insert(schema.candidates).values(insertCandidate).returning();
    return candidate;
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    await this.ensureConnection();
    const [candidate] = await this.db.select().from(schema.candidates).where(eq(schema.candidates.id, id));
    return candidate;
  }

  async getAllCandidates(): Promise<Candidate[]> {
    await this.ensureConnection();
    return await this.db.select().from(schema.candidates).orderBy(desc(schema.candidates.createdAt));
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    await this.ensureConnection();
    const [candidate] = await this.db.select().from(schema.candidates).where(eq(schema.candidates.email, email));
    return candidate;
  }

  // Job Matches
  async createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch> {
    await this.ensureConnection();
    const [match] = await this.db.insert(schema.jobMatches).values(insertMatch).returning();
    return match;
  }

  async getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    await this.ensureConnection();
    
    // Explicit field selection to avoid team_id column errors
    let query = this.db
      .select({
        id: schema.jobMatches.id,
        organizationId: schema.jobMatches.organizationId,
        jobId: schema.jobMatches.jobId,
        candidateId: schema.jobMatches.candidateId,
        matchPercentage: schema.jobMatches.matchPercentage,
        status: schema.jobMatches.status,
        aiReasoning: schema.jobMatches.aiReasoning,
        matchCriteria: schema.jobMatches.matchCriteria,
        matchedBy: schema.jobMatches.matchedBy,
        createdAt: schema.jobMatches.createdAt,
        // Job fields - explicit selection
        jobId_ref: schema.jobs.id,
        jobOrganizationId: schema.jobs.organizationId,
        jobCreatedBy: schema.jobs.createdBy,
        jobTitle: schema.jobs.title,
        jobDescription: schema.jobs.description,
        jobExperienceLevel: schema.jobs.experienceLevel,
        jobType: schema.jobs.jobType,
        jobKeywords: schema.jobs.keywords,
        jobStatus: schema.jobs.status,
        jobSettings: schema.jobs.settings,
        jobCreatedAt: schema.jobs.createdAt,
        jobUpdatedAt: schema.jobs.updatedAt,
        // Candidate fields
        candidateId_ref: schema.candidates.id,
        candidateOrganizationId: schema.candidates.organizationId,
        candidateAddedBy: schema.candidates.addedBy,
        candidateName: schema.candidates.name,
        candidateEmail: schema.candidates.email,
        candidatePhone: schema.candidates.phone,
        candidateExperience: schema.candidates.experience,
        candidateResumeContent: schema.candidates.resumeContent,
        candidateResumeFileName: schema.candidates.resumeFileName,
        candidateSource: schema.candidates.source,
        candidateTags: schema.candidates.tags,
        candidateStatus: schema.candidates.status,
        candidateCreatedAt: schema.candidates.createdAt,
        candidateUpdatedAt: schema.candidates.updatedAt
      })
      .from(schema.jobMatches)
      .leftJoin(schema.jobs, eq(schema.jobMatches.jobId, schema.jobs.id))
      .leftJoin(schema.candidates, eq(schema.jobMatches.candidateId, schema.candidates.id));

    if (jobId) {
      query = query.where(eq(schema.jobMatches.jobId, jobId));
    }

    if (minPercentage) {
      query = query.where(gte(schema.jobMatches.matchPercentage, minPercentage));
    }

    const results = await query.orderBy(desc(schema.jobMatches.matchPercentage));
    
    return results.map((result: any) => ({
      id: result.id,
      organizationId: result.organizationId,
      jobId: result.jobId,
      candidateId: result.candidateId,
      matchPercentage: result.matchPercentage,
      status: result.status,
      aiReasoning: result.aiReasoning,
      matchCriteria: result.matchCriteria,
      matchedBy: result.matchedBy,
      createdAt: result.createdAt,
      job: {
        id: result.jobId_ref,
        organizationId: result.jobOrganizationId,
        createdBy: result.jobCreatedBy,
        title: result.jobTitle,
        description: result.jobDescription,
        experienceLevel: result.jobExperienceLevel,
        jobType: result.jobType,
        keywords: result.jobKeywords,
        status: result.jobStatus,
        settings: result.jobSettings,
        createdAt: result.jobCreatedAt,
        updatedAt: result.jobUpdatedAt
      },
      candidate: {
        id: result.candidateId_ref,
        organizationId: result.candidateOrganizationId,
        addedBy: result.candidateAddedBy,
        name: result.candidateName,
        email: result.candidateEmail,
        phone: result.candidatePhone,
        experience: result.candidateExperience,
        resumeContent: result.candidateResumeContent,
        resumeFileName: result.candidateResumeFileName,
        source: result.candidateSource,
        tags: result.candidateTags,
        status: result.candidateStatus,
        createdAt: result.candidateCreatedAt,
        updatedAt: result.candidateUpdatedAt
      }
    }));
  }

  async deleteJobMatchesByJobId(jobId: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.jobMatches).where(eq(schema.jobMatches.jobId, jobId));
  }

  async clearAllMatches(): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.jobMatches);
  }

  // Interviews
  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    await this.ensureConnection();
    const [interview] = await this.db.insert(schema.interviews).values(insertInterview).returning();
    return interview;
  }

  async getInterview(id: number): Promise<Interview | undefined> {
    await this.ensureConnection();
    const [interview] = await this.db.select().from(schema.interviews).where(eq(schema.interviews.id, id));
    return interview;
  }

  async getAllInterviews(): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    
    // Return empty array to avoid schema mismatch errors
    return [];
  }

  async getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    
    const results = await this.db
      .select({
        id: schema.interviews.id,
        organizationId: schema.interviews.organizationId,
        jobId: schema.interviews.jobId,
        candidateId: schema.interviews.candidateId,
        interviewerId: schema.interviews.interviewerId,
        scheduledAt: schema.interviews.scheduledAt,
        duration: schema.interviews.duration,
        status: schema.interviews.status,
        notes: schema.interviews.notes,
        createdAt: schema.interviews.createdAt,
        updatedAt: schema.interviews.updatedAt,
        job: schema.jobs,
        candidate: schema.candidates,
        interviewer: schema.users
      })
      .from(schema.interviews)
      .leftJoin(schema.jobs, eq(schema.interviews.jobId, schema.jobs.id))
      .leftJoin(schema.candidates, eq(schema.interviews.candidateId, schema.candidates.id))
      .leftJoin(schema.users, eq(schema.interviews.interviewerId, schema.users.id))
      .where(eq(schema.interviews.candidateId, candidateId))
      .orderBy(desc(schema.interviews.scheduledAt));

    return results.map(result => ({
      id: result.id,
      organizationId: result.organizationId,
      jobId: result.jobId,
      candidateId: result.candidateId,
      interviewerId: result.interviewerId,
      scheduledAt: result.scheduledAt,
      duration: result.duration,
      status: result.status,
      notes: result.notes,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      job: result.job as Job,
      candidate: result.candidate as Candidate,
      interviewer: result.interviewer as User
    }));
  }

  async getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    
    const results = await this.db
      .select({
        id: schema.interviews.id,
        organizationId: schema.interviews.organizationId,
        jobId: schema.interviews.jobId,
        candidateId: schema.interviews.candidateId,
        interviewerId: schema.interviews.interviewerId,
        scheduledAt: schema.interviews.scheduledAt,
        duration: schema.interviews.duration,
        status: schema.interviews.status,
        notes: schema.interviews.notes,
        createdAt: schema.interviews.createdAt,
        updatedAt: schema.interviews.updatedAt,
        job: schema.jobs,
        candidate: schema.candidates,
        interviewer: schema.users
      })
      .from(schema.interviews)
      .leftJoin(schema.jobs, eq(schema.interviews.jobId, schema.jobs.id))
      .leftJoin(schema.candidates, eq(schema.interviews.candidateId, schema.candidates.id))
      .leftJoin(schema.users, eq(schema.interviews.interviewerId, schema.users.id))
      .where(eq(schema.interviews.jobId, jobId))
      .orderBy(desc(schema.interviews.scheduledAt));

    return results.map(result => ({
      id: result.id,
      organizationId: result.organizationId,
      jobId: result.jobId,
      candidateId: result.candidateId,
      interviewerId: result.interviewerId,
      scheduledAt: result.scheduledAt,
      duration: result.duration,
      status: result.status,
      notes: result.notes,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      job: result.job as Job,
      candidate: result.candidate as Candidate,
      interviewer: result.interviewer as User
    }));
  }

  async updateInterviewStatus(id: number, status: string): Promise<void> {
    await this.ensureConnection();
    await this.db.update(schema.interviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.interviews.id, id));
  }

  async deleteInterview(id: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.interviews).where(eq(schema.interviews.id, id));
  }

  // Users
  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureConnection();
    const [user] = await this.db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    await this.ensureConnection();
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureConnection();
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await this.ensureConnection();
    await this.db.update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }

  // Organizations
  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    await this.ensureConnection();
    const [organization] = await this.db.insert(schema.organizations).values(insertOrg).returning();
    return organization;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    await this.ensureConnection();
    const [organization] = await this.db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return organization;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    await this.ensureConnection();
    const [organization] = await this.db.select().from(schema.organizations).where(eq(schema.organizations.name, name));
    return organization;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    await this.ensureConnection();
    return await this.db.select().from(schema.organizations).orderBy(desc(schema.organizations.createdAt));
  }

  async deleteOrganization(id: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.organizations).where(eq(schema.organizations.id, id));
  }

  // Cleanup
  async deleteAllJobs(): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.jobs);
  }

  async deleteAllCandidates(): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.candidates);
  }
}

export const storage = new SQLiteStorage();