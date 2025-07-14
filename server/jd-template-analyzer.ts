import OpenAI from "openai";
import type { JobTemplate, InsertJobTemplate } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface JDAnalysisResult {
  positionTitle: string;
  seniorityLevel: string;
  department?: string;
  mandatorySkills: string[];
  preferredSkills: string[];
  skillProficiencyLevels: Record<string, string>;
  primaryTechnologies: string[];
  secondaryTechnologies: string[];
  technologyCategories: Record<string, string[]>;
  minimumYearsRequired: number;
  specificDomainExperience: string[];
  industryBackground: string[];
  technicalTasksPercentage: number;
  leadershipTasksPercentage: number;
  domainTasksPercentage: number;
  skillsMatchWeight: number;
  experienceWeight: number;
  keywordWeight: number;
  technicalDepthWeight: number;
  domainKnowledgeWeight: number;
  analysisQuality: number;
  confidence: number;
}

export async function analyzeJobDescription(
  jobTitle: string,
  jobDescription: string,
  experienceLevel: string,
  jobType: string,
  keywords: string
): Promise<JDAnalysisResult> {
  const prompt = `
You are an expert HR analyst specializing in job description standardization. Analyze the following job description and extract structured information to populate a standardized template.

JOB INFORMATION:
Title: ${jobTitle}
Experience Level: ${experienceLevel}
Job Type: ${jobType}
Keywords: ${keywords}

JOB DESCRIPTION:
${jobDescription}

ANALYSIS REQUIREMENTS:

1. SKILLS CLASSIFICATION:
   - Mandatory Skills: Skills that are absolutely required (must-have)
   - Preferred Skills: Skills that are nice-to-have or bonus qualifications
   - For each skill, determine proficiency level: "beginner", "intermediate", "expert"

2. TECHNOLOGY CATEGORIZATION:
   - Primary Technologies: Core technologies essential for the role
   - Secondary Technologies: Supporting tools and frameworks
   - Group technologies by category (e.g., "Programming Languages", "Databases", "Cloud Platforms")

3. EXPERIENCE ANALYSIS:
   - Determine minimum years of experience required
   - Identify specific domain experience needed
   - Extract industry background requirements

4. RESPONSIBILITY BREAKDOWN:
   - Estimate percentage of technical tasks (coding, development, technical implementation)
   - Estimate percentage of leadership tasks (management, mentoring, planning)
   - Estimate percentage of domain-specific tasks (business analysis, industry knowledge)
   - Total should equal 100%

5. ROLE CLASSIFICATION:
   - Determine seniority level: "junior", "mid", "senior", "lead", "principal"
   - Extract department/team information if mentioned

6. MATCHING CRITERIA WEIGHTS:
   Based on the role type, suggest appropriate weights for matching criteria:
   - Skills Match Weight (typical: 20-30%)
   - Experience Weight (typical: 10-20%)
   - Keyword Relevance Weight (typical: 30-40%)
   - Technical Depth Weight (typical: 10-15%)
   - Domain Knowledge Weight (typical: 15-25%)
   - Total should equal 100%

7. QUALITY ASSESSMENT:
   - Rate analysis quality from 1-100 based on how much structured information could be extracted
   - Rate confidence level from 1-100 based on clarity of the original job description

RESPOND IN JSON FORMAT:
{
  "positionTitle": "extracted or refined position title",
  "seniorityLevel": "junior|mid|senior|lead|principal",
  "department": "department name if identifiable",
  "mandatorySkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "skillProficiencyLevels": {
    "skill1": "beginner|intermediate|expert",
    "skill2": "beginner|intermediate|expert"
  },
  "primaryTechnologies": ["tech1", "tech2"],
  "secondaryTechnologies": ["tool1", "tool2"],
  "technologyCategories": {
    "Programming Languages": ["Java", "Python"],
    "Databases": ["MySQL", "PostgreSQL"],
    "Cloud Platforms": ["AWS", "Azure"]
  },
  "minimumYearsRequired": number,
  "specificDomainExperience": ["domain1", "domain2"],
  "industryBackground": ["industry1", "industry2"],
  "technicalTasksPercentage": number,
  "leadershipTasksPercentage": number,
  "domainTasksPercentage": number,
  "skillsMatchWeight": number,
  "experienceWeight": number,
  "keywordWeight": number,
  "technicalDepthWeight": number,
  "domainKnowledgeWeight": number,
  "analysisQuality": number,
  "confidence": number
}

IMPORTANT GUIDELINES:
- Be conservative with mandatory vs preferred skills - only mark as mandatory if explicitly required
- Extract exact technology names and versions when mentioned
- If information is unclear, use reasonable defaults based on role type
- Ensure all percentage fields add up to 100
- Use consistent naming conventions for skills and technologies
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistent analysis
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and ensure required fields exist
    return {
      positionTitle: result.positionTitle || jobTitle,
      seniorityLevel: result.seniorityLevel || experienceLevel.toLowerCase(),
      department: result.department || null,
      mandatorySkills: result.mandatorySkills || [],
      preferredSkills: result.preferredSkills || [],
      skillProficiencyLevels: result.skillProficiencyLevels || {},
      primaryTechnologies: result.primaryTechnologies || [],
      secondaryTechnologies: result.secondaryTechnologies || [],
      technologyCategories: result.technologyCategories || {},
      minimumYearsRequired: result.minimumYearsRequired || 0,
      specificDomainExperience: result.specificDomainExperience || [],
      industryBackground: result.industryBackground || [],
      technicalTasksPercentage: result.technicalTasksPercentage || 70,
      leadershipTasksPercentage: result.leadershipTasksPercentage || 20,
      domainTasksPercentage: result.domainTasksPercentage || 10,
      skillsMatchWeight: result.skillsMatchWeight || 25,
      experienceWeight: result.experienceWeight || 15,
      keywordWeight: result.keywordWeight || 35,
      technicalDepthWeight: result.technicalDepthWeight || 10,
      domainKnowledgeWeight: result.domainKnowledgeWeight || 15,
      analysisQuality: result.analysisQuality || 75,
      confidence: result.confidence || 75,
    };
  } catch (error) {
    console.error("JD Analysis Error:", error);
    throw new Error("Failed to analyze job description");
  }
}

export async function createJobTemplate(
  jobId: number,
  organizationId: number,
  jobTitle: string,
  jobDescription: string,
  experienceLevel: string,
  jobType: string,
  keywords: string
): Promise<InsertJobTemplate> {
  const analysis = await analyzeJobDescription(
    jobTitle,
    jobDescription,
    experienceLevel,
    jobType,
    keywords
  );

  return {
    jobId,
    organizationId,
    positionTitle: analysis.positionTitle,
    seniorityLevel: analysis.seniorityLevel,
    department: analysis.department,
    mandatorySkills: analysis.mandatorySkills,
    preferredSkills: analysis.preferredSkills,
    skillProficiencyLevels: analysis.skillProficiencyLevels,
    primaryTechnologies: analysis.primaryTechnologies,
    secondaryTechnologies: analysis.secondaryTechnologies,
    technologyCategories: analysis.technologyCategories,
    minimumYearsRequired: analysis.minimumYearsRequired,
    specificDomainExperience: analysis.specificDomainExperience,
    industryBackground: analysis.industryBackground,
    technicalTasksPercentage: analysis.technicalTasksPercentage,
    leadershipTasksPercentage: analysis.leadershipTasksPercentage,
    domainTasksPercentage: analysis.domainTasksPercentage,
    skillsMatchWeight: analysis.skillsMatchWeight,
    experienceWeight: analysis.experienceWeight,
    keywordWeight: analysis.keywordWeight,
    technicalDepthWeight: analysis.technicalDepthWeight,
    domainKnowledgeWeight: analysis.domainKnowledgeWeight,
    rawJobDescription: jobDescription,
    aiGeneratedData: analysis,
    templateVersion: "1.0",
    status: "generated",
    reviewedBy: null,
  };
}