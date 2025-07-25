import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, type AuthRequest } from "./auth";
import { getDB } from "./db-connection";
import { 
  applications, jobs, candidates, users, statusHistory, jobAssignments,
  insertApplicationSchema, insertStatusHistorySchema, insertJobAssignmentSchema,
  type ApplicationWithDetails, type JobWithApplications, type PipelineStats, type UserPermissions
} from "./sqlite-schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

// Pipeline permissions helper
async function getUserPermissions(userId: number, jobId: number, userRole: string): Promise<UserPermissions> {
  const { db } = await getDB();
  
  // Super admin has all permissions
  if (userRole === 'super_admin') {
    return {
      canViewJob: true,
      canEditJob: true,
      canMoveCandidates: true,
      canScheduleInterviews: true,
      canMakeDecisions: true,
      canViewAnalytics: true
    };
  }

  // Check job assignment
  const assignment = await db.select()
    .from(jobAssignments)
    .where(and(
      eq(jobAssignments.jobId, jobId),
      eq(jobAssignments.userId, userId)
    ))
    .get();

  // Get job details to check ownership
  const job = await db.select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();

  const isOwner = job?.createdBy === userId;
  const isAssigned = !!assignment;
  const assignmentRole = assignment?.role;

  // Role-based permissions
  const permissions: UserPermissions = {
    canViewJob: false,
    canEditJob: false,
    canMoveCandidates: false,
    canScheduleInterviews: false,
    canMakeDecisions: false,
    canViewAnalytics: false
  };

  if (userRole === 'org_admin') {
    // Org admin has all permissions within their organization
    Object.keys(permissions).forEach(key => {
      permissions[key as keyof UserPermissions] = true;
    });
  } else if (userRole === 'hiring_manager' || userRole === 'manager') {
    if (isOwner || isAssigned) {
      permissions.canViewJob = true;
      permissions.canEditJob = isOwner;
      permissions.canMoveCandidates = true;
      permissions.canScheduleInterviews = true;
      permissions.canMakeDecisions = true;
      permissions.canViewAnalytics = true;
    }
  } else if (userRole === 'recruiter') {
    if (isAssigned) {
      permissions.canViewJob = true;
      permissions.canMoveCandidates = true;
      permissions.canScheduleInterviews = true;
      // Recruiters can't make final decisions without approval
    }
  }

  return permissions;
}

// Get pipeline overview with jobs and applications
router.get("/pipeline", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { db } = await getDB();
    const user = req.user!;

    // Build query based on user role and permissions
    let jobsQuery = db.select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
      createdAt: jobs.createdAt,
      createdBy: jobs.createdBy,
      organizationId: jobs.organizationId,
      approvedBy: jobs.approvedBy,
      approvedAt: jobs.approvedAt,
      requiresApproval: jobs.requiresApproval,
      // Include creator info
      createdByName: sql`${users.firstName} || ' ' || ${users.lastName}`.as('createdByName'),
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.createdBy, users.id))
    .where(eq(jobs.organizationId, user.organizationId))
    .orderBy(desc(jobs.createdAt));

    const jobsList = await jobsQuery.all();

    // Get applications for these jobs
    const jobIds = jobsList.map((job: any) => job.id);
    console.log(`🔍 PIPELINE: Found ${jobsList.length} jobs with IDs:`, jobIds);
    
    const applicationsData = jobIds.length > 0 ? await db.select({
      id: applications.id,
      jobId: applications.jobId,
      candidateId: applications.candidateId,
      status: applications.status,
      currentStage: applications.currentStage,
      appliedAt: applications.appliedAt,
      matchPercentage: applications.matchPercentage,
      notes: applications.notes,
      // Candidate info
      candidateName: candidates.name,
      candidateEmail: candidates.email,
      candidateExperience: candidates.experience,
      // Application tracking
      appliedBy: applications.appliedBy,
      lastStageChangeAt: applications.lastStageChangeAt,
    })
    .from(applications)
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(eq(applications.organizationId, user.organizationId))
    .orderBy(desc(applications.appliedAt))
    .all() : [];
    
    console.log(`🔍 PIPELINE: Found ${applicationsData.length} applications for organization ${user.organizationId}`);
    if (applicationsData.length > 0) {
      console.log('🔍 PIPELINE: First application:', {
        id: applicationsData[0].id,
        jobId: applicationsData[0].jobId,
        candidateName: applicationsData[0].candidateName,
        currentStage: applicationsData[0].currentStage
      });
    }

    // Group applications by job
    const jobsWithApplications: JobWithApplications[] = jobsList.map((job: any) => ({
      ...job,
      applications: applicationsData
        .filter((app: any) => app.jobId === job.id)
        .map((app: any) => ({
          id: app.id,
          jobId: app.jobId,
          candidateId: app.candidateId,
          status: app.status,
          currentStage: app.currentStage,
          appliedAt: app.appliedAt,
          matchPercentage: app.matchPercentage,
          notes: app.notes,
          candidateName: app.candidateName || 'Unknown',
          candidateEmail: app.candidateEmail || 'unknown@email.com',
          candidateExperience: app.candidateExperience || 0,
          appliedBy: app.appliedBy,
          lastStageChangeAt: app.lastStageChangeAt || app.appliedAt,
          jobTitle: job.title, // Add job title for application cards
        })) as any[],
      createdByUser: {
        name: job.createdByName,
      } as any,
    })) as any[];

    console.log(`🔍 PIPELINE: Returning ${jobsWithApplications.length} jobs with applications`);
    res.json({ 
      success: true, 
      jobs: jobsWithApplications 
    });
  } catch (error) {
    console.error("Failed to fetch pipeline:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pipeline data" });
  }
});

// Get pipeline statistics
router.get("/pipeline/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { db } = await getDB();
    const user = req.user!;

    // Get job statistics
    const jobStats = await db.select({
      status: jobs.status,
      count: sql<number>`count(*)`.as('count')
    })
    .from(jobs)
    .where(eq(jobs.organizationId, user.organizationId))
    .groupBy(jobs.status)
    .all();

    // Get application statistics
    const appStats = await db.select({
      status: applications.status,
      count: sql<number>`count(*)`.as('count')
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(jobs.organizationId, user.organizationId))
    .groupBy(applications.status)
    .all();

    // Get total counts
    const totalJobs = await db.select({ count: sql<number>`count(*)`.as('count') })
      .from(jobs)
      .where(eq(jobs.organizationId, user.organizationId))
      .get();

    const totalApplications = await db.select({ count: sql<number>`count(*)`.as('count') })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(jobs.organizationId, user.organizationId))
      .get();

    const activeJobs = await db.select({ count: sql<number>`count(*)`.as('count') })
      .from(jobs)
      .where(and(
        eq(jobs.organizationId, user.organizationId),
        eq(jobs.status, 'active')
      ))
      .get();

    const stats: PipelineStats = {
      totalJobs: totalJobs?.count || 0,
      activeJobs: activeJobs?.count || 0,
      totalApplications: totalApplications?.count || 0,
      jobsByStatus: Object.fromEntries(
        jobStats.map((stat: any) => [stat.status, stat.count])
      ),
      applicationsByStatus: Object.fromEntries(
        appStats.map((stat: any) => [stat.status, stat.count])
      ),
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Failed to fetch pipeline stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pipeline statistics" });
  }
});

// Change job status
const changeJobStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'filled', 'closed', 'archived']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/jobs/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    const user = req.user!;
    const { status, reason, notes } = changeJobStatusSchema.parse(req.body);

    const { db } = await getDB();

    // Check permissions
    const permissions = await getUserPermissions(user.id, jobId, user.role);
    if (!permissions.canEditJob) {
      return res.status(403).json({ success: false, error: "Not authorized to change job status" });
    }

    // Get current job status
    const currentJob = await db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();

    if (!currentJob) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const oldStatus = currentJob.status;

    // Update job status
    const updateData: any = { 
      status,
      updatedAt: new Date().toISOString()
    };

    // Set specific timestamps based on status
    if (status === 'active' && oldStatus === 'draft') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date().toISOString();
    } else if (status === 'filled') {
      updateData.filledAt = new Date().toISOString();
    } else if (status === 'closed') {
      updateData.closedAt = new Date().toISOString();
    }

    await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId));

    // Record status change in history
    await db.insert(statusHistory).values({
      organizationId: user.organizationId,
      entityType: 'job',
      entityId: jobId,
      oldStatus,
      newStatus: status,
      changedBy: user.id,
      reason,
      notes,
    });

    res.json({ success: true, message: "Job status updated successfully" });
  } catch (error) {
    console.error("Failed to change job status:", error);
    res.status(500).json({ success: false, error: "Failed to change job status" });
  }
});

// Move application through pipeline stages
const moveApplicationSchema = z.object({
  status: z.enum(['new', 'screening', 'interview', 'decided']),
  substatus: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/applications/:id/move", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id);
    const user = req.user!;
    const { status, substatus, reason, notes } = moveApplicationSchema.parse(req.body);

    const { db } = await getDB();

    // Get application details
    const application = await db.select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .get();

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // Check permissions
    const permissions = await getUserPermissions(user.id, application.jobId, user.role);
    if (!permissions.canMoveCandidates) {
      return res.status(403).json({ success: false, error: "Not authorized to move candidates" });
    }

    // Validate stage progression for recruiters
    if (user.role === 'recruiter' && status === 'decided') {
      return res.status(403).json({ success: false, error: "Recruiters cannot make final hiring decisions" });
    }

    const oldStatus = application.status;

    // Update application status
    await db.update(applications)
      .set({
        status,
        substatus,
        currentStage: status,
        lastStageChangeAt: new Date().toISOString(),
        lastStageChangedBy: user.id,
        updatedAt: new Date().toISOString(),
        notes: notes ? `${application.notes}\n${new Date().toISOString()}: ${notes}` : application.notes,
      })
      .where(eq(applications.id, applicationId));

    // Record status change in history
    await db.insert(statusHistory).values({
      organizationId: user.organizationId,
      entityType: 'application',
      entityId: applicationId,
      oldStatus,
      newStatus: status,
      changedBy: user.id,
      reason,
      notes,
    });

    res.json({ success: true, message: "Application moved successfully" });
  } catch (error) {
    console.error("Failed to move application:", error);
    res.status(500).json({ success: false, error: "Failed to move application" });
  }
});

// Create application from existing candidate
const createApplicationSchema = z.object({
  jobId: z.number(),
  candidateId: z.number(),
  source: z.string().default('manual'),
  notes: z.string().default(''),
});

router.post("/applications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { jobId, candidateId, source, notes } = createApplicationSchema.parse(req.body);

    const { db } = await getDB();

    // Check if application already exists
    const existingApp = await db.select()
      .from(applications)
      .where(and(
        eq(applications.jobId, jobId),
        eq(applications.candidateId, candidateId)
      ))
      .get();

    if (existingApp) {
      return res.status(400).json({ success: false, error: "Application already exists for this candidate and job" });
    }

    // Create application
    const [newApplication] = await db.insert(applications).values({
      organizationId: user.organizationId,
      jobId,
      candidateId,
      appliedBy: user.id,
      status: 'new',
      currentStage: 'new',
      source,
      notes,
    }).returning();

    // Record in status history
    await db.insert(statusHistory).values({
      organizationId: user.organizationId,
      entityType: 'application',
      entityId: newApplication.id,
      oldStatus: null,
      newStatus: 'new',
      changedBy: user.id,
      reason: 'Application created',
    });

    res.json({ success: true, application: newApplication });
  } catch (error) {
    console.error("Failed to create application:", error);
    res.status(500).json({ success: false, error: "Failed to create application" });
  }
});

export default router;