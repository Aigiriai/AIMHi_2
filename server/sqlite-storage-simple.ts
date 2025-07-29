import { getSQLiteDB } from './sqlite-db';
import { eq, and, desc, asc } from 'drizzle-orm';
import { jobs, candidates, jobMatches, interviews, users, organizations, jobTemplates } from './sqlite-schema';
import type { 
  Job, Candidate, JobMatch, Interview, User, Organization, JobTemplate,
  InsertJob, InsertCandidate, InsertJobMatch, InsertInterview, InsertUser, InsertOrganization, InsertJobTemplate
} from '@shared/schema';

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
  deleteJobMatchesByJobId(jobId: number): Promise<void>;
  clearAllMatches(): Promise<void>;
  
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

export class SQLiteStorage implements IStorage {
  private db: any;
  private sqlite: any;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      const dbInstance = await getSQLiteDB();
      this.db = dbInstance.db;
      this.sqlite = dbInstance.sqlite;
    } catch (error) {
      console.error('Failed to initialize SQLite connection:', error);
    }
  }

  private async ensureConnection() {
    if (!this.db) {
      await this.initializeConnection();
    }
    
    // Ensure candidates table exists
    try {
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organization_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          experience INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          source TEXT,
          resume_content TEXT NOT NULL,
          resume_file_name TEXT NOT NULL,
          tags TEXT DEFAULT '[]',
          added_by INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (error) {
      console.error('Error ensuring candidates table:', error);
    }
  }

  // Jobs
  async createJob(insertJob: InsertJob): Promise<Job> {
    await this.ensureConnection();
    console.log('Creating job with data:', insertJob);
    
    try {
      // Temporarily disable foreign key constraints for this operation
      this.sqlite.prepare('PRAGMA foreign_keys = OFF').run();
      
      const stmt = this.sqlite.prepare(`
        INSERT INTO jobs (
          organization_id, team_id, created_by, title, description, 
          experience_level, job_type, requirements, location, salary_min, salary_max,
          keywords, original_file_name, status, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        insertJob.originalFileName || null,
        insertJob.status || 'active',
        '{}' // settings as JSON string
      );
      
      // Re-enable foreign key constraints
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      
      const job = this.sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
      console.log('Job created successfully:', job);
      return {
        ...job,
        organizationId: job.organization_id,
        teamId: job.team_id,
        createdBy: job.created_by,
        experienceLevel: job.experience_level,
        jobType: job.job_type,
        originalFileName: job.original_file_name,
        createdAt: new Date(job.created_at),
        updatedAt: new Date(job.updated_at)
      };
    } catch (error) {
      console.error('Error creating job:', error);
      // Make sure to re-enable foreign keys even if there's an error
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      throw error;
    }
  }

  async getJob(id: number): Promise<Job | undefined> {
    await this.ensureConnection();
    const job = this.sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return undefined;
    
    return {
      ...job,
      organizationId: job.organization_id,
      teamId: job.team_id,
      createdBy: job.created_by,
      experienceLevel: job.experience_level,
      jobType: job.job_type,
      originalFileName: job.original_file_name,
      createdAt: new Date(job.created_at),
      updatedAt: new Date(job.updated_at)
    };
  }

  async getAllJobs(): Promise<Job[]> {
    await this.ensureConnection();
    console.log('Fetching all jobs from database...');
    
    try {
      const count = this.sqlite.prepare('SELECT COUNT(*) as count FROM jobs').get();
      console.log('Total jobs in database:', count);
      
      const jobs = this.sqlite.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
      
      console.log('Retrieved jobs:', jobs.length);
      return jobs.map(job => ({
        ...job,
        organizationId: job.organization_id,
        teamId: job.team_id,
        createdBy: job.created_by,
        experienceLevel: job.experience_level,
        jobType: job.job_type,
        originalFileName: job.original_file_name,
        createdAt: new Date(job.created_at),
        updatedAt: new Date(job.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }
  }

  async getJobsByOrganization(organizationId: number): Promise<Job[]> {
    await this.ensureConnection();
    console.log('Fetching jobs for organization:', organizationId);
    
    try {
      const jobs = this.sqlite.prepare('SELECT * FROM jobs WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId);
      
      console.log('Retrieved organization jobs:', jobs.length);
      return jobs.map(job => ({
        ...job,
        organizationId: job.organization_id,
        teamId: job.team_id,
        createdBy: job.created_by,
        experienceLevel: job.experience_level,
        jobType: job.job_type,
        originalFileName: job.original_file_name,
        createdAt: new Date(job.created_at),
        updatedAt: new Date(job.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching organization jobs:', error);
      return [];
    }
  }

  async getJobDeletionImpact(id: number): Promise<{
    applications: number;
    matches: number;
    interviews: number;
    assignments: number;
    statusHistory: number;
    hasOriginalFile: boolean;
    hasTemplate: boolean;
  }> {
    await this.ensureConnection();
    
    try {
      // Count applications (using correct snake_case column name)
      const applicationsCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM applications WHERE job_id = ?').get(id)?.count || 0;
      
      // Count matches (using correct snake_case column name)
      const matchesCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM job_matches WHERE job_id = ?').get(id)?.count || 0;
      
      // Count interviews (using correct snake_case column name)
      const interviewsCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM interviews WHERE job_id = ?').get(id)?.count || 0;
      
      // Count assignments (using correct snake_case column name)
      const assignmentsCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM job_assignments WHERE job_id = ?').get(id)?.count || 0;
      
      // Count status history for jobs (using entity_type and entity_id)
      const statusHistoryCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM status_history WHERE entity_type = "job" AND entity_id = ?').get(id)?.count || 0;
      
      // Check for original file
      const job = this.sqlite.prepare('SELECT original_file_name FROM jobs WHERE id = ?').get(id);
      const hasOriginalFile = !!(job?.original_file_name);
      
      // Check for template
      const templateCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM job_templates WHERE job_id = ?').get(id)?.count || 0;
      const hasTemplate = templateCount > 0;
      
      return {
        applications: applicationsCount,
        matches: matchesCount,
        interviews: interviewsCount,
        assignments: assignmentsCount,
        statusHistory: statusHistoryCount,
        hasOriginalFile,
        hasTemplate
      };
    } catch (error) {
      console.error('Error getting job deletion impact:', error);
      throw error;
    }
  }

  async deleteJob(id: number): Promise<void> {
    await this.ensureConnection();
    
    try {
      console.log(`🗑️ FORCE DELETE: Starting cascade deletion for job ${id}`);
      
      // Delete all related records in correct order (child tables first)
      // 1. Delete applications
      const applicationsResult = this.sqlite.prepare('DELETE FROM applications WHERE job_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${applicationsResult.changes} applications`);
      
      // 2. Delete matches
      const matchesResult = this.sqlite.prepare('DELETE FROM job_matches WHERE job_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${matchesResult.changes} job matches`);
      
      // 3. Delete interviews
      const interviewsResult = this.sqlite.prepare('DELETE FROM interviews WHERE job_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${interviewsResult.changes} interviews`);
      
      // 4. Delete assignments
      const assignmentsResult = this.sqlite.prepare('DELETE FROM job_assignments WHERE job_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${assignmentsResult.changes} job assignments`);
      
      // 5. Delete status history for this job
      const statusHistoryResult = this.sqlite.prepare('DELETE FROM status_history WHERE entity_type = "job" AND entity_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${statusHistoryResult.changes} status history records`);
      
      // 6. Delete job templates
      const templatesResult = this.sqlite.prepare('DELETE FROM job_templates WHERE job_id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted ${templatesResult.changes} job templates`);
      
      // 7. Finally delete the job itself
      const jobResult = this.sqlite.prepare('DELETE FROM jobs WHERE id = ?').run(id);
      console.log(`🗑️ FORCE DELETE: Deleted job record (${jobResult.changes} affected)`);
      
      if (jobResult.changes === 0) {
        throw new Error('Job not found or already deleted');
      }
      
      console.log(`✅ FORCE DELETE: Successfully completed cascade deletion for job ${id}`);
    } catch (error) {
      console.error('Error in force delete job:', error);
      throw error;
    }
  }

  // Candidates
  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    await this.ensureConnection();
    
    try {
      // Temporarily disable foreign key constraints for this operation
      this.sqlite.prepare('PRAGMA foreign_keys = OFF').run();
      
      const stmt = this.sqlite.prepare(`
        INSERT INTO candidates (
          organization_id, added_by, name, email, phone, experience,
          resume_content, resume_file_name, source, tags, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        insertCandidate.organizationId,
        insertCandidate.addedBy,
        insertCandidate.name,
        insertCandidate.email,
        insertCandidate.phone,
        insertCandidate.experience,
        insertCandidate.resumeContent,
        insertCandidate.resumeFileName,
        insertCandidate.source || 'manual',
        JSON.stringify(insertCandidate.tags || []),
        insertCandidate.status || 'active'
      );
      
      // Re-enable foreign key constraints
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      
      const candidate = this.sqlite.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid);
      return {
        ...candidate,
        organizationId: candidate.organization_id,
        addedBy: candidate.added_by,
        resumeContent: candidate.resume_content,
        resumeFileName: candidate.resume_file_name,
        tags: JSON.parse(candidate.tags || '[]'),
        createdAt: new Date(candidate.created_at),
        updatedAt: new Date(candidate.updated_at)
      };
    } catch (error) {
      console.error('Error creating candidate:', error);
      // Make sure to re-enable foreign keys even if there's an error
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      throw error;
    }
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    await this.ensureConnection();
    const candidate = this.sqlite.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    if (!candidate) return undefined;
    
    return {
      ...candidate,
      organizationId: candidate.organization_id,
      addedBy: candidate.added_by,
      resumeContent: candidate.resume_content,
      resumeFileName: candidate.resume_file_name,
      tags: JSON.parse(candidate.tags || '[]'),
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at)
    };
  }

  async getAllCandidates(): Promise<Candidate[]> {
    await this.ensureConnection();
    const candidates = this.sqlite.prepare('SELECT * FROM candidates ORDER BY created_at DESC').all();
    
    return candidates.map(candidate => ({
      ...candidate,
      organizationId: candidate.organization_id,
      addedBy: candidate.added_by,
      resumeContent: candidate.resume_content,
      resumeFileName: candidate.resume_file_name,
      tags: JSON.parse(candidate.tags || '[]'),
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at)
    }));
  }

  async getCandidatesByOrganization(organizationId: number): Promise<Candidate[]> {
    await this.ensureConnection();
    const candidates = this.sqlite.prepare('SELECT * FROM candidates WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId);
    
    return candidates.map(candidate => ({
      ...candidate,
      organizationId: candidate.organization_id,
      addedBy: candidate.added_by,
      resumeContent: candidate.resume_content,
      resumeFileName: candidate.resume_file_name,
      tags: JSON.parse(candidate.tags || '[]'),
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at)
    }));
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    await this.ensureConnection();
    const candidate = this.sqlite.prepare('SELECT * FROM candidates WHERE email = ?').get(email);
    if (!candidate) return undefined;
    
    return {
      ...candidate,
      organizationId: candidate.organization_id,
      addedBy: candidate.added_by,
      resumeContent: candidate.resume_content,
      resumeFileName: candidate.resume_file_name,
      tags: JSON.parse(candidate.tags || '[]'),
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at)
    };
  }

  async updateCandidate(id: number, updates: Partial<Candidate>): Promise<void> {
    await this.ensureConnection();
    
    try {
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
      if (updates.experience !== undefined) { fields.push('experience = ?'); values.push(updates.experience); }
      if (updates.resumeContent !== undefined) { fields.push('resume_content = ?'); values.push(updates.resumeContent); }
      if (updates.resumeFileName !== undefined) { fields.push('resume_file_name = ?'); values.push(updates.resumeFileName); }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
      
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      
      const stmt = this.sqlite.prepare(`UPDATE candidates SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
      
      console.log(`Updated candidate ${id} with fields: ${fields.join(', ')}`);
    } catch (error) {
      console.error('Error updating candidate:', error);
      throw error;
    }
  }

  async deleteCandidate(id: number): Promise<void> {
    await this.ensureConnection();
    
    try {
      // Delete related matches and interviews first
      this.sqlite.prepare('DELETE FROM job_matches WHERE candidate_id = ?').run(id);
      this.sqlite.prepare('DELETE FROM interviews WHERE candidate_id = ?').run(id);
      
      // Delete the candidate
      const stmt = this.sqlite.prepare('DELETE FROM candidates WHERE id = ?');
      const result = stmt.run(id);
      
      if (result.changes === 0) {
        throw new Error('Candidate not found or already deleted');
      }
    } catch (error) {
      console.error('Error deleting candidate:', error);
      throw error;
    }
  }

  // Job Matches
  async createJobMatch(insertMatch: InsertJobMatch): Promise<JobMatch> {
    await this.ensureConnection();
    
    try {
      // Temporarily disable foreign key constraints for this operation
      this.sqlite.prepare('PRAGMA foreign_keys = OFF').run();
      
      const stmt = this.sqlite.prepare(`
        INSERT INTO job_matches (
          organization_id, job_id, candidate_id, matched_by, match_percentage,
          ai_reasoning, match_criteria, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        insertMatch.organizationId,
        insertMatch.jobId,
        insertMatch.candidateId,
        insertMatch.matchedBy,
        insertMatch.matchPercentage,
        insertMatch.aiReasoning || null,
        JSON.stringify(insertMatch.matchCriteria || {}),
        insertMatch.status || 'pending'
      );
      
      // Re-enable foreign key constraints
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      
      const match = this.sqlite.prepare('SELECT * FROM job_matches WHERE id = ?').get(result.lastInsertRowid);
      return {
        ...match,
        organizationId: match.organization_id,
        jobId: match.job_id,
        candidateId: match.candidate_id,
        matchedBy: match.matched_by,
        matchPercentage: match.match_percentage,
        aiReasoning: match.ai_reasoning,
        matchCriteria: JSON.parse(match.match_criteria || '{}'),
        createdAt: new Date(match.created_at),
        updatedAt: new Date(match.updated_at)
      };
    } catch (error) {
      console.error('Error creating job match:', error);
      // Make sure to re-enable foreign keys even if there's an error
      this.sqlite.prepare('PRAGMA foreign_keys = ON').run();
      throw error;
    }
  }

  async getJobMatches(jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    await this.ensureConnection();
    
    let query = `
      SELECT 
        jm.*,
        j.title as job_title, j.description as job_description,
        c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone, c.experience as candidate_experience
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    if (jobId) {
      query += ' AND jm.job_id = ?';
      params.push(jobId);
    }
    if (minPercentage) {
      query += ' AND jm.match_percentage >= ?';
      params.push(minPercentage);
    }
    
    query += ' ORDER BY jm.match_percentage DESC';
    
    const matches = this.sqlite.prepare(query).all(...params);
    
    return matches.map(match => {
      // Parse skill analysis from matchCriteria
      let skillAnalysis = null;
      let criteriaScores = null;
      let weightedScores = null;
      let parsedMatchCriteria = {};
      
      if (match.match_criteria && match.match_criteria !== '{}') {
        try {
          console.log('🔍 PARSING: matchCriteria exists for match:', match.id);
          console.log('🔍 PARSING: raw match_criteria length:', match.match_criteria.length);
          console.log('🔍 PARSING: raw match_criteria start:', match.match_criteria.substring(0, 100));
          // Robust JSON parsing to handle SQLite string serialization issues
          const rawCriteria = match.match_criteria;
          if (typeof rawCriteria === 'string') {
            try {
              // First attempt: standard JSON.parse
              parsedMatchCriteria = JSON.parse(rawCriteria);
              
              // Check if parsing resulted in a string (character array issue)
              if (typeof parsedMatchCriteria === 'string') {
                // Second attempt: handle double-escaped JSON
                parsedMatchCriteria = JSON.parse(parsedMatchCriteria);
              }
              
              // Validate it's actually an object with expected structure
              if (typeof parsedMatchCriteria === 'object' && parsedMatchCriteria !== null) {
                // Success - we have a proper object
                console.log('🔍 PARSING: JSON parsed successfully as object');
              } else {
                console.log('🔍 PARSING: Parsed result is not an object, using empty structure');
                parsedMatchCriteria = {};
              }
            } catch (parseError) {
              console.log('🔍 PARSING: JSON parsing failed, using empty object:', parseError.message);
              parsedMatchCriteria = {};
            }
          } else {
            parsedMatchCriteria = rawCriteria || {};
          }
          console.log('🔍 PARSING: parsedMatchCriteria type:', typeof parsedMatchCriteria);
          console.log('🔍 PARSING: parsedMatchCriteria keys:', Object.keys(parsedMatchCriteria));
          skillAnalysis = parsedMatchCriteria.skillAnalysis || null;
          criteriaScores = parsedMatchCriteria.criteriaScores || null;
          weightedScores = parsedMatchCriteria.weightedScores || null;
          console.log('🔍 PARSING: parsed successfully, has skillAnalysis:', !!skillAnalysis);
          console.log('🔍 PARSING: skillAnalysis type:', typeof skillAnalysis);
          console.log('🔍 PARSING: skillAnalysis content:', skillAnalysis ? Object.keys(skillAnalysis) : 'null');
        } catch (e) {
          console.error('Error parsing matchCriteria:', e);
        }
      } else {
        console.log('🔍 PARSING: No matchCriteria found or is empty for match:', match.id);
      }
      
      return {
        id: match.id,
        organizationId: match.organization_id,
        jobId: match.job_id,
        candidateId: match.candidate_id,
        matchedBy: match.matched_by,
        matchPercentage: match.match_percentage,
        aiReasoning: match.ai_reasoning,
        matchCriteria: parsedMatchCriteria,
        skillAnalysis,
        criteriaScores,
        weightedScores,
        status: match.status,
        createdAt: new Date(match.created_at),
        updatedAt: new Date(match.updated_at),
        job: {
          id: match.job_id,
          title: match.job_title,
          description: match.job_description
        } as Job,
        candidate: {
          id: match.candidate_id,
          name: match.candidate_name,
          email: match.candidate_email,
          phone: match.candidate_phone,
          experience: match.candidate_experience
        } as Candidate
      };
    });
  }

  async getJobMatchesByOrganization(organizationId: number, jobId?: number, minPercentage?: number): Promise<JobMatchResult[]> {
    await this.ensureConnection();
    
    let query = `
      SELECT 
        jm.*,
        j.title as job_title, j.description as job_description,
        c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone, c.experience as candidate_experience
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN candidates c ON jm.candidate_id = c.id
      WHERE jm.organization_id = ?
    `;
    
    const params = [organizationId];
    if (jobId) {
      query += ' AND jm.job_id = ?';
      params.push(jobId);
    }
    if (minPercentage) {
      query += ' AND jm.match_percentage >= ?';
      params.push(minPercentage);
    }
    
    query += ' ORDER BY jm.match_percentage DESC';
    
    const matches = this.sqlite.prepare(query).all(...params);
    
    return matches.map(match => ({
      id: match.id,
      organizationId: match.organization_id,
      jobId: match.job_id,
      candidateId: match.candidate_id,
      matchedBy: match.matched_by,
      matchPercentage: match.match_percentage,
      aiReasoning: match.ai_reasoning,
      matchCriteria: JSON.parse(match.match_criteria || '{}'),
      status: match.status,
      createdAt: new Date(match.created_at),
      updatedAt: new Date(match.updated_at),
      job: {
        id: match.job_id,
        title: match.job_title,
        description: match.job_description
      } as Job,
      candidate: {
        id: match.candidate_id,
        name: match.candidate_name,
        email: match.candidate_email,
        phone: match.candidate_phone,
        experience: match.candidate_experience
      } as Candidate
    }));
  }

  async deleteJobMatchesByJobId(jobId: number): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM job_matches WHERE job_id = ?').run(jobId);
  }

  async clearAllMatches(): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM job_matches').run();
  }

  // Interview methods (basic implementations)
  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    await this.ensureConnection();
    
    const stmt = this.sqlite.prepare(`
      INSERT INTO interviews (
        organization_id, job_id, candidate_id, scheduled_by, scheduled_date_time,
        duration, status, interview_type, meeting_link, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      insertInterview.organizationId,
      insertInterview.jobId,
      insertInterview.candidateId,
      insertInterview.scheduledBy,
      insertInterview.scheduledDateTime.toISOString(),
      insertInterview.duration || 60,
      insertInterview.status || 'scheduled',
      insertInterview.interviewType || 'video',
      insertInterview.meetingLink || null,
      insertInterview.notes || null
    );
    
    const interview = this.sqlite.prepare('SELECT * FROM interviews WHERE id = ?').get(result.lastInsertRowid);
    return {
      ...interview,
      organizationId: interview.organization_id,
      jobId: interview.job_id,
      candidateId: interview.candidate_id,
      scheduledBy: interview.scheduled_by,
      scheduledDateTime: new Date(interview.scheduled_date_time),
      interviewType: interview.interview_type,
      meetingLink: interview.meeting_link,
      createdAt: new Date(interview.created_at),
      updatedAt: new Date(interview.updated_at)
    };
  }

  async getInterview(id: number): Promise<Interview | undefined> {
    await this.ensureConnection();
    const interview = this.sqlite.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
    if (!interview) return undefined;
    
    return {
      ...interview,
      organizationId: interview.organization_id,
      jobId: interview.job_id,
      candidateId: interview.candidate_id,
      scheduledBy: interview.scheduled_by,
      scheduledDateTime: new Date(interview.scheduled_date_time),
      interviewType: interview.interview_type,
      meetingLink: interview.meeting_link,
      createdAt: new Date(interview.created_at),
      updatedAt: new Date(interview.updated_at)
    };
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
    this.sqlite.prepare('UPDATE interviews SET status = ? WHERE id = ?').run(status, id);
  }

  async deleteInterview(id: number): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM interviews WHERE id = ?').run(id);
  }

  async getInterviewsByOrganization(organizationId: number): Promise<InterviewWithDetails[]> {
    await this.ensureConnection();
    
    try {
      // First check if interviews table exists and has data
      const tableExists = this.sqlite.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='interviews'
      `).get();
      
      if (!tableExists) {
        console.log('Interviews table does not exist, returning empty array');
        return [];
      }
      
      const interviews = this.sqlite.prepare(`
        SELECT 
          i.*,
          j.title as job_title, j.description as job_description,
          c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone
        FROM interviews i
        JOIN jobs j ON i.job_id = j.id
        JOIN candidates c ON i.candidate_id = c.id
        WHERE i.organization_id = ?
        ORDER BY i.created_at DESC
      `).all(organizationId);
      
      return interviews.map(interview => ({
        id: interview.id,
        organizationId: interview.organization_id,
        jobId: interview.job_id,
        candidateId: interview.candidate_id,
        scheduledBy: interview.scheduled_by,
        scheduledDateTime: new Date(interview.scheduled_date_time),
        duration: interview.duration,
        interviewType: interview.interview_type,
        interviewerName: interview.interviewer_name,
        interviewerEmail: interview.interviewer_email,
        meetingLink: interview.meeting_link,
        notes: interview.notes,
        status: interview.status,
        createdAt: new Date(interview.created_at),
        updatedAt: new Date(interview.updated_at),
        job: {
          id: interview.job_id,
          title: interview.job_title,
          description: interview.job_description
        } as Job,
        candidate: {
          id: interview.candidate_id,
          name: interview.candidate_name,
          email: interview.candidate_email,
          phone: interview.candidate_phone
        } as Candidate
      }));
    } catch (error) {
      console.error('Error fetching organization interviews:', error);
      return [];
    }
  }

  // User methods (basic implementations)
  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureConnection();
    throw new Error('User creation not implemented in SQLite storage');
  }

  async getUser(id: number): Promise<User | undefined> {
    await this.ensureConnection();
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { db } = await getSQLiteDB();
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUsersByOrganization(organizationId: number): Promise<User[]> {
    const { db } = await getSQLiteDB();
    const result = await db.select().from(users).where(eq(users.organizationId, organizationId));
    return result;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await this.ensureConnection();
  }

  async deleteUser(id: number): Promise<void> {
    await this.ensureConnection();
  }

  // Organization methods (basic implementations)
  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    await this.ensureConnection();
    throw new Error('Organization creation not implemented in SQLite storage');
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const { db } = await getSQLiteDB();
    const result = await db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    await this.ensureConnection();
    return undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    await this.ensureConnection();
    return [];
  }

  async deleteOrganization(id: number): Promise<void> {
    await this.ensureConnection();
  }

  // Job Template methods
  async createJobTemplate(insertJobTemplate: InsertJobTemplate): Promise<JobTemplate> {
    await this.ensureConnection();
    
    // Disable foreign key constraints temporarily
    this.sqlite.pragma('foreign_keys = OFF');
    
    try {
      // Drop and recreate table without foreign key constraints
      this.sqlite.exec(`DROP TABLE IF EXISTS job_templates`);
      this.sqlite.exec(`
        CREATE TABLE job_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          organization_id INTEGER NOT NULL,
          position_title TEXT NOT NULL,
          seniority_level TEXT NOT NULL,
          department TEXT,
          mandatory_skills TEXT DEFAULT '[]',
          preferred_skills TEXT DEFAULT '[]',
          skill_proficiency_levels TEXT DEFAULT '{}',
          primary_technologies TEXT DEFAULT '[]',
          secondary_technologies TEXT DEFAULT '[]',
          technology_categories TEXT DEFAULT '{}',
          minimum_years_required INTEGER DEFAULT 0,
          specific_domain_experience TEXT DEFAULT '[]',
          industry_background TEXT DEFAULT '[]',
          technical_tasks_percentage INTEGER DEFAULT 70,
          leadership_tasks_percentage INTEGER DEFAULT 20,
          domain_tasks_percentage INTEGER DEFAULT 10,
          skills_match_weight INTEGER DEFAULT 25,
          experience_weight INTEGER DEFAULT 15,
          keyword_weight INTEGER DEFAULT 35,
          technical_depth_weight INTEGER DEFAULT 10,
          domain_knowledge_weight INTEGER DEFAULT 15,
          raw_job_description TEXT NOT NULL,
          ai_generated_data TEXT DEFAULT '{}',
          template_version TEXT DEFAULT '1.0',
          status TEXT DEFAULT 'generated',
          reviewed_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      const stmt = this.sqlite.prepare(`
        INSERT INTO job_templates (
          job_id, organization_id, position_title, seniority_level, department,
          mandatory_skills, preferred_skills, skill_proficiency_levels,
          primary_technologies, secondary_technologies, technology_categories,
          minimum_years_required, specific_domain_experience, industry_background,
          technical_tasks_percentage, leadership_tasks_percentage, domain_tasks_percentage,
          skills_match_weight, experience_weight, keyword_weight, technical_depth_weight, domain_knowledge_weight,
          raw_job_description, ai_generated_data, template_version, status, reviewed_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const result = stmt.run(
        insertJobTemplate.jobId,
        insertJobTemplate.organizationId,
        insertJobTemplate.positionTitle,
        insertJobTemplate.seniorityLevel,
        insertJobTemplate.department || null,
        JSON.stringify(insertJobTemplate.mandatorySkills || []),
        JSON.stringify(insertJobTemplate.preferredSkills || []),
        JSON.stringify(insertJobTemplate.skillProficiencyLevels || {}),
        JSON.stringify(insertJobTemplate.primaryTechnologies || []),
        JSON.stringify(insertJobTemplate.secondaryTechnologies || []),
        JSON.stringify(insertJobTemplate.technologyCategories || {}),
        insertJobTemplate.minimumYearsRequired || 0,
        JSON.stringify(insertJobTemplate.specificDomainExperience || []),
        JSON.stringify(insertJobTemplate.industryBackground || []),
        insertJobTemplate.technicalTasksPercentage || 70,
        insertJobTemplate.leadershipTasksPercentage || 20,
        insertJobTemplate.domainTasksPercentage || 10,
        insertJobTemplate.skillsMatchWeight || 25,
        insertJobTemplate.experienceWeight || 15,
        insertJobTemplate.keywordWeight || 35,
        insertJobTemplate.technicalDepthWeight || 10,
        insertJobTemplate.domainKnowledgeWeight || 15,
        insertJobTemplate.rawJobDescription,
        JSON.stringify(insertJobTemplate.aiGeneratedData || {}),
        insertJobTemplate.templateVersion || '1.0',
        insertJobTemplate.status || 'generated',
        insertJobTemplate.reviewedBy || null,
        now,
        now
      );

      console.log(`✅ Template created successfully for job ID: ${insertJobTemplate.jobId}`);
      
      return {
        id: result.lastInsertRowid as number,
        organizationId: insertJobTemplate.organizationId,
        jobId: insertJobTemplate.jobId,
        positionTitle: insertJobTemplate.positionTitle,
        seniorityLevel: insertJobTemplate.seniorityLevel,
        department: insertJobTemplate.department || null,
        mandatorySkills: insertJobTemplate.mandatorySkills || [],
        preferredSkills: insertJobTemplate.preferredSkills || [],
        skillProficiencyLevels: insertJobTemplate.skillProficiencyLevels || {},
        primaryTechnologies: insertJobTemplate.primaryTechnologies || [],
        secondaryTechnologies: insertJobTemplate.secondaryTechnologies || [],
        technologyCategories: insertJobTemplate.technologyCategories || {},
        minimumYearsRequired: insertJobTemplate.minimumYearsRequired || 0,
        specificDomainExperience: insertJobTemplate.specificDomainExperience || [],
        industryBackground: insertJobTemplate.industryBackground || [],
        technicalTasksPercentage: insertJobTemplate.technicalTasksPercentage || 70,
        leadershipTasksPercentage: insertJobTemplate.leadershipTasksPercentage || 20,
        domainTasksPercentage: insertJobTemplate.domainTasksPercentage || 10,
        skillsMatchWeight: insertJobTemplate.skillsMatchWeight || 25,
        experienceWeight: insertJobTemplate.experienceWeight || 15,
        keywordWeight: insertJobTemplate.keywordWeight || 35,
        technicalDepthWeight: insertJobTemplate.technicalDepthWeight || 10,
        domainKnowledgeWeight: insertJobTemplate.domainKnowledgeWeight || 15,
        rawJobDescription: insertJobTemplate.rawJobDescription,
        aiGeneratedData: insertJobTemplate.aiGeneratedData || {},
        templateVersion: insertJobTemplate.templateVersion || '1.0',
        status: insertJobTemplate.status || 'generated',
        reviewedBy: insertJobTemplate.reviewedBy || null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      };
    } catch (error) {
      console.error(`❌ Template creation failed for job ID: ${insertJobTemplate.jobId}`, error);
      throw error;
    } finally {
      // Re-enable foreign key constraints
      this.sqlite.pragma('foreign_keys = ON');
    }
  }

  async getJobTemplate(jobId: number): Promise<JobTemplate | undefined> {
    await this.ensureConnection();
    
    const template = this.sqlite.prepare('SELECT * FROM job_templates WHERE job_id = ?').get(jobId);
    if (!template) return undefined;

    return {
      id: template.id,
      jobId: template.job_id,
      organizationId: template.organization_id,
      positionTitle: template.position_title,
      seniorityLevel: template.seniority_level,
      department: template.department,
      mandatorySkills: JSON.parse(template.mandatory_skills || '[]'),
      preferredSkills: JSON.parse(template.preferred_skills || '[]'),
      skillProficiencyLevels: JSON.parse(template.skill_proficiency_levels || '{}'),
      primaryTechnologies: JSON.parse(template.primary_technologies || '[]'),
      secondaryTechnologies: JSON.parse(template.secondary_technologies || '[]'),
      technologyCategories: JSON.parse(template.technology_categories || '{}'),
      minimumYearsRequired: template.minimum_years_required,
      specificDomainExperience: JSON.parse(template.specific_domain_experience || '[]'),
      industryBackground: JSON.parse(template.industry_background || '[]'),
      technicalTasksPercentage: template.technical_tasks_percentage,
      leadershipTasksPercentage: template.leadership_tasks_percentage,
      domainTasksPercentage: template.domain_tasks_percentage,
      skillsMatchWeight: template.skills_match_weight,
      experienceWeight: template.experience_weight,
      keywordWeight: template.keyword_weight,
      technicalDepthWeight: template.technical_depth_weight,
      domainKnowledgeWeight: template.domain_knowledge_weight,
      rawJobDescription: template.raw_job_description,
      aiGeneratedData: JSON.parse(template.ai_generated_data || '{}'),
      templateVersion: template.template_version,
      status: template.status,
      reviewedBy: template.reviewed_by,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at)
    };
  }

  async updateJobTemplate(jobId: number, updates: Partial<JobTemplate>): Promise<JobTemplate | undefined> {
    await this.ensureConnection();
    
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'jobId' && key !== 'createdAt')
      .map(key => `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
      .join(', ');

    if (!setClause) return this.getJobTemplate(jobId);

    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'jobId' && key !== 'createdAt')
      .map(([key, value]) => {
        if (Array.isArray(value) || typeof value === 'object') {
          return JSON.stringify(value);
        }
        return value;
      });

    values.push(new Date().toISOString());
    values.push(jobId);

    const stmt = this.sqlite.prepare(`
      UPDATE job_templates 
      SET ${setClause}, updated_at = ?
      WHERE job_id = ?
    `);

    stmt.run(...values);
    return this.getJobTemplate(jobId);
  }

  async deleteJobTemplate(jobId: number): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM job_templates WHERE job_id = ?').run(jobId);
  }

  // Cleanup methods
  async deleteAllJobs(): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM jobs').run();
  }

  async deleteAllCandidates(): Promise<void> {
    await this.ensureConnection();
    this.sqlite.prepare('DELETE FROM candidates').run();
  }
}

export const storage = new SQLiteStorage();