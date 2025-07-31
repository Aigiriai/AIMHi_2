import { initializeSQLiteDatabase } from "./init-database";

// Simplified settings service without drizzle ORM
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
    sms?: boolean;
  };
  privacy?: {
    profileVisibility?: 'public' | 'private' | 'organization';
    activityTracking?: boolean;
    dataSharing?: boolean;
  };
}

export class SettingsService {
  // Get organization settings
  async getOrganizationSettings(organizationId: number): Promise<OrganizationSettings | null> {
    try {
      const sqlite = await initializeSQLiteDatabase();
      
      const org = sqlite.prepare(`
        SELECT * FROM organizations WHERE id = ?
      `).get(organizationId) as any;
      
      if (!org) return null;
      
      // Return basic organization settings (can be enhanced with additional settings table)
      return {
        name: org.name,
        domain: org.domain || '',
        timezone: org.timezone || 'UTC',
        dateFormat: org.date_format || 'YYYY-MM-DD',
        currency: org.currency || 'USD',
        plan: org.plan || 'basic'
      };
    } catch (error) {
      console.error('Error getting organization settings:', error);
      return null;
    }
  }

  // Update organization settings
  async updateOrganizationSettings(organizationId: number, settings: Partial<OrganizationSettings>): Promise<boolean> {
    try {
      const sqlite = await initializeSQLiteDatabase();
      
      // Update basic organization fields (can be enhanced with additional settings table)
      const updateFields = [];
      const updateValues = [];
      
      if (settings.name) {
        updateFields.push('name = ?');
        updateValues.push(settings.name);
      }
      if (settings.domain) {
        updateFields.push('domain = ?');
        updateValues.push(settings.domain);
      }
      if (settings.timezone) {
        updateFields.push('timezone = ?');
        updateValues.push(settings.timezone);
      }
      if (settings.dateFormat) {
        updateFields.push('date_format = ?');
        updateValues.push(settings.dateFormat);
      }
      if (settings.currency) {
        updateFields.push('currency = ?');
        updateValues.push(settings.currency);
      }
      if (settings.plan) {
        updateFields.push('plan = ?');
        updateValues.push(settings.plan);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(organizationId);
        
        sqlite.prepare(`
          UPDATE organizations 
          SET ${updateFields.join(', ')} 
          WHERE id = ?
        `).run(...updateValues);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating organization settings:', error);
      return false;
    }
  }

  // Get user settings (simplified - can be enhanced with user_settings table)
  async getUserSettings(userId: number): Promise<UserSettings | null> {
    try {
      // Return default settings for now (can be enhanced with database storage)
      return {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          browser: true,
          sms: false
        },
        privacy: {
          profileVisibility: 'organization',
          activityTracking: true,
          dataSharing: false
        }
      };
    } catch (error) {
      console.error('Error getting user settings:', error);
      return null;
    }
  }

  // Update user settings (simplified - can be enhanced with user_settings table)
  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<boolean> {
    try {
      // For now, just return success (can be enhanced with database storage)
      console.log(`User ${userId} settings updated:`, settings);
      return true;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return false;
    }
  }
}

export const settingsService = new SettingsService();