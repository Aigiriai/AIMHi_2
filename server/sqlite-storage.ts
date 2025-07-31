import { initializeSQLiteDatabase } from './init-database';

// Type definitions for SQLite storage
interface Job {
  id: number;
  title: string;
  description: string;
  requirements?: string;
  experience_level: string;
  job_type: string;
  keywords: string;
  location?: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

interface InsertJob {
  title: string;
  description: string;
  requirements?: string;
  experience_level: string;
  job_type: string;
  keywords: string;
  location?: string;
  organization_id: number;
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  experience: number;
  resume_content: string;
  resume_file_name: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

interface InsertCandidate {
  name: string;
  email: string;
  phone: string;
  experience: number;
  resume_content: string;
  resume_file_name: string;
  organization_id: number;
}

interface JobMatch {
  id: number;
  job_id: number;
  candidate_id: number;
  match_percentage: number;
  ai_reasoning?: string;
  organization_id: number;
  created_at: string;
}

interface InsertJobMatch {
  job_id: number;
  candidate_id: number;
  match_percentage: number;
  ai_reasoning?: string;
  organization_id: number;
}

interface Interview {
  id: number;
  job_id: number;
  candidate_id: number;
  scheduled_at: string;
  status: string;
  notes?: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

interface InsertInterview {
  job_id: number;
  candidate_id: number;
  scheduled_at: string;
  status: string;
  notes?: string;
  organization_id: number;
}

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: number;
  is_active: boolean;
  permissions?: string;
  created_at: string;
  updated_at: string;
}

interface InsertUser {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: number;
  is_active?: boolean;
  permissions?: string;
}

interface Organization {
  id: number;
  name: string;
  domain?: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InsertOrganization {
  name: string;
  domain?: string;
  plan: string;
  status?: string;
}

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



export class SQLiteStorage implements IStorage {
  private sqlite: any;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      this.sqlite = await initializeSQLiteDatabase();
    } catch (error) {
      console.error('Failed to initialize SQLite connection:', error);
    }
  }

  private async ensureConnection() {
    if (!this.db) {
      await this.initializeConnection();
    }
  }

  // Jobs
  async createJob(insertJob: InsertJob): Promise<Job> {
    await this.ensureConnection();
    console.log('Creating job with data:', insertJob);
    
    try {
      // Use raw SQL to insert job directly
      const stmt = this.sqlite.prepare(`
        INSERT INTO jobs (
          organization_id, team_id, created_by, title, description, 
          experience_level, job_type, requirements, location, salary_min, salary_max,
          keywords, status, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        insertJob.organizationId,
        insertJob.teamId || null,
        insertJob.createdBy,
        insertJob.title,
        insertJob.description,
        insertJob.experienceLevel,
        insertJob.jobType,
        insertJob.requirements || 'Requirements not specified',
        insertJob.location || 'Location not specified',
        insertJob.salaryMin || null,
        insertJob.salaryMax || null,
        insertJob.keywords,
        insertJob.status || 'active',
        '{}' // settings as JSON string
      );
      
      // Fetch the created job
      const job = this.sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
      console.log('Job created successfully:', job);
      return job;
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  async getJob(id: number): Promise<Job | undefined> {
    await this.ensureConnection();
    const [job] = await this.db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    await this.ensureConnection();
    console.log('Fetching all jobs from database...');
    
    try {
      // First check if there are any jobs at all
      const count = this.sqlite.prepare('SELECT COUNT(*) as count FROM jobs').get();
      console.log('Total jobs in database:', count);
      
      // Use raw SQL to fetch jobs
      const jobs = this.sqlite.prepare(`
        SELECT id, organization_id as organizationId, team_id as teamId, created_by as createdBy,
               title, description, experience_level as experienceLevel, job_type as jobType,
               keywords, status, settings, created_at as createdAt, updated_at as updatedAt
        FROM jobs 
        ORDER BY created_at DESC
      `).all();
      
      console.log('Retrieved jobs:', jobs.length);
      return jobs;
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
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

  async getCandidatesByOrganization(organizationId: number): Promise<Candidate[]> {
    await this.ensureConnection();
    return await this.db.select().from(schema.candidates).where(eq(schema.candidates.organizationId, organizationId)).orderBy(desc(schema.candidates.createdAt));
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
    
    return results.map((result: any) => {
      let skillAnalysis = null;
      let criteriaScores = null;
      let weightedScores = null;
      
      try {
        if (result.matchCriteria && result.matchCriteria !== '{}') {
          const parsedCriteria = JSON.parse(result.matchCriteria);
          skillAnalysis = parsedCriteria.skillAnalysis;
          criteriaScores = parsedCriteria.criteriaScores;
          weightedScores = parsedCriteria.weightedScores;
        }
      } catch (e) {
        console.error('Error parsing matchCriteria:', e);
      }
      
      return {
        id: result.id,
        organizationId: result.organizationId,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchPercentage: result.matchPercentage,
        status: result.status,
        aiReasoning: result.aiReasoning,
        matchCriteria: result.matchCriteria,
        skillAnalysis,
        criteriaScores,
        weightedScores,
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

  async getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    await this.ensureConnection();
    console.log('getJobMatchesByOrganization called with:', { organizationId, jobId, minPercentage });
    
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

    let whereConditions = [eq(schema.jobMatches.organizationId, organizationId)];

    if (jobId) {
      whereConditions.push(eq(schema.jobMatches.jobId, jobId));
    }

    if (minPercentage) {
      whereConditions.push(gte(schema.jobMatches.matchPercentage, minPercentage));
    }

    query = query.where(and(...whereConditions));

    const results = await query.orderBy(desc(schema.jobMatches.matchPercentage));
    
    return results.map((result: any) => {
      let skillAnalysis = null;
      let criteriaScores = null;
      let weightedScores = null;
      
      try {
        if (result.matchCriteria && result.matchCriteria !== '{}') {
          console.log('Parsing matchCriteria:', result.matchCriteria.substring(0, 100));
          const parsedCriteria = JSON.parse(result.matchCriteria);
          skillAnalysis = parsedCriteria.skillAnalysis;
          criteriaScores = parsedCriteria.criteriaScores;
          weightedScores = parsedCriteria.weightedScores;
          console.log('Successfully parsed skill analysis:', skillAnalysis ? 'Yes' : 'No');
        }
      } catch (e) {
        console.error('Error parsing matchCriteria:', e);
      }
      
      return {
        id: result.id,
        organizationId: result.organizationId,
        jobId: result.jobId,
        candidateId: result.candidateId,
        matchPercentage: result.matchPercentage,
        status: result.status,
        aiReasoning: result.aiReasoning,
        matchCriteria: result.matchCriteria,
        skillAnalysis,
        criteriaScores,
        weightedScores,
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
      };
    });
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
    return [];
  }

  async getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    return [];
  }

  async getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    return [];
  }

  async updateInterviewStatus(id: number, status: string): Promise<void> {
    await this.ensureConnection();
    await this.db.update(schema.interviews).set({ status }).where(eq(schema.interviews.id, id));
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
    await this.db.update(schema.users).set(updates).where(eq(schema.users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }

  // Organizations
  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    await this.ensureConnection();
    const [org] = await this.db.insert(schema.organizations).values(insertOrg).returning();
    return org;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    await this.ensureConnection();
    const [org] = await this.db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return org;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    await this.ensureConnection();
    const [org] = await this.db.select().from(schema.organizations).where(eq(schema.organizations.name, name));
    return org;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    await this.ensureConnection();
    return await this.db.select().from(schema.organizations).orderBy(desc(schema.organizations.createdAt));
  }

  async deleteOrganization(id: number): Promise<void> {
    await this.ensureConnection();
    await this.db.delete(schema.organizations).where(eq(schema.organizations.id, id));
  }

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