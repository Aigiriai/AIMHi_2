import { initializeSQLiteDatabase } from './init-database';

// Type definitions for raw SQLite storage (no drizzle ORM)
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
  status?: string;
  original_file_name?: string;
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
  status?: string;
  original_file_name?: string;
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
  status?: string;
  assigned_to?: number;
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
  status?: string;
  assigned_to?: number;
}

interface JobMatch {
  id: number;
  job_id: number;
  candidate_id: number;
  match_percentage: number;
  ai_reasoning?: string;
  organization_id: number;
  matched_by?: number;
  created_at: string;
}

interface InsertJobMatch {
  job_id: number;
  candidate_id: number;
  match_percentage: number;
  ai_reasoning?: string;
  organization_id: number;
  matched_by?: number;
}

interface Interview {
  id: number;
  job_id: number;
  candidate_id: number;
  scheduled_at: string;
  status: string;
  notes?: string;
  organization_id: number;
  interviewer_id?: number;
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
  interviewer_id?: number;
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

interface JobTemplate {
  id: number;
  title: string;
  description: string;
  organization_id: number;
  created_at: string;
}

interface InsertJobTemplate {
  title: string;
  description: string;
  organization_id: number;
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

export interface IStorage {
  // Jobs
  createJob(insertJob: InsertJob): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getJobsByOrganization(organizationId: number): Promise<Job[]>;
  
  // Candidates
  createCandidate(insertCandidate: InsertCandidate): Promise<Candidate>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  getAllCandidates(): Promise<Candidate[]>;
  getCandidatesByOrganization(organizationId: number): Promise<Candidate[]>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  updateCandidate(id: number, updates: Partial<Candidate>): Promise<void>;
  
  // Job Matches
  createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch>;
  getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  getJobMatchesByUser(userId: number, organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  getJobMatchesForUserRole(userId: number, userRole: string, organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]>;
  deleteJobMatchesByJobId(jobId: number): Promise<void>;
  clearAllMatches(): Promise<void>;
  clearMatchesByUser(userId: number, organizationId: number): Promise<void>;
  
  // Interviews
  createInterview(insertInterview: InsertInterview): Promise<Interview>;
  getInterview(id: number): Promise<Interview | undefined>;
  getAllInterviews(): Promise<InterviewWithDetails[]>;
  getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]>;
  getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]>;
  getInterviewsByOrganization(organizationId: number): Promise<InterviewWithDetails[]>;
  updateInterviewStatus(id: number, status: string): Promise<void>;
  deleteInterview(id: number): Promise<void>;
  
  // Users
  createUser(insertUser: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByOrganization(organizationId: number): Promise<User[]>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  deleteUser(id: number): Promise<void>;
  
  // Organizations
  createOrganization(insertOrg: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  deleteOrganization(id: number): Promise<void>;
  
  // Job Templates
  createJobTemplate(insertJobTemplate: InsertJobTemplate): Promise<JobTemplate>;
  getJobTemplate(jobId: number): Promise<JobTemplate | undefined>;
  updateJobTemplate(jobId: number, updates: Partial<JobTemplate>): Promise<JobTemplate | undefined>;
  deleteJobTemplate(jobId: number): Promise<void>;
  
  // Cleanup
  deleteAllJobs(): Promise<void>;
  deleteAllCandidates(): Promise<void>;
}

// Simplified raw SQL storage implementation
export class SQLiteStorageSimple implements IStorage {
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
    if (!this.sqlite) {
      await this.initializeConnection();
    }
    return this.sqlite;
  }

  // Job operations
  async createJob(insertJob: InsertJob): Promise<Job> {
    const sqlite = await this.ensureConnection();
    
    // Properties are now correctly mapped through sqlite-schema validation
    
    const result = sqlite.prepare(`
      INSERT INTO jobs (
        title, description, requirements, experience_level, job_type, 
        keywords, location, organization_id, status, original_file_name,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertJob.title,
      insertJob.description,
      insertJob.requirements || '',
      insertJob.experienceLevel || (insertJob as any).experience_level,
      insertJob.jobType || (insertJob as any).job_type,
      insertJob.keywords,
      insertJob.location || '',
      insertJob.organizationId || (insertJob as any).organization_id,
      insertJob.status || 'active',
      insertJob.originalFileName || (insertJob as any).original_file_name || '',
      insertJob.createdBy || (insertJob as any).created_by,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    return sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid) as Job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined;
  }

  async getAllJobs(): Promise<Job[]> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as Job[];
  }

  async getJobsByOrganization(organizationId: number): Promise<Job[]> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM jobs WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId) as Job[];
  }

  // Candidate operations
  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const sqlite = await this.ensureConnection();
    const result = sqlite.prepare(`
      INSERT INTO candidates (
        name, email, phone, experience, resume_content, resume_file_name,
        organization_id, added_by, status, assigned_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertCandidate.name,
      insertCandidate.email,
      insertCandidate.phone,
      insertCandidate.experience,
      insertCandidate.resumeContent || insertCandidate.resume_content,
      insertCandidate.resumeFileName || insertCandidate.resume_file_name,
      insertCandidate.organizationId || insertCandidate.organization_id,
      insertCandidate.addedBy || insertCandidate.added_by,
      insertCandidate.status || 'active',
      insertCandidate.assignedTo || insertCandidate.assigned_to || null,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    return sqlite.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid) as Candidate;
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as Candidate | undefined;
  }

  async getAllCandidates(): Promise<Candidate[]> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM candidates ORDER BY created_at DESC').all() as Candidate[];
  }

  async getCandidatesByOrganization(organizationId: number): Promise<Candidate[]> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM candidates WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId) as Candidate[];
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM candidates WHERE email = ?').get(email) as Candidate | undefined;
  }

  async updateCandidate(id: number, updates: Partial<Candidate>): Promise<void> {
    const sqlite = await this.ensureConnection();
    const updateFields = [];
    const updateValues = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(id);
      
      sqlite.prepare(`UPDATE candidates SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    }
  }

  // Job matching operations
  async createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch> {
    const sqlite = await this.ensureConnection();
    const result = sqlite.prepare(`
      INSERT INTO job_matches (
        job_id, candidate_id, match_percentage, match_criteria, 
        matched_by, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertMatch.jobId,
      insertMatch.candidateId,
      insertMatch.matchPercentage,
      typeof insertMatch.matchCriteria === 'string' ? insertMatch.matchCriteria : JSON.stringify(insertMatch.matchCriteria),
      insertMatch.matchedBy,
      insertMatch.organizationId,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    return sqlite.prepare('SELECT * FROM job_matches WHERE id = ?').get(result.lastInsertRowid) as JobMatch;
  }

  async getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    const sqlite = await this.ensureConnection();
    let query = `
      SELECT jm.*, j.title as job_title, j.description as job_description,
             c.name as candidate_name, c.email as candidate_email
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (jobId) {
      query += ' AND jm.job_id = ?';
      params.push(jobId);
    }
    if (minPercentage !== undefined) {
      query += ' AND jm.match_percentage >= ?';
      params.push(minPercentage);
    }
    
    query += ' ORDER BY jm.match_percentage DESC, jm.created_at DESC';
    
    const matches = sqlite.prepare(query).all(...params);
    return matches.map((match: any) => ({
      ...match,
      job: { id: match.job_id, title: match.job_title, description: match.job_description },
      candidate: { id: match.candidate_id, name: match.candidate_name, email: match.candidate_email }
    }));
  }

  async getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    const sqlite = await this.ensureConnection();
    let query = `
      SELECT jm.*, j.title as job_title, j.description as job_description,
             c.name as candidate_name, c.email as candidate_email
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE jm.organization_id = ?
    `;
    const params: any[] = [organizationId];
    
    if (jobId) {
      query += ' AND jm.job_id = ?';
      params.push(jobId);
    }
    if (minPercentage !== undefined) {
      query += ' AND jm.match_percentage >= ?';
      params.push(minPercentage);
    }
    
    query += ' ORDER BY jm.match_percentage DESC, jm.created_at DESC';
    
    const matches = sqlite.prepare(query).all(...params);
    return matches.map((match: any) => ({
      ...match,
      job: { id: match.job_id, title: match.job_title, description: match.job_description },
      candidate: { id: match.candidate_id, name: match.candidate_name, email: match.candidate_email }
    }));
  }

  async getJobMatchesByUser(userId: number, organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    const sqlite = await this.ensureConnection();
    let query = `
      SELECT jm.*, j.title as job_title, j.description as job_description,
             c.name as candidate_name, c.email as candidate_email
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE jm.matched_by = ? AND jm.organization_id = ?
    `;
    const params: any[] = [userId, organizationId];
    
    if (jobId) {
      query += ' AND jm.job_id = ?';
      params.push(jobId);
    }
    if (minPercentage !== undefined) {
      query += ' AND jm.match_percentage >= ?';
      params.push(minPercentage);
    }
    
    query += ' ORDER BY jm.match_percentage DESC, jm.created_at DESC';
    
    const matches = sqlite.prepare(query).all(...params);
    return matches.map((match: any) => ({
      ...match,
      job: { id: match.job_id, title: match.job_title, description: match.job_description },
      candidate: { id: match.candidate_id, name: match.candidate_name, email: match.candidate_email }
    }));
  }

  async getJobMatchesForUserRole(userId: number, userRole: string, organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    // Super admin and org admin see all matches in organization
    if (userRole === 'super_admin' || userRole === 'org_admin') {
      return this.getJobMatchesByOrganization(organizationId, jobId, minPercentage);
    }
    
    // Others see only their own matches
    return this.getJobMatchesByUser(userId, organizationId, jobId, minPercentage);
  }

  async deleteJobMatchesByJobId(jobId: number): Promise<void> {
    const sqlite = await this.ensureConnection();
    sqlite.prepare('DELETE FROM job_matches WHERE job_id = ?').run(jobId);
  }

  async clearAllMatches(): Promise<void> {
    const sqlite = await this.ensureConnection();
    sqlite.prepare('DELETE FROM job_matches').run();
  }

  async clearMatchesByUser(userId: number, organizationId: number): Promise<void> {
    const sqlite = await this.ensureConnection();
    sqlite.prepare('DELETE FROM job_matches WHERE matched_by = ? AND organization_id = ?').run(userId, organizationId);
  }

  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    throw new Error('Method not implemented in simplified storage');
  }

  async getInterview(id: number): Promise<Interview | undefined> {
    return undefined;
  }

  async getAllInterviews(): Promise<InterviewWithDetails[]> {
    return [];
  }

  async getInterviewsByCandidate(candidateId: number): Promise<InterviewWithDetails[]> {
    return [];
  }

  async getInterviewsByJob(jobId: number): Promise<InterviewWithDetails[]> {
    return [];
  }

  async getInterviewsByOrganization(organizationId: number): Promise<InterviewWithDetails[]> {
    return [];
  }

  async updateInterviewStatus(id: number, status: string): Promise<void> {
    // Implementation needed
  }

  async deleteInterview(id: number): Promise<void> {
    // Implementation needed
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    throw new Error('Method not implemented in simplified storage');
  }

  async getUser(id: number): Promise<User | undefined> {
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  }

  async getUsersByOrganization(organizationId: number): Promise<User[]> {
    const sqlite = await this.ensureConnection();
    return sqlite.prepare('SELECT * FROM users WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId) as User[];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    // Implementation needed
  }

  async deleteUser(id: number): Promise<void> {
    // Implementation needed
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    throw new Error('Method not implemented in simplified storage');
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    return undefined;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return [];
  }

  async deleteOrganization(id: number): Promise<void> {
    // Implementation needed
  }

  async createJobTemplate(insertJobTemplate: InsertJobTemplate): Promise<JobTemplate> {
    throw new Error('Method not implemented in simplified storage');
  }

  async getJobTemplate(jobId: number): Promise<JobTemplate | undefined> {
    return undefined;
  }

  async updateJobTemplate(jobId: number, updates: Partial<JobTemplate>): Promise<JobTemplate | undefined> {
    return undefined;
  }

  async deleteJobTemplate(jobId: number): Promise<void> {
    // Implementation needed
  }

  async deleteAllJobs(): Promise<void> {
    const sqlite = await this.ensureConnection();
    sqlite.prepare('DELETE FROM jobs').run();
  }

  async deleteAllCandidates(): Promise<void> {
    const sqlite = await this.ensureConnection();
    sqlite.prepare('DELETE FROM candidates').run();
  }
}

// Export the storage instance
export const storage = new SQLiteStorageSimple();