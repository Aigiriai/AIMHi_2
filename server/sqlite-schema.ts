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
  managerId: integer("manager_id"),
  settings: text("settings").default("{}"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// Users table - Multi-role support (moved before other tables that reference it)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull(),
  managerId: integer("manager_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"),
  hasTemporaryPassword: integer("has_temporary_password", { mode: "boolean" }).notNull().default(false),
  temporaryPassword: text("temporary_password"),
  settings: text("settings").default("{}"),
  permissions: text("permissions").default("{}"),
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

// Jobs table - Now organization-scoped
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
  status: text("status").notNull().default("active"),
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