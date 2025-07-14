import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const testJob = {
  title: "C Programmer",
  description: "We are seeking a skilled C programmer to develop system-level software for our embedded products. The ideal candidate will have experience with low-level programming, memory management, and performance optimization. You will be working on firmware development and system integration projects.",
  experienceLevel: "Mid-level",
  jobType: "Full-time",
  keywords: "C programming, systems programming, firmware, embedded systems, memory management, performance optimization"
};

const testCandidate = {
  name: "Alex Rodriguez",
  experience: 6,
  resumeContent: `ALEX RODRIGUEZ
Embedded Systems Engineer

EXPERIENCE:
Senior Embedded Engineer | TechCorp | 2019-2024
- Developed device drivers for UART, USB, SPI, and I2C peripherals on ARM Cortex-M microcontrollers
- Implemented thread-safe communication protocols for real-time systems running on FreeRTOS
- Optimized memory allocation and interrupt handling for resource-constrained environments
- Led firmware development for IoT devices with strict power consumption requirements

Embedded Software Developer | StartupTech | 2018-2019
- Built bootloaders and flash memory management systems for automotive ECUs
- Developed custom communication stacks for CAN bus and LIN protocols
- Implemented diagnostic protocols and over-the-air update mechanisms

SKILLS:
- Microcontroller programming (ARM, AVR, PIC)
- Real-time operating systems (FreeRTOS, ThreadX)
- Hardware interfaces (UART, SPI, I2C, CAN, USB)
- Development tools (GCC, Keil, IAR, Git)
- Protocol development and optimization`
};

async function demonstrateAIMatching() {
  console.log("=== AI MATCHING DEMONSTRATION ===\n");
  
  console.log("📋 JOB POSTING:");
  console.log(`Title: ${testJob.title}`);
  console.log(`Description: ${testJob.description.substring(0, 150)}...`);
  console.log(`Keywords: ${testJob.keywords}\n`);
  
  console.log("👤 CANDIDATE PROFILE:");
  console.log(`Name: ${testCandidate.name}`);
  console.log(`Experience: ${testCandidate.experience} years`);
  console.log(`Key Skills: Device drivers, UART/USB/SPI, ARM microcontrollers, FreeRTOS\n`);
  
  const prompt = `
You are an expert HR AI assistant that analyzes job requirements and candidate profiles with advanced multi-criteria matching, with special emphasis on keyword recency and skill currency.

Job Position: ${testJob.title}
Job Description: ${testJob.description}
Required Experience Level: ${testJob.experienceLevel}
Job Type: ${testJob.jobType}
Keywords: ${testJob.keywords}

Candidate Profile:
Name: ${testCandidate.name}
Experience: ${testCandidate.experience} years
Resume Content: ${testCandidate.resumeContent}

ANALYSIS CRITERIA (Rate each from 0-100):

1. SKILLS MATCH (Weight: 30%):
   - Technical skills alignment with job requirements
   - Programming languages/tools match
   - Specialized competencies and certifications

2. EXPERIENCE LEVEL (Weight: 20%):
   - Years of experience vs requirements
   - Seniority level appropriateness
   - Career progression alignment

3. KEYWORD RELEVANCE & RECENCY (Weight: 35%):
   - Job keywords present in resume
   - CRITICAL: How recently has the candidate worked with these keywords/skills?
   - Skills used 0-2 years ago: 100% relevance
   - Skills used 3-5 years ago: 70% relevance
   - Skills used 6-8 years ago: 40% relevance
   - Skills used 8+ years ago: 20% relevance or lower
   - Industry terminology usage and domain-specific language
   - Current technology stack vs outdated technologies

4. EDUCATION MATCH (Weight: 10%):
   - Educational background relevance
   - Degree level appropriateness
   - Recent certifications and continuous learning

5. INDUSTRY EXPERIENCE (Weight: 5%):
   - Relevant industry background
   - Domain knowledge currency
   - Recent sector-specific experience

IMPORTANT: When evaluating keyword relevance, heavily penalize outdated skills. A candidate who worked with React 8 years ago but hasn't touched it recently should score much lower than someone who used React last year, even if both mention it on their resume.

Provide detailed analysis with specific attention to skill recency and currency.

Respond in JSON format with:
{
  "criteriaScores": {
    "skillsMatch": number,
    "experienceLevel": number,
    "keywordRelevance": number,
    "educationMatch": number,
    "industryExperience": number
  },
  "overallMatchPercentage": number,
  "detailedReasoning": "comprehensive explanation including skill recency analysis",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendations": "hiring recommendation with focus on skill currency"
}
`;

  try {
    console.log("🤖 Analyzing with OpenAI GPT-3.5-turbo...\n");
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2500,
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log("🎯 MATCHING RESULTS:");
    console.log(`Overall Match Score: ${result.overallMatchPercentage}%\n`);
    
    console.log("📊 Criteria Breakdown:");
    console.log(`• Skills Match: ${result.criteriaScores.skillsMatch}/100`);
    console.log(`• Experience Level: ${result.criteriaScores.experienceLevel}/100`);
    console.log(`• Keyword Relevance: ${result.criteriaScores.keywordRelevance}/100`);
    console.log(`• Education Match: ${result.criteriaScores.educationMatch}/100`);
    console.log(`• Industry Experience: ${result.criteriaScores.industryExperience}/100\n`);
    
    console.log("✅ Key Strengths:");
    result.strengths?.forEach((strength: string) => console.log(`• ${strength}`));
    
    console.log("\n⚠️ Potential Concerns:");
    result.concerns?.forEach((concern: string) => console.log(`• ${concern}`));
    
    console.log("\n💡 AI Reasoning:");
    console.log(result.detailedReasoning);
    
    console.log("\n📋 Recommendation:");
    console.log(result.recommendations);
    
  } catch (error) {
    console.error("❌ Error during AI analysis:", error.message);
  }
}

demonstrateAIMatching();