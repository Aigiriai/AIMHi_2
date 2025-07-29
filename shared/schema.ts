import { pgTable, text, serial, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table - Root level for multi-tenancy
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").unique(), // company.com
  subdomain: text("subdomain").unique(), // company.aimhi.app
  plan: text("plan").notNull().default("trial"), // trial, basic, professional, enterprise
  status: text("status").notNull().default("active"), // active, suspended, cancelled
  timezone: text("timezone").default("UTC"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  currency: text("currency").default("USD"),
  settings: jsonb("settings").default({}), // Organization-level configurations
  billingSettings: jsonb("billing_settings").default({}), // Pricing model preferences
  complianceSettings: jsonb("compliance_settings").default({}), // GDPR, CCPA settings
  integrationSettings: jsonb("integration_settings").default({}), // HR system configs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization credentials table for storing temporary login credentials
export const organizationCredentials = pgTable("organization_credentials", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  adminUserId: integer("admin_user_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  temporaryPassword: text("temporary_password").notNull(),
  isPasswordChanged: boolean("is_password_changed").notNull().default(false),
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary passwords
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User credentials table for storing individual user temporary passwords
export const userCredentials = pgTable("user_credentials", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  temporaryPassword: text("temporary_password").notNull(),
  isPasswordChanged: boolean("is_password_changed").notNull().default(false),
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary passwords
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Teams/Departments table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  managerId: integer("manager_id"), // Self-reference to users table
  settings: jsonb("settings").default({}), // Team-level configurations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users table - Multi-role support
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"), // User phone number
  role: text("role").notNull(), // super_admin, org_admin, manager, team_lead, recruiter, viewer
  managerId: integer("manager_id"), // Hierarchical reporting structure
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  hasTemporaryPassword: boolean("has_temporary_password").notNull().default(false),
  temporaryPassword: text("temporary_password"), // Store temporary password for retrieval
  settings: jsonb("settings").default({}), // User-level preferences
  permissions: jsonb("permissions").default({}), // Custom permissions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User-Team associations (many-to-many)
export const userTeams = pgTable("user_teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  role: text("role").notNull(), // manager, member, viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Jobs table - Now organization-scoped
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  experienceLevel: text("experience_level").notNull(),
  jobType: text("job_type").notNull(),
  keywords: text("keywords").notNull(),
  originalFileName: text("original_file_name"), // Store original uploaded filename
  status: text("status").notNull().default("active"), // active, paused, closed
  settings: jsonb("settings").default({}), // Job-specific configurations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Job Templates table - Standardized JD structure
export const jobTemplates = pgTable("job_templates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  
  // Role Information
  positionTitle: text("position_title").notNull(),
  seniorityLevel: text("seniority_level").notNull(), // junior, mid, senior, lead, principal
  department: text("department"),
  
  // Skills Classification
  mandatorySkills: text("mandatory_skills").array().notNull(), // Must-have skills
  preferredSkills: text("preferred_skills").array().default([]), // Nice-to-have skills
  skillProficiencyLevels: jsonb("skill_proficiency_levels").default({}), // {skill: level}
  
  // Technology Stack
  primaryTechnologies: text("primary_technologies").array().notNull(), // Core technologies
  secondaryTechnologies: text("secondary_technologies").array().default([]), // Supporting tools
  technologyCategories: jsonb("technology_categories").default({}), // {category: [techs]}
  
  // Experience Requirements
  minimumYearsRequired: integer("minimum_years_required").notNull(),
  specificDomainExperience: text("specific_domain_experience").array().default([]),
  industryBackground: text("industry_background").array().default([]),
  
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
  aiGeneratedData: jsonb("ai_generated_data").default({}), // Full AI response
  templateVersion: text("template_version").default("1.0"),
  status: text("status").default("generated"), // generated, reviewed, approved
  reviewedBy: integer("reviewed_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Candidates table - Organization-scoped
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  addedBy: integer("added_by").references(() => users.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: integer("experience").notNull(),
  resumeContent: text("resume_content").notNull(),
  resumeFileName: text("resume_file_name").notNull(),
  source: text("source").default("manual"), // manual, linkedin, indeed, referral
  tags: text("tags").array().default([]), // Custom tags for categorization
  status: text("status").notNull().default("active"), // active, archived, blacklisted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Job matches table - Enhanced with tracking
export const jobMatches = pgTable("job_matches", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  matchedBy: integer("matched_by").references(() => users.id).notNull(),
  matchPercentage: real("match_percentage").notNull(),
  aiReasoning: text("ai_reasoning"),
  matchCriteria: jsonb("match_criteria").default({}), // Detailed scoring breakdown
  status: text("status").notNull().default("pending"), // pending, reviewed, shortlisted, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Interviews table - Enhanced tracking
export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  matchId: integer("match_id").references(() => jobMatches.id),
  scheduledBy: integer("scheduled_by").references(() => users.id).notNull(),
  scheduledDateTime: timestamp("scheduled_date_time").notNull(),
  duration: integer("duration").notNull().default(60), // duration in minutes
  interviewType: text("interview_type").notNull().default("video"), // video, phone, in-person
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no-show
  meetingLink: text("meeting_link"),
  notes: text("notes"),
  interviewerName: text("interviewer_name"),
  interviewerEmail: text("interviewer_email"),
  reminderSent: boolean("reminder_sent").default(false),
  transcriptPath: text("transcript_path"), // Path to stored transcript
  outcome: text("outcome"), // hired, rejected, next_round
  feedback: jsonb("feedback").default({}), // Structured feedback
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Usage tracking for billing
export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  metricType: text("metric_type").notNull(), // resume_processed, interview_scheduled, ai_match_run, api_call
  metricValue: integer("metric_value").notNull().default(1),
  metadata: jsonb("metadata").default({}), // Additional context
  billingPeriod: text("billing_period").notNull(), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit logs for compliance
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // user_login, data_access, data_modification, etc.
  resourceType: text("resource_type"), // job, candidate, interview, etc.
  resourceId: integer("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for all tables
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserTeamSchema = createInsertSchema(userTeams).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobMatchSchema = createInsertSchema(jobMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  scheduledDateTime: z.string().or(z.date()).transform((val) => new Date(val)),
});

export const insertUsageMetricSchema = createInsertSchema(usageMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserTeam = z.infer<typeof insertUserTeamSchema>;
export type UserTeam = typeof userTeams.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplate = typeof jobTemplates.$inferSelect;

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

export type InsertJobMatch = z.infer<typeof insertJobMatchSchema>;
export type JobMatch = typeof jobMatches.$inferSelect;

export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;

export type InsertUsageMetric = z.infer<typeof insertUsageMetricSchema>;
export type UsageMetric = typeof usageMetrics.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Enhanced result types with joins
export type JobMatchResult = JobMatch & {
  job: Job;
  candidate: Candidate;
};

export type InterviewWithDetails = Interview & {
  job: Job;
  candidate: Candidate;
  match?: JobMatch;
};

export type UserWithTeams = User & {
  teams: (UserTeam & { team: Team })[];
  manager?: User;
  subordinates: User[];
};

export type TeamWithUsers = Team & {
  users: (UserTeam & { user: User })[];
  manager?: User;
};

export type OrganizationWithStats = Organization & {
  userCount: number;
  teamCount: number;
  jobCount: number;
  candidateCount: number;
  monthlyUsage: UsageMetric[];
};
