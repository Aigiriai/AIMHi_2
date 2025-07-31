import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./sqlite-storage-simple";
import { insertJobSchema, insertCandidateSchema, insertInterviewSchema } from "./sqlite-schema";
import { matchCandidateToJob, batchMatchCandidates } from "./ai-matching";
import { extractResumeDataFromImage } from "./image-processing";
import { JobBoardService } from "./job-board-integrations";
import { processDocuments, extractTextFromDocument, extractResumeDetails } from "./document-processing";
import { createJobTemplate } from "./jd-template-analyzer";
import authRoutes from "./auth-routes";
import settingsRoutes from "./settings-routes";
import pipelineRoutes from "./pipeline-routes";
import { authenticateToken, requireOrganization, type AuthRequest } from "./auth";
import { initializeSQLiteDatabase } from "./init-database";
import { initializeMultiTenantSystem } from "./seed-demo";
import multer from "multer";
import { getDirectDomain } from "./index";
import { createIncomingCallTwiML, createOutboundCallTwiML, setCallContext, prepareCallContext } from "./ai-calling";
import twilio from "twilio";
import fs from "fs";
import path from "path";
import { FileStorageService } from "./file-storage";

// Simple text similarity calculation using word overlap
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let commonWords = 0;
  const wordsSet2 = new Set(words2);
  
  for (const word of words1) {
    if (wordsSet2.has(word)) {
      commonWords++;
    }
  }
  
  const totalWords = words1.length + words2.length;
  return totalWords === 0 ? 0 : (2 * commonWords) / totalWords;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 50, // Allow up to 50 files
  },
  fileFilter: (req: any, file: any, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'text/plain' // .txt
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word (.doc/.docx), text (.txt), and image files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const jobBoardService = new JobBoardService();
  const fileStorage = new FileStorageService();

  // Initialize multi-tenant system on startup
  // initializeMultiTenantSystem().catch(console.error); // Disabled to avoid drizzle conflicts

  // Test endpoint for AI matching demonstration
  app.post('/api/test-ai-match', async (req, res) => {
    try {
      const { job, candidate } = req.body;
      
      if (!job || !candidate) {
        return res.status(400).json({ error: 'Job and candidate data required' });
      }

      // Use the AI matching function to analyze the match
      const result = await matchCandidateToJob(job, candidate);
      
      res.json({
        matchPercentage: result.matchPercentage,
        reasoning: result.reasoning,
        criteriaScores: result.criteriaScores,
        weightedScores: result.weightedScores,
        analysis: {
          job: {
            title: job.title,
            keywords: job.keywords
          },
          candidate: {
            name: candidate.name,
            experience: candidate.experience
          }
        }
      });
    } catch (error) {
      console.error('Test AI matching error:', error);
      res.status(500).json({ error: 'Failed to test AI matching' });
    }
  });

  // Generate batch AI matches for organization
  app.post('/api/matches/batch-generate', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;

      console.log(`🎯 BATCH GENERATE: Starting batch matching for organization ${organizationId}`);

      // Get all jobs and candidates for the organization
      const jobs = await storage.getJobsByOrganization(organizationId);
      const candidates = await storage.getCandidatesByOrganization(organizationId);

      console.log(`🎯 BATCH GENERATE: Found ${jobs.length} jobs and ${candidates.length} candidates`);

      if (jobs.length === 0 || candidates.length === 0) {
        return res.json({
          success: true,
          message: "No jobs or candidates found to match",
          generated: 0
        });
      }

      let generatedCount = 0;
      let errors = [];

      // Generate matches for each job-candidate combination
      for (const job of jobs) {
        for (const candidate of candidates) {
          try {
            // Check if match already exists
            const sqlite = await initializeSQLiteDatabase();
            const existingMatch = sqlite.prepare(`
              SELECT * FROM job_matches 
              WHERE job_id = ? AND candidate_id = ? 
              LIMIT 1
            `).get(job.id, candidate.id);

            if (existingMatch) {
              console.log(`⏭️ BATCH GENERATE: Match already exists for job ${job.id} + candidate ${candidate.id}`);
              continue;
            }

            // Generate new match
            console.log(`🎯 BATCH GENERATE: Creating match for job ${job.id} (${job.title}) + candidate ${candidate.id} (${candidate.name})`);
            
            const matchResult = await matchCandidateToJob(job, candidate);

            if (matchResult) {
              // Store the match result in database with proper user tracking
              await storage.createJobMatch({
                organizationId: currentUser.organizationId!,
                jobId: job.id,
                candidateId: candidate.id,
                matchedBy: currentUser.id, // CRITICAL: Track who created the match
                matchPercentage: matchResult.matchPercentage,
                aiReasoning: matchResult.reasoning,
                matchCriteria: JSON.stringify({
                  criteriaScores: matchResult.criteriaScores,
                  weightedScores: matchResult.weightedScores,
                  skillAnalysis: matchResult.skillAnalysis
                }),
                status: 'pending'
              });
              
              generatedCount++;
              console.log(`✅ BATCH GENERATE: Generated match with ${matchResult.matchPercentage}% score for user ${currentUser.id}`);
            }

          } catch (error) {
            console.error(`❌ BATCH GENERATE: Error matching job ${job.id} + candidate ${candidate.id}:`, error);
            errors.push(`Job ${job.title} + ${candidate.name}: ${error.message}`);
          }
        }
      }

      console.log(`🎯 BATCH GENERATE: Completed. Generated ${generatedCount} new matches`);

      res.json({
        success: true,
        message: `Generated ${generatedCount} new AI matches`,
        generated: generatedCount,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error('❌ BATCH GENERATE ERROR:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate batch matches",
        error: error.message 
      });
    }
  });

  // Authentication routes
  app.use('/api/auth', authRoutes);
  
  // Settings routes
  app.use('/api/settings', settingsRoutes);
  
  // Pipeline routes
  app.use('/api/pipeline', pipelineRoutes);

  // Users management routes
  app.get('/api/users', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      // Get all users by organization for total count
      const allOrgUsers = await storage.getUsersByOrganization(currentUser.organizationId!);
      const totalUsers = allOrgUsers.length;
      
      // Apply pagination
      const paginatedUsers = allOrgUsers.slice(offset, offset + limit);
      
      // Get organization name
      const organization = await storage.getOrganization(currentUser.organizationId!);
      const organizationName = organization?.name || 'Unknown Organization';

      // Format the response
      const formattedUsers = paginatedUsers.map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        hasTemporaryPassword: user.hasTemporaryPassword,
        temporaryPassword: user.temporaryPassword,
        organizationName,
        status: 'active'
      }));

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalUsers / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      res.json({
        users: formattedUsers,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
          hasNext,
          hasPrev
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Team routes
  app.post('/api/teams', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const { name, description, department } = req.body;
      const currentUser = req.user!;

      // Validate required fields
      if (!name || !department) {
        return res.status(400).json({ message: 'Team name and department are required' });
      }

      // Check if team with this name already exists in the organization
      const sqlite = await initializeSQLiteDatabase();
      const existingTeam = sqlite.prepare(`
        SELECT * FROM teams 
        WHERE name = ? AND organization_id = ? 
        LIMIT 1
      `).get(name, currentUser.organizationId!);

      if (existingTeam) {
        return res.status(400).json({ message: `Team with name "${name}" already exists in this organization` });
      }

      // Create the team
      const result = sqlite.prepare(`
        INSERT INTO teams (organization_id, name, description, manager_id, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        currentUser.organizationId!,
        name,
        description || '',
        currentUser.id,
        JSON.stringify({
          autoAssignJobs: false,
          requireApproval: true,
          defaultInterviewDuration: 60
        }),
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      const newTeam = sqlite.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);

      res.json({
        message: 'Team created successfully',
        team: {
          id: newTeam.id,
          name: newTeam.name,
          description: newTeam.description,
          department
        }
      });
    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({ message: 'Failed to create team' });
    }
  });

  // Job routes
  app.post('/api/jobs', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      
      // Check if user has permission to create jobs (recruiters cannot create jobs)
      if (currentUser.role === 'recruiter') {
        return res.status(403).json({ 
          message: "You don't have permission to create jobs. Only Super Admin, Org Admin, and Hiring Manager can create jobs." 
        });
      }
      
      // Add organization context from authenticated user
      const completeData = {
        ...req.body,
        organizationId: currentUser.organizationId,
        createdBy: currentUser.id
      };
      
      const jobData = insertJobSchema.parse(completeData);
      const job = await storage.createJob(jobData);
      
      // Automatically generate job template after successful job creation
      try {
        console.log(`🔄 Generating template for job: ${job.title}`);
        const templateData = await createJobTemplate(
          job.id,
          job.organizationId,
          job.title,
          job.description,
          job.experienceLevel,
          job.jobType,
          job.keywords
        );
        
        await storage.createJobTemplate(templateData);
        console.log(`✅ Template generated successfully for job ID: ${job.id}`);
      } catch (templateError) {
        console.error(`❌ Template generation failed for job ID: ${job.id}`, templateError);
        // Continue with job creation even if template generation fails
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("Error creating job:", error);
      res.status(400).json({ message: error.message || "Failed to create job" });
    }
  });

  // Bulk job posting from files
  app.post('/api/jobs/bulk-upload', authenticateToken, requireOrganization, upload.array('files', 50), async (req: AuthRequest, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      console.log('Processing files:', files.length);
      const { jobDescriptions, ignored } = await processDocuments(files);
      console.log('Job descriptions found:', jobDescriptions.length);
      console.log('Ignored files:', ignored.length);
      
      const createdJobs = [];
      const errors = [];

      for (const jobDoc of jobDescriptions) {
        try {
          console.log('Processing job doc:', jobDoc.filename);
          console.log('Extracted data:', jobDoc.extractedData);
          
          // Find the original file to store it
          const originalFile = files.find(f => f.originalname === jobDoc.filename);
          
          // Add organization context from authenticated user
          const completeData = {
            ...jobDoc.extractedData,
            organizationId: req.user!.organizationId,
            createdBy: req.user!.id,
            originalFileName: originalFile?.originalname
          };
          
          console.log('Complete data before validation:', completeData);
          const jobData = insertJobSchema.parse(completeData);
          console.log('Validated job data:', jobData);
          
          const job = await storage.createJob(jobData);
          
          // Store the original file if found
          if (originalFile && job.id) {
            try {
              await fileStorage.storeJobFile(job.id, originalFile.originalname, originalFile.buffer);
              console.log(`✅ Stored original file for job ${job.id}: ${originalFile.originalname}`);
            } catch (fileError) {
              console.error(`❌ Failed to store original file for job ${job.id}:`, fileError);
            }
          }
          
          // Automatically generate job template after successful job creation
          try {
            console.log(`🔄 Generating template for job: ${job.title}`);
            const templateData = await createJobTemplate(
              job.id,
              job.organizationId,
              job.title,
              job.description,
              job.experienceLevel,
              job.jobType,
              job.keywords
            );
            
            await storage.createJobTemplate(templateData);
            console.log(`✅ Template generated successfully for job ID: ${job.id}`);
          } catch (templateError) {
            console.error(`❌ Template generation failed for job ID: ${job.id}`, templateError);
            // Continue with job creation even if template generation fails
          }
          
          createdJobs.push({ filename: jobDoc.filename, job });
        } catch (error: any) {
          console.error('Error processing job doc:', jobDoc.filename, error);
          errors.push({ filename: jobDoc.filename, error: error.message });
        }
      }

      res.json({
        message: `Processed ${files.length} files`,
        created: createdJobs.length,
        ignored: ignored.length,
        errors: errors.length,
        details: {
          createdJobs,
          ignoredFiles: ignored,
          errors
        }
      });
    } catch (error: any) {
      console.error("Error in bulk job upload:", error);
      res.status(500).json({ message: error.message || "Failed to process files" });
    }
  });

  // Job file download endpoint
  app.get('/api/jobs/:id/download', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const currentUser = req.user!;

      // Get the job to verify access and get filename
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!job.originalFileName) {
        return res.status(404).json({ message: "Original job file not available" });
      }

      // Get the file from storage
      const fileData = await fileStorage.getJobFile(jobId, job.originalFileName);
      
      if (!fileData) {
        return res.status(404).json({ message: "Job file not found" });
      }

      // Determine content type based on file extension
      const ext = path.extname(job.originalFileName).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.doc':
          contentType = 'application/msword';
          break;
        case '.docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        case '.txt':
          contentType = 'text/plain';
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${job.originalFileName}"`);
      res.send(fileData);
    } catch (error) {
      console.error("Error downloading job file:", error);
      res.status(500).json({ message: "Failed to download job file" });
    }
  });

  app.get('/api/jobs', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      console.log(`Fetching jobs for organization: ${currentUser.organizationId}`);
      
      // Get database connection
      const sqlite = await initializeSQLiteDatabase();
      
      // Role-based job filtering with detailed permission matrix
      let jobs;
      
      if (['super_admin', 'org_admin'].includes(currentUser.role)) {
        // Super admin and org admin can see all jobs in their organization
        jobs = sqlite.prepare(`
          SELECT * FROM jobs 
          WHERE organization_id = ? 
          ORDER BY created_at DESC
        `).all(currentUser.organizationId!);
      } else {
        // For Manager, Team Lead, and Recruiter: only see jobs they created or are assigned to
        const assignedJobIds = sqlite.prepare(`
          SELECT job_id FROM job_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const assignedIds = assignedJobIds.map((a: any) => a.job_id);
        
        if (assignedIds.length > 0) {
          // Get jobs where user is either the creator OR has an assignment
          const placeholders = assignedIds.map(() => '?').join(',');
          jobs = sqlite.prepare(`
            SELECT * FROM jobs 
            WHERE organization_id = ? AND (created_by = ? OR id IN (${placeholders}))
            ORDER BY created_at DESC
          `).all(currentUser.organizationId!, currentUser.id, ...assignedIds);
        } else {
          // Only jobs they created
          jobs = sqlite.prepare(`
            SELECT * FROM jobs 
            WHERE organization_id = ? AND created_by = ?
            ORDER BY created_at DESC
          `).all(currentUser.organizationId!, currentUser.id);
        }
      }
      console.log(`Retrieved organization jobs: ${jobs.length}`);
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.get('/api/jobs/:id/template', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const template = await storage.getJobTemplate(jobId);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching job template:", error);
      res.status(500).json({ message: "Failed to fetch job template" });
    }
  });

  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Get job deletion impact (what will be deleted)
  app.get('/api/jobs/:id/deletion-impact', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const jobId = parseInt(req.params.id);
      
      // Only super_admin and org_admin can access deletion impact (force delete restriction)
      if (!['super_admin', 'org_admin'].includes(currentUser.role)) {
        return res.status(403).json({ 
          message: "Only Super Administrators and Organization Administrators can delete jobs." 
        });
      }
      
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const impact = await storage.getJobDeletionImpact(jobId);
      res.json({
        jobId,
        jobTitle: job.title,
        impact
      });
    } catch (error) {
      console.error("Error getting job deletion impact:", error);
      res.status(500).json({ message: "Failed to get deletion impact" });
    }
  });

  app.delete('/api/jobs/:id', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const jobId = parseInt(req.params.id);
      
      // Only super_admin and org_admin can force delete jobs
      if (!['super_admin', 'org_admin'].includes(currentUser.role)) {
        return res.status(403).json({ 
          message: "Only Super Administrators and Organization Administrators can delete jobs." 
        });
      }
      
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Perform force delete with cascade deletion
      await storage.deleteJob(jobId);
      
      // Also delete the original file if it exists
      if (job.originalFileName) {
        try {
          const { FileStorageService } = await import('./file-storage');
          const fileStorage = new FileStorageService();
          await fileStorage.deleteJobFile(jobId);
          console.log(`🗑️ FORCE DELETE: Deleted original file for job ${jobId}`);
        } catch (fileError) {
          console.error(`⚠️ FORCE DELETE: Failed to delete original file for job ${jobId}:`, fileError);
          // Continue with deletion even if file deletion fails
        }
      }
      
      res.json({ message: "Job and all related data deleted successfully" });
    } catch (error) {
      console.error("Error in force delete job:", error);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // Candidate routes
  app.post('/api/candidates', authenticateToken, requireOrganization, upload.single('resume'), async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      
      if (!req.file) {
        return res.status(400).json({ message: "Resume file is required" });
      }

      let candidateData;
      
      // Handle various document types
      if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(req.file.mimetype)) {
        // Extract text content directly and treat as resume (since this is the candidate upload endpoint)
        const content = await extractTextFromDocument(req.file.buffer, req.file.originalname, req.file.mimetype);
        
        if (content.trim().length < 50) {
          return res.status(400).json({ message: "File content is too short to be a valid resume" });
        }

        // Extract resume details directly (this endpoint is specifically for resumes)
        const resumeDetails = await extractResumeDetails(content, req.file.originalname, req.file.buffer);
        candidateData = resumeDetails;
      } else {
        // For image files, extract data using OpenAI
        const extractedData = await extractResumeDataFromImage(req.file.buffer);
        candidateData = {
          name: req.body.name || extractedData.name,
          email: req.body.email || extractedData.email,
          phone: req.body.phone || extractedData.phone,
          experience: parseInt(req.body.experience) || extractedData.experience,
          resumeContent: extractedData.resumeContent,
          resumeFileName: req.file.originalname
        };
      }

      // Check for duplicate by email within the same organization
      const existingCandidate = await storage.getCandidateByEmail(candidateData.email);
      const forceOverwrite = req.body.forceOverwrite === 'true';
      
      if (existingCandidate && existingCandidate.organizationId === req.user!.organizationId && !forceOverwrite) {
        // Check if resume content is significantly different
        const existingContent = existingCandidate.resumeContent.toLowerCase().replace(/\s+/g, ' ').trim();
        const newContent = candidateData.resumeContent.toLowerCase().replace(/\s+/g, ' ').trim();
        
        const similarity = calculateSimilarity(existingContent, newContent);
        
        return res.status(409).json({
          isDuplicate: true,
          message: `Candidate with email ${candidateData.email} already exists`,
          existingCandidate: {
            id: existingCandidate.id,
            name: existingCandidate.name,
            email: existingCandidate.email
          },
          similarity: Math.round(similarity * 100),
          contentAnalysis: similarity > 0.9 ? 'very_similar' : 'different',
          suggestion: similarity > 0.9 
            ? "Resume content is very similar to existing candidate. Consider if this is truly a new candidate."
            : "Resume content appears to be updated. This might be a legitimate resume update.",
          allowOverwrite: true
        });
      }

      // Add organization context from authenticated user
      const completeData = {
        ...candidateData,
        organizationId: req.user!.organizationId,
        addedBy: req.user!.id
      };

      const parsedData = insertCandidateSchema.parse(completeData);
      
      // If overwriting, update the existing candidate instead of creating new
      if (forceOverwrite && existingCandidate) {
        // Store the original file in file storage
        const { FileStorageService } = await import('./file-storage');
        const fileStorage = new FileStorageService();
        await fileStorage.storeResumeFile(existingCandidate.id, parsedData.resumeFileName, req.file.buffer);
        
        await storage.updateCandidate(existingCandidate.id, {
          name: parsedData.name,
          phone: parsedData.phone,
          experience: parsedData.experience,
          resumeContent: parsedData.resumeContent,
          resumeFileName: parsedData.resumeFileName,
          updatedAt: new Date()
        });
        
        const updatedCandidate = await storage.getCandidate(existingCandidate.id);
        res.json({ 
          ...updatedCandidate, 
          wasUpdated: true,
          message: "Candidate profile updated with new resume"
        });
      } else {
        const candidate = await storage.createCandidate(parsedData);
        
        // Store the original file in file storage
        const { FileStorageService } = await import('./file-storage');
        const fileStorage = new FileStorageService();
        await fileStorage.storeResumeFile(candidate.id, parsedData.resumeFileName, req.file.buffer);
        
        // Different messaging based on user role
        const responseMessage = ['team_lead', 'recruiter'].includes(currentUser.role) 
          ? "Candidate uploaded successfully! Your submission will be reviewed by managers for assignment to jobs. Please follow up with your HR manager for status updates."
          : "Candidate uploaded successfully!";
        
        res.json({ 
          ...candidate, 
          message: responseMessage 
        });
      }
    } catch (error: any) {
      console.error("Error creating candidate:", error);
      res.status(400).json({ message: error.message || "Failed to create candidate" });
    }
  });

  // Bulk candidate upload from files
  app.post('/api/candidates/bulk-upload', authenticateToken, requireOrganization, upload.array('files', 50), async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const forceOverwrite = req.body.forceOverwrite === 'true';

      // All files uploaded to resume endpoint are treated as resumes
      const resumes = [];
      const ignored = [];

      for (const file of files) {
        try {
          const content = await extractTextFromDocument(file.buffer, file.originalname, file.mimetype);
          
          if (content.trim().length < 50) {
            ignored.push(file.originalname);
            continue;
          }

          // Always treat as resume since this is the resume upload endpoint
          const resumeDetails = await extractResumeDetails(content, file.originalname, file.buffer);
          resumes.push({
            filename: file.originalname,
            content,
            isResume: true,
            extractedData: resumeDetails,
            buffer: file.buffer // Store the original buffer for file storage
          });
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          ignored.push(file.originalname);
        }
      }
      
      console.log(`Document processing results: ${resumes.length} resumes, ${ignored.length} ignored`);
      if (resumes.length > 0) {
        console.log('Resume details:', resumes.map(r => ({ filename: r.filename, hasData: !!r.extractedData })));
      }
      
      const createdCandidates = [];
      const errors = [];
      const skippedDuplicates = [];

      for (const resumeDoc of resumes) {
        try {
          console.log(`Processing resume: ${resumeDoc.filename}`);
          console.log(`Extracted data:`, resumeDoc.extractedData);
          
          // Check for true duplicates: same email, name, AND phone number
          const existingCandidate = await storage.getCandidateByEmail(resumeDoc.extractedData.email);
          if (existingCandidate && existingCandidate.organizationId === req.user!.organizationId) {
            // Only treat as duplicate if email, name, and phone all match
            const nameMatch = existingCandidate.name.toLowerCase().trim() === resumeDoc.extractedData.name.toLowerCase().trim();
            const phoneMatch = existingCandidate.phone.replace(/\D/g, '') === resumeDoc.extractedData.phone.replace(/\D/g, '');
            
            if (nameMatch && phoneMatch) {
              if (!forceOverwrite) {
                // True duplicate found - all three fields match
                console.log(`True duplicate found: ${resumeDoc.extractedData.name} (${resumeDoc.extractedData.email}) - same name, email, and phone`);
                skippedDuplicates.push({ 
                  filename: resumeDoc.filename, 
                  reason: `Candidate with same name, email, and phone already exists`,
                  existingCandidate: existingCandidate.name,
                  isDuplicate: true,
                  canOverwrite: true
                });
                continue;
              } else {
                // Force overwrite - update existing candidate
                // Store the original file in file storage
                const { FileStorageService } = await import('./file-storage');
                const fileStorage = new FileStorageService();
                await fileStorage.storeResumeFile(existingCandidate.id, resumeDoc.extractedData.resumeFileName, resumeDoc.buffer);
                
                await storage.updateCandidate(existingCandidate.id, {
                  name: resumeDoc.extractedData.name,
                  phone: resumeDoc.extractedData.phone,
                  experience: resumeDoc.extractedData.experience,
                  resumeContent: resumeDoc.extractedData.resumeContent,
                  resumeFileName: resumeDoc.extractedData.resumeFileName,
                  updatedAt: new Date()
                });
                
                const updatedCandidate = await storage.getCandidate(existingCandidate.id);
                createdCandidates.push({ 
                  filename: resumeDoc.filename, 
                  candidate: { ...updatedCandidate, wasUpdated: true }
                });
                continue;
              }
            } else {
              // Different name or phone - not a duplicate, proceed with creation
              console.log(`Not a duplicate: ${resumeDoc.extractedData.name} has same email as ${existingCandidate.name} but different name/phone`);
            }
          }
          
          // Add organization context from authenticated user
          const completeData = {
            ...resumeDoc.extractedData,
            organizationId: req.user!.organizationId,
            addedBy: req.user!.id
          };
          
          console.log(`Complete data for validation:`, completeData);
          
          const candidateData = insertCandidateSchema.parse(completeData);
          console.log(`Validated candidate data:`, candidateData);
          
          const candidate = await storage.createCandidate(candidateData);
          console.log(`Created candidate:`, candidate);
          
          // Store the original file in file storage
          const { FileStorageService } = await import('./file-storage');
          const fileStorage = new FileStorageService();
          await fileStorage.storeResumeFile(candidate.id, resumeDoc.extractedData.resumeFileName, resumeDoc.buffer);
          
          createdCandidates.push({ filename: resumeDoc.filename, candidate });
        } catch (error: any) {
          console.error(`Error processing ${resumeDoc.filename}:`, error);
          errors.push({ filename: resumeDoc.filename, error: error.message });
        }
      }

      // Different messaging based on user role
      const baseMessage = `Processed ${files.length} files`;
      const roleSpecificMessage = ['team_lead', 'recruiter'].includes(currentUser.role) 
        ? `${baseMessage}. Your submissions will be reviewed by managers for assignment to jobs. Please follow up with your HR manager for status updates.`
        : baseMessage;

      res.json({
        message: roleSpecificMessage,
        created: createdCandidates.length,
        ignored: ignored.length,
        skipped: skippedDuplicates.length,
        errors: errors.length,
        details: {
          createdCandidates,
          ignoredFiles: ignored,
          skippedDuplicates,
          errors
        }
      });
    } catch (error: any) {
      console.error("Error in bulk candidate upload:", error);
      res.status(500).json({ message: error.message || "Failed to process files" });
    }
  });



  app.get('/api/candidates', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;
      
      console.log(`🔍 CANDIDATES: Fetching candidates for user ${currentUser.id} (${currentUser.role}) in org ${organizationId}`);
      
      let candidates;
      
      // Super admins and org admins see all candidates in the organization
      if (currentUser.role === 'super_admin' || currentUser.role === 'org_admin') {
        console.log(`👑 CANDIDATES: User has ${currentUser.role} role - showing all candidates`);
        candidates = await storage.getCandidatesByOrganization(organizationId);
      } else {
        // Manager role can see candidates they created or are assigned to
        if (currentUser.role === 'manager') {
          console.log(`👤 CANDIDATES: User has ${currentUser.role} role - showing created and assigned candidates`);
          
          // Get candidates created by this user
          const allCandidates = await storage.getCandidatesByOrganization(organizationId);
          const createdCandidates = allCandidates.filter(candidate => candidate.addedBy === currentUser.id);
          
          // Get candidate assignments for this user
          const sqlite = await initializeSQLiteDatabase();
          const assignedCandidateResults = sqlite.prepare(`
            SELECT candidate_id as candidateId FROM candidate_assignments 
            WHERE user_id = ?
          `).all(currentUser.id);
          
          const assignedCandidateIds = assignedCandidateResults.map((a: any) => a.candidateId);
          const assignedCandidates = allCandidates.filter(candidate => 
            assignedCandidateIds.includes(candidate.id)
          );
          
          // Combine and deduplicate
          const candidateMap = new Map();
          [...createdCandidates, ...assignedCandidates].forEach(candidate => {
            candidateMap.set(candidate.id, candidate);
          });
          
          candidates = Array.from(candidateMap.values());
          
          console.log(`🔍 CANDIDATES: Manager has access to ${candidates.length} candidates (${createdCandidates.length} created, ${assignedCandidates.length} assigned)`);
        } else {
          // Team Lead and Recruiter can ONLY see candidates assigned to them by managers
          console.log(`👤 CANDIDATES: User has ${currentUser.role} role - showing ONLY assigned candidates (no created candidates)`);
          
          const allCandidates = await storage.getCandidatesByOrganization(organizationId);
          
          // Get candidate assignments for this user
          const sqlite2 = await initializeSQLiteDatabase();
          const assignedCandidateResults2 = sqlite2.prepare(`
            SELECT candidate_id as candidateId FROM candidate_assignments 
            WHERE user_id = ?
          `).all(currentUser.id);
          
          const assignedCandidateIds = assignedCandidateResults2.map((a: any) => a.candidateId);
          candidates = allCandidates.filter(candidate => 
            assignedCandidateIds.includes(candidate.id)
          );
          
          console.log(`🔍 CANDIDATES: ${currentUser.role} has access to ${candidates.length} assigned candidates only`);
        }
      }
      
      res.json(candidates);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  });

  app.get('/api/candidates/:id', async (req, res) => {
    try {
      const candidate = await storage.getCandidate(parseInt(req.params.id));
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      console.error("Error fetching candidate:", error);
      res.status(500).json({ message: "Failed to fetch candidate" });
    }
  });

  app.get('/api/candidates/:id/resume', async (req, res) => {
    try {
      const candidate = await storage.getCandidate(parseInt(req.params.id));
      if (!candidate || !candidate.resume_file_name) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // Try to get the original file from file storage first
      const { FileStorageService } = await import('./file-storage');
      const fileStorage = new FileStorageService();
      const originalFile = await fileStorage.getResumeFile(candidate.id, candidate.resume_file_name);

      if (originalFile) {
        // Serve the original file with appropriate content type
        const fileExtension = candidate.resume_file_name.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';
        
        switch (fileExtension) {
          case 'pdf':
            contentType = 'application/pdf';
            break;
          case 'doc':
            contentType = 'application/msword';
            break;
          case 'docx':
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
          case 'txt':
            contentType = 'text/plain';
            break;
          case 'jpg':
          case 'jpeg':
            contentType = 'image/jpeg';
            break;
          case 'png':
            contentType = 'image/png';
            break;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${candidate.resume_file_name}"`);
        res.send(originalFile);
      } else {
        // Fallback to text content if original file not found
        if (!candidate.resume_content) {
          return res.status(404).json({ message: "Resume file not found" });
        }
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${candidate.resume_file_name}"`);
        res.send(candidate.resume_content);
      }
    } catch (error) {
      console.error("Error downloading resume:", error);
      res.status(500).json({ message: "Failed to download resume" });
    }
  });

  app.delete('/api/candidates/:id', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const candidate = await storage.getCandidate(candidateId);
      
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Verify candidate belongs to user's organization
      if (candidate.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteCandidate(candidateId);
      res.json({ message: "Candidate deleted successfully" });
    } catch (error) {
      console.error("Error deleting candidate:", error);
      res.status(500).json({ message: "Failed to delete candidate" });
    }
  });

  

  // Advanced AI Matching endpoint
  app.post('/api/matches/advanced', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const { jobId, minMatchPercentage = 15, weights, prioritizeRecent, strictMatchMode } = req.body;

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      const job = await storage.getJob(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get user-specific candidates based on role and assignments (same logic as /api/candidates)
      const currentUser = req.user!;
      let candidates;
      
      if (['super_admin', 'org_admin'].includes(currentUser.role)) {
        // Super admin and org admin can see all candidates in their organization
        candidates = await storage.getCandidatesByOrganization(currentUser.organizationId!);
      } else {
        // Other users see only candidates they created or are assigned to
        const allCandidates = await storage.getCandidatesByOrganization(currentUser.organizationId!);
        const createdCandidates = allCandidates.filter(candidate => candidate.addedBy === currentUser.id);
        
        // Get candidate assignments for this user
        const sqlite3 = await initializeSQLiteDatabase();
        const assignedCandidateResults = sqlite3.prepare(`
          SELECT candidate_id as candidateId FROM candidate_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const assignedCandidateIds = assignedCandidateResults.map((a: any) => a.candidateId);
        const assignedCandidates = allCandidates.filter(candidate => 
          assignedCandidateIds.includes(candidate.id)
        );
        
        // Combine and deduplicate
        const candidateMap = new Map();
        [...createdCandidates, ...assignedCandidates].forEach(candidate => {
          candidateMap.set(candidate.id, candidate);
        });
        
        candidates = Array.from(candidateMap.values());
      }
      
      if (candidates.length === 0) {
        return res.json({ matches: [], message: "No accessible candidates found", totalCandidates: 0, filteredCount: 0 });
      }

      // Clear existing matches for this job
      await storage.deleteJobMatchesByJobId(parseInt(jobId));

      // Use advanced matching with custom weights - add timeout to prevent hanging
      const matchingTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Advanced matching timeout - process took too long')), 5 * 60 * 1000); // 5 minute timeout
      });
      
      const matchResults = await Promise.race([
        batchMatchCandidates(job, candidates, weights),
        matchingTimeout
      ]) as any;
      
      // Apply filters based on advanced options - but also filter out invalid matches
      console.log('🔍 Pre-filter: Found', matchResults.length, 'total results');
      matchResults.forEach(match => {
        console.log('🔍 Candidate', match.candidateId, '- Match%:', match.matchPercentage, '- Valid:', !isNaN(match.matchPercentage) && match.matchPercentage >= minMatchPercentage);
      });
      
      let filteredMatches = matchResults.filter(match => {
        const isValidMatch = !isNaN(match.matchPercentage) && match.matchPercentage >= minMatchPercentage;
        if (!isValidMatch) {
          console.log('🚫 Filtering out candidate', match.candidateId, '- Match%:', match.matchPercentage, '- Reason:', isNaN(match.matchPercentage) ? 'NaN' : 'Below threshold');
        }
        return isValidMatch;
      });
      
      console.log('🔍 Post-filter: Found', filteredMatches.length, 'valid matches');
      
      // Sort by match percentage (highest first)
      filteredMatches.sort((a, b) => b.matchPercentage - a.matchPercentage);
      
      // Save matches to database
      console.log('💾 Saving', filteredMatches.length, 'matches to database');
      for (const match of filteredMatches) {
        console.log('💾 Processing match for candidate', match.candidateId, 'with', match.matchPercentage, '% match');
        console.log('💾 Match has skillAnalysis:', !!match.skillAnalysis);
        console.log('💾 SkillAnalysis keys:', match.skillAnalysis ? Object.keys(match.skillAnalysis) : 'none');
        
        const matchCriteriaToStore = {
          criteriaScores: match.criteriaScores,
          weightedScores: match.weightedScores,
          skillAnalysis: match.skillAnalysis
        };
        
        console.log('💾 Storing matchCriteria:', JSON.stringify(matchCriteriaToStore, null, 2));
        
        await storage.createJobMatch({
          organizationId: req.user!.organizationId,
          jobId: parseInt(jobId),
          candidateId: match.candidateId,
          matchedBy: req.user!.id,
          matchPercentage: match.matchPercentage,
          aiReasoning: match.reasoning,
          matchCriteria: JSON.stringify(matchCriteriaToStore),
          status: 'pending'
        });
        
        console.log('💾 Successfully stored match for candidate', match.candidateId);
      }

      // Create call contexts for ALL matches that passed the threshold
      if (filteredMatches.length > 0) {
        console.log(`🎯 Creating call contexts for ${filteredMatches.length} qualified matches`);
        
        // Import AI calling functions
        const aiCalling = await import('./ai-calling');
        const { prepareCallContext } = aiCalling;
        
        // Prepare contexts for all matches
        const allContexts: { [key: string]: { candidateName: string; jobDetails: any; matchPercentage?: number } } = {};
        
        for (const match of filteredMatches) {
          const candidate = candidates.find(c => c.id === match.candidateId);
          if (candidate) {
            console.log(`📞 Creating call context for: ${candidate.name} (${match.matchPercentage}%)`);
            const contextKey = `${candidate.name.replace(/\s+/g, '_')}_${job.id}`;
            allContexts[contextKey] = {
              candidateName: candidate.name,
              jobDetails: job,
              matchPercentage: match.matchPercentage
            };
          }
        }
        
        // Save all contexts to disk
        const { saveMultipleContextsToDisk } = aiCalling;
        saveMultipleContextsToDisk(allContexts);
        
        console.log(`✅ Call contexts created for all ${filteredMatches.length} qualified candidates`);
      }

      res.json({ 
        matches: filteredMatches,
        totalCandidates: candidates.length,
        filteredCount: filteredMatches.length,
        message: `Advanced matching completed. Found ${filteredMatches.length} candidates above ${minMatchPercentage}% threshold.`,
        weights: weights,
        options: {
          prioritizeRecent,
          strictMatchMode,
          minMatchPercentage
        }
      });
    } catch (error: any) {
      console.error("Error in advanced AI matching:", error);
      res.status(500).json({ message: error.message || "Failed to run advanced AI matching" });
    }
  });

  app.get('/api/matches', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const jobId = req.query.jobId ? parseInt(req.query.jobId as string) : undefined;
      const minPercentage = req.query.minPercentage ? parseFloat(req.query.minPercentage as string) : undefined;
      const currentUser = req.user!;
      
      console.log(`🔍 ROUTE: Getting matches with user-level filtering for user ${currentUser.id} (${currentUser.role})`);
      
      // Use role-based filtering instead of organization-only filtering
      const matches = await storage.getJobMatchesForUserRole(
        currentUser.id,
        currentUser.role,
        currentUser.organizationId!,
        jobId,
        minPercentage
      );
      
      console.log(`🔍 ROUTE: Got ${matches.length} matches for user ${currentUser.id} with role ${currentUser.role}`);
      if (matches.length > 0) {
        console.log('🔍 ROUTE: Sample match created by user:', matches[0].matchedBy);
      }
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  // Interview routes
  app.post('/api/interviews', async (req, res) => {
    try {
      const interviewData = insertInterviewSchema.parse(req.body);
      const interview = await storage.createInterview(interviewData);
      res.json(interview);
    } catch (error: any) {
      console.error("Error creating interview:", error);
      res.status(400).json({ message: error.message || "Failed to create interview" });
    }
  });

  app.get('/api/interviews', async (req, res) => {
    try {
      const interviews = await storage.getAllInterviews();
      res.json(interviews);
    } catch (error) {
      console.error("Error fetching interviews:", error);
      res.status(500).json({ message: "Failed to fetch interviews" });
    }
  });

  app.patch('/api/interviews/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateInterviewStatus(parseInt(req.params.id), status);
      res.json({ message: "Interview status updated successfully" });
    } catch (error) {
      console.error("Error updating interview status:", error);
      res.status(500).json({ message: "Failed to update interview status" });
    }
  });

  app.delete('/api/interviews/:id', async (req, res) => {
    try {
      await storage.deleteInterview(parseInt(req.params.id));
      res.json({ message: "Interview deleted successfully" });
    } catch (error) {
      console.error("Error deleting interview:", error);
      res.status(500).json({ message: "Failed to delete interview" });
    }
  });

  // AI Call route - with ngrok tunnel and OpenAI integration
  app.post('/api/initiate-ai-call', async (req, res) => {
    try {
      const { candidateName, phoneNumber, jobId } = req.body;
      console.log('🚀 Starting AI call initiation process...');
      
      if (!candidateName) {
        return res.status(400).json({ message: "Candidate name is required" });
      }
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      console.log('📞 Initiating AI call to:', candidateName, 'at', phoneNumber);
      console.log('📋 JobId received:', jobId, typeof jobId);

      // Get job details if jobId is provided
      let jobDetails = null;
      if (jobId) {
        try {
          const jobIdNumber = parseInt(jobId);
          console.log('📋 Parsed jobId as number:', jobIdNumber);
          jobDetails = await storage.getJob(jobIdNumber);
          console.log('💼 Retrieved job details:', jobDetails ? JSON.stringify(jobDetails, null, 2) : 'No job found');
        } catch (error) {
          console.warn('⚠️ Could not retrieve job details:', error);
        }
      } else {
        console.log('📋 No jobId provided');
      }

      // Check if required credentials are available
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.PHONE_NUMBER_FROM) {
        console.error('❌ Missing Twilio credentials');
        return res.status(500).json({ 
          message: "Twilio credentials not configured. Please contact administrator." 
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Missing OpenAI API key');
        return res.status(500).json({ 
          message: "OpenAI API key not configured. Please contact administrator." 
        });
      }

      // Get the direct domain for WebSocket connection (no tunnel required)
      const websocketDomain = getDirectDomain();
      console.log('🌐 Using direct domain:', websocketDomain);
      
      console.log('📋 TwiML WebSocket URL:', `wss://${websocketDomain}/media-stream`);

      // Initialize Twilio client
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Create TwiML that connects to our media stream
      const outboundTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${websocketDomain}/media-stream" />
  </Connect>
</Response>`;

      // Make the call using Twilio with WebSocket connection
      console.log('🔄 Creating Twilio call...');
      const call = await client.calls.create({
        to: phoneNumber,
        from: process.env.PHONE_NUMBER_FROM,
        twiml: outboundTwiML
      });

      console.log('✅ AI call initiated successfully:', call.sid);
      console.log('📋 Proceeding to store context...');
      
      // Check if we have a pre-stored context for this specific candidate
      const aiCalling = await import('./ai-calling');
      const { loadMultipleContextsFromDisk, setCallContext, prepareCallContext } = aiCalling;
      
      const multipleContexts = loadMultipleContextsFromDisk();
      let specificContext = null;
      
      // Look for this candidate's context in the multiple contexts
      for (const [key, context] of Object.entries(multipleContexts)) {
        if (context.candidateName === candidateName) {
          specificContext = context;
          console.log(`📋 Found pre-stored context for ${candidateName} with ${context.matchPercentage}% match`);
          break;
        }
      }
      
      // Use the specific context if found, otherwise create new one
      const contextToUse = specificContext ? specificContext.jobDetails : jobDetails;
      
      console.log('📋 About to store call context...');
      setCallContext(call.sid, candidateName, contextToUse);
      console.log('📋 Call context stored for:', candidateName);
      console.log('📋 Call SID for context:', call.sid);
      console.log('📋 Job details stored:', contextToUse?.title || 'No job details');
      
      // Set this as the ready context for immediate OpenAI connection
      prepareCallContext(candidateName, contextToUse);
      
      res.json({ 
        success: true, 
        message: `AI call initiated successfully to ${candidateName}`,
        callSid: call.sid,
        status: call.status,
        domain: websocketDomain
      });
    } catch (error: any) {
      console.error('❌ Error making AI call:', error);
      res.status(500).json({ 
        message: error.message || "Failed to initiate AI call" 
      });
    }
  });

  // Job Board Integration routes
  app.post('/api/job-boards/search', async (req, res) => {
    try {
      const { query, location, limit = 10 } = req.body;
      const results = await jobBoardService.searchAllPlatforms(query, location, limit);
      res.json(results);
    } catch (error: any) {
      console.error("Error searching job boards:", error);
      res.status(500).json({ message: error.message || "Failed to search job boards" });
    }
  });

  app.post('/api/job-boards/post', async (req, res) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const results = await jobBoardService.postToAllPlatforms(jobData);
      res.json(results);
    } catch (error: any) {
      console.error("Error posting to job boards:", error);
      res.status(500).json({ message: error.message || "Failed to post to job boards" });
    }
  });

  app.get('/api/job-boards/credentials', async (req, res) => {
    try {
      const status = jobBoardService.checkCredentialsStatus();
      res.json(status);
    } catch (error) {
      console.error("Error checking credentials:", error);
      res.status(500).json({ message: "Failed to check credentials" });
    }
  });

  // Data Management routes - Updated with user-level isolation
  app.delete('/api/matches', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const clearAll = req.query.clearAll === 'true';
      
      if (clearAll && (currentUser.role === 'org_admin' || currentUser.role === 'super_admin')) {
        // Only org admins and super admins can clear all matches in organization
        await storage.clearAllMatches();
        console.log(`🗑️ All matches cleared by ${currentUser.role} user ${currentUser.id}`);
      } else {
        // Clear only matches created by the current user
        await storage.clearMatchesByUser(currentUser.id, currentUser.organizationId!);
        console.log(`🗑️ Matches cleared for user ${currentUser.id} in organization ${currentUser.organizationId}`);
      }
      
      // Clear call context when matches are cleared
      const { clearCallContext } = await import('./ai-calling');
      clearCallContext('all');
      console.log("🗑️ Call context cleared along with AI matches");
      
      res.json({ message: "Matches cleared successfully" });
    } catch (error) {
      console.error("Error clearing matches:", error);
      res.status(500).json({ message: "Failed to clear matches" });
    }
  });

  app.delete('/api/jobs', async (req, res) => {
    try {
      await storage.deleteAllJobs();
      res.json({ message: "All jobs deleted successfully" });
    } catch (error) {
      console.error("Error deleting jobs:", error);
      res.status(500).json({ message: "Failed to delete jobs" });
    }
  });

  app.delete('/api/candidates', async (req, res) => {
    try {
      await storage.deleteAllCandidates();
      res.json({ message: "All candidates deleted successfully" });
    } catch (error) {
      console.error("Error deleting candidates:", error);
      res.status(500).json({ message: "Failed to delete candidates" });
    }
  });

  // Stats route with permission-based filtering
  app.get('/api/stats', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      console.log(`📊 STATS: Calculating user-specific stats for user ${currentUser.id} (${currentUser.role}) in organization ${currentUser.organizationId}`);
      
      // Get database connection for permission-based filtering
      const sqlite = await initializeSQLiteDatabase();
      
      // Get user's accessible job IDs based on role and assignments
      let accessibleJobIds: number[] = [];
      
      if (['super_admin', 'org_admin'].includes(currentUser.role)) {
        // Super admin and org admin can see all jobs in their organization
        const allJobs = sqlite.prepare(`
          SELECT id FROM jobs WHERE organization_id = ?
        `).all(currentUser.organizationId!);
        accessibleJobIds = allJobs.map((job: any) => job.id);
      } else {
        // For Manager, Team Lead, and Recruiter: only jobs they created or are assigned to
        const assignedJobIds = sqlite.prepare(`
          SELECT job_id FROM job_assignments WHERE user_id = ?
        `).all(currentUser.id);
        
        const createdJobs = sqlite.prepare(`
          SELECT id FROM jobs WHERE organization_id = ? AND created_by = ?
        `).all(currentUser.organizationId!, currentUser.id);
        
        const assignedIds = assignedJobIds.map((a: any) => a.job_id);
        const createdIds = createdJobs.map((j: any) => j.id);
        accessibleJobIds = Array.from(new Set([...assignedIds, ...createdIds]));
      }

      console.log(`📊 STATS: User has access to ${accessibleJobIds.length} jobs:`, accessibleJobIds);

      if (accessibleJobIds.length === 0) {
        // User has no accessible jobs
        console.log(`📊 STATS: User has no accessible jobs, returning empty stats`);
        
        return res.json({
          activeJobs: 0,
          totalCandidates: 0,
          aiMatches: 0,
          totalInterviews: 0,
          avgMatchRate: 0
        });
      }

      // Get user-specific data based on accessible jobs
      const sqlite4 = await initializeSQLiteDatabase();
      const jobQuery = `SELECT * FROM jobs WHERE organization_id = ? AND id IN (${accessibleJobIds.map(() => '?').join(',')})`;
      const userJobs = sqlite4.prepare(jobQuery).all(currentUser.organizationId!, ...accessibleJobIds);

      // Get user-specific candidate data based on role and assignments (same logic as /api/candidates)
      let candidates;
      
      if (['super_admin', 'org_admin'].includes(currentUser.role)) {
        // Super admin and org admin can see all candidates in their organization
        candidates = await storage.getCandidatesByOrganization(currentUser.organizationId!);
      } else {
        // Other users see only candidates they created or are assigned to
        const allCandidates = await storage.getCandidatesByOrganization(currentUser.organizationId!);
        const createdCandidates = allCandidates.filter(candidate => candidate.addedBy === currentUser.id);
        
        // Get candidate assignments for this user
        const sqlite5 = await initializeSQLiteDatabase();
        const assignedCandidateResults = sqlite5.prepare(`
          SELECT candidate_id as candidateId FROM candidate_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const assignedCandidateIds = assignedCandidateResults.map((a: any) => a.candidateId);
        const assignedCandidates = allCandidates.filter(candidate => 
          assignedCandidateIds.includes(candidate.id)
        );
        
        // Combine and deduplicate
        const candidateMap = new Map();
        [...createdCandidates, ...assignedCandidates].forEach(candidate => {
          candidateMap.set(candidate.id, candidate);
        });
        
        candidates = Array.from(candidateMap.values());
      }
      
      const [matches, interviews] = await Promise.all([
        storage.getJobMatchesByOrganization(currentUser.organizationId!),
        storage.getInterviewsByOrganization(currentUser.organizationId!)
      ]);

      // Filter matches to only include those for accessible jobs
      const accessibleMatches = matches.filter((match: any) => 
        accessibleJobIds.includes(match.jobId)
      );

      const avgMatchRate = accessibleMatches.length > 0 
        ? Math.round(accessibleMatches.reduce((sum: number, match: any) => sum + match.matchPercentage, 0) / accessibleMatches.length)
        : 0;

      const stats = {
        activeJobs: userJobs.length,
        totalCandidates: candidates.length,
        aiMatches: accessibleMatches.length,
        totalInterviews: interviews.length,
        avgMatchRate
      };

      console.log(`📊 STATS: Final user-specific stats for ${currentUser.role}:`, stats);

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Override Python backend AI calling with Node.js implementation
  app.post('/api/initiate-ai-call', async (req, res) => {
    try {
      const { phoneNumber, candidateName, jobId } = req.body;
      
      if (!phoneNumber || !candidateName) {
        return res.status(400).json({ 
          message: "Phone number and candidate name are required" 
        });
      }

      // Fetch job details if jobId is provided so Sarah can discuss the opportunity
      let jobDetails = null;
      if (jobId) {
        try {
          jobDetails = await storage.getJob(parseInt(jobId));
          console.log(`📋 Retrieved job details: ${jobDetails?.title}`);
        } catch (error) {
          console.log('⚠️ Could not fetch job details, proceeding without JD context');
        }
      }

      // Get the direct domain for WebSocket connection (no tunnel required)
      const websocketDomain = getDirectDomain();
      console.log('🌐 Using direct domain:', websocketDomain);

      // Check if Twilio credentials are available
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.PHONE_NUMBER_FROM) {
        return res.status(503).json({ 
          message: "Twilio credentials not configured" 
        });
      }

      // Create TwiML for outbound call that connects to our media stream
      const twiml = createOutboundCallTwiML(websocketDomain);
      
      // Initialize Twilio client
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      
      console.log(`📞 Initiating AI call to: ${candidateName} at ${phoneNumber}`);
      console.log(`🌐 Using WebSocket domain: ${websocketDomain}`);
      console.log(`📋 TwiML WebSocket URL: wss://${websocketDomain}/media-stream`);
      
      // Make the actual call using Twilio
      const call = await twilioClient.calls.create({
        from: process.env.PHONE_NUMBER_FROM!,
        to: phoneNumber,
        twiml: twiml
      });

      // Store call context for AI conversation
      const { setCallContext } = await import('./ai-calling');
      setCallContext(call.sid, candidateName, jobDetails);

      console.log('✅ AI call initiated successfully:', call.sid);
      console.log(`👤 Stored candidate name: ${candidateName}`);
      
      // Get domain for response
      const responseDomain = getDirectDomain();
      
      if (jobDetails) {
        console.log(`📋 Sarah will discuss: ${jobDetails.title}`);
        console.log(`💼 Job details stored:`, JSON.stringify(jobDetails, null, 2));
      } else {
        console.log('⚠️ No job details found to store');
      }
      
      res.json({ 
        success: true, 
        message: `AI call initiated successfully to ${candidateName}`,
        callSid: call.sid,
        status: call.status,
        domain: responseDomain
      });
    } catch (error) {
      console.error("Error initiating AI call:", error);
      res.status(500).json({ message: "Failed to initiate AI call" });
    }
  });

  // Twilio webhook for incoming calls
  app.post('/api/ai-call/incoming', async (req, res) => {
    try {
      const directDomain = getDirectDomain();
      const twiml = createIncomingCallTwiML(directDomain);
      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      console.error("Error handling incoming call:", error);
      res.status(500).send('Internal server error');
    }
  });

  // Get direct domain status (no tunnel required)
  app.get('/api/ai-call/status', async (req, res) => {
    const directDomain = getDirectDomain();
    res.json({
      directDomainAvailable: true,
      directDomain,
      twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.PHONE_NUMBER_FROM)
    });
  });

  // Job assignment routes
  app.get('/api/jobs/:jobId/assignments', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const jobId = parseInt(req.params.jobId);
      const currentUser = req.user!;

      // Verify user has access to this job
      const job = sqlite.prepare(`
        SELECT * FROM jobs 
        WHERE id = ? AND organization_id = ?
      `).get(jobId, currentUser.organizationId!);

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Get assignments with user details
      const assignments = sqlite.prepare(`
        SELECT 
          ja.id,
          ja.user_id as userId,
          ja.role,
          ja.assigned_by as assignedBy,
          ja.created_at as createdAt,
          u.first_name as firstName,
          u.last_name as lastName,
          u.email,
          u.role as userRole
        FROM job_assignments ja
        INNER JOIN users u ON ja.user_id = u.id
        WHERE ja.job_id = ?
      `).all(jobId);

      res.json(assignments);
    } catch (error) {
      console.error('Get job assignments error:', error);
      res.status(500).json({ message: 'Failed to fetch job assignments' });
    }
  });

  app.post('/api/jobs/:jobId/assignments', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const jobId = parseInt(req.params.jobId);
      const currentUser = req.user!;
      const { userId, role } = req.body;

      // Validate input
      if (!userId || !role) {
        return res.status(400).json({ message: 'User ID and role are required' });
      }

      if (!['owner', 'assigned', 'viewer'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be: owner, assigned, or viewer' });
      }

      // Verify user has permission to assign (owner, org_admin, or manager)
      if (!['super_admin', 'org_admin', 'manager'].includes(currentUser.role)) {
        const isJobOwner = sqlite.prepare(`
          SELECT * FROM jobs 
          WHERE id = ? AND created_by = ?
        `).get(jobId, currentUser.id);

        if (!isJobOwner) {
          return res.status(403).json({ message: 'Insufficient permissions to assign users' });
        }
      }

      // Verify target user exists and is in same organization
      const targetUser = sqlite.prepare(`
        SELECT * FROM users 
        WHERE id = ? AND organization_id = ?
      `).get(userId, currentUser.organizationId!);

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found or not in same organization' });
      }

      // Check if assignment already exists
      const existingAssignment = sqlite.prepare(`
        SELECT * FROM job_assignments 
        WHERE job_id = ? AND user_id = ?
      `).get(jobId, userId);

      if (existingAssignment) {
        return res.status(400).json({ message: 'User is already assigned to this job' });
      }

      // Create assignment
      const result = sqlite.prepare(`
        INSERT INTO job_assignments (job_id, user_id, role, assigned_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(jobId, userId, role, currentUser.id, new Date().toISOString(), new Date().toISOString());
      
      const assignment = sqlite.prepare('SELECT * FROM job_assignments WHERE id = ?').get(result.lastInsertRowid);

      res.json({
        message: 'User assigned successfully',
        assignment: assignment
      });
    } catch (error) {
      console.error('Create job assignment error:', error);
      res.status(500).json({ message: 'Failed to assign user' });
    }
  });

  app.delete('/api/jobs/:jobId/assignments/:assignmentId', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const jobId = parseInt(req.params.jobId);
      const assignmentId = parseInt(req.params.assignmentId);
      const currentUser = req.user!;

      // Verify assignment exists and user has permission to remove it
      const assignment = sqlite.prepare(`
        SELECT * FROM job_assignments 
        WHERE id = ? AND job_id = ?
      `).get(assignmentId, jobId);

      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Check permissions (can remove if: super_admin, org_admin, manager, job creator, or the assigned user themselves)
      const canRemove = 
        ['super_admin', 'org_admin', 'manager'].includes(currentUser.role) ||
        assignment.assigned_by === currentUser.id ||
        assignment.user_id === currentUser.id;

      if (!canRemove) {
        return res.status(403).json({ message: 'Insufficient permissions to remove assignment' });
      }

      // Delete assignment
      sqlite.prepare('DELETE FROM job_assignments WHERE id = ?').run(assignmentId);

      res.json({ message: 'Assignment removed successfully' });
    } catch (error) {
      console.error('Delete job assignment error:', error);
      res.status(500).json({ message: 'Failed to remove assignment' });
    }
  });

  // Candidate assignment routes with comprehensive error handling and logging
  app.get('/api/candidates/:candidateId/assignments', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const candidateId = parseInt(req.params.candidateId);
      const currentUser = req.user!;

      console.log(`📋 CANDIDATE ASSIGNMENT: Fetching assignments for candidate ${candidateId} by user ${currentUser.id} (${currentUser.role}) in org ${currentUser.organizationId}`);

      // Input validation with detailed logging
      if (isNaN(candidateId) || candidateId <= 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid candidate ID provided: '${req.params.candidateId}'`);
        return res.status(400).json({ 
          message: 'Invalid candidate ID provided',
          details: 'Candidate ID must be a positive integer'
        });
      }

      // Verify candidate exists and belongs to user's organization
      const candidate = sqlite.prepare(`
        SELECT * FROM candidates 
        WHERE id = ? AND organization_id = ?
      `).get(candidateId, currentUser.organizationId!);

      if (!candidate) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Candidate ${candidateId} not found in organization ${currentUser.organizationId} for user ${currentUser.id}`);
        return res.status(404).json({ 
          message: 'Candidate not found or access denied',
          details: 'Candidate may not exist or you may not have permission to view it'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Found candidate '${candidate.name}' (ID: ${candidateId})`);

      // Fetch assignments with user details using proper LEFT JOIN syntax
      const sqlite6 = await initializeSQLiteDatabase();
      const assignments = sqlite6.prepare(`
        SELECT 
          ca.id,
          ca.candidate_id as candidateId,
          ca.user_id as userId,
          ca.role,
          ca.assigned_by as assignedBy,
          ca.created_at as createdAt,
          u.first_name as userFirstName,
          u.last_name as userLastName,
          u.email as userEmail,
          u.role as userRole
        FROM candidate_assignments ca
        LEFT JOIN users u ON ca.user_id = u.id
        WHERE ca.candidate_id = ?
      `).all(candidateId);

      console.log(`✅ CANDIDATE ASSIGNMENT: Found ${assignments.length} assignments for candidate ${candidateId}`);
      if (assignments.length > 0) {
        console.log(`📋 CANDIDATE ASSIGNMENT: Assignment details:`, assignments.map((a: any) => ({
          id: a.id,
          user: `${a.userFirstName} ${a.userLastName}`,
          role: a.role
        })));
      }

      res.json({
        success: true,
        assignments,
        candidateDetails: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email
        }
      });
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT: Error fetching assignments:', error);
      console.error('❌ CANDIDATE ASSIGNMENT: Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Failed to fetch candidate assignments', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/candidates/:candidateId/assignments', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const candidateId = parseInt(req.params.candidateId);
      const currentUser = req.user!;
      const { userId, role } = req.body;

      console.log(`📋 CANDIDATE ASSIGNMENT: Creating assignment for candidate ${candidateId} by user ${currentUser.id} (${currentUser.role}) in org ${currentUser.organizationId}`);
      console.log(`📋 CANDIDATE ASSIGNMENT: Request payload:`, { userId, role, candidateId });

      // Comprehensive input validation
      if (isNaN(candidateId) || candidateId <= 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid candidate ID: '${req.params.candidateId}'`);
        return res.status(400).json({ 
          message: 'Invalid candidate ID provided',
          details: 'Candidate ID must be a positive integer'
        });
      }

      if (!userId || !role) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Missing required fields:`, { 
          userId: !!userId, 
          role: !!role,
          receivedBody: req.body
        });
        return res.status(400).json({ 
          message: 'User ID and role are required',
          details: 'Both userId and role must be provided in request body'
        });
      }

      if (typeof userId !== 'number' || userId <= 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid user ID: '${userId}' (type: ${typeof userId})`);
        return res.status(400).json({ 
          message: 'Invalid user ID provided',
          details: 'User ID must be a positive integer'
        });
      }

      const validRoles = ['owner', 'assigned', 'viewer'];
      if (!validRoles.includes(role)) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid role: '${role}'. Valid roles: ${validRoles.join(', ')}`);
        return res.status(400).json({ 
          message: 'Invalid role provided',
          details: `Role must be one of: ${validRoles.join(', ')}`
        });
      }

      // Verify candidate exists and belongs to user's organization
      const sqlite7 = await initializeSQLiteDatabase();
      const candidate = sqlite7.prepare(`
        SELECT * FROM candidates 
        WHERE id = ? AND organization_id = ?
      `).get(candidateId, currentUser.organizationId!);

      if (!candidate) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Candidate ${candidateId} not found in organization ${currentUser.organizationId}`);
        return res.status(404).json({ 
          message: 'Candidate not found or access denied',
          details: 'Candidate may not exist or you may not have permission to assign it'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Found candidate '${candidate.name}' (ID: ${candidateId}), added by user ${candidate.addedBy}`);

      // Verify target user exists and belongs to same organization  
      const targetUser = sqlite7.prepare(`
        SELECT * FROM users 
        WHERE id = ? AND organization_id = ?
      `).get(userId, currentUser.organizationId!);

      if (!targetUser) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Target user ${userId} not found in organization ${currentUser.organizationId}`);
        return res.status(404).json({ 
          message: 'Target user not found or not in same organization',
          details: 'User must belong to the same organization'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Found target user '${targetUser.firstName} ${targetUser.lastName}' (${targetUser.role})`);

      // Check permissions with detailed logging
      const canAssign = 
        ['super_admin', 'org_admin', 'manager'].includes(currentUser.role) ||
        candidate.addedBy === currentUser.id; // Candidate creator can assign

      console.log(`🔒 CANDIDATE ASSIGNMENT: Permission check:`, {
        currentUserRole: currentUser.role,
        candidateCreator: candidate.addedBy,
        currentUserId: currentUser.id,
        hasAdminRole: ['super_admin', 'org_admin', 'manager'].includes(currentUser.role),
        isCreator: candidate.addedBy === currentUser.id,
        canAssign
      });

      if (!canAssign) {
        console.log(`❌ CANDIDATE ASSIGNMENT: User ${currentUser.id} (${currentUser.role}) lacks permission to assign candidate ${candidateId}`);
        return res.status(403).json({ 
          message: 'Insufficient permissions to assign candidates',
          details: 'Only admins, managers, or the candidate creator can assign candidates'
        });
      }

      // Check if assignment already exists
      const existingAssignment = sqlite7.prepare(`
        SELECT * FROM candidate_assignments 
        WHERE candidate_id = ? AND user_id = ?
      `).get(candidateId, userId);

      if (existingAssignment) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Assignment already exists:`, {
          assignmentId: existingAssignment.id,
          candidateId,
          userId,
          existingRole: existingAssignment.role
        });
        return res.status(409).json({ 
          message: 'User is already assigned to this candidate',
          details: `User already has role '${existingAssignment.role}' for this candidate`
        });
      }

      // Create assignment with error handling
      console.log(`🔄 CANDIDATE ASSIGNMENT: Creating assignment with data:`, {
        candidateId,
        userId,
        role,
        assignedBy: currentUser.id
      });

      const result = sqlite7.prepare(`
        INSERT INTO candidate_assignments (candidate_id, user_id, role, assigned_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(candidateId, userId, role, currentUser.id, new Date().toISOString(), new Date().toISOString());
      
      const newAssignment = sqlite7.prepare('SELECT * FROM candidate_assignments WHERE id = ?').get(result.lastInsertRowid);

      console.log(`✅ CANDIDATE ASSIGNMENT: Successfully created assignment ${newAssignment.id} for candidate ${candidateId}`);
      console.log(`📋 CANDIDATE ASSIGNMENT: Assignment details:`, {
        assignmentId: newAssignment.id,
        candidateName: candidate.name,
        assignedUser: `${targetUser.firstName} ${targetUser.lastName}`,
        role: newAssignment.role,
        assignedBy: currentUser.id
      });

      res.status(201).json({
        success: true,
        message: 'Candidate assigned successfully',
        assignment: newAssignment,
        details: {
          candidateName: candidate.name,
          assignedUser: `${targetUser.firstName} ${targetUser.lastName}`,
          role: newAssignment.role
        }
      });
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT: Error creating assignment:', error);
      console.error('❌ CANDIDATE ASSIGNMENT: Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Failed to assign candidate', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/candidates/:candidateId/assignments/:assignmentId', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const sqlite = await initializeSQLiteDatabase();
      const candidateId = parseInt(req.params.candidateId);
      const assignmentId = parseInt(req.params.assignmentId);
      const currentUser = req.user!;

      console.log(`📋 CANDIDATE ASSIGNMENT: Deleting assignment ${assignmentId} for candidate ${candidateId} by user ${currentUser.id} (${currentUser.role})`);

      // Input validation with detailed logging
      if (isNaN(candidateId) || candidateId <= 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid candidate ID: '${req.params.candidateId}'`);
        return res.status(400).json({ 
          message: 'Invalid candidate ID provided',
          details: 'Candidate ID must be a positive integer'
        });
      }

      if (isNaN(assignmentId) || assignmentId <= 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Invalid assignment ID: '${req.params.assignmentId}'`);
        return res.status(400).json({ 
          message: 'Invalid assignment ID provided',
          details: 'Assignment ID must be a positive integer'
        });
      }

      // Verify assignment exists and belongs to the candidate
      const assignment = sqlite.prepare(`
        SELECT * FROM candidate_assignments 
        WHERE id = ? AND candidate_id = ?
      `).get(assignmentId, candidateId);

      if (!assignment) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Assignment ${assignmentId} not found for candidate ${candidateId}`);
        return res.status(404).json({ 
          message: 'Assignment not found',
          details: 'Assignment may not exist or may not belong to this candidate'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Found assignment:`, {
        assignmentId: assignment.id,
        userId: assignment.userId,
        role: assignment.role,
        assignedBy: assignment.assignedBy
      });

      // Verify candidate belongs to user's organization
      const candidate = await db.select()
        .from(schema.candidates)
        .where(and(
          eq(schema.candidates.id, candidateId),
          eq(schema.candidates.organizationId, currentUser.organizationId!)
        ))
        .get();

      if (!candidate) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Candidate ${candidateId} not found in organization ${currentUser.organizationId}`);
        return res.status(404).json({ 
          message: 'Candidate not found or access denied',
          details: 'Candidate may not exist or you may not have permission to modify its assignments'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Found candidate '${candidate.name}', created by user ${candidate.addedBy}`);

      // Check permissions with detailed logging
      const canRemove = 
        ['super_admin', 'org_admin', 'manager'].includes(currentUser.role) ||
        assignment.assignedBy === currentUser.id ||
        assignment.userId === currentUser.id ||
        candidate.addedBy === currentUser.id;

      console.log(`🔒 CANDIDATE ASSIGNMENT: Permission check for removal:`, {
        currentUserRole: currentUser.role,
        currentUserId: currentUser.id,
        assignmentAssignedBy: assignment.assignedBy,
        assignmentUserId: assignment.userId,
        candidateCreator: candidate.addedBy,
        hasAdminRole: ['super_admin', 'org_admin', 'manager'].includes(currentUser.role),
        isAssigner: assignment.assignedBy === currentUser.id,
        isAssignedUser: assignment.userId === currentUser.id,
        isCandidateCreator: candidate.addedBy === currentUser.id,
        canRemove
      });

      if (!canRemove) {
        console.log(`❌ CANDIDATE ASSIGNMENT: User ${currentUser.id} (${currentUser.role}) lacks permission to remove assignment ${assignmentId}`);
        return res.status(403).json({ 
          message: 'Insufficient permissions to remove assignment',
          details: 'Only admins, managers, the assigner, assigned user, or candidate creator can remove assignments'
        });
      }

      // Delete assignment
      console.log(`🔄 CANDIDATE ASSIGNMENT: Deleting assignment ${assignmentId}`);
      
      const result = await db.delete(schema.candidateAssignments)
        .where(eq(schema.candidateAssignments.id, assignmentId))
        .returning();

      if (result.length === 0) {
        console.log(`❌ CANDIDATE ASSIGNMENT: Failed to delete assignment ${assignmentId} - no rows affected`);
        return res.status(500).json({ 
          message: 'Failed to remove assignment',
          details: 'Assignment deletion did not affect any rows'
        });
      }

      console.log(`✅ CANDIDATE ASSIGNMENT: Successfully deleted assignment ${assignmentId} for candidate ${candidateId}`);

      res.json({ 
        success: true,
        message: 'Assignment removed successfully',
        details: {
          deletedAssignmentId: assignmentId,
          candidateName: candidate.name
        }
      });
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT: Error removing assignment:', error);
      console.error('❌ CANDIDATE ASSIGNMENT: Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Failed to remove assignment', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Application creation endpoints
  
  // Create a new application (candidate applying to job)
  app.post('/api/applications', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const { candidateId, jobId, notes = '', source = 'manual' } = req.body;
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;

      // Validate required fields
      if (!candidateId || !jobId) {
        return res.status(400).json({ message: "candidateId and jobId are required" });
      }

      // Check if user has permission to access both candidate and job
      const sqlite = await initializeSQLiteDatabase();
      
      // Check job assignment
      const jobAssignment = sqlite.prepare(`
        SELECT * FROM job_assignments 
        WHERE job_id = ? AND user_id = ?
      `).get(jobId, currentUser.id);

      // Check candidate assignment  
      const candidateAssignment = sqlite.prepare(`
        SELECT * FROM candidate_assignments 
        WHERE candidate_id = ? AND user_id = ?
      `).get(candidateId, currentUser.id);

      // Super admin and org admin can create applications without assignments
      const hasPermission = currentUser.role === 'super_admin' || 
                           currentUser.role === 'org_admin' ||
                           (jobAssignment && candidateAssignment);

      if (!hasPermission) {
        return res.status(403).json({ 
          message: "You need assignments to both the candidate and job to create an application" 
        });
      }

      // Check if application already exists
      const existingApplication = await db
        .select()
        .from(schema.applications)
        .where(and(
          eq(schema.applications.candidateId, candidateId),
          eq(schema.applications.jobId, jobId),
          eq(schema.applications.organizationId, organizationId)
        ))
        .get();

      if (existingApplication) {
        return res.status(409).json({ 
          message: "Application already exists for this candidate-job combination" 
        });
      }

      // Get AI match score if available
      let matchPercentage = null;
      const existingMatch = await db
        .select()
        .from(schema.jobMatches)
        .where(and(
          eq(schema.jobMatches.candidateId, candidateId),
          eq(schema.jobMatches.jobId, jobId)
        ))
        .get();

      if (existingMatch) {
        matchPercentage = existingMatch.overallScore;
      }

      // Create the application
      const newApplication = await db
        .insert(schema.applications)
        .values({
          organizationId,
          jobId,
          candidateId,
          appliedBy: currentUser.id,
          status: 'new',
          currentStage: 'new',
          appliedAt: new Date().toISOString(),
          matchPercentage,
          source,
          notes,
          lastStageChangeAt: new Date().toISOString(),
          lastStageChangedBy: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning()
        .get();

      console.log(`✅ APPLICATION: Created application ${newApplication.id} for candidate ${candidateId} → job ${jobId} by user ${currentUser.id}`);

      res.json({ 
        success: true, 
        application: newApplication,
        message: "Application created successfully"
      });

    } catch (error) {
      console.error('❌ APPLICATION ERROR:', error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  // Get application creation suggestions (AI matching integration)
  app.get('/api/applications/suggestions', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;
      const minScore = parseInt(req.query.minScore as string) || 70;

      console.log(`🔍 SUGGESTIONS: Getting application suggestions for user ${currentUser.id} with min score ${minScore}%`);

      // Get user's assigned jobs and candidates
      const sqlite = await initializeSQLiteDatabase();
      
      let accessibleJobIds: number[] = [];
      let accessibleCandidateIds: number[] = [];

      if (currentUser.role === 'super_admin' || currentUser.role === 'org_admin') {
        // Get all jobs and candidates in organization
        const allJobs = await storage.getJobsByOrganization(organizationId);
        const allCandidates = await storage.getCandidatesByOrganization(organizationId);
        accessibleJobIds = allJobs.map(j => j.id);
        accessibleCandidateIds = allCandidates.map(c => c.id);
      } else {
        // Get assigned jobs and candidates
        const jobAssignments = sqlite.prepare(`
          SELECT job_id as jobId FROM job_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const candidateAssignments = sqlite.prepare(`
          SELECT candidate_id as candidateId FROM candidate_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);

        accessibleJobIds = jobAssignments.map((ja: any) => ja.jobId);
        accessibleCandidateIds = candidateAssignments.map((ca: any) => ca.candidateId);
      }

      if (accessibleJobIds.length === 0 || accessibleCandidateIds.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Get high-scoring matches for accessible candidate-job combinations
      const rawSuggestions = await db
        .select()
        .from(schema.jobMatches)
        .innerJoin(schema.jobs, eq(schema.jobMatches.jobId, schema.jobs.id))
        .innerJoin(schema.candidates, eq(schema.jobMatches.candidateId, schema.candidates.id))
        .where(and(
          inArray(schema.jobMatches.jobId, accessibleJobIds),
          inArray(schema.jobMatches.candidateId, accessibleCandidateIds),
          gte(schema.jobMatches.matchPercentage, minScore)
        ))
        .orderBy(desc(schema.jobMatches.matchPercentage))
        .limit(20)
        .all();

      // Format suggestions data
      const suggestions = rawSuggestions.map((row: any) => ({
        matchId: row.job_matches?.id || row.jobMatches?.id,
        jobId: row.job_matches?.jobId || row.jobMatches?.jobId,
        candidateId: row.job_matches?.candidateId || row.jobMatches?.candidateId,
        overallScore: row.job_matches?.matchPercentage || row.jobMatches?.matchPercentage,
        jobTitle: row.jobs?.title,
        candidateName: row.candidates?.name,
        candidateEmail: row.candidates?.email
      }));

      // Filter out existing applications
      const existingApplications = await db
        .select({
          candidateId: schema.applications.candidateId,
          jobId: schema.applications.jobId
        })
        .from(schema.applications)
        .where(eq(schema.applications.organizationId, organizationId))
        .all();

      const existingSet = new Set(
        existingApplications.map((app: any) => `${app.candidateId}-${app.jobId}`)
      );

      const filteredSuggestions = suggestions.filter(
        (suggestion: any) => !existingSet.has(`${suggestion.candidateId}-${suggestion.jobId}`)
      );

      console.log(`🔍 SUGGESTIONS: Total matches found: ${rawSuggestions.length}`);
      console.log(`🔍 SUGGESTIONS: After formatting: ${suggestions.length}`);
      console.log(`🔍 SUGGESTIONS: Existing applications: ${existingApplications.length}`);
      console.log(`🔍 SUGGESTIONS: Final filtered suggestions: ${filteredSuggestions.length}`);
      
      if (suggestions.length > 0) {
        console.log(`🔍 SUGGESTIONS: Sample suggestion:`, {
          matchId: suggestions[0].matchId,
          jobId: suggestions[0].jobId,
          candidateId: suggestions[0].candidateId,
          score: suggestions[0].overallScore,
          jobTitle: suggestions[0].jobTitle,
          candidateName: suggestions[0].candidateName
        });
      }

      console.log(`✅ SUGGESTIONS: Found ${filteredSuggestions.length} application suggestions`);

      res.json({ suggestions: filteredSuggestions });

    } catch (error) {
      console.error('❌ SUGGESTIONS ERROR:', error);
      res.status(500).json({ message: "Failed to get application suggestions" });
    }
  });

  // Get available jobs for a candidate (for dropdown)
  app.get('/api/candidates/:candidateId/available-jobs', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const { candidateId } = req.params;
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;

      // Get user's accessible jobs
      const sqlite = await initializeSQLiteDatabase();
      
      let accessibleJobs: any[] = [];

      if (currentUser.role === 'super_admin' || currentUser.role === 'org_admin') {
        accessibleJobs = await storage.getJobsByOrganization(organizationId);
      } else {
        const jobAssignments = sqlite.prepare(`
          SELECT job_id as jobId FROM job_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const jobIds = jobAssignments.map((ja: any) => ja.jobId);
        if (jobIds.length > 0) {
          const jobQuery = `SELECT * FROM jobs WHERE id IN (${jobIds.map(() => '?').join(',')}) AND organization_id = ?`;
          accessibleJobs = sqlite.prepare(jobQuery).all(...jobIds, organizationId);
        }
      }

      // Filter out jobs that already have applications for this candidate
      const existingApplications = sqlite.prepare(`
        SELECT job_id as jobId FROM applications 
        WHERE candidate_id = ? AND organization_id = ?
      `).all(parseInt(candidateId), organizationId);

      const existingJobIds = new Set(existingApplications.map(app => app.jobId));
      const availableJobs = accessibleJobs.filter(job => !existingJobIds.has(job.id));

      res.json({ jobs: availableJobs });

    } catch (error) {
      console.error('❌ AVAILABLE JOBS ERROR:', error);
      res.status(500).json({ message: "Failed to get available jobs" });
    }
  });

  // Get available candidates for a job (for dropdown)
  app.get('/api/jobs/:jobId/available-candidates', authenticateToken, requireOrganization, async (req: AuthRequest, res) => {
    try {
      const { jobId } = req.params;
      const currentUser = req.user!;
      const organizationId = currentUser.organizationId!;

      // Get user's accessible candidates
      const sqlite = await initializeSQLiteDatabase();
      
      let accessibleCandidates: any[] = [];

      if (currentUser.role === 'super_admin' || currentUser.role === 'org_admin') {
        accessibleCandidates = await storage.getCandidatesByOrganization(organizationId);
      } else {
        const candidateAssignments = sqlite.prepare(`
          SELECT candidate_id as candidateId FROM candidate_assignments 
          WHERE user_id = ?
        `).all(currentUser.id);
        
        const candidateIds = candidateAssignments.map((ca: any) => ca.candidateId);
        if (candidateIds.length > 0) {
          const candidateQuery = `SELECT * FROM candidates WHERE id IN (${candidateIds.map(() => '?').join(',')}) AND organization_id = ?`;
          accessibleCandidates = sqlite.prepare(candidateQuery).all(...candidateIds, organizationId);
        }
      }

      // Filter out candidates that already have applications for this job
      const existingApplications = sqlite.prepare(`
        SELECT candidate_id as candidateId FROM applications 
        WHERE job_id = ? AND organization_id = ?
      `).all(parseInt(jobId), organizationId);

      const existingCandidateIds = new Set(existingApplications.map(app => app.candidateId));
      const availableCandidates = accessibleCandidates.filter(candidate => !existingCandidateIds.has(candidate.id));

      res.json({ candidates: availableCandidates });

    } catch (error) {
      console.error('❌ AVAILABLE CANDIDATES ERROR:', error);
      res.status(500).json({ message: "Failed to get available candidates" });
    }
  });

  // Database Management Endpoints (Super Admin Only)
  app.post('/api/admin/database/reset-development', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user is super admin
      if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Super admin access required' });
      }

      const devDbPath = path.join(process.cwd(), 'data', 'development.db');
      const devDbShmPath = path.join(process.cwd(), 'data', 'development.db-shm');
      const devDbWalPath = path.join(process.cwd(), 'data', 'development.db-wal');

      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(process.cwd(), 'data', `development.db.backup.${timestamp}`);

      try {
        if (fs.existsSync(devDbPath)) {
          fs.copyFileSync(devDbPath, backupPath);
          console.log(`📋 Development database backed up to ${backupPath}`);
          
          // Delete database files
          fs.unlinkSync(devDbPath);
          if (fs.existsSync(devDbShmPath)) fs.unlinkSync(devDbShmPath);
          if (fs.existsSync(devDbWalPath)) fs.unlinkSync(devDbWalPath);
          
          console.log('🗑️ Development database files deleted');
        }
        
        res.json({ 
          message: 'Development database reset successfully',
          backup: backupPath,
          requiresRestart: true
        });
      } catch (error) {
        console.error('❌ Failed to reset development database:', error);
        res.status(500).json({ message: 'Failed to reset development database' });
      }
    } catch (error) {
      console.error('❌ Database reset error:', error);
      res.status(500).json({ message: 'Database reset failed' });
    }
  });

  app.post('/api/admin/database/reset-production', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user is super admin
      if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Super admin access required' });
      }

      const prodDbPath = path.join(process.cwd(), 'data', 'production.db');
      const prodDbShmPath = path.join(process.cwd(), 'data', 'production.db-shm');
      const prodDbWalPath = path.join(process.cwd(), 'data', 'production.db-wal');

      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(process.cwd(), 'data', `production.db.backup.${timestamp}`);

      try {
        if (fs.existsSync(prodDbPath)) {
          fs.copyFileSync(prodDbPath, backupPath);
          console.log(`📋 Production database backed up to ${backupPath}`);
          
          // Delete database files
          fs.unlinkSync(prodDbPath);
          if (fs.existsSync(prodDbShmPath)) fs.unlinkSync(prodDbShmPath);
          if (fs.existsSync(prodDbWalPath)) fs.unlinkSync(prodDbWalPath);
          
          console.log('🗑️ Production database files deleted');
        }
        
        res.json({ 
          message: 'Production database reset successfully',
          backup: backupPath,
          requiresRestart: true
        });
      } catch (error) {
        console.error('❌ Failed to reset production database:', error);
        res.status(500).json({ message: 'Failed to reset production database' });
      }
    } catch (error) {
      console.error('❌ Database reset error:', error);
      res.status(500).json({ message: 'Database reset failed' });
    }
  });

  // Mount route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api', pipelineRoutes);

  // Return a placeholder server object since the actual server is created in index.ts
  return createServer();
}