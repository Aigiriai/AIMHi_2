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
  technicalDepth: number;
  projectDomainExperience: number;
}

export interface MatchWeights {
  skills: number;
  experience: number;
  keywords: number;
  technicalDepth: number;
  projectDomain: number;
}

export interface DetailedMatchResult {
  candidateId: number;
  matchPercentage: number;
  reasoning: string;
  criteriaScores: MatchCriteria;
  weightedScores: MatchCriteria;
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
async function extractCriticalTechnologies(
  jobDescription: string,
  keywords: string,
): Promise<string[]> {
  try {
    const combined = jobDescription + (keywords ? ` ${keywords}` : "");

    const prompt = `
Analyze the following job description and extract the critical technologies, then also identify closely associated technologies that are extremely relevant to this domain.

Job Description: ${combined}

Extract technologies in these categories:
1. PRIMARY CRITICAL TECHNOLOGIES - Specific platforms/systems explicitly mentioned (e.g., Hogan, SAP, Salesforce, Oracle, AWS)
2. Programming languages that are mandatory (not just "nice to have")
3. Critical databases or data systems
4. Essential frameworks or libraries
5. Required cloud platforms
6. Specialized domain technologies

Then for each primary technology, identify ASSOCIATED TECHNOLOGIES that are extremely closely related:
- If C Programming is mentioned → include C++, Device Drivers, Embedded Programming, Firmware, Real-time Systems
- If Hogan is mentioned → include Core Banking, Mainframe, COBOL, JCL, DB2, VSAM, CICS, Banking Systems, Financial Services
- If React is mentioned → include JavaScript, TypeScript, Node.js, JSX, Redux, Next.js, Frontend Development
- If AWS is mentioned → include EC2, S3, Lambda, CloudFormation, RDS, DynamoDB, Cloud Computing, DevOps
- If SAP is mentioned → include ABAP, SAP HANA, SAP Fiori, SAP BASIS, SAP MM, SAP SD, ERP Systems
- If Java is mentioned → include Spring, Spring Boot, Hibernate, Maven, Gradle, JPA, Backend Development
- If Python is mentioned → include Django, Flask, FastAPI, Pandas, NumPy, Data Science, Backend Development
- If .NET is mentioned → include C#, ASP.NET, Entity Framework, Azure, Microsoft Technologies
- If Oracle is mentioned → include PL/SQL, Oracle Database, SQL, Database Administration, TOAD

Rules:
- Only extract technologies that are clearly REQUIRED, not optional
- Include both primary and closely associated technologies, synonyms, and domain terms
- Focus on comprehensive domain coverage (banking with banking, cloud with cloud)
- Include industry terminology and related job functions
- Limit to maximum 50 total technologies for comprehensive matching

Respond with a JSON object:
{
  "primary_technologies": ["explicit technology from JD"],
  "associated_technologies": ["closely related technology1", "related technology2"],
  "all_critical_technologies": ["combined list of primary + associated"]
}

Example output: 
{
  "primary_technologies": ["Hogan", "COBOL"],
  "associated_technologies": ["Core Banking", "Mainframe", "JCL", "DB2", "VSAM", "CICS"],
  "all_critical_technologies": ["Hogan", "COBOL", "Core Banking", "Mainframe", "JCL", "DB2", "VSAM", "CICS"]
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
      '{"all_critical_technologies": []}';
    const result = JSON.parse(content);

    // Handle different possible response formats
    let technologies: string[] = [];
    if (
      result.all_critical_technologies &&
      Array.isArray(result.all_critical_technologies)
    ) {
      technologies = result.all_critical_technologies;
    } else if (result.technologies && Array.isArray(result.technologies)) {
      technologies = result.technologies;
    } else if (
      result.critical_technologies &&
      Array.isArray(result.critical_technologies)
    ) {
      technologies = result.critical_technologies;
    } else if (Array.isArray(result)) {
      technologies = result;
    }

    // Filter and normalize
    const filteredTechnologies = technologies
      .filter((tech) => tech && typeof tech === "string" && tech.length > 1)
      .map((tech) => tech.trim().toUpperCase())
      .slice(0, 50); // Increased to 50 technologies for comprehensive coverage

    // Log the extracted technologies for debugging
    console.log("Extracted critical technologies:", {
      primary: result.primary_technologies || [],
      associated: result.associated_technologies || [],
      total: filteredTechnologies,
    });

    return filteredTechnologies;
  } catch (error) {
    console.error("Error extracting critical technologies:", error);
    // Fallback to basic keyword extraction if AI fails
    return extractFallbackTechnologies(jobDescription, keywords);
  }
}

// Fallback method for technology extraction if AI fails
function extractFallbackTechnologies(
  jobDescription: string,
  keywords: string,
): string[] {
  const techAssociations: { [key: string]: string[] } = {
    hogan: ["CORE BANKING", "MAINFRAME", "COBOL", "JCL", "DB2", "VSAM", "CICS"],
    sap: ["ABAP", "SAP HANA", "SAP FIORI", "SAP BASIS", "SAP MM", "SAP SD"],
    oracle: ["PL/SQL", "ORACLE DB", "ORACLE FORMS", "ORACLE REPORTS", "TOAD"],
    salesforce: ["APEX", "VISUALFORCE", "LIGHTNING", "SOQL", "CRM"],
    aws: ["EC2", "S3", "LAMBDA", "CLOUDFORMATION", "RDS", "DYNAMODB"],
    azure: ["AZURE FUNCTIONS", "AZURE SQL", "AZURE DEVOPS", "POWER BI"],
    react: ["JAVASCRIPT", "TYPESCRIPT", "NODE.JS", "JSX", "REDUX"],
    angular: ["TYPESCRIPT", "RXJS", "ANGULAR CLI", "ANGULAR MATERIAL"],
    java: ["SPRING", "HIBERNATE", "MAVEN", "GRADLE", "JPA"],
    python: ["DJANGO", "FLASK", "PANDAS", "NUMPY", "SCIKIT-LEARN"],
    kubernetes: ["DOCKER", "HELM", "KUBECTL", "MICROSERVICES"],
    mainframe: ["COBOL", "JCL", "DB2", "VSAM", "CICS", "TSO"],
    cobol: ["MAINFRAME", "JCL", "DB2", "VSAM", "CICS"],
  };

  const combined = (jobDescription + " " + keywords).toLowerCase();
  const foundTechnologies: string[] = [];

  // Find primary technologies
  for (const [primaryTech, associatedTechs] of Object.entries(
    techAssociations,
  )) {
    if (combined.includes(primaryTech.toLowerCase())) {
      foundTechnologies.push(primaryTech.toUpperCase());
      // Add associated technologies
      foundTechnologies.push(...associatedTechs);
    }
  }

  // Add other common technologies found
  const additionalTechs = [
    "gcp",
    "mysql",
    "postgresql",
    "mongodb",
    "redis",
    "elasticsearch",
    "kafka",
  ];
  for (const tech of additionalTechs) {
    if (combined.includes(tech.toLowerCase())) {
      foundTechnologies.push(tech.toUpperCase());
    }
  }

  return foundTechnologies
    .filter((tech, index) => foundTechnologies.indexOf(tech) === index)
    .slice(0, 50);
}

// Apply strict domain validation rules to enforce technology requirements
function applyDomainValidationRules(
  initialScore: number,
  criticalTechnologies: string[],
  jobDescription: string,
  resumeContent: string,
  criteriaScores: MatchCriteria,
): number {
  if (criticalTechnologies.length === 0) {
    return initialScore; // No critical technologies detected, use original score
  }

  const normalizedResume = resumeContent.toLowerCase();
  const normalizedJob = jobDescription.toLowerCase();

  // Check for presence of each critical technology in resume
  const missingCriticalTech: string[] = [];
  const foundCriticalTech: string[] = [];

  for (const tech of criticalTechnologies) {
    if (normalizedResume.includes(tech.toLowerCase())) {
      foundCriticalTech.push(tech);
    } else {
      missingCriticalTech.push(tech);
    }
  }

  // Calculate penalty based on missing critical technologies
  const criticalTechPercentage =
    foundCriticalTech.length / criticalTechnologies.length;

  // Apply severe penalties for missing critical technologies
  if (criticalTechPercentage === 0) {
    // No critical technologies found - maximum 20% match
    return Math.min(initialScore, 20);
  } else if (criticalTechPercentage < 0.5) {
    // Less than 50% of critical technologies - maximum 35% match
    return Math.min(initialScore, 35);
  } else if (criticalTechPercentage < 1.0) {
    // Missing some critical technologies - cap at 60%
    return Math.min(initialScore, 60);
  }

  // Additional domain mismatch checks
  const isDomainMismatch = checkDomainMismatch(normalizedJob, normalizedResume);
  if (isDomainMismatch) {
    // Complete domain mismatch - maximum 25% match
    return Math.min(initialScore, 25);
  }

  return initialScore; // No penalties, return original score
}

// Check for major domain mismatches
function checkDomainMismatch(
  jobDescription: string,
  resumeContent: string,
): boolean {
  const bankingKeywords = [
    "banking",
    "finance",
    "core banking",
    "hogan",
    "temenos",
    "mainframe",
    "cobol",
  ];
  const audioKeywords = [
    "audio",
    "bluetooth",
    "sound",
    "music",
    "speaker",
    "headphone",
  ];
  const webKeywords = [
    "web development",
    "frontend",
    "backend",
    "react",
    "angular",
    "vue",
  ];
  const testingKeywords = [
    "test automation",
    "selenium",
    "appium",
    "qa",
    "testing framework",
  ];

  const isBankingJob = bankingKeywords.some((keyword) =>
    jobDescription.includes(keyword),
  );
  const isAudioResume = audioKeywords.some((keyword) =>
    resumeContent.includes(keyword),
  );
  const isWebResume = webKeywords.some((keyword) =>
    resumeContent.includes(keyword),
  );
  const isTestingResume = testingKeywords.some((keyword) =>
    resumeContent.includes(keyword),
  );

  // Banking job with non-banking resume
  if (isBankingJob && (isAudioResume || isWebResume || isTestingResume)) {
    return true;
  }

  return false;
}

export async function matchCandidateToJob(
  job: Job,
  candidate: Candidate,
  weights?: MatchWeights,
): Promise<DetailedMatchResult> {
  try {
    // Default weights if not provided - heavily prioritizing domain-specific experience
    const defaultWeights: MatchWeights = {
      skills: 20,
      experience: 10,
      keywords: 30,
      technicalDepth: 10,
      projectDomain: 30, // Maximum weight for domain-specific requirements
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

    // Extract critical domain-specific technologies from job description
    const criticalTechnologies = await extractCriticalTechnologies(
      fullJobDescription,
      job.keywords || "",
    );
    const hasCriticalTech = criticalTechnologies.length > 0;

    // Pre-filter: Check if candidate has ANY critical technologies before expensive AI processing
    if (hasCriticalTech) {
      const normalizedResumeContent = fullResumeContent.toLowerCase();
      const foundTechCount = criticalTechnologies.filter((tech) =>
        normalizedResumeContent.includes(tech.toLowerCase()),
      ).length;

      if (foundTechCount === 0) {
        // No critical technologies found - skip AI processing and return low score
        console.log(
          `Pre-filter rejection: Candidate ${candidate.name} has no critical technologies`,
        );
        return {
          candidateId: candidate.id,
          matchPercentage: 5,
          reasoning: `Pre-screening failed: No critical technologies found in resume. Required technologies: ${criticalTechnologies.join(", ")}. This candidate's background does not align with the essential technical requirements for this role.`,
          criteriaScores: {
            skillsMatch: 5,
            experienceLevel: 5,
            keywordRelevance: 5,
            technicalDepth: 5,
            projectDomainExperience: 5,
          },
          weightedScores: {
            skillsMatch: 1,
            experienceLevel: 0.5,
            keywordRelevance: 1.5,
            technicalDepth: 0.5,
            projectDomainExperience: 1.5,
          },
        };
      }

      console.log(
        `Pre-filter passed: Candidate ${candidate.name} has ${foundTechCount}/${criticalTechnologies.length} critical technologies`,
      );
    }

    const prompt = `
You are an expert HR AI assistant that analyzes job requirements and candidate profiles with advanced multi-criteria matching, with special emphasis on domain-specific technology experience and keyword recency.

Job Position: ${job.title}
Job Description: ${fullJobDescription}
Required Experience Level: ${job.experienceLevel}
Job Type: ${job.jobType}
Keywords: ${job.keywords}

${
  hasCriticalTech
    ? `
CRITICAL DOMAIN TECHNOLOGIES DETECTED: ${criticalTechnologies.join(", ")}
WARNING: This job requires specific platform/technology experience. Candidates without direct experience with these technologies should receive significantly lower scores.
`
    : ""
}

Candidate Profile:
Name: ${candidate.name}
Experience: ${candidate.experience} years
Resume Content: ${fullResumeContent}

ANALYSIS CRITERIA (Rate each from 0-100):

1. SKILLS MATCH (Weight: ${finalWeights.skills}%):
   - Technical skills alignment with job requirements
   - Programming languages/tools match
   - Specialized competencies and certifications

2. EXPERIENCE LEVEL (Weight: ${finalWeights.experience}%):
   - Years of experience vs requirements
   - Seniority level appropriateness
   - Career progression alignment

3. KEYWORD RELEVANCE & RECENCY (Weight: ${finalWeights.keywords}%):
   - Job keywords present in resume
   - CRITICAL: Parse employment dates accurately - "Present", "Current", "Till Date" means ONGOING work
   - Employment periods like "Aug 2024 - Present" or "April 2019 - Present" = CURRENT work (100% relevance)
   - Skills used currently or within last 2 years: 100% relevance
   - Skills used 3-5 years ago: 80% relevance
   - Skills used 6-8 years ago: 60% relevance
   - Skills used 8+ years ago: 40% relevance or lower
   - Continuous employment with technology from past to present = Maximum recency score
   - Industry terminology usage and domain-specific language

4. TECHNICAL DEPTH vs BREADTH (Weight: ${finalWeights.technicalDepth}%):
   - Specialist vs generalist assessment
   - Deep expertise in specific domains vs broad knowledge
   - Advanced technical competencies
   - Mastery level of core technologies

5. PROJECT/DOMAIN EXPERIENCE (Weight: ${finalWeights.projectDomain}%):
   - CRITICAL: Direct experience with specific technologies mentioned in job requirements
   - If job mentions specific platforms (e.g., Hogan, SAP, Oracle), candidate MUST have worked with those exact platforms
   - Candidates without domain-specific experience should score 0-20% in this category
   - Similar domain/industry background and project complexity
   - Technology stack and methodology familiarity

CRITICAL MATCHING RULES - MANDATORY REQUIREMENTS:
1. EXACT TECHNOLOGY MATCH REQUIREMENT: If the job mentions specific platforms/systems (like Hogan, SAP, Salesforce, Oracle), candidates MUST have that exact experience:
   - NO EXPERIENCE with required platform: Project Domain score = 0%, Overall score ≤ 30%
   - ZERO mention of required technology: Automatic severe penalty across all criteria
   - Limited/indirect experience: Project Domain score = 10-30%, Overall score ≤ 50%
   - Direct recent experience: Project Domain score = 80-100%

2. ABSOLUTE KEYWORD REQUIREMENTS: For specialized technologies, absence = disqualification:
   - Banking job requiring Hogan but no Hogan experience: Maximum 25% overall match
   - ERP job requiring SAP but no SAP experience: Maximum 25% overall match
   - Missing critical domain keywords should result in FAILING scores

3. ZERO TOLERANCE FOR DOMAIN MISMATCHES: 
   - Audio/Bluetooth engineer applying for banking role: Maximum 20% match
   - Web developer applying for mainframe role: Maximum 20% match
   - Different industry backgrounds should be heavily penalized

4. OVERALL SCORING CONSTRAINTS:
   - No critical domain experience: Overall score ≤ 25%
   - Wrong domain entirely: Overall score ≤ 20%
   - Missing essential technologies: Overall score ≤ 30%

CONSISTENCY REQUIREMENTS:
- Use exact numeric scoring (avoid ranges like "75-80")
- Identical resume content must produce identical scores
- Base scores on quantifiable metrics rather than subjective interpretation
- Be extremely strict about domain-specific technology requirements

CRITICAL DATE PARSING AND RECENCY ANALYSIS:
- Parse employment dates carefully (e.g., "Aug 2024 - Present", "April 2019 - Present")
- "Present" means current/ongoing work (highly recent)
- Work from 2023-Present = Very Recent (100% recency)
- Work from 2020-2022 = Recent (80% recency)
- Work from 2017-2019 = Somewhat Recent (60% recency)
- Work from 2014-2016 = Less Recent (40% recency)
- Work older than 2014 = Not Recent (20% recency)
- Continuous employment in a technology from past to present = Maximum recency score
- Pay special attention to "Present", "Current", "Till Date" indicators

Provide detailed analysis with specific attention to accurate skill recency and currency parsing.

Respond in JSON format with:
{
  "criteriaScores": {
    "skillsMatch": number,
    "experienceLevel": number,
    "keywordRelevance": number,
    "technicalDepth": number,
    "projectDomainExperience": number
  },
  "overallMatchPercentage": number,
  "detailedReasoning": "comprehensive explanation including skill recency analysis",
  "scoreExplanations": {
    "skillsMatch": "Why this specific score for skills alignment",
    "experienceLevel": "Why this specific score for experience match", 
    "keywordRelevance": "Why this specific score for keyword/recency match",
    "technicalDepth": "Why this specific score for technical depth",
    "projectDomainExperience": "Why this specific score for domain experience"
  },
  "overallScoreJustification": "Why the overall percentage makes sense given the criteria",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendations": "hiring recommendation with focus on skill currency"
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
      technicalDepth: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.technicalDepth ||
            result.overallMatchPercentage ||
            50,
        ),
      ),
      projectDomainExperience: Math.max(
        0,
        Math.min(
          100,
          result.criteriaScores?.projectDomainExperience ||
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
      technicalDepth:
        (criteriaScores.technicalDepth * finalWeights.technicalDepth) / 100,
      projectDomainExperience:
        (criteriaScores.projectDomainExperience * finalWeights.projectDomain) /
        100,
    };

    // Calculate initial weighted score
    let initialMatchPercentage = Math.round(
      weightedScores.skillsMatch +
        weightedScores.experienceLevel +
        weightedScores.keywordRelevance +
        weightedScores.technicalDepth +
        weightedScores.projectDomainExperience,
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

• Technical Depth: ${criteriaScores.technicalDepth}% (Weight: ${finalWeights.technicalDepth}% = ${weightedScores.technicalDepth.toFixed(1)} points)
  ${scoreExplanations.technicalDepth ? `AI Explanation: ${scoreExplanations.technicalDepth}` : ""}

• Project/Domain Experience: ${criteriaScores.projectDomainExperience}% (Weight: ${finalWeights.projectDomain}% = ${weightedScores.projectDomainExperience.toFixed(1)} points)
  ${scoreExplanations.projectDomainExperience ? `AI Explanation: ${scoreExplanations.projectDomainExperience}` : ""}

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

    return {
      candidateId: candidate.id,
      matchPercentage: Math.max(0, Math.min(100, finalMatchPercentage)),
      reasoning: enhancedReasoning,
      criteriaScores,
      weightedScores,
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
      technicalDepth: 0,
      projectDomainExperience: 0,
    };
    return {
      candidateId: candidate.id,
      matchPercentage: 0,
      reasoning: `Error occurred during advanced matching analysis: ${error instanceof Error ? error.message : "Unknown error"}`,
      criteriaScores: defaultScores,
      weightedScores: defaultScores,
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
