// Test script to demonstrate AI matching capabilities
import { matchCandidateToJob } from './server/ai-matching.js';

const testJob = {
  id: 1,
  title: "C Programmer",
  description: "We are seeking a skilled C programmer to develop system-level software for our embedded products. The ideal candidate will have experience with low-level programming, memory management, and performance optimization. You will be working on firmware development and system integration projects.",
  experienceLevel: "Mid-level",
  jobType: "Full-time",
  keywords: "C programming, systems programming, firmware, embedded systems, memory management, performance optimization"
};

const testCandidate = {
  id: 1,
  name: "Alex Rodriguez",
  email: "alex.rodriguez@email.com",
  experience: 6,
  resumeContent: `ALEX RODRIGUEZ
Embedded Systems Engineer

EXPERIENCE:

Senior Embedded Engineer | TechCorp | 2019-2024
- Developed device drivers for UART, USB, SPI, and I2C peripherals on ARM Cortex-M microcontrollers
- Implemented thread-safe communication protocols for real-time systems running on FreeRTOS
- Optimized memory allocation and interrupt handling for resource-constrained environments
- Led firmware development for IoT devices with strict power consumption requirements
- Collaborated with hardware team on PCB design and signal integrity analysis

Embedded Software Developer | StartupTech | 2018-2019
- Built bootloaders and flash memory management systems for automotive ECUs
- Developed custom communication stacks for CAN bus and LIN protocols
- Implemented diagnostic protocols and over-the-air update mechanisms
- Worked extensively with debugging tools like JTAG, oscilloscopes, and logic analyzers

EDUCATION:
B.S. Electrical Engineering | State University | 2018

SKILLS:
- Microcontroller programming (ARM, AVR, PIC)
- Real-time operating systems (FreeRTOS, ThreadX)
- Hardware interfaces (UART, SPI, I2C, CAN, USB)
- Development tools (GCC, Keil, IAR, Git)
- Protocol development and optimization
- Power management and low-power design
- Hardware debugging and validation`
};

async function testMatching() {
  console.log("=== AI MATCHING DEMONSTRATION ===\n");
  
  console.log("JOB DESCRIPTION:");
  console.log(`Title: ${testJob.title}`);
  console.log(`Keywords: ${testJob.keywords}`);
  console.log(`\nDescription: ${testJob.description}\n`);
  
  console.log("CANDIDATE RESUME:");
  console.log(`Name: ${testCandidate.name}`);
  console.log(`Experience: ${testCandidate.experience} years`);
  console.log(`Resume excerpt: ${testCandidate.resumeContent.substring(0, 200)}...\n`);
  
  try {
    const result = await matchCandidateToJob(testJob, testCandidate);
    
    console.log("=== AI ANALYSIS RESULTS ===");
    console.log(`Overall Match: ${result.matchPercentage}%`);
    console.log(`\nCriteria Breakdown:`);
    console.log(`- Skills Match: ${result.criteriaScores.skillsMatch}/100`);
    console.log(`- Experience Level: ${result.criteriaScores.experienceLevel}/100`);
    console.log(`- Keyword Relevance: ${result.criteriaScores.keywordRelevance}/100`);
    console.log(`- Education Match: ${result.criteriaScores.educationMatch}/100`);
    console.log(`- Industry Experience: ${result.criteriaScores.industryExperience}/100`);
    
    console.log(`\nWeighted Scores (with recency focus):`);
    console.log(`- Skills (30%): ${result.weightedScores.skillsMatch.toFixed(1)}`);
    console.log(`- Experience (20%): ${result.weightedScores.experienceLevel.toFixed(1)}`);
    console.log(`- Keywords (35%): ${result.weightedScores.keywordRelevance.toFixed(1)}`);
    console.log(`- Education (10%): ${result.weightedScores.educationMatch.toFixed(1)}`);
    console.log(`- Industry (5%): ${result.weightedScores.industryExperience.toFixed(1)}`);
    
    console.log(`\nAI Reasoning:`);
    console.log(result.reasoning);
    
  } catch (error) {
    console.error("Error testing AI matching:", error.message);
  }
}

testMatching();