import { getSQLiteDB } from "./sqlite-db";
import { organizations, users, teams } from "./sqlite-schema";
import { eq } from "drizzle-orm";

export interface OrganizationSettings {
  name: string;
  domain: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  plan: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  notifications?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    webhookUrl?: string;
  };
  compliance?: {
    gdprEnabled?: boolean;
    ccpaEnabled?: boolean;
    dataRetentionDays?: number;
  };
  integrations?: {
    linkedin?: { enabled?: boolean; clientId?: string; };
    indeed?: { enabled?: boolean; apiKey?: string; };
    twilio?: { enabled?: boolean; accountSid?: string; };
    email?: { enabled?: boolean; smtpHost?: string; smtpPort?: number; };
  };
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notifications?: {
    email?: boolean;
    browser?: boolean;
    newCandidates?: boolean;
    newMatches?: boolean;
    interviews?: boolean;
    reports?: boolean;
  };
  dashboard?: {
    layout?: 'grid' | 'list';
    widgets?: string[];
  };
  privacy?: {
    profileVisible?: boolean;
    activityVisible?: boolean;
  };
}

export interface TeamSettings {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private';
  permissions?: {
    canCreateJobs?: boolean;
    canManageCandidates?: boolean;
    canScheduleInterviews?: boolean;
    canViewReports?: boolean;
  };
  workflow?: {
    autoAssignCandidates?: boolean;
    requireApprovalForMatches?: boolean;
    interviewReminderDays?: number;
  };
}

export class SettingsService {
  // Organization Settings
  async getOrganizationSettings(organizationId: number): Promise<OrganizationSettings> {
    const { db } = await getSQLiteDB();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!org) {
      throw new Error("Organization not found");
    }

    return {
      name: org.name,
      domain: org.domain || "",
      timezone: (org.settings as any)?.timezone || "UTC",
      dateFormat: (org.settings as any)?.dateFormat || "MM/DD/YYYY",
      currency: (org.settings as any)?.currency || "USD",
      plan: org.plan,
      branding: (org.settings as any)?.branding || {},
      notifications: (org.settings as any)?.notifications || { emailEnabled: true, smsEnabled: false },
      compliance: org.complianceSettings as any || { gdprEnabled: false, ccpaEnabled: false, dataRetentionDays: 365 },
      integrations: org.integrationSettings as any || {}
    };
  }

  async updateOrganizationSettings(organizationId: number, settings: Partial<OrganizationSettings>): Promise<void> {
    const { db } = await getSQLiteDB();
    const [currentOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!currentOrg) {
      throw new Error("Organization not found");
    }

    const currentSettings = currentOrg.settings as any || {};
    const updatedSettings = {
      ...currentSettings,
      timezone: settings.timezone || currentSettings.timezone,
      dateFormat: settings.dateFormat || currentSettings.dateFormat,
      currency: settings.currency || currentSettings.currency,
      branding: { ...currentSettings.branding, ...settings.branding },
      notifications: { ...currentSettings.notifications, ...settings.notifications }
    };

    await db
      .update(organizations)
      .set({
        name: settings.name || currentOrg.name,
        domain: settings.domain || currentOrg.domain,
        settings: updatedSettings,
        complianceSettings: settings.compliance ? { ...currentOrg.complianceSettings as any, ...settings.compliance } : currentOrg.complianceSettings,
        integrationSettings: settings.integrations ? { ...currentOrg.integrationSettings as any, ...settings.integrations } : currentOrg.integrationSettings,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organizationId));
  }

  // User Settings
  async getUserSettings(userId: number): Promise<UserSettings> {
    const { db } = await getSQLiteDB();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error("User not found");
    }

    const settings = user.settings as any || {};
    return {
      theme: settings.theme || 'system',
      language: settings.language || 'en',
      notifications: {
        email: settings.notifications?.email !== false,
        browser: settings.notifications?.browser !== false,
        newCandidates: settings.notifications?.newCandidates !== false,
        newMatches: settings.notifications?.newMatches !== false,
        interviews: settings.notifications?.interviews !== false,
        reports: settings.notifications?.reports !== false
      },
      dashboard: {
        layout: settings.dashboard?.layout || 'grid',
        widgets: settings.dashboard?.widgets || ['stats', 'recent-matches', 'upcoming-interviews']
      },
      privacy: {
        profileVisible: settings.privacy?.profileVisible !== false,
        activityVisible: settings.privacy?.activityVisible !== false
      }
    };
  }

  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<void> {
    const { db } = await getSQLiteDB();
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!currentUser) {
      throw new Error("User not found");
    }

    const currentSettings = currentUser.settings as any || {};
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      notifications: { ...currentSettings.notifications, ...settings.notifications },
      dashboard: { ...currentSettings.dashboard, ...settings.dashboard },
      privacy: { ...currentSettings.privacy, ...settings.privacy }
    };

    await db
      .update(users)
      .set({
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Team Settings
  async getTeamSettings(teamId: number): Promise<TeamSettings> {
    const { db } = await getSQLiteDB();
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (!team) {
      throw new Error("Team not found");
    }

    const settings = team.settings as any || {};
    return {
      name: team.name,
      description: team.description || "",
      visibility: settings.visibility || 'public',
      permissions: {
        canCreateJobs: settings.permissions?.canCreateJobs !== false,
        canManageCandidates: settings.permissions?.canManageCandidates !== false,
        canScheduleInterviews: settings.permissions?.canScheduleInterviews !== false,
        canViewReports: settings.permissions?.canViewReports !== false
      },
      workflow: {
        autoAssignCandidates: settings.workflow?.autoAssignCandidates || false,
        requireApprovalForMatches: settings.workflow?.requireApprovalForMatches || true,
        interviewReminderDays: settings.workflow?.interviewReminderDays || 1
      }
    };
  }

  async updateTeamSettings(teamId: number, settings: Partial<TeamSettings>): Promise<void> {
    const { db } = await getSQLiteDB();
    const [currentTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (!currentTeam) {
      throw new Error("Team not found");
    }

    const currentSettings = currentTeam.settings as any || {};
    const updatedSettings = {
      ...currentSettings,
      visibility: settings.visibility || currentSettings.visibility,
      permissions: { ...currentSettings.permissions, ...settings.permissions },
      workflow: { ...currentSettings.workflow, ...settings.workflow }
    };

    await db
      .update(teams)
      .set({
        name: settings.name || currentTeam.name,
        description: settings.description || currentTeam.description,
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(teams.id, teamId));
  }
}

export const settingsService = new SettingsService();