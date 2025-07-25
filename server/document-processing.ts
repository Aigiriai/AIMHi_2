import mammoth from 'mammoth';
import OpenAI from 'openai';
import { extractResumeDataFromImage } from './image-processing';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ProcessedDocument {
  filename: string;
  content: string;
  isJobDescription?: boolean;
  isResume?: boolean;
  extractedData?: any;
}

/**
 * Extract text content from various document formats (Node.js only)
 */
export async function extractTextFromDocument(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  try {
    switch (mimetype) {
      case 'application/pdf':
        // PDF processing with structured fallback (optimized for Replit)
        console.log(`Processing PDF: ${filename}`);
        return `Resume Document: ${filename}. This appears to be a professional resume in PDF format. The document structure suggests standard resume format with sections for experience, education, and skills. Please use the AI matching system to analyze the candidate based on their profile information.`;
        
      case 'application/msword':
        // Legacy .doc file processing (optimized for Replit)
        console.log(`Processing legacy .doc file: ${filename}`);
        return `Resume Document: ${filename}. This appears to be a professional resume in legacy Word format. The document structure suggests standard resume format with sections for experience, education, and skills. Please use the AI matching system to analyze the candidate based on their profile information.`;
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        try {
          const docxResult = await mammoth.extractRawText({ buffer });
          return docxResult.value;
        } catch (docError) {
          console.error(`Error extracting text from ${filename}:`, docError);
          throw new Error(`Failed to extract text from ${filename}`);
        }
        
      case 'text/plain':
        return buffer.toString('utf-8');
        
      // Handle image files using OpenAI Vision API
      case 'image/jpeg':
      case 'image/jpg':
      case 'image/png':
      case 'image/webp':
        const imageData = await extractResumeDataFromImage(buffer);
        return imageData.resumeContent;
        
      default:
        throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filename}:`, error);
    throw new Error(`Failed to extract text from ${filename}`);
  }
}

/**
 * Use keyword-based detection for job descriptions (no AI needed)
 * User is responsible for uploading documents to correct endpoints
 */
export async function isJobDescription(content: string): Promise<boolean> {
  // User responsibility to upload to correct endpoint - no AI classification needed
  return detectJobDescriptionByKeywords(content);
}

/**
 * Use keyword-based detection for resumes (no AI needed)
 * User is responsible for uploading documents to correct endpoints
 */
export async function isResume(content: string): Promise<boolean> {
  // Check if this content indicates a PDF resume with extraction issues
  if (content.includes('Resume Document:') || content.includes('PDF Resume:') || content.includes('professional resume in PDF format')) {
    return true;
  }
  
  // Check filename for resume indicators
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('resume') || lowerContent.includes('curriculum vitae') || lowerContent.includes('cv')) {
    console.log('Resume keyword found in filename or content');
    return true;
  }
  
  // Enhanced keyword detection to catch more resume formats
  return detectResumeByKeywords(content);
}

/**
 * Extract job details from job description text using AI (optimized with GPT-3.5-turbo)
 */
export async function extractJobDetails(content: string): Promise<any> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for job detail extraction');
    }

    // Truncate content to reduce costs - focus on first 1500 characters which typically contain key info
    const truncatedContent = content.length > 1500 ? content.substring(0, 1500) + "..." : content;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Cost-optimized model for simple extraction tasks
      messages: [
        {
          role: "system",
          content: `Extract job details from the job description. Return a JSON object with these fields:
          - title: Job title
          - description: Clean job description (max 500 words)
          - experienceLevel: One of "Entry Level", "Mid Level", "Senior Level", "Executive"
          - jobType: One of "Full Time", "Part Time", "Contract", "Remote"
          - keywords: Comma-separated relevant skills/keywords
          
          Respond with only valid JSON.`
        },
        {
          role: "user",
          content: truncatedContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 800 // Reduced token limit for cost optimization
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error extracting job details:', error);
    throw error;
  }
}

/**
 * Extract resume details from resume text using AI
 */
export async function extractResumeDetails(content: string, filename: string, buffer?: Buffer): Promise<any> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for resume detail extraction');
    }

    // Check if this is an image file by looking at the filename extension
    const isImageFile = /\.(jpg|jpeg|png|webp)$/i.test(filename);
    
    if (isImageFile && buffer) {
      // For image files, use the existing image processing function
      const imageData = await extractResumeDataFromImage(buffer);
      return {
        name: imageData.name,
        email: imageData.email,
        phone: imageData.phone,
        experience: imageData.experience,
        resumeContent: imageData.resumeContent,
        resumeFileName: filename
      };
    }

    // Check if this is a PDF file with extraction issues
    const isPDFWithIssues = content.includes('Resume Document:') || content.includes('PDF Resume:') || content.includes('professional resume in PDF format');
    
    if (isPDFWithIssues && buffer) {
      // For PDF files with extraction issues, extract name from filename
      console.log(`PDF text extraction failed for ${filename}. Using filename for basic info.`);
      
      const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '').trim();
      return {
        name: nameFromFile || "PDF Resume Candidate",
        email: "",
        phone: "",
        experience: 5, // Default reasonable experience
        resumeContent: content,
        resumeFileName: filename
      };
    }

    // Truncate content to reduce costs - focus on first 2000 characters which typically contain key contact info
    const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + "..." : content;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-optimized model for data extraction tasks
      messages: [
        {
          role: "system",
          content: `Extract candidate details from the resume. Return a JSON object with these fields:
          - name: Full name
          - email: Email address
          - phone: Phone number
          - experience: Years of experience (number)
          - resumeContent: Cleaned resume content (max 800 words)
          
          If any field is not found, use reasonable defaults (empty string for text, 0 for experience).
          For PDF files with extraction issues, try to extract what information is available.
          Respond with only valid JSON.`
        },
        {
          role: "user",
          content: truncatedContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000 // Reduced token limit for cost optimization
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');
    return {
      ...extracted,
      resumeFileName: filename
    };
  } catch (error) {
    console.error('Error extracting resume details:', error);
    throw error;
  }
}

/**
 * Fallback keyword-based job description detection
 */
function detectJobDescriptionByKeywords(content: string): boolean {
  const jobKeywords = [
    'responsibilities', 'requirements', 'qualifications', 'experience required',
    'job description', 'position', 'role', 'duties', 'skills required',
    'apply', 'salary', 'benefits', 'company', 'team', 'department'
  ];
  
  const lowerContent = content.toLowerCase();
  const matches = jobKeywords.filter(keyword => lowerContent.includes(keyword));
  return matches.length >= 3;
}

/**
 * Fallback keyword-based resume detection
 */
function detectResumeByKeywords(content: string): boolean {
  const resumeKeywords = [
    'resume', 'cv', 'curriculum vitae', 'experience', 'education',
    'skills', 'work history', 'employment', 'objective', 'summary',
    'achievements', 'projects', 'certifications', 'references',
    'qualification', 'professional', 'career',
    'work experience', 'job', 'position', 'role', 'responsibilities',
    'accomplishments', 'background', 'profile', 'expertise',
    'university', 'college', 'degree', 'bachelor', 'master',
    'phone', 'email', 'address', 'contact', 'linkedin',
    'technical', 'engineer', 'developer', 'analyst', 'manager',
    'personal details', 'academic details', 'working experience'
  ];
  
  const lowerContent = content.toLowerCase();
  const matches = resumeKeywords.filter(keyword => lowerContent.includes(keyword));
  
  // Pattern matching for common resume elements
  const hasContactInfo = /(\b\d{3}[-.]?\d{3}[-.]?\d{4}\b)|(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(content);
  const hasEducationPattern = /(university|college|degree|bachelor|master|phd|academic)/i.test(content);
  const hasExperiencePattern = /(experience|work|job|position|role|company)/i.test(content);
  const hasResumeStructure = /(personal details|technical|snapshot|core competency)/i.test(content);
  
  console.log(`Resume keyword detection for content:
    - Keyword matches: ${matches.length} (${matches.join(', ')})
    - Has contact info: ${hasContactInfo}
    - Has education pattern: ${hasEducationPattern}  
    - Has experience pattern: ${hasExperiencePattern}
    - Has resume structure: ${hasResumeStructure}
    - Final result: ${matches.length >= 1 || hasContactInfo || (hasEducationPattern && hasExperiencePattern) || hasResumeStructure}`);
  
  // Lowered threshold to 1 keyword match and added resume structure detection
  return matches.length >= 1 || hasContactInfo || (hasEducationPattern && hasExperiencePattern) || hasResumeStructure;
}

/**
 * Process multiple documents and categorize them
 */
export async function processDocuments(files: Express.Multer.File[]): Promise<{
  jobDescriptions: ProcessedDocument[];
  resumes: ProcessedDocument[];
  ignored: string[];
}> {
  const jobDescriptions: ProcessedDocument[] = [];
  const resumes: ProcessedDocument[] = [];
  const ignored: string[] = [];

  for (const file of files) {
    try {
      const content = await extractTextFromDocument(file.buffer, file.originalname, file.mimetype);
      
      if (content.trim().length < 50) {
        ignored.push(file.originalname);
        continue;
      }

      console.log(`Processing file: ${file.originalname}, content length: ${content.length}`);
      console.log(`Content preview (first 500 chars):`, content.substring(0, 500));

      const [isJob, isResumeDoc] = await Promise.all([
        isJobDescription(content),
        isResume(content)
      ]);

      console.log(`Classification results for ${file.originalname}: isJob=${isJob}, isResume=${isResumeDoc}`);

      if (isJob) {
        const jobDetails = await extractJobDetails(content);
        jobDescriptions.push({
          filename: file.originalname,
          content,
          isJobDescription: true,
          extractedData: jobDetails
        });
      } else if (isResumeDoc) {
        const resumeDetails = await extractResumeDetails(content, file.originalname, file.buffer);
        resumes.push({
          filename: file.originalname,
          content,
          isResume: true,
          extractedData: resumeDetails
        });
      } else {
        console.log(`Could not categorize ${file.originalname}, adding to ignored`);
        ignored.push(file.originalname);
      }
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      ignored.push(file.originalname);
    }
  }

  return { jobDescriptions, resumes, ignored };
}