import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, type AuthRequest } from "./auth";
import { getDB } from "./db-helper";
import { 
  applications, jobs, candidates, users, statusHistory, jobAssignments,
  insertApplicationSchema, insertStatusHistorySchema, insertJobAssignmentSchema,
  type ApplicationWithDetails, type JobWithApplications, type PipelineStats, type UserPermissions
} from "../unified-schema";
import { eq, and, desc, sql, or, inArray } from "drizzle-orm";

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

    // Build query based on user role and permissions - implementing detailed permission matrix
    let jobsQuery;
    
    if (['super_admin', 'org_admin'].includes(user.role)) {
      // Super admin and org admin can see all jobs in their organization
      jobsQuery = db.select({
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
    } else {
      // For Manager, Team Lead, and Recruiter: only see jobs they created or are assigned to
      const assignedJobIds = await db.select({ jobId: jobAssignments.jobId })
        .from(jobAssignments)
        .where(eq(jobAssignments.userId, user.id));
      
      const assignedIds = assignedJobIds.map((a: any) => a.jobId);
      
      // Get jobs where user is either the creator OR has an assignment
      jobsQuery = db.select({
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
      .where(and(
        eq(jobs.organizationId, user.organizationId),
        or(
          eq(jobs.createdBy, user.id), // Jobs they created
          assignedIds.length > 0 ? inArray(jobs.id, assignedIds) : sql`0 = 1` // Jobs they're assigned to
        )
      ))
      .orderBy(desc(jobs.createdAt));
    }

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

// Get pipeline statistics with permission-based filtering
router.get("/pipeline/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`📊 PIPELINE STATS: Getting real stats for user ${req.user?.id} (${req.user?.role}) in organization ${req.user?.organizationId}`);
    
    const { db } = await getDB();
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    // Get jobs statistics using Drizzle ORM
    let totalJobsResult, activeJobsResult, totalApplicationsResult;
    
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'org_admin') {
      // Admin users see all jobs in their organization
      totalJobsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(jobs)
      .where(eq(jobs.organizationId, organizationId));

      activeJobsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(jobs)
      .where(and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.status, 'active')
      ));

      totalApplicationsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(applications)
      .where(eq(applications.organizationId, organizationId));
    } else {
      // Regular users see only their own jobs
      totalJobsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(jobs)
      .where(and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.createdBy, userId)
      ));

      activeJobsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(jobs)
      .where(and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.createdBy, userId),
        eq(jobs.status, 'active')
      ));

      totalApplicationsResult = await db.select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(
        eq(applications.organizationId, organizationId),
        eq(jobs.createdBy, userId)
      ));
    }

    const stats: PipelineStats = {
      totalJobs: totalJobsResult?.[0]?.count || 0,
      activeJobs: activeJobsResult?.[0]?.count || 0,
      totalApplications: totalApplicationsResult?.[0]?.count || 0,
      jobsByStatus: {},
      applicationsByStatus: {},
    };
    
    
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });
    
    console.log(`✅ PIPELINE STATS: Returning stats:`, stats);
    
    return res.json({ 
      success: true, 
      stats: {
        ...stats,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error("❌ PIPELINE STATS: Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to fetch pipeline statistics" 
    });
  }
});

// Change job status - Fixed to match frontend parameter name
const changeJobStatusSchema = z.object({
  newStatus: z.enum(['draft', 'active', 'paused', 'filled', 'closed', 'archived']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/jobs/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const expressReq = req as any; // Type assertion to access Express properties
    console.log(`🔄 JOB STATUS: Starting job status update - ID: ${expressReq.params.id}`);
    console.log(`🔄 JOB STATUS: Request body:`, expressReq.body);
    console.log(`🔄 JOB STATUS: User:`, { id: req.user?.id, role: req.user?.role, organizationId: req.user?.organizationId });
    
    const jobId = parseInt(expressReq.params.id);
    const user = req.user!;
    const { newStatus: status, reason, notes } = changeJobStatusSchema.parse(expressReq.body);
    
    console.log(`🔄 JOB STATUS: Parsed data - JobID: ${jobId}, Status: ${status}, User: ${user.id}`);

    const { db } = await getDB();

    // Check permissions - only super_admin, org_admin, and hiring_manager can change job status
    console.log(`🔄 JOB STATUS: Checking permissions for user role: ${user.role}`);
    if (!['super_admin', 'org_admin', 'hiring_manager'].includes(user.role)) {
      console.log(`❌ JOB STATUS: Permission denied for role: ${user.role}. Only Super Admin, Org Admin, and Hiring Manager can change job status.`);
      return res.status(403).json({ 
        success: false, 
        error: "You don't have permission to change job status. Only Super Admin, Org Admin, and Hiring Manager can change job status." 
      });
    }
    console.log(`✅ JOB STATUS: Permission granted for role: ${user.role}`);

    // Get current job status
    console.log(`🔄 JOB STATUS: Fetching current job data for ID: ${jobId}`);
    const currentJob = await db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();

    if (!currentJob) {
      console.log(`❌ JOB STATUS: Job not found with ID: ${jobId}`);
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    
    console.log(`✅ JOB STATUS: Found job - Title: ${currentJob.title}, Current Status: ${currentJob.status}`);
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

    console.log(`🔄 JOB STATUS: Updating job status from '${oldStatus}' to '${status}'`);
    await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId));
    console.log(`✅ JOB STATUS: Job status updated successfully`);

    // Record status change in history (skip if table doesn't exist)
    try {
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
      console.log(`✅ JOB STATUS: Status history recorded`);
    } catch (historyError) {
      console.warn('⚠️ JOB STATUS: Could not save status history (table may not exist)');
    }

    console.log(`✅ JOB STATUS: Job ${jobId} status update completed successfully`);
    res.json({ success: true, message: "Job status updated successfully" });
  } catch (error) {
    console.error("❌ JOB STATUS: Failed to change job status:", error);
    if (error instanceof z.ZodError) {
      console.error("❌ JOB STATUS: Validation error:", error.errors);
      return res.status(400).json({ success: false, error: "Invalid request data", details: error.errors });
    }
    res.status(500).json({ success: false, error: "Failed to change job status" });
  }
});

// Move application through pipeline stages
const moveApplicationSchema = z.object({
  newStage: z.enum(['new', 'screening', 'qualified', 'interviewing', 'reference_check', 'offer', 'hired', 'rejected', 'withdrawn']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/applications/:id/move", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const expressReq = req as any; // Type assertion to access Express properties
    const applicationId = parseInt(expressReq.params.id);
    const user = req.user!;
    const { newStage, reason, notes } = moveApplicationSchema.parse(expressReq.body);
    
    console.log(`🔄 MOVE APPLICATION: ID ${applicationId} to stage '${newStage}' by user ${user.id}`);

    const { db } = await getDB();

    // Get application details
    const application = await db.select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .get();

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // Check permissions (simplified for super_admin)
    if (user.role !== 'super_admin' && user.role !== 'org_admin') {
      return res.status(403).json({ success: false, error: "Not authorized to move candidates" });
    }

    const oldStage = application.currentStage;
    console.log(`🔄 MOVE APPLICATION: Moving from '${oldStage}' to '${newStage}'`);

    // Update application status
    await db.update(applications)
      .set({
        status: newStage,
        currentStage: newStage,
        lastStageChangeAt: new Date().toISOString(),
        lastStageChangedBy: user.id,
        updatedAt: new Date().toISOString(),
        notes: notes ? `${application.notes || ''}\n${new Date().toISOString()}: ${notes}` : application.notes,
      })
      .where(eq(applications.id, applicationId));
      
    console.log(`✅ MOVE APPLICATION: Successfully updated application ${applicationId}`);

    // Record status change in history (skip if table doesn't exist)
    try {
      await db.insert(statusHistory).values({
        organizationId: user.organizationId,
        entityType: 'application',
        entityId: applicationId,
        oldStatus: oldStage,
        newStatus: newStage,
        changedBy: user.id,
        reason,
        notes,
      });
    } catch (historyError) {
      console.warn('⚠️ MOVE APPLICATION: Could not save status history (table may not exist)');
    }

    console.log(`✅ MOVE APPLICATION: Application ${applicationId} moved successfully`);
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
    const expressReq = req as any; // Type assertion to access Express properties
    const user = req.user!;
    const { jobId, candidateId, source, notes } = createApplicationSchema.parse(expressReq.body);

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