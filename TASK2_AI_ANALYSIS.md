# Task 2: AIM Hi AI Matching Core Logic Analysis

## 🎯 OBJECTIVE: Extract and document AI matching algorithm for Python conversion

### Core AI Matching Components to Analyze:

1. **Primary Matching Function**: `matchCandidateToJob()`
2. **Scoring Criteria**: Skills, Experience, Keywords, Professional Depth, Domain Experience  
3. **Weight Calculations**: Mathematical weighted sum algorithms
4. **OpenAI Integration**: Prompt engineering and response processing
5. **Error Handling**: Fallback mechanisms and validation

### Core AI Matching Architecture Discovered:

#### 1. **Primary Entry Point**: `matchCandidateToJob(job, candidate, weights?)`
- **Input**: Job, Candidate objects, optional weight customization
- **Output**: DetailedMatchResult with comprehensive analysis
- **Models**: GPT-4o-mini for consistency, GPT-3.5-turbo for requirements extraction

#### 2. **Scoring Criteria** (5-dimensional analysis):
```typescript
interface MatchCriteria {
  skillsMatch: number;        // 25% weight - Tools, certifications, competencies  
  experienceLevel: number;    // 15% weight - Years, seniority, progression
  keywordRelevance: number;   // 25% weight - Keywords + recency analysis
  professionalDepth: number;  // 15% weight - Specialist vs generalist
  domainExperience: number;   // 20% weight - Industry-specific background
}
```

#### 3. **Key Algorithm Components**:
- **Content Normalization**: Hash-based consistent seed generation
- **Pre-filtering**: Critical requirements validation before expensive AI calls
- **Recency Analysis**: Employment date parsing (2023-Present = 100%, 2020-2022 = 80%)
- **Mathematical Weights**: Pure weighted sum calculation (not AI-suggested percentage)

#### 4. **OpenAI Integration Pattern**:
- **Requirements Extraction**: GPT-3.5-turbo with JSON response format
- **Detailed Matching**: GPT-4o-mini with content-based seeding for determinism
- **Error Handling**: Fallback to regex-based requirement extraction
- **Timeout Protection**: 30-second timeout with Promise.race

#### 5. **Response Structure**:
```typescript
interface DetailedMatchResult {
  candidateId: number;
  matchPercentage: number;     // Calculated via weighted sum
  reasoning: string;
  criteriaScores: MatchCriteria;
  weightedScores: MatchCriteria;
  skillAnalysis: {             // Detailed breakdown per criteria
    [criterion]: {
      skillsHas: string[];
      skillsMissing: string[];
      criteriaExplanation: string;
    }
  };
}
```

### Python Conversion Requirements:

#### **Critical Functions to Port**:
1. `matchCandidateToJob()` - Main orchestration function
2. `extractCriticalRequirements()` - AI-based job requirement extraction  
3. `normalizeResumeContent()` - Content preprocessing
4. `generateContentHash()` - Deterministic seeding
5. `extractFallbackRequirements()` - Regex-based fallback

#### **Dependencies Needed**:
- `openai` Python client
- `json` for response parsing
- `hashlib` for content hashing  
- `re` for regex fallback extraction
- `asyncio` for async OpenAI calls

#### **Key Conversion Challenges**:
- TypeScript interfaces → Python dataclasses/Pydantic models
- Promise-based async → Python async/await
- JavaScript string methods → Python string operations
- Error handling patterns → Python exception handling

### Python Implementation Completed:

#### **Created**: `ai_matching_engine.py` 
- ✅ **Complete Python port** of TypeScript AI matching logic
- ✅ **Async/await patterns** for OpenAI API integration
- ✅ **Dataclass models** replacing TypeScript interfaces
- ✅ **Exception handling** with proper error recovery
- ✅ **Deterministic seeding** using hashlib for consistent results

#### **Key Features Ported**:
1. **AIMHiMatchingEngine** class with full functionality
2. **Five-dimensional scoring** (Skills, Experience, Keywords, Depth, Domain)
3. **Pre-filtering logic** to reduce API costs
4. **Mathematical weighted calculations** (not AI-suggested percentages)
5. **Comprehensive error handling** with fallback mechanisms

#### **Frappe HRMS Integration Ready**:
- Input expects Frappe DocType dictionaries (Job Opening, Job Applicant)
- Output provides DetailedMatchResult compatible with Frappe custom fields
- Async architecture ready for Frappe server scripts
- Configurable weights for organizational customization

---
**Status**: TASK 2 COMPLETED ✅  
**Ready for**: Task 3 - Design Frappe HRMS integration architecture  
**Python Engine**: Ready for custom app integration