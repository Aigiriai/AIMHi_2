import OpenAI from "openai";
import type { Job, Candidate } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY_ENV_VAR ||
    "default_key",
});

export interface MatchCriteria {
  skillsMatch: number;
  experienceLevel: number;
  keywordRelevance: number;
  professionalDepth: number;
  domainExperience: number;
}

export interface MatchWeights {
  skills: number;
  experience: number;
  keywords: number;
  professionalDepth: number;
  domainExperience: number;
}

export interface SkillAnalysis {
  skillsHas: string[];
  skillsMissing: string[];
  criteriaExplanation: string;
}

export interface DetailedMatchResult {
  candidateId: number;
  matchPercentage: number;
  reasoning: string;
  criteriaScores: MatchCriteria;
  weightedScores: MatchCriteria;
  skillAnalysis: {
    skillsMatch: SkillAnalysis;
    experienceLevel: SkillAnalysis;
    keywordRelevance: SkillAnalysis;
    professionalDepth: SkillAnalysis;
    domainExperience: SkillAnalysis;
  };
}

export interface MatchResult {
  candidateId: number;
  matchPercentage: number;
  reasoning: string;
}

// Normalize resume content to ensure consistent analysis
function normalizeResumeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[^\w\s]/g, " ") // Remove special characters
    .trim();
}

// Generate a hash for consistent seed generation
function generateContentHash(
  jobDescription: string,
  resumeContent: string,
): number {
  const combined = normalizeResumeContent(jobDescription + resumeContent);
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Extract critical domain-specific technologies from job description using AI
async function extractCriticalRequirements(
  jobDescription: string,
  keywords: string,
): Promise<string[]> {
  try {
    const combined = jobDescription + (keywords ? ` ${keywords}` : "");

    const prompt = `
Analyze the following job description and extract the critical requirements, skills, and qualifications explicitly mentioned as essential for this role.

Job Description: ${combined}

Extract requirements in these categories:
1. ESSENTIAL SKILLS - Specific skills, competencies, or abilities explicitly mentioned as required
2. REQUIRED QUALIFICATIONS - Degrees, certifications, licenses, or credentials that are mandatory
3. CRITICAL TOOLS/EQUIPMENT - Specific tools, software, equipment, or systems that must be used
4. MANDATORY EXPERIENCE - Specific types of experience, processes, or methodologies required
5. ESSENTIAL KNOWLEDGE - Domain-specific knowledge, procedures, or expertise areas
6. REQUIRED CAPABILITIES - Physical, mental, or professional capabilities needed

Rules:
- Only extract requirements that are clearly REQUIRED, ESSENTIAL, or MANDATORY
- Include exact terms, names, and phrases from the job description
- Focus on specific, measurable requirements rather than generic terms
- Include professional terminology and industry-specific language
- Avoid inferring or adding requirements not explicitly stated
- Limit to maximum 30 total requirements for focused matching

Respond with a JSON object:
{
  "essential_requirements": ["requirement1", "requirement2", "requirement3"],
  "all_critical_requirements": ["combined list of all essential requirements"]
}

Example for a nursing position:
{
  "essential_requirements": ["RN License", "CPR Certification", "IV Therapy", "Electronic Health Records", "Patient Assessment"],
  "all_critical_requirements": ["RN License", "CPR Certification", "IV Therapy", "Electronic Health Records", "Patient Assessment"]
}

Example for a pilot position:
{
  "essential_requirements": ["Commercial Pilot License", "Instrument Rating", "Aviation Medical Certificate", "Flight Hours", "Radio Communication"],
  "all_critical_requirements": ["Commercial Pilot License", "Instrument Rating", "Aviation Medical Certificate", "Flight Hours", "Radio Communication"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.0,
    });

    const content =
      response.choices[0].message.content ||
      '{"all_critical_requirements": []}';
    const result = JSON.parse(content);

    // Handle different possible response formats
    let requirements: string[] = [];
    if (
      result.all_critical_requirements &&
      Array.isArray(result.all_critical_requirements)
    ) {
      requirements = result.all_critical_requirements;
    } else if (result.essential_requirements && Array.isArray(result.essential_requirements)) {
      requirements = result.essential_requirements;
    } else if (result.requirements && Array.isArray(result.requirements)) {
      requirements = result.requirements;
    } else if (Array.isArray(result)) {
      requirements = result;
    }

    // Filter and normalize
    const filteredRequirements = requirements
      .filter((req) => req && typeof req === "string" && req.length > 1)
      .map((req) => req.trim().toUpperCase())
      .slice(0, 30); // Focused on 30 critical requirements

    // Log the extracted requirements for debugging
    console.log("Extracted critical requirements:", {
      essential: result.essential_requirements || [],
      total: filteredRequirements,
    });

    return filteredRequirements;
  } catch (error) {
    console.error("Error extracting critical requirements:", error);
    // Fallback to basic keyword extraction if AI fails
    return extractFallbackRequirements(jobDescription, keywords);
  }
}

// Fallback method for requirements extraction if AI fails
function extractFallbackRequirements(
  jobDescription: string,
  keywords: string,
): string[] {
  const combined = `${jobDescription} ${keywords}`.toLowerCase();
  
  // Generic requirement patterns that work across all professions
  const requirementPatterns = [
    /required:?\s*([^.]+)/gi,
    /must have:?\s*([^.]+)/gi,
    /essential:?\s*([^.]+)/gi,
    /mandatory:?\s*([^.]+)/gi,
    /minimum:?\s*([^.]+)/gi,
    /qualification:?\s*([^.]+)/gi,
    /license:?\s*([^.]+)/gi,
    /certification:?\s*([^.]+)/gi,
    /degree:?\s*([^.]+)/gi,
    /experience:?\s*([^.]+)/gi,
  ];

  const foundRequirements: string[] = [];
  
  requirementPatterns.forEach(pattern => {
    const matches = combined.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const requirement = match.replace(/^(required|must have|essential|mandatory|minimum|qualification|license|certification|degree|experience):?\s*/i, '').trim();
        if (requirement.length > 2) {
          foundRequirements.push(requirement.toUpperCase());
        }
      });
    }
  });

  return foundRequirements.slice(0, 20); // Limit to 20 requirements
}

// Domain validation rules have been removed to eliminate sector-specific biases
// The system now relies purely on AI's natural language understanding

// Function removed to eliminate sector-specific biases

export async function matchCandidateToJob(
  job: Job,
  candidate: Candidate,
  weights?: MatchWeights,
): Promise<DetailedMatchResult> {
  try {
    // Default weights if not provided - balanced approach across all criteria
    const defaultWeights: MatchWeights = {
      skills: 25,
      experience: 15,
      keywords: 25,
      professionalDepth: 15,
      domainExperience: 20, // Experience in the specific field/domain
    };

    const finalWeights = weights || defaultWeights;

    // Generate consistent seed based on content for deterministic results
    const contentSeed = generateContentHash(
      job.description,
      candidate.resumeContent,
    );

    // Normalize content to ensure consistent analysis
    const normalizedResumeContent = normalizeResumeContent(
      candidate.resumeContent,
    );
    const normalizedJobDescription = normalizeResumeContent(job.description);

    // Use original content for display but normalized for consistent hashing
    const fullResumeContent = candidate.resumeContent;
    const fullJobDescription = job.description;

    // Extract critical requirements from job description
    const criticalRequirements = await extractCriticalRequirements(
      fullJobDescription,
      job.keywords || "",
    );
    const hasCriticalReq = criticalRequirements.length > 0;

    // Pre-filter: Check if candidate has ANY critical requirements before expensive AI processing
    if (hasCriticalReq) {
      const normalizedResumeContent = fullResumeContent.toLowerCase();
      const foundReqCount = criticalRequirements.filter((req) =>
        normalizedResumeContent.includes(req.toLowerCase()),
      ).length;

      if (foundReqCount === 0) {
        // No critical requirements found - skip AI processing and return low score
        console.log(
          `Pre-filter rejection: Candidate ${candidate.name} has no critical requirements`,
        );
        return {
          candidateId: candidate.id,
          matchPercentage: 5,
          reasoning: `Pre-screening failed: No critical requirements found in resume. Required qualifications: ${criticalRequirements.join(", ")}. This candidate's background does not align with the essential requirements for this role.`,
          criteriaScores: {
            skillsMatch: 5,
            experienceLevel: 5,
            keywordRelevance: 5,
            professionalDepth: 5,
            domainExperience: 5,
          },
          weightedScores: {
            skillsMatch: 1.25,
            experienceLevel: 0.75,
            keywordRelevance: 1.25,
            professionalDepth: 0.75,
            domainExperience: 1.0,
          },
        };
      }

      console.log(
        `Pre-filter passed: Candidate ${candidate.name} has ${foundReqCount}/${criticalRequirements.length} critical requirements`,
      );
    }

    const prompt = `
You are an expert HR AI assistant that analyzes job requirements and candidate profiles with advanced multi-criteria matching, focusing on accurate skill assessment and experience recency analysis across all professions.

Job Position: ${job.title}
Job Description: ${fullJobDescription}
Required Experience Level: ${job.experienceLevel}
Job Type: ${job.jobType}
Keywords: ${job.keywords}

${
  hasCriticalReq
    ? `
CRITICAL REQUIREMENTS DETECTED: ${criticalRequirements.join(", ")}
NOTE: This job has specific requirements that are essential for success in this role. Candidates without direct experience with these requirements should receive appropriately adjusted scores.
`
    : ""
}

Candidate Profile:
Name: ${candidate.name}
Experience: ${candidate.experience} years
Resume Content: ${fullResumeContent}

ANALYSIS CRITERIA (Rate each from 0-100):

1. SKILLS MATCH (Weight: ${finalWeights.skills}%):
   - Required competencies alignment with job requirements
   - Tools, equipment, software, or methodologies match
   - Professional skills and certifications
   - Domain-specific abilities and knowledge
   - IMPORTANT: In skillBreakdown.skillsMatch, list specific skills the candidate HAS vs MISSING

2. EXPERIENCE LEVEL (Weight: ${finalWeights.experience}%):
   - Years of experience vs requirements
   - Seniority level appropriateness
   - Career progression alignment
   - Leadership and responsibility level match

3. KEYWORD RELEVANCE & RECENCY (Weight: ${finalWeights.keywords}%):
   - Job keywords present in resume
   - CRITICAL: Parse employment dates accurately - "Present", "Current", "Till Date" means ONGOING work
   - Employment periods like "Aug 2024 - Present" or "April 2019 - Present" = CURRENT work (100% relevance)
   - Experience from 2023-Present = Very Recent (100% relevance)
   - Experience from 2020-2022 = Recent (80% relevance)
   - Experience from 2017-2019 = Somewhat Recent (60% relevance)
   - Experience from 2014-2016 = Less Recent (40% relevance)
   - Experience older than 2014 = Not Recent (20% relevance)
   - Continuous employment in relevant field from past to present = Maximum recency score
   - Professional terminology usage and field-specific language

4. PROFESSIONAL DEPTH vs BREADTH (Weight: ${finalWeights.professionalDepth}%):
   - Specialist vs generalist assessment
   - Deep expertise in specific domains vs broad knowledge
   - Advanced professional competencies
   - Mastery level of core skills and methodologies

5. DOMAIN/FIELD EXPERIENCE (Weight: ${finalWeights.domainExperience}%):
   - Direct experience with specific requirements mentioned in job description
   - Relevant industry, sector, or field background
   - Similar work environment and project complexity
   - Methodology, process, and system familiarity

CONSISTENCY REQUIREMENTS:
- Use exact numeric scoring (avoid ranges like "75-80")
- Identical resume content must produce identical scores
- Base scores on quantifiable metrics rather than subjective interpretation
- Focus on exact matches and demonstrated experience

CRITICAL DATE PARSING AND RECENCY ANALYSIS:
- Parse employment dates carefully (e.g., "Aug 2024 - Present", "April 2019 - Present")
- "Present" means current/ongoing work (highly recent)
- Work from 2023-Present = Very Recent (100% recency)
- Work from 2020-2022 = Recent (80% recency)
- Work from 2017-2019 = Somewhat Recent (60% recency)
- Work from 2014-2016 = Less Recent (40% recency)
- Work older than 2014 = Not Recent (20% recency)
- Continuous employment in relevant field from past to present = Maximum recency score
- Pay special attention to "Present", "Current", "Till Date" indicators

Provide detailed analysis with specific attention to accurate experience recency and qualification matching.

Respond in JSON format with:
{
  "criteriaScores": {
    "skillsMatch": number,
    "experienceLevel": number,
    "keywordRelevance": number,
    "professionalDepth": number,
    "domainExperience": number
  },
  "overallMatchPercentage": number,
  "detailedReasoning": "comprehensive explanation including experience recency analysis",
  "scoreExplanations": {
    "skillsMatch": "Why this specific score for skills alignment",
    "experienceLevel": "Why this specific score for experience match", 
    "keywordRelevance": "Why this specific score for keyword/recency match",
    "professionalDepth": "Why this specific score for professional depth",
    "domainExperience": "Why this specific score for domain experience"
  },
  "overallScoreJustification": "Why the overall percentage makes sense given the criteria",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendations": "hiring recommendation with focus on experience currency",
  "skillBreakdown": {
    "skillsMatch": {
      "has": ["specific skills/competencies candidate possesses"],
      "missing": ["specific skills/competencies candidate lacks"]
    },
    "experienceLevel": {
      "has": ["experience levels/types candidate has"],
      "missing": ["experience gaps candidate has"]
    },
    "keywordRelevance": {
      "has": ["job keywords found in candidate resume"],
      "missing": ["job keywords not found in candidate resume"]
    },
    "professionalDepth": {
      "has": ["areas of deep expertise candidate shows"],
      "missing": ["areas where candidate needs deeper expertise"]
    },
    "domainExperience": {
      "has": ["relevant industry/domain experience candidate has"],
      "missing": ["industry/domain experience candidate lacks"]
    }
  }

CRITICAL INSTRUCTIONS FOR SKILL BREAKDOWN:
- For each criteria, provide specific, actionable items in "has" and "missing" arrays
- "has" should contain actual skills/experience found in the candidate's resume
- "missing" should contain specific requirements from the job that the candidate doesn't have
- Be specific rather than generic (e.g., "React.js" not "frontend skills")
- Include at least 2-5 items in each "has" and "missing" array when possible
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Cost-optimized model with increased token allowance
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2500, // Increased tokens for detailed analysis with cheaper model
      temperature: 0.0, // Set to 0 for deterministic results
      seed: contentSeed, // Use content-based seed for identical resumes to get identical results
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Calculate weighted scores with fallback values
    const criteriaScores: MatchCriteria = {
      skillsMatch: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.skillsMatch ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
      experienceLevel: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.experienceLevel ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
      keywordRelevance: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.keywordRelevance ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
      professionalDepth: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.professionalDepth ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
      domainExperience: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.domainExperience ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
    };

    const weightedScores: MatchCriteria = {
      skillsMatch: (criteriaScores.skillsMatch * finalWeights.skills) / 100,
      experienceLevel:
        (criteriaScores.experienceLevel * finalWeights.experience) / 100,
      keywordRelevance:
        (criteriaScores.keywordRelevance * finalWeights.keywords) / 100,
      professionalDepth:
        (criteriaScores.professionalDepth * finalWeights.professionalDepth) / 100,
      domainExperience:
        (criteriaScores.domainExperience * finalWeights.domainExperience) / 100,
    };

    // Calculate initial weighted score
    let initialMatchPercentage = Math.round(
      weightedScores.skillsMatch +
        weightedScores.experienceLevel +
        weightedScores.keywordRelevance +
        weightedScores.professionalDepth +
        weightedScores.domainExperience,
    );

    // dont Apply strict domain-specific validation rules
    const finalMatchPercentage = initialMatchPercentage; //applyDomainValidationRules(
    //  initialMatchPercentage,
    //criticalTechnologies,
    //fullJobDescription,
    //fullResumeContent,
    //criteriaScores
    //);

    // Enhanced reasoning with criteria breakdown and AI explanations
    const scoreExplanations = result.scoreExplanations || {};
    const enhancedReasoning = `
MATCH ANALYSIS BREAKDOWN:

Overall Score: ${finalMatchPercentage}%
${result.overallScoreJustification ? `Overall Justification: ${result.overallScoreJustification}` : ""}

CRITERIA SCORES WITH AI EXPLANATIONS:
• Skills Match: ${criteriaScores.skillsMatch}% (Weight: ${finalWeights.skills}% = ${weightedScores.skillsMatch.toFixed(1)} points)
  ${scoreExplanations.skillsMatch ? `AI Explanation: ${scoreExplanations.skillsMatch}` : ""}

• Experience Level: ${criteriaScores.experienceLevel}% (Weight: ${finalWeights.experience}% = ${weightedScores.experienceLevel.toFixed(1)} points)
  ${scoreExplanations.experienceLevel ? `AI Explanation: ${scoreExplanations.experienceLevel}` : ""}

• Keyword Relevance: ${criteriaScores.keywordRelevance}% (Weight: ${finalWeights.keywords}% = ${weightedScores.keywordRelevance.toFixed(1)} points)
  ${scoreExplanations.keywordRelevance ? `AI Explanation: ${scoreExplanations.keywordRelevance}` : ""}

• Professional Depth: ${criteriaScores.professionalDepth}% (Weight: ${finalWeights.professionalDepth}% = ${weightedScores.professionalDepth.toFixed(1)} points)
  ${scoreExplanations.professionalDepth ? `AI Explanation: ${scoreExplanations.professionalDepth}` : ""}

• Domain Experience: ${criteriaScores.domainExperience}% (Weight: ${finalWeights.domainExperience}% = ${weightedScores.domainExperience.toFixed(1)} points)
  ${scoreExplanations.domainExperience ? `AI Explanation: ${scoreExplanations.domainExperience}` : ""}

CALCULATION METHOD:
Initial AI Score: ${initialMatchPercentage}%
Final Score After Validation: ${finalMatchPercentage}%
${initialMatchPercentage !== finalMatchPercentage ? "(Score adjusted by domain validation rules)" : "(No domain adjustments applied)"}

DETAILED ANALYSIS:
${result.detailedReasoning || "No detailed reasoning provided"}

STRENGTHS:
${result.strengths ? result.strengths.map((s: string) => `• ${s}`).join("\n") : "• None identified"}

CONCERNS:
${result.concerns ? result.concerns.map((c: string) => `• ${c}`).join("\n") : "• None identified"}

RECOMMENDATION:
${result.recommendations || "No specific recommendation provided"}
`;

    // Extract skill analysis from the AI result
    const skillAnalysis = {
      skillsMatch: {
        skillsHas: result.skillBreakdown?.skillsMatch?.has || [],
        skillsMissing: result.skillBreakdown?.skillsMatch?.missing || [],
        criteriaExplanation: result.scoreExplanations?.skillsMatch || 'No explanation available'
      },
      experienceLevel: {
        skillsHas: result.skillBreakdown?.experienceLevel?.has || [],
        skillsMissing: result.skillBreakdown?.experienceLevel?.missing || [],
        criteriaExplanation: result.scoreExplanations?.experienceLevel || 'No explanation available'
      },
      keywordRelevance: {
        skillsHas: result.skillBreakdown?.keywordRelevance?.has || [],
        skillsMissing: result.skillBreakdown?.keywordRelevance?.missing || [],
        criteriaExplanation: result.scoreExplanations?.keywordRelevance || 'No explanation available'
      },
      professionalDepth: {
        skillsHas: result.skillBreakdown?.professionalDepth?.has || [],
        skillsMissing: result.skillBreakdown?.professionalDepth?.missing || [],
        criteriaExplanation: result.scoreExplanations?.professionalDepth || 'No explanation available'
      },
      domainExperience: {
        skillsHas: result.skillBreakdown?.domainExperience?.has || [],
        skillsMissing: result.skillBreakdown?.domainExperience?.missing || [],
        criteriaExplanation: result.scoreExplanations?.domainExperience || 'No explanation available'
      }
    };

    return {
      candidateId: candidate.id,
      matchPercentage: Math.max(0, Math.min(100, finalMatchPercentage)),
      reasoning: enhancedReasoning,
      criteriaScores,
      weightedScores,
      skillAnalysis,
    };
  } catch (error) {
    console.error(
      "Error in advanced AI matching for candidate",
      candidate.id,
      ":",
      error,
    );
    const defaultScores = {
      skillsMatch: 0,
      experienceLevel: 0,
      keywordRelevance: 0,
      professionalDepth: 0,
      domainExperience: 0,
    };
    return {
      candidateId: candidate.id,
      matchPercentage: 0,
      reasoning: `Error occurred during advanced matching analysis: ${error instanceof Error ? error.message : "Unknown error"}`,
      criteriaScores: defaultScores,
      weightedScores: defaultScores,
      skillAnalysis: {
        skillsMatch: { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Error occurred during analysis' },
        experienceLevel: { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Error occurred during analysis' },
        keywordRelevance: { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Error occurred during analysis' },
        professionalDepth: { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Error occurred during analysis' },
        domainExperience: { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Error occurred during analysis' }
      },
    };
  }
}

export async function batchMatchCandidates(
  job: Job,
  candidates: Candidate[],
  weights?: MatchWeights,
): Promise<DetailedMatchResult[]> {
  const results = await Promise.all(
    candidates.map((candidate) => matchCandidateToJob(job, candidate, weights)),
  );
  return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
