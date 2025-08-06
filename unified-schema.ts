import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// UNIFIED SQLITE SCHEMA - Replaces both shared/schema.ts and sqlite-schema.ts
// This schema combines all fields from both PostgreSQL and SQLite schemas
// while maintaining SQLite-specific types for consistency

// Organizations table - Root level for multi-tenancy
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  domain: text("domain"), // company.com
  subdomain: text("subdomain"), // company.aimhi.app
  plan: text("plan").notNull().default("trial"), // trial, basic, professional, enterprise
  status: text("status").notNull().default("active"), // active, suspended, cancelled
  timezone: text("timezone").default("UTC"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  currency: text("currency").default("USD"),
  settings: text("settings").default("{}"), // JSON string - Organization-level configurations
  billingSettings: text("billing_settings").default("{}"), // JSON string - Pricing model preferences
  complianceSettings: text("compliance_settings").default("{}"), // JSON string - GDPR, CCPA settings
  integrationSettings: text("integration_settings").default("{}"), // JSON string - HR system configs
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Teams/Departments table
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  managerId: integer("manager_id"), // Self-reference to users table
  settings: text("settings").default("{}"), // JSON string - Team-level configurations
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
  phone: text("phone"), // User phone number
  role: text("role").notNull().default("recruiter"), // super_admin, org_admin, manager, team_lead, recruiter, viewer
  managerId: integer("manager_id"), // Hierarchical reporting structure
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  permissions: text("permissions").default("{}"), // JSON string - Custom permissions
  hasTemporaryPassword: integer("has_temporary_password", { mode: "boolean" }).notNull().default(false),
  temporaryPassword: text("temporary_password"), // Store temporary password for retrieval
  settings: text("settings").default("{}"), // JSON string - User-level preferences
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
  expiresAt: text("expires_at"), // ISO date string
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
  expiresAt: text("expires_at"), // ISO date string
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// User-Team associations (many-to-many)
export const userTeams = sqliteTable("user_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  role: text("role").notNull().default("member"), // manager, member, viewer
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Jobs table - Now organization-scoped with FULL ATS Pipeline support
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  experienceLevel: text("experience_level").notNull(),
  jobType: text("job_type").notNull(),
  keywords: text("keywords").notNull(),
  requirements: text("requirements").notNull().default("Requirements not specified"),
  location: text("location").notNull().default("Location not specified"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  originalFileName: text("original_file_name"), // Store original uploaded filename
  
  // ATS Pipeline fields (from init-database.ts)
  status: text("status").notNull().default("draft"), // draft, active, paused, filled, closed, archived
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"), // ISO date string
  closedAt: text("closed_at"), // ISO date string
  filledAt: text("filled_at"), // ISO date string
  requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(true),
  autoPublishAt: text("auto_publish_at"), // ISO date string
  applicationDeadline: text("application_deadline"), // ISO date string
  
  settings: text("settings").default("{}"), // JSON string - Job-specific configurations
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Job Templates table - Standardized JD structure (from shared/schema.ts + init-database.ts)
export const jobTemplates = sqliteTable("job_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  
  // Role Information
  positionTitle: text("position_title").notNull(),
  seniorityLevel: text("seniority_level").notNull(), // junior, mid, senior, lead, principal
  department: text("department"),
  
  // Skills Classification (JSON arrays as text)
  mandatorySkills: text("mandatory_skills").default("[]"), // JSON array string
  preferredSkills: text("preferred_skills").default("[]"), // JSON array string
  skillProficiencyLevels: text("skill_proficiency_levels").default("{}"), // JSON object string
  
  // Technology Stack
  primaryTechnologies: text("primary_technologies").default("[]"), // JSON array string
  secondaryTechnologies: text("secondary_technologies").default("[]"), // JSON array string
  technologyCategories: text("technology_categories").default("{}"), // JSON object string
  
  // Experience Requirements
  minimumYearsRequired: integer("minimum_years_required").default(0),
  specificDomainExperience: text("specific_domain_experience").default("[]"), // JSON array string
  industryBackground: text("industry_background").default("[]"), // JSON array string
  
  // Responsibilities Classification
  technicalTasksPercentage: integer("technical_tasks_percentage").default(70),
  leadershipTasksPercentage: integer("leadership_tasks_percentage").default(20),
  domainTasksPercentage: integer("domain_tasks_percentage").default(10),
  
  // Match Criteria Weights (for this specific role type)
  skillsMatchWeight: integer("skills_match_weight").default(25),
  experienceWeight: integer("experience_weight").default(15),
  keywordWeight: integer("keyword_weight").default(35),
  technicalDepthWeight: integer("technical_depth_weight").default(10),
  domainKnowledgeWeight: integer("domain_knowledge_weight").default(15),
  
  // Additional structured data
  rawJobDescription: text("raw_job_description").notNull(), // Original JD for reference
  aiGeneratedData: text("ai_generated_data").default("{}"), // JSON object string - Full AI response
  templateVersion: text("template_version").default("1.0"),
  status: text("status").default("generated"), // generated, reviewed, approved
  reviewedBy: integer("reviewed_by").references(() => users.id),
  
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
  source: text("source").default("manual"), // manual, linkedin, indeed, referral
  tags: text("tags").default("[]"), // JSON array string - Custom tags for categorization
  status: text("status").notNull().default("active"), // active, archived, blacklisted
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
  matchCriteria: text("match_criteria").default("{}"), // JSON object string - Detailed scoring breakdown
  status: text("status").notNull().default("pending"), // pending, reviewed, shortlisted, rejected
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Interviews table - Enhanced tracking (combines shared/schema.ts + sqlite-schema.ts)
export const interviews = sqliteTable("interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  matchId: integer("match_id").references(() => jobMatches.id),
  scheduledBy: integer("scheduled_by").references(() => users.id).notNull(),
  scheduledDateTime: text("scheduled_date_time").notNull(), // ISO date string
  duration: integer("duration").notNull().default(60), // duration in minutes
  interviewType: text("interview_type").notNull().default("video"), // video, phone, in-person
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no-show
  meetingLink: text("meeting_link"),
  notes: text("notes"),
  
  // Additional fields from shared/schema.ts
  interviewerName: text("interviewer_name"),
  interviewerEmail: text("interviewer_email"),
  reminderSent: integer("reminder_sent", { mode: "boolean" }).default(false),
  transcriptPath: text("transcript_path"), // Path to stored transcript
  outcome: text("outcome"), // hired, rejected, next_round
  
  feedback: text("feedback").default("{}"), // JSON object string - Structured feedback
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ATS Applications table - Links candidates to jobs with pipeline status (from init-database.ts)
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

// Job assignments for permissions (from init-database.ts)
export const jobAssignments = sqliteTable("job_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // owner, assigned, viewer
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Candidate assignments for permissions (from init-database.ts)
export const candidateAssignments = sqliteTable("candidate_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // owner, assigned, viewer
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Candidate submissions from Team Leads and Recruiters (from init-database.ts)
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
  tags: text("tags").default("[]"), // JSON array string
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  submissionNotes: text("submission_notes"), // Optional notes from submitter
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"), // ISO date string
  reviewNotes: text("review_notes"), // Optional notes from reviewer
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Status history for both jobs and applications (from init-database.ts)
export const statusHistory = sqliteTable("status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  entityType: text("entity_type").notNull(), // job, application, candidate
  entityId: integer("entity_id").notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  changedBy: integer("changed_by").references(() => users.id).notNull(),
  reason: text("reason"),
  notes: text("notes"),
  changedAt: text("changed_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Usage tracking for billing (from shared/schema.ts)
export const usageMetrics = sqliteTable("usage_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  metricType: text("metric_type").notNull(), // resume_processed, interview_scheduled, ai_match_run, api_call
  metricValue: real("metric_value").notNull(),
  billingPeriod: text("billing_period").notNull(), // YYYY-MM format
  metadata: text("metadata").default("{}"), // JSON object string - Additional context
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Audit logs for compliance (from shared/schema.ts + init-database.ts)
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // user_login, data_access, data_modification, etc.
  entityType: text("entity_type").notNull(), // job, candidate, interview, etc.
  entityId: integer("entity_id").notNull(),
  details: text("details").default("{}"), // JSON object string
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Create insert schemas for validation - compatible with both old schemas
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertOrganizationCredentialsSchema = createInsertSchema(organizationCredentials);
export const insertUserCredentialsSchema = createInsertSchema(userCredentials);
export const insertUserTeamsSchema = createInsertSchema(userTeams);
export const insertAuditLogsSchema = createInsertSchema(auditLogs);
export const insertUsageMetricsSchema = createInsertSchema(usageMetrics);
export const insertTeamSchema = createInsertSchema(teams);
export const insertUserSchema = createInsertSchema(users);
export const insertJobSchema = createInsertSchema(jobs);
export const insertJobTemplateSchema = createInsertSchema(jobTemplates);
export const insertCandidateSchema = createInsertSchema(candidates);
export const insertJobMatchSchema = createInsertSchema(jobMatches);
export const insertInterviewSchema = createInsertSchema(interviews).extend({
  scheduledDateTime: z.string().or(z.date()).transform((val) => new Date(val).toISOString()),
});
export const insertApplicationSchema = createInsertSchema(applications);
export const insertJobAssignmentSchema = createInsertSchema(jobAssignments);
export const insertCandidateAssignmentSchema = createInsertSchema(candidateAssignments);
export const insertCandidateSubmissionSchema = createInsertSchema(candidateSubmissions);
export const insertStatusHistorySchema = createInsertSchema(statusHistory);

// Type exports - BACKWARD COMPATIBLE with existing frontend
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
export type JobTemplate = typeof jobTemplates.$inferSelect;
export type InsertJobTemplate = typeof jobTemplates.$inferInsert;
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

// Enhanced result types with joins - MAINTAIN EXISTING FRONTEND COMPATIBILITY
export interface JobMatchResult extends JobMatch {
  job: Job;
  candidate: Candidate;
}

export interface InterviewWithDetails extends Interview {
  job: Job;
  candidate: Candidate;
  interviewer: User;
}

// ATS Pipeline types - NEW but backward compatible
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

// Additional enhanced types from shared/schema.ts
export type UserWithTeams = User & {
  teams: (UserTeams & { team: Team })[];
  manager?: User;
  subordinates: User[];
};

export type TeamWithUsers = Team & {
  users: (UserTeams & { user: User })[];
  manager?: User;
};

export type OrganizationWithStats = Organization & {
  userCount: number;
  teamCount: number;
  jobCount: number;
  candidateCount: number;
  monthlyUsage: UsageMetric[];
};

// Pipeline Stats
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
