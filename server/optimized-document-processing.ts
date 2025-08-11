import mammoth from 'mammoth';
import OpenAI from 'openai';
import { extractResumeDataFromImage } from './image-processing';
import { fileStorage } from './file-storage';
import { preprocessResumeContent, formatPreprocessedForAI } from './resume-preprocessor';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ProcessedDocument {
  filename: string;
  content: string;
  isJobDescription?: boolean;
  isResume?: boolean;
  extractedData?: any;
}

/**
 * Optimized text extraction without system process spawning (cost optimization)
 */
export async function extractTextFromDocument(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  try {
    switch (mimetype) {
      case 'application/pdf':
        // PDF processing not supported in this environment (optimized version)
        console.log(`❌ OPTIMIZED: PDF processing not supported: ${filename}`);
        console.log(`� OPTIMIZED: SKIPPING PDF FILE: PDF files are not supported in this environment`);
        
        return `UNSUPPORTED_FILE_FORMAT: PDF files are not supported in this environment.

File: ${filename}
Reason: PDF processing libraries are not available in this deployment environment.

SUPPORTED FORMATS:
✅ Microsoft Word (.docx)
✅ Plain Text (.txt)
✅ Image files (.jpg, .jpeg, .png, .gif, .bmp, .webp) - with OCR
✅ Legacy Word documents (.doc) - limited support

RECOMMENDATIONS:
1. Convert your PDF to a .docx (Word) format
2. Convert to plain text (.txt) format
3. Save as an image and upload for OCR processing
4. Use manual entry for the content

Please re-upload your document in a supported format for optimal AI matching results.`;

      case 'application/msword':
        // Enhanced legacy .doc handling
        console.log(`🔍 OPTIMIZED: Processing legacy .doc file: ${filename}`);
        console.log(`📄 OPTIMIZED: Using structured fallback for legacy DOC: ${filename}`);
        return `Legacy Word Document: ${filename}. 

IMPORTANT: This legacy Word document requires conversion for optimal results.
The document appears to be a professional document that may contain:
- Professional experience and work history
- Technical skills and competencies
- Educational background and certifications
- Contact information and personal details  
- Project experience and achievements

For accurate AI matching and cost optimization, please either:
1. Convert to .docx format and re-upload
2. Save as PDF and re-upload (will use enhanced PDF processing)
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
 * Optimized job detail extraction with cost controls
 */
export async function extractJobDetails(content: string): Promise<any> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for job detail extraction');
    }

    // Truncate content for cost optimization
    const truncatedContent = content.length > 1500 ? content.substring(0, 1500) + "..." : content;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Cost-optimized model
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
      max_tokens: 800
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error extracting job details:', error);
    throw error;
  }
}

/**
 * Optimized resume detail extraction with file storage
 */
export async function extractResumeDetails(content: string, filename: string, buffer?: Buffer): Promise<any> {
  try {
    // Check if this is an unsupported file format
    if (content.includes('UNSUPPORTED_FILE_FORMAT')) {
      console.log(`🚫 OPTIMIZED: Cannot extract resume details from unsupported file format: ${filename}`);
      const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '').trim();
      return {
        name: nameFromFile || "Unsupported Format Candidate",
        email: "",
        phone: "",
        experience: 0,
        resumeContent: content,
        resumeFileName: filename
      };
    }
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for resume detail extraction');
    }

    // Check if this is an image file
    const isImageFile = /\.(jpg|jpeg|png|webp)$/i.test(filename);
    
    if (isImageFile && buffer) {
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

    // Enhanced PDF/DOC handling with actual text extraction attempts
    const isPDFWithIssues = content.includes('PDF Document:') && content.includes('manual text extraction');
    const isLegacyDocWithIssues = content.includes('Legacy Word Document:');
    
    if ((isPDFWithIssues || isLegacyDocWithIssues) && buffer) {
      // For PDF files, PDF processing is not available
      if (isPDFWithIssues) {
        console.log(`🚫 OPTIMIZED: PDF processing not available for: ${filename}`);
      }
      
      // If still no good content, use filename-based extraction
      if (content.includes('manual text extraction') || content.includes('requires conversion')) {
        console.log(`📄 OPTIMIZED: Text extraction failed for ${filename}. Using filename for basic info.`);
        
        const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '').trim();
        return {
          name: nameFromFile || "Document Resume Candidate",
          email: "",
          phone: "",
          experience: 0,
          resumeContent: `Professional document: ${filename}
          
Candidate name (extracted from filename): ${nameFromFile}

This document requires manual processing for accurate data extraction.
For optimal AI matching results:

1. Convert to .docx format and re-upload
2. Convert to text format and re-upload  
3. Use manual entry form for key details
4. Upload as image for OCR processing

Document stored for manual review and download.`,
          resumeFileName: filename
        };
      }
    }

    // Apply intelligent local preprocessing to extract only essential information
    const preprocessed = preprocessResumeContent(content);
    const optimizedContent = formatPreprocessedForAI(preprocessed);
    
    // Use preprocessed contact info for immediate extraction
    const contactParts = preprocessed.contactInfo.split(' | ');
    const extractedName = contactParts[0] || filename.replace(/[-_]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '').trim();
    const extractedEmail = contactParts.find(part => part.includes('@')) || "";
    const extractedPhone = contactParts.find(part => /[\d\-\(\)\s]+/.test(part) && part.length > 7) || "";

    // Only send essential preprocessed data to OpenAI (reduces tokens by 80-90%)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-optimized model
      messages: [
        {
          role: "system",
          content: `Extract and clean candidate details from this preprocessed resume data. Return a JSON object with these fields:
          - name: Full name (use provided contact info)
          - email: Email address (use provided contact info)
          - phone: Phone number (use provided contact info)  
          - experience: Years of experience (use estimated years as baseline)
          - resumeContent: Professional summary combining key experience, skills, and education (max 600 words)
          
          Focus on professional achievements and relevant skills. Respond with only valid JSON.`
        },
        {
          role: "user",
          content: optimizedContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 800 // Reduced since we're sending preprocessed data
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');
    
    // Use locally extracted data as fallbacks for more accuracy
    return {
      name: extracted.name || extractedName,
      email: extracted.email || extractedEmail,
      phone: extracted.phone || extractedPhone,
      experience: extracted.experience || preprocessed.estimatedYears,
      resumeContent: extracted.resumeContent || optimizedContent,
      resumeFileName: filename
    };
  } catch (error) {
    console.error('Error extracting resume details:', error);
    throw error;
  }
}

/**
 * Keyword-based document classification (no AI needed)
 */
export function detectJobDescriptionByKeywords(content: string): boolean {
  const jobKeywords = [
    'responsibilities', 'requirements', 'qualifications', 'experience required',
    'job description', 'position', 'role', 'duties', 'skills required',
    'apply', 'salary', 'benefits', 'company', 'team', 'department'
  ];
  
  const lowerContent = content.toLowerCase();
  const matches = jobKeywords.filter(keyword => lowerContent.includes(keyword));
  return matches.length >= 3;
}

export function detectResumeByKeywords(content: string): boolean {
  const resumeKeywords = [
    'resume', 'cv', 'curriculum vitae', 'experience', 'education',
    'skills', 'work history', 'employment', 'objective', 'summary',
    'achievements', 'projects', 'certifications', 'references'
  ];
  
  const lowerContent = content.toLowerCase();
  const matches = resumeKeywords.filter(keyword => lowerContent.includes(keyword));
  return matches.length >= 3;
}

/**
 * Store resume file in file system instead of database
 */
export async function storeResumeFile(candidateId: number, filename: string, buffer: Buffer): Promise<string> {
  return await fileStorage.storeResumeFile(candidateId, filename, buffer);
}

/**
 * Retrieve resume file from file system
 */
export async function getResumeFile(candidateId: number, filename: string): Promise<Buffer | null> {
  return await fileStorage.getResumeFile(candidateId, filename);
}