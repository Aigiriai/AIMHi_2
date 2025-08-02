import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

// Organizations table - Root level for multi-tenancy
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  domain: text("domain"),
  subdomain: text("subdomain"),
  plan: text("plan").notNull().default("trial"),
  status: text("status").notNull().default("active"),
  timezone: text("timezone").default("UTC"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  currency: text("currency").default("USD"),
  settings: text("settings").default("{}"),
  billingSettings: text("billing_settings").default("{}"),
  complianceSettings: text("compliance_settings").default("{}"),
  integrationSettings: text("integration_settings").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Teams/Departments table
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  managerId: integer("manager_id").references(() => users.id),
  settings: text("settings").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Users table - Multi-role support (moved before other tables that reference it)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("recruiter"),
  managerId: integer("manager_id").references(() => users.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  permissions: text("permissions").default("{}"),
  hasTemporaryPassword: integer("has_temporary_password", { mode: "boolean" }).notNull().default(false),
  temporaryPassword: text("temporary_password"),
  settings: text("settings").default("{}"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Organization credentials table for storing temporary login credentials
export const organizationCredentials = sqliteTable("organization_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  adminUserId: integer("admin_user_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  temporaryPassword: text("temporary_password").notNull(),
  isPasswordChanged: integer("is_password_changed", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// User credentials table for storing individual user temporary passwords
export const userCredentials = sqliteTable("user_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  temporaryPassword: text("temporary_password").notNull(),
  isPasswordChanged: integer("is_password_changed", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// User Teams junction table
export const userTeams = sqliteTable("user_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  role: text("role").notNull().default("member"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Audit logs table
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  details: text("details").default("{}"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Usage metrics table
export const usageMetrics = sqliteTable("usage_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  metricType: text("metric_type").notNull(),
  metricValue: real("metric_value").notNull(),
  billingPeriod: text("billing_period").notNull(),
  metadata: text("metadata").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Jobs table - Now organization-scoped with ATS Pipeline
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  experienceLevel: text("experience_level").notNull(),
  jobType: text("job_type").notNull(),
  requirements: text("requirements").notNull(),
  location: text("location").notNull(),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  keywords: text("keywords").notNull(),
  originalFileName: text("original_file_name"), // Store original uploaded filename
  
  // ATS Pipeline fields
  status: text("status").notNull().default("draft"), // draft, active, paused, filled, closed, archived
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"),
  closedAt: text("closed_at"),
  filledAt: text("filled_at"),
  requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(true),
  autoPublishAt: text("auto_publish_at"),
  applicationDeadline: text("application_deadline"),
  
  settings: text("settings").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Candidates table - Organization-scoped
export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  addedBy: integer("added_by").references(() => users.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: integer("experience").notNull(),
  resumeContent: text("resume_content").notNull(),
  resumeFileName: text("resume_file_name").notNull(),
  source: text("source").default("manual"),
  tags: text("tags").default("[]"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Job matches table - Enhanced with tracking
export const jobMatches = sqliteTable("job_matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  matchedBy: integer("matched_by").references(() => users.id).notNull(),
  matchPercentage: real("match_percentage").notNull(),
  aiReasoning: text("ai_reasoning"),
  matchCriteria: text("match_criteria").default("{}"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Interviews table - Enhanced tracking
export const interviews = sqliteTable("interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  matchId: integer("match_id").references(() => jobMatches.id),
  scheduledBy: integer("scheduled_by").references(() => users.id).notNull(),
  scheduledDateTime: text("scheduled_date_time").notNull(),
  duration: integer("duration").notNull().default(60),
  status: text("status").notNull().default("scheduled"),
  interviewType: text("interview_type").notNull().default("video"),
  meetingLink: text("meeting_link"),
  notes: text("notes"),
  feedback: text("feedback").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ATS Applications table - Links candidates to jobs with pipeline status
export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  appliedBy: integer("applied_by").references(() => users.id).notNull(),
  
  // Pipeline status
  status: text("status").notNull().default("new"), // new, screening, interview, decided
  substatus: text("substatus"), // phone_screen, technical_assessment, etc.
  currentStage: text("current_stage").notNull().default("new"),
  
  // Application details
  appliedAt: text("applied_at").default("CURRENT_TIMESTAMP").notNull(),
  matchPercentage: real("match_percentage"),
  source: text("source").default("manual"), // manual, job_board, referral
  notes: text("notes").default(""),
  
  // Tracking
  lastStageChangeAt: text("last_stage_change_at").default("CURRENT_TIMESTAMP"),
  lastStageChangedBy: integer("last_stage_changed_by").references(() => users.id),
  
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Job assignments for permissions
export const jobAssignments = sqliteTable("job_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // owner, assigned, viewer
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Candidate assignments for permissions
export const candidateAssignments = sqliteTable("candidate_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // owner, assigned, viewer
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Candidate submissions from Team Leads and Recruiters
export const candidateSubmissions = sqliteTable("candidate_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  submittedBy: integer("submitted_by").references(() => users.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: integer("experience").notNull(),
  resumeContent: text("resume_content").notNull(),
  resumeFileName: text("resume_file_name").notNull(),
  source: text("source").default("manual"),
  tags: text("tags").default("[]"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  submissionNotes: text("submission_notes"), // Optional notes from submitter
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  reviewNotes: text("review_notes"), // Optional notes from reviewer
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Status history for both jobs and applications
export const statusHistory = sqliteTable("status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  entityType: text("entity_type").notNull(), // job, application
  entityId: integer("entity_id").notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  changedBy: integer("changed_by").references(() => users.id).notNull(),
  reason: text("reason"),
  notes: text("notes"),
  changedAt: text("changed_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Job templates for AI matching - Enhanced AI templates
export const jobTemplates = sqliteTable("job_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  positionTitle: text("position_title").notNull(),
  seniorityLevel: text("seniority_level").notNull(),
  department: text("department"),
  mandatorySkills: text("mandatory_skills").default("[]"),
  preferredSkills: text("preferred_skills").default("[]"),
  skillProficiencyLevels: text("skill_proficiency_levels").default("{}"),
  primaryTechnologies: text("primary_technologies").default("[]"),
  secondaryTechnologies: text("secondary_technologies").default("[]"),
  technologyCategories: text("technology_categories").default("{}"),
  minimumYearsRequired: integer("minimum_years_required").default(0),
  specificDomainExperience: text("specific_domain_experience").default("[]"),
  industryBackground: text("industry_background").default("[]"),
  technicalTasksPercentage: integer("technical_tasks_percentage").default(70),
  leadershipTasksPercentage: integer("leadership_tasks_percentage").default(20),
  domainTasksPercentage: integer("domain_tasks_percentage").default(10),
  skillsMatchWeight: integer("skills_match_weight").default(25),
  experienceWeight: integer("experience_weight").default(15),
  keywordWeight: integer("keyword_weight").default(35),
  technicalDepthWeight: integer("technical_depth_weight").default(10),
  domainKnowledgeWeight: integer("domain_knowledge_weight").default(15),
  rawJobDescription: text("raw_job_description").notNull(),
  aiGeneratedData: text("ai_generated_data").default("{}"),
  templateVersion: text("template_version").default("1.0"),
  status: text("status").default("generated"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Create insert schemas for validation
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertOrganizationCredentialsSchema = createInsertSchema(organizationCredentials);
export const insertUserCredentialsSchema = createInsertSchema(userCredentials);
export const insertUserTeamsSchema = createInsertSchema(userTeams);
export const insertAuditLogsSchema = createInsertSchema(auditLogs);
export const insertUsageMetricsSchema = createInsertSchema(usageMetrics);
export const insertTeamSchema = createInsertSchema(teams);
export const insertUserSchema = createInsertSchema(users);
export const insertJobSchema = createInsertSchema(jobs);
export const insertCandidateSchema = createInsertSchema(candidates);
export const insertJobMatchSchema = createInsertSchema(jobMatches);
export const insertInterviewSchema = createInsertSchema(interviews);
export const insertApplicationSchema = createInsertSchema(applications);
export const insertJobAssignmentSchema = createInsertSchema(jobAssignments);
export const insertCandidateAssignmentSchema = createInsertSchema(candidateAssignments);
export const insertCandidateSubmissionSchema = createInsertSchema(candidateSubmissions);
export const insertStatusHistorySchema = createInsertSchema(statusHistory);
export const insertJobTemplateSchema = createInsertSchema(jobTemplates);

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationCredentials = typeof organizationCredentials.$inferSelect;
export type InsertOrganizationCredentials = typeof organizationCredentials.$inferInsert;
export type UserCredentials = typeof userCredentials.$inferSelect;
export type InsertUserCredentials = typeof userCredentials.$inferInsert;
export type UserTeams = typeof userTeams.$inferSelect;
export type InsertUserTeams = typeof userTeams.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = typeof usageMetrics.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;
export type JobMatch = typeof jobMatches.$inferSelect;
export type InsertJobMatch = typeof jobMatches.$inferInsert;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = typeof interviews.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;
export type JobAssignment = typeof jobAssignments.$inferSelect;
export type InsertJobAssignment = typeof jobAssignments.$inferInsert;
export type CandidateAssignment = typeof candidateAssignments.$inferSelect;
export type InsertCandidateAssignment = typeof candidateAssignments.$inferInsert;
export type CandidateSubmission = typeof candidateSubmissions.$inferSelect;
export type InsertCandidateSubmission = typeof candidateSubmissions.$inferInsert;
export type StatusHistory = typeof statusHistory.$inferSelect;
export type InsertStatusHistory = typeof statusHistory.$inferInsert;
export type JobTemplate = typeof jobTemplates.$inferSelect;
export type InsertJobTemplate = typeof jobTemplates.$inferInsert;

// Result types for joined queries
export interface JobMatchResult extends JobMatch {
  job: Job;
  candidate: Candidate;
}

export interface InterviewWithDetails extends Interview {
  job: Job;
  candidate: Candidate;
  interviewer: User;
}

// ATS Pipeline types
export interface ApplicationWithDetails extends Application {
  job: Job;
  candidate: Candidate;
  appliedByUser: User;
  lastChangedByUser?: User;
}

export interface JobWithApplications extends Job {
  applications: ApplicationWithDetails[];
  createdByUser: User;
  approvedByUser?: User;
}

export interface PipelineStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  applicationsByStatus: Record<string, number>;
  jobsByStatus: Record<string, number>;
}

// Permission types
export interface UserPermissions {
  canViewJob: boolean;
  canEditJob: boolean;
  canMoveCandidates: boolean;
  canScheduleInterviews: boolean;
  canMakeDecisions: boolean;
  canViewAnalytics: boolean;
}