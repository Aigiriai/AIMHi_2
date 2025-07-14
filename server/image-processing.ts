import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface ExtractedResumeData {
  name: string;
  email: string;
  phone: string;
  experience: number;
  resumeContent: string;
}

export async function extractResumeDataFromImage(imageBuffer: Buffer): Promise<ExtractedResumeData> {
  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-optimized model for image processing
      messages: [
        {
          role: "system",
          content: `You are an expert resume parser. Analyze the resume image and extract key information. 
          Return the data in JSON format with these exact fields:
          - name: Full name of the candidate
          - email: Email address 
          - phone: Phone number (include country code if visible)
          - experience: Number of years of total work experience (as a number)
          - resumeContent: A concise summary of the resume including key skills, education, work history (max 600 words)
          
          If any field is not clearly visible or missing, use reasonable defaults:
          - name: "Unknown Candidate"
          - email: "no-email@provided.com"
          - phone: "No phone provided"
          - experience: 0
          - resumeContent: should always contain what you can see in the image`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the resume information from this image and return it in the specified JSON format."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800 // Reduced token limit for cost optimization
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      name: result.name || "Unknown Candidate",
      email: result.email || "no-email@provided.com", 
      phone: result.phone || "No phone provided",
      experience: Math.max(0, parseInt(result.experience) || 0),
      resumeContent: result.resumeContent || "Resume content could not be extracted from image"
    };
  } catch (error) {
    console.error("Image processing error:", error);
    throw new Error(`Failed to process resume image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}