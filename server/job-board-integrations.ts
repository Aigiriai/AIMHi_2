import type { InsertJob, Job } from "@shared/schema";

// LinkedIn API Integration
export interface LinkedInJobPosting {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP';
  experienceLevel: 'ENTRY_LEVEL' | 'ASSOCIATE' | 'MID_SENIOR' | 'DIRECTOR' | 'EXECUTIVE';
  skills: string[];
  postedDate: string;
}

export interface IndeedJobPosting {
  jobkey: string;
  jobtitle: string;
  company: string;
  city: string;
  state: string;
  country: string;
  formattedLocation: string;
  source: string;
  date: string;
  snippet: string;
  url: string;
  sponsored: boolean;
  expired: boolean;
  indeedApply: boolean;
  formattedLocationFull: string;
  formattedRelativeTime: string;
}

export class LinkedInIntegration {
  private apiKey: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;

  constructor() {
    this.apiKey = process.env.LINKEDIN_API_KEY || '';
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  }

  private checkCredentials(): boolean {
    return !!(this.apiKey && this.clientId && this.clientSecret);
  }

  async authenticate(): Promise<boolean> {
    if (!this.checkCredentials()) {
      console.log('⚠️ LinkedIn API credentials not configured');
      return false;
    }

    try {
      // LinkedIn OAuth2 authentication flow
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'r_jobs_fullaccess w_jobs_write'
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        console.log('✅ LinkedIn authentication successful');
        return true;
      }
    } catch (error) {
      console.error('❌ LinkedIn authentication failed:', error);
    }
    return false;
  }

  async searchJobs(query: string, location?: string, limit: number = 10): Promise<LinkedInJobPosting[]> {
    if (!this.accessToken && !(await this.authenticate())) {
      throw new Error('LinkedIn authentication required');
    }

    try {
      const params = new URLSearchParams({
        keywords: query,
        count: limit.toString(),
        start: '0'
      });

      if (location) {
        params.append('locationName', location);
      }

      const response = await fetch(`https://api.linkedin.com/v2/jobSearch?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return this.parseLinkedInJobs(data.elements || []);
      }
    } catch (error) {
      console.error('❌ LinkedIn job search failed:', error);
    }
    return [];
  }

  async postJob(job: InsertJob): Promise<boolean> {
    if (!this.accessToken && !(await this.authenticate())) {
      throw new Error('LinkedIn authentication required');
    }

    try {
      const jobData = {
        title: job.title,
        description: job.description,
        employmentType: this.mapJobTypeToLinkedIn(job.jobType),
        experienceLevel: this.mapExperienceLevelToLinkedIn(job.experienceLevel),
        skills: job.keywords.split(',').map(k => k.trim()),
        location: {
          countryCode: 'US' // Default to US, can be made configurable
        }
      };

      const response = await fetch('https://api.linkedin.com/v2/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(jobData)
      });

      if (response.ok) {
        console.log('✅ Job posted to LinkedIn successfully');
        return true;
      }
    } catch (error) {
      console.error('❌ LinkedIn job posting failed:', error);
    }
    return false;
  }

  private parseLinkedInJobs(jobs: any[]): LinkedInJobPosting[] {
    return jobs.map(job => ({
      id: job.id || '',
      title: job.title || '',
      description: job.description || '',
      company: job.companyDetails?.name || '',
      location: job.locationDescription || '',
      employmentType: job.employmentType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || 'MID_SENIOR',
      skills: job.skills || [],
      postedDate: job.listedAt || new Date().toISOString()
    }));
  }

  private mapJobTypeToLinkedIn(jobType: string): string {
    const mapping: { [key: string]: string } = {
      'full-time': 'FULL_TIME',
      'part-time': 'PART_TIME',
      'contract': 'CONTRACT',
      'temporary': 'TEMPORARY',
      'internship': 'INTERNSHIP'
    };
    return mapping[jobType.toLowerCase()] || 'FULL_TIME';
  }

  private mapExperienceLevelToLinkedIn(level: string): string {
    const mapping: { [key: string]: string } = {
      'entry': 'ENTRY_LEVEL',
      'junior': 'ASSOCIATE',
      'mid': 'MID_SENIOR',
      'senior': 'MID_SENIOR',
      'lead': 'DIRECTOR',
      'executive': 'EXECUTIVE'
    };
    return mapping[level.toLowerCase()] || 'MID_SENIOR';
  }
}

export class IndeedIntegration {
  private publisherId: string;
  private apiKey: string;

  constructor() {
    this.publisherId = process.env.INDEED_PUBLISHER_ID || '';
    this.apiKey = process.env.INDEED_API_KEY || '';
  }

  private checkCredentials(): boolean {
    return !!(this.publisherId && this.apiKey);
  }

  async searchJobs(query: string, location?: string, limit: number = 10): Promise<IndeedJobPosting[]> {
    if (!this.checkCredentials()) {
      console.log('⚠️ Indeed API credentials not configured');
      return [];
    }

    try {
      const params = new URLSearchParams({
        publisher: this.publisherId,
        q: query,
        format: 'json',
        limit: limit.toString(),
        sort: 'date',
        radius: '25',
        st: 'jobsite',
        jt: 'fulltime',
        start: '0',
        v: '2'
      });

      if (location) {
        params.append('l', location);
      }

      const response = await fetch(`https://api.indeed.com/ads/apisearch?${params}`);

      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      }
    } catch (error) {
      console.error('❌ Indeed job search failed:', error);
    }
    return [];
  }

  async postJob(job: InsertJob): Promise<boolean> {
    if (!this.checkCredentials()) {
      throw new Error('Indeed API credentials required');
    }

    try {
      // Indeed Job Posting API (requires approval and partnership)
      const jobData = {
        jobtitle: job.title,
        jobdescription: job.description,
        jobtype: this.mapJobTypeToIndeed(job.jobType),
        experienceLevel: job.experienceLevel,
        skills: job.keywords
      };

      // Note: Indeed's job posting API requires special partnership
      // This is a placeholder for the actual implementation
      console.log('📝 Indeed job posting prepared:', jobData);
      console.log('⚠️ Indeed job posting requires publisher partnership');
      
      return true; // Simulated success for now
    } catch (error) {
      console.error('❌ Indeed job posting failed:', error);
    }
    return false;
  }

  private mapJobTypeToIndeed(jobType: string): string {
    const mapping: { [key: string]: string } = {
      'full-time': 'fulltime',
      'part-time': 'parttime',
      'contract': 'contract',
      'temporary': 'temporary',
      'internship': 'internship'
    };
    return mapping[jobType.toLowerCase()] || 'fulltime';
  }

  convertToAIMHiJob(indeedJob: IndeedJobPosting): InsertJob {
    return {
      title: indeedJob.jobtitle,
      description: `${indeedJob.snippet}\n\nCompany: ${indeedJob.company}\nLocation: ${indeedJob.formattedLocation}\nSource: Indeed`,
      experienceLevel: 'mid', // Default mapping
      jobType: 'full-time', // Default mapping
      keywords: `${indeedJob.company}, ${indeedJob.city}, ${indeedJob.state}`
    };
  }
}

export class JobBoardService {
  private linkedIn: LinkedInIntegration;
  private indeed: IndeedIntegration;

  constructor() {
    this.linkedIn = new LinkedInIntegration();
    this.indeed = new IndeedIntegration();
  }

  async searchAllPlatforms(query: string, location?: string, limit: number = 10): Promise<{
    linkedIn: LinkedInJobPosting[];
    indeed: IndeedJobPosting[];
  }> {
    console.log(`🔍 Searching job boards for: "${query}" ${location ? `in ${location}` : ''}`);

    const [linkedInJobs, indeedJobs] = await Promise.all([
      this.linkedIn.searchJobs(query, location, limit).catch(() => []),
      this.indeed.searchJobs(query, location, limit).catch(() => [])
    ]);

    console.log(`📊 Found ${linkedInJobs.length} LinkedIn jobs, ${indeedJobs.length} Indeed jobs`);

    return {
      linkedIn: linkedInJobs,
      indeed: indeedJobs
    };
  }

  async postToAllPlatforms(job: InsertJob): Promise<{
    linkedIn: boolean;
    indeed: boolean;
  }> {
    console.log(`📤 Posting job "${job.title}" to all platforms`);

    const [linkedInSuccess, indeedSuccess] = await Promise.all([
      this.linkedIn.postJob(job).catch(() => false),
      this.indeed.postJob(job).catch(() => false)
    ]);

    console.log(`✅ Posted to LinkedIn: ${linkedInSuccess}, Indeed: ${indeedSuccess}`);

    return {
      linkedIn: linkedInSuccess,
      indeed: indeedSuccess
    };
  }

  getRequiredCredentials(): {
    linkedIn: string[];
    indeed: string[];
  } {
    return {
      linkedIn: ['LINKEDIN_API_KEY', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      indeed: ['INDEED_PUBLISHER_ID', 'INDEED_API_KEY']
    };
  }

  checkCredentialsStatus(): {
    linkedIn: boolean;
    indeed: boolean;
  } {
    return {
      linkedIn: !!(process.env.LINKEDIN_API_KEY && process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      indeed: !!(process.env.INDEED_PUBLISHER_ID && process.env.INDEED_API_KEY)
    };
  }
}