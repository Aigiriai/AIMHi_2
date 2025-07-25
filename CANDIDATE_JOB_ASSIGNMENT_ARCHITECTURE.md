# Candidate-Job Assignment Architecture Design

## Current Challenge
Managing many-to-many relationships between:
- **1 candidate** ↔ **multiple jobs** (candidate can apply to multiple positions)
- **1 job** ↔ **multiple candidates** (job can have multiple applicants)  
- **1 user** ↔ **multiple candidates** (user can manage multiple candidates)
- **1 user** ↔ **multiple jobs** (user can manage multiple jobs)

## Current System State

### Assignment Tables (Permission Layer)
```
candidateAssignments: userId ↔ candidateId (role: owner/assigned/viewer)
jobAssignments: userId ↔ jobId (role: owner/assigned/viewer)
```

### Application Table (Pipeline Layer)
```
applications: candidateId ↔ jobId (status: new/screening/interview/decided)
```

### Current Data (Organization 4)
- **Manager (User 5):** 2 candidates + 3 jobs = 6 potential applications
- **Team Lead (User 6):** 4 candidates + 2 jobs = 8 potential applications  
- **Recruiter (User 7):** 0 candidates + 2 jobs = 0 potential applications

## Proposed Solutions

### Option 1: Manual Application Creation (Recommended)
**Concept:** Assignments grant permission to work on candidates/jobs, but applications are manually created for active hiring processes.

**Workflow:**
1. **Assignment Phase:** Users get assigned candidates and jobs (current system)
2. **Application Creation:** Users manually create applications for relevant candidate-job combinations
3. **Pipeline Management:** Applications move through pipeline stages independently

**Benefits:**
- Clear separation between "talent pool" (candidates) and "active hiring" (applications)
- Users control which candidates actively apply for which jobs
- Prevents pipeline clutter with inactive combinations
- Maintains audit trail of application decisions

**Implementation:**
```sql
-- Add "Create Application" functionality
-- Applications created manually via UI button
-- Each application represents active candidate interest in specific job
```

### Option 2: Automatic Application Generation
**Concept:** When user has both candidate and job assignments, auto-create applications.

**Workflow:**
1. **Assignment Phase:** Users get assigned candidates and jobs
2. **Auto-Creation:** System automatically creates applications for all candidate-job combinations
3. **Pipeline Management:** All combinations appear in pipeline

**Challenges:**
- Creates too many applications (User 6 would get 8 applications automatically)
- Pipeline becomes cluttered with inactive combinations
- No indication of actual candidate interest vs. theoretical matches

### Option 3: Hybrid Approach  
**Concept:** Smart auto-creation based on AI matching scores + manual override.

**Workflow:**
1. **Assignment Phase:** Users get assigned candidates and jobs
2. **Smart Creation:** Auto-create applications only for high-match candidates (>80% AI score)
3. **Manual Addition:** Users can manually create additional applications
4. **Pipeline Management:** Mix of automatic and manual applications

## Recommended Implementation: Option 1 (Manual)

### Why Manual is Best:
1. **User Control:** Users decide which candidates to actively pursue for which jobs
2. **Quality over Quantity:** Pipeline shows only serious applications, not theoretical matches
3. **Real-world Workflow:** Mimics actual recruitment process where applications are intentional
4. **Scalability:** Prevents exponential growth of applications as org grows

### UI/UX Design:

#### 1. Candidate Listings Page
```
[Candidate Name] [Email] [Experience] [Assign to Job ▼] [Actions ▼]
                                      ↳ Job 1
                                      ↳ Job 2  
                                      ↳ Job 3
```

#### 2. Job Listings Page  
```
[Job Title] [Status] [Applications] [Add Candidate ▼] [Actions ▼]
                                    ↳ Candidate 1
                                    ↳ Candidate 2
                                    ↳ Candidate 3
```

#### 3. AI Matching Integration
```
[Run AI Matching] → Shows best candidate-job matches → [Create Application] buttons
```

### Database Schema (No Changes Needed)
Current schema supports this perfectly:
- `candidateAssignments` = Permission to work on candidates
- `jobAssignments` = Permission to work on jobs  
- `applications` = Active hiring processes (manually created)

### API Endpoints to Add:
```
POST /api/applications - Create new application (candidate + job)
GET /api/applications/suggestions - AI-suggested candidate-job matches
DELETE /api/applications/:id - Remove application
```

## Implementation Plan

### Phase 1: Add Application Creation UI
1. **Candidate Page:** Add "Apply to Job" dropdown for each candidate
2. **Job Page:** Add "Add Candidate" dropdown for each job
3. **AI Matching Page:** Add "Create Application" buttons for top matches

### Phase 2: Enhanced Pipeline Management  
1. **Application Cards:** Show candidate name, job title, match %, current stage
2. **Bulk Operations:** Create multiple applications from AI matches
3. **Application History:** Track when applications were created and by whom

### Phase 3: Smart Suggestions
1. **Auto-Suggestions:** Show high-match candidate-job pairs with "Create Application" buttons
2. **Duplicate Prevention:** Warn if application already exists for candidate-job pair
3. **Match Score Integration:** Show AI match percentage on application creation

## Benefits of This Approach

1. **Clear Separation:** Assignments = permissions, Applications = active hiring
2. **User Intent:** Applications represent actual hiring intent, not theoretical matches  
3. **Pipeline Quality:** Only serious applications appear in pipeline stages
4. **Scalable:** System performance doesn't degrade with large talent pools
5. **Audit Trail:** Clear history of who created which applications when
6. **Flexible:** Users can create applications for any candidate-job combination they have access to

## Next Steps

1. **Confirm Approach:** Get user approval for manual application creation approach
2. **Build UI Components:** Application creation dropdowns and buttons
3. **API Development:** Application CRUD endpoints with permission validation
4. **Integration:** Connect with existing pipeline and assignment systems
5. **Testing:** Verify workflow with realistic data scenarios