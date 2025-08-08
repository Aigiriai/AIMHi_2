import { Router } from "express";
import { settingsService } from "./settings-service";
import { authenticateToken, AuthRequest } from "./auth";
import { z } from "zod";

const router = Router();

// Organization Settings
const organizationSettingsSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  currency: z.string().optional(),
  branding: z.object({
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
  }).optional(),
  notifications: z.object({
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    webhookUrl: z.string().optional(),
  }).optional(),
  compliance: z.object({
    gdprEnabled: z.boolean().optional(),
    ccpaEnabled: z.boolean().optional(),
    dataRetentionDays: z.number().optional(),
  }).optional(),
  integrations: z.object({
    linkedin: z.object({
      enabled: z.boolean().optional(),
      clientId: z.string().optional(),
    }).optional(),
    indeed: z.object({
      enabled: z.boolean().optional(),
      apiKey: z.string().optional(),
    }).optional(),
    twilio: z.object({
      enabled: z.boolean().optional(),
      accountSid: z.string().optional(),
    }).optional(),
    email: z.object({
      enabled: z.boolean().optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().optional(),
    }).optional(),
  }).optional(),
});

router.get('/organization', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user!.organizationId;
    const settings = await settingsService.getOrganizationSettings(organizationId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    res.status(500).json({ error: 'Failed to fetch organization settings' });
  }
});

router.put('/organization', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const organizationId = req.user!.organizationId;
    console.log('Updating organization settings for org ID:', organizationId);
    // console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const validatedData = organizationSettingsSchema.parse(req.body);
    // console.log('Validated data:', JSON.stringify(validatedData, null, 2));
    console.log('Organization settings validation successful');
    
    await settingsService.updateOrganizationSettings(organizationId, validatedData);
    console.log('Organization settings updated successfully');
    
    res.json({ success: true, message: 'Organization settings updated successfully' });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update organization settings' });
    }
  }
});

// User Settings
const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    browser: z.boolean().optional(),
    newCandidates: z.boolean().optional(),
    newMatches: z.boolean().optional(),
    interviews: z.boolean().optional(),
    reports: z.boolean().optional(),
  }).optional(),
  dashboard: z.object({
    layout: z.enum(['grid', 'list']).optional(),
    widgets: z.array(z.string()).optional(),
  }).optional(),
  privacy: z.object({
    profileVisible: z.boolean().optional(),
    activityVisible: z.boolean().optional(),
  }).optional(),
});

router.get('/user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const settings = await settingsService.getUserSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

router.put('/user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = userSettingsSchema.parse(req.body);
    
    await settingsService.updateUserSettings(userId, validatedData);
    res.json({ success: true, message: 'User settings updated successfully' });
  } catch (error) {
    console.error('Error updating user settings:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update user settings' });
    }
  }
});

// Team Settings
const teamSettingsSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  permissions: z.object({
    canCreateJobs: z.boolean().optional(),
    canManageCandidates: z.boolean().optional(),
    canScheduleInterviews: z.boolean().optional(),
    canViewReports: z.boolean().optional(),
  }).optional(),
  workflow: z.object({
    autoAssignCandidates: z.boolean().optional(),
    requireApprovalForMatches: z.boolean().optional(),
    interviewReminderDays: z.number().optional(),
  }).optional(),
});

router.get('/team/:teamId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const settings = await settingsService.getTeamSettings(teamId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching team settings:', error);
    res.status(500).json({ error: 'Failed to fetch team settings' });
  }
});

router.put('/team/:teamId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const validatedData = teamSettingsSchema.parse(req.body);
    
    await settingsService.updateTeamSettings(teamId, validatedData);
    res.json({ success: true, message: 'Team settings updated successfully' });
  } catch (error) {
    console.error('Error updating team settings:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update team settings' });
    }
  }
});

export default router;