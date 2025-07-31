import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, type AuthRequest } from "./auth";
import { initializeSQLiteDatabase } from "./init-database";

const router = Router();

// Simplified pipeline routes without drizzle ORM
// This is a placeholder implementation for pipeline functionality

interface UserPermissions {
  canViewJob: boolean;
  canEditJob: boolean;
  canMoveCandidates: boolean;
  canScheduleInterviews: boolean;
  canMakeDecisions: boolean;
  canViewAnalytics: boolean;
}

// Pipeline permissions helper (simplified)
async function getUserPermissions(userId: number, jobId: number, userRole: string): Promise<UserPermissions> {
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

  // Basic permissions for other roles (can be enhanced later)
  return {
    canViewJob: true,
    canEditJob: userRole === 'org_admin' || userRole === 'manager',
    canMoveCandidates: userRole === 'org_admin' || userRole === 'manager',
    canScheduleInterviews: true,
    canMakeDecisions: userRole === 'org_admin' || userRole === 'manager',
    canViewAnalytics: userRole === 'org_admin' || userRole === 'manager'
  };
}

// GET /pipeline/jobs - Get jobs for pipeline view
router.get("/jobs", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sqlite = await initializeSQLiteDatabase();
    
    // Get jobs for the user's organization
    const jobs = sqlite.prepare(`
      SELECT * FROM jobs 
      WHERE organization_id = ? 
      ORDER BY created_at DESC
    `).all(req.user!.organizationId);

    res.json({
      success: true,
      jobs: jobs
    });
  } catch (error) {
    console.error('Get pipeline jobs error:', error);
    res.status(500).json({ message: 'Failed to get pipeline jobs' });
  }
});

// GET /pipeline/candidates - Get candidates for pipeline view
router.get("/candidates", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sqlite = await initializeSQLiteDatabase();
    
    // Get candidates for the user's organization
    const candidates = sqlite.prepare(`
      SELECT * FROM candidates 
      WHERE organization_id = ? 
      ORDER BY created_at DESC
    `).all(req.user!.organizationId);

    res.json({
      success: true,
      candidates: candidates
    });
  } catch (error) {
    console.error('Get pipeline candidates error:', error);
    res.status(500).json({ message: 'Failed to get pipeline candidates' });
  }
});

// PUT /pipeline/jobs/:id/status - Update job status
router.put("/jobs/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sqlite = await initializeSQLiteDatabase();
    const jobId = parseInt(req.params.id);
    const { status } = req.body;

    // Update job status
    sqlite.prepare(`
      UPDATE jobs 
      SET status = ?, updated_at = ? 
      WHERE id = ? AND organization_id = ?
    `).run(status, new Date().toISOString(), jobId, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Job status updated successfully'
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ message: 'Failed to update job status' });
  }
});

// PUT /pipeline/candidates/:id/status - Update candidate status
router.put("/candidates/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sqlite = await initializeSQLiteDatabase();
    const candidateId = parseInt(req.params.id);
    const { status } = req.body;

    // Update candidate status
    sqlite.prepare(`
      UPDATE candidates 
      SET status = ?, updated_at = ? 
      WHERE id = ? AND organization_id = ?
    `).run(status, new Date().toISOString(), candidateId, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Candidate status updated successfully'
    });
  } catch (error) {
    console.error('Update candidate status error:', error);
    res.status(500).json({ message: 'Failed to update candidate status' });
  }
});

// GET /pipeline/stats - Get pipeline statistics
router.get("/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sqlite = await initializeSQLiteDatabase();
    
    // Get basic stats for the organization
    const jobStats = sqlite.prepare(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      WHERE organization_id = ? 
      GROUP BY status
    `).all(req.user!.organizationId);

    const candidateStats = sqlite.prepare(`
      SELECT status, COUNT(*) as count 
      FROM candidates 
      WHERE organization_id = ? 
      GROUP BY status
    `).all(req.user!.organizationId);

    res.json({
      success: true,
      stats: {
        jobs: jobStats,
        candidates: candidateStats
      }
    });
  } catch (error) {
    console.error('Get pipeline stats error:', error);
    res.status(500).json({ message: 'Failed to get pipeline stats' });
  }
});

export default router;