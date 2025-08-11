import mammoth from 'mammoth';
import OpenAI from 'openai';
import { extractResumeDataFromImage } from './image-processing';

// Import pdfjs-dist with proper error handling for environments where it might not be available
let pdfjsLib: any = null;
let pdfjsInitialized = false;

async function initializePdfJs() {
  if (!pdfjsInitialized) {
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
      // Disable worker to avoid issues in server environments
      pdfjsLib.GlobalWorkerOptions.workerSrc = null;
      pdfjsInitialized = true;
      console.log('✅ PDF.js library initialized successfully');
    } catch (error) {
      console.warn('❌ PDF.js library not available. PDF files will use fallback processing.');
      pdfjsInitialized = true; // Mark as initialized even if failed to avoid repeated attempts
    }
  }
  return pdfjsLib;
}

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
        // Enhanced PDF processing with pdfjs-dist
        console.log(`🔍 Processing PDF: ${filename} with advanced text extraction`);
        
        const pdfLib = await initializePdfJs();
        if (pdfLib) {
          try {
            const typedArray = new Uint8Array(buffer);
            const loadingTask = pdfLib.getDocument({ data: typedArray });
            const pdfDocument = await loadingTask.promise;
            
            let extractedText = '';
            const numPages = pdfDocument.numPages;
            console.log(`📄 PDF has ${numPages} pages`);
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              const page = await pdfDocument.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              extractedText += pageText + '\n';
            }
            
            // Validate extracted text quality
            if (extractedText && extractedText.trim().length > 100) {
              console.log(`✅ PDF text extraction successful for ${filename} (${extractedText.length} characters)`);
              return extractedText.trim();
            } else {
              console.log(`⚠️ PDF text extraction yielded minimal content for ${filename}`);
              // Fall through to fallback processing
            }
          } catch (pdfError) {
            console.error(`❌ PDF parsing error for ${filename}:`, pdfError);
            // Fall through to fallback processing
          }
        }
        
        // Fallback for PDFs that couldn't be parsed or when pdf-parse is unavailable
        console.log(`📄 Using structured fallback for PDF: ${filename}`);
        return `PDF Document: ${filename}. 
        
IMPORTANT: This PDF requires manual text extraction for optimal results. 
The document appears to be a professional document that may contain:
- Professional experience and work history
- Technical skills and competencies  
- Educational background and certifications
- Contact information and personal details
- Project experience and achievements

For accurate AI matching, please either:
1. Convert this PDF to text format and re-upload
2. Use the manual entry form to input key information
3. Upload as an image file for OCR processing

File has been stored for reference and can be downloaded later.`;
        
      case 'application/msword':
        // Enhanced legacy .doc file processing
        console.log(`🔍 Processing legacy .doc file: ${filename}`);
        console.log(`📄 Using structured fallback for legacy DOC: ${filename}`);
        return `Legacy Word Document: ${filename}. 

IMPORTANT: This legacy Word document requires conversion for optimal results.
The document appears to be a professional document that may contain:
- Professional experience and work history
- Technical skills and competencies
- Educational background and certifications
- Contact information and personal details  
- Project experience and achievements

For accurate AI matching, please either:
1. Convert to .docx format and re-upload
2. Save as PDF and re-upload  
3. Use the manual entry form to input key information

File has been stored for reference and can be downloaded later.`;
        
        
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

    // Check if this is a PDF file with extraction issues (old fallback content)
    const isPDFWithIssues = content.includes('PDF Document:') && content.includes('manual text extraction');
    
    if (isPDFWithIssues && buffer) {
      // For PDF files with extraction issues, try to re-extract using pdfjs-dist
      const pdfLib = await initializePdfJs();
      if (pdfLib) {
        try {
          console.log(`🔄 Attempting direct PDF re-extraction for resume processing: ${filename}`);
          const typedArray = new Uint8Array(buffer);
          const loadingTask = pdfLib.getDocument({ data: typedArray });
          const pdfDocument = await loadingTask.promise;
          
          let extractedText = '';
          const numPages = pdfDocument.numPages;
          
          // Extract text from all pages
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            extractedText += pageText + '\n';
          }
          
          if (extractedText && extractedText.trim().length > 100) {
            console.log(`✅ Direct PDF extraction successful for resume: ${filename}`);
            // Use the extracted text instead of the fallback content
            content = extractedText.trim();
          }
        } catch (pdfError) {
          console.error(`❌ Direct PDF extraction failed for resume: ${filename}`, pdfError);
        }
      }
      
      // If still no good content, extract name from filename and use structured fallback
      if (content.includes('manual text extraction')) {
        console.log(`📄 PDF text extraction failed for ${filename}. Using filename for basic info.`);
        
        const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '').trim();
        return {
          name: nameFromFile || "PDF Resume Candidate",
          email: "",
          phone: "",
          experience: 3, // Conservative default
          resumeContent: `Professional resume document: ${filename}. 
          
This appears to be a PDF resume that requires manual processing. 
The candidate's name appears to be: ${nameFromFile}

For accurate matching, please:
1. Convert PDF to text format and re-upload
2. Use manual entry to input key details
3. Upload as image for OCR processing

Document has been stored and can be downloaded for manual review.`,
          resumeFileName: filename
        };
      }
    }

    // Enhanced content processing - truncate intelligently for cost optimization
    let truncatedContent = content;
    if (content.length > 3000) {
      // For longer content, try to keep the most important parts
      const firstPart = content.substring(0, 1500); // Contact info and summary usually at top
      const lastPart = content.substring(content.length - 1500); // Recent experience usually at bottom
      truncatedContent = firstPart + "\n\n[...CONTENT TRUNCATED FOR PROCESSING...]\n\n" + lastPart;
    }

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
          - resumeContent: Cleaned resume content focusing on key skills, experience, and achievements (max 800 words)
          
          If any field is not found, use reasonable defaults (empty string for text, 0 for experience).
          For PDF files with extraction issues, extract what information is available from the provided content.
          Focus on extracting actual skills, technologies, job roles, and measurable achievements.
          Respond with only valid JSON.`
        },
        {
          role: "user",
          content: truncatedContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200 // Increased slightly for better extraction quality
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